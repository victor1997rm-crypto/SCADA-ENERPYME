import { NextRequest, NextResponse } from 'next/server';
import { customAlphabet } from 'nanoid';
import { crearSesion, sessionExiste } from '@/lib/store';

/* Código corto, fácil de dictar por teléfono/WhatsApp: sin caracteres
   ambiguos (0/O, 1/I/L) y sin groserías accidentales en español. */
const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const generarCodigo = customAlphabet(alphabet, 6);

export async function POST() {
  let code = generarCodigo();
  // Extremadamente improbable, pero por si ya existe, reintenta unas veces.
  for (let i = 0; i < 5 && (await sessionExiste(code)); i++) {
    code = generarCodigo();
  }
  await crearSesion(code);
  return NextResponse.json({ code });
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.json({ error: 'Falta code' }, { status: 400 });
  const existe = await sessionExiste(code);
  return NextResponse.json({ existe });
}
