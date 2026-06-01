/**
 * ui-panels.js — Paneles: Asignación, Historial, Alertas, Viajes, Gráficas, Fallas, Barrido Manual, Maestra
 * Se carga DESPUÉS de ui.js. Inyecta funciones en window.UI.
 */
(function() {
  const UI_P = window.UI;
  if (!UI_P) { console.error('ui-panels: UI no disponible'); return; }


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
    renderAsignacion, renderAsigTable,
    renderHistorial, renderAlertas,
    renderViajes, renderGraficas,
    renderFallasPanel, renderBarridoManual,
    renderMaestra, cambiarEmpresa,
    _applyEmpresaTheme, _toggleNavGroup, _initNavGroups,
    exportarCSV, exportarDatos, importarDatos
  });
})();
