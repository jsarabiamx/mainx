/**
 * ui-fallas.js — Panel Fallas (AFR · Siniestros) + Barrido Manual
 * Incluye cambiarEmpresa, exportar, nav helpers
 * Se inyecta en window.UI después de ui.js
 */
(function() {
  const UI_P = window.UI;
  if (!UI_P) { console.error('ui-fallas: UI no disponible'); return; }

  // Helpers compartidos desde ui.js
  if (!window.UI_HELPERS) { console.error('ui-fallas.js: UI_HELPERS no disponible'); return; }
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
     PANEL: FALLAS v2 (AFR, Siniestros, Liberadas, Reincidencias — control completo)
  ══════════════════════════════════════════════════════ */
  let _fallasFilter = { tipo:'todas', search:'' };
  let _fallasTab    = 'activas'; // 'activas' | 'liberadas' | 'metricas'

  function renderFallasPanel() {
    const emp = DB.getEmpresaActiva();
    const el = $('fallas-content');
    if (!el) return;

    // ── Reunir datos ──────────────────────────────────────────────
    const uns = DB.getUnidadesList(emp).filter(u => u.activa);
    const conFallas = [];
    uns.forEach(u => {
      const activas = (u.fallas || []).filter(f => !f.resuelta);
      if (activas.length > 0) conFallas.push({ ...u, _fallasActivas: activas });
    });

    const stats = DB.getFallasStats(emp);
    const { tagStats, topProblematicas, liberadas, totalReincidentes, tiempoPromedioFallaMs } = stats;
    const sTag = tagStats['SINIESTRO'] || { activos: 0, totalHistorico: 0 };
    const aTag = tagStats['AFR']       || { activos: 0, totalHistorico: 0 };

    // ── Filtros de la tab activa ──────────────────────────────────
    const f = _fallasFilter;
    let lista = conFallas;
    if (f.tipo === 'siniestros') lista = lista.filter(u => u._fallasActivas.some(ff => ff.esSiniestro));
    else if (f.tipo === 'afr')   lista = lista.filter(u => u._fallasActivas.some(ff => !ff.esSiniestro));
    if (f.search) {
      lista = lista.filter(u => _multiTokenMatch(f.search, [
        u.num, u.base, u.modelo, u.cromatica, u.placa, u.empresa_asig,
        ...(u._fallasActivas||[]).map(ff => (ff.motivo||'') + ' ' + (ff.ubicacion||'') + ' ' + (ff.descripcion||''))
      ].join(' ')));
    }

    // ── Conteos KPI ───────────────────────────────────────────────
    const totalSiniestros = conFallas.filter(u => u._fallasActivas.some(ff => ff.esSiniestro)).length;
    const totalAFR        = conFallas.filter(u => u._fallasActivas.some(ff => !ff.esSiniestro)).length;
    const tiempoPromDias  = tiempoPromedioFallaMs > 0 ? (tiempoPromedioFallaMs / 86400000).toFixed(1) : '—';

    // Filtrar liberadas según búsqueda
    let listaLiberadas = liberadas;
    if (f.search) {
      listaLiberadas = liberadas.filter(u => _multiTokenMatch(f.search, [u.num, u.base, u.cromatica, u.modelo].join(' ')));
    }

    el.innerHTML = `
      <!-- Cabecera -->
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:10px">
        <div>
          <h2 style="font-size:14px;font-weight:700">MÓDULO DE FALLAS — CONTROL INTEGRAL</h2>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">Seguimiento de fallas activas · Etiquetas inteligentes · Historial y reincidencias</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <input id="fal-search" value="${esc(f.search)}" oninput="UI._debounceFallasSearch()"
            placeholder="🔍 Buscar (2280 TAPA SINIESTRO...)" class="plat-filter-search" style="min-width:220px">
          <button class="act-btn-primary" style="font-size:11px" onclick="UI.openRegistrarFallaGlobal()">+ Registrar falla</button>
        </div>
      </div>

      <!-- KPIs de etiquetas inteligentes -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-bottom:14px">
        <div class="fal-kpi ${f.tipo==='todas'&&_fallasTab==='activas'?'fal-kpi-active':''}"
          onclick="UI._fallasFilter.tipo='todas';UI._fallasTab='activas';UI.renderFallasPanel()">
          <div class="fal-kpi-n">${conFallas.length}</div>
          <div class="fal-kpi-l">Total activas</div>
        </div>
        <div class="fal-kpi ${f.tipo==='siniestros'&&_fallasTab==='activas'?'fal-kpi-active':''}"
          onclick="UI._fallasFilter.tipo='siniestros';UI._fallasTab='activas';UI.renderFallasPanel()"
          style="border-left:3px solid var(--red)">
          <div class="fal-kpi-n" style="color:var(--red)">${totalSiniestros}</div>
          <div class="fal-kpi-l">🚨 Siniestros</div>
          <div style="font-size:9px;color:var(--text3);margin-top:3px">${sTag.totalHistorico} histórico</div>
        </div>
        <div class="fal-kpi ${f.tipo==='afr'&&_fallasTab==='activas'?'fal-kpi-active':''}"
          onclick="UI._fallasFilter.tipo='afr';UI._fallasTab='activas';UI.renderFallasPanel()"
          style="border-left:3px solid var(--yellow)">
          <div class="fal-kpi-n" style="color:var(--yellow)">${totalAFR}</div>
          <div class="fal-kpi-l">⚠ AFR / Fallas</div>
          <div style="font-size:9px;color:var(--text3);margin-top:3px">${aTag.totalHistorico} histórico</div>
        </div>
        <div class="fal-kpi ${_fallasTab==='liberadas'?'fal-kpi-active':''}"
          onclick="UI._fallasTab='liberadas';UI._fallasFilter.tipo='todas';UI.renderFallasPanel()"
          style="border-left:3px solid var(--green)">
          <div class="fal-kpi-n" style="color:var(--green)">${liberadas.length}</div>
          <div class="fal-kpi-l">✓ Liberadas</div>
          <div style="font-size:9px;color:var(--text3);margin-top:3px">historial activo</div>
        </div>
        <div class="fal-kpi ${_fallasTab==='metricas'?'fal-kpi-active':''}"
          onclick="UI._fallasTab='metricas';UI.renderFallasPanel()"
          style="border-left:3px solid var(--purple)">
          <div class="fal-kpi-n" style="color:var(--purple)">${totalReincidentes}</div>
          <div class="fal-kpi-l">🔁 Reincidentes</div>
          <div style="font-size:9px;color:var(--text3);margin-top:3px">Más de 1 evento</div>
        </div>
        <div class="fal-kpi" style="border-left:3px solid var(--teal);cursor:default">
          <div class="fal-kpi-n" style="color:var(--teal)">${tiempoPromDias}</div>
          <div class="fal-kpi-l">días prom. en falla</div>
          <div style="font-size:9px;color:var(--text3);margin-top:3px">eventos liberados</div>
        </div>
      </div>

      <!-- Contenido según tab activa -->
      ${_fallasTab === 'activas'    ? _renderTabActivas(lista, f)        : ''}
      ${_fallasTab === 'liberadas'  ? _renderTabLiberadas(listaLiberadas) : ''}
      ${_fallasTab === 'metricas'   ? _renderTabMetricas(stats, emp)     : ''}

      <style>
        .fal-kpi{flex:1;background:var(--bg-panel);border:1px solid var(--border);border-radius:10px;padding:10px 14px;cursor:pointer;transition:all .15s}
        .fal-kpi:hover{background:var(--bg-hover);border-color:var(--border2)}
        .fal-kpi-active{border-color:var(--blue);background:rgba(59,130,246,.08)}
        .fal-kpi-n{font-size:22px;font-weight:700;line-height:1}
        .fal-kpi-l{font-size:11px;color:var(--text3);margin-top:3px}
        .fal-card{background:var(--bg-panel);border:1px solid var(--border);border-left:3px solid var(--yellow);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px;transition:all .15s}
        .fal-card:hover{border-color:var(--border2);transform:translateY(-2px);box-shadow:0 4px 16px rgba(0,0,0,.3)}
        .fal-card-siniestro{border-left-color:var(--red)}
        .fal-card-liberada{border-left-color:var(--green)}
        .fal-card-hdr{display:flex;align-items:center;gap:8px}
        .fal-card-num{font-size:18px;font-weight:700;letter-spacing:-.02em}
        .fal-card-tipo{font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;letter-spacing:.04em;text-transform:uppercase}
        .fal-card-field{font-size:11px}
        .fal-card-field-lbl{color:var(--text3);font-weight:600;text-transform:uppercase;font-size:9px;letter-spacing:.05em}
        .fal-card-actions{display:flex;gap:5px;margin-top:6px;padding-top:8px;border-top:1px solid var(--border)}
        .reincidencia-badge{display:inline-block;background:rgba(168,85,247,.15);color:#a855f7;border:1px solid rgba(168,85,247,.3);border-radius:4px;font-size:9px;font-weight:700;padding:1px 6px;margin-left:4px;text-transform:uppercase}
        .fal-hist-row{display:flex;align-items:flex-start;gap:10px;padding:8px 10px;border-radius:7px;background:var(--bg-card);margin-bottom:5px}
        .fal-hist-icon{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;margin-top:1px}
        .fal-top-bar{display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg-card);border-radius:7px;margin-bottom:6px}
        .fal-top-num{font-size:13px;font-weight:700;min-width:50px}
        .fal-top-bar-fill{flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden}
        .fal-top-bar-inner{height:100%;border-radius:3px;transition:width .3s}
      </style>
    `;
  }

  function _renderTabActivas(lista, f) {
    if (lista.length === 0) return `<div class="empty-state"><div style="font-size:32px;margin-bottom:8px">✅</div><div>Sin fallas activas ${f.tipo!=='todas'?'en este filtro':'en este momento'}</div></div>`;
    return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
      ${lista.map(u => _renderFallaCard(u, DB.getEmpresaActiva())).join('')}
    </div>`;
  }

  function _renderTabLiberadas(lista) {
    if (lista.length === 0) return `<div class="empty-state"><div style="font-size:32px;margin-bottom:8px">📋</div><div>No hay unidades liberadas registradas aún</div><div style="font-size:11px;margin-top:6px;color:var(--text3)">Las unidades aparecerán aquí cuando se libere una falla</div></div>`;
    return `
      <div style="margin-bottom:10px;font-size:12px;font-weight:600;color:var(--text2)">UNIDADES LIBERADAS — Historial activo (${lista.length})</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px">
        ${lista.map(u => _renderLiberadaCard(u)).join('')}
      </div>`;
  }

  function _renderTabMetricas(stats, emp) {
    const { topProblematicas, liberadas, totalReincidentes, tagStats, tiempoPromedioFallaMs } = stats;
    const tiempoPromDias = tiempoPromedioFallaMs > 0 ? (tiempoPromedioFallaMs / 86400000).toFixed(1) + ' días' : 'Sin datos';
    const maxEvt = topProblematicas.length ? topProblematicas[0].totalEventosFalla : 1;
    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <!-- Top unidades problemáticas -->
        <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:10px;padding:14px">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text2);margin-bottom:10px">🏆 Top unidades con más eventos</div>
          ${topProblematicas.length === 0
            ? '<div style="font-size:12px;color:var(--text3);padding:10px 0">Sin datos de fallas</div>'
            : topProblematicas.map((u, i) => `
              <div class="fal-top-bar" style="${u.tieneActiva?'border-left:2px solid var(--red)':''}">
                <div style="font-size:11px;color:var(--text3);min-width:16px">${i+1}</div>
                <div class="fal-top-num">${esc(u.num)}</div>
                <div style="flex:1">
                  <div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:3px">
                    <span style="color:var(--text3)">${esc(u.base||'—')}</span>
                    <span style="font-weight:600;color:${u.tieneActiva?'var(--red)':'var(--text)'}">
                      ${u.totalEventosFalla} evento${u.totalEventosFalla!==1?'s':''}
                    </span>
                  </div>
                  <div class="fal-top-bar-fill">
                    <div class="fal-top-bar-inner" style="width:${Math.round((u.totalEventosFalla/maxEvt)*100)}%;background:${u.siniestroCount>0?'var(--red)':'var(--yellow)'}"></div>
                  </div>
                  <div style="display:flex;gap:6px;margin-top:3px;font-size:9px;color:var(--text3)">
                    ${u.siniestroCount>0?`<span style="color:var(--red)">🚨 ${u.siniestroCount} siniestro${u.siniestroCount!==1?'s':''}</span>`:''}
                    ${u.afrCount>0?`<span style="color:var(--yellow)">⚠ ${u.afrCount} AFR</span>`:''}
                    ${u.tieneActiva?'<span style="color:var(--red);font-weight:700">● EN FALLA</span>':''}
                  </div>
                </div>
              </div>`).join('')}
        </div>

        <!-- Resumen estadístico -->
        <div style="display:flex;flex-direction:column;gap:10px">
          <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:10px;padding:14px">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text2);margin-bottom:10px">📊 Resumen por tipo de falla</div>
            ${['SINIESTRO','AFR'].map(tipo => {
              const s = tagStats[tipo] || { activos: 0, totalHistorico: 0 };
              const col = tipo === 'SINIESTRO' ? 'var(--red)' : 'var(--yellow)';
              const ico = tipo === 'SINIESTRO' ? '🚨' : '⚠';
              return `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg-card);border-radius:7px;margin-bottom:6px">
                <span style="font-size:16px">${ico}</span>
                <div style="flex:1">
                  <div style="font-size:12px;font-weight:700;color:${col}">${tipo}</div>
                  <div style="font-size:10px;color:var(--text3)">${s.totalHistorico} eventos históricos</div>
                </div>
                <div style="text-align:right">
                  <div style="font-size:16px;font-weight:700;color:${col}">${s.activos}</div>
                  <div style="font-size:9px;color:var(--text3)">activos</div>
                </div>
              </div>`;
            }).join('')}
          </div>
          <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:10px;padding:14px">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text2);margin-bottom:10px">🔁 Métricas de reincidencia</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              <div style="background:var(--bg-card);border-radius:8px;padding:12px;text-align:center">
                <div style="font-size:22px;font-weight:700;color:var(--purple)">${totalReincidentes}</div>
                <div style="font-size:10px;color:var(--text3);margin-top:3px">Unidades reincidentes</div>
              </div>
              <div style="background:var(--bg-card);border-radius:8px;padding:12px;text-align:center">
                <div style="font-size:22px;font-weight:700;color:var(--teal)">${liberadas.length}</div>
                <div style="font-size:10px;color:var(--text3);margin-top:3px">Unidades liberadas</div>
              </div>
              <div style="background:var(--bg-card);border-radius:8px;padding:12px;text-align:center;grid-column:span 2">
                <div style="font-size:18px;font-weight:700;color:var(--blue)">${tiempoPromDias}</div>
                <div style="font-size:10px;color:var(--text3);margin-top:3px">Tiempo promedio en falla</div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  function _renderFallaCard(u, emp) {
    const esSiniestroCard = u._fallasActivas.some(f => f.esSiniestro);
    const cardCls = esSiniestroCard ? 'fal-card fal-card-siniestro' : 'fal-card';
    const totalEvt = u.totalEventosFalla || u._fallasActivas.length;
    const esReincidente = (u.historialFallas || []).length > 0;

    const fallasHtml = u._fallasActivas.map(f => {
      const horas = (Date.now() - new Date(f.fecha).getTime()) / 3600000;
      const dias = Math.floor(horas / 24);
      const tiempo = dias > 0 ? `${dias}d ${Math.round(horas%24)}h` : `${Math.round(horas)}h`;
      const tipoStyle = f.esSiniestro
        ? 'background:rgba(192,57,43,.15);color:#c0392b'
        : 'background:rgba(192,125,16,.15);color:#c07d10';
      const tipoLabel = f.esSiniestro ? '🚨 SINIESTRO' : '⚠ AFR/FALLA';
      return `<div style="background:var(--bg-card);border-radius:7px;padding:8px 10px;margin-bottom:5px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap">
          <span class="fal-card-tipo" style="${tipoStyle}">${tipoLabel}</span>
          ${f.esReincidencia?'<span class="reincidencia-badge">🔁 Reincidencia</span>':''}
          <span style="font-size:10px;color:var(--text3);margin-left:auto">${tiempo} en atención</span>
        </div>
        <div class="fal-card-field"><span class="fal-card-field-lbl">Motivo:</span> <strong>${esc(f.motivo||'—')}</strong></div>
        ${f.descripcion?`<div class="fal-card-field" style="color:var(--text2);margin-top:3px">${esc(f.descripcion)}</div>`:''}
        ${f.ubicacion?`<div class="fal-card-field" style="margin-top:3px"><span class="fal-card-field-lbl">Ubicación:</span> ${esc(f.ubicacion)}</div>`:''}
        <div class="fal-card-actions">
          <button class="act-btn-sm" style="flex:1;color:var(--green)" onclick="event.stopPropagation();UI._liberarFalla('${esc(u.num)}','${esc(emp)}',${f.id})" title="Liberar / Marcar como resuelta">✓ Liberar</button>
          <button class="act-btn-sm" onclick="event.stopPropagation();UI._marcarFallaResuelta('${esc(u.num)}','${esc(emp)}',${f.id})" title="Finalizar con detalles">📝</button>
        </div>
      </div>`;
    }).join('');

    return `<div class="${cardCls}" onclick="UI.openUnitDetail('${esc(u.num)}')" style="cursor:pointer">
      <div class="fal-card-hdr">
        <div class="fal-card-num">${esc(u.num)}</div>
        <div style="display:flex;flex-direction:column;flex:1;min-width:0">
          <div style="font-size:11px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(u.base||'—')} · ${esc(u.cromatica||'—')}</div>
          <div style="font-size:10px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(u.modelo||'—')}</div>
        </div>
        ${esReincidente?`<div style="text-align:right;flex-shrink:0"><span class="reincidencia-badge">🔁 ${totalEvt} eventos</span></div>`:''}
      </div>
      <div onclick="event.stopPropagation()">
        ${fallasHtml}
      </div>
    </div>`;
  }

  function _renderLiberadaCard(u) {
    const ult = u.ultimaLiberacion ? new Date(u.ultimaLiberacion).toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric'}) : '—';
    const hist = (u.historialFallas || []).slice().reverse();
    const histHtml = hist.slice(0, 3).map(h => {
      const fechaI = h.fechaInicio ? new Date(h.fechaInicio).toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit'}) : '—';
      const fechaL = h.fechaLiberacion ? new Date(h.fechaLiberacion).toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit'}) : '—';
      const dias = h.tiempoEnFallaMs > 0 ? Math.round(h.tiempoEnFallaMs/86400000) + 'd' : '—';
      const col = h.tipo === 'SINIESTRO' ? 'var(--red)' : 'var(--yellow)';
      const ico = h.tipo === 'SINIESTRO' ? '🚨' : '⚠';
      return `<div class="fal-hist-row">
        <div class="fal-hist-icon" style="background:${h.tipo==='SINIESTRO'?'rgba(192,57,43,.15)':'rgba(192,125,16,.15)'}">${ico}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:11px;font-weight:600;color:${col}">${esc(h.tipo)} — ${esc(h.motivo||'Sin motivo')}</div>
          <div style="font-size:10px;color:var(--text3)">${fechaI} → ${fechaL} · ${dias} en falla</div>
          ${h.ubicacion?`<div style="font-size:10px;color:var(--text3)">${esc(h.ubicacion)}</div>`:''}
        </div>
      </div>`;
    }).join('');

    return `<div class="fal-card fal-card-liberada">
      <div class="fal-card-hdr">
        <div class="fal-card-num">${esc(u.num)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:11px;color:var(--text2)">${esc(u.base||'—')} · ${esc(u.cromatica||'—')}</div>
          <div style="font-size:10px;color:var(--text3)">Liberada: ${ult}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:16px;font-weight:700;color:var(--purple)">${u.totalEventosFalla}</div>
          <div style="font-size:9px;color:var(--text3)">eventos</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:4px">
        ${u.siniestroCount>0?`<span style="font-size:10px;background:rgba(192,57,43,.1);color:var(--red);border:1px solid rgba(192,57,43,.25);border-radius:4px;padding:2px 7px">🚨 ${u.siniestroCount} siniestro${u.siniestroCount!==1?'s':''}</span>`:''}
        ${u.afrCount>0?`<span style="font-size:10px;background:rgba(192,125,16,.1);color:var(--yellow);border:1px solid rgba(192,125,16,.25);border-radius:4px;padding:2px 7px">⚠ ${u.afrCount} AFR</span>`:''}
      </div>
      ${hist.length > 0 ? `<div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin-bottom:5px">Historial (${hist.length} eventos)</div>${histHtml}` : ''}
      ${hist.length > 3 ? `<div style="font-size:10px;color:var(--text3);margin-top:4px">+ ${hist.length-3} eventos más</div>` : ''}
    </div>`;
  }

  function _onFallasFilterChange() {
    const activeEl = document.activeElement;
    const activeId = activeEl && activeEl.id ? activeEl.id : null;
    const selStart = activeEl && typeof activeEl.selectionStart === 'number' ? activeEl.selectionStart : null;
    const selEnd   = activeEl && typeof activeEl.selectionEnd   === 'number' ? activeEl.selectionEnd   : null;

    _fallasFilter.search = $('fal-search')?.value || '';
    renderFallasPanel();

    if (activeId) {
      const nuevo = document.getElementById(activeId);
      if (nuevo) {
        nuevo.focus();
        if (selStart !== null && selEnd !== null && typeof nuevo.setSelectionRange === 'function') {
          try { nuevo.setSelectionRange(selStart, selEnd); } catch(e) {}
        }
      }
    }
  }

  function _debounceFallasSearch() {
    _debounce('fallas-search', () => _onFallasFilterChange(), 180);
  }

  function _liberarFalla(num, emp, fallaId) {
    if (!confirm(`¿Liberar la falla de la unidad ${num}?\nSe moverá a "Liberadas" y quedará en el historial.`)) return;
    DB.resolverFalla(num, emp, Number(fallaId), 'Liberada desde módulo de Fallas');
    const _uLib = DB.getUnidad(num, emp);
    const _restLib = (_uLib?.fallas||[]).filter(f=>!f.resuelta);
    DB.upsertUnidad(num, { observaciones: _restLib.length ? _restLib[0].motivo||'' : '' }, emp);
    toast(`✓ Unidad ${num} liberada y movida al historial`, 'success');
    renderFallasPanel();
  }

  /**
   * openRegistrarFallaGlobal — abre modal para registrar falla desde el panel de fallas
   * (sin requerir que se abra el detalle de unidad primero)
   */
  function openRegistrarFallaGlobal() {
    const emp = DB.getEmpresaActiva();
    const uns = DB.getUnidadesList(emp).filter(u => u.activa);
    const opts = uns.map(u => `<option value="${esc(u.num)}">${esc(u.num)}${u.base?' — '+esc(u.base):''}</option>`).join('');
    const body = document.getElementById('modal-body');
    if (!body) return;
    body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <h3 style="font-size:14px;font-weight:600;flex:1">Registrar falla</h3>
        <button onclick="UI.closeModal()" style="background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer">✕</button>
      </div>
      <div style="background:rgba(192,125,16,.08);border:1px solid rgba(192,125,16,.2);border-radius:8px;padding:10px 12px;margin-bottom:12px;display:flex;align-items:center;gap:8px">
        <input type="checkbox" id="f-es-siniestro" style="width:16px;height:16px;accent-color:var(--red)">
        <span style="font-size:13px;font-weight:600;color:var(--red)">🚨 Es un siniestro</span>
      </div>
      <div style="margin-bottom:10px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text3);margin-bottom:5px">Unidad *</div>
        <select id="f-unidad-global" style="width:100%;background:var(--bg-card);border:1px solid var(--border);border-radius:7px;padding:7px 10px;color:var(--text);font-family:var(--font);font-size:12px">
          <option value="">— Seleccionar unidad —</option>
          ${opts}
        </select>
      </div>
      ${_formGroup('Motivo de la falla *','f-motivo','text','','Ej: Motor, GPS desconectado, Accidente...')}
      ${_formGroup('Descripción detallada','f-desc-falla','textarea','',' ')}
      <div style="margin-bottom:10px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text3);margin-bottom:5px">Fecha y hora del evento</div>
        <input type="datetime-local" id="f-fecha-falla" value="${new Date().toISOString().substring(0,16)}"
          style="width:100%;background:var(--bg-card);border:1px solid var(--border);border-radius:7px;padding:7px 10px;color:var(--text);font-family:var(--font);font-size:12px">
      </div>
      ${_formGroup('Ubicación actual de la unidad','f-ubic-falla','text','','Ej: Estacionamiento MTY, Taller ACAY...')}
      <div id="f-err-falla" style="color:var(--red);font-size:11px;min-height:14px"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
        <button onclick="UI.closeModal()" class="act-btn">Cancelar</button>
        <button onclick="UI._guardarFallaGlobal('${esc(emp)}')" class="act-btn-primary" style="background:var(--red)">Registrar falla</button>
      </div>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
  }

  function _guardarFallaGlobal(emp) {
    const num = $('f-unidad-global')?.value;
    const motivo = $('f-motivo')?.value.trim();
    if (!num) { if($('f-err-falla')) $('f-err-falla').textContent='Selecciona una unidad'; return; }
    if (!motivo) { if($('f-err-falla')) $('f-err-falla').textContent='El motivo es requerido'; return; }
    const fichaFalla = {
      motivo,
      descripcion: $('f-desc-falla')?.value.trim()||'',
      fechaOcurrencia: $('f-fecha-falla')?.value ? new Date($('f-fecha-falla').value).toISOString() : '',
      ubicacion: $('f-ubic-falla')?.value.trim()||'',
      esSiniestro: $('f-es-siniestro')?.checked||false
    };
    DB.registrarFalla(num, emp, fichaFalla);
    const _etqG = fichaFalla.esSiniestro ? '🚨 ' + fichaFalla.motivo : fichaFalla.motivo;
    DB.upsertUnidad(num, { observaciones: _etqG, _fuente: 'falla_sync' }, emp);
    closeModal();
    toast(`Falla registrada en unidad ${num}${fichaFalla.esSiniestro?' — SINIESTRO':''}`, 'warn', 5000);
    renderFallasPanel();
  }



  /* ══════════════════════════════════════════════════════
     PANEL: BARRIDO MANUAL (procesa texto de técnicos) — v7.4
     ══════════════════════════════════════════════════════
     CAMBIOS v7.4 respecto a v7.3 (según feedback con captura):
       1. LAYOUT HORIZONTAL — los 3 cuadros quedan en fila (1fr · 1fr · 1fr),
          con separación visual clara. Se reducen alturas para que quepan.
       2. DETECCIÓN DE ETIQUETA ESTRICTA — regla:
            "<num> <texto>"     → ES etiqueta  (2280 siniestro)
            "<num>" (solo)      → NO es etiqueta (5333, 5261, 2428)
          El número solo entra al reporte como consulta de sistema, pero
          no genera fila en "ETIQUETAS DETECTADAS".
       3. FLUJO POR BOTONES (no automático):
            • Botón 1 "Procesar"              (Cuadro 1) → llena SOLO Cuadro 2
            • Botón 2 "Reprocesar / Enviar"   (Cuadro 2) → toma lo editado y llena Cuadro 3
            • Botón 3 "Procesar final"        (Cuadro 3) → guarda etiquetas
          Nunca se llenan los 3 cuadros de golpe.
       4. COPIAR — SOLO vive en el Cuadro 3.

     Lógica del reporte (heredada de v7.3):
       - EN LÍNEA (0 días, hoy después de 7:00 AM) → "5331 (en línea)" SIN fecha/hora
       - Sin transmisión en la mañana (hoy, 01:00–06:59 AM) → "5263 en espera, 20-04-26 / 01:54"
       - Última transmisión → agrupada por días (1 día, 2 días...)
       - Observaciones → unidades con etiqueta o sin fecha
  ══════════════════════════════════════════════════════ */

  /**
   * Estado del panel Barrido Manual.
   *   plataforma        : CEIBA | SAMSARA | AVL | ...
   *   filas             : [{num, fecha, enLinea, etiqueta, fechaSistema, fechaSistemaFuente, rawLine, _hasTextoEtiqueta}]
   *   reporteTexto      : texto EDITABLE del cuadro 2b
   *   etiquetasTexto    : texto EDITABLE del cuadro 2a
   *   finalReporte      : snapshot del reporte en el momento de pulsar "Reprocesar" → Cuadro 3
   *   finalEtiquetas    : snapshot de etiquetas → Cuadro 3
   *   step              : 0 = vacío · 1 = procesado (Cuadro 2 lleno) · 2 = enviado a final (Cuadro 3 lleno)
   *   dirtyReporte      : true si el usuario editó manualmente el reporte
   *   dirtyEtiquetas    : true si el usuario editó manualmente las etiquetas
   */
  let _barridoManualState = {
    plataforma: '',
    filas: [],
    reporteTexto: '',
    etiquetasTexto: '',
    finalReporte: '',
    finalEtiquetas: '',
    step: 0,
    dirtyReporte: false,
    dirtyEtiquetas: false,
    horaCorte: 7   // Hora de inicio de "En línea" — ajustable con el slider
  };

  // Palabras clave para detectar etiquetas (matching se hace sobre el texto DESPUÉS del número)
  const _BM_KEYWORDS = {
    'siniestro':     'SINIESTRO',
    'siniestr':      'SINIESTRO',
    'alineacion':    'ALINEACION',
    'alineación':    'ALINEACION',
    'alineado':      'ALINEACION',
    'afr':           'AFR',
    'taller':        'TALLER',
    'sin energia':   'SIN_ENERGIA',
    'sin energía':   'SIN_ENERGIA',
    'candado':       'CANDADO',
    'con candado':   'CANDADO',
    'parado':        'PARADO',
    'sin sim':       'SIN_SIM',
    'sim':           'SIN_SIM',
    'sin vin':       'SIN_VIN',
    'sin datos':     'SIN_DATOS',
    'venta':         'VENTA',
    'para venta':    'VENTA'
  };

  // Etiqueta → texto legible en el reporte
  const _BM_ETIQUETA_LABEL = {
    'SINIESTRO':   'siniestro',
    'ALINEACION':  'en alineación',
    'AFR':         'AFR',
    'TALLER':      'taller',
    'SIN_ENERGIA': 'sin energía',
    'CANDADO':     'con candado',
    'PARADO':      'parado',
    'SIN_SIM':     'sin SIM',
    'SIN_VIN':     'sin VIN',
    'SIN_DATOS':   'sin datos',
    'VENTA':       'para venta'
  };

  function _fechaSistemaParaBarridoManual(num, plataforma) {
    const emp = DB.getEmpresaActiva();
    const u = DB.getUnidad(num, emp);
    // Unidad no existe en asignación del sistema
    if (!u) return { fecha: null, fuente: '', unidad: null, existeEnSistema: false, existeEnPlat: false };
    const plat = String(plataforma || '').toLowerCase();
    const platKey = plat ? 'ultima_act_' + plat : '';
    const fechaPlat = platKey ? u[platKey] : null;
    // La unidad existe en plataforma si tiene fecha registrada en esa plataforma
    const existeEnPlat = !!fechaPlat;
    if (fechaPlat) return { fecha: fechaPlat, fuente: String(plataforma || '').toUpperCase(), unidad: u, existeEnSistema: true, existeEnPlat: true };
    // Existe en sistema pero NO en la plataforma seleccionada (nunca registró fecha en esa plat)
    return { fecha: null, fuente: '', unidad: u, existeEnSistema: true, existeEnPlat: false };
  }

  function _fechaSalidaBarridoManual(f) {
    return f.fecha || f.fechaSistema || null;
  }

  function _diasFechaBarridoManual(fecha) {
    if (!fecha) return null;
    const d = new Date(fecha);
    if (isNaN(d)) return null;
    const hoy = new Date();
    const hoyLocal = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const fechaLocal = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.round((hoyLocal.getTime() - fechaLocal.getTime()) / 86400000);
  }

  function _fmtBarridoManualFecha(fecha) {
    if (!fecha) return '';
    const fe = new Date(fecha);
    if (isNaN(fe)) return '';
    const dd = String(fe.getDate()).padStart(2,'0');
    const mm = String(fe.getMonth()+1).padStart(2,'0');
    const yy = String(fe.getFullYear()).slice(-2);
    const hh = String(fe.getHours()).padStart(2,'0');
    const mi = String(fe.getMinutes()).padStart(2,'0');
    return `${dd}-${mm}-${yy} / ${hh}:${mi}`;
  }

  function _fmtFechaSoloDia(fecha) {
    if (!fecha) return '';
    const fe = new Date(fecha);
    if (isNaN(fe)) return '';
    const dd = String(fe.getDate()).padStart(2,'0');
    const mm = String(fe.getMonth()+1).padStart(2,'0');
    const yy = String(fe.getFullYear()).slice(-2);
    return `${dd}-${mm}-${yy}`;
  }

  function renderBarridoManual() {
    const el = $('barridomanual-content');
    if (!el) return;

    if (!_barridoManualState.plataforma) _barridoManualState.plataforma = 'CEIBA';

    const emp = DB.getEmpresaActiva();
    const st = _barridoManualState;
    const numFilas = st.filas.length;
    const numEtiquetadas = st.filas.filter(f => f.etiqueta).length;
    const numConFecha = st.filas.filter(f => f.fecha).length;

    // Indicador de paso activo
    const stepBadge = (n, label) => {
      const active = st.step >= n;
      const bg = active ? 'var(--blue)' : 'var(--bg-card)';
      const color = active ? '#fff' : 'var(--text3)';
      const border = active ? 'var(--blue)' : 'var(--border)';
      return `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:10px;background:${bg};color:${color};border:1px solid ${border};font-size:10px;font-weight:700">${n}. ${label}</span>`;
    };

    el.innerHTML = `
      <div style="margin-bottom:14px">
        <h2 style="font-size:14px;font-weight:700">BARRIDO MANUAL · PROCESADOR DE REPORTES</h2>
        <div style="font-size:11px;color:var(--text3);margin-top:4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span>Empresa activa: <strong style="color:var(--text)">${esc(emp)}</strong></span>
          <span style="color:var(--border)">·</span>
          ${stepBadge(1, 'Entrada')}
          <span style="color:var(--text3)">→</span>
          ${stepBadge(2, 'Editar reporte')}
          <span style="color:var(--text3)">→</span>
          ${stepBadge(3, 'Resultado final')}
        </div>
      </div>

      <!-- ════ 3 CUADROS EN HORIZONTAL ════ -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;align-items:stretch">

        <!-- ═══ CUADRO 1 · ENTRADA ═══ -->
        <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:12px;display:flex;flex-direction:column;min-height:560px">
          <div style="padding:12px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <div style="font-size:11px;font-weight:700;color:var(--blue)">①</div>
            <div style="font-size:12px;font-weight:700">📥 ENTRADA</div>
            <select id="bm-plat" onchange="UI._barridoManualState.plataforma=this.value"
              style="background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:4px 8px;color:var(--text);font-size:11px;font-family:var(--font)">
              ${ALL_PLATS.map(p => `<option value="${p}" ${st.plataforma===p?'selected':''}>` + p + `</option>`).join('')}
            </select>
            <div style="margin-left:auto;display:flex;align-items:center;gap:6px" title="Hora desde la cual se considera En línea (default: 7 AM)">
              <span style="font-size:10px;color:var(--text3)">⏰ Desde:</span>
              <input type="range" id="bm-hora-corte" min="0" max="12" step="1"
                value="${st.horaCorte ?? 7}"
                oninput="UI._barridoManualState.horaCorte=parseInt(this.value);document.getElementById('bm-hora-label').textContent=parseInt(this.value)+':00'"
                style="width:80px;accent-color:var(--blue);cursor:pointer">
              <span id="bm-hora-label" style="font-size:11px;font-weight:700;color:var(--blue);min-width:32px">${st.horaCorte ?? 7}:00</span>
            </div>
          </div>
          <div style="padding:8px 14px 4px;font-size:10px;color:var(--text3)">Pega el texto del técnico · un número + texto = etiqueta · solo número = consulta</div>
          <textarea id="bm-input" style="flex:1;width:100%;min-height:380px;background:var(--bg-card);border:none;padding:12px 14px;color:var(--text);font-family:monospace;font-size:12px;resize:none;line-height:1.55" placeholder="Ejemplo:
2280 siniestro
8216 con candado
7051 afr
5261
5333
5331
2275
..."></textarea>
          <div style="padding:10px 14px;border-top:1px solid var(--border);display:flex;gap:6px;flex-wrap:wrap">
            <button class="act-btn-primary" onclick="UI._procesarBarridoManual()">⚙ Procesar</button>
            <button class="act-btn" onclick="UI._limpiarBarridoManual()">🗑 Limpiar</button>
            <button class="act-btn" onclick="UI._cargarBarridoManualEjemplo()">📋 Ejemplo</button>
          </div>
        </div>

        <!-- ═══ CUADRO 2 · PROCESAMIENTO Y EDICIÓN (Etiquetas + Reporte) ═══ -->
        <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:12px;display:flex;flex-direction:column;min-height:560px">
          <div style="padding:12px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <div style="font-size:11px;font-weight:700;color:${st.step>=1?'var(--blue)':'var(--text3)'}">②</div>
            <div style="font-size:12px;font-weight:700">📝 EDITABLE</div>
            <span style="font-size:10px;color:var(--text3)">editable · respeta tu edición</span>
            ${st.dirtyReporte || st.dirtyEtiquetas ? '<span style="margin-left:auto;font-size:10px;color:var(--yellow);font-weight:700">✎ EDITADO</span>' : ''}
          </div>

          <!-- 2a · Etiquetas detectadas -->
          <div style="padding:10px 14px 6px;display:flex;align-items:center;gap:8px">
            <div style="font-size:11px;font-weight:700">🏷 Etiquetas detectadas</div>
            <span style="font-size:10px;color:var(--text3)">(para guardar en sistema)</span>
            <span style="margin-left:auto;font-size:10px;color:var(--blue);font-weight:700">${numEtiquetadas}</span>
          </div>
          <textarea id="bm-etiquetas" oninput="UI._barridoManualState.dirtyEtiquetas=true;UI._barridoManualState.etiquetasTexto=this.value"
            style="width:calc(100% - 28px);margin:0 14px;min-height:90px;max-height:120px;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:8px 10px;color:var(--text);font-family:monospace;font-size:11px;resize:none;line-height:1.5"
            placeholder="(aparecen al procesar)">${esc(st.etiquetasTexto || '')}</textarea>

          <!-- 2b · Reporte ordenado editable -->
          <div style="padding:10px 14px 6px;display:flex;align-items:center;gap:8px">
            <div style="font-size:11px;font-weight:700">📋 Reporte ordenado</div>
            <span style="font-size:10px;color:var(--text3)">(editable)</span>
          </div>
          <textarea id="bm-reporte" oninput="UI._barridoManualState.dirtyReporte=true;UI._barridoManualState.reporteTexto=this.value"
            style="flex:1;width:calc(100% - 28px);margin:0 14px;min-height:240px;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:10px 12px;color:var(--text);font-family:monospace;font-size:11px;resize:none;line-height:1.55"
            placeholder="(aparece al procesar)">${esc(st.reporteTexto || '')}</textarea>

          <div style="padding:12px 14px;border-top:1px solid var(--border);margin-top:10px">
            <button class="act-btn-primary" style="width:100%" onclick="UI._enviarAFinalBarridoManual()"
              ${st.step < 1 ? 'disabled style="width:100%;opacity:0.45;cursor:not-allowed"' : ''}>
              ↪ Reprocesar / Enviar a final
            </button>
          </div>
        </div>

        <!-- ═══ CUADRO 3 · RESULTADO FINAL ═══ -->
        <div style="background:var(--bg-panel);border:1px solid ${st.step>=2?'var(--green)':'var(--border)'};border-radius:12px;display:flex;flex-direction:column;min-height:560px">
          <div style="padding:12px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <div style="font-size:11px;font-weight:700;color:${st.step>=2?'var(--green)':'var(--text3)'}">③</div>
            <div style="font-size:12px;font-weight:700">✅ RESULTADO FINAL</div>
            ${st.step>=2 ? '<span style="margin-left:auto;font-size:10px;color:var(--green);font-weight:700">● LISTO</span>' : ''}
          </div>

          <div style="padding:10px 14px 6px;display:flex;align-items:center;gap:8px">
            <div style="font-size:11px;font-weight:700">🏷 Etiquetas a guardar en sistema</div>
          </div>
          <pre id="bm-final-etiquetas" style="margin:0 14px;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:8px 10px;font-family:monospace;font-size:11px;color:var(--text2);white-space:pre-wrap;min-height:90px;max-height:120px;overflow:auto;line-height:1.5">${esc(st.finalEtiquetas || '(pendiente — pulsa Reprocesar en el cuadro 2)')}</pre>

          <div style="padding:10px 14px 6px;display:flex;align-items:center;gap:8px">
            <div style="font-size:11px;font-weight:700">📋 Reporte final</div>
            <span style="font-size:10px;color:var(--text3)">(respeta tu edición)</span>
          </div>
          <pre id="bm-final-reporte" style="flex:1;margin:0 14px;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:10px 12px;font-family:monospace;font-size:11px;color:var(--text);white-space:pre-wrap;min-height:240px;overflow:auto;line-height:1.55">${esc(st.finalReporte || '(pendiente — pulsa Reprocesar en el cuadro 2)')}</pre>

          <div style="padding:12px 14px;border-top:1px solid var(--border);margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">
            <button class="act-btn" onclick="UI._copiarReporteFinalBarrido()"
              ${st.step < 2 ? 'disabled style="opacity:0.45;cursor:not-allowed"' : ''}>
              📋 Copiar reporte
            </button>
            <button class="act-btn-primary" style="flex:1" onclick="UI._procesarFinalBarridoManual()"
              ${st.step < 2 ? 'disabled style="flex:1;opacity:0.45;cursor:not-allowed"' : ''}>
              💾 Procesar final (guardar etiquetas)
            </button>
          </div>
        </div>

      </div>

      ${numFilas > 0 ? _renderBarridoManualDetalle() : ''}
    `;
  }

  function _renderBarridoManualDetalle() {
    const filas = _barridoManualState.filas;
    return `
      <div style="margin-top:16px;background:var(--bg-panel);border:1px solid var(--border);border-radius:12px;overflow:hidden">
        <div style="padding:12px 14px;border-bottom:1px solid var(--border);font-size:12px;font-weight:700">📊 TABLA INTERNA — VISTA DETALLADA</div>
        <div style="overflow-x:auto;max-height:280px">
          <table style="width:100%">
            <thead><tr>
              <th>UNIDAD</th><th>ETIQUETA</th><th>FECHA TÉCNICO</th><th>FECHA PARA REPORTE</th><th>DÍAS SIN CONECTAR</th><th>ESTADO EN SISTEMA</th>
            </tr></thead>
            <tbody>
              ${filas.map(f => {
                const emp = DB.getEmpresaActiva();
                const u = DB.getUnidad(f.num, emp);
                const fechaSalida = _fechaSalidaBarridoManual(f);
                const dias = _diasFechaBarridoManual(fechaSalida);
                const colorEt = f.etiqueta === 'SINIESTRO' ? '#c0392b'
                              : f.etiqueta === 'ALINEACION' ? '#3b82f6'
                              : f.etiqueta === 'AFR' ? '#c07d10'
                              : f.etiqueta === 'SIN_ENERGIA' ? '#c0392b'
                              : f.etiqueta === 'TALLER' ? '#8b5cf6'
                              : f.etiqueta === 'CANDADO' ? '#6b7280'
                              : f.etiqueta ? '#a78bfa' : 'var(--text3)';
                const fechaFuente = !f.fecha && f.fechaSistemaFuente ? ` <span style="color:var(--text3)">(${esc(f.fechaSistemaFuente)})</span>` : '';
                const etiquetaTxt = f.etiqueta ? (_BM_ETIQUETA_LABEL[f.etiqueta] || f.etiqueta) : '';
                return `<tr style="cursor:${u?'pointer':'default'}" ${u?`onclick="UI.openUnitDetail('${esc(f.num)}')"`:''}>
                  <td style="font-weight:700">${esc(f.num)}</td>
                  <td>${f.etiqueta ? `<span style="padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700;background:${colorEt}22;color:${colorEt}">${esc(etiquetaTxt)}</span>` : '<span style="color:var(--text3)">—</span>'}</td>
                  <td style="font-size:11px">${f.fecha ? Parsers.fmtDate(f.fecha) : '<span style="color:var(--text3)">—</span>'}</td>
                  <td style="font-size:11px">${fechaSalida ? Parsers.fmtDate(fechaSalida) + fechaFuente : (f.enLinea ? '<span style="color:var(--green)">EN LÍNEA</span>' : '<span style="color:var(--text3)">—</span>')}</td>
                  <td>${dias !== null ? diasBadge(dias) : (f.enLinea ? '<span style="color:var(--green);font-size:11px">0</span>' : '—')}</td>
                  <td style="font-size:11px">${u ? '<span style="color:var(--green)">✓ En asignación</span>' : '<span style="color:var(--yellow)">⚠ No encontrada</span>'}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  /**
   * BOTÓN 1 · "Procesar" (Cuadro 1)
   * Detecta cada línea y llena SOLO el Cuadro 2 (etiquetas + reporte).
   * NO llena el Cuadro 3.
   *
   * Regla de detección de etiqueta:
   *   "<num> <texto>"   → ES etiqueta  ("2280 siniestro", "8216 con candado")
   *   "<num>" solo      → NO es etiqueta, pero la unidad entra al reporte como consulta
   *   "<num> <fecha>"   → NO es etiqueta (la fecha no cuenta como "texto" de etiqueta)
   */
  function _procesarBarridoManual() {
    const input = $('bm-input')?.value || '';
    if (!input.trim()) { toast('Pega primero el texto a procesar', 'warn'); return; }
    const plat = _barridoManualState.plataforma || $('bm-plat')?.value || 'CEIBA';

    // Regex para detectar si el "resto" tras el número es solo fecha (no es etiqueta)
    const SOLO_FECHA_RE = /^\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}(\s*[-\/\s]\s*\d{1,2}:\d{2})?$/;
    const SOLO_HORA_RE  = /^\d{1,2}:\d{2}$/;

    const lines = input.split('\n').map(l => l.trim()).filter(Boolean);
    const filas = [];
    const seen = new Set();

    lines.forEach(line => {
      // Extraer el primer número de la línea
      const numMatch = line.match(/\b(\d{3,5})\b/);
      if (!numMatch) return;
      const num = numMatch[1];
      const n = parseInt(num);
      if (n < 100 || n > 99999) return;
      if (seen.has(num)) return;
      seen.add(num);

      // "resto" = lo que queda al quitar el número de la línea
      const resto = line.replace(numMatch[0], '').replace(/^[\s:\-–—,\.]+/, '').trim();
      const restoLower = resto.toLowerCase();

      // ¿Es SOLO número (nada después)?
      const soloNumero = resto === '';
      // ¿El resto es solo una fecha/hora?
      const restoEsFechaOnly = SOLO_FECHA_RE.test(resto) || SOLO_HORA_RE.test(resto);

      // Extraer fecha si la hay (independiente de si hay etiqueta)
      let fecha = null;
      const dateMatch = line.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})(?:\s*[\/\s]\s*(\d{1,2}):(\d{2}))?/);
      if (dateMatch) {
        let [, d, m, y, hh, mm] = dateMatch;
        if (y.length === 2) y = '20' + y;
        const iso = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}T${(hh||'00').padStart(2,'0')}:${mm||'00'}`;
        const parsed = new Date(iso);
        if (!isNaN(parsed)) fecha = parsed.toISOString();
      }

      const enLinea = /\ben\s+l[ií]nea\b/i.test(line) || /\bon[-\s]?line\b/i.test(line);

      // REGLA CLAVE v7.4:
      //   etiqueta solo se asigna si hay TEXTO después del número
      //   (no solo número, no solo fecha)
      let etiqueta = null;
      const hayTextoEtiqueta = !soloNumero && !restoEsFechaOnly;
      if (hayTextoEtiqueta) {
        const kws = Object.keys(_BM_KEYWORDS).sort((a,b) => b.length - a.length);
        for (const kw of kws) {
          if (restoLower.includes(kw)) { etiqueta = _BM_KEYWORDS[kw]; break; }
        }
        // "en línea" NO es etiqueta guardable → se trata como en_linea normal
        if (enLinea) etiqueta = null;
      }

      const sys = _fechaSistemaParaBarridoManual(num, plat);
      filas.push({
        num,
        fecha,
        fechaSistema: fecha ? null : sys.fecha,
        fechaSistemaFuente: fecha ? '' : sys.fuente,
        enLinea,
        etiqueta,
        rawLine: line,
        _hasTextoEtiqueta: hayTextoEtiqueta,
        _existeEnSistema: sys.existeEnSistema,
        _existeEnPlat:    sys.existeEnPlat
      });
    });

    // Llenar SOLO Cuadro 2 (etiquetas + reporte). Cuadro 3 queda en blanco.
    _barridoManualState.filas = filas;
    _barridoManualState.reporteTexto = _formatearReporteBarrido(filas);
    _barridoManualState.etiquetasTexto = _formatearEtiquetasBarrido(filas);
    _barridoManualState.finalReporte = '';
    _barridoManualState.finalEtiquetas = '';
    _barridoManualState.step = 1;
    _barridoManualState.dirtyReporte = false;
    _barridoManualState.dirtyEtiquetas = false;

    renderBarridoManual();
    const etCount = filas.filter(f=>f.etiqueta).length;
    toast(`✓ ${filas.length} unidades procesadas · ${etCount} etiqueta${etCount===1?'':'s'} detectada${etCount===1?'':'s'}`, 'success');
  }

  /**
   * BOTÓN 2 · "Reprocesar / Enviar a final" (Cuadro 2)
   * Toma el contenido EDITADO de los dos textareas del Cuadro 2 y lo vuelca al Cuadro 3.
   * No re-parsea el texto de entrada del Cuadro 1. El Cuadro 3 refleja exactamente
   * lo que el usuario dejó en el 2 (con sus ediciones).
   */
  function _enviarAFinalBarridoManual() {
    const st = _barridoManualState;
    if (st.step < 1) { toast('Primero pulsa "Procesar" en el cuadro 1', 'warn'); return; }

    // Sincronizar desde los textareas (por si hubo cambios no capturados por oninput)
    const taReporte = $('bm-reporte');
    const taEtiquetas = $('bm-etiquetas');
    if (taReporte) st.reporteTexto = taReporte.value;
    if (taEtiquetas) st.etiquetasTexto = taEtiquetas.value;

    st.finalReporte = st.reporteTexto || '';
    st.finalEtiquetas = st.etiquetasTexto || '';
    st.step = 2;

    renderBarridoManual();
    toast('✓ Enviado al cuadro final · listo para copiar y guardar', 'success');
  }

  /**
   * Formato de ETIQUETAS (cuadro 2a):
   *   2280 siniestro
   *   8216 con candado
   *   7051 afr
   */
  function _formatearEtiquetasBarrido(filas) {
    const conEt = filas.filter(f => f.etiqueta);
    if (!conEt.length) return '';
    return conEt.map(f => {
      const label = _BM_ETIQUETA_LABEL[f.etiqueta] || f.etiqueta.toLowerCase().replace(/_/g,' ');
      return `${f.num} ${label}`;
    }).join('\n');
  }

  /**
   * Formato del REPORTE ORDENADO — lógica del PDF v7.3 (sin cambios):
   *   - EN LÍNEA (hoy después de 7:00 AM) → "<num> (en línea)"
   *   - Sin transmisión en la mañana (hoy 01:00–06:59) → "<num> en espera, fecha/hora"
   *   - Última transmisión → agrupada por días
   *   - Observaciones → con etiqueta o sin fecha
   */
  function _formatearReporteBarrido(filas) {
    if (!filas.length) return '';
    const hoy = new Date();
    const hoyStr = _fmtFechaSoloDia(hoy);
    const plat = _barridoManualState.plataforma || 'CEIBA';

    // Hora de corte configurable: desde HORA_INICIO_LINEA hasta medianoche = EN LÍNEA
    // El valor se guarda en _barridoManualState.horaCorte (default 7)
    const HORA_INICIO_LINEA = typeof _barridoManualState.horaCorte === 'number'
      ? _barridoManualState.horaCorte : 7;
    const HORA_FIN_LINEA    = 24;  // Hasta medianoche (comportamiento original)

    const enriched = filas.map(f => {
      const fechaSalida = _fechaSalidaBarridoManual(f);
      const d = fechaSalida ? new Date(fechaSalida) : null;
      let categoria = null;
      let dias = null;

      if (d && !isNaN(d)) {
        dias = _diasFechaBarridoManual(fechaSalida);
        const esHoy = _fmtFechaSoloDia(d) === hoyStr;
        if (esHoy) {
          const hora = d.getHours();
          // En línea: entre HORA_INICIO_LINEA y HORA_FIN_LINEA
          if (hora >= HORA_INICIO_LINEA && hora < HORA_FIN_LINEA) {
            categoria = 'en_linea';
          } else {
            // Antes de las 7 o después de las 4 PM → sin transmisión en la mañana/tarde
            categoria = 'madrugada';
          }
        } else {
          categoria = f.etiqueta ? 'etiqueta_con_fecha' : 'dias';
        }
      } else if (f._existeEnSistema && !f._existeEnPlat) {
        // Unidad en sistema pero SIN registro en esta plataforma
        categoria = 'sin_plataforma';
      } else if (f._existeEnSistema && f._existeEnPlat === true && !fechaSalida) {
        // Existe en plataforma pero sin fecha (módulo GPS sin datos)
        categoria = 'sin_modulo';
      } else {
        categoria = 'sin_fecha';
      }

      if (f.enLinea && !d) categoria = 'en_linea';

      return { ...f, _fechaSalida: fechaSalida, _fechaObj: d, _dias: dias, _categoria: categoria };
    });

    const platNombre = String(plat).toUpperCase();
    let out = `Base ${_fmtFechaSoloDia(hoy)}\n`;
    out += `\n📡 ESTADO DE UNIDADES CCTV\n`;
    out += `✅ OPERATIVO — Cámaras / Antenas GPS-3G OK\n`;

    // ── EN LÍNEA ──────────────────────────────────────────────────────────
    const enLineaList = enriched.filter(f => f._categoria === 'en_linea' && !f.etiqueta);
    if (enLineaList.length) {
      out += `\nEn línea:\n`;
      enLineaList
        .sort((a,b) => Number(a.num) - Number(b.num))
        .forEach(f => { out += `${f.num} (en línea)\n`; });
    }

    // ── SIN TRANSMISIÓN EN LA MAÑANA (hoy pero fuera del horario 07-16) ──
    const madrugadaList = enriched.filter(f => f._categoria === 'madrugada' && !f.etiqueta);
    if (madrugadaList.length) {
      out += `\n☀️ Sin transmisión en la mañana\n`;
      madrugadaList
        .sort((a,b) => (a._fechaObj||0) - (b._fechaObj||0))
        .forEach(f => {
          out += `${f.num} en espera, ${_fmtBarridoManualFecha(f._fechaSalida)}\n`;
        });
    }

    // ── ÚLTIMA TRANSMISIÓN (días anteriores, sin etiqueta) ────────────────
    const diasList = enriched.filter(f => f._categoria === 'dias' && !f.etiqueta);
    if (diasList.length) {
      const porDias = {};
      diasList.forEach(f => {
        const d = f._dias;
        if (!porDias[d]) porDias[d] = [];
        porDias[d].push(f);
      });
      out += `\n⏱️ Última transmisión\n`;
      Object.keys(porDias).map(Number).sort((a,b) => a-b).forEach(d => {
        out += `▪️ ${d} día${d===1?'':'s'}\n`;
        porDias[d]
          .sort((a,b) => b._fechaObj - a._fechaObj)
          .forEach(f => {
            out += `${f.num} — ${_fmtBarridoManualFecha(f._fechaSalida)}\n`;
          });
      });
    }

    // ── OBSERVACIONES (con etiqueta O con fecha pero con etiqueta) ─────────
    const obsList = enriched.filter(f =>
      f.etiqueta &&
      f._categoria !== 'sin_plataforma' &&
      f._categoria !== 'sin_modulo'
    );
    if (obsList.length) {
      out += `\n⚠ OBSERVACIONES\n`;
      obsList
        .sort((a,b) => Number(a.num) - Number(b.num))
        .forEach(f => {
          const label = f.etiqueta ? (_BM_ETIQUETA_LABEL[f.etiqueta] || f.etiqueta.toLowerCase()) : '';
          if (f._fechaObj) {
            const diasTxt = f._dias > 0 ? ` (${f._dias} día${f._dias===1?'':'s'} sin transmitir)` : '';
            out += `${f.num} — ${label}\n`;
            out += `${_fmtBarridoManualFecha(f._fechaObj)}${diasTxt}\n`;
          } else {
            out += `${f.num} — ${label}\n`;
          }
        });
    }

    // ── SIN MÓDULO GPS (existe en plataforma pero sin fecha) ──────────────
    const sinModuloList = enriched.filter(f => f._categoria === 'sin_modulo');
    // También incluir sin_fecha que existen en sistema y en plataforma pero sin fecha
    const sinFechaConPlat = enriched.filter(f => f._categoria === 'sin_fecha' && f._existeEnSistema && f._existeEnPlat);
    const todosSinModulo = [...sinModuloList, ...sinFechaConPlat];
    if (todosSinModulo.length) {
      out += `\n⛓️‍💥Sin módulo GPS / validar físicamente:\n`;
      todosSinModulo
        .sort((a,b) => Number(a.num) - Number(b.num))
        .forEach(f => {
          out += `${f.num} sin fecha en módulo⚠️validar\n`;
        });
    }

    // ── SIN PLATAFORMA: unidad en sistema pero sin registro en esta plat,
    //    O unidad que el técnico puso y no está en ningún lado
    const sinPlatList = enriched.filter(f =>
      f._categoria === 'sin_plataforma' || f._existeEnSistema === false
    ).filter(f => !f.etiqueta); // con etiqueta ya van a OBSERVACIONES
    if (sinPlatList.length) {
      out += `\n🚫Unidades sin plataforma ${platNombre}:\n`;
      sinPlatList
        .sort((a,b) => Number(a.num) - Number(b.num))
        .forEach(f => {
          out += `${f.num} sin ${platNombre.toLowerCase()}\n`;
        });
    }

    return out.trim();
  }

  function _cargarBarridoManualEjemplo() {
    const ejemplo = `2280 siniestro
8216 con candado
7051 afr
5261 sin energia
5263 taller
2428
5333
5331
2275
5263
7105 en linea
8130 16-04-26 / 18:25`;
    const inp = $('bm-input');
    if (inp) inp.value = ejemplo;
    toast('Ejemplo cargado — pulsa Procesar', 'info', 2500);
  }

  function _limpiarBarridoManual() {
    const inp = $('bm-input'); if (inp) inp.value = '';
    _barridoManualState.filas = [];
    _barridoManualState.reporteTexto = '';
    _barridoManualState.etiquetasTexto = '';
    _barridoManualState.finalReporte = '';
    _barridoManualState.finalEtiquetas = '';
    _barridoManualState.step = 0;
    _barridoManualState.dirtyReporte = false;
    _barridoManualState.dirtyEtiquetas = false;
    renderBarridoManual();
  }

  /**
   * BOTÓN COPIAR (Cuadro 3) — única ubicación permitida en v7.4
   * Copia el contenido del reporte final (snapshot en st.finalReporte).
   */
  function _copiarReporteFinalBarrido() {
    const txt = _barridoManualState.finalReporte || '';
    if (!txt.trim()) { toast('Pulsa primero "Reprocesar / Enviar a final" en el cuadro 2', 'warn'); return; }
    try {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(txt);
        toast('✓ Reporte copiado al portapapeles', 'success');
      } else {
        const ta = document.createElement('textarea');
        ta.value = txt; document.body.appendChild(ta);
        ta.select(); document.execCommand('copy');
        document.body.removeChild(ta);
        toast('✓ Reporte copiado', 'success');
      }
    } catch(e) {
      toast('No se pudo copiar', 'error');
    }
  }

  /**
   * BOTÓN 3 · "Procesar final (guardar etiquetas)" (Cuadro 3)
   * Guarda SOLO las etiquetas del snapshot del Cuadro 3 (st.finalEtiquetas).
   * No reprocesa nada — usa lo que ya quedó bloqueado al pulsar "Reprocesar".
   */
  function _procesarFinalBarridoManual() {
    const st = _barridoManualState;
    if (st.step < 2) { toast('Pulsa primero "Reprocesar / Enviar a final" en el cuadro 2', 'warn'); return; }

    const plat = st.plataforma || 'CEIBA';
    const etiquetasFinales = _parsearTextoEtiquetas(st.finalEtiquetas);

    if (!etiquetasFinales.length) {
      toast('No hay etiquetas en el reporte final para guardar', 'warn');
      return;
    }

    if (!confirm(`Guardar ${etiquetasFinales.length} etiqueta${etiquetasFinales.length===1?'':'s'} en el sistema?\n\nEmpresa: ${DB.getEmpresaActiva()}\nPlataforma: ${plat}\n\nSe guardarán SOLO las etiquetas. El reporte no se toca.`)) return;

    const emp = DB.getEmpresaActiva();
    const filasSoloEtiqueta = etiquetasFinales.map(e => ({
      num: e.num,
      etiqueta: e.etiqueta,
      detalles: e.detalles || ''
    }));

    const res = DB.registrarBarridoManual(plat, filasSoloEtiqueta, emp);
    toast(`✓ Guardado: ${res.etiquetadas} etiquetas aplicadas en ${plat}`, 'success', 5000);
  }

  /**
   * Parsea el texto de etiquetas (cuadro editable) y devuelve [{num, etiqueta, detalles}].
   * Admite "2280 siniestro", "7051 afr", "5261 sin energía", "8216 con candado".
   * Respeta la regla v7.4: si no hay texto después del número, no es etiqueta.
   */
  function _parsearTextoEtiquetas(texto) {
    if (!texto || !texto.trim()) return [];
    const result = [];
    const seen = new Set();
    texto.split('\n').forEach(line => {
      const l = line.trim();
      if (!l) return;
      const numMatch = l.match(/\b(\d{3,5})\b/);
      if (!numMatch) return;
      const num = numMatch[1];
      const n = parseInt(num);
      if (n < 100 || n > 99999) return;
      if (seen.has(num)) return;

      const resto = l.replace(numMatch[0], '').replace(/^[\s:\-–—,\.]+/, '').trim();
      if (!resto) return; // solo número → no es etiqueta

      const lower = resto.toLowerCase();
      let etiqueta = null;
      const kws = Object.keys(_BM_KEYWORDS).sort((a,b) => b.length - a.length);
      for (const kw of kws) {
        if (lower.includes(kw)) { etiqueta = _BM_KEYWORDS[kw]; break; }
      }
      if (!etiqueta) return;

      const detalles = resto;
      seen.add(num);
      result.push({ num, etiqueta, detalles });
    });
    return result;
  }

  /** Compatibilidad hacia atrás */
  function _guardarBarridoManualEnSistema() {
    _procesarFinalBarridoManual();
  }

  /** Alias legacy — el Cuadro 2 ya no tiene botón "Copiar" (reglas v7.4). */
  function _copiarBarridoManual() {
    _copiarReporteFinalBarrido();
  }

  let _maestraFilter = { base:'', crom:'', est:'', plats:{} }; // plats: { CEIBA:'con'|'sin'|'' , ... }

  function renderMaestra() {
    const emp = DB.getEmpresaActiva();
    const cfg = DB.getConfig();
    const hoy = Date.now();
    const el = $('maestra-content');
    if (!el) return;

    const uns = DB.getUnidadesList(emp).filter(u => u.activa);
    const bases = [...new Set(uns.map(u => u.base).filter(Boolean))].sort();
    const cromaticas = [...new Set(uns.map(u => u.cromatica).filter(Boolean))].sort();

    // Aplicar filtros
    const f = _maestraFilter;
    let lista = uns;
    if (f.base) lista = lista.filter(u => u.base === f.base);
    if (f.crom) lista = lista.filter(u => u.cromatica === f.crom);
    if (f.est)  lista = lista.filter(u => Parsers.normalizarEstatus(u.estatus) === f.est);
    // Filtros por plataforma con/sin
    ALL_PLATS.forEach(p => {
      const v = (f.plats || {})[p];
      if (!v) return;
      const k = 'ultima_act_' + p.toLowerCase();
      if (v === 'con') lista = lista.filter(u => !!u[k]);
      if (v === 'sin') lista = lista.filter(u => !u[k]);
    });

    // Conteo por plataforma (con equipo / sin equipo)
    const conteos = {};
    ALL_PLATS.forEach(p => {
      const k = 'ultima_act_' + p.toLowerCase();
      conteos[p] = { con: lista.filter(u => u[k]).length, sin: lista.filter(u => !u[k]).length };
    });

    lista.sort((a,b) => parseInt(a.num||0) - parseInt(b.num||0));

    el.innerHTML = `
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:10px">
        <div>
          <h2 style="font-size:14px;font-weight:700">TABLA MAESTRA</h2>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">Unidades con matriz de plataformas · Muestra el ID del equipo por plataforma · Filtra y exporta en CSV</div>
        </div>
        <button class="export-btn" onclick="UI._exportarMaestra()">↓ Exportar CSV</button>
      </div>

      <!-- Conteos por plataforma -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:14px">
        ${ALL_PLATS.map(p => `
          <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:10px;padding:10px 12px">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">${platIcon(p,18)}<div style="font-size:12px;font-weight:700">${p}</div></div>
            <div style="display:flex;gap:8px;font-size:11px">
              <div><span style="color:var(--green);font-weight:700">${conteos[p].con}</span> <span style="color:var(--text3)">con ${p.charAt(0)+p.slice(1).toLowerCase()}</span></div>
              <div><span style="color:var(--text3);font-weight:600">${conteos[p].sin}</span> <span style="color:var(--text3)">sin ${p.charAt(0)+p.slice(1).toLowerCase()}</span></div>
            </div>
          </div>`).join('')}
      </div>

      <!-- Filtros -->
      <div class="plat-filter-bar" style="margin-bottom:12px;border-radius:10px;border:1px solid var(--border)">
        <div class="plat-filter-group">
          <span class="plat-filter-lbl">BASE</span>
          <select id="ma-f-base" onchange="UI._onMaestraFilterChange()">
            <option value="">Todas</option>
            ${bases.map(b => `<option value="${esc(b)}" ${f.base===b?'selected':''}>${esc(b)}</option>`).join('')}
          </select>
        </div>
        <div class="plat-filter-group">
          <span class="plat-filter-lbl">CROMÁTICA</span>
          <select id="ma-f-crom" onchange="UI._onMaestraFilterChange()">
            <option value="">Todas</option>
            ${cromaticas.map(c => `<option value="${esc(c)}" ${f.crom===c?'selected':''}>${esc(c)}</option>`).join('')}
          </select>
        </div>
        <div class="plat-filter-group">
          <span class="plat-filter-lbl">ESTATUS OP.</span>
          <select id="ma-f-est" onchange="UI._onMaestraFilterChange()">
            <option value="">Todos</option>
            ${[...new Set(uns.map(u => Parsers.normalizarEstatus(u.estatus)).filter(Boolean))].sort()
              .map(e => `<option value="${esc(e)}" ${f.est===e?'selected':''}>${esc(e)}</option>`).join('')}
          </select>
        </div>
        <div class="plat-filter-group" style="flex-direction:row;flex-wrap:wrap;gap:6px;align-items:center;flex:1">
          <span class="plat-filter-lbl" style="white-space:nowrap">PLATAFORMA</span>
          ${ALL_PLATS.map(p => {
            const v = (f.plats||{})[p] || '';
            const platLow = p.charAt(0)+p.slice(1).toLowerCase();
            return `<div style="display:flex;border:1px solid var(--border);border-radius:6px;overflow:hidden;font-size:10px;font-weight:600">
              <button onclick="UI._setMaestraPlatFilter('${p}','con')" style="padding:3px 7px;border:none;cursor:pointer;background:${v==='con'?'var(--green)':'var(--bg-base)'};color:${v==='con'?'#fff':'var(--text2)'}">✓ Con ${platLow}</button>
              <button onclick="UI._setMaestraPlatFilter('${p}','sin')" style="padding:3px 7px;border:none;border-left:1px solid var(--border);cursor:pointer;background:${v==='sin'?'var(--red)':'var(--bg-base)'};color:${v==='sin'?'#fff':'var(--text2)'}">Sin ${platLow}</button>
            </div>`;
          }).join('')}
        </div>
        <button class="act-btn" onclick="UI._resetMaestraFilters()">↺ Reset</button>
        <span style="margin-left:auto;font-size:11px;color:var(--text2);align-self:center"><strong>${lista.length}</strong> unidades filtradas</span>
      </div>

      <!-- Tabla -->
      <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:12px;overflow:hidden">
        <div style="overflow:auto;max-height:65vh">
          <table style="width:100%">
            <thead>
              <tr>
                <th style="position:sticky;left:0;background:var(--bg-panel);z-index:2">UNIDAD</th>
                <th>EMPRESA</th><th>BASE</th><th>CROMÁTICA</th><th>ESTATUS</th>
                ${ALL_PLATS.map(p => `<th style="text-align:center">${p}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${lista.map(u => `<tr onclick="UI.openUnitDetail('${esc(u.num)}')" style="cursor:pointer">
                <td style="position:sticky;left:0;background:var(--bg-panel);font-weight:700">${esc(u.num)}</td>
                <td>${esc(u.empresa_asig||emp)}</td>
                <td>${esc(u.base||'—')}</td>
                <td>${esc(u.cromatica||'—')}</td>
                <td>${estatusBadge(u.estatus)}</td>
                ${ALL_PLATS.map(p => {
                  const k = 'ultima_act_' + p.toLowerCase();
                  const tiene = !!u[k];
                  // Identificador específico por plataforma
                  const idMap = {
                    CEIBA:   u.dvr_ceiba   || '',
                    SAMSARA: u.vin_samsara  || '',
                    MAN:     u.placa_man    || '',
                    SCANIA:  u.placa_scania || '',
                    AVL:     '',
                    VOLVO:   '',
                    MOTIVE:  u.motive_vg   || ''
                  };
                  const idVal = idMap[p] || '';
                  if (tiene) {
                    const desK = 'desinstalacion_' + p.toLowerCase();
                    const esDes = !!u[desK];
                    if (esDes) {
                      return `<td style="text-align:center">
                        <span style="font-size:9px;font-weight:700;color:#888;background:rgba(100,100,100,.15);padding:1px 5px;border-radius:3px" title="Desinstalado">DESINSTAL.</span>
                      </td>`;
                    }
                    return `<td style="text-align:center">
                      ${idVal
                        ? `<span style="font-family:monospace;font-size:10px;font-weight:700;color:var(--green)" title="${esc(idVal)}">${esc(idVal.length>10?idVal.substring(0,10)+'…':idVal)}</span>`
                        : `<span style="font-size:11px;font-weight:700;color:var(--green)">✓ Con ${p.charAt(0)+p.slice(1).toLowerCase()}</span>`
                      }
                    </td>`;
                  } else {
                    return `<td style="text-align:center;color:var(--text3);font-size:10px">Sin ${p.charAt(0)+p.slice(1).toLowerCase()}</td>`;
                  }
                }).join('')}
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function _onMaestraFilterChange() {
    _maestraFilter = {
      base:  $('ma-f-base')?.value || '',
      crom:  $('ma-f-crom')?.value || '',
      est:   $('ma-f-est')?.value  || '',
      plats: _maestraFilter.plats  || {}
    };
    renderMaestra();
  }
  function _setMaestraPlatFilter(plat, val) {
    if (!_maestraFilter.plats) _maestraFilter.plats = {};
    // Toggle: si ya está activo, desactivar
    _maestraFilter.plats[plat] = (_maestraFilter.plats[plat] === val) ? '' : val;
    renderMaestra();
  }
  function _resetMaestraFilters() {
    _maestraFilter = { base:'', crom:'', est:'', plats:{} };
    renderMaestra();
  }

  function _exportarMaestra() {
    const emp = DB.getEmpresaActiva();
    const f = _maestraFilter;
    let lista = DB.getUnidadesList(emp).filter(u => u.activa);
    if (f.base) lista = lista.filter(u => u.base === f.base);
    if (f.crom) lista = lista.filter(u => u.cromatica === f.crom);
    if (f.est)  lista = lista.filter(u => Parsers.categorizarEstatus(u.estatus) === f.est);
    lista.sort((a,b) => parseInt(a.num||0) - parseInt(b.num||0));

    const header = ['UNIDAD','EMPRESA','BASE','CROMATICA','MODELO','ESTATUS', ...ALL_PLATS];
    const rows = lista.map(u => {
      const vals = [
        u.num, u.empresa_asig||emp, u.base||'', u.cromatica||'', u.modelo||'',
        Parsers.categorizarEstatus(u.estatus)
      ];
      ALL_PLATS.forEach(p => {
        const k = 'ultima_act_' + p.toLowerCase();
        vals.push(u[k] ? 'SI' : 'NO');
      });
      return vals.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',');
    });
    const csv = [header.join(','), ...rows].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8' }));
    a.download = `maestra_${emp}_${new Date().toISOString().substring(0,10)}.csv`;
    a.click();
    toast('Maestra exportada', 'success');
  }

  /* ══ EMPRESA ══════════════════════════════════════════ */
  function cambiarEmpresa(name){
    DB.setEmpresaActiva(name);
    const sel=$('empresa-select');if(sel)sel.value=name;
    const selE=$('filter-emp');if(selE)selE.value=name;

    // Aplicar tema visual de empresa
    _applyEmpresaTheme(name);

    const active=document.querySelector('.panel.active');
    if(active)App.nav(null,active.id);
  }

  function _applyEmpresaTheme(name) {
    document.body.classList.add('empresa-transition');
    setTimeout(() => document.body.classList.remove('empresa-transition'), 280);
    document.body.setAttribute('data-empresa', name || 'ETN');
    const badge = document.getElementById('tb-empresa-badge');
    if (badge) badge.textContent = name || 'ETN';
  }

  // Estado de grupos colapsados — persiste en memoria durante la sesión
  const _navCollapsed = {};

  function _toggleNavGroup(group) {
    const el = document.querySelector(`.nav-group[data-group="${group}"]`);
    if (!el) return;
    const isCollapsed = el.classList.toggle('collapsed');
    _navCollapsed[group] = isCollapsed;
  }

  // Al inicio, colapsar "Datos" y "Análisis" por defecto para ahorrar espacio
  function _initNavGroups() {
    ['datos','sims','analisis','sistema'].forEach(g => {
      if (_navCollapsed[g] === undefined) _navCollapsed[g] = true;
      if (_navCollapsed[g]) {
        const el = document.querySelector(`.nav-group[data-group="${g}"]`);
        if (el) el.classList.add('collapsed');
      }
    });
  }

  /* ══ EXPORT ═══════════════════════════════════════════ */
  function exportarCSV(modo){
    const emp=DB.getEmpresaActiva();
    const uns=DB.getReporte(emp,modo||'todas');
    const cols=['num','economico','base','cromatica','modelo','estatus','plataforma','ultima_act','fallaCount','activa','mes','observaciones','serie','motor','placa','asientos','empresa_asig','siniestro'];
    const csv=[cols.join(','),...uns.map(u=>cols.map(c=>{
      let v=u[c]??'';
      if(c==='ultima_act')v=Parsers.fmtDate(v);
      if(c==='activa')v=v?'Activa':'Inactiva';
      if(c==='siniestro')v=v?'Sí':'No';
      return`"${String(v).replace(/"/g,'""')}"`;
    }).join(','))].join('\n');
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));
    a.download=`mesa_control_${emp}_${modo||'completo'}_${new Date().toISOString().substring(0,10)}.csv`;
    a.click(); toast('CSV exportado','success');
  }

  function exportarDatos(){
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([DB.exportData()],{type:'application/json'}));
    a.download=`backup_mc_${new Date().toISOString().substring(0,10)}.json`;
    a.click(); toast('Backup exportado','success');
  }

  function importarDatos(file){
    const reader=new FileReader();
    reader.onload=e=>{
      if(DB.importData(e.target.result)){toast('Importación exitosa. Recargando...','success');setTimeout(()=>location.reload(),1200);}
      else toast('Error al importar: formato inválido','error');
    };
    reader.readAsText(file);
  }


  // Inyectar en UI

  Object.assign(UI_P, {
    renderFallasPanel, renderBarridoManual,
    _renderTabActivas, _renderTabLiberadas, _renderTabMetricas,
    _liberarFalla, openRegistrarFallaGlobal, _guardarFallaGlobal,
    _procesarBarridoManual, _enviarAFinalBarridoManual,
    _guardarBarridoManualEnSistema, _limpiarBarridoManual,
    _copiarBarridoManual, _copiarReporteFinalBarrido,
    _procesarFinalBarridoManual, _cargarBarridoManualEjemplo,
    renderMaestra, _onMaestraFilterChange, _setMaestraPlatFilter,
    _resetMaestraFilters, _exportarMaestra,
    cambiarEmpresa, _applyEmpresaTheme,
    _toggleNavGroup, _initNavGroups,
    exportarCSV, exportarDatos, importarDatos
  });
})();
