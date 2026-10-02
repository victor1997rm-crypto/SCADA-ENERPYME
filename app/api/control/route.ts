import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { obtenerControl, setControl, resetSesion, sessionExiste, obtenerManiobrasDesde, agregarManiobra } from '@/lib/store';
import type { ControlState, CondicionInicialItem } from '@/lib/store';

// Equipos que SOLO opera el supervisor (lista blanca por pagina): cuchillas de puesta a tierra y, en
// 'ODS' / 'ODT', sus interruptores y cuchillas, que aun no tienen diagrama y se ven solo en el MIMICO.
const TIERRAS: Record<string, string[]> = {
  '400kV': ['cu-tr'],
  '115kV': ['cu-tr-73c17', 'cu-tr-73c19'],
  '345kV': ['ct1', 'ct2', 'ct3', 'ct4'],
  'ODS': ['INT19', 'CUC42', 'CUC74', 'CUC41', 'PT14', 'INT23', 'CUC43', 'CUC75', 'CUC44', 'PT15', 'INT22', 'CUC36', 'CUC77', 'CUC37', 'PT18', 'INT41', 'CUC78', 'CUC79', 'INT20', 'CUC34', 'CUC76', 'CUC35', 'PT16', 'INT21', 'CUC38', 'CUC73', 'CUC39', 'PT17'],
  'ODT': ['INT27', 'CUC46', 'CUC64', 'CUC45', 'PT19', 'INT29', 'CUC49', 'CUC72', 'CUC50', 'PT23', 'INT32', 'INT30', 'CUC51', 'CUC71', 'CUC52', 'PT22', 'INT31', 'INT40', 'CUC65', 'CUC66', 'INT43', 'CUC48', 'CUC67', 'CUC47', 'PT20', 'INT39', 'CUC69', 'CUC68', 'CUC70', 'PT21', 'INT42'],
  'PYM': ['customct_1790185554956_8', 'customct_1790185610265_10', 'customct_1790182589192_1', 'customct_1790179671531_4', 'customct_1790179622079_1', 'customct_1790179670824_3', 'customct_1790180006988_6', 'customct_1790180005694_5', 'customct_1790180084958_7'],
};

const PAGINAS_VALIDAS = ['400kV', '115kV', '345kV', 'PYM', 'ODS', 'ODT'];

function sanearCondicionInicial(raw: unknown): CondicionInicialItem[] {
  if (!Array.isArray(raw)) return [];
  const salida: CondicionInicialItem[] = [];
  const vistos = new Set<string>();
  for (const it of raw.slice(0, 300)) {
    if (!it || typeof it !== 'object') continue;
    const { pagina, equipo, tag, antes, despues } = it as Record<string, unknown>;
    if (typeof pagina !== 'string' || !PAGINAS_VALIDAS.includes(pagina)) continue;
    if (typeof equipo !== 'string' || !/^[\w-]{1,80}$/.test(equipo)) continue;
    if (despues !== 'ABIERTO' && despues !== 'CERRADO') continue;
    const k = pagina + '|' + equipo;
    if (vistos.has(k)) continue;
    vistos.add(k);
    salida.push({
      pagina, equipo,
      tag: typeof tag === 'string' ? tag.slice(0, 60) : null,
      antes: antes === 'ABIERTO' || antes === 'CERRADO' ? antes : null,
      despues,
      tierra: (TIERRAS[pagina] || []).includes(equipo),   // se decide con la lista blanca del servidor
    });
  }
  return salida;
}

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
    // La condicion inicial viaja con el INICIAR: el operador la aplica en silencio (sin alarmas
    // ni registro de maniobra) antes de desbloquear su CTL. Vacia = condicion principal.
    const condicionInicial = sanearCondicionInicial(body.condicionInicial);
    const control: ControlState = { estado: 'grabando', inicioTs: Date.now(), finTs: null, condicionInicial };
    await setControl(code, control);
    return NextResponse.json({ control });
  }

  if (accion === 'finalizar') {
    const actual = await obtenerControl(code);
    const finTs = Date.now();
    // La falla (y su aprobación) se conservan para el registro de la sesión.
    const control: ControlState = {
      estado: 'finalizado', inicioTs: actual.inicioTs, finTs, falla: actual.falla,
      condicionInicial: actual.condicionInicial,   // se conserva para el registro de la sesion
    };
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
    // resetSesion deja el control limpio (sin condicionInicial): la siguiente prueba arranca
    // en la condicion principal.
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
    if (![1, 2, 3, 4].includes(caso)) {
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
