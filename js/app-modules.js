/* ═══════════════════════════════════════════════
   CCTV Fleet Control — Modules v6.0
   + Filtros multi-selección en todos los módulos
   + Tabla del dashboard reposicionada arriba
   + Atendidos: filtro por empresa (con modo general/individual)
   + Config: eliminación por módulo por empresa
   + Modales personalizados (sin alert/confirm/prompt nativos)
═══════════════════════════════════════════════ */

const MODS = (() => {

  let mainChart    = null;
  let catChart     = null;
  let techChart    = null;
  let provChart    = null;
  let chipState    = { piso: '', tipo: '', resultado: '' };
  let prioSel      = 'Media';
  let currentAtencion = null;

  // ─── Helper: detecta el estatus "atendido" dinámicamente por empresa ─────────
  // Cada empresa puede nombrar su estatus de cierre distinto (Atendidos, Atendido, Cerrado…)
  // Se busca el primer estatus que contenga "atendid" en la lista; fallback literal: 'Atendido'.
  function _getAtendidoLabel(empresa) {
    const emp = empresa || DATA.state.currentEmpresa;
    const lista = DATA.getSel('estatus', emp);
    return lista.find(e => /atendid/i.test(e)) || 'Atendido';
  }
  function _isAtendidoEst(estatus, empresa) {
    if (!estatus) return false;
    return estatus === _getAtendidoLabel(empresa);
  }

  
  // ─── Estado de filtros multi-select ──────────
  const mf = {
    dash: { empresas:[], bases:[], estados:[], prioridades:[], tipos:[], proveedores:[], tecnicos:[] },
    aten: { empresas:[], bases:[], tecnicos:[] },
  };

  // ══════════════════════════════════════════
  //  MÓDULO 1 — REGISTRO
  // ══════════════════════════════════════════
  function renderRegistro(session) {
    const canEdit = AUTH.can('addReports');
    const emp     = DATA.state.currentEmpresa;
    const folioPreview = DATA.generarFolio(emp, '____');

    return `
    <div id="mod-registro" class="module active">
      <div class="mod-header">
        <div class="mod-title-wrap">
          <h2 class="mod-title">Nuevo Registro</h2>
          <span class="mod-subtitle">Falla / Mantenimiento Preventivo · CCTV Terrestre</span>
        </div>
        <div class="mod-header-right">
          <div class="registro-mode-toggle">
            <button class="rmt-btn rmt-btn-active" id="rmt-manual" onclick="MODS.setRegistroMode('manual')">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Manual
            </button>
            ${canEdit ? `<button class="rmt-btn" id="rmt-bulk" onclick="MODS.setRegistroMode('bulk')">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              Carga Masiva
            </button>` : ''}
          </div>
          <span class="folio-preview" id="folioPreview">Folio: ${folioPreview}</span>
          ${canEdit ? `<button class="btn btn-ghost btn-sm" onclick="MODS.limpiarRegistro()">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 101.14-4.52"/></svg>
            Limpiar
          </button>` : ''}
        </div>
      </div>

      ${!canEdit ? '<div class="card" style="background:rgba(245,158,11,0.06);border-color:rgba(245,158,11,0.2)"><p style="color:var(--amber);font-size:12.5px">⚠ Solo lectura — No tienes permisos para crear registros</p></div>' : ''}

      <div class="card">
        <div class="card-hdr">
          <div class="card-icon card-icon-blue"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg></div>
          <span class="card-title">Datos de la Unidad</span>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label class="${canEdit ? 'required' : ''}" for="rUnidad">Número de Unidad</label>
            <input type="text" id="rUnidad" placeholder="Ej: 4521" ${!canEdit ? 'disabled' : ''} oninput="MODS.updateFolioPreview()">
          </div>
          <div class="form-group">
            <label class="${canEdit ? 'required' : ''}" for="rBase">Base Operativa</label>
            <div class="select-wrap">
              <select id="rBase" ${!canEdit ? 'disabled' : ''} onchange="MODS.onBaseChangeRegistro()">
                <option value="">— Seleccionar —</option>
                ${DATA.getSel('base').map(b => `<option>${b}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="${canEdit ? 'required' : ''}" for="rServicio">Tipo de Servicio</label>
            <div class="select-wrap">
              <select id="rServicio" ${!canEdit ? 'disabled' : ''}>
                <option value="">— Seleccionar —</option>
                ${DATA.getSel('servicio').map(s => `<option>${s}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label for="rProveedor">Proveedor del Equipo</label>
            <div class="select-wrap">
              <select id="rProveedor" ${!canEdit ? 'disabled' : ''}>
                <option value="">— Seleccionar —</option>
                ${DATA.getSel('proveedor').map(p => `<option>${p}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="${canEdit ? 'required' : ''}" for="rFecha">Fecha y Hora</label>
            <input type="datetime-local" id="rFecha" value="${UI.nowISO()}" ${!canEdit ? 'disabled' : ''}>
          </div>
          <div class="form-group">
            <label for="rTecnico">Técnico Asignado</label>
            <select id="rTecnicoSel" ${!canEdit ? 'disabled' : ''} onchange="MODS.onTecnicoSelChange()" style="width:100%;margin-bottom:5px">
              <option value="">— Seleccionar base primero —</option>
            </select>
            <input type="text" id="rTecnico" placeholder="Nombre del técnico (Otro)" ${!canEdit ? 'disabled' : ''} style="display:none">
          </div>
          <div class="form-group">
            <label for="rPrioridad">Prioridad</label>
            <div class="chip-row" id="prioChips">
              ${['Alta','Media','Baja'].map(p => `<div class="chip${p==='Media'?' active':''}" onclick="MODS.selPrio('${p}')" style="--chip-r:${p==='Alta'?'239':p==='Media'?'245':'34'};--chip-g:${p==='Alta'?'68':p==='Media'?'158':'197'};--chip-b:${p==='Alta'?'68':p==='Media'?'11':'94'}">${p}</div>`).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-hdr">
          <div class="card-icon card-icon-amber"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
          <span class="card-title">Tipo de Incidencia</span>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label>Piso</label>
            <div class="chip-row" id="pisoChips">
              ${(DATA.getSel('piso') || []).map(p => `<div class="chip" onclick="MODS.selChip('piso','${p}',this)">${p}</div>`).join('')}
            </div>
          </div>
          <div class="form-group">
            <label>Tipo</label>
            <div class="chip-row" id="tipoChips">
              ${DATA.getSel('tipo').map(t => `<div class="chip" onclick="MODS.selChip('tipo','${t}',this)">${t}</div>`).join('')}
            </div>
          </div>
          <div class="form-group">
            <label class="${canEdit ? 'required' : ''}" for="rCategoria">Categoría</label>
            <div class="select-wrap">
              <select id="rCategoria" ${!canEdit ? 'disabled' : ''} onchange="MODS.onCategoriaChange()">
                <option value="">— Seleccionar —</option>
                ${DATA.getSel('categoria').map(c => `<option>${c}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label for="rComponente">Componente</label>
            <div class="select-wrap">
              <select id="rComponente" ${!canEdit ? 'disabled' : ''}>
                <option value="">— Seleccionar categoría —</option>
              </select>
            </div>
          </div>
          <div class="form-group col-2">
            <label for="rDesc">Descripción de la Falla</label>
            <textarea id="rDesc" placeholder="Describe el problema o trabajo a realizar..." ${!canEdit ? 'disabled' : ''}></textarea>
          </div>
        </div>
      </div>

      ${canEdit ? `
      <div style="display:flex;justify-content:flex-end;gap:10px">
        <button class="btn btn-secondary btn-lg" onclick="MODS.limpiarRegistro()">Limpiar</button>
        <button class="btn btn-primary btn-lg" onclick="MODS.guardarRegistro()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Guardar Registro
        </button>
      </div>` : ''}
    </div>`;
  }

  function updateFolioPreview() {
    const unidad = document.getElementById('rUnidad');
    const el     = document.getElementById('folioPreview');
    if (!el) return;
    el.textContent = 'Folio: ' + DATA.generarFolio(DATA.state.currentEmpresa, unidad ? unidad.value || '____' : '____');
  }

  function selChip(key, val, el) {
    chipState[key] = val;
    const row = el.closest('.chip-row');
    if (row) row.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === el));
  }

  function selPrio(val) {
    prioSel = val;
    document.querySelectorAll('#prioChips .chip').forEach(c => {
      c.classList.toggle('active', c.textContent.trim() === val);
    });
  }

  function onCategoriaChange() {
    const cat  = document.getElementById('rCategoria');
    const comp = document.getElementById('rComponente');
    if (!cat || !comp) return;
    const opts = DATA.getComponentes(cat.value);
    comp.innerHTML = '<option value="">— Seleccionar —</option>'
      + opts.map(o => `<option>${o}</option>`).join('');
  }

  function onBaseChangeRegistro() {
    // Implemented via app-modules-patch.js (reads real users)
    const base = document.getElementById('rBase')?.value;
    const emp  = DATA.state.currentEmpresa;
    const sel  = document.getElementById('rTecnicoSel');
    const hint = document.getElementById('rTecnicoHint');
    if (!sel) return;
    const tecnicos = DATA.getTecnicosPorBase(emp, base);
    let opts = '<option value="">— Seleccionar técnico —</option>';
    if (tecnicos.length > 0) {
      opts += tecnicos.map(t => {
        const label = t.base ? `${t.nombre} (${t.base})` : t.nombre;
        return `<option value="${t.nombre}" data-username="${t.username || t.nombre}">${label}</option>`;
      }).join('');
    }
    opts += '<option value="__otro__">Otro (escribir manualmente)</option>';
    sel.innerHTML = opts;
    if (hint) {
      if (!base) {
        hint.textContent = 'Selecciona una base para ver los técnicos disponibles';
        hint.style.color = 'var(--text3)';
      } else if (tecnicos.length === 0) {
        hint.textContent = `Sin técnicos en ${base} / ${emp}. Usa "Otro" o crea usuarios técnicos.`;
        hint.style.color = 'var(--amber)';
      } else {
        hint.textContent = `${tecnicos.length} técnico(s) en ${base} (${emp})`;
        hint.style.color = 'var(--text3)';
      }
    }
    const inp = document.getElementById('rTecnico');
    if (inp) inp.style.display = 'none';
  }

  function onTecnicoSelChange() {
    const sel = document.getElementById('rTecnicoSel');
    const inp = document.getElementById('rTecnico');
    if (!sel || !inp) return;
    inp.style.display = sel.value === '__otro__' ? '' : 'none';
    if (sel.value === '__otro__') inp.focus();
  }

  function getRegistroTecnicoValue() {
    const sel = document.getElementById('rTecnicoSel');
    const inp = document.getElementById('rTecnico');
    if (!sel) return inp ? inp.value.trim() : '';
    if (sel.value === '__otro__' || sel.value === '') return inp ? inp.value.trim() : '';
    return sel.value;
  }

  function limpiarRegistro() {
    // Reset tech select
    const tecSel = document.getElementById('rTecnicoSel');
    if (tecSel) { tecSel.innerHTML = '<option value="">— Selecciona base primero —</option>'; }
    const tecHint = document.getElementById('rTecnicoHint');
    if (tecHint) { tecHint.textContent = 'Selecciona una base para ver los técnicos disponibles'; tecHint.style.color = 'var(--text3)'; }
    ['rUnidad','rTecnico','rDesc'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    ['rBase','rServicio','rCategoria','rComponente','rProveedor'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.selectedIndex = 0;
    });
    const rc = document.getElementById('rComponente');
    if (rc) rc.innerHTML = '<option value="">— Seleccionar categoría —</option>';
    document.getElementById('rFecha').value = UI.nowISO();
    chipState = { piso: '', tipo: '', resultado: '' };
    prioSel = 'Media';
    document.querySelectorAll('.chip-row .chip').forEach(c => c.classList.remove('active'));
    selPrio('Media');
    updateFolioPreview();
  }

  async function guardarRegistro() {
    const unidad = document.getElementById('rUnidad')?.value.trim();
    const base   = document.getElementById('rBase')?.value;
    const svc    = document.getElementById('rServicio')?.value;
    const fecha  = document.getElementById('rFecha')?.value;
    const cat    = document.getElementById('rCategoria')?.value;

    const errors = [];
    if (!unidad) errors.push('Número de Unidad');
    if (!base)   errors.push('Base Operativa');
    if (!svc)    errors.push('Tipo de Servicio');
    if (!fecha)  errors.push('Fecha y Hora');
    if (!cat)    errors.push('Categoría');

    if (errors.length) {
      UI.toast('Campos requeridos: ' + errors.join(', '), 'err');
      return;
    }

    let nuevo;
    try {
      const _tecSel = document.getElementById('rTecnicoSel');
      const _tecUsername = (_tecSel && _tecSel.value && _tecSel.value !== '__otro__')
        ? (_tecSel.options[_tecSel.selectedIndex]?.dataset?.username || '')
        : '';
      nuevo = await DATA.crearReporte({
      unidad,
      base,
      servicio:        svc,
      fecha,
      piso:            chipState.piso,
      tipo:            chipState.tipo,
      categoria:       cat,
      componente:      document.getElementById('rComponente')?.value,
      proveedor:       document.getElementById('rProveedor')?.value,
      descripcion:     document.getElementById('rDesc')?.value.trim(),
      prioridad:       prioSel || 'Media',
      tecnico:         MODS.getRegistroTecnicoValue(),
      tecnicoUsername: _tecUsername,
      });
    } catch (error) {
      UI.toast(error.message || 'No se pudo registrar el reporte', 'err');
      return;
    }

    UI.toast(`Reporte ${nuevo.folio} registrado`);
    limpiarRegistro();
    UI.updateHeaderCounts();
  }

  // ══════════════════════════════════════════
  //  MÓDULO 2 — ATENCIÓN
  // ══════════════════════════════════════════
  function renderAtencion(session) {
    const fallas  = DATA.getFilteredFallas();
    // Estatus que NO deben aparecer en Pendientes·En Proceso (son de cierre/especiales)
    const ESTATUS_EXCLUIR_PEND = /atendid|vandaliz|venta|sin sim|sin operac|renta|en operaci/i;
    const pend    = fallas.filter(f => {
      if (!f.estatus) return true; // sin estatus = pendiente
      if (_isAtendidoEst(f.estatus, f.empresa)) return false;
      if (ESTATUS_EXCLUIR_PEND.test(f.estatus)) return false;
      return true;
    });
    const aten    = fallas.filter(f => _isAtendidoEst(f.estatus, f.empresa));
    const canEdit = AUTH.can('changeStatus') || AUTH.can('editReports');

    return `
    <div id="mod-atencion" class="module active">
      <div class="mod-header">
        <div class="mod-title-wrap">
          <h2 class="mod-title">Atención Técnica</h2>
          <span class="mod-subtitle">${DATA.state.viewMode === 'general' ? 'Vista general · Todas las empresas' : DATA.state.currentEmpresa + ' · Reportes activos'}</span>
        </div>
        <div class="mod-header-right">
          <span style="font-family:var(--mono);font-size:11px;color:var(--red);background:var(--red-bg);border:1px solid rgba(239,68,68,0.2);border-radius:6px;padding:3px 10px">${pend.length} pendientes</span>
          <span style="font-family:var(--mono);font-size:11px;color:var(--green);background:var(--green-bg);border:1px solid rgba(34,197,94,0.2);border-radius:6px;padding:3px 10px">${aten.length} atendidos</span>
        </div>
      </div>

      <div class="aten-panels">
        <div class="card">
          <div class="card-hdr">
            <div class="card-icon card-icon-red"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
            <span class="card-title">Pendientes · En Proceso</span>
            <span class="nav-badge" style="margin-left:auto">${pend.length}</span>
          </div>
          <div class="aten-list" id="listaAtenPend">
            ${pend.length === 0
              ? '<div class="empty-state"><span class="empty-icon">✓</span><p class="empty-msg">Sin pendientes</p><p class="empty-sub">Todos los reportes han sido atendidos</p></div>'
              : pend.map(f => atenCard(f, canEdit)).join('')}
          </div>
        </div>

        <div class="card">
          <div class="card-hdr">
            <div class="card-icon card-icon-green"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></div>
            <span class="card-title">Atendidos</span>
            <span style="font-family:var(--mono);font-size:11px;color:var(--green);margin-left:auto">${aten.length}</span>
          </div>
          <div class="aten-list" id="listaAtenOk">
            ${aten.length === 0
              ? '<div class="empty-state"><span class="empty-icon">📋</span><p class="empty-msg">Sin reportes atendidos</p></div>'
              : aten.slice(0, 50).map(f => atenCard(f, canEdit)).join('')}
          </div>
        </div>
      </div>

      <div id="atenDetailPanel"></div>
    </div>`;
  }

  function atenCard(f, canEdit) {
    const prio   = f.prioridad || 'Media';
    const pcolor = UI.prioColor(prio);
    const bClass = UI.badgeClass(f.estatus);
    return `<div class="aten-card" onclick="MODS.selAtencion('${f.id}')" style="--prio-color:${pcolor}">
      <div class="aten-card-main">
        <div class="aten-card-title">
          <span style="font-family:var(--mono);font-weight:700;color:var(--text)">Ud. ${f.unidad}</span>
          ${UI.empresaBadgeHTML(f.empresa)}
          <span class="badge ${bClass}">${f.estatus}</span>
        </div>
        <div class="aten-card-sub">
          <span>${f.categoria} · ${f.componente || '—'}${f.proveedor ? ' · <span style="color:var(--cyan)">'+f.proveedor+'</span>' : ''}</span>
        </div>
        <div class="aten-card-meta">
          ${f.folio} · ${UI.fmtDt(f.fecha)} · ${f.base || '—'}
          ${f.tecnico ? ' · <strong>' + f.tecnico + '</strong>' : ''}
          ${f.fechaAtencion ? ' · <span style="color:var(--green);font-size:10px">✓ ' + UI.fmtDt(f.fechaAtencion) + '</span>' : ''}
        </div>
      </div>
      <div class="aten-card-actions">
        <span style="color:${pcolor};font-size:10px;font-weight:700;font-family:var(--mono)">${prio}</span>
      </div>
    </div>`;
  }

  function selAtencion(id) {
    currentAtencion = id;
    window._currentAtencion = id;
    const f = DATA.state.fallas.find(x => x.id === id);
    if (!f) return;

    const canEdit     = AUTH.can('changeStatus') || AUTH.can('editReports');
    const estatusList = DATA.getSel('estatus', f.empresa);
    const panel       = document.getElementById('atenDetailPanel');

    panel.innerHTML = `
    <div class="aten-detail-panel" data-reporte-id="${id}">
      <div class="aten-detail-hdr">
        <div class="aten-detail-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Detalle — Unidad ${f.unidad} · ${f.folio}
          <span class="badge ${UI.badgeClass(f.estatus)}">${f.estatus}</span>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('atenDetailPanel').innerHTML=''">✕ Cerrar</button>
      </div>

      <div class="aten-split">
        <div class="aten-preview-col">
          <p class="preview-title">Datos del Reporte</p>
          <div>
            ${previewRow('Folio',        `<span style="font-family:var(--mono)">${f.folio}</span>`)}
            ${previewRow('Empresa',      UI.empresaBadgeHTML(f.empresa))}
            ${previewRow('Unidad',       f.unidad)}
            ${previewRow('Base',         f.base || '—')}
            ${previewRow('Servicio',     f.servicio || '—')}
            ${previewRow('Tipo',         f.tipo || '—')}
            ${previewRow('Proveedor',    f.proveedor ? `<span style="color:var(--cyan)">${f.proveedor}</span>` : '—')}
            ${previewRow('Categoría',    f.categoria || '—')}
            ${previewRow('Componente',   f.componente || '—')}
            ${previewRow('Prioridad',    `<span style="color:${UI.prioColor(f.prioridad)};font-weight:700">${f.prioridad || '—'}</span>`)}
            ${previewRow('Descripción',  f.descripcion || '—')}
            ${previewRow('Técnico',      f.tecnico || 'Sin asignar')}
            ${previewRow('Fecha',        UI.fmtDt(f.fecha))}
            ${previewRow('Registrado',   UI.fmtDt(f.createdAt))}
            ${f.fechaAtencion ? previewRow('Fecha Atención', `<span style="color:var(--green)">${UI.fmtDt(f.fechaAtencion)}</span>`) : ''}
          </div>

          ${f.historial && f.historial.length ? `
          <p class="preview-title" style="margin-top:16px">Historial</p>
          <div class="audit-timeline" style="max-height:180px;overflow-y:auto">
            ${[...f.historial].map(h => `
            <div class="audit-item" style="padding:8px 0">
              <div class="audit-dot" style="background:var(--accent)"></div>
              <div class="audit-body">
                <div class="audit-tipo" style="color:var(--accent);font-size:10px">${h.accion}</div>
                <div class="audit-det">${h.detalle}</div>
                <div class="audit-meta"><span>${h.usuario}</span><span>·</span><span>${UI.fmtDt(h.fecha)}</span></div>
              </div>
            </div>`).join('')}
          </div>` : ''}
        </div>

        <div class="aten-form-col">
          <p class="preview-title">Actualización</p>
          ${canEdit ? `
          <div style="display:flex;flex-direction:column;gap:12px">
            <div class="form-group">
              <label>Estatus</label>
              <div class="select-wrap">
                <select id="atenEstatus" onchange="MODS.onAtenEstatusChange()">
                  ${estatusList.map(e => `<option${e===f.estatus?' selected':''}>${e}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="form-group" id="atenFechaWrap" style="${_isAtendidoEst(f.estatus, f.empresa)?'':'display:none'}">
              <label>Fecha de Atención</label>
              <div style="font-family:var(--mono);font-size:12px;color:var(--green);padding:8px;background:var(--green-bg);border-radius:var(--r);border:1px solid rgba(34,197,94,0.2)" id="atenFechaDisplay">
                ${f.fechaAtencion ? UI.fmtDt(f.fechaAtencion) : 'Se registrará al guardar'}
              </div>
            </div>
            <div class="form-group">
              <label>Técnico Asignado</label>
              <div class="select-wrap">
                <select id="atenTecnico">
                  ${(() => {
                    const emp = f.empresa || DATA.state.currentEmpresa;
                    // Mostrar TODOS los técnicos de la empresa, sin filtrar por base
                    // para que el admin pueda ver y seleccionar a técnicos de apoyo
                    const todosLosTecs = DATA.getTecnicosPorBase(emp, '');
                    let opts = '<option value="">— Sin asignar —</option>';

                    // Técnicos de la misma base primero
                    const tecsBase   = todosLosTecs.filter(t => t.base === f.base);
                    const tecsOtros  = todosLosTecs.filter(t => t.base !== f.base);

                    if (tecsBase.length) opts += `<optgroup label="Técnicos base ${f.base || 'del reporte'}">`;
                    tecsBase.forEach(t => {
                      const label = t.nombre + (t.base ? ` (${t.base})` : '');
                      const sel = (f.tecnico === t.nombre) ? ' selected' : '';
                      opts += `<option value="${t.nombre}" data-username="${t.username || t.nombre}"${sel}>${label}</option>`;
                    });
                    if (tecsBase.length) opts += '</optgroup>';

                    if (tecsOtros.length) opts += `<optgroup label="Técnicos de otras bases">`;
                    tecsOtros.forEach(t => {
                      const label = t.nombre + (t.base ? ` (${t.base})` : '');
                      // Marcar al técnico de apoyo si ya atendió
                      const esApoyo = f.tecnicoApoyoNombre === t.nombre;
                      const sel = (f.tecnico === t.nombre || esApoyo) ? ' selected' : '';
                      const sufijo = esApoyo ? ' ⚡apoyo' : '';
                      opts += `<option value="${t.nombre}" data-username="${t.username || t.nombre}"${sel}>${label}${sufijo}</option>`;
                    });
                    if (tecsOtros.length) opts += '</optgroup>';

                    // Si el técnico actual no está en la lista, agregarlo
                    if (f.tecnico && !todosLosTecs.find(t => t.nombre === f.tecnico)) {
                      opts += `<option value="${f.tecnico}" data-username="${f.tecnicoUsername || f.tecnico}" selected>${f.tecnico}</option>`;
                    }
                    return opts;
                  })()}
                </select>
              </div>
              ${f.esApoyo && f.tecnicoApoyoNombre ? `
              <div style="font-size:11px;color:#f59e0b;margin-top:4px;padding:4px 8px;background:rgba(245,158,11,0.08);border-radius:4px;border-left:2px solid #f59e0b">
                ⚡ Atendido por apoyo: <strong>${f.tecnicoApoyoNombre}</strong> (base ${DATA.getTecnicosPorBase(f.empresa||'','').find(t=>t.nombre===f.tecnicoApoyoNombre)?.base || '—'})
              </div>` : ''}
              <div style="font-size:11px;color:var(--text3);margin-top:4px" id="atenTecnicoHint">Técnicos de la base ${f.base || '—'} (${f.empresa || ''})</div>
            </div>
            <div class="form-group">
              <label>Resultado / Notas</label>
              <textarea id="atenResultado" placeholder="Describir acción tomada...">${f.resultado || ''}</textarea>
            </div>
            <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">
              ${AUTH.can('manageUsers') ? `<button class="btn btn-danger btn-sm" onclick="MODS.eliminarAtencion('${f.id}')" title="Eliminar ticket">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                Eliminar
              </button>` : ''}
              <button class="btn btn-primary" onclick="MODS.guardarAtencion()">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Guardar Cambios
              </button>
            </div>
          </div>
          ` : '<p style="color:var(--text3);font-size:12.5px">Solo lectura — Sin permisos de edición</p>'}
        </div>
      </div>
    </div>`;

    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function eliminarAtencion(id) {
    if (!AUTH.can('manageUsers')) { UI.toast('Sin permisos para eliminar', 'err'); return; }
    const f = DATA.state.fallas.find(x => x.id === id);
    if (!f) return;
    const ok = await UI.showConfirm({
      title: 'Eliminar Ticket',
      message: `¿Eliminar el ticket <strong>${f.folio}</strong>? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      danger: true
    });
    if (!ok) return;
    try {
      await DATA.eliminarReporte(id);
    } catch (error) {
      UI.toast(error.message || 'No se pudo eliminar el ticket', 'err');
      return;
    }
    UI.toast(`Ticket ${f.folio} eliminado`);
    UI.updateHeaderCounts();
    await APP.showModule('atencion');
  }

  function onAtenEstatusChange() {
    const sel  = document.getElementById('atenEstatus')?.value;
    const wrap = document.getElementById('atenFechaWrap');
    if (wrap) wrap.style.display = _isAtendidoEst(sel, null) ? '' : 'none';
  }

  async function guardarAtencion() {
    if (!currentAtencion) return;
    const estatus   = document.getElementById('atenEstatus')?.value;
    const _atenSel  = document.getElementById('atenTecnico');
    const tecnico   = _atenSel ? (_atenSel.value || '').trim() : '';
    const tecnicoUsername = _atenSel && _atenSel.options && _atenSel.selectedIndex >= 0
      ? (_atenSel.options[_atenSel.selectedIndex]?.dataset?.username || tecnico)
      : tecnico;
    const resultado = document.getElementById('atenResultado')?.value.trim();

    try {
      await DATA.actualizarReporte(currentAtencion, { estatus, tecnico, tecnicoUsername, resultado });
    } catch (error) {
      UI.toast(error.message || 'No se pudo actualizar el reporte', 'err');
      return;
    }
    UI.toast('Reporte actualizado');
    UI.updateHeaderCounts();
    await APP.showModule('atencion');
  }

  function previewRow(key, val) {
    return `<div class="preview-row">
      <span class="preview-key">${key}</span>
      <span class="preview-val">${val}</span>
    </div>`;
  }

  // ══════════════════════════════════════════
  //  MÓDULO 3 — DASHBOARD
  //  Tabla reposicionada ARRIBA de los gráficos
  // ══════════════════════════════════════════
  function renderDashboard(session) {
    const session2 = AUTH.checkSession();
    const allEmps = (session2 && session2.empresas) ? session2.empresas : DATA.state.empresas;
    const empOpts = allEmps.map(e => { const clr = DATA.getEmpresaColor(e); return { value: e, label: e, color: clr.hex }; });
    const baseOpts   = [...new Set(DATA.state.fallas.map(f=>f.base).filter(Boolean))].map(b => ({ value:b, label:b }));
    const tecOpts    = [...new Set(DATA.state.fallas.map(f=>f.tecnico).filter(Boolean))].map(t => ({ value:t, label:t }));
    const _liveProv = DATA.getSel('proveedor', DATA.state.currentEmpresa).length ? DATA.getSel('proveedor', DATA.state.currentEmpresa) : DATA.PROVEEDORES_DEFAULT;
    const provOpts = _liveProv.map(p => ({ value:p, label:p }));

    const msEmp  = UI.buildMultiSelect({ id:'dbMsEmp',  options: empOpts,              selected: mf.dash.empresas,    placeholder:'Todas las empresas',    onChange: v => { mf.dash.empresas=v; renderDashTable(); }, colorDot: true });
    const msBase = UI.buildMultiSelect({ id:'dbMsBase', options: baseOpts,             selected: mf.dash.bases,       placeholder:'Todas las bases',       onChange: v => { mf.dash.bases=v; renderDashTable(); } });
    const _liveEstatus = DATA.getSel('estatus', DATA.state.currentEmpresa).length ? DATA.getSel('estatus', DATA.state.currentEmpresa) : DATA.ESTATUS_DEFAULT;
    const msStat = UI.buildMultiSelect({ id:'dbMsStat', options: _liveEstatus.map(e=>({value:e,label:e})), selected: mf.dash.estados, placeholder:'Todos los estados', onChange: v => { mf.dash.estados=v; renderDashTable(); } });
    const msPrio = UI.buildMultiSelect({ id:'dbMsPrio', options:['Alta','Media','Baja'],selected: mf.dash.prioridades, placeholder:'Todas las prioridades', onChange: v => { mf.dash.prioridades=v; renderDashTable(); } });
    const msTipo = UI.buildMultiSelect({ id:'dbMsTipo', options: DATA.TIPOS_DEFAULT,   selected: mf.dash.tipos,       placeholder:'Todos los tipos',       onChange: v => { mf.dash.tipos=v; renderDashTable(); } });
    const msProv = UI.buildMultiSelect({ id:'dbMsProv', options: provOpts,             selected: mf.dash.proveedores, placeholder:'Todos los proveedores', onChange: v => { mf.dash.proveedores=v; renderDashTable(); } });
    const msTec  = UI.buildMultiSelect({ id:'dbMsTec',  options: tecOpts,              selected: mf.dash.tecnicos,    placeholder:'Todos los técnicos',    onChange: v => { mf.dash.tecnicos=v; renderDashTable(); } });

    return `
    <div id="mod-dashboard" class="module active">
      <div class="mod-header">
        <div class="mod-title-wrap">
          <h2 class="mod-title">Dashboard & Control</h2>
          <span class="mod-subtitle" id="dbScopeLabel">Vista operativa general</span>
        </div>
        <div class="mod-header-right" style="gap:8px">
          <select class="filter-select" id="dbPeriodo" onchange="MODS.initDashboard()" style="font-size:11px">
            <option value="">Todo el tiempo</option>
            <option value="day">Hoy</option>
            <option value="week">Esta semana</option>
            <option value="month">Este mes</option>
            <option value="year">Este año</option>
          </select>
          <button class="btn btn-ghost btn-sm" onclick="MODS.exportCSV()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Exportar CSV
          </button>
        </div>
      </div>

      <!-- KPIs -->
      <div class="kpi-grid" id="kpiGrid"></div>

      <!-- TABLA PRINCIPAL (ahora ARRIBA de los gráficos) -->
      <div class="card" style="margin-bottom:16px">
        <div class="card-hdr card-hdr-between">
          <div style="display:flex;align-items:center;gap:8px">
            <div class="card-icon card-icon-blue"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v11m0 0H5m4 0h10M9 14v5m0 0H5a2 2 0 01-2-2v-3m4 5h10a2 2 0 002-2v-3"/></svg></div>
            <span class="card-title">Control General — Registros</span>
            <span class="db-count-badge" id="dbCount"></span>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="MODS.clearFilters()">Limpiar filtros</button>
        </div>

        <!-- Filtros multi-select -->
        <div style="padding:10px 14px 14px;border-bottom:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">
            <input type="text" id="dbSearch" class="filter-input filter-search" placeholder="🔍 Buscar unidad, folio..." oninput="MODS.renderDashTable()" style="flex:1;min-width:180px">
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px" id="dbMsWrapper">
            <div><div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Empresa</div>${msEmp.html}</div>
            <div><div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Base</div>${msBase.html}</div>
            <div><div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Estado</div>${msStat.html}</div>
            <div><div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Prioridad</div>${msPrio.html}</div>
            <div><div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Tipo</div>${msTipo.html}</div>
            <div><div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Proveedor</div>${msProv.html}</div>
            <div><div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Técnico</div>${msTec.html}</div>
          </div>
        </div>

        <div class="table-wrap" style="max-height:420px;overflow-y:auto;overflow-x:auto">
          <table class="data-table">
            <thead><tr>
              <th>Folio</th><th>Unidad</th><th>Empresa</th><th>Base</th>
              <th>Servicio</th><th>Tipo</th><th>Proveedor</th><th>Categoría</th><th>Componente</th>
              <th>Prioridad</th><th>Fecha</th><th>Técnico</th><th>Estatus</th>
              <th>F. Atención</th><th>Resultado</th>${AUTH.can('changeStatus') ? '<th>Acciones</th>' : ''}
            </tr></thead>
            <tbody id="dbTbody"></tbody>
          </table>
        </div>
      </div>

      <!-- ══ SALUD OPERATIVA BANNER ══ -->
      <div class="so-banner" id="soBanner">
        <div class="so-kpi so-kpi-operativo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="so-icon"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          <div>
            <div class="so-big" id="soOpPct">—%</div>
            <div class="so-lbl2">OPERATIVO</div>
            <div class="so-sub2" id="soOpSub">— de — unidades</div>
          </div>
        </div>
        <div class="so-kpi so-kpi-atencion">
          <canvas id="soGaugeCanvas" width="80" height="80" style="flex-shrink:0"></canvas>
          <div>
            <div class="so-big so-amber" id="soAtPct">—%</div>
            <div class="so-lbl2">REQUIERE ATENCIÓN</div>
            <div class="so-sub2" id="soAtSub">— de — unidades</div>
          </div>
        </div>
        <div class="so-msg" id="soMsg"></div>
      </div>

      <!-- ══ GRÁFICAS ROW 1 ══ -->
      <div class="charts-row">
        <!-- Barras estatus -->
        <div class="card chart-card-main">
          <div class="card-hdr">
            <div class="card-icon card-icon-blue"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></div>
            <span class="card-title">Estado Operativo por Estatus</span>
          </div>
          <div class="chart-wrap"><canvas id="mainChart"></canvas></div>
          <div id="chartLegend" class="chart-legend"></div>
        </div>
        <!-- Side: donut general + empresa -->
        <div class="charts-side">
          <div class="card">
            <div class="card-hdr">
              <div class="card-icon card-icon-blue"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 2v10l7 3"/></svg></div>
              <span class="card-title">General Operativo</span>
            </div>
            <div class="go-wrap">
              <div class="go-donut-area">
                <canvas id="goDonutChart" width="160" height="160"></canvas>
                <div class="go-donut-center" id="goDonutCenter"><span class="go-total-num" id="goTotalNum">—</span><span class="go-total-lbl">TOTAL<br>UNIDADES</span></div>
              </div>
              <div class="go-legend" id="goLegend"></div>
            </div>
          </div>
          <div class="card">
            <div class="card-hdr">
              <div class="card-icon card-icon-green"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
              <span class="card-title">Por Empresa</span>
            </div>
            <div id="empresaBars" class="empresa-bars" style="padding:10px 14px"></div>
          </div>
        </div>
      </div>

      <!-- ══ GRÁFICAS ROW 2 ══ -->
      <div class="charts-row">
        <div class="card" style="flex:1;min-width:0">
          <div class="card-hdr" style="flex-wrap:wrap;gap:6px">
            <div class="card-icon card-icon-purple"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div>
            <span class="card-title">Productividad por Técnico</span>
            <div style="margin-left:auto;display:flex;gap:4px;align-items:center;flex-wrap:wrap">
              <select id="techBaseSelect" onchange="MODS.setTechBase(this.value)" style="font-size:10px;padding:2px 6px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text2);height:24px;cursor:pointer">
                <option value="">Todas las bases</option>
              </select>
              <button id="techModeBase" onclick="MODS.setTechMode('base')" class="btn btn-sm btn-primary" style="font-size:10px;padding:2px 8px">BASE</button>
              <button id="techModeVs" onclick="MODS.setTechMode('vs')" class="btn btn-sm btn-ghost" style="font-size:10px;padding:2px 8px">VS BASES</button>
            </div>
          </div>
          <div id="techChartWrap" class="chart-wrap" style="height:220px"><canvas id="techChart"></canvas></div>
          <div id="techResumenCards" style="margin-top:8px"></div>
        </div>
        <div class="card" style="flex:1">
          <div class="card-hdr">
            <div class="card-icon card-icon-cyan" style="background:var(--cyan-bg);border-color:rgba(6,182,212,0.2);color:var(--cyan)"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg></div>
            <span class="card-title">Reportes por Proveedor</span>
          </div>
          <div class="chart-wrap" style="height:220px"><canvas id="provChart"></canvas></div>
        </div>
      </div>

      <!-- ══ SALUD OPERATIVA GAUGE CARD ══ -->
      <div class="so-health-card" id="soHealthCard">
        <div class="card-hdr">
          <div class="card-icon" style="background:rgba(34,197,94,0.1);border-color:rgba(34,197,94,0.2);color:#22c55e">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <span class="card-title">Salud Operativa</span>
        </div>
        <div class="so-gauge-area">
          <canvas id="soHealthGauge" width="220" height="130"></canvas>
          <div class="so-gauge-label">
            <div class="so-big so-green" id="soHealthPct">—%</div>
            <div class="so-lbl2">OPERATIVO</div>
            <div class="so-sub2" id="soHealthSub">— de — unidades</div>
          </div>
        </div>
        <p class="so-health-msg" id="soHealthMsg"></p>
      </div>
    </div>`;
  }

  function initDashboard() {
    buildKPIs();
    buildCharts();

    // Attach multiselect events after render
    ['dbMsEmp','dbMsBase','dbMsStat','dbMsPrio','dbMsTipo','dbMsProv','dbMsTec'].forEach(id => {
      const wrapper = document.getElementById(id + '_ms');
      if (wrapper) {
        // Re-attach by rebuilding triggers (events are inline via closures stored in buildMultiSelect)
      }
    });

    renderDashTable();

    // Attach multi-select events
    setTimeout(() => {
      attachMultiSelectEvents('dbMsEmp',  v => { mf.dash.empresas=v; renderDashTable(); });
      attachMultiSelectEvents('dbMsBase', v => { mf.dash.bases=v; renderDashTable(); });
      attachMultiSelectEvents('dbMsStat', v => { mf.dash.estados=v; renderDashTable(); });
      attachMultiSelectEvents('dbMsPrio', v => { mf.dash.prioridades=v; renderDashTable(); });
      attachMultiSelectEvents('dbMsTipo', v => { mf.dash.tipos=v; renderDashTable(); });
      attachMultiSelectEvents('dbMsProv', v => { mf.dash.proveedores=v; renderDashTable(); });
      attachMultiSelectEvents('dbMsTec',  v => { mf.dash.tecnicos=v; renderDashTable(); });
    }, 0);
  }

  // Helper to wire up multiselect events (already rendered HTML)
  function attachMultiSelectEvents(id, onChange) {
    const containerId = id + '_ms';
    const container   = document.getElementById(containerId);
    if (!container) return;

    const dropdown = document.getElementById(id + '_dropdown');
    const trigger  = document.getElementById(id + '_trigger');
    const chipsEl  = document.getElementById(id + '_chips');
    const clearBtn = document.getElementById(id + '_clearBtn');
    if (!dropdown || !trigger) return;

    let currentSelected = [...(container.querySelectorAll('.ms-option.ms-selected'))].map(o => o.dataset.val);

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.style.display !== 'none';
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

        const check = opt.querySelector('div');
        const isSel = currentSelected.includes(val);
        opt.classList.toggle('ms-selected', isSel);
        opt.style.background = isSel ? 'rgba(79,142,247,0.1)' : '';
        if (check) {
          check.style.borderColor = isSel ? 'var(--accent)' : 'var(--border2)';
          check.style.background  = isSel ? 'var(--accent)' : 'transparent';
          check.innerHTML = isSel ? '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : '';
        }

        // Update chips label
        if (chipsEl) {
          if (!currentSelected.length) {
            const placeholder = trigger.querySelector('.ms-trigger > span')?.textContent || '';
            chipsEl.innerHTML = `<span style="color:var(--text3);font-size:12px">${placeholder}</span>`;
          } else {
            chipsEl.innerHTML = currentSelected.map(v =>
              `<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(79,142,247,0.12);color:var(--accent);border:1px solid rgba(79,142,247,0.25);border-radius:4px;padding:1px 6px;font-size:11px;white-space:nowrap">${v}</span>`
            ).join('');
          }
        }
        onChange([...currentSelected]);
      });
    });

    clearBtn && clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      currentSelected = [];
      container.querySelectorAll('.ms-option').forEach(opt => {
        opt.classList.remove('ms-selected');
        opt.style.background = '';
        const check = opt.querySelector('div');
        if (check) { check.style.borderColor='var(--border2)'; check.style.background='transparent'; check.innerHTML=''; }
      });
      if (chipsEl) chipsEl.innerHTML = `<span style="color:var(--text3);font-size:12px">Seleccionar...</span>`;
      onChange([]);
    });
  }

  function getPeriodoFallas() {
    const periodo = document.getElementById('dbPeriodo')?.value || '';
    let fallas = DATA.getFilteredFallas();
    if (!periodo) return fallas;
    const now  = new Date();
    const start = new Date();
    if (periodo === 'day')   { start.setHours(0,0,0,0); }
    if (periodo === 'week')  { start.setDate(now.getDate() - now.getDay()); start.setHours(0,0,0,0); }
    if (periodo === 'month') { start.setDate(1); start.setHours(0,0,0,0); }
    if (periodo === 'year')  { start.setMonth(0,1); start.setHours(0,0,0,0); }
    return fallas.filter(f => new Date(f.createdAt || f.fecha) >= start);
  }

  function buildKPIs() {
    const grid   = document.getElementById('kpiGrid');
    if (!grid) return;
    const fallas = getPeriodoFallas();
    const total  = fallas.length;
    const isGeneral = DATA.state.viewMode === 'general';

    // Palette: colores por familia semántica
    const KEYWORD_COLORS = [
      { re: /pendiente/i,    r:239, g:68,  b:68,  lbl:'Pendientes'   },
      { re: /proceso|work/i, r:245, g:158, b:11,  lbl:'En proceso'   },
      { re: /atendid/i,      r:34,  g:197, b:94,  lbl:'Atendidos'    },
      { re: /vandaliz/i,     r:132, g:204, b:22,  lbl:'Vandalizado'  },
      { re: /sin sim/i,      r:6,   g:182, b:212, lbl:'SIN SIM'      },
      { re: /operaci/i,      r:168, g:85,  b:247, lbl:'En operación' },
      { re: /renta/i,        r:249, g:115, b:22,  lbl:'Renta'        },
      { re: /venta/i,        r:225, g:29,  b:72,  lbl:'Venta'        },
      { re: /cancel/i,       r:6,   g:182, b:212, lbl:'Cancelado'    },
    ];
    const DYNA_COLORS = [
      [79,142,247],[168,85,247],[6,182,212],[249,115,22],
      [132,204,22],[225,29,72],[16,185,129],[139,92,246],[236,72,153]
    ];

    const baseKPI = [
      { key: 'total', val: total, lbl: 'Total Registros', sub: 'Histórico', r: 79, g: 142, b: 247 },
    ];

    let statusKPIs;

    if (isGeneral) {
      // Modo General: agrupar todos los estatus por familia semántica
      // Primero: familias conocidas
      const grupos = KEYWORD_COLORS.map(kw => ({
        lbl: kw.lbl, r: kw.r, g: kw.g, b: kw.b,
        cnt: fallas.filter(f => f.estatus && kw.re.test(f.estatus)).length
      })).filter(g => g.cnt > 0);

      // Segundo: estatus que no encajan en ninguna familia (raros/custom)
      const yaAgrupados = new Set(
        fallas.filter(f => f.estatus && KEYWORD_COLORS.some(kw => kw.re.test(f.estatus)))
              .map(f => f.estatus)
      );
      const raros = [...new Set(fallas.map(f => f.estatus).filter(e => e && !yaAgrupados.has(e)))];
      raros.forEach((e, i) => {
        const cnt = fallas.filter(f => f.estatus === e).length;
        if (cnt > 0) {
          const [r,g,b] = DYNA_COLORS[i % DYNA_COLORS.length];
          grupos.push({ lbl: e, r, g, b, cnt });
        }
      });

      statusKPIs = grupos.map(g => ({
        key: g.lbl, val: g.cnt,
        lbl: g.lbl,
        sub: (total ? Math.round(g.cnt / total * 100) : 0) + '% del total',
        r: g.r, g: g.g, b: g.b
      }));
    } else {
      // Modo Individual: mantener lógica original por estatus exacto
      const estatusConfig = _getEstatusVivos();
      let dynaIdx = 0;
      function colorForEstatus(label) {
        for (const kw of KEYWORD_COLORS) {
          if (kw.re.test(label)) return [kw.r, kw.g, kw.b];
        }
        return DYNA_COLORS[dynaIdx++ % DYNA_COLORS.length];
      }
      statusKPIs = estatusConfig.map(e => {
        const cnt  = fallas.filter(f => f.estatus === e).length;
        const pctE = total ? Math.round(cnt / total * 100) : 0;
        const [r,g,b] = colorForEstatus(e);
        return { key: e, val: cnt, lbl: e, sub: pctE + '% del total', r, g, b };
      });
    }

    const kpis = [...baseKPI, ...statusKPIs];
    grid.innerHTML = kpis.map(k => `
      <div class="kpi-card" style="--kpi-r:${k.r};--kpi-g:${k.g};--kpi-b:${k.b}">
        <div class="kpi-val" style="color:rgb(${k.r},${k.g},${k.b})">${k.val}</div>
        <div class="kpi-lbl">${k.lbl}</div>
        <div class="kpi-sub">${k.sub}</div>
      </div>
    `).join('');
  }

  /* Returns the live list of estatus from config for the current scope */
  function _getEstatusVivos() {
    const session = AUTH.checkSession();
    const emps = DATA.state.viewMode === 'general'
      ? ((session && session.empresas && session.empresas.length) ? session.empresas : DATA.state.empresas)
      : [DATA.state.currentEmpresa];
    const set = new Set();
    emps.forEach(emp => {
      (DATA.getSel('estatus', emp) || DATA.ESTATUS_DEFAULT).forEach(e => set.add(e));
    });
    // Also include any estatus actually present in fallas (legacy safety)
    DATA.state.fallas.forEach(f => { if (f.estatus) set.add(f.estatus); });
    return [...set];
  }

  let goDonutChart = null;

  function _drawSoGauge(canvasId, pct, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0,0,W,H);
    const cx = W/2, cy = H * 0.78;
    const r  = Math.min(W,H) * 0.42;
    const startA = Math.PI, endA = 2*Math.PI;
    // Track
    ctx.beginPath(); ctx.arc(cx,cy,r,startA,endA); ctx.strokeStyle='rgba(255,255,255,0.07)'; ctx.lineWidth=14; ctx.lineCap='round'; ctx.stroke();
    // Fill green→amber→red gradient arc
    const fillEnd = startA + (pct/100) * Math.PI;
    const grad = ctx.createLinearGradient(cx-r,cy,cx+r,cy);
    grad.addColorStop(0,'#22c55e'); grad.addColorStop(0.5,'#f59e0b'); grad.addColorStop(1,'#ef4444');
    ctx.beginPath(); ctx.arc(cx,cy,r,startA,fillEnd); ctx.strokeStyle=color||grad; ctx.lineWidth=14; ctx.lineCap='round'; ctx.stroke();
  }

  function _buildSoBanner(fallas) {
    const total = fallas.length || 1;
    const aten  = fallas.filter(f => _isAtendidoEst(f.estatus, f.empresa)).length;
    const pend  = fallas.filter(f => /pendiente|sin sim|vandaliz/i.test(f.estatus||'')).length;
    const opPct = Math.round(aten/total*100);
    const atPct = Math.round(pend/total*100);

    const setBig = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
    setBig('soOpPct',  opPct+'%');
    setBig('soOpSub',  `${aten} de ${total} unidades`);
    setBig('soAtPct',  atPct+'%');
    setBig('soAtSub',  `${pend} de ${total} unidades`);
    setBig('soHealthPct', opPct+'%');
    setBig('soHealthSub', `${aten} de ${total} unidades`);

    const atEl = document.getElementById('soAtPct');
    if (atEl) atEl.className = atPct >= 50 ? 'so-big so-red' : atPct >= 20 ? 'so-big so-amber' : 'so-big so-amber';

    const msg = document.getElementById('soMsg');
    if (msg) {
      const criticos = [...new Set(fallas.filter(f=>/pendiente|sin sim|vandaliz/i.test(f.estatus||'')).map(f=>f.estatus))];
      if (pend>0) msg.textContent = `Hay ${pend} unidade${pend!==1?'s':''} que requieren atención: ${criticos.join(', ').toLowerCase()}.`;
      else msg.textContent = 'Todas las unidades están operativas. 🟢';
    }
    const hMsg = document.getElementById('soHealthMsg');
    if (hMsg) {
      if (opPct < 100) hMsg.textContent = `El ${100-opPct}% de las unidades requiere atención para alcanzar una operación óptima.`;
      else hMsg.textContent = 'Operación al 100%. Todas las unidades atendidas.';
    }

    // Mini gauge in banner
    _drawSoGauge('soGaugeCanvas', atPct, atPct>=50?'#ef4444':'#f59e0b');
    // Health gauge
    _drawSoGauge('soHealthGauge', opPct, opPct>=70?'#22c55e':opPct>=40?'#f59e0b':'#ef4444');
  }

  function _buildGoDonut(fallas) {
    const existing = document.getElementById('goDonutChart');
    if (!existing) return;
    if (goDonutChart) { goDonutChart.destroy(); goDonutChart = null; }

    const total = fallas.length;
    const FAMILIES = [
      { re: /pendiente/i,    lbl:'Pendientes',  color:'#ef4444' },
      { re: /proceso|work/i, lbl:'En proceso',  color:'#f59e0b' },
      { re: /atendid/i,      lbl:'Atendidos',   color:'#22c55e' },
      { re: /vandaliz/i,     lbl:'Vandalizado', color:'#84cc16' },
      { re: /sin sim/i,      lbl:'Sin SIM',     color:'#06b6d4' },
      { re: /operaci/i,      lbl:'En operación',color:'#a855f7' },
    ];
    const grupos = [];
    const yaGrp  = new Set();
    FAMILIES.forEach(fam => {
      const cnt = fallas.filter(f => f.estatus && fam.re.test(f.estatus)).length;
      if (cnt > 0) {
        grupos.push({ lbl: fam.lbl, cnt, color: fam.color });
        fallas.filter(f => f.estatus && fam.re.test(f.estatus)).forEach(f => yaGrp.add(f.estatus));
      }
    });
    const EXTRA = ['#ec4899','#f97316','#3b82f6','#8b5cf6'];
    [...new Set(fallas.map(f=>f.estatus).filter(e=>e&&!yaGrp.has(e)))].forEach((e,i)=>{
      const cnt = fallas.filter(f=>f.estatus===e).length;
      if(cnt>0) grupos.push({lbl:e,cnt,color:EXTRA[i%EXTRA.length]});
    });

    const t = total||1;
    goDonutChart = new Chart(existing, {
      type: 'doughnut',
      data: {
        labels: grupos.map(g=>g.lbl),
        datasets: [{ data: grupos.map(g=>g.cnt), backgroundColor: grupos.map(g=>g.color), borderWidth: 2, borderColor: '#0f1923', hoverOffset: 6 }]
      },
      options: {
        responsive: false, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} (${Math.round(ctx.parsed/t*100)}%)` } }
        },
        cutout: '62%'
      }
    });

    const centerEl = document.getElementById('goTotalNum');
    if (centerEl) centerEl.textContent = total;

    // legend
    const legEl = document.getElementById('goLegend');
    if (legEl) {
      legEl.innerHTML = grupos.map(g => {
        const pct = Math.round(g.cnt/t*100);
        return `<div class="go-leg-item">
          <span class="go-leg-dot" style="background:${g.color}"></span>
          <span class="go-leg-lbl">${g.lbl}</span>
          <span class="go-leg-pct">${pct}%</span>
          <span class="go-leg-cnt">${g.cnt} de ${total}</span>
        </div>`;
      }).join('');
    }
  }

  function buildCharts() {
    const fallas = getPeriodoFallas();

    if (mainChart) { mainChart.destroy(); mainChart = null; }
    if (catChart)  { catChart.destroy();  catChart  = null; }
    if (techChart) { techChart.destroy(); techChart = null; }
    if (provChart) { provChart.destroy(); provChart = null; }

    // Salud Operativa banner + donut general
    _buildSoBanner(fallas);
    _buildGoDonut(fallas);

    const mc = document.getElementById('mainChart');
    if (mc) {
      const isGeneral = DATA.state.viewMode === 'general';
      const total = fallas.length || 1;
      const aten  = fallas.filter(f => _isAtendidoEst(f.estatus, f.empresa)).length;
      const avancePct = Math.round(aten / total * 100);

      const FAMILIES = [
        { re: /pendiente/i,    lbl:'Pendientes',   color:'#ef4444' },
        { re: /proceso|work/i, lbl:'En proceso',   color:'#f59e0b' },
        { re: /atendid/i,      lbl:'Atendidos',    color:'#22c55e' },
        { re: /vandaliz/i,     lbl:'Vandalizado',  color:'#84cc16' },
        { re: /sin sim/i,      lbl:'SIN SIM',      color:'#06b6d4' },
        { re: /operaci/i,      lbl:'En operación', color:'#a855f7' },
        { re: /renta/i,        lbl:'Renta',        color:'#f97316' },
        { re: /venta/i,        lbl:'Venta',        color:'#e11d48' },
        { re: /cancel/i,       lbl:'Cancelado',    color:'#06b6d4' },
      ];
      const EXTRA_COLORS = ['#ec4899','#f97316','#84cc16','#8b5cf6','#14b8a6','#e11d48','#10b981','#3b82f6'];

      let labels, counts, colors;

      if (isGeneral) {
        // Agrupar por familia semántica
        const grupos = [];
        const yaAgrupados = new Set();
        FAMILIES.forEach(fam => {
          const cnt = fallas.filter(f => f.estatus && fam.re.test(f.estatus)).length;
          if (cnt > 0) {
            grupos.push({ lbl: fam.lbl, cnt, color: fam.color });
            fallas.filter(f => f.estatus && fam.re.test(f.estatus)).forEach(f => yaAgrupados.add(f.estatus));
          }
        });
        // Raros que no encajan en ninguna familia
        const rarosSet = [...new Set(fallas.map(f => f.estatus).filter(e => e && !yaAgrupados.has(e)))];
        rarosSet.forEach((e, i) => {
          const cnt = fallas.filter(f => f.estatus === e).length;
          if (cnt > 0) grupos.push({ lbl: e, cnt, color: EXTRA_COLORS[i % EXTRA_COLORS.length] });
        });
        labels = grupos.map(g => g.lbl);
        counts = grupos.map(g => g.cnt);
        colors = grupos.map(g => g.color);
      } else {
        // Modo Individual: estatus exacto por empresa
        const estatusList = _getEstatusVivos();
        const COLOR_MAP = {};
        FAMILIES.forEach(fam => {
          estatusList.forEach(e => { if (fam.re.test(e)) COLOR_MAP[e] = fam.color; });
        });
        let extraIdx = 0;
        labels = estatusList;
        counts = estatusList.map(e => fallas.filter(f => f.estatus === e).length);
        colors = estatusList.map(e => COLOR_MAP[e] || EXTRA_COLORS[extraIdx++ % EXTRA_COLORS.length]);
      }

      mainChart = new Chart(mc, {
        type: 'bar',
        data: {
          labels,
          datasets: [{ data: counts, backgroundColor: colors, borderRadius: 6, borderSkipped: false }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => {
                  const cnt = ctx.parsed.y;
                  const pct = Math.round(cnt / total * 100);
                  return ` ${cnt} de ${total} registros (${pct}%)`;
                },
                title: ctx => ctx[0]?.label || '',
                afterLabel: ctx => {
                  const cnt = ctx.parsed.y;
                  const pct = Math.round(cnt / total * 100);
                  const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
                  return ` ${bar} ${pct}% del total`;
                }
              }
            }
          },
          scales: {
            x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#7c8ba1', font: { size: 11 } } },
            y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#7c8ba1', font: { size: 11 } }, beginAtZero: true }
          }
        }
      });

      const legend = document.getElementById('chartLegend');
      if (legend) {
        legend.innerHTML = labels.map((lbl, i) => {
          const pct = Math.round(counts[i] / total * 100);
          return `<div class="legend-item"><div class="legend-dot" style="background:${colors[i]}"></div><span>${lbl}: ${counts[i]} de ${total} (${pct}%)</span></div>`;
        }).join('');
      }

      // Avance label (% atendidos / total)
      const avEl = document.getElementById('chartAvance');
      if (avEl) avEl.textContent = `Avance: ${avancePct}% atendido`;
    }



    const bars = document.getElementById('empresaBars');
    if (bars) {
      const all = fallas.length || 1;
      bars.innerHTML = DATA.state.empresas.map(emp => {
        const cnt = fallas.filter(f => f.empresa === emp).length;
        const clr = DATA.getEmpresaColor(emp);
        const pct = Math.round(cnt / all * 100);
        return `<div class="empresa-bar-row">
          <div class="empresa-bar-info">
            <span class="empresa-bar-name">${emp}</span>
            <span class="empresa-bar-num">${cnt}</span>
          </div>
          <div class="empresa-bar-track">
            <div class="empresa-bar-fill" style="width:${pct}%;background:${clr.hex}"></div>
          </div>
        </div>`;
      }).join('');
    }

    _buildTechChart(fallas);

    const pc = document.getElementById('provChart');
    if (pc) {
      const provs      = [...new Set(fallas.map(f => f.proveedor).filter(Boolean))];
      const provCounts = provs.map(p => fallas.filter(f => f.proveedor === p).length);
      if (provs.length === 0) {
        pc.closest('.chart-wrap').innerHTML = '<p style="color:var(--text3);font-size:12px;padding:20px;text-align:center">Sin proveedores registrados</p>';
      } else {
        provChart = new Chart(pc, {
          type: 'bar',
          data: {
            labels: provs,
            datasets: [{ data: provCounts, backgroundColor: ['#06b6d4','#a855f7','#f59e0b','#22c55e','#ef4444'], borderRadius: 6, borderSkipped: false }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#7c8ba1', font: { size: 11 } } },
              y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#7c8ba1', font: { size: 11 } }, beginAtZero: true }
            }
          }
        });
      }
    }
  }


  // ══════════════════════════════════════════════════════════
  // PRODUCTIVIDAD POR TÉCNICO — BASE y VS BASES
  // Solo aplica a técnicos (role === 'tecnico')
  // Admin y Master no entran en la gráfica
  // ══════════════════════════════════════════════════════════
  let _techMode    = 'base'; // 'base' | 'vs' | 'general'
  let _techBaseFilter = '';  // base seleccionada en dropdown
  let _techSelected   = null; // username del técnico seleccionado

  function selectTecnico(username) {
    // Toggle — si ya estaba seleccionado, deseleccionar
    if (_techSelected === username) {
      _techSelected = null;
    } else {
      _techSelected = username;
    }
    const fallas = getPeriodoFallas();

    if (_techSelected) {
      // Mostrar solo este técnico
      const allUsers  = AUTH.getUsers() || [];
      const u = allUsers.find(u => u.username === _techSelected);
      if (!u) { _techSelected = null; _buildTechChart(fallas); return; }

      if (techChart) { techChart.destroy(); techChart = null; }
      const wrap = document.getElementById('techChartWrap');
      if (wrap) wrap.innerHTML = '<canvas id="techChart"></canvas>';

      const ff = fallas.filter(f =>
        f.tecnicoUsername === u.username || f.tecnico === (u.nombre || u.username)
      );
      const correctivos = ff.filter(f => /correctiv/i.test(f.tipo)).length;
      const preventivos = ff.filter(f => /preventiv/i.test(f.tipo)).length;
      const atendidos   = ff.filter(f => _isAtendidoEst(f.estatus, f.empresa)).length;

      // Gráfica detallada: desglose por empresa para este técnico
      const empresas = DATA.state.empresas || [];
      const labelsEmp  = empresas;
      const corrEmp    = empresas.map(e => ff.filter(f => f.empresa === e && /correctiv/i.test(f.tipo)).length);
      const prevEmp    = empresas.map(e => ff.filter(f => f.empresa === e && /preventiv/i.test(f.tipo)).length);
      const atenEmp    = empresas.map(e => ff.filter(f => f.empresa === e && _isAtendidoEst(f.estatus, f.empresa)).length);

      const tc = document.getElementById('techChart');
      if (tc) {
        techChart = new Chart(tc, {
          type: 'bar',
          data: {
            labels: labelsEmp,
            datasets: [
              { label: 'Correctivos', data: corrEmp, backgroundColor: '#ef4444', borderRadius: 4, borderSkipped: false },
              { label: 'Preventivos', data: prevEmp, backgroundColor: '#22c55e', borderRadius: 4, borderSkipped: false },
              { label: 'Atendidos',   data: atenEmp, backgroundColor: '#4f8ef7', borderRadius: 4, borderSkipped: false },
            ]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
              legend: { display: true, labels: { color: '#7c8ba1', font: { size: 10 } } },
              title: { display: true, text: `${u.nombre || u.username} — por empresa`, color: '#7c8ba1', font: { size: 11 } }
            },
            scales: {
              x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#7c8ba1', font: { size: 10 } } },
              y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#7c8ba1', font: { size: 10 } }, beginAtZero: true }
            }
          }
        });
      }

      // Actualizar tarjetas con indicador de selección
      const cards = document.getElementById('techResumenCards');
      if (cards) {
        cards.querySelectorAll('.tech-card').forEach(c => {
          const isSelected = c.dataset.username === _techSelected;
          c.style.border = isSelected ? '2px solid var(--accent)' : '1px solid var(--border)';
          c.style.boxShadow = isSelected ? '0 0 0 2px rgba(79,142,247,0.2)' : 'none';
        });
      }
    } else {
      // Deseleccionar — volver al modo normal
      _buildTechChart(fallas);
    }
  }

  function _poblarBaseSelect() {
    const sel = document.getElementById('techBaseSelect');
    if (!sel) return;
    const session = AUTH.checkSession();
    const empActiva = DATA.state.currentEmpresa;
    const allUsers  = AUTH.getUsers() || [];
    // Solo técnicos de la empresa activa
    const tecnicos  = allUsers.filter(u =>
      u.role === 'tecnico' && u.activo !== false &&
      (!empActiva || (u.empresas || []).includes(empActiva))
    );
    const bases = [...new Set(tecnicos.map(u => (u.base || '').toUpperCase()).filter(Boolean))].sort();
    const prev  = sel.value;
    sel.innerHTML = '<option value="">Todas las bases</option>' +
      bases.map(b => `<option value="${b}"${b === prev ? ' selected' : ''}>${b}</option>`).join('');
    // Si el selector está vacío y hay bases, pre-seleccionar la primera
    if (!sel.value && bases.length) sel.value = bases[0];
    _techBaseFilter = sel.value;
  }

  function setTechBase(base) {
    _techBaseFilter = (base || '').toUpperCase();
    _buildTechChart(getPeriodoFallas());
  }

  function setTechMode(mode) {
    _techMode = mode;
    const btnBase = document.getElementById('techModeBase');
    const btnVs   = document.getElementById('techModeVs');
    const selBase = document.getElementById('techBaseSelect');
    if (btnBase) { btnBase.className = mode === 'base' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-ghost'; btnBase.style.cssText = 'font-size:10px;padding:2px 8px'; }
    if (btnVs)   { btnVs.className   = mode === 'vs'   ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-ghost'; btnVs.style.cssText   = 'font-size:10px;padding:2px 8px'; }
    // El dropdown solo aplica en modo BASE
    if (selBase) selBase.style.display = mode === 'base' ? '' : 'none';
    _buildTechChart(getPeriodoFallas());
  }

  function _buildTechChart(fallas) {
    if (techChart) { techChart.destroy(); techChart = null; }

    const wrap  = document.getElementById('techChartWrap');
    const cards = document.getElementById('techResumenCards');

    _poblarBaseSelect();

    const session    = AUTH.checkSession();
    const empActiva  = DATA.state.currentEmpresa;
    const isGeneral  = DATA.state.viewMode === 'general';
    const allUsers   = AUTH.getUsers() || [];

    // Solo técnicos — excluir master y admin
    // Filtrar por empresa activa (técnico debe tener acceso a esa empresa)
    const tecnicos = allUsers.filter(u =>
      u.role === 'tecnico' && u.activo !== false &&
      (!empActiva || isGeneral || (u.empresas || []).includes(empActiva))
    );

    const _fallasTec = (u) => fallas.filter(f =>
      f.tecnicoUsername === u.username || f.tecnico === (u.nombre || u.username)
    );

    if (_techMode === 'base') {
      // ── MODO BASE: técnicos de la base seleccionada en el dropdown ──
      const baseSeleccionada = _techBaseFilter;
      const tecBase = baseSeleccionada
        ? tecnicos.filter(u => (u.base || '').toUpperCase() === baseSeleccionada)
        : tecnicos;

      if (tecBase.length === 0) {
        if (wrap) wrap.innerHTML = '<p style="color:var(--text3);font-size:12px;padding:20px;text-align:center">Sin técnicos en esta base</p>';
        if (cards) cards.innerHTML = ''; return;
      }

      const labels     = tecBase.map(u => u.nombre || u.username);
      const correctivos= tecBase.map(u => _fallasTec(u).filter(f => /correctiv/i.test(f.tipo)).length);
      const preventivos= tecBase.map(u => _fallasTec(u).filter(f => /preventiv/i.test(f.tipo)).length);
      const atendidos  = tecBase.map(u => _fallasTec(u).filter(f => _isAtendidoEst(f.estatus, f.empresa)).length);

      _renderTechBarChart(labels, correctivos, preventivos, atendidos);
      _renderTechCards(tecBase, fallas, baseSeleccionada ? `Técnicos · Base ${baseSeleccionada}` : `Todos los técnicos · ${empActiva || 'Global'}`);

    } else if (_techMode === 'vs') {
      // ── MODO VS BASES: top 1 técnico de cada base, solo bases de la empresa activa ──
      const baseMap = {};
      tecnicos.forEach(u => {
        const base = (u.base || 'Sin base').toUpperCase();
        if (!baseMap[base]) baseMap[base] = [];
        baseMap[base].push(u);
      });

      const topPorBase = Object.entries(baseMap).map(([base, tecList]) => {
        const scored = tecList.map(u => {
          const ff = _fallasTec(u);
          return { u,
            atendidos:   ff.filter(f => _isAtendidoEst(f.estatus, f.empresa)).length,
            correctivos: ff.filter(f => /correctiv/i.test(f.tipo)).length,
            preventivos: ff.filter(f => /preventiv/i.test(f.tipo)).length,
          };
        }).sort((a, b) => b.atendidos - a.atendidos);
        return { base, top: scored[0] };
      }).filter(b => b.top);

      if (topPorBase.length === 0) {
        if (wrap) wrap.innerHTML = '<p style="color:var(--text3);font-size:12px;padding:20px;text-align:center">Sin bases con técnicos</p>';
        if (cards) cards.innerHTML = ''; return;
      }

      _renderTechBarChart(
        topPorBase.map(b => b.base),
        topPorBase.map(b => b.top.correctivos),
        topPorBase.map(b => b.top.preventivos),
        topPorBase.map(b => b.top.atendidos),
        topPorBase.map(b => b.top.u.nombre || b.top.u.username)
      );
      _renderTechCardsVsBases(topPorBase, fallas);

    } else {
      // ── MODO GENERAL (desde botón General en header) ──
      // Top 1 técnico de cada empresa compiten entre sí
      const empresas = DATA.state.empresas || [];
      const topPorEmp = empresas.map(emp => {
        const tecsEmp = allUsers.filter(u =>
          u.role === 'tecnico' && u.activo !== false &&
          (u.empresas || []).includes(emp)
        );
        if (!tecsEmp.length) return null;
        const scored = tecsEmp.map(u => {
          const ff = fallas.filter(f =>
            (f.empresa === emp) &&
            (f.tecnicoUsername === u.username || f.tecnico === (u.nombre || u.username))
          );
          return { u, emp,
            atendidos:   ff.filter(f => _isAtendidoEst(f.estatus, f.empresa)).length,
            correctivos: ff.filter(f => /correctiv/i.test(f.tipo)).length,
            preventivos: ff.filter(f => /preventiv/i.test(f.tipo)).length,
          };
        }).sort((a, b) => b.atendidos - a.atendidos);
        return { emp, top: scored[0] };
      }).filter(Boolean).filter(e => e.top);

      if (topPorEmp.length === 0) {
        if (wrap) wrap.innerHTML = '<p style="color:var(--text3);font-size:12px;padding:20px;text-align:center">Sin datos por empresa</p>';
        if (cards) cards.innerHTML = ''; return;
      }

      _renderTechBarChart(
        topPorEmp.map(e => e.emp),
        topPorEmp.map(e => e.top.correctivos),
        topPorEmp.map(e => e.top.preventivos),
        topPorEmp.map(e => e.top.atendidos),
        topPorEmp.map(e => e.top.u.nombre || e.top.u.username)
      );
      // Reutilizar _renderTechCardsVsBases con estructura compatible
      _renderTechCardsVsBases(
        topPorEmp.map(e => ({ base: e.emp, top: { u: e.top.u, ...e.top } })),
        fallas, true
      );
    }
  }

  function _renderTechBarChart(labels, correctivos, preventivos, atendidos, sublabels) {
    const wrap = document.getElementById('techChartWrap');
    if (!wrap) return;
    wrap.innerHTML = '<canvas id="techChart"></canvas>';
    const tc = document.getElementById('techChart');
    if (!tc) return;

    // Si hay sublabels (VS BASES), mostrar "BASE\nNombre técnico"
    const displayLabels = sublabels
      ? labels.map((b, i) => [b, sublabels[i] ? sublabels[i].split(' ')[0] : ''])
      : labels;

    techChart = new Chart(tc, {
      type: 'bar',
      data: {
        labels: displayLabels,
        datasets: [
          { label: 'Correctivos', data: correctivos, backgroundColor: '#ef4444', borderRadius: 4, borderSkipped: false },
          { label: 'Preventivos', data: preventivos, backgroundColor: '#22c55e', borderRadius: 4, borderSkipped: false },
          { label: 'Atendidos',   data: atendidos,   backgroundColor: '#4f8ef7', borderRadius: 4, borderSkipped: false },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: true, labels: { color: '#7c8ba1', font: { size: 10 } } },
          tooltip: {
            callbacks: {
              title: ctx => Array.isArray(ctx[0].label) ? ctx[0].label.join(' · ') : ctx[0].label
            }
          }
        },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#7c8ba1', font: { size: 10 } } },
          y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#7c8ba1', font: { size: 10 } }, beginAtZero: true }
        }
      }
    });
  }

  function _renderTechCards(tecBase, fallas, titulo) {
    const cards = document.getElementById('techResumenCards');
    if (!cards) return;

    const stats = tecBase.map(u => {
      const ff   = fallas.filter(f => f.tecnicoUsername === u.username || f.tecnico === (u.nombre || u.username));
      const aten = ff.filter(f => _isAtendidoEst(f.estatus, f.empresa)).length;
      const corr = ff.filter(f => /correctiv/i.test(f.tipo)).length;
      const prev = ff.filter(f => /preventiv/i.test(f.tipo)).length;
      const total= ff.length;
      const efic = total > 0 ? Math.round(aten / total * 100) : 0;
      return { u, aten, corr, prev, total, efic };
    }).sort((a, b) => b.efic - a.efic);

    if (stats.length === 0) { cards.innerHTML = ''; return; }

    const mejor = stats[0];
    const peor  = stats[stats.length - 1];

    cards.innerHTML = `
      <div style="font-size:10px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.05em;padding:8px 0 4px">${titulo}</div>
      ${(() => {
        const apoyos = fallas.filter(f => f.esApoyo && f.tecnicoApoyoUsername);
        if (!apoyos.length) return '';
        const apoyoStats = {};
        apoyos.forEach(f => {
          const k = f.tecnicoApoyoNombre || f.tecnicoApoyoUsername;
          if (!apoyoStats[k]) apoyoStats[k] = 0;
          apoyoStats[k]++;
        });
        return '<div style="font-size:10px;color:#f59e0b;padding:4px 0">⚡ Apoyos registrados: ' +
          Object.entries(apoyoStats).map(([n,c]) => n + ' (' + c + ')').join(', ') + '</div>';
      })()}
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${stats.map((s, i) => {
          const isMejor = i === 0 && stats.length > 1;
          const isPeor  = i === stats.length - 1 && stats.length > 1;
          const badge   = isMejor
            ? '<span style="font-size:9px;background:rgba(34,197,94,.15);color:#22c55e;border:1px solid rgba(34,197,94,.3);border-radius:4px;padding:1px 5px">⭐ MEJOR</span>'
            : isPeor
            ? '<span style="font-size:9px;background:rgba(239,68,68,.15);color:#ef4444;border:1px solid rgba(239,68,68,.3);border-radius:4px;padding:1px 5px">↓ MENOR</span>'
            : '';
          const barColor = s.efic >= 70 ? '#22c55e' : s.efic >= 40 ? '#f59e0b' : '#ef4444';
          return `<div class="tech-card" data-username="${s.u.username}" onclick="MODS.selectTecnico('${s.u.username}')" style="flex:1;min-width:160px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px;cursor:pointer;transition:border .15s,box-shadow .15s" onmouseenter="this.style.borderColor='var(--accent)'" onmouseleave="if('${s.u.username}'!==MODS._getSelectedTech())this.style.borderColor='var(--border)'">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <div style="width:34px;height:34px;border-radius:50%;background:var(--bg4);border:2px solid var(--border2);display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div style="min-width:0">
                <div style="font-size:12px;font-weight:600;color:var(--text1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.u.nombre || s.u.username}</div>
                <div style="font-size:10px;color:var(--text3)">${s.u.base || '—'}</div>
              </div>
              ${badge}
            </div>
            <div style="display:flex;gap:10px;font-size:11px;margin-bottom:6px">
              <div style="text-align:center"><div style="color:#4f8ef7;font-weight:700;font-size:14px">${s.aten}</div><div style="color:var(--text3)">Atend.</div></div>
              <div style="text-align:center"><div style="color:#ef4444;font-weight:700;font-size:14px">${s.corr}</div><div style="color:var(--text3)">Corr.</div></div>
              <div style="text-align:center"><div style="color:#22c55e;font-weight:700;font-size:14px">${s.prev}</div><div style="color:var(--text3)">Prev.</div></div>
              <div style="text-align:center"><div style="color:var(--text2);font-weight:700;font-size:14px">${s.total}</div><div style="color:var(--text3)">Total</div></div>
            </div>
            <div style="display:flex;align-items:center;gap:6px">
              <div style="flex:1;height:5px;background:var(--bg4);border-radius:3px;overflow:hidden">
                <div style="height:100%;width:${s.efic}%;background:${barColor};border-radius:3px;transition:width .4s"></div>
              </div>
              <span style="font-size:10px;font-weight:700;color:${barColor}">${s.efic}%</span>
            </div>
          </div>`;
        }).join('')}
      </div>
      <p style="font-size:10px;color:var(--text3);margin-top:6px;text-align:center">La eficiencia se calcula: atendidos / total asignados</p>`;
  }

  function _renderTechCardsVsBases(topPorBase, fallas, isEmpresa = false) {
    const cards = document.getElementById('techResumenCards');
    if (!cards) return;

    const stats = topPorBase.map(({ base, top }) => ({
      base,
      u: top.u,
      aten: top.atendidos,
      corr: top.correctivos,
      prev: top.preventivos,
      total: fallas.filter(f => f.tecnicoUsername === top.u.username || f.tecnico === (top.u.nombre || top.u.username)).length,
      efic: fallas.filter(f => f.tecnicoUsername === top.u.username || f.tecnico === (top.u.nombre || top.u.username)).length > 0
        ? Math.round(top.atendidos / fallas.filter(f => f.tecnicoUsername === top.u.username || f.tecnico === (top.u.nombre || top.u.username)).length * 100) : 0
    })).sort((a, b) => b.efic - a.efic);

    if (stats.length === 0) { cards.innerHTML = ''; return; }

    cards.innerHTML = `
      <div style="font-size:10px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.05em;padding:8px 0 4px">Top técnico por base</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${stats.map((s, i) => {
          const isMejor = i === 0;
          const isPeor  = i === stats.length - 1 && stats.length > 1;
          const badge   = isMejor
            ? '<span style="font-size:9px;background:rgba(34,197,94,.15);color:#22c55e;border:1px solid rgba(34,197,94,.3);border-radius:4px;padding:1px 5px">🏆 BASE TOP</span>'
            : isPeor
            ? '<span style="font-size:9px;background:rgba(239,68,68,.15);color:#ef4444;border:1px solid rgba(239,68,68,.3);border-radius:4px;padding:1px 5px">↓ REZAGADA</span>'
            : '';
          const barColor = s.efic >= 70 ? '#22c55e' : s.efic >= 40 ? '#f59e0b' : '#ef4444';
          return `<div class="tech-card" data-username="${s.top.u.username}" onclick="MODS.selectTecnico('${s.top.u.username}')" style="flex:1;min-width:160px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px;cursor:pointer;transition:border .15s" onmouseenter="this.style.borderColor='var(--accent)'" onmouseleave="if('${s.top.u.username}'!==MODS._getSelectedTech())this.style.borderColor='var(--border)'">
            <div style="font-size:10px;font-weight:700;color:var(--accent);margin-bottom:6px;text-transform:uppercase">${s.base} ${badge}</div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <div style="width:30px;height:30px;border-radius:50%;background:var(--bg4);border:2px solid var(--border2);display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div style="min-width:0">
                <div style="font-size:11px;font-weight:600;color:var(--text1)">${s.u.nombre || s.u.username}</div>
                <div style="font-size:10px;color:var(--text3)">Técnico destacado</div>
              </div>
            </div>
            <div style="display:flex;gap:8px;font-size:11px;margin-bottom:6px">
              <div style="text-align:center"><div style="color:#4f8ef7;font-weight:700;font-size:13px">${s.aten}</div><div style="color:var(--text3)">Atend.</div></div>
              <div style="text-align:center"><div style="color:#ef4444;font-weight:700;font-size:13px">${s.corr}</div><div style="color:var(--text3)">Corr.</div></div>
              <div style="text-align:center"><div style="color:#22c55e;font-weight:700;font-size:13px">${s.prev}</div><div style="color:var(--text3)">Prev.</div></div>
            </div>
            <div style="display:flex;align-items:center;gap:6px">
              <div style="flex:1;height:5px;background:var(--bg4);border-radius:3px;overflow:hidden">
                <div style="height:100%;width:${s.efic}%;background:${barColor};border-radius:3px"></div>
              </div>
              <span style="font-size:10px;font-weight:700;color:${barColor}">${s.efic}%</span>
            </div>
          </div>`;
        }).join('')}
      </div>`;
  }

  function renderDashTable() {
    const tbody = document.getElementById('dbTbody');
    if (!tbody) return;

    // Multi-select filter logic
    const search = (document.getElementById('dbSearch')?.value || '').toLowerCase();

    let fallas = getPeriodoFallas();

    // AND logic between filters, OR logic within same filter
    if (search)                    fallas = fallas.filter(f => (f.folio+f.unidad+(f.descripcion||'')).toLowerCase().includes(search));
    if (mf.dash.empresas.length)   fallas = fallas.filter(f => mf.dash.empresas.includes(f.empresa));
    if (mf.dash.bases.length)      fallas = fallas.filter(f => mf.dash.bases.includes(f.base));
    if (mf.dash.estados.length)    fallas = fallas.filter(f => mf.dash.estados.includes(f.estatus));
    if (mf.dash.prioridades.length)fallas = fallas.filter(f => mf.dash.prioridades.includes(f.prioridad));
    if (mf.dash.tipos.length)      fallas = fallas.filter(f => mf.dash.tipos.includes(f.tipo));
    if (mf.dash.proveedores.length)fallas = fallas.filter(f => mf.dash.proveedores.includes(f.proveedor));
    if (mf.dash.tecnicos.length)   fallas = fallas.filter(f => mf.dash.tecnicos.includes(f.tecnico));

    const cnt = document.getElementById('dbCount');
    if (cnt) cnt.textContent = fallas.length + ' registros';

    const canEdit = AUTH.can('changeStatus');
    tbody.innerHTML = fallas.map(f => `
      <tr class="${UI.rowClass(f.estatus)}">
        <td class="td-folio">${f.folio}</td>
        <td class="td-strong">${f.unidad}</td>
        <td>${UI.empresaBadgeHTML(f.empresa)}</td>
        <td>${f.base || '—'}</td>
        <td>${f.servicio || '—'}</td>
        <td>${f.tipo || '—'}</td>
        <td><span style="color:var(--cyan);font-size:11px">${f.proveedor || '—'}</span></td>
        <td>${f.categoria || '—'}</td>
        <td>${f.componente || '—'}</td>
        <td><span style="color:${UI.prioColor(f.prioridad)};font-weight:700;font-size:11px">${f.prioridad || '—'}</span></td>
        <td style="font-family:var(--mono);font-size:11px;color:var(--text3)">${UI.fmtDate(f.fecha)}</td>
        <td>${f.tecnico || '—'}</td>
        <td><span class="badge ${UI.badgeClass(f.estatus)}">${f.estatus}</span></td>
        <td style="font-family:var(--mono);font-size:11px;color:var(--green)">${f.fechaAtencion ? UI.fmtDate(f.fechaAtencion) : '—'}</td>
        <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis">${f.resultado || '—'}</td>
        ${canEdit ? `<td style="white-space:nowrap">
          <button class="btn btn-ghost btn-sm" onclick="MODS.selAtencionFromDash('${f.id}')">Editar</button>
          <button class="btn btn-danger btn-sm" style="margin-left:4px" onclick="MODS.eliminarDesideDash('${f.id}')" title="Eliminar">🗑</button>
        </td>` : ''}
      </tr>
    `).join('') || '<tr><td colspan="16" style="text-align:center;padding:30px;color:var(--text3)">Sin registros</td></tr>';
  }

  function selAtencionFromDash(id) {
    // Ir a módulo atencion y abrir el detalle directo (funciona aunque el registro
    // sea vandalizado y no aparezca en el panel de pendientes)
    APP.showModule('atencion').then ? 
      APP.showModule('atencion').then(() => setTimeout(() => selAtencion(id), 150)) :
      (APP.showModule('atencion'), setTimeout(() => selAtencion(id), 150));
  }

  function eliminarDesideDash(id) {
    const f = DATA.state.fallas.find(x => x.id === id);
    if (!f) return;
    if (!confirm(`¿Eliminar el reporte ${f.folio} (Ud. ${f.unidad})? Esta acción no se puede deshacer.`)) return;
    DATA.eliminarReporte(id).then(() => {
      UI.toast(`Reporte ${f.folio} eliminado`);
      UI.updateHeaderCounts();
      APP.showModule('dashboard');
    }).catch(err => UI.toast(err.message || 'No se pudo eliminar', 'err'));
  }

  function clearFilters() {
    mf.dash = { empresas:[], bases:[], estados:[], prioridades:[], tipos:[], proveedores:[], tecnicos:[] };
    const srch = document.getElementById('dbSearch');
    if (srch) srch.value = '';
    APP.showModule('dashboard');
    setTimeout(initDashboard, 50);
  }

  function exportCSV() {
    const fallas = getPeriodoFallas();
    const headers = ['Folio','Unidad','Empresa','Base','Servicio','Piso','Tipo','Proveedor','Categoría','Componente','Descripción','Prioridad','Fecha','Técnico','Estatus','Fecha Atención','Resultado'];
    const rows = fallas.map(f => [
      f.folio, f.unidad, f.empresa, f.base, f.servicio, f.piso, f.tipo, f.proveedor||'', f.categoria, f.componente,
      (f.descripcion||'').replace(/,/g,';'), f.prioridad, f.fecha, f.tecnico, f.estatus, f.fechaAtencion||'', (f.resultado||'').replace(/,/g,';')
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `CCTV_Export_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    UI.toast('CSV exportado');
  }

  // ══════════════════════════════════════════
  //  MÓDULO 4 — ATENDIDOS
  //  Filtro por empresa con lógica individual/general
  // ══════════════════════════════════════════
  function renderAtendidos(session) {
    const session2 = AUTH.checkSession();
    const allEmps  = (session2 && session2.empresas) ? session2.empresas : DATA.state.empresas;
    const empOpts  = allEmps.map(e => { const clr = DATA.getEmpresaColor(e); return { value: e, label: e, color: clr.hex }; });
    const tecOpts  = [...new Set(DATA.state.fallas.map(f=>f.tecnico).filter(Boolean))].map(t=>({value:t,label:t}));
    const baseOpts = [...new Set(DATA.state.fallas.map(f=>f.base).filter(Boolean))].map(b=>({value:b,label:b}));

    const msEmpA  = UI.buildMultiSelect({ id:'atMsEmp',  options: empOpts,  selected: mf.aten.empresas, placeholder:'Todas las empresas', onChange: v=>{mf.aten.empresas=v;renderAtendidosTable();}, colorDot:true });
    const msBaseA = UI.buildMultiSelect({ id:'atMsBase', options: baseOpts, selected: mf.aten.bases,    placeholder:'Todas las bases',    onChange: v=>{mf.aten.bases=v;renderAtendidosTable();} });
    const msTecA  = UI.buildMultiSelect({ id:'atMsTec',  options: tecOpts,  selected: mf.aten.tecnicos, placeholder:'Todos los técnicos', onChange: v=>{mf.aten.tecnicos=v;renderAtendidosTable();} });

    return `
    <div id="mod-atendidos" class="module active">
      <div class="mod-header">
        <div class="mod-title-wrap">
          <h2 class="mod-title">Historial de Atendidos</h2>
          <span class="mod-subtitle">Registro de unidades atendidas con filtro por período</span>
        </div>
        <div class="mod-header-right">
          <button class="btn btn-ghost btn-sm" onclick="MODS.exportAtendidosCSV()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Exportar CSV
          </button>
        </div>
      </div>

      <!-- Filtros período + empresa -->
      <div class="card" style="padding:14px 16px;margin-bottom:14px">
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
          ${['Hoy','Semana','Mes','Año','Todo'].map(p => `<button class="btn btn-ghost btn-sm atend-period-btn" data-p="${p.toLowerCase()}" onclick="MODS.setAtendPeriodo('${p.toLowerCase()}')" style="font-size:11px">${p}</button>`).join('')}
          <input type="date" id="atendFechaDesde" class="filter-input" style="font-size:11px;flex:1;min-width:130px" onchange="MODS.renderAtendidosTable()">
          <span style="color:var(--text3);align-self:center">—</span>
          <input type="date" id="atendFechaHasta" class="filter-input" style="font-size:11px;flex:1;min-width:130px" onchange="MODS.renderAtendidosTable()">
          <input type="text" class="filter-input filter-search" id="atendSearch" placeholder="🔍 Buscar unidad / folio..." oninput="MODS.renderAtendidosTable()" style="flex:1;min-width:160px">
        </div>
        <!-- Multi-selects por empresa/base/técnico en fila horizontal -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px">
          <div><div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Empresa</div>${msEmpA.html}</div>
          <div><div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Base</div>${msBaseA.html}</div>
          <div><div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Técnico</div>${msTecA.html}</div>
        </div>
      </div>

      <!-- KPIs de atendidos -->
      <div id="atendKpis" style="display:flex;gap:12px;margin-bottom:14px;flex-wrap:wrap"></div>

      <!-- Tabla atendidos -->
      <div class="card">
        <div class="card-hdr card-hdr-between">
          <div style="display:flex;align-items:center;gap:8px">
            <div class="card-icon card-icon-green"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></div>
            <span class="card-title">Unidades Atendidas</span>
            <span class="db-count-badge" id="atendCount"></span>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="MODS.clearAtendFilters()">Limpiar filtros</button>
        </div>
        <div class="table-wrap" style="max-height:420px;overflow-y:auto;overflow-x:auto">
          <table class="data-table">
            <thead><tr>
              <th>Folio</th><th>Unidad</th><th>Empresa</th><th>Base</th>
              <th>Tipo</th><th>Proveedor</th><th>Categoría</th><th>Componente</th>
              <th>Técnico</th><th>Fecha Registro</th><th>Fecha Atención</th><th>Tiempo Respuesta</th><th># Tickets</th><th>Resultado</th>
            </tr></thead>
            <tbody id="atendTbody"></tbody>
          </table>
        </div>
      </div>
    </div>`;
  }

  function setAtendPeriodo(p) {
    const now    = new Date();
    let desde    = null;
    let hasta    = null;

    if (p === 'hoy') {
      desde = new Date(now); desde.setHours(0,0,0,0);
      hasta = new Date(now); hasta.setHours(23,59,59,999);
    } else if (p === 'semana') {
      desde = new Date(now); desde.setDate(now.getDate() - now.getDay()); desde.setHours(0,0,0,0);
      hasta = new Date(now); hasta.setHours(23,59,59,999);
    } else if (p === 'mes') {
      desde = new Date(now.getFullYear(), now.getMonth(), 1);
      hasta = new Date(now); hasta.setHours(23,59,59,999);
    } else if (p === 'año') {
      desde = new Date(now.getFullYear(), 0, 1);
      hasta = new Date(now); hasta.setHours(23,59,59,999);
    }

    const dEl = document.getElementById('atendFechaDesde');
    const hEl = document.getElementById('atendFechaHasta');
    if (dEl && desde) dEl.value = desde.toISOString().slice(0,10);
    if (hEl && hasta) hEl.value = hasta.toISOString().slice(0,10);
    if (p === 'todo') { if (dEl) dEl.value = ''; if (hEl) hEl.value = ''; }

    document.querySelectorAll('.atend-period-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.p === p);
      b.style.background  = b.dataset.p === p ? 'rgba(79,142,247,0.15)' : '';
      b.style.borderColor = b.dataset.p === p ? 'rgba(79,142,247,0.4)' : '';
    });

    renderAtendidosTable();
  }

  function renderAtendidosTable() {
    const tbody  = document.getElementById('atendTbody');
    if (!tbody) return;

    // Attach multi-select events if not yet attached
    ['atMsEmp','atMsBase','atMsTec'].forEach(id => {
      const container = document.getElementById(id + '_ms');
      if (container && !container.dataset.wired) {
        container.dataset.wired = '1';
        attachMultiSelectEvents(id, v => {
          if (id === 'atMsEmp')  mf.aten.empresas = v;
          if (id === 'atMsBase') mf.aten.bases    = v;
          if (id === 'atMsTec')  mf.aten.tecnicos = v;
          renderAtendidosTable();
        });
      }
    });

    const session = AUTH.checkSession();
    let fallas = DATA.state.fallas.filter(f => _isAtendidoEst(f.estatus, f.empresa));

    if (session && session.empresas && session.empresas.length > 0) {
      fallas = fallas.filter(f => session.empresas.includes(f.empresa));
    }

    // Respetar modo individual/general del header
    if (DATA.state.viewMode === 'individual' && mf.aten.empresas.length === 0) {
      fallas = fallas.filter(f => f.empresa === DATA.state.currentEmpresa);
    }

    const desde   = document.getElementById('atendFechaDesde')?.value;
    const hasta   = document.getElementById('atendFechaHasta')?.value;
    const search  = document.getElementById('atendSearch')?.value.toLowerCase() || '';

    if (desde)               fallas = fallas.filter(f => { const fa = f.fechaAtencion || f.fecha; return fa && fa.slice(0,10) >= desde; });
    if (hasta)               fallas = fallas.filter(f => { const fa = f.fechaAtencion || f.fecha; return fa && fa.slice(0,10) <= hasta; });
    if (mf.aten.empresas.length) fallas = fallas.filter(f => mf.aten.empresas.includes(f.empresa));
    if (mf.aten.bases.length)    fallas = fallas.filter(f => mf.aten.bases.includes(f.base));
    if (mf.aten.tecnicos.length) fallas = fallas.filter(f => mf.aten.tecnicos.includes(f.tecnico));
    if (search)              fallas = fallas.filter(f => (f.folio+f.unidad).toLowerCase().includes(search));

    fallas.sort((a,b) => new Date(b.fechaAtencion||b.fecha||0) - new Date(a.fechaAtencion||a.fecha||0));

    const cnt = document.getElementById('atendCount');
    if (cnt) cnt.textContent = fallas.length + ' registros';

    const kpis = document.getElementById('atendKpis');
    if (kpis) {
      const byTecnico = {};
      fallas.forEach(f => { if (f.tecnico) { byTecnico[f.tecnico] = (byTecnico[f.tecnico]||0)+1; } });
      const topTec = Object.entries(byTecnico).sort((a,b)=>b[1]-a[1]).slice(0,3);
      kpis.innerHTML = [
        { label: 'Total Atendidos', val: fallas.length, r:34,g:197,b:94 },
        { label: 'Correctivos',     val: fallas.filter(f=>f.tipo==='Correctivo').length, r:239,g:68,b:68 },
        { label: 'Preventivos',     val: fallas.filter(f=>f.tipo==='Preventivo').length, r:34,g:197,b:94 },
      ].map(k => `<div class="kpi-card" style="flex:0 0 auto;padding:10px 18px;--kpi-r:${k.r};--kpi-g:${k.g};--kpi-b:${k.b}">
        <div class="kpi-val" style="color:rgb(${k.r},${k.g},${k.b});font-size:22px">${k.val}</div>
        <div class="kpi-lbl">${k.label}</div>
      </div>`).join('') +
      (topTec.length ? `<div class="kpi-card" style="flex:1;padding:10px 18px">
        <div class="kpi-lbl" style="margin-bottom:6px">Top Técnicos</div>
        ${topTec.map(([t,c]) => `<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0"><span style="color:var(--text2)">${t}</span><span style="color:var(--accent);font-family:var(--mono)">${c}</span></div>`).join('')}
      </div>` : '');
    }

    tbody.innerHTML = fallas.map(f => {
      let tiempoResp = '—';
      if (f.fecha && f.fechaAtencion) {
        const ms  = new Date(f.fechaAtencion) - new Date(f.fecha);
        const hrs = Math.floor(ms / 3600000);
        const min = Math.floor((ms % 3600000) / 60000);
        tiempoResp = hrs > 0 ? `${hrs}h ${min}m` : `${min}m`;
      }
      const ticketCount = DATA.state.fallas.filter(x => x.unidad === f.unidad && x.empresa === f.empresa).length;
      const highFreq = ticketCount >= 3;
      return `<tr class="${UI.rowClass(f.estatus)}">
        <td class="td-folio">${f.folio}</td>
        <td class="td-strong">${f.unidad}</td>
        <td>${UI.empresaBadgeHTML(f.empresa)}</td>
        <td>${f.base || '—'}</td>
        <td>${f.tipo || '—'}</td>
        <td><span style="color:var(--cyan);font-size:11px">${f.proveedor || '—'}</span></td>
        <td>${f.categoria || '—'}</td>
        <td>${f.componente || '—'}</td>
        <td style="font-weight:600">${f.tecnico || '—'}</td>
        <td style="font-family:var(--mono);font-size:11px;color:var(--text3)">${UI.fmtDate(f.fecha)}</td>
        <td style="font-family:var(--mono);font-size:11px;color:var(--green)">${f.fechaAtencion ? UI.fmtDate(f.fechaAtencion) : '—'}</td>
        <td style="font-family:var(--mono);font-size:11px;color:var(--amber)">${tiempoResp}</td>
        <td><span style="font-family:var(--mono);font-size:12px;font-weight:700;color:${highFreq?'var(--red)':'var(--text2)'};${highFreq?'background:var(--red-bg);padding:2px 7px;border-radius:4px;border:1px solid rgba(239,68,68,0.25)':''}" title="${ticketCount} ticket${ticketCount!==1?'s':''} en total">${ticketCount}${highFreq?' ⚠':''}</span></td>
        <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis">${f.resultado || '—'}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="14" style="text-align:center;padding:30px;color:var(--text3)">Sin registros atendidos en el período seleccionado</td></tr>';
  }

  function clearAtendFilters() {
    mf.aten = { empresas:[], bases:[], tecnicos:[] };
    APP.showModule('atendidos');
    setTimeout(() => renderAtendidosTable(), 50);
  }

  function exportAtendidosCSV() {
    const rows = [...document.querySelectorAll('#atendTbody tr')].map(tr =>
      [...tr.querySelectorAll('td')].map(td => `"${td.textContent.trim()}"`).join(',')
    );
    const headers = '"Folio","Unidad","Empresa","Base","Tipo","Proveedor","Categoría","Componente","Técnico","Fecha Registro","Fecha Atención","Tiempo Respuesta","# Tickets","Resultado"';
    const csv = [headers, ...rows].join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `CCTV_Atendidos_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    UI.toast('CSV de atendidos exportado');
  }

  // ══════════════════════════════════════════
  //  MÓDULO 5 — CONFIGURACIÓN
  //  + Eliminación por módulo por empresa
  //  + Modal de edición personalizado (sin prompt nativo)
  //  + Botón reset completo del sistema
  // ══════════════════════════════════════════
  function renderConfig(session) {
    const emp     = DATA.state.currentEmpresa;
    const canEdit = AUTH.can('viewConfig');
    const sections = [
      { key: 'base',      label: 'Bases Operativas',        icon: '📍' },
      { key: 'servicio',  label: 'Tipos de Servicio',       icon: '🚌' },
      { key: 'estatus',   label: 'Estatus',                 icon: '🏷' },
      { key: 'tipo',      label: 'Tipos de Incidencia',     icon: '🔧' },
      { key: 'piso',      label: 'Opciones de Piso',        icon: '🏢' },
      { key: 'proveedor', label: 'Proveedores de Equipo',   icon: '📡' },
      { key: 'categoria', label: 'Categorías / Componentes',icon: '📷' },
    ];

    return `
    <div id="mod-config" class="module active">
      <div class="mod-header">
        <div class="mod-title-wrap">
          <h2 class="mod-title">Configuración</h2>
          <span class="mod-subtitle">Administra opciones, empresas y selectores — <strong style="color:var(--accent)">${emp}</strong></span>
        </div>
        ${canEdit ? `<button class="btn btn-primary btn-sm" style="margin-left:auto;gap:6px;display:flex;align-items:center" onclick="MODS.openBulkConfig()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
          Carga Masiva
        </button>` : ''}
      </div>

      <div class="config-layout">
        <div>
          <div class="card" style="margin-bottom:14px;padding:10px 14px">
            <p style="font-size:12px;color:var(--text2);background:var(--bg3);border-radius:var(--r);border-left:3px solid var(--accent);padding:8px 12px">
              💡 La empresa activa es <strong style="color:var(--accent)">${emp}</strong> · Todas las acciones aplican solo a esta empresa
            </p>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;margin-bottom:14px">
            ${sections.map(sec => {
              const items     = DATA.getSel(sec.key);
              const isCategoria = sec.key === 'categoria';
              return `
              <div class="card config-card-grid" style="cursor:pointer" onclick="MODS.toggleConfigGrid('${sec.key}')">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0" id="configHdr-${sec.key}">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="font-size:16px">${sec.icon}</span>
                    <span style="font-weight:600;font-size:13px">${sec.label}</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:8px">
                    <span class="config-count">${items.length}</span>
                    ${canEdit && items.length > 0 ? `<button class="btn btn-danger btn-sm" style="font-size:10px;padding:2px 8px" onclick="event.stopPropagation();MODS.clearModuleItems('${sec.key}')" title="Eliminar todos de ${emp}">🗑 Todo</button>` : ''}
                    <span id="configGridExp-${sec.key}" style="font-size:9px;color:var(--text3)">▼</span>
                  </div>
                </div>

                <div class="config-grid-body" id="configGridBody-${sec.key}" style="display:none;margin-top:12px">
                  <div class="config-items">
                    ${items.map((item, i) => `
                      <div class="config-item">
                        <span class="config-item-text">${item}</span>
                        ${canEdit ? `<div class="config-item-actions">
                          <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();MODS.editConfigItem('${sec.key}',${i})">✏</button>
                          <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();MODS.delConfigItem('${sec.key}',${i})">✕</button>
                        </div>` : ''}
                      </div>
                    `).join('')}
                  </div>
                  ${isCategoria ? buildComponentesSections(emp) : ''}
                  ${canEdit ? `<div class="config-add-row" onclick="event.stopPropagation()">
                    <input type="text" id="configAdd-${sec.key}" placeholder="Ej: TAP, MTY, SATURNO (separar con coma)" onclick="event.stopPropagation()" onkeydown="if(event.key==='Enter'){event.stopPropagation();MODS.addConfigItem('${sec.key}')}">
                    <button class="btn btn-primary btn-sm" title="Puedes ingresar múltiples valores separados por coma" onclick="event.stopPropagation();MODS.addConfigItem('${sec.key}')">+ Agregar</button>
                  </div>` : ''}
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>

        <!-- Empresas panel -->
        <div class="card" style="align-self:start">
          <div class="card-hdr">
            <div class="card-icon card-icon-green"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>
            <span class="card-title">Empresas del Sistema</span>
          </div>
          <div id="configEmpresasList" style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">
            ${DATA.state.empresas.map((e) => {
              const clr   = DATA.getEmpresaColor(e);
              const cnt   = DATA.state.fallas.filter(f => f.empresa === e).length;
              const isCore = DATA.DEFAULT_EMPRESAS.includes(e);
              const isMaster = session && session.role === 'master';
              return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r)">
                <div style="display:flex;align-items:center;gap:8px;font-weight:700;font-size:13px;font-family:var(--mono)">
                  <span style="width:8px;height:8px;border-radius:50%;background:${clr.hex}"></span>${e}
                  ${isCore ? '<span style="font-size:9px;color:var(--text3);font-family:var(--font)">core</span>' : ''}
                </div>
                <div style="display:flex;align-items:center;gap:6px">
                  <span style="font-size:11px;color:var(--text3)">${cnt} reg.</span>
                  ${isMaster ? `<button class="btn btn-ghost btn-sm" title="Renombrar empresa" onclick="MODS.renameEmpresa('${e}')">✏</button>` : ''}
                  ${!isCore && AUTH.can('manageUsers') ? `<button class="btn btn-danger btn-sm" onclick="MODS.delEmpresa('${e}')">✕</button>` : ''}
                </div>
              </div>`;
            }).join('')}
          </div>
          ${AUTH.can('viewConfig') ? `<div class="config-add-row">
            <input type="text" id="configAddEmpresa" placeholder="Nueva empresa..." onkeydown="if(event.key==='Enter')MODS.addEmpresa()">
            <button class="btn btn-primary btn-sm" onclick="MODS.addEmpresa()">+ Agregar</button>
          </div>` : ''}
        </div>

        <!-- Data Management panel (Master only) -->
        ${AUTH.can('manageUsers') ? `<div class="card" style="align-self:start;border:1px solid rgba(239,68,68,0.2)">
          <div class="card-hdr">
            <div class="card-icon" style="background:var(--red-bg);border-color:rgba(239,68,68,0.2);color:var(--red)"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg></div>
            <span class="card-title" style="color:var(--red)">Gestión de Datos</span>
          </div>
          <p style="font-size:11.5px;color:var(--text3);margin-bottom:14px;line-height:1.5">Zona de peligro — Estas acciones son irreversibles.</p>
          <div style="display:flex;flex-direction:column;gap:10px">
            <div style="padding:10px;background:var(--bg3);border-radius:var(--r);border:1px solid var(--border)">
              <p style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:8px">Borrar reportes por empresa</p>
              <div style="display:flex;gap:8px;align-items:center">
                <div class="select-wrap" style="flex:1">
                  <select id="clearEmpresaSel">
                    ${DATA.state.empresas.map(e => `<option>${e}</option>`).join('')}
                  </select>
                </div>
                <button class="btn btn-danger btn-sm" onclick="MODS.clearEmpresaData()">Borrar</button>
              </div>
            </div>
            <button class="btn btn-danger" style="width:100%" onclick="MODS.clearAllData()">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
              Borrar TODOS los registros
            </button>
            <!-- Botón reset completo del sistema -->
            <div style="margin-top:4px;padding:10px;background:rgba(239,68,68,0.05);border:2px dashed rgba(239,68,68,0.35);border-radius:var(--r)">
              <p style="font-size:11px;color:var(--red);margin-bottom:8px;font-weight:700">⚠ RESTABLECIMIENTO COMPLETO DEL SISTEMA</p>
              <p style="font-size:11px;color:var(--text3);margin-bottom:10px;line-height:1.5">Elimina TODA la información del sistema: usuarios, registros, configuraciones y catálogos. Restaura el sistema a estado inicial limpio. <strong style="color:var(--red)">Exclusivo para Administrador Master.</strong></p>
              <button class="btn btn-danger" style="width:100%;border:2px solid rgba(239,68,68,0.5)" onclick="MODS.resetSystem()">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                Restablecer Sistema Completo
              </button>
            </div>
          </div>
        </div>` : ''}
      </div>
    </div>`;
  }

  function toggleConfigGrid(key) {
    const body = document.getElementById('configGridBody-' + key);
    const icon = document.getElementById('configGridExp-' + key);
    if (!body) return;
    const open = body.style.display !== 'none';
    document.querySelectorAll('[id^="configGridBody-"]').forEach(b => { b.style.display = 'none'; });
    document.querySelectorAll('[id^="configGridExp-"]').forEach(i => { i.textContent = '▼'; });
    if (!open) {
      body.style.display = '';
      if (icon) icon.textContent = '▲';
    }
  }

  function toggleConfigSec(key) { toggleConfigGrid(key); }

  function buildComponentesSections(emp) {
    const cats = DATA.getSel('categoria', emp);
    if (!cats.length) return '';
    return `<div style="margin:10px 0 6px;padding:10px;background:var(--bg);border-radius:var(--r);border:1px solid var(--border)">
      <p style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Componentes por Categoría</p>
      ${cats.map(cat => {
        const comps  = DATA.getComponentes(cat, emp);
        const catKey = cat.replace(/\s/g,'_');
        return `<div style="margin-bottom:8px;padding:8px;background:var(--bg2);border-radius:var(--r);border:1px solid var(--border)">
          <p style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:6px">${cat}</p>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px">
            ${comps.map((c,ci) => `<span style="background:var(--bg3);border:1px solid var(--border);color:var(--text2);font-size:11px;padding:2px 8px;border-radius:4px;display:inline-flex;align-items:center;gap:4px">
              ${c}
              ${AUTH.can('viewConfig') ? `<button onclick="event.stopPropagation();MODS.delComponente('${emp}','${cat}',${ci})" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:10px;padding:0 2px">✕</button>` : ''}
            </span>`).join('')}
          </div>
          ${AUTH.can('viewConfig') ? `<div style="display:flex;gap:6px" onclick="event.stopPropagation()">
            <input type="text" id="configAddComp-${catKey}" placeholder="Ej: Comp A, Comp B (coma=múltiples)" style="flex:1;font-size:12px" onclick="event.stopPropagation()" onkeydown="if(event.key==='Enter'){event.stopPropagation();MODS.addComponente('${emp}','${cat}')}">
            <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();MODS.addComponente('${emp}','${cat}')">+</button>
          </div>` : ''}
        </div>`;
      }).join('')}
    </div>`;
  }


  // ══════════════════════════════════════════════════════
  // CARGA MASIVA DE SELECTORES — múltiples empresas
  // ══════════════════════════════════════════════════════
  function openBulkConfig() {
    const empresas  = DATA.state.empresas || [];
    const sections  = [
      { key: 'base',      label: '📍 Bases Operativas' },
      { key: 'servicio',  label: '🚌 Tipos de Servicio' },
      { key: 'estatus',   label: '🏷 Estatus' },
      { key: 'tipo',      label: '🔧 Tipos de Incidencia' },
      { key: 'piso',      label: '🏢 Opciones de Piso' },
      { key: 'proveedor', label: '📡 Proveedores de Equipo' },
      { key: 'categoria', label: '📷 Categorías' },
    ];

    UI.openModal(`
      <h3 class="modal-title">Carga Masiva de Configuración</h3>
      <p style="font-size:12px;color:var(--text3);margin-bottom:16px">Agrega items a múltiples empresas a la vez. Solo se añaden los que no existan — no reemplaza lo que ya hay.</p>

      <div class="form-group">
        <label>Tipo de selector</label>
        <div class="select-wrap">
          <select id="bulkKey">
            ${sections.map(s => `<option value="${s.key}">${s.label}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="form-group">
        <label>Items a agregar <span style="color:var(--text3);font-weight:400">(separar con coma)</span></label>
        <textarea id="bulkItems" rows="4" placeholder="Ej: GDLJ, TAP, MTY, PUEB" style="width:100%;resize:vertical;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:8px 10px;color:var(--text1);font-family:var(--mono);font-size:12px"></textarea>
      </div>

      <div class="form-group">
        <label>Aplicar a empresas</label>
        <div style="display:flex;flex-wrap:wrap;gap:6px;padding:10px;background:var(--bg3);border-radius:var(--r);border:1px solid var(--border)" id="bulkEmpresasChips">
          ${empresas.map(e => {
            const clr = DATA.getEmpresaColor(e);
            return `<div class="chip active" data-emp="${e}" style="--chip-r:${clr.r};--chip-g:${clr.g};--chip-b:${clr.b};cursor:pointer" onclick="this.classList.toggle('active')">${e}</div>`;
          }).join('')}
        </div>
        <div style="display:flex;gap:8px;margin-top:6px">
          <button class="btn btn-ghost btn-sm" onclick="document.querySelectorAll('#bulkEmpresasChips .chip').forEach(c=>c.classList.add('active'))">Todas</button>
          <button class="btn btn-ghost btn-sm" onclick="document.querySelectorAll('#bulkEmpresasChips .chip').forEach(c=>c.classList.remove('active'))">Ninguna</button>
        </div>
      </div>

      <div id="bulkPreview" style="display:none;margin-bottom:12px;padding:10px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);font-size:11px;font-family:var(--mono);color:var(--text2)"></div>

      <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">
        <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
        <button class="btn btn-ghost btn-sm" onclick="MODS.previewBulkConfig()">👁 Vista previa</button>
        <button class="btn btn-primary" onclick="MODS.doBulkConfig()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
          Aplicar carga masiva
        </button>
      </div>
    `);
  }

  function previewBulkConfig() {
    const key      = document.getElementById('bulkKey')?.value;
    const raw      = document.getElementById('bulkItems')?.value || '';
    const empresas = [...document.querySelectorAll('#bulkEmpresasChips .chip.active')].map(c => c.dataset.emp);
    const values   = raw.split(',').map(v => v.trim()).filter(Boolean);
    const preview  = document.getElementById('bulkPreview');
    if (!preview) return;

    if (!values.length || !empresas.length) {
      preview.style.display = 'block';
      preview.innerHTML = '<span style="color:#f59e0b">⚠ Ingresa items y selecciona al menos una empresa</span>';
      return;
    }

    const lines = empresas.map(emp => {
      const existing = DATA.getSel(key, emp);
      const nuevos   = values.filter(v => !existing.includes(v));
      const duplos   = values.filter(v =>  existing.includes(v));
      return `<div style="margin-bottom:4px"><strong style="color:var(--accent)">${emp}</strong> → ` +
        (nuevos.length ? `<span style="color:var(--green)">+${nuevos.join(', ')}</span>` : '<span style="color:var(--text3)">sin cambios</span>') +
        (duplos.length ? ` <span style="color:var(--text3)">(ya existen: ${duplos.join(', ')})</span>` : '') +
        '</div>';
    });

    preview.style.display = 'block';
    preview.innerHTML = '<div style="font-weight:600;margin-bottom:6px;color:var(--text2)">Vista previa:</div>' + lines.join('');
  }

  async function doBulkConfig() {
    const key      = document.getElementById('bulkKey')?.value;
    const raw      = document.getElementById('bulkItems')?.value || '';
    const empresas = [...document.querySelectorAll('#bulkEmpresasChips .chip.active')].map(c => c.dataset.emp);
    const values   = raw.split(',').map(v => v.trim()).filter(Boolean);

    if (!values.length) { UI.toast('Ingresa al menos un item', 'err'); return; }
    if (!empresas.length) { UI.toast('Selecciona al menos una empresa', 'err'); return; }

    const session = AUTH.checkSession();
    let totalAgregados = 0, totalSkipped = 0;

    for (const emp of empresas) {
      if (!DATA.state.selectores[emp]) continue;
      for (const val of values) {
        const lista = DATA.state.selectores[emp][key];
        if (!Array.isArray(lista)) continue;
        if (lista.includes(val)) { totalSkipped++; continue; }
        try {
          await DS.upsertSelectorItem(emp, key, val, { usuario: session ? session.username : 'sistema' });
          lista.push(val);
          totalAgregados++;
        } catch(e) {
          UI.toast(`Error al guardar "${val}" en ${emp}: ${e.message}`, 'err');
        }
      }
    }

    UI.closeModal();
    await APP.showModule('config');

    const msg = totalAgregados > 0
      ? `✅ ${totalAgregados} item${totalAgregados>1?'s':''} agregado${totalAgregados>1?'s':''} en ${empresas.length} empresa${empresas.length>1?'s':''}`
      : `Sin cambios — todos los items ya existían`;
    UI.toast(msg + (totalSkipped ? ` (${totalSkipped} duplicados ignorados)` : ''), totalAgregados > 0 ? 'ok' : 'warn');
  }

  async function addConfigItem(key) {
    const input = document.getElementById('configAdd-' + key);
    const raw   = input?.value.trim();
    if (!raw) { UI.toast('Escribe un valor', 'err'); return; }
    const emp  = DATA.state.currentEmpresa;
    if (!DATA.state.selectores[emp]) {
      UI.toast('Error: selectores no cargados para ' + emp, 'err'); return;
    }
    const opts = DATA.state.selectores[emp][key];
    if (!Array.isArray(opts)) {
      UI.toast('Error: sección "' + key + '" no encontrada', 'err'); return;
    }
    const session = AUTH.checkSession();
    const values = raw.split(',').map(v => v.trim()).filter(v => v.length > 0);
    const added = [], skipped = [];
    for (const val of values) {
      if (opts.includes(val)) { skipped.push(val); continue; }
      try {
        await DS.upsertSelectorItem(emp, key, val, { usuario: session ? session.username : 'sistema' });
        opts.push(val);
        if (key === 'categoria') DATA.state.selectores[emp].componente[val] = [];
        added.push(val);
      } catch(e) {
        UI.toast('Error al guardar "' + val + '": ' + (e.message || e), 'err');
        console.error('addConfigItem error:', e);
        return;
      }
    }
    if (added.length === 0) {
      UI.toast(skipped.length > 0 ? `Ya existen: ${skipped.join(', ')}` : 'Sin valores válidos', 'err');
      return;
    }
    await AUTH.log('CONFIG_EDIT', `Opciones agregadas en ${key}: ${added.join(', ')}`);
    if (input) input.value = '';
    const msg = added.length === 1
      ? `"${added[0]}" agregado`
      : `${added.length} opciones agregadas${skipped.length ? ` (${skipped.length} ya existían)` : ''}`;
    // Re-render y mantener panel abierto
    await APP.showModule('config');
    MODS.toggleConfigGrid(key);
    UI.toast(msg);
  }

  async function delConfigItem(key, idx) {
    const emp  = DATA.state.currentEmpresa;
    const opts = DATA.state.selectores[emp][key];
    const val  = opts?.[idx];
    if (!val) return;

    // Validar uso en reportes antes de confirmar
    const enUso = DATA.state.fallas.filter(
      f => f.empresa === emp && f.is_active !== false && f[key] === val
    );
    const advertencia = enUso.length > 0
      ? `<br><br>⚠ <strong>${enUso.length} reporte(s)</strong> usan esta opción actualmente.`
      : '';

    const ok = await UI.showConfirm({
      title: 'Eliminar opción',
      message: `¿Eliminar <strong>"${val}"</strong> de ${key}?${advertencia}`,
      confirmText: 'Eliminar',
      danger: true
    });
    if (!ok) return;

    const session = AUTH.checkSession();
    try {
      await DS.deleteSelectorItem(emp, key, val, {
        usuario: session ? session.username : 'sistema',
        force: true, // el usuario ya confirmó
      });
    } catch (e) {
      UI.toast(e.message, 'err'); return;
    }

    // Reflejo local
    if (key === 'categoria') delete DATA.state.selectores[emp].componente[val];
    opts.splice(idx, 1);
    await AUTH.log('CONFIG_EDIT', `Opción eliminada en ${key}: ${val}`);
    await APP.showModule('config');
    UI.toast('Opción eliminada');
  }

  async function clearModuleItems(key) {
    const emp  = DATA.state.currentEmpresa;
    const opts = DATA.state.selectores[emp]?.[key];
    if (!opts || opts.length === 0) { UI.toast('No hay items para eliminar', 'warn'); return; }
    const ok = await UI.showConfirm({
      title: `Eliminar todo — ${key}`,
      message: `¿Eliminar <strong>todos los ${opts.length} items</strong> de "${key}" para la empresa <strong>${emp}</strong>?`,
      confirmText: 'Eliminar todos',
      danger: true
    });
    if (!ok) return;
    const session = AUTH.checkSession();
    // Actualizar selectores via DS
    if (key === 'categoria') DATA.state.selectores[emp].componente = {};
    DATA.state.selectores[emp][key] = [];
    await DS.saveSelectores(DATA.state.selectores);
    await AUTH.log('CONFIG_CLEAR', `Todos los items de ${key} eliminados para ${emp}`, session ? session.username : 'sistema');
    await APP.showModule('config');
    UI.toast(`Items de "${key}" eliminados para ${emp}`);
  }

  async function editConfigItem(key, idx) {
    const opts  = DATA.state.selectores[DATA.state.currentEmpresa][key];
    const old   = opts?.[idx];
    if (!old) return;

    const nuevo = await UI.showPrompt({
      title: `Editar opción — ${key}`,
      label: 'Nuevo valor',
      value: old,
      placeholder: 'Escribe el nuevo valor',
      validate: (v) => {
        if (v === old) return null; // no change is fine
        if (opts.includes(v)) return `"${v}" ya existe`;
        return null;
      }
    });
    if (!nuevo || nuevo === old) return;
    const trimmed = nuevo.trim();
    const emp = DATA.state.currentEmpresa;
    const session = AUTH.checkSession();

    // Actualizar en la tabla relacional de Supabase
    try {
      await DS.updateSelectorItem(emp, key, old, trimmed, { usuario: session ? session.username : 'sistema' });
    } catch(e) {
      UI.toast('Error al actualizar: ' + (e.message || e), 'err');
      return;
    }

    // Reflejo local en memoria
    opts[idx] = trimmed;
    if (key === 'categoria' && DATA.state.selectores[emp].componente[old]) {
      DATA.state.selectores[emp].componente[trimmed] = DATA.state.selectores[emp].componente[old];
      delete DATA.state.selectores[emp].componente[old];
    }
    await DATA.persistAll();
    await APP.showModule('config');
    UI.toast('Opción actualizada');
  }

  async function addComponente(emp, cat) {
    const catKey = cat.replace(/\s/g,'_');
    const input  = document.getElementById('configAddComp-' + catKey);
    const raw    = input?.value.trim();
    if (!raw) { UI.toast('Escribe un componente', 'err'); return; }
    if (!DATA.state.selectores[emp].componente[cat]) DATA.state.selectores[emp].componente[cat] = [];
    const list = DATA.state.selectores[emp].componente[cat];
    const values = raw.split(',').map(v => v.trim()).filter(v => v.length > 0);
    const added = [], skipped = [];
    const session = AUTH.checkSession();
    for (const val of values) {
      if (list.includes(val)) { skipped.push(val); continue; }
      try {
        await DS.upsertSelectorItem(emp, 'componente', val, { categoria: cat, usuario: session ? session.username : 'sistema' });
        list.push(val);
        added.push(val);
      } catch(e) {
        UI.toast('Error al guardar "' + val + '": ' + (e.message || e), 'err');
        console.error('addComponente error:', e);
        return;
      }
    }
    if (added.length === 0) {
      UI.toast(skipped.length > 0 ? `Ya existen: ${skipped.join(', ')}` : 'Sin valores válidos', 'err');
      return;
    }
    if (input) input.value = '';
    const msg = added.length === 1
      ? `Componente "${added[0]}" agregado`
      : `${added.length} componentes agregados`;
    await APP.showModule('config');
    MODS.toggleConfigGrid('categoria');
    UI.toast(msg);
  }

  async function delComponente(emp, cat, cidx) {
    if (!DATA.state.selectores[emp]?.componente[cat]) return;
    const val = DATA.state.selectores[emp].componente[cat][cidx];
    const ok = await UI.showConfirm({
      title: 'Eliminar componente',
      message: `¿Eliminar <strong>"${val}"</strong> de la categoría "${cat}"?`,
      confirmText: 'Eliminar',
      danger: true
    });
    if (!ok) return;
    try {
      const session = AUTH.checkSession();
      await DS.deleteSelectorItem(emp, 'componente', val, { categoria: cat, force: true, usuario: session ? session.username : 'sistema' });
      DATA.state.selectores[emp].componente[cat].splice(cidx, 1);
    } catch(e) {
      UI.toast('Error al eliminar componente: ' + (e.message || e), 'err');
      console.error('delComponente error:', e);
      return;
    }
    await APP.showModule('config');
    UI.toast('Componente eliminado');
  }

  async function addEmpresa() {
    const input  = document.getElementById('configAddEmpresa');
    const nombre = (input?.value || '').trim();
    if (!nombre) { UI.toast('Escribe el nombre de la empresa', 'err'); return; }
    let result;
    try {
      result = await DATA.agregarEmpresa(nombre);
    } catch(e) {
      UI.toast('Error al crear empresa: ' + (e.message || e), 'err');
      console.error('addEmpresa error:', e);
      return;
    }
    if (!result.ok) { UI.toast(result.error, 'err'); return; }
    if (input) input.value = '';
    // Sync master session so new empresa appears in all filters immediately
    const session = AUTH.checkSession();
    if (session && (session.role === 'master' || session.role === 'admin')) {
      if (!session.empresas) session.empresas = [];
      if (!session.empresas.includes(result.nombre)) session.empresas.push(result.nombre);
      await AUTH.syncSessionEmpresas(DATA.state.empresas);
    }
    const sessionUpdated = AUTH.checkSession();
    UI.renderEmpresaStrip(sessionUpdated);
    await APP.showModule('config');
    UI.toast(`Empresa "${result.nombre}" agregada`);
  }

  async function renameEmpresa(nombre) {
    const session = AUTH.checkSession();
    if (!session || session.role !== 'master') { UI.toast('Solo el Administrador Master puede renombrar empresas', 'err'); return; }
    const nuevo = await UI.showPrompt({
      title: `Renombrar empresa`,
      label: 'Nuevo nombre',
      value: nombre,
      placeholder: 'Escribe el nuevo nombre',
      validate: (v) => {
        const val = v.trim().toUpperCase();
        if (!val) return 'El nombre no puede estar vacío';
        if (val === nombre) return null;
        if (DATA.state.empresas.includes(val)) return `"${val}" ya existe`;
        return null;
      }
    });
    if (!nuevo || nuevo.trim().toUpperCase() === nombre) return;
    const result = await DATA.renameEmpresa(nombre, nuevo);
    if (!result.ok) { UI.toast(result.error, 'err'); return; }
    // Sync session so renamed empresa appears correctly everywhere
    await AUTH.syncSessionEmpresas(DATA.state.empresas);
    const session2 = AUTH.checkSession();
    UI.renderEmpresaStrip(session2);
    await APP.showModule('config');
    UI.toast(`Empresa renombrada a "${result.newName}"`);
  }

  async function delEmpresa(nombre) {
    const ok = await UI.showConfirm({
      title: `Eliminar empresa`,
      message: `¿Eliminar la empresa <strong>"${nombre}"</strong>? Esta acción eliminará toda su configuración.`,
      confirmText: 'Eliminar',
      danger: true
    });
    if (!ok) return;
    const result = await DATA.eliminarEmpresa(nombre);
    if (!result.ok) { UI.toast(result.error, 'err'); return; }
    await AUTH.syncSessionEmpresas(DATA.state.empresas);
    const session = AUTH.checkSession();
    UI.renderEmpresaStrip(session);
    await APP.showModule('config');
    UI.toast(`Empresa "${nombre}" eliminada`);
  }

  async function clearEmpresaData() {
    const sel = document.getElementById('clearEmpresaSel');
    const emp = sel?.value;
    if (!emp) return;
    const ok = await UI.showConfirm({
      title: `Borrar reportes de ${emp}`,
      message: `¿Eliminar <strong>TODOS los reportes</strong> de la empresa <strong>${emp}</strong>? Esta acción es irreversible.`,
      confirmText: 'Borrar reportes',
      danger: true
    });
    if (!ok) return;
    const result = await AUTH.clearEmpresaData(emp);
    if (!result.ok) { UI.toast(result.error, 'err'); return; }
    // Reflejo local: remover de memoria los reportes soft-deleted de esa empresa
    DATA.state.fallas = DATA.state.fallas.filter(f => f.empresa !== emp);
    UI.toast(`${result.removed} registros de ${emp} eliminados`);
    UI.updateHeaderCounts();
    await APP.showModule('config');
  }

  async function clearAllData() {
    const ok1 = await UI.showConfirm({
      title: 'Borrar TODOS los registros',
      message: '⚠ ¿Eliminar <strong>absolutamente todos los reportes</strong> de la plataforma? Esta acción es <strong>IRREVERSIBLE</strong> y no puede deshacerse.',
      confirmText: 'Sí, borrar todo',
      danger: true
    });
    if (!ok1) return;
    const ok2 = await UI.showConfirm({
      title: 'Confirmar borrado total',
      message: 'Confirmación final: todos los datos de reportes serán eliminados permanentemente.',
      confirmText: 'Eliminar definitivamente',
      danger: true
    });
    if (!ok2) return;
    const result = await AUTH.clearAllData();
    if (!result.ok) { UI.toast(result.error, 'err'); return; }
    DATA.state.fallas = []; // limpiar reflejo local (los registros persisten como soft-deleted)
    UI.toast('Todos los registros han sido eliminados', 'warn');
    UI.updateHeaderCounts();
    await APP.showModule('config');
  }

  async function resetSystem() {
    const session = AUTH.checkSession();
    if (!session || session.role !== 'master') {
      UI.toast('Acción exclusiva para Administrador Master', 'err');
      return;
    }
    const ok1 = await UI.showConfirm({
      title: '⚠ Restablecimiento Completo del Sistema',
      message: 'Esta acción eliminará <strong>TODA</strong> la información del sistema:<br><br>• Usuarios (excepto tu cuenta actual)<br>• Todos los reportes<br>• Configuraciones y catálogos de todas las empresas<br><br>El sistema volverá a su estado inicial. <strong>Esta acción es completamente irreversible.</strong>',
      confirmText: 'Entiendo, restablecer',
      cancelText: 'Cancelar',
      danger: true
    });
    if (!ok1) return;
    const ok2 = await UI.showConfirm({
      title: 'Confirmación final',
      message: '¿Estás completamente seguro? Una vez confirmado, <strong>no hay vuelta atrás</strong>.',
      confirmText: 'Restablecer ahora',
      danger: true
    });
    if (!ok2) return;

    // Ejecutar reset via DS (audita y limpia todo)
    await DS.hardResetAll(session.username);

    // Restaurar estado local
    DATA.state.fallas     = [];
    const defaultSel = {};
    DATA.DEFAULT_EMPRESAS.forEach(e => { defaultSel[e] = DATA.buildEmpresaSelectores(); });
    DATA.state.selectores = defaultSel;
    DATA.state.empresas   = [...DATA.DEFAULT_EMPRESAS];

    // Conservar solo el usuario actual en memoria (DS ya limpió storage)
    const users = AUTH.getUsers();
    const newUsers = { list: users.filter(u => u.id === session.userId) };
    await DS.saveUsers(newUsers);
    // Restaurar sesión
    await DS.saveSession(session);

    await AUTH.log('SYSTEM_RESET', 'Restablecimiento completo del sistema ejecutado', session.username);
    UI.toast('Sistema restablecido a estado inicial', 'warn');
    UI.updateHeaderCounts();

    setTimeout(() => {
      window.location.reload();
    }, 1500);
  }

  // ══════════════════════════════════════════
  //  MÓDULO 6 — HISTORIAL (solo Master)
  // ══════════════════════════════════════════
  function renderHistorial(session) {
    const audit = AUTH.getAudit(500);
    const tipos = [...new Set(audit.map(a => a.tipo))];

    return `
    <div id="mod-historial" class="module active">
      <div class="mod-header">
        <div class="mod-title-wrap">
          <h2 class="mod-title">Historial de Movimientos</h2>
          <span class="mod-subtitle">Auditoría completa del sistema · Solo visible para Administrador Master · No editable</span>
        </div>
        <div class="mod-header-right">
          <span style="font-family:var(--mono);font-size:11px;color:var(--purple);background:var(--purple-bg);border:1px solid rgba(168,85,247,0.2);border-radius:6px;padding:3px 10px">${audit.length} registros</span>
        </div>
      </div>

      <div class="card">
        <div class="card-hdr card-hdr-between">
          <div style="display:flex;align-items:center;gap:8px">
            <div class="card-icon card-icon-purple"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
            <span class="card-title">Registro de Auditoría</span>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <select id="auditFilter" class="filter-select" onchange="MODS.filterAudit()" style="font-size:11px">
              <option value="">Todos los tipos</option>
              ${tipos.map(t => `<option>${t}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="audit-timeline" id="auditTimeline">
          ${renderAuditItems(audit)}
        </div>
      </div>
    </div>`;
  }

  function renderAuditItems(items) {
    if (!items.length) return '<div class="empty-state"><span class="empty-icon">📋</span><p class="empty-msg">Sin registros de auditoría</p></div>';
    return items.map(a => {
      const color = UI.auditTypeColor(a.tipo);
      const deviceInfo = a.device ? `<span class="device-badge">📱 ${a.device}</span>` : '';
      return `<div class="audit-item">
        <div class="audit-dot" style="background:${color}"></div>
        <div class="audit-body">
          <div class="audit-tipo" style="color:${color}">${a.tipo}</div>
          <div class="audit-det">${a.detalle} ${deviceInfo}</div>
          <div class="audit-meta">
            <span>${a.nombre || a.usuario}</span>
            <span>·</span>
            <span>${UI.fmtDt(a.fecha)}</span>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  function filterAudit() {
    const tipo     = document.getElementById('auditFilter')?.value || '';
    const all      = AUTH.getAudit(500);
    const filtered = tipo ? all.filter(a => a.tipo === tipo) : all;
    const tl = document.getElementById('auditTimeline');
    if (tl) tl.innerHTML = renderAuditItems(filtered);
  }

  function setRegistroMode(mode) {
    if (mode === 'bulk') {
      const main = document.getElementById('mainContent');
      if (main) {
        const session = AUTH.checkSession();
        main.innerHTML = BULK.renderCargaMasiva(session);
      }
    } else {
      APP.showModule('registro');
    }
  }

  return {
    renderRegistro, renderAtencion, renderDashboard, renderAtendidos, renderConfig, renderHistorial,
    setTechMode, setTechBase,
    initDashboard, renderDashTable, renderAtendidosTable, setAtendPeriodo, exportAtendidosCSV, clearAtendFilters,
    clearFilters, exportCSV,
    selAtencion, selAtencionFromDash, eliminarDesideDash, guardarAtencion, onAtenEstatusChange, eliminarAtencion,
    updateFolioPreview, selChip, selPrio, onCategoriaChange, limpiarRegistro, guardarRegistro,
    onBaseChangeRegistro, onTecnicoSelChange, getRegistroTecnicoValue,
    toggleConfigGrid, toggleConfigSec,
    openBulkConfig, previewBulkConfig, doBulkConfig,
    selectTecnico, _getSelectedTech: () => _techSelected,
    addConfigItem, delConfigItem, editConfigItem, clearModuleItems,
    addComponente, delComponente, addEmpresa, renameEmpresa, delEmpresa,
    clearEmpresaData, clearAllData, resetSystem,
    filterAudit, setRegistroMode
  };
})();
