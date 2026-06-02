/**
 * ui-analisis.js — Paneles de análisis
 * Asignación concentrado · Historial · Alertas · Viajes · Gráficas · Maestra
 * Se inyecta en window.UI después de ui.js
 */
(function() {
  const UI_P = window.UI;
  if (!UI_P) { console.error('ui-analisis: UI no disponible'); return; }

  // Helpers compartidos desde ui.js
  if (!window.UI_HELPERS) { console.error('ui-analisis.js: UI_HELPERS no disponible'); return; }
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
     PANEL: ASIGNACIÓN CONCENTRADO
  ══════════════════════════════════════════════════════ */
  let _asigQ='',_asigPage=1;
  const ASIG_PS=15;

  function renderAsignacion(){
    const emp=DB.getEmpresaActiva();
    const st=DB.getStats(emp);
    const uns=DB.getUnidadesList(emp);
    const act=uns.filter(u=>u.activa);
    const COLORS=['#3b82f6','#c07d10','#1a9e6e','#c0392b','#8b5cf6','#06b6d4','#c06010'];
    const total=act.length||1;

    if($('asig-total'))  $('asig-total').textContent =act.length;
    if($('asig-op'))     $('asig-op').textContent    =act.filter(u=>Parsers.categorizarEstatus(u.estatus)==='En operación').length;
    if($('asig-fuera'))  $('asig-fuera').textContent =act.filter(u=>Parsers.categorizarEstatus(u.estatus)==='Fuera de operación').length;
    if($('asig-venta'))  $('asig-venta').textContent =act.filter(u=>Parsers.categorizarEstatus(u.estatus)==='Para venta').length;
    if($('asig-empN'))   $('asig-empN').textContent  =DB.getEmpresasList().length;

    // Donuts con datos normalizados
    const bE=Object.entries(st.porBase).sort((a,b)=>b[1]-a[1]);
    const cE=Object.entries(st.porCromatica).sort((a,b)=>b[1]-a[1]);
    const eE=Object.entries(st.porEstatus).sort((a,b)=>b[1]-a[1]);

    if(bE.length){ Charts.donut('asig-donut-base',bE.map(e=>e[0]),bE.map(e=>e[1]),COLORS);
      if($('asig-base-legend')) $('asig-base-legend').innerHTML=bE.slice(0,7).map(([k,v],i)=>
        `<div class="leg-row"><span class="leg-dot" style="background:${COLORS[i%COLORS.length]}"></span><span class="leg-name">${esc(k)}</span><span class="leg-num">${v}</span><span class="leg-pct">(${Math.round(v/total*100)}%)</span></div>`).join('');}

    if(cE.length){ Charts.donut('asig-donut-crom',cE.map(e=>e[0]),cE.map(e=>e[1]),COLORS);
      if($('asig-crom-legend')) $('asig-crom-legend').innerHTML=cE.slice(0,5).map(([k,v],i)=>
        `<div class="leg-row"><span class="leg-dot" style="background:${COLORS[i%COLORS.length]}"></span><span class="leg-name" style="max-width:80px;overflow:hidden;text-overflow:ellipsis">${esc(k)}</span><span class="leg-num">${v}</span></div>`).join('');}

    if(eE.length){ Charts.donut('asig-donut-est',eE.map(e=>e[0]),eE.map(e=>e[1]),['#1a9e6e','#c0392b','#c07d10','#3b82f6','#9ca3af']);
      if($('asig-est-legend')) $('asig-est-legend').innerHTML=eE.map(([k,v],i)=>
        `<div class="leg-row"><span class="leg-dot" style="background:${['#1a9e6e','#c0392b','#c07d10','#3b82f6','#9ca3af'][i]||COLORS[i%COLORS.length]}"></span><span class="leg-name">${esc(k)}</span><span class="leg-num">${v}</span><span class="leg-pct">(${Math.round(v/total*100)}%)</span></div>`).join('');}

    // Empresa bars
    if($('asig-emp-bars')) $('asig-emp-bars').innerHTML=Object.entries(st.porEmpresa).sort((a,b)=>b[1]-a[1]).map(([k,v],i)=>
      `<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
        <span style="font-size:11px;min-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(k)}</span>
        <div style="flex:1;height:7px;background:var(--bg-card);border-radius:3px"><div style="height:100%;border-radius:3px;background:${COLORS[i%COLORS.length]};width:${Math.round(v/total*100)}%"></div></div>
        <span style="font-size:11px;color:var(--text2);min-width:20px">${v}</span>
      </div>`).join('');

    renderAsigTable(act);
  }

  function renderAsigTable(unsList){
    let lista=unsList||DB.getUnidadesList(DB.getEmpresaActiva()).filter(u=>u.activa);
    if(_asigQ){
      lista = lista.filter(u => _multiTokenMatch(_asigQ, [
        u.num, u.base, u.modelo, u.serie, u.placa, u.cromatica, u.empresa_asig,
        u.rol, u.motor, u.observaciones, u.dvr_ceiba, u.vin_samsara, u.placa_man, u.placa_scania
      ].join(' ')));
    }
    lista.sort((a,b)=>parseInt(a.num)-parseInt(b.num));
    const total=lista.length, pages=Math.ceil(total/ASIG_PS)||1;
    if(_asigPage>pages) _asigPage=1;
    const slice=lista.slice((_asigPage-1)*ASIG_PS,_asigPage*ASIG_PS);

    if($('asig-table-total')) $('asig-table-total').textContent=`Total: ${total} unidades`;
    const tbody=$('asig-tbody');
    if(!tbody)return;
    tbody.innerHTML=slice.map(u=>{
      const d=Parsers.diasDesde(u.ultima_act);
      const cls=Parsers.statusClass(d);
      const color=cls==='critico'?'var(--red)':cls==='atencion'?'var(--yellow)':cls==='enlinea'?'var(--green)':'var(--text3)';
      return`<tr onclick="UI.openUnitDetail('${esc(u.num)}')" style="cursor:pointer">
        <td><span style="font-size:13px;font-weight:700;color:${color}">${esc(u.num)}</span>${u.siniestro?'<span style="font-size:9px;color:var(--red);margin-left:4px">🚨</span>':''}</td>
        <td>${esc(u.base||'—')}</td><td>${esc(u.cromatica||'—')}</td>
        <td style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(u.modelo||'—')}</td>
        <td>${estatusBadge(u.estatus)}</td><td>${esc(u.rol||'—')}</td>
        <td>${esc(u.empresa_asig||'—')}</td>
        <td style="font-size:11px;font-family:monospace;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(u.serie||'—')}</td>
        <td style="font-size:11px;font-family:monospace">${esc(u.motor||'—')}</td>
        <td>${esc(u.placa||'—')}</td>
        <td style="text-align:center">${esc(u.asientos||'—')}</td>
        <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text2)">${esc(u.observaciones||'—')}</td>
      </tr>`;
    }).join('');
    renderPagination('asig-pag-info','asig-pag-btns',total,_asigPage,pages,p=>{_asigPage=p;renderAsigTable();});
  }

  /* ══════════════════════════════════════════════════════
     PANEL: REPORTES
  ══════════════════════════════════════════════════════ */
  function renderReportes(){
    const emp=DB.getEmpresaActiva();
    const fuera    =DB.getReporte(emp,'fuera_linea');
    const opFuera  =DB.getReporte(emp,'op_fuera_linea');
    const sinDat   =DB.getReporte(emp,'sin_datos');
    const fallas   =DB.getReporte(emp,'fallas');
    const inact    =DB.getReporte(emp,'inactivas');
    const venta    =DB.getReporte(emp,'para_venta');
    const fuerOp   =DB.getReporte(emp,'fuera_op');

    if($('rep-fuera-count'))    $('rep-fuera-count').textContent   =fuera.length;
    if($('rep-sindat-count'))   $('rep-sindat-count').textContent  =sinDat.length;
    if($('rep-fallas-count'))   $('rep-fallas-count').textContent  =fallas.length;
    if($('rep-inact-count'))    $('rep-inact-count').textContent   =inact.length;

    _renderRepTab('rep-fuera-tbody',fuera,['unidad','base','cromatica','plataforma','ultima_act','dias','estatus']);
    _renderRepTab('rep-opfuera-tbody',opFuera,['unidad','base','cromatica','plataforma','ultima_act','dias']);
    _renderRepTab('rep-sindat-tbody',sinDat,['unidad','base','cromatica','modelo','accion_gps']);
    _renderRepTab('rep-fallas-tbody',fallas,['unidad','base','fallas_count','estatus','updated']);
    _renderRepTab('rep-inact-tbody',inact,['unidad','base','modelo','mes','reactivar']);
    _renderRepTab('rep-venta-tbody',venta,['unidad','base','cromatica','modelo','placa','empresa']);
    _renderRepTab('rep-fueraop-tbody',fuerOp,['unidad','base','cromatica','modelo','estatus']);
  }

  function _renderRepTab(tbodyId,uns,cols){
    const tb=$(tbodyId); if(!tb)return;
    tb.innerHTML=uns.slice(0,50).map(u=>{
      const d=Parsers.diasDesde(u.ultima_act);
      return`<tr onclick="!event.target.closest('button')&&UI.openUnitDetail('${esc(u.num)}')" style="cursor:pointer">${cols.map(c=>{
        if(c==='unidad') return`<td style="font-weight:700;color:${Parsers.statusClass(d)==='critico'?'var(--red)':Parsers.statusClass(d)==='atencion'?'var(--yellow)':'var(--text2)'}">${esc(u.num)}</td>`;
        if(c==='base')   return`<td>${esc(u.base||'—')}</td>`;
        if(c==='cromatica')   return`<td>${esc(u.cromatica||'—')}</td>`;
        if(c==='modelo')      return`<td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(u.modelo||'—')}</td>`;
        if(c==='plataforma')  return`<td>${esc(u.plataforma||'—')}</td>`;
        if(c==='ultima_act')  return`<td style="font-size:11px">${u.ultima_act?Parsers.fmtDate(u.ultima_act):'Sin datos'}</td>`;
        if(c==='dias')        return`<td>${diasBadge(d)}</td>`;
        if(c==='estatus')     return`<td>${estatusBadge(u.estatus)}</td>`;
        if(c==='fallas_count')return`<td style="font-weight:700;color:var(--yellow);text-align:center">${u.fallaCount||0}</td>`;
        if(c==='updated')     return`<td style="font-size:11px">${Parsers.fmtDate(u.updatedAt)}</td>`;
        if(c==='mes')         return`<td>${esc(u.mes||'—')}</td>`;
        if(c==='empresa')     return`<td>${esc(u.empresa_asig||'—')}</td>`;
        if(c==='placa')       return`<td>${esc(u.placa||'—')}</td>`;
        if(c==='accion_gps')  return`<td><button class="act-btn-sm" onclick="event.stopPropagation();UI.openDatePicker(null,iso=>{UI._updateManualFechaConISO('${esc(u.num)}','${esc(DB.getEmpresaActiva())}',iso);UI.renderReportes()},'GPS — Unidad ${esc(u.num)}')">+ Ingresar GPS</button></td>`;
        if(c==='reactivar')   return`<td><button class="act-btn-sm" onclick="event.stopPropagation();DB.reactivarUnidad('${esc(u.num)}');UI.toast('Unidad reactivada','success');UI.renderReportes()">Reactivar</button></td>`;
        return`<td>—</td>`;
      }).join('')}</tr>`;
    }).join('');
  }

  function exportarReporte(tipo){
    const emp=DB.getEmpresaActiva();
    const uns=DB.getReporte(emp,tipo||'fuera_linea');
    const cols=['num','economico','base','cromatica','modelo','estatus','plataforma','ultima_act','serie','motor','placa','asientos','empresa_asig','observaciones','fallaCount'];
    const header=cols.join(',');
    const rows=uns.map(u=>cols.map(c=>{
      let v=u[c]??'';
      if(c==='ultima_act')v=Parsers.fmtDate(v);
      if(c==='activa')v=v?'Activa':'Inactiva';
      return`"${String(v).replace(/"/g,'""')}"`;
    }).join(','));
    const csv=[header,...rows].join('\n');
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));
    a.download=`reporte_${emp}_${tipo||'completo'}_${new Date().toISOString().substring(0,10)}.csv`;
    a.click();
    toast('Reporte exportado','success');
  }

  /* ══════════════════════════════════════════════════════
     PANEL: HISTORIAL (con filtros)
  ══════════════════════════════════════════════════════ */
  let _histFiltro={tipo:'',texto:''};

  function renderHistorial(){
    // Pedimos todos los filtrados SOLO por tipo; la búsqueda de texto la hacemos local
    // para soportar multi-token ("2280 2275 barrido")
    let hist = DB.getHistorialGlobal(500, _histFiltro.tipo ? { tipo: _histFiltro.tipo } : null);
    if (_histFiltro.texto) {
      hist = hist.filter(h => _multiTokenMatch(_histFiltro.texto, [h.mensaje, h.tipo, h.empresa].join(' ')));
    }
    hist = hist.slice(0, 200);
    const el=$('historial-list');
    if(!el)return;
    if(!hist.length){el.innerHTML=`<div class="empty-state">Sin actividad registrada</div>`;return;}
    const colors={barrido:'var(--green)',asignacion:'var(--blue)',manual:'var(--purple)',reset:'var(--yellow)',error:'var(--red)',info:'var(--text3)',falla:'var(--red)'};
    el.innerHTML=hist.map(h=>`
      <div style="display:flex;gap:12px;padding:9px 0;border-bottom:1px solid var(--border);align-items:flex-start">
        <div style="width:7px;height:7px;border-radius:50%;background:${colors[h.tipo]||'var(--text3)'};flex-shrink:0;margin-top:4px"></div>
        <div style="flex:1;min-width:0">
          <div style="font-size:10px;color:var(--text3);font-family:monospace">${Parsers.fmtDate(h.fecha)} · <span style="color:var(--blue)">${esc(h.empresa||'—')}</span></div>
          <div style="font-size:12px;margin-top:1px;overflow:hidden;text-overflow:ellipsis">${esc(h.mensaje)}</div>
        </div>
        <span style="font-size:10px;font-weight:700;color:${colors[h.tipo]||'var(--text3)'};text-transform:uppercase;white-space:nowrap">${esc(h.tipo)}</span>
      </div>`).join('');
  }

  /* ══════════════════════════════════════════════════════
     PANEL: ALERTAS (clasificadas por prioridad)
  ══════════════════════════════════════════════════════ */
  function renderAlertas(){
    const emp=DB.getEmpresaActiva();
    const alertas=DB.getAlertas(emp);
    const el=$('alertas-content');
    if(!el)return;
    if(!alertas.length){el.innerHTML=`<div class="empty-state"><div style="font-size:32px;margin-bottom:8px">✅</div><div>Sin alertas activas</div></div>`;return;}

    // Agrupar por nivel: critico, atencion, info
    const grupos = { critico:[], atencion:[], info:[] };
    alertas.forEach(a => { (grupos[a.nivel] || grupos.info).push(a); });

    const grupoInfo = {
      critico:  { titulo:'🔴 CRÍTICO',  color:'var(--red)',    sub:'Requieren acción inmediata' },
      atencion: { titulo:'🟠 ATENCIÓN', color:'var(--yellow)', sub:'Requieren seguimiento' },
      info:     { titulo:'🔵 INFORMATIVO', color:'var(--blue)', sub:'Actualizaciones y cambios' }
    };

    let html = '';
    ['critico','atencion','info'].forEach(nivel => {
      const lista = grupos[nivel];
      if (!lista.length) return;
      const gi = grupoInfo[nivel];
      html += `<div style="margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <div style="font-size:13px;font-weight:700;color:${gi.color}">${gi.titulo}</div>
          <div style="font-size:11px;color:var(--text3)">${gi.sub}</div>
          <div style="flex:1;height:1px;background:${gi.color};opacity:.18"></div>
          <div style="font-size:11px;font-weight:700;color:${gi.color}">${lista.length} tipo(s)</div>
        </div>`;

      lista.forEach(a => {
        const color = nivel === 'critico' ? 'var(--red)' : nivel === 'atencion' ? 'var(--yellow)' : 'var(--blue)';
        const preview = a.unidades.slice(0, 8);
        html += `<div style="background:var(--bg-panel);border:1px solid ${color}44;border-left:3px solid ${color};border-radius:10px;padding:14px;margin-bottom:10px">
          <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;flex-wrap:wrap">
            <div style="flex:1;min-width:200px">
              <div style="font-size:13px;font-weight:600">${esc(a.titulo)}</div>
              <div style="font-size:11px;color:var(--text3);margin-top:2px">
                <strong>${a.count}</strong> unidad(es) · ${esc(a.accion||'')}
              </div>
            </div>
            <div style="display:flex;gap:6px">
              <button class="act-btn-sm" onclick="UI._filtrarPorAlerta('${a.tipo}')" title="Ver todas en el resumen">↗ Ir a resumen</button>
              <button class="act-btn-sm" onclick="UI._exportarAlerta('${a.tipo}')" title="Exportar a CSV">↓ CSV</button>
            </div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:6px">
            ${preview.map(u => {
              const days = u.dias;
              const daysInfo = days !== null && days !== undefined ? ` · ${days}d` : '';
              const platInfo = u.plataforma ? ` · ${u.plataforma}` : '';
              return `<span onclick="UI.openUnitDetail('${esc(u.num)}')" style="padding:5px 9px;border-radius:5px;background:var(--bg-card);border:1px solid var(--border);font-size:11px;cursor:pointer;color:${color};display:inline-flex;align-items:center;gap:4px" title="${esc(u.base||'')}${esc(platInfo)}${esc(daysInfo)}">
                <strong>${esc(u.num)}</strong>
                <span style="font-size:10px;color:var(--text3);font-weight:400">${esc(u.base||'—')}${esc(platInfo)}${esc(daysInfo)}</span>
              </span>`;
            }).join('')}
            ${a.unidades.length > 8 ? `<span style="font-size:11px;color:var(--text3);padding:5px 9px">+${a.unidades.length - 8} más…</span>` : ''}
          </div>
        </div>`;
      });
      html += `</div>`;
    });

    el.innerHTML = html;
  }

  function _filtrarPorAlerta(tipo) {
    // Mapear tipo de alerta a filtros del resumen
    const map = {
      'siniestro':        { est:'', dias:'' },  // se filtra por siniestro manualmente
      'fuera_largo':      { dias:'fuera' },
      'op_sin_gps':       { est:'op', dias:'fuera' },
      'sin_gps':          { dias:'fuera' },
      'sin_placa':        {},
      'sin_vin':          { plat:'SAMSARA' },
      'huerfanas':        {},
      'inexistente':      {},
      'cambios_recientes':{}
    };
    const f = map[tipo] || {};
    _rf = { plat:'', base:'', crom:'', est:'', dias:'', search:'', sort:'dias', page:1, ...f };
    App.nav(null, 'panel-resumen');
    setTimeout(()=>{
      // Sincronizar UI
      document.querySelectorAll('#chips-plat .chip').forEach(c => c.classList.toggle('active', c.textContent.trim() === (_rf.plat || 'Todas')));
      const fb=$('filter-base'); if(fb) fb.value=_rf.base;
      const fc=$('filter-crom'); if(fc) fc.value=_rf.crom;
      renderUnitList();
      toast('Filtros aplicados desde alerta','info',2000);
    }, 100);
  }

  function _exportarAlerta(tipo) {
    const emp=DB.getEmpresaActiva();
    const alertas=DB.getAlertas(emp);
    const a = alertas.find(x => x.tipo === tipo);
    if (!a) { toast('Alerta no encontrada','error'); return; }
    const cols = ['num','empresa_asig','base','cromatica','modelo','estatus','plataforma','ultima_act','dias','serie','placa','observaciones'];
    const rows = a.unidades.map(u => cols.map(c => {
      let v = u[c] ?? '';
      if (c === 'ultima_act') v = v ? Parsers.fmtDate(v) : 'Sin datos';
      if (c === 'dias')       v = v === null || v === undefined ? 'Sin datos' : v;
      if (c === 'empresa_asig') v = v || emp;
      return `"${String(v).replace(/"/g,'""')}"`;
    }).join(','));
    const csv = [cols.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const aEl = document.createElement('a');
    aEl.href = URL.createObjectURL(blob);
    aEl.download = `alerta_${tipo}_${emp}_${new Date().toISOString().substring(0,10)}.csv`;
    aEl.click();
    toast(`Alerta "${a.titulo}" exportada (${a.count} unidades)`, 'success');
  }

  /* ══════════════════════════════════════════════════════
     PANEL: VIAJES (filtros completos + datetime picker + obs inline)
  ══════════════════════════════════════════════════════ */
  let _viajesFiltro = { emp:[], base:[], crom:[], est:[], dias:[], search:'', plataforma:[] };

  function renderViajes() {
    const emp = DB.getEmpresaActiva();
    const cfg = DB.getConfig();
    const hoy = Date.now();
    const el = $('viajes-content');
    if (!el) return;

    // Base de candidatas: activas + no "Para venta" + (en operación o fuera de línea)
    const uns = DB.getUnidadesList(emp).filter(u => u.activa && Parsers.categorizarEstatus(u.estatus) !== 'Para venta');
    const candidatas = uns.map(u => {
      const dias = u.ultima_act ? Math.floor((hoy - new Date(u.ultima_act))/86400000) : null;
      const est = Parsers.categorizarEstatus(u.estatus);
      let categoria;
      if (dias === null || dias > cfg.diasAtencion) categoria = 'fuera';
      else if (est === 'En operación' || est === 'Arrendamiento') categoria = 'operacion';
      else categoria = 'otro';
      return { ...u, _dias: dias, _categoria: categoria };
    }).filter(u => u._categoria === 'operacion' || u._categoria === 'fuera');

    // Aplicar filtros (multi-selección con arrays)
    const f = _viajesFiltro;
    let lista = candidatas;
    if (f.emp && f.emp.length)  lista = lista.filter(u => f.emp.includes(u.empresa_asig||emp));
    if (f.base && f.base.length) lista = lista.filter(u => f.base.includes(u.base));
    if (f.crom && f.crom.length) lista = lista.filter(u => f.crom.includes(u.cromatica));
    if (f.est && f.est.length) {
      lista = lista.filter(u => f.est.includes(Parsers.categorizarEstatus(u.estatus)));
    }
    if (f.dias && f.dias.length) {
      lista = lista.filter(u => {
        if (u._dias === null) return f.dias.includes('Fuera');
        let bucket;
        if (u._dias <= cfg.diasLinea) bucket = 'En línea';
        else if (u._dias <= cfg.diasAtencion) bucket = 'Atención';
        else bucket = 'Fuera';
        return f.dias.includes(bucket);
      });
    }
    if (f.plataforma && f.plataforma.length) {
      lista = lista.filter(u => f.plataforma.some(p => {
        const kk = 'ultima_act_' + p.toLowerCase();
        return u[kk] || u.plataforma === p;
      }));
    }
    if (f.search) {
      lista = lista.filter(u => _multiTokenMatch(f.search, [
        u.num, u.base, u.modelo, u.cromatica, u.placa, u.empresa_asig, u.observaciones
      ].join(' ')));
    }
    lista.sort((a,b) => (b._dias||0) - (a._dias||0));

    const viajesGuardados = DB.getViajes(emp);
    const viajesPorUnidad = {};
    viajesGuardados.forEach(v => { viajesPorUnidad[v.num] = v; });

    // Opciones para selects
    const empresasAsig = [...new Set(uns.map(u => u.empresa_asig).filter(Boolean))].sort();
    const bases        = [...new Set(uns.map(u => u.base).filter(Boolean))].sort();
    const cromaticas   = [...new Set(uns.map(u => u.cromatica).filter(Boolean))].sort();

    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <div>
          <h2 style="font-size:14px;font-weight:700">PROGRAMACIÓN DE VIAJES Y ATENCIONES</h2>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">Asigna viajes a unidades en operación o programa atenciones para las fuera de línea · Cambios se guardan automáticamente</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="export-btn" onclick="UI._exportarViajes()">↓ Exportar viajes</button>
        </div>
      </div>

      <!-- FILTROS -->
      <div class="plat-filter-bar" style="margin-bottom:12px;border-radius:10px;border:1px solid var(--border)">
        <div class="plat-filter-group">
          <span class="plat-filter-lbl">EMPRESA</span>
          ${_multiSelectChipsDropdown({
            id: 'vj-f-emp',
            label: 'Empresa',
            allLabel: 'Todas',
            options: empresasAsig,
            selected: f.emp || [],
            onChange: 'UI._onViajesFilterChange()'
          })}
        </div>
        <div class="plat-filter-group">
          <span class="plat-filter-lbl">BASE</span>
          ${_multiSelectChipsDropdown({
            id: 'vj-f-base',
            label: 'Base',
            allLabel: 'Todas',
            options: bases,
            selected: f.base || [],
            onChange: 'UI._onViajesFilterChange()'
          })}
        </div>
        <div class="plat-filter-group">
          <span class="plat-filter-lbl">CROMÁTICA</span>
          ${_multiSelectChipsDropdown({
            id: 'vj-f-crom',
            label: 'Cromática',
            allLabel: 'Todas',
            options: cromaticas,
            selected: f.crom || [],
            onChange: 'UI._onViajesFilterChange()'
          })}
        </div>
        <div class="plat-filter-group">
          <span class="plat-filter-lbl">ESTATUS</span>
          ${_multiSelectChipsDropdown({
            id: 'vj-f-est',
            label: 'Estatus',
            allLabel: 'Todos',
            options: ['En operación','Fuera de operación'],
            selected: f.est || [],
            onChange: 'UI._onViajesFilterChange()'
          })}
        </div>
        <div class="plat-filter-group">
          <span class="plat-filter-lbl">DÍAS GPS</span>
          ${_multiSelectChipsDropdown({
            id: 'vj-f-dias',
            label: 'Días',
            allLabel: 'Todos',
            options: ['En línea','Atención','Fuera'],
            selected: f.dias || [],
            onChange: 'UI._onViajesFilterChange()'
          })}
        </div>
        <div class="plat-filter-group">
          <span class="plat-filter-lbl">PLATAFORMA ASIG.</span>
          ${_multiSelectChipsDropdown({
            id: 'vj-f-plat',
            label: 'Plataforma',
            allLabel: 'Todas',
            options: ALL_PLATS,
            selected: f.plataforma || [],
            onChange: 'UI._onViajesFilterChange()'
          })}
        </div>
        <input id="vj-f-search" value="${esc(f.search)}" oninput="UI._debounceViajesSearch()" placeholder="🔍 Buscar (separa con espacios: 2250 2280)..." class="plat-filter-search">
        <button class="act-btn" onclick="UI._resetViajesFilters()">↺ Reset</button>
        <span style="margin-left:auto;font-size:11px;color:var(--text2);align-self:center"><strong>${lista.length}</strong> unidades · <strong>${viajesGuardados.length}</strong> viajes guardados</span>
      </div>

      <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:12px;overflow:hidden">
        <div style="overflow-x:auto;max-height:65vh">
        <table>
          <thead><tr>
            <th>UNIDAD</th><th>EMPRESA</th><th>BASE</th><th>CROMÁTICA</th><th>MODELO</th><th>ESTATUS</th><th>DÍAS</th>
            <th>LUGAR SALIDA</th><th>HORA SAL.</th><th>DESTINO</th><th>HORA LLEG.</th><th>FECHA ATENCIÓN</th>
            <th>MOTIVO</th><th>PLATAFORMA</th><th>OBSERV.</th><th>ACC.</th>
          </tr></thead>
          <tbody id="vj-tbody">
          ${lista.map(u => _renderViajeRow(u, viajesPorUnidad[u.num] || {}, emp, f.plataforma)).join('')}
          </tbody>
        </table>
        </div>
      </div>
      <style>
        .vj-input{background:var(--bg-card);border:1px solid var(--border);border-radius:5px;padding:4px 7px;color:var(--text);font-family:var(--font);font-size:11px}
        .vj-input:focus{outline:none;border-color:var(--blue)}
        .vj-dt-display{background:var(--bg-card);border:1px solid var(--border);border-radius:5px;padding:4px 7px;color:var(--text2);font-family:var(--font);font-size:11px;cursor:pointer;min-height:22px;display:inline-flex;align-items:center;gap:4px}
        .vj-dt-display:hover{border-color:var(--blue);color:var(--text)}
        .vj-dt-display-empty{color:var(--text3);font-style:italic}
        .vj-obs-icon{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:5px;cursor:pointer;font-size:13px}
        .vj-obs-icon:hover{background:var(--bg-hover)}
        .vj-obs-has{color:var(--yellow)}
        .vj-obs-empty{color:var(--text3)}
        .vj-obs-editor{background:var(--bg-card);border:1px solid var(--blue);border-radius:5px;padding:4px;width:280px;max-width:100%}
        .vj-obs-editor textarea{width:100%;background:var(--bg-base);border:1px solid var(--border);border-radius:4px;padding:5px 7px;color:var(--text);font-family:var(--font);font-size:11px;resize:vertical;min-height:50px}
        .vj-row-saved{background:rgba(26,158,110,.04)}
      </style>
    `;
  }

  function _renderViajeRow(u, v, emp, platActual) {
    const catBadge = u._categoria === 'operacion'
      ? '<span class="ebadge ebadge-op">OPERACIÓN</span>'
      : '<span class="ebadge ebadge-fuera">FUERA DE LÍNEA</span>';
    const rowClass = v && v.id ? 'vj-row-saved' : '';

    // Plataforma auto-asignada: si hay filtro activo de plataforma, pre-selecciona esa; si no, usa la guardada
    const platSel = v.plataforma || platActual || '';

    const fmtDt = iso => iso ? Parsers.fmtDate(iso) : '';
    const fmtDate = iso => {
      if (!iso) return '';
      try { return new Date(iso).toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric'}); }
      catch(e) { return iso; }
    };

    return `<tr data-num="${esc(u.num)}" class="${rowClass}">
      <td style="font-weight:700"><a onclick="UI.openUnitDetail('${esc(u.num)}')" style="color:var(--blue);cursor:pointer">${esc(u.num)}</a></td>
      <td>${esc(u.empresa_asig||emp)}</td>
      <td>${esc(u.base||'—')}</td>
      <td>${esc(u.cromatica||'—')}</td>
      <td style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(u.modelo||'—')}</td>
      <td>${catBadge}</td>
      <td>${diasBadge(u._dias)}</td>
      <td><input type="text" class="vj-input" data-f="salidaLugar" data-n="${esc(u.num)}" value="${esc(v.salidaLugar||'')}" placeholder="Origen..." style="width:110px" onchange="UI._autoSaveViajeRow('${esc(u.num)}')"></td>
      <td>
        <span class="vj-dt-display ${v.salidaHora?'':'vj-dt-display-empty'}" onclick="UI._pickViajeDt('${esc(u.num)}','salidaHora','${esc(v.salidaHora||'')}',true)">
          📅 ${v.salidaHora?fmtDt(v.salidaHora):'dd/mm/aaaa --:--'}
        </span>
      </td>
      <td><input type="text" class="vj-input" data-f="destino" data-n="${esc(u.num)}" value="${esc(v.destino||'')}" placeholder="Destino..." style="width:110px" onchange="UI._autoSaveViajeRow('${esc(u.num)}')"></td>
      <td>
        <span class="vj-dt-display ${v.llegadaHora?'':'vj-dt-display-empty'}" onclick="UI._pickViajeDt('${esc(u.num)}','llegadaHora','${esc(v.llegadaHora||'')}',true)">
          📅 ${v.llegadaHora?fmtDt(v.llegadaHora):'dd/mm/aaaa --:--'}
        </span>
      </td>
      <td>
        <span class="vj-dt-display ${v.fechaAtencion?'':'vj-dt-display-empty'}" onclick="UI._pickViajeDt('${esc(u.num)}','fechaAtencion','${esc(v.fechaAtencion||'')}',false)">
          📅 ${v.fechaAtencion?fmtDate(v.fechaAtencion):'dd/mm/aaaa'}
        </span>
      </td>
      <td><input type="text" class="vj-input" data-f="motivo" data-n="${esc(u.num)}" value="${esc(v.motivo||'')}" placeholder="Motivo..." style="width:110px" onchange="UI._autoSaveViajeRow('${esc(u.num)}')"></td>
      <td>
        <select class="vj-input" data-f="plataforma" data-n="${esc(u.num)}" style="width:100px" onchange="UI._autoSaveViajeRow('${esc(u.num)}')">
          <option value="">—</option>
          ${ALL_PLATS.map(p=>`<option value="${p}" ${platSel===p?'selected':''}>${p}</option>`).join('')}
        </select>
      </td>
      <td style="text-align:center">
        <span class="vj-obs-icon ${v.observaciones?'vj-obs-has':'vj-obs-empty'}" onclick="UI._toggleObsEditor('${esc(u.num)}')" title="${esc(v.observaciones||'Click para agregar observación')}">
          ${v.observaciones ? '📝' : '💬'}
        </span>
      </td>
      <td style="white-space:nowrap">
        ${v.id?`<button class="act-btn-sm" style="color:var(--red)" onclick="UI._eliminarViajeRow('${esc(u.num)}',${v.id})" title="Eliminar viaje">🗑</button>`:''}
      </td>
    </tr>
    <tr id="vj-obs-row-${esc(u.num)}" style="display:none">
      <td colspan="16" style="padding:8px 14px;background:var(--bg-card)">
        <div class="vj-obs-editor">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text3);margin-bottom:4px">Observación · Unidad ${esc(u.num)}</div>
          <textarea id="vj-obs-txt-${esc(u.num)}" placeholder="Escribe aquí el comentario de atención...">${esc(v.observaciones||'')}</textarea>
          <div style="display:flex;justify-content:flex-end;gap:6px;margin-top:5px">
            <button class="act-btn-sm" onclick="UI._toggleObsEditor('${esc(u.num)}')">Cancelar</button>
            <button class="act-btn-sm" style="color:var(--blue);font-weight:700" onclick="UI._saveObsViaje('${esc(u.num)}')">💾 Guardar</button>
          </div>
        </div>
      </td>
    </tr>`;
  }

  // Debounce global para evitar re-renders excesivos al teclear rápido en buscadores
  const _debounceTimers = {};
  function _debounce(key, fn, ms = 180) {
    if (_debounceTimers[key]) clearTimeout(_debounceTimers[key]);
    _debounceTimers[key] = setTimeout(() => { delete _debounceTimers[key]; fn(); }, ms);
  }

  function _onViajesFilterChange() {
    // Preservar focus + posición del cursor del input activo antes de re-renderizar
    const activeEl = document.activeElement;
    const activeId = activeEl && activeEl.id ? activeEl.id : null;
    const selStart = activeEl && typeof activeEl.selectionStart === 'number' ? activeEl.selectionStart : null;
    const selEnd   = activeEl && typeof activeEl.selectionEnd   === 'number' ? activeEl.selectionEnd   : null;

    _viajesFiltro = {
      emp:    _readMultiSelectValues('vj-f-emp'),
      base:   _readMultiSelectValues('vj-f-base'),
      crom:   _readMultiSelectValues('vj-f-crom'),
      est:    _readMultiSelectValues('vj-f-est'),
      dias:   _readMultiSelectValues('vj-f-dias'),
      plataforma: _readMultiSelectValues('vj-f-plat'),
      search: $('vj-f-search')?.value || ''
    };
    renderViajes();

    // Restaurar focus tras el re-render (corrige bug del PDF: el buscador perdía focus
    // y había que volver a hacer click cada vez que escribías un dígito).
    if (activeId) {
      const nuevo = document.getElementById(activeId);
      if (nuevo) {
        nuevo.focus();
        if (selStart !== null && selEnd !== null && typeof nuevo.setSelectionRange === 'function') {
          try { nuevo.setSelectionRange(selStart, selEnd); } catch(e) { /* input type no soporta selection */ }
        }
      }
    }
  }

  /**
   * Versión debounced del filtro de viajes para el input de búsqueda.
   * Evita re-renders en cada tecla — espera 180ms de pausa antes de aplicar.
   */
  function _debounceViajesSearch() {
    _debounce('viajes-search', () => _onViajesFilterChange(), 180);
  }

  /**
   * Versión debounced del buscador del panel Resumen.
   * Preserva focus tras el re-render (mismo patrón que viajes).
   */
  function _debounceResumenSearch(value) {
    _rf = { ..._rf, search: value, page: 1 };
    _debounce('resumen-search', () => {
      const activeEl = document.activeElement;
      const activeId = activeEl && activeEl.id ? activeEl.id : null;
      const selStart = activeEl && typeof activeEl.selectionStart === 'number' ? activeEl.selectionStart : null;
      const selEnd   = activeEl && typeof activeEl.selectionEnd   === 'number' ? activeEl.selectionEnd   : null;
      // Para este input (sin id), guardar referencia por clase/placeholder
      const wasInput = activeEl && activeEl.tagName === 'INPUT' ? activeEl : null;
      const wasPlaceholder = wasInput ? wasInput.placeholder : null;

      renderUnitList();

      // Restaurar focus
      if (wasPlaceholder) {
        const match = document.querySelector(`input[placeholder="${wasPlaceholder.replace(/"/g,'\\"')}"]`);
        if (match) {
          match.focus();
          if (selStart !== null && selEnd !== null && typeof match.setSelectionRange === 'function') {
            try { match.setSelectionRange(selStart, selEnd); } catch(e) {}
          }
        }
      } else if (activeId) {
        const nuevo = document.getElementById(activeId);
        if (nuevo) {
          nuevo.focus();
          if (selStart !== null && selEnd !== null && typeof nuevo.setSelectionRange === 'function') {
            try { nuevo.setSelectionRange(selStart, selEnd); } catch(e) {}
          }
        }
      }
    }, 180);
  }

  /**
   * Versión debounced del buscador de Asignación con preservación de focus.
   */
  function _debounceAsigSearch(value) {
    _asigQ = value;
    _debounce('asig-search', () => {
      const activeEl = document.activeElement;
      const wasInput = activeEl && activeEl.tagName === 'INPUT' ? activeEl : null;
      const wasPlaceholder = wasInput ? wasInput.placeholder : null;
      const selStart = activeEl && typeof activeEl.selectionStart === 'number' ? activeEl.selectionStart : null;
      const selEnd   = activeEl && typeof activeEl.selectionEnd   === 'number' ? activeEl.selectionEnd   : null;

      renderAsigTable();

      if (wasPlaceholder) {
        const match = document.querySelector(`input[placeholder="${wasPlaceholder.replace(/"/g,'\\"')}"]`);
        if (match) {
          match.focus();
          if (selStart !== null && selEnd !== null && typeof match.setSelectionRange === 'function') {
            try { match.setSelectionRange(selStart, selEnd); } catch(e) {}
          }
        }
      }
    }, 180);
  }
  function _resetViajesFilters() {
    _viajesFiltro = { emp:[], base:[], crom:[], est:[], dias:[], search:'', plataforma:[] };
    renderViajes();
  }

  function _pickViajeDt(num, field, current, withTime) {
    const label = field === 'salidaHora' ? 'Hora de salida'
                : field === 'llegadaHora' ? 'Hora de llegada estimada'
                : 'Fecha de atención';

    openDatePicker(current || null, iso => {
      // Guardar directamente en DB (sin esperar clic de guardar)
      const emp = DB.getEmpresaActiva();
      const existente = DB.getViajes(emp).find(v => v.num === num);
      const datos = existente ? { ...existente } : { num };
      datos[field] = iso;
      // Leer también los otros inputs de la fila para no perderlos
      document.querySelectorAll(`[data-n="${num}"].vj-input`).forEach(inp => {
        datos[inp.dataset.f] = inp.value;
      });
      // Si no tiene plataforma asignada, tomar la del filtro si existe
      if (!datos.plataforma && _viajesFiltro.plataforma) datos.plataforma = _viajesFiltro.plataforma;
      DB.saveViaje(datos, emp);
      toast(`${label} guardada`,'success',1500);
      renderViajes();
    }, label);
  }

  function _autoSaveViajeRow(num) {
    const emp = DB.getEmpresaActiva();
    const existente = DB.getViajes(emp).find(v => v.num === num);
    const datos = existente ? { ...existente, num } : { num };
    document.querySelectorAll(`[data-n="${num}"].vj-input`).forEach(inp => {
      datos[inp.dataset.f] = inp.value;
    });
    if (!datos.plataforma && _viajesFiltro.plataforma) datos.plataforma = _viajesFiltro.plataforma;
    DB.saveViaje(datos, emp);
    toast(`Cambios guardados (${num})`,'success',1200);
  }

  function _guardarViajeRow(num) { _autoSaveViajeRow(num); }

  function _toggleObsEditor(num) {
    const row = $('vj-obs-row-' + num);
    if (!row) return;
    row.style.display = row.style.display === 'none' ? '' : 'none';
    if (row.style.display !== 'none') {
      const ta = $('vj-obs-txt-' + num);
      if (ta) ta.focus();
    }
  }

  function _saveObsViaje(num) {
    const emp = DB.getEmpresaActiva();
    const ta = $('vj-obs-txt-' + num);
    const obs = ta ? ta.value.trim() : '';
    const existente = DB.getViajes(emp).find(v => v.num === num);
    const datos = existente ? { ...existente, num, observaciones: obs }
                            : { num, observaciones: obs };
    // Leer también los otros inputs de la fila para no perderlos
    document.querySelectorAll(`[data-n="${num}"].vj-input`).forEach(inp => {
      datos[inp.dataset.f] = inp.value;
    });
    if (!datos.plataforma && _viajesFiltro.plataforma) datos.plataforma = _viajesFiltro.plataforma;
    DB.saveViaje(datos, emp);
    toast('Observación guardada','success', 1500);
    _toggleObsEditor(num);
    renderViajes();
  }

  function _eliminarViajeRow(num, id) {
    if (!confirm(`¿Eliminar el viaje programado para la unidad ${num}?`)) return;
    DB.eliminarViaje(Number(id));
    toast('Viaje eliminado','info');
    renderViajes();
  }

  function _exportarViajes() {
    const emp = DB.getEmpresaActiva();
    const viajes = DB.getViajes(emp);
    if (!viajes.length) { toast('No hay viajes registrados','warn'); return; }
    const header = ['UNIDAD','EMPRESA','PLATAFORMA','LUGAR_SALIDA','HORA_SALIDA','DESTINO','HORA_LLEGADA','FECHA_ATENCION','MOTIVO','OBSERVACIONES','ESTADO'];
    const rows = viajes.map(v => {
      const u = DB.getUnidad(v.num, emp);
      return [
        v.num, u?.empresa_asig||emp, v.plataforma||'',
        v.salidaLugar||'', v.salidaHora?Parsers.fmtDate(v.salidaHora):'',
        v.destino||'', v.llegadaHora?Parsers.fmtDate(v.llegadaHora):'',
        v.fechaAtencion||'', v.motivo||'', v.observaciones||'', v.estado||''
      ].map(x => `"${String(x).replace(/"/g,'""')}"`).join(',');
    });
    const csv = [header.join(','), ...rows].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8' }));
    a.download = `viajes_${emp}_${new Date().toISOString().substring(0,10)}.csv`;
    a.click();
    toast('Viajes exportados','success');
  }

  /* ══════════════════════════════════════════════════════
     PANEL: GRÁFICAS POR PLATAFORMA
  ══════════════════════════════════════════════════════ */
  function renderGraficas() {
    const emp = DB.getEmpresaActiva();
    const cfg = DB.getConfig();
    const hoy = Date.now();
    const el = $('graficas-content');
    if (!el) return;

    // Excluir Para venta y siniestros activos de gráficas
    const uns = DB.getUnidadesList(emp).filter(u =>
      u.activa && !_tieneSiniestroActivo(u) && Parsers.categorizarEstatus(u.estatus) !== 'Para venta'
    );

    // LÓGICA CORREGIDA (v7.1):
    // Cada plataforma tiene su PROPIO UNIVERSO (sus dispositivos, no todas las unidades de la empresa).
    // Ejemplo: Samsara tiene 350 dispositivos y 343 están en línea → 98% (no 47% sobre 710).
    // El "total" por plataforma es SOLO las unidades que tienen fecha en esa plataforma.
    // "Fuera de línea" en la dona = atención + fuera estricto (sin contar las que no tienen el dispositivo).
    // Las "sin datos" son las unidades de la empresa que NO están en esa plataforma —
    // se muestran aparte como dato informativo, pero NO entran en el denominador del %.
    const statsByPlat = ALL_PLATS.map(p => {
      const k = 'ultima_act_' + p.toLowerCase();
      const conFecha = uns.filter(u => u[k]);
      const enLinea = conFecha.filter(u => Math.floor((hoy - new Date(u[k]))/86400000) <= cfg.diasLinea).length;
      const atencion = conFecha.filter(u => {
        const d = Math.floor((hoy - new Date(u[k]))/86400000);
        return d > cfg.diasLinea && d <= cfg.diasAtencion;
      }).length;
      const fueraEstricto = conFecha.filter(u => Math.floor((hoy - new Date(u[k]))/86400000) > cfg.diasAtencion).length;
      const sinEquipo = uns.length - conFecha.length;           // unidades sin este dispositivo (informativo)
      const totalPlat = conFecha.length;                        // universo REAL de esta plataforma
      const fueraTotal = atencion + fueraEstricto;              // atención cuenta como fuera en la dona
      return { plat:p, totalPlat, totalEmpresa: uns.length, enLinea, atencion, fueraEstricto, sinEquipo, fueraTotal };
    });

    el.innerHTML = `
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:10px">
        <div>
          <h2 style="font-size:14px;font-weight:700">GRÁFICAS POR PLATAFORMA</h2>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">Cada plataforma muestra el porcentaje en línea sobre SUS PROPIOS dispositivos · "Atención" cuenta como fuera · Excluye "Para venta"</div>
        </div>
        <div style="display:flex;gap:10px;font-size:11px;color:var(--text3);align-items:center">
          <span style="display:flex;align-items:center;gap:5px"><span style="width:10px;height:10px;border-radius:50%;background:var(--green)"></span>En línea</span>
          <span style="display:flex;align-items:center;gap:5px"><span style="width:10px;height:10px;border-radius:50%;background:var(--red)"></span>Fuera de línea</span>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px">
        ${statsByPlat.map(s => {
          // % SOBRE EL UNIVERSO DE LA PLATAFORMA (no sobre total empresa)
          const pctLinea = s.totalPlat ? Math.round(s.enLinea / s.totalPlat * 100) : 0;
          const sinEquipoPct = s.totalEmpresa ? Math.round(s.sinEquipo / s.totalEmpresa * 100) : 0;
          const pctColor = pctLinea >= 80 ? 'var(--green)' : pctLinea >= 50 ? 'var(--yellow)' : 'var(--red)';
          return `<div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:12px;padding:14px;display:flex;flex-direction:column;align-items:center;transition:transform .15s ease" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
            <div style="display:flex;align-items:center;gap:7px;margin-bottom:10px">${platIcon(s.plat,22)}<div style="font-size:13px;font-weight:700">${s.plat}</div></div>
            <div style="width:120px;height:120px;position:relative">
              <canvas id="gplat-${s.plat}"></canvas>
              <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;pointer-events:none">
                <div style="font-size:22px;font-weight:700;color:${pctColor}">${pctLinea}%</div>
                <div style="font-size:9px;color:var(--text3);text-transform:uppercase">en línea</div>
              </div>
            </div>
            <div style="width:100%;margin-top:10px;display:flex;flex-direction:column;gap:3px;font-size:11px">
              <div style="display:flex;justify-content:space-between"><span style="color:var(--green)">● En línea</span><strong>${s.enLinea}</strong></div>
              <div style="display:flex;justify-content:space-between"><span style="color:var(--yellow)">● Atención</span><strong>${s.atencion}</strong></div>
              <div style="display:flex;justify-content:space-between"><span style="color:var(--red)">● Fuera</span><strong>${s.fueraEstricto}</strong></div>
              <div style="height:1px;background:var(--border);margin:4px 0"></div>
              <div style="display:flex;justify-content:space-between"><span style="font-weight:700">DISPOSITIVOS ${s.plat}</span><strong>${s.totalPlat}</strong></div>
              <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text3);margin-top:2px" title="Unidades de la empresa que no tienen este dispositivo">○ Sin equipo<span>${s.sinEquipo} (${sinEquipoPct}%)</span></div>
            </div>
          </div>`;
        }).join('')}
      </div>

      <!-- Resumen general (independiente de cada plataforma) -->
      <div style="margin-top:18px;background:var(--bg-panel);border:1px solid var(--border);border-radius:12px;padding:14px">
        <div style="font-size:12px;font-weight:700;margin-bottom:4px">RESUMEN GENERAL DE LA EMPRESA</div>
        <div style="font-size:10px;color:var(--text3);margin-bottom:10px">Considera la última conexión en CUALQUIER plataforma</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px">
          ${(() => {
            const totalOp = uns.length;
            const totalEnLinea = uns.filter(u => u.ultima_act && Math.floor((hoy-new Date(u.ultima_act))/86400000) <= cfg.diasLinea).length;
            const totalFuera = totalOp - totalEnLinea;
            const pctGlobal = totalOp ? Math.round(totalEnLinea/totalOp*100) : 0;
            return `
              <div style="text-align:center"><div style="font-size:22px;font-weight:700">${totalOp}</div><div style="font-size:10px;color:var(--text3)">Unidades operativas</div></div>
              <div style="text-align:center"><div style="font-size:22px;font-weight:700;color:var(--green)">${totalEnLinea}</div><div style="font-size:10px;color:var(--text3)">En línea</div></div>
              <div style="text-align:center"><div style="font-size:22px;font-weight:700;color:var(--red)">${totalFuera}</div><div style="font-size:10px;color:var(--text3)">Fuera de línea</div></div>
              <div style="text-align:center"><div style="font-size:22px;font-weight:700;color:${pctGlobal>80?'var(--green)':pctGlobal>50?'var(--yellow)':'var(--red)'}">${pctGlobal}%</div><div style="font-size:10px;color:var(--text3)">Operativo</div></div>
            `;
          })()}
        </div>
      </div>
    `;

    // Dibujar donuts — cada plataforma su propia dona (enLinea vs fueraTotal, sobre totalPlat)
    setTimeout(() => {
      statsByPlat.forEach(s => {
        if (s.totalPlat > 0) {
          Charts.donut('gplat-'+s.plat, ['En línea','Fuera'], [s.enLinea, s.fueraTotal], ['#1a9e6e','#c0392b']);
        } else {
          // Sin dispositivos: dona vacía gris
          Charts.donut('gplat-'+s.plat, ['Sin dispositivos'], [1], ['#374151']);
        }
      });
    }, 50);
  }

  Object.assign(UI_P, {
    renderAsignacion, renderAsigTable, renderReportes, exportarReporte,
    renderHistorial, renderAlertas, _filtrarPorAlerta, _exportarAlerta,
    renderViajes, renderGraficas,
    _renderViajeRow, _debounce,
    _onViajesFilterChange, _debounceViajesSearch,
    _debounceResumenSearch, _debounceAsigSearch,
    _resetViajesFilters, _pickViajeDt, _autoSaveViajeRow,
    _guardarViajeRow, _toggleObsEditor, _saveObsViaje,
    _eliminarViajeRow, _exportarViajes
  });
})();
