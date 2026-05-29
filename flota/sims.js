/**
 * sims.js — Control de SIMs
 * Módulo UI completo para gestión, asignación y seguimiento de SIMs GPS.
 * Depende de: DB, Charts, UI (toast), Parsers
 */
const SimsUI = (() => {

  /* ═══ CONSTANTES ════════════════════════════════════════ */
  let _destinoSeleccionado = null; // 'STOCK' | 'BAJA' | null — para SIM RETIRADA
  const OPERADORAS_STD = ['TELCEL', 'YUMOVIL', 'ALESTRA'];
  const ESTADOS_STD    = ['SIM INSTALADA', 'SIM RETIRADA', 'SIM SIN ASIGNAR', 'SIM PARA INSTALAR'];

  const ESTADO_COLOR = {
    'SIM INSTALADA':    { bg:'rgba(16,185,129,.15)',  text:'#10b981', border:'rgba(16,185,129,.35)'  },
    'SIM RETIRADA':     { bg:'rgba(239,68,68,.15)',   text:'#ef4444', border:'rgba(239,68,68,.35)'   },
    'SIM SIN ASIGNAR':  { bg:'rgba(245,158,11,.15)',  text:'#f59e0b', border:'rgba(245,158,11,.35)'  },
    'SIM PARA INSTALAR':{ bg:'rgba(59,130,246,.15)',  text:'#60a5fa', border:'rgba(59,130,246,.35)'  },
    '_default':         { bg:'rgba(139,92,246,.15)',  text:'#a78bfa', border:'rgba(139,92,246,.35)'  }
  };

  const OP_COLOR = {
    'TELCEL':  '#ef4444',
    'YUMOVIL': '#10b981',
    'ALESTRA': '#3b82f6',
    '_default':'#a78bfa'
  };

  /* ═══ ESTADO INTERNO ════════════════════════════════════ */
  let _filtros = { base:'', operadora:'', estado:'', search:'' };
  let _paginaActual = 1;
  const POR_PAGINA = 10;
  let _panelAbierto = false;  // panel lateral
  let _editandoId = null;     // id del sim en edición, null = nuevo

  /* ═══ RENDER PRINCIPAL ══════════════════════════════════ */
  function render() {
    const el = document.getElementById('sims-content');
    if (!el) return;
    const emp  = DB.getEmpresaActiva();
    const sims = DB.getSims(emp);
    const stats = DB.getSimStats(emp);

    el.innerHTML = `
      ${_styles()}
      <div class="sims-root">

        <!-- HEADER -->
        <div class="sims-header">
          <div>
            <div style="font-size:14px;font-weight:700;letter-spacing:.04em">CONTROL DE SIMS</div>
            <div style="font-size:11px;color:var(--text3);margin-top:1px">
              Empresa: ${emp} &nbsp;·&nbsp; Últ. act.: ${new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <button class="sims-btn-export" onclick="SimsUI.exportarCSV()" title="Exportar CSV">↓ CSV</button>
            <button class="sims-btn-export" onclick="SimsUI.verHistorial()" title="Historial de retiros" style="background:rgba(139,92,246,.15);color:#a78bfa;border-color:rgba(139,92,246,.3)">🕑 Historial</button>
            <button class="sims-btn-primary" onclick="SimsUI.abrirPanel(null)">+ Agregar / Gestionar SIM</button>
          </div>
        </div>

        <!-- KPI CARDS -->
        <div class="sims-kpi-row" id="sims-kpi-row">
          ${_kpiCard('SIMs INSTALADAS',   stats.instaladas,  stats.total, '#10b981', '🟢', 'spark-sim-inst', 'kpi-val-inst', 'kpi-pct-inst')}
          ${_kpiCard('SIMs RETIRADAS',    stats.retiradas,   stats.total, '#ef4444', '🔴', 'spark-sim-ret',  'kpi-val-ret',  'kpi-pct-ret')}
          ${_kpiCard('SIMs SIN ASIGNAR',  stats.sinAsignar,  stats.total, '#f59e0b', '🟡', 'spark-sim-sin',  'kpi-val-sin',  'kpi-pct-sin')}
          ${_kpiCard('SIMs PARA INSTALAR',stats.paraInstalar,stats.total, '#60a5fa', '🔵', 'spark-sim-par',  'kpi-val-par',  'kpi-pct-par')}
        </div>
        <!-- Barra de total dinámico -->
        <div style="display:flex;align-items:center;gap:10px;background:var(--bg-panel);border:1px solid var(--border);border-radius:10px;padding:10px 16px">
          <span style="font-size:18px">📶</span>
          <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3)">Total SIMs</span>
          <span id="kpi-val-total" style="font-size:22px;font-weight:700;color:var(--text);margin-left:4px">${stats.total}</span>
          <span id="sim-filtro-ctx" style="font-size:11px;color:var(--text3);margin-left:6px">— Vista general</span>
        </div>

        <!-- CUERPO: tabla + sidebar panel -->
        <div class="sims-body-wrap">
          <div class="sims-left">

            <!-- FILTROS -->
            <div class="sims-filter-bar">
              <div class="sims-filter-group">
                <label class="sims-filter-label">Filtrar por base</label>
                <select class="sims-select" id="sim-f-base" onchange="SimsUI._setFiltro('base',this.value)">
                  <option value="">Todas las bases</option>
                  ${_opcionesBase(emp)}
                </select>
              </div>
              <div class="sims-filter-group">
                <label class="sims-filter-label">Filtrar por operadora</label>
                <select class="sims-select" id="sim-f-op" onchange="SimsUI._setFiltro('operadora',this.value)">
                  <option value="">Todas las operadoras</option>
                  ${_opcionesOperadora(sims)}
                </select>
              </div>
              <div class="sims-filter-group">
                <label class="sims-filter-label">Filtrar por estado SIM</label>
                <select class="sims-select" id="sim-f-est" onchange="SimsUI._setFiltro('estado',this.value)">
                  <option value="">Todas</option>
                  ${_opcionesEstado(sims)}
                </select>
              </div>
              <div class="sims-filter-group" style="flex:2">
                <label class="sims-filter-label">&nbsp;</label>
                <div style="display:flex;gap:6px;align-items:center">
                  <input class="sims-search" id="sim-search" placeholder="🔍 Buscar por ICCID, unidad o equipo..."
                    value="${_filtros.search}" oninput="SimsUI._setFiltro('search',this.value)">
                  <button class="sims-btn-ghost" onclick="SimsUI._limpiarFiltros()">↺ Limpiar filtros</button>
                </div>
              </div>
            </div>

            <!-- TABLA -->
            <div class="sims-table-wrap">
              ${sims.length === 0 ? _estadoVacio() : _tabla(sims, emp)}
            </div>

          </div>

          <!-- SIDEBAR GRÁFICAS -->
          <div class="sims-sidebar">
            <div class="sims-chart-card">
              <div class="sims-chart-title">📶 Total de SIMs <span id="sim-chart-total-ctx" style="font-weight:400;font-size:9px;color:var(--text3)"></span></div>
              <div style="position:relative;height:130px;margin:8px 0">
                <canvas id="sim-chart-total" style="width:100%;height:100%"></canvas>
              </div>
              <div id="sim-leg-total"></div>
            </div>
            <div class="sims-chart-card">
              <div class="sims-chart-title">SIMs por Operadora</div>
              <div style="position:relative;height:130px;margin:8px 0">
                <canvas id="sim-chart-op" style="width:100%;height:100%"></canvas>
              </div>
              <div id="sim-leg-op"></div>
            </div>
            <div class="sims-chart-card">
              <div class="sims-chart-title">SIMs por Estado</div>
              <div style="position:relative;height:130px;margin:8px 0">
                <canvas id="sim-chart-est" style="width:100%;height:100%"></canvas>
              </div>
              <div id="sim-leg-est"></div>
            </div>
            ${_alertasSidebar(stats)}
            <button class="sims-btn-primary" style="width:100%;margin-top:4px" onclick="SimsUI.abrirPanel(null)">
              + Agregar / Gestionar SIM
            </button>
          </div>
        </div>

      </div>

      <!-- PANEL LATERAL (drawer) -->
      <div id="sim-drawer-overlay" class="sim-overlay ${_panelAbierto?'':'hidden'}" onclick="SimsUI.cerrarPanel()"></div>
      <div id="sim-drawer" class="sim-drawer ${_panelAbierto?'open':''}">
        <div id="sim-drawer-inner"></div>
      </div>
    `;

    // Restaurar valores de filtros en selects
    ['base','operadora','estado'].forEach(k => {
      const el2 = document.getElementById('sim-f-' + (k==='operadora'?'op':k==='estado'?'est':k));
      if (el2 && _filtros[k]) el2.value = _filtros[k];
    });

    _renderGraficas(stats);
    if (_panelAbierto) _renderDrawerInner(_editandoId, emp);
    _renderTabla(sims);
  }

  /* ═══ KPI CARD ══════════════════════════════════════════ */
  function _kpiCard(titulo, valor, total, color, emoji, canvasId, valId, pctId) {
    const pct = total > 0 ? Math.round(valor / total * 100) : 0;
    return `
      <div class="sims-kpi-card" style="border-top:3px solid ${color}">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="font-size:28px;line-height:1;background:rgba(255,255,255,.04);border-radius:8px;padding:8px">
            ${emoji}
          </div>
          <div>
            <div class="sims-kpi-label" style="color:${color}">${titulo}</div>
            <div id="${valId}" class="sims-kpi-value" style="color:${color}">${valor}</div>
            <div id="${pctId}" class="sims-kpi-pct">${pct}% del total</div>
          </div>
        </div>
        <div style="height:40px;margin-top:10px"><canvas id="${canvasId}"></canvas></div>
      </div>`;
  }

  /* ═══ TABLA ═════════════════════════════════════════════ */
  function _tabla(simsAll, emp) {
    const filtradas = _filtrar(simsAll);
    const totalPags = Math.ceil(filtradas.length / POR_PAGINA) || 1;
    if (_paginaActual > totalPags) _paginaActual = 1;
    const pagina = filtradas.slice((_paginaActual - 1) * POR_PAGINA, _paginaActual * POR_PAGINA);

    if (filtradas.length === 0) return `<div class="sims-empty">No hay registros que coincidan con los filtros aplicados.</div>`;

    return `
      <table class="sims-table">
        <thead>
          <tr>
            <th>ICCID</th>
            <th>OPERADORA</th>
            <th>UNIDAD</th>
            <th>BASE</th>
            <th>CROMÁTICA</th>
            <th>EQUIPO</th>
            <th>ESTADO</th>
            <th>ÚLTIMO MOVIMIENTO</th>
            <th>ÚLTIMA CONEXIÓN</th>
            <th>OBSERVACIONES</th>
            <th>ACCIONES</th>
          </tr>
        </thead>
        <tbody id="sims-tbody">
          ${pagina.map(s => _fila(s, emp)).join('')}
        </tbody>
      </table>
      <div class="sims-pag">
        <span style="font-size:11px;color:var(--text3)">
          Mostrando ${(_paginaActual-1)*POR_PAGINA+1} a ${Math.min(_paginaActual*POR_PAGINA, filtradas.length)} de ${filtradas.length} SIMs
        </span>
        <div style="display:flex;gap:4px;align-items:center">
          <button class="sims-pag-btn" onclick="SimsUI._irPag(${_paginaActual-1})" ${_paginaActual<=1?'disabled':''}>‹</button>
          ${_pagBotones(totalPags)}
          <button class="sims-pag-btn" onclick="SimsUI._irPag(${_paginaActual+1})" ${_paginaActual>=totalPags?'disabled':''}>›</button>
          <select class="sims-select" style="margin-left:6px;padding:3px 8px;font-size:11px" onchange="SimsUI._setPorPagina(this.value)">
            ${[10,25,50].map(n=>`<option value="${n}" ${POR_PAGINA===n?'selected':''}>${n} por página</option>`).join('')}
          </select>
        </div>
      </div>`;
  }

  function _fila(s, emp) {
    const ec = _estadoColor(s.estado);
    const oc = OP_COLOR[s.operadora] || OP_COLOR['_default'];
    const unidad = s.unidad ? DB.getUnidad(s.unidad, emp) : null;
    const ultimaCon = unidad ? (unidad.ultima_act ? Parsers.fmtDate(unidad.ultima_act) : '—') : '—';
    return `
      <tr class="sims-row">
        <td style="font-family:monospace;font-size:11px;color:var(--text2)">${s.iccid || '—'}</td>
        <td><span class="sims-op-badge" style="background:${oc}20;color:${oc};border-color:${oc}40">${s.operadora||'—'}</span></td>
        <td style="font-weight:700">${s.unidad||'—'}</td>
        <td>${s.base||'—'}</td>
        <td>${s.cromatica||'—'}</td>
        <td>${s.equipoDvr||'—'}</td>
        <td><span class="sims-est-badge" style="background:${ec.bg};color:${ec.text};border-color:${ec.border}">${s.estado||'—'}</span></td>
        <td>
          <div style="font-size:11px;color:var(--text2)">${s.movimiento||'—'}</div>
          <div style="font-size:10px;color:var(--text3)">${s.actualizadoEn ? _fmtRel(s.actualizadoEn) : ''}</div>
        </td>
        <td style="font-size:11px">${ultimaCon}</td>
        <td style="font-size:11px;color:var(--text3);max-width:160px">
          ${s.observaciones
            ? `<span title="${s.observaciones.replace(/"/g,'&quot;')}" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:150px;font-style:italic">${s.observaciones}</span>`
            : '<span style="color:var(--border2)">—</span>'}
        </td>
        <td>
          <div style="display:flex;gap:4px">
            <button class="sims-icon-btn" title="Editar" onclick="SimsUI.abrirPanel('${s.id}')">✎</button>
            <button class="sims-icon-btn sims-icon-btn-del" title="Eliminar" onclick="SimsUI.eliminar('${s.id}')">✕</button>
          </div>
        </td>
      </tr>`;
  }

  /* ═══ PANEL LATERAL (DRAWER) ════════════════════════════ */
  function abrirPanel(id) {
    _destinoSeleccionado = null; // resetear destino al abrir
    _panelAbierto = true;
    _editandoId = id || null;
    const emp = DB.getEmpresaActiva();
    // Si es edición, restaurar destino_retiro del sim existente
    if (id) {
      const sims = DB.getSims(emp);
      const sim = sims.find(s => s.id === id);
      if (sim?.destino_retiro) _destinoSeleccionado = sim.destino_retiro;
    }
    const overlay = document.getElementById('sim-drawer-overlay');
    const drawer  = document.getElementById('sim-drawer');
    if (overlay) overlay.classList.remove('hidden');
    if (drawer)  drawer.classList.add('open');
    _renderDrawerInner(id, emp);
  }

  function cerrarPanel() {
    _panelAbierto = false;
    _editandoId = null;
    const overlay = document.getElementById('sim-drawer-overlay');
    const drawer  = document.getElementById('sim-drawer');
    if (overlay) overlay.classList.add('hidden');
    if (drawer)  drawer.classList.remove('open');
  }

  function _renderDrawerInner(id, emp) {
    const inner = document.getElementById('sim-drawer-inner');
    if (!inner) return;
    const sim = id ? DB.getSims(emp).find(s => String(s.id) === String(id)) : null;
    const esEdicion = !!sim;

    // Datos de la unidad si existe
    const unidad = sim?.unidad ? DB.getUnidad(sim.unidad, emp) : null;

    inner.innerHTML = `
      <div class="sim-drawer-header">
        <div>
          <div style="font-size:13px;font-weight:700">${esEdicion ? 'EDITAR SIM' : 'ASIGNAR SIM A UNIDAD'}</div>
          ${esEdicion ? `<div style="font-size:10px;color:var(--text3);font-family:monospace;margin-top:2px">${sim.iccid || sim.id}</div>` : ''}
        </div>
        <button class="sims-icon-btn" onclick="SimsUI.cerrarPanel()" style="font-size:16px">✕</button>
      </div>

      <!-- 1. INFORMACIÓN DE LA UNIDAD -->
      <div class="sim-section">
        <div class="sim-section-title">1. INFORMACIÓN DE LA UNIDAD</div>
        <div class="sim-field">
          <label class="sim-label">Unidad <span style="color:var(--red)">*</span></label>
          <input id="sd-unidad" class="sim-input" placeholder="Ej. 2432"
            value="${sim?.unidad||''}" oninput="SimsUI._autocompletarUnidad(this.value)">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div class="sim-field">
            <label class="sim-label">Base</label>
            <div id="sd-base" class="sim-input-readonly">${sim?.base || unidad?.base || '—'}</div>
          </div>
          <div class="sim-field">
            <label class="sim-label">Cromática</label>
            <div id="sd-cromatica" class="sim-input-readonly">${sim?.cromatica || unidad?.cromatica || '—'}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div class="sim-field">
            <label class="sim-label">Equipo</label>
            <div id="sd-equipo" class="sim-input-readonly">${sim?.equipoDvr || unidad?.plataforma || '—'}</div>
          </div>
          <div class="sim-field">
            <label class="sim-label">Empresa</label>
            <div id="sd-empresa" class="sim-input-readonly">${sim?.empresa || emp}</div>
          </div>
        </div>
        <div class="sim-info-note">ℹ Los datos de la unidad se llenan automáticamente.</div>
      </div>

      <!-- 2. INFORMACIÓN DE LA SIM -->
      <div class="sim-section">
        <div class="sim-section-title">2. INFORMACIÓN DE LA SIM</div>
        <div class="sim-field">
          <label class="sim-label">ICCID / Número de SIM</label>
          <input id="sd-iccid" class="sim-input" placeholder="Ej. 8952020923293058197" value="${sim?.iccid||''}">
        </div>
        <div class="sim-field">
          <label class="sim-label">Operadora <span style="color:var(--red)">*</span></label>
          <select id="sd-op" class="sim-input" onchange="SimsUI._toggleOtraOp(this.value)">
            <option value="">Selecciona una operadora</option>
            ${OPERADORAS_STD.map(o=>`<option value="${o}" ${sim?.operadora===o?'selected':''}>${o}</option>`).join('')}
            <option value="OTRO" ${sim?.operadora&&!OPERADORAS_STD.includes(sim.operadora)?'selected':''}>OTRO</option>
          </select>
          <input id="sd-op-otro" class="sim-input" style="margin-top:6px;${sim?.operadora&&!OPERADORAS_STD.includes(sim.operadora)?'':'display:none'}"
            placeholder="Escribe la operadora..." value="${sim?.operadora&&!OPERADORAS_STD.includes(sim.operadora)?sim.operadora:''}">
        </div>
      </div>

      <!-- 3. ESTADO DE LA SIM -->
      <div class="sim-section">
        <div class="sim-section-title">3. ESTADO DE LA SIM</div>
        <div class="sim-field">
          <select id="sd-est" class="sim-input" onchange="SimsUI._toggleOtroEst(this.value)">
            <option value="">Selecciona un estado</option>
            ${ESTADOS_STD.map(e=>`<option value="${e}" ${sim?.estado===e?'selected':''}>${e}</option>`).join('')}
            <option value="OTRO" ${sim?.estado&&!ESTADOS_STD.includes(sim.estado)?'selected':''}>OTRO</option>
          </select>
          <input id="sd-est-otro" class="sim-input" style="margin-top:6px;${sim?.estado&&!ESTADOS_STD.includes(sim.estado)?'':'display:none'}"
            placeholder="Estado personalizado..." value="${sim?.estado&&!ESTADOS_STD.includes(sim.estado)?sim.estado:''}">
        </div>
        <!-- Chips rápidos de estado -->
        <div class="sim-estado-chips">
          ${ESTADOS_STD.map(e => {
            const ec = _estadoColor(e);
            const act = sim?.estado === e;
            return `<button class="sim-estado-chip ${act?'active':''}" data-estado="${e}"
              style="${act?`background:${ec.bg};color:${ec.text};border-color:${ec.border}`:''};"
              onclick="SimsUI._selEstadoChip(this,'${e}')">${e.replace('SIM ','')}</button>`;
          }).join('')}
        </div>
        <!-- Destino de retiro: visible cuando estado = SIM RETIRADA -->
        <div id="sd-destino-wrap" style="margin-top:14px;padding:12px;background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.25);border-radius:8px;display:none">
          <div class="sim-label" style="margin-bottom:8px;font-size:10px;font-weight:700;color:#ef4444;text-transform:uppercase;letter-spacing:.06em">📤 DESTINO DE RETIRO *</div>
          <div style="display:flex;gap:8px">
            <button id="sd-dest-stock" class="sim-destino-btn" onclick="SimsUI._selDestino('STOCK')">📦 STOCK</button>
            <button id="sd-dest-baja"  class="sim-destino-btn" onclick="SimsUI._selDestino('BAJA')">🗑 BAJA</button>
          </div>
        </div>
      </div>

      <!-- 4. CAPACIDAD GB -->
      <div class="sim-section">
        <div class="sim-section-title">4. CAPACIDAD</div>
        <div class="sim-field">
          <div style="display:flex;align-items:center;gap:8px">
            <input id="sd-gb" class="sim-input" type="number" min="0" step="1" placeholder="Ej. 15"
              style="flex:1;-moz-appearance:textfield" value="${sim?.gb||''}"
              oninput="this.value=this.value.replace(/[^0-9]/g,'')">
            <span style="font-size:13px;font-weight:700;color:var(--text2);white-space:nowrap">GB</span>
          </div>
        </div>
      </div>

      <!-- 5. OBSERVACIONES -->
      <div class="sim-section">
        <div class="sim-section-title">5. OBSERVACIONES (OPCIONAL)</div>
        <textarea id="sd-obs" class="sim-input" rows="3" placeholder="Escribe alguna observación...">${sim?.observaciones||''}</textarea>
      </div>

      <!-- BOTONES -->
      <div class="sim-drawer-footer">
        <button class="sims-btn-ghost" onclick="SimsUI.cerrarPanel()">Cancelar</button>
        <button class="sims-btn-primary" onclick="SimsUI.guardarSim()">
          ${esEdicion ? '💾 Guardar cambios' : '📶 Asignar SIM'}
        </button>
      </div>
    `;
    // Post-render: inicializar estado visual del destino-wrap y botones
    setTimeout(() => {
      if (sim?.estado === 'SIM RETIRADA') {
        const wrap = document.getElementById('sd-destino-wrap');
        if (wrap) wrap.style.display = 'block';
      }
      if (_destinoSeleccionado) SimsUI._selDestino(_destinoSeleccionado);
    }, 0);
  }

  /* ═══ ACCIONES ══════════════════════════════════════════ */
  function _autocompletarUnidad(numStr) {
    const num = numStr.trim();
    if (!num) { _limpiarCamposUnidad(); return; }
    const emp = DB.getEmpresaActiva();
    const u   = DB.getUnidad(num, emp);
    if (u) {
      _setRO('sd-base',     u.base       || '—');
      _setRO('sd-cromatica',u.cromatica  || '—');
      _setRO('sd-equipo',   u.plataforma || u.modelo || '—');
      _setRO('sd-empresa',  u.empresa    || emp);
    } else {
      _limpiarCamposUnidad();
    }
  }

  function _limpiarCamposUnidad() {
    ['sd-base','sd-cromatica','sd-equipo','sd-empresa'].forEach(id => _setRO(id, '—'));
  }

  function _setRO(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function _toggleOtraOp(val) {
    const inp = document.getElementById('sd-op-otro');
    if (inp) inp.style.display = val === 'OTRO' ? 'block' : 'none';
  }

  function _toggleOtroEst(val) {
    // Campo "otro estado"
    const inp = document.getElementById('sd-est-otro');
    if (inp) inp.style.display = val === 'OTRO' ? 'block' : 'none';

    // Sync chips visuales
    document.querySelectorAll('.sim-estado-chip').forEach(ch => {
      ch.classList.toggle('active', ch.dataset.estado === val);
      const ec = _estadoColor(ch.dataset.estado);
      if (ch.classList.contains('active')) {
        ch.style.background  = ec.bg;
        ch.style.color       = ec.text;
        ch.style.borderColor = ec.border;
      } else {
        ch.style.background  = '';
        ch.style.color       = '';
        ch.style.borderColor = '';
      }
    });

    // Mostrar/ocultar DESTINO DE RETIRO
    const wrap = document.getElementById('sd-destino-wrap');
    if (wrap) {
      if (val === 'SIM RETIRADA') {
        wrap.style.display = 'block';
      } else {
        wrap.style.display = 'none';
        _selDestino(null); // limpiar selección si cambia de estado
      }
    }
  }

  function _registrarHistorialRetiro(simData, simAnterior, emp) {
    if (!window.GPS_SB) return;
    const _sbCfg = window.CCTV_SUPABASE_CONFIG || {};
    const _sbUrl = (_sbCfg.url || 'https://sxzhmcrpeyuqslupttby.supabase.co') + '/rest/v1';
    const _sbKey = _sbCfg.anonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4emhtY3JwZXl1cXNsdXB0dGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MjQ5MDgsImV4cCI6MjA5MzAwMDkwOH0.-muAjBKc2PekqbgRltLVBnUCdxfQlHNxmVruXrw_sl8';
    const _sbHdr = { 'apikey': _sbKey, 'Authorization': 'Bearer ' + _sbKey, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' };
    const registro = {
      empresa_id:     emp,
      num_economico:  simData.unidad    || (simAnterior && simAnterior.unidad)    || '',
      iccid:          simData.iccid     || (simAnterior && simAnterior.iccid)     || '',
      operadora:      simData.operadora || (simAnterior && simAnterior.operadora) || '',
      gb:             simData.gb        || (simAnterior && simAnterior.gb)        || null,
      base:           simData.base      || (simAnterior && simAnterior.base)      || '',
      cromatica:      simData.cromatica || (simAnterior && simAnterior.cromatica) || '',
      equipo_dvr:     simData.equipo_dvr || (simAnterior && simAnterior.equipoDvr) || '',
      estado_antes:   (simAnterior && simAnterior.estado) || 'SIM INSTALADA',
      estado_nuevo:   'SIM RETIRADA',
      destino_retiro: simData.destino_retiro || null,
      observaciones:  simData.observaciones || '',
      fecha_retiro:   new Date().toISOString()
    };
    fetch(_sbUrl + '/gps_sims_historial', {
      method: 'POST', headers: _sbHdr, body: JSON.stringify(registro)
    }).then(r => {
      if (r.ok) console.log('[SimsUI] Historial retiro registrado', registro.iccid);
      else r.text().then(t => console.error('[SimsUI] Historial retiro FAIL', r.status, t));
    }).catch(e => console.error('[SimsUI] Historial retiro ERROR', e));
  }

  function _selDestino(dest) {
    _destinoSeleccionado = dest;
    const btnStock = document.getElementById('sd-dest-stock');
    const btnBaja  = document.getElementById('sd-dest-baja');
    if (!btnStock || !btnBaja) return;
    // Reset ambos
    btnStock.style.background = ''; btnStock.style.color = ''; btnStock.style.borderColor = '';
    btnBaja.style.background  = ''; btnBaja.style.color  = ''; btnBaja.style.borderColor  = '';
    if (dest === 'STOCK') {
      btnStock.style.background = 'rgba(16,185,129,.2)';
      btnStock.style.color      = '#10b981';
      btnStock.style.borderColor= '#10b981';
    } else if (dest === 'BAJA') {
      btnBaja.style.background  = 'rgba(239,68,68,.2)';
      btnBaja.style.color       = '#ef4444';
      btnBaja.style.borderColor = '#ef4444';
    }
  }

  function _selEstadoChip(btn, estado) {
    const sel = document.getElementById('sd-est');
    if (sel) { sel.value = estado; sel.dispatchEvent(new Event('change')); }
  }

  function guardarSim() {
    const emp    = DB.getEmpresaActiva();
    const unidad = (document.getElementById('sd-unidad')?.value || '').trim();
    const iccid  = (document.getElementById('sd-iccid')?.value  || '').trim();
    let operadora = document.getElementById('sd-op')?.value || '';
    if (operadora === 'OTRO') operadora = (document.getElementById('sd-op-otro')?.value || '').trim();
    let estado = document.getElementById('sd-est')?.value || '';
    if (estado === 'OTRO') estado = (document.getElementById('sd-est-otro')?.value || '').trim();
    const obs    = (document.getElementById('sd-obs')?.value || '').trim();
    const gbRaw  = (document.getElementById('sd-gb')?.value || '').trim();
    const gb     = gbRaw ? parseInt(gbRaw, 10) : null;

    if (!unidad && !iccid) { UI.toast('Ingresa al menos la unidad o el ICCID', 'warn'); return; }
    if (!operadora)         { UI.toast('Selecciona o escribe una operadora',   'warn'); return; }
    if (!estado)            { UI.toast('Selecciona o escribe el estado',        'warn'); return; }
    if (estado === 'SIM RETIRADA' && !_destinoSeleccionado) {
      UI.toast('Selecciona el destino de retiro: STOCK o BAJA', 'warn'); return;
    }

    // Obtener datos de unidad para autocompletar
    const u = unidad ? DB.getUnidad(unidad, emp) : null;
    const simData = {
      id:              _editandoId || undefined,
      unidad,
      num_economico:   unidad,
      iccid,
      operadora:       operadora.toUpperCase(),
      estado,
      destino_retiro:  estado === 'SIM RETIRADA' ? _destinoSeleccionado : null,
      gb:              gb,
      observaciones:   obs,
      base:            u?.base       || '',
      cromatica:       u?.cromatica  || '',
      equipo_dvr:      u?.plataforma || u?.modelo || '',
      empresa:         u?.empresa    || emp,
      movimiento:      _editandoId ? 'Edición' : 'Asignación',
      activa:          true
    };

    // Obtener registro anterior para detectar retiro y recuperar _sbId
    const simAnterior = _editandoId ? DB.getSims(emp).find(s => String(s.id) === String(_editandoId)) : null;
    const esRetiro = estado === 'SIM RETIRADA' && simAnterior && simAnterior.estado !== 'SIM RETIRADA';

    // Propagar _sbId del registro anterior para que Supabase haga PATCH en vez de INSERT
    if (simAnterior && simAnterior._sbId) simData._sbId = simAnterior._sbId;

    // Guardar en localStorage
    const registroLocal = DB.saveSim(simData, emp);

    // Guardar en Supabase — INSERT retorna el id real (bigserial); guardarlo en localStorage
    if (window.GPS_SB && GPS_SB.saveSim) {
      GPS_SB.saveSim(simData, emp)
        .then(rows => {
          // rows es array con el registro insertado/actualizado — guardar _sbId localmente
          if (rows && rows.length > 0 && rows[0].id) {
            const sbId = rows[0].id;
            console.log('[SimsUI] Supabase saveSim OK', simData.unidad, '→ sbId:', sbId);
            // Persistir _sbId en localStorage para que ediciones futuras usen PATCH
            DB.saveSim({ ...registroLocal, id: registroLocal.id, _sbId: sbId }, emp);
          }
        })
        .catch(e => console.error('[SimsUI] Supabase saveSim ERROR', e));
    }

    // Registrar en historial si es retiro de SIM activa
    if (esRetiro || (estado === 'SIM RETIRADA' && !_editandoId)) {
      _registrarHistorialRetiro(simData, simAnterior, emp);
    }

    UI.toast(_editandoId ? 'SIM actualizada' : 'SIM asignada correctamente', 'success');
    _destinoSeleccionado = null;
    cerrarPanel();
    render();
  }

  function eliminar(id) {
    if (!confirm('¿Eliminar este registro de SIM?\nEsta acción no se puede deshacer.')) return;
    const emp = DB.getEmpresaActiva();
    DB.deleteSim(id, emp);
    UI.toast('Registro eliminado', 'info');
    render();
  }

  function verHistorial() {
    var emp = DB.getEmpresaActiva();
    if (typeof UI === 'undefined' || !UI.openModal) return;
    UI.openModal('<div style="background:var(--bg-panel);border:1px solid var(--border2);border-radius:12px;padding:24px;width:700px;max-width:95vw">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
      + '<div style="font-size:14px;font-weight:700">&#128336; HISTORIAL DE SIMs RETIRADAS — ' + emp + '</div>'
      + '<button onclick="UI.closeModal()" style="background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer">✕</button>'
      + '</div>'
      + '<div id="sims-hist-body" style="font-size:12px;color:var(--text3);text-align:center;padding:20px">Cargando historial...</div>'
      + '</div>');
    if (!window.GPS_SB) {
      var elx = document.getElementById('sims-hist-body');
      if (elx) elx.textContent = 'Supabase no disponible.';
      return;
    }
    GPS_SB._getRaw('gps_sims_historial',
      'empresa_id=eq.' + encodeURIComponent(emp) + '&order=fecha_retiro.desc&limit=100'
    ).then(function(rows) {
      var el = document.getElementById('sims-hist-body');
      if (!el) return;
      if (!rows || rows.length === 0) {
        el.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text3)">Sin historial de retiros registrado.</div>';
        return;
      }
      var fmtDate = function(d) {
        return d ? new Date(d).toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
      };
      var ths = '<th style="padding:6px 8px;text-align:left;color:var(--text3);font-weight:700;border-bottom:1px solid var(--border)">';
      var thead = '<thead><tr>'
        + ths + 'FECHA RETIRO</th>'
        + ths + 'UNIDAD</th>'
        + ths + 'ICCID</th>'
        + ths + 'OPERADORA</th>'
        + ths + 'GB</th>'
        + ths + 'BASE</th>'
        + ths + 'DESTINO</th>'
        + ths + 'OBS</th>'
        + '</tr></thead>';
      var tbody = '<tbody>' + rows.map(function(r) {
        var destStyle = r.destino_retiro === 'STOCK' ? 'color:#10b981' : r.destino_retiro === 'BAJA' ? 'color:#ef4444' : 'color:var(--text3)';
        var td = 'style="padding:6px 8px;';
        return '<tr style="border-bottom:1px solid var(--border)">'
          + '<td ' + td + 'color:var(--text2);white-space:nowrap">' + fmtDate(r.fecha_retiro) + '</td>'
          + '<td ' + td + 'font-weight:700;color:var(--text)">' + (r.num_economico || '—') + '</td>'
          + '<td ' + td + 'font-family:monospace;color:var(--text2);font-size:10px">' + (r.iccid || '—') + '</td>'
          + '<td ' + td + 'color:var(--text2)">' + (r.operadora || '—') + '</td>'
          + '<td ' + td + 'text-align:center;color:var(--blue);font-weight:700">' + (r.gb ? r.gb + ' GB' : '—') + '</td>'
          + '<td ' + td + 'color:var(--text2)">' + (r.base || '—') + '</td>'
          + '<td ' + td + 'font-weight:700;' + destStyle + '">' + (r.destino_retiro || '—') + '</td>'
          + '<td ' + td + 'color:var(--text3);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (r.observaciones || '') + '</td>'
          + '</tr>';
      }).join('') + '</tbody>';
      el.innerHTML = '<div style="overflow-x:auto;max-height:400px;overflow-y:auto">'
        + '<table style="width:100%;border-collapse:collapse;font-size:11px">' + thead + tbody + '</table>'
        + '</div>'
        + '<div style="margin-top:10px;font-size:10px;color:var(--text3);text-align:right">' + rows.length + ' registro(s)</div>';
    }).catch(function(e) {
      var el = document.getElementById('sims-hist-body');
      if (el) el.textContent = 'Error: ' + e.message;
    });
  }

  function exportarCSV() {
    const emp  = DB.getEmpresaActiva();
    const sims = _filtrar(DB.getSims(emp));
    const headers = ['ICCID','Operadora','Unidad','Base','Cromática','Equipo DVR','Estado','Movimiento','Observaciones','Fecha'];
    const rows = sims.map(s => [
      s.iccid, s.operadora, s.unidad, s.base, s.cromatica, s.equipoDvr,
      s.estado, s.movimiento, s.observaciones, s.actualizadoEn
    ].map(v => `"${(v||'').toString().replace(/"/g,'""')}"`));
    const csv  = [headers.join(','), ...rows.map(r=>r.join(','))].join('\n');
    const blob = new Blob(['\ufeff'+csv], { type:'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href:url, download:`SIMs_${emp}_${Date.now()}.csv` });
    a.click();
    URL.revokeObjectURL(url);
    UI.toast('CSV exportado', 'success');
  }

  /* ═══ FILTROS Y PAGINACIÓN ══════════════════════════════ */
  function _setFiltro(key, val) {
    _filtros[key] = val;
    _paginaActual = 1;
    const emp  = DB.getEmpresaActiva();
    const sims = DB.getSims(emp);
    _renderTabla(sims);
    _renderGraficasDinamicas(sims);
  }

  function _limpiarFiltros() {
    _filtros = { base:'', operadora:'', estado:'', search:'' };
    _paginaActual = 1;
    render();
  }

  function _filtrar(sims) {
    return sims.filter(s => {
      if (_filtros.base       && s.base      !== _filtros.base)      return false;
      if (_filtros.operadora  && s.operadora !== _filtros.operadora)  return false;
      if (_filtros.estado     && s.estado    !== _filtros.estado)     return false;
      if (_filtros.search) {
        const q = _filtros.search.toLowerCase();
        if (!((s.iccid||'').toLowerCase().includes(q) ||
              (s.unidad||'').toLowerCase().includes(q) ||
              (s.equipoDvr||'').toLowerCase().includes(q) ||
              (s.base||'').toLowerCase().includes(q)))  return false;
      }
      return true;
    });
  }

  function _irPag(n) {
    const sims = DB.getSims(DB.getEmpresaActiva());
    const total = Math.ceil(_filtrar(sims).length / POR_PAGINA) || 1;
    _paginaActual = Math.max(1, Math.min(n, total));
    _renderTabla(sims);
  }

  function _setPorPagina(n) {
    // rebuild simple — just re-render
    render();
  }

  function _renderTabla(sims) {
    const wrap = document.querySelector('.sims-table-wrap');
    if (!wrap) return;
    const emp = DB.getEmpresaActiva();
    wrap.innerHTML = sims.length === 0 ? _estadoVacio() : _tabla(sims, emp);
  }

  function _pagBotones(total) {
    const paginas = [];
    for (let i = 1; i <= total; i++) {
      if (total > 7) {
        // Mostrar primeras, actuales, y últimas
        if (i === 1 || i === total || Math.abs(i - _paginaActual) <= 1) {
          paginas.push(i);
        } else if (paginas[paginas.length-1] !== '...') {
          paginas.push('...');
        }
      } else {
        paginas.push(i);
      }
    }
    return paginas.map(p =>
      p === '...'
        ? `<span style="padding:0 3px;color:var(--text3)">…</span>`
        : `<button class="sims-pag-btn ${p===_paginaActual?'active':''}" onclick="SimsUI._irPag(${p})">${p}</button>`
    ).join('');
  }

  /* ═══ GRÁFICAS ══════════════════════════════════════════ */

  /** Calcula stats sobre el subconjunto filtrado actual */
  function _statsFromSims(sims) {
    const stats = { total: sims.length, instaladas: 0, retiradas: 0, sinAsignar: 0, paraInstalar: 0, otras: 0 };
    const byOperadora = {};
    const byEstado = {};
    sims.forEach(s => {
      const est = (s.estado || '').toUpperCase();
      if (est.includes('INSTALAD') && !est.includes('PARA')) stats.instaladas++;
      else if (est.includes('RETIR'))    stats.retiradas++;
      else if (est.includes('SIN ASIG')) stats.sinAsignar++;
      else if (est.includes('INSTALAR')) stats.paraInstalar++;
      else stats.otras++;
      const op = s.operadora || 'Sin operadora';
      byOperadora[op] = (byOperadora[op] || 0) + 1;
      const estLabel = s.estado || 'Sin estado';
      byEstado[estLabel] = (byEstado[estLabel] || 0) + 1;
    });
    return { ...stats, byOperadora, byEstado };
  }

  /** Actualiza KPI cards dinámicamente sin re-render completo */
  function _actualizarKPIs(stats) {
    const mapa = [
      { id:'kpi-val-inst', val: stats.instaladas },
      { id:'kpi-val-ret',  val: stats.retiradas  },
      { id:'kpi-val-sin',  val: stats.sinAsignar  },
      { id:'kpi-val-par',  val: stats.paraInstalar},
      { id:'kpi-val-total',val: stats.total       },
    ];
    mapa.forEach(({ id, val }) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    });
    const pctMapa = [
      { id:'kpi-pct-inst', val: stats.instaladas  },
      { id:'kpi-pct-ret',  val: stats.retiradas   },
      { id:'kpi-pct-sin',  val: stats.sinAsignar   },
      { id:'kpi-pct-par',  val: stats.paraInstalar },
    ];
    pctMapa.forEach(({ id, val }) => {
      const el = document.getElementById(id);
      if (el) el.textContent = stats.total > 0 ? Math.round(val / stats.total * 100) + '% del total' : '0% del total';
    });
    // Etiqueta de contexto de filtro
    const ctx = document.getElementById('sim-filtro-ctx');
    if (ctx) {
      const partes = [];
      if (_filtros.operadora) partes.push(_filtros.operadora);
      if (_filtros.base)      partes.push('Base: ' + _filtros.base);
      if (_filtros.estado)    partes.push(_filtros.estado);
      ctx.textContent = partes.length ? '— Filtro: ' + partes.join(' · ') : '— Vista general';
    }
  }

  /** Renderiza o actualiza todas las gráficas del sidebar con datos filtrados */
  function _renderGraficasDinamicas(simsAll) {
    const filtradas = _filtrar(simsAll);
    const stats = _statsFromSims(filtradas);
    _actualizarKPIs(stats);

    setTimeout(() => {
      const total = stats.total;

      // ── Gráfica Total de SIMs (donut simple con estados) ──────────────
      const totalEntries = Object.entries(stats.byEstado);
      if (totalEntries.length) {
        const tColors = totalEntries.map(([k]) => _estadoColor(k).text);
        Charts.donut('sim-chart-total', totalEntries.map(([k])=>k), totalEntries.map(([,v])=>v), tColors);
      }
      const legTotal = document.getElementById('sim-leg-total');
      if (legTotal) {
        const ctxLabel = _filtros.operadora ? _filtros.operadora : (_filtros.base ? 'Base ' + _filtros.base : 'Todas las operadoras');
        legTotal.innerHTML = `
          <div style="text-align:center;margin-bottom:6px">
            <div style="font-size:28px;font-weight:700;color:var(--text)">${total}</div>
            <div style="font-size:10px;color:var(--text3)">${ctxLabel}</div>
          </div>
          ${totalEntries.map(([k,v])=>`
            <div class="leg-row">
              <div class="leg-dot" style="background:${_estadoColor(k).text}"></div>
              <div class="leg-name" style="font-size:10px">${k.replace('SIM ','')}</div>
              <div class="leg-num">${v}</div>
            </div>`).join('')}`;
      }

      // ── Gráfica por Operadora ─────────────────────────────────────────
      const opEntries = Object.entries(stats.byOperadora);
      if (opEntries.length) {
        const colors = opEntries.map(([k]) => OP_COLOR[k] || OP_COLOR['_default']);
        Charts.donut('sim-chart-op', opEntries.map(([k])=>k), opEntries.map(([,v])=>v), colors);
        const leg = document.getElementById('sim-leg-op');
        if (leg) leg.innerHTML = opEntries.map(([k,v])=>`
          <div class="leg-row">
            <div class="leg-dot" style="background:${OP_COLOR[k]||OP_COLOR['_default']}"></div>
            <div class="leg-name">${k}</div>
            <div class="leg-num">${v}</div>
            <div class="leg-pct">(${total > 0 ? Math.round(v/total*100) : 0}%)</div>
          </div>`).join('');
      } else {
        const leg = document.getElementById('sim-leg-op');
        if (leg) leg.innerHTML = `<div style="font-size:10px;color:var(--text3);text-align:center;padding:4px 0">Sin datos</div>`;
      }

      // ── Gráfica por Estado ────────────────────────────────────────────
      const estEntries = Object.entries(stats.byEstado);
      if (estEntries.length) {
        const colors = estEntries.map(([k]) => _estadoColor(k).text);
        Charts.donut('sim-chart-est', estEntries.map(([k])=>k), estEntries.map(([,v])=>v), colors);
        const leg = document.getElementById('sim-leg-est');
        if (leg) leg.innerHTML = estEntries.map(([k,v])=>`
          <div class="leg-row">
            <div class="leg-dot" style="background:${_estadoColor(k).text}"></div>
            <div class="leg-name" style="font-size:10px">${k.replace('SIM ','')}</div>
            <div class="leg-num">${v}</div>
            <div class="leg-pct">(${total > 0 ? Math.round(v/total*100) : 0}%)</div>
          </div>`).join('');
      } else {
        const leg = document.getElementById('sim-leg-est');
        if (leg) leg.innerHTML = `<div style="font-size:10px;color:var(--text3);text-align:center;padding:4px 0">Sin datos</div>`;
      }
    }, 80);
  }

  /** Llamada inicial en render() — usa todos los sims sin filtrar para estado de inicio */
  function _renderGraficas(stats) {
    const emp  = DB.getEmpresaActiva();
    const sims = DB.getSims(emp);
    _renderGraficasDinamicas(sims);
  }

  /* ═══ HELPERS VISUALES ══════════════════════════════════ */
  function _estadoVacio() {
    return `
      <div class="sims-empty">
        <div style="font-size:40px;margin-bottom:12px">📶</div>
        <div style="font-size:14px;font-weight:600;margin-bottom:6px">Sin registros de SIMs</div>
        <div style="font-size:12px;color:var(--text3);margin-bottom:16px">
          Agrega el primer registro usando el botón de abajo.
        </div>
        <button class="sims-btn-primary" onclick="SimsUI.abrirPanel(null)">+ Agregar / Gestionar SIM</button>
      </div>`;
  }

  function _alertasSidebar(stats) {
    const items = [];
    if (stats.sinAsignar > 0)
      items.push({ icon:'⚠', label:'Unidad sin SIM asignada', n: stats.sinAsignar, color:'#f59e0b' });
    // Detectar duplicados de ICCID (SIMs con mismo ICCID)
    const emp  = DB.getEmpresaActiva();
    const sims = DB.getSims(emp);
    const iccidCounts = {};
    sims.forEach(s => { if (s.iccid) iccidCounts[s.iccid] = (iccidCounts[s.iccid]||0)+1; });
    const dupes = Object.values(iccidCounts).filter(c=>c>1).length;
    if (dupes > 0) items.push({ icon:'⚠', label:'SIM duplicadas', n: dupes, color:'#ef4444' });
    // SIMs agregadas en últimas 24h
    const hace24h = Date.now() - 86400000;
    const recientes = sims.filter(s => new Date(s.creadoEn).getTime() > hace24h).length;
    if (recientes > 0) items.push({ icon:'ℹ', label:'Agregadas recientes', n: recientes, color:'#10b981' });

    if (!items.length) return '';
    return `
      <div class="sims-chart-card">
        <div class="sims-chart-title">ALERTAS SIM <a style="float:right;font-size:10px;color:var(--blue);cursor:pointer">Ver todas →</a></div>
        ${items.map(it=>`
          <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)">
            <span style="font-size:16px">${it.icon}</span>
            <span style="flex:1;font-size:11px;color:var(--text2)">${it.label}</span>
            <span style="font-size:13px;font-weight:700;color:${it.color}">${it.n}</span>
          </div>`).join('')}
      </div>`;
  }

  function _estadoColor(estado) {
    return ESTADO_COLOR[estado] || ESTADO_COLOR['_default'];
  }

  function _opcionesBase(emp) {
    const sims = DB.getSims(emp);
    const bases = [...new Set(sims.map(s=>s.base).filter(Boolean))].sort();
    return bases.map(b=>`<option value="${b}" ${_filtros.base===b?'selected':''}>${b}</option>`).join('');
  }

  function _opcionesOperadora(sims) {
    const ops = [...new Set(sims.map(s=>s.operadora).filter(Boolean))].sort();
    return ops.map(o=>`<option value="${o}" ${_filtros.operadora===o?'selected':''}>${o}</option>`).join('');
  }

  function _opcionesEstado(sims) {
    const ests = [...new Set(sims.map(s=>s.estado).filter(Boolean))].sort();
    return ests.map(e=>`<option value="${e}" ${_filtros.estado===e?'selected':''}>${e}</option>`).join('');
  }

  function _fmtRel(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 2)   return 'Hace un momento';
    if (mins < 60)  return `Hace ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)   return `Hace ${hrs} h`;
    return `Hace ${Math.floor(hrs/24)} días`;
  }

  /* ═══ ESTILOS ═══════════════════════════════════════════ */
  function _styles() {
    return `<style>
.sims-root{display:flex;flex-direction:column;gap:14px}
.sims-header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px}
.sims-kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
@media(max-width:900px){.sims-kpi-row{grid-template-columns:repeat(2,1fr)}}
@media(max-width:560px){.sims-kpi-row{grid-template-columns:1fr}}
.sims-kpi-card{background:var(--bg-panel);border:1px solid var(--border);border-radius:12px;padding:14px;transition:box-shadow .15s}
.sims-kpi-card:hover{box-shadow:0 2px 12px rgba(0,0,0,.25)}
.sims-kpi-label{font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;opacity:.85}
.sims-kpi-value{font-size:32px;font-weight:700;line-height:1.1;margin-top:2px}
.sims-kpi-pct{font-size:11px;color:var(--text3);margin-top:1px}
.sims-body-wrap{display:grid;grid-template-columns:1fr 240px;gap:14px;align-items:start}
@media(max-width:1100px){.sims-body-wrap{grid-template-columns:1fr}}
.sims-left{display:flex;flex-direction:column;gap:10px;min-width:0}
.sims-sidebar{display:flex;flex-direction:column;gap:10px}
.sims-chart-card{background:var(--bg-panel);border:1px solid var(--border);border-radius:10px;padding:12px}
.sims-chart-title{font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--text2);margin-bottom:4px}
.sims-filter-bar{display:grid;grid-template-columns:1fr 1fr 1fr 2fr;gap:10px;background:var(--bg-panel);border:1px solid var(--border);border-radius:10px;padding:12px}
@media(max-width:900px){.sims-filter-bar{grid-template-columns:1fr 1fr}}
@media(max-width:560px){.sims-filter-bar{grid-template-columns:1fr}}
.sims-filter-group{display:flex;flex-direction:column;gap:4px}
.sims-filter-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text3)}
.sims-select{background:var(--bg-card);border:1px solid var(--border2);border-radius:7px;padding:6px 10px;color:var(--text);font-family:var(--font);font-size:12px;cursor:pointer}
.sims-select:focus{outline:none;border-color:var(--blue)}
.sims-search{background:var(--bg-card);border:1px solid var(--border2);border-radius:7px;padding:6px 10px;color:var(--text);font-family:var(--font);font-size:12px;flex:1}
.sims-search::placeholder{color:var(--text3)}
.sims-search:focus{outline:none;border-color:var(--blue)}
.sims-table-wrap{background:var(--bg-panel);border:1px solid var(--border);border-radius:10px;overflow:hidden}
.sims-table{width:100%;border-collapse:collapse;font-size:12px}
.sims-table thead tr{background:var(--bg-card)}
.sims-table th{padding:9px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--text3);white-space:nowrap;border-bottom:1px solid var(--border)}
.sims-table td{padding:10px 12px;border-bottom:1px solid var(--border);vertical-align:middle}
.sims-row:hover{background:var(--bg-card)}
.sims-row:last-child td{border-bottom:none}
.sims-op-badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;border:1px solid}
.sims-est-badge{display:inline-block;padding:3px 8px;border-radius:5px;font-size:10px;font-weight:700;border:1px solid;white-space:nowrap}
.sims-pag{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--bg-card);border-top:1px solid var(--border);flex-wrap:wrap;gap:6px}
.sims-pag-btn{padding:4px 9px;border-radius:5px;background:var(--bg-panel);border:1px solid var(--border);color:var(--text2);font-size:12px;cursor:pointer;transition:all .12s}
.sims-pag-btn:hover:not(:disabled){background:var(--bg-hover);color:var(--text)}
.sims-pag-btn:disabled{opacity:.35;cursor:not-allowed}
.sims-pag-btn.active{background:var(--blue);color:#fff;border-color:var(--blue)}
.sims-btn-primary{display:inline-flex;align-items:center;gap:5px;padding:7px 14px;border-radius:7px;background:var(--blue);border:none;color:#fff;font-family:var(--font);font-size:12px;font-weight:600;cursor:pointer;transition:background .15s;white-space:nowrap}
.sims-btn-primary:hover{background:#2563eb}
.sims-btn-ghost{display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border-radius:7px;background:var(--bg-card);border:1px solid var(--border2);color:var(--text2);font-family:var(--font);font-size:12px;cursor:pointer;transition:all .12s;white-space:nowrap}
.sims-btn-ghost:hover{background:var(--bg-hover);color:var(--text)}
.sims-btn-export{display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border-radius:7px;background:var(--bg-card);border:1px solid var(--border2);color:var(--text2);font-family:var(--font);font-size:12px;cursor:pointer}
.sims-btn-export:hover{background:var(--bg-hover)}
.sims-icon-btn{padding:4px 8px;border-radius:5px;background:var(--bg-card);border:1px solid var(--border);color:var(--text2);font-size:11px;cursor:pointer;transition:all .12s}
.sims-icon-btn:hover{background:var(--bg-hover);color:var(--text)}
.sims-icon-btn-del:hover{background:rgba(239,68,68,.15);color:#ef4444;border-color:rgba(239,68,68,.4)}
.sims-empty{text-align:center;padding:56px 20px;color:var(--text3)}
/* DRAWER */
.sim-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:1000;backdrop-filter:blur(2px)}
.sim-drawer{position:fixed;top:0;right:0;width:360px;height:100vh;background:var(--bg-panel);border-left:1px solid var(--border);z-index:1001;transform:translateX(100%);transition:transform .25s cubic-bezier(.4,0,.2,1);overflow-y:auto}
.sim-drawer.open{transform:translateX(0)}
@media(max-width:480px){.sim-drawer{width:100vw}}
.sim-drawer-header{display:flex;align-items:flex-start;justify-content:space-between;padding:16px;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--bg-panel);z-index:2}
.sim-drawer-footer{display:flex;justify-content:flex-end;gap:8px;padding:14px 16px;border-top:1px solid var(--border);position:sticky;bottom:0;background:var(--bg-panel)}
.sim-section{padding:14px 16px;border-bottom:1px solid var(--border)}
.sim-section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--blue);margin-bottom:10px}
.sim-field{display:flex;flex-direction:column;gap:4px;margin-bottom:8px}
.sim-label{font-size:11px;font-weight:600;color:var(--text3)}
.sim-input{background:var(--bg-card);border:1px solid var(--border2);border-radius:7px;padding:7px 10px;color:var(--text);font-family:var(--font);font-size:12px;width:100%;box-sizing:border-box}
.sim-input:focus{outline:none;border-color:var(--blue)}
.sim-input-readonly{background:var(--bg-card);border:1px solid var(--border);border-radius:7px;padding:7px 10px;color:var(--text2);font-size:12px;min-height:33px}
.sim-info-note{font-size:10px;color:var(--text3);background:rgba(59,130,246,.07);border:1px solid rgba(59,130,246,.18);border-radius:6px;padding:6px 10px;margin-top:4px}
.leg-row{display:flex;align-items:center;gap:6px;padding:3px 0;font-size:11px}
.leg-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.leg-name{flex:1;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.leg-num{font-weight:700;color:var(--text)}
.leg-pct{color:var(--text3);font-size:10px}
.sim-estado-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.sim-estado-chip{padding:4px 10px;border-radius:20px;border:1px solid var(--border2);background:var(--bg-card);color:var(--text2);font-size:10px;font-weight:600;cursor:pointer;transition:all .12s;white-space:nowrap}
.sim-estado-chip:hover{border-color:var(--blue);color:var(--blue)}
.sim-estado-chip.active{font-weight:700}
.sim-destino-btn{flex:1;padding:8px 12px;border-radius:8px;border:2px solid var(--border2);background:var(--bg-card);color:var(--text2);font-size:11px;font-weight:700;cursor:pointer;transition:all .15s;letter-spacing:.04em}
.sim-destino-btn:hover{border-color:var(--blue);color:var(--blue);background:rgba(96,165,250,.1)}
</style>`;
  }

  /* ═══ EXPORTS ═══════════════════════════════════════════ */
  return {
    render,
    abrirPanel,
    cerrarPanel,
    guardarSim,
    eliminar,
    exportarCSV,
    _setFiltro,
    _selDestino,
    verHistorial,
    _registrarHistorialRetiro,
    _limpiarFiltros,
    _irPag,
    _setPorPagina,
    _autocompletarUnidad,
    _toggleOtraOp,
    _toggleOtroEst,
    _selEstadoChip,
  };
})();
