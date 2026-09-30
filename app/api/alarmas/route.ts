import { NextRequest, NextResponse } from 'next/server';
import { agregarAlarmas, obtenerAlarmasDesde, sessionExiste, AlarmaRuido } from '@/lib/store';

/* Ruido de fondo de la pantalla de alarmas: la ventana del operador lo publica
   (POST) y la ventana del supervisor lo consulta por polling (GET), igual
   patron que /api/maniobra. */

const CLASES = ['normal', 'red', 'teal', 'bright'];
const txt = (v: unknown, max: number) => (typeof v === 'string' ? v : '').slice(0, max);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { code, alarmas } = body || {};
  if (!code || !Array.isArray(alarmas)) {
    return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });
  }
  if (!(await sessionExiste(code))) {
    return NextResponse.json({ error: 'Sesión no existe o expiró' }, { status: 404 });
  }
  const limpias: AlarmaRuido[] = alarmas.slice(0, 100).map((a: any) => ({
    dt: txt(a?.dt, 24),
    origin: txt(a?.origin, 60),
    desc: txt(a?.desc, 160),
    event: txt(a?.event, 60),
    value: txt(a?.value, 60),
    cls: CLASES.includes(a?.cls) ? a.cls : 'normal',
  }));
  await agregarAlarmas(code, limpias);
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const desdeStr = req.nextUrl.searchParams.get('desde') ?? '0';
  const desde = parseInt(desdeStr, 10) || 0;
  if (!code) return NextResponse.json({ error: 'Falta code' }, { status: 400 });
  const alarmas = await obtenerAlarmasDesde(code, desde);
  return NextResponse.json({ alarmas, siguienteDesde: desde + alarmas.length });
}
