# SCADA Monitor — Ammper Energía

Backend + pantallas para monitoreo remoto en vivo del simulador SCADA
(400kV / 115kV / 34.5kV). Un operador maniobra desde `/operador`, y
quien evalúa observa en tiempo real desde `/monitor` (con el panel
ENTRENADOR: INICIAR / FINALIZAR / RESET y cronómetro).

## Variables de entorno requeridas (Vercel → Settings → Environment Variables)

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

(Puedes usar la misma base de Redis de otro proyecto sin problema —
las llaves usan el prefijo `scadamon:` para no chocar con nada más.
Si quisieras cambiar el prefijo, hay una variable opcional
`REDIS_KEY_PREFIX`.)

Sin estas variables, el proyecto sigue corriendo (útil para probar
localmente) pero usando memoria del proceso en vez de Redis — es decir,
NO sirve para monitoreo entre dos ubicaciones distintas sin Redis.

## Desarrollo local

```bash
npm install
npm run dev
```

Abre `http://localhost:3000/operador.html` en una pestaña y
`http://localhost:3000/monitor.html` en otra.

## Despliegue en Vercel

1. Sube este proyecto a un repo de GitHub (o usa `vercel` CLI directo
   sin GitHub, con `npx vercel`).
2. En Vercel: **New Project** → importa el repo.
3. Antes de darle "Deploy", agrega las dos variables de entorno de
   arriba en **Environment Variables**.
4. Deploy.
5. Comparte `https://tu-proyecto.vercel.app/operador.html` con el
   operador, y `https://tu-proyecto.vercel.app/monitor.html` con quien
   va a evaluar (el código de sesión se genera solo y se lo pasas tú).

## Estructura

- `app/api/session` — crear/verificar código de sesión
- `app/api/maniobra` — el operador registra cada maniobra; el monitor
  las lee por polling (cada 1.2s)
- `app/api/control` — INICIAR / FINALIZAR / RESET del cronómetro,
  controlado desde `/monitor`
- `lib/store.ts` — capa de Redis (con fallback en memoria para pruebas
  locales sin credenciales)
- `public/operador.html` y `public/monitor.html` — las dos pantallas,
  generadas a partir del simulador SCADA original con dos scripts
  inyectados (uno por modo)
