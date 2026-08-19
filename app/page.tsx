export const metadata = {
  title: "Simulador SCADA Ammper",
  description: "Acceso al simulador SCADA Ammper Energ\u00eda \u2014 S.E. ENERPYME",
};

export default function Home() {
  return (
    <>
      <style>{`

  :root{
    --bg:#060a0f;
    --cyan:#5fc9d6;
    --amber:#d9a34d;
    --red:#e02020;
    --text:#c8e8f0;
    --text-dim:#5f7c88;
  }
  *{box-sizing:border-box; -webkit-tap-highlight-color:transparent;}
  html{ min-height:100%; background:#060a0f; }
  html,body{margin:0;padding:0;min-height:100vh;background:#060a0f;font-family:Arial,sans-serif;color:var(--text);overflow-x:hidden;}

  #circuit{ position:fixed; inset:0; z-index:0; pointer-events:none; opacity:.5; background:#060a0f; }

  #page{
    position:relative; z-index:1;
    min-height:calc(100vh - 54px);
    background:#060a0f;
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    padding: 36px 20px 48px;
  }

  /* ── Header idéntico al del SCADA real ── */
  #scada-header{
    position:relative; width:100%; height:clamp(40px,8vw,54px); flex-shrink:0;
    background:#000; display:flex; align-items:center; overflow:hidden;
  }
  #scada-header::before{
    content:""; position:absolute; top:0; right:0; width:44%; height:100%;
    background:linear-gradient(to right, transparent 0%, #a01515 15%, #e02020 100%);
    z-index:0;
  }
  #header-left{ display:flex; align-items:center; gap:8px; padding-left:16px; z-index:2; position:relative; }
  #header-ammper-text{ height:clamp(22px,6vw,30px); width:auto; display:block; }
  #header-right-label{
    flex:1; z-index:2; position:relative;
    display:flex; align-items:center; justify-content:flex-end;
    padding-right:16px;
    font-family:'Arial Black',Arial,sans-serif; font-weight:900;
    font-size:clamp(10px,2.2vw,15px); color:#fff; letter-spacing:.08em;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  }

  /* ── Título principal — texto rojo sólido, sin bordes punteados ── */
  #title-tag{
    color:var(--red);
    font-family:'Arial Black',Arial,sans-serif;
    font-weight:900;
    font-size:clamp(19px,5vw,38px);
    letter-spacing:.06em;
    padding:0 10px 16px;
    text-align:center;
    text-shadow:0 0 18px rgba(224,32,32,.3);
    border-bottom:2px solid var(--red);
    margin-bottom:12px;
  }
  #subtitle{
    font-family:'Courier New',monospace;
    font-size:clamp(10px,2.2vw,13px);
    color:var(--text-dim);
    letter-spacing:.18em;
    text-transform:uppercase;
    text-align:center;
    margin: 6px 0 48px;
  }
  #subtitle .dot{ color:var(--cyan); }

  #selectors{
    display:flex; flex-wrap:wrap;
    gap:clamp(20px,4vw,40px);
    justify-content:center; align-items:stretch;
    width:100%; max-width:900px;
  }

  .role-card{
    flex:1 1 320px; max-width:380px;
    background:rgba(6,10,15,.6);
    border:1px solid var(--role-color, var(--cyan));
    padding:22px 22px 20px;
    text-decoration:none; color:inherit;
    display:flex; flex-direction:column; gap:12px;
    transition: background .18s ease, box-shadow .18s ease, transform .18s ease;
  }
  .role-card:hover, .role-card:focus-visible{
    background:rgba(255,255,255,.03);
    box-shadow:0 0 26px rgba(0,0,0,.5);
    transform:translateY(-2px);
    outline:none;
  }
  .role-card.op{ --role-color: var(--cyan); }
  .role-card.sup{ --role-color: var(--amber); }

  .role-top{ display:flex; align-items:center; justify-content:space-between; }
  .role-led{ width:9px;height:9px;border-radius:50%; background:var(--role-color); box-shadow:0 0 10px var(--role-color); flex-shrink:0; }
  .role-eyebrow{ font-family:'Courier New',monospace; font-size:10px; letter-spacing:.2em; text-transform:uppercase; color:var(--text-dim); }
  .role-title{
    font-family:'Arial Black',Arial,sans-serif; font-weight:900;
    font-size:22px; letter-spacing:.04em; color:var(--role-color);
    text-transform:uppercase;
  }
  .role-desc{ font-size:12.5px; line-height:1.6; color:var(--text-dim); font-family:Arial,sans-serif; }
  .role-status{
    margin-top:auto; padding-top:12px; border-top:1px solid rgba(255,255,255,.12);
    display:flex; align-items:center; justify-content:space-between;
    font-family:'Courier New',monospace; font-size:11px; letter-spacing:.1em;
  }
  .role-status .lbl{ color:var(--text-dim); }
  .role-status .val{ color:var(--role-color); font-weight:700; }
  .role-status .val::after{ content:" \\25B8"; }

  #foot{
    margin-top:clamp(36px,7vh,56px);
    font-family:'Courier New',monospace;
    font-size:10px; color:var(--text-dim); letter-spacing:.12em; text-align:center;
  }

  @media (prefers-reduced-motion: reduce){
    #title-tag{ animation:none; }
  }

      `}</style>
<div id="scada-header">
  <div id="header-left">
    <img id="header-ammper-text" src="data:image/png;base64,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" alt="Ammper" />
  </div>
  <div id="header-right-label">ACCESO AL SIMULADOR</div>
</div>

<svg id="circuit" preserveAspectRatio="none">
  <defs>
    <pattern id="grid" width="46" height="46" patternUnits="userSpaceOnUse">
      <path d="M46 0H0V46" fill="none" stroke="#123244" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#grid)"/>
</svg>

<div id="page">

  <div id="title-tag">SIMULADOR SCADA AMMPER</div>
  <div id="subtitle">S.E. ENERPYME</div>

  <div id="selectors">
    <a className="role-card op" href="/operador.html">
      <div className="role-top">
        <span className="role-eyebrow">Pantalla 1</span>
        <span className="role-led"></span>
      </div>
      <div className="role-title">Operador</div>
      <div className="role-desc">Maniobra el diagrama del SCADA: abre y cierra interruptores y cuchillas, y da seguimiento al estado de la subestación en vivo.</div>
      <div className="role-status"><span className="lbl">ESTADO</span><span className="val">ENTRAR</span></div>
    </a>

    <a className="role-card sup" href="/monitor.html">
      <div className="role-top">
        <span className="role-eyebrow">Pantalla 2</span>
        <span className="role-led"></span>
      </div>
      <div className="role-title">Supervisor</div>
      <div className="role-desc">Observa en tiempo real lo que hace el operador, controla el ejercicio (iniciar / finalizar / reset) y revisa el registro de maniobras.</div>
      <div className="role-status"><span className="lbl">ESTADO</span><span className="val">ENTRAR</span></div>
    </a>
  </div>

  <div id="foot">RED EL&Eacute;CTRICA ENERPYME &middot; ENTRENAMIENTO SCADA</div>

</div>
    </>
  );
}
