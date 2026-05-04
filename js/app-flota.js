/* ═══════════════════════════════════════════════════
   CCTV Fleet Control — Módulo Carga de Asignación
   Procesa archivos Excel FLOTA_GHO y guarda en Supabase
   v1.0
═══════════════════════════════════════════════════ */

const FLOTA = (() => {
  'use strict';

  // ─── Estado ───────────────────────────────────
  const state = {
    archivo:    null,   // File object
    archivoNom: '',
    filas:      [],     // datos parseados [{numEco, cromatica, estatus, base, pisos, servicio}]
    mesAnio:    '',     // '2026-05'
    step:       1,      // 1=upload 2=preview 3=done
  };

  // ─── ESQUEMAS POR EMPRESA (índice base-0) ──────
  const ESQUEMAS = {
    // GHO: FLOTA_GHO_Oficial_...  hoja Detalle1
    GHO: {
      patron:    /FLOTA/i,
      nombre_archivo: 'FLOTA_GHO_Oficial_...',
      columnas_label: 'E=ECONÓMICO · M=CROMÁTICA · T=ESTATUS · K=BASE · R=PISOS · G=SERVICIO',
      tiene_pisos: true,
      parsear: (row) => ({
        numEco:         String(row[4]  || '').trim(),
        cromatica:      String(row[12] || '').trim(),
        estatusInforme: String(row[19] || '').trim(),
        base:           String(row[10] || '').trim(),
        pisos:          String(row[17] || '').trim(),
        servicio:       String(row[6]  || '').trim(),
      }),
      esEcoValido: (numEco) => numEco.length >= 2 && /\d/.test(numEco),
      detectarCabecera: (rows) => {
        for (let i = 0; i < Math.min(10, rows.length); i++) {
          const c = String(rows[i][4] || '').toUpperCase();
          if (c.includes('ECONÓM') || c.includes('ECONOM') || c.includes('NUM')) return i + 1;
        }
        return 1;
      },
    },
    // ETN: 05_ASIGNACION_STLU_DTM_MAYO  hoja Detalle1
    // Estructura real del archivo:
    //   Fila 1: título "Detalles para Cuenta de ECONÓMICO..."
    //   Fila 2: vacía
    //   Fila 3: cabecera (ECONÓMICO, CROMÁTICA, ESTATUS, MODELO, ROL, BASE, EMPRESA...)
    //   Fila 4+: datos reales (números económicos en col A)
    ETN: {
      patron:    /ASIGNAC/i,
      nombre_archivo: 'XX_ASIGNACION_STLU_DTM_MES',
      columnas_label: 'A=ECONÓMICO · B=CROMÁTICA · C=ESTATUS · F=BASE · H=SERVICIO',
      tiene_pisos: false,  // sin pisos en archivo — se agrega manual
      parsear: (row) => ({
        numEco:         String(row[0] || '').trim(),
        cromatica:      String(row[1] || '').trim(),
        estatusInforme: String(row[2] || '').trim(),
        base:           String(row[5] || '').trim(),
        pisos:          '',  // se agrega manual desde el concentrado
        servicio:       String(row[7] || '').trim(),
      }),
      // El número económico ETN es puramente numérico (4-6 dígitos)
      esEcoValido: (numEco) => /^\d{3,6}$/.test(numEco.trim()),
      detectarCabecera: (rows) => {
        // Estrategia 1: buscar la fila cuya col[0] es la cabecera "ECONÓMICO"
        // (esa fila es la cabecera real de columnas, los datos empiezan en la siguiente)
        for (let i = 0; i < Math.min(15, rows.length); i++) {
          const c = String(rows[i][0] || '').toUpperCase().trim();
          // La fila de cabecera dice exactamente "ECONÓMICO" o "ECONOMICO"
          if (c === 'ECONÓMICO' || c === 'ECONOMICO' || c === 'ECO' || c === 'NUM ECONÓMICO') {
            return i + 1; // la siguiente fila son los datos
          }
        }
        // Estrategia 2: buscar la primera fila donde col[0] sea un número puro de 4+ dígitos
        for (let i = 0; i < Math.min(15, rows.length); i++) {
          const c = String(rows[i][0] || '').trim();
          if (/^\d{4,6}$/.test(c)) return i; // esta fila ya es datos
        }
        // Fallback
        return 3;
      },
    },
  };

  // Esquema default (GHO)
  const COL = { E: 4, G: 6, K: 10, M: 12, R: 17, T: 19 };  // legacy, no usado directamente

  function getEsquema(emp) {
    return ESQUEMAS[emp] || ESQUEMAS['GHO'];
  }

  // ─── Render principal ──────────────────────────
  function renderCargaAsignacion(session) {
    const emp = DATA.state.currentEmpresa || 'GHO';
    const esquema = getEsquema(emp);
    return `
    <div id="mod-flota" class="module active">
      <div class="mod-header">
        <div class="mod-title-wrap">
          <div style="display:flex;align-items:center;gap:10px">
            <div class="mod-icon" style="background:rgba(139,92,246,.15);color:#8b5cf6">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
            </div>
            <div>
              <h2 class="mod-title">Carga de Asignación Mensual</h2>
              <p class="mod-subtitle" id="flotaSubtitle">Sube el archivo Excel <strong>${esquema.nombre_archivo}</strong> — hoja <strong>Detalle1</strong></p>
            </div>
          </div>
        </div>
      </div>

      <div id="flotaContent" style="max-width:900px;margin:0 auto;padding:0 4px">
        ${renderStep1()}
      </div>
    </div>`;
  }

  // ─── STEP 1: Drop zone ────────────────────────
  function renderStep1() {
    const emp = DATA.state.currentEmpresa || 'GHO';
    return `
    <div style="display:grid;grid-template-columns:1fr 280px;gap:16px;align-items:start">

      <!-- Drop zone -->
      <div>
        <div id="flotaDropZone"
          ondragover="event.preventDefault();this.classList.add('dz-hover')"
          ondragleave="this.classList.remove('dz-hover')"
          ondrop="FLOTA.onDrop(event)"
          style="border:2px dashed rgba(139,92,246,.35);border-radius:16px;background:rgba(139,92,246,.04);
                 padding:52px 24px;text-align:center;cursor:pointer;transition:all .2s"
          onclick="document.getElementById('flotaFileInput').click()">
          <div style="font-size:36px;margin-bottom:12px">📊</div>
          <div style="font-size:14px;font-weight:600;color:var(--text1);margin-bottom:6px">Arrastra y suelta el archivo aquí</div>
          <div style="font-size:12px;color:var(--text3);margin-bottom:16px">o haz clic para seleccionar</div>
          <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();document.getElementById('flotaFileInput').click()">
            📂 Seleccionar archivo
          </button>
          <div style="margin-top:12px;font-size:10px;color:var(--text3)">.xlsx, .xls, .csv — hasta 50 MB</div>
        </div>
        <input type="file" id="flotaFileInput" accept=".xlsx,.xls,.csv" style="display:none"
          onchange="FLOTA.onFileSelect(this.files[0])">

        <!-- Progreso de detección -->
        <div id="flotaProgress" style="margin-top:16px;display:none">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text3);margin-bottom:10px">
            Proceso de detección
          </div>
          <div class="flota-steps">
            ${['Archivo','Leyendo','Detectando','Validando','Listo'].map((s,i) =>
              '<div class="fs-step" id="fstep-' + i + '">'
              + '<div class="fs-dot">' + (i+1) + '</div>'
              + '<div class="fs-lbl">' + s + '</div>'
              + '</div>'
            ).join('<div class="fs-line"></div>')}
          </div>
          <div id="flotaDetMsg" style="margin-top:10px;font-size:12px;color:var(--green)"></div>
        </div>

        <!-- Preview -->
        <div id="flotaPreview" style="display:none;margin-top:16px"></div>
      </div>

      <!-- Panel derecho: formato esperado + historial -->
      <div style="display:flex;flex-direction:column;gap:12px">
        <div class="card" style="padding:14px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text3);margin-bottom:10px">
            Formato esperado
          </div>
          <div style="font-size:11px;color:var(--text2);font-family:var(--mono);background:var(--bg3);padding:8px 10px;border-radius:6px;margin-bottom:8px">
            ${getEsquema(emp).nombre_archivo}
          </div>
          <div style="font-size:11px;color:var(--text3);margin-bottom:6px">
            <span style="color:var(--text2);font-weight:600">Hoja:</span> Detalle1
          </div>
          <div style="font-size:10px;color:var(--text3);line-height:1.8">
            ${getEsquema(emp).columnas_label.split('·').map(p => {
              const parts = p.trim().split('=');
              const col   = parts[0] ? parts[0].trim() : '';
              const lbl   = parts[1] ? parts[1].trim() : '';
              return '<span style="color:#8b5cf6">' + col + '</span>=' + lbl;
            }).join(' · ')}
          </div>
          ${getEsquema(emp).tiene_pisos ? '' :
            '<div style="margin-top:6px;font-size:10px;color:#f59e0b">⚠️ Pisos se agregan manual en el concentrado</div>'
          }
        </div>

        <div class="card" style="padding:14px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text3);margin-bottom:10px">
            Empresa activa
          </div>
          <div style="font-size:22px;font-weight:800;color:#8b5cf6">${emp}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:4px">Los datos se guardarán bajo esta empresa</div>
        </div>

        <div class="card" style="padding:14px" id="flotaHistorialPanel">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text3);margin-bottom:10px">
            Últimas cargas
          </div>
          <div id="flotaHistorial" style="font-size:11px;color:var(--text3)">Cargando...</div>
        </div>
      </div>
    </div>`;
  }

  // ─── STEP 2: Vista de concentrado guardado ─────
  function renderConcentrado(emp) {
    return `
    <div id="flotaConcentrado">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">
        <div>
          <h3 style="font-size:17px;font-weight:700;margin:0">Concentrado de Asignación</h3>
          <div style="font-size:12px;color:var(--text3);margin-top:2px" id="concSubtitle">Cargando...</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <input type="text" id="flotaBuscador"
            placeholder="🔍 Buscar (espacios: 2280 2175)..."
            style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text1);font-size:12px;padding:7px 12px;width:240px;font-family:inherit"
            oninput="FLOTA.filtrarTabla(this.value)">
          <select id="flotaFiltroMes" style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text1);font-size:12px;padding:7px 10px;font-family:inherit"
            onchange="FLOTA.cambiarMes(this.value)">
          </select>
          <button class="btn btn-ghost btn-sm" onclick="FLOTA.exportarCSV()" style="gap:5px">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            CSV
          </button>
          <button class="btn btn-primary btn-sm" onclick="FLOTA.showUpload()" style="gap:5px">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Cargar nueva
          </button>
        </div>
      </div>

      <!-- KPIs -->
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:16px" id="flotaKpis">
        <div class="card" style="padding:14px;text-align:center">
          <div style="font-size:26px;font-weight:800;font-family:var(--mono)" id="kfTotal">—</div>
          <div style="font-size:11px;color:var(--text3)">Total</div>
        </div>
        <div class="card" style="padding:14px;text-align:center">
          <div style="font-size:26px;font-weight:800;font-family:var(--mono);color:var(--green)" id="kfOp">—</div>
          <div style="font-size:11px;color:var(--text3)">En Operación</div>
        </div>
        <div class="card" style="padding:14px;text-align:center">
          <div style="font-size:26px;font-weight:800;font-family:var(--mono);color:var(--red)" id="kfFuera">—</div>
          <div style="font-size:11px;color:var(--text3)">Fuera de Op.</div>
        </div>
        <div class="card" style="padding:14px;text-align:center">
          <div style="font-size:26px;font-weight:800;font-family:var(--mono);color:#f59e0b" id="kfVenta">—</div>
          <div style="font-size:11px;color:var(--text3)">Para Venta</div>
        </div>
        <div class="card" style="padding:14px;text-align:center">
          <div style="font-size:26px;font-weight:800;font-family:var(--mono);color:#8b5cf6" id="kfOtros">—</div>
          <div style="font-size:11px;color:var(--text3)">Otros/Renta</div>
        </div>
      </div>

      <!-- Tabla -->
      <div class="card" style="padding:0;overflow:hidden">
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:12px" id="flotaTabla">
            <thead>
              <tr style="background:var(--bg3);border-bottom:1px solid var(--border)">
                <th style="padding:10px 12px;text-align:left;color:var(--text3);font-weight:600;white-space:nowrap">Unidad</th>
                <th style="padding:10px 12px;text-align:left;color:var(--text3);font-weight:600">Base</th>
                <th style="padding:10px 12px;text-align:left;color:var(--text3);font-weight:600">Cromática</th>
                <th style="padding:10px 12px;text-align:left;color:var(--text3);font-weight:600">Servicio</th>
                <th style="padding:10px 12px;text-align:left;color:var(--text3);font-weight:600">Estatus</th>
                <th style="padding:10px 12px;text-align:left;color:var(--text3);font-weight:600">Pisos</th>
                <th style="padding:10px 12px;text-align:left;color:var(--text3);font-weight:600">Mes</th>
              </tr>
            </thead>
            <tbody id="flotaTbody">
              <tr><td colspan="7" style="padding:32px;text-align:center;color:var(--text3)">
                <div style="display:inline-flex;align-items:center;gap:8px">
                  <div style="width:14px;height:14px;border:2px solid rgba(255,255,255,.1);border-top-color:#8b5cf6;border-radius:50%;animation:spin .7s linear infinite"></div>
                  Cargando datos...
                </div>
              </td></tr>
            </tbody>
          </table>
        </div>
        <div id="flotaPaginador" style="padding:10px 16px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;font-size:11px;color:var(--text3)"></div>
      </div>
    </div>`;
  }

  // ─── FILE HANDLERS ────────────────────────────
  function onDrop(e) {
    e.preventDefault();
    document.getElementById('flotaDropZone')?.classList.remove('dz-hover');
    const file = e.dataTransfer?.files?.[0];
    if (file) onFileSelect(file);
  }

  async function onFileSelect(file) {
    if (!file) return;
    state.archivo    = file;
    state.archivoNom = file.name;

    // Verificar que parezca un archivo de la empresa activa
    const emp      = DATA.state.currentEmpresa || 'GHO';
    const esquema  = getEsquema(emp);
    const nombreUp = file.name.toUpperCase();
    if (!esquema.patron.test(file.name)) {
      UI.toast('⚠️ El archivo no parece ser de ' + emp + ' — verifica el nombre', 'warn');
    }

    // Mostrar progreso
    const prog = document.getElementById('flotaProgress');
    if (prog) prog.style.display = '';
    setStep(0);

    try {
      setStep(1); // Leyendo
      const filas = await leerExcel(file);
      setStep(2); // Detectando
      const parsed = parsearFilas(filas);
      setStep(3); // Validando
      if (parsed.length === 0) {
        UI.toast('No se encontraron filas en la hoja Detalle1', 'err');
        return;
      }
      state.filas = parsed;
      // Intentar detectar mes del nombre del archivo
      state.mesAnio = detectarMes(file.name);
      setStep(4); // Listo

      const msg = document.getElementById('flotaDetMsg');
      if (msg) msg.innerHTML = `✓ ✓ ${parsed.length} unidades detectadas. Base: OK · Cromática: OK · Estatus: OK`;

      mostrarPreview(parsed, file.name);

    } catch(err) {
      console.error('[FLOTA]', err);
      UI.toast('Error al leer el archivo: ' + err.message, 'err');
    }
  }

  function setStep(n) {
    for (let i = 0; i <= 4; i++) {
      const el = document.getElementById('fstep-' + i);
      if (!el) continue;
      el.classList.remove('fs-active','fs-done');
      if (i < n)  el.classList.add('fs-done');
      if (i === n) el.classList.add('fs-active');
    }
  }

  // ─── LEER EXCEL ───────────────────────────────
  async function _ensureXLSX() {
    if (window.XLSX) return;
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload  = resolve;
      s.onerror = () => reject(new Error('No se pudo cargar la librería de Excel. Verifica tu conexión.'));
      document.head.appendChild(s);
    });
  }

  async function leerExcel(file) {
    await _ensureXLSX();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const data  = new Uint8Array(e.target.result);
          const wb    = XLSX.read(data, { type: 'array' });
          // Buscar hoja Detalle1
          const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('detalle1'))
                         || wb.SheetNames[0];
          const ws    = wb.Sheets[sheetName];
          const rows  = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          resolve(rows);
        } catch(err) { reject(err); }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  // ─── PARSEAR FILAS ────────────────────────────
  function parsearFilas(rows) {
    if (!rows || rows.length < 2) return [];
    const emp     = DATA.state.currentEmpresa || 'GHO';
    const esquema = getEsquema(emp);

    const startRow = esquema.detectarCabecera(rows);
    const result   = [];

    for (let i = startRow; i < rows.length; i++) {
      const row    = rows[i];
      const parsed = esquema.parsear(row);
      if (!parsed.numEco || !esquema.esEcoValido(parsed.numEco)) continue;
      result.push(parsed);
    }
    return result;
  }

  function detectarMes(nombre) {
    // Intentar extraer fecha del nombre: FLOTA_GHO_Oficial_27Abril2026_1
    const meses = { enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,
                    julio:7,agosto:8,septiembre:9,octubre:10,noviembre:11,diciembre:12 };
    const lower = nombre.toLowerCase();
    for (const [mes, num] of Object.entries(meses)) {
      if (lower.includes(mes)) {
        const yearMatch = nombre.match(/20\d{2}/);
        const year = yearMatch ? yearMatch[0] : new Date().getFullYear();
        return `${year}-${String(num).padStart(2,'0')}`;
      }
    }
    // Fallback: mes actual
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  }

  // ─── PREVIEW ──────────────────────────────────
  function mostrarPreview(filas, nombre) {
    const prev = document.getElementById('flotaPreview');
    if (!prev) return;

    const emp      = DATA.state.currentEmpresa || 'GHO';
    const tipoArch = nombre.split('_').slice(0,2).join('_');
    const enOp     = filas.filter(f => /operaci/i.test(f.estatusInforme)).length;
    const fueraOp  = filas.filter(f => /fuera/i.test(f.estatusInforme)).length;
    const venta    = filas.filter(f => /venta/i.test(f.estatusInforme)).length;
    const otros    = filas.length - enOp - fueraOp - venta;

    const sample   = filas.slice(0, 5);

    prev.style.display = '';
    prev.innerHTML = `
      <div class="card" style="padding:0;overflow:hidden">
        <!-- Header detección -->
        <div style="padding:12px 16px;background:rgba(34,197,94,.06);border-bottom:1px solid rgba(34,197,94,.12);display:flex;align-items:center;gap:8px">
          <div style="width:20px;height:20px;background:var(--green);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0">✓</div>
          <div>
            <div style="font-size:12px;font-weight:700;color:var(--green)">ASIGNACIÓN (${emp})</div>
            <div style="font-size:11px;color:var(--text3)">${nombre} · Hoja: Detalle1</div>
          </div>
        </div>

        <!-- Vista previa -->
        <div style="padding:14px 16px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text3);margin-bottom:8px">
            Vista previa (primeras 5 filas)
          </div>
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:11px">
              <thead>
                <tr style="border-bottom:1px solid var(--border)">
                  ${(getEsquema(DATA.state.currentEmpresa||'GHO').tiene_pisos ? ['Unidad','Base','Cromática','Servicio','Estatus','Pisos'] : ['Unidad','Base','Cromática','Servicio','Estatus']).map(h =>
                    '<th style="padding:6px 10px;text-align:left;color:var(--text3);font-weight:600;white-space:nowrap">' + h + '</th>'
                  ).join('')}
                </tr>
              </thead>
              <tbody>
                ${sample.map(f =>
                  '<tr style="border-bottom:1px solid rgba(255,255,255,.03)">'
                  + '<td style="padding:7px 10px;font-family:var(--mono);font-weight:600">' + f.numEco + '</td>'
                  + '<td style="padding:7px 10px">' + (f.base || '—') + '</td>'
                  + '<td style="padding:7px 10px">' + (f.cromatica || '—') + '</td>'
                  + '<td style="padding:7px 10px">' + (f.servicio || '—') + '</td>'
                  + '<td style="padding:7px 10px">' + estatusBadge(f.estatusInforme) + '</td>'
                  + (getEsquema(DATA.state.currentEmpresa||'GHO').tiene_pisos ? '<td style="padding:7px 10px">' + (f.pisos || '—') + '</td>' : '')
                  + '</tr>'
                ).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Resumen + acciones -->
        <div style="padding:12px 16px;background:var(--bg3);border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
          <div style="display:flex;gap:16px;font-size:11px">
            <span>Registros: <strong style="color:var(--text1)">${filas.length}</strong></span>
            <span style="color:var(--green)">Op: ${enOp}</span>
            <span style="color:var(--red)">Fuera: ${fueraOp}</span>
            <span style="color:#f59e0b">Venta: ${venta}</span>
            ${otros > 0 ? `<span style="color:#8b5cf6">Otros: ${otros}</span>` : ''}
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-ghost btn-sm" onclick="FLOTA.cancelar()">Cancelar</button>
            <button class="btn btn-primary" onclick="FLOTA.procesarYGuardar()" style="gap:6px">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              Procesar y guardar →
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function estatusBadge(est) {
    if (!est) return '<span style="color:var(--text3)">—</span>';
    const up = est.toUpperCase();
    if (up.includes('OPERACI') && !up.includes('FUERA')) return `<span style="background:rgba(34,197,94,.12);color:var(--green);border:1px solid rgba(34,197,94,.2);border-radius:4px;padding:1px 6px;font-size:10px;font-weight:600">EN OPERACIÓN</span>`;
    if (up.includes('FUERA'))  return `<span style="background:rgba(239,68,68,.12);color:var(--red);border:1px solid rgba(239,68,68,.2);border-radius:4px;padding:1px 6px;font-size:10px;font-weight:600">FUERA OP.</span>`;
    if (up.includes('VENTA'))  return `<span style="background:rgba(245,158,11,.12);color:#f59e0b;border:1px solid rgba(245,158,11,.2);border-radius:4px;padding:1px 6px;font-size:10px;font-weight:600">PARA VENTA</span>`;
    if (up.includes('RENTA'))  return `<span style="background:rgba(139,92,246,.12);color:#8b5cf6;border:1px solid rgba(139,92,246,.2);border-radius:4px;padding:1px 6px;font-size:10px;font-weight:600">RENTADO</span>`;
    return `<span style="background:rgba(255,255,255,.06);color:var(--text2);border:1px solid var(--border);border-radius:4px;padding:1px 6px;font-size:10px">${est}</span>`;
  }

  // ─── PROCESAR Y GUARDAR ───────────────────────
  async function procesarYGuardar() {
    if (!state.filas.length) return;
    const emp    = DATA.state.currentEmpresa || 'GHO';
    const session = AUTH.checkSession();
    const userId  = session?.username || session?.nombre || 'sistema';
    const mesAnio = state.mesAnio;
    const archivo = state.archivoNom;

    UI.toast('⏳ Guardando asignación...', 'info');

    try {
      // Upsert en lotes de 200
      const BATCH = 200;
      for (let i = 0; i < state.filas.length; i += BATCH) {
        const lote = state.filas.slice(i, i + BATCH).map(f => ({
          empresa_id:      emp,
          num_economico:   f.numEco,
          cromatica:       f.cromatica || null,
          estatus_informe: f.estatusInforme || null,
          base:            f.base || null,
          pisos:           f.pisos || null,
          servicio:        f.servicio || null,
          mes_anio:        mesAnio,
          archivo_origen:  archivo,
          cargado_por:     userId,
          updated_at:      new Date().toISOString(),
        }));

        const { error } = await _getClient().from('flota_asignacion').upsert(lote, {
          onConflict: 'empresa_id,num_economico,mes_anio',
          ignoreDuplicates: false,
        });

        if (error) throw error;
      }

      // Guardar log de carga
      const enOp   = state.filas.filter(f => /operaci/i.test(f.estatusInforme) && !/fuera/i.test(f.estatusInforme)).length;
      const fuera  = state.filas.filter(f => /fuera/i.test(f.estatusInforme)).length;
      const venta  = state.filas.filter(f => /venta/i.test(f.estatusInforme)).length;
      const otros  = state.filas.length - enOp - fuera - venta;

      await _getClient().from('flota_carga_log').insert({
        empresa_id:  emp,
        archivo:     archivo,
        mes_anio:    mesAnio,
        total:       state.filas.length,
        en_operacion:enOp,
        fuera_op:    fuera,
        para_venta:  venta,
        otros:       otros,
        cargado_por: String(userId),
      });

      UI.toast(`✅ ${state.filas.length} unidades guardadas correctamente`);
      // Ir al concentrado
      const main = document.getElementById('flotaContent');
      if (main) {
        main.innerHTML = renderConcentrado(emp);
        cargarConcentrado(emp);
      }

    } catch(err) {
      console.error('[FLOTA]', err);
      UI.toast('Error al guardar: ' + (err.message || err), 'err');
    }
  }

  // ─── CONCENTRADO ─────────────────────────────
  let _allRows = [];
  let _filteredRows = [];
  let _page = 0;
  const PAGE_SIZE = 50;

  async function cargarConcentrado(emp) {
    emp = emp || DATA.state.currentEmpresa || 'GHO';

    try {
      const sb = _getClient();

      // Cargar meses disponibles
      const { data: meses } = await sb.from('flota_asignacion')
        .select('mes_anio')
        .eq('empresa_id', emp)
        .order('mes_anio', { ascending: false });

      const mesesUnicos = [...new Set((meses || []).map(r => r.mes_anio))];

      const sel = document.getElementById('flotaFiltroMes');
      if (sel && mesesUnicos.length) {
        sel.innerHTML = mesesUnicos.map(m => `<option value="${m}">${_fmtMes(m)}</option>`).join('');
      }

      const mesActivo = mesesUnicos[0] || state.mesAnio;
      await cargarPorMes(emp, mesActivo);

    } catch(err) {
      console.error('[FLOTA concentrado]', err);
    }
  }

  async function cargarPorMes(emp, mes) {
    try {
      const sb = _getClient();
      const { data, error } = await sb.from('flota_asignacion')
        .select('*')
        .eq('empresa_id', emp)
        .eq('mes_anio', mes)
        .order('num_economico', { ascending: true });

      if (error) throw error;
      _allRows      = data || [];
      _filteredRows = _allRows;
      _page         = 0;

      actualizarKpis(_allRows);
      renderTabla();

      const sub = document.getElementById('concSubtitle');
      if (sub) sub.textContent = `${_allRows.length} unidades · ${_fmtMes(mes)}`;

    } catch(err) {
      console.error('[FLOTA mes]', err);
    }
  }

  function actualizarKpis(rows) {
    const enOp  = rows.filter(r => /operaci/i.test(r.estatus_informe) && !/fuera/i.test(r.estatus_informe)).length;
    const fuera = rows.filter(r => /fuera/i.test(r.estatus_informe)).length;
    const venta = rows.filter(r => /venta/i.test(r.estatus_informe)).length;
    const otros = rows.length - enOp - fuera - venta;
    const el = id => { const e = document.getElementById(id); if (e) e.textContent = ''; };
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set('kfTotal', rows.length);
    set('kfOp',    enOp);
    set('kfFuera', fuera);
    set('kfVenta', venta);
    set('kfOtros', otros);
  }

  function renderTabla() {
    const tbody  = document.getElementById('flotaTbody');
    const pagDiv = document.getElementById('flotaPaginador');
    if (!tbody) return;

    const start  = _page * PAGE_SIZE;
    const slice  = _filteredRows.slice(start, start + PAGE_SIZE);
    const total  = _filteredRows.length;
    const pages  = Math.ceil(total / PAGE_SIZE);

    if (slice.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="padding:24px;text-align:center;color:var(--text3)">Sin resultados</td></tr>';
    } else {
      tbody.innerHTML = slice.map(r => `
        <tr style="border-bottom:1px solid rgba(255,255,255,.03);transition:background .1s" onmouseover="this.style.background='rgba(255,255,255,.02)'" onmouseout="this.style.background=''">
          <td style="padding:8px 12px;font-family:var(--mono);font-weight:700">${r.num_economico}</td>
          <td style="padding:8px 12px;color:var(--text2)">${r.base || '—'}</td>
          <td style="padding:8px 12px;color:var(--text2)">${r.cromatica || '—'}</td>
          <td style="padding:8px 12px;color:var(--text2)">${r.servicio || '—'}</td>
          <td style="padding:8px 12px">${estatusBadge(r.estatus_informe)}</td>
          <td style="padding:8px 12px">${_renderPisosCel(r)}</td>
          <td style="padding:8px 12px;font-family:var(--mono);font-size:11px;color:var(--text3)">${_fmtMes(r.mes_anio)}</td>
        </tr>
      `).join('');
    }

    if (pagDiv) {
      pagDiv.innerHTML = `
        <span>${total} unidades · Página ${_page+1} de ${pages || 1}</span>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" onclick="FLOTA.paginar(-1)" ${_page === 0 ? 'disabled' : ''}>‹ Ant</button>
          <button class="btn btn-ghost btn-sm" onclick="FLOTA.paginar(1)"  ${_page >= pages-1 ? 'disabled' : ''}>Sig ›</button>
        </div>`;
    }
  }

  function filtrarTabla(q) {
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    _filteredRows = terms.length
      ? _allRows.filter(r => terms.every(t =>
          (r.num_economico || '').toLowerCase().includes(t) ||
          (r.base || '').toLowerCase().includes(t) ||
          (r.cromatica || '').toLowerCase().includes(t) ||
          (r.servicio || '').toLowerCase().includes(t)
        ))
      : _allRows;
    _page = 0;
    actualizarKpis(_filteredRows);
    renderTabla();
  }

  function paginar(dir) {
    const pages = Math.ceil(_filteredRows.length / PAGE_SIZE);
    _page = Math.max(0, Math.min(pages - 1, _page + dir));
    renderTabla();
  }

  async function cambiarMes(mes) {
    const emp = DATA.state.currentEmpresa || 'GHO';
    await cargarPorMes(emp, mes);
  }

  // ─── RENDER PISOS CELL ───────────────────────
  function _renderPisosCel(r) {
    const eid = r.id.replace(/'/g, '');
    if (r.pisos) {
      return '<span style="color:var(--text2)">' + r.pisos + '</span>'
           + ' <button onclick="FLOTA.editarPisos(\'' + eid + '\')"'
           + ' style="background:none;border:none;cursor:pointer;font-size:10px;color:var(--text3);padding:0 2px" title="Cambiar">✏️</button>';
    }
    const sel_id = 'psel_' + eid;
    return '<select id="' + sel_id + '" onchange="FLOTA.actualizarPisos(\'' + eid + '\',this.value)"'
      + ' style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.25);'
      + 'border-radius:6px;color:#f59e0b;font-size:10px;padding:2px 6px;cursor:pointer;font-family:inherit">'
      + '<option value="">Pendiente</option>'
      + '<option value="UNO">1 Piso</option>'
      + '<option value="DOS">2 Pisos</option>'
      + '</select>';
  }

  function editarPisos(id) {
    // Reemplazar el span por el select para editar
    const row = _allRows.find(r => r.id === id);
    if (!row) return;
    row.pisos = ''; // forzar que renderTabla muestre select
    renderTabla();
  }

  // ─── ACTUALIZAR PISOS (inline desde tabla) ────
  async function actualizarPisos(id, valor) {
    if (!id || !valor) return;
    try {
      const { error } = await _getClient()
        .from('flota_asignacion')
        .update({ pisos: valor, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      // Actualizar en memoria
      const row = _allRows.find(r => r.id === id);
      if (row) row.pisos = valor;
      const frow = _filteredRows.find(r => r.id === id);
      if (frow) frow.pisos = valor;
      UI.toast('✓ Pisos actualizado');
    } catch(err) {
      console.error('[FLOTA pisos]', err);
      UI.toast('Error al guardar pisos', 'err');
    }
  }

  function exportarCSV() {
    if (!_filteredRows.length) return;
    const headers = ['Unidad','Base','Cromática','Servicio','Estatus','Pisos','Mes'];
    const rows    = _filteredRows.map(r => [
      r.num_economico, r.base, r.cromatica, r.servicio,
      r.estatus_informe, r.pisos, r.mes_anio
    ].map(v => `"${(v||'').replace(/"/g,'""')}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const a   = document.createElement('a');
    a.href    = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `asignacion_${DATA.state.currentEmpresa}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }

  function cancelar() {
    state.archivo = null; state.filas = [];
    const prev = document.getElementById('flotaPreview');
    const prog = document.getElementById('flotaProgress');
    if (prev) { prev.style.display = 'none'; prev.innerHTML = ''; }
    if (prog) prog.style.display = 'none';
    document.getElementById('flotaFileInput').value = '';
  }

  function showUpload() {
    _initToken++; // cancelar cualquier init pendiente
    const main = document.getElementById('flotaContent');
    if (main) { main.innerHTML = renderStep1(); cargarHistorial(); }
  }

  async function cargarHistorial() {
    const emp = DATA.state.currentEmpresa || 'GHO';
    const sb  = _getClient();
    const el  = document.getElementById('flotaHistorial');
    if (!el) return;
    try {
      const { data } = await sb.from('flota_carga_log')
        .select('archivo,mes_anio,total,en_operacion,created_at')
        .eq('empresa_id', emp)
        .order('created_at', { ascending: false })
        .limit(5);
      if (!data || data.length === 0) { el.textContent = 'Sin cargas previas'; return; }
      el.innerHTML = data.map(r =>
        '<div style="padding:7px 0;border-bottom:1px solid rgba(255,255,255,.05)">'
        + '<div style="font-weight:600;color:var(--text1)">' + _fmtMes(r.mes_anio) + '</div>'
        + '<div style="color:var(--text3);font-size:10px;margin-top:2px">' + r.total + ' unidades · ' + r.en_operacion + ' en op.</div>'
        + '<div style="color:var(--text3);font-size:10px">' + (r.archivo ? r.archivo.slice(0,30) : '') + '</div>'
        + '</div>'
      ).join('');
    } catch(e) { el.textContent = 'Sin cargas previas'; }
  }

  // ─── INICIALIZAR (llamado cuando se carga el módulo) ──
  // Token para cancelar callbacks asíncronos si el usuario navega antes de que terminen
  let _initToken = 0;

  function init() {
    const token = ++_initToken;

    setTimeout(() => {
      // Si el módulo ya no está en el DOM, abortar
      if (!document.getElementById('mod-flota')) return;
      if (token !== _initToken) return;

      cargarHistorial();

      const emp = DATA.state.currentEmpresa || 'GHO';
      _getClient().from('flota_asignacion')
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', emp)
        .then(({ count, error }) => {
          // Verificar que seguimos en el módulo flota y con el mismo token
          if (token !== _initToken) return;
          if (!document.getElementById('mod-flota')) return;

          if (error) {
            console.warn('[FLOTA init] count error:', error.message);
            const el = document.getElementById('flotaHistorial');
            if (el && el.textContent === 'Cargando...') el.textContent = 'Sin cargas previas';
            return;
          }

          if (count > 0) {
            const main = document.getElementById('flotaContent');
            if (main) {
              try {
                main.innerHTML = renderConcentrado(emp);
                cargarConcentrado(emp);
              } catch(e) {
                console.error('[FLOTA init] renderConcentrado error:', e);
              }
            }
          } else {
            const el = document.getElementById('flotaHistorial');
            if (el && el.textContent === 'Cargando...') el.textContent = 'Sin cargas previas';
          }
        })
        .catch((err) => {
          if (token !== _initToken) return;
          console.warn('[FLOTA init] catch:', err);
          const el = document.getElementById('flotaHistorial');
          if (el) el.textContent = 'Sin cargas previas';
        });
    }, 150);
  }

  // ─── HELPERS ──────────────────────────────────
  function _getClient() {
    // Crear cliente solo una vez (lazy, nunca en el top-level del módulo)
    if (!window._flotaSbClient) {
      const cfg = window.CCTV_SUPABASE_CONFIG || {};
      const url  = cfg.url     || 'https://sxzhmcrpeyuqslupttby.supabase.co';
      const key  = cfg.anonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4emhtY3JwZXl1cXNsdXB0dGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MjQ5MDgsImV4cCI6MjA5MzAwMDkwOH0.-muAjBKc2PekqbgRltLVBnUCdxfQlHNxmVruXrw_sl8';
      window._flotaSbClient = window.supabase.createClient(url, key);
    }
    return window._flotaSbClient;
  }

  function _fmtMes(mesAnio) {
    if (!mesAnio) return '—';
    const meses = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const [y, m] = mesAnio.split('-');
    return `${meses[parseInt(m)] || m} ${y}`;
  }

  // ─── EXPORTS ──────────────────────────────────
  return {
    renderCargaAsignacion,
    renderConcentrado,
    onDrop,
    onFileSelect,
    procesarYGuardar,
    filtrarTabla,
    paginar,
    cambiarMes,
    exportarCSV,
    cancelar,
    showUpload,
    init,
    cargarConcentrado,
    actualizarPisos,
  };

})();
