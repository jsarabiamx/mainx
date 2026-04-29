/* ═══════════════════════════════════════════════
   CCTV Fleet Control — Técnico Module v7.1
   AUTÓNOMO: no depende de app-data.js
   + Botón "Atender" → En proceso + notifica admin
   + Notificaciones desde admin
   + Técnico filtrado por usuarios reales
   + Filtros multi-selección
═══════════════════════════════════════════════ */

const TECH = (() => {

  let state = {
    session:        null,
    empresa:        null,
    empresas:       [],
    empresasSel:    [],
    fallas:         [],
    selectedId:     null,
    searchPend:     '',
    searchDone:     '',
    filterBases:    [],
    filterProvs:    [],
    filterEstados:  [],
    filterSearch:   '',
    lastNotifCheck: Date.now(),
  };

  let notifPollInterval = null;
  const sharedData = {
    users: { list: [] },
    selectores: {},
    notificaciones: [],
  };

  /* ══════════════════════════════════════════════
     DATA HELPERS — usan dataService.js (DS)
     Al migrar a Supabase solo cambia DS internamente,
     este módulo no requiere modificaciones.
  ══════════════════════════════════════════════ */

  async function getFallas() {
    const f = await DS.getAllReportesActivos();
    return f.map(x => ({ ...x, empresa: x.empresa || 'GHO' }));
  }

  async function refreshSharedData() {
    const [users, selectores, notificaciones] = await Promise.all([
      DS.getUsers(),
      DS.getSelectores(),
      DS.getNotificaciones(),
    ]);
    sharedData.users = users || { list: [] };
    sharedData.selectores = selectores || {};
    sharedData.notificaciones = notificaciones || [];
  }

  /* Técnicos reales por empresa + base (desde DS) */
  function getTecnicosPorBase(empresa, base) {
    const usersData = sharedData.users;
    if (!usersData || !usersData.list) return [];
    return usersData.list.filter(u => {
      if (!u.activo) return false;
      if (u.role !== 'tecnico' && u.role !== 'admin') return false;
      const ue = u.empresas || [];
      if (!ue.includes(empresa)) return false;
      if (base && u.base && u.base !== base) return false;
      return true;
    }).map(u => ({ nombre: u.nombre, username: u.username, base: u.base || '' }));
  }

  function getSelectores(empresa) {
    const saved = sharedData.selectores;
    if (!saved || !saved[empresa]) return { base: [], proveedor: [], estatus: [] };
    return saved[empresa];
  }

  /* Todos los estatus configurados en las empresas activas del técnico */
  function getAllEstatus() {
    const emps = state.empresasSel.length ? state.empresasSel : state.empresas;
    // Union of all estatus from all active empresas
    const set = new Set();
    emps.forEach(e => {
      const sel = getSelectores(e);
      (sel.estatus || []).forEach(s => set.add(s));
    });
    // Also add any estatus actually present in fallas (in case of legacy data)
    state.fallas.forEach(f => { if (f.estatus) set.add(f.estatus); });
    return [...set];
  }

  /* Técnicos reales por empresa + base (desde DS) */
  function getTecnicosPorBase(empresa, base) {
    const usersData = sharedData.users;
    if (!usersData || !usersData.list) return [];
    return usersData.list.filter(u => {
      if (!u.activo) return false;
      if (u.role !== 'tecnico' && u.role !== 'admin') return false;
      const ue = u.empresas || [];
      if (!ue.includes(empresa)) return false;
      if (base && u.base && u.base !== base) return false;
      return true;
    }).map(u => ({ nombre: u.nombre, username: u.username, base: u.base || '' }));
  }

  /* ── Notificaciones ── */
  function getNotificaciones() {
    return sharedData.notificaciones || [];
  }

  async function crearNotificacion(tipo, data) {
    const created = await DS.createNotificacion({ tipo, ...data });
    sharedData.notificaciones = [created, ...(sharedData.notificaciones || [])].slice(0, 200);
    return created;
  }

  async function marcarLeida(id) {
    await DS.marcarNotificacionLeida(id);
    sharedData.notificaciones = (sharedData.notificaciones || []).map(n => n.id === id ? { ...n, leida: true } : n);
  }

  async function marcarTodasLeidas() {
    const session = state.session;
    await DS.markAllNotifRead(n =>
      n.tipo === 'ADMIN_VALIDADO' ||
      n.destino === session.username ||
      n.destino === 'tecnico'
    );
    sharedData.notificaciones = (sharedData.notificaciones || []).map(n =>
      (n.tipo === 'ADMIN_VALIDADO' || n.destino === session.username || n.destino === 'tecnico')
        ? { ...n, leida: true }
        : n
    );
  }

  function getMisNotificaciones() {
    const session = state.session;
    if (!session) return [];
    return getNotificaciones().filter(n =>
      n.tipo === 'ADMIN_VALIDADO' ||
      n.destino === session.username ||
      n.destino === 'tecnico'
    );
  }

  function getMisNoLeidas() {
    return getMisNotificaciones().filter(n => !n.leida);
  }

  /* ── Técnico presiona Atender ── */
  async function tecnicoAtender(reporteId, tecnicoNombre, tecnicoUsername) {
    const fallas = await getFallas();
    const idx = fallas.findIndex(f => f.id === reporteId);
    if (idx < 0) return null;

    const histEntry = {
      fecha:   new Date().toISOString(),
      accion:  'Técnico atendiendo',
      usuario: tecnicoNombre,
      detalle: `${tecnicoNombre} inició atención`
    };

    const changes = {
      estatus:             'En proceso',
      tecnico:             tecnicoNombre,
      tecnicoUsername:     tecnicoUsername || '',
      fechaInicioAtencion: new Date().toISOString(),
      historial: [histEntry, ...(fallas[idx].historial || [])],
    };

    // Persistir via DS (registro individual, no lista completa)
    await DS.updateReporte(reporteId, changes, { usuario: tecnicoNombre });
    // Reflejo local
    Object.assign(fallas[idx], changes);
    state.fallas = fallas;

    // Notificar admin
    await crearNotificacion('TECH_ATENDIENDO', {
      reporteId: fallas[idx].id,
      folio:     fallas[idx].folio,
      unidad:    fallas[idx].unidad,
      empresa:   fallas[idx].empresa,
      tecnico:   tecnicoNombre,
      destino:   'admin',
      titulo:    `${tecnicoNombre} — Unidad ${fallas[idx].unidad} atendiendo`,
      mensaje:   `${tecnicoNombre} está atendiendo la unidad ${fallas[idx].unidad} (${fallas[idx].folio}). Valida cuando esté listo.`,
    });

    // Log
    await AUTH.log('TECH_ATENDER', `Técnico ${tecnicoNombre} atiende ${fallas[idx].folio}`, tecnicoNombre);
    return fallas[idx];
  }

  /* ── Utilidades ── */
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

  function getAllBases() {
    const emps = state.empresasSel.length ? state.empresasSel : state.empresas;
    const fromConfig = emps.flatMap(e => getSelectores(e).base || []);
    // Also include bases actually used in fallas (in case config changed)
    const fromFallas = state.fallas.filter(f => emps.includes(f.empresa)).map(f => f.base).filter(Boolean);
    return [...new Set([...fromConfig, ...fromFallas])];
  }

  function getAllProveedores() {
    const emps = state.empresasSel.length ? state.empresasSel : state.empresas;
    const fromConfig = emps.flatMap(e => getSelectores(e).proveedor || []);
    const fromFallas = state.fallas.filter(f => emps.includes(f.empresa)).map(f => f.proveedor).filter(Boolean);
    return [...new Set([...fromConfig, ...fromFallas])];
  }

  function isPendiente(f) { return f.estatus !== 'Atendido'; }

  function applyFilters(list) {
    const emps = state.empresasSel.length ? state.empresasSel : state.empresas;
    let out = list.filter(f => emps.includes(f.empresa));
    if (state.filterBases.length)   out = out.filter(f => state.filterBases.includes(f.base));
    if (state.filterProvs.length)   out = out.filter(f => state.filterProvs.includes(f.proveedor));
    if (state.filterEstados.length) out = out.filter(f => state.filterEstados.includes(f.estatus));
    if (state.filterSearch) out = out.filter(f =>
      (f.unidad + f.folio + (f.descripcion||'')).toLowerCase().includes(state.filterSearch)
    );
    return out;
  }

  function getPendientes() { return applyFilters(state.fallas.filter(isPendiente)); }
  function getAtendidos()  { return applyFilters(state.fallas.filter(f => !isPendiente(f))); }
  function getAll()        { return applyFilters(state.fallas); }

  function filterList(list, q) {
    if (!q) return list;
    const lq = q.toLowerCase();
    return list.filter(f =>
      (f.unidad||'').toLowerCase().includes(lq) ||
      (f.folio||'').toLowerCase().includes(lq) ||
      (f.descripcion||'').toLowerCase().includes(lq) ||
      (f.categoria||'').toLowerCase().includes(lq) ||
      (f.tecnico||'').toLowerCase().includes(lq) ||
      (f.estatus||'').toLowerCase().includes(lq)
    );
  }

  /* ── Format ── */
  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' }) +
           ' ' + d.toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' });
  }

  function fmtDateShort(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-MX', { day:'2-digit', month:'short' });
  }

  function statusBadgeClass(estatus) {
    if (!estatus) return 'badge-pendiente';
    const e = estatus.toLowerCase();
    if (e.includes('atendido'))  return 'badge-atendido';
    if (e.includes('proceso'))   return 'badge-proceso';
    if (e.includes('refacci'))   return 'badge-refaccion';
    if (e.includes('localizado'))return 'badge-no-loc';
    return 'badge-pendiente';
  }

  function priorityClass(p) {
    const v = (p || 'media').toLowerCase();
    if (v === 'alta') return 'prio-alta';
    if (v === 'baja') return 'prio-baja';
    return 'prio-media';
  }

  function getEmpresaColor(emp) {
    const MAP = { 'GHO':'#4f8ef7','ETN':'#f59e0b','AERS':'#22c55e','AMEALSENSE':'#a855f7' };
    return MAP[emp] || '#4f8ef7';
  }

  /* ══════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════ */

  async function init() {
    await refreshSharedData();
    const session = await AUTH.checkSessionAsync();
    if (!session) { window.location.href = 'index.html'; return; }
    if (session.role !== AUTH.ROLES.TECH) { window.location.href = 'app.html'; return; }

    state.session  = session;
    state.empresas = (session.empresas && session.empresas.length > 0) ? session.empresas : ['GHO'];
    state.empresa  = state.empresas[0];
    state.fallas   = await getFallas();

    renderHeader();
    renderEmpresaStrip();
    renderFilterBar();
    renderAll();
    setupEvents();
    startNotifPoll();

    // Hide loading overlay
    setTimeout(() => {
      const overlay = document.getElementById('loadingOverlay');
      if (overlay) {
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.4s';
        setTimeout(() => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 400);
      }
    }, 300);
  }

  /* ══════════════════════════════════════════════
     HEADER
  ══════════════════════════════════════════════ */

  function renderHeader() {
    const s = state.session;
    const initials = (s.nombre || s.username).split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
    const av = document.getElementById('userAvatar');
    const un = document.getElementById('userName');
    const ue = document.getElementById('userEmpresa');
    if (av) av.textContent = initials;
    if (un) un.textContent = s.nombre || s.username;
    if (ue) ue.textContent = state.empresas.join(' · ');

    // Inject notification bell
    injectNotifBell();
  }

  function injectNotifBell() {
    const headerRight = document.querySelector('.header-right');
    if (!headerRight || document.getElementById('techNotifWrap')) return;

    const wrap = document.createElement('div');
    wrap.id = 'techNotifWrap';
    wrap.style.cssText = 'position:relative;display:flex;align-items:center';
    wrap.innerHTML = `
      <button id="techNotifBtn" style="
        position:relative;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);
        border-radius:8px;color:rgba(255,255,255,0.6);padding:7px 10px;cursor:pointer;
        display:flex;align-items:center;transition:all 0.15s">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 01-3.46 0"/>
        </svg>
        <span id="techNotifBadge" style="display:none;position:absolute;top:-5px;right:-5px;
          background:#ef4444;color:white;border-radius:50%;width:17px;height:17px;
          font-size:9px;font-weight:700;align-items:center;justify-content:center;
          border:2px solid #060810;line-height:1">0</span>
      </button>
      <div id="techNotifDropdown" style="display:none;position:absolute;top:calc(100%+8px);right:0;
        z-index:9999;background:#0a0d16;border:1px solid #242d45;border-radius:12px;
        box-shadow:0 20px 50px rgba(0,0,0,0.8);width:340px;overflow:hidden">
        <div style="padding:12px 16px;border-bottom:1px solid #1a2035;display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:12px;font-weight:700;color:#e2e8f0">Notificaciones</span>
          <button id="techNotifMarkAll" style="font-size:10px;color:#4f8ef7;background:none;border:none;cursor:pointer;padding:2px 6px">Marcar leídas</button>
        </div>
        <div id="techNotifList" style="max-height:300px;overflow-y:auto"></div>
      </div>`;

    const logoutBtn = document.getElementById('btnLogout');
    if (logoutBtn) {
      headerRight.insertBefore(wrap, logoutBtn);
    } else {
      headerRight.appendChild(wrap);
    }

    // Events
    document.getElementById('techNotifBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      const drop = document.getElementById('techNotifDropdown');
      const isOpen = drop.style.display !== 'none';
      drop.style.display = isOpen ? 'none' : 'block';
      if (!isOpen) renderNotifList();
    });

    document.getElementById('techNotifMarkAll').addEventListener('click', async (e) => {
      e.stopPropagation();
      await marcarTodasLeidas();
      updateNotifBadge();
      renderNotifList();
    });

    updateNotifBadge();
  }

  /* ── Notif badge & list ── */
  function updateNotifBadge() {
    const badge = document.getElementById('techNotifBadge');
    if (!badge) return;
    const count = getMisNoLeidas().length;
    if (count > 0) {
      badge.style.display = 'flex';
      badge.textContent = count > 9 ? '9+' : count;
    } else {
      badge.style.display = 'none';
    }
  }

  function renderNotifList() {
    const cont = document.getElementById('techNotifList');
    if (!cont) return;
    const mine = getMisNotificaciones().slice(0, 20);

    if (!mine.length) {
      cont.innerHTML = `<div style="padding:20px;text-align:center;color:#3d4f6b;font-size:12px">Sin notificaciones</div>`;
      return;
    }

    cont.innerHTML = mine.map(n => {
      const isValidado = n.tipo === 'ADMIN_VALIDADO';
      return `
        <div style="padding:11px 14px;border-bottom:1px solid #1a2035;
          background:${n.leida ? 'transparent' : 'rgba(34,197,94,0.04)'}">
          <div style="display:flex;gap:9px;align-items:flex-start">
            <div style="font-size:16px;flex-shrink:0;margin-top:1px">${isValidado ? '&#10003;' : '&#9881;'}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:600;color:#e2e8f0;margin-bottom:2px;display:flex;gap:6px;align-items:center">
                ${n.titulo || n.tipo}
                ${!n.leida ? '<span style="width:6px;height:6px;border-radius:50%;background:#22c55e;flex-shrink:0"></span>' : ''}
              </div>
              <div style="font-size:11px;color:#7c8ba1;line-height:1.4;white-space:normal;overflow-wrap:anywhere">${n.mensaje || ''}</div>
              <div style="font-size:10px;color:#3d4f6b;margin-top:3px">${fmtDate(n.fecha)}</div>
              ${n.reporteId ? `<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
                <button onclick="event.stopPropagation();TECH.openNotifReport('${n.id}','${n.reporteId}')" style="padding:6px 10px;border-radius:6px;background:rgba(255,255,255,0.04);border:1px solid #242d45;color:#e2e8f0;font-size:11px;cursor:pointer">Ver detalle</button>
              </div>` : ''}
            </div>
          </div>
        </div>`;
    }).join('');
  }

  function startNotifPoll() {
    // Snapshot de config para detectar cambios del admin en estatus/bases/etc.
    let _lastConfigSig = JSON.stringify(sharedData.selectores || {}) || '';
    let _lastFallasSig = state.fallas.map(f => f.id + f.estatus).join('');

    notifPollInterval = setInterval(async () => {
      state.fallas = await getFallas();
      await refreshSharedData();
      const newFallasSig = state.fallas.map(f => f.id + f.estatus).join('');

      // Detectar cambios de config del admin (nuevos estatus, bases, proveedores)
      const currentConfigSig = JSON.stringify(sharedData.selectores || {}) || '';
      const configChanged = currentConfigSig !== _lastConfigSig;
      if (configChanged) {
        _lastConfigSig = currentConfigSig;
        _lastFilterOptions = { bases: [], provs: [], estados: [] }; // forzar rebuild del filtro
      }

      // Check for new ADMIN_VALIDADO notifications for this tecnico
      const newValidados = getMisNoLeidas().filter(n =>
        n.tipo === 'ADMIN_VALIDADO' &&
        new Date(n.fecha) > new Date(state.lastNotifCheck)
      );
      if (newValidados.length > 0) {
        newValidados.forEach(n => showToast(n.titulo || 'Unidad liberada / atendida', 'success'));
        state.lastNotifCheck = Date.now();
      }

      updateNotifBadge();

      // Re-render if fallas changed OR config changed
      if (newFallasSig !== _lastFallasSig || configChanged) {
        _lastFallasSig = newFallasSig;
        renderAll();
      }
    }, 8000);
  }

  /* ══════════════════════════════════════════════
     EMPRESA STRIP
  ══════════════════════════════════════════════ */

  function renderEmpresaStrip() {
    const strip = document.getElementById('empresaStrip');
    if (!strip) return;

    if (state.empresas.length <= 1) {
      state.empresasSel = [...state.empresas];
      const container = strip.closest('.empresa-strip');
      if (container) container.style.display = 'none';
      return;
    }

    strip.innerHTML = state.empresas.map(emp => {
      const clr   = getEmpresaColor(emp);
      const isSel = state.empresasSel.includes(emp) || state.empresasSel.length === 0;
      return `<button class="empresa-chip${isSel?' active':''}" data-emp="${emp}" style="
        display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:20px;cursor:pointer;
        font-size:11px;font-weight:700;font-family:monospace;
        background:${isSel?'rgba(0,0,0,0.3)':'transparent'};
        color:${isSel?clr:'rgba(255,255,255,0.5)'};
        border:1px solid ${isSel?clr:'rgba(255,255,255,0.15)'};transition:all 0.15s">
        <span style="width:6px;height:6px;border-radius:50%;background:${clr};flex-shrink:0"></span>
        ${emp}
      </button>`;
    }).join('') +
    (state.empresasSel.length > 0 ? `<button id="techClearEmp" style="font-size:10px;color:rgba(255,255,255,0.4);background:none;border:none;cursor:pointer;padding:4px 8px">✕ Limpiar</button>` : '');

    strip.querySelectorAll('.empresa-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const emp = btn.dataset.emp;
        const idx = state.empresasSel.indexOf(emp);
        if (idx >= 0) state.empresasSel.splice(idx, 1);
        else state.empresasSel.push(emp);
        state.selectedId = null;
        renderEmpresaStrip();
        renderFilterBar();
        renderAll();
      });
    });

    const clrBtn = document.getElementById('techClearEmp');
    if (clrBtn) clrBtn.addEventListener('click', () => {
      state.empresasSel = [];
      state.selectedId  = null;
      renderEmpresaStrip();
      renderFilterBar();
      renderAll();
    });
  }

  /* ══════════════════════════════════════════════
     FILTER BAR
  ══════════════════════════════════════════════ */

  function renderFilterBar() {
    let bar = document.getElementById('techFilterBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'techFilterBar';
      bar.style.cssText = 'background:#0a0d16;border-bottom:1px solid #1a2035;padding:10px 16px';
      // Insert AFTER the empresa-strip, BEFORE the kpi-strip
      const kpiStrip = document.querySelector('.kpi-strip');
      const main     = document.querySelector('.tech-main');
      if (kpiStrip && kpiStrip.parentNode) {
        kpiStrip.parentNode.insertBefore(bar, kpiStrip);
      } else if (main) {
        main.insertBefore(bar, main.firstChild);
      } else {
        document.body.insertBefore(bar, document.body.firstChild);
      }
    }

    const bases   = getAllBases();
    const provs   = getAllProveedores();
    // Leemos los estatus desde configuración del admin (dinámico)
    const estados = getAllEstatus();
    const hasFilters = state.filterBases.length || state.filterProvs.length || state.filterEstados.length || state.filterSearch;

    bar.innerHTML = `
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <span style="font-size:10px;color:#3d4f6b;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;flex-shrink:0">Filtros</span>
        <input id="techFiltSearch" placeholder="🔍 Buscar unidad, folio..." value="${state.filterSearch||''}"
          style="background:#0f1320;border:1px solid #1a2035;color:#e2e8f0;font-size:11px;padding:5px 10px;border-radius:6px;max-width:220px;flex:1;min-width:140px;outline:none">
        ${msHtml('techFiltBase', bases,   state.filterBases,   'Bases')}
        ${msHtml('techFiltProv', provs,   state.filterProvs,   'Proveedores')}
        ${msHtml('techFiltEst',  estados, state.filterEstados, 'Estados')}
        ${hasFilters ? `<button id="techClearFilters" style="background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.25);color:#ef4444;font-size:10px;padding:4px 12px;border-radius:6px;cursor:pointer;flex-shrink:0">✕ Limpiar</button>` : ''}
        <span style="margin-left:auto;font-size:10px;color:#3d4f6b;font-family:monospace">${getAll().length} reportes</span>
      </div>`;

    document.getElementById('techFiltSearch')?.addEventListener('input', e => {
      state.filterSearch = e.target.value.toLowerCase();
      state.selectedId = null;
      renderAll();
    });

    attachMs('techFiltBase', v => { state.filterBases   = v; state.selectedId=null; renderAll(); });
    attachMs('techFiltProv', v => { state.filterProvs   = v; state.selectedId=null; renderAll(); });
    attachMs('techFiltEst',  v => { state.filterEstados = v; state.selectedId=null; renderAll(); });

    document.getElementById('techClearFilters')?.addEventListener('click', () => {
      state.filterBases=[]; state.filterProvs=[]; state.filterEstados=[]; state.filterSearch='';
      renderFilterBar(); renderAll();
    });
  }

  function msHtml(id, options, selected, placeholder) {
    if (!options.length) return '';
    const hasSel = selected.length > 0;
    return `<div style="position:relative;display:inline-block" id="${id}_wrap">
      <button id="${id}_btn" style="
        background:${hasSel?'rgba(79,142,247,0.12)':'#0f1320'};
        border:1px solid ${hasSel?'rgba(79,142,247,0.4)':'#1a2035'};
        color:${hasSel?'#4f8ef7':'#7c8ba1'};
        font-size:11px;padding:4px 10px;border-radius:6px;cursor:pointer;white-space:nowrap;
        display:flex;align-items:center;gap:5px">
        ${hasSel?`<span style="background:#4f8ef7;color:white;border-radius:3px;padding:1px 5px;font-size:10px">${selected.length}</span>`:''}
        ${placeholder}
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div id="${id}_drop" style="display:none;position:absolute;top:calc(100% + 4px);left:0;z-index:9999;
        background:#0a0d16;border:1px solid #242d45;border-radius:8px;
        box-shadow:0 12px 32px rgba(0,0,0,0.7);min-width:160px;overflow:hidden">
        <div style="padding:6px">
          <div style="padding:4px 8px 6px;border-bottom:1px solid #1a2035;display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="font-size:10px;color:#3d4f6b;font-weight:700;text-transform:uppercase">${placeholder}</span>
            <button id="${id}_clear" style="font-size:10px;color:#4f8ef7;background:none;border:none;cursor:pointer">Limpiar</button>
          </div>
          ${options.map(opt => {
            const isSel = selected.includes(opt);
            return `<div class="tms-opt" data-ms="${id}" data-val="${opt}" style="
              display:flex;align-items:center;gap:7px;padding:6px 10px;border-radius:5px;cursor:pointer;
              ${isSel?'background:rgba(79,142,247,0.1)':''}">
              <div style="width:13px;height:13px;border-radius:3px;flex-shrink:0;
                border:1.5px solid ${isSel?'#4f8ef7':'#242d45'};
                background:${isSel?'#4f8ef7':'transparent'};
                display:flex;align-items:center;justify-content:center">
                ${isSel?'<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>':''}
              </div>
              <span style="font-size:12px;color:#e2e8f0">${opt}</span>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;
  }

  function attachMs(id, onChange) {
    const wrap = document.getElementById(id + '_wrap');
    if (!wrap) return;
    const btn  = document.getElementById(id + '_btn');
    const drop = document.getElementById(id + '_drop');
    const clr  = document.getElementById(id + '_clear');
    if (!btn || !drop) return;

    let current = [];
    // Init from DOM (check which options have blue background = selected)
    wrap.querySelectorAll('.tms-opt').forEach(opt => {
      const check = opt.querySelector('div');
      if (check && check.style.background.includes('#4f8ef7')) current.push(opt.dataset.val);
    });

    btn.addEventListener('click', e => {
      e.stopPropagation();
      const isOpen = drop.style.display !== 'none';
      document.querySelectorAll('[id$="_drop"]').forEach(d => { d.style.display='none'; });
      drop.style.display = isOpen ? 'none' : 'block';
    });

    wrap.querySelectorAll('.tms-opt').forEach(opt => {
      opt.addEventListener('click', e => {
        e.stopPropagation();
        const val = opt.dataset.val;
        const idx = current.indexOf(val);
        if (idx >= 0) current.splice(idx, 1); else current.push(val);
        const isSel = current.includes(val);
        opt.style.background = isSel ? 'rgba(79,142,247,0.1)' : '';
        const check = opt.querySelector('div');
        if (check) {
          check.style.borderColor = isSel ? '#4f8ef7' : '#242d45';
          check.style.background  = isSel ? '#4f8ef7' : 'transparent';
          check.innerHTML = isSel ? '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : '';
        }
        btn.style.background  = current.length ? 'rgba(79,142,247,0.12)' : '#0f1320';
        btn.style.borderColor = current.length ? 'rgba(79,142,247,0.4)'  : '#1a2035';
        btn.style.color       = current.length ? '#4f8ef7' : '#7c8ba1';
        onChange([...current]);
      });
    });

    clr && clr.addEventListener('click', e => {
      e.stopPropagation();
      current = [];
      wrap.querySelectorAll('.tms-opt').forEach(opt => {
        opt.style.background = '';
        const check = opt.querySelector('div');
        if (check) { check.style.borderColor='#242d45'; check.style.background='transparent'; check.innerHTML=''; }
      });
      btn.style.background='#0f1320'; btn.style.borderColor='#1a2035'; btn.style.color='#7c8ba1';
      onChange([]);
    });
  }

  /* ══════════════════════════════════════════════
     RENDER PRINCIPAL
  ══════════════════════════════════════════════ */

  async function renderAll() {
    state.fallas = await getFallas();
    // Clean up filter state: remove any filter values no longer valid
    const validBases   = getAllBases();
    const validProvs   = getAllProveedores();
    const validEstatus = getAllEstatus();
    state.filterBases   = state.filterBases.filter(v => validBases.includes(v));
    state.filterProvs   = state.filterProvs.filter(v => validProvs.includes(v));
    state.filterEstados = state.filterEstados.filter(v => validEstatus.includes(v));
    // Only rebuild filter bar if options have changed (avoids flicker on every poll)
    const bar = document.getElementById('techFilterBar');
    if (!bar || _filterOptionsChanged(validBases, validProvs, validEstatus)) {
      renderFilterBar();
      _lastFilterOptions = { bases: validBases, provs: validProvs, estados: validEstatus };
    }
    renderKPIs();
    renderPendientes();
    renderAtendidos();
    if (state.selectedId) renderDetail(state.selectedId);
  }

  let _lastFilterOptions = { bases: [], provs: [], estados: [] };
  function _filterOptionsChanged(bases, provs, estados) {
    const prev = _lastFilterOptions;
    return JSON.stringify(prev.bases.sort()) !== JSON.stringify([...bases].sort()) ||
           JSON.stringify(prev.provs.sort()) !== JSON.stringify([...provs].sort()) ||
           JSON.stringify(prev.estados.sort()) !== JSON.stringify([...estados].sort());
  }

  function renderKPIs() {
    const all  = getAll();
    const done = all.filter(f => f.estatus === 'Atendido');
    const pend = all.filter(isPendiente); // everything except Atendido
    // "En proceso" counts any status that contains "proceso" (dynamic)
    const proc = all.filter(f => (f.estatus||'').toLowerCase().includes('proceso'));
    const el = (id, v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
    el('kpiPendiente', pend.length);
    el('kpiAtendido',  done.length);
    el('kpiProceso',   proc.length);
    el('kpiTotal',     all.length);
  }

  /* ── Pendientes ── */
  function renderPendientes() {
    const raw  = getPendientes();
    const list = filterList(raw, state.searchPend);
    const cont  = document.getElementById('pendientesList');
    const count = document.getElementById('pendientesCount');
    if (count) count.textContent = raw.length;
    if (!cont) return;

    if (!list.length) {
      cont.innerHTML = emptyState(state.searchPend?'🔍':'✅', state.searchPend?'Sin resultados':'Sin pendientes', state.searchPend?'Intenta otra búsqueda':'Todos los reportes están atendidos');
      return;
    }

    list.sort((a,b) => {
      const o={alta:0,media:1,baja:2};
      const pa=o[(a.prioridad||'media').toLowerCase()]??1;
      const pb=o[(b.prioridad||'media').toLowerCase()]??1;
      return pa!==pb ? pa-pb : new Date(b.fecha||0)-new Date(a.fecha||0);
    });

    cont.innerHTML = list.map(f => reportCard(f)).join('');
    bindClicks(cont);
  }

  /* ── Atendidos ── */
  function renderAtendidos() {
    const raw  = getAtendidos();
    const list = filterList(raw, state.searchDone);
    const cont  = document.getElementById('atendidosList');
    const count = document.getElementById('atendidosCount');
    if (count) count.textContent = raw.length;
    if (!cont) return;

    if (!list.length) {
      cont.innerHTML = emptyState(state.searchDone?'🔍':'📋', state.searchDone?'Sin resultados':'Sin atendidos', state.searchDone?'Intenta otra búsqueda':'No hay reportes atendidos aún');
      return;
    }

    list.sort((a,b) => new Date(b.fechaAtencion||b.fecha||0) - new Date(a.fechaAtencion||a.fecha||0));
    cont.innerHTML = list.map(f => reportCard(f)).join('');
    bindClicks(cont);
  }

  /* ── Report card ── */
  function reportCard(f) {
    const prioCls  = priorityClass(f.prioridad);
    const badgeCls = statusBadgeClass(f.estatus);
    const isActive = f.id === state.selectedId;
    const clr      = getEmpresaColor(f.empresa);
    const pend     = isPendiente(f);
    const enProc   = (f.estatus||'').toLowerCase().includes('proceso');
    const myName   = state.session ? (state.session.nombre || state.session.username) : '';

    return `
      <div class="report-item${isActive?' active':''}" data-id="${f.id}" style="cursor:pointer">
        <div class="report-item-top">
          <span class="report-folio">${f.folio||f.id}</span>
          <span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;
            color:${clr};background:rgba(0,0,0,0.2);border:1px solid ${clr}40;border-radius:4px;padding:1px 7px;flex-shrink:0">${f.empresa}</span>
          <span class="report-status-badge ${badgeCls}">${f.estatus||'Pendiente'}</span>
        </div>
        <div class="report-unidad">Unidad ${f.unidad||'—'}</div>
        <div class="report-desc">${f.descripcion||'Sin descripción'}</div>
        <div class="report-meta">
          <span class="meta-chip"><span class="priority-dot ${prioCls}"></span>${f.prioridad||'Media'}</span>
          <span class="meta-chip">📁 ${f.categoria||'—'}</span>
          <span class="meta-chip">🕐 ${fmtDateShort(f.fecha)}</span>
          ${f.base?`<span class="meta-chip">📍 ${f.base}</span>`:''}
          ${f.proveedor?`<span class="meta-chip" style="color:#06b6d4">📡 ${f.proveedor}</span>`:''}
          ${f.tecnico&&enProc?`<span class="meta-chip" style="color:#f59e0b">🔧 ${f.tecnico}</span>`:''}
          ${f.fechaAtencion?`<span class="meta-chip" style="color:#22c55e">✓ ${fmtDateShort(f.fechaAtencion)}</span>`:''}
        </div>
        ${pend && !enProc ? `
          <div style="margin-top:8px">
            <button data-atender="${f.id}" style="
              display:inline-flex;align-items:center;gap:6px;padding:6px 14px;
              background:linear-gradient(135deg,#4f8ef7,#2b63d6);border:none;border-radius:7px;
              color:white;font-size:11px;font-weight:700;cursor:pointer;
              box-shadow:0 4px 12px rgba(79,142,247,0.3)">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
              Atender
            </button>
          </div>` : ''}
        ${enProc && f.tecnico === myName ? `
          <div style="margin-top:8px">
            <span style="font-size:10px;color:#f59e0b;background:rgba(245,158,11,0.1);
              border:1px solid rgba(245,158,11,0.25);border-radius:6px;padding:3px 8px">
              🔧 En atención — esperando validación del admin
            </span>
          </div>` : ''}
      </div>`;
  }

  /* ── Click handlers ── */
  function bindClicks(container) {
    container.querySelectorAll('.report-item').forEach(el => {
      el.addEventListener('click', (e) => {
        // Check if Atender button was clicked
        const atenderBtn = e.target.closest('[data-atender]');
        if (atenderBtn) {
          e.stopPropagation();
          showAtenderModal(atenderBtn.dataset.atender);
          return;
        }
        const id = el.dataset.id;
        state.selectedId = state.selectedId === id ? null : id;
        renderPendientes();
        renderAtendidos();
        renderDetail(state.selectedId);
      });
    });
  }

  /* ══════════════════════════════════════════════
     MODAL ATENDER
  ══════════════════════════════════════════════ */

  function showAtenderModal(reporteId) {
    const fallas = state.fallas;
    const f = fallas.find(x => x.id === reporteId);
    if (!f) return;

    const session  = state.session;
    const emp      = f.empresa || state.empresa;
    const base     = f.base || '';
    const myName   = session.nombre || session.username;
    const tecnicos = getTecnicosPorBase(emp, base);

    // Build options — always include "yo" first, then other real users, then "Otro"
    let tecOptions = `<option value="">— Seleccionar técnico —</option>`;
    tecOptions += `<option value="__self__" selected>${myName} (yo)</option>`;
    tecnicos.filter(t => t.nombre !== myName).forEach(t => {
      const label = t.base ? `${t.nombre} (${t.base})` : t.nombre;
      tecOptions += `<option value="${t.nombre}">${label}</option>`;
    });
    tecOptions += `<option value="__otro__">Otro (escribir manualmente)</option>`;

    const hintColor = tecnicos.length === 0 ? '#f59e0b' : '#3d4f6b';
    const hintText  = tecnicos.length === 0
      ? `Sin técnicos registrados en ${base||'esta base'} (${emp}). Usa "Otro".`
      : `${tecnicos.length} técnico(s) en ${base||'la empresa'} (${emp})`;

    // Remove existing modal if any
    const existing = document.getElementById('atenderModal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'atenderModal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
    overlay.innerHTML = `
      <div style="background:#0a0d16;border:1px solid #1a2035;border-radius:16px;width:420px;max-width:95vw;overflow:hidden;box-shadow:0 32px 64px rgba(0,0,0,0.8)">
        <div style="background:#0f1320;padding:18px 22px;border-bottom:1px solid #1a2035">
          <div style="font-size:15px;font-weight:700;color:#e2e8f0">Atender Reporte</div>
          <div style="font-size:11px;color:#7c8ba1;margin-top:2px">Unidad ${f.unidad} · ${f.folio}</div>
        </div>
        <div style="padding:18px 22px;display:flex;flex-direction:column;gap:14px">
          <div style="background:rgba(79,142,247,0.07);border:1px solid rgba(79,142,247,0.2);border-radius:8px;padding:10px 13px;font-size:12px;color:#7c8ba1;line-height:1.5">
            Al confirmar, la unidad pasará a <strong style="color:#4f8ef7">"En proceso"</strong> y se notificará al administrador para validación.
          </div>
          <div>
            <div style="font-size:11px;color:#7c8ba1;margin-bottom:3px">
              Base de atención: <strong style="color:#4f8ef7">${base||'No especificada'}</strong>
            </div>
            <div style="font-size:10px;color:${hintColor};margin-bottom:10px">${hintText}</div>
            <label style="display:block;font-size:11px;font-weight:700;color:#7c8ba1;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Técnico que atiende</label>
            <select id="atenderTecSel" style="width:100%;background:#0f1320;border:1px solid #1a2035;border-radius:8px;color:#e2e8f0;font-size:13px;padding:9px 12px;outline:none;box-sizing:border-box">
              ${tecOptions}
            </select>
            <input id="atenderTecOtro" type="text" placeholder="Nombre del técnico" style="display:none;width:100%;background:#0f1320;border:1px solid #1a2035;border-radius:8px;color:#e2e8f0;font-size:13px;padding:9px 12px;outline:none;box-sizing:border-box;margin-top:6px">
          </div>
        </div>
        <div style="padding:14px 22px;border-top:1px solid #1a2035;display:flex;justify-content:flex-end;gap:10px">
          <button id="atenderCancelBtn" style="padding:8px 16px;border-radius:8px;background:transparent;border:1px solid #1a2035;color:#7c8ba1;cursor:pointer;font-size:13px">Cancelar</button>
          <button id="atenderConfirmBtn" style="padding:8px 18px;border-radius:8px;background:linear-gradient(135deg,#4f8ef7,#2b63d6);border:none;color:white;cursor:pointer;font-size:13px;font-weight:700;box-shadow:0 4px 12px rgba(79,142,247,0.3)">Confirmar Atención</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const sel    = overlay.querySelector('#atenderTecSel');
    const otroInp= overlay.querySelector('#atenderTecOtro');

    sel.addEventListener('change', () => {
      otroInp.style.display = sel.value === '__otro__' ? '' : 'none';
      if (sel.value === '__otro__') otroInp.focus();
    });

    overlay.querySelector('#atenderCancelBtn').onclick = () => overlay.remove();

    overlay.querySelector('#atenderConfirmBtn').onclick = async () => {
      let nombre = '';
      if (sel.value === '__self__' || sel.value === '') {
        nombre = myName;
      } else if (sel.value === '__otro__') {
        nombre = otroInp.value.trim();
        if (!nombre) { otroInp.style.borderColor='#ef4444'; otroInp.focus(); return; }
      } else {
        nombre = sel.value;
      }

      overlay.remove();
      const result = await tecnicoAtender(reporteId, nombre, session.username);
      if (result) {
        showToast(`Atendiendo unidad ${result.unidad} — Admin notificado ✓`, 'success');
        renderAll();
        renderDetail(reporteId);
      }
    };

    // Close on backdrop click
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  }

  /* ══════════════════════════════════════════════
     DETALLE
  ══════════════════════════════════════════════ */

  function renderDetail(id) {
    const placeholder = document.getElementById('detailPlaceholder');
    const content     = document.getElementById('detailContent');
    if (!placeholder || !content) return;

    if (!id) {
      placeholder.classList.remove('hidden');
      content.classList.remove('visible');
      return;
    }

    const f = state.fallas.find(x => x.id === id);
    if (!f) {
      placeholder.classList.remove('hidden');
      content.classList.remove('visible');
      return;
    }

    placeholder.classList.add('hidden');
    content.classList.add('visible');

    const set = (elId, val) => { const e=document.getElementById(elId); if(e) e.textContent=val; };

    set('detailFolio',  f.folio||f.id);
    set('detailDate',   fmtDate(f.fecha));
    set('detailUnidad', `Unidad ${f.unidad||'—'}`);
    set('detailEmpresa',f.empresa||state.empresa);

    const badge = document.getElementById('detailStatusBadge');
    if (badge) {
      badge.className   = `report-status-badge ${statusBadgeClass(f.estatus)}`;
      badge.textContent = f.estatus||'Pendiente';
    }

    set('dEmpresa',    f.empresa||'—');
    set('dBase',       f.base||'—');
    set('dServicio',   f.servicio||'—');
    set('dPiso',       f.piso||'—');
    set('dPrioridad',  f.prioridad||'—');
    set('dCategoria',  f.categoria||'—');
    set('dComponente', f.componente||'—');
    set('dOperador',   (f.proveedor?'📡 '+f.proveedor:'')||f.operador||'—');
    set('dTecnico',    f.tecnico||'—');
    set('dFechaAten',  f.fechaAtencion ? fmtDate(f.fechaAtencion) : '—');

    const dDesc = document.getElementById('dDescripcion');
    const dObs  = document.getElementById('dObservaciones');
    if (dDesc) dDesc.textContent = f.descripcion||'Sin descripción';
    if (dObs)  dObs.textContent  = f.resultado||f.observaciones||'Sin observaciones';

    renderHistory(f);
  }

  function renderHistory(f) {
    const cont = document.getElementById('detailHistory');
    if (!cont) return;
    const hist = f.historial||[];
    if (!hist.length) {
      cont.innerHTML = `<p style="font-size:12px;color:#3d4f6b;padding:10px 0">Sin movimientos registrados</p>`;
      return;
    }
    cont.innerHTML = [...hist].map(h => `
      <div class="history-entry">
        <div class="history-dot-wrap"><div class="h-dot"></div></div>
        <div class="history-info">
          <div class="h-action">${h.accion||'Actualización'}</div>
          <div class="h-meta">${h.usuario||'—'} · ${fmtDate(h.fecha)}</div>
          ${h.detalle&&h.accion?`<div class="h-det" style="font-size:10px;color:#3d4f6b">${h.detalle}</div>`:''}
        </div>
      </div>`).join('');
  }

  /* ══════════════════════════════════════════════
     EVENTS
  ══════════════════════════════════════════════ */

  function setupEvents() {
    const logoutBtn = document.getElementById('btnLogout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        if (!confirm('¿Cerrar sesión?')) return;
        clearInterval(notifPollInterval);
        await AUTH.logout();
        window.location.href = 'index.html';
      });
    }

    const spEl = document.getElementById('searchPendientes');
    if (spEl) spEl.addEventListener('input', e => { state.searchPend = e.target.value.trim(); renderPendientes(); });

    const saEl = document.getElementById('searchAtendidos');
    if (saEl) saEl.addEventListener('input', e => { state.searchDone = e.target.value.trim(); renderAtendidos(); });

    // Close dropdowns on outside click
    document.addEventListener('click', e => {
      if (!e.target.closest('[id$="_wrap"]')) {
        document.querySelectorAll('[id$="_drop"]').forEach(d => { d.style.display='none'; });
      }
      if (!e.target.closest('#techNotifWrap')) {
        const d = document.getElementById('techNotifDropdown');
        if (d) d.style.display='none';
      }
    });
  }

  /* ══════════════════════════════════════════════
     TOAST & HELPERS
  ══════════════════════════════════════════════ */

  function showToast(msg, type='info') {
    const cont = document.getElementById('toastContainer');
    if (!cont) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    const icons = { success:'✅', error:'❌', info:'ℹ️', warn:'⚠️' };
    el.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
    el.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 14px;background:#0f1320;border:1px solid #242d45;border-radius:8px;font-size:12px;color:#e2e8f0;animation:toastIn 0.25s ease;box-shadow:0 8px 24px rgba(0,0,0,0.5)';
    cont.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.25s';
      setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 250);
    }, 3500);
  }

  function emptyState(icon, title, sub) {
    return `<div class="empty-state">
      <span class="empty-icon">${icon}</span>
      <div class="empty-title">${title}</div>
      <div class="empty-sub">${sub}</div>
    </div>`;
  }

  /* ══════════════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════════════ */

  function openNotifReport(notifId, reporteId) {
    if (notifId) {
      void marcarLeida(notifId).then(() => {
        updateNotifBadge();
        renderNotifList();
      });
    }
    if (!reporteId) return;
    state.selectedId = reporteId;
    renderPendientes();
    renderAtendidos();
    renderDetail(reporteId);
    const d = document.getElementById('techNotifDropdown');
    if (d) d.style.display = 'none';
  }

  return { init, showAtenderModal, openNotifReport };

})();

document.addEventListener('DOMContentLoaded', TECH.init);
