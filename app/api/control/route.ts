import { NextRequest, NextResponse } from 'next/server';
import { obtenerControl, setControl, resetSesion, sessionExiste, obtenerManiobrasDesde } from '@/lib/store';
import type { ControlState } from '@/lib/store';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.json({ error: 'Falta code' }, { status: 400 });
  if (!(await sessionExiste(code))) {
    return NextResponse.json({ error: 'Sesión no existe o expiró' }, { status: 404 });
  }
  const control = await obtenerControl(code);
  return NextResponse.json({ control });
}

export async function POST(req: NextRequest) {
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

  return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
}
