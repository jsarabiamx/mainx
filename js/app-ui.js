/* ═══════════════════════════════════════════════
   CCTV Fleet Control — UI Utilities v6.0
   + Sistema de modales personalizados
   + Multi-select dropdown helper
═══════════════════════════════════════════════ */

const UI = (() => {

  // ─── TOAST ──────────────────────────────────
  function toast(msg, type = 'ok') {
    const t = document.getElementById('toast');
    if (!t) return;
    const icons = {
      ok:   '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
      err:  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
      warn: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
    };
    t.innerHTML = (icons[type] || icons.ok) + '<span>' + msg + '</span>';
    t.className = 'toast ' + (type !== 'ok' ? type : '');
    clearTimeout(t._tid);
    setTimeout(() => t.classList.add('show'), 10);
    t._tid = setTimeout(() => t.classList.remove('show'), 3500);
  }

  // ─── RELOJ ───────────────────────────────────
  function updateClock() {
    const now = new Date();
    const ct = document.getElementById('clockTime');
    const cd = document.getElementById('clockDate');
    if (ct) ct.textContent = now.toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    if (cd) cd.textContent = now.toLocaleDateString('es-MX', { weekday:'short', day:'2-digit', month:'short' });
  }

  // ─── FORMAT ──────────────────────────────────
  function fmtDt(s) {
    if (!s) return '—';
    const d = new Date(s);
    return d.toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' })
         + ' ' + d.toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' });
  }

  function fmtDate(s) {
    if (!s) return '—';
    return new Date(s).toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' });
  }

  function nowISO() { return new Date().toISOString().slice(0, 16); }

  // ─── BADGES ──────────────────────────────────
  function badgeClass(estatus) {
    if (!estatus) return 'b-pendiente';
    const map = {
      'Pendiente':          'b-pendiente',
      'En proceso':         'b-proceso',
      'Atendido':           'b-atendido',
      'Requiere refacción': 'b-refaccion',
      'No localizado':      'b-nolocalizado'
    };
    if (map[estatus]) return map[estatus];
    if (/atendid/i.test(estatus))   return 'b-atendido';
    if (/proceso/i.test(estatus))   return 'b-proceso';
    if (/pendient/i.test(estatus))  return 'b-pendiente';
    return 'b-pendiente';
  }

  function rowClass(estatus) {
    if (!estatus) return '';
    const map = {
      'Pendiente':          'tr-pendiente',
      'En proceso':         'tr-proceso',
      'Atendido':           'tr-atendido',
      'Requiere refacción': 'tr-refaccion',
      'No localizado':      'tr-nolocalizado'
    };
    if (map[estatus]) return map[estatus];
    if (/atendid/i.test(estatus))   return 'tr-atendido';
    if (/proceso/i.test(estatus))   return 'tr-proceso';
    if (/pendient/i.test(estatus))  return 'tr-pendiente';
    return '';
  }

  function prioColor(p) {
    if (p === 'Alta')  return '#ef4444';
    if (p === 'Media') return '#f59e0b';
    return '#22c55e';
  }

  function empresaBadgeHTML(empresa) {
    const clr = DATA.getEmpresaColor(empresa);
    return `<span class="empresa-badge" style="background:rgba(${clr.r},${clr.g},${clr.b},0.12);color:${clr.hex};border:1px solid rgba(${clr.r},${clr.g},${clr.b},0.25)">${empresa}</span>`;
  }

  function roleBadge(role) {
    const cls = { master:'role-master', admin:'role-admin', tecnico:'role-tecnico' }[role] || 'role-admin';
    return `<span class="role-badge ${cls}">${AUTH.ROLE_LABELS[role] || role}</span>`;
  }

  function auditTypeColor(tipo) {
    const map = {
      LOGIN:        '#22c55e',
      LOGOUT:       '#4f8ef7',
      PASS_CHANGE:  '#f59e0b',
      PASS_RESET:   '#f59e0b',
      USER_CREATE:  '#a855f7',
      USER_EDIT:    '#4f8ef7',
      USER_STATUS:  '#f59e0b',
      USER_DELETE:  '#ef4444',
      REPORT_CREATE:'#22c55e',
      REPORT_EDIT:  '#4f8ef7',
      REPORT_DELETE:'#ef4444',
      EMPRESA_CREATE:'#22c55e',
      EMPRESA_DELETE:'#ef4444',
    };
    return map[tipo] || '#7c8ba1';
  }

  // ─── MODAL BASE ───────────────────────────────
  function openModal(html) {
    const overlay = document.getElementById('modalOverlay');
    const box     = document.getElementById('modalBox');
    if (!overlay || !box) return;
    box.innerHTML = html;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    // Focus first input
    setTimeout(() => {
      const inp = box.querySelector('input:not([disabled]),select:not([disabled]),textarea:not([disabled])');
      if (inp) inp.focus();
    }, 80);
  }

  function closeModal(e) {
    if (e && e.target !== document.getElementById('modalOverlay')) return;
    forceCloseModal();
  }

  function forceCloseModal() {
    const overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  // ─── MODAL DE CONFIRMACIÓN PERSONALIZADO ──────
  /**
   * showConfirm({ title, message, confirmText, cancelText, danger })
   * Retorna una Promise<boolean>
   */
  function showConfirm({ title = '¿Confirmar acción?', message = '', confirmText = 'Confirmar', cancelText = 'Cancelar', danger = false } = {}) {
    return new Promise(resolve => {
      const overlay = document.getElementById('modalOverlay');
      const box     = document.getElementById('modalBox');
      if (!overlay || !box) { resolve(window.confirm(message || title)); return; }

      box.innerHTML = `
        <div class="modal-hdr">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;
              background:${danger ? 'rgba(239,68,68,0.12)' : 'rgba(79,142,247,0.12)'};
              border:1px solid ${danger ? 'rgba(239,68,68,0.25)' : 'rgba(79,142,247,0.25)'}">
              ${danger
                ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
                : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4f8ef7" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
              }
            </div>
            <h3 class="modal-title">${title}</h3>
          </div>
          <button class="modal-close" id="confirmClose">✕</button>
        </div>
        <div class="modal-body">
          ${message ? `<p style="color:var(--text2);font-size:13.5px;line-height:1.6">${message}</p>` : ''}
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="confirmCancel">${cancelText}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirmOk">${confirmText}</button>
        </div>`;

      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';

      const cleanup = (val) => {
        overlay.classList.remove('open');
        document.body.style.overflow = '';
        resolve(val);
      };

      document.getElementById('confirmOk').onclick    = () => cleanup(true);
      document.getElementById('confirmCancel').onclick = () => cleanup(false);
      document.getElementById('confirmClose').onclick  = () => cleanup(false);
    });
  }

  // ─── MODAL DE EDICIÓN PERSONALIZADO ──────────
  /**
   * showPrompt({ title, label, value, placeholder, validate })
   * Retorna Promise<string|null>
   */
  function showPrompt({ title = 'Editar', label = '', value = '', placeholder = '', validate = null } = {}) {
    return new Promise(resolve => {
      const overlay = document.getElementById('modalOverlay');
      const box     = document.getElementById('modalBox');
      if (!overlay || !box) { const r = window.prompt(label || title, value); resolve(r); return; }

      box.innerHTML = `
        <div class="modal-hdr">
          <h3 class="modal-title">${title}</h3>
          <button class="modal-close" id="promptClose">✕</button>
        </div>
        <div class="modal-body">
          ${label ? `<label style="display:block;font-size:12px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">${label}</label>` : ''}
          <input type="text" id="promptInput" value="${value.replace(/"/g,'&quot;')}" placeholder="${placeholder}" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:10px;color:var(--text);font-family:var(--font);font-size:14px;padding:11px 14px;outline:none;transition:all 0.2s">
          <div id="promptErr" style="display:none;margin-top:8px;padding:8px 12px;background:var(--red-bg);border:1px solid rgba(239,68,68,0.25);border-radius:8px;font-size:12.5px;color:var(--red)"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="promptCancel">Cancelar</button>
          <button class="btn btn-primary" id="promptOk">Guardar</button>
        </div>`;

      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';

      const input  = document.getElementById('promptInput');
      const errEl  = document.getElementById('promptErr');
      setTimeout(() => { input.focus(); input.select(); }, 80);

      const cleanup = (val) => {
        overlay.classList.remove('open');
        document.body.style.overflow = '';
        resolve(val);
      };

      const doOk = () => {
        const val = input.value.trim();
        if (!val) { errEl.textContent = 'El campo no puede estar vacío'; errEl.style.display = 'block'; return; }
        if (validate) {
          const err = validate(val);
          if (err) { errEl.textContent = err; errEl.style.display = 'block'; return; }
        }
        cleanup(val);
      };

      document.getElementById('promptOk').onclick     = doOk;
      document.getElementById('promptCancel').onclick  = () => cleanup(null);
      document.getElementById('promptClose').onclick   = () => cleanup(null);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') doOk(); if (e.key === 'Escape') cleanup(null); });
      input.addEventListener('focus', () => { input.style.borderColor = 'rgba(79,142,247,0.5)'; input.style.boxShadow = '0 0 0 3px rgba(79,142,247,0.1)'; });
      input.addEventListener('blur',  () => { input.style.borderColor = ''; input.style.boxShadow = ''; });
    });
  }

  // ─── MULTI-SELECT DROPDOWN ────────────────────
  /**
   * Builds a multi-select dropdown widget
   * options: array of { value, label, color? }
   * selected: array of currently selected values
   * placeholder: e.g. "Todas las empresas"
   * onChange: callback(selectedArray)
   */
  function buildMultiSelect({ id, options, selected = [], placeholder = 'Seleccionar...', onChange, colorDot = false }) {
    const containerId = id + '_ms';

    const renderChips = (sel) => {
      if (!sel.length) return `<span style="color:var(--text3);font-size:12px">${placeholder}</span>`;
      return sel.map(v => {
        const opt = options.find(o => o.value === v || o === v);
        const label = opt ? (opt.label || opt.value || opt) : v;
        const color = opt && opt.color ? opt.color : null;
        return `<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(79,142,247,0.12);color:var(--accent);border:1px solid rgba(79,142,247,0.25);border-radius:4px;padding:1px 6px;font-size:11px;white-space:nowrap">
          ${color ? `<span style="width:6px;height:6px;border-radius:50%;background:${color};flex-shrink:0"></span>` : ''}
          ${label}
        </span>`;
      }).join('');
    };

    const html = `
      <div class="ms-container" id="${containerId}" style="position:relative;user-select:none">
        <div class="ms-trigger" id="${id}_trigger"
          style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;min-height:32px;padding:4px 32px 4px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;cursor:pointer;position:relative;gap:4px;row-gap:4px">
          <span id="${id}_chips">${renderChips(selected)}</span>
          <svg style="position:absolute;right:8px;top:50%;transform:translateY(-50%);flex-shrink:0" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="ms-dropdown" id="${id}_dropdown"
          style="display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:9999;background:var(--bg2);border:1px solid var(--border2);border-radius:10px;box-shadow:0 16px 40px rgba(0,0,0,0.5);overflow:hidden;max-height:260px;overflow-y:auto">
          <div style="padding:6px">
            <div style="padding:4px 8px 8px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
              <span style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;font-weight:700">${placeholder}</span>
              <button style="font-size:10px;color:var(--accent);background:none;border:none;cursor:pointer;padding:2px 6px" id="${id}_clearBtn">Limpiar</button>
            </div>
            ${options.map(opt => {
              const val   = typeof opt === 'string' ? opt : opt.value;
              const label = typeof opt === 'string' ? opt : (opt.label || opt.value);
              const color = typeof opt === 'object' && opt.color ? opt.color : null;
              const isSel = selected.includes(val);
              return `<div class="ms-option${isSel ? ' ms-selected' : ''}" data-val="${val}"
                style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:6px;cursor:pointer;transition:background 0.15s;${isSel ? 'background:rgba(79,142,247,0.1)' : ''}">
                <div style="width:14px;height:14px;border-radius:3px;border:1.5px solid ${isSel ? 'var(--accent)' : 'var(--border2)'};background:${isSel ? 'var(--accent)' : 'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.15s">
                  ${isSel ? '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
                </div>
                ${color ? `<span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></span>` : ''}
                <span style="font-size:12.5px;color:var(--text)">${label}</span>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>`;

    // Attach events after render (call after inserting HTML)
    const attachEvents = () => {
      const container = document.getElementById(containerId);
      if (!container) return;

      let currentSelected = [...selected];
      const dropdown  = document.getElementById(id + '_dropdown');
      const trigger   = document.getElementById(id + '_trigger');
      const chipsEl   = document.getElementById(id + '_chips');
      const clearBtn  = document.getElementById(id + '_clearBtn');

      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdown.style.display !== 'none';
        // Close all other ms-dropdowns
        document.querySelectorAll('.ms-dropdown').forEach(d => { d.style.display = 'none'; });
        dropdown.style.display = isOpen ? 'none' : 'block';
      });

      container.querySelectorAll('.ms-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
          e.stopPropagation();
          const val = opt.dataset.val;
          const idx = currentSelected.indexOf(val);
          if (idx >= 0) currentSelected.splice(idx, 1);
          else currentSelected.push(val);

          // Update checkbox style
          const check = opt.querySelector('div');
          const isSel = currentSelected.includes(val);
          opt.classList.toggle('ms-selected', isSel);
          opt.style.background = isSel ? 'rgba(79,142,247,0.1)' : '';
          check.style.borderColor = isSel ? 'var(--accent)' : 'var(--border2)';
          check.style.background  = isSel ? 'var(--accent)' : 'transparent';
          check.innerHTML = isSel ? '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : '';

          chipsEl.innerHTML = renderChips(currentSelected);
          if (onChange) onChange([...currentSelected]);
        });
      });

      clearBtn && clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        currentSelected = [];
        container.querySelectorAll('.ms-option').forEach(opt => {
          opt.classList.remove('ms-selected');
          opt.style.background = '';
          const check = opt.querySelector('div');
          check.style.borderColor = 'var(--border2)';
          check.style.background  = 'transparent';
          check.innerHTML = '';
        });
        chipsEl.innerHTML = renderChips([]);
        if (onChange) onChange([]);
      });
    };

    return { html, attachEvents };
  }

  // ─── Close dropdowns on outside click ─────────
  document.addEventListener('click', () => {
    document.querySelectorAll('.ms-dropdown').forEach(d => { d.style.display = 'none'; });
  });

  // ─── NAV RENDER ──────────────────────────────
  function renderNav(session) {
    const container = document.getElementById('navLeft');
    if (!container) return;

    const isMaster = session.role === AUTH.ROLES.MASTER;
    const isAdmin  = session.role === AUTH.ROLES.ADMIN;
    const pendCount = DATA.getFilteredFallas().filter(f => f.estatus === 'Pendiente').length;

    let html = '';

    if (isMaster || isAdmin) {
      html += navBtn('registro', `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
        Nuevo Registro
      `);
    }

    html += navBtn('atencion', `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      Atención Técnica
      <span class="nav-badge" id="cntPend">${pendCount > 0 ? pendCount : ''}</span>
    `);

    if (isMaster || isAdmin) {
      html += navBtn('dashboard', `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
        Dashboard
      `);
    }

    if (isMaster || isAdmin) {
      html += navBtn('atendidos', `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/><path d="M21 16v5l-3-1-3 1v-5"/></svg>
        Atendidos
      `);
    }

    if (isMaster || isAdmin) {
      html += navBtn('config', `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M5.34 18.66l-1.41 1.41M20 12h-2M6 12H4M15.07 8.93l1.41-1.41M7.93 15.07l-1.41 1.41"/></svg>
        Configuración
      `);
    }

    if (isMaster) {
      html += navBtn('usuarios', `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
        Usuarios
        <span class="nav-badge nav-badge-master"></span>
      `);
    }

    if (isMaster) {
      html += navBtn('historial', `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 3h6l3 9 3-9h6"/><path d="M3 21l9-6 9 6"/></svg>
        Historial
        <span class="nav-badge nav-badge-master">Master</span>
      `);
    }

    if (isMaster) {
      html += navBtn('flota', `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        Carga Asignación
        <span class="nav-badge nav-badge-master">Master</span>
      `);
    }

    container.innerHTML = html;
  }

  function navBtn(mod, content) {
    return `<button class="nav-btn" id="nav-${mod}" onclick="APP.showModule('${mod}')">${content}</button>`;
  }

  // ─── EMPRESA STRIP ───────────────────────────
  function renderEmpresaStrip(session) {
    const strip = document.getElementById('empresaStrip');
    if (!strip) return;

    const userEmpresas = session && session.empresas ? session.empresas : DATA.state.empresas;
    const visibles = DATA.state.empresas.filter(e => userEmpresas.includes(e));

    let html = visibles.map(emp => {
      const clr   = DATA.getEmpresaColor(emp);
      const all   = DATA.state.fallas.filter(f => f.empresa === emp).length;
      const isAct = DATA.state.viewMode === 'individual' && emp === DATA.state.currentEmpresa;
      return `<div class="empresa-tab${isAct ? ' active' : ''}"
        style="--empresa-color:${clr.hex};--empresa-r:${clr.r};--empresa-g:${clr.g};--empresa-b:${clr.b}"
        onclick="APP.changeEmpresa('${emp}')">
        <span class="empresa-tab-dot"></span>
        <span>${emp}</span>
        <span class="empresa-tab-count">${all}</span>
      </div>`;
    }).join('');

    strip.innerHTML = html;
  }

  // ─── HEADER ──────────────────────────────────
  function updateHeaderUser(session) {
    if (!session) return;
    const nombre = document.getElementById('userNombre');
    const role   = document.getElementById('userRole');
    const avatar = document.getElementById('userAvatar');
    if (nombre) nombre.textContent = session.nombre;
    if (role)   role.textContent = AUTH.ROLE_LABELS[session.role] || session.role;
    if (avatar) avatar.textContent = (session.nombre[0] || '?').toUpperCase();
  }

  function updateHeaderCounts() {
    const all  = DATA.getFilteredFallas();
    // "Pendientes" header = everything that is NOT a closing/atendido status (dynamic per company)
    const pend = all.filter(f => {
      const lista = DATA.getSel('estatus', f.empresa);
      const cierre = lista.find(e => /atendid/i.test(e)) || 'Atendido';
      return f.estatus !== cierre;
    }).length;
    // "En proceso" = match any estatus containing "proceso"
    const proc = all.filter(f => (f.estatus||'').toLowerCase().includes('proceso')).length;

    const elT = document.getElementById('hstatTotal');
    const elP = document.getElementById('hstatPend');
    const elPr= document.getElementById('hstatProc');
    if (elT)  elT.textContent  = all.length;
    if (elP)  elP.textContent  = pend;
    if (elPr) elPr.textContent = proc;

    // Nav badge: show total non-atendido
    const cntBadge = document.getElementById('cntPend');
    if (cntBadge) cntBadge.textContent = pend > 0 ? pend : '';
  }

  return {
    toast, updateClock, fmtDt, fmtDate, nowISO,
    badgeClass, rowClass, prioColor, empresaBadgeHTML, roleBadge, auditTypeColor,
    openModal, closeModal, forceCloseModal,
    showConfirm, showPrompt,
    buildMultiSelect,
    renderNav, renderEmpresaStrip, updateHeaderUser, updateHeaderCounts
  };
})();
