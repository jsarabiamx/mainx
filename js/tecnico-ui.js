/* tecnico-ui.js — Visión + Perfil  v2.0
   Carga datos reales de Supabase para el técnico logueado
*/
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    addStyles();
    addPanels();
    watchReady();
  });

  /* ══════════════════════════════════════════
     ESTILOS
  ══════════════════════════════════════════ */
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
      .tni { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; cursor:pointer; user-select:none; }
      .tni-icon { width:28px; height:28px; border-radius:8px; display:flex; align-items:center; justify-content:center; color:rgba(255,255,255,.3); transition:all .15s; }
      .tni.active .tni-icon { background:rgba(79,142,247,.15); color:#4f8ef7; }
      .tni-lbl { font-size:10px; font-weight:600; color:rgba(255,255,255,.3); transition:color .15s; }
      .tni.active .tni-lbl { color:#4f8ef7; }

      #tuiPanelVision, #tuiPanelPerfil {
        position:fixed; inset:0; z-index:8000;
        background:#07090f; overflow-y:auto;
        padding:16px 16px calc(80px + env(safe-area-inset-bottom));
        transform:translateY(100%);
        transition:transform .3s cubic-bezier(.33,1,.68,1);
        pointer-events:none;
      }
      #tuiPanelVision.open, #tuiPanelPerfil.open { transform:translateY(0); pointer-events:all; }

      .vp-head { font-size:15px; font-weight:700; margin-bottom:16px; padding-top:8px; display:flex; align-items:center; justify-content:space-between; }
      .vp-back { background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.1); border-radius:8px; color:rgba(255,255,255,.5); font-size:11px; padding:5px 12px; cursor:pointer; font-family:inherit; }

      .vp-tabs { display:flex; gap:6px; margin-bottom:16px; }
      .vp-tab { flex:1; padding:9px; background:#111622; border:1px solid rgba(255,255,255,.1); border-radius:10px; font-size:11px; font-weight:600; color:rgba(255,255,255,.4); cursor:pointer; text-align:center; font-family:inherit; transition:all .15s; }
      .vp-tab.active { background:rgba(79,142,247,.12); border-color:rgba(79,142,247,.4); color:#4f8ef7; }

      .vp-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px; }
      .vp-card { background:#111622; border:1px solid rgba(255,255,255,.07); border-radius:14px; padding:16px 14px; }
      .vp-val { font-size:32px; font-weight:700; font-family:monospace; line-height:1; margin-bottom:4px; }
      .vp-lbl { font-size:11px; color:rgba(255,255,255,.35); }
      .vp-card-wide { background:#111622; border:1px solid rgba(255,255,255,.07); border-radius:14px; padding:16px 14px; margin-bottom:10px; display:flex; align-items:center; justify-content:space-between; }
      .vp-prod-num { font-size:36px; font-weight:800; font-family:monospace; }
      .vp-prod-lbl { font-size:11px; color:rgba(255,255,255,.35); margin-top:3px; }
      .vp-prod-ring { width:72px; height:72px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:19px; font-weight:800; font-family:monospace; border:4px solid rgba(255,255,255,.07); flex-shrink:0; }

      .vp-chart { background:#111622; border:1px solid rgba(255,255,255,.07); border-radius:14px; padding:16px; margin-bottom:10px; }
      .vp-chart-title { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:rgba(255,255,255,.3); margin-bottom:14px; }
      .vp-bar-row { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
      .vp-bar-lbl { font-size:11px; color:rgba(255,255,255,.4); width:72px; text-align:right; flex-shrink:0; }
      .vp-bar-track { flex:1; height:8px; background:rgba(255,255,255,.05); border-radius:4px; overflow:hidden; }
      .vp-bar-fill { height:100%; border-radius:4px; transition:width .5s ease; }
      .vp-bar-n { font-size:11px; font-family:monospace; color:rgba(255,255,255,.5); width:22px; text-align:right; }

      .vp-trend { background:#111622; border:1px solid rgba(255,255,255,.07); border-radius:14px; padding:16px; margin-bottom:10px; }
      .vp-trend-bars { display:flex; align-items:flex-end; gap:4px; height:90px; margin-top:10px; }
      .vp-t-col { display:flex; flex-direction:column; align-items:center; justify-content:flex-end; gap:4px; flex:1; min-width:0; }
      .vp-t-bar { width:100%; border-radius:3px 3px 0 0; min-height:2px; transition:height .4s ease; }
      .vp-t-lbl { font-size:9px; color:rgba(255,255,255,.3); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; text-align:center; }
      .vp-t-val { font-size:10px; font-family:monospace; color:rgba(255,255,255,.5); line-height:1; }

      .vp-empty { text-align:center; padding:32px 16px; color:rgba(255,255,255,.3); font-size:13px; }
      .vp-empty-ico { font-size:32px; margin-bottom:10px; }

      .pp-wrap { display:flex; flex-direction:column; align-items:center; padding:24px 0 20px; }
      .pp-avatar { width:80px; height:80px; border-radius:50%; background:linear-gradient(135deg,#1e3a6e,#2a4a8a); border:2px solid rgba(79,142,247,.35); display:flex; align-items:center; justify-content:center; font-size:30px; font-weight:700; color:#4f8ef7; margin-bottom:12px; }
      .pp-name { font-size:21px; font-weight:700; margin-bottom:3px; text-align:center; }
      .pp-role { font-size:11px; color:rgba(255,255,255,.35); background:rgba(79,142,247,.12); border:1px solid rgba(79,142,247,.2); padding:3px 10px; border-radius:20px; margin-bottom:4px; }
      .pp-emp-chips { display:flex; gap:6px; flex-wrap:wrap; justify-content:center; margin-top:8px; }
      .pp-chip { font-size:10px; font-weight:700; padding:2px 8px; border-radius:10px; background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.1); color:rgba(255,255,255,.5); }
      .pp-card { background:#111622; border:1px solid rgba(255,255,255,.07); border-radius:14px; overflow:hidden; margin-bottom:12px; }
      .pp-row { display:flex; align-items:center; justify-content:space-between; padding:13px 16px; border-bottom:1px solid rgba(255,255,255,.05); }
      .pp-row:last-child { border-bottom:none; }
      .pp-row-lbl { font-size:12px; color:rgba(255,255,255,.35); }
      .pp-row-val { font-size:13px; font-weight:600; max-width:60%; overflow:hidden; text-overflow:ellipsis; text-align:right; white-space:nowrap; }
      .pp-stat-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:12px; }
      .pp-stat { background:#111622; border:1px solid rgba(255,255,255,.07); border-radius:12px; padding:14px 10px; text-align:center; }
      .pp-stat-n { font-size:26px; font-weight:700; font-family:monospace; }
      .pp-stat-l { font-size:10px; color:rgba(255,255,255,.35); margin-top:3px; }

      .vp-loader { display:flex; align-items:center; justify-content:center; padding:40px 0; gap:10px; color:rgba(255,255,255,.3); font-size:12px; }
      .vp-spinner { width:18px; height:18px; border:2px solid rgba(255,255,255,.1); border-top-color:#4f8ef7; border-radius:50%; animation:vpSpin .7s linear infinite; }
      @keyframes vpSpin { to { transform:rotate(360deg); } }
    `;
    document.head.appendChild(s);
  }

  /* ══════════════════════════════════════════
     PANELES HTML
  ══════════════════════════════════════════ */
  function addPanels() {
    if (!document.getElementById('tuiPanelVision')) {
      const pv = document.createElement('div');
      pv.id = 'tuiPanelVision';
      pv.innerHTML = `
        <div class="vp-head">
          📊 Mi Visión
          <button class="vp-back" onclick="tuiScreen('inicio')">← Regresar</button>
        </div>
        <div class="vp-tabs">
          <button class="vp-tab active" onclick="tuiPeriod('dia',this)">Hoy</button>
          <button class="vp-tab" onclick="tuiPeriod('semana',this)">Semana</button>
          <button class="vp-tab" onclick="tuiPeriod('mes',this)">Mes</button>
          <button class="vp-tab" onclick="tuiPeriod('total',this)">Total</button>
        </div>
        <div id="tvContent"><div class="vp-loader"><div class="vp-spinner"></div> Cargando...</div></div>
      `;
      document.body.appendChild(pv);
    }

    if (!document.getElementById('tuiPanelPerfil')) {
      const pp = document.createElement('div');
      pp.id = 'tuiPanelPerfil';
      pp.innerHTML = `
        <div class="vp-head">
          👤 Mi Perfil
          <button class="vp-back" onclick="tuiScreen('inicio')">← Regresar</button>
        </div>
        <div id="ppContent"><div class="vp-loader"><div class="vp-spinner"></div> Cargando...</div></div>
      `;
      document.body.appendChild(pp);
    }
  }

  /* ══════════════════════════════════════════
     NAVEGACIÓN
  ══════════════════════════════════════════ */
  window.tuiScreen = window.tuiGo = function (screen) {
    ['Inicio','Vision','Perfil'].forEach(n =>
      document.getElementById('tni'+n)?.classList.remove('active')
    );
    const navId = screen === 'vision' ? 'tniVision' : screen === 'perfil' ? 'tniPerfil' : 'tniInicio';
    document.getElementById(navId)?.classList.add('active');
    document.getElementById('tuiPanelVision')?.classList.remove('open');
    document.getElementById('tuiPanelPerfil')?.classList.remove('open');
    if (screen === 'vision') {
      document.getElementById('tuiPanelVision')?.classList.add('open');
      renderVision();
    } else if (screen === 'perfil') {
      document.getElementById('tuiPanelPerfil')?.classList.add('open');
      renderPerfil();
    }
  };

  let _period = 'dia';
  window.tuiPeriod = function (p, btn) {
    _period = p;
    document.querySelectorAll('.vp-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderVision();
  };

  /* ══════════════════════════════════════════
     HELPERS
  ══════════════════════════════════════════ */
  function getSession() {
    try { return AUTH.checkSession(); } catch (e) { return null; }
  }
  function cutoff(period) {
    const now = new Date();
    if (period === 'dia')    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (period === 'semana') return new Date(now - 7  * 86400000);
    if (period === 'mes')    return new Date(now - 30 * 86400000);
    return null;
  }
  function isAtendido(est)  { return /atendid/i.test(est || ''); }
  function isEnProceso(est) { return /proceso/i.test(est || ''); }
  function isPendiente(est) { return !isAtendido(est) && !isEnProceso(est); }

  /* ══════════════════════════════════════════
     CACHÉ DE REPORTES DEL TÉCNICO
  ══════════════════════════════════════════ */
  let _reportesCache = null;
  let _reportesCacheTs = 0;
  const CACHE_TTL = 60000;

  async function getTechReportes() {
    const now = Date.now();
    if (_reportesCache && (now - _reportesCacheTs) < CACHE_TTL) return _reportesCache;

    const s = getSession();
    if (!s) return [];
    const un = (s.username || '').toLowerCase().trim();
    const sn = (s.nombre || '').toLowerCase().trim();

    try {
      const todos = await DS.getAllReportesActivos();
      const mios = todos.filter(f => {
        const tu = (f.tecnicoUsername || f.tecnico_username || '').toLowerCase().trim();
        const tn = (f.tecnico || f.tecnicoNombre || '').toLowerCase().trim();
        return (un && tu === un) || (sn && tn && tn === sn);
      });
      _reportesCache = mios;
      _reportesCacheTs = now;
      return mios;
    } catch (e) {
      console.warn('[TUI] Error cargando reportes:', e);
      const fallback = (window._techState?.fallas || []).filter(f => {
        return (f.tecnicoUsername || '').toLowerCase().trim() === un;
      });
      _reportesCache = fallback;
      _reportesCacheTs = now;
      return fallback;
    }
  }

  function invalidateCache() { _reportesCacheTs = 0; _reportesCache = null; }

  /* ══════════════════════════════════════════
     RENDER VISIÓN
  ══════════════════════════════════════════ */
  let _visionRendering = false;

  async function renderVision() {
    if (_visionRendering) return;
    _visionRendering = true;
    invalidateCache();

    const cont = document.getElementById('tvContent');
    if (!cont) { _visionRendering = false; return; }
    cont.innerHTML = `<div class="vp-loader"><div class="vp-spinner"></div> Cargando reportes...</div>`;

    try {
      const s = getSession();
      if (!s) {
        cont.innerHTML = `<div class="vp-empty"><div class="vp-empty-ico">🔒</div>Sin sesión activa</div>`;
        _visionRendering = false; return;
      }

      const todos  = await getTechReportes();
      const cut    = cutoff(_period);

      const enPeriodo   = cut
        ? todos.filter(f => {
            const fd = f.fecha || f.fechaReporte || f.created_at || f.createdAt;
            return fd && new Date(fd) >= cut;
          })
        : todos;

      const atendidos   = todos.filter(f => isAtendido(f.estatus));
      const perAtend    = enPeriodo.filter(f => isAtendido(f.estatus));
      const perPend     = enPeriodo.filter(f => isPendiente(f.estatus));
      const perProc     = enPeriodo.filter(f => isEnProceso(f.estatus));
      const perCorrect  = enPeriodo.filter(f => /correctiv/i.test(f.tipo || ''));
      const perPrev     = enPeriodo.filter(f => /preventiv/i.test(f.tipo || ''));

      const total    = todos.length;
      const totalPer = enPeriodo.length;
      const prodPct  = total > 0 ? Math.round((atendidos.length / total) * 100) : 0;
      const prodColor= prodPct >= 70 ? '#22c55e' : prodPct >= 40 ? '#f59e0b' : '#ef4444';
      const perLabel = { dia:'hoy', semana:'esta semana', mes:'este mes', total:'histórico' }[_period];
      const trendData= buildTrend(_period, todos);

      cont.innerHTML = `
        <div class="vp-grid">
          <div class="vp-card">
            <div class="vp-val" style="color:#22c55e">${perAtend.length}</div>
            <div class="vp-lbl">Atendidos ${perLabel}</div>
          </div>
          <div class="vp-card">
            <div class="vp-val" style="color:#f59e0b">${perPend.length}</div>
            <div class="vp-lbl">Pendientes</div>
          </div>
          <div class="vp-card">
            <div class="vp-val" style="color:#3b82f6">${perProc.length}</div>
            <div class="vp-lbl">En proceso</div>
          </div>
          <div class="vp-card">
            <div class="vp-val">${totalPer}</div>
            <div class="vp-lbl">Total ${perLabel}</div>
          </div>
        </div>

        <div class="vp-card-wide">
          <div>
            <div class="vp-prod-num" style="color:${prodColor}">${atendidos.length}<span style="font-size:18px;color:rgba(255,255,255,.3)">/${total}</span></div>
            <div class="vp-prod-lbl">Reportes atendidos (histórico)</div>
          </div>
          <div class="vp-prod-ring" style="border-color:${prodColor};color:${prodColor}">${prodPct}%</div>
        </div>

        ${totalPer > 0 ? `
        <div class="vp-chart">
          <div class="vp-chart-title">Distribución ${perLabel}</div>
          ${bar('Atendidos',  perAtend.length,   totalPer, '#22c55e')}
          ${bar('En proceso', perProc.length,    totalPer, '#3b82f6')}
          ${bar('Pendientes', perPend.length,    totalPer, '#f59e0b')}
          ${bar('Correctivos',perCorrect.length, totalPer, '#ef4444')}
          ${bar('Preventivos',perPrev.length,    totalPer, '#8b5cf6')}
        </div>` : ''}

        ${trendData.some(d => d.val > 0) ? `
        <div class="vp-trend">
          <div class="vp-chart-title">Tendencia de atención</div>
          <div class="vp-trend-bars">
            ${trendData.map(d => {
              const pct = d.max > 0 ? Math.round((d.val / d.max) * 100) : 0;
              const h   = Math.max(pct * 0.8, d.val > 0 ? 4 : 2);
              return `<div class="vp-t-col">
                <div class="vp-t-val">${d.val > 0 ? d.val : ''}</div>
                <div class="vp-t-bar" style="height:${h}px;background:${d.val>0?'#4f8ef7':'rgba(255,255,255,.05)'}"></div>
                <div class="vp-t-lbl">${d.label}</div>
              </div>`;
            }).join('')}
          </div>
        </div>` : ''}

        ${total === 0 ? `<div class="vp-empty"><div class="vp-empty-ico">📋</div>No tienes reportes asignados aún</div>` : ''}
      `;
    } catch (err) {
      cont.innerHTML = `<div class="vp-empty"><div class="vp-empty-ico">⚠️</div>Error al cargar datos</div>`;
      console.error('[TUI Vision]', err);
    }
    _visionRendering = false;
  }

  function bar(label, val, max, color) {
    const pct = max > 0 ? Math.round((val / max) * 100) : 0;
    return `<div class="vp-bar-row">
      <div class="vp-bar-lbl">${label}</div>
      <div class="vp-bar-track"><div class="vp-bar-fill" style="width:${pct}%;background:${color}"></div></div>
      <div class="vp-bar-n">${val}</div>
    </div>`;
  }

  function buildTrend(period, reportes) {
    const now   = new Date();
    const atend = reportes.filter(f => isAtendido(f.estatus));
    let slots   = [];

    if (period === 'dia') {
      for (let h = 0; h < 24; h++) {
        const cnt = atend.filter(f => {
          const fd = f.fecha || f.fechaReporte || f.created_at;
          if (!fd) return false;
          const nd = new Date(fd);
          return nd.getHours() === h && nd.getDate() === now.getDate() && nd.getMonth() === now.getMonth();
        }).length;
        slots.push({ label: h % 4 === 0 ? h+'h' : '', val: cnt });
      }
    } else if (period === 'semana') {
      const dias = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now - i * 86400000);
        const cnt = atend.filter(f => {
          const fd = f.fecha || f.fechaReporte || f.created_at;
          if (!fd) return false;
          const nd = new Date(fd);
          return nd.getDate() === d.getDate() && nd.getMonth() === d.getMonth();
        }).length;
        slots.push({ label: dias[d.getDay()], val: cnt });
      }
    } else if (period === 'mes') {
      for (let w = 3; w >= 0; w--) {
        const from = new Date(now - (w+1)*7*86400000);
        const to   = new Date(now - w*7*86400000);
        const cnt  = atend.filter(f => {
          const fd = f.fecha || f.fechaReporte || f.created_at;
          if (!fd) return false;
          const nd = new Date(fd);
          return nd >= from && nd < to;
        }).length;
        slots.push({ label: 'Sem '+(4-w), val: cnt });
      }
    } else {
      const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
      for (let m = 5; m >= 0; m--) {
        const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
        const cnt = atend.filter(f => {
          const fd = f.fecha || f.fechaReporte || f.created_at;
          if (!fd) return false;
          const nd = new Date(fd);
          return nd.getFullYear() === d.getFullYear() && nd.getMonth() === d.getMonth();
        }).length;
        slots.push({ label: meses[d.getMonth()], val: cnt });
      }
    }

    const maxVal = Math.max(...slots.map(s => s.val), 1);
    return slots.map(s => ({ ...s, max: maxVal }));
  }

  /* ══════════════════════════════════════════
     RENDER PERFIL
  ══════════════════════════════════════════ */
  async function renderPerfil() {
    const cont = document.getElementById('ppContent');
    if (!cont) return;
    cont.innerHTML = `<div class="vp-loader"><div class="vp-spinner"></div> Cargando perfil...</div>`;

    try {
      const s = getSession();
      if (!s) {
        cont.innerHTML = `<div class="vp-empty"><div class="vp-empty-ico">🔒</div>Sin sesión activa</div>`;
        return;
      }

      let perfil = { ...s };
      try {
        const users = await DS.getUsers();
        const lista = users?.list || users || [];
        const found = lista.find(u =>
          (u.username || '').toLowerCase() === (s.username || '').toLowerCase()
        );
        if (found) perfil = { ...s, ...found };
      } catch (e) { /* usa sesión */ }

      const nm    = perfil.nombre  || perfil.name     || '—';
      const un    = perfil.username                   || '—';
      const em    = perfil.email                      || '—';
      const tel   = perfil.telefono                   || '—';
      const base  = perfil.base                       || '—';
      const empId = perfil.empleado_id || perfil.empleadoId || '—';
      const emps  = perfil.empresas || s.empresas     || [];
      const role  = perfil.role || s.role             || 'tecnico';

      const fmtDate = iso => {
        if (!iso) return '—';
        try { return new Date(iso).toLocaleDateString('es-MX', {year:'numeric',month:'short',day:'numeric'}); }
        catch(e){ return iso; }
      };
      const creado   = fmtDate(perfil.created_at || perfil.createdAt);
      const hist     = perfil.login_history || perfil.loginHistory || [];
      const lastLogin= hist.length > 0
        ? (() => {
            try {
              const entry = hist[hist.length-1];
              const dt    = entry?.fecha || entry?.ts || entry;
              return new Date(dt).toLocaleDateString('es-MX',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
            } catch(e){ return '—'; }
          })()
        : 'Primera sesión';

      // Stats
      const todos  = _reportesCache || [];
      const totalR = todos.length;
      const atendR = todos.filter(f => isAtendido(f.estatus)).length;
      const pendR  = todos.filter(f => isPendiente(f.estatus)).length;

      cont.innerHTML = `
        <div class="pp-wrap">
          <div class="pp-avatar">${nm.charAt(0).toUpperCase()}</div>
          <div class="pp-name">${nm}</div>
          <div class="pp-role">${role.toUpperCase()}</div>
          <div class="pp-emp-chips">
            ${emps.length > 0
              ? emps.map(e=>`<span class="pp-chip">${e}</span>`).join('')
              : `<span class="pp-chip">${perfil.empresa || s.empresa || '—'}</span>`}
          </div>
        </div>

        <div class="pp-stat-grid">
          <div class="pp-stat">
            <div class="pp-stat-n">${totalR}</div>
            <div class="pp-stat-l">Asignados</div>
          </div>
          <div class="pp-stat">
            <div class="pp-stat-n" style="color:#22c55e">${atendR}</div>
            <div class="pp-stat-l">Atendidos</div>
          </div>
          <div class="pp-stat">
            <div class="pp-stat-n" style="color:#f59e0b">${pendR}</div>
            <div class="pp-stat-l">Pendientes</div>
          </div>
        </div>

        <div class="pp-card">
          <div class="pp-row"><span class="pp-row-lbl">👤 Usuario</span><span class="pp-row-val" style="color:#4f8ef7">@${un}</span></div>
          <div class="pp-row"><span class="pp-row-lbl">📧 Email</span><span class="pp-row-val" style="font-size:11px">${em}</span></div>
          <div class="pp-row"><span class="pp-row-lbl">📱 Teléfono</span><span class="pp-row-val">${tel}</span></div>
        </div>

        <div class="pp-card">
          <div class="pp-row"><span class="pp-row-lbl">🏢 Base</span><span class="pp-row-val">${base}</span></div>
          <div class="pp-row"><span class="pp-row-lbl">🆔 ID Empleado</span><span class="pp-row-val">${empId}</span></div>
          <div class="pp-row"><span class="pp-row-lbl">🏭 Empresas</span><span class="pp-row-val">${emps.join(', ') || '—'}</span></div>
        </div>

        <div class="pp-card">
          <div class="pp-row"><span class="pp-row-lbl">📅 Registro</span><span class="pp-row-val">${creado}</span></div>
          <div class="pp-row"><span class="pp-row-lbl">🕐 Último acceso</span><span class="pp-row-val" style="font-size:11px">${lastLogin}</span></div>
        </div>
      `;
    } catch (err) {
      cont.innerHTML = `<div class="vp-empty"><div class="vp-empty-ico">⚠️</div>Error al cargar perfil</div>`;
      console.error('[TUI Perfil]', err);
    }
  }

  /* ══════════════════════════════════════════
     ESPERAR A QUE LA APP CARGUE
  ══════════════════════════════════════════ */
  function watchReady() {
    let tries = 0;
    const check = setInterval(() => {
      tries++;
      const ov = document.getElementById('loadingOverlay');
      const loaded = !ov || ov.style.display === 'none' || ov.style.visibility === 'hidden';
      if (loaded || tries > 80) {
        clearInterval(check);
        setTimeout(() => getTechReportes().catch(() => {}), 1000);
      }
    }, 150);
  }

  /* ══════════════════════════════════════════
     BOTÓN ATENDER DEL DETALLE
  ══════════════════════════════════════════ */
  setInterval(() => {
    const btn = document.getElementById('detalleAtenderBtn');
    if (!btn || btn._bound) return;
    btn._bound = true;
    btn.addEventListener('click', () => {
      try {
        const id = window._techState?.selectedId;
        if (id && typeof showAtenderModal === 'function') showAtenderModal(id);
      } catch (e) {}
    });
  }, 500);

  setInterval(() => {
    const vd = document.getElementById('viewDetalle');
    if (!vd || vd.style.display === 'none') return;
    try {
      const id  = window._techState?.selectedId;
      const f   = window._techState?.fallas?.find(x => x.id === id);
      const sec = document.getElementById('detalleAtenderSection');
      if (sec && f) sec.style.display = /proceso|atendid/i.test(f.estatus || '') ? 'none' : '';
    } catch (e) {}
  }, 800);

})();
