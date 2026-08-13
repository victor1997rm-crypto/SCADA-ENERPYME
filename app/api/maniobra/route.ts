import { NextRequest, NextResponse } from 'next/server';
import { agregarManiobra, obtenerManiobrasDesde, sessionExiste } from '@/lib/store';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { code, pagina, equipo, tag, antes, despues } = body || {};
  if (!code || !pagina || !equipo || !antes || !despues) {
    return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });
  }
  if (!(await sessionExiste(code))) {
    return NextResponse.json({ error: 'Sesión no existe o expiró' }, { status: 404 });
  }
  await agregarManiobra(code, {
    pagina, equipo, tag: tag ?? null, antes, despues, ts: Date.now(),
  });
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const desdeStr = req.nextUrl.searchParams.get('desde') ?? '0';
  const desde = parseInt(desdeStr, 10) || 0;
  if (!code) return NextResponse.json({ error: 'Falta code' }, { status: 400 });
  if (!(await sessionExiste(code))) {
    return NextResponse.json({ error: 'Sesión no existe o expiró' }, { status: 404 });
  }
  const maniobras = await obtenerManiobrasDesde(code, desde);
  return NextResponse.json({ maniobras, siguienteDesde: desde + maniobras.length });
}
