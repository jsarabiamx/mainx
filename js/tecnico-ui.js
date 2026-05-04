/* tecnico-ui.js — Mejoras visuales + Visión + Perfil
   Trabaja SOBRE la UI existente. No reemplaza nada. */
(function() {
  'use strict';

  /* Esperar a que el body esté listo */
  function onReady(cb) {
    if (document.readyState !== 'loading') { cb(); return; }
    document.addEventListener('DOMContentLoaded', cb);
  }

  onReady(function() {
    injectStyles();
    addBottomNav();
    watchLoadingOverlay();
  });

  /* ── ESTILOS ── */
  function injectStyles() {
    const s = document.createElement('style');
    s.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
      body { padding-bottom: 76px; }
      .tech-header { background: rgba(7,9,15,.96) !important; backdrop-filter: blur(16px) !important; border-bottom: 1px solid rgba(255,255,255,.07) !important; }
      .kpi-strip { display: grid !important; grid-template-columns: repeat(4,1fr) !important; gap: 1px !important; background: rgba(255,255,255,.06) !important; border-bottom: 1px solid rgba(255,255,255,.07) !important; padding: 0 !important; }
      .kpi-card { background: rgba(10,13,22,1) !important; border: none !important; border-radius: 0 !important; padding: 14px 8px !important; flex-direction: column !important; align-items: center !important; gap: 4px !important; position: relative !important; box-shadow: none !important; }
      .kpi-icon { display: none !important; }
      .kpi-value { font-size: 22px !important; font-weight: 700 !important; line-height: 1 !important; }
      .kpi-label { font-size: 9px !important; color: rgba(255,255,255,.35) !important; font-weight: 500 !important; text-transform: uppercase !important; letter-spacing: .05em !important; }
      .kpi-pending .kpi-value { color: #f59e0b !important; }
      .kpi-process .kpi-value { color: #4f8ef7 !important; }
      .kpi-done    .kpi-value { color: #22c55e !important; }
      .kpi-total   .kpi-value { color: #a855f7 !important; }
      .panels-grid { display: flex !important; flex-direction: column !important; gap: 12px !important; padding: 12px !important; }
      .panel { border-radius: 14px !important; border: 1px solid rgba(255,255,255,.07) !important; }
      .toast-container { bottom: 80px !important; }

      /* ── BOTTOM NAV ── */
      #tuiNav { position: fixed; bottom: 0; left: 0; right: 0; z-index: 999; height: 68px; background: rgba(7,9,15,.97); backdrop-filter: blur(20px); border-top: 1px solid rgba(255,255,255,.07); display: grid; grid-template-columns: repeat(3,1fr); padding-bottom: env(safe-area-inset-bottom); }
      .tni { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; cursor: pointer; }
      .tni-icon { width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,.3); transition: all .15s; }
      .tni.active .tni-icon { background: rgba(79,142,247,.15); color: #4f8ef7; }
      .tni-lbl { font-size: 10px; font-weight: 600; color: rgba(255,255,255,.3); }
      .tni.active .tni-lbl { color: #4f8ef7; }

      /* ── PANELES EXTRAS ── */
      #tuiPanelVision, #tuiPanelPerfil { display: none; padding: 16px; min-height: 60vh; }
      #tuiPanelVision.show, #tuiPanelPerfil.show { display: block; }
      .tui-hidden { display: none !important; }

      /* Vision */
      .vp-tabs { display: flex; gap: 6px; margin-bottom: 16px; }
      .vp-tab { flex: 1; padding: 8px; background: rgba(17,22,34,1); border: 1px solid rgba(255,255,255,.1); border-radius: 8px; font-size: 11px; font-weight: 600; color: rgba(255,255,255,.5); cursor: pointer; text-align: center; font-family: inherit; }
      .vp-tab.active { background: rgba(79,142,247,.15); border-color: rgba(79,142,247,.4); color: #4f8ef7; }
      .vp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
      .vp-card { background: rgba(17,22,34,1); border: 1px solid rgba(255,255,255,.07); border-radius: 14px; padding: 16px; }
      .vp-val { font-size: 30px; font-weight: 700; font-family: monospace; line-height: 1; margin-bottom: 4px; }
      .vp-lbl { font-size: 11px; color: rgba(255,255,255,.4); }
      .vp-chart { background: rgba(17,22,34,1); border: 1px solid rgba(255,255,255,.07); border-radius: 14px; padding: 16px; margin-bottom: 12px; }
      .vp-chart-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: rgba(255,255,255,.4); margin-bottom: 12px; }
      .vp-bar-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
      .vp-bar-lbl { font-size: 11px; color: rgba(255,255,255,.5); width: 90px; text-align: right; flex-shrink: 0; }
      .vp-bar-track { flex: 1; height: 8px; background: rgba(255,255,255,.06); border-radius: 4px; overflow: hidden; }
      .vp-bar-fill { height: 100%; border-radius: 4px; transition: width .6s; }
      .vp-bar-n { font-size: 11px; font-family: monospace; color: rgba(255,255,255,.5); width: 20px; text-align: right; }

      /* Perfil */
      .pp-avatar-wrap { display: flex; flex-direction: column; align-items: center; padding: 24px 0 20px; }
      .pp-avatar { width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg,#1e3a6e,#2a4a8a); border: 2px solid rgba(79,142,247,.3); display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 700; color: #4f8ef7; margin-bottom: 12px; }
      .pp-name { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
      .pp-role { font-size: 12px; color: rgba(255,255,255,.4); }
      .pp-card { background: rgba(17,22,34,1); border: 1px solid rgba(255,255,255,.07); border-radius: 14px; overflow: hidden; margin-bottom: 12px; }
      .pp-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,.05); }
      .pp-row:last-child { border-bottom: none; }
      .pp-lbl { font-size: 12px; color: rgba(255,255,255,.4); }
      .pp-val { font-size: 13px; font-weight: 600; font-family: monospace; text-align: right; max-width: 60%; overflow: hidden; text-overflow: ellipsis; }
    `;
    document.head.appendChild(s);
  }

  /* ── BOTTOM NAV ── */
  function addBottomNav() {
    const nav = document.createElement('nav');
    nav.id = 'tuiNav';
    nav.innerHTML = `
      <div class="tni active" id="tniInicio" onclick="tuiScreen('inicio')">
        <div class="tni-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>
        <div class="tni-lbl">Inicio</div>
      </div>
      <div class="tni" id="tniVision" onclick="tuiScreen('vision')">
        <div class="tni-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
        <div class="tni-lbl">Visión</div>
      </div>
      <div class="tni" id="tniPerfil" onclick="tuiScreen('perfil')">
        <div class="tni-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
        <div class="tni-lbl">Perfil</div>
      </div>
    `;
    document.body.appendChild(nav);

    /* Panel Visión */
    const pv = document.createElement('div');
    pv.id = 'tuiPanelVision';
    pv.innerHTML = `
      <div class="vp-tabs">
        <button class="vp-tab active" onclick="tuiPeriod('dia',this)">Hoy</button>
        <button class="vp-tab" onclick="tuiPeriod('semana',this)">Semana</button>
        <button class="vp-tab" onclick="tuiPeriod('mes',this)">Mes</button>
      </div>
      <div class="vp-grid">
        <div class="vp-card"><div class="vp-val" style="color:#4f8ef7" id="tvAtend">0</div><div class="vp-lbl">Atendidos</div></div>
        <div class="vp-card"><div class="vp-val" style="color:#f59e0b" id="tvPend">0</div><div class="vp-lbl">Pendientes</div></div>
        <div class="vp-card"><div class="vp-val" style="color:#ef4444" id="tvCorr">0</div><div class="vp-lbl">Correctivos</div></div>
        <div class="vp-card"><div class="vp-val" style="color:#22c55e" id="tvPrev">0</div><div class="vp-lbl">Preventivos</div></div>
      </div>
      <div class="vp-chart">
        <div class="vp-chart-title">Distribución</div>
        <div id="tvChart"></div>
      </div>`;
    document.body.appendChild(pv);

    /* Panel Perfil */
    const pp = document.createElement('div');
    pp.id = 'tuiPanelPerfil';
    pp.innerHTML = `
      <div class="pp-avatar-wrap">
        <div class="pp-avatar" id="ppAvatar">T</div>
        <div class="pp-name" id="ppNombre">—</div>
        <div class="pp-role">Técnico de campo</div>
      </div>
      <div class="pp-card">
        <div class="pp-row"><span class="pp-lbl">Usuario</span><span class="pp-val" id="ppUser">—</span></div>
        <div class="pp-row"><span class="pp-lbl">Base</span><span class="pp-val" id="ppBase">—</span></div>
        <div class="pp-row"><span class="pp-lbl">Teléfono</span><span class="pp-val" id="ppTel">—</span></div>
        <div class="pp-row"><span class="pp-lbl">ID Empleado</span><span class="pp-val" id="ppEmp">—</span></div>
        <div class="pp-row"><span class="pp-lbl">Email</span><span class="pp-val" id="ppEmail" style="font-size:11px">—</span></div>
        <div class="pp-row"><span class="pp-lbl">Empresas</span><span class="pp-val" id="ppEmps">—</span></div>
      </div>`;
    document.body.appendChild(pp);
  }

  /* ── Navegación ── */
  const MAIN_SELECTORS = ['.tech-main', '.empresa-strip', '.kpi-strip'];

  window.tuiScreen = function(screen) {
    // Nav active
    ['Inicio','Vision','Perfil'].forEach(n => document.getElementById('tni'+n)?.classList.remove('active'));
    document.getElementById('tni' + screen.charAt(0).toUpperCase() + screen.slice(1))?.classList.add('active');

    // Paneles extras
    document.getElementById('tuiPanelVision')?.classList.remove('show');
    document.getElementById('tuiPanelPerfil')?.classList.remove('show');

    // Mostrar/ocultar contenido principal
    const mainEls = document.querySelectorAll('.tech-main, .empresa-strip, .kpi-strip');

    if (screen === 'inicio') {
      mainEls.forEach(el => el.classList.remove('tui-hidden'));
    } else if (screen === 'vision') {
      mainEls.forEach(el => el.classList.add('tui-hidden'));
      document.getElementById('tuiPanelVision')?.classList.add('show');
      tuiRenderVision();
    } else if (screen === 'perfil') {
      mainEls.forEach(el => el.classList.add('tui-hidden'));
      document.getElementById('tuiPanelPerfil')?.classList.add('show');
      tuiRenderPerfil();
    }
  };

  /* ── Visión ── */
  let _period = 'dia';

  window.tuiPeriod = function(p, btn) {
    _period = p;
    document.querySelectorAll('.vp-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    tuiRenderVision();
  };

  function tuiRenderVision() {
    const session = typeof AUTH !== 'undefined' ? AUTH.checkSession() : null;
    if (!session) return;

    const kpiAtend = parseInt(document.getElementById('kpiAtendido')?.textContent || '0');
    const kpiPend  = parseInt(document.getElementById('kpiPendiente')?.textContent || '0');

    // Intentar obtener datos detallados si están disponibles
    let atend = kpiAtend, pend = kpiPend, corr = 0, prev = 0;

    try {
      if (typeof TECH !== 'undefined' && TECH.state && Array.isArray(TECH.state.fallas)) {
        const now    = new Date();
        const cutoff = _period === 'dia'    ? new Date(now - 86400000)
                     : _period === 'semana' ? new Date(now - 7*86400000)
                     : new Date(now - 30*86400000);
        const un = session.username || '';
        const nm = session.nombre || session.name || '';
        const misF = TECH.state.fallas.filter(f =>
          (f.tecnicoUsername === un || f.tecnico === nm) &&
          (!f.fecha || new Date(f.fecha) >= cutoff)
        );
        const isA = (e) => /atendid/i.test(e || '');
        atend = misF.filter(f => isA(f.estatus)).length;
        pend  = TECH.state.fallas.filter(f => !isA(f.estatus) && (f.tecnicoUsername === un || f.tecnico === nm)).length;
        corr  = misF.filter(f => /correctiv/i.test(f.tipo)).length;
        prev  = misF.filter(f => /preventiv/i.test(f.tipo)).length;
      }
    } catch(e) {}

    T('tvAtend', atend); T('tvPend', pend); T('tvCorr', corr); T('tvPrev', prev);

    const chart = document.getElementById('tvChart');
    if (chart) {
      const max = Math.max(corr, prev, atend, 1);
      chart.innerHTML = [
        ['Correctivos', corr, '#ef4444'],
        ['Preventivos', prev, '#22c55e'],
        ['Atendidos',   atend,'#4f8ef7'],
      ].map(([l,v,c]) =>
        `<div class="vp-bar-row">
          <div class="vp-bar-lbl">${l}</div>
          <div class="vp-bar-track"><div class="vp-bar-fill" style="width:${Math.round(v/max*100)}%;background:${c}"></div></div>
          <div class="vp-bar-n">${v}</div>
        </div>`
      ).join('');
    }
  }

  /* ── Perfil ── */
  function tuiRenderPerfil() {
    const session = typeof AUTH !== 'undefined' ? AUTH.checkSession() : null;
    if (!session) return;
    const nombre  = session.nombre || session.name || session.username || '—';
    const initial = nombre.charAt(0).toUpperCase();
    T('ppAvatar',  initial);
    T('ppNombre',  nombre);
    T('ppUser',    '@' + (session.username || '—'));
    T('ppBase',    session.base || '—');
    T('ppTel',     session.telefono || '—');
    T('ppEmp',     session.empleadoId || '—');
    T('ppEmail',   session.email || '—');
    T('ppEmps',    (session.empresas || []).join(', ') || '—');
  }

  /* ── Detectar cuando loading desaparece para saber que la app cargó ── */
  function watchLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) return;

    const obs = new MutationObserver(() => {
      const hidden = overlay.style.display === 'none' || overlay.style.opacity === '0' ||
                     overlay.classList.contains('hidden') || overlay.style.visibility === 'hidden';
      if (hidden) {
        obs.disconnect();
        // La app cargó — exponer TECH.state si está disponible
        setTimeout(() => {
          try {
            if (typeof TECH !== 'undefined' && TECH.state) {
              window.TECH = TECH;
            }
          } catch(e) {}
        }, 500);
      }
    });
    obs.observe(overlay, { attributes: true, attributeFilter: ['style','class'] });
  }

  function T(id, v) { const e = document.getElementById(id); if (e) e.textContent = v ?? '—'; }

})();
