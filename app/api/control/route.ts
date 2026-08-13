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

  if (accion === 'iniciar') {
    const control: ControlState = { estado: 'grabando', inicioTs: Date.now(), finTs: null };
    await setControl(code, control);
    return NextResponse.json({ control });
  }

  if (accion === 'finalizar') {
    const actual = await obtenerControl(code);
    const finTs = Date.now();
    const control: ControlState = { estado: 'finalizado', inicioTs: actual.inicioTs, finTs };
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
    await resetSesion(code);
    return NextResponse.json({ control: { estado: 'espera', inicioTs: null, finTs: null } });
  }

  return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
}
