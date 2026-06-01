/**
 * parsers.js v4 — Parseo exacto por plataforma según documentación real
 * v4.1 — Agrega parseVOLVO: tracking-report de Volvo Connect
 *         Hoja "Actividades del vehículo": A=Vehículo (ETN-8101), B=Tiempo
 *         Agrupa por unidad, conserva la fecha más reciente del histórico de eventos.
 *
 * ASIGNACIÓN (hoja: Detalle1)
 * CEIBA (hoja: sheet1)
 * SAMSARA (hoja: samsara_reporte del estado)
 * AVL (hoja: Últimos datos de la unidad)
 * SCANIA (hoja: Posición de la flota)
 * MAN (hoja: Dispositivos)
 * VOLVO (hoja: Actividades del vehículo) ← NUEVO
 * MOTIVE (hoja: devices_report)
 */
const Parsers = (() => {

  /* ══════════════════════════════════════════════════════
     UTILIDADES COMUNES
  ══════════════════════════════════════════════════════ */

  function cleanNum(val) {
    if (val === null || val === undefined) return '';
    const s = String(val).trim();
    const m = s.match(/\b(\d{3,5})\b/);
    if (m) return m[1];
    const m2 = s.match(/(\d+)/);
    return m2 ? m2[1] : '';
  }

  function parseDate(val) {
    if (!val && val !== 0) return null;
    if (val instanceof Date && !isNaN(val)) return val;
    if (typeof val === 'number' && val > 25000 && val < 60000) {
      const ms = (val - 25569) * 86400 * 1000;
      const raw = new Date(ms);
      if (isNaN(raw)) return null;
      return new Date(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate(),
        raw.getUTCHours(), raw.getUTCMinutes(), raw.getUTCSeconds());
    }
    let s = String(val).trim();
    if (!s || s === '0' || s === 'NaN') return null;
    if (s.startsWith('http')) return null;
    s = s.replace(/^(\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2})\s+(\d{1,2})\b/, '$1:$2');
    const multiDateMatch = s.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?::\d{2})?)/);
    if (multiDateMatch) s = multiDateMatch[1];
    const isoLike = s.match(/^(\d{4})-(\d{2})-(\d{2})[\sT](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (isoLike) {
      const d = new Date(parseInt(isoLike[1]), parseInt(isoLike[2])-1, parseInt(isoLike[3]),
        parseInt(isoLike[4]), parseInt(isoLike[5]), parseInt(isoLike[6]||'0'));
      if (!isNaN(d)) return d;
    }
    let d = new Date(s);
    if (!isNaN(d)) return d;
    const mAMPM = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})[\s,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/i);
    if (mAMPM) {
      let dd=parseInt(mAMPM[1]),mo=parseInt(mAMPM[2]),yy=parseInt(mAMPM[3]);
      let hh=parseInt(mAMPM[4]),mm=parseInt(mAMPM[5]),ss=parseInt(mAMPM[6]||'0');
      const ampm=(mAMPM[7]||'').replace(/\./g,'').toUpperCase();
      if (ampm==='PM'&&hh<12) hh+=12;
      if (ampm==='AM'&&hh===12) hh=0;
      d=new Date(yy,mo-1,dd,hh,mm,ss);
      if (!isNaN(d)) return d;
    }
    const m2 = s.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})$/);
    if (m2) { d=new Date(s); if (!isNaN(d)) return d; }
    return null;
  }

  function fmtDate(v) {
    if (!v) return '';
    const d = v instanceof Date ? v : new Date(v);
    if (isNaN(d)) return String(v).substring(0,16);
    return d.toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric'})+' '+
           d.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
  }
  function fmtDateShort(v) {
    if (!v) return '';
    const d=new Date(v); if (isNaN(d)) return '';
    return d.toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric'});
  }
  function fmtTime(v) {
    if (!v) return '';
    const d=new Date(v); if (isNaN(d)) return '';
    return d.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
  }
  function diasDesde(iso) {
    if (!iso) return null;
    const d=new Date(iso); if (isNaN(d)) return null;
    const hoy=new Date();
    const hoyLocal=new Date(hoy.getFullYear(),hoy.getMonth(),hoy.getDate());
    const fechaLocal=new Date(d.getFullYear(),d.getMonth(),d.getDate());
    return Math.round((hoyLocal.getTime()-fechaLocal.getTime())/86400000);
  }
  function statusClass(dias) {
    if (dias===null||dias===undefined) return 'sin';
    try {
      const cfg=DB.getConfig();
      if (dias<=cfg.diasLinea) return 'enlinea';
      if (dias<=cfg.diasAtencion) return 'atencion';
    } catch(e) {
      if (dias<=1) return 'enlinea';
      if (dias<=4) return 'atencion';
    }
    return 'critico';
  }

  /* ══════════════════════════════════════════════════════
     LECTOR XLSX
  ══════════════════════════════════════════════════════ */
  function readXLSX(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const data = new Uint8Array(e.target.result);
          const wb = XLSX.read(data, { type:'array', cellDates:true, cellNF:false, raw:false, cellHTML:false, cellFormula:false, cellStyles:false });
          const fname = String(file.name||'').toLowerCase();
          const isAVLByFilename = fname.includes('para_barridos')||fname.includes('para barridos')||
            fname.includes('_status_')||fname.includes(' status ')||/status[_\s-]\d{4}/.test(fname)||/_status\.xl/.test(fname);
          const normalize = s => String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
          const hasContent = wb.SheetNames.some(n=>normalize(n)==='content'||normalize(n).startsWith('content'));
          const hasUltimos = wb.SheetNames.some(n=>normalize(n).includes('ultimos datos')||normalize(n).includes('ultimo dato'));
          const isAVL = isAVLByFilename||(hasContent&&hasUltimos);
          let sheetNames = wb.SheetNames.slice();
          if (isAVL) {
            const contentSheets=sheetNames.filter(n=>normalize(n)==='content'||normalize(n).startsWith('content'));
            if (contentSheets.length>0) {
              contentSheets.forEach(n=>{delete wb.Sheets[n];const idx=wb.SheetNames.indexOf(n);if(idx>=0)wb.SheetNames.splice(idx,1);});
              sheetNames=wb.SheetNames.slice();
            }
          }
          const sheets={};
          sheetNames.forEach(name=>{
            const ws=wb.Sheets[name];
            if (ws) {
              Object.keys(ws).forEach(addr=>{
                if (addr.startsWith('!')) return;
                const cell=ws[addr];
                if (cell&&cell.l) delete cell.l;
                if (cell&&cell.w!==undefined) cell.v=cell.w;
              });
            }
            sheets[name]=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false,blankrows:false});
          });
          console.log('[readXLSX] Hojas finales:',sheetNames,isAVL?'(AVL)':'');
          resolve({sheets,sheetNames,filename:file.name,isAVL});
        } catch(err){reject(err);}
      };
      reader.onerror=()=>reject(new Error('No se pudo leer el archivo'));
      reader.readAsArrayBuffer(file);
    });
  }

  /* ══════════════════════════════════════════════════════
     PARSER: ASIGNACIÓN (hoja: Detalle1)
  ══════════════════════════════════════════════════════ */
  function parseAsignacion(rows) {
    if (!rows||rows.length<3) return [];
    let headerRowIdx=-1;
    for (let i=0;i<Math.min(rows.length,8);i++) {
      const row=rows[i]; if (!Array.isArray(row)) continue;
      const rowStr=row.map(c=>String(c||'').toUpperCase().replace(/[ÁÉÍÓÚÜ]/g,m=>({Á:'A',É:'E',Í:'I',Ó:'O',Ú:'U',Ü:'U'}[m]||m))).join('|');
      if (rowStr.includes('ECONOMICO')||rowStr.includes('ECONÓMICO')||rowStr.includes('CROMATICA')||rowStr.includes('AUTOBUS')||rowStr.includes('AUTOBUSES')) {
        headerRowIdx=i; break;
      }
    }
    if (headerRowIdx===-1) headerRowIdx=2;
    const headerRow=rows[headerRowIdx]; if (!headerRow) return [];
    const normalize=s=>String(s||'').toUpperCase().replace(/[ÁÉÍÓÚÜ]/g,m=>({Á:'A',É:'E',Í:'I',Ó:'O',Ú:'U',Ü:'U'}[m]||m)).replace(/\s+/g,'').trim();
    const colIdx={};
    headerRow.forEach((h,i)=>{
      const n=normalize(h);
      if (n.includes('ECONOM')||n==='UNIDAD'||n==='AUTOBUS'||n==='AUTOBUSES'||n==='NOUNIDAD'||n==='NUMUNIDAD'||n==='NUM'||n==='NO') colIdx.economico=i;
      else if (n.includes('CROMATICA')) colIdx.cromatica=i;
      else if (n.includes('MARCACOMERCIAL')||n==='MARCACOM'||n.includes('MARCA_COM')) colIdx.cromatica=i;
      else if (n.includes('ESTATUS')||n==='STATUS') colIdx.estatus=i;
      else if (n==='ESTATUSSUC'||n==='ESTATUSSUCURSAL') colIdx.estatus=colIdx.estatus??i;
      else if (n.includes('MODELO')) colIdx.modelo=i;
      else if (n.includes('TECNOLOGIA')||n.includes('TECNOLOG')) colIdx.modelo=i;
      else if (n==='ROL'||n==='ROLE') colIdx.rol=i;
      else if (n==='BASE'||n==='BASEASIGNADA') colIdx.base=i;
      else if ((n.includes('EMPRESA')||n.includes('OPERADORA'))&&!n.includes('PRINCIPAL')) colIdx.empresa=i;
      else if (n==='EMPRESAPRINCIPAL') colIdx.empresa_principal=i;
      else if (n.includes('SERIE')||n==='VIN'||n==='SERIAL') colIdx.serie=i;
      else if (n.includes('MOTOR')) colIdx.motor=i;
      else if (n.includes('PLACA')||n.includes('TARJETA')) colIdx.placa=i;
      else if (n.includes('ASIENTO')) colIdx.asientos=i;
      else if (n.includes('OBSERV')||n.includes('OBS')) colIdx.observaciones=i;
      else if (n==='CLAVEROL'||n==='CLAVERUTA') colIdx.clave_rol=i;
    });
    if (colIdx.economico===undefined) {
      const busIdx=headerRow.findIndex(h=>{const n=normalize(h);return n==='AUTOBUS'||n==='AUTOBUSES'||n==='NUMERODEAUTOBUS';});
      if (busIdx!==-1) colIdx.economico=busIdx;
    }
    if (colIdx.economico===undefined) colIdx.economico=0;
    if (colIdx.cromatica===undefined) colIdx.cromatica=1;
    if (colIdx.estatus===undefined) colIdx.estatus=2;
    if (colIdx.modelo===undefined) colIdx.modelo=3;
    if (colIdx.rol===undefined) colIdx.rol=4;
    if (colIdx.base===undefined) colIdx.base=5;
    if (colIdx.empresa===undefined) colIdx.empresa=6;
    if (colIdx.serie===undefined) colIdx.serie=7;
    if (colIdx.motor===undefined) colIdx.motor=8;
    if (colIdx.placa===undefined) colIdx.placa=9;
    if (colIdx.asientos===undefined) colIdx.asientos=10;
    if (colIdx.observaciones===undefined) colIdx.observaciones=11;
    const isGHO=colIdx.economico>0;
    console.log('[Asignacion] colIdx:',JSON.stringify(colIdx),'isGHO:',isGHO);
    const result=[]; const seen=new Set();
    for (let i=headerRowIdx+1;i<rows.length;i++) {
      const row=rows[i]; if (!Array.isArray(row)||row.every(c=>!c)) continue;
      const rawNum=row[colIdx.economico]; if (!rawNum&&rawNum!==0) continue;
      const num=cleanNum(String(rawNum)); if (!num||num.length<2||isNaN(Number(num))) continue;
      const n=Number(num); if (n<100||n>99999) continue;
      const isDuplicate=seen.has(num); seen.add(num);
      result.push({num, economico:String(row[colIdx.economico]||'').trim(),
        cromatica:String(row[colIdx.cromatica]||'').trim(), estatus:String(row[colIdx.estatus]||'').trim(),
        modelo:String(row[colIdx.modelo]||'').trim(), rol:String(row[colIdx.rol]||'').trim(),
        base:String(row[colIdx.base]||'').trim(), empresa:String(row[colIdx.empresa]||'').trim(),
        serie:String(row[colIdx.serie]||'').trim(), motor:String(row[colIdx.motor]||'').trim(),
        placa:String(row[colIdx.placa]||'').trim(), asientos:String(row[colIdx.asientos]||'').trim(),
        observaciones:String(row[colIdx.observaciones]||'').trim(),
        _duplicate:isDuplicate, _rowIdx:i+1});
    }
    console.log(`[Asignacion] headers en fila ${headerRowIdx}, → ${result.length} registros`);
    return result;
  }

  /* ══════════════════════════════════════════════════════
     PARSER: CEIBA (hoja: sheet1)
     A(0)=Parent fleet, B(1)=Plate No., C(2)=Serial No., H(7)=GPS time
  ══════════════════════════════════════════════════════ */
  function parseCeiba(rows) {
    if (!rows||rows.length<2) return [];
    let hIdx=0;
    for (let i=0;i<Math.min(rows.length,5);i++) {
      const r=rows[i];
      if (Array.isArray(r)&&r.some(c=>String(c||'').toLowerCase().includes('plate'))) {hIdx=i;break;}
    }
    const result=[];
    for (let i=hIdx+1;i<rows.length;i++) {
      const row=rows[i]; if (!Array.isArray(row)||!row[1]) continue;
      const rawPlate=String(row[1]||'').trim(); const num=cleanNum(rawPlate);
      if (!num||isNaN(Number(num))) continue;
      const n=Number(num); if (n<100||n>99999) continue;
      const rawDate=row[7]||row[6]||''; const fecha=parseDate(rawDate);
      const serie=String(row[2]||'').trim();
      result.push({num, fecha:fecha?fecha.toISOString():null, fechaStr:fecha?fmtDate(fecha):null, serie, plataforma:'CEIBA'});
    }
    console.log(`[CEIBA] ${result.length} registros, con fecha: ${result.filter(r=>r.fecha).length}`);
    return result;
  }

  /* ══════════════════════════════════════════════════════
     PARSER: SAMSARA (hoja: samsara_reporte del estado)
     A=Nombre, C=Serie, E=Estado, N=Última hora de registro
  ══════════════════════════════════════════════════════ */
  function parseSamsara(rows) {
    if (!rows||rows.length<2) return [];
    let hIdx=0;
    for (let i=0;i<Math.min(rows.length,3);i++) {
      const r=rows[i];
      if (Array.isArray(r)&&r.some(c=>String(c||'').toLowerCase().includes('nombre'))) {hIdx=i;break;}
    }
    const headerRow=rows[hIdx]; if (!headerRow) return [];
    const normalize=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
    let colUltima=-1,colEstado=-1,colSerie=-1,colNombre=0;
    headerRow.forEach((h,i)=>{
      const n=normalize(h); if (!n) return;
      if (colUltima===-1&&(n==='ultima hora de registro'||n.startsWith('ultima hora')||(n.includes('ultima')&&n.includes('hora')&&n.includes('registro')))) {colUltima=i;return;}
      if (n==='nombre'&&colNombre===0){colNombre=i;return;}
      if (colEstado===-1&&(n==='estado'||n==='estatus'||n==='status')) {colEstado=i;return;}
      if (colSerie===-1&&(n.includes('numero de serie')||n.includes('serie del dispositivo'))) {colSerie=i;return;}
    });
    if (colEstado===-1) colEstado=4;
    if (colSerie===-1) colSerie=2;
    if (colUltima===-1) colUltima=headerRow.length-1;
    if (colNombre===-1) colNombre=0;
    console.log(`[SAMSARA] Headers — Nombre:${colNombre}, Serie:${colSerie}, Estado:${colEstado}, Última:${colUltima}`);
    function normalizarEstadoSamsara(raw) {
      const v=String(raw||'').trim(); if (!v) return '';
      const vl=v.toLowerCase();
      if (vl.includes('no detect')||vl.includes('not detected')) return 'NO_DETECTADO';
      if (vl.includes('funcionando')||vl.includes('operativo')||vl==='ok'||vl.includes('active')) return 'FUNCIONANDO';
      if (vl.includes('sin vin')||vl==='sin vg'||vl.includes('sin vg')||vl.includes('no vin')) return 'SIN_VIN';
      if (vl.includes('sin placa')||vl.includes('no plate')) return 'SIN_PLACA';
      return v.toUpperCase().replace(/\s+/g,'_').substring(0,20);
    }
    const result=[];
    for (let i=hIdx+1;i<rows.length;i++) {
      const row=rows[i]; if (!Array.isArray(row)||!row[colNombre]) continue;
      const rawNombre=String(row[colNombre]||'').trim(); const num=cleanNum(rawNombre);
      if (!num||isNaN(Number(num))) continue;
      const n=Number(num); if (n<100||n>99999) continue;
      const rawDate=row[colUltima]||''; const fecha=parseDate(rawDate);
      const serie=String(row[colSerie]||'').trim();
      const estadoRaw=String(row[colEstado]||'').trim(); const estadoSamsara=normalizarEstadoSamsara(estadoRaw);
      result.push({num, fecha:fecha?fecha.toISOString():null, fechaStr:fecha?fmtDate(fecha):null,
        serie, estado:estadoRaw, estadoSamsara, sinVIN:estadoSamsara==='SIN_VIN',
        noDetecta:estadoSamsara==='NO_DETECTADO', rawNombre, plataforma:'SAMSARA'});
    }
    console.log(`[SAMSARA] ${result.length} registros`);
    return result;
  }

  /* ══════════════════════════════════════════════════════
     PARSER: AVL (hoja: Últimos datos de la unidad)
     A=Grouping, B=Último mensaje
  ══════════════════════════════════════════════════════ */
  function parseAVL(rows) {
    if (!rows||rows.length<2) return [];
    let hIdx=-1;
    for (let i=0;i<Math.min(rows.length,10);i++) {
      const r=rows[i]; if (!Array.isArray(r)) continue;
      const low=r.map(c=>String(c||'').toLowerCase());
      if (low.some(c=>c.includes('grouping'))||low.some(c=>c.includes('ultimo mensaje')||c.includes('último mensaje'))) {hIdx=i;break;}
    }
    if (hIdx===-1) hIdx=0;
    const result=[];
    for (let i=hIdx+1;i<rows.length;i++) {
      const row=rows[i]; if (!Array.isArray(row)||row[0]===undefined||row[0]===null||row[0]==='') continue;
      const rawGroup=String(row[0]||'').trim(); if (!rawGroup) continue;
      const num=cleanNum(rawGroup); if (!num) continue;
      const n=Number(num); if (isNaN(n)||n<100||n>99999) continue;
      let rawCell=row[1], rawDate='';
      if (rawCell&&typeof rawCell==='object') rawDate=String(rawCell.w||rawCell.v||rawCell.text||'').trim();
      else rawDate=String(rawCell||'').trim();
      if (!rawDate||rawDate.startsWith('http')||rawDate.includes('maps.google')||rawDate.includes('google.com/maps')) {
        let altCell=row[2];
        let alt=(altCell&&typeof altCell==='object')?String(altCell.w||altCell.v||''):String(altCell||'');
        if (alt&&!alt.startsWith('http')) rawDate=alt.trim();
      }
      const firstDate=rawDate.match(/(\d{4}-\d{2}-\d{2}[\sT]\d{1,2}:\d{2}(?::\d{2})?)/);
      if (firstDate) rawDate=firstDate[1];
      else { const altFormat=rawDate.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?)/); if (altFormat) rawDate=altFormat[1]; }
      const fecha=parseDate(rawDate);
      result.push({num, fecha:fecha?fecha.toISOString():null, fechaStr:fecha?fmtDate(fecha):null, plataforma:'AVL', _raw:rawGroup});
    }
    console.log(`[AVL] ${result.length} registros, con fecha: ${result.filter(r=>r.fecha).length}`);
    return result;
  }

  /* ══════════════════════════════════════════════════════
     PARSER: SCANIA (hoja: Posición de la flota)
     A=Vehículo, B=Hora
  ══════════════════════════════════════════════════════ */
  function parseScania(rows) {
    if (!rows||rows.length<2) return [];
    let hIdx=0;
    for (let i=0;i<Math.min(rows.length,5);i++) {
      const r=rows[i];
      if (Array.isArray(r)&&r.some(c=>String(c||'').toLowerCase().includes('veh'))) {hIdx=i;break;}
    }
    const result=[];
    for (let i=hIdx+1;i<rows.length;i++) {
      const row=rows[i]; if (!Array.isArray(row)||!row[0]) continue;
      const rawVeh=String(row[0]||'').trim(); const num=cleanNum(rawVeh);
      if (!num||isNaN(Number(num))) continue;
      const n=Number(num); if (n<100||n>99999) continue;
      const rawDate=String(row[1]||'').trim(); const fecha=parseDate(rawDate);
      result.push({num, fecha:fecha?fecha.toISOString():null, fechaStr:fecha?fmtDate(fecha):null, plataforma:'SCANIA'});
    }
    console.log(`[SCANIA] ${result.length} registros`);
    return result;
  }

  /* ══════════════════════════════════════════════════════
     PARSER: MAN (hoja: Dispositivos)
     A=Dispositivo, B=VIN, D=Ultima Conexion
  ══════════════════════════════════════════════════════ */
  function parseMAN(rows) {
    if (!rows||rows.length<2) return [];
    let hIdx=0;
    for (let i=0;i<Math.min(rows.length,5);i++) {
      const r=rows[i];
      if (Array.isArray(r)&&r.some(c=>String(c||'').toLowerCase().includes('dispositivo'))) {hIdx=i;break;}
    }
    const result=[];
    for (let i=hIdx+1;i<rows.length;i++) {
      const row=rows[i]; if (!Array.isArray(row)||!row[0]) continue;
      const rawDisp=String(row[0]||'').trim(); const num=cleanNum(rawDisp);
      if (!num||isNaN(Number(num))) continue;
      const n=Number(num); if (n<100||n>99999) continue;
      const vin=String(row[1]||'').trim();
      const rawDate=String(row[3]||'').trim(); const fecha=parseDate(rawDate);
      result.push({num, fecha:fecha?fecha.toISOString():null, fechaStr:fecha?fmtDate(fecha):null, serie:vin, plataforma:'MAN'});
    }
    console.log(`[MAN] ${result.length} registros`);
    return result;
  }

  /* ══════════════════════════════════════════════════════
     PARSER: VOLVO  ← NUEVO v4.1
     Archivo: tracking-report-YYYYMMDD-HHMM.xlsx (Volvo Connect)
     Hoja: "Actividades del vehículo"
     A=Vehículo (ETN-8101), B=Tiempo (fecha del evento)
     Una fila por evento — misma unidad repetida muchas veces.
     Lógica: agrupar y conservar la fecha MÁS RECIENTE por unidad.
  ══════════════════════════════════════════════════════ */
  function parseVOLVO(rows) {
    if (!rows||rows.length<2) return [];
    const normH=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();

    // Buscar fila de headers — buscar "Vehículo"/"Vehicle"/"Tiempo"/"Time"
    // O detectar la primera fila donde col A tiene formato "XXX-NNNNN" (datos reales)
    let hIdx=-1;
    for (let i=0;i<Math.min(rows.length,15);i++) {
      const r=rows[i]; if (!Array.isArray(r)||!r.length) continue;
      const norm=r.map(c=>normH(c));
      // Detectar por header textual
      if (norm.some(n=>n==='vehiculo'||n==='vehicle'||n==='vehic'||n.includes('ehicul'))
          ||norm.some(n=>n==='tiempo'||n==='time')) {
        hIdx=i;
        console.log('[VOLVO] Headers por nombre en fila',i,':',r.slice(0,4));
        break;
      }
      // Detectar directamente por datos: si col A tiene "XXX-NNNNN" y col B parece fecha
      const colA=String(r[0]||'').trim();
      const colB=String(r[1]||'').trim();
      const esVehiculo=/^[A-Z]{2,5}-\d{3,6}$/.test(colA)||/^\d{4,6}$/.test(colA);
      const esFecha=/\d{4}-\d{2}-\d{2}/.test(colB)||/\d{2}\/\d{2}\/\d{4}/.test(colB);
      if (esVehiculo&&esFecha) {
        hIdx=i-1; // la fila anterior sería el header (o -1 si i=0)
        console.log('[VOLVO] Datos detectados directamente en fila',i,'— hIdx=',(i-1));
        break;
      }
    }
    // Si no encontró headers, asumir que la fila 1 es header (fila 0 es nota)
    if (hIdx<0) hIdx=1;
    console.log('[VOLVO] hIdx final:',hIdx,' total filas:',rows.length,' muestra col0:',rows[Math.min(hIdx+1,rows.length-1)]?.slice?.(0,3));

    // Detectar columnas — fallback a posiciones 0,1 si no hay headers claros
    const hRow=rows[hIdx]||[];
    let colVeh=0,colFecha=1;
    hRow.forEach((h,i)=>{
      const n=normH(h);
      if (n==='vehiculo'||n==='vehicle'||n.includes('ehicul')) colVeh=i;
      else if (n==='tiempo'||n==='time'||n.includes('fecha')||n.includes('hora')) {
        if (colFecha===1||i>0) colFecha=i; // preferir la primera col de tiempo encontrada
      }
    });
    console.log('[VOLVO] colVeh=',colVeh,' colFecha=',colFecha);
    // Agrupar por unidad → conservar fecha más reciente
    const grupos={};
    for (let i=hIdx+1;i<rows.length;i++) {
      const row=rows[i]; if (!Array.isArray(row)) continue;
      const rawVeh=String(row[colVeh]||'').trim(); if (!rawVeh) continue;
      // "ETN-8101" → "8101"
      const num=cleanNum(rawVeh); if (!num||isNaN(Number(num))) continue;
      const n=Number(num); if (n<100||n>99999) continue;
      const rawFecha=String(row[colFecha]||'').trim();
      const fecha=parseDate(rawFecha); if (!fecha) continue;
      if (!grupos[num]||fecha>grupos[num]) grupos[num]=fecha;
    }
    const result=Object.entries(grupos).map(([num,fecha])=>({
      num, fecha:fecha.toISOString(), fechaStr:fmtDate(fecha), plataforma:'VOLVO'
    }));
    console.log(`[VOLVO] ${result.length} unidades únicas (de múltiples eventos)`);
    return result;
  }

  /* ══════════════════════════════════════════════════════
     PARSER: MOTIVE (hoja: devices_report)
     A=ID DE ENTIDAD, G=Fecha ubicación, H=Grupos, I=Dispositivo,
     J=Serie, N=Última actividad, O=Estado
  ══════════════════════════════════════════════════════ */
  function parseMOTIVE(rows) {
    if (!rows||rows.length<2) return [];
    let hIdx=0;
    for (let i=0;i<Math.min(rows.length,5);i++) {
      const r=rows[i];
      if (Array.isArray(r)&&r.some(c=>String(c||'').toUpperCase().includes('ID DE ENTIDAD'))) {hIdx=i;break;}
    }
    const headers=(rows[hIdx]||[]).map(c=>String(c||'').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim());
    const col=name=>headers.findIndex(h=>h.includes(name));
    const colId=(()=>{const i=col('ID DE ENTIDAD');return i!==-1?i:0;})();
    const colFecha=(()=>{
      for (let i=0;i<headers.length;i++){if(headers[i].includes('ACTIVIDAD')&&headers[i].includes('DISP'))return i;if(headers[i].includes('LTIMA ACTIVIDAD'))return i;}
      return 13;
    })();
    const colFechaG=(()=>{
      for (let i=0;i<headers.length;i++){if(headers[i].includes('FECHA')&&headers[i].includes('UBICAC'))return i;if(headers[i].includes('FECHA DE LA'))return i;}
      return 6;
    })();
    const colGrupo=(()=>{const i=headers.findIndex(h=>h.includes('GRUPO'));return i!==-1?i:7;})();
    const colDisp=(()=>{const i=col('DISPOSITIVO');return i!==-1?i:8;})();
    const colSerie=(()=>{for(let i=0;i<headers.length;i++){if(headers[i].includes('SERIE')&&i>8)return i;}return 9;})();
    const colModelo=(()=>{const all=[];headers.forEach((h,i)=>{if(h==='MODELO'&&i>colDisp)all.push(i);});if(all.length>0)return all[0];const i=col('MODELO');return i!==-1&&i>colDisp?i:10;})();
    const colEstado=(()=>{const i=headers.findIndex(h=>h==='ESTADO'||(h.includes('ESTADO')&&!h.includes('SUB')&&!h.includes('FECHA')));return i!==-1?i:14;})();
    console.log('[MOTIVE] colFecha='+colFecha+'('+headers[colFecha]+') colGrupo='+colGrupo+'('+headers[colGrupo]+') colEstado='+colEstado+'('+headers[colEstado]+')');
    const agrupado={};
    for (let i=hIdx+1;i<rows.length;i++) {
      const row=rows[i]; if (!Array.isArray(row)||row[colId]===undefined||row[colId]===null||row[colId]==='') continue;
      const rawId=String(row[colId]||'').trim(); const num=cleanNum(rawId);
      if (!num||isNaN(Number(num))) continue;
      const n=Number(num); if (n<100||n>99999) continue;
      const fechaAct=parseDate(String(row[colFecha]||'').trim());
      const fechaUbic=parseDate(String(row[colFechaG]||'').trim());
      let fechaMejor=null;
      if (fechaAct&&fechaUbic) fechaMejor=fechaAct>fechaUbic?fechaAct:fechaUbic;
      else fechaMejor=fechaAct||fechaUbic;
      const grupo=String(row[colGrupo]||'').trim();
      const disp=String(row[colDisp]||'').trim().toUpperCase();
      const serie=String(row[colSerie]||'').trim();
      const modelo=String(row[colModelo]||'').trim();
      const estado=String(row[colEstado]||'').trim();
      const esGateway=disp.includes('GATEWAY')||disp.includes('VG')||disp.includes('VEHICLE');
      const esDashcam=disp.includes('DASH')||disp.includes('CAM')||disp.includes('FACING');
      if (!agrupado[num]) {
        agrupado[num]={num, fecha:fechaMejor?fechaMejor.toISOString():null, fechaStr:fechaMejor?fmtDate(fechaMejor):null,
          empresa:grupo||'', estado:estado||'',
          serieGateway:esGateway?serie:'', modeloGateway:esGateway?modelo:'',
          serieDashcam:esDashcam?serie:'', modeloDashcam:esDashcam?modelo:'',
          dispositivos:[{tipo:disp,serie,modelo,estado,fecha:fechaMejor?fechaMejor.toISOString():null}],
          plataforma:'MOTIVE'};
      } else {
        const ent=agrupado[num];
        if (fechaMejor&&(!ent.fecha||fechaMejor>new Date(ent.fecha))) {ent.fecha=fechaMejor.toISOString();ent.fechaStr=fmtDate(fechaMejor);ent.estado=estado||ent.estado;}
        if (esGateway&&serie){ent.serieGateway=serie;ent.modeloGateway=modelo;}
        if (esDashcam&&serie){ent.serieDashcam=serie;ent.modeloDashcam=modelo;}
        if (!ent.empresa&&grupo) ent.empresa=grupo;
        ent.dispositivos.push({tipo:disp,serie,modelo,estado,fecha:fechaMejor?fechaMejor.toISOString():null});
      }
    }
    const result=Object.values(agrupado);
    console.log(`[MOTIVE] ${result.length} unidades agrupadas`);
    return result;
  }

  /* ══════════════════════════════════════════════════════
     DETECCIÓN DE PLATAFORMA Y HOJA CORRECTA
  ══════════════════════════════════════════════════════ */
  function detectarPlataforma(filename, sheetNames) {
    const f=String(filename||'').toLowerCase();
    if (f.includes('devices_report')||f.includes('devices report')) return 'MOTIVE';
    if (f.includes('samsara')||f.includes('reporte_del_estado')||f.includes('reporte del estado')) return 'SAMSARA';
    if (f.includes('last gps')||f.includes('last_gps')||f.match(/info[-_]\d{8}/)) return 'CEIBA';
    if (f.includes('dispositivos')||f.match(/dispositivos[_\s]\d+/)) return 'MAN';
    if (f.includes('posicion_de_la_flota')||f.includes('posicion de la flota')||f.includes('posición')) return 'SCANIA';
    // VOLVO: "tracking-report-YYYYMMDD-HHMM"
    if (f.includes('tracking-report')||f.includes('tracking report')) return 'VOLVO';
    if (f.includes('para_barridos')||f.includes('para barridos')||
        f.includes('_status_')||f.includes(' status ')||f.match(/status[_\s-]\d{4}/)||
        f.match(/_status\.xl/)||f.match(/etn.*status/)||
        (f.includes('status')&&f.match(/\d{4}[-_]\d{2}[-_]\d{2}/))) return 'AVL';
    if (Array.isArray(sheetNames)) {
      const normalize=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
      const hasUltimos=sheetNames.some(n=>normalize(n).includes('ultimos datos')||normalize(n).includes('ultimo dato'));
      if (hasUltimos) return 'AVL';
    }
    if (f.match(/\d{2}_asignaci/i)||f.includes('asignac')) return 'ASIGNACION';
    return null;
  }

  function selectSheet(sheets, sheetNames, plat) {
    const normalize=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
    if (plat==='ASIGNACION') {
      const det=sheetNames.find(n=>normalize(n)==='detalle1'||normalize(n).includes('detalle'));
      return det||sheetNames[0];
    }
    if (plat==='CEIBA') {
      const sh=sheetNames.find(n=>normalize(n).includes('sheet')||normalize(n)==='sheet1');
      return sh||sheetNames[0];
    }
    if (plat==='SAMSARA') {
      const sh=sheetNames.find(n=>normalize(n).includes('samsara')||normalize(n).includes('reporte'));
      return sh||sheetNames[0];
    }
    if (plat==='AVL') {
      console.log('[selectSheet AVL] Hojas disponibles:',sheetNames);
      const sinContent=sheetNames.filter(n=>{const nm=normalize(n);return nm!=='content'&&!nm.startsWith('content')&&nm!=='contenido';});
      if (sinContent.length===0) return sheetNames[0];
      let prefer=sinContent.find(n=>{const nm=normalize(n);return nm.includes('ultimos datos')||nm.includes('ultimo dato')||nm==='ultimos datos de la unidad'||nm==='ultimo dato de la unidad';});
      if (prefer) {console.log('[selectSheet AVL] Elegida:',prefer);return prefer;}
      prefer=sinContent.find(n=>normalize(n).includes('unidad'));
      if (prefer) {console.log('[selectSheet AVL] Elegida (fallback 1):',prefer);return prefer;}
      console.log('[selectSheet AVL] Elegida (fallback 2):',sinContent[0]);
      return sinContent[0];
    }
    if (plat==='SCANIA') {
      const sh=sheetNames.find(n=>normalize(n).includes('posicion')||normalize(n).includes('flota'));
      return sh||sheetNames[0];
    }
    if (plat==='MAN') {
      const sh=sheetNames.find(n=>normalize(n).includes('dispositivo'));
      return sh||sheetNames[0];
    }
    if (plat==='MOTIVE') {
      const sh=sheetNames.find(n=>normalize(n).includes('devices_report')||normalize(n).includes('devices report'));
      return sh||sheetNames[0];
    }
    if (plat==='VOLVO') {
      // Hoja: "Actividades del vehículo" (Volvo Connect tracking-report)
      // Priorizar por nombre, fallback a primera hoja
      const sh=sheetNames.find(n=>normalize(n).includes('actividad')||normalize(n).includes('vehicle')||normalize(n).includes('vehiculo'));
      if (sh) { console.log('[selectSheet VOLVO] Elegida:', sh); return sh; }
      // Si no hay hoja por nombre, usar la primera (puede ser la única)
      console.log('[selectSheet VOLVO] Usando primera hoja:', sheetNames[0]);
      return sheetNames[0];
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
      case 'MOTIVE':  return parseMOTIVE(rows);
      case 'VOLVO':   return parseVOLVO(rows);
      default:        return [];
    }
  }

  function validarResultado(registros) {
    const total=registros.length; const conFecha=registros.filter(r=>r.fecha).length;
    const sinFecha=total-conFecha; const pct=total>0?Math.round(conFecha/total*100):0;
    return {total,conFecha,sinFecha,pct,ok:total>0};
  }

  function normalizarCromatica(val) {
    const v=String(val||'').toUpperCase().trim(); if (!v) return '';
    if (v.includes('MIGRA')||v==='INM') return 'Migración (INM)';
    if (v==='ETN'||v==='ETNC') return 'ETN';
    if (v.includes('TURISTA')) return 'Turistar';
    if (v.includes('TURISMO')) return 'Turismo';
    if (v.includes('RENTA')) return 'Unidades en Renta';
    return val.trim();
  }
  function normalizarEstatus(val) {
    const v=String(val||'').toUpperCase().trim(); if (!v||v==='—') return '';
    if (v.includes('EN OPERACI')||v==='OPERACION') return 'En operación';
    if (v.includes('ARRENDAMIENTO')||v.includes('ARRENDADO')) return 'Arrendamiento';
    if (v.includes('PARA VENTA')||v==='A VENTA') return 'Para venta';
    if (v.includes('FUERA DE OPERACI')||v==='FUERA') return 'Fuera de operación';
    if (v.includes('RENTADO A SAME')||v.includes('RENT')) return 'Rentado a SAME';
    if (v.includes('BAJA')) return 'Baja';
    if (v.includes('SINIESTRO')) return 'Siniestro';
    return val.trim();
  }
  function categorizarEstatus(est) {
    const e=normalizarEstatus(est);
    if (e==='En operación'||e==='Arrendamiento') return 'En operación';
    if (e==='Para venta') return 'Para venta';
    if (e==='Fuera de operación'||e==='Rentado a SAME') return 'Fuera de operación';
    if (e==='Siniestro') return 'Siniestro';
    if (e==='Baja') return 'Baja';
    return 'Otro';
  }

  return {
    cleanNum, parseDate, fmtDate, fmtDateShort, fmtTime,
    diasDesde, statusClass,
    parseAsignacion, parseCeiba, parseSamsara, parseMAN, parseAVL, parseScania, parseVOLVO,
    readXLSX, detectarPlataforma, selectSheet, parsearPorPlataforma, validarResultado,
    normalizarCromatica, normalizarEstatus, categorizarEstatus
  };
})();
