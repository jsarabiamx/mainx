/**
 * parsers.js v4 — Parseo exacto por plataforma según documentación real
 *
 * ASIGNACIÓN (hoja: Detalle1)
 *   Fila 1: texto descriptivo "Detalles para Cuenta de ECONÓMICO - ESTATUS: ..."
 *   Fila 2: vacía
 *   Fila 3: HEADERS → A=ECONÓMICO, B=CROMÁTICA, C=ESTATUS, D=MODELO, E=ROL, F=BASE, G=EMPRESA DONDE OPERA, H=SERIE, I=MOTOR, J=PLACA/TARJETA, K=ASIENTOS, L=OBSERVACIONES
 *   Fila 4+: datos
 *
 * CEIBA (hoja: sheet1 / Sheet)
 *   Fila 1: HEADERS → A=Parent fleet, B=Plate No., C=Serial No., D=Speed, E=Latitude, F=Longitude, G=Direction, H=GPS time
 *
 * SAMSARA (hoja: samsara_reporte del estado)
 *   Fila 1: HEADERS → A=Nombre, B=Etiquetas, C=Número de serie del dispositivo, D=Producto/Estado, E=Tiempo, ...N=Última hora de registro
 *
 * AVL (hoja: Últimos datos de la unidad)
 *   Fila 1: HEADERS → A=Grouping, B=Último mensaje, C=Últimas coordenadas, D=Localización, E=Velocidad
 *
 * SCANIA (hoja: Posición de la flota)
 *   Fila 1: HEADERS → A=Vehículo, B=Hora, C=Nivel AdBlue, D=Batería, E=Velocidad
 *
 * MAN (hoja: Dispositivos)
 *   Fila 1: HEADERS → A=Dispositivo, B=VIN, C=Velocidad, D=Ultima Conexion, E=Comentario
 */
const Parsers = (() => {

  /* ══════════════════════════════════════════════════════
     UTILIDADES COMUNES
  ══════════════════════════════════════════════════════ */

  /**
   * cleanNum — extrae el primer número de 2-5 dígitos de cualquier string
   * "A2280" → "2280"  |  "2519 ETN" → "2519"  |  "2596 Mont 2608 - AERS" → "2596"
   * "B234"  → "234"   |  "3039 - AERS C S" → "3039"
   */
  function cleanNum(val) {
    if (val === null || val === undefined) return '';
    const s = String(val).trim();
    // Buscar primer número de 2-5 dígitos (números de unidad típicos: 600-8999)
    const m = s.match(/\b(\d{3,5})\b/);
    if (m) return m[1];
    // Fallback: cualquier secuencia de dígitos al principio
    const m2 = s.match(/(\d+)/);
    return m2 ? m2[1] : '';
  }

  /**
   * parseDate — convierte cualquier formato de fecha a Date
   * Maneja: Excel serial, ISO, "2026-04-14 23:42:19", "14-04-2026 20:57:54", etc.
   */
  function parseDate(val) {
    if (!val && val !== 0) return null;
    if (val instanceof Date && !isNaN(val)) return val;

    // Excel serial number
    if (typeof val === 'number' && val > 25000 && val < 60000) {
      const d = new Date((val - 25569) * 86400 * 1000);
      return isNaN(d) ? null : d;
    }

    let s = String(val).trim();
    if (!s || s === '0' || s === 'NaN') return null;

    // Quitar hipervínculos si viniera como URL
    if (s.startsWith('http')) return null;

    // Formato AVL: "2023-09-07 11:07 19" (el segundo viene después de espacio, no ":")
    // Normalizar: "2023-09-07 11:07 19" → "2023-09-07 11:07:19"
    s = s.replace(/^(\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2})\s+(\d{1,2})\b/, '$1:$2');

    // Si tiene múltiples fechas (AVL repite la fecha), tomar solo primera parte
    const multiDateMatch = s.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?::\d{2})?)/);
    if (multiDateMatch) s = multiDateMatch[1];

    // Intentar parseo directo (ISO y variantes)
    let d = new Date(s.replace(' ', 'T'));
    if (!isNaN(d)) return d;

    // DD-MM-YYYY HH:MM:SS o DD/MM/YYYY
    const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[T\s](\d{1,2}:\d{2}(?::\d{2})?))?/);
    if (m1) {
      const iso = `${m1[3]}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}${m1[4]?'T'+m1[4]:''}`;
      d = new Date(iso);
      if (!isNaN(d)) return d;
    }

    // YYYY-MM-DD sin hora
    const m2 = s.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})$/);
    if (m2) {
      d = new Date(s);
      if (!isNaN(d)) return d;
    }

    return null;
  }

  function fmtDate(v) {
    if (!v) return '';
    const d = v instanceof Date ? v : new Date(v);
    if (isNaN(d)) return String(v).substring(0,16);
    // "14/04/2026 08:15"
    return d.toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric'}) + ' ' +
           d.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
  }

  function fmtDateShort(v) {
    if (!v) return '';
    const d = new Date(v);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric'});
  }

  function fmtTime(v) {
    if (!v) return '';
    const d = new Date(v);
    if (isNaN(d)) return '';
    return d.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
  }

  function diasDesde(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d)) return null;
    const hoy = new Date();
    const hoyLocal = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const fechaLocal = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.round((hoyLocal.getTime() - fechaLocal.getTime()) / 86400000);
  }

  function statusClass(dias) {
    if (dias === null || dias === undefined) return 'sin';
    try {
      const cfg = DB.getConfig();
      if (dias <= cfg.diasLinea)    return 'enlinea';
      if (dias <= cfg.diasAtencion) return 'atencion';
    } catch(e) {
      if (dias <= 1) return 'enlinea';
      if (dias <= 4) return 'atencion';
    }
    return 'critico';
  }

  /**
   * getColByIndex — obtiene valor de una fila por índice de columna (0-based)
   * Compatible con sheet_to_json que usa nombres de headers como keys
   */
  function getByIdx(row, headers, idx) {
    const key = headers[idx];
    return key !== undefined ? row[key] : undefined;
  }

  /* ══════════════════════════════════════════════════════
     LECTOR XLSX — con selección de hoja específica
  ══════════════════════════════════════════════════════ */
  function readXLSX(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const data = new Uint8Array(e.target.result);
          const wb = XLSX.read(data, {
            type: 'array',
            cellDates: true,
            cellNF: false,
            raw: false,
            cellHTML: false,
            cellFormula: false,
            cellStyles: false
          });

          // Detectar si es archivo AVL por nombre de archivo o por combinación de hojas
          const fname = String(file.name || '').toLowerCase();
          const isAVLByFilename = fname.includes('para_barridos') || fname.includes('para barridos') ||
                                  fname.includes('_status_') || fname.includes(' status ') ||
                                  /status[_\s-]\d{4}/.test(fname) || /_status\.xl/.test(fname);
          const normalize = s => String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
          const hasContent    = wb.SheetNames.some(n => normalize(n) === 'content' || normalize(n).startsWith('content'));
          const hasUltimos    = wb.SheetNames.some(n => normalize(n).includes('ultimos datos') || normalize(n).includes('ultimo dato'));
          const isAVLByShape  = hasContent && hasUltimos;
          const isAVL = isAVLByFilename || isAVLByShape;

          // Si es AVL, eliminar físicamente la hoja "Content" del workbook
          // así NADIE puede seleccionarla por error más adelante.
          let sheetNames = wb.SheetNames.slice();
          if (isAVL) {
            const contentSheets = sheetNames.filter(n => normalize(n) === 'content' || normalize(n).startsWith('content'));
            if (contentSheets.length > 0) {
              console.log('[readXLSX] Archivo AVL detectado — eliminando hoja(s) "Content":', contentSheets);
              contentSheets.forEach(n => {
                delete wb.Sheets[n];
                const idx = wb.SheetNames.indexOf(n);
                if (idx >= 0) wb.SheetNames.splice(idx, 1);
              });
              sheetNames = wb.SheetNames.slice();
            }
          }

          const sheets = {};
          sheetNames.forEach(name => {
            const ws = wb.Sheets[name];
            // Eliminar hipervínculos antes de convertir: usar solo el valor visible (.w o .v)
            if (ws) {
              Object.keys(ws).forEach(addr => {
                if (addr.startsWith('!')) return;
                const cell = ws[addr];
                if (cell && cell.l) delete cell.l; // quitar hyperlink
                // Preferir valor formateado (w) sobre raw (v)
                if (cell && cell.w !== undefined) cell.v = cell.w;
              });
            }
            const arr = XLSX.utils.sheet_to_json(ws, {
              header: 1,
              defval: '',
              raw: false,
              blankrows: false
            });
            sheets[name] = arr;
          });

          console.log('[readXLSX] Hojas finales:', sheetNames, isAVL ? '(AVL con Content removida)' : '');
          resolve({ sheets, sheetNames, filename: file.name, isAVL });
        } catch(err) { reject(err); }
      };
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
      reader.readAsArrayBuffer(file);
    });
  }

  /* ══════════════════════════════════════════════════════
     PARSER: ASIGNACIÓN
     Hoja: "Detalle1" (buscar por nombre)
     Estructura:
       Fila 0: "Detalles para Cuenta de ECONÓMICO - ESTATUS: EN OPERACIÓN..."
       Fila 1: vacía (a veces)
       Fila 2: HEADERS: ECONÓMICO | CROMÁTICA | ESTATUS | MODELO | ROL | BASE | EMPRESA DONDE OPERA | SERIE | MOTOR | PLACA/TARJETA | ASIENTOS | OBSERVACIONES
       Fila 3+: datos
  ══════════════════════════════════════════════════════ */
  function parseAsignacion(rows) {
    if (!rows || rows.length < 3) return [];

    // Encontrar la fila de headers (donde aparece "ECONÓMICO" o "ECONOMICO")
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 8); i++) {
      const row = rows[i];
      if (!Array.isArray(row)) continue;
      const rowStr = row.map(c => String(c||'').toUpperCase().replace(/[ÁÉÍÓÚÜ]/g, m =>
        ({Á:'A',É:'E',Í:'I',Ó:'O',Ú:'U',Ü:'U'}[m]||m))).join('|');
      if (rowStr.includes('ECONOMICO') || rowStr.includes('ECONÓMICO') || rowStr.includes('CROMATICA')) {
        headerRowIdx = i;
        break;
      }
    }

    if (headerRowIdx === -1) {
      console.warn('[Asignacion] No se encontró fila de headers, usando fila 2');
      headerRowIdx = 2;
    }

    const headerRow = rows[headerRowIdx];
    if (!headerRow) return [];

    // Normalizar header para búsqueda
    const normalize = s => String(s||'').toUpperCase()
      .replace(/[ÁÉÍÓÚÜ]/g, m => ({Á:'A',É:'E',Í:'I',Ó:'O',Ú:'U',Ü:'U'}[m]||m))
      .replace(/\s+/g,'').trim();

    // Mapear columnas por nombre
    const colIdx = {};
    headerRow.forEach((h, i) => {
      const n = normalize(h);
      if (n.includes('ECONOM') || n === 'UNIDAD') colIdx.economico = i;
      // Cromática: columna propia ETN o col M "MARCA COMERCIAL" de GHO
      else if (n.includes('CROMATICA')) colIdx.cromatica = i;
      else if (n.includes('MARCACOMERCIAL') || n === 'MARCACOM' || n.includes('MARCA_COM')) colIdx.cromatica = i;
      else if (n.includes('ESTATUS') || n === 'STATUS' || n === 'ESTADO') colIdx.estatus = i;
      // Modelo: columna propia ETN o col N "TECNOLOGIA" de GHO
      else if (n.includes('MODELO')) colIdx.modelo = i;
      else if (n.includes('TECNOLOGIA') || n.includes('TECNOLOG')) colIdx.modelo = i;
      else if (n === 'ROL' || n === 'ROLE') colIdx.rol = i;
      else if (n === 'BASE' || n === 'BASEASIGNADA') colIdx.base = i;
      else if (n.includes('EMPRESA') || n.includes('OPERADORA')) colIdx.empresa = i;
      else if (n.includes('SERIE') || n === 'VIN' || n === 'SERIAL') colIdx.serie = i;
      else if (n.includes('MOTOR')) colIdx.motor = i;
      else if (n.includes('PLACA') || n.includes('TARJETA')) colIdx.placa = i;
      else if (n.includes('ASIENTO')) colIdx.asientos = i;
      else if (n.includes('OBSERV') || n.includes('OBS')) colIdx.observaciones = i;
    });

    // Fallbacks por posición exacta según documentación del PDF:
    // A=ECONÓMICO(0), B=CROMÁTICA(1), C=ESTATUS(2), D=MODELO(3), E=ROL(4), F=BASE(5), G=EMPRESA(6)
    // H=SERIE(7), I=MOTOR(8), J=PLACA(9), K=ASIENTOS(10), L=OBSERVACIONES(11)
    if (colIdx.economico === undefined) colIdx.economico = 0;
    if (colIdx.cromatica === undefined) colIdx.cromatica = 1;
    if (colIdx.estatus   === undefined) colIdx.estatus   = 2;
    if (colIdx.modelo    === undefined) colIdx.modelo    = 3;
    if (colIdx.rol       === undefined) colIdx.rol       = 4;
    if (colIdx.base      === undefined) colIdx.base      = 5;
    if (colIdx.empresa   === undefined) colIdx.empresa   = 6;
    if (colIdx.serie     === undefined) colIdx.serie     = 7;
    if (colIdx.motor     === undefined) colIdx.motor     = 8;
    if (colIdx.placa     === undefined) colIdx.placa     = 9;
    if (colIdx.asientos  === undefined) colIdx.asientos  = 10;
    if (colIdx.observaciones === undefined) colIdx.observaciones = 11;

    const result = [];
    const seen = new Set();

    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!Array.isArray(row) || row.every(c => !c)) continue;

      const rawNum = row[colIdx.economico];
      if (!rawNum && rawNum !== 0) continue;

      const num = cleanNum(String(rawNum));
      if (!num || num.length < 2 || isNaN(Number(num))) continue;

      // Validación: número de unidad típicamente 3-5 dígitos
      const n = Number(num);
      if (n < 100 || n > 99999) continue;

      // Advertir duplicado
      const isDuplicate = seen.has(num);
      seen.add(num);

      result.push({
        num,
        economico:    String(row[colIdx.economico]    || '').trim(),
        cromatica:    String(row[colIdx.cromatica]    || '').trim(),
        estatus:      String(row[colIdx.estatus]      || '').trim(),
        modelo:       String(row[colIdx.modelo]       || '').trim(),
        rol:          String(row[colIdx.rol]          || '').trim(),
        base:         String(row[colIdx.base]         || '').trim(),
        empresa:      String(row[colIdx.empresa]      || '').trim(),
        serie:        String(row[colIdx.serie]        || '').trim(),
        motor:        String(row[colIdx.motor]        || '').trim(),
        placa:        String(row[colIdx.placa]        || '').trim(),
        asientos:     String(row[colIdx.asientos]     || '').trim(),
        observaciones:String(row[colIdx.observaciones]|| '').trim(),
        _duplicate:   isDuplicate,
        _rowIdx:      i + 1
      });
    }

    console.log(`[Asignacion] headers en fila ${headerRowIdx}, colMap:`, colIdx, `→ ${result.length} registros`);
    return result;
  }

  /* ══════════════════════════════════════════════════════
     PARSER: CEIBA
     Hoja: "sheet1" o la primera hoja
     Estructura (array de arrays, fila 0 = headers):
       A(0)=Parent fleet, B(1)=Plate No., C(2)=Serial No.,
       D(3)=Speed[KM/H], E(4)=Latitude, F(5)=Longitude,
       G(6)=Direction, H(7)=GPS time
  ══════════════════════════════════════════════════════ */
  function parseCeiba(rows) {
    if (!rows || rows.length < 2) return [];

    // Encontrar fila de headers
    let hIdx = 0;
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      const r = rows[i];
      if (Array.isArray(r) && r.some(c => String(c||'').toLowerCase().includes('plate'))) {
        hIdx = i; break;
      }
    }

    const result = [];
    for (let i = hIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!Array.isArray(row) || !row[1]) continue;

      // Col B(1) = Plate No. — puede traer texto como "A5220", "ROL DIRECTO A5220"
      const rawPlate = String(row[1] || '').trim();
      const num = cleanNum(rawPlate);
      if (!num || isNaN(Number(num))) continue;
      const n = Number(num);
      if (n < 100 || n > 99999) continue;

      // Col H(7) = GPS time
      const rawDate = row[7] || row[6] || '';
      const fecha = parseDate(rawDate);

      // FIX CEIBA (v7.3): el archivo exportado de Ceiba trae la hora adelantada 1h.
      // Restamos SOLO 1 hora al timestamp — minutos y segundos quedan intactos.
      // Esto corrige el desfase EN ORIGEN, así que todo el sistema (Samsara cruzado,
      // Viajes, Barrido Manual, agrupación por días) ya queda con la hora correcta.
      if (fecha) fecha.setHours(fecha.getHours() - 1);

      // Col C(2) = Serial No.
      const serie = String(row[2] || '').trim();

      result.push({
        num,
        fecha: fecha ? fecha.toISOString() : null,
        fechaStr: fecha ? fmtDate(fecha) : null,
        serie,
        plataforma: 'CEIBA'
      });
    }

    console.log(`[CEIBA] ${result.length} registros, con fecha: ${result.filter(r=>r.fecha).length}`);
    return result;
  }

  /* ══════════════════════════════════════════════════════
     PARSER: SAMSARA
     Hoja: "samsara_reporte del estado" (o la que contenga esa palabra)
     Estructura (array de arrays, fila 0 = headers):
       A(0)=Nombre, B(1)=Etiquetas, C(2)=Número de serie del dispositivo,
       D(3)=Producto, E(4)=Estado/Funcionando, F(5)=Tiempo(conectado),
       ...muchas columnas..., N(13)=Última hora de registro
     El índice de "Última hora" puede variar, buscar por nombre.
  ══════════════════════════════════════════════════════ */
  /* ══════════════════════════════════════════════════════
     PARSER: SAMSARA
     Hoja: "samsara_reporte del estado" (o la que contenga esa palabra)
     Estructura (array de arrays, fila 0 = headers):
       A(0)=Nombre, B(1)=Etiquetas, C(2)=Número de serie del dispositivo,
       D(3)=Producto, E(4)=Estado (Funcionando / No detectado / Sin VIN / Sin placa),
       F(5)=Tiempo..., N(13)=Última hora de registro
     El índice de "Última hora" puede variar, buscar por nombre.
     La columna E "Estado" trae el VALOR LITERAL que viene del archivo y se respeta tal cual.
  ══════════════════════════════════════════════════════ */
  function parseSamsara(rows) {
    if (!rows || rows.length < 2) return [];

    // Encontrar fila de headers (fila 0 normalmente)
    let hIdx = 0;
    for (let i = 0; i < Math.min(rows.length, 3); i++) {
      const r = rows[i];
      if (Array.isArray(r) && r.some(c => String(c||'').toLowerCase().includes('nombre'))) {
        hIdx = i; break;
      }
    }

    const headerRow = rows[hIdx];
    if (!headerRow) return [];

    // Localizar columnas por nombre
    const normalize = s => String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
    let colUltima = -1, colEstado = -1, colSerie = -1, colNombre = 0;

    headerRow.forEach((h, i) => {
      const n = normalize(h);
      if (!n) return;
      // Última hora de registro — detectar PRIMERO para que no colisione con "estado"
      if (colUltima === -1 && (n === 'ultima hora de registro' || n.startsWith('ultima hora') ||
          (n.includes('ultima') && n.includes('hora') && n.includes('registro')))) {
        colUltima = i; return;
      }
      // Nombre (col A)
      if (n === 'nombre' && colNombre === 0) { colNombre = i; return; }
      // Estado (col E en el archivo real) — match estricto para no confundir con otras columnas
      if (colEstado === -1 && (n === 'estado' || n === 'estatus' || n === 'status')) {
        colEstado = i; return;
      }
      // Número de serie del dispositivo (col C)
      if (colSerie === -1 && (n.includes('numero de serie') || n.includes('serie del dispositivo'))) {
        colSerie = i; return;
      }
    });

    // Si no encontramos "estado" por nombre, usar la columna E (índice 4) como en el archivo estándar
    if (colEstado === -1) colEstado = 4;
    if (colSerie  === -1) colSerie  = 2;
    if (colUltima === -1) {
      // Buscar último campo que parezca fecha
      colUltima = headerRow.length - 1;
    }
    if (colNombre === -1) colNombre = 0;

    console.log(`[SAMSARA] Headers detectados — Nombre:${colNombre}, Serie:${colSerie}, Estado:${colEstado}, Última:${colUltima}`);

    /**
     * Normaliza el valor LITERAL del archivo a uno de los 4 estados manejados por la UI.
     * Respeta lo que viene en el archivo — NO deriva por fecha ni por presencia de VG.
     */
    function normalizarEstadoSamsara(raw) {
      const v = String(raw||'').trim();
      if (!v) return '';
      const vl = v.toLowerCase();
      if (vl.includes('no detect') || vl.includes('not detected')) return 'NO_DETECTADO';
      if (vl.includes('funcionando') || vl.includes('operativo') || vl === 'ok' || vl.includes('active')) return 'FUNCIONANDO';
      if (vl.includes('sin vin') || vl === 'sin vg' || vl.includes('sin vg') || vl.includes('no vin')) return 'SIN_VIN';
      if (vl.includes('sin placa') || vl.includes('no plate')) return 'SIN_PLACA';
      // Valor desconocido: dejarlo normalizado en mayúsculas con guiones
      return v.toUpperCase().replace(/\s+/g,'_').substring(0,20);
    }

    const result = [];
    for (let i = hIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!Array.isArray(row) || !row[colNombre]) continue;

      // Col A(0) = Nombre — puede traer "2519 ETN", "ETN 2519", "8019 SINI ETN"
      const rawNombre = String(row[colNombre] || '').trim();
      const num = cleanNum(rawNombre);
      if (!num || isNaN(Number(num))) continue;
      const n = Number(num);
      if (n < 100 || n > 99999) continue;

      // Última hora de registro (solo para mostrar, NO para calcular estado)
      const rawDate = row[colUltima] || '';
      const fecha = parseDate(rawDate);

      // Col C(2) = Número de serie (VG)
      const serie = String(row[colSerie] || '').trim();

      // ══ COLUMNA E: ESTADO — VALOR LITERAL DEL ARCHIVO ══
      // Esto es lo que el usuario pidió: respetar lo que dice el archivo, no derivarlo.
      const estadoRaw = String(row[colEstado] || '').trim();
      const estadoSamsara = normalizarEstadoSamsara(estadoRaw);

      // Flags auxiliares (solo para compatibilidad con otros módulos)
      const sinVIN = estadoSamsara === 'SIN_VIN';
      const noDetecta = estadoSamsara === 'NO_DETECTADO';

      result.push({
        num,
        fecha: fecha ? fecha.toISOString() : null,
        fechaStr: fecha ? fmtDate(fecha) : null,
        serie,                // VG / número de serie del dispositivo
        estado: estadoRaw,    // valor LITERAL del archivo
        estadoSamsara,        // normalizado: FUNCIONANDO / NO_DETECTADO / SIN_VIN / SIN_PLACA
        sinVIN,
        noDetecta,
        rawNombre,
        plataforma: 'SAMSARA'
      });
    }

    console.log(`[SAMSARA] ${result.length} registros, con estado: ${result.filter(r=>r.estadoSamsara).length}`);
    return result;
  }

  /* ══════════════════════════════════════════════════════
     PARSER: AVL
     Hoja: "Últimos datos de la unidad" (buscar por nombre similar)
     Estructura (array de arrays, fila 0 = headers):
       A(0)=Grouping, B(1)=Último mensaje, C(2)=Últimas coordenadas,
       D(3)=Localización, E(4)=Velocidad
     NOTA: Columna B puede contener hipervínculos - usar solo texto visible
     El valor en B puede ser "2023-09-07 11:07 19:2023-09-07 11:07 19 Geocerca" - tomar primera fecha
  ══════════════════════════════════════════════════════ */
  function parseAVL(rows) {
    if (!rows || rows.length < 2) return [];

    // Encontrar fila de headers (buscar "Grouping" o "Último mensaje")
    let hIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const r = rows[i];
      if (!Array.isArray(r)) continue;
      const low = r.map(c => String(c||'').toLowerCase());
      if (low.some(c => c.includes('grouping')) || low.some(c => c.includes('ultimo mensaje') || c.includes('último mensaje'))) {
        hIdx = i; break;
      }
    }
    if (hIdx === -1) hIdx = 0;

    const result = [];
    for (let i = hIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!Array.isArray(row) || row[0] === undefined || row[0] === null || row[0] === '') continue;

      // Col A(0) = Grouping — puede traer:
      // "2143 (Venta)", "2164 *C* VENTA", "74 (F/Servicio) (ETN)", "2188 *C* (ETN)",
      // "2242 *C* (INM)", "2245 (ETN)", etc.
      const rawGroup = String(row[0] || '').trim();
      if (!rawGroup) continue;

      const num = cleanNum(rawGroup);
      if (!num) continue;
      const n = Number(num);
      if (isNaN(n) || n < 100 || n > 99999) continue;

      // Col B(1) = Último mensaje — puede ser:
      // - Hipervínculo a Google Maps (objeto {Target:..., Tooltip:...} o string url)
      // - Texto "2026-04-14 11:33 56:2026-04-14 11:33 56 Geocerca ETN" (fecha duplicada + descripción)
      // - Fecha simple
      // - {} objeto con 'text' o 'v' (de sheet_to_json algunas versiones)
      let rawCell = row[1];
      let rawDate = '';

      if (rawCell && typeof rawCell === 'object') {
        // Objeto de celda XLSX — tomar .v o .w o .text
        rawDate = String(rawCell.w || rawCell.v || rawCell.text || '').trim();
      } else {
        rawDate = String(rawCell || '').trim();
      }

      // Descartar si es hipervínculo puro
      if (!rawDate || rawDate.startsWith('http') || rawDate.includes('maps.google') ||
          rawDate.includes('google.com/maps')) {
        // Intentar col C "últimas coordenadas" puede tener fecha también
        let altCell = row[2];
        let alt = (altCell && typeof altCell === 'object') ? String(altCell.w || altCell.v || '') : String(altCell || '');
        if (alt && !alt.startsWith('http')) rawDate = alt.trim();
      }

      // Formato duplicado típico de AVL: "YYYY-MM-DD HH:MM SS:YYYY-MM-DD HH:MM SS [descripción]"
      // → Extraer la primera fecha completa
      const firstDate = rawDate.match(/(\d{4}-\d{2}-\d{2}[\sT]\d{1,2}:\d{2}(?::\d{2})?)/);
      if (firstDate) rawDate = firstDate[1];
      else {
        // Formatos alternativos: DD/MM/YYYY HH:MM
        const altFormat = rawDate.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?)/);
        if (altFormat) rawDate = altFormat[1];
      }

      const fecha = parseDate(rawDate);

      result.push({
        num,
        fecha: fecha ? fecha.toISOString() : null,
        fechaStr: fecha ? fmtDate(fecha) : null,
        plataforma: 'AVL',
        _raw: rawGroup  // guardamos el raw por si se necesita depurar
      });
    }

    console.log(`[AVL] Total: ${result.length} registros, con fecha: ${result.filter(r=>r.fecha).length}`);
    return result;
  }

  /* ══════════════════════════════════════════════════════
     PARSER: SCANIA
     Hoja: "Posición de la flota"
     Estructura (array de arrays, fila 0 = headers):
       A(0)=Vehículo, B(1)=Hora, C(2)=Nivel AdBlue, D(3)=Batería, E(4)=Velocidad
  ══════════════════════════════════════════════════════ */
  function parseScania(rows) {
    if (!rows || rows.length < 2) return [];

    // Encontrar fila de headers
    let hIdx = 0;
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      const r = rows[i];
      if (Array.isArray(r) && r.some(c => String(c||'').toLowerCase().includes('veh'))) {
        hIdx = i; break;
      }
    }

    const result = [];
    for (let i = hIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!Array.isArray(row) || !row[0]) continue;

      // Col A(0) = Vehículo — puede traer "B234", "8157 F/A", "B049"
      const rawVeh = String(row[0] || '').trim();
      const num = cleanNum(rawVeh);
      if (!num || isNaN(Number(num))) continue;
      const n = Number(num);
      if (n < 100 || n > 99999) continue;

      // Col B(1) = Hora (fecha + hora combinados: "2026-04-14 23:42:19")
      const rawDate = String(row[1] || '').trim();
      const fecha = parseDate(rawDate);

      result.push({
        num,
        fecha: fecha ? fecha.toISOString() : null,
        fechaStr: fecha ? fmtDate(fecha) : null,
        plataforma: 'SCANIA'
      });
    }

    console.log(`[SCANIA] ${result.length} registros, con fecha: ${result.filter(r=>r.fecha).length}`);
    return result;
  }

  /* ══════════════════════════════════════════════════════
     PARSER: MAN
     Hoja: "Dispositivos"
     Estructura (array de arrays, fila 0 = headers):
       A(0)=Dispositivo, B(1)=VIN, C(2)=Velocidad, D(3)=Ultima Conexion, E(4)=Comentario
  ══════════════════════════════════════════════════════ */
  function parseMAN(rows) {
    if (!rows || rows.length < 2) return [];

    // Encontrar fila de headers
    let hIdx = 0;
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      const r = rows[i];
      if (Array.isArray(r) && r.some(c => String(c||'').toLowerCase().includes('dispositivo'))) {
        hIdx = i; break;
      }
    }

    const result = [];
    for (let i = hIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!Array.isArray(row) || !row[0]) continue;

      // Col A(0) = Dispositivo — "3039 - AERS C S", "2787 - AERS", "2596 Mont 2608 - AERS"
      const rawDisp = String(row[0] || '').trim();
      const num = cleanNum(rawDisp);
      if (!num || isNaN(Number(num))) continue;
      const n = Number(num);
      if (n < 100 || n > 99999) continue;

      // Col B(1) = VIN — mantener tal cual "WMARR4ZZ8KC024699"
      const vin = String(row[1] || '').trim();

      // Col D(3) = Ultima Conexion — "14-04-2026 20:57:54"
      const rawDate = String(row[3] || '').trim();
      const fecha = parseDate(rawDate);

      result.push({
        num,
        fecha: fecha ? fecha.toISOString() : null,
        fechaStr: fecha ? fmtDate(fecha) : null,
        serie: vin,  // guardar VIN como serie
        plataforma: 'MAN'
      });
    }

    console.log(`[MAN] ${result.length} registros, con fecha: ${result.filter(r=>r.fecha).length}`);
    return result;
  }

  /* ══════════════════════════════════════════════════════
     DETECCIÓN DE PLATAFORMA Y HOJA CORRECTA
  ══════════════════════════════════════════════════════ */
  function detectarPlataforma(filename, sheetNames) {
    const f = String(filename||'').toLowerCase();
    if (f.includes('samsara') || f.includes('reporte_del_estado') || f.includes('reporte del estado')) return 'SAMSARA';
    if (f.includes('last gps') || f.includes('last_gps') || f.match(/info[-_]\d{8}/)) return 'CEIBA';
    if (f.includes('dispositivos') || f.match(/dispositivos[_\s]\d+/)) return 'MAN';
    if (f.includes('posicion_de_la_flota') || f.includes('posicion de la flota') || f.includes('posición')) return 'SCANIA';
    // AVL por filename
    if (f.includes('para_barridos') || f.includes('para barridos') ||
        f.includes('_status_') || f.includes(' status ') || f.match(/status[_\s-]\d{4}/) ||
        f.match(/_status\.xl/) || f.match(/etn.*status/) ||
        (f.includes('status') && f.match(/\d{4}[-_]\d{2}[-_]\d{2}/))) return 'AVL';
    // AVL por estructura: si tiene "Últimos datos de la unidad" o combinación Content + Últimos
    if (Array.isArray(sheetNames)) {
      const normalize = s => String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
      const hasUltimos = sheetNames.some(n => normalize(n).includes('ultimos datos') || normalize(n).includes('ultimo dato'));
      if (hasUltimos) return 'AVL';
    }
    if (f.match(/\d{2}_asignaci/i) || f.includes('asignac')) return 'ASIGNACION';
    return null;
  }

  /**
   * Selecciona la hoja correcta de cada plataforma
   */
  function selectSheet(sheets, sheetNames, plat) {
    const normalize = s => String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();

    if (plat === 'ASIGNACION') {
      // Buscar "Detalle1" o "detalle1" o la primera hoja con datos
      const det = sheetNames.find(n => normalize(n) === 'detalle1' || normalize(n).includes('detalle'));
      return det || sheetNames[0];
    }
    if (plat === 'CEIBA') {
      const sh = sheetNames.find(n => normalize(n).includes('sheet') || normalize(n) === 'sheet1');
      return sh || sheetNames[0];
    }
    if (plat === 'SAMSARA') {
      const sh = sheetNames.find(n => normalize(n).includes('samsara') || normalize(n).includes('reporte'));
      return sh || sheetNames[0];
    }
    if (plat === 'AVL') {
      // AVL tiene típicamente 2 hojas: "Content" (metadata, NO usar) y "Últimos datos de la unidad" (datos reales).
      // Regla dura: NUNCA usar la hoja "Content" bajo ninguna circunstancia.
      console.log('[selectSheet AVL] Hojas disponibles:', sheetNames);

      // Primero filtrar TODAS las Content variantes
      const sinContent = sheetNames.filter(n => {
        const nm = normalize(n);
        return nm !== 'content' && !nm.startsWith('content') && nm !== 'contenido';
      });

      if (sinContent.length === 0) {
        console.warn('[selectSheet AVL] Solo hay hojas Content en el archivo — probablemente el archivo está corrupto o no es AVL');
        return sheetNames[0]; // último recurso
      }

      // 1. Priorizar "ultimos datos" (tolera acentos, mayúsculas, variantes)
      let prefer = sinContent.find(n => {
        const nm = normalize(n);
        return nm.includes('ultimos datos') || nm.includes('ultimo dato') ||
               nm === 'ultimos datos de la unidad' || nm === 'ultimo dato de la unidad';
      });
      if (prefer) { console.log('[selectSheet AVL] Elegida:', prefer); return prefer; }

      // 2. Cualquier hoja que contenga "unidad"
      prefer = sinContent.find(n => normalize(n).includes('unidad'));
      if (prefer) { console.log('[selectSheet AVL] Elegida (fallback 1):', prefer); return prefer; }

      // 3. Primera hoja que no sea Content
      console.log('[selectSheet AVL] Elegida (fallback 2, primera no-Content):', sinContent[0]);
      return sinContent[0];
    }
    if (plat === 'SCANIA') {
      const sh = sheetNames.find(n => normalize(n).includes('posicion') || normalize(n).includes('flota'));
      return sh || sheetNames[0];
    }
    if (plat === 'MAN') {
      const sh = sheetNames.find(n => normalize(n).includes('dispositivo'));
      return sh || sheetNames[0];
    }
    return sheetNames[0];
  }

  function parsearPorPlataforma(plat, rows) {
    switch (plat) {
      case 'CEIBA':   return parseCeiba(rows);
      case 'SAMSARA': return parseSamsara(rows);
      case 'AVL':     return parseAVL(rows);
      case 'SCANIA':  return parseScania(rows);
      case 'MAN':     return parseMAN(rows);
      default:        return [];
    }
  }

  function validarResultado(registros) {
    const total = registros.length;
    const conFecha = registros.filter(r => r.fecha).length;
    const sinFecha = total - conFecha;
    const pct = total > 0 ? Math.round(conFecha/total*100) : 0;
    return { total, conFecha, sinFecha, pct, ok: total > 0 };
  }

  /* ══════════════════════════════════════════════════════
     NORMALIZACIÓN DE CAMPOS CROMÁTICA/ESTATUS para gráficas
  ══════════════════════════════════════════════════════ */
  function normalizarCromatica(val) {
    const v = String(val||'').toUpperCase().trim();
    if (!v) return '';
    // Normalizar variantes: INM, MIGRACIÓN, MIGRACION → "Migración (INM)"
    if (v.includes('MIGRA') || v === 'INM') return 'Migración (INM)';
    if (v === 'ETN' || v === 'ETNC') return 'ETN';
    if (v.includes('TURISTA')) return 'Turistar';
    if (v.includes('TURISMO')) return 'Turismo';
    if (v.includes('RENTA')) return 'Unidades en Renta';
    return val.trim();
  }

  function normalizarEstatus(val) {
    const v = String(val||'').toUpperCase().trim();
    if (!v || v === '—') return '';
    if (v.includes('EN OPERACI') || v === 'OPERACION') return 'En operación';
    if (v.includes('ARRENDAMIENTO') || v.includes('ARRENDADO')) return 'Arrendamiento';
    if (v.includes('PARA VENTA') || v === 'A VENTA') return 'Para venta';
    if (v.includes('FUERA DE OPERACI') || v === 'FUERA') return 'Fuera de operación';
    if (v.includes('RENTADO A SAME') || v.includes('RENT')) return 'Rentado a SAME';
    if (v.includes('BAJA')) return 'Baja';
    if (v.includes('SINIESTRO')) return 'Siniestro';
    return val.trim();
  }

  function categorizarEstatus(est) {
    const e = normalizarEstatus(est);
    if (e === 'En operación' || e === 'Arrendamiento') return 'En operación';
    if (e === 'Para venta') return 'Para venta';
    if (e === 'Fuera de operación' || e === 'Rentado a SAME') return 'Fuera de operación';
    if (e === 'Siniestro') return 'Siniestro';
    if (e === 'Baja') return 'Baja';
    return 'Otro';
  }

  return {
    cleanNum, parseDate, fmtDate, fmtDateShort, fmtTime,
    diasDesde, statusClass,
    parseAsignacion, parseCeiba, parseSamsara, parseMAN, parseAVL, parseScania,
    readXLSX, detectarPlataforma, selectSheet, parsearPorPlataforma, validarResultado,
    normalizarCromatica, normalizarEstatus, categorizarEstatus
  };
})();
