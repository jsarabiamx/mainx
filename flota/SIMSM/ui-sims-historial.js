/**
 * sims-historial.js — Historial de SIMs Retiradas / Dadas de Baja
 * Módulo independiente. Lee directamente de Supabase (gps_sims_historial).
 * No depende de DB localStorage.
 * Depende de: GPS_SB (gps-db.js), UI (toast/openModal)
 */
const SimsHistorialUI = (() => {

  /* ═══ CONFIG SUPABASE ══════════════════════════════════ */
  const _sbCfg  = () => window.CCTV_SUPABASE_CONFIG || {};
  const _sbUrl  = () => (_sbCfg().url || 'https://sxzhmcrpeyuqslupttby.supabase.co') + '/rest/v1';
  const _sbKey  = () => _sbCfg().anonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4emhtY3JwZXl1cXNsdXB0dGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MjQ5MDgsImV4cCI6MjA5MzAwMDkwOH0.-muAjBKc2PekqbgRltLVBnUCdxfQlHNxmVruXrw_sl8';
  const _hdr    = () => ({ 'apikey': _sbKey(), 'Authorization': 'Bearer ' + _sbKey(), 'Content-Type': 'application/json' });

  /* ═══ ESTADO INTERNO ═══════════════════════════════════ */
  let _rows      = [];      // filas cargadas de Supabase
  let _cargando  = false;
  let _filtros   = { destino: '', operadora: '', search: '' };
  let _pagina    = 1;
  const POR_PAG  = 20;

  /* ═══ HELPERS ══════════════════════════════════════════ */
  function _fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-MX', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function _esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function _destBadge(d) {
    if (d === 'STOCK') return `<span style="background:rgba(16,185,129,.15);color:#10b981;border:1px solid rgba(16,185,129,.3);padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700">📦 STOCK</span>`;
    if (d === 'BAJA')  return `<span style="background:rgba(239,68,68,.15);color:#ef4444;border:1px solid rgba(239,68,68,.3);padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700">🗑 BAJA</span>`;
    return '<span style="color:var(--text3)">—</span>';
  }

  function _filtrar(rows) {
    return rows.filter(r => {
      if (_filtros.destino   && r.destino_retiro !== _filtros.destino)           return false;
      if (_filtros.operadora && r.operadora      !== _filtros.operadora)          return false;
      if (_filtros.search) {
        const q = _filtros.search.toLowerCase();
        const hay = [r.num_economico, r.iccid, r.operadora, r.base, r.cromatica, r.observaciones]
          .some(v => v && String(v).toLowerCase().includes(q));
        if (!hay) return false;
      }
      return true;
    });
  }

  /* ═══ CARGA DESDE SUPABASE ════════════════════════════ */
  async function _cargarDesdeSupabase(emp) {
    if (!window.GPS_SB) throw new Error('GPS_SB no disponible');
    const rows = await GPS_SB._getRaw('gps_sims_historial',
      `empresa_id=eq.${encodeURIComponent(emp)}&order=fecha_retiro.desc&limit=500`
    );
    return rows || [];
  }

  /* ═══ RENDER PRINCIPAL ════════════════════════════════ */
  function render() {
    const el = document.getElementById('sims-historial-content');
    if (!el) return;
    const emp = DB.getEmpresaActiva();

    el.innerHTML = _styles() + `
      <div class="simh-root">

        <!-- HEADER -->
        <div class="simh-header">
          <div>
            <div style="font-size:14px;font-weight:700;letter-spacing:.04em">HISTORIAL DE SIMs RETIRADAS</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">
              Empresa: ${_esc(emp)} &nbsp;·&nbsp; Registro histórico inmutable de retiros
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <button class="simh-btn-export" onclick="SimsHistorialUI.exportarCSV()" title="Exportar CSV">↓ CSV</button>
            <button class="simh-btn-reload" onclick="SimsHistorialUI.render()" title="Recargar">↺ Recargar</button>
          </div>
        </div>

        <!-- KPI CARDS -->
        <div id="simh-kpis" class="simh-kpis">
          <div class="simh-kpi-card" style="border-color:rgba(239,68,68,.4)">
            <div class="simh-kpi-label">TOTAL RETIRADAS</div>
            <div class="simh-kpi-val" id="simh-k-total" style="color:#ef4444">—</div>
          </div>
          <div class="simh-kpi-card" style="border-color:rgba(16,185,129,.4)">
            <div class="simh-kpi-label">📦 STOCK</div>
            <div class="simh-kpi-val" id="simh-k-stock" style="color:#10b981">—</div>
          </div>
          <div class="simh-kpi-card" style="border-color:rgba(239,68,68,.4)">
            <div class="simh-kpi-label">🗑 BAJA</div>
            <div class="simh-kpi-val" id="simh-k-baja" style="color:#ef4444">—</div>
          </div>
          <div class="simh-kpi-card" style="border-color:rgba(96,165,250,.4)">
            <div class="simh-kpi-label">GB RETIRADOS</div>
            <div class="simh-kpi-val" id="simh-k-gb" style="color:#60a5fa">—</div>
          </div>
        </div>

        <!-- FILTROS -->
        <div class="simh-filters">
          <select class="simh-select" id="simh-f-dest" onchange="SimsHistorialUI._setFiltro('destino',this.value)">
            <option value="">Todos los destinos</option>
            <option value="STOCK">📦 STOCK</option>
            <option value="BAJA">🗑 BAJA</option>
          </select>
          <select class="simh-select" id="simh-f-op" onchange="SimsHistorialUI._setFiltro('operadora',this.value)">
            <option value="">Todas las operadoras</option>
          </select>
          <div style="position:relative;flex:1;min-width:200px">
            <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text3);font-size:13px">🔍</span>
            <input class="simh-input-search" id="simh-search" placeholder="Buscar ICCID, unidad, base..."
              oninput="SimsHistorialUI._setFiltro('search',this.value)" style="padding-left:32px">
          </div>
          <button class="simh-btn-ghost" onclick="SimsHistorialUI._limpiarFiltros()">✕ Limpiar</button>
        </div>

        <!-- TABLA -->
        <div class="simh-table-wrap">
          <div id="simh-table-body">
            <div style="text-align:center;padding:40px;color:var(--text3)">⏳ Cargando historial desde Supabase...</div>
          </div>
        </div>

        <!-- PAGINACION -->
        <div id="simh-pagination" style="display:flex;justify-content:center;gap:6px;margin-top:12px;flex-wrap:wrap"></div>

      </div>`;

    // Cargar datos
    _cargando = true;
    _cargarDesdeSupabase(emp).then(rows => {
      _rows = rows;
      _cargando = false;
      _renderKPIs(rows);
      _renderOperadorasFiltro(rows);
      _renderTabla();
    }).catch(e => {
      _cargando = false;
      const tb = document.getElementById('simh-table-body');
      if (tb) tb.innerHTML = `<div style="text-align:center;padding:40px;color:#ef4444">❌ Error cargando datos: ${_esc(e.message)}</div>`;
    });
  }

  /* ═══ KPIs ════════════════════════════════════════════ */
  function _renderKPIs(rows) {
    const total = rows.length;
    const stock = rows.filter(r => r.destino_retiro === 'STOCK').length;
    const baja  = rows.filter(r => r.destino_retiro === 'BAJA').length;
    const gb    = rows.reduce((s, r) => s + (r.gb || 0), 0);
    const set   = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('simh-k-total', total);
    set('simh-k-stock', stock);
    set('simh-k-baja',  baja);
    set('simh-k-gb',    gb ? gb + ' GB' : '—');
  }

  function _renderOperadorasFiltro(rows) {
    const ops = [...new Set(rows.map(r => r.operadora).filter(Boolean))].sort();
    const sel = document.getElementById('simh-f-op');
    if (!sel) return;
    const cur = _filtros.operadora;
    sel.innerHTML = `<option value="">Todas las operadoras</option>` +
      ops.map(o => `<option value="${_esc(o)}" ${cur===o?'selected':''}>${_esc(o)}</option>`).join('');
  }

  /* ═══ TABLA ═══════════════════════════════════════════ */
  function _renderTabla() {
    const tb = document.getElementById('simh-table-body');
    if (!tb) return;

    const filtradas = _filtrar(_rows);
    const total     = filtradas.length;
    const inicio    = (_pagina - 1) * POR_PAG;
    const pagRows   = filtradas.slice(inicio, inicio + POR_PAG);

    if (total === 0) {
      tb.innerHTML = `
        <div style="text-align:center;padding:50px 20px;color:var(--text3)">
          <div style="font-size:32px;margin-bottom:8px">📭</div>
          <div style="font-size:13px;font-weight:600">Sin registros de retiros</div>
          <div style="font-size:11px;margin-top:4px">Los retiros de SIMs aparecerán aquí automáticamente</div>
        </div>`;
      _renderPaginacion(0);
      return;
    }

    tb.innerHTML = `
      <table class="simh-table">
        <thead>
          <tr>
            <th>FECHA RETIRO</th>
            <th>UNIDAD</th>
            <th>ICCID</th>
            <th>OPERADORA</th>
            <th style="text-align:center">GB</th>
            <th>BASE</th>
            <th>CROMÁTICA</th>
            <th>EQUIPO</th>
            <th style="text-align:center">DESTINO</th>
            <th>OBSERVACIONES</th>
          </tr>
        </thead>
        <tbody>
          ${pagRows.map(r => `
            <tr class="simh-row">
              <td style="white-space:nowrap;color:var(--text2)">${_fmtDate(r.fecha_retiro)}</td>
              <td style="font-weight:700;color:var(--text);font-size:13px">${_esc(r.num_economico) || '—'}</td>
              <td style="font-family:monospace;font-size:10px;color:var(--text2)">${_esc(r.iccid) || '—'}</td>
              <td>${r.operadora ? `<span class="simh-op-badge">${_esc(r.operadora)}</span>` : '—'}</td>
              <td style="text-align:center;font-weight:700;color:#60a5fa">${r.gb ? r.gb + ' GB' : '—'}</td>
              <td style="color:var(--text2)">${_esc(r.base) || '—'}</td>
              <td style="color:var(--text2)">${_esc(r.cromatica) || '—'}</td>
              <td style="color:var(--text2);font-size:10px">${_esc(r.equipo_dvr) || '—'}</td>
              <td style="text-align:center">${_destBadge(r.destino_retiro)}</td>
              <td style="color:var(--text3);font-size:10px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${_esc(r.observaciones)}">${_esc(r.observaciones) || ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div style="font-size:10px;color:var(--text3);padding:8px 4px">
        Mostrando ${inicio + 1}–${Math.min(inicio + POR_PAG, total)} de ${total} registro(s)
      </div>`;

    _renderPaginacion(total);
  }

  function _renderPaginacion(total) {
    const pag = document.getElementById('simh-pagination');
    if (!pag) return;
    const totalPags = Math.ceil(total / POR_PAG);
    if (totalPags <= 1) { pag.innerHTML = ''; return; }
    let html = '';
    for (let i = 1; i <= totalPags; i++) {
      const act = i === _pagina;
      html += `<button onclick="SimsHistorialUI._irPagina(${i})"
        style="padding:4px 10px;border-radius:6px;border:1px solid ${act?'var(--blue)':'var(--border2)'};
        background:${act?'var(--blue)':'var(--bg-card)'};color:${act?'#fff':'var(--text2)'};
        font-size:11px;cursor:pointer;font-weight:${act?'700':'400'}">${i}</button>`;
    }
    pag.innerHTML = html;
  }

  /* ═══ FILTROS Y PAGINACIÓN ════════════════════════════ */
  function _setFiltro(key, val) {
    _filtros[key] = val;
    _pagina = 1;
    _renderTabla();
  }

  function _limpiarFiltros() {
    _filtros = { destino: '', operadora: '', search: '' };
    _pagina  = 1;
    const sel1 = document.getElementById('simh-f-dest');
    const sel2 = document.getElementById('simh-f-op');
    const inp  = document.getElementById('simh-search');
    if (sel1) sel1.value = '';
    if (sel2) sel2.value = '';
    if (inp)  inp.value  = '';
    _renderTabla();
  }

  function _irPagina(n) {
    _pagina = n;
    _renderTabla();
    const root = document.querySelector('.simh-root');
    if (root) root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ═══ EXPORT CSV ══════════════════════════════════════ */
  function exportarCSV() {
    const emp  = DB.getEmpresaActiva();
    const rows = _filtrar(_rows);
    if (!rows.length) { if (typeof UI !== 'undefined') UI.toast('Sin datos para exportar', 'warn'); return; }
    const headers = ['Fecha Retiro','Unidad','ICCID','Operadora','GB','Base','Cromática','Equipo','Destino','Observaciones'];
    const data = rows.map(r => [
      _fmtDate(r.fecha_retiro), r.num_economico, r.iccid, r.operadora,
      r.gb ? r.gb + ' GB' : '', r.base, r.cromatica, r.equipo_dvr,
      r.destino_retiro, r.observaciones
    ].map(v => `"${(v||'').toString().replace(/"/g,'""')}"`));
    const csv  = [headers.join(','), ...data.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {
      href: url, download: `HistorialSIMs_${emp}_${Date.now()}.csv`
    });
    a.click();
    URL.revokeObjectURL(url);
    if (typeof UI !== 'undefined') UI.toast('CSV exportado', 'success');
  }

  /* ═══ REGISTRO DE RETIRO (llamado desde sims.js) ══════ */
  function registrarRetiro(simData, simAnterior, emp) {
    if (!window.GPS_SB) return;
    const registro = {
      empresa_id:     emp,
      num_economico:  simData.unidad        || (simAnterior && simAnterior.unidad)    || '',
      iccid:          simData.iccid         || (simAnterior && simAnterior.iccid)     || '',
      operadora:      simData.operadora     || (simAnterior && simAnterior.operadora) || '',
      gb:             simData.gb            || (simAnterior && simAnterior.gb)        || null,
      base:           simData.base          || (simAnterior && simAnterior.base)      || '',
      cromatica:      simData.cromatica     || (simAnterior && simAnterior.cromatica) || '',
      equipo_dvr:     simData.equipo_dvr    || (simAnterior && simAnterior.equipoDvr) || '',
      estado_antes:   (simAnterior && simAnterior.estado) || 'SIM INSTALADA',
      estado_nuevo:   'SIM RETIRADA',
      destino_retiro: simData.destino_retiro || null,
      observaciones:  simData.observaciones || '',
      fecha_retiro:   new Date().toISOString()
    };
    const url = _sbUrl() + '/gps_sims_historial';
    fetch(url, {
      method: 'POST', headers: _hdr(), body: JSON.stringify(registro)
    }).then(r => {
      if (r.ok) console.log('[SimsHistorialUI] Retiro registrado ✓', registro.iccid);
      else r.text().then(t => console.error('[SimsHistorialUI] FAIL', r.status, t));
    }).catch(e => console.error('[SimsHistorialUI] ERROR', e));
  }

  /* ═══ ESTILOS ═════════════════════════════════════════ */
  function _styles() {
    return `<style>
.simh-root{padding:16px 20px;max-width:1400px;font-family:var(--font)}
.simh-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;flex-wrap:wrap;gap:10px}
.simh-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
@media(max-width:900px){.simh-kpis{grid-template-columns:repeat(2,1fr)}}
.simh-kpi-card{background:var(--bg-card);border:1px solid var(--border2);border-radius:10px;padding:14px 16px;text-align:center}
.simh-kpi-label{font-size:9px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
.simh-kpi-val{font-size:28px;font-weight:700;line-height:1}
.simh-filters{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center}
.simh-select,.simh-input-search{background:var(--bg-card);border:1px solid var(--border2);border-radius:7px;padding:7px 10px;color:var(--text);font-size:12px;min-width:160px}
.simh-input-search{flex:1;min-width:200px}
.simh-select:focus,.simh-input-search:focus{outline:none;border-color:var(--blue)}
.simh-btn-export,.simh-btn-reload,.simh-btn-ghost{padding:7px 14px;border-radius:7px;border:1px solid var(--border2);background:var(--bg-card);color:var(--text2);font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;transition:all .12s}
.simh-btn-export:hover,.simh-btn-reload:hover{border-color:var(--blue);color:var(--blue)}
.simh-btn-ghost:hover{border-color:#ef4444;color:#ef4444}
.simh-table-wrap{overflow-x:auto;background:var(--bg-card);border:1px solid var(--border2);border-radius:10px}
.simh-table{width:100%;border-collapse:collapse;font-size:11px}
.simh-table thead tr{background:var(--bg-panel)}
.simh-table th{padding:8px 10px;text-align:left;font-size:9px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid var(--border)}
.simh-table td{padding:8px 10px;border-bottom:1px solid var(--border);vertical-align:middle}
.simh-row:hover td{background:rgba(255,255,255,.03)}
.simh-op-badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700;background:rgba(239,68,68,.15);color:#ef4444;border:1px solid rgba(239,68,68,.3)}
</style>`;
  }

  /* ═══ EXPORTS ═════════════════════════════════════════ */
  return {
    render,
    exportarCSV,
    registrarRetiro,
    _setFiltro,
    _limpiarFiltros,
    _irPagina
  };

})();
