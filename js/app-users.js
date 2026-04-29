/* ═══════════════════════════════════════════════
   CCTV Fleet Control — Users Module v6.0
   + Filtro por empresa (etiquetas con color)
   + Filtros en disposición horizontal
   + Búsqueda multi-valor (varios nombres / coincidencias parciales)
   + Modales personalizados (sin confirm/prompt nativos)
═══════════════════════════════════════════════ */

const USRMGR = (() => {

  // Filtros: arrays para multi-selección
  let filterEmpresas = []; // array de empresas seleccionadas
  let filterRoles    = [];
  let filterBases    = [];
  let filterSearch   = '';
  let filterActivo   = ''; // 'activo' | 'inactivo' | ''

  // ── RENDER MÓDULO ────────────────────────────
  function renderUsuarios(session) {
    const allUsers   = AUTH.getUsers();
    const visEmpresa = DATA.state.empresas;
    const allBases   = [...new Set(allUsers.map(u => u.base).filter(Boolean))];

    // Auto-filtrar si estamos en modo individual y no hay filtro activo
    if (DATA.state.viewMode === 'individual' && DATA.state.currentEmpresa && filterEmpresas.length === 0) {
      filterEmpresas = [DATA.state.currentEmpresa];
    }

    const filtered = applyFilters(allUsers);

    return `
    <div id="mod-usuarios" class="module active">
      <div class="mod-header">
        <div class="mod-title-wrap">
          <h2 class="mod-title">Gestión de Usuarios</h2>
          <span class="mod-subtitle">Control total de accesos · Solo Administrador Master</span>
        </div>
        <div class="mod-header-right">
          <span style="font-family:var(--mono);font-size:11px;color:var(--purple);background:var(--purple-bg);border:1px solid rgba(168,85,247,0.2);border-radius:6px;padding:3px 10px">${allUsers.length} usuarios</span>
          <button class="btn btn-primary btn-sm" onclick="USRMGR.openCreateModal()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
            Nuevo Usuario
          </button>
        </div>
      </div>

      <!-- Filtros en disposición horizontal con etiquetas de empresa -->
      <div class="card" style="padding:14px 16px;margin-bottom:14px">

        <!-- Etiquetas de empresa (chips coloreados) -->
        <div style="margin-bottom:10px">
          <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Filtrar por empresa</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
            ${visEmpresa.map(e => {
              const clr   = DATA.getEmpresaColor(e);
              const isSel = filterEmpresas.includes(e);
              const cnt   = allUsers.filter(u => (u.empresas||[]).includes(e)).length;
              return `<button class="empresa-filter-chip${isSel ? ' active' : ''}"
                data-emp="${e}"
                onclick="USRMGR.toggleEmpresaFilter('${e}')"
                style="
                  display:inline-flex;align-items:center;gap:6px;
                  padding:4px 12px;border-radius:20px;cursor:pointer;
                  font-size:11px;font-weight:700;font-family:var(--mono);
                  transition:all 0.15s;
                  background:${isSel ? `rgba(${clr.r},${clr.g},${clr.b},0.18)` : 'var(--bg3)'};
                  color:${isSel ? clr.hex : 'var(--text2)'};
                  border:1px solid ${isSel ? `rgba(${clr.r},${clr.g},${clr.b},0.45)` : 'var(--border)'};
                  box-shadow:${isSel ? `0 0 10px rgba(${clr.r},${clr.g},${clr.b},0.15)` : 'none'}
                ">
                <span style="width:7px;height:7px;border-radius:50%;background:${clr.hex};flex-shrink:0"></span>
                ${e}
                <span style="font-size:10px;opacity:0.7">${cnt}</span>
              </button>`;
            }).join('')}
            ${filterEmpresas.length > 0 ? `<button class="btn btn-ghost btn-sm" onclick="USRMGR.clearEmpresaFilter()" style="font-size:10px">✕ Quitar filtro empresa</button>` : ''}
          </div>
        </div>

        <!-- Resto de filtros en fila horizontal -->
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end">
          <!-- Búsqueda multi-valor -->
          <div style="flex:2;min-width:200px">
            <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Búsqueda (separar por coma)</div>
            <input type="text" class="filter-input" id="uSearch"
              placeholder="ej: Juan, Pedro, admin..."
              style="width:100%" oninput="USRMGR.applyUIFilters()" value="${filterSearch}">
          </div>

          <!-- Rol -->
          <div style="flex:1;min-width:140px">
            <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Rol</div>
            <select class="filter-select" id="uFRol" onchange="USRMGR.applyUIFilters()" style="width:100%">
              <option value="">Todos los roles</option>
              <option value="master"${filterRoles.includes('master')?' selected':''}>Administrador Master</option>
              <option value="admin"${filterRoles.includes('admin')?' selected':''}>Administrador</option>
              <option value="tecnico"${filterRoles.includes('tecnico')?' selected':''}>Técnico</option>
            </select>
          </div>

          <!-- Base -->
          <div style="flex:1;min-width:130px">
            <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Base</div>
            <select class="filter-select" id="uFBase" onchange="USRMGR.applyUIFilters()" style="width:100%">
              <option value="">Todas las bases</option>
              ${allBases.map(b => `<option${filterBases.includes(b)?' selected':''}>${b}</option>`).join('')}
            </select>
          </div>

          <!-- Estado -->
          <div style="flex:1;min-width:120px">
            <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Estado</div>
            <select class="filter-select" id="uFActivo" onchange="USRMGR.applyUIFilters()" style="width:100%">
              <option value="">Todos</option>
              <option value="activo"${filterActivo==='activo'?' selected':''}>Activos</option>
              <option value="inactivo"${filterActivo==='inactivo'?' selected':''}>Inactivos</option>
            </select>
          </div>

          <div style="display:flex;align-items:flex-end;gap:8px">
            <button class="btn btn-ghost btn-sm" onclick="USRMGR.clearFilters()">Limpiar todo</button>
            <span style="font-size:11px;color:var(--text3);font-family:var(--mono);padding:4px 0;white-space:nowrap">${filtered.length} / ${allUsers.length}</span>
          </div>
        </div>
      </div>

      <div class="users-grid" id="usersGrid">
        ${filtered.length ? filtered.map(u => userCard(u, session)).join('') : '<div class="empty-state" style="grid-column:1/-1"><span class="empty-icon">👥</span><p class="empty-msg">Sin usuarios con los filtros seleccionados</p></div>'}
      </div>
    </div>`;
  }

  // ── TOGGLE EMPRESA CHIP ──────────────────────
  function toggleEmpresaFilter(emp) {
    const idx = filterEmpresas.indexOf(emp);
    if (idx >= 0) filterEmpresas.splice(idx, 1);
    else filterEmpresas.push(emp);
    // Re-render full module to update chips
    APP.showModule('usuarios');
  }

  function clearEmpresaFilter() {
    filterEmpresas = [];
    APP.showModule('usuarios');
  }

  // ── APPLY FILTERS ────────────────────────────
  function applyFilters(users) {
    let list = users;

    // Multi-empresa: OR lógica dentro de empresas
    if (filterEmpresas.length) {
      list = list.filter(u => filterEmpresas.some(e => (u.empresas || []).includes(e)));
    }

    // Rol: single select (podría extenderse a multi)
    if (filterRoles.length) {
      list = list.filter(u => filterRoles.includes(u.role));
    }

    // Base
    if (filterBases.length) {
      list = list.filter(u => filterBases.includes(u.base));
    }

    // Activo
    if (filterActivo === 'activo')   list = list.filter(u => u.activo !== false);
    if (filterActivo === 'inactivo') list = list.filter(u => u.activo === false);

    // Búsqueda multi-valor: separar por coma, OR lógica
    if (filterSearch.trim()) {
      const terms = filterSearch.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
      list = list.filter(u => {
        const haystack = (u.nombre + ' ' + u.username + ' ' + (u.email||'') + ' ' + (u.base||'')).toLowerCase();
        return terms.some(t => haystack.includes(t));
      });
    }

    return list;
  }

  function applyUIFilters() {
    filterSearch  = document.getElementById('uSearch')?.value || '';
    const rolSel  = document.getElementById('uFRol')?.value || '';
    filterRoles   = rolSel ? [rolSel] : [];
    const baseSel = document.getElementById('uFBase')?.value || '';
    filterBases   = baseSel ? [baseSel] : [];
    filterActivo  = document.getElementById('uFActivo')?.value || '';

    const allUsers = AUTH.getUsers();
    const filtered = applyFilters(allUsers);
    const session  = AUTH.checkSession();
    const grid     = document.getElementById('usersGrid');

    if (grid) {
      grid.innerHTML = filtered.length
        ? filtered.map(u => userCard(u, session)).join('')
        : '<div class="empty-state" style="grid-column:1/-1"><span class="empty-icon">👥</span><p class="empty-msg">Sin usuarios con los filtros seleccionados</p></div>';
    }

    // Update count
    const countSpan = document.querySelector('#mod-usuarios .mod-header-right span');
    if (countSpan) countSpan.textContent = `${AUTH.getUsers().length} usuarios`;

    // Update count display near search
    const countEl = document.querySelector('#mod-usuarios .card span[style*="mono"]');
  }

  function clearFilters() {
    filterSearch  = '';
    filterEmpresas = [];
    filterRoles   = [];
    filterBases   = [];
    filterActivo  = '';
    APP.showModule('usuarios');
  }

  // ── USER CARD ─────────────────────────────────
  function userCard(u, session) {
    const avatarColors = {
      master:  'linear-gradient(135deg, #a855f7, #7c3aed)',
      admin:   'linear-gradient(135deg, #4f8ef7, #2b63d6)',
      tecnico: 'linear-gradient(135deg, #22c55e, #16a34a)'
    };
    const isMe = u.id === session.userId;
    const empresas = u.empresas || [];

    return `<div class="user-card ${!u.activo ? 'inactive' : ''}">
      <div class="user-card-top">
        <div class="user-card-avatar" style="background:${avatarColors[u.role] || avatarColors.admin}">
          ${u.nombre[0].toUpperCase()}
        </div>
        <div class="user-card-info">
          <div class="user-card-name">${u.nombre} ${isMe ? '<span style="font-size:9px;color:var(--accent)">(tú)</span>' : ''}</div>
          <div class="user-card-username">@${u.username}</div>
          ${u.base ? `<div style="font-size:10px;color:var(--text3);font-family:var(--mono);margin-top:2px">📍 ${u.base}</div>` : ''}
          <div style="margin-top:4px">${UI.roleBadge(u.role)}</div>
        </div>
        <div style="margin-left:auto;display:flex;flex-direction:column;align-items:flex-end;gap:6px">
          <span style="font-size:10px;font-family:var(--mono);padding:2px 8px;border-radius:4px;${u.activo ? 'background:var(--green-bg);color:var(--green);border:1px solid rgba(34,197,94,0.2)' : 'background:var(--red-bg);color:var(--red);border:1px solid rgba(239,68,68,0.2)'}">
            ${u.activo ? 'ACTIVO' : 'INACTIVO'}
          </span>
        </div>
      </div>

      <!-- Empresas asignadas -->
      <div class="user-card-empresas">
        ${empresas.map(e => {
          const clr = DATA.getEmpresaColor(e);
          return `<span class="user-empresas-chip" style="color:${clr.hex};border-color:rgba(${clr.r},${clr.g},${clr.b},0.25);background:rgba(${clr.r},${clr.g},${clr.b},0.08)">${e}</span>`;
        }).join('')}
      </div>

      <!-- Contraseña visible para Master -->
      <div style="margin:8px 0;padding:6px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:10px;color:var(--text3);font-family:var(--mono)">Autenticación:</span>
        <span class="pass-hidden" id="passDisp-${u.id}" style="font-family:var(--mono);font-size:11px;color:var(--text3)" data-pass="${u.password || ''}" data-hash="${u.password_hash || ''}" onclick="USRMGR.togglePassDisp('${u.id}')">${u.password_hash ? 'hash local' : '••••••••'}  <span style="font-size:9px;color:var(--accent);cursor:pointer">detalle</span></span>
      </div>

      <div class="user-card-actions" style="flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" onclick="USRMGR.openEditModal('${u.id}')">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Editar
        </button>
        <button class="btn btn-ghost btn-sm" onclick="USRMGR.openResetPassModal('${u.id}')">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          Contraseña
        </button>
        ${!isMe ? `<button class="btn ${u.activo ? 'btn-danger' : 'btn-success'} btn-sm" onclick="USRMGR.toggleUser('${u.id}')">
          ${u.activo ? 'Desactivar' : 'Activar'}
        </button>` : ''}
        ${!isMe ? `<button class="btn btn-danger btn-sm" onclick="USRMGR.deleteUser('${u.id}')">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>` : ''}
      </div>

      <div style="margin-top:8px;font-size:10px;color:var(--text3);font-family:var(--mono)">
        Creado: ${UI.fmtDate(u.createdAt)} · por @${u.createdBy}
      </div>
      ${u.loginHistory && u.loginHistory.length && session.role === 'master' ? `
      <div style="margin-top:8px;padding:6px 10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--r)">
        <div style="font-size:10px;color:var(--text3);margin-bottom:4px;font-weight:600">Último acceso</div>
        <div style="font-size:10px;font-family:var(--mono);color:var(--text2)">
          📅 ${UI.fmtDt(u.loginHistory[0].fecha)}<br>
          📱 ${u.loginHistory[0].deviceType} · ${u.loginHistory[0].browser} · ${u.loginHistory[0].screenRes}
        </div>
      </div>` : ''}
    </div>`;
  }

  function togglePassDisp(userId) {
    const el = document.getElementById('passDisp-' + userId);
    if (!el) return;
    const pass  = el.dataset.pass;
    const hash  = el.dataset.hash;
    const shown = el.dataset.shown === '1';
    if (shown) {
      el.innerHTML = `${hash ? 'hash local' : '••••••••'}  <span style="font-size:9px;color:var(--accent);cursor:pointer">detalle</span>`;
      el.dataset.shown = '0';
    } else {
      el.innerHTML = `<span style="color:var(--amber)">${hash || pass || 'Sin dato visible'}</span>  <span style="font-size:9px;color:var(--accent);cursor:pointer">ocultar</span>`;
      el.dataset.shown = '1';
    }
  }

  // ── MODAL CREAR USUARIO ──────────────────────
  function openCreateModal() {
    const requiresEmail = DS.isDatabaseMode();
    const allBases = [...new Set(
      DATA.state.empresas.flatMap(e => DATA.getSel('base', e))
    )];

    UI.openModal(`
    <div class="modal-hdr">
      <h3 class="modal-title">Nuevo Usuario</h3>
      <button class="modal-close" onclick="UI.forceCloseModal()">✕</button>
    </div>
    <div class="modal-body">
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="form-group">
          <label class="required">Nombre Completo</label>
          <input type="text" id="mNombre" placeholder="Nombre del usuario">
        </div>
        <div class="form-group">
          <label class="required">Usuario (login)</label>
          <input type="text" id="mUsername" placeholder="Sin espacios, minúsculas">
        </div>
        <div class="form-group">
          <label class="required">Contraseña</label>
          <div class="pass-wrap" style="position:relative">
            <input type="password" id="mPassword" placeholder="Mínimo 6 caracteres" style="padding-right:40px">
            <button type="button" onclick="USRMGR.toggleModalPass('mPassword',this)" class="pass-toggle" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--text3);cursor:pointer">👁</button>
          </div>
        </div>
        <div class="form-group">
          <label class="required">Rol</label>
          <div class="select-wrap">
            <select id="mRole">
              <option value="tecnico">Técnico</option>
              <option value="admin">Administrador</option>
              <option value="master">Administrador Master</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Base Asignada</label>
          <div class="select-wrap">
            <select id="mBase">
              <option value="">— Sin base específica —</option>
              ${allBases.map(b => `<option>${b}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Empresas Accesibles</label>
          <div style="display:flex;flex-wrap:wrap;gap:6px;padding:10px;background:var(--bg3);border-radius:var(--r);border:1px solid var(--border)" id="mEmpresasChips">
            ${DATA.state.empresas.map(e => {
              const clr = DATA.getEmpresaColor(e);
              return `<div class="chip active" data-emp="${e}" style="--chip-r:${clr.r};--chip-g:${clr.g};--chip-b:${clr.b}" onclick="this.classList.toggle('active')">${e}</div>`;
            }).join('')}
          </div>
          <p style="font-size:11px;color:var(--text3);margin-top:4px">Solo se mostrarán datos de las empresas seleccionadas</p>
        </div>
        <div class="form-group">
          <label class="${requiresEmail ? 'required' : ''}">Email${requiresEmail ? '' : ' (opcional)'}</label>
          <input type="email" id="mEmail" placeholder="correo@ejemplo.com">
        </div>
        <div id="modalErr" style="display:none;background:var(--red-bg);border:1px solid rgba(239,68,68,0.25);border-radius:var(--r);padding:8px 12px;font-size:12.5px;color:var(--red)"></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="UI.forceCloseModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="USRMGR.doCreate()">Crear Usuario</button>
    </div>`);
  }

  function toggleModalPass(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    btn.textContent = input.type === 'password' ? '👁' : '🙈';
  }

  async function doCreate() {
    const nombre   = document.getElementById('mNombre')?.value.trim();
    const username = document.getElementById('mUsername')?.value.trim().toLowerCase().replace(/\s/g,'');
    const password = document.getElementById('mPassword')?.value;
    const role     = document.getElementById('mRole')?.value;
    const base     = document.getElementById('mBase')?.value || '';
    const email    = document.getElementById('mEmail')?.value.trim();
    const empresas = [...document.querySelectorAll('#mEmpresasChips .chip.active')].map(c => c.dataset.emp);
    const errEl    = document.getElementById('modalErr');
    const requiresEmail = DS.isDatabaseMode();

    const errors = [];
    if (!nombre)   errors.push('Nombre');
    if (!username) errors.push('Usuario');
    if (!password || password.length < 6) errors.push('Contraseña (mín. 6 chars)');
    if (requiresEmail && !email) errors.push('Email');
    if (empresas.length === 0) errors.push('Al menos una empresa');

    if (errors.length) {
      errEl.textContent = 'Campos requeridos: ' + errors.join(', ');
      errEl.style.display = 'block'; return;
    }

    const result = await AUTH.createUser({ nombre, username, password, role, empresas, base, email });
    if (!result.ok) { errEl.textContent = result.error; errEl.style.display = 'block'; return; }

    UI.forceCloseModal();
    await APP.showModule('usuarios');
    UI.toast(`Usuario "${nombre}" creado`);
  }

  // ── MODAL EDITAR USUARIO ─────────────────────
  function openEditModal(userId) {
    const u = AUTH.getUser(userId);
    if (!u) return;

    const allBases = [...new Set(
      DATA.state.empresas.flatMap(e => DATA.getSel('base', e))
    )];

    UI.openModal(`
    <div class="modal-hdr">
      <h3 class="modal-title">Editar Usuario · ${u.nombre}</h3>
      <button class="modal-close" onclick="UI.forceCloseModal()">✕</button>
    </div>
    <div class="modal-body">
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="form-group">
          <label class="required">Nombre Completo</label>
          <input type="text" id="emNombre" value="${u.nombre}">
        </div>
        <div class="form-group">
          <label>Usuario (login)</label>
          <input type="text" id="emUsername" value="${u.username}" style="opacity:0.5" disabled>
        </div>
        <div class="form-group">
          <label class="required">Rol</label>
          <div class="select-wrap">
            <select id="emRole">
              <option value="tecnico"${u.role==='tecnico'?' selected':''}>Técnico</option>
              <option value="admin"${u.role==='admin'?' selected':''}>Administrador</option>
              <option value="master"${u.role==='master'?' selected':''}>Administrador Master</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Base Asignada</label>
          <div class="select-wrap">
            <select id="emBase">
              <option value="">— Sin base específica —</option>
              ${allBases.map(b => `<option${u.base===b?' selected':''}>${b}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Empresas Accesibles</label>
          <div style="display:flex;flex-wrap:wrap;gap:6px;padding:10px;background:var(--bg3);border-radius:var(--r);border:1px solid var(--border)" id="emEmpresasChips">
            ${DATA.state.empresas.map(e => {
              const clr  = DATA.getEmpresaColor(e);
              const isOn = (u.empresas || []).includes(e);
              return `<div class="chip${isOn?' active':''}" data-emp="${e}" style="--chip-r:${clr.r};--chip-g:${clr.g};--chip-b:${clr.b}" onclick="this.classList.toggle('active')">${e}</div>`;
            }).join('')}
          </div>
        </div>
        <div class="form-group">
          <label>Email (opcional)</label>
          <input type="email" id="emEmail" value="${u.email || ''}" placeholder="correo@ejemplo.com">
        </div>
        <div id="modalErr" style="display:none;background:var(--red-bg);border:1px solid rgba(239,68,68,0.25);border-radius:var(--r);padding:8px 12px;font-size:12.5px;color:var(--red)"></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="UI.forceCloseModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="USRMGR.doEdit('${userId}')">Guardar Cambios</button>
    </div>`);
  }

  async function doEdit(userId) {
    const nombre   = document.getElementById('emNombre')?.value.trim();
    const role     = document.getElementById('emRole')?.value;
    const base     = document.getElementById('emBase')?.value || '';
    const email    = document.getElementById('emEmail')?.value.trim();
    const empresas = [...document.querySelectorAll('#emEmpresasChips .chip.active')].map(c => c.dataset.emp);
    const errEl    = document.getElementById('modalErr');

    if (!nombre) { errEl.textContent = 'El nombre es requerido'; errEl.style.display = 'block'; return; }
    if (empresas.length === 0) { errEl.textContent = 'Selecciona al menos una empresa'; errEl.style.display = 'block'; return; }

    const result = await AUTH.updateUser(userId, { nombre, role, empresas, base, email });
    if (!result.ok) { errEl.textContent = result.error; errEl.style.display = 'block'; return; }

    UI.forceCloseModal();
    await APP.showModule('usuarios');
    UI.toast('Usuario actualizado');
  }

  // ── MODAL RESET PASSWORD ─────────────────────
  function openResetPassModal(userId) {
    const u = AUTH.getUser(userId);
    if (!u) return;

    UI.openModal(`
    <div class="modal-hdr">
      <h3 class="modal-title">Restablecer Contraseña</h3>
      <button class="modal-close" onclick="UI.forceCloseModal()">✕</button>
    </div>
    <div class="modal-body">
      <div style="margin-bottom:14px;padding:10px 12px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:var(--r);font-size:12.5px;color:var(--amber)">
        Restableciendo contraseña para: <strong>${u.nombre}</strong> (@${u.username})
      </div>
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="form-group">
          <label class="required">Nueva Contraseña</label>
          <div class="pass-wrap" style="position:relative">
            <input type="password" id="rpPass1" placeholder="Mínimo 6 caracteres" style="padding-right:40px">
            <button type="button" onclick="USRMGR.toggleModalPass('rpPass1',this)" class="pass-toggle" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--text3);cursor:pointer">👁</button>
          </div>
        </div>
        <div class="form-group">
          <label class="required">Confirmar Contraseña</label>
          <input type="password" id="rpPass2" placeholder="Repite la contraseña">
        </div>
        <div id="modalErr" style="display:none;background:var(--red-bg);border:1px solid rgba(239,68,68,0.25);border-radius:var(--r);padding:8px 12px;font-size:12.5px;color:var(--red)"></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="UI.forceCloseModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="USRMGR.doResetPass('${userId}')">Restablecer</button>
    </div>`);
  }

  async function doResetPass(userId) {
    const p1    = document.getElementById('rpPass1')?.value;
    const p2    = document.getElementById('rpPass2')?.value;
    const errEl = document.getElementById('modalErr');

    if (!p1 || p1.length < 6) { errEl.textContent = 'Mínimo 6 caracteres'; errEl.style.display = 'block'; return; }
    if (p1 !== p2) { errEl.textContent = 'Las contraseñas no coinciden'; errEl.style.display = 'block'; return; }

    const result = await AUTH.resetPassword(userId, p1);
    if (!result.ok) { errEl.textContent = result.error; errEl.style.display = 'block'; return; }

    UI.forceCloseModal();
    await APP.showModule('usuarios');
    UI.toast(result.message || 'Contrasena restablecida');
  }

  async function toggleUser(userId) {
    const u = AUTH.getUser(userId);
    if (!u) return;
    const accion = u.activo ? 'desactivar' : 'activar';
    const ok = await UI.showConfirm({
      title: `${accion.charAt(0).toUpperCase() + accion.slice(1)} usuario`,
      message: `¿${accion.charAt(0).toUpperCase() + accion.slice(1)} a <strong>${u.nombre}</strong>?`,
      confirmText: accion.charAt(0).toUpperCase() + accion.slice(1),
      danger: u.activo
    });
    if (!ok) return;
    const result = await AUTH.toggleUser(userId);
    if (!result.ok) { UI.toast(result.error, 'err'); return; }
    await APP.showModule('usuarios');
    UI.toast(`Usuario ${result.activo ? 'activado' : 'desactivado'}`);
  }

  async function deleteUser(userId) {
    const u = AUTH.getUser(userId);
    if (!u) return;
    const ok = await UI.showConfirm({
      title: 'Eliminar usuario',
      message: `¿Eliminar permanentemente a <strong>${u.nombre}</strong>? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      danger: true
    });
    if (!ok) return;
    const result = await AUTH.deleteUser(userId);
    if (!result.ok) { UI.toast(result.error, 'err'); return; }
    await APP.showModule('usuarios');
    UI.toast(`Usuario "${u.nombre}" eliminado`);
  }

  return {
    renderUsuarios, applyUIFilters, clearFilters,
    toggleEmpresaFilter, clearEmpresaFilter,
    openCreateModal, toggleModalPass, doCreate,
    openEditModal, doEdit,
    openResetPassModal, doResetPass,
    toggleUser, deleteUser, togglePassDisp
  };
})();
