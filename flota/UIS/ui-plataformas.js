/**
 * ui-plataformas.js — Panel Plataformas GPS
 * Se carga DESPUÉS de ui.js. Inyecta funciones en window.UI.
 */
(function() {
  const UI_P = window.UI;
  if (!UI_P) { console.error('ui-plataformas: UI no disponible'); return; }

  // Helpers compartidos desde ui.js
  if (!window.UI_HELPERS) { console.error('ui-plataformas: UI_HELPERS no disponible'); return; }
  const { $, esc, toast, openModal, closeModal, openDatePicker,
    _multiTokenMatch, _multiSelectChipsDropdown,
    _msToggle, _msOnCheck, _msUpdateTriggerText, _msSelectAll,
    _msFilterOptions, _readMultiSelectValues,
    platIcon, PLAT_STYLE, ALL_PLATS, platsSortedByData,
    comboWithOther, _onComboChange, readComboValue,
    renderEtiquetasUnidad, estatusBadge, diasBadge,
    renderPagination, PAGE_SIZE,
    fmtDate, fmtDateShort, diasDesde, statusClass
  } = window.UI_HELPERS;



  /* ══════════════════════════════════════════════════════
     PANEL: PLATAFORMAS (v7 — layout horizontal + detalle inline + multibuscar)
  ══════════════════════════════════════════════════════ */

  // Helper: detecta siniestro activo aunque u.siniestro no esté seteado
  // Revisa: flag siniestro, fallas activas, y observaciones con keyword siniestro
  function _tieneSiniestroActivo(u) {
    if (!u) return false;
    if (u.siniestro) return true;
    if ((u.fallas || []).some(f => f.esSiniestro && !f.resuelta)) return true;
    // Fallback: si la observación menciona siniestro (puesto manual o por sync)
    const obs = String(u.observaciones || u.siniestroDesc || '').toUpperCase();
    if (obs.includes('SINIESTRO')) return true;
    return false;
  }

  let _platExpandida = '';
  let _platTableFilter = { emp:[], base:[], crom:[], est:[], dias:[], estadoSam:[], search:'' };
  let _platDetailUnit = null;  // unidad "enfocada" dentro de la tabla (detalle inline)
  let _platDetailTab = 'conexiones'; // tab activa: conexiones / historial / fallas / notas

  // Helpers para leer el identificador específico por plataforma
  function _idCampoPlat(plat) {
    return { CEIBA:'dvr_ceiba', SAMSARA:'vin_samsara', MAN:'placa_man', SCANIA:'placa_scania' }[plat] || null;
  }

  /**
   * Detecta si un string parece ser un Serial No. de CEIBA (DVR).
   * Patrón típico: 10 caracteres alfanuméricos en mayúsculas, empieza con "006" o similar
   * Ejemplos: "006001D8F9", "006001DBF9", "0060007AE", "0071012C6E"
   */
  function _pareceSerialCeiba(s) {
    if (!s) return false;
    const v = String(s).trim().toUpperCase();
    // 9-12 chars alfanuméricos, hexadecimal-like, sin espacios
    return /^[0-9A-F]{9,12}$/.test(v) && !/^[0-9]+$/.test(v); // debe tener al menos una letra
  }
  /**
   * Detecta si un string parece VG de Samsara (formato: GX##-###-###, con guiones)
   */
  function _pareceVGSamsara(s) {
    if (!s) return false;
    const v = String(s).trim().toUpperCase();
    return /^G[A-Z0-9]{3}[-_]?[A-Z0-9]{3,5}[-_]?[A-Z0-9]{3,5}/.test(v);
  }

  function _idValorUnidad(u, plat) {
    const campo = _idCampoPlat(plat);
    if (campo && u[campo]) return u[campo];
    // Fallback para datos LEGACY (v<7): el Serial/VG/VIN se guardaba en u.serie
    // Si el campo dedicado está vacío pero u.serie parece ser de esta plataforma, usarlo
    if (plat === 'CEIBA' && _pareceSerialCeiba(u.serie)) return u.serie;
    if (plat === 'SAMSARA' && _pareceVGSamsara(u.serie)) return u.serie;
    // Fallbacks por plataforma — leyendo de asignación
    if (plat === 'MAN')     return u.placa || u.placa_man || '—';
    if (plat === 'SCANIA')  return u.placa || u.placa_scania || '—';
    if (plat === 'VOLVO' || plat === 'MOTIVE') return u.placa || '—';
    return '—';
  }
  function _labelIdPlat(plat) {
    if (plat === 'CEIBA')   return 'DVR';
    if (plat === 'SAMSARA') return 'VG';
    if (plat === 'MAN')     return 'PLACA';
    if (plat === 'SCANIA')  return 'PLACA';
    return 'PLACA';
  }

  function renderPlataformas(){
    const emp=DB.getEmpresaActiva();
    const el=$('plataformas-grid');
    if(!el)return;

    // Renderizar con datos actuales (fallas se sincronizan en background por app.js)

    const uns=DB.getUnidadesList(emp).filter(u=>u.activa);

    const cfg=DB.getConfig();
    const hoy=Date.now();

    // Excluir "Para venta" Y siniestros activos de los conteos operativos de plataformas
    // Solo la empresa activa — MOTIVE/VOLVO manejan multi-empresa dentro de su propia tabla
    const operativas = DB.getUnidadesList(emp).filter(u =>
      u.activa && Parsers.categorizarEstatus(u.estatus) !== 'Para venta' && !_tieneSiniestroActivo(u)
    );

    // Barra de acciones superior (export + cargar masivo)
    let topBar = `<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;align-items:center">
      <div style="display:flex;gap:6px;align-items:center;margin-right:auto">
        <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text3)">Exportar</span>
        <select id="plat-export-sel" style="background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:5px 8px;color:var(--text2);font-size:11px;font-family:var(--font)">
          ${ALL_PLATS.map(p => `<option value="${p}" ${_platExpandida===p?'selected':''}>${p}</option>`).join('')}
        </select>
        <button class="export-btn" onclick="UI._exportarFaltantesPlat(document.getElementById('plat-export-sel').value)" title="Unidades que NO tienen datos en esta plataforma">↓ Faltantes CSV</button>
        <button class="export-btn" onclick="UI._exportarFueraLineaPlat(document.getElementById('plat-export-sel').value)" title="Unidades fuera de línea de esta plataforma">↓ Fuera de línea CSV</button>
      </div>
      <button class="act-btn-primary" onclick="App.nav(null,'panel-barridos')">↑ Cargar barridos masivo</button>
    </div>`;

    // Hint bar
    let hintBar = `<div style="font-size:11px;color:var(--text3);margin-bottom:10px">
      💡 Click en una plataforma para filtrar la tabla · "Para venta" se excluye de conteos operativos
    </div>`;

    // ═══ TARJETAS HORIZONTALES (una fila, responsive wrap) ═══
    const cardsHTML = ALL_PLATS.map(p=>{
      const k='ultima_act_'+p.toLowerCase();
      const conFecha=operativas.filter(u=>u[k]);
      // Excluir siniestros de conteos GPS en tarjetas de plataforma
      const conFechaGPS=conFecha.filter(u=>!_tieneSiniestroActivo(u));
      const _dLocalCard=(f)=>{
        if(!f) return null;
        const fd=new Date(String(f).replace(' ','T'));
        if(isNaN(fd)) return null;
        const hD=new Date(hoy);
        const hM=new Date(hD.getFullYear(),hD.getMonth(),hD.getDate());
        const fM=new Date(fd.getFullYear(),fd.getMonth(),fd.getDate());
        return Math.floor((hM-fM)/86400000);
      };
      const enLinea=conFechaGPS.filter(u=>{ const _d=_dLocalCard(u[k]); return _d!==null && _d<=cfg.diasLinea; }).length;
      const fuera=conFechaGPS.length-enLinea;
      const esManual=true;
      const COLS_MAP={
        CEIBA:'Plate No. | GPS time | Serial No.',
        SAMSARA:'Nombre | Última hora de registro | N° serie',
        AVL:'Grouping | Último mensaje',
        SCANIA:'Vehículo | Hora',
        MAN:'Dispositivo | VIN | Ultima Conexion',
        VOLVO:'Captura manual',
        MOTIVE:'ID Entidad | Última Actividad | Estado | Serie VG | Serie Cam'
      };
      const activa = _platExpandida === p;
      return `<div class="plat-card ${activa?'plat-card-active':''}" onclick="UI._togglePlatDetail('${p}')">
        <div class="plat-card-head">
          ${platIcon(p,20)}
          <div style="min-width:0;flex:1">
            <div style="font-size:12px;font-weight:700">${p}</div>
            <div style="font-size:9px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Plataforma GPS · Click para ver</div>
          </div>
        </div>
        <div class="plat-card-stats">
          <div class="plat-stat"><div class="plat-stat-n">${conFecha.length}</div><div class="plat-stat-l">CON DATOS</div></div>
          <div class="plat-stat"><div class="plat-stat-n" style="color:var(--green)">${enLinea}</div><div class="plat-stat-l">EN LÍNEA</div></div>
          <div class="plat-stat"><div class="plat-stat-n" style="color:var(--red)">${fuera}</div><div class="plat-stat-l">FUERA</div></div>
        </div>
        <div class="plat-card-cols">${esc(COLS_MAP[p])}</div>
        <div onclick="event.stopPropagation()">
        ${esManual
          ? `<div style="display:flex;flex-direction:column;gap:6px">
              <label class="plat-card-btn-upload">
                ↑ Cargar archivo ${p}
                <input type="file" accept=".xlsx,.xls,.csv" style="display:none" onchange="UI._cargarArchivoPlat('${p}',this.files[0]);this.value=''">
              </label>
              <button class="plat-card-btn-manual" onclick="UI._abrirCapturaManualPlat('${p}')">+ Captura manual</button>
             </div>`
          : `<label class="plat-card-btn-upload">
              ↑ Cargar archivo ${p}
              <input type="file" accept=".xlsx,.xls,.csv" style="display:none" onchange="UI._cargarArchivoPlat('${p}',this.files[0]);this.value=''">
            </label>`}
        </div>
      </div>`;
    }).join('');

    el.innerHTML = topBar + hintBar + `
      <div id="plat-cards-row" class="plat-cards-row">${cardsHTML}</div>
      <div id="plat-detail-box" style="margin-top:14px"></div>`;

    if (_platExpandida) {
      _renderPlatDetail(_platExpandida);
    }

    // ESC para cerrar detalle inline
    _bindEscCerrarDetalle();
  }

  function _togglePlatDetail(plat) {
    _platExpandida = (_platExpandida === plat) ? '' : plat;
    if (!_platExpandida) {
      _platTableFilter = { emp:[], base:[], crom:[], est:[], dias:[], estadoSam:[], search:'' };
      _platDetailUnit = null;
    } else {
      // Reset al cambiar de plataforma
      _platDetailUnit = null;
    }
    renderPlataformas();
  }

  /**
   * Renderiza la tabla de detalle de una plataforma (cabezales, filtros, estilos)
   */
  function _renderPlatDetail(plat) {
    const emp = DB.getEmpresaActiva();
    const box = $('plat-detail-box');
    if (!box) return;
    const k = 'ultima_act_' + plat.toLowerCase();
    const esManual = plat === 'VOLVO';

    // BASE de unidades para este panel:
    // - Plataformas NO manuales (CEIBA, SAMSARA, AVL, SCANIA, MAN): SOLO unidades que aparecen
    //   en el archivo de esa plataforma (tienen ultima_act_<plat> o fueron cargadas por barrido).
    //   Esto evita que por ejemplo el filtro TAPA muestre unidades sin Samsara.
    // - Plataformas manuales (VOLVO, MOTIVE): solo las que tienen captura manual (ultima_act_<plat>).
    // Siempre filtrar por empresa activa — sin datos cruzados entre empresas
    let scopeUns = DB.getUnidadesList(emp).filter(u =>
      u.activa && !_tieneSiniestroActivo(u) && Parsers.categorizarEstatus(u.estatus) !== 'Para venta'
    );
    scopeUns = scopeUns.filter(u => !!u[k]);

    // Los selects se pueblan SOLO con valores presentes en el scope (unidades de esta plataforma).
    // Esto hace que TAPA, LEON, ACAY solo aparezcan si hay unidades con datos de esta plataforma en esas bases.
    const empresasAsig = [...new Set(scopeUns.map(u => u.empresa_asig).filter(Boolean))].sort();
    const bases        = [...new Set(scopeUns.map(u => u.base).filter(Boolean))].sort();
    const cromaticas   = [...new Set(scopeUns.map(u => u.cromatica).filter(Boolean))].sort();

    const incluyeEstadoSam = (plat === 'SAMSARA');

    // Filtro extra solo para Samsara: estado del dispositivo (multi-selección)
    const filtroEstadoSam = incluyeEstadoSam ? `
      <div class="plat-filter-group">
        <span class="plat-filter-lbl">ESTADO SAMSARA</span>
        ${_multiSelectChipsDropdown({
          id: 'pf-estado-sam',
          label: 'Estado',
          allLabel: 'Todos',
          options: ['FUNCIONANDO','NO_DETECTADO','SIN_VIN','SIN_PLACA'],
          selected: _platTableFilter.estadoSam || [],
          onChange: `UI._onPlatFilterChange('${plat}')`
        })}
      </div>` : '';

    // Captura manual inline para Volvo/Motive
    const capturaManualUI = esManual ? `
      <div id="pf-manual-bar" style="padding:12px 14px;background:rgba(139,92,246,.06);border-bottom:1px solid var(--border);display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
        <div class="plat-filter-group">
          <span class="plat-filter-lbl">N° UNIDAD</span>
          <input id="pf-m-num" placeholder="Ej: 2280" oninput="UI._autocompletarCapturaManual('${plat}')" style="background:var(--bg-base);border:1px solid var(--border);border-radius:6px;padding:5px 8px;color:var(--text);font-size:12px;width:100px;font-family:var(--font)">
        </div>
        <div class="plat-filter-group">
          <span class="plat-filter-lbl">BASE</span>
          <input id="pf-m-base" readonly style="background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:5px 8px;color:var(--text2);font-size:12px;width:90px;font-family:var(--font)">
        </div>
        <div class="plat-filter-group">
          <span class="plat-filter-lbl">CROMÁTICA</span>
          <input id="pf-m-crom" readonly style="background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:5px 8px;color:var(--text2);font-size:12px;width:110px;font-family:var(--font)">
        </div>
        <div class="plat-filter-group">
          <span class="plat-filter-lbl">MODELO</span>
          <input id="pf-m-modelo" readonly style="background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:5px 8px;color:var(--text2);font-size:12px;width:150px;font-family:var(--font)">
        </div>
        <div class="plat-filter-group">
          <span class="plat-filter-lbl">ÚLT. CONEXIÓN</span>
          <input id="pf-m-fecha" type="datetime-local" oninput="UI._recalcularDiasManual()" onchange="UI._recalcularDiasManual()" style="background:var(--bg-base);border:1px solid var(--border);border-radius:6px;padding:5px 8px;color:var(--text);font-size:12px;font-family:var(--font)">
        </div>
        <div class="plat-filter-group">
          <span class="plat-filter-lbl">DÍAS</span>
          <div id="pf-m-dias" style="padding:5px 8px;border-radius:6px;background:var(--bg-card);min-width:50px;text-align:center;font-size:12px;color:var(--text2)">—</div>
        </div>
        <div class="plat-filter-group">
          <span class="plat-filter-lbl">PLACA / ID</span>
          <input id="pf-m-id" readonly style="background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:5px 8px;color:var(--text2);font-size:12px;width:120px;font-family:var(--font)">
        </div>
        <button class="act-btn-primary" onclick="UI._guardarCapturaManualPlat('${plat}')">💾 Guardar</button>
      </div>` : '';

    box.innerHTML = `
      <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:12px;overflow:hidden;width:100%">
        <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          ${platIcon(plat,24)}
          <div style="flex:1;min-width:160px">
            <div style="font-size:14px;font-weight:700;letter-spacing:-.01em">Unidades con datos en ${plat}</div>
            <div id="plat-table-summary" style="font-size:11px;color:var(--text3);margin-top:2px"></div>
          </div>
          <button class="act-btn" onclick="UI._togglePlatDetail('${plat}')">✕ Cerrar tabla</button>
        </div>
        ${capturaManualUI}
        <div class="plat-filter-bar">
          <div class="plat-filter-group">
            <span class="plat-filter-lbl">EMPRESA</span>
            ${_multiSelectChipsDropdown({
              id: 'pf-emp',
              label: 'Empresa',
              allLabel: 'Todas',
              options: empresasAsig,
              selected: _platTableFilter.emp || [],
              onChange: `UI._onPlatFilterChange('${plat}')`
            })}
          </div>
          <div class="plat-filter-group">
            <span class="plat-filter-lbl">BASE</span>
            ${_multiSelectChipsDropdown({
              id: 'pf-base',
              label: 'Base',
              allLabel: 'Todas',
              options: bases,
              selected: _platTableFilter.base || [],
              onChange: `UI._onPlatFilterChange('${plat}')`
            })}
          </div>
          <div class="plat-filter-group">
            <span class="plat-filter-lbl">CROMÁTICA</span>
            ${_multiSelectChipsDropdown({
              id: 'pf-crom',
              label: 'Cromática',
              allLabel: 'Todas',
              options: cromaticas,
              selected: _platTableFilter.crom || [],
              onChange: `UI._onPlatFilterChange('${plat}')`
            })}
          </div>
          <div class="plat-filter-group">
            <span class="plat-filter-lbl">ESTATUS ASIG.</span>
            ${_multiSelectChipsDropdown({
              id: 'pf-est',
              label: 'Estatus',
              allLabel: 'Todos',
              options: ['En operación','Fuera de operación'],
              selected: _platTableFilter.est || [],
              onChange: `UI._onPlatFilterChange('${plat}')`
            })}
          </div>
          <div class="plat-filter-group">
            <span class="plat-filter-lbl">DÍAS GPS</span>
            ${_multiSelectChipsDropdown({
              id: 'pf-dias',
              label: 'Días',
              allLabel: 'Todos',
              options: ['En línea','Atención','Fuera'],
              selected: _platTableFilter.dias || [],
              onChange: `UI._onPlatFilterChange('${plat}')`
            })}
          </div>
          ${filtroEstadoSam}
          <input id="pf-search" oninput="UI._debouncePlatSearch('${plat}')" placeholder="🔍 Buscar (separa con espacios: 2280 2275)..." class="plat-filter-search">
          <button class="act-btn" onclick="UI._resetPlatFilters('${plat}')">↺ Reset</button>
          <button id="plat-btn-del-sel" style="display:none;padding:6px 10px;border-radius:6px;background:rgba(239,68,68,.15);color:#ef4444;border:1px solid rgba(239,68,68,.4);font-size:11px;cursor:pointer" onclick="UI._eliminarSeleccionadas('${plat}')">🗑 Eliminar selec. (<span id="plat-sel-count">0</span>)</button>
        </div>
        <div id="plat-table-wrap"></div>
      </div>
    `;

    // Los valores de los multi-select se inicializan en el propio helper via prop `selected`.
    // El input de texto de búsqueda sí es nativo, inicializamos su valor aquí:
    if ($('pf-search')) $('pf-search').value = _platTableFilter.search || '';

    _refreshPlatTable(plat);
  }

  function _onPlatFilterChange(plat) {
    _platTableFilter = {
      emp: _readMultiSelectValues('pf-emp'),
      base: _readMultiSelectValues('pf-base'),
      crom: _readMultiSelectValues('pf-crom'),
      est: _readMultiSelectValues('pf-est'),
      dias: _readMultiSelectValues('pf-dias'),
      estadoSam: _readMultiSelectValues('pf-estado-sam'),
      search: $('pf-search')?.value || ''
    };
    _refreshPlatTable(plat);
  }

  /**
   * Versión debounced del buscador de plataformas.
   * Como _refreshPlatTable solo actualiza #plat-table-wrap (no todo el panel),
   * el focus del input #pf-search no se pierde porque el input queda fuera del re-render.
   * Pero igual agregamos debounce para no filtrar letra por letra.
   */
  function _debouncePlatSearch(plat) {
    _debounce('plat-search', () => _onPlatFilterChange(plat), 150);
  }

  function _resetPlatFilters(plat) {
    _platTableFilter = { emp:[], base:[], crom:[], est:[], dias:[], estadoSam:[], search:'' };
    _platDetailUnit = null;
    // Re-renderizar el panel completo para que los selects se re-construyan con
    // el scope correcto y se limpien visualmente (corrección del bug donde el reset
    // no funcionaba bien tras combinaciones de filtros)
    _renderPlatDetail(plat);
  }

  /**
   * Devuelve el estado efectivo de Samsara para una unidad.
   *
   * Regla de oro (pedido del usuario): SI el archivo de barrido trae un estado explícito,
   * se respeta ese valor TAL CUAL (FUNCIONANDO / NO_DETECTADO / SIN_VIN / SIN_PLACA).
   * La fecha de última conexión NO altera este valor — son cosas distintas.
   *
   * Solo si la unidad jamás ha tenido un barrido Samsara (no tiene u.estado_samsara
   * ni u.ultima_act_samsara) se deriva heurísticamente por lo que hay en asignación.
   */
  function _estadoSamsaraDe(u) {
    // 1) Valor literal del archivo de Samsara → es la fuente de verdad
    if (u.estado_samsara) return u.estado_samsara;
    // 2) Si la unidad está en el barrido de Samsara pero no trajo estado, asumir funcionando
    //    (el archivo aporta fecha, no columna E poblada).
    if (u.ultima_act_samsara) return 'FUNCIONANDO';
    // 3) La unidad ni siquiera está en el archivo Samsara → derivación heurística
    if (!u.vin_samsara && !u.serie) return 'SIN_VIN';
    if (!u.placa) return 'SIN_PLACA';
    return 'NO_DETECTADO';
  }

  function _refreshPlatTable(plat) {
    const emp = DB.getEmpresaActiva();
    const cfg = DB.getConfig();
    const hoy = Date.now();
    const k = 'ultima_act_' + plat.toLowerCase();

    // SCOPE: solo unidades que REALMENTE están en esta plataforma (tienen ultima_act_<plat>).
    // Esto corrige el bug donde filtrar por "TAPA" en Samsara mostraba todas las unidades de
    // TAPA aunque no estuvieran en el archivo de Samsara.
    // Unidades "Para venta" se excluyen de los conteos operativos.
    // VOLVO/MOTIVE son captura manual — pueden tener unidades de cualquier empresa
    let uns = DB.getUnidadesList(emp).filter(u =>
      u.activa && Parsers.categorizarEstatus(u.estatus) !== 'Para venta'
    );
    uns = uns.filter(u => !!u[k]);

    // Siniestros activos NO aparecen en tabla de Plataformas GPS.
    // Sí aparecen en Resumen y en el módulo de Fallas.
    uns = uns.filter(u => !_tieneSiniestroActivo(u));

    const f = _platTableFilter;

    // Filtros multi-selección: cada filtro es un ARRAY.
    // Array vacío = "Todos" (no filtra). Con elementos = solo esos valores (OR dentro del filtro).
    if (f.emp && f.emp.length)  uns = uns.filter(u => f.emp.includes(u.empresa_asig||emp));
    if (f.base && f.base.length) uns = uns.filter(u => f.base.includes(u.base));
    if (f.crom && f.crom.length) uns = uns.filter(u => f.crom.includes(u.cromatica));
    if (f.est && f.est.length) {
      uns = uns.filter(u => f.est.includes(Parsers.categorizarEstatus(u.estatus)));
    }

    // Días GPS multi-selección: puede combinar "En línea" + "Atención" + "Fuera"
    if (f.dias && f.dias.length) {
      uns = uns.filter(u => {
        if (!u[k]) return false;
        const fd = new Date(String(u[k]).replace(' ','T'));
        if (isNaN(fd)) return false;
        const _hD2 = new Date(hoy); // hoy es Date.now() (número)
        const hoyL  = new Date(_hD2.getFullYear(), _hD2.getMonth(), _hD2.getDate());
        const fechL = new Date(fd.getFullYear(), fd.getMonth(), fd.getDate());
        const d = Math.floor((hoyL - fechL) / 86400000);
        let bucket;
        if (d <= cfg.diasLinea) bucket = 'En línea';
        else if (d <= cfg.diasAtencion) bucket = 'Atención';
        else bucket = 'Fuera';
        return f.dias.includes(bucket);
      });
    }

    // Filtro específico Samsara (multi-selección)
    if (plat === 'SAMSARA' && f.estadoSam && f.estadoSam.length) {
      uns = uns.filter(u => f.estadoSam.includes(_estadoSamsaraDe(u)));
    }

    // Búsqueda multi-token usando el helper global (OR entre tokens)
    if (f.search) {
      uns = uns.filter(u => _multiTokenMatch(f.search, [
        u.num, u.base, u.modelo, u.placa, u.serie, u.cromatica, u.empresa_asig,
        u.dvr_ceiba, u.vin_samsara, u.placa_man, u.placa_scania, u.observaciones
      ].join(' ')));
    }

    // (Ya no se necesita el filtro especial de Volvo/Motive: el scope por plataforma se aplica
    // igual a todas las plataformas, así que solo aparecen las unidades con datos manuales.)

    // Ordenar por días desc (más fuera primero)
    uns.sort((a,b) => {
      const da = a[k] ? Math.floor((hoy - new Date(a[k]))/86400000) : -1;
      const db = b[k] ? Math.floor((hoy - new Date(b[k]))/86400000) : -1;
      return db - da;
    });

    // Summary: calculado con las unidades ya filtradas (consistente con la tabla)
    const wrap = $('plat-table-wrap');
    if (!wrap) return;

    const sum = $('plat-table-summary');
    if (sum) {
      const _dLocal = (fecha) => {
        if (!fecha) return null;
        const fd = new Date(String(fecha).replace(' ','T'));
        if (isNaN(fd)) return null;
        const _hD  = new Date(hoy); // hoy es Date.now() (número)
        const hoyL  = new Date(_hD.getFullYear(), _hD.getMonth(), _hD.getDate());
        const fechL = new Date(fd.getFullYear(), fd.getMonth(), fd.getDate());
        return Math.floor((hoyL - fechL) / 86400000);
      };
      const enLinea  = uns.filter(u => { const d = _dLocal(u[k]); return d !== null && d <= cfg.diasLinea; }).length;
      const atencion = uns.filter(u => { const d = _dLocal(u[k]); return d !== null && d > cfg.diasLinea && d <= cfg.diasAtencion; }).length;
      const fuera    = uns.filter(u => { const d = _dLocal(u[k]); return d !== null && d > cfg.diasAtencion; }).length;
      const sinis    = uns.filter(u => u.siniestro).length;
      sum.innerHTML = `<strong>${uns.length}</strong> unidades en ${plat} · <span style="color:var(--green)">${enLinea} en línea</span> · <span style="color:var(--yellow)">${atencion} atención</span> · <span style="color:var(--red)">${fuera} fuera</span>${sinis?` · <span style="color:#c0392b">🚨 ${sinis} siniestro${sinis>1?'s':''}</span>`:''}`;
    }

    if (!uns.length) {
      const esManual = plat === 'VOLVO';
      const hayFiltros = (f.emp && f.emp.length) || (f.base && f.base.length) ||
                         (f.crom && f.crom.length) || (f.est && f.est.length) ||
                         (f.dias && f.dias.length) || (f.estadoSam && f.estadoSam.length) ||
                         f.search;
      let msg;
      if (hayFiltros) {
        msg = `<div class="empty-state" style="padding:30px">
          <div style="font-size:12px;color:var(--text3);margin-bottom:8px">Sin resultados con los filtros actuales</div>
          <button class="act-btn-sm" onclick="UI._resetPlatFilters('${plat}')">↺ Limpiar filtros</button>
        </div>`;
      } else if (esManual) {
        msg = `<div class="empty-state" style="padding:30px">
          <div style="font-size:32px;margin-bottom:8px">✎</div>
          <div style="font-size:12px;color:var(--text2);margin-bottom:4px">Aún no hay capturas manuales para ${plat}</div>
          <div style="font-size:11px;color:var(--text3)">Usa la barra de captura de arriba para agregar la primera unidad</div>
        </div>`;
      } else {
        msg = `<div class="empty-state" style="padding:30px">
          <div style="font-size:32px;margin-bottom:8px">📂</div>
          <div style="font-size:12px;color:var(--text2);margin-bottom:4px">Sin datos cargados de ${plat}</div>
          <div style="font-size:11px;color:var(--text3);margin-bottom:10px">Carga un archivo de barrido ${plat} para ver unidades</div>
          <button class="btn-process" style="font-size:12px" onclick="App.nav(null,'panel-barridos')">↑ Cargar barridos</button>
        </div>`;
      }
      wrap.innerHTML = msg;
      return;
    }

    const idLabel = _labelIdPlat(plat);
    const incluyeEstadoCol = (plat === 'SAMSARA');
    const esMotive = (plat === 'MOTIVE');

    const th = `
      <th style="width:28px;text-align:center;padding:4px 6px"><input type="checkbox" id="plat-chk-all" title="Selec. todas" onclick="event.stopPropagation();UI._platCheckAll(this,'${plat}')" style="cursor:pointer;width:14px;height:14px"></th>
      <th>UNIDAD</th><th>BASE</th><th>CROMÁTICA</th><th>MODELO</th>
      <th>ESTATUS</th>
      ${incluyeEstadoCol ? '<th>ESTADO SAMSARA</th>' : ''}
      ${esMotive ? '<th>ESTADO DISP.</th><th>EMPRESA</th>' : ''}
      <th>${plat} ÚLT. ACTIVIDAD</th><th>DÍAS</th>
      ${esMotive ? '<th>SERIE VG</th><th>SERIE CAM</th>' : `<th>${idLabel}</th>`}
      <th>OBSERVACIONES</th>
      <th>NOTAS</th>
      <th style="width:32px"></th>`;

    const rows = uns.map(u => {
      try {
        // Normalizar campos a string para evitar errores en esc()
        const safeU = {
          num:         String(u.num         || ''),
          base:        String(u.base        || ''),
          cromatica:   String(u.cromatica   || ''),
          modelo:      String(u.modelo      || ''),
          placa:       String(u.placa       || ''),
          serie:       String(u.serie       || ''),
          empresa:     String(u.empresa     || emp),
          empresa_asig:String(u.empresa_asig|| emp),
          observaciones: typeof u.observaciones === 'string' ? u.observaciones : (u.observaciones ? JSON.stringify(u.observaciones) : ''),
          notas: typeof u.notas === 'string' ? u.notas : '',
          dvr_ceiba:   String(u.dvr_ceiba   || ''),
          vin_samsara: String(u.vin_samsara || ''),
          placa_man:   String(u.placa_man   || ''),
          placa_scania:String(u.placa_scania|| ''),
          siniestro:   !!u.siniestro,
          siniestroDesc: String(u.siniestroDesc || ''),
          fallas:      Array.isArray(u.fallas) ? u.fallas : [],
          _motiveRaw:  u._motiveRaw || {},
          estado_motive: String(u.estado_motive || ''),
          empresa_motive: String(u.empresa_motive || ''),
          serie_vg_motive: String(u.serie_vg_motive || ''),
          serie_cam_motive: String(u.serie_cam_motive || ''),
          motive_vg:   String(u.motive_vg   || ''),
          motive_cam:  String(u.motive_cam  || ''),
        };
        const fecha = u[k];
        // FIX: calcular días comparando SOLO la parte de fecha local (sin horas)
        // Math.floor con new Date("YYYY-MM-DD HH:MM:SS") puede dar -1 si el browser
        // interpreta el string como UTC y la hora local resulta en el día siguiente.
        const d = (() => {
          if (!fecha) return null;
          const fd = new Date(String(fecha).replace(' ','T'));
          if (isNaN(fd)) return null;
          const _hoyD = new Date(hoy); // hoy es Date.now() (número) — convertir a Date
          const hoyLocal   = new Date(_hoyD.getFullYear(), _hoyD.getMonth(), _hoyD.getDate());
          const fechaLocal = new Date(fd.getFullYear(), fd.getMonth(), fd.getDate());
          return Math.floor((hoyLocal - fechaLocal) / 86400000);
        })();

        // ── Desinstalación ────────────────────────────────────────────────
        const desKey = 'desinstalacion_' + plat.toLowerCase();
        const desInfo = u[desKey]; // { fecha, comentario, ts }
        const estaDesinstalada = !!desInfo;

        // Estatus badge
        let platBadgeColor, platBadgeLabel;
        if (!fecha)                    { platBadgeColor = 'var(--text3)'; platBadgeLabel = 'SIN DATOS'; }
        else if (d <= cfg.diasLinea)   { platBadgeColor = 'var(--green)'; platBadgeLabel = 'EN LÍNEA'; }
        else if (d <= cfg.diasAtencion){ platBadgeColor = 'var(--yellow)'; platBadgeLabel = 'ATENCIÓN'; }
        else                           { platBadgeColor = 'var(--red)'; platBadgeLabel = 'FUERA'; }
        const estatusCell = `<span style="display:inline-block;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700;background:${platBadgeColor}22;color:${platBadgeColor};border:1px solid ${platBadgeColor}44">${platBadgeLabel}</span>`;

        // Estado Samsara
        let estadoSamsaraCell = '';
        if (incluyeEstadoCol) {
          const es = _estadoSamsaraDe(u);
          const cfgEst = {
            FUNCIONANDO:  { c:'#1a9e6e', bg:'rgba(26,158,110,.15)', br:'rgba(26,158,110,.3)', l:'FUNCIONANDO' },
            NO_DETECTADO: { c:'#c0392b', bg:'rgba(192,57,43,.15)', br:'rgba(192,57,43,.3)', l:'NO DETECTADO' },
            SIN_VIN:      { c:'#a78bfa', bg:'rgba(139,92,246,.15)', br:'rgba(139,92,246,.3)', l:'SIN VG' },
            SIN_PLACA:    { c:'#c07d10', bg:'rgba(192,125,16,.15)', br:'rgba(192,125,16,.3)', l:'SIN PLACA' }
          }[es] || { c:'#9ca3af', bg:'rgba(156,163,175,.15)', br:'rgba(156,163,175,.3)', l: es || '—' };
          estadoSamsaraCell = `<span style="padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700;background:${cfgEst.bg};color:${cfgEst.c};border:1px solid ${cfgEst.br}">${cfgEst.l}</span>`;
        }

        const idValue   = _idValorUnidad(u, plat);
        const isSelected = _platDetailUnit === safeU.num;
        const _fallaActiva  = safeU.fallas.find(fa => !fa.resuelta);
        const _etiquetaFalla = _fallaActiva ? String(_fallaActiva.motivo || _fallaActiva.etiqueta || '') : '';
        const _siniestroLabel = safeU.siniestro ? (safeU.siniestroDesc ? `🚨 ${safeU.siniestroDesc}` : '🚨 SINIESTRO') : '';
        const obsTexto = safeU.observaciones || _siniestroLabel || _etiquetaFalla || '';

        // Motive
        const motiveRaw      = esMotive ? safeU._motiveRaw : {};
        const motiveEstado   = String(motiveRaw.estado   || safeU.estado_motive   || '');
        const motiveEmpresa  = String(motiveRaw.empresa  || safeU.empresa_motive  || '');
        const motiveSerieVG  = String(motiveRaw.serieGateway || safeU.serie_vg_motive  || safeU.motive_vg  || '');
        const motiveSerieCam = String(motiveRaw.serieDashcam  || safeU.serie_cam_motive || safeU.motive_cam || '');
        const motiveEstadoCell = esMotive ? (() => {
          const e = motiveEstado.toUpperCase();
          const isOff = e.includes('POWERED OFF') || e.includes('OFF');
          const c = isOff ? 'var(--red)' : (e.includes('NORMAL') ? 'var(--green)' : 'var(--text3)');
          return `<span style="padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700;background:${c}22;color:${c};border:1px solid ${c}44">${motiveEstado||'—'}</span>`;
        })() : '';

        const esManualRow = true;
        const rowStyle = estaDesinstalada
          ? 'cursor:pointer;opacity:.55;filter:grayscale(.8);background:rgba(80,80,80,.08)'
          : 'cursor:pointer';
        const desBadge = estaDesinstalada
          ? `<span style="display:inline-block;margin-left:4px;padding:1px 5px;border-radius:3px;font-size:9px;font-weight:700;background:rgba(120,120,120,.25);color:#999;border:1px solid #555" title="Desinstalado el ${desInfo.fecha||'?'}">DESINSTAL.</span>`
          : '';
        return `<tr data-num="${esc(safeU.num)}" class="plat-row-clickable ${isSelected?'plat-row-selected':''}" onclick="UI._onPlatRowClick('${esc(safeU.num)}','${plat}')" ondblclick="UI._editarCapturaManuaRow('${esc(safeU.num)}','${plat}')" style="${rowStyle}" title="${esManualRow?'Doble clic para editar fecha':''}">
          <td style="text-align:center;padding:4px 6px" onclick="event.stopPropagation()"><input type="checkbox" class="plat-row-chk" data-num="${esc(safeU.num)}" onchange="UI._platUpdateSelCount()" style="cursor:pointer;width:14px;height:14px" onclick="event.stopPropagation()"></td>
          <td style="font-weight:700">${esc(safeU.num)}${desBadge}</td>
          <td>${esc(safeU.base||'—')}</td>
          <td>${esc(safeU.cromatica||'—')}</td>
          <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(safeU.modelo||'—')}</td>
          <td>${estatusCell}</td>
          ${incluyeEstadoCol ? `<td>${estadoSamsaraCell}</td>` : ''}
          ${esMotive ? `<td>${motiveEstadoCell}</td><td style="font-size:11px">${esc(motiveEmpresa||'—')}</td>` : ''}
          <td style="font-size:11px;cursor:pointer" onclick="event.stopPropagation();UI._editarFechaInline('${esc(safeU.num)}','${plat}',this)" title="Click para editar fecha">${fecha?Parsers.fmtDate(fecha):'<span style="color:var(--text3)">Sin datos</span>'}<span style="opacity:0;font-size:9px;margin-left:3px" class="plat-obs-pencil">✎</span></td>
          <td>${diasBadge(d)}</td>
          ${esMotive
            ? `<td style="font-family:monospace;font-size:10px">${esc(motiveSerieVG||'—')}</td><td style="font-family:monospace;font-size:10px">${esc(motiveSerieCam||'—')}</td>`
            : `<td style="font-family:monospace;font-size:11px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(idValue)}</td>`
          }
          <td class="plat-obs-cell" style="max-width:200px;color:var(--text2);font-size:11px" onclick="event.stopPropagation();UI._editarObsRapido('${esc(safeU.num)}','${esc(safeU.empresa_asig)}','${plat}')" title="Click para editar — ${esc(obsTexto||'sin observación')}">
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;max-width:180px;vertical-align:middle">${esc(obsTexto)||'<span style="color:var(--text3);font-style:italic">+ agregar…</span>'}</span>
            <span class="plat-obs-pencil" style="opacity:0;margin-left:4px;font-size:10px">✎</span>
          </td>
          <td class="plat-obs-cell" style="max-width:200px;color:var(--text2);font-size:11px" onclick="event.stopPropagation();UI._editarNotasRapido('${esc(safeU.num)}','${esc(safeU.empresa_asig)}')" title="Click para editar notas — ${esc(safeU.notas||'sin notas')}">
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;max-width:180px;vertical-align:middle">${esc(safeU.notas)||'<span style="color:var(--text3);font-style:italic">+ nota…</span>'}</span>
            <span class="plat-obs-pencil" style="opacity:0;margin-left:4px;font-size:10px">✎</span>
          </td>
        </tr>`;
      } catch(rowErr) {
        console.warn('[PlatTable] Error generando fila para unidad', u && u.num, rowErr);
        return `<tr><td colspan="9" style="color:var(--text3);font-size:11px;padding:4px 8px">— error fila ${u&&u.num||'?'} —</td></tr>`;
      }
    }).join('');

    // Renderizar tabla + detalle inline (si hay unidad enfocada).
    // IMPORTANTE: el detail inline va FUERA del div con scroll, así siempre es visible
    // inmediatamente al hacer click en una fila, sin necesidad de hacer scroll.
    let html = `<div style="overflow-x:auto"><table style="width:100%;min-width:900px">
      <thead><tr>${th}</tr></thead>
      <tbody id="plat-table-body">${rows}</tbody>
    </table></div>`;

    if (_platDetailUnit) {
      const u = DB.getUnidad(_platDetailUnit, emp);
      if (u) html += _renderPlatDetailInline(u, plat);
    }

    wrap.innerHTML = html;

    // Hacer scroll suave al detalle tras inyectarlo en el DOM
    if (_platDetailUnit) {
      setTimeout(() => {
        const det = document.getElementById('plat-inline-detail');
        if (det) det.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    }
  }

  /**
   * Click en fila: 1er click abre detalle inline, 2º click en la MISMA fila lo cierra.
   * NO navega a otra ventana — el usuario pidió explícitamente que todo se haga inline.
   */
  function _onPlatRowClick(num, plat) {
    if (_platDetailUnit === num) {
      // 2º click → cerrar
      _cerrarPlatDetailInline();
    } else {
      _platDetailUnit = num;
      _platDetailTab = 'conexiones'; // reset al abrir nueva unidad
      _refreshPlatTable(plat);
      // Scroll suave al detalle
      setTimeout(() => {
        const el = $('plat-inline-detail');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
  }

  /**
   * Detalle inline dentro del panel de plataforma (no navega fuera).
   * Diseño tipo "resumen completo" según PDF pág. 5:
   * - Tarjeta grande: número, estado, datos clave
   * - Tabs: Conexiones GPS / Historial / Fallas / Notas
   * - Grid de 6 plataformas con fecha y botón "Ingresar fecha" / "Actualizar"
   * - Observaciones editables in-situ
   */
  function _renderPlatDetailInline(u, plat) {
    const emp = u.empresa || DB.getEmpresaActiva();
    const cfg = DB.getConfig();
    const hoy = Date.now();
    const k = 'ultima_act_' + plat.toLowerCase();
    const fecha = u[k];
    const d = fecha ? (() => {
      const fd = new Date(String(fecha).replace(' ','T'));
      if (isNaN(fd)) return null;
      const hD = new Date(hoy);
      const hM = new Date(hD.getFullYear(), hD.getMonth(), hD.getDate());
      const fM = new Date(fd.getFullYear(), fd.getMonth(), fd.getDate());
      return Math.floor((hM - fM) / 86400000);
    })() : null;
    const cls = Parsers.statusClass(d);
    const clsColor = cls==='critico'?'var(--red)':cls==='atencion'?'var(--yellow)':cls==='sin'?'var(--text3)':'var(--green)';
    const clsLabel = cls==='critico'?'FUERA DE LÍNEA':cls==='atencion'?'ATENCIÓN':cls==='sin'?'SIN DATOS':'EN LÍNEA';
    const etiquetas = renderEtiquetasUnidad(u, 'sm');

    // Cantidad de plataformas con/sin datos
    const platsConDatos = ALL_PLATS.filter(p => u['ultima_act_'+p.toLowerCase()]).length;
    const platsSinDatos = ALL_PLATS.length - platsConDatos;

    // ══ GRID DE 6 PLATAFORMAS (estilo página 5 del PDF) ══
    const platGrid = ALL_PLATS.map(p => {
      const kk = 'ultima_act_'+p.toLowerCase();
      const fe = u[kk];
      const style = PLAT_STYLE[p] || {};
      const fondoHeader = fe ? `background:${style.bg}` : 'background:var(--bg-panel)';

      const desKeyD = 'desinstalacion_' + p.toLowerCase();
      const desInfoD = u[desKeyD];
      const estaDesD = !!desInfoD;

      if (!fe) {
        // Sin datos → muestra "Ingresar fecha"
        return `<div class="plat-inline-card" style="border:1px solid var(--border);border-radius:8px;overflow:hidden${estaDesD?';opacity:.5;filter:grayscale(.7)':''}">
          <div style="padding:8px 10px;${fondoHeader};display:flex;align-items:center;gap:6px">
            ${platIcon(p, 16)}
            <div style="font-size:11px;font-weight:700;color:${style.color||'var(--text2)'}">${p}</div>
            ${estaDesD?`<span style="margin-left:auto;font-size:9px;background:rgba(120,120,120,.3);color:#aaa;padding:1px 5px;border-radius:3px;font-weight:700">DESINSTAL.</span>`:''}
          </div>
          <div style="padding:10px;display:flex;flex-direction:column;gap:6px;align-items:center;justify-content:center;min-height:70px">
            <div style="font-size:10px;color:var(--text3)">Sin datos registrados</div>
            ${estaDesD
              ? `<div style="font-size:9px;color:#888;text-align:center">Desinstalado: ${desInfoD.fecha||'?'}<br><span style="color:#666">${desInfoD.comentario||''}</span></div>
                 <button class="act-btn-sm" style="font-size:9px;padding:3px 7px;background:rgba(80,80,80,.3);border-color:#555;color:#aaa;margin-top:2px" onclick="event.stopPropagation();UI._liberarDesinstalacion('${esc(u.num)}','${p}','${esc(emp)}','${esc(plat)}')">↩ Liberar equipo</button>`
              : `<button class="act-btn-sm" style="font-size:10px;padding:4px 8px" onclick="event.stopPropagation();UI.openDatePicker(null,iso=>{UI._updatePlatFechaConISO('${esc(u.num)}','${p}','${esc(emp)}',iso);UI._refreshPlatTable('${plat}')},'${p} — Ingresar fecha')">+ Ingresar fecha</button>
                 <button class="act-btn-sm" style="font-size:9px;padding:3px 7px;background:rgba(160,60,40,.18);border-color:rgba(160,60,40,.4);color:#c07060;margin-top:2px" onclick="event.stopPropagation();UI._modalDesinstalacion('${esc(u.num)}','${p}','${esc(emp)}','${esc(plat)}')">🔧 Desinstalación</button>`
            }
          </div>
        </div>`;
      }

      const dd = Math.floor((hoy - new Date(fe))/86400000);
      const ddCls = dd <= cfg.diasLinea ? 'var(--green)' : dd <= cfg.diasAtencion ? 'var(--yellow)' : 'var(--red)';
      const ddLabel = dd <= cfg.diasLinea ? 'EN LÍNEA' : dd <= cfg.diasAtencion ? 'ATENCIÓN' : 'FUERA DE LÍNEA';
      return `<div class="plat-inline-card" style="border:1px solid ${estaDesD?'#555':ddCls+'66'};border-radius:8px;overflow:hidden;background:var(--bg-panel)${estaDesD?';opacity:.5;filter:grayscale(.7)':''}">
        <div style="padding:8px 10px;${fondoHeader};display:flex;align-items:center;gap:6px">
          ${platIcon(p, 16)}
          <div style="font-size:11px;font-weight:700;color:${style.color||'var(--text2)'}">${p}</div>
          ${estaDesD?`<span style="margin-left:auto;font-size:9px;background:rgba(120,120,120,.3);color:#aaa;padding:1px 5px;border-radius:3px;font-weight:700">DESINSTAL.</span>`:''}
        </div>
        <div style="padding:10px">
          <div style="font-size:11px;color:var(--text);margin-bottom:2px">${Parsers.fmtDate(fe)}</div>
          <div style="font-size:9px;font-weight:700;color:${estaDesD?'#888':ddCls};margin-bottom:4px">${estaDesD?'DESINSTALADO':ddLabel}</div>
          <div style="font-size:18px;font-weight:700;color:${estaDesD?'#888':ddCls};line-height:1">${dd}<span style="font-size:10px;margin-left:3px;color:var(--text3)">días</span></div>
          ${estaDesD
            ? `<div style="font-size:9px;color:#666;margin-top:4px">${desInfoD.comentario||''}</div>
               <button class="act-btn-sm" style="font-size:9px;padding:3px 7px;background:rgba(80,80,80,.3);border-color:#555;color:#aaa;margin-top:6px;width:100%" onclick="event.stopPropagation();UI._liberarDesinstalacion('${esc(u.num)}','${p}','${esc(emp)}','${esc(plat)}')">↩ Liberar equipo</button>`
            : `<div style="display:flex;gap:4px;margin-top:6px">
                <button class="act-btn-sm" style="font-size:10px;padding:3px 7px;flex:1" onclick="event.stopPropagation();UI.openDatePicker('${fe}',iso=>{UI._updatePlatFechaConISO('${esc(u.num)}','${p}','${esc(emp)}',iso);UI._refreshPlatTable('${plat}')},'${p} — Actualizar conexión')">↻ Actualizar</button>
                <button class="act-btn-sm" style="font-size:9px;padding:3px 6px;background:rgba(160,60,40,.18);border-color:rgba(160,60,40,.4);color:#c07060" title="Registrar desinstalación" onclick="event.stopPropagation();UI._modalDesinstalacion('${esc(u.num)}','${p}','${esc(emp)}','${esc(plat)}')">🔧</button>
               </div>`
          }
        </div>
      </div>`;
    }).join('');

    // ══ CONTENIDO POR TAB ══
    const tab = _platDetailTab || 'conexiones';
    let tabContent = '';

    if (tab === 'conexiones') {
      tabContent = `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px">
          ${platGrid}
        </div>`;
    } else if (tab === 'historial') {
      const hist = (u.historial || []).slice(-30).reverse();
      if (!hist.length) {
        tabContent = `<div class="empty-state" style="padding:20px">Sin historial registrado</div>`;
      } else {
        const colors = {creacion:'var(--blue)',actualizacion:'var(--green)',barrido:'var(--green)',falla:'var(--red)',inactivacion:'var(--yellow)',reactivacion:'var(--green)',etiqueta:'var(--purple)'};
        tabContent = `<div style="max-height:280px;overflow-y:auto;padding:4px 0">
          ${hist.map(h => `
            <div style="display:flex;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
              <div style="width:6px;height:6px;border-radius:50%;background:${colors[h.tipo]||'var(--text3)'};flex-shrink:0;margin-top:6px"></div>
              <div style="flex:1;min-width:0">
                <div style="font-size:10px;color:var(--text3);font-family:monospace">${Parsers.fmtDate(h.fecha)}</div>
                <div style="font-size:11px;color:var(--text2)">
                  <strong style="color:${colors[h.tipo]||'var(--text2)'};text-transform:uppercase;font-size:10px">${esc(h.tipo)}</strong>
                  ${h.motivo?' — '+esc(h.motivo):''}
                  ${h.cambios?' — '+Object.keys(h.cambios).map(k2=>`${k2}: "${esc(h.cambios[k2].de||'—')}" → "${esc(h.cambios[k2].a||'—')}"`).join(', '):''}
                  ${h.fuente?' <span style="color:var(--text3)">('+esc(h.fuente)+')</span>':''}
                </div>
              </div>
            </div>`).join('')}
        </div>`;
      }
    } else if (tab === 'fallas') {
      const fallas = (u.fallas || []);
      if (!fallas.length) {
        tabContent = `<div class="empty-state" style="padding:20px">
          Sin fallas registradas
          <div style="margin-top:10px"><button class="act-btn" onclick="event.stopPropagation();UI.openRegistrarFalla('${esc(u.num)}','${esc(emp)}')">+ Registrar falla</button></div>
        </div>`;
      } else {
        tabContent = `<div style="display:flex;flex-direction:column;gap:6px;max-height:280px;overflow-y:auto">
          ${fallas.map(f => `
            <div style="padding:9px 11px;background:var(--bg-panel);border-radius:7px;border-left:3px solid ${f.resuelta?'var(--green)':(f.esSiniestro?'var(--red)':'var(--yellow)')}">
              <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:3px">
                <strong style="font-size:11px;color:${f.resuelta?'var(--green)':(f.esSiniestro?'var(--red)':'var(--yellow)')}">
                  ${f.esSiniestro?'🚨 SINIESTRO':'⚠ FALLA'}${f.resuelta?' (resuelta)':''}
                </strong>
                <span style="font-size:10px;color:var(--text3);font-family:monospace">${Parsers.fmtDate(f.fecha)}</span>
              </div>
              <div style="font-size:11px;color:var(--text2)">${esc(f.motivo||'Sin motivo')}</div>
              ${f.ubicacion?`<div style="font-size:10px;color:var(--text3);margin-top:2px">📍 ${esc(f.ubicacion)}</div>`:''}
              ${f.descripcion?`<div style="font-size:10px;color:var(--text3);margin-top:2px">${esc(f.descripcion)}</div>`:''}
            </div>`).join('')}
          <button class="act-btn" style="margin-top:8px" onclick="event.stopPropagation();UI.openRegistrarFalla('${esc(u.num)}','${esc(emp)}')">+ Registrar nueva falla</button>
        </div>`;
      }
    } else if (tab === 'notas') {
      // Observaciones EDITABLES in-situ
      const obsActual = u.observaciones || '';
      const notasAct = u.notas || '';
      tabContent = `
        <div style="display:flex;flex-direction:column;gap:10px;max-height:280px;overflow-y:auto">
          <div>
            <label style="display:block;font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">OBSERVACIONES (de asignación)</label>
            <textarea id="pid-obs-${esc(u.num)}" rows="3" placeholder="Escribe una observación..." style="width:100%;background:var(--bg-panel);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);font-family:var(--font);font-size:12px;resize:vertical" onclick="event.stopPropagation()">${esc(obsActual)}</textarea>
          </div>
          <div>
            <label style="display:block;font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">NOTAS ADICIONALES</label>
            <textarea id="pid-notas-${esc(u.num)}" rows="3" placeholder="Notas internas sobre esta unidad..." style="width:100%;background:var(--bg-panel);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);font-family:var(--font);font-size:12px;resize:vertical" onclick="event.stopPropagation()">${esc(notasAct)}</textarea>
          </div>
          <div style="display:flex;gap:6px">
            <button class="act-btn act-btn-primary" onclick="event.stopPropagation();UI._guardarObsInline('${esc(u.num)}','${esc(emp)}','${plat}')">💾 Guardar cambios</button>
            <div style="font-size:10px;color:var(--text3);align-self:center">Los cambios quedan guardados en la unidad</div>
          </div>
        </div>`;
    }

    // ══ LAYOUT GENERAL ══
    return `
      <div id="plat-inline-detail" style="border-top:2px solid var(--blue);background:var(--bg-card);padding:14px 18px;animation:slideIn .2s ease" onclick="event.stopPropagation()">

        <!-- Breadcrumbs -->
        <div style="display:flex;align-items:center;gap:8px;font-size:10px;color:var(--text3);margin-bottom:10px">
          <a onclick="UI._cerrarPlatDetailInline()" style="color:var(--blue);cursor:pointer">← Volver al resumen</a>
          <span>›</span>
          <span>Unidades</span>
          <span>›</span>
          <strong style="color:var(--text2)">${esc(u.num)}</strong>
        </div>

        <!-- Tarjeta superior -->
        <div style="display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap;margin-bottom:12px;padding:14px;background:var(--bg-panel);border-radius:10px;border:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:12px;min-width:180px">
            <div style="width:54px;height:54px;border-radius:50%;border:3px solid ${clsColor};background:${clsColor}22;display:flex;align-items:center;justify-content:center;font-size:22px">${cls==='critico'?'🔴':cls==='atencion'?'🟡':cls==='sin'?'⚪':'🟢'}</div>
            <div>
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                <div style="font-size:28px;font-weight:700;letter-spacing:-.02em;line-height:1">${esc(u.num)}</div>
                ${etiquetas}
              </div>
              <div style="font-size:11px;font-weight:700;color:${clsColor};margin-top:4px;letter-spacing:.04em">${clsLabel}</div>
              <div style="font-size:10px;color:var(--text3);margin-top:2px">Empresa: ${esc(u.empresa_asig||emp)}</div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px 20px;flex:1;min-width:280px">
            ${[
              ['BASE', u.base],
              ['CROMÁTICA', u.cromatica],
              ['MODELO', u.modelo],
              ['ESTATUS', Parsers.categorizarEstatus(u.estatus)],
              ['ROL', u.rol],
              ['PLACA', u.placa],
              ['EMPRESA ASIG', u.empresa_asig || emp]
            ].map(([l,v]) => `<div><div style="font-size:9px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.04em">${l}</div><div style="font-size:12px;font-weight:600;margin-top:2px">${esc(v||'—')}</div></div>`).join('')}
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;text-align:right;align-self:stretch;justify-content:space-between;padding:4px 0;border-left:1px solid var(--border);padding-left:14px">
            <div>
              <div style="font-size:9px;color:var(--text3);font-weight:700;margin-bottom:2px">PLATAFORMAS CONECTADAS</div>
              <div style="font-size:20px;font-weight:700;color:var(--blue)">${platsConDatos}<span style="font-size:11px;color:var(--text3);margin-left:3px">de ${ALL_PLATS.length}</span></div>
            </div>
            <div style="font-size:10px;color:${platsSinDatos>0?'var(--yellow)':'var(--green)'}">${platsSinDatos} sin datos</div>
          </div>
        </div>

        <!-- Botones de acción rápida -->
        <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">
          <button class="act-btn" onclick="event.stopPropagation();UI._cerrarPlatDetailInline()">← Volver a resumen</button>
          <button class="act-btn" onclick="event.stopPropagation();UI.openEditarUnidad('${esc(u.num)}','${esc(emp)}')">✎ Editar</button>
          <button class="act-btn act-btn-danger-soft" onclick="event.stopPropagation();UI.openRegistrarFalla('${esc(u.num)}','${esc(emp)}')">⚠ Registrar falla</button>
          <button class="act-btn" onclick="event.stopPropagation();UI.openDatePicker(null,iso=>{UI._updatePlatFechaConISO('${esc(u.num)}','${plat}','${esc(emp)}',iso);UI._refreshPlatTable('${plat}')}, '${plat} — Actualizar conexión')">📡 Actualizar ${plat}</button>
          <button class="act-btn" onclick="event.stopPropagation();UI.openUnitDetail('${esc(u.num)}')">🔎 Vista completa</button>
          <button class="act-btn act-btn-danger-soft" onclick="event.stopPropagation();if(confirm('¿Eliminar unidad ${esc(u.num)}?')){DB.eliminarUnidad('${esc(u.num)}','${esc(emp)}');UI.toast('Unidad eliminada','info');UI._cerrarPlatDetailInline();UI._refreshPlatTable('${plat}');}">🗑 Eliminar</button>
          <button class="act-btn" style="margin-left:auto" onclick="event.stopPropagation();UI._cerrarPlatDetailInline()">✕ Cerrar</button>
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:2px;border-bottom:1px solid var(--border);margin-bottom:14px">
          ${[
            ['conexiones','Conexiones GPS',platsConDatos],
            ['historial','Historial',(u.historial||[]).length],
            ['fallas','Fallas',(u.fallas||[]).filter(f=>!f.resuelta).length],
            ['notas','Notas','']
          ].map(([id,label,count]) => {
            const active = tab === id;
            return `<div onclick="event.stopPropagation();UI._cambiarPlatDetailTab('${id}','${plat}')" style="padding:8px 14px;font-size:11px;font-weight:${active?'700':'500'};color:${active?'var(--blue)':'var(--text3)'};border-bottom:2px solid ${active?'var(--blue)':'transparent'};cursor:pointer;margin-bottom:-1px">${esc(label)}${count!==''&&count>0?` <span style="background:${active?'var(--blue)':'var(--bg-panel)'};color:${active?'white':'var(--text3)'};padding:0 6px;border-radius:8px;font-size:10px">${count}</span>`:''}</div>`;
          }).join('')}
        </div>

        <!-- Contenido del tab -->
        <div>${tabContent}</div>
      </div>
      <style>
        .plat-inline-card{transition:transform .15s}
        .plat-inline-card:hover{transform:translateY(-2px)}
      </style>
    `;
  }

  /**
   * Cambia el tab activo del detalle inline sin cerrar el panel
   */
  function _cambiarPlatDetailTab(tabId, plat) {
    _platDetailTab = tabId;
    _refreshPlatTable(plat);
  }

  /**
   * Edita observaciones rápidamente desde la celda de la tabla de plataformas.
   * Se abre un prompt simple (sin re-renderizar toda la tabla mientras se escribe,
   * para no perder foco). Al guardar actualiza la unidad y refresca la tabla.
   */

  // ══════════════════════════════════════════════════════════════════
  //  DESINSTALACIÓN DE EQUIPO GPS
  // ══════════════════════════════════════════════════════════════════
  function _modalDesinstalacion(num, platDes, emp, platTabla) {
    const prev = document.getElementById('modal-desinstalacion');
    if (prev) prev.remove();
    const u = DB.getUnidad(num, emp);
    if (!u) return;
    const desKey = 'desinstalacion_' + platDes.toLowerCase();
    const existing = u[desKey] || {};
    const fechaDefault = existing.fecha || new Date().toISOString().slice(0,10);
    const comentDefault = existing.comentario || '';
    const modal = document.createElement('div');
    modal.id = 'modal-desinstalacion';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:9999;display:flex;align-items:center;justify-content:center';
    modal.innerHTML = `
      <div style="background:var(--bg-card);border:1px solid var(--border2);border-radius:12px;padding:24px;width:360px;max-width:95vw;box-shadow:0 20px 60px rgba(0,0,0,.6)">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px">
          <span style="font-size:20px">🔧</span>
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--text)">Desinstalación de equipo</div>
            <div style="font-size:11px;color:var(--text3)">Unidad ${esc(num)} · Plataforma ${esc(platDes)}</div>
          </div>
        </div>
        <div style="margin-bottom:12px">
          <label style="font-size:10px;color:var(--text3);display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em">Fecha de desinstalación</label>
          <input id="des-fecha" type="date" value="${fechaDefault}" style="width:100%;background:var(--bg-base);border:1px solid var(--border2);border-radius:6px;padding:7px 10px;color:var(--text);font-size:13px">
        </div>
        <div style="margin-bottom:18px">
          <label style="font-size:10px;color:var(--text3);display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em">Comentario / motivo</label>
          <textarea id="des-comentario" rows="3" placeholder="Ej: Equipo retirado por falla, enviado a taller..." style="width:100%;background:var(--bg-base);border:1px solid var(--border2);border-radius:6px;padding:7px 10px;color:var(--text);font-size:12px;resize:vertical">${esc(comentDefault)}</textarea>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button onclick="document.getElementById('modal-desinstalacion').remove()" style="padding:7px 14px;border-radius:6px;border:1px solid var(--border2);background:transparent;color:var(--text2);cursor:pointer;font-size:12px">Cancelar</button>
          <button id="des-guardar-btn" style="padding:7px 16px;border-radius:6px;border:none;background:#7a2810;color:#fff;cursor:pointer;font-size:12px;font-weight:600">Registrar desinstalación</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.getElementById('des-guardar-btn').onclick = () => {
      const fecha = document.getElementById('des-fecha').value;
      const comentario = document.getElementById('des-comentario').value.trim();
      if (!fecha) { toast('Selecciona una fecha','warn'); return; }
      const datos = {};
      datos[desKey] = { fecha, comentario, ts: new Date().toISOString() };
      const uObj = DB.getUnidad(num, emp);
      if (uObj) {
        uObj.historial = uObj.historial || [];
        uObj.historial.push({ fecha: new Date().toISOString(), tipo: 'desinstalacion', motivo: `${platDes}: ${comentario||'sin comentario'}`, fuente: 'manual' });
      }
      DB.upsertUnidad(num, datos, emp);
      // Sincronizar a Supabase
      if (window.GPS_SB) {
        GPS_SB.patchDesinstalacionBarrido(num, emp, platDes, { fecha, comentario, ts: new Date().toISOString() })
          .catch(() => {});
      }
      modal.remove();
      toast(`Desinstalación registrada en ${platDes}`, 'warn');
      // Refrescar vista completa
      const panelDetalle = document.getElementById('panel-detalle');
      if (panelDetalle && panelDetalle.classList.contains('active')) {
        renderDetalle(num, emp);
        return;
      }
      if (platTabla) _refreshPlatTable(platTabla);
      if (_platDetailUnit === num && _platExpandida) {
        const uUp = DB.getUnidad(num, emp);
        if (uUp) { const box = document.getElementById('plat-inline-detail'); if (box) box.outerHTML = _renderPlatDetailInline(uUp, platTabla || _platExpandida); }
      }
    };
  }

  function _liberarDesinstalacion(num, platDes, emp, platTabla) {
    const u = DB.getUnidad(num, emp);
    if (!u) return;
    const desKey = 'desinstalacion_' + platDes.toLowerCase();
    if (u[desKey]) {
      delete u[desKey];
      u.historial = u.historial || [];
      u.historial.push({ fecha: new Date().toISOString(), tipo: 'reactivacion', motivo: `Equipo liberado en ${platDes}`, fuente: 'manual' });
      DB.upsertUnidad(num, { updatedAt: new Date().toISOString() }, emp);
      if (window.GPS_SB) {
        GPS_SB.patchDesinstalacionBarrido(num, emp, platDes, null).catch(() => {});
      }
    }
    toast(`Equipo ${num} liberado en ${platDes}`, 'success');
    // Refrescar la vista completa del detalle de unidad
    const panelDetalle = document.getElementById('panel-detalle');
    if (panelDetalle && panelDetalle.classList.contains('active')) {
      renderDetalle(num, emp);
      return;
    }
    // Si está en la tabla de plataformas (detalle inline)
    if (platTabla) _refreshPlatTable(platTabla);
    if (_platDetailUnit === num && _platExpandida) {
      const uUp = DB.getUnidad(num, emp);
      if (uUp) { const box = document.getElementById('plat-inline-detail'); if (box) box.outerHTML = _renderPlatDetailInline(uUp, platTabla || _platExpandida); }
    }
  }

  function _editarObsRapido(num, emp, plat) {
    let u = DB.getUnidad(num, emp);
    if (!u) {
      DB.upsertUnidad(num, { activa: true, _soloBarrido: true, _fuente: 'obs_inline' }, emp);
      u = DB.getUnidad(num, emp);
    }
    if (!u) { toast('No se pudo crear la unidad','error'); return; }
    const fallaActiva = (u.fallas||[]).find(f => !f.resuelta);
    const actual = u.observaciones || (fallaActiva ? fallaActiva.motivo : '') || '';
    const nuevo = window.prompt(
      `Observaciones para unidad ${num}:\n(Se sincroniza con el registro de fallas)\n\n(Deja vacío para borrar)`,
      actual
    );
    if (nuevo === null) return; // canceló
    const texto = nuevo.trim();
    DB.upsertUnidad(num, { observaciones: texto, _fuente: 'edit_obs_inline' }, emp);

    // Sincronizar con fallas:
    if (texto) {
      if (fallaActiva) {
        // Actualizar motivo de falla activa existente
        fallaActiva.motivo = texto;
        fallaActiva.etiqueta = texto;
        DB.upsertUnidad(num, { fallas: u.fallas }, emp);
      } else if (!u.siniestro) {
        // Crear falla AFR con este texto si no hay ninguna activa
        DB.registrarFalla(num, emp, { motivo: texto, tipo: 'AFR', esSiniestro: false });
      }
    }

    toast('Observación guardada','success');
    if (_platExpandida === plat) _refreshPlatTable(plat);
  }

  /**
   * Edita las notas de una unidad directamente desde la tabla de plataformas.
   * Las notas se guardan en u.notas (campo de la unidad, no del barrido).
   * Sobreviven al borrar datos de plataforma porque viven en gps_unidades.
   */
  function _editarNotasRapido(num, emp) {
    // Reusar el mismo modal que _addNote para consistencia
    _addNote(num, emp);
  }

  /**
   * Guarda las observaciones y notas editadas inline en el detalle
   */
  function _guardarObsInline(num, emp, plat) {
    const obs = $('pid-obs-'+num)?.value || '';
    const notas = $('pid-notas-'+num)?.value || '';
    DB.upsertUnidad(num, { observaciones: obs, notas: notas, _fuente: 'edit_inline' }, emp);
    toast('Cambios guardados','success');
    _refreshPlatTable(plat);
  }

  function _cerrarPlatDetailInline() {
    if (!_platDetailUnit) return;
    _platDetailUnit = null;
    if (_platExpandida) _refreshPlatTable(_platExpandida);
  }

  /**
   * ESC cierra detalle inline; click fuera también
   */
  let _platEscBound = false;
  function _bindEscCerrarDetalle() {
    if (_platEscBound) return;
    _platEscBound = true;
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && _platDetailUnit && _platExpandida) {
        _cerrarPlatDetailInline();
      }
    });
    document.addEventListener('click', e => {
      if (!_platDetailUnit || !_platExpandida) return;
      const detail = document.getElementById('plat-inline-detail');
      if (!detail) return;
      // Si click fuera del detail y fuera de la tabla, cerrar
      const table = document.getElementById('plat-table-body');
      if (detail.contains(e.target)) return;
      if (table && table.contains(e.target)) return;
      _cerrarPlatDetailInline();
    });
  }

  /* ─── CAPTURA MANUAL INLINE PARA VOLVO/MOTIVE ────────── */
  function _abrirCapturaManualPlat(plat) {
    _platExpandida = plat;
    _platDetailUnit = null;
    renderPlataformas();
    // Dar foco al input de número y auto-llenar fecha/hora actual
    setTimeout(() => {
      const eNum = $('pf-m-num');
      if (eNum) eNum.focus();
      const eFecha = $('pf-m-fecha');
      if (eFecha && !eFecha.value) {
        // datetime-local requiere formato "YYYY-MM-DDTHH:MM"
        const now = new Date();
        const pad = n => String(n).padStart(2,'0');
        eFecha.value = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
        _recalcularDiasManual();
      }
    }, 150);
  }

  function _autocompletarCapturaManual(plat) {
    const num = ($('pf-m-num')?.value || '').trim();
    const emp = DB.getEmpresaActiva();
    if (!num) {
      ['pf-m-base','pf-m-crom','pf-m-modelo','pf-m-id','pf-m-dias'].forEach(id => {
        const e = $(id); if (!e) return;
        if (id === 'pf-m-dias') e.textContent = '—'; else e.value = '';
      });
      return;
    }
    const u = DB.getUnidad(num, emp);
    if (!u) {
      if ($('pf-m-base'))   $('pf-m-base').value   = '(no existe en asignación)';
      if ($('pf-m-crom'))   $('pf-m-crom').value   = '';
      if ($('pf-m-modelo')) $('pf-m-modelo').value = '';
      if ($('pf-m-id'))     $('pf-m-id').value     = '';
      if ($('pf-m-dias'))   $('pf-m-dias').textContent = '—';
      return;
    }
    if ($('pf-m-base'))   $('pf-m-base').value   = u.base || '';
    if ($('pf-m-crom'))   $('pf-m-crom').value   = u.cromatica || '';
    if ($('pf-m-modelo')) $('pf-m-modelo').value = u.modelo || '';
    if ($('pf-m-id'))     $('pf-m-id').value     = u.placa || '';

    // Calcular días si ya hay fecha en el input
    _recalcularDiasManual();
  }

  function _recalcularDiasManual() {
    const fechaInput = $('pf-m-fecha')?.value;
    const el = $('pf-m-dias');
    if (!el) return;
    if (!fechaInput) { el.textContent = '—'; el.style.color = 'var(--text2)'; return; }
    const dias = Math.floor((Date.now() - new Date(fechaInput).getTime()) / 86400000);
    el.textContent = dias + 'd';
    el.style.color = dias <= 1 ? 'var(--green)' : dias <= 4 ? 'var(--yellow)' : 'var(--red)';
  }

  function _guardarCapturaManualPlat(plat) {
    const num = ($('pf-m-num')?.value || '').trim();
    const fecha = $('pf-m-fecha')?.value;
    if (!num)   { toast('Ingresa el número de unidad', 'warn'); return; }
    if (!fecha) { toast('Ingresa la fecha de última conexión', 'warn'); return; }
    const emp = DB.getEmpresaActiva();
    const u = DB.getUnidad(num, emp);
    if (!u) {
      if (!confirm(`La unidad ${num} no existe en la asignación. ¿Crear solo con datos de barrido ${plat}?`)) return;
    }
    const iso = new Date(fecha).toISOString();
    const platKey = 'ultima_act_' + plat.toLowerCase();
    const idPlaca = ($('pf-m-id')?.value || '').trim();
    const datos = { [platKey]: iso, plataforma: plat, _fuente: 'captura_manual_' + plat };
    if (!u || !u.ultima_act || new Date(iso) > new Date(u.ultima_act)) datos.ultima_act = iso;
    DB.upsertUnidad(num, datos, emp);

    // Guardar en Supabase: gps_barridos (para la tabla de Plataformas)
    // y gps_unidades (para que DB.getUnidadesList la encuentre en cualquier navegador)
    if (window.GPS_SB) {
      const uActual = DB.getUnidad(num, emp) || {};
      const raw = { num, fecha: iso, fechaStr: Parsers.fmtDate(iso), plataforma: plat };
      if (idPlaca) raw.placa = idPlaca;

      // upsert en gps_unidades primero (así la unidad existe antes de upsert en barridos)
      GPS_SB.upsertUnidad({
        num,
        base:      uActual.base      || $('pf-m-base')?.value   || null,
        cromatica: uActual.cromatica || $('pf-m-crom')?.value   || null,
        modelo:    uActual.modelo    || $('pf-m-modelo')?.value || null,
        placa:     idPlaca           || uActual.placa           || null,
        estatus:   uActual.estatus   || 'EN_OPERACION',
      }, emp)
      .then(() => GPS_SB.saveBarrido(plat, [raw], emp))
      .catch(e => console.warn('[Captura manual] Error guardando en Supabase:', e));
    }

    DB.addLog('manual', `${plat}: captura manual unidad ${num} (${Parsers.fmtDate(iso)})`, emp);
    toast(`✓ ${plat}: unidad ${num} guardada`, 'success');

    // Limpiar y refrescar
    ['pf-m-num','pf-m-base','pf-m-crom','pf-m-modelo','pf-m-id','pf-m-fecha'].forEach(id => { const e = $(id); if (e && e.tagName !== 'DIV') e.value = ''; });
    if ($('pf-m-dias')) $('pf-m-dias').textContent = '—';
    _refreshPlatTable(plat);
  }

  function _platCheckAll(chkAll, plat) {
    document.querySelectorAll('.plat-row-chk').forEach(c => { c.checked = chkAll.checked; });
    _platUpdateSelCount();
  }

  function _platUpdateSelCount() {
    const sel = document.querySelectorAll('.plat-row-chk:checked');
    const btn = document.getElementById('plat-btn-del-sel');
    const cnt = document.getElementById('plat-sel-count');
    if (btn) btn.style.display = sel.length > 0 ? '' : 'none';
    if (cnt) cnt.textContent = sel.length;
  }

  function _eliminarSeleccionadas(plat) {
    const chks = document.querySelectorAll('.plat-row-chk:checked');
    if (!chks.length) return;
    const nums = Array.from(chks).map(c => c.dataset.num);
    if (!confirm('Eliminar ' + nums.length + ' unidad(es) de ' + plat + '? Solo se eliminan del barrido, no de la asignacion.')) return;
    const emp = DB.getEmpresaActiva();
    nums.forEach(num => {
      const borrado = {};
      borrado['ultima_act_' + plat.toLowerCase()] = null;
      if (plat === 'SAMSARA') { borrado.estado_samsara = null; borrado.vin_samsara = null; }
      if (plat === 'MOTIVE')  { borrado.estado_motive = null; borrado.motive_vg = null; borrado.motive_cam = null; }
      DB.upsertUnidad(num, borrado, emp);
      if (window.GPS_SB) {
        const c = window.CCTV_SUPABASE_CONFIG || {};
        const url = (c.url || 'https://sxzhmcrpeyuqslupttby.supabase.co') + '/rest/v1';
        const key = c.anonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4emhtY3JwZXl1cXNsdXB0dGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MjQ5MDgsImV4cCI6MjA5MzAwMDkwOH0.-muAjBKc2PekqbgRltLVBnUCdxfQlHNxmVruXrw_sl8';
        const h = { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' };
        fetch(url + '/gps_barridos?num_economico=eq.' + encodeURIComponent(num) + '&empresa_id=eq.' + encodeURIComponent(emp) + '&plataforma=eq.' + encodeURIComponent(plat), { method: 'PATCH', headers: h, body: JSON.stringify({ activa: false, ultima_conexion: null, tiene_datos: false }) }).catch(()=>{});
      }
    });
    toast(nums.length + ' unidad(es) eliminadas de ' + plat, 'info');
    _platDetailUnit = null;
    // Ocultar botón y resetear contador ANTES de re-renderizar
    const _btnDel = document.getElementById('plat-btn-del-sel');
    const _cntDel = document.getElementById('plat-sel-count');
    if (_btnDel) _btnDel.style.display = 'none';
    if (_cntDel) _cntDel.textContent = '0';
    _refreshPlatTable(plat);
  }

  function _eliminarDeBarrido(num, emp, plat) {
    if (!confirm('Eliminar unidad ' + num + ' de ' + plat + '? Solo se elimina del barrido, no de la asignacion.')) return;
    const borrado = {};
    borrado['ultima_act_' + plat.toLowerCase()] = null;
    if (plat === 'SAMSARA') { borrado.estado_samsara = null; borrado.vin_samsara = null; }
    if (plat === 'MOTIVE')  { borrado.estado_motive = null; borrado.motive_vg = null; borrado.motive_cam = null; }
    DB.upsertUnidad(num, borrado, emp);
    toast('Unidad ' + num + ' eliminada de ' + plat, 'info');
    if (window.GPS_SB) {
      const c = window.CCTV_SUPABASE_CONFIG || {};
      const url = (c.url || 'https://sxzhmcrpeyuqslupttby.supabase.co') + '/rest/v1';
      const key = c.anonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4emhtY3JwZXl1cXNsdXB0dGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MjQ5MDgsImV4cCI6MjA5MzAwMDkwOH0.-muAjBKc2PekqbgRltLVBnUCdxfQlHNxmVruXrw_sl8';
      const h = { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' };
      fetch(url + '/gps_barridos?num_economico=eq.' + encodeURIComponent(num) + '&empresa_id=eq.' + encodeURIComponent(emp) + '&plataforma=eq.' + encodeURIComponent(plat), { method: 'PATCH', headers: h, body: JSON.stringify({ activa: false, ultima_conexion: null, tiene_datos: false }) }).catch(()=>{});
    }
    _platDetailUnit = null;
    _refreshPlatTable(plat);
  }

  function _editarFechaInline(num, plat, tdEl) {
    if (!tdEl) return;
    const emp = DB.getEmpresaActiva();
    const u = DB.getUnidad(num, emp);
    const platKey = 'ultima_act_' + plat.toLowerCase();
    const fechaActual = u && u[platKey] ? u[platKey] : '';
    const toLocal = iso => {
      if (!iso) return '';
      const d = new Date(iso);
      const p = n => String(n).padStart(2,'0');
      return d.getFullYear() + '-' + p(d.getMonth()+1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
    };
    tdEl.innerHTML = [
      '<input type="datetime-local" style="font-size:11px;background:var(--bg-base);border:1px solid var(--blue);border-radius:4px;padding:2px 4px;color:var(--text);width:160px" value="' + toLocal(fechaActual) + '">',
      '<button style="margin-left:4px;padding:2px 6px;border-radius:4px;background:var(--blue);color:#fff;border:none;cursor:pointer;font-size:10px" onclick="event.stopPropagation();UI._confirmarFechaInline(this,&quot;' + num + '&quot;,&quot;' + plat + '&quot;)">✓</button>',
      '<button style="margin-left:2px;padding:2px 6px;border-radius:4px;background:var(--bg-card);color:var(--text2);border:1px solid var(--border);cursor:pointer;font-size:10px" onclick="event.stopPropagation();UI._refreshPlatTable(&quot;' + plat + '&quot;)">✕</button>'
    ].join('');
    tdEl.querySelector('input') && tdEl.querySelector('input').focus();
  }

  function _confirmarFechaInline(btnEl, num, plat) {
    const td = btnEl.closest('td');
    if (!td) return;
    const inp = td.querySelector('input');
    if (!inp || !inp.value) { toast('Fecha inválida', 'warn'); return; }
    const emp = DB.getEmpresaActiva();
    const iso = new Date(inp.value).toISOString();
    const platKey = 'ultima_act_' + plat.toLowerCase();
    const datos = {};
    datos[platKey] = iso;
    const u = DB.getUnidad(num, emp);
    if (!u || !u.ultima_act || new Date(iso) > new Date(u.ultima_act)) datos.ultima_act = iso;
    DB.upsertUnidad(num, datos, emp);
    toast('Fecha actualizada: ' + num, 'success');
    if (window.GPS_SB) {
      const c = window.CCTV_SUPABASE_CONFIG || {};
      const url = (c.url || 'https://sxzhmcrpeyuqslupttby.supabase.co') + '/rest/v1';
      const key = c.anonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4emhtY3JwZXl1cXNsdXB0dGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MjQ5MDgsImV4cCI6MjA5MzAwMDkwOH0.-muAjBKc2PekqbgRltLVBnUCdxfQlHNxmVruXrw_sl8';
      const h = { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' };
      fetch(url + '/gps_barridos?num_economico=eq.' + encodeURIComponent(num) + '&empresa_id=eq.' + encodeURIComponent(emp) + '&plataforma=eq.' + encodeURIComponent(plat), { method: 'PATCH', headers: h, body: JSON.stringify({ ultima_conexion: iso, tiene_datos: true, activa: true }) }).catch(()=>{});
    }
    _refreshPlatTable(plat);
  }

  /**
   * Doble clic en fila de VOLVO/MOTIVE: pre-llena el formulario de captura manual
   * con los datos de la unidad para que el usuario solo corrija la fecha.
   * NO re-renderiza — solo llena los campos del form que ya está visible.
   */
  function _editarCapturaManuaRow(num, plat) {
    const emp = DB.getEmpresaActiva();
    const u = DB.getUnidad(num, emp);
    if (!u) return;

    // Limpiar detalle inline si estaba abierto (evita que la tabla desaparezca)
    _platDetailUnit = null;

    // Pre-llenar campos del form que ya está en el DOM
    if ($('pf-m-num'))    $('pf-m-num').value    = num;
    if ($('pf-m-base'))   $('pf-m-base').value   = u.base || '';
    if ($('pf-m-crom'))   $('pf-m-crom').value   = u.cromatica || '';
    if ($('pf-m-modelo')) $('pf-m-modelo').value = u.modelo || '';
    if ($('pf-m-id'))     $('pf-m-id').value     = u.placa || '';

    // Fecha: hora actual del momento del barrido
    const eFecha = $('pf-m-fecha');
    if (eFecha) {
      const now = new Date();
      const pad = n => String(n).padStart(2,'0');
      eFecha.value = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
      _recalcularDiasManual();
    }

    // Scroll suave al formulario y foco en fecha
    const bar = $('pf-manual-bar');
    if (bar) bar.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (eFecha) eFecha.focus();
  }

  function _updatePlatFechaConISO(num, plat, emp, iso) {
    if (!iso) return;
    const u = DB.getUnidad(num, emp);
    if (!u) return;
    const platKey = 'ultima_act_' + plat.toLowerCase();
    const datos = { [platKey]: iso };
    if (!u.ultima_act || new Date(iso) > new Date(u.ultima_act)) datos.ultima_act = iso;
    DB.upsertUnidad(num, datos, emp);
    DB.addLog('manual', `${plat}: fecha GPS actualizada para unidad ${num} (${Parsers.fmtDate(iso)})`, emp);
    toast(`✓ ${plat} actualizado`, 'success');
    renderPlataformas();
  }

  /**
   * Exporta las unidades que NO tienen datos en la plataforma seleccionada
   * (para planificar instalaciones)
   */
  function _exportarFaltantesPlat(plat) {
    const emp=DB.getEmpresaActiva();
    const k='ultima_act_'+plat.toLowerCase();
    const uns=DB.getUnidadesList(emp).filter(u=>u.activa && !u[k]);
    if (!uns.length) { toast(`No hay unidades faltantes en ${plat}`,'info'); return; }
    const cols=['num','base','cromatica','modelo','estatus','rol','placa','serie','empresa_asig','plataforma_actual'];
    const header=['UNIDAD','BASE','CROMATICA','MODELO','ESTATUS','ROL','PLACA','SERIE','EMPRESA','PLATAFORMA_ACTUAL'];
    const PLATS=['CEIBA','SAMSARA','AVL','SCANIA','MAN','VOLVO','MOTIVE'];
    const rows=uns.map(u=>{
      const platsActuales = PLATS.filter(p => u['ultima_act_'+p.toLowerCase()]).join(' | ') || 'Ninguna';
      return cols.map(c => {
        let v = c === 'plataforma_actual' ? platsActuales : (u[c] ?? '');
        return `"${String(v).replace(/"/g,'""')}"`;
      }).join(',');
    });
    const csv=[header.join(','),...rows].join('\n');
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));
    a.download=`faltantes_${plat}_${emp}_${new Date().toISOString().substring(0,10)}.csv`;
    a.click();
    toast(`✓ ${uns.length} unidades sin ${plat} exportadas`,'success');
  }

  /**
   * Exporta las unidades FUERA DE LÍNEA de la plataforma seleccionada
   */
  function _exportarFueraLineaPlat(plat) {
    const emp=DB.getEmpresaActiva();
    const cfg=DB.getConfig();
    const hoy=Date.now();
    const k='ultima_act_'+plat.toLowerCase();
    const uns=DB.getUnidadesList(emp).filter(u=>{
      if(!u.activa) return false;
      if(!u[k]) return false;
      const _fdE=new Date(String(u[k]).replace(' ','T'));
      if(isNaN(_fdE)) return false;
      const _hDE=new Date(hoy);
      const _hME=new Date(_hDE.getFullYear(),_hDE.getMonth(),_hDE.getDate());
      const _fME=new Date(_fdE.getFullYear(),_fdE.getMonth(),_fdE.getDate());
      const d=Math.floor((_hME-_fME)/86400000);
      return d > cfg.diasAtencion;
    }).map(u=>({
      ...u,
      _dias: (()=>{ const _fdM=new Date(String(u[k]).replace(' ','T')); if(isNaN(_fdM)) return 0; const _hDM=new Date(hoy); const _hMM=new Date(_hDM.getFullYear(),_hDM.getMonth(),_hDM.getDate()); const _fMM=new Date(_fdM.getFullYear(),_fdM.getMonth(),_fdM.getDate()); return Math.floor((_hMM-_fMM)/86400000); })()
    })).sort((a,b)=>b._dias-a._dias);

    if (!uns.length) { toast(`No hay unidades fuera de línea en ${plat}`,'info'); return; }

    const header=['UNIDAD','EMPRESA','BASE','CROMATICA','PLATAFORMA','FECHA_ULT_ACTUALIZACION','DIAS_SIN_CONEXION','PLACA','OBSERVACIONES'];
    const rows=uns.map(u=>{
      return [
        u.num, u.empresa_asig||emp, u.base||'', u.cromatica||'',
        plat, Parsers.fmtDate(u[k]), u._dias, u.placa||'', u.observaciones||''
      ].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',');
    });
    const csv=[header.join(','),...rows].join('\n');
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));
    a.download=`fuera_linea_${plat}_${emp}_${new Date().toISOString().substring(0,10)}.csv`;
    a.click();
    toast(`✓ ${uns.length} unidades fuera de línea (${plat}) exportadas`,'success');
  }

  async function _cargarArchivoPlat(plat,file){
    if(!file)return;
    toast(`Procesando ${plat}...`,'info',2000);
    try{
      const {sheets,sheetNames,isAVL}=await Parsers.readXLSX(file);
      const sheetName=Parsers.selectSheet(sheets,sheetNames,plat);

      // Para AVL: mostrar mensaje explícito de la hoja que se usó
      if (plat === 'AVL') {
        console.log(`[AVL] Hojas encontradas: ${sheetNames.join(', ')} → Leyendo: "${sheetName}"`);
        if (!sheetName || sheetName.toLowerCase().includes('content')) {
          toast(`⚠ No se encontró la hoja "Últimos datos de la unidad" en el archivo AVL`, 'error', 5000);
          return;
        }
      }

      const rows = sheets[sheetName];
      if (!rows || rows.length < 2) {
        toast(`La hoja "${sheetName}" está vacía o no tiene datos`, 'warn', 4000);
        return;
      }

      const parsed=Parsers.parsearPorPlataforma(plat,rows);
      if(!parsed.length){
        toast(`No se encontraron datos válidos en ${plat} (hoja: ${sheetName})`,'warn',5000);
        return;
      }
      _barridosPending[plat]={parsed,filename:file.name,val:Parsers.validarResultado(parsed),sheetName};
      const emp = DB.getEmpresaActiva();
      const totalArchivo = rows.length - 1;
      const descartados = totalArchivo - parsed.length;
      const msgDesc = descartados > 0 ? ` (${descartados} sin número económico)` : '';

      // ── Guardar local (sincrono) ──────────────────────────────────────────
      const res = DB.saveBarrido(plat, parsed, emp);

      // ── Guardar en Supabase (await — toast muestra resultado real) ────────
      let sbOk = false;
      if (window.GPS_SB) {
        try {
          await GPS_SB.saveBarrido(plat, parsed, emp);
          sbOk = true;
          toast(`✓ ${plat} (${sheetName}): ${parsed.length} registros${msgDesc} → ${res.actualizadas} act. locales · Supabase ✓`, 'success', 5000);
        } catch(sbErr) {
          console.error('[saveBarrido Supabase]', sbErr);
          toast(`⚠ ${plat}: guardado local OK pero falló Supabase: ${sbErr.message}`, 'error', 8000);
        }
      } else {
        toast(`✓ ${plat} (${sheetName}): ${parsed.length} registros${msgDesc} → ${res.actualizadas} actualizadas en ${emp}`, 'success', 7000);
      }

      if (typeof App !== 'undefined' && App._bloquearBarridosSync) App._bloquearBarridosSync();
      renderPlataformas();
      renderResumen();
    }catch(err){
      toast(`Error en ${plat}: `+err.message,'error');
      console.error(err);
    }
  }


  // Inyectar en UI
  Object.assign(UI_P, {
    renderPlataformas, _refreshPlatTable, _togglePlatDetail,
    _renderPlatDetail, _onPlatFilterChange, _resetPlatFilters,
    _eliminarSeleccionadas, _eliminarDeBarrido,
    _editarFechaInline, _confirmarFechaInline,
    _guardarObsInline, _cerrarPlatDetailInline,
    _abrirCapturaManualPlat, _guardarCapturaManualPlat,
    _platCheckAll, _platUpdateSelCount,
    _exportarFaltantesPlat, _exportarFueraLineaPlat,
    _cambiarPlatDetailTab, _modalDesinstalacion, _liberarDesinstalacion,
    _renderPlatDetailInline, _onPlatRowClick,
    _platExpandida: undefined
  });
})();
