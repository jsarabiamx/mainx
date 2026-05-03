/* ═══════════════════════════════════════════════
   CCTV Fleet Control — App Main Controller v7.0
   + Campana de notificaciones para admin
   + Módulo de validación en proceso
   + Técnico por base en campos de selección
═══════════════════════════════════════════════ */

const APP = (() => {

  let currentModule = 'atencion';
  let notifPollInterval = null;

  async function init() {
    try {
      await DATA.init();
    } catch (e) {
      console.error('[APP] DATA.init() falló:', e);
    }
    const session = await AUTH.checkSessionAsync();
    if (!session) { window.location.href = 'index.html'; return; }

    // Si tiene first_login pendiente, regresar al login para completar datos
    if (session.firstLogin) { window.location.replace('index.html'); return; }

    if (session.role === AUTH.ROLES.TECH) {
      window.location.href = 'tecnico.html'; return;
    }

    // Bloquear el botón "atrás" del navegador — evita entrar sin autenticación
    history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', () => {
      history.pushState(null, '', window.location.href);
    });

    await AUTH.trackDeviceInfo();

    UI.renderNav(session);
    UI.renderEmpresaStrip(session);
    UI.updateHeaderUser(session);
    UI.updateClock();
    setInterval(UI.updateClock, 1000);

    // Inject notification bell for admin/master
    injectNotifBell();
    startNotifPoll();

    const chip = document.getElementById('userChip');
    if (chip) {
      chip.addEventListener('click', () => {
        const dd = document.getElementById('userDropdown');
        if (dd) dd.classList.toggle('open');
      });
      document.addEventListener('click', (e) => {
        if (!chip.contains(e.target)) {
          const dd = document.getElementById('userDropdown');
          if (dd) dd.classList.remove('open');
        }
        // Close notif dropdown on outside click
        const notifWrap = document.getElementById('adminNotifWrap');
        if (notifWrap && !notifWrap.contains(e.target)) {
          const drop = document.getElementById('adminNotifDropdown');
          if (drop) drop.style.display = 'none';
        }
      });
    }

    const isMaster = session.role === AUTH.ROLES.MASTER;
    const isAdmin  = session.role === AUTH.ROLES.ADMIN;
    const defaultMod = (isMaster || isAdmin) ? 'dashboard' : 'atencion';
    await showModule(defaultMod);

    await AUTH.log('PAGE_LOAD', `Cargó el sistema (${AUTH.ROLE_LABELS[session.role]})`);
  }

  /* ─── CAMPANA NOTIFICACIONES ADMIN ──────────── */
  function injectNotifBell() {
    const headerRight = document.querySelector('.header-right');
    if (!headerRight || document.getElementById('adminNotifWrap')) return;

    const wrap = document.createElement('div');
    wrap.id = 'adminNotifWrap';
    wrap.style.cssText = 'position:relative;display:flex;align-items:center';
    wrap.innerHTML = `
      <button id="adminNotifBtn" onclick="APP.toggleNotif()" title="Notificaciones" style="
        position:relative;background:var(--bg3);border:1px solid var(--border);
        border-radius:8px;color:var(--text2);padding:6px 10px;cursor:pointer;
        display:flex;align-items:center;gap:5px;font-size:12px;transition:all 0.15s">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 01-3.46 0"/>
        </svg>
        <span id="adminNotifBadge" style="display:none;position:absolute;top:-5px;right:-5px;
          background:#ef4444;color:white;border-radius:50%;width:17px;height:17px;
          font-size:9px;font-weight:700;align-items:center;justify-content:center;
          border:2px solid var(--bg)">0</span>
      </button>
      <div id="adminNotifDropdown" style="display:none;position:absolute;top:calc(100%+8px);right:0;
        z-index:9999;background:var(--bg2);border:1px solid var(--border2);border-radius:12px;
        box-shadow:0 20px 50px rgba(0,0,0,0.7);width:380px;overflow:hidden">
        <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:12px;font-weight:700;color:var(--text)">Notificaciones del Sistema</span>
          <div style="display:flex;gap:8px">
            <button onclick="APP.showValidacionModule()" style="font-size:10px;color:var(--amber);background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.25);border-radius:5px;padding:3px 8px;cursor:pointer">
              Ver en proceso
            </button>
            <button onclick="APP.marcarTodasLeidas()" style="font-size:10px;color:var(--accent);background:none;border:none;cursor:pointer">Marcar leídas</button>
          </div>
        </div>
        <div id="adminNotifList" style="max-height:380px;overflow-y:auto"></div>
      </div>`;
    // Insert before the user chip
    const userChip = document.getElementById('userChip');
    headerRight.insertBefore(wrap, userChip);
    updateNotifBadge();
  }

  function updateNotifBadge() {
    const raw = DATA.getNotificacionesNoLeidas().filter(n => n.destino === 'admin' || n.tipo === 'TECH_ATENDIENDO');
    // Deduplicar por reporteId+tipo
    const seen = new Map();
    const notifs = [];
    for (const n of raw.sort((a,b) => new Date(b.fecha) - new Date(a.fecha))) {
      const key = (n.reporteId || n.id) + '|' + n.tipo;
      if (!seen.has(key)) { seen.set(key, true); notifs.push(n); }
    }
    const badge = document.getElementById('adminNotifBadge');
    if (!badge) return;
    if (notifs.length > 0) {
      badge.style.display = 'flex';
      badge.textContent = notifs.length > 9 ? '9+' : notifs.length;
    } else {
      badge.style.display = 'none';
    }
  }

  function startNotifPoll() {
    notifPollInterval = setInterval(async () => {
      updateNotifBadge();
      DATA.state.fallas = await DS.getAllReportesActivos();
      DATA.state.notificaciones = await DS.getNotificaciones();
    }, 8000);
  }

  function toggleNotif() {
    const drop = document.getElementById('adminNotifDropdown');
    if (!drop) return;
    const isOpen = drop.style.display !== 'none';
    drop.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) renderNotifList();
  }

  function renderNotifList() {
    const cont = document.getElementById('adminNotifList');
    if (!cont) return;
    const raw = DATA.getNotificaciones().filter(n => n.destino === 'admin' || n.tipo === 'TECH_ATENDIENDO');
    // Deduplicar: por cada reporteId+tipo conservar solo la más reciente
    const seen = new Map();
    const all = [];
    for (const n of raw.sort((a,b) => new Date(b.fecha) - new Date(a.fecha))) {
      const key = (n.reporteId || n.id) + '|' + n.tipo;
      if (!seen.has(key)) { seen.set(key, true); all.push(n); }
    }
    const allSliced = all.slice(0, 30);

    if (!allSliced.length) {
      cont.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text3);font-size:12px">Sin notificaciones pendientes</div>`;
      return;
    }

    cont.innerHTML = allSliced.map(n => {
      const isAtend = n.tipo === 'TECH_ATENDIENDO';
      return `
        <div style="padding:12px 16px;border-bottom:1px solid var(--border);cursor:pointer;
          background:${n.leida ? 'transparent' : 'rgba(245,158,11,0.04)'};transition:background 0.15s"
          onclick="APP.onNotifClick('${n.id}','${n.reporteId || ''}')">
          <div style="display:flex;align-items:flex-start;gap:10px">
            <div style="flex-shrink:0;width:32px;height:32px;border-radius:8px;
              background:${isAtend ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)'};
              border:1px solid ${isAtend ? 'rgba(245,158,11,0.25)' : 'rgba(34,197,94,0.25)'};
              display:flex;align-items:center;justify-content:center;font-size:14px">
              ${isAtend ? '🔧' : '✅'}
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:3px;display:flex;align-items:center;gap:6px">
                ${n.titulo || n.tipo}
                ${!n.leida ? '<span style="width:6px;height:6px;border-radius:50%;background:#f59e0b;flex-shrink:0"></span>' : ''}
              </div>
              <div style="font-size:11px;color:var(--text2);line-height:1.4">${n.mensaje || ''}</div>
              <div style="font-size:10px;color:var(--text3);margin-top:4px;display:flex;align-items:center;gap:8px">
                <span>${fmtDt(n.fecha)}</span>
                ${n.empresa ? `<span style="background:rgba(79,142,247,0.1);color:var(--accent);border-radius:3px;padding:1px 5px;font-size:9px">${n.empresa}</span>` : ''}
              </div>
            </div>
          </div>
          ${isAtend && !n.leida ? `
            <div style="margin-top:8px;display:flex;gap:6px">
              <button onclick="event.stopPropagation();APP.validarDesdeNotif('${n.reporteId}')" style="
                flex:1;padding:6px;border-radius:6px;background:linear-gradient(135deg,#22c55e,#16a34a);
                border:none;color:white;font-size:11px;font-weight:700;cursor:pointer">
                ✓ Validar y marcar Atendido
              </button>
              <button onclick="event.stopPropagation();APP.irAReporte('${n.reporteId}')" style="
                padding:6px 10px;border-radius:6px;background:var(--bg3);border:1px solid var(--border);
                color:var(--text2);font-size:11px;cursor:pointer">
                Ver detalle
              </button>
            </div>` : ''}
        </div>`;
    }).join('');
  }

  function fmtDt(s) {
    if (!s) return '—';
    const d = new Date(s);
    return d.toLocaleDateString('es-MX', { day:'2-digit', month:'short' }) +
           ' ' + d.toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' });
  }

  async function onNotifClick(notifId, reporteId) {
    await DATA.marcarNotificacionLeida(notifId);
    updateNotifBadge();
    renderNotifList();
    if (reporteId) irAReporte(reporteId);
  }

  function irAReporte(reporteId) {
    const drop = document.getElementById('adminNotifDropdown');
    if (drop) drop.style.display = 'none';
    showModule('atencion');
    setTimeout(() => {
      if (typeof MODS !== 'undefined' && MODS.selAtencion) {
        MODS.selAtencion(reporteId);
      }
    }, 100);
  }

  async function validarDesdeNotif(reporteId) {
    const falla = DATA.state.fallas.find(f => f.id === reporteId);
    if (!falla) { UI.toast('Reporte no encontrado', 'err'); return; }

    try {
      // Resolver el label de "atendido" según la empresa del reporte (GHO='Atendidos', ETN='Atendidos', etc.)
      const listaEst = DATA.getSel('estatus', falla.empresa);
      const estatusAtendido = listaEst.find(e => /atendid/i.test(e)) || 'Atendido';
      await DATA.actualizarReporte(reporteId, {
        estatus: estatusAtendido,
        resultado: 'Validado y marcado como atendido desde notificación'
      });
      DATA.state.fallas = await DS.getAllReportesActivos();
      await DATA.marcarNotificacionesPorReporte(reporteId);
    } catch (error) {
      UI.toast(error.message || 'No se pudo validar el reporte', 'err');
      return;
    }

    updateNotifBadge();
    renderNotifList();
    UI.toast(`Unidad ${falla.unidad} validada y atendida ✓`);
    UI.updateHeaderCounts();

    // Refresh current module
    if (currentModule === 'atencion') await showModule('atencion');
  }

  async function marcarTodasLeidas() {
    await DATA.marcarTodasLeidas(n => n.destino === 'admin' || n.tipo === 'TECH_ATENDIENDO');
    updateNotifBadge();
    renderNotifList();
  }

  function showValidacionModule() {
    const drop = document.getElementById('adminNotifDropdown');
    if (drop) drop.style.display = 'none';
    showModule('atencion');
    // After render, filter to show En proceso
    setTimeout(() => {
      UI.toast('Mostrando reportes en proceso — busca "En proceso" en la lista', 'warn');
    }, 200);
  }

  /* ─── MODULE ROUTING ─────────────────────────── */
  async function showModule(mod) {
    const session = await AUTH.checkSessionAsync();
    if (!session) { window.location.href = 'index.html'; return; }

    const perms = {
      registro:  AUTH.can('addReports'),
      atencion:  true,
      dashboard: AUTH.can('viewDashboard'),
      atendidos: AUTH.can('viewDashboard'),
      config:    AUTH.can('viewConfig'),
      usuarios:  AUTH.can('manageUsers'),
      historial: AUTH.can('viewAudit'),
    };

    if (!perms[mod]) {
      UI.toast('Sin permisos para acceder a este módulo', 'err');
      return;
    }

    currentModule = mod;

    document.querySelectorAll('.nav-btn').forEach(b => {
      b.classList.toggle('active', b.id === 'nav-' + mod);
    });

    const main = document.getElementById('mainContent');
    if (!main) return;

    switch (mod) {
      case 'registro':
        main.innerHTML = MODS.renderRegistro(session);
        break;
      case 'atencion':
        main.innerHTML = MODS.renderAtencion(session);
        break;
      case 'dashboard':
        main.innerHTML = MODS.renderDashboard(session);
        setTimeout(MODS.initDashboard, 50);
        break;
      case 'atendidos':
        main.innerHTML = MODS.renderAtendidos(session);
        setTimeout(() => MODS.renderAtendidosTable(), 50);
        break;
      case 'config':
        main.innerHTML = MODS.renderConfig(session);
        break;
      case 'usuarios':
        main.innerHTML = USRMGR.renderUsuarios(session);
        break;
      case 'historial':
        main.innerHTML = MODS.renderHistorial(session);
        break;
    }

    UI.updateHeaderCounts();
    updateNotifBadge();
  }

  async function refreshPlatform() {
    const btn = document.getElementById('refreshBtn');
    if (btn) {
      btn.classList.add('spinning');
      setTimeout(() => btn.classList.remove('spinning'), 700);
    }
    DATA.state.fallas = await DS.getAllReportesActivos();
    DATA.state.notificaciones = await DS.getNotificaciones();
    await showModule(currentModule);
    UI.renderEmpresaStrip(AUTH.checkSession());
    updateNotifBadge();
    UI.toast('Plataforma actualizada');
  }

  async function changeEmpresa(emp) {
    DATA.state.currentEmpresa = emp;
    DATA.state.viewMode = 'individual';
    await DATA.persistAll();
    const mi = document.getElementById('modeIndividual');
    const mg = document.getElementById('modeGeneral');
    if (mi) mi.classList.add('active');
    if (mg) mg.classList.remove('active');
    UI.renderEmpresaStrip(AUTH.checkSession());
    await showModule(currentModule);
  }

  async function setViewMode(mode) {
    DATA.state.viewMode = mode;
    await DATA.persistAll();
    const mi = document.getElementById('modeIndividual');
    const mg = document.getElementById('modeGeneral');
    if (mi) mi.classList.toggle('active', mode === 'individual');
    if (mg) mg.classList.toggle('active', mode === 'general');
    // Sincronizar modo de la gráfica de técnicos con el viewMode
    if (typeof MODS !== 'undefined' && MODS.setTechMode) {
      MODS.setTechMode(mode === 'general' ? 'general' : 'base');
    }
    UI.renderEmpresaStrip(AUTH.checkSession());
    await showModule(currentModule);
  }

  function closeModal(e) { UI.closeModal(e); }

  async function logout() {
    if (!confirm('¿Cerrar sesión?')) return;
    clearInterval(notifPollInterval);
    await AUTH.logout();
    window.location.href = 'index.html';
  }

  return {
    init, showModule, refreshPlatform, changeEmpresa, setViewMode, closeModal, logout,
    // Notifications
    toggleNotif, marcarTodasLeidas, onNotifClick, irAReporte, validarDesdeNotif, showValidacionModule,
    updateNotifBadge
  };
})();

document.addEventListener('DOMContentLoaded', APP.init);
