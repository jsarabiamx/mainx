/* tecnico-ui.js — SOLO agrega bottom nav + Visión + Perfil. No toca nada más. */
(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', function() {
    addStyles();
    addNav();
    addPanels();
    waitAndInit();
  });

  function addStyles() {
    const s = document.createElement('style');
    s.textContent = `
      body { padding-bottom: 72px !important; }
      .toast-container { bottom: 80px !important; }

      #tuiNav {
        position: fixed; bottom: 0; left: 0; right: 0; z-index: 9000;
        height: 68px; background: rgba(6,8,16,.98);
        backdrop-filter: blur(20px);
        border-top: 1px solid rgba(255,255,255,.08);
        display: grid; grid-template-columns: repeat(3,1fr);
        padding-bottom: env(safe-area-inset-bottom);
      }
      .tni { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; cursor:pointer; transition:opacity .15s; }
      .tni:active { opacity:.6; }
      .tni-icon { width:28px; height:28px; border-radius:8px; display:flex; align-items:center; justify-content:center; color:rgba(255,255,255,.3); transition:all .15s; }
      .tni.active .tni-icon { background:rgba(79,142,247,.15); color:#4f8ef7; }
      .tni-lbl { font-size:10px; font-weight:600; color:rgba(255,255,255,.3); }
      .tni.active .tni-lbl { color:#4f8ef7; }

      #tuiPanelVision, #tuiPanelPerfil {
        position:fixed; inset:0; z-index:500;
        background:#07090f; overflow-y:auto;
        transform:translateY(100%);
        transition:transform .3s cubic-bezier(.33,1,.68,1);
        padding:16px 16px calc(80px + env(safe-area-inset-bottom));
      }
      #tuiPanelVision.open, #tuiPanelPerfil.open { transform:translateY(0); }

      .vp-head { font-size:16px; font-weight:700; margin-bottom:16px; padding-top:8px; }
      .vp-tabs { display:flex; gap:6px; margin-bottom:16px; }
      .vp-tab { flex:1; padding:9px; background:#111622; border:1px solid rgba(255,255,255,.1); border-radius:10px; font-size:11px; font-weight:600; color:rgba(255,255,255,.4); cursor:pointer; text-align:center; font-family:inherit; }
      .vp-tab.active { background:rgba(79,142,247,.12); border-color:rgba(79,142,247,.4); color:#4f8ef7; }
      .vp-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px; }
      .vp-card { background:#111622; border:1px solid rgba(255,255,255,.07); border-radius:14px; padding:16px; }
      .vp-val { font-size:32px; font-weight:700; font-family:monospace; line-height:1; margin-bottom:4px; }
      .vp-lbl { font-size:11px; color:rgba(255,255,255,.35); }
      .vp-chart { background:#111622; border:1px solid rgba(255,255,255,.07); border-radius:14px; padding:16px; }
      .vp-chart-title { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:rgba(255,255,255,.3); margin-bottom:12px; }
      .vp-bar-row { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
      .vp-bar-lbl { font-size:11px; color:rgba(255,255,255,.4); width:80px; text-align:right; flex-shrink:0; }
      .vp-bar-track { flex:1; height:8px; background:rgba(255,255,255,.05); border-radius:4px; overflow:hidden; }
      .vp-bar-fill { height:100%; border-radius:4px; transition:width .6s; }
      .vp-bar-n { font-size:11px; font-family:monospace; color:rgba(255,255,255,.4); width:22px; text-align:right; }

      .pp-wrap { display:flex; flex-direction:column; align-items:center; padding:20px 0 18px; }
      .pp-avatar { width:72px; height:72px; border-radius:50%; background:linear-gradient(135deg,#1e3a6e,#2a4a8a); border:2px solid rgba(79,142,247,.3); display:flex; align-items:center; justify-content:center; font-size:26px; font-weight:700; color:#4f8ef7; margin-bottom:12px; }
      .pp-name { font-size:20px; font-weight:700; margin-bottom:4px; }
      .pp-role { font-size:12px; color:rgba(255,255,255,.35); }
      .pp-card { background:#111622; border:1px solid rgba(255,255,255,.07); border-radius:14px; overflow:hidden; margin-bottom:12px; }
      .pp-row { display:flex; align-items:center; justify-content:space-between; padding:13px 16px; border-bottom:1px solid rgba(255,255,255,.05); }
      .pp-row:last-child { border-bottom:none; }
      .pp-lbl { font-size:12px; color:rgba(255,255,255,.35); }
      .pp-val { font-size:13px; font-weight:600; font-family:monospace; max-width:60%; overflow:hidden; text-overflow:ellipsis; text-align:right; }
    `;
    document.head.appendChild(s);
  }

  function addNav() {
    const nav = document.createElement('nav');
    nav.id = 'tuiNav';
    nav.innerHTML = `
      <div class="tni active" id="tniInicio" onclick="tuiGo('inicio')">
        <div class="tni-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>
        <div class="tni-lbl">Inicio</div>
      </div>
      <div class="tni" id="tniVision" onclick="tuiGo('vision')">
        <div class="tni-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
        <div class="tni-lbl">Visión</div>
      </div>
      <div class="tni" id="tniPerfil" onclick="tuiGo('perfil')">
        <div class="tni-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
        <div class="tni-lbl">Perfil</div>
      </div>`;
    document.body.appendChild(nav);
  }

  function addPanels() {
    // Panel Visión
    const pv = document.createElement('div');
    pv.id = 'tuiPanelVision';
    pv.innerHTML = `
      <div class="vp-head">Mi Visión</div>
      <div class="vp-tabs">
        <button class="vp-tab active" onclick="tuiPeriod('dia',this)">Hoy</button>
        <button class="vp-tab" onclick="tuiPeriod('semana',this)">Semana</button>
        <button class="vp-tab" onclick="tuiPeriod('mes',this)">Mes</button>
      </div>
      <div class="vp-grid">
        <div class="vp-card"><div class="vp-val" style="color:#4f8ef7" id="tvA">0</div><div class="vp-lbl">Atendidos</div></div>
        <div class="vp-card"><div class="vp-val" style="color:#f59e0b" id="tvP">0</div><div class="vp-lbl">Pendientes</div></div>
        <div class="vp-card"><div class="vp-val" style="color:#ef4444" id="tvC">0</div><div class="vp-lbl">Correctivos</div></div>
        <div class="vp-card"><div class="vp-val" style="color:#22c55e" id="tvPr">0</div><div class="vp-lbl">Preventivos</div></div>
      </div>
      <div class="vp-chart">
        <div class="vp-chart-title">Distribución</div>
        <div id="tvChart"></div>
      </div>`;
    document.body.appendChild(pv);

    // Panel Perfil
    const pp = document.createElement('div');
    pp.id = 'tuiPanelPerfil';
    pp.innerHTML = `
      <div class="pp-wrap">
        <div class="pp-avatar" id="ppAv">T</div>
        <div class="pp-name" id="ppNm">—</div>
        <div class="pp-role">Técnico de campo</div>
      </div>
      <div class="pp-card">
        <div class="pp-row"><span class="pp-lbl">Usuario</span><span class="pp-val" id="ppU">—</span></div>
        <div class="pp-row"><span class="pp-lbl">Base</span><span class="pp-val" id="ppB">—</span></div>
        <div class="pp-row"><span class="pp-lbl">Teléfono</span><span class="pp-val" id="ppT">—</span></div>
        <div class="pp-row"><span class="pp-lbl">ID Empleado</span><span class="pp-val" id="ppE">—</span></div>
        <div class="pp-row"><span class="pp-lbl">Email</span><span class="pp-val" id="ppEm" style="font-size:11px">—</span></div>
        <div class="pp-row"><span class="pp-lbl">Empresas</span><span class="pp-val" id="ppEp">—</span></div>
      </div>`;
    document.body.appendChild(pp);
  }

  /* ── Navegación ── */
  window.tuiGo = function(screen) {
    ['Inicio','Vision','Perfil'].forEach(n => document.getElementById('tni'+n)?.classList.remove('active'));
    document.getElementById('tniInicio' === 'tni'+screen ? 'tniInicio' :
      screen === 'vision' ? 'tniVision' : 'tniPerfil')?.classList.add('active');
    document.getElementById('tni' + screen.charAt(0).toUpperCase() + screen.slice(1))?.classList.add('active');

    document.getElementById('tuiPanelVision')?.classList.remove('open');
    document.getElementById('tuiPanelPerfil')?.classList.remove('open');

    if (screen === 'vision') { document.getElementById('tuiPanelVision')?.classList.add('open'); renderV(); }
    if (screen === 'perfil') { document.getElementById('tuiPanelPerfil')?.classList.add('open'); renderP(); }
    if (screen === 'inicio') { document.getElementById('tniInicio')?.classList.add('active'); }
  };

  /* ── Período ── */
  let _per = 'dia';
  window.tuiPeriod = function(p, btn) {
    _per = p;
    document.querySelectorAll('.vp-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderV();
  };

  function renderV() {
    const s = typeof AUTH !== 'undefined' ? AUTH.checkSession() : null;
    if (!s) return;
    let a=0,p=0,c=0,pr=0;
    try {
      if (typeof TECH !== 'undefined' && TECH.state?.fallas) {
        const all = TECH.state.fallas;
        const now = new Date();
        const cut = _per==='dia' ? new Date(now-86400000) : _per==='semana' ? new Date(now-7*86400000) : new Date(now-30*86400000);
        const un = s.username||''; const nm = s.nombre||s.name||'';
        const isA = e => /atendid/i.test(e||'');
        const mis = all.filter(f => (f.tecnicoUsername===un||f.tecnico===nm) && (!f.fecha||new Date(f.fecha)>=cut));
        a = mis.filter(f=>isA(f.estatus)).length;
        p = all.filter(f=>!isA(f.estatus)&&(f.tecnicoUsername===un||f.tecnico===nm)).length;
        c = mis.filter(f=>/correctiv/i.test(f.tipo)).length;
        pr= mis.filter(f=>/preventiv/i.test(f.tipo)).length;
      }
    } catch(e) {}
    T('tvA',a); T('tvP',p); T('tvC',c); T('tvPr',pr);
    const ch = document.getElementById('tvChart');
    if (ch) {
      const mx = Math.max(a,c,pr,1);
      ch.innerHTML = [['Correctivos',c,'#ef4444'],['Preventivos',pr,'#22c55e'],['Atendidos',a,'#4f8ef7']]
        .map(([l,v,col]) => `<div class="vp-bar-row"><div class="vp-bar-lbl">${l}</div><div class="vp-bar-track"><div class="vp-bar-fill" style="width:${Math.round(v/mx*100)}%;background:${col}"></div></div><div class="vp-bar-n">${v}</div></div>`).join('');
    }
  }

  function renderP() {
    const s = typeof AUTH !== 'undefined' ? AUTH.checkSession() : null;
    if (!s) return;
    const nm = s.nombre||s.name||s.username||'—';
    T('ppAv', nm.charAt(0).toUpperCase());
    T('ppNm', nm); T('ppU','@'+(s.username||'—'));
    T('ppB',s.base||'—'); T('ppT',s.telefono||'—');
    T('ppE',s.empleadoId||'—'); T('ppEm',s.email||'—');
    T('ppEp',(s.empresas||[]).join(', ')||'—');
  }

  function waitAndInit() {
    let n = 0;
    const poll = setInterval(() => {
      n++;
      const ov = document.getElementById('loadingOverlay');
      const gone = !ov || !ov.parentNode || ov.style.opacity==='0';
      if (gone || n > 60) { clearInterval(poll); setTimeout(renderP, 300); }
    }, 200);
  }

  function T(id,v) { const e=document.getElementById(id); if(e) e.textContent=v??'—'; }

  /* Conectar botón Atender del detalle con el modal */
  setInterval(() => {
    const btn = document.getElementById('detalleAtenderBtn');
    if (!btn || btn._bound) return;
    btn._bound = true;
    btn.addEventListener('click', () => {
      // Buscar el selectedId desde el state de tecnico.js
      try {
        const id = window._techState ? window._techState.selectedId : null;
        if (id && typeof showAtenderModal === 'function') showAtenderModal(id);
      } catch(e) {}
    });
  }, 500);

  /* Ocultar/mostrar btn Atender según estatus */
  const _dvObs = new MutationObserver(() => {
    const vd = document.getElementById('viewDetalle');
    if (!vd || vd.style.display === 'none') return;
    setTimeout(() => {
      try {
        const id = window._techState && window._techState.selectedId;
        const fallas = window._techState && window._techState.fallas;
        const f = fallas && id ? fallas.find(x => x.id === id) : null;
        const sec = document.getElementById('detalleAtenderSection');
        if (sec && f) {
          sec.style.display = /proceso|atendid/i.test(f.estatus||'') ? 'none' : '';
        }
      } catch(e) {}
    }, 100);
  });
  const _vd = document.getElementById('viewDetalle');
  if (_vd) _dvObs.observe(_vd, { attributes: true, attributeFilter: ['style'] });

})();
