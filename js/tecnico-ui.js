/* tecnico-ui.js — Nueva UI Mobile para CCTV Fleet Control Técnico
   Puente entre tecnico.js (lógica/datos) y la nueva interfaz */

(function () {
  'use strict';

  /* ─── Estado de la nueva UI ─── */
  let _activeTab    = 'pendiente'; // pendiente | proceso | atendido | total
  let _activeScreen = 'inicio';
  let _selectedId   = null;
  let _visionPeriod = 'dia';
  let _activeFilter = 'miBase'; // miBase | general

  /* ─── Exponer globales requeridas por el HTML ─── */
  window.setTab         = setTab;
  window.goScreen       = goScreen;
  window.setVisionPeriod= setVisionPeriod;
  window.toggleFilter   = toggleFilter;
  window.closeSheet     = closeSheet;
  window.doAtender      = doAtender;

  /* ─── Esperar a que tecnico.js termine su init (más robusto) ─── */
  let _hookDone = false;

  function _tryHook() {
    if (_hookDone) return;
    if (typeof TECH === 'undefined') return;

    // Registrar los hooks aunque _uiReady todavía no esté
    TECH._renderCards   = renderNewCards;
    TECH._renderKPIs    = renderNewKPIs;
    TECH._renderPerfil  = renderNewPerfil;
    TECH._renderEmpresa = renderNewEmpresaStrip;
    _hookDone = true;

    // Si ya hay datos disponibles, renderizar inmediatamente
    if (TECH._uiReady && TECH.state && TECH.state.fallas) {
      renderNewCards();
      renderNewKPIs();
      renderNewPerfil();
      renderNewEmpresaStrip();
    }
  }

  // Intentar hookear inmediatamente y luego con polling
  _tryHook();
  const _readyInterval = setInterval(() => {
    _tryHook();
    // Una vez que hay datos, renderizar y parar el polling de arranque
    if (_hookDone && typeof TECH !== 'undefined' && TECH._uiReady) {
      clearInterval(_readyInterval);
      renderNewCards();
      renderNewKPIs();
      renderNewPerfil();
      renderNewEmpresaStrip();
    }
  }, 150);

  // También escuchar el evento DOMContentLoaded por si acaso
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _tryHook);
  } else {
    setTimeout(_tryHook, 50);
  }

  /* ─── EMPRESA STRIP ─── */
  function renderNewEmpresaStrip() {
    if (typeof TECH === 'undefined') return;
    const strip = document.getElementById('empresaStrip');
    if (!strip) return;

    const s = TECH.state;
    if (!s || !s.empresas) return;

    strip.innerHTML = '<span class="t-emp-label">Empresa:</span>' +
      s.empresas.map(emp => {
        const colors = { GHO: ['#4f8ef7','rgba(79,142,247,.2)'], ETN: ['#f59e0b','rgba(245,158,11,.2)'], AERS: ['#22c55e','rgba(34,197,94,.2)'], AMEALSENSE: ['#a855f7','rgba(168,85,247,.2)'] };
        const [fg, bg] = colors[emp] || ['#e8edf8','rgba(255,255,255,.1)'];
        const isActive = s.empresasSel.length === 0 || s.empresasSel.includes(emp);
        return `<div class="t-emp-chip ${isActive?'active':''}" style="color:${fg};border-color:${bg};background:${isActive?bg:'transparent'}"
          onclick="TECH._toggleEmpresa('${emp}')">${emp}</div>`;
      }).join('');
  }

  /* ─── KPIs ─── */
  function renderNewKPIs() {
    if (typeof TECH === 'undefined') return;
    const fallas = TECH._getFallas ? TECH._getFallas() : [];

    const isAtendido = (est, emp) => /atendid/i.test(est || '');
    const isProceso  = (est) => /proceso|process|en.proc/i.test(est || '');

    const pendientes = fallas.filter(f => !isAtendido(f.estatus) && !isProceso(f.estatus)).length;
    const proceso    = fallas.filter(f => isProceso(f.estatus)).length;
    const atendidos  = fallas.filter(f => isAtendido(f.estatus)).length;
    const total      = fallas.length;

    _setText('kpiPendiente', pendientes);
    _setText('kpiProceso',   proceso);
    _setText('kpiAtendido',  atendidos);
    _setText('kpiTotal',     total);
  }

  /* ─── CARDS ─── */
  function renderNewCards() {
    if (typeof TECH === 'undefined') return;
    const list = document.getElementById('reportList');
    if (!list) return;

    let fallas = TECH._getFallas ? TECH._getFallas() : [];

    // Filtro de tab
    const isAtendido = (est) => /atendid/i.test(est || '');
    const isProceso  = (est) => /proceso|en.proc/i.test(est || '');

    if (_activeTab === 'pendiente') fallas = fallas.filter(f => !isAtendido(f.estatus) && !isProceso(f.estatus));
    else if (_activeTab === 'proceso')  fallas = fallas.filter(f => isProceso(f.estatus));
    else if (_activeTab === 'atendido') fallas = fallas.filter(f => isAtendido(f.estatus));
    // total: sin filtro

    // Filtro de búsqueda
    const q = (document.getElementById('searchInput')?.value || '').toLowerCase();
    if (q) fallas = fallas.filter(f =>
      (f.unidad||'').toLowerCase().includes(q) ||
      (f.folio||'').toLowerCase().includes(q) ||
      (f.categoria||'').toLowerCase().includes(q) ||
      (f.descripcion||'').toLowerCase().includes(q)
    );

    // Filtro miBase/general
    const session = typeof AUTH !== 'undefined' ? AUTH.checkSession() : null;
    if (_activeFilter === 'miBase' && session?.base) {
      fallas = fallas.filter(f => (f.base||'').toUpperCase() === (session.base||'').toUpperCase());
    }

    if (fallas.length === 0) {
      list.innerHTML = `<div class="t-empty">
        <div class="t-empty-icon">${_activeTab === 'atendido' ? '✅' : _activeTab === 'proceso' ? '🔧' : '📋'}</div>
        <div class="t-empty-title">Sin reportes</div>
        <div class="t-empty-sub">${_activeTab === 'pendiente' ? 'Todos los reportes están atendidos' : 'No hay reportes en este estado'}</div>
      </div>`;
      return;
    }

    list.innerHTML = fallas.map(f => _buildCard(f)).join('');
    renderNewKPIs();
  }

  function _buildCard(f) {
    const est = (f.estatus || '').toLowerCase();
    const statusClass = /atendid/i.test(est) ? 'atendido' : /proceso/i.test(est) ? 'proceso' : 'pendiente';
    const statusLabel = /atendid/i.test(est) ? 'Atendidos' : /proceso/i.test(est) ? 'En proceso' : 'Pendiente';
    const isSelected  = _selectedId === f.id;

    const empColors = { GHO: '#4f8ef7', ETN: '#f59e0b', AERS: '#22c55e', AMEALSENSE: '#a855f7' };
    const empColor  = empColors[f.empresa] || '#e8edf8';
    const fecha = f.fecha ? new Date(f.fecha).toLocaleDateString('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '—';

    const canAtender = statusClass === 'pendiente';

    return `<div class="t-card ${isSelected?'selected':''}" id="card-${f.id}" onclick="openSheet('${f.id}')">
      <div class="t-card-accent ${statusClass}"></div>
      <div class="t-card-body">
        <div class="t-card-thumb">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="15" height="10" rx="1"/><path d="M17 9l4-2v10l-4-2"/></svg>
        </div>
        <div class="t-card-info">
          <div class="t-card-top">
            <span class="t-card-folio">${f.folio||'—'}</span>
            <span class="t-card-emp-tag" style="background:${empColor}22;color:${empColor}">${f.empresa||'—'}</span>
            <span class="t-card-status ${statusClass}">${statusLabel}</span>
          </div>
          <div class="t-card-unidad">Unidad ${f.unidad||'—'}</div>
          <div class="t-card-desc">${f.descripcion||f.categoria||'Sin descripción'}</div>
          <div class="t-card-meta">
            ${f.prioridad ? `<span class="t-card-meta-item">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>
              ${f.prioridad}
            </span>` : ''}
            ${f.categoria ? `<span class="t-card-meta-item">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="7" height="9"/><rect x="15" y="12" width="7" height="9"/></svg>
              ${f.categoria}
            </span>` : ''}
            ${f.base ? `<span class="t-card-meta-item">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/></svg>
              ${f.base}
            </span>` : ''}
            ${f.proveedor ? `<span class="t-card-proveedor">${f.proveedor}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="t-card-actions">
        <button class="t-card-btn" onclick="event.stopPropagation();openSheet('${f.id}')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          Ver detalle
        </button>
        ${canAtender ? `<button class="t-card-btn primary" onclick="event.stopPropagation();atenderCard('${f.id}')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Atender
        </button>` : `<button class="t-card-btn" style="color:var(--text3)" disabled>
          ${statusClass === 'atendido' ? '✅ Atendido' : '🔧 En proceso'}
        </button>`}
      </div>
    </div>`;
  }

  /* ─── BOTTOM SHEET ─── */
  window.openSheet = function(id) {
    if (typeof TECH === 'undefined') return;
    _selectedId = id;
    const fallas = TECH._getFallas ? TECH._getFallas() : [];
    const f = fallas.find(x => x.id === id);
    if (!f) return;

    const empColors = { GHO: '#4f8ef7', ETN: '#f59e0b', AERS: '#22c55e', AMEALSENSE: '#a855f7' };
    const empColor  = empColors[f.empresa] || '#e8edf8';
    const est = (f.estatus||'').toLowerCase();
    const statusClass = /atendid/i.test(est) ? 'atendido' : /proceso/i.test(est) ? 'proceso' : 'pendiente';
    const statusLabel = /atendid/i.test(est) ? 'Atendidos' : /proceso/i.test(est) ? 'En proceso' : 'Pendiente';
    const fecha = f.fecha ? new Date(f.fecha).toLocaleDateString('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:true}) : '—';

    _setText('sheetFolio',     f.folio || '—');
    _setText('sheetUnidad',    'Unidad ' + (f.unidad || '—'));
    _setText('sheetBase',      f.base || '—');
    _setText('sheetServicio',  f.servicio || '—');
    _setText('sheetPrioridad', f.prioridad || '—');
    _setText('sheetOperador',  f.proveedor || '—');
    _setText('sheetCategoria', f.categoria || '—');
    _setText('sheetComponente',f.componente || '—');
    _setText('sheetDesc',      f.descripcion || 'Sin descripción');
    _setText('sheetTecnico',   f.tecnico || '—');
    _setText('sheetFechaAten', f.fechaAtencion ? new Date(f.fechaAtencion).toLocaleDateString('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:true}) : '—');
    _setText('sheetObs',       f.resultado || 'Sin observaciones');
    _setText('sheetDate',      fecha);

    const empEl = document.getElementById('sheetEmpresa');
    if (empEl) { empEl.textContent = f.empresa || '—'; empEl.style.background = empColor + '22'; empEl.style.color = empColor; }

    const statusEl = document.getElementById('sheetStatus');
    if (statusEl) { statusEl.textContent = statusLabel; statusEl.className = 't-card-status ' + statusClass; }

    // Botón atender
    const btn = document.getElementById('sheetAtenderBtn');
    if (btn) {
      if (statusClass === 'pendiente') {
        btn.textContent = ''; btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Atender';
        btn.style.display = '';
        btn.onclick = () => doAtender();
      } else {
        btn.style.display = 'none';
      }
    }

    // Mostrar sheet
    document.getElementById('sheetOverlay')?.classList.add('show');
    document.getElementById('detailSheet')?.classList.add('show');

    // Highlight card
    document.querySelectorAll('.t-card').forEach(c => c.classList.remove('selected'));
    document.getElementById('card-' + id)?.classList.add('selected');
  };

  window.closeSheet = function() {
    _selectedId = null;
    document.getElementById('sheetOverlay')?.classList.remove('show');
    document.getElementById('detailSheet')?.classList.remove('show');
    document.querySelectorAll('.t-card').forEach(c => c.classList.remove('selected'));
  };

  /* ─── ATENDER ─── */
  window.atenderCard = function(id) {
    _selectedId = id;
    doAtender();
  };

  window.doAtender = function() {
    if (!_selectedId || typeof TECH === 'undefined') return;
    const fallas = TECH._getFallas ? TECH._getFallas() : [];
    const f = fallas.find(x => x.id === _selectedId);
    if (!f) return;

    // Usar el modal de atender de tecnico.js
    if (typeof TECH._openAtenderModal === 'function') {
      TECH._openAtenderModal(_selectedId);
    }
  };

  /* ─── TAB SWITCH ─── */
  function setTab(tab) {
    _activeTab = tab;
    document.querySelectorAll('.t-kpi').forEach(k => k.classList.remove('active'));
    document.querySelector(`.t-kpi[data-tab="${tab}"]`)?.classList.add('active');
    renderNewCards();
  }

  /* ─── SCREEN SWITCH ─── */
  function goScreen(screen) {
    _activeScreen = screen;
    document.querySelectorAll('.t-screen').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.t-nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('screen' + cap(screen))?.classList.add('active');
    document.getElementById('nav-' + screen)?.classList.add('active');
    if (screen === 'vision') renderVision();
    if (screen === 'perfil') renderNewPerfil();
  }

  /* ─── FILTER ─── */
  function toggleFilter(el) {
    document.querySelectorAll('.t-filter-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    _activeFilter = el.dataset.filter;
    renderNewCards();
  }

  /* ─── VISION ─── */
  function setVisionPeriod(period, btn) {
    _visionPeriod = period;
    document.querySelectorAll('.v-period-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderVision();
  }

  function renderVision() {
    if (typeof TECH === 'undefined') return;
    const session = typeof AUTH !== 'undefined' ? AUTH.checkSession() : null;
    const allFallas = TECH._getAllFallas ? TECH._getAllFallas() : (TECH._getFallas ? TECH._getFallas() : []);

    // Filtrar por período
    const now  = new Date();
    const msDay  = 86400000;
    const cutoff = _visionPeriod === 'dia'    ? new Date(now - msDay)
                 : _visionPeriod === 'semana' ? new Date(now - 7 * msDay)
                 : new Date(now - 30 * msDay);

    // Solo mis fallas (técnico logueado)
    const username = session?.username || '';
    const nombre   = session?.nombre || session?.name || '';
    const misF = allFallas.filter(f =>
      (f.tecnicoUsername === username || f.tecnico === nombre || f.tecnico === session?.username) &&
      (!f.fecha || new Date(f.fecha) >= cutoff)
    );

    const isAtendido = (est) => /atendid/i.test(est || '');

    const atendidos  = misF.filter(f => isAtendido(f.estatus)).length;
    const pendF      = allFallas.filter(f => !isAtendido(f.estatus) && (f.tecnicoUsername === username || f.tecnico === nombre));
    const correctivos= misF.filter(f => /correctiv/i.test(f.tipo)).length;
    const preventivos= misF.filter(f => /preventiv/i.test(f.tipo)).length;

    _setText('vAtendidos',   atendidos);
    _setText('vPendientes',  pendF.length);
    _setText('vCorrectivos', correctivos);
    _setText('vPreventivos', preventivos);

    // Chart de distribución
    const chartEl = document.getElementById('visionChart');
    if (chartEl) {
      const total = Math.max(correctivos + preventivos, 1);
      chartEl.innerHTML = [
        { label: 'Correctivos', val: correctivos, color: '#ef4444' },
        { label: 'Preventivos', val: preventivos, color: '#22c55e' },
        { label: 'Atendidos',   val: atendidos,   color: '#4f8ef7' },
      ].map(({label, val, color}) => `
        <div class="v-bar-row">
          <div class="v-bar-label">${label}</div>
          <div class="v-bar-track">
            <div class="v-bar-fill" style="width:${Math.round(val/Math.max(atendidos||1,total)*100)}%;background:${color}"></div>
          </div>
          <div class="v-bar-val">${val}</div>
        </div>`).join('');
    }

    // Chart por empresa
    const empEl = document.getElementById('visionEmpChart');
    if (empEl && session) {
      const empresas = session.empresas || [];
      const maxEmp = Math.max(...empresas.map(e => misF.filter(f => f.empresa === e).length), 1);
      const empColors = { GHO: '#4f8ef7', ETN: '#f59e0b', AERS: '#22c55e', AMEALSENSE: '#a855f7' };
      empEl.innerHTML = empresas.map(e => {
        const cnt = misF.filter(f => f.empresa === e).length;
        return `<div class="v-bar-row">
          <div class="v-bar-label">${e}</div>
          <div class="v-bar-track">
            <div class="v-bar-fill" style="width:${Math.round(cnt/maxEmp*100)}%;background:${empColors[e]||'#4f8ef7'}"></div>
          </div>
          <div class="v-bar-val">${cnt}</div>
        </div>`;
      }).join('');
    }
  }

  /* ─── PERFIL ─── */
  function renderNewPerfil() {
    const session = typeof AUTH !== 'undefined' ? AUTH.checkSession() : null;
    if (!session) return;

    const nombre  = session.nombre || session.name || session.username || '—';
    const initial = nombre.charAt(0).toUpperCase();

    _setText('perfilAvatar',   initial);
    _setText('perfilNombre',   nombre);
    _setText('perfilUsername', '@' + (session.username || '—'));
    _setText('perfilBase',     session.base || '—');
    _setText('perfilTel',      session.telefono || '—');
    _setText('perfilEmpleado', session.empleadoId || '—');
    _setText('perfilEmail',    session.email || '—');
    _setText('perfilEmpresas', (session.empresas || []).join(', ') || '—');

    const avatar = document.getElementById('userAvatar');
    if (avatar) avatar.textContent = initial;
    const bigAvatar = document.getElementById('perfilAvatar');
    if (bigAvatar) bigAvatar.textContent = initial;

    // Logout
    const logoutBtn = document.getElementById('btnLogout');
    if (logoutBtn && !logoutBtn._bound) {
      logoutBtn._bound = true;
      logoutBtn.onclick = async () => {
        if (typeof AUTH !== 'undefined') await AUTH.logout();
        window.location.href = 'index.html';
      };
    }
  }

  /* ─── HELPERS ─── */
  function _setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val ?? '—';
  }
  function cap(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : str; }

  /* ─── HOOK DE TECNICO.JS: detectar cuando renderAll() corre y actualizar la nueva UI ─── */
  // Sobreescribir showToast para redirigir a nuestra implementación
  if (typeof window.showToast === 'undefined') {
    window.showToast = function(msg, type='ok') {
      const container = document.getElementById('toastContainer');
      if (!container) return;
      const t = document.createElement('div');
      t.className = 'toast ' + type;
      t.textContent = msg;
      container.appendChild(t);
      setTimeout(() => t.remove(), 3200);
    };
  }

  /* ─── Polling de renderizado para sincronizar con tecnico.js ─── */
  // tecnico.js llama internamente a sus propias funciones de render.
  // Hacemos polling ligero cada 500ms para sincronizar la nueva UI.
  setInterval(() => {
    if (typeof TECH !== 'undefined' && TECH._uiReady) {
      renderNewCards();
      renderNewKPIs();
      renderNewEmpresaStrip();
    }
  }, 3000);

})();
