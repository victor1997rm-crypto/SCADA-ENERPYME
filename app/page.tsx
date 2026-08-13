export default function Home() {
  return (
    <main style={{ fontFamily: "Arial, sans-serif", padding: 40, background: "#060a0f", color: "#c8e8f0", minHeight: "100vh" }}>
      <h1 style={{ color: "#7ee8ff" }}>SCADA Monitor — Ammper Energía</h1>
      <p>Elige una pantalla:</p>
      <ul>
        <li><a href="/operador.html" style={{ color: "#00ee66" }}>Pantalla del operador</a></li>
        <li><a href="/monitor.html" style={{ color: "#7ee8ff" }}>Pantalla de monitoreo</a></li>
      </ul>
    </main>
  );
}
