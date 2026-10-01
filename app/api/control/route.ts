import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { obtenerControl, setControl, resetSesion, sessionExiste, obtenerManiobrasDesde, agregarManiobra } from '@/lib/store';
import type { ControlState } from '@/lib/store';

// Cuchillas de puesta a tierra que SOLO opera el supervisor (lista blanca por pagina).
const TIERRAS: Record<string, string[]> = {
  '400kV': ['cu-tr'],
  '115kV': ['cu-tr-73c17', 'cu-tr-73c19'],
  '345kV': ['ct1', 'ct2', 'ct3', 'ct4'],
  'PYM': ['customct_1790185554956_8', 'customct_1790185610265_10', 'customct_1790182589192_1', 'customct_1790179671531_4', 'customct_1790179622079_1', 'customct_1790179670824_3', 'customct_1790180006988_6', 'customct_1790180005694_5', 'customct_1790180084958_7'],
};

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.json({ error: 'Falta code' }, { status: 400 });
  if (!(await sessionExiste(code))) {
    return NextResponse.json({ error: 'Sesión no existe o expiró' }, { status: 404 });
  }
  const control = await obtenerControl(code);
  return NextResponse.json({ control });
}

// Clave de supervisor: se guarda SOLO en la variable de entorno SUPERVISOR_PIN (Vercel),
// nunca en el codigo. La pagina del supervisor la manda en el encabezado x-supervisor-pin.
function revisarClave(req: NextRequest): 'ok' | 'sin-config' | 'incorrecta' {
  const esperada = process.env.SUPERVISOR_PIN || '';
  if (!esperada) return 'sin-config';
  let recibida = req.headers.get('x-supervisor-pin') || '';
  try { recibida = decodeURIComponent(recibida); } catch { /* se compara tal cual */ }
  const a = Buffer.from(recibida);
  const b = Buffer.from(esperada);
  if (a.length !== b.length) return 'incorrecta';
  return timingSafeEqual(a, b) ? 'ok' : 'incorrecta';
}

export async function POST(req: NextRequest) {
  const clave = revisarClave(req);
  if (clave === 'sin-config') {
    return NextResponse.json({ error: 'Falta configurar SUPERVISOR_PIN en Vercel' }, { status: 503 });
  }
  if (clave === 'incorrecta') {
    await new Promise((r) => setTimeout(r, 600));   // frena los intentos de adivinar la clave
    return NextResponse.json({ error: 'Clave de supervisor incorrecta' }, { status: 401 });
  }

  const body = await req.json();
  const { code, accion } = body || {};
  if (!code || !accion) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });
  if (!(await sessionExiste(code))) {
    return NextResponse.json({ error: 'Sesión no existe o expiró' }, { status: 404 });
  }

  if (accion === 'conectar') {
    const actual = await obtenerControl(code);
    const control: ControlState = { ...actual, supervisorConectado: true };
    await setControl(code, control);
    return NextResponse.json({ control });
  }

  if (accion === 'iniciar') {
    const control: ControlState = { estado: 'grabando', inicioTs: Date.now(), finTs: null };
    await setControl(code, control);
    return NextResponse.json({ control });
  }

  if (accion === 'finalizar') {
    const actual = await obtenerControl(code);
    const finTs = Date.now();
    // La falla (y su aprobación) se conservan para el registro de la sesión.
    const control: ControlState = { estado: 'finalizado', inicioTs: actual.inicioTs, finTs, falla: actual.falla };
    await setControl(code, control);

    const duracionMs = actual.inicioTs ? finTs - actual.inicioTs : 0;
    // Maniobras realizadas dentro de la ventana [inicioTs, finTs].
    const todas = await obtenerManiobrasDesde(code, 0);
    const delEjercicio = actual.inicioTs
      ? todas.filter((m) => m.ts >= actual.inicioTs! && m.ts <= finTs)
      : [];

    return NextResponse.json({ control, duracionMs, maniobras: delEjercicio });
  }

  if (accion === 'reset') {
    // resetSesion ya guarda resetTs:Date.now() (ver lib/store.ts) — es la
    // señal que el operador detecta en su polling para recargar solo.
    await resetSesion(code);
    const control = await obtenerControl(code);
    return NextResponse.json({ control });
  }

  if (accion === 'falla') {
    // El supervisor dispara la falla simulada. Solo con el ejercicio en curso.
    const actual = await obtenerControl(code);
    if (actual.estado !== 'grabando') {
      return NextResponse.json({ error: 'El ejercicio no está en curso' }, { status: 409 });
    }
    const caso = Number(body.caso) || 1;
    if (caso !== 1) {
      return NextResponse.json({ error: 'Caso no reconocido' }, { status: 400 });
    }
    const ahora = Date.now();
    const control: ControlState = { ...actual, falla: { id: ahora, caso, ts: ahora } };
    await setControl(code, control);
    return NextResponse.json({ control });
  }

  if (accion === 'cancelar-falla') {
    // El supervisor confirma que el operador siguió el procedimiento: la falla
    // persistente en A38K0 se libera y el operador ya puede cerrarlo.
    const actual = await obtenerControl(code);
    if (!actual.falla || actual.falla.canceladaTs) {
      return NextResponse.json({ error: 'No hay falla activa' }, { status: 409 });
    }
    const control: ControlState = { ...actual, falla: { ...actual.falla, canceladaTs: Date.now() } };
    await setControl(code, control);
    return NextResponse.json({ control });
  }

  if (accion === 'tierra') {
    // El supervisor opera una cuchilla de puesta a tierra; el operador la recibe por
    // el mismo polling de /api/control (sin consultas nuevas) y queda en el registro.
    const { pagina, equipo, despues, tag } = body;
    const actual = await obtenerControl(code);
    if (actual.estado !== 'grabando') {
      return NextResponse.json({ error: 'El ejercicio no está en curso' }, { status: 409 });
    }
    if (!(TIERRAS[pagina] || []).includes(equipo) || (despues !== 'ABIERTO' && despues !== 'CERRADO')) {
      return NextResponse.json({ error: 'Cuchilla no permitida' }, { status: 400 });
    }
    const previas = actual.tierras || [];
    const id = Math.max(Date.now(), (previas.length ? previas[previas.length - 1].id : 0) + 1);
    const tierras = [...previas, { id, pagina, equipo, despues }].slice(-30);
    await setControl(code, { ...actual, tierras });
    await agregarManiobra(code, {
      pagina, equipo, tag: typeof tag === 'string' ? tag : null,
      antes: despues === 'CERRADO' ? 'ABIERTO' : 'CERRADO', despues, ts: Date.now(), origen: 'supervisor',
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
}
