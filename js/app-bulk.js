/* ═══════════════════════════════════════════════
   CCTV Fleet Control — Bulk Registration Module v1.0
   Carga masiva de unidades con flujo secuencial
═══════════════════════════════════════════════ */

const BULK = (() => {

  // ─── Estado del módulo ────────────────────────
  const state = {
    unidades: [],       // [{id, numero, status: 'pending'|'done'}]
    currentIdx: 0,
    chipState: { piso: '', tipo: '' },
    prioSel: 'Media',
    active: false,
  };

  // ─── Utilidades ───────────────────────────────
  function parseUnidades(raw) {
    // Normalizar: reemplazar comas, saltos de línea, tabulaciones y múltiples espacios
    const normalized = raw
      .replace(/,/g, ' ')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const parts = normalized.split(' ').map(s => s.trim()).filter(s => s.length > 0);

    // Deduplicar manteniendo orden
    const seen = new Set();
    return parts.filter(u => {
      if (seen.has(u)) return false;
      seen.add(u);
      return true;
    });
  }

  function getCurrentUnidad() {
    return state.unidades[state.currentIdx] || null;
  }

  function getPendingCount() {
    return state.unidades.filter(u => u.status === 'pending').length;
  }

  function getDoneCount() {
    return state.unidades.filter(u => u.status === 'done').length;
  }

  // ─── PANTALLA 1: Ingreso de lista ────────────
  function renderCargaMasiva(session) {
    const canEdit = AUTH.can('addReports');
    const emp     = DATA.state.currentEmpresa;

    return `
    <div id="mod-bulk" class="module active">
      <div class="mod-header">
        <div class="mod-title-wrap">
          <div style="display:flex;align-items:center;gap:10px">
            <button class="btn btn-ghost btn-sm" onclick="APP.showModule('registro')" style="padding:5px 8px">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              Volver
            </button>
            <div>
              <h2 class="mod-title">Carga Masiva de Unidades</h2>
              <span class="mod-subtitle">Ingresa la lista de unidades enviada por los técnicos para su validación.</span>
            </div>
          </div>
        </div>
        <div class="mod-header-right">
          <span style="font-family:var(--mono);font-size:11px;color:var(--accent);background:var(--accent-bg);border:1px solid var(--accent-glow);border-radius:6px;padding:3px 10px">
            ${emp}
          </span>
        </div>
      </div>

      ${!canEdit ? `<div class="card" style="background:rgba(245,158,11,0.06);border-color:rgba(245,158,11,0.2)">
        <p style="color:var(--amber);font-size:12.5px">⚠ Solo lectura — No tienes permisos para crear registros</p>
      </div>` : ''}

      <div class="bulk-layout">

        <!-- PASO 1: Lista -->
        <div class="bulk-step-card card">
          <div class="bulk-step-header">
            <div class="bulk-step-num">1</div>
            <div>
              <div class="bulk-step-title">Ingresar Lista de Unidades</div>
              <div class="bulk-step-sub">Pega o escribe la lista de unidades (una por línea)</div>
            </div>
          </div>
          <textarea
            id="bulkInput"
            class="bulk-textarea"
            placeholder="Ejemplos de formatos aceptados:&#10;&#10;• Por línea:  55185&#10;                   20095&#10;                   20166&#10;&#10;• En línea:  55185 20095 20166&#10;&#10;• Con comas: 55185, 20095, 20166"
            oninput="BULK.onInputChange()"
            ${!canEdit ? 'disabled' : ''}
          ></textarea>
          <div class="bulk-input-footer">
            <span class="bulk-detected" id="bulkDetectedCount">0 unidades detectadas</span>
            ${canEdit ? `<button class="btn btn-primary" id="bulkProcesarBtn" onclick="BULK.procesarLista()" disabled>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="22 2 15 22 11 12 2 6 22 2"/></svg>
              Procesar Lista
            </button>` : ''}
          </div>
        </div>

        <!-- PASO 2: Resumen -->
        <div class="bulk-step-card card">
          <div class="bulk-step-header">
            <div class="bulk-step-num">2</div>
            <div>
              <div class="bulk-step-title">Resumen de la Lista</div>
              <div class="bulk-step-sub">Verifica el resumen antes de continuar</div>
            </div>
          </div>

          <div class="bulk-summary-grid" id="bulkSummaryGrid">
            <div class="bulk-summary-card">
              <div class="bsc-icon" style="color:var(--accent)">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v11m0 0H5m4 0h10M9 14v5m0 0H5a2 2 0 01-2-2v-3m4 5h10a2 2 0 002-2v-3"/></svg>
              </div>
              <div class="bsc-val" id="bscTotal">0</div>
              <div class="bsc-lbl">Total detectadas</div>
            </div>
            <div class="bulk-summary-card">
              <div class="bsc-icon" style="color:var(--amber)">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/></svg>
              </div>
              <div class="bsc-val" id="bscDups">0</div>
              <div class="bsc-lbl">Duplicadas en la lista</div>
            </div>
            <div class="bulk-summary-card">
              <div class="bsc-icon" style="color:var(--green)">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div class="bsc-val" id="bscExisting">0</div>
              <div class="bsc-lbl">Ya registradas</div>
            </div>
            <div class="bulk-summary-card bsc-highlight">
              <div class="bsc-icon" style="color:var(--accent)">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </div>
              <div class="bsc-val" id="bscNew">0</div>
              <div class="bsc-lbl">Nuevas para validar</div>
            </div>
          </div>

          <div id="bulkSummaryInfo" style="display:none" class="bulk-info-box">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span id="bulkSummaryInfoText">Se crearán registros temporales para su validación.</span>
          </div>
        </div>

        <!-- INSTRUCCIONES -->
        <div class="card bulk-instructions">
          <div class="bulk-instr-title">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Instrucciones
          </div>
          <ol class="bulk-instr-list">
            <li>Pega la lista completa de unidades una por línea.</li>
            <li>Verifica el resumen de la lista.</li>
            <li>Haz clic en <strong>"Procesar Lista"</strong>.</li>
            <li>Continúa con la validación unidad por unidad.</li>
          </ol>
          <div class="bulk-note">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
            <strong>Nota</strong>
          </div>
          <p class="bulk-note-text">Podrás revisar y capturar la información de cada unidad en el siguiente paso.</p>
        </div>
      </div>
    </div>`;
  }

  // ─── PANTALLA 2: Validación secuencial ───────
  function renderValidacion() {
    const session   = AUTH.checkSession();
    const emp       = DATA.state.currentEmpresa;
    const total     = state.unidades.length;
    const doneCount = getDoneCount();
    const pendCount = getPendingCount();
    const current   = getCurrentUnidad();

    if (!current) {
      return renderValidacionCompleta();
    }

    const displayIdx = state.currentIdx + 1;

    // Find next pending index for display
    const sel = DATA.getSel('base');
    const selSvc = DATA.getSel('servicio');
    const selProv = DATA.getSel('proveedor');
    const selPiso = DATA.getSel('piso') || [];
    const selTipo = DATA.getSel('tipo');
    const selCat  = DATA.getSel('categoria');

    return `
    <div id="mod-validacion" class="module active">

      <!-- HEADER VALIDACION -->
      <div class="mod-header">
        <div class="mod-title-wrap">
          <div style="display:flex;align-items:center;gap:10px">
            <button class="btn btn-ghost btn-sm" onclick="BULK.volverALista()" style="padding:5px 8px">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              Volver a Carga Masiva
            </button>
            <div>
              <h2 class="mod-title">Validación y Captura de Unidades</h2>
              <span class="mod-subtitle">Captura la información de cada unidad para su validación.</span>
            </div>
          </div>
        </div>
      </div>

      <div class="validacion-layout">

        <!-- SIDEBAR: Lista de unidades -->
        <div class="validacion-sidebar card">
          <div class="vsb-header">
            <span class="vsb-title">Lista de Unidades (${total})</span>
            <button class="btn btn-ghost btn-sm vsb-refresh" onclick="BULK.refreshList()" title="Refrescar lista">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 101.14-4.52"/></svg>
              Refrescar Lista
            </button>
          </div>
          <div class="vsb-list" id="validacionSidebarList">
            ${state.unidades.map((u, i) => `
              <div class="vsb-item ${i === state.currentIdx ? 'vsb-item-active' : ''} ${u.status === 'done' ? 'vsb-item-done' : ''}"
                   onclick="BULK.goToUnit(${i})" id="vsb-item-${i}">
                <span class="vsb-item-num">${i + 1}</span>
                <span class="vsb-item-unidad">${u.numero}</span>
                <span class="vsb-item-badge ${u.status === 'done' ? 'vsb-badge-done' : 'vsb-badge-pending'}">
                  ${u.status === 'done' ? '✓' : '•'} ${u.status === 'done' ? 'Listo' : 'Pendiente'}
                </span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- MAIN: Formulario de captura -->
        <div class="validacion-main">

          <!-- Unidad actual banner -->
          <div class="validacion-unit-banner card">
            <div class="vub-left">
              <div class="vub-label">Unidad actual</div>
              <div class="vub-unidad">${current.numero}</div>
            </div>
            <div class="vub-nav">
              <button class="btn btn-ghost btn-sm vub-nav-btn" onclick="BULK.prevUnit()" ${state.currentIdx === 0 ? 'disabled' : ''}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <span class="vub-progress">${displayIdx} / ${total}</span>
              <button class="btn btn-ghost btn-sm vub-nav-btn" onclick="BULK.nextUnit()" ${state.currentIdx >= total - 1 ? 'disabled' : ''}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
            <div class="vub-counters">
              <div class="vub-counter vub-total">
                <div class="vub-cval">${total}</div>
                <div class="vub-clbl">Total unidades</div>
              </div>
              <div class="vub-counter vub-captured">
                <div class="vub-cval">${doneCount}</div>
                <div class="vub-clbl">Capturadas</div>
              </div>
              <div class="vub-counter vub-pending" style="display:flex;align-items:center;gap:8px">
                <div>
                  <div class="vub-cval" style="color:var(--red)">${pendCount}</div>
                  <div class="vub-clbl">Pendientes</div>
                </div>
                ${pendCount === 0 ? '' : `<button class="btn btn-primary btn-sm" onclick="BULK.enviarAlSistema()" style="white-space:nowrap">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  Enviar al Sistema
                </button>`}
              </div>
            </div>
          </div>

          <!-- FORMULARIO -->
          <div class="card">
            <div class="form-grid">

              <!-- BASE OPERATIVA -->
              <div class="form-group">
                <label class="required" for="bulkBase">Base Operativa</label>
                <div class="select-wrap">
                  <select id="bulkBase" onchange="BULK.onBaseChange()">
                    <option value="">— Seleccionar —</option>
                    ${sel.map(b => `<option>${b}</option>`).join('')}
                  </select>
                </div>
              </div>

              <!-- TIPO DE SERVICIO -->
              <div class="form-group">
                <label class="required" for="bulkServicio">Tipo de Servicio</label>
                <div class="select-wrap">
                  <select id="bulkServicio">
                    <option value="">— Seleccionar —</option>
                    ${selSvc.map(s => `<option>${s}</option>`).join('')}
                  </select>
                </div>
              </div>

              <!-- PROVEEDOR -->
              <div class="form-group">
                <label for="bulkProveedor">Proveedor del Equipo</label>
                <div class="select-wrap">
                  <select id="bulkProveedor">
                    <option value="">— Seleccionar —</option>
                    ${selProv.map(p => `<option>${p}</option>`).join('')}
                  </select>
                </div>
              </div>

              <!-- TÉCNICO (filtrado por base + empresa, desde usuarios reales) -->
              <div class="form-group">
                <label for="bulkTecnico">Técnico Asignado</label>
                <div class="select-wrap">
                  <select id="bulkTecnico" onchange="BULK.onTecnicoChange()">
                    <option value="">— Seleccionar base primero —</option>
                  </select>
                </div>
                <div id="bulkTecnicoHint" style="font-size:10px;color:#3d4f6b;margin-top:4px">
                  Selecciona una base para ver técnicos disponibles
                </div>
                <input type="text" id="bulkTecnicoOtro" placeholder="Nombre del técnico" style="display:none;margin-top:6px">
              </div>

              <!-- FECHA -->
              <div class="form-group">
                <label class="required" for="bulkFecha">Fecha y Hora</label>
                <input type="datetime-local" id="bulkFecha" value="${UI.nowISO()}">
              </div>

              <!-- PRIORIDAD -->
              <div class="form-group">
                <label>Prioridad</label>
                <div class="chip-row" id="bulkPrioChips">
                  ${['Alta','Media','Baja'].map(p => `<div class="chip${p==='Media'?' active':''}"
                    onclick="BULK.selPrio('${p}',this)"
                    style="--chip-r:${p==='Alta'?'239':p==='Media'?'245':'34'};--chip-g:${p==='Alta'?'68':p==='Media'?'158':'197'};--chip-b:${p==='Alta'?'68':p==='Media'?'11':'94'}"
                  >${p}</div>`).join('')}
                </div>
              </div>

              <!-- PISO -->
              <div class="form-group">
                <label>Piso</label>
                <div class="chip-row" id="bulkPisoChips">
                  ${selPiso.map(p => `<div class="chip" onclick="BULK.selChip('piso','${p}',this)">${p}</div>`).join('')}
                </div>
              </div>

              <!-- TIPO INCIDENCIA -->
              <div class="form-group">
                <label>Tipo</label>
                <div class="chip-row" id="bulkTipoChips">
                  ${selTipo.map(t => `<div class="chip" onclick="BULK.selChip('tipo','${t}',this)">${t}</div>`).join('')}
                </div>
              </div>

              <!-- ESTADO (CON FALLA / SIN FALLA) -->
              <div class="form-group">
                <label>Estado <span style="color:var(--text3);font-size:10px">(obligatorio si Con Falla)</span></label>
                <div style="display:flex;gap:8px">
                  <div class="bulk-estado-btn bulk-estado-falla" id="bulkEstadoFalla" onclick="BULK.selEstado('falla')">
                    <div class="bulk-estado-dot" style="background:var(--red)"></div>
                    Con falla
                  </div>
                  <div class="bulk-estado-btn bulk-estado-sinfalla" id="bulkEstadoSinFalla" onclick="BULK.selEstado('sinfalla')">
                    <div class="bulk-estado-dot" style="background:var(--green)"></div>
                    Sin falla
                  </div>
                </div>
              </div>

            </div>

            <!-- SECCIÓN FALLA TÉCNICA (visible solo cuando hay falla) -->
            <div id="bulkFallaSection" style="margin-top:14px;display:none">
              <div class="card-hdr" style="margin-bottom:10px">
                <div class="card-icon card-icon-amber">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                </div>
                <span class="card-title">Falla Técnica</span>
              </div>
              <div class="form-grid">
                <div class="form-group">
                  <label class="required" for="bulkCategoria">Categoría</label>
                  <div class="select-wrap">
                    <select id="bulkCategoria" onchange="BULK.onCategoriaChange()">
                      <option value="">— Seleccionar —</option>
                      ${selCat.map(c => `<option>${c}</option>`).join('')}
                    </select>
                  </div>
                </div>
                <div class="form-group">
                  <label for="bulkComponente">Componente</label>
                  <div class="select-wrap">
                    <select id="bulkComponente">
                      <option value="">— Seleccionar categoría —</option>
                    </select>
                  </div>
                </div>
                <div class="form-group col-2">
                  <label for="bulkDesc">Descripción de la Falla</label>
                  <textarea id="bulkDesc" placeholder="Describe el problema o trabajo a realizar..."></textarea>
                </div>
              </div>
            </div>

            <!-- BOTONES ACCIÓN -->
            <div class="validacion-actions">
              <button class="btn btn-ghost" onclick="BULK.prevUnit()" ${state.currentIdx === 0 ? 'disabled' : ''}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                Anterior
              </button>
              <button class="btn btn-secondary" onclick="BULK.skipUnit()">
                Omitir →
              </button>
              <div style="flex:1"></div>
              <button class="btn btn-primary btn-lg" onclick="BULK.enviarAlSistema()">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                Guardar y continuar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }

  function renderValidacionCompleta() {
    const total = state.unidades.length;
    const done  = getDoneCount();

    return `
    <div id="mod-validacion-done" class="module active">
      <div class="validacion-completa-wrap">
        <div class="vc-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <h2 class="vc-title">¡Carga masiva completada!</h2>
        <p class="vc-sub">Se procesaron <strong style="color:var(--accent)">${done}</strong> de <strong>${total}</strong> unidades correctamente.</p>
        <div class="vc-stats">
          <div class="vc-stat">
            <div class="vc-stat-val" style="color:var(--green)">${done}</div>
            <div class="vc-stat-lbl">Registros creados</div>
          </div>
          <div class="vc-stat">
            <div class="vc-stat-val" style="color:var(--text2)">${total - done}</div>
            <div class="vc-stat-lbl">Omitidas</div>
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:10px">
          <button class="btn btn-ghost" onclick="APP.showModule('atencion')">Ver Atención Técnica</button>
          <button class="btn btn-primary" onclick="APP.showModule('registro')">Nuevo Registro</button>
        </div>
      </div>
    </div>`;
  }

  // ─── Eventos UI ───────────────────────────────
  function onInputChange() {
    const raw   = document.getElementById('bulkInput')?.value || '';
    const units = parseUnidades(raw);
    const count = units.length;

    // Contar duplicados en el input original
    const rawParts = raw
      .replace(/,/g, ' ')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    const dups = rawParts.length - count;

    // Contar cuáles ya están registradas en el sistema
    const registered = DATA.state.fallas.filter(f =>
      f.empresa === DATA.state.currentEmpresa && units.includes(f.unidad)
    ).map(f => f.unidad);
    const existingSet = new Set(registered);
    const existingCount = existingSet.size;

    const detectedEl = document.getElementById('bulkDetectedCount');
    if (detectedEl) {
      detectedEl.textContent = `${count} unidades detectadas`;
      detectedEl.style.color = count > 0 ? 'var(--green)' : 'var(--text3)';
    }

    const btn = document.getElementById('bulkProcesarBtn');
    if (btn) btn.disabled = count === 0;

    // Update summary cards
    const bscTotal    = document.getElementById('bscTotal');
    const bscDups     = document.getElementById('bscDups');
    const bscExisting = document.getElementById('bscExisting');
    const bscNew      = document.getElementById('bscNew');
    const infoBox     = document.getElementById('bulkSummaryInfo');
    const infoText    = document.getElementById('bulkSummaryInfoText');

    if (bscTotal)    bscTotal.textContent    = count;
    if (bscDups)     bscDups.textContent     = dups;
    if (bscExisting) bscExisting.textContent = existingCount;
    if (bscNew)      bscNew.textContent      = Math.max(0, count - existingCount);

    if (infoBox && infoText && count > 0) {
      infoBox.style.display = 'flex';
      const newCount = Math.max(0, count - existingCount);
      infoText.textContent = newCount > 0
        ? `Se crearán ${newCount} registros temporales para su validación.`
        : 'Todas las unidades ya están registradas. Puedes continuar para actualizarlas.';
    } else if (infoBox) {
      infoBox.style.display = 'none';
    }
  }

  function procesarLista() {
    const raw   = document.getElementById('bulkInput')?.value || '';
    const units = parseUnidades(raw);

    if (units.length === 0) {
      UI.toast('Ingresa al menos una unidad', 'err');
      return;
    }

    // Inicializar estado
    state.unidades = units.map(u => ({ id: DATA.uid(), numero: u, status: 'pending' }));
    state.currentIdx = 0;
    state.chipState  = { piso: '', tipo: '' };
    state.prioSel    = 'Media';
    state.active     = true;

    // Renderizar pantalla de validación
    renderCurrentValidacion();
  }

  function renderCurrentValidacion() {
    // Find first pending if current is done
    let idx = state.currentIdx;

    // If current is done, find the next pending
    if (state.unidades[idx]?.status === 'done') {
      const nextPending = state.unidades.findIndex((u, i) => i >= idx && u.status === 'pending');
      if (nextPending !== -1) {
        state.currentIdx = nextPending;
        idx = nextPending;
      } else {
        // Find any pending
        const anyPending = state.unidades.findIndex(u => u.status === 'pending');
        if (anyPending !== -1) {
          state.currentIdx = anyPending;
          idx = anyPending;
        } else {
          // All done
          const main = document.getElementById('mainContent');
          if (main) main.innerHTML = renderValidacionCompleta();
          UI.updateHeaderCounts();
          return;
        }
      }
    }

    const main = document.getElementById('mainContent');
    if (main) {
      main.innerHTML = renderValidacion();
      resetFormFields();
      scrollSidebarToActive();
    }
  }

  function resetFormFields() {
    ['bulkBase','bulkServicio','bulkCategoria','bulkComponente','bulkProveedor'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.selectedIndex = 0;
    });
    const rc = document.getElementById('bulkComponente');
    if (rc) rc.innerHTML = '<option value="">— Seleccionar categoría —</option>';
    const fd = document.getElementById('bulkFecha');
    if (fd) fd.value = UI.nowISO();
    const bd = document.getElementById('bulkDesc');
    if (bd) bd.value = '';

    state.chipState = { piso: '', tipo: '' };
    state.prioSel   = 'Media';

    // Reset chip visuals
    document.querySelectorAll('.chip-row .chip').forEach(c => c.classList.remove('active'));
    // Re-set media as default prio
    document.querySelectorAll('#bulkPrioChips .chip').forEach(c => {
      if (c.textContent.trim() === 'Media') c.classList.add('active');
    });

    // Reset estado buttons
    resetEstado();
    const fallaSection = document.getElementById('bulkFallaSection');
    if (fallaSection) fallaSection.style.display = 'none';
  }

  function resetEstado() {
    const fb = document.getElementById('bulkEstadoFalla');
    const sb = document.getElementById('bulkEstadoSinFalla');
    if (fb) fb.classList.remove('active');
    if (sb) sb.classList.remove('active');
    state.chipState.estado = '';
  }

  function selEstado(tipo) {
    const fb = document.getElementById('bulkEstadoFalla');
    const sb = document.getElementById('bulkEstadoSinFalla');
    const fallaSection = document.getElementById('bulkFallaSection');

    if (tipo === 'falla') {
      if (fb) fb.classList.add('active');
      if (sb) sb.classList.remove('active');
      if (fallaSection) fallaSection.style.display = '';
    } else {
      if (sb) sb.classList.add('active');
      if (fb) fb.classList.remove('active');
      if (fallaSection) fallaSection.style.display = 'none';
    }
    state.chipState.estado = tipo;
  }

  function selChip(key, val, el) {
    state.chipState[key] = val;
    const row = el.closest('.chip-row');
    if (row) row.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === el));
  }

  function selPrio(val, el) {
    state.prioSel = val;
    document.querySelectorAll('#bulkPrioChips .chip').forEach(c => {
      c.classList.toggle('active', c.textContent.trim() === val);
    });
  }

  function onCategoriaChange() {
    const cat  = document.getElementById('bulkCategoria');
    const comp = document.getElementById('bulkComponente');
    if (!cat || !comp) return;
    const opts = DATA.getComponentes(cat.value);
    comp.innerHTML = '<option value="">— Seleccionar —</option>'
      + opts.map(o => `<option>${o}</option>`).join('');
  }

  function scrollSidebarToActive() {
    setTimeout(() => {
      const active = document.getElementById(`vsb-item-${state.currentIdx}`);
      if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }

  // ─── Navegación ───────────────────────────────
  function goToUnit(idx) {
    state.currentIdx = idx;
    renderCurrentValidacion();
  }

  function prevUnit() {
    if (state.currentIdx > 0) {
      state.currentIdx--;
      renderCurrentValidacion();
    }
  }

  function nextUnit() {
    if (state.currentIdx < state.unidades.length - 1) {
      state.currentIdx++;
      renderCurrentValidacion();
    }
  }

  function skipUnit() {
    // Find next pending after current
    const next = state.unidades.findIndex((u, i) => i > state.currentIdx && u.status === 'pending');
    if (next !== -1) {
      state.currentIdx = next;
    } else {
      // Try from beginning
      const fromStart = state.unidades.findIndex((u, i) => i !== state.currentIdx && u.status === 'pending');
      if (fromStart !== -1) state.currentIdx = fromStart;
    }
    renderCurrentValidacion();
  }

  function refreshList() {
    renderCurrentValidacion();
  }

  // ─── Guardar y continuar ─────────────────────
  async function enviarAlSistema() {
    const current = getCurrentUnidad();
    if (!current) return;

    const base    = document.getElementById('bulkBase')?.value;
    const svc     = document.getElementById('bulkServicio')?.value;
    const fecha   = document.getElementById('bulkFecha')?.value;
    const estado  = state.chipState.estado;

    // Validaciones mínimas
    const errors = [];
    if (!base)  errors.push('Base Operativa');
    if (!svc)   errors.push('Tipo de Servicio');
    if (!fecha) errors.push('Fecha y Hora');

    // Si hay falla, requerir categoría
    const hasFalla = estado === 'falla';
    const cat      = document.getElementById('bulkCategoria')?.value || '';

    if (hasFalla && !cat) {
      errors.push('Categoría (requerida con falla)');
    }

    if (errors.length) {
      UI.toast('Campos requeridos: ' + errors.join(', '), 'err');
      return;
    }

    // Crear reporte
    const session = AUTH.checkSession();
    let nuevo;
    try {
      nuevo = await DATA.crearReporte({
      unidad:      current.numero,
      empresa:     DATA.state.currentEmpresa,
      base,
      servicio:    svc,
      fecha,
      piso:        state.chipState.piso || '',
      tipo:        state.chipState.tipo || '',
      categoria:   cat,
      componente:  document.getElementById('bulkComponente')?.value || '',
      proveedor:   document.getElementById('bulkProveedor')?.value || '',
      descripcion: document.getElementById('bulkDesc')?.value?.trim() || '',
      prioridad:   state.prioSel || 'Media',
      tecnico:     getBulkTecnicoValue(),
      tecnicoUsername: session ? session.username : '',
      });
    } catch (error) {
      UI.toast(error.message || 'No se pudo crear el reporte', 'err');
      return;
    }

    // Marcar como completada
    state.unidades[state.currentIdx].status = 'done';
    state.unidades[state.currentIdx].folio  = nuevo.folio;

    UI.toast(`✓ Unidad ${current.numero} — Folio: ${nuevo.folio}`);
    UI.updateHeaderCounts();

    // Avanzar automáticamente a la siguiente pendiente
    const nextPending = state.unidades.findIndex((u, i) => i > state.currentIdx && u.status === 'pending');
    if (nextPending !== -1) {
      state.currentIdx = nextPending;
      renderCurrentValidacion();
    } else {
      // Buscar desde el inicio
      const anyPending = state.unidades.findIndex(u => u.status === 'pending');
      if (anyPending !== -1) {
        state.currentIdx = anyPending;
        renderCurrentValidacion();
      } else {
        // ¡Todas completas!
        const main = document.getElementById('mainContent');
        if (main) main.innerHTML = renderValidacionCompleta();
        UI.updateHeaderCounts();
      }
    }
  }

  function volverALista() {
    state.active = false;
    APP.showModule('registro');
  }

  // ─── API pública ──────────────────────────────
  // ─── Técnico por base (desde usuarios reales) ───
  function onBaseChange() {
    const base   = document.getElementById('bulkBase')?.value;
    const emp    = DATA.state.currentEmpresa;
    const tecSel = document.getElementById('bulkTecnico');
    const hint   = document.getElementById('bulkTecnicoHint');
    if (!tecSel) return;

    const tecnicos = DATA.getTecnicosPorBase(emp, base);

    let opts = '<option value="">— Seleccionar técnico —</option>';
    if (tecnicos.length > 0) {
      opts += tecnicos.map(t => {
        const label = t.base ? `${t.nombre} (${t.base})` : t.nombre;
        return `<option value="${t.nombre}">${label}</option>`;
      }).join('');
    }
    opts += '<option value="__otro__">Otro (escribir manualmente)</option>';
    tecSel.innerHTML = opts;

    if (hint) {
      if (!base) {
        hint.textContent = 'Selecciona una base para ver técnicos disponibles';
        hint.style.color = '#3d4f6b';
      } else if (tecnicos.length === 0) {
        hint.textContent = `Sin técnicos en ${base} / ${emp}. Usa "Otro" o crea usuarios técnicos.`;
        hint.style.color = '#f59e0b';
      } else {
        hint.textContent = `${tecnicos.length} técnico(s) disponible(s) en ${base}`;
        hint.style.color = '#3d4f6b';
      }
    }

    const otroInp = document.getElementById('bulkTecnicoOtro');
    if (otroInp) otroInp.style.display = 'none';
  }

  function onTecnicoChange() {
    const sel = document.getElementById('bulkTecnico');
    const inp = document.getElementById('bulkTecnicoOtro');
    if (!sel || !inp) return;
    inp.style.display = sel.value === '__otro__' ? '' : 'none';
  }

  function getBulkTecnicoValue() {
    const sel = document.getElementById('bulkTecnico');
    const inp = document.getElementById('bulkTecnicoOtro');
    if (!sel) return '';
    if (sel.value === '__otro__') return inp ? inp.value.trim() : '';
    if (!sel.value) return '';
    return sel.value; // already the nombre
  }

  return {
    renderCargaMasiva,
    onInputChange,
    procesarLista,
    selChip,
    selPrio,
    selEstado,
    onCategoriaChange,
    goToUnit,
    prevUnit,
    nextUnit,
    skipUnit,
    refreshList,
    enviarAlSistema,
    volverALista,
    state,
    onBaseChange,
    onTecnicoChange,
  };
})();
