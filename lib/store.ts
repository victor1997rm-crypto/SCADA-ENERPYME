import { Redis } from '@upstash/redis';

/* ============================================================
   Capa de almacenamiento para las sesiones de monitoreo en vivo.

   - En producción (Vercel) usa Upstash Redis, vía las variables de
     entorno UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN, que
     deben configurarse directamente en Vercel (nunca hardcodeadas
     aquí ni compartidas por chat).
   - Si esas variables no existen (ej. desarrollo local sin Redis
     configurado todavía), cae automáticamente a un store en
     memoria del propio proceso. Sirve para probar la lógica, pero
     OJO: no persiste entre despliegues ni sirve para monitoreo
     real entre dos ubicaciones — para eso se necesita Redis.
   ============================================================ */

export type Maniobra = {
  id: number;
  pagina: string;       // '400kV' | '115kV' | '345kV'
  equipo: string;       // id interno del elemento (ej. 'int1')
  tag: string | null;   // tag real SIVOC (ej. 'A2010') si existe
  antes: string;        // 'ABIERTO' | 'CERRADO'
  despues: string;      // 'ABIERTO' | 'CERRADO'
  ts: number;           // epoch ms
};

export type ControlState = {
  estado: 'espera' | 'grabando' | 'finalizado';
  inicioTs: number | null;
  finTs: number | null;
};

const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 horas

/* Prefijo de llaves: permite compartir la MISMA base de Redis con otros
   proyectos (ej. ammper-otr) sin que las llaves choquen entre sí. El
   token de Redis nunca sale del servidor (rutas /api/*), así que no hay
   riesgo de seguridad en reusar una base ya existente — esto es solo
   para namespacing, no para aislamiento por seguridad. */
const PREFIX = process.env.REDIS_KEY_PREFIX || 'scadamon';
function k(suffix: string): string {
  return `${PREFIX}:${suffix}`;
}

function hasRedisEnv(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

let _redis: Redis | null = null;
function redis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return _redis;
}

/* ---------- Fallback en memoria (solo desarrollo local) ---------- */
type MemSession = {
  maniobras: Maniobra[];
  control: ControlState;
  createdAt: number;
};
const memStore: Map<string, MemSession> = (globalThis as any).__scadaMemStore || new Map();
(globalThis as any).__scadaMemStore = memStore;

function memGetOrCreate(code: string): MemSession {
  let s = memStore.get(code);
  if (!s) {
    s = { maniobras: [], control: { estado: 'espera', inicioTs: null, finTs: null }, createdAt: Date.now() };
    memStore.set(code, s);
  }
  return s;
}

/* ---------- API pública del store (misma firma en ambos modos) ---------- */

export const usandoRedis = hasRedisEnv();

export async function sessionExiste(code: string): Promise<boolean> {
  if (hasRedisEnv()) {
    const v = await redis().get(k(`session:${code}:control`));
    return v !== null;
  }
  return memStore.has(code);
}

export async function crearSesion(code: string): Promise<void> {
  const control: ControlState = { estado: 'espera', inicioTs: null, finTs: null };
  if (hasRedisEnv()) {
    const r = redis();
    await r.set(k(`session:${code}:control`), JSON.stringify(control), { ex: SESSION_TTL_SECONDS });
    await r.del(k(`session:${code}:maniobras`));
    await r.expire(k(`session:${code}:maniobras`), SESSION_TTL_SECONDS);
    return;
  }
  memStore.set(code, { maniobras: [], control, createdAt: Date.now() });
}

export async function agregarManiobra(code: string, m: Omit<Maniobra, 'id'>): Promise<void> {
  if (hasRedisEnv()) {
    const r = redis();
    const len = await r.llen(k(`session:${code}:maniobras`));
    const item: Maniobra = { ...m, id: len };
    await r.rpush(k(`session:${code}:maniobras`), JSON.stringify(item));
    await r.expire(k(`session:${code}:maniobras`), SESSION_TTL_SECONDS);
    return;
  }
  const s = memGetOrCreate(code);
  s.maniobras.push({ ...m, id: s.maniobras.length });
}

export async function obtenerManiobrasDesde(code: string, desde: number): Promise<Maniobra[]> {
  if (hasRedisEnv()) {
    const r = redis();
    const raw = await r.lrange(k(`session:${code}:maniobras`), desde, -1);
    return raw.map((x) => (typeof x === 'string' ? JSON.parse(x) : x)) as Maniobra[];
  }
  const s = memGetOrCreate(code);
  return s.maniobras.slice(desde);
}

export async function obtenerControl(code: string): Promise<ControlState> {
  if (hasRedisEnv()) {
    const v = await redis().get(k(`session:${code}:control`));
    if (!v) return { estado: 'espera', inicioTs: null, finTs: null };
    return (typeof v === 'string' ? JSON.parse(v) : v) as ControlState;
  }
  return memGetOrCreate(code).control;
}

export async function setControl(code: string, control: ControlState): Promise<void> {
  if (hasRedisEnv()) {
    await redis().set(k(`session:${code}:control`), JSON.stringify(control), { ex: SESSION_TTL_SECONDS });
    return;
  }
  memGetOrCreate(code).control = control;
}

export async function resetSesion(code: string): Promise<void> {
  const control: ControlState = { estado: 'espera', inicioTs: null, finTs: null };
  if (hasRedisEnv()) {
    const r = redis();
    await r.set(k(`session:${code}:control`), JSON.stringify(control), { ex: SESSION_TTL_SECONDS });
    await r.del(k(`session:${code}:maniobras`));
    return;
  }
  memStore.set(code, { maniobras: [], control, createdAt: Date.now() });
}
