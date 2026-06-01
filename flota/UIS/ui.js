/**
 * ui.js — Core UI: helpers, Resumen, Detalle, Barridos, Asignación
 * Extendido por: ui-plataformas.js, ui-panels.js
 */
const UI = (() => {
dos los paneles corregidos según retroalimentación del PDF
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
    CEIBA:   { bg:'#1a3a2a', color:'#2db882', label:'C'  },
    SAMSARA: { bg:'#3a2a1a', color:'#c07d10', label:'S'  },
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
      pills.push(`<span style="${pillStyle};background:rgba(192,57,43,.14);color:#c0392b;border:1px solid rgba(192,57,43,.35)" title="${esc(u.siniestroDesc||'Siniestro')}">SINIESTRO${u.siniestroDesc?': '+esc(u.siniestroDesc):''}</span>`);
    }

    // Etiquetas de DESINSTALACIÓN por plataforma
    const ALL_P = ['CEIBA','SAMSARA','AVL','SCANIA','MAN','VOLVO','MOTIVE'];
    ALL_P.forEach(p => {
      const desK = 'desinstalacion_' + p.toLowerCase();
      if (u[desK]) {
        const desI = u[desK];
        pills.push(`<span style="${pillStyle};background:rgba(90,90,90,.18);color:#909090;border:1px solid rgba(100,100,100,.35)" title="Equipo ${p} desinstalado el ${desI.fecha||'?'}: ${desI.comentario||''}">🔧 ${p} DESINSTAL.</span>`);
      }
    });

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
      const col = horas < 24 ? '#1a9e6e' : '#c07d10';
      const bg  = horas < 24 ? 'rgba(26,158,110,.14)' : 'rgba(192,125,16,.14)';
      const br  = horas < 24 ? 'rgba(26,158,110,.35)' : 'rgba(192,125,16,.35)';
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
    const colors={success:'#1a9e6e',error:'#c0392b',info:'#3b82f6',warn:'#c07d10'};
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
  let _rf={plat:'',base:'',crom:'',est:'',dias:'',search:'',sort:'dias',page:1};

  function renderResumen() {
    // Ceder el hilo al navegador antes de ejecutar para no bloquear clicks
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(_doRenderResumen);
    } else {
      _doRenderResumen();
    }
  }
  function _doRenderResumen() {
    const emp=DB.getEmpresaActiva();
    const st=DB.getStats(emp);

    const lastLog=DB.getHistorialGlobal(1)[0];
    if($('tb-last-update')) $('tb-last-update').textContent=
      `Empresa: ${emp} · ${lastLog?'Últ. act.: '+Parsers.fmtDate(lastLog.fecha):'Sin actualizaciones'}`;

    // Sparklines (ilustrativos, basados en totales de la empresa)
    const rnd=(b,n=8)=>Array.from({length:n},(_,i)=>Math.max(0,b+Math.round(Math.sin(i)*2+(Math.random()-.5)*3)));
    Charts.sparkline('spark-fuera',    rnd(st.fuera+st.sinDatos),'#c0392b');
    Charts.sparkline('spark-atencion', rnd(st.atencion),         '#c07d10');
    Charts.sparkline('spark-enlinea',  rnd(st.enLinea),          '#1a9e6e');
    Charts.bar('spark-total',null,rnd(st.activas),'#3b82f6');

    const totalAlertas=st.sinVIN+st.sinPlaca+st.sinDatos+st.siniestros;
    if($('nav-alertas-badge')) $('nav-alertas-badge').textContent=totalAlertas;

    _fillFilters(emp);
    // renderUnitList actualiza KPIs, donuts y alertas usando la lista filtrada actual
    renderUnitList();
  }

  function _fillFilters(emp) {
    const uns=DB.getUnidadesList(emp).filter(u=>u.activa);
    const selB=$('filter-base');
    if(selB){const c=selB.value,bases=[...new Set(uns.map(u=>u.base).filter(Boolean))].sort();selB.innerHTML=`<option value="">Todas</option>`+bases.map(b=>`<option>${esc(b)}</option>`).join('');if(c)selB.value=c;}
    const selC=$('filter-crom');
    if(selC){const c=selC.value,croms=[...new Set(uns.map(u=>u.cromatica).filter(Boolean))].sort();selC.innerHTML=`<option value="">Todos</option>`+croms.map(b=>`<option>${esc(b)}</option>`).join('');if(c)selC.value=c;}
    const selE=$('filter-emp');
    if(selE){selE.innerHTML=DB.getEmpresasList().map(e=>`<option value="${e}" ${e===DB.getEmpresaActiva()?'selected':''}>${e}</option>`).join('');}

    // ── Filtro ESTADO dinámico según empresa ──────────────────────
    const selEst=$('filter-est');
    if(selEst){
      const prev = selEst.value;
      // Recoger todos los estatus únicos de las unidades activas de esta empresa
      const estatusUnicos = [...new Set(
        uns.map(u => Parsers.normalizarEstatus(u.estatus)).filter(Boolean)
      )].sort();
      selEst.innerHTML = `<option value="">Todos</option>` +
        estatusUnicos.map(e => `<option value="${esc(e)}" ${prev===e?'selected':''}>${esc(e)}</option>`).join('');
      if(prev && estatusUnicos.includes(prev)) selEst.value = prev;
    }
  }

  /* ── UNIT LIST ─────────────────────────────────────── */
  function renderUnitList() {
    const emp=DB.getEmpresaActiva();
    const cfg=DB.getConfig();
    const hoy=Date.now();
    let uns=DB.getUnidadesList(emp).filter(u=>u.activa);
    uns=uns.map(u=>({...u,dias:Parsers.diasDesde(u.ultima_act)}));

    // Excluir "Para venta" por defecto. Si el usuario filtra explícitamente por "Para venta", sí las muestra.
    if (_rf.est !== 'Para venta') {
      uns = uns.filter(u => Parsers.normalizarEstatus(u.estatus) !== 'Para venta');
    }

    if(_rf.plat)   uns=uns.filter(u=>u.plataforma===_rf.plat||u['ultima_act_'+_rf.plat.toLowerCase()]);
    if(_rf.base)   uns=uns.filter(u=>u.base===_rf.base);
    if(_rf.crom)   uns=uns.filter(u=>u.cromatica===_rf.crom);
    if(_rf.est) {
      uns = uns.filter(u => Parsers.normalizarEstatus(u.estatus) === _rf.est);
    }
    if(_rf.dias){
      uns=uns.filter(u=>{
        const d=u.dias;
        if(_rf.dias==='enlinea')  return d!==null&&d<=cfg.diasLinea;
        if(_rf.dias==='atencion') return d!==null&&d>cfg.diasLinea&&d<=cfg.diasAtencion;
        if(_rf.dias==='fuera')    return d===null||d>cfg.diasAtencion;
        return true;
      });
    }
    if(_rf.search){
      uns = uns.filter(u => _multiTokenMatch(_rf.search, [
        u.num, u.base, u.modelo, u.cromatica, u.placa, u.empresa_asig,
        u.serie, u.dvr_ceiba, u.vin_samsara, u.placa_man, u.placa_scania, u.observaciones
      ].join(' ')));
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
          'SIM INSTALADA':    { text:'#1a9e6e', bg:'rgba(26,158,110,.13)' },
          'SIM RETIRADA':     { text:'#c0392b', bg:'rgba(192,57,43,.13)' },
          'SIM SIN ASIGNAR':  { text:'#c07d10', bg:'rgba(192,125,16,.13)' },
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
              <div class="uf">
                <div class="uf-lbl">EMPRESA</div>
                <div class="uf-val" style="display:flex;align-items:center;gap:5px">
                  ${esc(u.empresa_asig||'—')}
                  ${u.estatus ? (() => {
                    const est = Parsers.normalizarEstatus(u.estatus);
                    const cfg = {
                      'En operación':    { c:'#1a9e6e', bg:'rgba(26,158,110,.13)' },
                      'Arrendamiento':   { c:'#1a9e6e', bg:'rgba(26,158,110,.10)' },
                      'Para venta':      { c:'#c0392b', bg:'rgba(192,57,43,.13)' },
                      'Fuera de operación':{ c:'#c07d10', bg:'rgba(192,125,16,.13)' },
                      'Rentado a SAME':  { c:'#c07d10', bg:'rgba(192,125,16,.10)' },
                      'Baja':            { c:'#888',    bg:'rgba(100,100,100,.13)' },
                      'Siniestro':       { c:'#c0392b', bg:'rgba(192,57,43,.18)' },
                    }[est] || { c:'var(--text3)', bg:'rgba(100,100,100,.08)' };
                    return `<span style="font-size:9px;font-weight:700;padding:1px 6px;border-radius:3px;background:${cfg.bg};color:${cfg.c};white-space:nowrap" title="${esc(u.estatus)}">${esc(est||u.estatus)}</span>`;
                  })() : ''}
                </div>
              </div>
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
      Charts.donut('donut-estado',['Fuera','Atención','En línea'],[fuera+sinDatos,atencion,enLinea],['#c0392b','#c07d10','#1a9e6e']);
    }
    if($('pct-fuera'))    $('pct-fuera').textContent    =Math.round((fuera+sinDatos)/total*100)+'%';
    if($('pct-atencion')) $('pct-atencion').textContent =Math.round(atencion/total*100)+'%';
    if($('pct-enlinea'))  $('pct-enlinea').textContent  =Math.round(enLinea/total*100)+'%';

    const COLORS=['#3b82f6','#c07d10','#1a9e6e','#c0392b','#8b5cf6','#06b6d4','#c06010','#ec4899'];

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
    let u=DB.getUnidad(num,emp);
    if(!u){toast('Unidad no encontrada','error');App.nav(null,'panel-resumen');return;}
    // Cargar nota fresca de Supabase (para mostrar notas guardadas desde plataforma)
    // IMPORTANTE: solo actualizar si Supabase tiene dato — nunca borrar lo que ya está en pantalla
    if(window.GPS_SB && !u.notas){
      GPS_SB._getRaw('gps_barridos',
        'num_economico=eq.'+encodeURIComponent(num)+'&empresa_id=eq.'+encodeURIComponent(emp)+'&notas=not.is.null&limit=1'
      ).then(rows=>{
        if(rows && rows.length > 0 && rows[0].notas){
          const notaFresca = rows[0].notas;
          DB.upsertUnidad(num, {notas: notaFresca}, emp);
          const nd = document.getElementById('notas-display');
          if(nd) nd.innerHTML = notaFresca.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        }
      }).catch(()=>{});
    }
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
          const desK = 'desinstalacion_' + p.toLowerCase();
          const esDes = !!u[desK];
          const pc = esDes ? '#555' : (!tiene?'var(--border)':(d!==null&&d<=cfg.diasLinea)?'var(--green)':(d!==null&&d<=cfg.diasAtencion)?'var(--yellow)':'var(--red)');
          const subLabel = esDes ? 'DESINSTAL.' : (tiene ? Parsers.fmtDateShort(f) : 'Sin datos');
          const subColor = esDes ? '#666' : 'var(--text3)';
          return `<div style="display:flex;align-items:center;gap:5px;padding:5px 8px;border-radius:7px;background:var(--bg-card);border:1px solid ${pc}44;min-width:0;cursor:${tiene&&!esDes?'pointer':'default'}${esDes?';opacity:.6;filter:grayscale(.6)':''}" ${tiene&&!esDes?`onclick="UI._filtrarTimelinePlat('${p}','${esc(num)}','${esc(emp)}')" title="Click para filtrar línea de tiempo"`:''}>
            ${platIcon(p,18)}
            <div style="min-width:0">
              <div style="font-size:10px;font-weight:700;color:${pc}">${p}</div>
              <div style="font-size:9px;color:${subColor}">${subLabel}</div>
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
            const kp='ultima_act_'+p.toLowerCase();
            const f=u[kp];
            const pd=Parsers.diasDesde(f);
            const pc=!f?'var(--border)':pd<=DB.getConfig().diasLinea?'var(--green)':pd<=DB.getConfig().diasAtencion?'var(--yellow)':'var(--red)';
            const label=!f?'SIN DATOS':pd<=DB.getConfig().diasLinea?'EN LÍNEA':'FUERA DE LÍNEA';
            const desKeyP='desinstalacion_'+p.toLowerCase();
            const desInfoP=u[desKeyP];
            const estaDesP=!!desInfoP;
            return`<div style="background:var(--bg-panel);border:1px solid ${estaDesP?'#444':'var(--border)'};border-top:2px solid ${estaDesP?'#555':pc};border-radius:10px;padding:12px${estaDesP?';opacity:.55;filter:grayscale(.7)':''}">
              <div style="display:flex;align-items:center;gap:7px;margin-bottom:8px">
                ${platIcon(p,22)}
                <span style="font-size:12px;font-weight:700">${p}</span>
                ${estaDesP?`<span style="margin-left:auto;font-size:9px;background:rgba(120,120,120,.3);color:#aaa;padding:1px 5px;border-radius:3px;font-weight:700">DESINSTAL.</span>`:''}
              </div>
              ${f?`<div style="font-size:15px;font-weight:700">${Parsers.fmtDateShort(f)}</div>
                <div style="font-size:11px;color:var(--text2)">${Parsers.fmtTime(f)}</div>
                <div style="font-size:10px;font-weight:700;text-transform:uppercase;margin:5px 0 2px;color:${estaDesP?'#888':pc}">${estaDesP?'DESINSTALADO':label}</div>
                <div style="font-size:20px;font-weight:700;color:${estaDesP?'#888':pc}">${pd} días</div>`
              :`<div style="color:var(--text3);font-size:12px;margin:8px 0">Sin datos registrados</div>`}
              ${estaDesP
                ? `<div style="font-size:10px;color:#666;margin:4px 0">${esc(desInfoP.fecha||'')} ${desInfoP.comentario?'· '+esc(desInfoP.comentario):''}</div>
                   <button class="act-btn-sm" style="margin-top:6px;width:100%;background:rgba(80,80,80,.3);border-color:#555;color:#999" onclick="UI._liberarDesinstalacion('${esc(num)}','${p}','${esc(emp)}','')">↩ Liberar equipo</button>`
                : `<div style="display:flex;gap:4px;margin-top:6px">
                    <button class="act-btn-sm" style="flex:1" onclick="UI.openDatePicker('${f||''}',iso=>{UI._updatePlatFechaConISO('${esc(num)}','${p}','${esc(emp)}',iso)},'${p} — Actualizar conexión')">
                      ${f?'↻ Actualizar':'+ Ingresar fecha'}
                    </button>
                    <button class="act-btn-sm" style="padding:4px 7px;background:rgba(130,50,30,.2);border-color:rgba(160,60,40,.35);color:#b06050" title="Registrar desinstalación de equipo" onclick="UI._modalDesinstalacion('${esc(num)}','${p}','${esc(emp)}','')">🔧</button>
                  </div>`
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
          <!-- notas-display se actualiza async desde Supabase si hay notas más recientes -->
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
      Charts.lineChart('chart-histdias', labels, vals, '#c0392b');
    } else {
      Charts.sparkline('chart-histdias', [0, 0], '#c0392b');
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

  function _addNote(num, emp) {
    // Asegurar que la unidad exista (puede ser _soloBarrido)
    let u = DB.getUnidad(num, emp);
    if (!u) {
      DB.upsertUnidad(num, { activa: true, _soloBarrido: true }, emp);
      u = DB.getUnidad(num, emp);
    }
    const notasLocal = u ? (u.notas || '') : '';

    // Abrir modal con lo que hay en localStorage mientras carga Supabase
    const _abrirModalNotas = (txt) => {
      openModal(`
        <div style="background:var(--bg-panel);border:1px solid var(--border2);border-radius:12px;padding:24px;width:440px">
          <div style="font-size:14px;font-weight:600;margin-bottom:12px">✏ Notas — Unidad ${esc(num)}</div>
          <textarea id="modal-notas" rows="5" style="width:100%;background:var(--bg-card);border:1px solid var(--border2);border-radius:8px;padding:10px;color:var(--text);font-family:var(--font);font-size:13px;resize:vertical">${esc(txt)}</textarea>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px">
            <button onclick="UI.closeModal()" class="act-btn">Cancelar</button>
            <button onclick="UI._guardarNotaModal('${esc(num)}','${esc(emp)}')" class="act-btn-primary">Guardar</button>
          </div>
        </div>`);
    };

    // Buscar nota más reciente en Supabase (fuente de verdad)
    if (window.GPS_SB) {
      GPS_SB._getRaw('gps_barridos',
        'num_economico=eq.'+encodeURIComponent(num)+'&empresa_id=eq.'+encodeURIComponent(emp)+'&notas=not.is.null&limit=1'
      ).then(rows => {
        const notaSupa = (rows && rows.length > 0) ? (rows[0].notas || '') : '';
        const notaFinal = notaSupa || notasLocal;
        // Actualizar localStorage si Supabase tiene algo más reciente
        if (notaSupa && notaSupa !== notasLocal) {
          DB.upsertUnidad(num, { notas: notaSupa }, emp);
        }
        _abrirModalNotas(notaFinal);
      }).catch(() => _abrirModalNotas(notasLocal));
    } else {
      _abrirModalNotas(notasLocal);
    }
  }

  function _guardarNotaModal(num, emp) {
    const txt = (document.getElementById('modal-notas')?.value || '').trim();
    // 1. Guardar en localStorage
    DB.upsertUnidad(num, { notas: txt, _fuente: 'edit_notas_modal' }, emp);
    // 2. Sincronizar notas a Supabase
    // Usamos PATCH con return=minimal — si falla, loguear en consola
    if (window.GPS_SB) {
      const _sbCfg = window.CCTV_SUPABASE_CONFIG || {};
      const _sbUrl = (_sbCfg.url || 'https://sxzhmcrpeyuqslupttby.supabase.co') + '/rest/v1';
      const _sbKey = _sbCfg.anonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4emhtY3JwZXl1cXNsdXB0dGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MjQ5MDgsImV4cCI6MjA5MzAwMDkwOH0.-muAjBKc2PekqbgRltLVBnUCdxfQlHNxmVruXrw_sl8';
      const _sbHdr = { 'apikey': _sbKey, 'Authorization': 'Bearer ' + _sbKey, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' };
      // PATCH todas las filas de esta unidad en todas las plataformas
      fetch(_sbUrl + '/gps_barridos?num_economico=eq.' + encodeURIComponent(num) + '&empresa_id=eq.' + encodeURIComponent(emp), {
        method: 'PATCH', headers: _sbHdr, body: JSON.stringify({ notas: txt || null })
      }).then(r => {
        if (r.ok) {
          console.log('[notas PATCH] OK ✓', num, '"' + txt + '"');
        } else {
          r.text().then(t => console.error('[notas PATCH] FAIL', r.status, t));
        }
      }).catch(e => console.error('[notas PATCH] ERROR', e));
    }
    UI.closeModal();
    UI.toast('Notas guardadas', 'success');
    // 3. Actualizar el display de notas inmediatamente si está visible
    const nd = document.getElementById('notas-display');
    if (nd) {
      nd.innerHTML = txt
        ? txt.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        : '<span style="color:var(--text3)">Sin notas registradas.</span>';
    }
    // 4. Si el detalle está abierto, re-renderizar SOLO la sección notas (no todo el detalle)
    // Llamar renderDetalle haría fetch async a Supabase que podría pisar el texto
    // Solo llamar si notas-display no existe (detalle no está abierto)
    if (!nd && typeof UI.renderDetalle === 'function') {
      UI.renderDetalle(num, emp);
    }
    // 5. Refrescar celda NOTAS en tabla de plataformas directamente (sin re-render completo)
    const platRows = document.querySelectorAll('[data-num="' + num + '"]');
    platRows.forEach(row => {
      const notasCells = row.querySelectorAll('td.plat-obs-cell');
      // La última celda plat-obs-cell es la de NOTAS
      const notasCell = notasCells[notasCells.length - 1];
      if (notasCell) {
        const span = notasCell.querySelector('span');
        if (span) span.innerHTML = txt
          ? txt.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
          : '<span style="color:var(--text3);font-style:italic">+ nota…</span>';
      }
    });
    // 6. NO hacer _refreshPlatTable — ya actualizamos las celdas directamente arriba
    // Un refresh completo re-leería u.notas del store y podría pisar el texto si hay race condition
  }

  function _updateManualFechaConISO(num,emp,iso){
    DB.upsertUnidad(num,{ultima_act:iso},emp);
    toast(`Fecha GPS actualizada para unidad ${num}`,'success');
    renderDetalle(num,emp);
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
      const borderC = f.esSiniestro ? 'rgba(192,57,43,.5)' : 'rgba(192,125,16,.4)';
      const bgC = f.esSiniestro ? 'rgba(192,57,43,.08)' : 'rgba(192,125,16,.08)';
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
    const etiqueta = fichaFalla.motivo || "";
    DB.upsertUnidad(num, { observaciones: etiqueta, _fuente: "falla_sync" }, emp);
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

    DB.upsertUnidad(numVal,datos,emp);
    DB.addLog('manual',`Unidad ${numVal} guardada manualmente (${tipo})`,emp);

    if (continuar) {
      toast(`✓ Unidad ${numVal} guardada — Agrega la siguiente`,'success',2500);
      // Reabrir el modal limpio manteniendo el tipo de registro
      closeModal();
      setTimeout(()=>{
        openEditarUnidad(null, emp);
        // Mantener el tipo de captura seleccionado
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
  function _alertCarga(id,msg,type){const el=$(id);if(!el)return;const c={success:'#1a9e6e',error:'#c0392b',info:'#3b82f6',warn:'#c07d10'}[type]||'#3b82f6';el.innerHTML=`<div style="padding:9px 13px;border-radius:7px;font-size:12px;background:${c}18;color:${c};border:1px solid ${c}44;display:flex;align-items:center;gap:8px">${{success:'✓',error:'✕',info:'ℹ',warn:'⚠'}[type]||'ℹ'} ${esc(msg)}</div>`;}

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
    const res=DB.saveAsignacion(mes,_asigPending,DB.getEmpresaActiva(),{marcarInactivas:marcar});
    const _empAsig = DB.getEmpresaActiva();
    toast(`✓ Asignación "${mes}": ${res.total} unidades (${res.creadas} nuevas, ${res.actualizadas} actualizadas${marcar?', '+res.inactivadas+' inactivadas':''})`,'success',6000);
    // Enviar a Supabase con la empresa activa correcta (fix: antes se enviaba null)
    if (window.GPS_SB && _asigPending) {
      GPS_SB.saveAsignacion(mes, _asigPending, _empAsig)
        .then(r => console.log(`[Asignacion Supabase] OK — ${_empAsig}: ${r?.total} filas`))
        .catch(e => console.error('[Asignacion Supabase] ERROR:', e.message));
    }
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
      const c=h.tipo==='error'?'#c0392b':h.tipo==='barrido'?'#1a9e6e':h.tipo==='asignacion'?'#3b82f6':h.tipo==='manual'?'#a78bfa':'#9ca3af';
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
    const COLS={CEIBA:'Plate No. | GPS Time | Serial No.',SAMSARA:'Nombre | Última hora de registro | VG/Serie',AVL:'Grouping | Último mensaje',SCANIA:'Vehículo | Hora',MAN:'Dispositivo | VIN | Ultima Conexion',VOLVO:'Captura manual',MOTIVE:'ID Entidad | Última Actividad | Estado | Serie VG | Serie Cam'};
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

  function integrarBarridos(){
    const emp=DB.getEmpresaActiva();
    const entries=Object.entries(_barridosPending);
    if(!entries.length){toast('No hay archivos pendientes','warn');return;}
    let totalAct=0,totalNoEnc=0;
    entries.forEach(([plat,{parsed}])=>{
      const res=DB.saveBarrido(plat,parsed,emp);
      totalAct+=res.actualizadas;
      totalNoEnc+=res.noEncontradas;
    });
    _barridosPending={};
    _refreshLog();
    toast(`✓ Integrados: ${totalAct} unidades actualizadas${totalNoEnc?' · '+totalNoEnc+' sin asignación (creadas)':''}`, 'success', 5000);
    _setStep('bstep-',1);
    _renderPlatDetectCards();
    _updateBarridoResumen();
    setTimeout(()=>App.nav(null,'panel-resumen'), 800);
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
    _reactivar, _confirmarEliminar, _addNote, _guardarNotaModal,
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
    _abrirCapturaManualPlat, _autocompletarCapturaManual,
    _platCheckAll, _platUpdateSelCount, _eliminarSeleccionadas,
    _eliminarDeBarrido, _editarFechaInline, _confirmarFechaInline,
    _recalcularDiasManual, _guardarCapturaManualPlat, _editarCapturaManuaRow,
    _modalDesinstalacion, _liberarDesinstalacion,
    _updatePlatFechaConISO,
    // v7.1: tabs del detalle inline y guardar observaciones in-situ
    _cambiarPlatDetailTab, _guardarObsInline, _editarObsRapido, _editarNotasRapido,
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
    _onMaestraFilterChange, _resetMaestraFilters, _setMaestraPlatFilter, _exportarMaestra,
    // date picker
    openDatePicker, _confirmDatePicker,
    // carga
    handleAsigFile, procesarAsig,
    handleBarridoFiles, integrarBarridos,
    // empresa
    cambiarEmpresa, _applyEmpresaTheme, _toggleNavGroup, _initNavGroups,
    get _platExpandida(){ return _platExpandida; },
    _refreshPlatTable,
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
