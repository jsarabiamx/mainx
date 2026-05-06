/* ═══════════════════════════════════════════════
   CCTV Fleet Control — Bulk Registration Module v2.0
   Cambios PDF: Donde reporta, técnico que reporta,
   autocomplete desde flota ETN, SIN DVR, validación
   duplicados, tipo auto, pisos desde asignación.
═══════════════════════════════════════════════ */

const BULK = (() => {

  const state = {
    unidades: [],
    currentIdx: 0,
    chipState: { piso: '', tipo: '' },
    prioSel: 'Media',
    active: false,
    dondeReporta: '',
    tecnicoQueReporta: '',
    proveedorFuente: '',
    procesarTs: null,
  };

  function parseUnidades(raw) {
    const normalized = raw.replace(/,/g,' ').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim();
    const parts = normalized.split(' ').map(s=>s.trim()).filter(s=>s.length>0);
    const seen = new Set();
    return parts.filter(u=>{ if(seen.has(u))return false; seen.add(u); return true; });
  }

  function getCurrentUnidad() { return state.unidades[state.currentIdx]||null; }
  function getPendingCount()  { return state.unidades.filter(u=>u.status==='pending'&&!u.sinDvr).length; }
  function getDoneCount()     { return state.unidades.filter(u=>u.status==='done').length; }

  // Actualiza sin_dvr en flota_asignacion para una unidad
  async function _updateFlotaSinDvr(numEco, value) {
    try {
      const emp = DATA.state.currentEmpresa;
      const cfg = window.CCTV_SUPABASE_CONFIG;
      if (!cfg) return;
      let authToken = cfg.anonKey;
      try {
        const sb = window._flotaSbClient || (window.supabase && window.supabase.createClient(cfg.url, cfg.anonKey));
        if (sb) { const { data:{session} } = await sb.auth.getSession(); if(session?.access_token) authToken=session.access_token; }
      } catch(e){}
      // PATCH — actualiza el registro más reciente de la unidad en esta empresa
      const resp = await fetch(
        cfg.restUrl + '/flota_asignacion?empresa_id=eq.' + encodeURIComponent(emp) + '&num_economico=eq.' + encodeURIComponent(numEco),
        {
          method: 'PATCH',
          headers: { 'apikey':cfg.anonKey, 'Authorization':'Bearer '+authToken, 'Content-Type':'application/json', 'Prefer':'return=minimal' },
          body: JSON.stringify({ sin_dvr: value, updated_at: new Date().toISOString() })
        }
      );
      if (!resp.ok) console.warn('[BULK sinDvr PATCH]', resp.status, await resp.text());
      else {
        // Actualizar caché local también
        const cache = window._flotaConcentradoCache||[];
        cache.filter(r=>String(r.num_economico)===String(numEco)&&r.empresa_id===emp).forEach(r=>r.sin_dvr=value);
        console.log('[BULK sinDvr]', numEco, '→ sin_dvr=', value);
      }
    } catch(e) { console.warn('[BULK sinDvr]', e); }
  }

  // Obtiene datos de flota para UNA unidad - desde cache
  function _getFlotaData(numEco) {
    try {
      const cache = window._flotaConcentradoCache||[];
      const emp   = DATA.state.currentEmpresa;
      return cache.find(r=>String(r.num_economico).trim()===String(numEco).trim()&&r.empresa_id===emp)||null;
    } catch(e){ return null; }
  }

  // Pre-fetch via REST API directo (no depende de window.supabase ni clientes previos)
  async function _prefetchFlotaData(numeros) {
    try {
      const emp = DATA.state.currentEmpresa;
      const cfg = window.CCTV_SUPABASE_CONFIG;
      if (!cfg) { console.warn('[BULK prefetch] Sin config Supabase'); return {}; }

      // Construir query REST directa — más confiable que el cliente JS
      const numList = numeros.map(n => `"${String(n).trim()}"`).join(',');
      const url = cfg.restUrl + '/flota_asignacion'
        + '?select=num_economico,cromatica,servicio,base,pisos,empresa_id,mes_anio,sin_dvr'
        + '&empresa_id=eq.' + encodeURIComponent(emp)
        + '&num_economico=in.(' + numList + ')'
        + '&order=mes_anio.desc';  // traer el mes más reciente primero

      // Obtener token de sesión activa del usuario si existe
      let authToken = cfg.anonKey;
      try {
        const sb = window._flotaSbClient || (window.supabase && window.supabase.createClient(cfg.url, cfg.anonKey));
        if (sb) {
          const { data: { session } } = await sb.auth.getSession();
          if (session?.access_token) authToken = session.access_token;
        }
      } catch(e) { /* usar anon key */ }

      console.log('[BULK prefetch] Consultando empresa:', emp, '| unidades:', numeros.join(','));

      const resp = await fetch(url, {
        headers: {
          'apikey':        cfg.anonKey,
          'Authorization': 'Bearer ' + authToken,
          'Content-Type':  'application/json',
          'Accept':        'application/json',
        }
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.warn('[BULK prefetch] HTTP', resp.status, errText);
        return {};
      }

      const data = await resp.json();
      console.log('[BULK prefetch] Respuesta:', data);
      if (!Array.isArray(data)) return {};

      const map = {};
      // Solo guardar el primero encontrado por unidad (ya viene ordenado mes desc = más reciente)
      data.forEach(r => {
        const key = String(r.num_economico).trim();
        if (!map[key]) map[key] = r;
      });

      // Actualizar caché global
      const existing = window._flotaConcentradoCache || [];
      data.forEach(r => {
        const idx = existing.findIndex(e => String(e.num_economico) === String(r.num_economico) && e.empresa_id === r.empresa_id);
        if (idx === -1) existing.push(r); else existing[idx] = r;
      });
      window._flotaConcentradoCache = existing;

      console.log('[BULK prefetch]', emp, '→', data.length, 'unidades encontradas en asignación');
      return map;
    } catch(e) {
      console.warn('[BULK prefetch] Error:', e);
      return {};
    }
  }

  // ─── PANTALLA 1: Ingreso de lista ────────────
  function renderCargaMasiva(session) {
    const canEdit = AUTH.can('addReports');
    const emp     = DATA.state.currentEmpresa;
    const selBase = DATA.getSel('base');
    const drVal   = state.dondeReporta||'';
    const tqrVal  = state.tecnicoQueReporta||'';
    const pfVal   = state.proveedorFuente||'';

    return `
    <div id="mod-bulk" class="module active">
      <div class="mod-header">
        <div class="mod-title-wrap">
          <div style="display:flex;align-items:center;gap:10px">
            <button class="btn btn-ghost btn-sm" onclick="BULK.salirDeBulk()" style="padding:5px 8px">
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
          <span style="font-family:var(--mono);font-size:11px;color:var(--accent);background:var(--accent-bg);border:1px solid var(--accent-glow);border-radius:6px;padding:3px 10px">${emp}</span>
        </div>
      </div>

      ${!canEdit?`<div class="card" style="background:rgba(245,158,11,0.06);border-color:rgba(245,158,11,0.2)"><p style="color:var(--amber);font-size:12.5px">⚠ Solo lectura</p></div>`:''}

      <div class="bulk-layout">

        <!-- DATOS DEL TÉCNICO QUE REPORTA (PRIMERO) -->
        <div class="bulk-step-card card">
          <div class="bulk-step-header">
            <div class="bulk-step-num" style="background:linear-gradient(135deg,#4f8ef7,#8b5cf6);color:#fff;font-size:14px">★</div>
            <div>
              <div class="bulk-step-title">Datos del Técnico que Reporta</div>
              <div class="bulk-step-sub">Se aplicarán como datos base a todas las unidades de esta carga</div>
            </div>
          </div>
          <div class="form-grid" style="margin-top:4px">
            <div class="form-group">
              <label for="bulkDondeReporta">Donde Reporta <span style="color:var(--red)">*</span></label>
              <div class="select-wrap">
                <select id="bulkDondeReporta" onchange="BULK.onDondeReportaChange()">
                  <option value="">— Seleccionar —</option>
                  ${selBase.map(b=>`<option value="${b}"${drVal===b?' selected':''}>${b}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="form-group">
              <label for="bulkTecnicoReporta">Técnico que Reporta</label>
              <div class="select-wrap">
                <select id="bulkTecnicoReporta" onchange="BULK.onTecnicoReportaChange()">
                  <option value="">— Seleccionar base primero —</option>
                </select>
              </div>
              <input type="text" id="bulkTecnicoReportaOtro" placeholder="Escribe el nombre del técnico"
                style="display:none;margin-top:6px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text1);font-size:12px;padding:8px 12px;width:100%;font-family:inherit" value="${tqrVal}"/>
            </div>
            <div class="form-group">
              <label for="bulkProveedorFuente">De Donde Surge la Falla</label>
              <div class="select-wrap">
                <select id="bulkProveedorFuente" onchange="BULK._actualizarResumenTag()">
                  <option value="">— Seleccionar —</option>
                  ${(DATA.getSel('proveedor')||[]).map(p=>`<option value="${p}"${pfVal===p?' selected':''}>${p}</option>`).join('')}
                </select>
              </div>
            </div>
          </div>
          <div id="bulkReporteResumen" style="display:${drVal?'flex':'none'};margin-top:10px;padding:8px 12px;background:rgba(79,142,247,.06);border:1px solid rgba(79,142,247,.15);border-radius:8px;gap:16px;font-size:11px;flex-wrap:wrap">
            <span>📍 <strong>Reporta:</strong> <span id="bulkRRBase">${drVal||'—'}</span></span>
            <span>👤 <strong>Técnico:</strong> <span id="bulkRRTecnico">${tqrVal||'—'}</span></span>
            <span>🔧 <strong>Fuente:</strong> <span id="bulkRRFuente">${pfVal||'—'}</span></span>
          </div>
        </div>

        <!-- PASO 1: Lista -->
        <div class="bulk-step-card card">
          <div class="bulk-step-header">
            <div class="bulk-step-num">1</div>
            <div>
              <div class="bulk-step-title">Ingresar Lista de Unidades</div>
              <div class="bulk-step-sub">Pega o escribe la lista de unidades (una por línea)</div>
            </div>
          </div>
          <textarea id="bulkInput" class="bulk-textarea"
            placeholder="Ejemplos:&#10;• Por línea: 55185&#10;                  20095&#10;• En línea: 55185 20095 20166&#10;• Con comas: 55185, 20095, 20166"
            oninput="BULK.onInputChange()" ${!canEdit?'disabled':''}></textarea>
          <div class="bulk-input-footer">
            <span class="bulk-detected" id="bulkDetectedCount">0 unidades detectadas</span>
            ${canEdit?`<button class="btn btn-primary" id="bulkProcesarBtn" onclick="BULK.procesarLista()" disabled>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="22 2 15 22 11 12 2 6 22 2"/></svg>
              Procesar Lista
            </button>`:''}
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
            <div class="bulk-summary-card"><div class="bsc-icon" style="color:var(--accent)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v11m0 0H5m4 0h10M9 14v5m0 0H5a2 2 0 01-2-2v-3m4 5h10a2 2 0 002-2v-3"/></svg></div><div class="bsc-val" id="bscTotal">0</div><div class="bsc-lbl">Total detectadas</div></div>
            <div class="bulk-summary-card"><div class="bsc-icon" style="color:var(--amber)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/></svg></div><div class="bsc-val" id="bscDups">0</div><div class="bsc-lbl">Duplicadas</div></div>
            <div class="bulk-summary-card"><div class="bsc-icon" style="color:var(--red)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div><div class="bsc-val" id="bscExisting">0</div><div class="bsc-lbl">Con reporte pendiente</div></div>
            <div class="bulk-summary-card bsc-highlight"><div class="bsc-icon" style="color:var(--accent)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></div><div class="bsc-val" id="bscNew">0</div><div class="bsc-lbl">Nuevas para validar</div></div>
          </div>
          <div id="bulkSummaryInfo" style="display:none" class="bulk-info-box">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span id="bulkSummaryInfoText">Se crearán registros para su validación.</span>
          </div>
          <div id="bulkPendientesWrap" style="display:none;margin-top:10px"></div>
        </div>

        <!-- INSTRUCCIONES -->
        <div class="card bulk-instructions">
          <div class="bulk-instr-title"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Instrucciones</div>
          <ol class="bulk-instr-list">
            <li>Selecciona <strong>Donde Reporta</strong> y el Técnico que reporta.</li>
            <li>Pega la lista completa de unidades.</li>
            <li>Verifica el resumen de la lista.</li>
            <li>Haz clic en <strong>"Procesar Lista"</strong>.</li>
            <li>Continúa con la validación unidad por unidad.</li>
          </ol>
          <div class="bulk-note"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg><strong>Nota</strong></div>
          <p class="bulk-note-text">Podrás revisar y capturar la información de cada unidad en el siguiente paso.</p>
        </div>
      </div>
    </div>`;
  }

  // ─── Handlers pantalla 1 ──────────────────────
  function onDondeReportaChange() {
    const base = document.getElementById('bulkDondeReporta')?.value||'';
    state.dondeReporta = base;
    const emp     = DATA.state.currentEmpresa;
    const tecSel  = document.getElementById('bulkTecnicoReporta');
    if (tecSel) {
      const tecnicos = DATA.getTecnicosPorBase(emp, base);
      let opts = '<option value="">— Seleccionar técnico —</option>';
      opts += tecnicos.map(t=>`<option value="${t.nombre}">${t.nombre}${t.base?' ('+t.base+')':''}</option>`).join('');
      opts += '<option value="__otro__">Otro (escribir manualmente)</option>';
      tecSel.innerHTML = opts;
      const otroInp = document.getElementById('bulkTecnicoReportaOtro');
      if (otroInp) otroInp.style.display='none';
      // Si solo hay un técnico disponible, seleccionarlo automáticamente
      if (tecnicos.length === 1) {
        tecSel.value = tecnicos[0].nombre;
        state.tecnicoQueReporta = tecnicos[0].nombre;
      }
    }
    // requestAnimationFrame garantiza que el DOM del select ya fue actualizado
    requestAnimationFrame(() => _actualizarResumenTag());
  }

  function onTecnicoReportaChange() {
    const sel = document.getElementById('bulkTecnicoReporta');
    const inp = document.getElementById('bulkTecnicoReportaOtro');
    if (!sel) return;
    if (sel.value==='__otro__') {
      if (inp) inp.style.display='';
      state.tecnicoQueReporta = inp?.value||'';
    } else {
      if (inp) inp.style.display='none';
      state.tecnicoQueReporta = sel.value;
    }
    _actualizarResumenTag();
  }

  function _actualizarResumenTag() {
    const wrap = document.getElementById('bulkReporteResumen');
    const base = document.getElementById('bulkDondeReporta')?.value||'';
    const tec  = _getTecnicoReportaValue();
    const prov = document.getElementById('bulkProveedorFuente')?.value||'';
    state.dondeReporta      = base;
    state.tecnicoQueReporta = tec;
    state.proveedorFuente   = prov;
    if (wrap) {
      wrap.style.display = base?'flex':'none';
      const rb=document.getElementById('bulkRRBase'), rt=document.getElementById('bulkRRTecnico'), rf=document.getElementById('bulkRRFuente');
      if (rb) rb.textContent=base||'—';
      if (rt) rt.textContent=tec||'—';
      if (rf) rf.textContent=prov||'—';
    }
  }

  function _getTecnicoReportaValue() {
    const sel = document.getElementById('bulkTecnicoReporta');
    const inp = document.getElementById('bulkTecnicoReportaOtro');
    if (!sel) return state.tecnicoQueReporta||'';
    if (sel.value==='__otro__') return inp?inp.value.trim():'';
    return sel.value||'';
  }

  // ─── PANTALLA 2: Validación ───────────────────
  function renderValidacion() {
    const emp       = DATA.state.currentEmpresa;
    const total     = state.unidades.length;
    const doneCount = getDoneCount();
    const pendCount = getPendingCount();
    const current   = getCurrentUnidad();
    if (!current) return renderValidacionCompleta();

    const sel    = DATA.getSel('base');
    const selCat = DATA.getSel('categoria');

    const fd = current.flotaData || _getFlotaData(current.numero);
    if (fd && !current.flotaData) current.flotaData = fd;

    const autoBase      = state.dondeReporta || fd?.base || '';
    const autoCromatica = fd?.cromatica||'';
    const autoServicio  = fd?.servicio||'';
    const autoPisos     = fd?.pisos||'';
    const selSvc        = DATA.getSel('servicio', emp);
    const tienePendiente = current.reportePendiente;

    return `
    <div id="mod-validacion" class="module active">
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
        <!-- SIDEBAR -->
        <div class="validacion-sidebar card">
          <div class="vsb-header">
            <span class="vsb-title">Lista de Unidades (${total})</span>
            <button class="btn btn-ghost btn-sm vsb-refresh" onclick="BULK.refreshList()" title="Refrescar">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 101.14-4.52"/></svg>
              Refrescar Lista
            </button>
          </div>
          <div class="vsb-list" id="validacionSidebarList">
            ${state.unidades.map((u,i)=>{
              const isDone=u.status==='done', isBarrido=u.status==='barrido', isSinDvr=u.sinDvr;
              const badgeClass=isSinDvr?'vsb-badge-barrido':isBarrido?'vsb-badge-barrido':isDone?'vsb-badge-done':u.reportePendiente?'vsb-badge-barrido':'vsb-badge-pending';
              const badgeTxt=isSinDvr?'📵 Sin DVR':isBarrido?'📡 Barrido':isDone?'✓ Listo':u.reportePendiente?('⚠ '+( u.reportePendiente.folio||'Pendiente')):'• Pendiente';
              const itemClass=['vsb-item',i===state.currentIdx?'vsb-item-active':'',isBarrido?'vsb-item-barrido':isDone?'vsb-item-done':''].filter(Boolean).join(' ');
              return `<div class="${itemClass}" onclick="BULK.goToUnit(${i})" id="vsb-item-${i}">
                <span class="vsb-item-num">${i+1}</span>
                <span class="vsb-item-unidad">${u.numero}</span>
                <span class="vsb-item-badge ${badgeClass}">${badgeTxt}</span>
              </div>`;
            }).join('')}
          </div>
          <div style="margin-top:10px;padding:8px 10px;background:rgba(79,142,247,.06);border:1px solid rgba(79,142,247,.15);border-radius:8px;font-size:10px;color:var(--text2)">
            <div style="font-weight:700;color:#4f8ef7;margin-bottom:4px">📋 Técnico que Reporta</div>
            <div>📍 ${state.dondeReporta||'—'}</div>
            <div>👤 ${state.tecnicoQueReporta||'—'}</div>
            ${state.proveedorFuente?`<div>🔧 ${state.proveedorFuente}</div>`:''}
          </div>
        </div>

        <!-- MAIN -->
        <div class="validacion-main">
          <!-- Banner -->
          <div class="validacion-unit-banner card">
            <div class="vub-left">
              <div class="vub-label">Unidad actual</div>
              <div class="vub-unidad">${current.numero}</div>
              ${current.sinDvr&&current.flotaData?.sin_dvr?`<div style="font-size:10px;color:#6b7280;margin-top:2px">📵 Sin DVR registrado en asignación</div>`:autoCromatica?`<div style="font-size:10px;color:var(--accent);margin-top:2px">🎨 ${autoCromatica}${autoServicio?' · '+autoServicio:''}</div>`:''}
            </div>
            <div class="vub-nav">
              <button class="btn btn-ghost btn-sm vub-nav-btn" onclick="BULK.prevUnit()" ${state.currentIdx===0?'disabled':''}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg></button>
              <span class="vub-progress">${state.currentIdx+1} / ${total}</span>
              <button class="btn btn-ghost btn-sm vub-nav-btn" onclick="BULK.nextUnit()" ${state.currentIdx>=total-1?'disabled':''}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg></button>
            </div>
            <div class="vub-counters">
              <div class="vub-counter vub-total"><div class="vub-cval">${total}</div><div class="vub-clbl">Total unidades</div></div>
              <div class="vub-counter vub-captured"><div class="vub-cval">${doneCount}</div><div class="vub-clbl">Capturadas</div></div>
              <div class="vub-counter vub-pending" style="display:flex;align-items:center;gap:8px">
                <div><div class="vub-cval" style="color:var(--red)">${pendCount}</div><div class="vub-clbl">Pendientes</div></div>
                ${pendCount===0?'':`<button class="btn btn-primary btn-sm" onclick="BULK.enviarAlSistema()" style="white-space:nowrap"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Enviar al Sistema</button>`}
              </div>
            </div>
          </div>

          <!-- Aviso reporte pendiente -->
          ${tienePendiente?`
          <div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.25);border-radius:10px;padding:12px 16px;margin-bottom:10px;display:flex;align-items:flex-start;gap:10px">
            <span style="font-size:18px">⚠️</span>
            <div style="flex:1">
              <div style="font-size:12px;font-weight:700;color:#f59e0b;margin-bottom:4px">Esta unidad ya tiene un reporte pendiente</div>
              <div style="font-size:11px;color:var(--text2)">Folio: <strong>${tienePendiente.folio||'—'}</strong> · Base: ${tienePendiente.base||'—'} · ${tienePendiente.servicio||''}</div>
              <div style="font-size:11px;color:var(--text3);margin-top:2px">${tienePendiente.descripcion||''}</div>
              <div style="display:flex;gap:8px;margin-top:8px">
                <button class="btn btn-ghost btn-sm" onclick="BULK.editarReportePendiente()">✏️ Editar reporte existente</button>
                <button class="btn btn-ghost btn-sm" onclick="BULK.ignorarPendienteYContinuar()">Crear nuevo de todas formas →</button>
              </div>
            </div>
          </div>`:''}

          <!-- FORMULARIO -->
          <div class="card">
            <div class="form-grid">
              <!-- DONDE REPORTA -->
              <div class="form-group">
                <label class="required" for="bulkBase">Donde Reporta</label>
                <div class="select-wrap">
                  <select id="bulkBase" onchange="BULK.onBaseChange()">
                    <option value="">— Seleccionar —</option>
                    ${sel.map(b=>`<option value="${b}"${autoBase===b?' selected':''}>${b}</option>`).join('')}
                  </select>
                </div>
              </div>
              <!-- TIPO DE SERVICIO (auto desde cromática) -->
              <div class="form-group">
                <label class="required">Tipo de Servicio</label>
                ${(()=>{
                    if (fd && autoServicio) {
                      // Datos completos de flota: mostrar servicio como badge fijo
                      return `<div style="background:rgba(79,142,247,.08);border:1px solid rgba(79,142,247,.2);border-radius:8px;padding:8px 12px;font-size:12px;font-weight:600;color:var(--accent)">${autoServicio}</div>
                        <input type="hidden" id="bulkServicio" value="${autoServicio}">
                        <div style="font-size:10px;color:var(--text3);margin-top:3px">🎨 Cromática: ${autoCromatica} · Detectado de asignación</div>`;
                    } else if (fd && autoCromatica) {
                      // Hay flota pero sin servicio: mostrar cromática como info y dejar select editable
                      return `<div class="select-wrap"><select id="bulkServicio">
                        <option value="">— Seleccionar —</option>
                        ${selSvc.map(s=>`<option>${s}</option>`).join('')}
                      </select></div>
                      <div style="font-size:10px;color:var(--accent);margin-top:3px">🎨 Cromática en asignación: ${autoCromatica}</div>`;
                    } else {
                      // Sin datos de flota: select libre
                      return `<div class="select-wrap"><select id="bulkServicio">
                        <option value="">— Seleccionar —</option>
                        ${selSvc.map(s=>`<option>${s}</option>`).join('')}
                      </select></div>
                      <div style="font-size:10px;color:var(--text3);margin-top:3px">⚠ Unidad no encontrada en asignación ${emp}</div>`;
                    }
                  })()}
              </div>
              <!-- PROVEEDOR (vista desde pantalla 1) -->
              <div class="form-group">
                <label>De Donde Surge la Falla</label>
                <div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:8px 12px;font-size:12px;color:var(--text2)">${state.proveedorFuente||'— No especificado —'}</div>
                <input type="hidden" id="bulkProveedor" value="${state.proveedorFuente||''}">
              </div>
              <!-- TÉCNICO QUE REPORTA (vista) -->
              <div class="form-group">
                <label>Técnico que Reporta</label>
                <div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:8px 12px;font-size:12px;color:var(--text2)">${state.tecnicoQueReporta||'— No especificado —'}</div>
                <input type="hidden" id="bulkTecnico" value="${state.tecnicoQueReporta||''}">
              </div>
              <!-- TÉCNICO ADICIONAL -->
              <div class="form-group">
                <label for="bulkTecnicoAdicional">Técnico Adicional <span style="color:var(--text3);font-size:10px">(opcional)</span></label>
                <div class="select-wrap">
                  <select id="bulkTecnicoAdicional" onchange="BULK.onTecnicoAdicionalChange()">
                    <option value="">— Ninguno —</option>
                    ${(DATA.getTecnicosPorBase(DATA.state.currentEmpresa,autoBase)||[]).map(t=>`<option value="${t.nombre}">${t.nombre}${t.base?' ('+t.base+')':''}</option>`).join('')}
                    <option value="__otro__">Otro (escribir manualmente)</option>
                  </select>
                </div>
                <input type="text" id="bulkTecnicoAdicionalOtro" placeholder="Nombre del técnico adicional"
                  style="display:none;margin-top:6px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text1);font-size:12px;padding:8px 12px;width:100%;font-family:inherit"/>
              </div>
              <!-- FECHA Y HORA -->
              <div class="form-group">
                <label class="required" for="bulkFecha">Fecha y Hora</label>
                <input type="datetime-local" id="bulkFecha" value="${state.procesarTs||UI.nowISO()}">
              </div>
              <!-- PRIORIDAD -->
              <div class="form-group">
                <label>Prioridad</label>
                <div class="chip-row" id="bulkPrioChips">
                  ${['Alta','Media','Baja'].map(p=>`<div class="chip${p==='Media'?' active':''}" onclick="BULK.selPrio('${p}',this)" style="--chip-r:${p==='Alta'?'239':p==='Media'?'245':'34'};--chip-g:${p==='Alta'?'68':p==='Media'?'158':'197'};--chip-b:${p==='Alta'?'68':p==='Media'?'11':'94'}">${p}</div>`).join('')}
                </div>
              </div>
              <!-- PISO -->
              <div class="form-group">
                <label>Piso</label>
                <div class="chip-row" id="bulkPisoChips">
                  ${(DATA.getSel('piso')||[]).map(p=>{
                    const isAuto=autoPisos&&autoPisos.toUpperCase().includes(p.toUpperCase());
                    return `<div class="chip${isAuto?' active':''}" onclick="BULK.selChip('piso','${p}',this)">${p}</div>`;
                  }).join('')}
                </div>
                ${autoPisos?`<div style="font-size:10px;color:var(--text3);margin-top:3px">Detectado en asignación: ${autoPisos}</div>`:''}
              </div>
              <!-- TIPO (auto por estado) -->
              <div class="form-group">
                <label>Tipo</label>
                <div class="chip-row" id="bulkTipoChips">
                  <div class="chip" id="bulkTipoPreventivo" onclick="BULK.selChip('tipo','Preventivo',this)">Preventivo</div>
                  <div class="chip" id="bulkTipoCorrectivo" onclick="BULK.selChip('tipo','Correctivo',this)">Correctivo</div>
                </div>
              </div>
              <!-- ESTADO -->
              <div class="form-group">
                <label>Estado <span style="color:var(--text3);font-size:10px">(obligatorio si Con Falla)</span></label>
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                  <div class="bulk-estado-btn bulk-estado-falla" id="bulkEstadoFalla" onclick="BULK.selEstado('falla')"><div class="bulk-estado-dot" style="background:var(--red)"></div>Con falla</div>
                  <div class="bulk-estado-btn bulk-estado-sinfalla" id="bulkEstadoSinFalla" onclick="BULK.selEstado('sinfalla')"><div class="bulk-estado-dot" style="background:var(--green)"></div>Sin falla</div>
                  <div class="bulk-estado-btn" id="bulkEstadoBarrido" onclick="BULK.selEstado('barrido')" style="border:1px solid var(--border);border-radius:8px;padding:8px 16px;cursor:pointer;display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--text2);background:var(--bg3)"><div class="bulk-estado-dot" style="background:#4f8ef7"></div>Barrido</div>
                  <div class="bulk-estado-btn" id="bulkEstadoSinDvr" onclick="BULK.selEstado('sindvr')" style="border:1px solid var(--border);border-radius:8px;padding:8px 16px;cursor:pointer;display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--text2);background:var(--bg3)"><div class="bulk-estado-dot" style="background:#6b7280"></div>Sin DVR</div>
                </div>
              </div>
            </div>

            <!-- ÚLTIMA ACTUALIZACIÓN -->
            <div id="bulkUltActSection" style="margin-top:10px;padding:10px 14px;background:rgba(79,142,247,.05);border:1px solid rgba(79,142,247,.15);border-radius:10px;display:none">
              <div style="display:flex;align-items:center;justify-content:space-between">
                <span style="font-size:12px;font-weight:600;color:#4f8ef7">⏱️ Última actualización</span>
                <button id="bulkUltActBtn" onclick="BULK.toggleUltAct()" style="background:rgba(79,142,247,.15);border:1px solid rgba(79,142,247,.3);border-radius:6px;color:#4f8ef7;font-size:11px;font-weight:600;padding:4px 10px;cursor:pointer;font-family:inherit">+ Agregar fecha</button>
              </div>
              <div id="bulkUltActWrap" style="display:none;margin-top:8px">
                <label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Fecha de última transmisión</label>
                <input type="datetime-local" id="bulkUltActFecha" style="background:var(--bg2);border:1px solid rgba(79,142,247,.3);border-radius:8px;color:var(--text1);font-size:12px;padding:7px 10px;width:100%;max-width:280px;font-family:inherit"/>
                <div style="font-size:10px;color:var(--text3);margin-top:4px">Sin fecha = unidad en línea</div>
              </div>
            </div>

            <!-- FALLA TÉCNICA -->
            <div id="bulkFallaSection" style="margin-top:14px;display:none">
              <div class="card-hdr" style="margin-bottom:10px">
                <div class="card-icon card-icon-amber"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
                <span class="card-title">Falla Técnica</span>
              </div>
              <div class="form-grid">
                <div class="form-group">
                  <label class="required" for="bulkCategoria">Categoría</label>
                  <div class="select-wrap"><select id="bulkCategoria" onchange="BULK.onCategoriaChange()"><option value="">— Seleccionar —</option>${selCat.map(c=>`<option>${c}</option>`).join('')}</select></div>
                </div>
                <div class="form-group">
                  <label for="bulkComponente">Componente</label>
                  <div class="select-wrap"><select id="bulkComponente"><option value="">— Seleccionar categoría —</option></select></div>
                </div>
                <div class="form-group col-2">
                  <label for="bulkDesc">Descripción de la Falla</label>
                  <textarea id="bulkDesc" placeholder="Describe el problema o trabajo a realizar..."></textarea>
                </div>
              </div>
            </div>

            <!-- SIN DVR -->
            <div id="bulkSinDvrSection" style="margin-top:14px;display:none">
              <div style="background:rgba(107,114,128,.08);border:1px solid rgba(107,114,128,.25);border-radius:10px;padding:12px 16px">
                <div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:4px">📵 Sin Equipo DVR</div>
                <div style="font-size:11px;color:var(--text3)">Esta unidad se registrará sin DVR en asignación. No se generará reporte de falla.</div>
              </div>
            </div>

            <!-- PREVENTIVO (sin falla) -->
            <div id="bulkPreventivoSection" style="margin-top:10px;display:none;padding:10px 14px;background:rgba(34,197,94,.05);border:1px solid rgba(34,197,94,.15);border-radius:10px">
              <div style="font-size:11px;font-weight:600;color:var(--green);margin-bottom:6px">✅ Preventivo — Fecha de realización</div>
              <input type="datetime-local" id="bulkPrevFecha" value="${state.procesarTs||UI.nowISO()}" style="background:var(--bg2);border:1px solid rgba(34,197,94,.3);border-radius:8px;color:var(--text1);font-size:12px;padding:7px 10px;max-width:280px;font-family:inherit"/>
              <div style="font-size:10px;color:var(--text3);margin-top:4px">Podrás asignar una falla después desde Atención Técnica</div>
            </div>

            <!-- ACCIONES -->
            <div class="validacion-actions">
              <button class="btn btn-ghost" onclick="BULK.prevUnit()" ${state.currentIdx===0?'disabled':''}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg> Anterior</button>
              <button class="btn btn-secondary" onclick="BULK.skipUnit()">Omitir →</button>
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

  function _fmtFechaCorta(iso) {
    if (!iso) return '';
    try {
      const d=new Date(iso),dd=String(d.getDate()).padStart(2,'0'),mm=String(d.getMonth()+1).padStart(2,'0'),yy=String(d.getFullYear()).slice(-2),hh=String(d.getHours()).padStart(2,'0'),mi=String(d.getMinutes()).padStart(2,'0');
      return dd+'-'+mm+'-'+yy+' / '+hh+':'+mi;
    } catch(e){ return iso; }
  }

  function _diasSinActualizar(iso) {
    if (!iso) return null;
    try { return Math.floor((new Date()-new Date(iso))/86400000); } catch(e){ return null; }
  }

  function _generarTextoBarrido() {
    const emp=DATA.state.currentEmpresa, now=new Date();
    const fecha=now.toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'2-digit'});
    const hora=now.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit',hour12:false});
    const enLinea   = state.unidades.filter(u=>u.status==='barrido'&&!u.ultimaActualizacion&&!u.sinDvr);
    const conUltAct = state.unidades.filter(u=>u.status==='barrido'&&!!u.ultimaActualizacion);
    const sinDvr    = state.unidades.filter(u=>u.sinDvr);
    const conFalla  = state.unidades.filter(u=>u.status==='done'&&u.folio);

    let txt=`📡 ESTADO DE UNIDADES ${emp}\n📅 Barrido ${fecha} / ${hora}\n`;
    if (state.tecnicoQueReporta) txt+=`👤 ${state.tecnicoQueReporta}${state.dondeReporta?' · '+state.dondeReporta:''}\n`;
    txt+='\n';
    if (enLinea.length>0)   { txt+=`✅ OPERATIVO — Cámaras / Antenas GPS-3G OK\n`; enLinea.forEach(u=>{txt+=u.numero+'\n';}); txt+='\n'; }
    if (conUltAct.length>0) { txt+=`📴 FUERA DE LÍNEA\n`; conUltAct.forEach(u=>{const d=_diasSinActualizar(u.ultimaActualizacion),f=_fmtFechaCorta(u.ultimaActualizacion);txt+=u.numero+(f?' — Últ. tx: '+f:'')+(d>0?' ('+d+'d sin tx)':'')+'\n';}); txt+='\n'; }
    if (sinDvr.length>0)    { txt+=`📵 SIN DVR\n`; sinDvr.forEach(u=>{txt+=u.numero+'\n';}); txt+='\n'; }
    if (conFalla.length>0)  { txt+=`🔴 CON FALLA\n`; conFalla.forEach(u=>{txt+=u.numero+(u.folio?' — Folio: '+u.folio:'')+(u.descripcionFalla?' — '+u.descripcionFalla:'')+'\n';}); txt+='\n'; }
    return txt.trim();
  }

  function copiarBarrido() {
    const txt=_generarTextoBarrido();
    navigator.clipboard.writeText(txt).then(()=>UI.toast('✅ Barrido copiado al portapapeles')).catch(()=>{
      const ta=document.createElement('textarea');ta.value=txt;ta.style.position='fixed';ta.style.opacity='0';
      document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);
      UI.toast('✅ Barrido copiado');
    });
  }

  function renderValidacionCompleta() {
    const total=state.unidades.length, done=getDoneCount(), barridos=state.unidades.filter(u=>u.status==='barrido').length;
    const sinDvr=state.unidades.filter(u=>u.sinDvr).length, conFalla=state.unidades.filter(u=>u.status==='done'&&u.folio).length;
    const omitidas=state.unidades.filter(u=>u.status==='pending').length, textoBarrido=_generarTextoBarrido();
    return `
    <div id="mod-validacion-done" class="module active" style="padding:20px">
      <div class="validacion-completa-wrap" style="max-width:680px;margin:0 auto">
        <div class="vc-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="20 6 9 17 4 12"/></svg></div>
        <h2 class="vc-title">¡Barrido completado!</h2>
        <div class="vc-stats" style="margin-bottom:20px">
          <div class="vc-stat"><div class="vc-stat-val" style="color:#4f8ef7">${barridos}</div><div class="vc-stat-lbl">En línea</div></div>
          <div class="vc-stat"><div class="vc-stat-val" style="color:var(--red)">${conFalla}</div><div class="vc-stat-lbl">Con falla</div></div>
          <div class="vc-stat"><div class="vc-stat-val" style="color:var(--green)">${done-conFalla}</div><div class="vc-stat-lbl">Sin falla</div></div>
          <div class="vc-stat"><div class="vc-stat-val" style="color:#6b7280">${sinDvr}</div><div class="vc-stat-lbl">Sin DVR</div></div>
          <div class="vc-stat"><div class="vc-stat-val" style="color:var(--text3)">${omitidas}</div><div class="vc-stat-lbl">Omitidas</div></div>
        </div>
        <div style="background:#0d1117;border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;text-align:left">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <span style="font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.05em">Resumen para compartir</span>
            <button class="btn btn-primary btn-sm" onclick="BULK.copiarBarrido()" style="gap:6px;display:flex;align-items:center"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copiar</button>
          </div>
          <pre id="barridoTexto" style="font-family:var(--mono);font-size:12px;color:var(--text1);white-space:pre-wrap;margin:0;line-height:1.6">${textoBarrido.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>
        </div>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <button class="btn btn-ghost" onclick="APP.showModule('atencion')">Ver Atención Técnica</button>
          <button class="btn btn-primary" onclick="APP.showModule('registro')">Nuevo Registro</button>
        </div>
      </div>
    </div>`;
  }

  function onInputChange() {
    const raw=document.getElementById('bulkInput')?.value||'', units=parseUnidades(raw), count=units.length;
    state._lastInput = raw; // preservar para restauración
    const rawParts=raw.replace(/,/g,' ').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim().split(' ').map(s=>s.trim()).filter(s=>s.length>0);
    const dups=rawParts.length-count;
    const fallas=DATA.state.fallas||[], emp=DATA.state.currentEmpresa;

    // Detectar con reporte pendiente
    const conPendiente=fallas.filter(f=>f.empresa===emp&&units.includes(f.unidad)&&/pendiente/i.test(f.estatus||''));
    const existingCount=new Set(conPendiente.map(f=>f.unidad)).size;

    // Detectar sin DVR desde caché local de flota (disponible si ya se visitó Carga Asignación o se procesó lista antes)
    const cache=window._flotaConcentradoCache||[];
    const sinDvrUnits=units.filter(u=>{
      const fd=cache.find(r=>String(r.num_economico).trim()===String(u).trim()&&r.empresa_id===emp);
      return fd?.sin_dvr===true;
    });

    const detectedEl=document.getElementById('bulkDetectedCount');
    if(detectedEl){detectedEl.textContent=`${count} unidades detectadas`;detectedEl.style.color=count>0?'var(--green)':'var(--text3)';}
    const btn=document.getElementById('bulkProcesarBtn');if(btn)btn.disabled=count===0;
    const bT=document.getElementById('bscTotal'),bD=document.getElementById('bscDups'),bE=document.getElementById('bscExisting'),bN=document.getElementById('bscNew');
    if(bT)bT.textContent=count;if(bD)bD.textContent=dups;if(bE)bE.textContent=existingCount;if(bN)bN.textContent=Math.max(0,count-existingCount);

    const infoBox=document.getElementById('bulkSummaryInfo'),infoText=document.getElementById('bulkSummaryInfoText');
    if(infoBox&&infoText&&count>0){
      infoBox.style.display='flex';
      let msg='';
      if(existingCount>0) msg+=`⚠ ${existingCount} unidad(es) con reporte pendiente. `;
      if(sinDvrUnits.length>0) msg+=`📵 ${sinDvrUnits.length} sin DVR: ${sinDvrUnits.join(', ')}. `;
      if(!msg) msg=Math.max(0,count-existingCount)>0?`Se crearán ${Math.max(0,count-existingCount)} registros.`:'Todas ya registradas.';
      infoText.textContent=msg;
    }else if(infoBox){infoBox.style.display='none';}

    // Panel de alertas: pendientes + sin DVR
    const pendWrap=document.getElementById('bulkPendientesWrap');
    const hayAlgo=conPendiente.length>0||sinDvrUnits.length>0;
    if(pendWrap&&hayAlgo){
      pendWrap.style.display='';
      let html='';
      if(conPendiente.length>0){
        html+=`<div style="font-size:11px;font-weight:700;color:#f59e0b;margin-bottom:4px">⚠ Con reporte pendiente:</div>`;
        html+=conPendiente.map(f=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 10px;background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.15);border-radius:6px;margin-bottom:3px;font-size:11px"><span style="font-weight:700">${f.unidad}</span><span style="color:var(--text2)">${f.base||''} · ${f.servicio||''}</span><span style="color:#f59e0b;font-family:var(--mono)">${f.folio||''}</span></div>`).join('');
      }
      if(sinDvrUnits.length>0){
        if(html) html+='<div style="margin-top:6px"></div>';
        html+=`<div style="font-size:11px;font-weight:700;color:#9ca3af;margin-bottom:4px">📵 Sin DVR registrado en asignación:</div>`;
        html+=sinDvrUnits.map(u=>`<div style="display:flex;align-items:center;gap:8px;padding:5px 10px;background:rgba(107,114,128,.08);border:1px solid rgba(107,114,128,.2);border-radius:6px;margin-bottom:3px;font-size:11px"><span style="font-weight:700;font-family:var(--mono)">${u}</span><span style="color:#9ca3af">Sin equipo DVR</span></div>`).join('');
      }
      pendWrap.innerHTML=html;
    }else if(pendWrap){pendWrap.style.display='none';}
  }

  async function procesarLista() {
    const raw=document.getElementById('bulkInput')?.value||'', units=parseUnidades(raw);
    if(units.length===0){UI.toast('Ingresa al menos una unidad','err');return;}
    const base=document.getElementById('bulkDondeReporta')?.value||'';
    if(!base){UI.toast('Selecciona Donde Reporta antes de continuar','warn');return;}
    state.dondeReporta     =base;
    state.tecnicoQueReporta=_getTecnicoReportaValue();
    state.proveedorFuente  =document.getElementById('bulkProveedorFuente')?.value||'';
    state.procesarTs       =UI.nowISO();
    const fallas=DATA.state.fallas||[], emp=DATA.state.currentEmpresa;

    // Deshabilitar botón mientras consulta
    const btn=document.getElementById('bulkProcesarBtn');
    if(btn){btn.disabled=true;btn.textContent='Buscando en asignación...';}

    // Pre-fetch datos de flota para autocompletar cromática/servicio/base/pisos
    const flotaMap = await _prefetchFlotaData(units);

    state.unidades=units.map(u=>{
      const fd=flotaMap[u]||_getFlotaData(u)||null;
      const pendiente=fallas.find(f=>f.empresa===emp&&f.unidad===u&&/pendiente/i.test(f.estatus||''))||null;
      const yaSinDvr=fd?.sin_dvr===true;
      return {
        id:DATA.uid(), numero:u,
        // Si ya está marcada sin DVR en asignación, arrancar como barrido/sinDvr
        status: yaSinDvr ? 'barrido' : 'pending',
        sinDvr: yaSinDvr,
        reportePendiente: pendiente,
        flotaData: fd,
      };
    });
    state.currentIdx=0; state.chipState={piso:'',tipo:''}; state.prioSel='Media'; state.active=true;
    renderCurrentValidacion();
  }

  // Versión safe de render para restauración — retorna HTML o null si falla
  function renderValidacionDirect() {
    try {
      // Asegurar que tenemos unidades válidas
      if (!state.unidades || state.unidades.length === 0) return null;
      // Encontrar una unidad pendiente válida
      const pendingIdx = state.unidades.findIndex(u => u.status === 'pending' && !u.sinDvr);
      if (pendingIdx !== -1) state.currentIdx = pendingIdx;
      const html = renderValidacion();
      return html || null;
    } catch(e) {
      console.error('[BULK renderValidacionDirect]', e);
      return null;
    }
  }

  // Post-render: resetear campos y scroll (corre después del paint)
  function postRenderValidacion() {
    try { resetFormFields(); } catch(e) {}
    try { scrollSidebarToActive(); } catch(e) {}
  }

  function renderCurrentValidacion() {
    try {
      let idx=state.currentIdx;
      const cur=state.unidades[idx];
      if(cur&&(cur.status==='done'||cur.status==='barrido'||cur.sinDvr)){
        const next=state.unidades.findIndex((u,i)=>i>=idx&&u.status==='pending'&&!u.sinDvr);
        if(next!==-1){state.currentIdx=next;idx=next;}
        else{
          const any=state.unidades.findIndex(u=>u.status==='pending'&&!u.sinDvr);
          if(any!==-1){state.currentIdx=any;idx=any;}
          else{const m=document.getElementById('mainContent');if(m)m.innerHTML=renderValidacionCompleta();UI.updateHeaderCounts();return;}
        }
      }
      const main=document.getElementById('mainContent');
      if(!main){console.error('[BULK] mainContent not found');return;}
      const html=renderValidacion();
      if(!html){console.error('[BULK] renderValidacion returned empty');return;}
      main.innerHTML=html;
      // resetFormFields necesita que el DOM esté pintado
      requestAnimationFrame(()=>{
        try{resetFormFields();}catch(e){console.warn('[BULK] resetFormFields error:',e);}
        scrollSidebarToActive();
      });
    } catch(e) {
      console.error('[BULK] renderCurrentValidacion error:', e);
      // Fallback: mostrar estado de recuperación
      const main=document.getElementById('mainContent');
      if(main) main.innerHTML=renderValidacion();
    }
  }

  function resetFormFields() {
    ['bulkCategoria','bulkComponente'].forEach(id=>{const el=document.getElementById(id);if(el)el.selectedIndex=0;});
    const rc=document.getElementById('bulkComponente');if(rc)rc.innerHTML='<option value="">— Seleccionar categoría —</option>';
    const fd=document.getElementById('bulkFecha');if(fd)fd.value=state.procesarTs||UI.nowISO();
    const bd=document.getElementById('bulkDesc');if(bd)bd.value='';
    state.chipState={piso:'',tipo:''}; state.prioSel='Media';
    document.querySelectorAll('.chip-row .chip').forEach(c=>c.classList.remove('active'));
    document.querySelectorAll('#bulkPrioChips .chip').forEach(c=>{if(c.textContent.trim()==='Media')c.classList.add('active');});
    const baseEl=document.getElementById('bulkBase');
    if(baseEl&&state.dondeReporta){const opt=[...baseEl.options].find(o=>o.value===state.dondeReporta);if(opt)opt.selected=true;}
    resetEstado();
  }

  function resetEstado() {
    ['bulkEstadoFalla','bulkEstadoSinFalla','bulkEstadoBarrido','bulkEstadoSinDvr'].forEach(id=>{
      const b=document.getElementById(id);if(b){b.classList.remove('active');b.style.borderColor='';b.style.color='';}
    });
    ['bulkUltActSection','bulkFallaSection','bulkPreventivoSection','bulkSinDvrSection'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none';});
    const wrap=document.getElementById('bulkUltActWrap'),btn=document.getElementById('bulkUltActBtn'),inp=document.getElementById('bulkUltActFecha');
    if(wrap)wrap.style.display='none'; if(btn)btn.textContent='+ Agregar fecha'; if(inp)inp.value='';
    state.chipState.estado='';
  }

  function selEstado(tipo) {
    ['bulkEstadoFalla','bulkEstadoSinFalla','bulkEstadoBarrido','bulkEstadoSinDvr'].forEach(id=>{
      const b=document.getElementById(id);if(b){b.classList.remove('active');b.style.borderColor='';b.style.color='';}
    });
    const fs=document.getElementById('bulkFallaSection'), ua=document.getElementById('bulkUltActSection');
    const ps=document.getElementById('bulkPreventivoSection'), ds=document.getElementById('bulkSinDvrSection');
    if(tipo==='falla'){
      const b=document.getElementById('bulkEstadoFalla');if(b)b.classList.add('active');
      if(fs)fs.style.display=''; if(ua)ua.style.display=''; if(ps)ps.style.display='none'; if(ds)ds.style.display='none';
      _autoSelTipo('Correctivo');
    }else if(tipo==='barrido'){
      const b=document.getElementById('bulkEstadoBarrido');if(b){b.classList.add('active');b.style.borderColor='#4f8ef7';b.style.color='#4f8ef7';}
      if(fs)fs.style.display='none'; if(ua)ua.style.display=''; if(ps)ps.style.display='none'; if(ds)ds.style.display='none';
    }else if(tipo==='sindvr'){
      const b=document.getElementById('bulkEstadoSinDvr');if(b){b.classList.add('active');b.style.borderColor='#6b7280';b.style.color='#9ca3af';}
      if(fs)fs.style.display='none'; if(ua)ua.style.display='none'; if(ps)ps.style.display='none'; if(ds)ds.style.display='';
    }else{
      const b=document.getElementById('bulkEstadoSinFalla');if(b)b.classList.add('active');
      if(fs)fs.style.display='none'; if(ua)ua.style.display=''; if(ps)ps.style.display=''; if(ds)ds.style.display='none';
      _autoSelTipo('Preventivo');
    }
    state.chipState.estado=tipo;
  }

  function _autoSelTipo(tipo) {
    state.chipState.tipo=tipo;
    document.querySelectorAll('#bulkTipoChips .chip').forEach(c=>c.classList.toggle('active',c.textContent.trim()===tipo));
  }

  function toggleUltAct() {
    const wrap=document.getElementById('bulkUltActWrap'),btn=document.getElementById('bulkUltActBtn'),inp=document.getElementById('bulkUltActFecha');
    if(!wrap)return;
    const visible=wrap.style.display!=='none';
    wrap.style.display=visible?'none':'';
    if(btn)btn.textContent=visible?'+ Agregar fecha':'✕ Quitar fecha';
    if(!visible&&inp&&!inp.value){const d=new Date();d.setDate(d.getDate()-1);inp.value=d.toISOString().slice(0,16);}
    if(visible&&inp)inp.value='';
  }

  function selChip(key,val,el){state.chipState[key]=val;const row=el.closest('.chip-row');if(row)row.querySelectorAll('.chip').forEach(c=>c.classList.toggle('active',c===el));}
  function selPrio(val,el){state.prioSel=val;document.querySelectorAll('#bulkPrioChips .chip').forEach(c=>c.classList.toggle('active',c.textContent.trim()===val));}
  function onCategoriaChange(){const cat=document.getElementById('bulkCategoria'),comp=document.getElementById('bulkComponente');if(!cat||!comp)return;const opts=DATA.getComponentes(cat.value);comp.innerHTML='<option value="">— Seleccionar —</option>'+opts.map(o=>`<option>${o}</option>`).join('');}
  function scrollSidebarToActive(){setTimeout(()=>{const a=document.getElementById(`vsb-item-${state.currentIdx}`);if(a)a.scrollIntoView({behavior:'smooth',block:'nearest'});},50);}

  function goToUnit(idx){
    const u=state.unidades[idx];
    const isFinished=u&&(u.status==='done'||u.status==='barrido'||u.sinDvr);
    if(isFinished&&idx!==state.currentIdx){
      if(state._editConfirmIdx===idx){
        state._editConfirmIdx=null; state.currentIdx=idx;
        if(!u.sinDvr){u.status='pending';} renderCurrentValidacion(); UI.toast(`✏️ Editando unidad ${u.numero}`);
      }else{
        state._editConfirmIdx=idx;
        document.querySelectorAll('.vsb-item').forEach((el,i)=>el.classList.toggle('vsb-item-active',i===idx));
        UI.toast(`Toca de nuevo para editar ${u.numero}`);
      }
    }else{state._editConfirmIdx=null;state.currentIdx=idx;renderCurrentValidacion();}
  }

  function prevUnit(){if(state.currentIdx>0){state.currentIdx--;renderCurrentValidacion();}}
  function nextUnit(){if(state.currentIdx<state.unidades.length-1){state.currentIdx++;renderCurrentValidacion();}}
  function skipUnit(){
    const next=state.unidades.findIndex((u,i)=>i>state.currentIdx&&u.status==='pending'&&!u.sinDvr);
    if(next!==-1)state.currentIdx=next;
    else{const from=state.unidades.findIndex((u,i)=>i!==state.currentIdx&&u.status==='pending'&&!u.sinDvr);if(from!==-1)state.currentIdx=from;}
    renderCurrentValidacion();
  }
  function refreshList(){renderCurrentValidacion();}

  function editarReportePendiente(){
    const current=getCurrentUnidad();if(!current?.reportePendiente)return;
    const reporteId=current.reportePendiente.id;
    APP.showModule('atencion');
    setTimeout(()=>{if(typeof MODS!=='undefined'&&MODS.selAtencion)MODS.selAtencion(reporteId);},150);
  }
  function ignorarPendienteYContinuar(){const current=getCurrentUnidad();if(current)current.reportePendiente=null;renderCurrentValidacion();}

  function onTecnicoAdicionalChange(){
    const sel=document.getElementById('bulkTecnicoAdicional'),inp=document.getElementById('bulkTecnicoAdicionalOtro');
    if(!sel||!inp)return; inp.style.display=sel.value==='__otro__'?'':'none';
  }

  function _getTecnicoAdicionalValue(){
    const sel=document.getElementById('bulkTecnicoAdicional'),inp=document.getElementById('bulkTecnicoAdicionalOtro');
    if(!sel)return''; if(sel.value==='__otro__')return inp?inp.value.trim():''; return sel.value===''?'':sel.value;
  }

  function onBaseChange(){
    const base=document.getElementById('bulkBase')?.value||'';
    const tecAd=document.getElementById('bulkTecnicoAdicional');if(!tecAd)return;
    const tecnicos=DATA.getTecnicosPorBase(DATA.state.currentEmpresa,base);
    let opts='<option value="">— Ninguno —</option>';
    opts+=tecnicos.map(t=>`<option value="${t.nombre}">${t.nombre}${t.base?' ('+t.base+')':''}</option>`).join('');
    opts+='<option value="__otro__">Otro (escribir manualmente)</option>';
    tecAd.innerHTML=opts;
  }

  async function enviarAlSistema() {
    const current=getCurrentUnidad();if(!current)return;
    const estado=state.chipState.estado;

    if(estado==='sindvr'){
      state.unidades[state.currentIdx].sinDvr=true; state.unidades[state.currentIdx].status='barrido';
      // Guardar sin_dvr=true en flota_asignacion via REST
      _updateFlotaSinDvr(current.numero, true).catch(e=>console.warn('[BULK sinDvr update]',e));
      UI.toast(`📵 Unidad ${current.numero} — Sin DVR registrado`);
      UI.updateHeaderCounts(); _avanzarSiguientePendiente(); return;
    }

    if(estado==='barrido'){
      // Si tiene reporte pendiente existente, advertir antes de marcar en línea
      if(current.reportePendiente && !current._confirmadoBarrido){
        current._confirmadoBarrido=true;
        UI.toast(`⚠ ${current.numero} tiene reporte pendiente (${current.reportePendiente.folio||''}). Presiona Barrido de nuevo si confirmas que está en línea.`,'warn');
        return;
      }
      current._confirmadoBarrido=false;
      state.unidades[state.currentIdx].status='barrido'; state.unidades[state.currentIdx].enLinea=true;
      const ultActFechaEl=document.getElementById('bulkUltActFecha'),ultActWrap=document.getElementById('bulkUltActWrap');
      const ultActVal=(ultActWrap&&ultActWrap.style.display!=='none'&&ultActFechaEl?.value)?ultActFechaEl.value:null;
      state.unidades[state.currentIdx].ultimaActualizacion=ultActVal||null;
      UI.toast(ultActVal?`📴 Unidad ${current.numero} — fuera de línea`:`📶 Unidad ${current.numero} — en línea`);
      UI.updateHeaderCounts(); _avanzarSiguientePendiente(); return;
    }

    const base=document.getElementById('bulkBase')?.value;
    const svcHidden=document.querySelector('input[type=hidden]#bulkServicio');
    const svc=(svcHidden?svcHidden.value:null)||document.getElementById('bulkServicio')?.value||'';
    const fecha=document.getElementById('bulkFecha')?.value;
    const errors=[];
    if(!base)errors.push('Donde Reporta');if(!svc)errors.push('Tipo de Servicio');if(!fecha)errors.push('Fecha y Hora');
    const hasFalla=estado==='falla', cat=document.getElementById('bulkCategoria')?.value||'';
    if(hasFalla&&!cat)errors.push('Categoría (requerida con falla)');
    if(errors.length){UI.toast('Campos requeridos: '+errors.join(', '),'err');return;}

    const session=AUTH.checkSession(), tecAdicional=_getTecnicoAdicionalValue();
    const prevFechaEl=document.getElementById('bulkPrevFecha');
    const prevFecha=(!hasFalla&&prevFechaEl?.value)?prevFechaEl.value:fecha;

    let nuevo;
    try {
      nuevo=await DATA.crearReporte({
        unidad:current.numero, empresa:DATA.state.currentEmpresa, base, servicio:svc,
        fecha:prevFecha||fecha, piso:state.chipState.piso||'', tipo:state.chipState.tipo||'',
        categoria:cat, componente:document.getElementById('bulkComponente')?.value||'',
        proveedor:state.proveedorFuente||'',
        descripcion:document.getElementById('bulkDesc')?.value?.trim()||'',
        prioridad:state.prioSel||'Media', tecnico:state.tecnicoQueReporta||'',
        tecnicoUsername:session?session.username:'', tecnicoAdicional:tecAdicional||'',
        cromatica:current.flotaData?.cromatica||'',
      });
    }catch(error){UI.toast(error.message||'No se pudo crear el reporte','err');return;}

    const _ultWrap=document.getElementById('bulkUltActWrap'),_ultInp=document.getElementById('bulkUltActFecha');
    const _ultVal=(_ultWrap&&_ultWrap.style.display!=='none'&&_ultInp?.value)?_ultInp.value:null;
    state.unidades[state.currentIdx].status='done';
    state.unidades[state.currentIdx].folio=nuevo.folio;
    state.unidades[state.currentIdx].ultimaActualizacion=_ultVal||null;
    state.unidades[state.currentIdx].descripcionFalla=document.getElementById('bulkDesc')?.value?.trim()||'';

    UI.toast(`✓ Unidad ${current.numero} — Folio: ${nuevo.folio}`);
    UI.updateHeaderCounts(); _avanzarSiguientePendiente();
  }

  function _avanzarSiguientePendiente(){
    const next=state.unidades.findIndex((u,i)=>i>state.currentIdx&&u.status==='pending'&&!u.sinDvr);
    if(next!==-1){state.currentIdx=next;renderCurrentValidacion();return;}
    const any=state.unidades.findIndex(u=>u.status==='pending'&&!u.sinDvr);
    if(any!==-1){state.currentIdx=any;renderCurrentValidacion();return;}
    const main=document.getElementById('mainContent');if(main)main.innerHTML=renderValidacionCompleta();
    UI.updateHeaderCounts();
  }

  function volverALista(){state.active=false;APP.showModule('bulk');}

  // Salir completamente de carga masiva (desde pantalla 1) — limpia el estado
  function salirDeBulk(){
    state.active=false;
    state.unidades=[];
    state._lastInput='';
    state.dondeReporta='';
    state.tecnicoQueReporta='';
    state.proveedorFuente='';
    APP.showModule('registro');
  }

  return {
    renderCargaMasiva, onInputChange, procesarLista, selChip, selPrio, selEstado,
    onCategoriaChange, goToUnit, prevUnit, nextUnit, skipUnit, refreshList,
    enviarAlSistema, volverALista, copiarBarrido, toggleUltAct, state,
    onBaseChange, onDondeReportaChange, onTecnicoReportaChange, onTecnicoAdicionalChange,
    editarReportePendiente, ignorarPendienteYContinuar, _actualizarResumenTag, salirDeBulk, renderValidacionDirect, postRenderValidacion,
  };
})();
