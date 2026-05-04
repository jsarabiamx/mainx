/* tecnico-ui.js v4 — Navegación por tabs + detalle en pantalla completa */
(function() {
  'use strict';

  /* ─── Estado de la UI ─── */
  let _tab = 'pendiente'; // pendiente | proceso | atendido

  /* ─── Esperar a que el DOM esté listo ─── */
  function onReady(cb) {
    if (document.readyState !== 'loading') { cb(); return; }
    document.addEventListener('DOMContentLoaded', cb);
  }

  onReady(function() {
    injectStyles();
    restructureLayout();
    addBottomNav();
    watchReady();
  });

  /* ═══════════════ ESTILOS ═══════════════ */
  function injectStyles() {
    const s = document.createElement('style');
    s.id = 'tuiStyles';
    s.textContent = `
      body { padding-bottom: 72px !important; background: #07090f; }

      /* ── Header ── */
      .tech-header {
        height: 58px !important;
        background: rgba(7,9,15,.97) !important;
        backdrop-filter: blur(20px) !important;
        border-bottom: 1px solid rgba(255,255,255,.07) !important;
        padding: 0 14px !important;
      }
      .brand-info h1 { font-size: 13px !important; }
      .brand-info p  { font-size: 10px !important; color: rgba(255,255,255,.3) !important; }

      /* ── Empresa strip ── */
      .empresa-strip {
        background: rgba(10,13,22,1) !important;
        border-bottom: 1px solid rgba(255,255,255,.07) !important;
        padding: 7px 14px !important;
        gap: 8px !important;
      }
      .strip-label { font-size: 10px !important; color: rgba(255,255,255,.3) !important; }

      /* ── KPI strip → tabs ── */
      .kpi-strip {
        display: grid !important;
        grid-template-columns: repeat(4,1fr) !important;
        gap: 1px !important;
        background: rgba(255,255,255,.06) !important;
        border-bottom: 1px solid rgba(255,255,255,.07) !important;
        margin: 0 !important;
      }
      .kpi-card {
        background: #0b0e1a !important;
        border: none !important; border-radius: 0 !important;
        padding: 12px 6px !important;
        display: flex !important; flex-direction: column !important;
        align-items: center !important; gap: 3px !important;
        cursor: pointer !important; transition: background .15s !important;
        position: relative !important; box-shadow: none !important;
      }
      .kpi-card:active { background: #141b2e !important; }
      .kpi-icon { display: none !important; }
      .kpi-value { font-size: 20px !important; font-weight: 700 !important; line-height: 1 !important; font-family: 'JetBrains Mono', monospace !important; }
      .kpi-label { font-size: 8px !important; color: rgba(255,255,255,.3) !important; font-weight: 600 !important; text-transform: uppercase !important; letter-spacing: .05em !important; text-align: center !important; }
      .kpi-card.kpi-pending .kpi-value  { color: #f59e0b !important; }
      .kpi-card.kpi-process .kpi-value  { color: #4f8ef7 !important; }
      .kpi-card.kpi-done    .kpi-value  { color: #22c55e !important; }
      .kpi-card.kpi-total   .kpi-value  { color: #a855f7 !important; }

      /* Indicador de tab activo */
      .kpi-card.tui-tab-active::after {
        content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 2px;
      }
      .kpi-card.kpi-pending.tui-tab-active::after { background: #f59e0b; }
      .kpi-card.kpi-process.tui-tab-active::after { background: #4f8ef7; }
      .kpi-card.kpi-done.tui-tab-active::after    { background: #22c55e; }
      .kpi-card.kpi-total.tui-tab-active::after   { background: transparent; }
      .kpi-card.kpi-pending.tui-tab-active { background: rgba(245,158,11,.06) !important; }
      .kpi-card.kpi-process.tui-tab-active { background: rgba(79,142,247,.06) !important; }
      .kpi-card.kpi-done.tui-tab-active    { background: rgba(34,197,94,.06) !important; }

      /* ── Filter bar ── */
      #techFilterBar {
        padding: 10px 12px 6px !important;
        display: flex !important; gap: 6px !important;
        overflow-x: auto !important; scrollbar-width: none !important;
      }
      #techFilterBar::-webkit-scrollbar { display: none; }

      /* ── MAIN ── */
      .tech-main { padding: 0 !important; }

      /* ── CONTENEDOR DE LISTA ── */
      #tuiListContainer {
        display: flex; flex-direction: column;
        overflow-y: auto;
        height: calc(100dvh - 58px - 40px - 64px - 72px); /* header + empresa + kpis + nav */
        padding: 10px 10px 10px;
        gap: 10px;
      }

      /* Ocultar panels originales */
      .panels-grid { display: none !important; }
      .detail-panel { display: none !important; }
      #techFilterBar { display: none !important; }

      /* ── REPORT CARD ── */
      .tui-card {
        background: #111622;
        border: 1px solid rgba(255,255,255,.07);
        border-radius: 14px;
        overflow: hidden;
        cursor: pointer;
        flex-shrink: 0;
        transition: border-color .15s, transform .1s;
        position: relative;
      }
      .tui-card:active { transform: scale(.98); }
      .tui-card::before {
        content: ''; position: absolute;
        left: 0; top: 0; bottom: 0; width: 3px;
      }
      .tui-card.pendiente-item::before { background: #f59e0b; }
      .tui-card.proceso-item::before   { background: #4f8ef7; }
      .tui-card.atendido-item::before  { background: #22c55e; }

      .tui-card-head { padding: 12px 12px 0 16px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 5px; }
      .tui-card-folio { font-size: 10px; font-weight: 600; color: #4f8ef7; font-family: monospace; }
      .tui-card-emp { font-size: 9px; font-weight: 700; padding: 1px 6px; border-radius: 4px; text-transform: uppercase; }
      .tui-card-badge { font-size: 9px; font-weight: 700; padding: 2px 8px; border-radius: 20px; text-transform: uppercase; margin-left: auto; }
      .tui-card-badge.pendiente { background: rgba(245,158,11,.12); color: #f59e0b; border: 1px solid rgba(245,158,11,.2); }
      .tui-card-badge.proceso   { background: rgba(79,142,247,.12);  color: #4f8ef7; border: 1px solid rgba(79,142,247,.2); }
      .tui-card-badge.atendido  { background: rgba(34,197,94,.12);   color: #22c55e; border: 1px solid rgba(34,197,94,.2); }

      .tui-card-unidad { font-size: 17px; font-weight: 700; padding: 0 12px 4px 16px; }
      .tui-card-desc   { font-size: 12px; color: rgba(255,255,255,.5); padding: 0 12px 8px 16px; line-height: 1.4;
        display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .tui-card-meta   { padding: 0 12px 12px 16px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
      .tui-meta-chip   { font-size: 10px; color: rgba(255,255,255,.35); display: flex; align-items: center; gap: 4px; }
      .tui-meta-prov   { font-size: 10px; font-weight: 600; color: #4fd1c5; }
      .tui-prio-dot    { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
      .tui-prio-dot.alta  { background: #ef4444; }
      .tui-prio-dot.media { background: #f59e0b; }
      .tui-prio-dot.baja  { background: #22c55e; }

      /* ── DETALLE PANTALLA COMPLETA ── */
      #tuiDetail {
        position: fixed; inset: 0; z-index: 200;
        background: #07090f;
        overflow-y: auto;
        transform: translateX(100%);
        transition: transform .3s cubic-bezier(.33,1,.68,1);
        padding-bottom: calc(72px + env(safe-area-inset-bottom));
      }
      #tuiDetail.open { transform: translateX(0); }

      .tui-detail-header {
        position: sticky; top: 0; z-index: 10;
        background: rgba(7,9,15,.97); backdrop-filter: blur(16px);
        border-bottom: 1px solid rgba(255,255,255,.07);
        padding: 14px 16px;
        display: flex; align-items: center; gap: 10px;
      }
      .tui-back-btn {
        width: 34px; height: 34px; border-radius: 9px;
        background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1);
        color: rgba(255,255,255,.7); cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0; transition: all .15s;
      }
      .tui-back-btn:active { background: rgba(255,255,255,.1); }
      .tui-detail-folio { font-size: 11px; font-weight: 600; color: #4f8ef7; font-family: monospace; }
      .tui-detail-status { font-size: 9px; font-weight: 700; padding: 2px 8px; border-radius: 20px; text-transform: uppercase; }

      .tui-detail-body { padding: 16px; }
      .tui-detail-unidad { font-size: 26px; font-weight: 700; margin-bottom: 6px; }
      .tui-detail-badges { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 20px; }

      .tui-section { background: #111622; border: 1px solid rgba(255,255,255,.07); border-radius: 14px; padding: 14px 16px; margin-bottom: 12px; }
      .tui-section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: rgba(255,255,255,.3); margin-bottom: 12px; }
      .tui-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .tui-field-lbl { font-size: 10px; color: rgba(255,255,255,.35); margin-bottom: 3px; }
      .tui-field-val { font-size: 13px; font-weight: 600; }
      .tui-full { grid-column: 1 / -1; }
      .tui-desc-box { background: #0b0e1a; border-radius: 8px; padding: 10px 12px; font-size: 13px; color: rgba(255,255,255,.65); line-height: 1.6; }

      .tui-detail-footer {
        position: sticky; bottom: 0; z-index: 10;
        background: rgba(7,9,15,.97); backdrop-filter: blur(16px);
        border-top: 1px solid rgba(255,255,255,.07);
        padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
        display: flex; gap: 10px;
      }
      .tui-btn-back {
        padding: 13px 18px; background: rgba(255,255,255,.06);
        border: 1px solid rgba(255,255,255,.1); border-radius: 12px;
        color: rgba(255,255,255,.7); font-size: 13px; font-weight: 600;
        cursor: pointer; font-family: inherit;
        display: flex; align-items: center; gap: 6px;
        flex-shrink: 0;
      }
      .tui-btn-back:active { background: rgba(255,255,255,.12); }
      .tui-btn-atender {
        flex: 1; padding: 13px;
        background: linear-gradient(135deg, #4f8ef7, #2b63d6);
        border: none; border-radius: 12px;
        color: white; font-size: 13px; font-weight: 700;
        cursor: pointer; font-family: inherit;
        display: flex; align-items: center; justify-content: center; gap: 6px;
        box-shadow: 0 4px 14px rgba(79,142,247,.35);
      }
      .tui-btn-atender:active { transform: scale(.97); }
      .tui-status-proc {
        flex: 1; padding: 13px;
        background: rgba(245,158,11,.08); border: 1px solid rgba(245,158,11,.2);
        border-radius: 12px; color: #f59e0b;
        font-size: 12px; font-weight: 600;
        display: flex; align-items: center; justify-content: center; gap: 6px;
      }

      /* ── EMPTY STATE ── */
      .tui-empty { padding: 60px 24px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 14px; }
      .tui-empty-icon { width: 60px; height: 60px; background: #111622; border: 1px solid rgba(255,255,255,.07); border-radius: 18px; display: flex; align-items: center; justify-content: center; font-size: 26px; }
      .tui-empty-title { font-size: 15px; font-weight: 600; color: rgba(255,255,255,.6); }
      .tui-empty-sub { font-size: 12px; color: rgba(255,255,255,.3); max-width: 220px; line-height: 1.5; }

      /* ── BOTTOM NAV ── */
      #tuiNav {
        position: fixed; bottom: 0; left: 0; right: 0; z-index: 300;
        height: 72px; background: rgba(7,9,15,.97);
        backdrop-filter: blur(20px);
        border-top: 1px solid rgba(255,255,255,.07);
        display: grid; grid-template-columns: repeat(3,1fr);
        padding-bottom: env(safe-area-inset-bottom);
      }
      .tni { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; cursor: pointer; }
      .tni:active { opacity: .6; }
      .tni-icon { width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,.3); transition: all .15s; }
      .tni.active .tni-icon { background: rgba(79,142,247,.15); color: #4f8ef7; }
      .tni-lbl { font-size: 10px; font-weight: 600; color: rgba(255,255,255,.3); }
      .tni.active .tni-lbl { color: #4f8ef7; }

      /* ── PANELES VISION / PERFIL ── */
      #tuiPanelVision, #tuiPanelPerfil {
        position: fixed; inset: 0; z-index: 150;
        background: #07090f;
        overflow-y: auto;
        transform: translateY(100%);
        transition: transform .3s cubic-bezier(.33,1,.68,1);
        padding: 16px;
        padding-bottom: calc(80px + env(safe-area-inset-bottom));
      }
      #tuiPanelVision.open, #tuiPanelPerfil.open { transform: translateY(0); }

      .vp-tabs { display: flex; gap: 6px; margin-bottom: 16px; }
      .vp-tab { flex: 1; padding: 9px; background: #111622; border: 1px solid rgba(255,255,255,.1); border-radius: 10px; font-size: 11px; font-weight: 600; color: rgba(255,255,255,.4); cursor: pointer; text-align: center; font-family: inherit; }
      .vp-tab.active { background: rgba(79,142,247,.12); border-color: rgba(79,142,247,.4); color: #4f8ef7; }
      .vp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
      .vp-card { background: #111622; border: 1px solid rgba(255,255,255,.07); border-radius: 14px; padding: 16px; }
      .vp-val { font-size: 32px; font-weight: 700; font-family: monospace; line-height: 1; margin-bottom: 4px; }
      .vp-lbl { font-size: 11px; color: rgba(255,255,255,.35); }
      .vp-chart { background: #111622; border: 1px solid rgba(255,255,255,.07); border-radius: 14px; padding: 16px; margin-bottom: 12px; }
      .vp-chart-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: rgba(255,255,255,.35); margin-bottom: 12px; }
      .vp-bar-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
      .vp-bar-lbl { font-size: 11px; color: rgba(255,255,255,.45); width: 80px; text-align: right; flex-shrink: 0; }
      .vp-bar-track { flex: 1; height: 8px; background: rgba(255,255,255,.05); border-radius: 4px; overflow: hidden; }
      .vp-bar-fill  { height: 100%; border-radius: 4px; transition: width .6s; }
      .vp-bar-n { font-size: 11px; font-family: monospace; color: rgba(255,255,255,.4); width: 22px; text-align: right; }

      .pp-wrap { display: flex; flex-direction: column; align-items: center; padding: 24px 0 20px; }
      .pp-avatar { width: 76px; height: 76px; border-radius: 50%; background: linear-gradient(135deg,#1e3a6e,#2a4a8a); border: 2px solid rgba(79,142,247,.3); display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 700; color: #4f8ef7; margin-bottom: 12px; }
      .pp-name { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
      .pp-role { font-size: 12px; color: rgba(255,255,255,.35); }
      .pp-card { background: #111622; border: 1px solid rgba(255,255,255,.07); border-radius: 14px; overflow: hidden; margin-bottom: 12px; }
      .pp-row { display: flex; align-items: center; justify-content: space-between; padding: 13px 16px; border-bottom: 1px solid rgba(255,255,255,.05); }
      .pp-row:last-child { border-bottom: none; }
      .pp-lbl { font-size: 12px; color: rgba(255,255,255,.35); }
      .pp-val { font-size: 13px; font-weight: 600; font-family: monospace; max-width: 60%; overflow: hidden; text-overflow: ellipsis; text-align: right; }

      /* Toast override */
      .toast-container { bottom: 80px !important; }
    `;
    document.head.appendChild(s);
  }

  /* ═══════════════ RESTRUCTURAR LAYOUT ═══════════════ */
  function restructureLayout() {
    const main = document.querySelector('.tech-main');
    if (!main) return;

    // Crear contenedor de lista
    const listContainer = document.createElement('div');
    listContainer.id = 'tuiListContainer';
    main.parentNode.insertBefore(listContainer, main);
    // Ocultar el main original pero dejarlo para que tecnico.js siga funcionando
    main.style.display = 'none';

    // Crear panel de detalle (pantalla completa)
    const detail = document.createElement('div');
    detail.id = 'tuiDetail';
    document.body.appendChild(detail);
  }

  /* ═══════════════ BOTTOM NAV ═══════════════ */
  function addBottomNav() {
    const nav = document.createElement('nav');
    nav.id = 'tuiNav';
    nav.innerHTML = `
      <div class="tni active" id="tniInicio" onclick="tuiGoTab('inicio')">
        <div class="tni-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>
        <div class="tni-lbl">Inicio</div>
      </div>
      <div class="tni" id="tniVision" onclick="tuiGoScreen('vision')">
        <div class="tni-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
        <div class="tni-lbl">Visión</div>
      </div>
      <div class="tni" id="tniPerfil" onclick="tuiGoScreen('perfil')">
        <div class="tni-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
        <div class="tni-lbl">Perfil</div>
      </div>`;
    document.body.appendChild(nav);

    // Panel Visión
    const pv = document.createElement('div');
    pv.id = 'tuiPanelVision';
    pv.innerHTML = `
      <div style="font-size:14px;font-weight:700;margin-bottom:14px;padding-top:8px">Mi Visión</div>
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

    // Panel Perfil
    const pp = document.createElement('div');
    pp.id = 'tuiPanelPerfil';
    pp.innerHTML = `
      <div class="pp-wrap">
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

  /* ═══════════════ ESPERAR DATOS ═══════════════ */
  function watchReady() {
    // tecnico.js oculta el overlay cuando termina
    let attempts = 0;
    const poll = setInterval(() => {
      attempts++;
      const overlay = document.getElementById('loadingOverlay');
      const kpi = document.getElementById('kpiPendiente');
      const overlayGone = !overlay || overlay.style.display === 'none' || overlay.style.opacity === '0' || !overlay.parentNode;

      if ((overlayGone || attempts > 40) && kpi) {
        clearInterval(poll);
        // Esperar un poco más para que tecnico.js termine de renderizar
        setTimeout(() => {
          hookKpiTabs();
          renderTab('pendiente');
          syncPoll();
          renderPerfil();
        }, 200);
      }
    }, 150);
  }

  /* ═══════════════ KPI TABS ═══════════════ */
  function hookKpiTabs() {
    const kpiMap = [
      { cls: 'kpi-pending', tab: 'pendiente' },
      { cls: 'kpi-process', tab: 'proceso' },
      { cls: 'kpi-done',    tab: 'atendido' },
      // kpi-total no es tab navegable
    ];
    document.querySelectorAll('.kpi-card').forEach(card => {
      for (const { cls, tab } of kpiMap) {
        if (card.classList.contains(cls)) {
          card.addEventListener('click', () => setTab(tab));
          break;
        }
      }
    });
    // Marcar inicial
    markActiveTab('pendiente');
  }

  function setTab(tab) {
    _tab = tab;
    markActiveTab(tab);
    renderTab(tab);
    // Cerrar detalle si estaba abierto
    closeDetail();
  }

  function markActiveTab(tab) {
    document.querySelectorAll('.kpi-card').forEach(c => c.classList.remove('tui-tab-active'));
    const cls = tab === 'pendiente' ? 'kpi-pending' : tab === 'proceso' ? 'kpi-process' : 'kpi-done';
    document.querySelector('.kpi-card.' + cls)?.classList.add('tui-tab-active');
  }

  /* ═══════════════ RENDER LISTA ═══════════════ */
  function getFallas() {
    // Leer del DOM original que ya renderizó tecnico.js
    const pend = document.getElementById('pendientesList');
    const aten = document.getElementById('atendidosList');
    const allItems = [...(pend?.querySelectorAll('.report-item') || []), ...(aten?.querySelectorAll('.report-item') || [])];
    return allItems;
  }

  function renderTab(tab) {
    const container = document.getElementById('tuiListContainer');
    if (!container) return;

    // Actualizar contadores y título
    updateCounts();

    // Obtener fallas del estado de TECH si está disponible
    let fallas = [];
    try {
      if (typeof TECH !== 'undefined' && TECH.state?.fallas) {
        const all = TECH.state.fallas;
        const isA = (e) => /atendid/i.test(e || '');
        const isP = (e) => /proceso/i.test(e || '');
        if (tab === 'pendiente') fallas = all.filter(f => !isA(f.estatus) && !isP(f.estatus));
        else if (tab === 'proceso')  fallas = all.filter(f => isP(f.estatus));
        else if (tab === 'atendido') fallas = all.filter(f => isA(f.estatus));
      }
    } catch(e) {}

    if (!fallas.length) {
      const labels = { pendiente: ['✅','Sin pendientes','Todos los reportes están atendidos'],
                       proceso:   ['🔧','Sin reportes en proceso','Ningún reporte en atención ahora'],
                       atendido:  ['📋','Sin atendidos','Los reportes atendidos aparecerán aquí'] };
      const [ico, tit, sub] = labels[tab] || labels.pendiente;
      container.innerHTML = `<div class="tui-empty">
        <div class="tui-empty-icon">${ico}</div>
        <div class="tui-empty-title">${tit}</div>
        <div class="tui-empty-sub">${sub}</div>
      </div>`;
      return;
    }

    // Ordenar
    if (tab === 'pendiente') {
      const o = {alta:0,media:1,baja:2};
      fallas.sort((a,b) => {
        const pa = o[(a.prioridad||'media').toLowerCase()] ?? 1;
        const pb = o[(b.prioridad||'media').toLowerCase()] ?? 1;
        return pa !== pb ? pa - pb : new Date(b.fecha||0) - new Date(a.fecha||0);
      });
    } else {
      fallas.sort((a,b) => new Date(b.fechaAtencion||b.fecha||0) - new Date(a.fechaAtencion||a.fecha||0));
    }

    container.innerHTML = fallas.map(f => buildCard(f, tab)).join('');

    // Bind clicks en los cards
    container.querySelectorAll('.tui-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        openDetail(id);
      });
    });
  }

  function buildCard(f, tab) {
    const clr = empColor(f.empresa);
    const isA = /atendid/i.test(f.estatus||'');
    const isP = /proceso/i.test(f.estatus||'');
    const accentCls = isA ? 'atendido-item' : isP ? 'proceso-item' : 'pendiente-item';
    const badgeLbl  = isA ? 'Atendido' : isP ? 'En proceso' : 'Pendiente';
    const badgeCls  = isA ? 'atendido' : isP ? 'proceso' : 'pendiente';
    const prioCls   = (f.prioridad||'').toLowerCase();
    const fecha     = f.fecha ? new Date(f.fecha).toLocaleDateString('es-MX',{day:'2-digit',month:'short'}) : '—';

    return `<div class="tui-card ${accentCls}" data-id="${f.id}">
      <div class="tui-card-head">
        <span class="tui-card-folio">${f.folio||f.id}</span>
        <span class="tui-card-emp" style="color:${clr};background:${clr}18;border:1px solid ${clr}30">${f.empresa||''}</span>
        <span class="tui-card-badge ${badgeCls}">${badgeLbl}</span>
      </div>
      <div class="tui-card-unidad">Unidad ${f.unidad||'—'}</div>
      <div class="tui-card-desc">${f.descripcion||'Sin descripción'}</div>
      <div class="tui-card-meta">
        <span class="tui-meta-chip"><span class="tui-prio-dot ${prioCls}"></span>${f.prioridad||'Media'}</span>
        ${f.categoria?`<span class="tui-meta-chip">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="7" height="9"/><rect x="15" y="12" width="7" height="9"/></svg>
          ${f.categoria}</span>`:''}
        <span class="tui-meta-chip">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          ${fecha}
        </span>
        ${f.base?`<span class="tui-meta-chip">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/></svg>
          ${f.base}</span>`:''}
        ${f.proveedor?`<span class="tui-meta-prov">${f.proveedor}</span>`:''}
      </div>
    </div>`;
  }

  /* ═══════════════ DETALLE PANTALLA COMPLETA ═══════════════ */
  let _detailId = null;

  function openDetail(id) {
    _detailId = id;
    let f = null;
    try { f = TECH?.state?.fallas?.find(x => x.id === id); } catch(e) {}
    if (!f) return;

    const clr    = empColor(f.empresa);
    const isA    = /atendid/i.test(f.estatus||'');
    const isP    = /proceso/i.test(f.estatus||'');
    const isPend = !isA && !isP;
    const badgeLbl = isA ? 'Atendido' : isP ? 'En proceso' : 'Pendiente';
    const badgeCls = isA ? 'atendido' : isP ? 'proceso' : 'pendiente';
    const fecha  = f.fecha ? new Date(f.fecha).toLocaleString('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:true}) : '—';
    const fechaA = f.fechaAtencion ? new Date(f.fechaAtencion).toLocaleString('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:true}) : '—';

    const detail = document.getElementById('tuiDetail');
    if (!detail) return;

    detail.innerHTML = `
      <div class="tui-detail-header">
        <button class="tui-back-btn" onclick="closeDetail()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span class="tui-detail-folio">${f.folio||f.id}</span>
        <span class="tui-detail-status tui-card-badge ${badgeCls}" style="margin-left:auto">${badgeLbl}</span>
      </div>

      <div class="tui-detail-body">
        <div class="tui-detail-unidad">Unidad ${f.unidad||'—'}</div>
        <div class="tui-detail-badges">
          <span style="font-size:10px;font-weight:700;padding:3px 9px;border-radius:5px;color:${clr};background:${clr}18;border:1px solid ${clr}30">${f.empresa||'—'}</span>
          <span style="font-size:11px;color:rgba(255,255,255,.4)">${fecha}</span>
        </div>

        <div class="tui-section">
          <div class="tui-section-title">Información general</div>
          <div class="tui-grid">
            <div><div class="tui-field-lbl">Base</div><div class="tui-field-val">${f.base||'—'}</div></div>
            <div><div class="tui-field-lbl">Servicio</div><div class="tui-field-val">${f.servicio||'—'}</div></div>
            <div><div class="tui-field-lbl">Piso</div><div class="tui-field-val">${f.piso||'—'}</div></div>
            <div><div class="tui-field-lbl">Prioridad</div><div class="tui-field-val">${f.prioridad||'—'}</div></div>
            <div class="tui-full"><div class="tui-field-lbl">Operador / Proveedor</div><div class="tui-field-val" style="color:#4fd1c5">${f.proveedor||'—'}</div></div>
          </div>
        </div>

        ${f.categoria ? `<div class="tui-section">
          <div class="tui-section-title">Falla técnica</div>
          <div class="tui-grid">
            <div><div class="tui-field-lbl">Categoría</div><div class="tui-field-val">${f.categoria||'—'}</div></div>
            <div><div class="tui-field-lbl">Componente</div><div class="tui-field-val">${f.componente||'—'}</div></div>
            <div class="tui-full"><div class="tui-field-lbl">Descripción</div><div class="tui-desc-box">${f.descripcion||'Sin descripción'}</div></div>
          </div>
        </div>` : ''}

        ${(f.tecnico || f.fechaAtencion) ? `<div class="tui-section">
          <div class="tui-section-title">Atención</div>
          <div class="tui-grid">
            <div><div class="tui-field-lbl">Técnico asignado</div><div class="tui-field-val">${f.tecnico||'—'}</div></div>
            <div><div class="tui-field-lbl">Fecha atención</div><div class="tui-field-val" style="color:#22c55e">${fechaA}</div></div>
            ${f.resultado?`<div class="tui-full"><div class="tui-field-lbl">Resultado</div><div class="tui-desc-box">${f.resultado}</div></div>`:''}
          </div>
        </div>` : ''}
      </div>

      <div class="tui-detail-footer">
        <button class="tui-btn-back" onclick="closeDetail()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          Regresar
        </button>
        ${isPend ? `<button class="tui-btn-atender" onclick="tuiAtender('${id}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
          Atender
        </button>` : isP ? `<div class="tui-status-proc">
          🔧 En atención — esperando validación del admin
        </div>` : `<div class="tui-status-proc" style="background:rgba(34,197,94,.08);border-color:rgba(34,197,94,.2);color:#22c55e">
          ✅ Reporte atendido y validado
        </div>`}
      </div>`;

    detail.classList.add('open');
    detail.scrollTop = 0;
  }

  window.closeDetail = function() {
    document.getElementById('tuiDetail')?.classList.remove('open');
    _detailId = null;
  };

  window.tuiAtender = function(id) {
    // Usar el modal original de tecnico.js
    if (typeof TECH !== 'undefined' && typeof showAtenderModal === 'function') {
      showAtenderModal(id);
    } else {
      // Buscar el botón de atender en el DOM original y hacerle click
      const btn = document.querySelector(`[data-atender="${id}"]`);
      if (btn) btn.click();
      else if (typeof TECH !== 'undefined' && TECH.showAtenderModal) {
        TECH.showAtenderModal(id);
      }
    }
  };

  /* ═══════════════ NAVEGACIÓN SCREENS ═══════════════ */
  window.tuiGoTab = function(tab) {
    closeDetail();
    document.getElementById('tuiPanelVision')?.classList.remove('open');
    document.getElementById('tuiPanelPerfil')?.classList.remove('open');
    ['Inicio','Vision','Perfil'].forEach(n => document.getElementById('tni'+n)?.classList.remove('active'));
    document.getElementById('tniInicio')?.classList.add('active');
    renderTab(_tab);
  };

  window.tuiGoScreen = function(screen) {
    closeDetail();
    document.getElementById('tuiPanelVision')?.classList.remove('open');
    document.getElementById('tuiPanelPerfil')?.classList.remove('open');
    ['Inicio','Vision','Perfil'].forEach(n => document.getElementById('tni'+n)?.classList.remove('active'));
    document.getElementById('tni' + screen.charAt(0).toUpperCase() + screen.slice(1))?.classList.add('active');

    if (screen === 'vision') {
      document.getElementById('tuiPanelVision')?.classList.add('open');
      renderVision();
    } else if (screen === 'perfil') {
      document.getElementById('tuiPanelPerfil')?.classList.add('open');
      renderPerfil();
    }
  };

  /* ═══════════════ VISIÓN ═══════════════ */
  let _period = 'dia';

  window.tuiPeriod = function(p, btn) {
    _period = p;
    document.querySelectorAll('.vp-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderVision();
  };

  function renderVision() {
    const session = typeof AUTH !== 'undefined' ? AUTH.checkSession() : null;
    if (!session) return;

    let atend = 0, pend = 0, corr = 0, prev = 0;
    try {
      if (typeof TECH !== 'undefined' && TECH.state?.fallas) {
        const all = TECH.state.fallas;
        const now = new Date();
        const cutoff = _period === 'dia'    ? new Date(now - 86400000)
                     : _period === 'semana' ? new Date(now - 7*86400000)
                     : new Date(now - 30*86400000);
        const un = session.username || '';
        const nm = session.nombre || session.name || '';
        const isA = (e) => /atendid/i.test(e||'');
        const misF = all.filter(f =>
          (f.tecnicoUsername === un || f.tecnico === nm) &&
          (!f.fecha || new Date(f.fecha) >= cutoff)
        );
        atend = misF.filter(f => isA(f.estatus)).length;
        pend  = all.filter(f => !isA(f.estatus) && (f.tecnicoUsername === un || f.tecnico === nm)).length;
        corr  = misF.filter(f => /correctiv/i.test(f.tipo)).length;
        prev  = misF.filter(f => /preventiv/i.test(f.tipo)).length;
      }
    } catch(e) {}

    T('tvAtend',atend); T('tvPend',pend); T('tvCorr',corr); T('tvPrev',prev);

    const chart = document.getElementById('tvChart');
    if (chart) {
      const max = Math.max(corr,prev,atend,1);
      chart.innerHTML = [['Correctivos',corr,'#ef4444'],['Preventivos',prev,'#22c55e'],['Atendidos',atend,'#4f8ef7']]
        .map(([l,v,c]) => `<div class="vp-bar-row">
          <div class="vp-bar-lbl">${l}</div>
          <div class="vp-bar-track"><div class="vp-bar-fill" style="width:${Math.round(v/max*100)}%;background:${c}"></div></div>
          <div class="vp-bar-n">${v}</div>
        </div>`).join('');
    }
  }

  /* ═══════════════ PERFIL ═══════════════ */
  function renderPerfil() {
    const s = typeof AUTH !== 'undefined' ? AUTH.checkSession() : null;
    if (!s) return;
    const nombre  = s.nombre || s.name || s.username || '—';
    T('ppAvatar', nombre.charAt(0).toUpperCase());
    T('ppNombre',  nombre);
    T('ppUser',   '@' + (s.username||'—'));
    T('ppBase',    s.base||'—');
    T('ppTel',     s.telefono||'—');
    T('ppEmp',     s.empleadoId||'—');
    T('ppEmail',   s.email||'—');
    T('ppEmps',   (s.empresas||[]).join(', ')||'—');
  }

  /* ═══════════════ SYNC POLL ═══════════════ */
  function syncPoll() {
    updateCounts();
    renderTab(_tab);
    setInterval(() => {
      updateCounts();
      if (_detailId) return; // no re-renderizar si hay detalle abierto
      renderTab(_tab);
    }, 5000);
  }

  function updateCounts() {
    try {
      if (typeof TECH !== 'undefined' && TECH.state?.fallas) {
        const all  = TECH.state.fallas;
        const isA  = (e) => /atendid/i.test(e||'');
        const isP  = (e) => /proceso/i.test(e||'');
        T('kpiPendiente', all.filter(f => !isA(f.estatus) && !isP(f.estatus)).length);
        T('kpiProceso',   all.filter(f => isP(f.estatus)).length);
        T('kpiAtendido',  all.filter(f => isA(f.estatus)).length);
        T('kpiTotal',     all.length);
      }
    } catch(e) {}
  }

  /* ═══════════════ HELPERS ═══════════════ */
  function empColor(emp) {
    const M = {GHO:'#4f8ef7',ETN:'#f59e0b',AERS:'#22c55e',AMEALSENSE:'#a855f7'};
    return M[emp] || '#4f8ef7';
  }
  function T(id,v) { const e=document.getElementById(id); if(e) e.textContent=v??'—'; }

})();
