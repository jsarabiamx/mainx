/**
 * ui.js v4 — Todos los paneles corregidos según retroalimentación del PDF
 */
const UI = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const PAGE_SIZE = 12;

  /**
   * Helper global para búsqueda multi-token en tablas.
   * Separa la consulta por espacios y devuelve true si CUALQUIER token coincide
   * en el texto concatenado (OR entre tokens). Si no hay query, siempre true.
   *
   * Ejemplo: "2280 2275" muestra ambas unidades; "LEON TAPA MTY" muestra las 3 bases.
   */
  function _multiTokenMatch(query, fieldsStr) {
    const tokens = String(query||'').toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) return true;
    const hay = String(fieldsStr||'').toLowerCase();
    return tokens.some(t => hay.includes(t));
  }

  /**
   * ════════════════════════════════════════════════════════════════
   * MULTI-SELECT DROPDOWN (chips con checkboxes)
   * ════════════════════════════════════════════════════════════════
   * Renderiza un botón que abre un panel con checkboxes. Cada vez que
   * el usuario marca/desmarca se llama onChange con el nuevo array.
   *
   * Uso:
   *   _multiSelectChipsDropdown({
   *     id: 'pf-base-ms',
   *     label: 'BASE',
   *     allLabel: 'Todas',
   *     options: ['MTY','LEON','TAPA'],
   *     selected: ['MTY','LEON'],   // array actual
   *     onChange: 'UI._onPlatFilterChange(\\'CEIBA\\')'
   *   })
   *
   * El VALOR se guarda en data-selected (JSON) del elemento root.
   * Leer con: _readMultiSelectValues(id) → array
   */
  function _multiSelectChipsDropdown(opts) {
    const { id, label, allLabel = 'Todos', options, selected = [], onChange } = opts;
    const selSet = new Set(selected);
    const count = selSet.size;
    const isAll = count === 0 || count === options.length;
    const displayText = isAll
      ? allLabel
      : (count === 1 ? esc([...selSet][0]) : `${count} seleccionados`);

    // El panel está oculto por default; toggle con click en el botón
    return `
      <div class="ms-root" id="${id}" data-selected='${JSON.stringify([...selSet])}' data-all-options='${JSON.stringify(options)}'>
        <div class="ms-trigger" onclick="UI._msToggle('${id}')">
          <span class="ms-trigger-text ${isAll?'ms-trigger-placeholder':''}">${displayText}</span>
          <span class="ms-trigger-chev">▾</span>
        </div>
        <div class="ms-panel" id="${id}-panel">
          <div class="ms-search">
            <input type="text" placeholder="Buscar…" oninput="UI._msFilterOptions('${id}', this.value)">
          </div>
          <div class="ms-actions">
            <a onclick="UI._msSelectAll('${id}', true); ${onChange}" title="Limpiar selección — equivale a 'Todos' (sin filtrar)">✕ Limpiar selección</a>
          </div>
          <div class="ms-options" id="${id}-options">
            ${options.map(o => `
              <label class="ms-option" data-val="${esc(String(o).toLowerCase())}">
                <input type="checkbox" value="${esc(o)}" ${selSet.has(o)?'checked':''}
                  onchange="UI._msOnCheck('${id}', this.value, this.checked); ${onChange}">
                <span>${esc(o)}</span>
              </label>
            `).join('')}
          </div>
        </div>
      </div>`;
  }

  function _msToggle(id) {
    // Cerrar otros paneles abiertos
    document.querySelectorAll('.ms-panel.open').forEach(p => {
      if (p.id !== id + '-panel') p.classList.remove('open');
    });
    const panel = document.getElementById(id + '-panel');
    if (panel) panel.classList.toggle('open');
  }

  function _msOnCheck(id, value, checked) {
    const root = document.getElementById(id);
    if (!root) return;
    let sel;
    try { sel = JSON.parse(root.dataset.selected || '[]'); } catch(e) { sel = []; }
    if (checked) {
      if (!sel.includes(value)) sel.push(value);
    } else {
      sel = sel.filter(v => v !== value);
    }
    root.dataset.selected = JSON.stringify(sel);
    // Actualizar el texto del trigger
    _msUpdateTriggerText(id);
  }

  function _msUpdateTriggerText(id) {
    const root = document.getElementById(id);
    if (!root) return;
    let sel = []; try { sel = JSON.parse(root.dataset.selected || '[]'); } catch(e) {}
    let allOptions = []; try { allOptions = JSON.parse(root.dataset.allOptions || '[]'); } catch(e) {}
    const count = sel.length;
    const isAll = count === 0 || count === allOptions.length;
    const trig = root.querySelector('.ms-trigger-text');
    if (!trig) return;
    if (isAll) {
      trig.textContent = root.querySelector('.ms-trigger-placeholder') ? trig.textContent : (allOptions.length && count===allOptions.length ? 'Todos' : 'Todos');
      // Heurística simple: si contiene "Todo" ya, dejarlo, sino usar 'Todos'
      if (!/todos|todas/i.test(trig.textContent)) trig.textContent = 'Todos';
      trig.classList.add('ms-trigger-placeholder');
    } else if (count === 1) {
      trig.textContent = sel[0];
      trig.classList.remove('ms-trigger-placeholder');
    } else {
      trig.textContent = count + ' seleccionados';
      trig.classList.remove('ms-trigger-placeholder');
    }
  }

  function _msSelectAll(id, all) {
    const root = document.getElementById(id);
    if (!root) return;
    // Tanto "Todos" como "Ninguno" limpian la selección:
    // - "Todos" = sin filtro (mostrar todas las unidades sin restricción)
    // - "Ninguno" = también sin filtro (filtrar a cero no tiene utilidad en UX)
    // El usuario marca manualmente los valores que quiere para filtrar.
    root.dataset.selected = JSON.stringify([]);
    root.querySelectorAll('.ms-option input[type="checkbox"]').forEach(cb => { cb.checked = false; });
    _msUpdateTriggerText(id);
  }

  function _msFilterOptions(id, query) {
    const q = String(query||'').toLowerCase().trim();
    const optsDiv = document.getElementById(id + '-options');
    if (!optsDiv) return;
    optsDiv.querySelectorAll('.ms-option').forEach(el => {
      const v = el.dataset.val || '';
      el.style.display = (!q || v.includes(q)) ? '' : 'none';
    });
  }

  /**
   * Lee los valores seleccionados de un multi-select. Retorna array.
   * Array vacío = "Todos" (sin filtro).
   */
  function _readMultiSelectValues(id) {
    const root = document.getElementById(id);
    if (!root) return [];
    try { return JSON.parse(root.dataset.selected || '[]'); } catch(e) { return []; }
  }

  // Cerrar panel al hacer click fuera
  document.addEventListener('click', (e) => {
    if (!e.target.closest || !e.target.closest('.ms-root')) {
      document.querySelectorAll('.ms-panel.open').forEach(p => p.classList.remove('open'));
    }
  });

  /* ══ PLATFORM STYLES ══════════════════════════════════ */
  const PLAT_STYLE = {
    CEIBA:   { bg:'#1a3a2a', color:'#34d399', label:'C'  },
    SAMSARA: { bg:'#3a2a1a', color:'#f59e0b', label:'S'  },
    AVL:     { bg:'#1a2a3a', color:'#60a5fa', label:'A'  },
    SCANIA:  { bg:'#3a1a1a', color:'#f87171', label:'Sc' },
    MAN:     { bg:'#2a2a3a', color:'#a78bfa', label:'M'  },
    VOLVO:   { bg:'#1a3040', color:'#06b6d4', label:'V'  },
    MOTIVE:  { bg:'#2a1a3a', color:'#c084fc', label:'Mo' },
  };
  const ALL_PLATS = ['CEIBA','SAMSARA','AVL','SCANIA','MAN','VOLVO','MOTIVE'];

  /**
   * Ordena plataformas colocando primero las que tienen datos para la unidad dada.
   */
  function platsSortedByData(u) {
    const withData = [], withoutData = [];
    ALL_PLATS.forEach(p => {
      const f = u['ultima_act_' + p.toLowerCase()];
      if (f) withData.push({ p, fecha: f });
      else   withoutData.push({ p, fecha: null });
    });
    withData.sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
    return [...withData, ...withoutData];
  }

  /**
   * ComboBox con opción "Otro" → habilita un input de texto libre.
   * Retorna el HTML del grupo; el valor final se lee con readComboValue(id).
   */
  function comboWithOther(label, id, tipoCatalogo, currentValue, required) {
    const opciones = DB.getCatalogo(tipoCatalogo);
    const matches = opciones.some(o => o.toLowerCase() === String(currentValue||'').toLowerCase());
    const isOther = currentValue && !matches;
    return `<div style="margin-bottom:11px">
      <label style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text3);display:block;margin-bottom:4px">${label}${required?' *':''}</label>
      <select id="${id}" onchange="UI._onComboChange('${id}')"
        style="width:100%;background:var(--bg-card);border:1px solid var(--border2);border-radius:7px;padding:7px 10px;color:var(--text);font-family:var(--font);font-size:12px;margin-bottom:5px">
        <option value="">— seleccionar —</option>
        ${opciones.map(o => `<option value="${esc(o)}" ${o===currentValue?'selected':''}>${esc(o)}</option>`).join('')}
        <option value="__other__" ${isOther?'selected':''}>✎ Otro (escribir nuevo)…</option>
      </select>
      <input id="${id}-other" type="text" placeholder="Escribe el nuevo valor…" value="${isOther?esc(currentValue):''}"
        data-catalogo="${tipoCatalogo}"
        style="display:${isOther?'block':'none'};width:100%;background:var(--bg-card);border:1px solid var(--border2);border-radius:7px;padding:7px 10px;color:var(--text);font-family:var(--font);font-size:12px">
    </div>`;
  }
  function _onComboChange(id) {
    const sel = $(id), inp = $(id + '-other');
    if (!sel || !inp) return;
    if (sel.value === '__other__') { inp.style.display = 'block'; inp.focus(); }
    else { inp.style.display = 'none'; inp.value = ''; }
  }
  function readComboValue(id) {
    const sel = $(id), inp = $(id + '-other');
    if (!sel) return '';
    if (sel.value === '__other__') {
      const v = (inp?.value || '').trim();
      if (v) {
        const cat = inp.dataset.catalogo;
        if (cat) DB.addCatalogo(cat, v);
      }
      return v;
    }
    return sel.value;
  }

  /**
   * renderEtiquetasUnidad — pills visibles junto al número (resumen y detalle).
   * Incluye etiquetas custom de u.etiquetas[] + etiqueta de viaje si aplica.
   */
  function renderEtiquetasUnidad(u, sizeClass) {
    if (!u) return '';
    sizeClass = sizeClass || 'sm';
    const small = sizeClass === 'sm';
    const pillStyle = small
      ? 'font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;letter-spacing:.03em;text-transform:uppercase'
      : 'font-size:11px;font-weight:700;padding:3px 9px;border-radius:5px;letter-spacing:.04em;text-transform:uppercase';

    const pills = [];

    // Etiqueta de SINIESTRO (prioridad máxima, siempre visible)
    if (u.siniestro) {
      pills.push(`<span style="${pillStyle};background:rgba(239,68,68,.14);color:#ef4444;border:1px solid rgba(239,68,68,.35)" title="${esc(u.siniestroDesc||'Siniestro')}">SINIESTRO${u.siniestroDesc?': '+esc(u.siniestroDesc):''}</span>`);
    }

    // Etiqueta de viaje activo (icono de ruta)
    const viaje = DB.getViajeActivoDe ? DB.getViajeActivoDe(u.num, u.empresa) : null;
    if (viaje) {
      const destino = viaje.destino ? '→ '+esc(viaje.destino.substring(0,18)) : '';
      pills.push(`<span style="${pillStyle};background:rgba(6,182,212,.14);color:#06b6d4;border:1px solid rgba(6,182,212,.35)" title="Viaje programado ${esc(viaje.salidaLugar||'')} → ${esc(viaje.destino||'')}">🚐 VIAJE ${destino}</span>`);
    }

    // Etiqueta de falla activa (motivo visible)
    const fallasActivas = (u.fallas || []).filter(f => !f.resuelta);
    if (fallasActivas.length > 0 && !u.siniestro) {
      const f = fallasActivas[fallasActivas.length - 1]; // más reciente
      // Cambia de color según antigüedad: verde recién creada (<1d), amarillo/naranja >1d
      const horas = (Date.now() - new Date(f.fecha).getTime()) / 3600000;
      const col = horas < 24 ? '#10b981' : '#f59e0b';
      const bg  = horas < 24 ? 'rgba(16,185,129,.14)' : 'rgba(245,158,11,.14)';
      const br  = horas < 24 ? 'rgba(16,185,129,.35)' : 'rgba(245,158,11,.35)';
      pills.push(`<span style="${pillStyle};background:${bg};color:${col};border:1px solid ${br}" title="Falla: ${esc(f.motivo)}">⚠ ${esc((f.motivo||'FALLA').substring(0,22))}</span>`);
    }

    // Etiquetas custom (AFR, ALINEACION, TALLER, etc.)
    (u.etiquetas || []).forEach(et => {
      if (et.tipo === 'SINIESTRO') return; // ya la agregamos arriba
      const col = et.color || '#a78bfa';
      const bg = col + '24';
      const br = col + '59';
      pills.push(`<span style="${pillStyle};background:${bg};color:${col};border:1px solid ${br}" title="${esc(et.detalles||et.tipo)}">${esc(et.tipo)}</span>`);
    });

    return pills.join('');
  }

  function platIcon(p, size=24) {
    const st = PLAT_STYLE[p] || { bg:'#2a2a2a', color:'#9ca3af', label:(p||'?')[0] };
    return `<div style="width:${size}px;height:${size}px;border-radius:${Math.round(size/6)}px;background:${st.bg};color:${st.color};display:inline-flex;align-items:center;justify-content:center;font-size:${Math.round(size*.42)}px;font-weight:700;flex-shrink:0" title="${p}">${st.label}</div>`;
  }

  /* ══ TOAST ════════════════════════════════════════════ */
  function toast(msg, type='info', dur=3500) {
    let el = $('toast-container');
    if (!el) { el = document.createElement('div'); el.id='toast-container'; el.style.cssText='position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;max-width:380px;pointer-events:none'; document.body.appendChild(el); }
    const colors={success:'#10b981',error:'#ef4444',info:'#3b82f6',warn:'#f59e0b'};
    const icons={success:'✓',error:'✕',info:'ℹ',warn:'⚠'};
    const t=document.createElement('div');
    t.style.cssText=`pointer-events:all;background:#1c2333;border:1px solid ${colors[type]}44;border-left:3px solid ${colors[type]};border-radius:9px;padding:10px 14px;font-size:12px;color:#e2e8f0;display:flex;align-items:flex-start;gap:8px;animation:slideIn .2s ease;box-shadow:0 4px 20px rgba(0,0,0,.4)`;
    t.innerHTML=`<span style="color:${colors[type]};font-weight:700;flex-shrink:0">${icons[type]}</span><span style="flex:1">${esc(msg)}</span><span style="cursor:pointer;color:#4a5568;margin-left:4px;pointer-events:all" onclick="this.parentElement.remove()">✕</span>`;
    el.appendChild(t); setTimeout(()=>{if(t.parentNode)t.remove();},dur);
  }

  /* ══ MODAL ════════════════════════════════════════════ */
  function openModal(html) {
    closeModal();
    const overlay=document.createElement('div');
    overlay.id='modal-overlay';
    overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:500;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(3px)';
    overlay.innerHTML=html;
    overlay.addEventListener('click',e=>{if(e.target===overlay)closeModal();});
    document.body.appendChild(overlay);
  }
  function closeModal(){const m=$('modal-overlay');if(m)m.remove();}

  /* ══════════════════════════════════════════════════════════════
     MODALES PROPIOS: _uiConfirm y _uiPrompt (sin prompt/confirm del browser)
  ══════════════════════════════════════════════════════════════ */
  function _uiConfirm({ title='¿Confirmar?', message='', icon='⚠', danger=false, okText='Confirmar', cancelText='Cancelar' }) {
    return new Promise(resolve => {
      const mid = '_uc_' + Date.now();
      openModal(`<div style="background:var(--bg-panel);border:1px solid var(--border2);border-radius:14px;padding:28px 28px 22px;width:420px;max-width:90vw;text-align:center">
        <div style="font-size:26px;margin-bottom:10px">${icon}</div>
        <div style="font-size:15px;font-weight:700;margin-bottom:10px">${title}</div>
        ${message?`<div style="font-size:13px;color:var(--text2);margin-bottom:18px;line-height:1.5">${message}</div>`:''}
        <div style="display:flex;gap:10px;justify-content:center;margin-top:6px">
          <button class="act-btn" style="min-width:90px" id="${mid}_no">${cancelText}</button>
          <button class="act-btn${danger?' act-btn-danger-soft':' act-btn-primary'}" style="min-width:90px;${danger?'background:#ef444433;border-color:#ef4444;color:#f87171':''}" id="${mid}_ok">${okText}</button>
        </div>
      </div>`);
      const bind = () => {
        const ok = document.getElementById(mid+'_ok');
        const no = document.getElementById(mid+'_no');
        if (!ok) { setTimeout(bind, 30); return; }
        ok.onclick = () => { closeModal(); resolve(true); };
        no.onclick = () => { closeModal(); resolve(false); };
        ok.focus();
      };
      bind();
    });
  }

  function _uiPrompt({ title='', message='', placeholder='', defaultValue='', icon='', okText='Guardar', cancelText='Cancelar', multiline=false }) {
    return new Promise(resolve => {
      const mid = '_up_' + Date.now();
      const iid = mid + '_inp';
      const inputHtml = multiline
        ? `<textarea id="${iid}" rows="4" placeholder="${placeholder}" style="width:100%;background:var(--bg-card);border:1px solid var(--border2);border-radius:8px;padding:10px 12px;color:var(--text);font-family:var(--font);font-size:13px;resize:vertical;box-sizing:border-box;margin-bottom:14px">${defaultValue}</textarea>`
        : `<input id="${iid}" type="text" value="${defaultValue}" placeholder="${placeholder}" style="width:100%;background:var(--bg-card);border:1px solid var(--border2);border-radius:8px;padding:10px 12px;color:var(--text);font-family:var(--font);font-size:13px;box-sizing:border-box;margin-bottom:14px">`;
      openModal(`<div style="background:var(--bg-panel);border:1px solid var(--border2);border-radius:14px;padding:26px;width:440px;max-width:90vw">
        ${icon?`<div style="font-size:24px;margin-bottom:10px;text-align:center">${icon}</div>`:''}
        ${title?`<div style="font-size:15px;font-weight:700;margin-bottom:6px">${title}</div>`:''}
        ${message?`<div style="font-size:12px;color:var(--text2);margin-bottom:12px;line-height:1.5">${message}</div>`:''}
        ${inputHtml}
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button class="act-btn" id="${mid}_no">${cancelText}</button>
          <button class="act-btn-primary" id="${mid}_ok">${okText}</button>
        </div>
      </div>`);
      const bind = () => {
        const ok = document.getElementById(mid+'_ok');
        const no = document.getElementById(mid+'_no');
        const inp = document.getElementById(iid);
        if (!ok) { setTimeout(bind, 30); return; }
        if (inp) { inp.focus(); inp.selectionStart = inp.value.length; }
        ok.onclick = () => { const v = inp ? inp.value : ''; closeModal(); resolve(v); };
        no.onclick = () => { closeModal(); resolve(null); };
        if (inp) inp.onkeydown = (e) => { if (e.key==='Enter' && !multiline) ok.onclick(); };
      };
      bind();
    });
  }


  /* ══ DATE-TIME PICKER ════════════════════════════════ */
  /**
   * Abre un modal bonito de selección de fecha y hora
   * @param {string} currentISO  valor actual ISO
   * @param {function} onConfirm  callback(isoString)
   * @param {string} label  etiqueta
   */
  function openDatePicker(currentISO, onConfirm, label='Seleccionar fecha y hora') {
    const curr = currentISO ? new Date(currentISO) : new Date();
    const localStr = isNaN(curr) ? '' : curr.toISOString().substring(0,16);
    openModal(`
      <div style="background:var(--bg-panel);border:1px solid var(--border2);border-radius:14px;padding:24px;width:340px;box-shadow:0 24px 60px rgba(0,0,0,.6)">
        <div style="font-size:14px;font-weight:600;margin-bottom:16px;display:flex;align-items:center;gap:8px">
          <span style="font-size:20px">📅</span> ${esc(label)}
        </div>
        <div style="margin-bottom:14px">
          <label style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text3);display:block;margin-bottom:6px">Fecha y hora</label>
          <input type="datetime-local" id="dt-picker-input" value="${localStr}"
            style="width:100%;background:var(--bg-card);border:1px solid var(--border2);border-radius:8px;padding:10px 12px;color:var(--text);font-family:var(--font);font-size:14px;letter-spacing:.02em">
        </div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:16px">
          <span style="font-size:10px;color:var(--text3);width:100%;margin-bottom:4px">Accesos rápidos:</span>
          ${['Hoy','Ayer','Hace 2d','Hace 7d'].map((l,i)=>{
            const d=new Date(); d.setDate(d.getDate()-[0,1,2,7][i]);
            const v=d.toISOString().substring(0,16);
            return `<button onclick="$('dt-picker-input').value='${v}'" style="font-size:11px;padding:4px 9px;border-radius:6px;background:var(--bg-card2);border:1px solid var(--border);color:var(--text2);cursor:pointer">${l}</button>`;
          }).join('')}
        </div>
        <div id="dt-err" style="color:var(--red);font-size:11px;min-height:16px;margin-bottom:8px"></div>
        <div style="display:flex;justify-content:flex-end;gap:8px">
          <button onclick="UI.closeModal()" style="padding:8px 16px;border-radius:8px;background:var(--bg-card);border:1px solid var(--border);color:var(--text2);font-family:var(--font);font-size:12px;cursor:pointer">Cancelar</button>
          <button onclick="UI._confirmDatePicker()" style="padding:8px 18px;border-radius:8px;background:var(--blue);border:none;color:#fff;font-family:var(--font);font-size:12px;font-weight:600;cursor:pointer">Confirmar</button>
        </div>
      </div>
    `);
    window.__dtPickerCb = onConfirm;
  }

  function _confirmDatePicker() {
    const val = $('dt-picker-input')?.value;
    if (!val) { if($('dt-err'))$('dt-err').textContent='Selecciona una fecha'; return; }
    const d = new Date(val);
    if (isNaN(d)) { if($('dt-err'))$('dt-err').textContent='Fecha inválida'; return; }
    closeModal();
    if (typeof window.__dtPickerCb === 'function') window.__dtPickerCb(d.toISOString());
  }

  /* ══ BADGES ═══════════════════════════════════════════ */
  function estatusBadge(est) {
    const e=String(est||'').toUpperCase();
    if(e.includes('EN OPERACI')||e.includes('ARRENDAMIENTO'))return`<span class="ebadge ebadge-op">${esc(est||'—')}</span>`;
    if(e.includes('PARA VENTA')||e.includes('A VENTA'))return`<span class="ebadge ebadge-venta">${esc(est||'—')}</span>`;
    if(e.includes('FUERA')||e.includes('RENTADO'))return`<span class="ebadge ebadge-fuera">${esc(est||'—')}</span>`;
    if(e.includes('SINIESTRO'))return`<span class="ebadge ebadge-siniestro">${esc(est||'—')}</span>`;
    if(e.includes('BAJA'))return`<span class="ebadge ebadge-baja">${esc(est||'—')}</span>`;
    return`<span class="ebadge ebadge-other">${esc(est||'—')}</span>`;
  }
  function diasBadge(d){
    if(d===null||d===undefined)return`<span class="dbadge dbadge-sin">—</span>`;
    const c=DB.getConfig();
    if(d<=c.diasLinea)return`<span class="dbadge dbadge-ok">${d}d</span>`;
    if(d<=c.diasAtencion)return`<span class="dbadge dbadge-warn">${d}d</span>`;
    return`<span class="dbadge dbadge-err">${d}d</span>`;
  }

  /* ══ PAGINATION ═══════════════════════════════════════ */
  function renderPagination(infoId, btnsId, total, page, pages, onPage) {
    const inf=$(infoId), btns=$(btnsId);
    if(!inf||!btns)return;
    const from=Math.min((page-1)*PAGE_SIZE+1,total), to=Math.min(page*PAGE_SIZE,total);
    inf.textContent=total>0?`Mostrando ${from}–${to} de ${total} unidades`:'Sin resultados';
    if(pages<=1){btns.innerHTML='';return;}
    // Guardar callback en registro global para que onclick pueda invocarlo
    if(!window._UI_PAGE_CBS) window._UI_PAGE_CBS = {};
    window._UI_PAGE_CBS[btnsId] = onPage;
    const nums=[];
    if(pages<=7){for(let i=1;i<=pages;i++)nums.push(i);}
    else{nums.push(1);if(page>3)nums.push('…');for(let i=Math.max(2,page-1);i<=Math.min(pages-1,page+1);i++)nums.push(i);if(page<pages-2)nums.push('…');nums.push(pages);}
    btns.innerHTML=
      `<button class="page-btn" ${page<=1?'disabled':''} onclick="if(window._UI_PAGE_CBS&&window._UI_PAGE_CBS['${btnsId}'])window._UI_PAGE_CBS['${btnsId}'](${page-1})">‹</button>`+
      nums.map(n=>n==='…'?`<span class="page-btn" style="cursor:default;opacity:.4">…</span>`:`<button class="page-btn ${n===page?'active':''}" onclick="if(window._UI_PAGE_CBS&&window._UI_PAGE_CBS['${btnsId}'])window._UI_PAGE_CBS['${btnsId}'](${n})">${n}</button>`).join('')+
      `<button class="page-btn" ${page>=pages?'disabled':''} onclick="if(window._UI_PAGE_CBS&&window._UI_PAGE_CBS['${btnsId}'])window._UI_PAGE_CBS['${btnsId}'](${page+1})">›</button>`;
  }

  /* ══════════════════════════════════════════════════════
     PANEL: RESUMEN
  ══════════════════════════════════════════════════════ */
  let _rf={plat:'',base:[],crom:[],est:[],dias:[],etiqueta:'',search:'',sort:'dias',page:1};

  function renderResumen() {
    const emp=DB.getEmpresaActiva();
    const st=DB.getStats(emp);

    const lastLog=DB.getHistorialGlobal(1)[0];
    if($('tb-last-update')) $('tb-last-update').textContent=
      `Empresa: ${emp} · ${lastLog?'Últ. act.: '+Parsers.fmtDate(lastLog.fecha):'Sin actualizaciones'}`;

    // Sparklines (ilustrativos, basados en totales de la empresa)
    const rnd=(b,n=8)=>Array.from({length:n},(_,i)=>Math.max(0,b+Math.round(Math.sin(i)*2+(Math.random()-.5)*3)));
    Charts.sparkline('spark-fuera',    rnd(st.fuera+st.sinDatos),'#ef4444');
    Charts.sparkline('spark-atencion', rnd(st.atencion),         '#f59e0b');
    Charts.sparkline('spark-enlinea',  rnd(st.enLinea),          '#10b981');
    Charts.bar('spark-total',null,rnd(st.activas),'#3b82f6');

    const totalAlertas=st.sinVIN+st.sinPlaca+st.sinDatos+st.siniestros;
    if($('nav-alertas-badge')) $('nav-alertas-badge').textContent=totalAlertas;

    _fillFilters(emp);
    // renderUnitList actualiza KPIs, donuts y alertas usando la lista filtrada actual
    renderUnitList();
  }

  function _fillFilters(emp) {
    const uns = DB.getUnidadesList(emp).filter(u => u.activa && !u._soloBarrido);
    // Empresa (select simple — no multi)
    const selE = $('filter-emp');
    if (selE) selE.innerHTML = DB.getEmpresasList().map(e =>
      `<option value="${e}" ${e===emp?'selected':''}>${e}</option>`).join('');

    // Helper: renderizar un _multiSelectChipsDropdown en un contenedor div
    const _renderMs = (containerId, msId, opts) => {
      const el = $(containerId);
      if (!el) return;
      el.innerHTML = _multiSelectChipsDropdown(opts);
    };

    // BASE — valores dinámicos de asignación
    const bases = [...new Set(uns.map(u => u.base).filter(Boolean))].sort();
    _renderMs('ms-rf-base', 'ms-rf-base', {
      id: 'ms-rf-base', label: 'Base', allLabel: 'Todas',
      options: bases, selected: _rf.base || [],
      onChange: 'UI._rf={...UI._rf,base:UI._msGetSelected("ms-rf-base"),page:1};UI.renderUnitList()'
    });

    // CROMÁTICA — valores dinámicos de asignación
    const croms = [...new Set(uns.map(u => u.cromatica).filter(Boolean))].sort();
    _renderMs('ms-rf-crom', 'ms-rf-crom', {
      id: 'ms-rf-crom', label: 'Cromática', allLabel: 'Todos',
      options: croms, selected: _rf.crom || [],
      onChange: 'UI._rf={...UI._rf,crom:UI._msGetSelected("ms-rf-crom"),page:1};UI.renderUnitList()'
    });

    // ESTADO — usar estatus normalizado directo (no la categoría genérica)
    // Así aparecen: Enrolado, Desenrolado, Revisar, En operación, Para venta, etc.
    const estOpciones = [...new Set(uns.map(u => {
      return Parsers.normalizarEstatus(u.estatus) || u.estatus || '';
    }).filter(Boolean))].sort();
    _renderMs('ms-rf-est', 'ms-rf-est', {
      id: 'ms-rf-est', label: 'Estado', allLabel: 'Todos',
      options: estOpciones, selected: _rf.est || [],
      onChange: 'UI._rf={...UI._rf,est:UI._msGetSelected("ms-rf-est"),page:1};UI.renderUnitList()'
    });

    // DÍAS GPS — opciones fijas
    const diasOpts = ['En línea (<2d)', 'Atención (2-4d)', 'Fuera de línea'];
    _renderMs('ms-rf-dias', 'ms-rf-dias', {
      id: 'ms-rf-dias', label: 'Días GPS', allLabel: 'Todos',
      options: diasOpts, selected: _rf.dias || [],
      onChange: 'UI._rf={...UI._rf,dias:UI._msGetSelected("ms-rf-dias"),page:1};UI.renderUnitList()'
    });

    // ETIQUETA — opciones comunes + "Otro"
    const etqOpts = ['Siniestro','AFR / Falla','Sin SIM','En taller','En alineación','En carrocería','En pintura','Mecánica','Candado','Sin energía','Para venta','Desinstalado','Otro'];
    _renderMs('ms-rf-etq', 'ms-rf-etq', {
      id: 'ms-rf-etq', label: 'Etiqueta', allLabel: 'Todas',
      options: etqOpts, selected: Array.isArray(_rf.etiqueta) ? _rf.etiqueta : (_rf.etiqueta ? [_rf.etiqueta] : []),
      onChange: 'UI._rf={...UI._rf,etiqueta:UI._msGetSelected("ms-rf-etq"),page:1};UI.renderUnitList()'
    });
  }

  /* ── UNIT LIST ─────────────────────────────────────── */
  function renderUnitList() {
    const emp=DB.getEmpresaActiva();
    const cfg=DB.getConfig();
    const hoy=Date.now();
    let uns=DB.getUnidadesList(emp).filter(u=>u.activa && !u._soloBarrido);
    uns=uns.map(u=>({...u,dias:Parsers.diasDesde(u.ultima_act)}));

    // Excluir "Para venta" por defecto. Si el usuario filtra explícitamente por "Para venta", sí las muestra.
    // Excluir Para venta/Vendido salvo que el usuario los seleccione explícitamente
    const _ventaValues = ['Para venta','Vendido'];
    const _filtrandoVenta = Array.isArray(_rf.est)
      ? _rf.est.some(e => _ventaValues.includes(e))
      : _rf.est === 'venta';
    if (!_filtrandoVenta) {
      uns = uns.filter(u => {
        const norm = Parsers.normalizarEstatus(u.estatus);
        return !_ventaValues.includes(norm);
      });
    }

    if(_rf.plat)   uns=uns.filter(u=>u.plataforma===_rf.plat||u['ultima_act_'+_rf.plat.toLowerCase()]);
    // BASE — multi-select (array)
    if(_rf.base && _rf.base.length) uns=uns.filter(u=>_rf.base.includes(u.base));
    // CROMÁTICA — multi-select (array)
    if(_rf.crom && _rf.crom.length) uns=uns.filter(u=>_rf.crom.includes(u.cromatica));
    // ESTADO — multi-select: comparar contra estatus normalizado
    if(_rf.est && _rf.est.length){
      uns=uns.filter(u=>{
        const norm = Parsers.normalizarEstatus(u.estatus) || u.estatus || '';
        return _rf.est.includes(norm);
      });
    }
    // DÍAS GPS — multi-select con labels legibles
    if(_rf.dias && _rf.dias.length){
      uns=uns.filter(u=>{
        const d=u.dias;
        const bucket = d===null||d>cfg.diasAtencion ? 'Fuera de línea'
                     : d>cfg.diasLinea             ? 'Atención (2-4d)'
                     :                               'En línea (<2d)';
        return _rf.dias.includes(bucket);
      });
    }
    if(_rf.etiqueta && (Array.isArray(_rf.etiqueta) ? _rf.etiqueta.length : _rf.etiqueta)){
      // Mapear labels del dropdown a keywords de búsqueda
      const _ETQ_MAP = {
        'siniestro':     ['siniestro','accidente'],
        'afr / falla':   ['afr','falla','retarder','daño'],
        'sin sim':       ['sin sim','sim baja','sim bloqueada','sim sd','sin baja'],
        'en taller':     ['taller','en taller'],
        'en alineación': ['alineacion','alineación','alineado'],
        'en carrocería': ['carroceria','carrocería'],
        'en pintura':    ['pintura','en pintura'],
        'mecánica':      ['mecanica','mecánica','motor','en motor'],
        'candado':       ['candado','con candado','inmovilizado'],
        'sin energía':   ['sin energia','sin energía','sin luz','sin corriente'],
        'para venta':    ['para venta','en venta','venta'],
        'desinstalado':  ['desinstalado','sin equipo','sin dispositivo'],
        'otro':          ['otro']
      };
      const _etqArr = Array.isArray(_rf.etiqueta) ? _rf.etiqueta : [_rf.etiqueta];
      // Expandir labels a sus keywords
      const _keywords = [];
      _etqArr.forEach(label => {
        const lw = label.toLowerCase();
        const mapped = _ETQ_MAP[lw];
        if (mapped) _keywords.push(...mapped);
        else _keywords.push(lw); // fallback: buscar el label tal cual
      });
      uns = uns.filter(u => {
        const _uFull = DB.getUnidad(u.num, emp) || u;
        const _fallaMotivos = (_uFull.fallas||[])
          .filter(f => !f.resuelta)
          .map(f => [f.motivo||'', f.etiqueta||'', f.tipo||''].join(' ').toLowerCase())
          .join(' ');
        const _esSiniestro = (_uFull.siniestro || u.siniestro);
        const _sinDesc = (_uFull.siniestroDesc || u.siniestroDesc || '').toLowerCase();
        const _obs = [
          _uFull.observaciones_manual || '',
          _uFull.observaciones || '',
          _uFull.notas || '',
          u.observaciones || '',
          u.notas || ''
        ].join(' ').toLowerCase();
        const allText = [_fallaMotivos, _esSiniestro?'siniestro':'', _sinDesc, _obs].join(' ');
        return _keywords.some(kw => allText.includes(kw));
      });
    }
    if(_rf.search){
      uns = uns.filter(u => {
        // Construir string de búsqueda incluyendo fallas activas y siniestro
        const _uFull = DB.getUnidad(u.num, emp) || u;
        const _fallaMotivos = (_uFull.fallas||[])
          .filter(f => !f.resuelta)
          .map(f => [f.motivo, f.etiqueta, f.descripcion].join(' '))
          .join(' ');
        const _sinLabel = (_uFull.siniestro||u.siniestro) ? 'siniestro' : '';
        const _sinDesc  = _uFull.siniestroDesc || u.siniestroDesc || '';
        const _obsManual = _uFull.observaciones_manual || '';
        const searchStr = [
          u.num, u.base, u.modelo, u.cromatica, u.placa, u.empresa_asig,
          u.serie, u.dvr_ceiba, u.vin_samsara, u.placa_man, u.placa_scania,
          _fallaMotivos, _sinLabel, _sinDesc, _obsManual
        ].join(' ');
        return _multiTokenMatch(_rf.search, searchStr);
      });
    }

    uns.sort((a,b)=>{
      if(_rf.sort==='dias') return (b.dias??9999)-(a.dias??9999);
      if(_rf.sort==='num')  return parseInt(a.num)-parseInt(b.num);
      if(_rf.sort==='base') return (a.base||'').localeCompare(b.base||'');
      return 0;
    });

    // Actualizar KPIs, gráficas laterales y alertas con la lista FILTRADA
    _updateSidePanelsFromFiltered(uns);

    const fueraN=uns.filter(u=>u.dias===null||u.dias>cfg.diasAtencion).length;
    if($('units-count-badge')) $('units-count-badge').textContent=uns.length;

    const total=uns.length, pages=Math.ceil(total/PAGE_SIZE)||1;
    if(_rf.page>pages) _rf.page=1;
    if(_rf.page<1)     _rf.page=1;
    const slice=uns.slice((_rf.page-1)*PAGE_SIZE,_rf.page*PAGE_SIZE);

    const listEl=$('unit-list');
    if(!listEl) return;
    if(!slice.length){
      listEl.innerHTML=`<div class="empty-state"><div style="font-size:28px;margin-bottom:8px">🚌</div><div>Sin unidades que mostrar con los filtros actuales</div><div style="margin-top:8px"><button class="act-btn" onclick="_resetFiltros()">↺ Limpiar filtros</button></div></div>`;
    } else {
      listEl.innerHTML=slice.map(u=>{
        const cls=Parsers.statusClass(u.dias);
        const clsColor=cls==='critico'?'var(--red)':cls==='atencion'?'var(--yellow)':cls==='sin'?'var(--text3)':'var(--green)';
        // Plataformas ordenadas (con datos primero)
        const platsOrdered=platsSortedByData(u).filter(x=>x.fecha).map(x=>x.p);
        if(!platsOrdered.length&&u.plataforma) platsOrdered.push(u.plataforma);
        const fechaDisp=u.ultima_act?Parsers.fmtDateShort(u.ultima_act)+' '+Parsers.fmtTime(u.ultima_act):'Sin datos';
        const etiquetas = renderEtiquetasUnidad(u, 'sm');
        // Info SIM activa de esta unidad
        const _simEmp = DB.getEmpresaActiva();
        const _simInfo = (() => {
          const sims = DB.getSims ? DB.getSims(_simEmp) : [];
          // Buscar la SIM más reciente asignada a esta unidad
          return sims.find(s => s.unidad === String(u.num)) || null;
        })();
        const _simColor = _simInfo ? {
          'SIM INSTALADA':    { text:'#10b981', bg:'rgba(16,185,129,.13)' },
          'SIM RETIRADA':     { text:'#ef4444', bg:'rgba(239,68,68,.13)' },
          'SIM SIN ASIGNAR':  { text:'#f59e0b', bg:'rgba(245,158,11,.13)' },
          'SIM PARA INSTALAR':{ text:'#60a5fa', bg:'rgba(59,130,246,.13)' }
        }[_simInfo.estado] || { text:'#a78bfa', bg:'rgba(139,92,246,.13)' } : null;

        return `<div class="unit-card ${cls}" onclick="UI.openUnitDetail('${esc(u.num)}')">
          <div class="unit-card-status">
            <span style="font-size:16px">${cls==='critico'?'🔴':cls==='atencion'?'🟡':cls==='sin'?'⚪':'🟢'}</span>
            <div class="unit-num">${esc(u.num)}</div>
            <div class="unit-stlabel" style="color:${clsColor}">${cls==='critico'?'CRÍTICO':cls==='atencion'?'ATENCIÓN':cls==='sin'?'SIN GPS':'EN LÍNEA'}</div>
          </div>
          <div class="unit-card-info">
            ${etiquetas?`<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:5px">${etiquetas}</div>`:''}
            <div class="uf-row">
              <div class="uf"><div class="uf-lbl">BASE</div><div class="uf-val">${esc(u.base||'—')}</div></div>
              <div class="uf"><div class="uf-lbl">CROMÁTICA</div><div class="uf-val">${esc(u.cromatica||'—')}</div></div>
              <div class="uf"><div class="uf-lbl">MODELO</div><div class="uf-val" style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(u.modelo||'—')}</div></div>
              <div class="uf"><div class="uf-lbl">EMPRESA</div><div class="uf-val">${esc(u.empresa_asig||'—')}</div></div>
            </div>
            ${_simInfo ? `<div style="display:flex;align-items:center;gap:6px;margin-top:6px;padding:5px 8px;border-radius:6px;background:${_simColor.bg};border:1px solid ${_simColor.text}30;flex-wrap:wrap">
              <span style="font-size:10px">📶</span>
              <span style="font-size:10px;font-weight:700;color:${_simColor.text}">${esc(_simInfo.estado.replace('SIM ',''))}</span>
              <span style="font-size:10px;color:var(--text3)">·</span>
              <span style="font-size:10px;color:var(--text2);font-weight:600">${esc(_simInfo.operadora||'—')}</span>
              <span style="font-size:10px;color:var(--text3)">·</span>
              <span style="font-size:10px;color:var(--text3);font-family:monospace">${esc((_simInfo.iccid||'').substring(0,14))}${_simInfo.iccid&&_simInfo.iccid.length>14?'…':''}</span>
              ${_simInfo.observaciones?`<span style="font-size:10px;color:var(--text3)">·</span><span style="font-size:10px;color:var(--text3);font-style:italic;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(_simInfo.observaciones)}">${esc(_simInfo.observaciones)}</span>`:''}
            </div>` : `<div style="display:flex;align-items:center;gap:5px;margin-top:6px;padding:4px 8px;border-radius:6px;background:rgba(107,114,128,.08);border:1px solid rgba(107,114,128,.15)">
              <span style="font-size:10px">📶</span>
              <span style="font-size:10px;color:var(--text3)">Sin SIM asignada</span>
            </div>`}
          </div>
          <div class="unit-card-conn">
            <div class="uf-lbl">ÚLTIMA CONEXIÓN</div>
            <div style="font-size:11px;color:var(--text2)">${esc(fechaDisp)}</div>
            <div style="font-size:22px;font-weight:700;color:${clsColor};line-height:1;margin:4px 0">${u.dias!==null?u.dias:'—'} <span style="font-size:11px">${u.dias!==null?'días':''}</span></div>
            <div style="font-size:10px;color:var(--text3)">SIN CONEXIÓN</div>
            <div style="display:flex;gap:3px;margin-top:5px;justify-content:flex-end">${platsOrdered.map(p=>platIcon(p,20)).join('')}</div>
          </div>
          <span style="color:var(--text3);padding-left:4px;font-size:16px">›</span>
        </div>`;
      }).join('');
    }
    renderPagination('pag-info','pag-btns',total,_rf.page,pages,p=>{_rf.page=p;renderUnitList();});
  }

  /**
   * Recalcula KPIs, donuts laterales y alertas usando la lista YA filtrada.
   * Esto hace las gráficas reactivas a los filtros de la barra.
   */
  function _updateSidePanelsFromFiltered(unsFiltradas) {
    const cfg=DB.getConfig();
    let enLinea=0, atencion=0, fuera=0, sinDatos=0;
    const porBase={}, porCromatica={};
    let sinVIN=0, sinPlaca=0, siniestros=0;
    unsFiltradas.forEach(u => {
      // Siniestros activos se excluyen de conteos GPS (fuera/atención/en línea)
      if (!_tieneSiniestroActivo(u)) {
        if (!u.ultima_act) { sinDatos++; }
        else {
          const d = u.dias;
          if (d<=cfg.diasLinea) enLinea++;
          else if (d<=cfg.diasAtencion) atencion++;
          else fuera++;
        }
      }
      if (u.base)      porBase[u.base]=(porBase[u.base]||0)+1;
      if (u.cromatica) porCromatica[u.cromatica]=(porCromatica[u.cromatica]||0)+1;
      if (u['ultima_act_samsara'] && !u.serie) sinVIN++;
      if (!u.placa) sinPlaca++;
      if (u.siniestro) siniestros++;
    });
    const total=unsFiltradas.length||1;

    if($('kpi-fuera'))    $('kpi-fuera').textContent    =fuera+sinDatos;
    if($('kpi-atencion')) $('kpi-atencion').textContent =atencion;
    if($('kpi-enlinea'))  $('kpi-enlinea').textContent  =enLinea;
    if($('kpi-total'))    $('kpi-total').textContent    =unsFiltradas.length;

    if(unsFiltradas.length>0){
      Charts.donut('donut-estado',['Fuera','Atención','En línea'],[fuera+sinDatos,atencion,enLinea],['#ef4444','#f59e0b','#10b981']);
    }
    if($('pct-fuera'))    $('pct-fuera').textContent    =Math.round((fuera+sinDatos)/total*100)+'%';
    if($('pct-atencion')) $('pct-atencion').textContent =Math.round(atencion/total*100)+'%';
    if($('pct-enlinea'))  $('pct-enlinea').textContent  =Math.round(enLinea/total*100)+'%';

    const COLORS=['#3b82f6','#f59e0b','#10b981','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899'];

    const bE=Object.entries(porBase).sort((a,b)=>b[1]-a[1]);
    if(bE.length && $('donut-bases')){
      Charts.donut('donut-bases',bE.map(e=>e[0]),bE.map(e=>e[1]),COLORS);
      if($('bases-legend')) $('bases-legend').innerHTML=bE.map(([k,v],i)=>
        `<div class="leg-row" style="cursor:pointer" onclick="UI._rf={...UI._rf,base:'${esc(k)}',page:1};document.getElementById('filter-base').value='${esc(k)}';UI.renderUnitList()" title="Click para filtrar por ${esc(k)}"><span class="leg-dot" style="background:${COLORS[i%COLORS.length]}"></span><span class="leg-name">${esc(k)}</span><span class="leg-num">${v}</span><span class="leg-pct">(${Math.round(v/total*100)}%)</span></div>`).join('');
    } else if($('bases-legend')) {
      $('bases-legend').innerHTML='<div style="color:var(--text3);font-size:11px;padding:8px">Sin datos</div>';
    }

    const cE=Object.entries(porCromatica).sort((a,b)=>b[1]-a[1]);
    if(cE.length && $('donut-cromatica')){
      Charts.donut('donut-cromatica',cE.map(e=>e[0]),cE.map(e=>e[1]),COLORS);
      if($('crom-legend')) $('crom-legend').innerHTML=cE.map(([k,v],i)=>
        `<div class="leg-row" style="cursor:pointer" onclick="UI._rf={...UI._rf,crom:'${esc(k)}',page:1};document.getElementById('filter-crom').value='${esc(k)}';UI.renderUnitList()" title="Click para filtrar por ${esc(k)}"><span class="leg-dot" style="background:${COLORS[i%COLORS.length]}"></span><span class="leg-name" style="max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(k)}</span><span class="leg-num">${v}</span></div>`).join('');
    } else if($('crom-legend')) {
      $('crom-legend').innerHTML='<div style="color:var(--text3);font-size:11px;padding:8px">Sin datos</div>';
    }

    if($('alerta-sinvin'))   $('alerta-sinvin').textContent  =sinVIN;
    if($('alerta-sinplaca')) $('alerta-sinplaca').textContent=sinPlaca;
    if($('alerta-sinconn'))  $('alerta-sinconn').textContent =sinDatos;
  }

  /* ══════════════════════════════════════════════════════
     PANEL: DETALLE UNIDAD
  ══════════════════════════════════════════════════════ */
  function openUnitDetail(num,emp){emp=emp||DB.getEmpresaActiva();App.nav(null,'panel-detalle',{num,emp});}

  function renderDetalle(num,emp){
    emp=emp||DB.getEmpresaActiva();
    const u=DB.getUnidad(num,emp);
    if(!u){toast('Unidad no encontrada','error');App.nav(null,'panel-resumen');return;}
    const cfg=DB.getConfig();
    const dias=Parsers.diasDesde(u.ultima_act);
    const cls=Parsers.statusClass(dias);
    const clsColor=cls==='critico'?'var(--red)':cls==='atencion'?'var(--yellow)':cls==='sin'?'var(--text3)':'var(--green)';
    const el=$('panel-detalle'); if(!el)return;

    // Estado de plataformas (ordenadas: con datos primero por fecha desc, luego sin datos)
    const platStatus = platsSortedByData(u).map(({p,fecha})=>{
      const d = Parsers.diasDesde(fecha);
      return {p, f: fecha, d, tiene: !!fecha};
    });

    // Plataformas fuera de línea (con datos pero con dias>diasAtencion)
    const platsFueraLinea = platStatus.filter(x => x.tiene && x.d !== null && x.d > cfg.diasAtencion);
    const platsConDatos   = platStatus.filter(x => x.tiene).length;
    const platsSinDatos   = platStatus.filter(x => !x.tiene).length;

    // Etiqueta grande: si hay plataformas fuera de línea, mostramos cuántas;
    // si no, mostramos días de la última conexión global.
    let bigNum, bigLabel, bigSub;
    if (platsFueraLinea.length > 0) {
      bigNum = platsFueraLinea.length;
      bigLabel = `plataforma${platsFueraLinea.length>1?'s':''} fuera de línea`;
      bigSub = platsFueraLinea.map(x => x.p).join(' · ');
    } else if (dias !== null) {
      bigNum = dias;
      bigLabel = 'días sin conexión';
      bigSub = u.ultima_act ? 'Últ.: ' + Parsers.fmtDate(u.ultima_act) : '';
    } else {
      bigNum = '—';
      bigLabel = 'sin datos GPS';
      bigSub = platsSinDatos + ' plataforma(s) sin datos';
    }

    el.innerHTML=`
      <div class="breadcrumb">
        <span class="bc-link" onclick="App.nav(null,'panel-resumen')">← Volver al resumen</span>
        <span style="color:var(--text3);margin:0 6px">·</span>
        <span class="bc-link" onclick="App.nav(null,'panel-resumen')">Inicio</span> ›
        <span class="bc-link" onclick="App.nav(null,'panel-resumen')">Unidades</span> ›
        <span style="color:var(--text)">${esc(num)}</span>
      </div>

      <div class="detail-header">
        <div style="display:flex;align-items:flex-start;gap:14px;flex:1;min-width:0">
          <div class="det-icon-wrap" style="border-color:${clsColor};background:${clsColor}22">
            <span style="font-size:22px">${cls==='critico'?'🔴':cls==='atencion'?'🟡':cls==='sin'?'⚪':'🟢'}</span>
          </div>
          <div style="min-width:0">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <div class="det-num">${esc(u.num)}</div>
              ${u.siniestro?`<span style="font-size:11px;font-weight:700;color:var(--red);background:var(--red-bg);border:1px solid var(--red-border);padding:2px 8px;border-radius:5px">SINIESTRO: ${esc(u.siniestroDesc)}</span>`:''}
            </div>
            <span class="det-badge" style="background:${clsColor}22;color:${clsColor};border:1px solid ${clsColor}44">
              ${cls==='critico'?'FUERA DE LÍNEA':cls==='atencion'?'ATENCIÓN':cls==='sin'?'SIN GPS':'EN LÍNEA'}
            </span>
            <div style="font-size:11px;color:var(--text3);margin-top:4px">Empresa: ${esc(emp)}</div>
          </div>
        </div>
        <div class="det-fields">
          ${[['BASE',u.base],['CROMÁTICA',u.cromatica],['MODELO',u.modelo],['EMPRESA ASIG.',u.empresa_asig||emp],
             ['ESTATUS',u.estatus,'badge'],['ROL',u.rol],['MES ASIG.',u.mes],['TARJETA/PLACA',u.placa]].map(([l,v,t])=>
            `<div><div class="det-flbl">${l}</div><div class="det-fval">${t==='badge'?estatusBadge(v):esc(v||'—')}</div></div>`).join('')}
        </div>
        <div class="det-dias-box">
          <div class="det-dias-lbl">${platsFueraLinea.length>0?'FUERA DE LÍNEA':'DÍAS SIN CONEXIÓN'}</div>
          <div class="det-dias-num" style="color:${clsColor}">${bigNum}</div>
          <div style="font-size:11px;color:${clsColor}">${esc(bigLabel)}</div>
          <div class="det-dias-sub" style="font-size:10px;margin-top:4px">${esc(bigSub)}</div>
        </div>
      </div>

      <!-- MINI CARDS PLATAFORMAS (ORDENADAS: con datos primero) -->
      <div class="plat-quick-row" style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">
        ${platStatus.map(({p,f,d,tiene})=>{
          const pc=!tiene?'var(--border)':(d!==null&&d<=cfg.diasLinea)?'var(--green)':(d!==null&&d<=cfg.diasAtencion)?'var(--yellow)':'var(--red)';
          return `<div style="display:flex;align-items:center;gap:5px;padding:5px 8px;border-radius:7px;background:var(--bg-card);border:1px solid ${pc}33;min-width:0;cursor:${tiene?'pointer':'default'}" ${tiene?`onclick="UI._filtrarTimelinePlat('${p}','${esc(num)}','${esc(emp)}')" title="Click para filtrar línea de tiempo"`:''}>
            ${platIcon(p,18)}
            <div style="min-width:0">
              <div style="font-size:10px;font-weight:700;color:${pc}">${p}</div>
              <div style="font-size:9px;color:var(--text3)">${tiene?Parsers.fmtDateShort(f):'Sin datos'}</div>
            </div>
          </div>`;
        }).join('')}
      </div>

      <!-- ACCIONES -->
      <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">
        <button class="act-btn" onclick="App.nav(null,'panel-resumen')">← Volver a resumen</button>
        <button class="act-btn" onclick="UI.openEditarUnidad('${esc(num)}','${esc(emp)}')">✎ Editar</button>
        <button class="act-btn act-btn-danger-soft" onclick="UI.openRegistrarFalla('${esc(num)}','${esc(emp)}')">⚠ Registrar falla</button>
        <button class="act-btn" onclick="UI.openDatePicker(null,iso=>{UI._updateManualFechaConISO('${esc(num)}','${esc(emp)}',iso)},'Actualizar fecha GPS global')">📡 Actualizar GPS</button>
        ${!u.activa?`<button class="act-btn act-btn-ok" onclick="UI._reactivar('${esc(num)}','${esc(emp)}')">✓ Reactivar</button>`:''}
        <button class="act-btn act-btn-danger-soft" style="color:var(--red)" onclick="UI._confirmarEliminar('${esc(num)}','${esc(emp)}')">🗑 Eliminar</button>
      </div>

      <!-- TABS -->
      <div class="tabs-bar" id="det-tabs">
        <div class="tab active" data-tab="dtab-conexiones" onclick="UI._switchTab(this,'det-tabs','dtab-')">Conexiones GPS</div>
        <div class="tab" data-tab="dtab-historial"   onclick="UI._switchTab(this,'det-tabs','dtab-')">Historial (${(u.historial||[]).length})</div>
        <div class="tab" data-tab="dtab-ficha"       onclick="UI._switchTab(this,'det-tabs','dtab-')">Ficha técnica</div>
        <div class="tab" data-tab="dtab-fallas"      onclick="UI._switchTab(this,'det-tabs','dtab-')">Fallas (${(u.fallas||[]).length})</div>
        <div class="tab" data-tab="dtab-notas"       onclick="UI._switchTab(this,'det-tabs','dtab-')">Notas</div>
      </div>

      <!-- TAB: CONEXIONES -->
      <div id="dtab-conexiones">
        <div class="plat-grid">
          ${ALL_PLATS.map(p=>{
            const k='ultima_act_'+p.toLowerCase();
            const desKey='desinstalacion_'+p.toLowerCase();
            const desObj=u[desKey]||null;
            const desInstalado=!!desObj;
            const f=desInstalado?null:u[k];
            const pd=desInstalado?null:Parsers.diasDesde(f);
            const pc=desInstalado?'var(--border2)':!f?'var(--border)':pd<=DB.getConfig().diasLinea?'var(--green)':pd<=DB.getConfig().diasAtencion?'var(--yellow)':'var(--red)';
            const label=desInstalado?'DESINSTALADO':!f?'SIN DATOS':pd<=DB.getConfig().diasLinea?'EN LÍNEA':'FUERA DE LÍNEA';
            const cardBg=desInstalado?'var(--bg-card)':'var(--bg-panel)';
            const cardOpacity=desInstalado?'0.5':'1';
            return`<div style="background:${cardBg};border:1px solid var(--border);border-top:3px solid ${pc};border-radius:10px;padding:12px;opacity:${cardOpacity}">
              <div style="display:flex;align-items:center;gap:7px;margin-bottom:8px">
                ${platIcon(p,22)}
                <span style="font-size:12px;font-weight:700">${p}</span>
                <button title="${desInstalado?'Reinstalar equipo '+p:'Desinstalar equipo '+p}" onclick="event.stopPropagation();UI._toggleDesinstalacion('${esc(num)}','${p}','${esc(emp)}')"
                  style="margin-left:auto;background:none;border:none;cursor:pointer;font-size:13px;color:${desInstalado?'var(--green)':'var(--text3)'}">
                  ${desInstalado?'🔧↩':'🔧'}
                </button>
              </div>
              ${desInstalado
                ?`<div style="color:var(--text3);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:8px 0">Equipo desinstalado</div>
                  ${desObj.comentario?`<div style="font-size:10px;color:var(--text3);font-style:italic;margin-bottom:6px">${esc(desObj.comentario)}</div>`:''}
                  ${desObj.fecha?`<div style="font-size:10px;color:var(--text3)">${Parsers.fmtDateShort(desObj.fecha)}</div>`:''}
                  <button class="act-btn-sm" style="margin-top:6px;width:100%;opacity:0.6" onclick="event.stopPropagation();UI._toggleDesinstalacion('${esc(num)}','${p}','${esc(emp)}')">
                    🔧 Reinstalar equipo
                  </button>`
                :`${f?`<div style="font-size:15px;font-weight:700">${Parsers.fmtDateShort(f)}</div>
                  <div style="font-size:11px;color:var(--text2)">${Parsers.fmtTime(f)}</div>
                  <div style="font-size:10px;font-weight:700;text-transform:uppercase;margin:5px 0 2px;color:${pc}">${label}</div>
                  <div style="font-size:20px;font-weight:700;color:${pc}">${pd} días</div>`
                :`<div style="color:var(--text3);font-size:12px;margin:8px 0">Sin datos registrados</div>`}
                <button class="act-btn-sm" style="margin-top:6px;width:100%" onclick="UI.openDatePicker('${f||''}',iso=>{UI._updatePlatFechaConISO('${esc(num)}','${p}','${esc(emp)}',iso)},'${p} — Actualizar conexión')">
                  ${f?'↻ Actualizar':'+ Ingresar fecha'}
                </button>`
              }
            </div>`;
          }).join('')}
        </div>

        <div class="det-bottom-grid">
          <!-- Línea de tiempo (filtrable por plataforma) -->
          <div class="det-box">
            <div style="display:flex;align-items:center;margin-bottom:8px">
              <div class="det-box-title" style="margin-bottom:0">LÍNEA DE TIEMPO</div>
              <select id="tl-filter-plat" onchange="UI._renderTimelineAndChart('${esc(num)}','${esc(emp)}',this.value)"
                style="margin-left:auto;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:3px 7px;color:var(--text2);font-family:var(--font);font-size:10px">
                <option value="">Todas</option>
                ${ALL_PLATS.filter(p=>u['ultima_act_'+p.toLowerCase()]).map(p=>`<option value="${p}">${p}</option>`).join('')}
              </select>
            </div>
            <div id="tl-content" style="max-height:200px;overflow-y:auto"></div>
          </div>

          <!-- Gráfica histórico de días sin conexión -->
          <div class="det-box">
            <div class="det-box-title">HISTÓRICO DÍAS SIN CONEXIÓN</div>
            <div style="height:120px"><canvas id="chart-histdias"></canvas></div>
            <div style="display:flex;gap:16px;margin-top:8px;flex-wrap:wrap">
              <div><div style="font-size:10px;color:var(--text3)">Días actuales</div><div style="font-size:18px;font-weight:700;color:${clsColor}">${dias!==null?dias:'—'}</div></div>
              <div><div style="font-size:10px;color:var(--text3)">Plat. fuera</div><div style="font-size:18px;font-weight:700;color:var(--red)">${platsFueraLinea.length}</div></div>
              <div><div style="font-size:10px;color:var(--text3)">Fallas activas</div><div style="font-size:18px;font-weight:700;color:var(--yellow)">${(u.fallas||[]).filter(f=>!f.resuelta).length}</div></div>
            </div>
          </div>

          <!-- Info adicional -->
          <div class="det-box">
            <div class="det-box-title">INFORMACIÓN ADICIONAL</div>
            ${[['Motor',u.motor],['Serie/VIN',u.serie],['Placa/Tarjeta',u.placa],['Asientos',u.asientos],['Empresa',u.empresa_asig||emp],['Siniestro',u.siniestro?'Sí - '+u.siniestroDesc:'No'],['Fallas totales',u.fallaCount||0]].map(([k,v])=>
              `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:11px"><span style="color:var(--text3)">${k}</span><span style="font-weight:500;text-align:right;max-width:55%;overflow:hidden;text-overflow:ellipsis">${esc(String(v||'—'))}</span></div>`
            ).join('')}
            <button class="act-btn" style="width:100%;margin-top:8px" onclick="UI._addNote('${esc(num)}','${esc(emp)}')">✏ Agregar nota</button>
          </div>
        </div>
      </div>

      <!-- TAB: HISTORIAL -->
      <div id="dtab-historial" class="hidden">${_renderHistorialUnidad(u)}</div>

      <!-- TAB: FICHA TÉCNICA -->
      <div id="dtab-ficha" class="hidden">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="det-box">
            <div class="det-box-title">DATOS DE ASIGNACIÓN</div>
            ${[['N° Económico',u.economico],['Base',u.base],['Cromática',u.cromatica],['Modelo',u.modelo],['Estatus',u.estatus],['Rol',u.rol],['Empresa asig.',u.empresa_asig],['Mes asig.',u.mes],['Observaciones',u.observaciones]].map(([l,v])=>
              `<div style="display:flex;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px"><span style="color:var(--text3);min-width:130px">${l}</span><span style="font-weight:500;flex:1">${esc(String(v||'—'))}</span></div>`).join('')}
          </div>
          <div class="det-box">
            <div class="det-box-title">DATOS TÉCNICOS</div>
            ${[['N° Unidad',u.num],['Placa/Tarjeta',u.placa],['Serie/VIN',u.serie],['Motor',u.motor],['Asientos',u.asientos],['Plataforma GPS',u.plataforma],['Siniestro',u.siniestro?'SÍ — '+u.siniestroDesc:'No'],['Notas',u.notas],['Última actualización',Parsers.fmtDate(u.updatedAt)]].map(([l,v])=>
              `<div style="display:flex;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px"><span style="color:var(--text3);min-width:130px">${l}</span><span style="font-weight:500;flex:1;overflow:hidden;text-overflow:ellipsis">${esc(String(v||'—'))}</span></div>`).join('')}
          </div>
        </div>
      </div>

      <!-- TAB: FALLAS -->
      <div id="dtab-fallas" class="hidden">
        <div class="det-box">
          <div style="display:flex;align-items:center;margin-bottom:10px">
            <div class="det-box-title" style="margin-bottom:0">FICHAS DE FALLAS / INCIDENTES</div>
            <button class="act-btn-primary" style="margin-left:auto;font-size:11px" onclick="UI.openRegistrarFalla('${esc(num)}','${esc(emp)}')">+ Nueva falla</button>
          </div>
          ${(u.fallas||[]).length===0?`<div class="empty-state" style="padding:20px">Sin fallas registradas</div>`:
            (u.fallas||[]).slice().reverse().map(f=>`
              <div style="border:1px solid ${f.resuelta?'var(--green-border)':(f.esSiniestro?'var(--red-border)':'var(--border)')};border-radius:9px;padding:12px;margin-bottom:8px;background:${f.resuelta?'var(--green-bg)':(f.esSiniestro?'var(--red-bg)':'var(--bg-card)')};opacity:${f.resuelta?'.75':'1'}">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px;flex-wrap:wrap">
                  <span style="font-size:14px">${f.resuelta?'✅':(f.esSiniestro?'🚨':'⚠')}</span>
                  <span style="font-size:12px;font-weight:700;color:${f.resuelta?'var(--green)':(f.esSiniestro?'var(--red)':'var(--yellow)')}">
                    ${f.resuelta?'RESUELTA':(f.esSiniestro?'SINIESTRO':'FALLA ACTIVA')}
                  </span>
                  <span style="font-size:11px;color:var(--text3);margin-left:auto">${Parsers.fmtDate(f.fecha)}</span>
                </div>
                ${[['Motivo',f.motivo],['Descripción',f.descripcion],['Ubicación',f.ubicacion],['Fecha ocurrencia',f.fechaOcurrencia?Parsers.fmtDate(f.fechaOcurrencia):'']].filter(([,v])=>v).map(([l,v])=>
                  `<div style="font-size:11px;margin-bottom:3px"><span style="color:var(--text3)">${l}:</span> <span>${esc(v)}</span></div>`).join('')}
                ${f.resuelta?`<div style="font-size:11px;margin-top:6px;padding-top:6px;border-top:1px solid var(--border)"><span style="color:var(--text3)">Resuelta:</span> <span>${esc(Parsers.fmtDate(f.fechaResolucion))}</span>${f.motivoResolucion?`<br><span style="color:var(--text3)">Solución:</span> <span>${esc(f.motivoResolucion)}</span>`:''}</div>`:''}
                <div style="display:flex;gap:6px;margin-top:10px;padding-top:8px;border-top:1px solid var(--border)">
                  ${!f.resuelta?`<button class="act-btn-sm" style="color:var(--green)" onclick="UI._marcarFallaResuelta('${esc(num)}','${esc(emp)}',${f.id})">✓ Marcar resuelta</button>`:''}
                  <button class="act-btn-sm" style="color:var(--red)" onclick="UI._eliminarFalla('${esc(num)}','${esc(emp)}',${f.id})">🗑 Eliminar</button>
                </div>
              </div>`).join('')}
        </div>
      </div>

      <!-- TAB: NOTAS -->
      <div id="dtab-notas" class="hidden">
        <div class="det-box" style="max-width:600px">
          <div class="det-box-title">NOTAS</div>
          <div id="notas-display" style="font-size:13px;line-height:1.7;padding:10px 0;min-height:80px;white-space:pre-wrap">${esc(u.notas)||'<span style="color:var(--text3)">Sin notas registradas.</span>'}</div>
          <button class="act-btn" onclick="UI._addNote('${esc(num)}','${esc(emp)}')">✏ Editar notas</button>
        </div>
      </div>
    `;

    // Renderizar timeline + chart iniciales (sin filtro)
    setTimeout(()=>_renderTimelineAndChart(num, emp, ''), 50);
  }

  /**
   * Renderiza la línea de tiempo y la gráfica histórica, opcionalmente filtrando por plataforma.
   */
  function _renderTimelineAndChart(num, emp, platFiltro) {
    const u=DB.getUnidad(num,emp);
    if(!u)return;
    const cfg=DB.getConfig();
    const tlEl=$('tl-content');

    // Construir timeline a partir del historial real de actualizaciones + fecha final actual
    const hist = (u.historial||[]).filter(h =>
      h.tipo === 'actualizacion' || h.tipo === 'creacion' ||
      h.tipo === 'falla' || h.tipo === 'falla_resuelta'
    );

    // Eventos de plataforma: cada plataforma con fecha es un evento
    const platEvents = [];
    ALL_PLATS.forEach(p => {
      if (platFiltro && p !== platFiltro) return;
      const f = u['ultima_act_'+p.toLowerCase()];
      if (f) platEvents.push({ fecha: f, plat: p, d: Parsers.diasDesde(f) });
    });
    platEvents.sort((a,b) => new Date(b.fecha) - new Date(a.fecha));

    if (tlEl) {
      if (!platEvents.length) {
        tlEl.innerHTML = `<div style="text-align:center;padding:16px;color:var(--text3);font-size:12px">Sin registros GPS${platFiltro?' para '+platFiltro:''}</div>`;
      } else {
        tlEl.innerHTML = platEvents.map(({plat, fecha, d}) => {
          const pc = d<=cfg.diasLinea?'var(--green)':d<=cfg.diasAtencion?'var(--yellow)':'var(--red)';
          return `<div style="display:flex;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);align-items:center">
            <div style="width:6px;height:6px;border-radius:50%;background:${pc};flex-shrink:0"></div>
            <div style="flex:1;min-width:0">
              <span style="font-size:11px;font-weight:600">${Parsers.fmtDateShort(fecha)}</span>
              <span style="font-size:10px;color:var(--text3);margin-left:4px">${Parsers.fmtTime(fecha)}</span>
              <div style="display:flex;align-items:center;gap:4px;margin-top:1px">${platIcon(plat,14)}<span style="font-size:10px;color:var(--text2)">${plat}</span></div>
            </div>
            <div style="font-size:11px;font-weight:700;color:${pc}">${d}d</div>
          </div>`;
        }).join('');
      }
    }

    // Gráfica histórica: construir serie con valores reales
    // Si filtramos por plataforma, mostramos cómo se ha movido esa plataforma vs hoy.
    let labels = [], vals = [];
    if (platFiltro) {
      const f = u['ultima_act_'+platFiltro.toLowerCase()];
      if (f) {
        // 4 puntos: hace 30d, hace 14d, últ. conexión, hoy
        const hoy = Date.now();
        const ultConn = new Date(f).getTime();
        const diasAhora = Math.floor((hoy - ultConn) / 86400000);
        labels = ['-30d', '-14d', 'Últ. conn', 'Hoy'];
        vals   = [
          Math.max(0, diasAhora - 30),
          Math.max(0, diasAhora - 14),
          0,
          diasAhora
        ];
      }
    } else {
      // Serie: días sin conexión por cada snapshot del historial de actualizaciones
      const hoy = Date.now();
      const snaps = platEvents.slice(0, 8).reverse();
      if (snaps.length > 0) {
        snaps.forEach(e => {
          labels.push(Parsers.fmtDateShort(e.fecha));
          vals.push(e.d);
        });
        labels.push('Hoy');
        const maxFecha = snaps[snaps.length - 1].fecha;
        const diasHoy = Math.floor((hoy - new Date(maxFecha).getTime()) / 86400000);
        vals.push(diasHoy);
      }
    }

    if (labels.length > 0) {
      Charts.lineChart('chart-histdias', labels, vals, '#ef4444');
    } else {
      Charts.sparkline('chart-histdias', [0, 0], '#ef4444');
    }
  }

  /**
   * Llamado desde las mini-tarjetas de plataforma (hacer click filtra timeline + chart)
   */
  function _filtrarTimelinePlat(plat, num, emp) {
    const sel = $('tl-filter-plat');
    if (sel) { sel.value = plat; }
    _renderTimelineAndChart(num, emp, plat);
    toast(`Línea de tiempo filtrada: ${plat}`, 'info', 2000);
  }

  function _renderHistorialUnidad(u) {
    const hist=(u.historial||[]).slice().reverse();
    if(!hist.length) return`<div class="empty-state">Sin historial</div>`;
    const colors={creacion:'var(--blue)',actualizacion:'var(--green)',falla:'var(--red)',inactivacion:'var(--yellow)',reactivacion:'var(--green)',barrido:'var(--teal)'};
    return`<div style="max-height:500px;overflow-y:auto">${hist.map(h=>`
      <div style="display:flex;gap:12px;padding:9px 0;border-bottom:1px solid var(--border);align-items:flex-start">
        <div style="width:7px;height:7px;border-radius:50%;background:${colors[h.tipo]||'var(--text3)'};flex-shrink:0;margin-top:4px"></div>
        <div style="flex:1;min-width:0">
          <div style="font-size:10px;color:var(--text3);font-family:monospace">${esc(Parsers.fmtDate(h.fecha))}</div>
          <div style="font-size:12px;font-weight:500;margin-top:1px">${h.tipo==='creacion'?'Unidad creada':h.tipo==='actualizacion'?'Datos actualizados':h.tipo==='falla'?'Falla/incidente registrado':h.tipo==='inactivacion'?'Marcada inactiva':h.tipo==='reactivacion'?'Reactivada':esc(h.tipo)}</div>
          ${h.cambios?`<div style="font-size:10px;color:var(--text3)">${Object.entries(h.cambios).slice(0,3).map(([f,{de,a}])=>`${f}: "${esc(String(de))}" → "${esc(String(a))}"`).join(' · ')}</div>`:''}
          ${h.motivo?`<div style="font-size:10px;color:var(--red)">${esc(h.motivo)}</div>`:''}
        </div>
        <span style="font-size:10px;font-weight:700;color:${colors[h.tipo]||'var(--text3)'};text-transform:uppercase">${h.tipo}</span>
      </div>`).join('')}</div>`;
  }

  function _switchTab(el,groupId,prefix){
    $(groupId).querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    el.classList.add('active');
    const tabId=el.dataset.tab;
    document.querySelectorAll(`[id^="${prefix}"]`).forEach(t=>t.classList.add('hidden'));
    const target=$(tabId); if(target) target.classList.remove('hidden');
  }

  /* ─── ACCIONES UNIDAD ─────────────────────────────── */
  function _reactivar(num,emp){DB.reactivarUnidad(num,emp);toast(`Unidad ${num} reactivada`,'success');renderDetalle(num,emp);}

  function _confirmarEliminar(num,emp){
    openModal(`
      <div style="background:var(--bg-panel);border:1px solid var(--red-border);border-radius:12px;padding:24px;width:380px;text-align:center">
        <div style="font-size:32px;margin-bottom:10px">🗑</div>
        <div style="font-size:15px;font-weight:600;margin-bottom:8px">¿Eliminar unidad ${esc(num)}?</div>
        <div style="font-size:12px;color:var(--text3);margin-bottom:20px">Esta acción no se puede deshacer. Se perderán todos los datos e historial de esta unidad.</div>
        <div style="display:flex;gap:10px;justify-content:center">
          <button onclick="UI.closeModal()" class="act-btn">No, cancelar</button>
          <button onclick="UI.closeModal();DB.eliminarUnidad('${esc(num)}','${esc(emp)}');UI.toast('Unidad eliminada','error');App.nav(null,'panel-resumen')"
            style="padding:8px 18px;border-radius:8px;background:var(--red);border:none;color:#fff;font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer">Sí, eliminar</button>
        </div>
      </div>`);
  }

  function _addNote(num,emp){
    const u=DB.getUnidad(num,emp);
    openModal(`
      <div style="background:var(--bg-panel);border:1px solid var(--border2);border-radius:12px;padding:24px;width:440px">
        <div style="font-size:14px;font-weight:600;margin-bottom:12px">✏ Notas — Unidad ${esc(num)}</div>
        <textarea id="modal-notas" rows="5" style="width:100%;background:var(--bg-card);border:1px solid var(--border2);border-radius:8px;padding:10px;color:var(--text);font-family:var(--font);font-size:13px;resize:vertical">${esc(u?.notas||'')}</textarea>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px">
          <button onclick="UI.closeModal()" class="act-btn">Cancelar</button>
          <button onclick="UI._guardarNota('${esc(num)}','${esc(emp)}',document.getElementById('modal-notas').value)" class="act-btn-primary">Guardar</button>
        </div>
      </div>`);
  }

  function _guardarNota(num, emp, texto) {
    // 1) localStorage
    DB.upsertUnidad(num, { notas: texto }, emp);
    // 2) Supabase
    if (window.GPS_SB && GPS_SB.saveNota) {
      GPS_SB.saveNota(num, emp, texto)
        .catch(e => console.warn('[_guardarNota] Supabase:', e.message));
    }
    closeModal();
    toast('Notas guardadas', 'success');
    // Actualizar display en tab Notas si está visible
    const nd = document.getElementById('notas-display');
    if (nd) nd.textContent = texto || 'Sin notas registradas.';
    // Actualizar celda en tabla de plataformas si está abierta
    const notaCells = document.querySelectorAll('.plat-nota-cell');
    notaCells.forEach(cell => {
      const tr = cell.closest('tr');
      if (tr && tr.dataset.num === String(num)) {
        const span = cell.querySelector('span');
        if (span) span.innerHTML = texto
          ? esc(texto)
          : '<span style="color:var(--text3);font-style:italic;font-size:11px">+ agregar nota</span>';
      }
    });
  }

  async function _editarNotaRapido(num, plat, emp) {
    const u = DB.getUnidad(num, emp) || {};
    const actual = u.notas || '';
    const nueva = await _uiPrompt({
      title: `Notas — Unidad ${num}`,
      message: 'Escribe una nota interna. Deja vacío para borrar.',
      placeholder: 'Ej: sin equipo SAMSARA, pendiente instalación...',
      defaultValue: actual, icon: '📝', okText: 'Guardar nota', multiline: true
    });
    if (nueva === null) return;
    _guardarNota(num, emp, nueva);
    // Re-renderizar la tabla para reflejar el cambio
    if (_platExpandida === plat) _refreshPlatTable(plat);
  }

  function _updateManualFechaConISO(num,emp,iso){
    DB.upsertUnidad(num,{ultima_act:iso},emp);
    toast(`Fecha GPS actualizada para unidad ${num}`,'success');
    renderDetalle(num,emp);
  }


  // ── Multi-select helpers ────────────────────────────────────────────────
  function _onPlatCheckRow(num, plat, checked) {
    if (checked) {
      _platSeleccionadas.add(num);
    } else {
      _platSeleccionadas.delete(num);
    }
    _updateBulkBar(plat);
    // Sincronizar checkbox "select all"
    const chkAll = document.getElementById('plat-chk-all');
    if (chkAll) {
      const allChks = document.querySelectorAll('.plat-row-chk');
      chkAll.checked = allChks.length > 0 && [...allChks].every(c => c.checked);
      chkAll.indeterminate = _platSeleccionadas.size > 0 && !chkAll.checked;
    }
  }

  function _toggleSelectAllPlat(checked, plat) {
    const allChks = document.querySelectorAll('.plat-row-chk');
    allChks.forEach(chk => {
      const num = chk.dataset.num;
      if (checked) {
        _platSeleccionadas.add(num);
        chk.checked = true;
        chk.closest('tr').classList.add('plat-row-checked');
      } else {
        _platSeleccionadas.delete(num);
        chk.checked = false;
        chk.closest('tr').classList.remove('plat-row-checked');
      }
    });
    _updateBulkBar(plat);
  }

  function _limpiarSeleccionPlat() {
    _platSeleccionadas.clear();
    document.querySelectorAll('.plat-row-chk').forEach(c => { c.checked = false; c.closest('tr').classList.remove('plat-row-checked'); });
    const chkAll = document.getElementById('plat-chk-all');
    if (chkAll) { chkAll.checked = false; chkAll.indeterminate = false; }
    _updateBulkBar('');
  }

  function _updateBulkBar(plat) {
    const bar   = document.getElementById('plat-bulk-bar');
    const count = document.getElementById('plat-bulk-count');
    const btnDesins = document.getElementById('plat-btn-desinstalar');
    if (!bar) return;
    const n = _platSeleccionadas.size;
    if (n > 0) {
      bar.style.display = 'flex';
      if (count) count.textContent = `${n} unidad${n>1?'es':''} seleccionada${n>1?'s':''}`;
      // Detectar si TODAS las seleccionadas ya están desinstaladas → mostrar "Instalar equipo"
      if (btnDesins && plat) {
        const emp = DB.getEmpresaActiva();
        const desKey = 'desinstalacion_' + plat.toLowerCase();
        const nums = [..._platSeleccionadas];
        const todasDesinstaladas = nums.length > 0 && nums.every(num => !!(DB.getUnidad(num, emp)||{})[desKey]);
        const algunaDesinstalada = nums.some(num => !!(DB.getUnidad(num, emp)||{})[desKey]);
        if (todasDesinstaladas) {
          btnDesins.textContent = '🔧 Instalar equipo';
          btnDesins.style.borderColor = 'var(--green)';
          btnDesins.style.color = 'var(--green)';
          btnDesins.style.background = 'rgba(34,197,94,.1)';
          btnDesins.dataset.modo = 'instalar';
        } else {
          btnDesins.textContent = algunaDesinstalada ? '🔧 Desinstalar equipo (mixto)' : '🔧 Desinstalar equipo';
          btnDesins.style.borderColor = '#f59e0b';
          btnDesins.style.color = '#fbbf24';
          btnDesins.style.background = 'rgba(120,53,15,.15)';
          btnDesins.dataset.modo = 'desinstalar';
        }
      }
    } else {
      bar.style.display = 'none';
    }
  }

  async function _eliminarSeleccionadasPlat(plat) {
    const emp = DB.getEmpresaActiva();
    const nums = [..._platSeleccionadas];
    if (!nums.length) return;
    const okDel = await _uiConfirm({
      title: `Eliminar ${nums.length} unidad${nums.length>1?'es':''} de ${plat}`,
      message: `${nums.slice(0,5).join(', ')}${nums.length>5?'...':''}<br><br>Esta acción borra los datos de esta plataforma y es permanente.`,
      icon: '🗑', danger: true, okText: 'Sí, eliminar', cancelText: 'Cancelar'
    });
    if (!okDel) return;

    toast(`⏳ Eliminando ${nums.length} unidades de ${plat}...`, 'info', 3000);

    let borradasLocal = 0;
    let borradasSB = 0;
    let erroresSB = 0;

    // 1) Borrar en localStorage
    nums.forEach(num => {
      const u = DB.getUnidad(num, emp);
      if (!u) return;
      const k = 'ultima_act_' + plat.toLowerCase();
      const platFields = {
        [k]: null,
        dvr_ceiba: plat === 'CEIBA' ? null : undefined,
        vin_samsara: plat === 'SAMSARA' ? null : undefined,
        placa_man: plat === 'MAN' ? null : undefined,
        placa_scania: plat === 'SCANIA' ? null : undefined,
        motive_vg: plat === 'MOTIVE' ? null : undefined,
        motive_cam: plat === 'MOTIVE' ? null : undefined,
        estado_motive: plat === 'MOTIVE' ? null : undefined,
        estado_samsara: plat === 'SAMSARA' ? null : undefined,
      };
      // Quitar campos undefined
      Object.keys(platFields).forEach(key => platFields[key] === undefined && delete platFields[key]);
      DB.upsertUnidad(num, platFields, emp);
      borradasLocal++;
    });

    // 2) Borrar en Supabase gps_barridos
    if (window.GPS_SB) {
      const BATCH = 50;
      for (let i = 0; i < nums.length; i += BATCH) {
        const batch = nums.slice(i, i + BATCH);
        try {
          await GPS_SB.deleteBarridos(batch, plat, emp);
          borradasSB += batch.length;
        } catch(e) {
          console.warn('[_eliminarSeleccionadasPlat] Supabase error:', e.message);
          erroresSB += batch.length;
        }
      }
    }

    // 3) Limpiar selección y re-renderizar
    _platSeleccionadas.clear();
    renderPlataformas();
    renderResumen();

    const sbMsg = window.GPS_SB
      ? (erroresSB === 0 ? ` · ☁ ${borradasSB} en Supabase` : ` · ⚠ ${erroresSB} sin borrar en Supabase`)
      : '';
    toast(`✅ ${borradasLocal} unidades eliminadas de ${plat}${sbMsg}`, 'success', 5000);
  }


  // ══════════════════════════════════════════════════════════════════
  // DESINSTALACIÓN DE EQUIPOS GPS POR PLATAFORMA
  // ══════════════════════════════════════════════════════════════════

  async function _toggleDesinstalacion(num, plat, emp) {
    const u = DB.getUnidad(num, emp) || {};
    const desKey = 'desinstalacion_' + plat.toLowerCase();
    const yaDesinstalado = !!u[desKey];

    if (yaDesinstalado) {
      // Reinstalar — quitar desinstalación
      const okRe = await _uiConfirm({
        title: `Reinstalar equipo ${plat}`,
        message: `Unidad ${num} — ¿Confirmar reinstalación?`,
        icon: '🔧', okText: 'Reinstalar', cancelText: 'Cancelar'
      });
      if (!okRe) return;
      const upd = { [desKey]: null };
      DB.upsertUnidad(num, upd, emp);
      // Supabase: limpiar campo en gps_barridos
      if (window.GPS_SB) {
        GPS_SB._patch('gps_barridos',
          `empresa_id=eq.${emp}&plataforma=eq.${plat}&num_economico=eq.${num}`,
          { desinstalado: false, desinstalacion_fecha: null, desinstalacion_comentario: null, desinstalacion_ts: null }
        ).catch(e => console.warn('[_toggleDesinstalacion] reinstalar:', e.message));
      }
      toast(`✅ Equipo ${plat} reinstalado en unidad ${num}`, 'success', 3000);
    } else {
      // Desinstalar — pedir comentario
      const comentario = await _uiPrompt({
        title: `Desinstalar equipo ${plat} — Unidad ${num}`,
        message: 'El equipo quedará marcado como desinstalado. Puedes agregar un comentario.',
        placeholder: 'Ej: equipo en mal estado, robo, reasignación...',
        defaultValue: '', icon: '🔧', okText: 'Confirmar desinstalación'
      });
      if (comentario === null) return; // Canceló
      const ahora = new Date().toISOString();
      const desObj = { fecha: ahora, comentario: comentario.trim(), ts: Date.now() };
      const upd = { [desKey]: desObj };
      DB.upsertUnidad(num, upd, emp);
      // Supabase: marcar como desinstalado en gps_barridos
      if (window.GPS_SB) {
        GPS_SB._patch('gps_barridos',
          `empresa_id=eq.${emp}&plataforma=eq.${plat}&num_economico=eq.${num}`,
          { desinstalado: true, desinstalacion_fecha: ahora,
            desinstalacion_comentario: comentario.trim(), desinstalacion_ts: ahora }
        ).catch(e => console.warn('[_toggleDesinstalacion] desinstalar:', e.message));
      }
      // Guardar en nota de la unidad si hay comentario
      if (comentario.trim()) {
        const notaActual = (DB.getUnidad(num, emp) || {}).notas || '';
        const nuevaNota = notaActual
          ? `${notaActual} | ${plat} desinstalado: ${comentario.trim()}`
          : `${plat} desinstalado: ${comentario.trim()}`;
        DB.upsertUnidad(num, { notas: nuevaNota }, emp);
        if (window.GPS_SB && GPS_SB.saveNota) {
          GPS_SB.saveNota(num, emp, nuevaNota).catch(e => console.warn('[_toggleDesinstalacion] nota:', e.message));
        }
      }
      toast(`🔧 Equipo ${plat} desinstalado en unidad ${num}`, 'success', 3000);
    }
    renderDetalle(num, emp);
    if (_platExpandida === plat) _refreshPlatTable(plat);
  }

  async function _toggleDesinstalacionMasiva(plat, emp) {
    const btn = document.getElementById('plat-btn-desinstalar');
    const modo = btn?.dataset.modo || 'desinstalar';
    if (modo === 'instalar') {
      // Reinstalar todas las seleccionadas
      const nums = [..._platSeleccionadas];
      const ok = await _uiConfirm({
        title: `Reinstalar equipo ${plat}`,
        message: `${nums.length} unidad${nums.length>1?'es':''}: ${nums.slice(0,5).join(', ')}${nums.length>5?'...':''}`,
        icon: '🔧', okText: 'Reinstalar', cancelText: 'Cancelar'
      });
      if (!ok) return;
      const desKey = 'desinstalacion_' + plat.toLowerCase();
      nums.forEach(num => DB.upsertUnidad(num, { [desKey]: null }, emp));
      if (window.GPS_SB) {
        const inList = nums.join(',');
        GPS_SB._patch('gps_barridos',
          `empresa_id=eq.${emp}&plataforma=eq.${plat}&num_economico=in.(${inList})`,
          { desinstalado: false, desinstalacion_fecha: null, desinstalacion_comentario: null, desinstalacion_ts: null }
        ).catch(e => console.warn('[_toggleDesinstalacionMasiva reinstalar]', e.message));
      }
      _platSeleccionadas.clear();
      toast(`✅ ${nums.length} unidades reinstaladas en ${plat}`, 'success', 3000);
      _refreshPlatTable(plat);
    } else {
      // Desinstalar
      await _desinstalarSeleccionadasPlat(plat, emp);
    }
  }

  async function _desinstalarSeleccionadasPlat(plat, emp) {
    const nums = [..._platSeleccionadas];
    if (!nums.length) return;
    const comentario = await _uiPrompt({
      title: `Desinstalar equipo ${plat} en ${nums.length} unidad${nums.length>1?'es':''}`,
      message: `Unidades: ${nums.slice(0,5).join(', ')}${nums.length>5?'...':''}<br>Todas quedarán marcadas como desinstaladas.`,
      placeholder: 'Comentario opcional...',
      defaultValue: '', icon: '🔧', okText: 'Confirmar desinstalación'
    });
    if (comentario === null) return;
    const ahora = new Date().toISOString();
    const desObj = { fecha: ahora, comentario: comentario.trim(), ts: Date.now() };
    const desKey = 'desinstalacion_' + plat.toLowerCase();

    let ok = 0;
    for (const num of nums) {
      DB.upsertUnidad(num, { [desKey]: desObj }, emp);
      ok++;
    }

    // Supabase en background
    if (window.GPS_SB) {
      const BATCH = 50;
      for (let i = 0; i < nums.length; i += BATCH) {
        const batch = nums.slice(i, i + BATCH);
        const inList = batch.join(',');
        GPS_SB._patch('gps_barridos',
          `empresa_id=eq.${emp}&plataforma=eq.${plat}&num_economico=in.(${inList})`,
          { desinstalado: true, desinstalacion_fecha: ahora,
            desinstalacion_comentario: comentario.trim(), desinstalacion_ts: ahora }
        ).catch(e => console.warn('[_desinstalarSeleccionadasPlat]', e.message));
      }
    }

    _platSeleccionadas.clear();
    toast(`🔧 ${ok} unidades marcadas como desinstaladas en ${plat}`, 'success', 4000);
    _refreshPlatTable(plat);
  }

  async function _eliminarUnidadDePlat(num, plat, emp) {
    const okDelU = await _uiConfirm({
      title: `Eliminar unidad ${num} de ${plat}`,
      message: 'La unidad seguirá existiendo en otras plataformas y en la asignación.',
      icon: '🗑', danger: true, okText: 'Eliminar', cancelText: 'Cancelar'
    });
    if (!okDelU) return;
    const platKey = 'ultima_act_' + plat.toLowerCase();
    DB.upsertUnidad(num, { [platKey]: null, _fuente: 'eliminar_plat' }, emp);
    if (window.GPS_SB) {
      GPS_SB._patch('gps_barridos',
        `empresa_id=eq.${encodeURIComponent(emp)}&plataforma=eq.${plat}&num_economico=eq.${encodeURIComponent(num)}`,
        { activa: false }
      ).catch(() => {});
    }
    toast(`Unidad ${num} eliminada de ${plat}`, 'warn');
    _refreshPlatTable(plat);
  }


  // Doble clic en fila VOLVO/MOTIVE: pre-llena el form con datos de la unidad
  function _editarCapturaManuaRow(num, plat) {
    const emp = DB.getEmpresaActiva();
    const u = DB.getUnidad(num, emp);
    if (!u) return;
    _platDetailUnit = null;
    if ($('pf-m-num'))    $('pf-m-num').value    = num;
    if ($('pf-m-base'))   $('pf-m-base').value   = u.base || '';
    if ($('pf-m-crom'))   $('pf-m-crom').value   = u.cromatica || '';
    if ($('pf-m-modelo')) $('pf-m-modelo').value = u.modelo || '';
    if ($('pf-m-id'))     $('pf-m-id').value     = u.placa || '';
    const eFecha = $('pf-m-fecha');
    if (eFecha) {
      const now = new Date();
      const pad = n => String(n).padStart(2,'0');
      eFecha.value = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
      _recalcularDiasManual();
    }
    const bar = $('pf-manual-bar');
    if (bar) bar.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (eFecha) eFecha.focus();
  }

  function _updatePlatFechaConISO(num,plat,emp,iso){
    const k='ultima_act_'+plat.toLowerCase();
    const u=DB.getUnidad(num,emp);
    const datos={[k]:iso,plataforma:plat};
    if(!u?.ultima_act||new Date(iso)>new Date(u.ultima_act)) datos.ultima_act=iso;
    DB.upsertUnidad(num,datos,emp);
    toast(`${plat} actualizado para unidad ${num}`,'success');
    renderDetalle(num,emp);
  }

  /* ══ MODAL: REGISTRAR FALLA ═══════════════════════════ */
  function openRegistrarFalla(num,emp) {
    emp = emp || DB.getEmpresaActiva();
    const u = DB.getUnidad(num, emp);
    const fallasActivas = (u && u.fallas || []).filter(f => !f.resuelta);

    // Si ya tiene falla activa → mostrar la falla existente, no formulario nuevo
    if (fallasActivas.length > 0) {
      const f = fallasActivas[fallasActivas.length - 1];
      const color = f.esSiniestro ? 'var(--red)' : 'var(--yellow)';
      const borderC = f.esSiniestro ? 'rgba(239,68,68,.5)' : 'rgba(245,158,11,.4)';
      const bgC = f.esSiniestro ? 'rgba(239,68,68,.08)' : 'rgba(245,158,11,.08)';
      const icon = f.esSiniestro ? '🚨' : '⚠';
      const titulo = f.esSiniestro ? 'SINIESTRO ACTIVO' : 'FALLA ACTIVA';
      openModal(`
        <div style="background:var(--bg-panel);border:1px solid ${borderC};border-radius:14px;width:520px;max-height:85vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,.6)">
          <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center">
            <span style="font-size:18px;margin-right:8px">${icon}</span>
            <h3 style="font-size:14px;font-weight:600;flex:1;color:${color}">${titulo} — Unidad ${esc(num)}</h3>
            <button onclick="UI.closeModal()" style="background:none;border:none;color:var(--text2);cursor:pointer;font-size:18px">✕</button>
          </div>
          <div style="padding:18px 20px">
            <div style="background:${bgC};border:1px solid ${borderC};border-radius:10px;padding:14px;margin-bottom:14px">
              <div style="font-size:13px;font-weight:700;margin-bottom:8px;color:${color}">${esc(f.motivo||'Sin motivo')}</div>
              ${f.descripcion?`<div style="font-size:12px;color:var(--text2);margin-bottom:6px">${esc(f.descripcion)}</div>`:''}
              ${f.ubicacion?`<div style="font-size:11px;color:var(--text3)">📍 ${esc(f.ubicacion)}</div>`:''}
              <div style="font-size:11px;color:var(--text3);margin-top:6px">Registrada: ${Parsers.fmtDate(f.fechaOcurrencia||f.fecha)}</div>
            </div>
            <div style="font-size:12px;color:var(--text3);margin-bottom:6px">Esta unidad ya tiene una falla activa. ¿Qué deseas hacer?</div>
          </div>
          <div style="padding:12px 20px;border-top:1px solid var(--border);display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
            <button onclick="UI.closeModal();UI._marcarFallaResuelta('${esc(num)}','${esc(emp)}',${f.id})" class="act-btn-ok" style="flex:1">✓ Marcar resuelta</button>
            <button onclick="UI._abrirFormNuevaFalla('${esc(num)}','${esc(emp)}')" class="act-btn" style="flex:1;border-color:var(--red);color:var(--red)">+ Nueva falla adicional</button>
            <button onclick="UI.closeModal()" class="act-btn" style="flex:1">Cerrar</button>
          </div>
        </div>`);
      return;
    }

    // Sin falla activa → formulario normal
    _abrirFormNuevaFalla(num, emp);
  }

  function _abrirFormNuevaFalla(num, emp) {
    openModal(`
      <div style="background:var(--bg-panel);border:1px solid var(--border2);border-radius:14px;width:500px;max-height:85vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,.6)">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center">
          <span style="font-size:18px;margin-right:8px">⚠</span>
          <h3 style="font-size:14px;font-weight:600;flex:1">Registrar falla — Unidad ${esc(num)}</h3>
          <button onclick="UI.closeModal()" style="background:none;border:none;color:var(--text2);cursor:pointer;font-size:18px">✕</button>
        </div>
        <div style="padding:18px 20px">
          <div style="margin-bottom:12px">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:10px;border-radius:8px;border:1px solid var(--border2);background:var(--bg-card)">
              <input type="checkbox" id="f-es-siniestro" style="width:16px;height:16px;accent-color:var(--red)">
              <span style="font-size:13px;font-weight:600;color:var(--red)">🚨 Es un siniestro</span>
            </label>
          </div>
          ${_formGroup('Motivo de la falla *','f-motivo','text','','Ej: Motor, GPS desconectado, Accidente...')}
          ${_formGroup('Descripción detallada','f-desc-falla','textarea','',' ')}
          <div style="margin-bottom:12px">
            <label style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text3);display:block;margin-bottom:5px">Fecha y hora del incidente</label>
            <div style="display:flex;gap:8px">
              <input type="datetime-local" id="f-fecha-falla" value="${new Date().toISOString().substring(0,16)}"
                style="flex:1;background:var(--bg-card);border:1px solid var(--border2);border-radius:7px;padding:7px 10px;color:var(--text);font-family:var(--font);font-size:12px">
            </div>
          </div>
          ${_formGroup('Ubicación actual de la unidad','f-ubic-falla','text','','Ej: Estacionamiento MTY, Taller ACAY...')}
          <div id="f-err-falla" style="color:var(--red);font-size:11px;min-height:14px"></div>
        </div>
        <div style="padding:12px 20px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px">
          <button onclick="UI.closeModal()" class="act-btn">Cancelar</button>
          <button onclick="UI._guardarFalla('${esc(num)}','${esc(emp)}')" class="act-btn-primary" style="background:var(--red)">Registrar falla</button>
        </div>
      </div>`);
  }
  function _guardarFalla(num,emp){
    const motivo=$('f-motivo')?.value.trim();
    if(!motivo){if($('f-err-falla'))$('f-err-falla').textContent='El motivo es requerido';return;}
    const fichaFalla={
      motivo,
      descripcion:$('f-desc-falla')?.value.trim()||'',
      fechaOcurrencia:$('f-fecha-falla')?.value?new Date($('f-fecha-falla').value).toISOString():'',
      ubicacion:$('f-ubic-falla')?.value.trim()||'',
      esSiniestro:$('f-es-siniestro')?.checked||false
    };
    DB.registrarFalla(num,emp,fichaFalla);
    // Sincronizar observaciones con el motivo de la falla (local + Supabase)
    const etiqueta = fichaFalla.esSiniestro ? fichaFalla.motivo : fichaFalla.motivo;
    DB.upsertUnidad(num, { observaciones: etiqueta, _fuente: 'falla_sync' }, emp);
    // Actualizar observaciones en gps_barridos de Supabase para todos los navegadores
    if (window.GPS_SB) {
      const plataformas = ['CEIBA','SAMSARA','AVL','SCANIA','MAN','VOLVO','MOTIVE'];
      plataformas.forEach(plat => {
        GPS_SB._patch('gps_barridos',
          `empresa_id=eq.${encodeURIComponent(emp)}&plataforma=eq.${plat}&num_economico=eq.${encodeURIComponent(num)}`,
          { datos_raw: { observaciones: etiqueta } }
        ).catch(()=>{});
      });
    }
    closeModal();
    toast(`Falla registrada en unidad ${num}${fichaFalla.esSiniestro?' — SINIESTRO':''}`,'warn',5000);
    renderDetalle(num,emp);
  }

  function _marcarFallaResuelta(num, emp, fallaId) {
    openModal(`
      <div style="background:var(--bg-panel);border:1px solid var(--green-border);border-radius:12px;padding:22px;width:400px">
        <div style="font-size:14px;font-weight:600;margin-bottom:10px;color:var(--green)">✓ Marcar falla como resuelta</div>
        <div style="font-size:12px;color:var(--text3);margin-bottom:12px">La falla se conservará en el historial marcada como resuelta.</div>
        <label style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text3);display:block;margin-bottom:5px">Descripción de la solución (opcional)</label>
        <textarea id="fix-motivo" rows="3" placeholder="Ej: Se reemplazó antena GPS, sistema restaurado..." style="width:100%;background:var(--bg-card);border:1px solid var(--border2);border-radius:7px;padding:8px 10px;color:var(--text);font-family:var(--font);font-size:12px;resize:vertical"></textarea>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
          <button onclick="UI.closeModal()" class="act-btn">Cancelar</button>
          <button onclick="UI._confirmarResolverFalla('${esc(num)}','${esc(emp)}',${fallaId})" class="act-btn-ok">✓ Marcar resuelta</button>
        </div>
      </div>`);
  }
  function _confirmarResolverFalla(num, emp, fallaId) {
    const motivo = $('fix-motivo')?.value.trim() || '';
    const ok = DB.resolverFalla(num, emp, Number(fallaId), motivo);
    closeModal();
    if (ok) {
      const _uR = DB.getUnidad(num, emp);
      const _rest = (_uR?.fallas||[]).filter(f=>!f.resuelta);
      DB.upsertUnidad(num, { observaciones: _rest.length ? _rest[0].motivo||'' : '' }, emp);
      toast('Falla marcada como resuelta','success');
      renderDetalle(num, emp);
    } else { toast('No se pudo actualizar la falla','error'); }
  }
  function _eliminarFalla(num, emp, fallaId) {
    openModal(`
      <div style="background:var(--bg-panel);border:1px solid var(--red-border);border-radius:12px;padding:22px;width:380px;text-align:center">
        <div style="font-size:28px;margin-bottom:8px">🗑</div>
        <div style="font-size:14px;font-weight:600;margin-bottom:6px">¿Eliminar ficha de falla?</div>
        <div style="font-size:12px;color:var(--text3);margin-bottom:16px">Esta acción no se puede deshacer. Considera marcarla como resuelta en lugar de eliminarla.</div>
        <div style="display:flex;gap:8px;justify-content:center">
          <button onclick="UI.closeModal()" class="act-btn">Cancelar</button>
          <button onclick="UI._confirmarEliminarFalla('${esc(num)}','${esc(emp)}',${fallaId})" class="act-btn-danger-soft" style="color:var(--red)">Sí, eliminar</button>
        </div>
      </div>`);
  }
  function _confirmarEliminarFalla(num, emp, fallaId) {
    const ok = DB.eliminarFalla(num, emp, Number(fallaId));
    closeModal();
    if (ok) { toast('Falla eliminada','error'); renderDetalle(num, emp); }
    else    { toast('No se pudo eliminar','error'); }
  }

  /* ══ MODAL: NUEVA/EDITAR UNIDAD ═══════════════════════ */
  function _formGroup(label,id,type,val,ph,opts={}){
    if(type==='textarea')return`<div style="margin-bottom:11px"><label style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text3);display:block;margin-bottom:4px">${label}</label><textarea id="${id}" rows="3" placeholder="${esc(ph)}" style="width:100%;background:var(--bg-card);border:1px solid var(--border2);border-radius:7px;padding:7px 10px;color:var(--text);font-family:var(--font);font-size:12px;resize:vertical">${esc(String(val||''))}</textarea></div>`;
    if(type==='select')return`<div style="margin-bottom:11px"><label style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text3);display:block;margin-bottom:4px">${label}</label><select id="${id}" style="width:100%;background:var(--bg-card);border:1px solid var(--border2);border-radius:7px;padding:7px 10px;color:var(--text);font-family:var(--font);font-size:12px;appearance:none">${(opts.options||[]).map(o=>`<option value="${esc(o.v||o)}" ${(o.v||o)===val?'selected':''}>${esc(o.l||o||'— seleccionar —')}</option>`).join('')}</select></div>`;
    return`<div style="margin-bottom:11px"><label style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text3);display:block;margin-bottom:4px">${label}</label><input id="${id}" type="${type}" value="${esc(String(val||''))}" placeholder="${esc(ph)}" style="width:100%;background:var(--bg-card);border:1px solid var(--border2);border-radius:7px;padding:7px 10px;color:var(--text);font-family:var(--font);font-size:12px"></div>`;
  }

  function openEditarUnidad(num,emp){
    emp=emp||DB.getEmpresaActiva();
    const u=num?DB.getUnidad(num,emp):null;
    const isNew=!u;

    // ComboBox tipo de registro
    const tipoActual=isNew?'asignacion':(u?.plataforma?'barrido':'asignacion');

    openModal(`
      <div style="background:var(--bg-panel);border:1px solid var(--border2);border-radius:14px;width:620px;max-height:88vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,.6)">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center">
          <h3 style="font-size:14px;font-weight:600;flex:1">${isNew?'Nueva Unidad — Captura Manual':`Editar Unidad #${esc(u.num)}`}</h3>
          <button onclick="UI.closeModal()" style="background:none;border:none;color:var(--text2);cursor:pointer;font-size:18px">✕</button>
        </div>
        <div style="padding:18px 20px">
          <!-- Tipo de registro -->
          <div style="margin-bottom:16px">
            <label style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text3);display:block;margin-bottom:6px">Tipo de captura</label>
            <div style="display:flex;gap:8px">
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:8px 14px;border-radius:8px;border:1px solid var(--border2);background:var(--bg-card);flex:1">
                <input type="radio" name="tipo-reg" value="asignacion" ${tipoActual==='asignacion'?'checked':''} onchange="UI._switchTipoReg(this.value)" style="accent-color:var(--blue)">
                <span style="font-size:12px;font-weight:500">📋 Unidad de asignación</span>
              </label>
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:8px 14px;border-radius:8px;border:1px solid var(--border2);background:var(--bg-card);flex:1">
                <input type="radio" name="tipo-reg" value="barrido" ${tipoActual==='barrido'?'checked':''} onchange="UI._switchTipoReg(this.value)" style="accent-color:var(--green)">
                <span style="font-size:12px;font-weight:500">📡 Unidad de barrido</span>
              </label>
            </div>
          </div>

          <!-- CAMPOS COMUNES -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 14px">
            <div id="f-num-wrap">
              <div style="margin-bottom:11px">
                <label style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text3);display:block;margin-bottom:4px">Número / Económico *</label>
                <input id="f-num" type="text" value="${esc(u?.num||u?.economico||'')}" placeholder="Ej: 2280"
                  style="width:100%;background:var(--bg-card);border:1px solid var(--border2);border-radius:7px;padding:7px 10px;color:var(--text);font-family:var(--font);font-size:12px">
              </div>
            </div>
            ${_formGroup('Empresa *','f-empresa','text',u?.empresa_asig||emp,'ETN, AERS...')}
          </div>

          <!-- ASIGNACIÓN FIELDS -->
          <div id="fields-asignacion" style="display:grid;grid-template-columns:1fr 1fr;gap:0 14px">
            ${comboWithOther('Base','f-base','bases',u?.base||'',true)}
            ${comboWithOther('Cromática','f-crom','cromaticas',u?.cromatica||'',true)}
            ${_formGroup('Modelo *','f-mod','text',u?.modelo||'','Volvo 9700 Luxury 2013...')}
            ${_formGroup('Estatus asignación *','f-est','select',u?.estatus||'',''  ,{options:['','En operación','Arrendamiento','Para venta','Fuera de operación','Rentado a SAME','Baja','Siniestro']})}
            ${_formGroup('Rol *','f-rol','text',u?.rol||'','SAT, QUER, MEXP...')}
            ${_formGroup('Placa / Tarjeta','f-placa','text',u?.placa||'','')}
            ${_formGroup('Serie / VIN','f-serie','text',u?.serie||'','WMAR...')}
            ${_formGroup('Motor','f-motor','text',u?.motor||'','')}
            ${_formGroup('Asientos','f-asientos','number',u?.asientos||'','')}
            ${_formGroup('Mes asignación','f-mes','text',u?.mes||new Date().toLocaleDateString('es-MX',{month:'long',year:'numeric'}),'')}
          </div>

          <!-- BARRIDO FIELDS (inicialmente oculto si tipo=asignacion) -->
          <div id="fields-barrido" style="display:${tipoActual==='barrido'?'grid':'none'};grid-template-columns:1fr 1fr;gap:0 14px">
            ${_formGroup('Plataforma GPS *','f-plat','select',u?.plataforma||'','',{options:['','CEIBA','SAMSARA','AVL','SCANIA','MAN','VOLVO','MOTIVE']})}
            <div style="margin-bottom:11px">
              <label style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text3);display:block;margin-bottom:4px">Fecha última actualización GPS</label>
              <div style="display:flex;gap:6px">
                <input type="datetime-local" id="f-ultact" value="${u?.ultima_act?u.ultima_act.substring(0,16):''}"
                  style="flex:1;background:var(--bg-card);border:1px solid var(--border2);border-radius:7px;padding:7px 10px;color:var(--text);font-family:var(--font);font-size:12px">
                <button onclick="UI.openDatePicker(document.getElementById('f-ultact').value||null,iso=>{document.getElementById('f-ultact').value=iso.substring(0,16)},'Seleccionar fecha GPS')" style="padding:7px 10px;border-radius:7px;background:var(--bg-card2);border:1px solid var(--border);color:var(--text2);cursor:pointer;font-size:14px">📅</button>
              </div>
            </div>
            ${_formGroup('VIN / Número de serie del dispositivo','f-vin','text',u?.serie||'','GUJ3-X65-7NC, WMAR...')}
          </div>

          <!-- OBSERVACIONES -->
          ${_formGroup('Observaciones','f-obs','textarea',u?.observaciones||'','AFR, Siniestro, otro motivo...')}

          <div id="form-err" style="color:var(--red);font-size:11px;min-height:14px"></div>
        </div>
        <div style="padding:12px 20px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap">
          <button onclick="UI.closeModal()" class="act-btn">Cancelar</button>
          ${isNew?`<button onclick="UI._guardarUnidad('','${esc(emp)}',true)" class="act-btn">💾 Guardar y agregar otra</button>`:''}
          <button onclick="UI._guardarUnidad('${esc(num||'')}','${esc(emp)}',false)" class="act-btn-primary">Guardar unidad</button>
        </div>
      </div>`);
  }

  function _switchTipoReg(tipo){
    const fa=$('fields-asignacion'), fb=$('fields-barrido');
    if(fa) fa.style.display=tipo==='asignacion'?'grid':'none';
    if(fb) fb.style.display=tipo==='barrido'?'grid':'none';
  }

  function _guardarUnidad(numOrig,emp,continuar){
    const numVal=$('f-num')?.value.trim();
    const ferr=$('form-err');
    if(!numVal){if(ferr)ferr.textContent='El número de unidad es requerido';return;}

    const tipo=document.querySelector('input[name="tipo-reg"]:checked')?.value||'asignacion';
    const plat=$('f-plat')?.value;
    const ultActV=$('f-ultact')?.value;
    const ultActISO=ultActV?new Date(ultActV).toISOString():'';

    // Verificar duplicado
    if(!numOrig){
      const existe=DB.getUnidad(numVal,emp);
      if(existe){
        if(ferr)ferr.textContent=`La unidad ${numVal} ya existe en la posición registrada`;
        return;
      }
    }

    // Leer valores de ComboBox (maneja "Otro")
    const baseVal = readComboValue('f-base') || $('f-base')?.value || '';
    const cromVal = readComboValue('f-crom') || $('f-crom')?.value || '';

    const datos={
      economico:    numVal,
      empresa_asig: $('f-empresa')?.value.trim()||emp,
      base:         baseVal,
      cromatica:    cromVal,
      modelo:       $('f-mod')?.value.trim()||'',
      estatus:      $('f-est')?.value||'',
      rol:          $('f-rol')?.value.trim()||'',
      placa:        $('f-placa')?.value.trim()||'',
      serie:        $('f-serie')?.value.trim()||$('f-vin')?.value.trim()||'',
      motor:        $('f-motor')?.value.trim()||'',
      asientos:     $('f-asientos')?.value.trim()||'',
      mes:          $('f-mes')?.value.trim()||'',
      plataforma:   plat||'',
      observaciones:$('f-obs')?.value.trim()||'',
      activa:       true,
      _fuente:      'manual'
    };

    if(ultActISO){
      datos.ultima_act=ultActISO;
      if(plat) datos['ultima_act_'+plat.toLowerCase()]=ultActISO;
    }

    // Normalizar claves para que coincidan con DB local Y Supabase (gps_unidades)
    const datosDB = {
      ...datos,
      num:      numVal,
      serie:    datos.serie,
      mes:      datos.mes,
      // aliases para Supabase (columnas reales)
      serie_vin: datos.serie,
      mes_asig:  datos.mes,
    };
    DB.upsertUnidad(numVal, datosDB, emp);
    DB.addLog('manual',`Unidad ${numVal} guardada manualmente (${tipo})`,emp);

    // ── Persistir en Supabase ──────────────────────────────────────────
    if (window.GPS_SB) {
      // Payload mapeado a columnas reales de gps_unidades
      const sbPayload = {
        base:          datos.base         || null,
        cromatica:     datos.cromatica    || null,
        modelo:        datos.modelo       || null,
        estatus:       datos.estatus      || null,
        rol:           datos.rol          || null,
        placa:         datos.placa        || null,
        serie_vin:     datos.serie        || null,
        motor:         datos.motor        || null,
        asientos:      datos.asientos     ? String(datos.asientos) : null,
        mes_asig:      datos.mes          || null,
        observaciones: datos.observaciones|| null,
        activa:        true,
      };
      GPS_SB.upsertUnidad({ num: numVal, ...sbPayload }, emp)
        .then(() => {
          // Si tiene plataforma GPS, también guardar el barrido
          if (datos.plataforma && datos.ultima_act) {
            const raw = { num: numVal, fecha: datos.ultima_act, fechaStr: datos.ultima_act, plataforma: datos.plataforma };
            return GPS_SB.saveBarrido(datos.plataforma, [raw], emp);
          }
        })
        .catch(e => console.warn('[_guardarUnidad Supabase]', e));
    }

    if (continuar) {
      toast(`✓ Unidad ${numVal} guardada — Agrega la siguiente`,'success',2500);
      closeModal();
      setTimeout(()=>{
        openEditarUnidad(null, emp);
        setTimeout(()=>{
          const radio = document.querySelector(`input[name="tipo-reg"][value="${tipo}"]`);
          if (radio) { radio.checked = true; _switchTipoReg(tipo); }
        }, 50);
      }, 100);
      return;
    }

    closeModal();
    toast(`Unidad ${numVal} guardada ✓`,'success');

    const active=document.querySelector('.panel.active');
    if(active?.id==='panel-detalle') renderDetalle(numVal,emp);
    else renderResumen();
  }

  /* ══════════════════════════════════════════════════════
     CARGA ASIGNACIÓN — FUNCIONAL
  ══════════════════════════════════════════════════════ */
  let _asigPending=null;

  function _setStep(prefix,n){for(let i=1;i<=5;i++){const el=$(prefix+i);if(!el)continue;el.classList.remove('done','active');if(i<n)el.classList.add('done');else if(i===n)el.classList.add('active');}}
  function _alertCarga(id,msg,type){const el=$(id);if(!el)return;const c={success:'#10b981',error:'#ef4444',info:'#3b82f6',warn:'#f59e0b'}[type]||'#3b82f6';el.innerHTML=`<div style="padding:9px 13px;border-radius:7px;font-size:12px;background:${c}18;color:${c};border:1px solid ${c}44;display:flex;align-items:center;gap:8px">${{success:'✓',error:'✕',info:'ℹ',warn:'⚠'}[type]||'ℹ'} ${esc(msg)}</div>`;}

  async function handleAsigFile(file){
    if(!file)return;
    _asigPending=null;
    _setStep('cstep-',1);
    _alertCarga('asig-alert',`Leyendo "${file.name}"...`,'info');

    try{
      _setStep('cstep-',2);
      const {sheets,sheetNames}=await Parsers.readXLSX(file);
      _setStep('cstep-',3);

      // Seleccionar hoja Detalle1
      const sheetName=Parsers.selectSheet(sheets,sheetNames,'ASIGNACION');
      const rows=sheets[sheetName];
      _alertCarga('asig-alert',`Hoja "${sheetName}": ${rows.length} filas. Detectando columnas...`,'info');

      _setStep('cstep-',4);
      const parsed=Parsers.parseAsignacion(rows);

      if(!parsed.length){
        _alertCarga('asig-alert','No se detectaron datos válidos. Verifica que el archivo sea el de asignación con la hoja Detalle1.','error');
        _setStep('cstep-',1);
        return;
      }

      _asigPending=parsed;
      _setStep('cstep-',5);

      // Mostrar info
      if($('asig-det-type'))   $('asig-det-type').textContent='ASIGNACIÓN (DISTRIBUCIÓN)';
      if($('asig-det-file'))   $('asig-det-file').textContent=file.name;
      if($('asig-det-sheet'))  $('asig-det-sheet').textContent=sheetName;
      if($('asig-summary-rows'))  $('asig-summary-rows').textContent=parsed.length;
      if($('asig-summary-valid')) $('asig-summary-valid').textContent=`${parsed.length} (100%)`;
      if($('asig-det-banner'))    $('asig-det-banner').classList.remove('hidden');
      if($('asig-preview-section'))$('asig-preview-section').classList.remove('hidden');
      if($('btn-procesar-asig'))   $('btn-procesar-asig').disabled=false;

      // Verificar datos de muestra
      const sample=parsed.slice(0,3);
      const tieneBase=sample.filter(r=>r.base).length>0;
      const tieneCrom=sample.filter(r=>r.cromatica).length>0;
      const tieneEst =sample.filter(r=>r.estatus).length>0;
      _alertCarga('asig-alert',`✓ ${parsed.length} unidades detectadas. Base: ${tieneBase?'OK':'⚠ revisar'} · Cromática: ${tieneCrom?'OK':'⚠ revisar'} · Estatus: ${tieneEst?'OK':'⚠ revisar'}`,'success');

      // Preview table
      const prevBody=$('asig-preview-body');
      if(prevBody) prevBody.innerHTML=parsed.slice(0,5).map(r=>`<tr>
        <td>${esc(r.num)}</td><td>${esc(r.base)}</td><td>${esc(r.cromatica)}</td>
        <td>${esc(r.modelo)}</td><td>${estatusBadge(r.estatus)}</td>
        <td>${esc(r.empresa)}</td><td style="max-width:80px;overflow:hidden;text-overflow:ellipsis">${esc(r.serie)}</td>
        <td>${esc(r.rol)}</td></tr>`).join('');

    }catch(err){
      _setStep('cstep-',1);
      _alertCarga('asig-alert','Error al procesar: '+err.message,'error');
      console.error('[handleAsigFile]',err);
    }
  }

  function procesarAsig(){
    if(!_asigPending?.length)return;
    const mes=prompt('Periodo/mes de esta asignación:',new Date().toLocaleDateString('es-MX',{month:'long',year:'numeric'}));
    if(!mes)return;
    const marcar=confirm('¿Marcar como inactivas las unidades que NO aparezcan en esta asignación?\n\n(Recomendado si es la asignación completa del mes)');
    const res=DB.saveAsignacion(mes,_asigPending,null,{marcarInactivas:marcar});
    toast(`✓ Asignación "${mes}": ${res.total} unidades (${res.creadas} nuevas, ${res.actualizadas} actualizadas${marcar?', '+res.inactivadas+' inactivadas':''})`,'success',6000);
    _asigPending=null;
    if($('btn-procesar-asig')) $('btn-procesar-asig').disabled=true;
    _setStep('cstep-',1);
    ['asig-det-banner','asig-preview-section'].forEach(id=>{const e=$(id);if(e)e.classList.add('hidden');});
    App.nav(null,'panel-asignacion');
  }

  /* ══════════════════════════════════════════════════════
     BARRIDOS — FUNCIONAL
  ══════════════════════════════════════════════════════ */
  let _barridosPending={};

  function renderBarridos(){
    const emp=DB.getEmpresaActiva();
    const bArr=DB.getBarridos(emp);
    const el=$('barridos-recientes');
    if(el){
      if(!bArr.length){el.innerHTML=`<div class="empty-state" style="padding:16px">Sin cargas registradas</div>`;}
      else{
        el.innerHTML=bArr.slice(0,10).map(b=>`
          <div style="display:flex;gap:10px;align-items:center;padding:9px 14px;border-bottom:1px solid var(--border);cursor:default">
            ${platIcon(b.plataforma,28)}
            <div style="flex:1;min-width:0">
              <div style="font-size:11px;color:var(--text3)">${Parsers.fmtDate(b.fecha)}</div>
              <div style="font-size:12px;font-weight:600">${b.plataforma}</div>
              <div style="font-size:10px;color:var(--green)">✓ ${b.actualizadas} actualizadas · ${b.noEncontradas||0} sin asignación</div>
            </div>
            <div style="font-size:11px;color:var(--text3);text-align:right">${b.totalRegistros.toLocaleString()}<br>registros</div>
          </div>`).join('');
      }
    }
    _refreshLog();
  }

  function _refreshLog(){
    const el=$('log-processing');
    if(!el)return;
    const hist=DB.getHistorialGlobal(40);
    if(!hist.length){el.innerHTML='<div style="color:var(--text3);font-size:11px">Sistema listo.</div>';return;}
    el.innerHTML=hist.map(h=>{
      const c=h.tipo==='error'?'#ef4444':h.tipo==='barrido'?'#10b981':h.tipo==='asignacion'?'#3b82f6':h.tipo==='manual'?'#a78bfa':'#9ca3af';
      return`<div style="padding:1px 0"><span style="color:var(--text3);font-size:10px">${Parsers.fmtTime(h.fecha)} </span><span style="color:${c};font-size:11px">${esc(h.mensaje)}</span></div>`;
    }).join('');
    el.scrollTop=el.scrollHeight;
  }

  async function handleBarridoFiles(files){
    if(!files||!files.length)return;
    _barridosPending={};
    _setStep('bstep-',2);

    for(const file of files){
      try{
        _setStep('bstep-',3);
        const {sheets,sheetNames,isAVL}=await Parsers.readXLSX(file);

        // Detectar plataforma usando nombre de archivo + estructura de hojas
        let plat = Parsers.detectarPlataforma(file.name, sheetNames);
        if (!plat && isAVL) plat = 'AVL';
        if(!plat||plat==='ASIGNACION'){
          plat=prompt(`No se pudo detectar la plataforma de:\n"${file.name}"\n(hojas: ${sheetNames.join(', ')})\n\nEscribe: CEIBA / SAMSARA / AVL / SCANIA / MAN / VOLVO / MOTIVE`,'');
          if(!plat) continue;
          plat=plat.trim().toUpperCase();
        }

        _setStep('bstep-',4);
        const sheetName=Parsers.selectSheet(sheets,sheetNames,plat);

        // Para AVL: verificar explícitamente que no sea "Content"
        if (plat === 'AVL' && (!sheetName || sheetName.toLowerCase().includes('content'))) {
          DB.addLog('error',`"${file.name}": no se encontró la hoja "Últimos datos de la unidad" (solo hay: ${sheetNames.join(', ')})`);
          _refreshLog();
          continue;
        }

        const rows=sheets[sheetName];
        if (!rows || rows.length < 2) {
          DB.addLog('error',`"${file.name}": hoja "${sheetName}" vacía`);
          _refreshLog();
          continue;
        }

        const parsed=Parsers.parsearPorPlataforma(plat,rows);
        const val=Parsers.validarResultado(parsed);
        _barridosPending[plat]={parsed,filename:file.name,val,sheetName};
        DB.addLog('info',`"${file.name}" → ${plat} (hoja: "${sheetName}"): ${parsed.length} registros, ${val.conFecha} con fecha`);
        _refreshLog();
      }catch(err){
        DB.addLog('error',`Error en "${file.name}": ${err.message}`);
        _refreshLog();
        toast(`Error en "${file.name}": ${err.message}`,'error');
        console.error('[handleBarridoFiles]',err);
      }
    }

    _setStep('bstep-',5);
    _renderPlatDetectCards();
    _updateBarridoResumen();
    const n=Object.keys(_barridosPending).length;
    if(n) toast(`${n} archivo(s) procesado(s) y listo(s) para integrar`,'info');
  }

  function _renderPlatDetectCards(){
    const el=$('plat-detect-cards');
    if(!el)return;
    const COLS={CEIBA:'Plate No. | GPS Time | Serial No.',SAMSARA:'Nombre | Última hora de registro | VG/Serie',AVL:'Grouping | Último mensaje',SCANIA:'Vehículo | Hora',MAN:'Dispositivo | VIN | Ultima Conexion',VOLVO:'Vehículo | Tiempo (última actividad)',MOTIVE:'ID Entidad | Última Actividad | Estado | Serie VG | Serie Cam'};
    el.innerHTML=ALL_PLATS.map(p=>{
      const d=_barridosPending[p];
      return`<div style="background:var(--bg-panel);border:1px solid ${d?'var(--green-border)':'var(--border)'};border-top:2px solid ${d?'var(--green)':'var(--border)'};border-radius:10px;padding:12px">
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:7px">${platIcon(p,22)}<div>
          <div style="font-size:12px;font-weight:700">${p}</div>
          <div style="font-size:9px;font-weight:700;text-transform:uppercase;color:${d?'var(--green)':'var(--text3)'}">${d?'DETECTADO':'SIN ARCHIVO'}</div>
        </div></div>
        <div style="font-size:10px;color:var(--text3);margin-bottom:4px">Columnas:</div>
        <div style="font-size:10px;color:${d?'var(--green)':'var(--text3)'};margin-bottom:6px">${COLS[p]||'—'}</div>
        <div style="font-size:11px;color:var(--text3);border-top:1px solid var(--border);padding-top:5px">Registros: ${d?d.parsed.length.toLocaleString()+'  ·  Con fecha: '+d.val.conFecha:'—'}</div>
        ${d?`<div style="font-size:9px;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px" title="${d.filename}">${d.filename}</div>`:''}
      </div>`;
    }).join('');
  }

  function _updateBarridoResumen(){
    const entries=Object.entries(_barridosPending);
    const total=entries.reduce((s,[,v])=>s+v.parsed.length,0);
    if($('br-plats'))     $('br-plats').textContent    =entries.length;
    if($('br-registros')) $('br-registros').textContent=total.toLocaleString();
    if($('br-archivos'))  $('br-archivos').textContent =entries.length;
    if($('br-errores'))   $('br-errores').textContent  ='0';
  }

  async function integrarBarridos(){
    const emp=DB.getEmpresaActiva();
    const entries=Object.entries(_barridosPending);
    if(!entries.length){toast('No hay archivos pendientes','warn');return;}

    let totalAct=0,totalNoEnc=0;

    // 1) Guardar en localStorage (siempre, sin importar conexión)
    entries.forEach(([plat,{parsed}])=>{
      const res=DB.saveBarrido(plat,parsed,emp);
      totalAct+=res.actualizadas;
      totalNoEnc+=res.noEncontradas;
    });

    _barridosPending={};
    _refreshLog();
    toast(`✓ Local: ${totalAct} unidades actualizadas${totalNoEnc?' · '+totalNoEnc+' sin asignación':''}`,'success',4000);
    _setStep('bstep-',1);
    _renderPlatDetectCards();
    _updateBarridoResumen();

    // 2) Sincronizar con Supabase en background (si hay conexión)
    if(window.GPS_SB){
      toast('⏳ Sincronizando con Supabase...','info',3000);
      let sbOk=0, sbErr=0;
      for(const [plat,{parsed}] of entries){
        try{
          const res = await GPS_SB.saveBarrido(plat, parsed, emp);
          sbOk += res.total || 0;
          console.log(`[integrarBarridos] Supabase ${plat}/${emp}: ${res.total} registros OK`);
        }catch(e){
          sbErr++;
          console.warn(`[integrarBarridos] Supabase error en ${plat}:`, e.message);
        }
      }
      if(sbErr===0){
        toast(`☁ Supabase: ${sbOk} registros sincronizados`,'success',4000);
      } else {
        toast(`⚠ Supabase: ${sbOk} OK · ${sbErr} plataforma(s) con error (datos guardados localmente)`,'warn',6000);
      }
    } else {
      toast('📴 Sin conexión — datos guardados localmente, se sincronizarán al reconectar','warn',5000);
    }

    setTimeout(()=>App.nav(null,'panel-resumen'),1200);
  }

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
  let _platDetailUnit = null;
  let _platDetailTab = 'conexiones';
  let _platSeleccionadas = new Set();

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

    // Sincronizar fallas activas de Supabase antes de renderizar
    // para garantizar que u.siniestro esté correcto en todos los dispositivos
    if (window.GPS_SB && !renderPlataformas._syncDone) {
      renderPlataformas._syncDone = true;
      App._syncFallasDesdeInicio && App._syncFallasDesdeInicio().then(() => {
        renderPlataformas();
      });
      // Renderizar con datos actuales mientras llega el sync (no bloquear UI)
    }

    const uns=DB.getUnidadesList(emp).filter(u=>u.activa);

    const cfg=DB.getConfig();
    const hoy=Date.now();

    // Conteos de tarjetas: solo empresa activa
    const todasUns = DB.getUnidadesList(emp).filter(u => u.activa);

    // Para venta: se excluye en la tarjeta de cada plataforma individualmente
    // SAMSARA incluye Para venta si tienen ultima_act_samsara; el resto no.
    const operativas = todasUns.filter(u => !_tieneSiniestroActivo(u));

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
      // SAMSARA: incluir cualquier estatus si tiene ultima_act (del barrido)
      const conFecha = operativas.filter(u => {
        if (!u[k]) return false;
        if (p === 'SAMSARA') return true;
        return Parsers.categorizarEstatus(u.estatus) !== 'Para venta';
      });
      // Excluir siniestros de conteos GPS en tarjetas de plataforma
      const conFechaGPS=conFecha.filter(u=>!_tieneSiniestroActivo(u));
      const enLinea=conFechaGPS.filter(u=>Math.floor((hoy-new Date(u[k]))/86400000)<=cfg.diasLinea).length;
      const fuera=conFechaGPS.length-enLinea;
      const esManual=true; // captura manual en todas las plataformas
      const COLS_MAP={
        CEIBA:'Plate No. | GPS time | Serial No.',
        SAMSARA:'Nombre | Última hora de registro | N° serie',
        AVL:'Grouping | Último mensaje',
        SCANIA:'Vehículo | Hora',
        MAN:'Dispositivo | VIN | Ultima Conexion',
        VOLVO:'Vehículo | Tiempo',
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
          ? `<label class="plat-card-btn-upload">
              ↑ Cargar archivo ${p}
              <input type="file" accept=".xlsx,.xls,.csv" style="display:none" onchange="UI._cargarArchivoPlat('${p}',this.files[0]);this.value=''">
            </label>
            <button class="plat-card-btn-manual" style="margin-top:4px" onclick="UI._abrirCapturaManualPlat('${p}')">+ Captura manual</button>`
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
    const esManual = true; // captura manual en todas las plataformas

    // BASE de unidades para este panel:
    // - Plataformas NO manuales (CEIBA, SAMSARA, AVL, SCANIA, MAN): SOLO unidades que aparecen
    //   en el archivo de esa plataforma (tienen ultima_act_<plat> o fueron cargadas por barrido).
    //   Esto evita que por ejemplo el filtro TAPA muestre unidades sin Samsara.
    // Scope de unidades: siempre por empresa activa
    let scopeUns;
    // SAMSARA: incluir Para venta/Desenrolado si tienen ultima_act_samsara (están en el barrido)
    scopeUns = DB.getUnidadesList(emp).filter(u => {
      if (!u.activa || _tieneSiniestroActivo(u) || !u[k]) return false;
      if (plat === 'SAMSARA') return true; // SAMSARA: cualquier estatus si tiene barrido
      return Parsers.categorizarEstatus(u.estatus) !== 'Para venta';
    });

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
          <div id="plat-bulk-bar" style="display:none;align-items:center;gap:8px">
            <span id="plat-bulk-count" style="font-size:12px;color:var(--text2)"></span>
            <button id="plat-btn-desinstalar" style="background:#78350f22;border:1px solid #f59e0b;color:#fbbf24;border-radius:6px;padding:4px 12px;cursor:pointer;font-size:12px"
              onclick="UI._toggleDesinstalacionMasiva('${plat}','${esc(emp)}')">🔧 Desinstalar equipo</button>
            <button style="background:#ef444422;border:1px solid #ef4444;color:#f87171;border-radius:6px;padding:4px 12px;cursor:pointer;font-size:12px"
              onclick="UI._eliminarSeleccionadasPlat('${plat}')">🗑 Eliminar seleccionadas</button>
            <button class="act-btn" onclick="UI._limpiarSeleccionPlat()">✕ Deseleccionar</button>
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
              options: [...new Set(scopeUns.map(u => Parsers.categorizarEstatus(u.estatus)).filter(Boolean))].sort(),
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
    // SAMSARA: mostrar SOLO unidades con ultima_act_samsara (del archivo de barrido)
    // Incluye cualquier estatus (Para venta, Desenrolado, etc.) si tienen barrido de SAMSARA
    // NO incluye unidades de la asignación que no estén en el archivo de barrido
    let uns = DB.getUnidadesList(emp).filter(u => {
      if (!u.activa || !u[k]) return false; // sin ultima_act → no está en el barrido
      if (plat === 'SAMSARA') return true;  // SAMSARA: cualquier estatus si tiene barrido
      return Parsers.categorizarEstatus(u.estatus) !== 'Para venta';
    });

    // Siniestros activos NO aparecen en tabla de Plataformas GPS.
    // Solo aparecen en Resumen y módulo de Fallas.
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
        const d = Math.floor((hoy - new Date(u[k]))/86400000);
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

    // Búsqueda multi-token: incluye fallas activas, siniestro y observaciones manuales
    if (f.search) {
      uns = uns.filter(u => {
        const _uFull = DB.getUnidad(u.num, emp) || u;
        const _fallaMotivos = (_uFull.fallas||[])
          .filter(f => !f.resuelta)
          .map(f => [f.motivo, f.etiqueta].join(' '))
          .join(' ');
        const _sinLabel = (_uFull.siniestro||u.siniestro) ? 'siniestro' : '';
        const _obsManual = _uFull.observaciones_manual || '';
        const searchStr = [
          u.num, u.base, u.modelo, u.placa, u.serie, u.cromatica, u.empresa_asig,
          u.dvr_ceiba, u.vin_samsara, u.placa_man, u.placa_scania,
          _fallaMotivos, _sinLabel, _obsManual
        ].join(' ');
        return _multiTokenMatch(f.search, searchStr);
      });
    }

    // (Ya no se necesita el filtro especial de Volvo/Motive: el scope por plataforma se aplica
    // igual a todas las plataformas, así que solo aparecen las unidades con datos manuales.)

    // Ordenar por días desc (más fuera primero)
    uns.sort((a,b) => {
      const da = a[k] ? Math.floor((hoy - new Date(a[k]))/86400000) : -1;
      const db = b[k] ? Math.floor((hoy - new Date(b[k]))/86400000) : -1;
      return db - da;
    });

    const wrap = $('plat-table-wrap');
    if (!wrap) return;

    // Summary: el TOTAL ahora es solo del scope de esta plataforma
    const sum = $('plat-table-summary');
    if (sum) {
      // Excluir siniestros activos de conteos GPS en plataformas
      const unsGPS = uns.filter(u => !_tieneSiniestroActivo(u));
      const enLinea  = unsGPS.filter(u => { const d = Math.floor((hoy-new Date(u[k]))/86400000); return d <= cfg.diasLinea; }).length;
      const atencion = unsGPS.filter(u => { const d = Math.floor((hoy-new Date(u[k]))/86400000); return d > cfg.diasLinea && d <= cfg.diasAtencion; }).length;
      const fuera    = unsGPS.filter(u => { const d = Math.floor((hoy-new Date(u[k]))/86400000); return d > cfg.diasAtencion; }).length;
      const sinis    = uns.filter(u => u.siniestro).length;
      sum.innerHTML = `<strong>${uns.length}</strong> unidades en ${plat} · <span style="color:var(--green)">${enLinea} en línea</span> · <span style="color:var(--yellow)">${atencion} atención</span> · <span style="color:var(--red)">${fuera} fuera</span>${sinis?` · <span style="color:#ef4444">🚨 ${sinis} siniestro${sinis>1?'s':''}</span>`:''}`;
    }

    const esManual = true; // captura manual en todas las plataformas

    if (!uns.length) {
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
      <th style="width:28px;text-align:center"><input type="checkbox" id="plat-chk-all" title="Seleccionar todos" style="cursor:pointer;width:14px;height:14px" onchange="UI._toggleSelectAllPlat(this.checked,'${plat}')"></th>
      <th>UNIDAD</th><th>BASE</th><th>CROMÁTICA</th><th>MODELO</th>
      <th>ESTATUS</th>
      ${incluyeEstadoCol ? '<th>ESTADO SAMSARA</th>' : ''}
      ${esMotive ? '<th>ESTADO DISP.</th><th>EMPRESA</th>' : ''}
      <th>${plat} ÚLT. ACTIVIDAD</th><th>DÍAS</th>
      ${esMotive ? '<th>SERIE VG</th><th>SERIE CAM</th>' : `<th>${idLabel}</th>`}
      <th>OBSERVACIONES</th>
      <th style="min-width:140px">NOTAS</th>`;

    const rows = uns.map(u => {
      const fecha = u[k];
      const d = fecha ? Math.floor((hoy - new Date(fecha))/86400000) : null;

      // Estatus: ON-LINE / ATENCION / FUERA / SIN DATOS
      let platBadgeColor, platBadgeLabel;
      if (!fecha)                       { platBadgeColor = 'var(--text3)'; platBadgeLabel = 'SIN DATOS'; }
      else if (d <= cfg.diasLinea)       { platBadgeColor = 'var(--green)'; platBadgeLabel = 'EN LÍNEA'; }
      else if (d <= cfg.diasAtencion)    { platBadgeColor = 'var(--yellow)'; platBadgeLabel = 'ATENCIÓN'; }
      else                               { platBadgeColor = 'var(--red)'; platBadgeLabel = 'FUERA'; }
      const estatusCell = `<span style="display:inline-block;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700;background:${platBadgeColor}22;color:${platBadgeColor};border:1px solid ${platBadgeColor}44">${platBadgeLabel}</span>`;

      // Estado adicional para Samsara — VALOR LITERAL del archivo (col E)
      let estadoSamsaraCell = '';
      if (incluyeEstadoCol) {
        const es = _estadoSamsaraDe(u);
        const cfgEst = {
          FUNCIONANDO:  { c:'#10b981', bg:'rgba(16,185,129,.15)', br:'rgba(16,185,129,.3)', l:'FUNCIONANDO' },
          NO_DETECTADO: { c:'#ef4444', bg:'rgba(239,68,68,.15)', br:'rgba(239,68,68,.3)', l:'NO DETECTADO' },
          SIN_VIN:      { c:'#a78bfa', bg:'rgba(139,92,246,.15)', br:'rgba(139,92,246,.3)', l:'SIN VG' },
          SIN_PLACA:    { c:'#f59e0b', bg:'rgba(245,158,11,.15)', br:'rgba(245,158,11,.3)', l:'SIN PLACA' }
        }[es] || { c:'#9ca3af', bg:'rgba(156,163,175,.15)', br:'rgba(156,163,175,.3)', l: es || '—' };
        estadoSamsaraCell = `<span style="padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700;background:${cfgEst.bg};color:${cfgEst.c};border:1px solid ${cfgEst.br}">${cfgEst.l}</span>`;
      }

      // Identificador SEGÚN la plataforma (desde el campo específico del barrido)
      const idValue = _idValorUnidad(u, plat);
      const selected = _platDetailUnit === u.num ? 'background:rgba(59,130,246,.12)' : '';
      // OBSERVACIONES: solo fallas activas de Supabase/local o lo que el usuario escribió manualmente
      // NO mostrar datos de asignación (técnico, responsable) ni seriales del barrido
      const _uConFallas = DB.getUnidad(u.num, emp) || u;
      const _fallaActiva = (_uConFallas.fallas||[]).find(f => !f.resuelta);
      const _etiquetaFalla = _fallaActiva ? (_fallaActiva.motivo || _fallaActiva.etiqueta || '') : '';
      const _siniestroLabel = (_uConFallas.siniestro || u.siniestro)
        ? ((_uConFallas.siniestroDesc||u.siniestroDesc) ? `🚨 ${_uConFallas.siniestroDesc||u.siniestroDesc}` : '🚨 SINIESTRO') : '';
      // Prioridad de fuentes para el chip de observación:
      // 1. notas (gps_notas en Supabase — fuente de verdad, se sincroniza entre browsers)
      // 2. observaciones_manual (editado directamente desde la tabla)
      // 3. observaciones con _fuente edit_obs
      // 4. siniestro / etiqueta de falla
      const _uFuente = _uConFallas._fuente || u._fuente || '';
      const _notaFuente = (_uConFallas.notas || u.notas || '').trim();
      const _obsManualFuente = (_uConFallas.observaciones_manual || '').trim();
      const _obsFuente = _uFuente.includes('edit_obs')
        ? (_uConFallas.observaciones || u.observaciones || '').trim()
        : '';
      const _obsRawBruta = _notaFuente || _obsManualFuente || _obsFuente;
      const _obsRaw = _obsRawBruta || _siniestroLabel || _etiquetaFalla || '';
      const obsTexto = _obsRaw;
      const _obsChip = (() => {
        if (!_obsRaw) return '';
        const o = _obsRaw.toUpperCase();
        if (o.includes('SIM BAJA') || o === 'SIM BAJA')
          return `<span style="background:#7c3aed22;color:#a78bfa;border:1px solid #7c3aed44;border-radius:4px;padding:1px 6px;font-size:10px;font-weight:600">📵 SIM BAJA</span>`;
        if (o.includes('DVR') && (o.includes('DAÑADO') || o.includes('DANADO') || o.includes('MAL')))
          return `<span style="background:#92400e22;color:#fbbf24;border:1px solid #92400e44;border-radius:4px;padding:1px 6px;font-size:10px;font-weight:600">⚠ DVR</span>`;
        if (o.includes('GPS MAL') || o === 'GPS MAL')
          return `<span style="background:#78350f22;color:#fb923c;border:1px solid #78350f44;border-radius:4px;padding:1px 6px;font-size:10px;font-weight:600">⚠ GPS MAL</span>`;
        if (o.startsWith('🚨') || o.includes('SINIEST'))
          return `<span style="background:#7f1d1d22;color:#f87171;border:1px solid #7f1d1d44;border-radius:4px;padding:1px 6px;font-size:10px;font-weight:600">🚨 ${_obsRaw.replace(/🚨/g,'').trim()}</span>`;
        if (o.includes('AFR') || o.includes('FALLA'))
          return `<span style="background:#78350f22;color:#fb923c;border:1px solid #78350f44;border-radius:4px;padding:1px 6px;font-size:10px;font-weight:600">⚠ ${_obsRaw}</span>`;
        return esc(_obsRaw);
      })();
      const isSelected = _platDetailUnit === u.num;

      // Motive: extraer estado y series de datos_raw si los tiene en barrido
      const motiveRaw = esMotive ? (u._motiveRaw || {}) : {};
      const motiveEstado = motiveRaw.estado || u.estado_motive || '';
      const motiveEmpresa = motiveRaw.empresa || u.empresa_motive || '';
      const motiveSerieVG  = motiveRaw.serieGateway || u.serie_vg_motive || u.motive_vg || '';
      const motiveSerieCam = motiveRaw.serieDashcam  || u.serie_cam_motive || u.motive_cam || '';
      const motiveEstadoCell = esMotive ? (() => {
        const e = String(motiveEstado).toUpperCase();
        const isOff = e.includes('POWERED OFF') || e.includes('OFF');
        const c = isOff ? 'var(--red)' : (e.includes('NORMAL') ? 'var(--green)' : 'var(--text3)');
        return `<span style="padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700;background:${c}22;color:${c};border:1px solid ${c}44">${motiveEstado||'—'}</span>`;
      })() : '';

      const isChecked = _platSeleccionadas.has(u.num);
      const desKey2 = 'desinstalacion_' + plat.toLowerCase();
      const isDesinstalado = !!(DB.getUnidad(u.num, emp)||u)[desKey2];
      return `<tr data-num="${esc(u.num)}" class="plat-row-clickable ${isSelected?'plat-row-selected':''} ${isChecked?'plat-row-checked':''} ${isDesinstalado?'plat-row-desinstalado':''}" style="${isDesinstalado?'opacity:0.45;':''}" onclick="UI._onPlatRowClick('${esc(u.num)}','${plat}')" ondblclick="event.preventDefault();UI._editarCapturaManuaRow('${esc(u.num)}','${plat}')" style="cursor:pointer;user-select:none;-webkit-user-select:none;-moz-user-select:none" title="${esManual?'Doble clic para editar fecha':''}">
        <td style="width:28px;text-align:center" onclick="event.stopPropagation()">
          <input type="checkbox" class="plat-row-chk" data-num="${esc(u.num)}" ${isChecked?'checked':''} style="cursor:pointer;width:14px;height:14px" onchange="UI._onPlatCheckRow('${esc(u.num)}','${plat}',this.checked)">
        </td>
        <td style="font-weight:700">${
          u._sinUnidad || (u.num && u.num.startsWith('SIN-'))
            ? `<span style="font-size:10px;background:var(--yellow)22;color:var(--yellow);border:1px solid var(--yellow)44;border-radius:4px;padding:2px 6px;font-family:monospace" title="Dispositivo sin unidad asignada — Serial: ${esc(u.motive_vg||u.num.replace('SIN-',''))}">PENDIENTE</span>`
            : esc(u.num)
        }</td>
        <td>${esc(u.base||'—')}</td>
        <td>${esc(u.cromatica||'—')}</td>
        <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(u.modelo||'—')}</td>
        <td>${estatusCell}</td>
        ${incluyeEstadoCol ? `<td>${estadoSamsaraCell}</td>` : ''}
        ${esMotive ? `<td>${motiveEstadoCell}</td><td style="font-size:11px">${esc(motiveEmpresa||'—')}</td>` : ''}
        <td style="font-size:11px">${
          fecha === 'PENDIENTE'
            ? '<span style="color:var(--yellow);font-size:10px;font-weight:700">Sin instalar</span>'
            : fecha ? Parsers.fmtDate(fecha) : '<span style="color:var(--text3)">Sin datos</span>'
        }</td>
        <td>${isDesinstalado ? '<span style="background:var(--border2);color:var(--text3);border-radius:4px;padding:1px 7px;font-size:10px;font-weight:700">DESINS.</span>' : (fecha === 'PENDIENTE' ? '<span style="color:var(--yellow);font-size:10px">—</span>' : diasBadge(d))}</td>
        ${esMotive
          ? `<td style="font-family:monospace;font-size:10px">${esc(motiveSerieVG||'—')}</td><td style="font-family:monospace;font-size:10px">${esc(motiveSerieCam||'—')}</td>`
          : `<td style="font-family:monospace;font-size:11px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(idValue)}</td>`
        }
        <td class="plat-obs-cell" style="max-width:220px;color:var(--text2);font-size:11px" onclick="event.stopPropagation();UI._editarObsRapido('${esc(u.num)}','${esc(u.empresa||emp)}','${plat}')" title="Click para editar — ${esc(obsTexto||'sin observación')}">
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;max-width:130px;vertical-align:middle">${_obsChip||'<span style="color:var(--text3);font-style:italic;font-size:11px">+ agregar observación</span>'}</span>
          ${_fallaActiva ? `<button onclick="event.stopPropagation();UI._liberarFallaDesdeTabla('${esc(u.num)}','${esc(u.empresa||emp)}','${plat}')" title="Liberar falla" style="margin-left:4px;background:none;border:1px solid var(--green)44;border-radius:4px;cursor:pointer;color:var(--green);font-size:9px;padding:1px 5px;font-weight:700;vertical-align:middle">✓ Liberar</button>` : ''}
          <span class="plat-obs-pencil" style="opacity:0;margin-left:2px;font-size:10px">✎</span>
        </td>
        <td class="plat-nota-cell" style="max-width:200px;color:var(--text2);font-size:11px" onclick="event.stopPropagation();UI._editarNotaRapido('${esc(u.num)}','${plat}','${esc(u.empresa||emp)}')">
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;max-width:180px;vertical-align:middle">${(() => { const _n=(DB.getUnidad('${esc(u.num)}','${esc(u.empresa||emp)}')||u).notas||''; return _n ? esc(_n) : '<span style=\"color:var(--text3);font-style:italic;font-size:11px\">+ agregar nota</span>'; })()}</span>
          <span style="opacity:0;margin-left:4px;font-size:10px" class="plat-obs-pencil">✎</span>
        </td>
        <td style="width:32px;text-align:center" onclick="event.stopPropagation()">
          <button title="Eliminar unidad de ${plat}"  onclick="UI._eliminarUnidadDePlat('${esc(u.num)}','${plat}','${esc(u.empresa||emp)}')" style="background:none;border:none;cursor:pointer;color:var(--red);font-size:14px;padding:2px 4px;border-radius:4px;opacity:0.6" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.6">✕</button>
        </td>
      </tr>`;
    }).join('');

    // Renderizar tabla + detalle inline (si hay unidad enfocada).
    // IMPORTANTE: el detail inline va FUERA del div con scroll, así siempre es visible
    // inmediatamente al hacer click en una fila, sin necesidad de hacer scroll.
    let html = `<div style="overflow:auto;max-height:55vh"><table style="width:100%;min-width:900px">
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
    const d = fecha ? Math.floor((hoy - new Date(fecha))/86400000) : null;
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

      if (!fe) {
        // Sin datos → muestra "Ingresar fecha"
        return `<div class="plat-inline-card" style="border:1px solid var(--border);border-radius:8px;overflow:hidden">
          <div style="padding:8px 10px;${fondoHeader};display:flex;align-items:center;gap:6px">
            ${platIcon(p, 16)}
            <div style="font-size:11px;font-weight:700;color:${style.color||'var(--text2)'}">${p}</div>
          </div>
          <div style="padding:10px;display:flex;flex-direction:column;gap:6px;align-items:center;justify-content:center;min-height:70px">
            <div style="font-size:10px;color:var(--text3)">Sin datos registrados</div>
            <button class="act-btn-sm" style="font-size:10px;padding:4px 8px" onclick="event.stopPropagation();UI.openDatePicker(null,iso=>{UI._updatePlatFechaConISO('${esc(u.num)}','${p}','${esc(emp)}',iso);UI._refreshPlatTable('${plat}')},'${p} — Ingresar fecha')">+ Ingresar fecha</button>
          </div>
        </div>`;
      }

      const dd = Math.floor((hoy - new Date(fe))/86400000);
      const ddCls = dd <= cfg.diasLinea ? 'var(--green)' : dd <= cfg.diasAtencion ? 'var(--yellow)' : 'var(--red)';
      const ddLabel = dd <= cfg.diasLinea ? 'EN LÍNEA' : dd <= cfg.diasAtencion ? 'ATENCIÓN' : 'FUERA DE LÍNEA';
      return `<div class="plat-inline-card" style="border:1px solid ${ddCls}66;border-radius:8px;overflow:hidden;background:var(--bg-panel)">
        <div style="padding:8px 10px;${fondoHeader};display:flex;align-items:center;gap:6px">
          ${platIcon(p, 16)}
          <div style="font-size:11px;font-weight:700;color:${style.color||'var(--text2)'}">${p}</div>
        </div>
        <div style="padding:10px">
          <div style="font-size:11px;color:var(--text);margin-bottom:2px">${Parsers.fmtDate(fe)}</div>
          <div style="font-size:9px;font-weight:700;color:${ddCls};margin-bottom:4px">${ddLabel}</div>
          <div style="font-size:18px;font-weight:700;color:${ddCls};line-height:1">${dd}<span style="font-size:10px;margin-left:3px;color:var(--text3)">días</span></div>
          <button class="act-btn-sm" style="font-size:10px;padding:3px 7px;margin-top:6px;width:100%" onclick="event.stopPropagation();UI.openDatePicker('${fe}',iso=>{UI._updatePlatFechaConISO('${esc(u.num)}','${p}','${esc(emp)}',iso);UI._refreshPlatTable('${plat}')},'${p} — Actualizar conexión')">↻ Actualizar</button>
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
  async function _liberarFallaDesdeTabla(num, emp, plat) {
    const u = DB.getUnidad(num, emp);
    if (!u) return;
    const fallaActiva = (u.fallas || []).find(f => !f.resuelta);
    if (!fallaActiva) {
      // Sin falla activa: solo limpiar obs/notas
      DB.upsertUnidad(num, { observaciones: '', notas: '', observaciones_manual: '', _fuente: 'edit_obs_inline' }, emp);
      if (window.GPS_SB && GPS_SB.saveNota) GPS_SB.saveNota(num, emp, '').catch(() => {});
      if (_platExpandida === plat) _refreshPlatTable(plat);
      renderResumen();
      toast('Observación limpiada', 'success');
      return;
    }
    // Confirmar liberación
    const motivo = await _uiPrompt({
      title: `✓ Liberar falla — Unidad ${num}`,
      message: `Falla: "${fallaActiva.motivo || fallaActiva.etiqueta || 'GPS MAL'}". Descripción de la solución (opcional):`,
      placeholder: 'Ej: Se reemplazó antena GPS, sistema restaurado...',
      defaultValue: '', icon: '✅', okText: '✓ Liberar falla'
    });
    if (motivo === null) return; // cancelado
    const ok = DB.resolverFalla(num, emp, fallaActiva.id, motivo);
    if (ok) {
      if (_platExpandida === plat) _refreshPlatTable(plat);
      renderResumen();
      toast('Falla liberada correctamente', 'success');
    }
  }

  async function _editarObsRapido(num, emp, plat) {
    const u = DB.getUnidad(num, emp);
    if (!u) { toast('Unidad no encontrada','error'); return; }
    const fallaActiva = (u.fallas||[]).find(f => !f.resuelta);

    // Helper: detectar si un valor es un ID numérico (timestamp o bigint) — NO es texto de observación
    const _esIdNumerico = v => v && /^\d{5,}$/.test(String(v).trim());

    // Intentar cargar la nota real desde Supabase antes de mostrar el modal
    let notaSupabase = '';
    if (window.GPS_SB && GPS_SB._getRaw) {
      try {
        const rows = await GPS_SB._getRaw('gps_notas',
          `empresa_id=eq.${encodeURIComponent(emp)}&num_economico=eq.${encodeURIComponent(num)}`
        );
        if (rows && rows.length > 0 && rows[0].nota) {
          notaSupabase = rows[0].nota;
          // Actualizar localStorage con el valor correcto
          DB.upsertUnidad(num, { notas: notaSupabase, observaciones: notaSupabase }, emp);
        }
      } catch(e) { /* silencioso — usamos localStorage */ }
    }

    // Prioridad: Supabase live > u.notas (si no es ID) > u.observaciones (si no es ID) > etiqueta falla
    const _rawNotas = u.notas || '';
    const _rawObs   = u.observaciones || '';
    const actual =
      notaSupabase ||
      (_esIdNumerico(_rawNotas) ? '' : _rawNotas) ||
      (_esIdNumerico(_rawObs)   ? '' : _rawObs)   ||
      (fallaActiva ? (fallaActiva.etiqueta || '') : '') || '';

    const nuevo = await _uiPrompt({
      title: `Observación — Unidad ${num}`,
      message: 'Se sincroniza con el registro de fallas. Deja vacío para borrar.',
      placeholder: 'Ej: AFR motor, SIM baja, GPS mal...',
      defaultValue: actual, icon: '📋', okText: 'Guardar observación'
    });
    if (nuevo === null) return;
    const texto = nuevo.trim();
    // Guardar en localStorage: tanto observaciones como notas (consistencia)
    DB.upsertUnidad(num, { observaciones: texto, notas: texto, observaciones_manual: texto, _fuente: 'edit_obs_inline' }, emp);

    // Sincronizar etiqueta en falla activa si existe
    if (texto && fallaActiva) {
      fallaActiva.etiqueta = texto;
      // NO tocar fallaActiva.motivo para no corromper el texto con IDs
      DB.upsertUnidad(num, { fallas: u.fallas }, emp);
    }

    // Sincronizar a Supabase gps_notas (fuente de verdad)
    if (window.GPS_SB && GPS_SB.saveNota) {
      GPS_SB.saveNota(num, emp, texto)
        .catch(e => console.warn('[editarObsRapido] Supabase sync:', e.message));
    }
    toast('Observación guardada','success');
    if (_platExpandida === plat) _refreshPlatTable(plat);
    renderResumen();
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
    setTimeout(() => {
      const eNum = $('pf-m-num');
      if (eNum) eNum.focus();
      // Auto-llenar fecha con hora actual
      const eFecha = $('pf-m-fecha');
      if (eFecha && !eFecha.value) {
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

    // Guardar en Supabase: gps_unidades + gps_barridos
    if (window.GPS_SB) {
      const uActual = DB.getUnidad(num, emp) || {};
      const upsertData = {
        num,
        base:      uActual.base      || $('pf-m-base')?.value   || null,
        cromatica: uActual.cromatica || $('pf-m-crom')?.value   || null,
        modelo:    uActual.modelo    || $('pf-m-modelo')?.value || null,
        placa:     idPlaca           || uActual.placa           || null,
        estatus:   uActual.estatus   || 'EN_OPERACION',
      };
      GPS_SB.upsertUnidad(upsertData, emp)
        .then(() => GPS_SB.saveBarrido(plat, [{ num, fecha: iso, fechaStr: Parsers.fmtDate(iso), plataforma: plat, placa: idPlaca || null }], emp))
        .catch(e => console.warn('[Captura manual Supabase]', e));
    }

    DB.addLog('manual', `${plat}: captura manual unidad ${num} (${Parsers.fmtDate(iso)})`, emp);
    toast(`✓ ${plat}: unidad ${num} guardada`, 'success');

    // Limpiar y refrescar
    ['pf-m-num','pf-m-base','pf-m-crom','pf-m-modelo','pf-m-id','pf-m-fecha'].forEach(id => { const e = $(id); if (e && e.tagName !== 'DIV') e.value = ''; });
    if ($('pf-m-dias')) $('pf-m-dias').textContent = '—';
    _refreshPlatTable(plat);
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
      const d=Math.floor((hoy-new Date(u[k]))/86400000);
      return d > cfg.diasAtencion;
    }).map(u=>({
      ...u,
      _dias: Math.floor((hoy-new Date(u[k]))/86400000)
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
      const emp = DB.getEmpresaActiva();
      _barridosPending[plat]={parsed,filename:file.name,val:Parsers.validarResultado(parsed),sheetName};

      // 1) Guardar en localStorage siempre
      const res=DB.saveBarrido(plat,parsed,emp);
      toast(`✓ ${plat}: ${parsed.length} registros → ${res.actualizadas} actualizadas`,'success',4000);
      renderPlataformas();
      renderResumen();

      // 2) Sincronizar con Supabase en background
      if(window.GPS_SB){
        toast(`⏳ Sincronizando ${plat} con Supabase...`,'info',3000);
        GPS_SB.saveBarrido(plat, parsed, emp)
          .then(r => toast(`☁ Supabase ${plat}: ${r.total} registros sincronizados`,'success',4000))
          .catch(e => {
            console.warn(`[_cargarArchivoPlat] Supabase error ${plat}:`, e.message);
            toast(`⚠ ${plat} guardado local — Supabase: ${e.message}`,'warn',5000);
          });
      }
    }catch(err){
      toast(`Error en ${plat}: `+err.message,'error');
      console.error(err);
    }
  }

  /* ══════════════════════════════════════════════════════
     PANEL: ASIGNACIÓN CONCENTRADO
  ══════════════════════════════════════════════════════ */
  let _asigQ='',_asigPage=1;
  const ASIG_PS=15;

  function renderAsignacion(){
    const emp=DB.getEmpresaActiva();
    const st=DB.getStats(emp);
    // ✅ Excluir _soloBarrido: unidades sin asignación, solo con datos de barrido
    const uns=DB.getUnidadesList(emp).filter(u => !u._soloBarrido);
    const act=uns.filter(u=>u.activa);
    const COLORS=['#3b82f6','#f59e0b','#10b981','#ef4444','#8b5cf6','#06b6d4','#f97316'];
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

    if(eE.length){ Charts.donut('asig-donut-est',eE.map(e=>e[0]),eE.map(e=>e[1]),['#10b981','#ef4444','#f59e0b','#3b82f6','#9ca3af']);
      if($('asig-est-legend')) $('asig-est-legend').innerHTML=eE.map(([k,v],i)=>
        `<div class="leg-row"><span class="leg-dot" style="background:${['#10b981','#ef4444','#f59e0b','#3b82f6','#9ca3af'][i]||COLORS[i%COLORS.length]}"></span><span class="leg-name">${esc(k)}</span><span class="leg-num">${v}</span><span class="leg-pct">(${Math.round(v/total*100)}%)</span></div>`).join('');}

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
    let lista=unsList||DB.getUnidadesList(DB.getEmpresaActiva()).filter(u=>u.activa && !u._soloBarrido);
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
    _rf = { plat:'', base:[], crom:[], est:[], dias:[], etiqueta:'', search:'', sort:'dias', page:1, ...f };
    App.nav(null, 'panel-resumen');
    setTimeout(()=>{
      document.querySelectorAll('#chips-plat .chip').forEach(c => c.classList.toggle('active', c.textContent.trim() === (_rf.plat || 'Todas')));
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
        .vj-row-saved{background:rgba(16,185,129,.04)}
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

    // Excluir de gráficas: Para venta, siniestros, fuera de operación, desenrolado, fuera de servicio
    const _estatusExcluidos = new Set(['Para venta','Fuera de operación','Desenrolado','Fuera de servicio','Entregado','Baja','Siniestro']);
    const uns = DB.getUnidadesList(emp).filter(u => {
      if (!u.activa) return false;
      if (_tieneSiniestroActivo(u)) return false;
      const cat = Parsers.categorizarEstatus(u.estatus);
      if (_estatusExcluidos.has(cat)) return false;
      return true;
    });

    // LÓGICA CORREGIDA (v7.1):
    // Cada plataforma tiene su PROPIO UNIVERSO (sus dispositivos, no todas las unidades de la empresa).
    // Ejemplo: Samsara tiene 350 dispositivos y 343 están en línea → 98% (no 47% sobre 710).
    // El "total" por plataforma es SOLO las unidades que tienen fecha en esa plataforma.
    // "Fuera de línea" en la dona = atención + fuera estricto (sin contar las que no tienen el dispositivo).
    // Las "sin datos" son las unidades de la empresa que NO están en esa plataforma —
    // se muestran aparte como dato informativo, pero NO entran en el denominador del %.
    // Para SAMSARA: incluir unidades Para venta/Desenrolado que tengan barrido de SAMSARA
    const _unsTodosEstatus = DB.getUnidadesList(emp).filter(u => u.activa && !_tieneSiniestroActivo(u));

    const statsByPlat = ALL_PLATS.map(p => {
      const k = 'ultima_act_' + p.toLowerCase();
      // SAMSARA usa el universo completo (incluyendo Para venta con barrido)
      // El resto usa solo unidades en operación
      const _base = p === 'SAMSARA' ? _unsTodosEstatus : uns;
      const conFecha = _base.filter(u => u[k]);
      // Unidades con falla AFR activa (no siniestro) cuentan como EN LÍNEA — están en operación
      const tieneAFR = u => (u.fallas||[]).some(f => !f.resuelta && !f.esSiniestro);
      const enLinea = conFecha.filter(u => {
        if (tieneAFR(u)) return true; // AFR activo → en línea
        return Math.floor((hoy - new Date(u[k]))/86400000) <= cfg.diasLinea;
      }).length;
      const atencion = conFecha.filter(u => {
        if (tieneAFR(u)) return false; // AFR no cuenta como atención
        const d = Math.floor((hoy - new Date(u[k]))/86400000);
        return d > cfg.diasLinea && d <= cfg.diasAtencion;
      }).length;
      const fueraEstricto = conFecha.filter(u => {
        if (tieneAFR(u)) return false; // AFR no cuenta como fuera
        return Math.floor((hoy - new Date(u[k]))/86400000) > cfg.diasAtencion;
      }).length;
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
          Charts.donut('gplat-'+s.plat, ['En línea','Fuera'], [s.enLinea, s.fueraTotal], ['#10b981','#ef4444']);
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
        ? 'background:rgba(239,68,68,.15);color:#ef4444'
        : 'background:rgba(245,158,11,.15);color:#f59e0b';
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
        <div class="fal-hist-icon" style="background:${h.tipo==='SINIESTRO'?'rgba(239,68,68,.15)':'rgba(245,158,11,.15)'}">${ico}</div>
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
        ${u.siniestroCount>0?`<span style="font-size:10px;background:rgba(239,68,68,.1);color:var(--red);border:1px solid rgba(239,68,68,.25);border-radius:4px;padding:2px 7px">🚨 ${u.siniestroCount} siniestro${u.siniestroCount!==1?'s':''}</span>`:''}
        ${u.afrCount>0?`<span style="font-size:10px;background:rgba(245,158,11,.1);color:var(--yellow);border:1px solid rgba(245,158,11,.25);border-radius:4px;padding:2px 7px">⚠ ${u.afrCount} AFR</span>`:''}
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
      <div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:8px;padding:10px 12px;margin-bottom:12px;display:flex;align-items:center;gap:8px">
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
    dirtyEtiquetas: false
  };

  // Palabras clave para detectar etiquetas (matching sobre texto DESPUÉS del número)
  // Orden importa: las más específicas/largas primero para evitar falsos positivos.
  const _BM_KEYWORDS = {
    // ── Siniestro ──────────────────────────────────────────────
    'siniestro':          'SINIESTRO',
    'siniestr':           'SINIESTRO',
    'accidente':          'SINIESTRO',
    // ── Alineación / carrocería ────────────────────────────────
    'en alineacion':      'ALINEACION',
    'en alineación':      'ALINEACION',
    'alineacion':         'ALINEACION',
    'alineación':         'ALINEACION',
    'alineado':           'ALINEACION',
    'en carroceria':      'CARROCERIA',
    'en carrocería':      'CARROCERIA',
    'carroceria':         'CARROCERIA',
    'carrocería':         'CARROCERIA',
    // ── Pintura ────────────────────────────────────────────────
    'en pintura':         'PINTURA',
    'pintura':            'PINTURA',
    // ── Taller (incluye "en taller") ──────────────────────────
    'en taller':          'TALLER',
    'taller':             'TALLER',
    // ── AFR ────────────────────────────────────────────────────
    'afr':                'AFR',
    // ── Energía ────────────────────────────────────────────────
    'sin energia':        'SIN_ENERGIA',
    'sin energía':        'SIN_ENERGIA',
    'sin luz':            'SIN_ENERGIA',
    // ── Candado / inmovilizado ─────────────────────────────────
    'con candado':        'CANDADO',
    'candado':            'CANDADO',
    'inmovilizado':       'CANDADO',
    // ── Parado / patio ─────────────────────────────────────────
    'en patio':           'PARADO',
    'parado':             'PARADO',
    'sin operar':         'PARADO',
    // ── SIM ────────────────────────────────────────────────────
    'sin sim':            'SIN_SIM',
    'sim baja':           'SIN_SIM',
    'sim sin datos':      'SIN_SIM',
    'sim sd':             'SIN_SIM',
    'sim bloqueada':      'SIN_SIM',
    'sim':                'SIN_SIM',
    'sin baja':           'SIN_SIM',   // "sin baja" = SIM dada de baja
    // ── VIN / placa ────────────────────────────────────────────
    'sin vin':            'SIN_VIN',
    'sin placa':          'SIN_VIN',
    // ── Sin datos GPS ──────────────────────────────────────────
    'sin datos':          'SIN_DATOS',
    'sin gps':            'SIN_DATOS',
    'sin señal':          'SIN_DATOS',
    'sin senal':          'SIN_DATOS',
    // ── Venta ──────────────────────────────────────────────────
    'para venta':         'VENTA',
    'en venta':           'VENTA',
    'venta':              'VENTA',
    // ── Mecánica / motor ───────────────────────────────────────
    'en mecanica':        'MECANICA',
    'en mecánica':        'MECANICA',
    'mecanica':           'MECANICA',
    'mecánica':           'MECANICA',
    'en motor':           'MECANICA',
    'motor':              'MECANICA',
    // ── MAN (plataforma diferente) ─────────────────────────────
    'en man':             'EN_MAN',
    'con man':            'EN_MAN',
    // ── Desinstalado / sin equipo ──────────────────────────────
    'desinstalado':       'DESINSTALADO',
    'sin equipo':         'DESINSTALADO',
    'sin dispositivo':    'DESINSTALADO',
    // ── Robo ───────────────────────────────────────────────────
    'robado':             'ROBO',
    'robo':               'ROBO',
    // ── Baja ───────────────────────────────────────────────────
    'de baja':            'BAJA',
    'baja':               'BAJA'
  };

  // Etiqueta → texto legible en el reporte
  const _BM_ETIQUETA_LABEL = {
    'SINIESTRO':     'siniestro',
    'ALINEACION':    'en alineación',
    'CARROCERIA':    'en carrocería',
    'PINTURA':       'en pintura',
    'TALLER':        'en taller',
    'AFR':           'AFR',
    'SIN_ENERGIA':   'sin energía',
    'CANDADO':       'con candado',
    'PARADO':        'parado',
    'SIN_SIM':       'sin SIM',
    'SIN_VIN':       'sin VIN',
    'SIN_DATOS':     'sin datos GPS',
    'VENTA':         'para venta',
    'MECANICA':      'en mecánica',
    'EN_MAN':        'en MAN',
    'DESINSTALADO':  'desinstalado',
    'ROBO':          'robo',
    'BAJA':          'de baja',
    'OTRO':          '' // texto libre — se usa etiquetaTextoLibre directamente
  };

  function _fechaSistemaParaBarridoManual(num, plataforma) {
    const emp = DB.getEmpresaActiva();
    const u = DB.getUnidad(num, emp);
    if (!u) return { fecha: null, fuente: '', unidad: null };
    const plat = String(plataforma || '').toLowerCase();
    const platKey = plat ? 'ultima_act_' + plat : '';
    // FIX: usar SOLO la fecha de la plataforma seleccionada.
    // NO caer al fallback u.ultima_act (podría ser de otra plataforma).
    const fechaPlat = platKey ? (u[platKey] || null) : null;
    if (fechaPlat) return { fecha: fechaPlat, fuente: String(plataforma || '').toUpperCase(), unidad: u };
    return { fecha: null, fuente: '', unidad: u };
  }

  function _fechaSalidaBarridoManual(f) {
    return f.fecha || f.fechaSistema || null;
  }

  function _diasFechaBarridoManual(fecha) {
    if (!fecha) return null;
    // FIX: normalizar espacio→T para que todos los browsers traten como hora local
    const d = new Date(String(fecha).replace(' ', 'T'));
    if (isNaN(d)) return null;
    const hoy = new Date();
    const hoyLocal = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const fechaLocal = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.round((hoyLocal.getTime() - fechaLocal.getTime()) / 86400000);
  }

  function _fmtBarridoManualFecha(fecha) {
    if (!fecha) return '';
    // Aceptar Date object directamente O string normalizado
    const fe = fecha instanceof Date ? fecha : new Date(String(fecha).replace(' ', 'T'));
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
    // FIX: normalizar espacio→T para hora local consistente
    const fe = fecha instanceof Date ? fecha : new Date(String(fecha).replace(' ', 'T'));
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
              style="margin-left:auto;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:4px 8px;color:var(--text);font-size:11px;font-family:var(--font)">
              ${ALL_PLATS.map(p => `<option value="${p}" ${st.plataforma===p?'selected':''}>${p}</option>`).join('')}
            </select>
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
                const colorEt = f.etiqueta === 'SINIESTRO' ? '#ef4444'
                              : f.etiqueta === 'ALINEACION' ? '#3b82f6'
                              : f.etiqueta === 'AFR' ? '#f59e0b'
                              : f.etiqueta === 'SIN_ENERGIA' ? '#ef4444'
                              : f.etiqueta === 'TALLER' ? '#8b5cf6'
                              : f.etiqueta === 'CANDADO' ? '#6b7280'
                              : f.etiqueta ? '#a78bfa' : 'var(--text3)';
                const fechaFuente = !f.fecha && f.fechaSistemaFuente ? ` <span style="color:var(--text3)">(${esc(f.fechaSistemaFuente)})</span>` : '';
                const etiquetaTxt = f.etiqueta ? (f.etiqueta === 'OTRO' ? (f.etiquetaTextoLibre || f.etiqueta) : (_BM_ETIQUETA_LABEL[f.etiqueta] || f.etiqueta)) : '';
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

      // REGLA CLAVE v7.4 + v7.5:
      //   etiqueta solo se asigna si hay TEXTO después del número
      //   (no solo número, no solo fecha)
      //   Si hay texto pero NO coincide con ningún keyword → etiqueta OTRO con texto original
      let etiqueta = null;
      let etiquetaTextoLibre = null; // texto original del técnico cuando no hay keyword match
      const hayTextoEtiqueta = !soloNumero && !restoEsFechaOnly;
      if (hayTextoEtiqueta) {
        const kws = Object.keys(_BM_KEYWORDS).sort((a,b) => b.length - a.length);
        for (const kw of kws) {
          if (restoLower.includes(kw)) { etiqueta = _BM_KEYWORDS[kw]; break; }
        }
        // "en línea" NO es etiqueta guardable → se trata como en_linea normal
        if (enLinea) { etiqueta = null; }
        // Si hay texto pero no coincide con ningún keyword → guardar texto libre como observación
        else if (!etiqueta && resto) {
          etiqueta = 'OTRO';
          etiquetaTextoLibre = resto; // texto original del técnico
        }
      }

      const sys = _fechaSistemaParaBarridoManual(num, plat);
      filas.push({
        num,
        fecha,
        fechaSistema: fecha ? null : sys.fecha,
        fechaSistemaFuente: fecha ? '' : sys.fuente,
        enLinea,
        etiqueta,
        etiquetaTextoLibre, // texto libre cuando etiqueta === 'OTRO'
        rawLine: line,
        _hasTextoEtiqueta: hayTextoEtiqueta
      });
    });

    // Llenar SOLO Cuadro 2 (etiquetas + reporte). Cuadro 3 queda en blanco.
    // Aprender keywords nuevos (OTRO) en segundo plano
    _aprenderKeywordsNuevos(filas, DB.getEmpresaActiva()).catch(()=>{});
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
      // Para OTRO: usar texto libre del técnico. Para el resto: label del diccionario.
      const label = f.etiqueta === 'OTRO' ? (f.etiquetaTextoLibre || f.etiqueta) : (_BM_ETIQUETA_LABEL[f.etiqueta] || f.etiqueta.toLowerCase().replace(/_/g,' '));
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
          if (f.etiqueta) {
            // Con etiqueta y fecha de hoy → OBSERVACIONES (no en_linea)
            categoria = 'etiqueta_en_linea';
          } else if (hora >= 1 && hora <= 6) {
            categoria = 'madrugada';
          } else {
            categoria = 'en_linea';
          }
        } else {
          // Fecha de otro día: con o sin etiqueta → días o etiqueta_con_fecha
          categoria = f.etiqueta ? 'etiqueta_con_fecha' : 'dias';
        }
      } else {
        categoria = 'sin_fecha';
      }

      if (f.enLinea && !d) {
        // En línea sin fecha del sistema
        categoria = f.etiqueta ? 'etiqueta_sin_fecha' : 'en_linea';
      }

      return { ...f, _fechaSalida: fechaSalida, _fechaObj: d, _dias: dias, _categoria: categoria };
    });

    let out = `Base ${_fmtFechaSoloDia(hoy)}\n`;
    out += `\n📡 ESTADO DE UNIDADES CCTV\n`;
    out += `✅ OPERATIVO — Cámaras / Antenas GPS-3G OK\n`;

    const enLineaList = enriched.filter(f =>
      (f._categoria === 'en_linea') && !f.etiqueta
    );
    if (enLineaList.length) {
      out += `\nEn línea:\n`;
      enLineaList
        .sort((a,b) => Number(a.num) - Number(b.num))
        .forEach(f => { out += `${f.num} (en línea)\n`; });
    }

    const madrugadaList = enriched.filter(f => f._categoria === 'madrugada' && !f.etiqueta);
    if (madrugadaList.length) {
      out += `\n☀ Sin transmisión en la mañana\n`;
      madrugadaList
        .sort((a,b) => a._fechaObj - b._fechaObj)
        .forEach(f => {
          out += `${f.num} en espera, ${_fmtBarridoManualFecha(f._fechaSalida)}\n`;
        });
    }

    const diasList = enriched.filter(f => f._categoria === 'dias');
    if (diasList.length) {
      const porDias = {};
      diasList.forEach(f => {
        const d = f._dias;
        if (!porDias[d]) porDias[d] = [];
        porDias[d].push(f);
      });
      out += `\n⏱ Última transmisión\n`;
      Object.keys(porDias).map(Number).sort((a,b) => a-b).forEach(d => {
        out += `▪ ${d} día${d===1?'':'s'}\n`;
        porDias[d]
          .sort((a,b) => b._fechaObj - a._fechaObj)
          .forEach(f => {
            out += `${f.num} — ${_fmtBarridoManualFecha(f._fechaSalida)}\n`;
          });
      });
    }

    // ── Pre-clasificar para evitar duplicados ──────────────────────────────
    // Determinar qué unidades van a cada sección ANTES de renderizar,
    // para que una unidad NO aparezca en dos secciones a la vez.
    const platActual = _barridoManualState.plataforma || 'CEIBA';
    const emp = DB.getEmpresaActiva();
    const kPlat = 'ultima_act_' + platActual.toLowerCase();

    // Sets de números por categoría (mutuamente excluyentes)
    const _numsSinAsig    = new Set(); // no existe en asignación
    const _numsSinEquipo  = new Set(); // existe pero sin datos en esta plataforma Y sin etiqueta Y sin fecha técnico
    // Los que tienen etiqueta O tienen fecha técnico → van a OBSERVACIONES (con o sin plataforma)

    filas.forEach(f => {
      const u = DB.getUnidad(f.num, emp);
      if (!u) {
        _numsSinAsig.add(f.num);
      } else if (!u[kPlat] && !f.etiqueta && !f.fecha) {
        // Sin datos en la plataforma, sin etiqueta, sin fecha del técnico
        // → va solo a "Sin equipo PLATAFORMA", no a observaciones
        _numsSinEquipo.add(f.num);
      }
      // Si tiene etiqueta o fecha técnico → va a OBSERVACIONES aunque no tenga plataforma
    });

    // ── OBSERVACIONES ────────────────────────────────────────────────────
    // Solo entran: unidades con etiqueta OR con fecha pero días>0 OR con fecha y sin_fecha que tengan etiqueta
    // NO entran: las del set _numsSinEquipo ni _numsSinAsig (a menos que tengan etiqueta)
    const obsList = enriched.filter(f => {
      // Si tiene etiqueta → siempre va a OBSERVACIONES (cualquier categoría, incluyendo en_linea hoy)
      if (f.etiqueta) return true;
      // Sin etiqueta y sin fecha: solo si NO está en los sets de sin-equipo / sin-asig
      if (f._categoria === 'sin_fecha' || f._categoria === 'etiqueta_sin_fecha') {
        return !_numsSinEquipo.has(f.num) && !_numsSinAsig.has(f.num);
      }
      return false;
    });
    if (obsList.length) {
      out += `\n⚠ OBSERVACIONES\n`;
      obsList
        .sort((a,b) => Number(a.num) - Number(b.num))
        .forEach(f => {
          const label = f.etiqueta ? (f.etiqueta === 'OTRO' ? (f.etiquetaTextoLibre || f.etiqueta.toLowerCase()) : (_BM_ETIQUETA_LABEL[f.etiqueta] || f.etiqueta.toLowerCase())) : '';

          if (f._fechaObj) {
            const dias = f._dias;
            const ayer = new Date(hoy.getTime() - 86400000);
            const esAyer = _fmtFechaSoloDia(f._fechaObj) === _fmtFechaSoloDia(ayer);
            const prefijoFecha = esAyer ? 'Ayer ' : '';
            const fechaFmt = `${prefijoFecha}${_fmtBarridoManualFecha(f._fechaObj)}`;

            if (label) {
              // Con etiqueta: "2434 — en carrocería"
              //               "(9 días sin transmitir) — 31-05-26 / 01:25"
              out += `${f.num} — ${label}\n`;
              if (dias > 0) {
                out += ` (${dias} día${dias===1?'':'s'} sin transmitir) — ${fechaFmt}\n`;
              } else {
                // En línea con etiqueta: mostrar fecha igualmente
                out += ` ${fechaFmt}\n`;
              }
            } else {
              // Sin etiqueta con fecha: va en sección Última transmisión, no aquí.
              // Pero por si llega: mostrar num + fecha + días
              const diasTxt = dias > 0 ? ` (${dias} día${dias===1?'':'s'} sin transmitir)` : '';
              out += `${f.num}\n${fechaFmt}${diasTxt}\n`;
            }
          } else {
            // Sin fecha: solo etiqueta
            if (label) out += `${f.num} — ${label}\n`;
            else out += `${f.num} — sin datos\n`;
          }
        });
    }

    // ── Sin equipo en la plataforma seleccionada ────────────────────────
    // Unidades que existen en asignación pero no tienen datos en esta plataforma
    // y tampoco tienen etiqueta ni fecha técnico (no duplicar con OBSERVACIONES)
    if (_numsSinEquipo.size) {
      const sinEquipoList = [..._numsSinEquipo].sort((a,b) => Number(a) - Number(b));
      out += `\n🚫 Sin equipo ${platActual}:\n`;
      sinEquipoList.forEach(num => {
        out += `${num} sin ${platActual.toLowerCase()}\n`;
      });
    }

    // ── Sin asignación activa ───────────────────────────────────────────
    if (_numsSinAsig.size) {
      const sinAsigList = [..._numsSinAsig].sort((a,b) => Number(a) - Number(b));
      out += `\n⚠ Sin asignación activa (verificar en sistema):\n`;
      sinAsigList.forEach(num => {
        out += `${num} — no encontrada en asignación\n`;
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
  async function _aprenderKeywordsNuevos(filas, emp) {
    // Guardar en Supabase textos libres (OTRO) para que el sistema los aprenda
    if (!window.GPS_SB || !GPS_SB._upsert) return;
    const nuevos = filas.filter(f => f.etiqueta === 'OTRO' && f.etiquetaTextoLibre);
    if (!nuevos.length) return;
    const rows = nuevos.map(f => ({
      keyword:    f.etiquetaTextoLibre.toLowerCase().trim(),
      etiqueta:   'OTRO',
      label:      f.etiquetaTextoLibre.trim(),
      empresa_id: emp || null,
      usos:       1,
      updated_at: new Date().toISOString()
    }));
    try {
      await GPS_SB._upsert('gps_barrido_keywords', rows, 'keyword,empresa_id');
      console.log(`[BarridoManual] ${rows.length} keywords nuevos guardados`);
    } catch(e) { console.warn('[BarridoManual] keywords save:', e.message); }
  }

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

  let _maestraFilter = { base:'', crom:'', est:'' };

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
    if (f.est)  lista = lista.filter(u => Parsers.categorizarEstatus(u.estatus) === f.est);
    // Filtros por plataforma: 'con' = tiene datos, 'sin' = no tiene
    ALL_PLATS.forEach(p => {
      const fp = f['plat_' + p];
      if (!fp) return;
      const k = 'ultima_act_' + p.toLowerCase();
      if (fp === 'con') lista = lista.filter(u => !!u[k]);
      if (fp === 'sin') lista = lista.filter(u => !u[k]);
    });

    // Conteo por plataforma
    const conteos = {};
    ALL_PLATS.forEach(p => {
      const k = 'ultima_act_' + p.toLowerCase();
      conteos[p] = { con: uns.filter(u => u[k]).length, sin: uns.filter(u => !u[k]).length };
    });

    lista.sort((a,b) => parseInt(a.num||0) - parseInt(b.num||0));

    el.innerHTML = `
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:10px">
        <div>
          <h2 style="font-size:14px;font-weight:700">TABLA MAESTRA</h2>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">Unidades con matriz de plataformas · Filtra por plataforma y exporta en CSV</div>
        </div>
        <button class="export-btn" onclick="UI._exportarMaestra()">↓ Exportar CSV</button>
      </div>

      <!-- Chips de filtro por plataforma -->
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;align-items:center">
        <span style="font-size:11px;color:var(--text3);margin-right:4px">PLATAFORMA</span>
        ${ALL_PLATS.map(p => {
          const fp = f['plat_' + p] || '';
          const con = conteos[p].con;
          const sin = conteos[p].sin;
          const btnCon = `<button onclick="UI._setMaestraPlatFilter('${p}','con')" style="padding:3px 10px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;border:1px solid ${fp==='con'?'var(--green)':'var(--border)'};background:${fp==='con'?'rgba(34,197,94,.15)':'var(--bg-card)'};color:${fp==='con'?'var(--green)':'var(--text2)'}">✓ Con ${p} <span style="color:var(--text3)">${con}</span></button>`;
          const btnSin = `<button onclick="UI._setMaestraPlatFilter('${p}','sin')" style="padding:3px 10px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;border:1px solid ${fp==='sin'?'var(--red)':'var(--border)'};background:${fp==='sin'?'rgba(239,68,68,.12)':'var(--bg-card)'};color:${fp==='sin'?'var(--red)':'var(--text2)'}">Sin ${p} <span style="color:var(--text3)">${sin}</span></button>`;
          return btnCon + btnSin;
        }).join('')}
      </div>

      <!-- Filtros base/crom/estatus -->
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
            ${[...new Set(uns.map(u => Parsers.categorizarEstatus(u.estatus)).filter(Boolean))].sort().map(e =>
              `<option value="${esc(e)}" ${f.est===e?'selected':''}>${esc(e)}</option>`
            ).join('')}
          </select>
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
                ${ALL_PLATS.map(p => `<th style="text-align:center;font-size:11px">${p}</th>`).join('')}
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
                  return `<td style="text-align:center">
                    <span style="font-size:10px;font-weight:700;color:${tiene?'var(--green)':'var(--red)'}">${tiene?'✓ Con '+p:'Sin '+p}</span>
                  </td>`;
                }).join('')}
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function _setMaestraPlatFilter(plat, val) {
    // Toggle: si ya está activo ese valor, desactivar
    const current = _maestraFilter['plat_' + plat] || '';
    _maestraFilter['plat_' + plat] = current === val ? '' : val;
    renderMaestra();
  }

  function _onMaestraFilterChange() {
    const prev = _maestraFilter;
    _maestraFilter = {
      base: $('ma-f-base')?.value || '',
      crom: $('ma-f-crom')?.value || '',
      est:  $('ma-f-est')?.value || ''
    };
    // Preservar filtros de plataforma
    ALL_PLATS.forEach(p => {
      _maestraFilter['plat_' + p] = prev['plat_' + p] || '';
    });
    renderMaestra();
  }
  function _resetMaestraFilters() {
    _maestraFilter = { base:'', crom:'', est:'' };
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
    const active=document.querySelector('.panel.active');
    if(active)App.nav(null,active.id);
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

  return {
    // render panels
    renderResumen, renderUnitList, renderDetalle,
    renderAsignacion, renderAsigTable,
    renderBarridos, renderPlataformas,
    renderReportes, renderHistorial, renderAlertas,
    renderViajes, renderGraficas, renderFallasPanel, renderBarridoManual, renderMaestra,
    // unit actions
    openUnitDetail, openEditarUnidad, openRegistrarFalla,
    _guardarUnidad, _guardarFalla, _abrirFormNuevaFalla,
    _registrarFalla: openRegistrarFalla,
    _reactivar, _confirmarEliminar, _addNote,
    _updateManualFechaConISO, _updatePlatFechaConISO,
    _switchTab, _switchTipoReg, _cargarArchivoPlat,
    _marcarFallaResuelta, _confirmarResolverFalla,
    _eliminarFalla, _confirmarEliminarFalla,
    // detalle interactivo
    _renderTimelineAndChart, _filtrarTimelinePlat,
    // combo
    _onComboChange,
    // plataformas expandibles
    _togglePlatDetail, _refreshPlatTable, _onPlatFilterChange, _debouncePlatSearch, _resetPlatFilters,
    _exportarFaltantesPlat, _exportarFueraLineaPlat,
    // plataformas v7: detalle inline, búsqueda multi-token, captura manual
    _onPlatRowClick, _cerrarPlatDetailInline,
    _guardarNota, _editarNotaRapido,
    _uiConfirm, _uiPrompt,
    _toggleDesinstalacion, _desinstalarSeleccionadasPlat, _toggleDesinstalacionMasiva,
    _onPlatCheckRow, _toggleSelectAllPlat, _limpiarSeleccionPlat,
    _updateBulkBar, _eliminarSeleccionadasPlat,
    _abrirCapturaManualPlat, _autocompletarCapturaManual,
    _recalcularDiasManual, _guardarCapturaManualPlat, _editarCapturaManuaRow,
    _updatePlatFechaConISO,
    // v7.1: tabs del detalle inline y guardar observaciones in-situ
    _cambiarPlatDetailTab, _guardarObsInline, _editarObsRapido, _liberarFallaDesdeTabla, _eliminarUnidadDePlat,
    // v7.2: multi-select dropdowns
    _msToggle, _msOnCheck, _msSelectAll, _msFilterOptions,
    // alertas
    _filtrarPorAlerta, _exportarAlerta,
    // viajes
    _guardarViajeRow, _eliminarViajeRow, _exportarViajes,
    _autoSaveViajeRow, _pickViajeDt, _onViajesFilterChange, _debounceViajesSearch, _resetViajesFilters,
    _debounceResumenSearch, _debounceAsigSearch,
    _toggleObsEditor, _saveObsViaje,
    get _viajesFiltro(){return _viajesFiltro;},
    set _viajesFiltro(v){Object.assign(_viajesFiltro,v);},
    // fallas panel
    _onFallasFilterChange, _debounceFallasSearch, _liberarFalla,
    openRegistrarFallaGlobal, _guardarFallaGlobal,
    get _fallasFilter(){return _fallasFilter;},
    set _fallasFilter(v){Object.assign(_fallasFilter,v);},
    get _fallasTab(){return _fallasTab;},
    set _fallasTab(v){_fallasTab=v;},
    // barrido manual v7.4
    _procesarBarridoManual, _enviarAFinalBarridoManual,
    _cargarBarridoManualEjemplo, _copiarBarridoManual,
    _guardarBarridoManualEnSistema, _procesarFinalBarridoManual,
    _copiarReporteFinalBarrido, _limpiarBarridoManual,
    get _barridoManualState(){return _barridoManualState;},
    set _barridoManualState(v){Object.assign(_barridoManualState,v);},
    // maestra
    _onMaestraFilterChange, _setMaestraPlatFilter, _resetMaestraFilters, _exportarMaestra,
    // date picker
    openDatePicker, _confirmDatePicker,
    // carga
    handleAsigFile, procesarAsig,
    handleBarridoFiles, integrarBarridos,
    // empresa
    cambiarEmpresa,
    // modal
    closeModal,
    // export
    exportarCSV, exportarDatos, importarDatos, exportarReporte,
    // toast
    toast,
    // filtros
    get _rf(){return _rf;},
    set _rf(v){_rf=v;},
    get _asigQ(){return _asigQ;},
    set _asigQ(v){_asigQ=v;},
    get _histFiltro(){return _histFiltro;},
    set _histFiltro(v){Object.assign(_histFiltro,v);}
  };
})();
