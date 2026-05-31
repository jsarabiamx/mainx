/**
 * app.js v4 — Controlador navegación
 */
const App = (() => {
  const META = {
    'panel-resumen':    { title:'MESA DE CONTROL', sub:'',                          nav:'nav-resumen'    },
    'panel-detalle':    { title:'MESA DE CONTROL', sub:'Detalle de Unidad',         nav:null             },
    'panel-asignacion': { title:'MESA DE CONTROL', sub:'Concentrado de Asignación', nav:'nav-asignacion' },
    'panel-carga-asig': { title:'MESA DE CONTROL', sub:'Carga de Asignación',       nav:'nav-carga-asig' },
    'panel-barridos':   { title:'MESA DE CONTROL', sub:'Carga de Barridos GPS',     nav:'nav-barridos'   },
    'panel-manual':     { title:'MESA DE CONTROL', sub:'Captura Manual',            nav:'nav-manual'     },
    'panel-reportes':   { title:'MESA DE CONTROL', sub:'Reportes',                  nav:'nav-reportes'   },
    'panel-maestra':    { title:'MESA DE CONTROL', sub:'Tabla Maestra',             nav:'nav-reportes'   },
    'panel-historial':  { title:'MESA DE CONTROL', sub:'Historial de Actividad',    nav:'nav-historial'  },
    'panel-plataformas':{ title:'MESA DE CONTROL', sub:'Plataformas GPS',           nav:'nav-plataformas'},
    'panel-viajes':     { title:'MESA DE CONTROL', sub:'Programación de Viajes',    nav:'nav-viajes'     },
    'panel-barrido-manual':{ title:'MESA DE CONTROL', sub:'Barrido Manual',         nav:'nav-barrido-manual'},
    'panel-graficas':   { title:'MESA DE CONTROL', sub:'Gráficas por Plataforma',   nav:'nav-graficas'   },
    'panel-fallas':     { title:'MESA DE CONTROL', sub:'Fallas activas',            nav:'nav-fallas-panel'},
    'panel-alertas':    { title:'MESA DE CONTROL', sub:'Centro de Alertas',         nav:'nav-alertas'    },
    'panel-config':     { title:'MESA DE CONTROL', sub:'Configuración',             nav:'nav-config'     },
    'panel-sims':       { title:'MESA DE CONTROL', sub:'Control de SIMs',           nav:'nav-sims'       },
  };

  function nav(el, panelId, extra) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const meta = META[panelId];
    if (meta?.nav) { const t = document.getElementById(meta.nav); if(t) t.classList.add('active'); }

    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById(panelId);
    if (panel) panel.classList.add('active');

    const te = document.getElementById('tb-title');
    const se = document.getElementById('tb-subtitle');
    if (te && meta) te.textContent = meta.title;
    if (se && meta) { se.textContent = meta.sub; se.style.display = meta.sub ? 'block' : 'none'; }

    const sw = document.getElementById('tb-sub-wrap');
    const tr = document.getElementById('tb-right-wrap');
    if (sw) sw.style.display = panelId === 'panel-resumen' ? 'flex' : 'none';
    if (tr) tr.style.display = panelId !== 'panel-resumen' ? 'flex' : 'none';

    switch(panelId) {
      case 'panel-resumen':    UI.renderResumen();    break;
      case 'panel-detalle':    if(extra) UI.renderDetalle(extra.num, extra.emp); break;
      case 'panel-asignacion': UI.renderAsignacion(); break;
      case 'panel-barridos':   UI.renderBarridos();   break;
      case 'panel-reportes':   UI.renderReportes();   break;
      case 'panel-maestra':    UI.renderMaestra();    break;
      case 'panel-historial':  UI.renderHistorial();  break;
      case 'panel-plataformas':UI.renderPlataformas();break;
      case 'panel-viajes':     UI.renderViajes();     break;
      case 'panel-barrido-manual': UI.renderBarridoManual(); break;
      case 'panel-graficas':   UI.renderGraficas();   break;
      case 'panel-fallas':     UI.renderFallasPanel();break;
      case 'panel-alertas':    UI.renderAlertas();    break;
      case 'panel-manual':     renderManual();        break;
      case 'panel-config':     renderConfig();        break;
      case 'panel-sims':       SimsUI.render();       break;
      case 'panel-carga-asig':
        for(let i=1;i<=5;i++){const e=document.getElementById('cstep-'+i);if(e){e.classList.remove('done','active');if(i===1)e.classList.add('active');}}
        ['asig-det-banner','asig-preview-section'].forEach(id=>{const e=document.getElementById(id);if(e)e.classList.add('hidden');});
        const bp=document.getElementById('btn-procesar-asig');if(bp)bp.disabled=true;
        break;
    }
  }

  function renderManual() {
    const emp = DB.getEmpresaActiva();
    const uns = DB.getUnidadesList(emp);
    const activas = uns.filter(u=>u.activa);
    const sinGps  = activas.filter(u=>!u.ultima_act);
    const el = document.getElementById('manual-content');
    if (!el) return;

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
        <div class="kstat"><div class="kstat-n">${activas.length}</div><div class="kstat-l">Unidades activas</div></div>
        <div class="kstat"><div class="kstat-n" style="color:var(--yellow)">${sinGps.length}</div><div class="kstat-l">Sin GPS</div></div>
        <div class="kstat"><div class="kstat-n" style="color:var(--red)">${uns.filter(u=>u.siniestro).length}</div><div class="kstat-l">Siniestros</div></div>
      </div>
      <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:12px;overflow:hidden">
        <div style="padding:11px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <h3 style="font-size:13px;font-weight:600;flex:1">Gestión de unidades — ${emp}</h3>
          <input id="manual-search" placeholder="🔍 Buscar..." class="search-input" oninput="App._filterManual(this.value)" style="width:200px">
          <button class="act-btn-primary" onclick="UI.openEditarUnidad(null,'${emp}')">+ Nueva unidad</button>
        </div>
        <div style="overflow:auto;max-height:500px">
          <table>
            <thead><tr>
              <th>Unidad</th><th>Base</th><th>Cromática</th><th>Plataforma</th>
              <th>Última conexión GPS</th><th>Días</th><th>Estatus</th><th>Acciones</th>
            </tr></thead>
            <tbody id="manual-tbody">
              ${_manualRows(uns, emp)}
            </tbody>
          </table>
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap">
        <div style="flex:1;background:var(--bg-panel);border:1px solid var(--border);border-radius:10px;padding:12px">
          <div style="font-size:12px;font-weight:600;margin-bottom:8px">Backup y restauración</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="act-btn" onclick="UI.exportarDatos()">↓ Backup JSON</button>
            <button class="act-btn" onclick="document.getElementById('import-json').click()">↑ Restaurar</button>
            <input type="file" id="import-json" accept=".json" style="display:none" onchange="UI.importarDatos(this.files[0]);this.value=''">
            <button class="act-btn" onclick="UI.exportarCSV()">↓ CSV completo</button>
          </div>
        </div>
      </div>`;
  }

  function _manualRows(uns, emp) {
    return uns.map(u => {
      const d = Parsers.diasDesde(u.ultima_act);
      const db = d===null?`<span class="dbadge dbadge-sin">—</span>`:d<=DB.getConfig().diasLinea?`<span class="dbadge dbadge-ok">${d}d</span>`:d<=DB.getConfig().diasAtencion?`<span class="dbadge dbadge-warn">${d}d</span>`:`<span class="dbadge dbadge-err">${d}d</span>`;
      const eBadge=u.siniestro?`<span class="ebadge ebadge-siniestro">SINIESTRO</span>`:(u.estatus?`<span class="ebadge ${String(u.estatus).toUpperCase().includes('OPERACI')?'ebadge-op':String(u.estatus).toUpperCase().includes('VENTA')?'ebadge-venta':'ebadge-fuera'}">${u.estatus}</span>`:'-');
      return `<tr>
        <td style="font-weight:700">${u.num}${!u.activa?'<span style="font-size:9px;color:var(--text3);margin-left:4px">INACTIVA</span>':''}</td>
        <td>${u.base||'—'}</td><td>${u.cromatica||'—'}</td><td>${u.plataforma||'—'}</td>
        <td style="font-size:11px">${u.ultima_act?Parsers.fmtDate(u.ultima_act):'Sin datos'}</td>
        <td>${db}</td><td>${eBadge}</td>
        <td style="white-space:nowrap">
          <button class="act-btn-sm" onclick="UI.openUnitDetail('${u.num}','${emp}')">↗</button>
          <button class="act-btn-sm" onclick="UI.openEditarUnidad('${u.num}','${emp}')">✎</button>
          <button class="act-btn-sm" onclick="UI.openDatePicker(${u.ultima_act?`'${u.ultima_act}'`:'null'},iso=>{UI._updateManualFechaConISO('${u.num}','${emp}',iso);App.renderManual&&App.renderManual()},'GPS — ${u.num}')">📡</button>
          ${!u.activa?`<button class="act-btn-sm" onclick="DB.reactivarUnidad('${u.num}','${emp}');App.nav(null,'panel-manual')">↺</button>`:`<button class="act-btn-sm" style="color:var(--yellow)" onclick="if(confirm('¿Marcar inactiva?')){DB.marcarInactiva('${u.num}','${emp}');App.nav(null,'panel-manual')}">⊖</button>`}
        </td>
      </tr>`;
    }).join('');
  }

  function _filterManual(q) {
    const emp = DB.getEmpresaActiva();
    const uns = DB.getUnidadesList(emp).filter(u => !q || (u.num+'').includes(q) || (u.base||'').toLowerCase().includes(q.toLowerCase()) || (u.cromatica||'').toLowerCase().includes(q.toLowerCase()));
    const tbody = document.getElementById('manual-tbody');
    if (tbody) tbody.innerHTML = _manualRows(uns, emp);
  }

  function renderConfig() {
    const cfg = DB.getConfig();
    const el = document.getElementById('config-content');
    if (!el) return;
    const empActiva = DB.getEmpresaActiva();
    const PLATS = ['CEIBA','SAMSARA','AVL','SCANIA','MAN','VOLVO','MOTIVE'];

    el.innerHTML = `
      <div style="max-width:640px;display:flex;flex-direction:column;gap:12px">
        <!-- Umbrales GPS -->
        <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:12px;padding:16px">
          <div style="font-size:13px;font-weight:600;margin-bottom:12px">⚙ Umbrales de estado GPS</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
            <div>
              <label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Días para "En línea" (≤)</label>
              <input type="number" id="cfg-linea" value="${cfg.diasLinea}" min="0" max="7" style="width:100%;background:var(--bg-card);border:1px solid var(--border2);border-radius:7px;padding:7px 10px;color:var(--text);font-family:var(--font)">
            </div>
            <div>
              <label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Días para "Atención" (≤)</label>
              <input type="number" id="cfg-aten" value="${cfg.diasAtencion}" min="1" max="30" style="width:100%;background:var(--bg-card);border:1px solid var(--border2);border-radius:7px;padding:7px 10px;color:var(--text);font-family:var(--font)">
            </div>
          </div>
          <button class="act-btn-primary" onclick="
            const l=parseInt(document.getElementById('cfg-linea').value);
            const a=parseInt(document.getElementById('cfg-aten').value);
            if(l>=0&&a>l){DB.setConfig({diasLinea:l,diasAtencion:a});UI.toast('Configuración guardada','success');}
            else{UI.toast('Valores inválidos','error');}">Guardar configuración</button>
        </div>

        <!-- Gestión de empresas (editar, agregar, eliminar, seleccionar) -->
        <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:12px;padding:16px">
          <div style="font-size:13px;font-weight:600;margin-bottom:12px">🏢 Gestión de empresas</div>
          ${DB.getEmpresasList().map(e=>{
            const isActive = e === empActiva;
            const nUnidades = DB.getUnidadesList(e).length;
            return `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);flex-wrap:wrap">
              <span style="flex:1;font-size:13px;font-weight:500;min-width:120px">${e}</span>
              <span style="font-size:11px;color:var(--text3);min-width:80px">${nUnidades} unidades</span>
              ${isActive?`<span class="ebadge ebadge-op" style="font-size:10px">ACTIVA</span>`:
                `<button class="act-btn-sm" onclick="UI.cambiarEmpresa('${e}');App.nav(null,'panel-config')">Seleccionar</button>`}
              <button class="act-btn-sm" onclick="App._editarEmpresa('${e}')" title="Renombrar">✎</button>
              ${!isActive?`<button class="act-btn-sm" style="color:var(--red)" onclick="App._eliminarEmpresa('${e}')" title="Eliminar">✕</button>`:''}
            </div>`;
          }).join('')}
          <button class="act-btn" style="margin-top:10px" onclick="App._nuevaEmpresa()">+ Nueva empresa</button>
        </div>

        <!-- Gestión de asignaciones -->
        <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:12px;padding:16px">
          <div style="font-size:13px;font-weight:600;margin-bottom:8px">📋 Historial de asignaciones</div>
          <div style="font-size:11px;color:var(--text3);margin-bottom:10px">Historial de cargas mensuales de ${empActiva}: ${DB.getAsignaciones(empActiva).length} registros</div>
          <button class="act-btn" style="color:var(--yellow)" onclick="App._eliminarHistorialAsignaciones()">🗑 Eliminar historial de asignaciones</button>
          <div style="font-size:10px;color:var(--text3);margin-top:5px">(Esto NO elimina las unidades, solo el log del historial)</div>
        </div>

        <!-- Eliminar datos por plataforma (doble confirmación) -->
        <div style="background:var(--bg-panel);border:1px solid var(--yellow-border);border-radius:12px;padding:16px">
          <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--yellow)">📡 Eliminar datos de plataforma GPS</div>
          <div style="font-size:11px;color:var(--text3);margin-bottom:10px">Borra todas las fechas de conexión registradas para la plataforma seleccionada en ${empActiva}. Las unidades se mantienen.</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <select id="cfg-plat-del" style="background:var(--bg-card);border:1px solid var(--border2);border-radius:7px;padding:7px 10px;color:var(--text);font-family:var(--font);font-size:12px">
              ${PLATS.map(p=>`<option value="${p}">${p}</option>`).join('')}
            </select>
            <button class="act-btn" style="color:var(--yellow)" onclick="App._eliminarDatosPlataforma(document.getElementById('cfg-plat-del').value)">🗑 Eliminar datos de esta plataforma</button>
          </div>
        </div>

        <!-- Zona de peligro -->
        <div style="background:var(--bg-panel);border:1px solid var(--red-border);border-radius:12px;padding:16px">
          <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--red)">⚠ Zona de peligro</div>
          <button class="act-btn" style="color:var(--red)" onclick="App._borrarEmpresa('${empActiva}')">🗑 Borrar todos los datos de ${empActiva}</button>
        </div>
      </div>`;
  }

  /* ─── ACCIONES CONFIG ─────────────────────────────── */
  function _editarEmpresa(key) {
    const nuevo = prompt(`Renombrar empresa "${key}":\n(el nombre se guarda en mayúsculas)`, key);
    if (!nuevo || nuevo.trim() === key) return;
    const nuevaKey = DB.renombrarEmpresa(key, nuevo.trim());
    if (nuevaKey) {
      UI.toast(`Empresa renombrada: ${nuevaKey}`,'success');
      populateEmpresaSelect();
      nav(null, 'panel-config');
    } else {
      UI.toast('No se pudo renombrar (nombre ya existe)','error');
    }
  }

  function _eliminarEmpresa(key) {
    if (!confirm(`¿Eliminar empresa "${key}"?\nSe borrarán TODOS sus datos (unidades, barridos, asignaciones, viajes).\n\nEsta acción NO se puede deshacer.`)) return;
    if (!confirm(`CONFIRMACIÓN FINAL\n\nEstás a punto de eliminar permanentemente la empresa "${key}".\n¿Continuar?`)) return;
    if (DB.removeEmpresa(key)) {
      UI.toast(`Empresa ${key} eliminada`,'error');
      populateEmpresaSelect();
      nav(null, 'panel-config');
    } else {
      UI.toast('No se puede eliminar la única empresa','warn');
    }
  }

  function _nuevaEmpresa() {
    const nombre = prompt('Nombre de la nueva empresa:');
    if (!nombre || !nombre.trim()) return;
    const k = DB.addEmpresa(nombre);
    UI.toast(`Empresa "${k}" creada`,'success');
    populateEmpresaSelect();
    nav(null, 'panel-config');
  }

  function _eliminarHistorialAsignaciones() {
    const emp = DB.getEmpresaActiva();
    const n = DB.getAsignaciones(emp).length;
    if (n === 0) { UI.toast('No hay historial que eliminar','info'); return; }
    if (!confirm(`¿Eliminar el historial de ${n} asignaciones de ${emp}?\n\nLas unidades se mantendrán intactas, solo se borra el log.`)) return;
    DB.eliminarTodasAsignaciones(emp);
    UI.toast('Historial de asignaciones eliminado','info');
    nav(null, 'panel-config');
  }

  async function _eliminarDatosPlataforma(plataforma) {
    const emp = DB.getEmpresaActiva();
    if (!confirm(`¿Eliminar TODOS los datos GPS de la plataforma ${plataforma} en ${emp}?\n\nSe borrarán todas las fechas de última conexión registradas para esta plataforma.`)) return;
    if (!confirm(`CONFIRMACIÓN FINAL\n\nEsta acción NO se puede deshacer.\n¿Estás completamente seguro de eliminar los datos de ${plataforma}?`)) return;

    // ✅ FIX: primero borrar en Supabase (await real), luego limpiar localStorage
    // Así si el usuario recarga, initFromSupabase no restaura los datos borrados
    if (window.GPS_SB) {
      try {
        await GPS_SB._delete('gps_barridos',
          `empresa_id=eq.${encodeURIComponent(emp)}&plataforma=eq.${encodeURIComponent(plataforma)}`
        );
        console.log(`[GPS] Supabase: borrados barridos de ${plataforma} en ${emp}`);
      } catch(e) {
        console.warn('[GPS_SB eliminarDatosPlataforma]', e);
        UI.toast(`Error al eliminar en Supabase: ${e.message}`, 'error');
        return;
      }
    }

    // Ahora limpiar localStorage
    const afectadas = DB.eliminarDatosPlataforma(plataforma, emp);
    UI.toast(`${afectadas} unidades actualizadas. Datos de ${plataforma} eliminados.`, 'warn', 4500);
    nav(null, 'panel-config');
  }

  function _borrarEmpresa(emp) {
    if (!confirm(`¿BORRAR TODOS los datos de ${emp}?\n\nEsto incluye unidades, barridos, asignaciones y viajes.`)) return;
    if (!confirm(`CONFIRMACIÓN FINAL\n\nEsta acción NO se puede deshacer.\n¿Seguro que deseas borrar toda la información de ${emp}?`)) return;
    DB.resetEmpresa();
    // ✅ FIX: también borrar de Supabase para evitar que initFromSupabase restaure datos zombi
    if (window.GPS_SB) {
      Promise.all([
        GPS_SB._delete('gps_barridos',     `empresa_id=eq.${encodeURIComponent(emp)}`),
        GPS_SB._delete('gps_asignaciones', `empresa_id=eq.${encodeURIComponent(emp)}`),
        GPS_SB._delete('gps_unidades',     `empresa_id=eq.${encodeURIComponent(emp)}`),
        GPS_SB._delete('gps_fallas',       `empresa_id=eq.${encodeURIComponent(emp)}`)
      ]).then(() => {
        console.log(`[GPS_SB] Datos de ${emp} eliminados de Supabase`);
      }).catch(e => console.warn('[GPS_SB _borrarEmpresa]', e));
    }
    UI.toast('Datos eliminados', 'error');
    nav(null, 'panel-resumen');
  }

  function populateEmpresaSelect() {
    const sel = document.getElementById('empresa-select');
    if (!sel) return;
    sel.innerHTML = DB.getEmpresasList().map(e => `<option value="${e}" ${e===DB.getEmpresaActiva()?'selected':''}>${e}</option>`).join('');
  }

  // ── Sincronización en tiempo real de fallas desde Supabase ───────────────
  let _fallasSyncTimer = null;
  let _fallasSyncHash = '';

  async function _syncFallasFromSupabase() {
    if (!window.GPS_SB) return;
    try {
      const emp = DB.getEmpresaActiva();
      if (!emp) return;
      const rows = await GPS_SB.getFallasActivas(emp);
      if (!rows || !rows.length) return;

      // Hash simple para detectar cambios
      const hash = rows.map(r => r.id + ':' + r.activa + ':' + r.resuelta).join('|');
      if (hash === _fallasSyncHash) return;
      _fallasSyncHash = hash;

      // Sincronizar cada falla al estado local
      let huboNuevas = false;
      rows.forEach(row => {
        const num = row.num_economico;
        let u = DB.getUnidad(num, emp);
        // Si la unidad no existe local, crear stub para que el siniestro sea visible
        if (!u) {
          DB.upsertUnidad(num, {
            activa: true, siniestro: false, fallas: [], _fuente: 'supabase_falla_sync'
          }, emp);
          u = DB.getUnidad(num, emp);
          if (!u) return;
        }

        u.fallas = u.fallas || [];
        const existe = u.fallas.find(f => f._sbId === row.id || String(f.id) === String(row.datos_extra?.id));
        const esSiniestro = row.tipo === 'SINIESTRO';

        if (!existe) {
          // Falla nueva desde otro dispositivo
          const falla = {
            ...(row.datos_extra || {}),
            id: row.datos_extra?.id || Date.now(),
            _sbId: row.id,
            motivo: row.etiqueta || row.datos_extra?.motivo || '',
            descripcion: row.descripcion || row.datos_extra?.descripcion || '',
            esSiniestro,
            resuelta: false,
            fecha: row.created_at
          };
          u.fallas.push(falla);
          if (esSiniestro) { u.siniestro = true; u.siniestroDesc = falla.motivo; }
          huboNuevas = true;
        } else {
          // Falla ya existe — asegurar que _sbId y siniestro estén actualizados
          if (!existe._sbId) { existe._sbId = row.id; }
          // CRÍTICO: si la falla es siniestro pero la unidad no tiene el flag, corregirlo
          if (esSiniestro && !u.siniestro) {
            u.siniestro = true;
            u.siniestroDesc = existe.motivo || row.etiqueta || '';
            huboNuevas = true;
          }
          if (row.resuelta && !existe.resuelta) {
            existe.resuelta = true;
            existe.fechaResolucion = row.updated_at;
            // Si se resolvió el siniestro, limpiar flag si no quedan más siniestros activos
            if (esSiniestro) {
              const quedanSiniestros = u.fallas.some(f => f.esSiniestro && !f.resuelta);
              if (!quedanSiniestros) { u.siniestro = false; u.siniestroDesc = ''; }
            }
            huboNuevas = true;
          }
        }
      });

      if (huboNuevas) {
        DB.save && DB.save();
        // Re-renderizar la vista activa para reflejar cambios de siniestro
        if (typeof UI !== 'undefined') {
          UI.renderResumen && UI.renderResumen();
          // Si Plataformas está visible, también refrescarla
          const platGrid = document.getElementById('plataformas-grid');
          if (platGrid) UI.renderPlataformas && UI.renderPlataformas();
        }
      }
    } catch(e) {
      console.debug('[FallaSync]', e.message);
    }
  }

  // Sincronización inicial de fallas — siempre corre al inicio aunque haya datos locales
  async function _syncFallasDesdeInicio() {
    if (!window.GPS_SB) return;
    try {
      const empresas = DB.getEmpresasList();
      let huboNuevas = false;

      for (const emp of empresas) {
        const rows = await GPS_SB.getFallasActivas(emp);
        if (!rows || !rows.length) continue;

        rows.forEach(row => {
          const num = String(row.num_economico);
          let u = DB.getUnidad(num, emp);

          // Crear stub si la unidad no existe
          if (!u) {
            DB.upsertUnidad(num, { activa: true, siniestro: false, fallas: [], _fuente: 'supabase_falla_init' }, emp);
            u = DB.getUnidad(num, emp);
            if (!u) return;
          }

          u.fallas = u.fallas || [];
          const esSiniestro = row.tipo === 'SINIESTRO';
          const existe = u.fallas.find(f => f._sbId === row.id);

          if (!existe) {
            const extra = row.datos_extra || {};
            const falla = {
              id: extra.id || row.id,
              _sbId: row.id,
              motivo: row.etiqueta || extra.motivo || '',
              descripcion: row.descripcion || extra.descripcion || '',
              ubicacion: extra.ubicacion || '',
              esSiniestro,
              resuelta: false,
              fecha: row.created_at,
              fechaOcurrencia: extra.fechaOcurrencia || row.created_at
            };
            u.fallas.push(falla);
            u.fallaCount = u.fallas.length;
            huboNuevas = true;
          }

          // SIEMPRE corregir el flag de siniestro si corresponde
          if (esSiniestro && !u.siniestro) {
            u.siniestro = true;
            u.siniestroDesc = row.etiqueta || '';
            huboNuevas = true;
          }
          // Si tenía siniestro marcado pero ya no hay falla activa de tipo SINIESTRO, limpiarlo
          if (!esSiniestro && u.siniestro) {
            const tieneSiniestroActivo = u.fallas.some(f => f.esSiniestro && !f.resuelta);
            if (!tieneSiniestroActivo) { u.siniestro = false; u.siniestroDesc = ''; huboNuevas = true; }
          }
        });
      }

      if (huboNuevas) {
        DB.save && DB.save();
        // Re-renderizar todo para reflejar siniestros
        UI.renderResumen && UI.renderResumen();
        const platGrid = document.getElementById('plataformas-grid');
        if (platGrid) UI.renderPlataformas && UI.renderPlataformas();
      }
    } catch(e) {
      console.warn('[FallaInit]', e.message);
    }
  }

  function _startFallasSync() {
    _syncFallasFromSupabase();
    _fallasSyncTimer = setInterval(_syncFallasFromSupabase, 15000); // cada 15 seg
  }

  function init() {
    populateEmpresaSelect();
    injectStyles();

    // Aplicar tema de empresa desde el inicio
    if (UI._applyEmpresaTheme) UI._applyEmpresaTheme(DB.getEmpresaActiva());
    if (UI._initNavGroups) UI._initNavGroups();

    UI.renderResumen();
    document.getElementById('tb-date').textContent = new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric'});

    // ── Carga desde Supabase ──────────────────────────────────────────────
    // SIEMPRE sincronizar desde Supabase al iniciar.
    // Esto garantiza que los barridos GPS (ultima_act_<plat>) estén aplicados
    // en cualquier dispositivo/sesión, sin depender de localStorage previo.
    const hayDatos = DB.getUnidadesList(DB.getEmpresaActiva()).length > 0;

    if (!hayDatos) {
      // Sin datos locales: carga completa desde Supabase
      _showSyncBanner('⏳ Cargando datos desde Supabase...');
      DB.initFromSupabase().then(() => {
        _hideSyncBanner();
        UI.renderResumen();
        populateEmpresaSelect();
      }).catch(e => {
        _hideSyncBanner();
        console.error('[App] initFromSupabase error:', e);
        UI.renderResumen();
      });
    } else {
      // Hay datos locales: sincronizar en background
      setTimeout(() => {
        DB.initFromSupabase().then(() => {
          UI.renderResumen();
          const panelPlat = document.getElementById('panel-plataformas');
          if (panelPlat && panelPlat.classList.contains('active')) UI.renderPlataformas();
        }).catch(e => console.error('[App] bg sync error:', e));
      }, 500);
    }

    // Siempre sincronizar fallas activas (siniestros, AFR) desde Supabase
    // Esto garantiza que cualquier dispositivo vea siniestros registrados en otro
    setTimeout(() => {
      _syncFallasDesdeInicio();
    }, 3000);

    // Iniciar sincronización en tiempo real de fallas
    setTimeout(_startFallasSync, 5000);

    // Polling de desinstalaciones — sync entre navegadores cada 30s
    setTimeout(_startDesinstalacionesSync, 8000);
  }

  async function _syncDesinstalaciones() {
    if (!window.GPS_SB) return;
    try {
      const rows = await GPS_SB._getRaw('gps_barridos', 'desinstalado=eq.true');
      if (!rows || !rows.length) {
        // Si no hay desinstalados en Supabase, limpiar los locales que no estén en SB
        _limpiarDesinstalacionesLocales([]);
        return;
      }
      let cambio = false;
      rows.forEach(r => {
        const emp = String(r.empresa_id || '');
        const num = String(r.num_economico || '');
        const plat = String(r.plataforma || '').toLowerCase();
        const desKey = 'desinstalacion_' + plat;
        const u = DB.getUnidad(num, emp);
        if (!u) return;
        const nuevoVal = {
          fecha:      r.desinstalacion_fecha      || null,
          comentario: r.desinstalacion_comentario || '',
          ts:         r.desinstalacion_ts         || null
        };
        const actual = u[desKey];
        if (!actual || actual.fecha !== nuevoVal.fecha || actual.comentario !== nuevoVal.comentario) {
          DB.upsertUnidad(num, { [desKey]: nuevoVal }, emp);
          cambio = true;
        }
      });
      // También limpiar las que fueron liberadas en Supabase
      _limpiarDesinstalacionesLocales(rows);
      if (cambio) {
        // Refrescar UI si hay paneles activos
        const panelPlat = document.getElementById('panel-plataformas');
        if (panelPlat && panelPlat.classList.contains('active') && UI._platExpandida) {
          UI._refreshPlatTable(UI._platExpandida);
        }
        const panelDetalle = document.getElementById('panel-detalle');
        if (panelDetalle && panelDetalle.classList.contains('active')) {
          // Re-renderizar solo si hay cambio en la unidad actual
          const numActual = panelDetalle.querySelector('[data-num]')?.dataset?.num;
          if (numActual) UI.renderDetalle(numActual, DB.getEmpresaActiva());
        }
      }
    } catch(e) { /* silencioso */ }
  }

  function _limpiarDesinstalacionesLocales(rowsDesinstalados) {
    // Quita desinstalacion_* de unidades locales que ya no están desinstaladas en Supabase
    const sbSet = new Set(rowsDesinstalados.map(r => `${r.empresa_id}|${r.num_economico}|${r.plataforma?.toLowerCase()}`));
    const ALL_P = ['ceiba','samsara','avl','scania','man','volvo','motive'];
    DB.getEmpresasList().forEach(emp => {
      DB.getUnidadesList(emp).forEach(u => {
        ALL_P.forEach(p => {
          const desKey = 'desinstalacion_' + p;
          if (u[desKey]) {
            const key = `${emp}|${u.num}|${p}`;
            if (!sbSet.has(key)) {
              delete u[desKey];
              DB.upsertUnidad(u.num, { updatedAt: new Date().toISOString() }, emp);
            }
          }
        });
      });
    });
  }

  function _startDesinstalacionesSync() {
    _syncDesinstalaciones();
    setInterval(_syncDesinstalaciones, 30000);
  }

  function _showSyncBanner(msg) {
    let b = document.getElementById('sync-banner');
    if (!b) {
      b = document.createElement('div');
      b.id = 'sync-banner';
      b.style.cssText = 'position:fixed;top:44px;left:0;right:0;background:#1d4ed8;color:#fff;text-align:center;font-size:12px;padding:6px;z-index:9999;font-family:var(--font,sans-serif)';
      document.body.appendChild(b);
    }
    b.textContent = msg;
    b.style.display = 'block';
  }

  function _hideSyncBanner() {
    const b = document.getElementById('sync-banner');
    if (b) b.style.display = 'none';
  }

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn{from{transform:translateX(20px);opacity:0}to{transform:translateX(0);opacity:1}}
      .ebadge{display:inline-block;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.03em}
      .ebadge-op{background:rgba(16,185,129,.12);color:#10b981;border:1px solid rgba(16,185,129,.25)}
      .ebadge-venta{background:rgba(139,92,246,.12);color:#a78bfa;border:1px solid rgba(139,92,246,.25)}
      .ebadge-fuera{background:rgba(239,68,68,.12);color:#ef4444;border:1px solid rgba(239,68,68,.25)}
      .ebadge-siniestro{background:rgba(239,68,68,.2);color:#ef4444;border:1px solid rgba(239,68,68,.5);animation:pulse 2s infinite}
      .ebadge-baja{background:rgba(107,114,128,.12);color:#9ca3af;border:1px solid rgba(107,114,128,.25)}
      .ebadge-other{background:rgba(59,130,246,.12);color:#60a5fa;border:1px solid rgba(59,130,246,.25)}
      .dbadge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;font-family:monospace}
      .dbadge-ok{background:rgba(16,185,129,.12);color:#10b981}
      .dbadge-warn{background:rgba(245,158,11,.12);color:#f59e0b}
      .dbadge-err{background:rgba(239,68,68,.12);color:#ef4444}
      .dbadge-sin{color:var(--text3)}
      .bc-link{cursor:pointer;color:var(--text2)}.bc-link:hover{color:var(--blue)}
      .leg-row{display:flex;align-items:center;gap:5px;font-size:11px;padding:2px 0}
      .leg-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
      .leg-name{flex:1;white-space:nowrap}
      .leg-num{font-weight:600;color:var(--text2)}
      .leg-pct{color:var(--text3);font-size:10px}
      .empty-state{text-align:center;padding:40px;color:var(--text3);font-size:13px}
      .kstat{background:var(--bg-panel);border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center}
      .kstat-n{font-size:26px;font-weight:700;line-height:1}
      .kstat-l{font-size:11px;color:var(--text3);margin-top:4px}
      .search-input{background:var(--bg-card);border:1px solid var(--border);border-radius:7px;padding:6px 10px;color:var(--text);font-family:var(--font);font-size:12px}
      .search-input:focus{outline:none;border-color:var(--blue)}
      .search-input::placeholder{color:var(--text3)}
      .act-btn{display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border-radius:7px;background:var(--bg-card);border:1px solid var(--border2);color:var(--text2);font-family:var(--font);font-size:12px;font-weight:500;cursor:pointer;transition:all .15s;white-space:nowrap}
      .act-btn:hover{background:var(--bg-hover);color:var(--text)}
      .act-btn:disabled{opacity:.4;cursor:not-allowed}
      .act-btn-primary{display:inline-flex;align-items:center;gap:5px;padding:7px 14px;border-radius:7px;background:var(--blue);border:none;color:#fff;font-family:var(--font);font-size:12px;font-weight:600;cursor:pointer;transition:background .15s}
      .act-btn-primary:hover{background:#2563eb}
      .act-btn-ok{background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);color:#10b981;display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border-radius:7px;font-family:var(--font);font-size:12px;font-weight:500;cursor:pointer}
      .act-btn-danger-soft{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#ef4444;display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border-radius:7px;font-family:var(--font);font-size:12px;font-weight:500;cursor:pointer}
      .act-btn-sm{padding:3px 8px;border-radius:5px;background:var(--bg-card);border:1px solid var(--border);color:var(--text2);font-family:var(--font);font-size:11px;cursor:pointer;transition:all .15s}
      .act-btn-sm:hover{background:var(--bg-hover);color:var(--text)}
      .unit-card{display:flex;align-items:center;gap:12px;background:var(--bg-panel);border:1px solid var(--border);border-radius:12px;padding:12px 14px;cursor:pointer;transition:all .15s}
      .unit-card:hover{border-color:var(--border2);background:var(--bg-card)}
      .unit-card.critico{border-left:3px solid var(--red)}
      .unit-card.atencion{border-left:3px solid var(--yellow)}
      .unit-card.enlinea{border-left:3px solid var(--green)}
      .unit-card.sin{border-left:3px solid var(--text3)}
      .unit-card-status{display:flex;flex-direction:column;align-items:center;min-width:72px;flex-shrink:0}
      .unit-num{font-size:20px;font-weight:700;letter-spacing:-.03em;line-height:1}
      .unit-stlabel{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-top:2px}
      .unit-card-info{flex:1;min-width:0}
      .uf-row{display:flex;gap:14px;flex-wrap:wrap}
      .uf{display:flex;flex-direction:column;gap:1px}
      .uf-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text3)}
      .uf-val{font-size:12px;font-weight:500}
      .unit-card-conn{text-align:right;flex-shrink:0;min-width:100px}
      .detail-header{background:var(--bg-panel);border:1px solid var(--border);border-radius:12px;padding:16px 18px;display:flex;align-items:flex-start;gap:14px;margin-bottom:12px;flex-wrap:wrap}
      .det-icon-wrap{width:50px;height:50px;border-radius:50%;border:2px solid;display:flex;align-items:center;justify-content:center;flex-shrink:0}
      .det-num{font-size:26px;font-weight:700;letter-spacing:-.03em}
      .det-badge{display:inline-block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:3px 10px;border-radius:5px;margin-top:3px}
      .det-fields{display:grid;grid-template-columns:repeat(4,1fr);gap:8px 16px;flex:1;min-width:0}
      .det-flbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text3);margin-bottom:2px}
      .det-fval{font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .det-dias-box{background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:10px 14px;text-align:right;flex-shrink:0;min-width:150px}
      .det-dias-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text3);margin-bottom:3px}
      .det-dias-num{font-size:34px;font-weight:700;line-height:1}
      .det-dias-sub{font-size:10px;color:var(--text3)}
      .plat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}
      .det-bottom-grid{display:grid;grid-template-columns:1fr 1.3fr 1fr;gap:10px}
      .det-box{background:var(--bg-panel);border:1px solid var(--border);border-radius:10px;padding:12px}
      .det-box-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text2);margin-bottom:9px}
      .breadcrumb{font-size:12px;color:var(--text3);margin-bottom:11px}
      .tabs-bar{display:flex;border-bottom:1px solid var(--border);margin-bottom:12px;flex-wrap:wrap}
      .tab{padding:8px 14px;font-size:12px;font-weight:500;cursor:pointer;color:var(--text2);border-bottom:2px solid transparent;margin-bottom:-1px;transition:all .15s;white-space:nowrap}
      .tab:hover{color:var(--text)}
      .tab.active{color:var(--blue);border-bottom-color:var(--blue)}
      .hidden{display:none!important}
      input:focus,select:focus,textarea:focus{outline:none;border-color:var(--blue)!important}
      @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
      /* Responsive */
      @media(max-width:900px){
        .plat-grid{grid-template-columns:repeat(2,1fr)!important}
        .det-bottom-grid{grid-template-columns:1fr!important}
        .det-fields{grid-template-columns:repeat(2,1fr)!important}
        .kpi-grid{grid-template-columns:repeat(2,1fr)!important}
        .charts-row{grid-template-columns:repeat(2,1fr)!important}
        .asig-kpi-row{grid-template-columns:repeat(2,1fr)!important}
        .units-cols{grid-template-columns:1fr!important}
      }
      @media(max-width:600px){
        #sidebar{width:56px;min-width:56px}
        .sb-logo-title,.sb-logo-sub,.nav-item span:not(.nav-icon),.nav-badge,.sb-emp,.nav-section,.sb-footer{display:none}
        .nav-item{justify-content:center;padding:10px}
        .plat-grid{grid-template-columns:1fr!important}
        .det-fields{grid-template-columns:1fr 1fr!important}
        .kpi-grid{grid-template-columns:1fr 1fr!important}
      }
    `;
    document.head.appendChild(style);
  }

  document.addEventListener('DOMContentLoaded', init);

  function forzarRecargaSupabase() {
    if (!window.GPS_SB) {
      alert('Supabase no disponible. Verifica la conexión.');
      return;
    }
    _showSyncBanner('⏳ Recargando datos desde Supabase...');
    DB.initFromSupabase().then(ok => {
      _hideSyncBanner();
      if (ok) {
        UI.renderResumen();
        populateEmpresaSelect();
        console.log('[App] Recarga forzada desde Supabase completada');
      } else {
        alert('Error al recargar desde Supabase. Revisa la consola (F12).');
      }
    }).catch(e => {
      _hideSyncBanner();
      console.error('[App] forzarRecargaSupabase error:', e);
      alert('Error: ' + e.message);
    });
  }

  return {
    nav, populateEmpresaSelect, renderManual, renderConfig, _filterManual, _syncFallasDesdeInicio,
    _editarEmpresa, _eliminarEmpresa, _nuevaEmpresa,
    _eliminarHistorialAsignaciones, _eliminarDatosPlataforma, _borrarEmpresa,
    forzarRecargaSupabase
  };
})();
