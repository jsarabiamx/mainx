/**
 * gps-db.js — Capa Supabase para Mesa de Control GPS
 * Prefijo gps_ en todas las tablas — completamente separado del sistema CCTV
 * Mantiene la misma API pública que db.js para compatibilidad total
 */

const GPS_SB = (() => {
  // Usar la misma config de Supabase del sistema padre si está disponible
  // o configuración propia
  const CONFIG = (() => {
    if (window.CCTV_SUPABASE_CONFIG) return window.CCTV_SUPABASE_CONFIG;
    return {
      url: 'https://sxzhmcrpeyuqslupttby.supabase.co',
      anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4emhtY3JwZXl1cXNsdXB0dGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MjQ5MDgsImV4cCI6MjA5MzAwMDkwOH0.-muAjBKc2PekqbgRltLVBnUCdxfQlHNxmVruXrw_sl8'
    };
  })();

  const BASE = CONFIG.url + '/rest/v1';
  const KEY  = CONFIG.anonKey;
  const HEADERS = {
    'apikey': KEY,
    'Authorization': 'Bearer ' + KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  // ── REST helpers ──────────────────────────────────────────────────────────
  async function _get(table, params = '') {
    const r = await fetch(`${BASE}/${table}${params ? '?' + params : ''}`, { headers: HEADERS });
    if (!r.ok) throw new Error(`GPS_SB GET ${table}: ${r.status}`);
    return r.json();
  }

  // _getRaw: igual que _get pero con paginación automática (hasta 5000 filas)
  async function _getRaw(table, params = '') {
    const limit = 3000; // 3000 cubre ETN (2370) y GHO (867) en un solo request
    let offset = 0;
    let all = [];
    while (true) {
      const sep = params ? '&' : '';
      const r = await fetch(`${BASE}/${table}?${params}${sep}limit=${limit}&offset=${offset}`, {
        headers: { ...HEADERS, 'Prefer': 'count=none' }
      });
      if (!r.ok) throw new Error(`GPS_SB GET ${table}: ${r.status}`);
      const rows = await r.json();
      all = all.concat(rows);
      if (rows.length < limit) break;
      offset += limit;
      if (offset > 9000) break; // seguridad
    }
    return all;
  }

  async function _upsert(table, data) {
    const r = await fetch(`${BASE}/${table}`, {
      method: 'POST',
      headers: { ...HEADERS, 'Prefer': 'return=representation,resolution=merge-duplicates' },
      body: JSON.stringify(data)
    });
    if (!r.ok) { const e = await r.text(); throw new Error(`GPS_SB UPSERT ${table}: ${e}`); }
    return r.json();
  }

  // INSERT simple (para tablas sin UNIQUE constraint como gps_fallas)
  async function _insert(table, data) {
    const r = await fetch(`${BASE}/${table}`, {
      method: 'POST',
      headers: { ...HEADERS, 'Prefer': 'return=representation' },
      body: JSON.stringify(data)
    });
    if (!r.ok) { const e = await r.text(); throw new Error(`GPS_SB INSERT ${table}: ${e}`); }
    return r.json();
  }

  async function _patch(table, filter, data) {
    // Tablas que tienen updated_at
    const HAS_UPDATED_AT = ['gps_unidades','gps_empresas','gps_config','gps_fallas','gps_sims'];
    const body = HAS_UPDATED_AT.includes(table)
      ? { ...data, updated_at: new Date().toISOString() }
      : { ...data };
    const r = await fetch(`${BASE}/${table}?${filter}`, {
      method: 'PATCH',
      headers: {
        'apikey':        KEY,
        'Authorization': 'Bearer ' + KEY,
        'Content-Type':  'application/json',
        'Prefer':        'return=minimal'   // return=minimal para bulk updates
      },
      body: JSON.stringify(body)
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => r.status);
      throw new Error(`GPS_SB PATCH ${table}: ${r.status} — ${txt}`);
    }
    return true;
  }

  // FIX: usar return=minimal para DELETE masivo.
  // Con return=representation PostgREST puede rechazar bulk deletes silenciosamente.
  async function _delete(table, filter) {
    const r = await fetch(`${BASE}/${table}?${filter}`, {
      method: 'DELETE',
      headers: {
        'apikey':        KEY,
        'Authorization': 'Bearer ' + KEY,
        'Prefer':        'return=minimal'
      }
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => String(r.status));
      throw new Error(`GPS_SB DELETE ${table}: ${r.status} — ${txt}`);
    }
    return true;
  }

  // ── Empresas ──────────────────────────────────────────────────────────────
  async function getEmpresas() {
    const rows = await _get('gps_empresas', 'activa=eq.true&order=id');
    const obj = {};
    rows.forEach(r => { obj[r.id] = { nombre: r.nombre, color: r.color }; });
    return obj;
  }

  async function getEmpresasList() {
    const rows = await _get('gps_empresas', 'activa=eq.true&select=id&order=id');
    return rows.map(r => r.id);
  }

  async function addEmpresa(id, nombre, color = '#3b82f6') {
    await _upsert('gps_empresas', { id, nombre, color, activa: true });
  }

  async function removeEmpresa(id) {
    await _patch('gps_empresas', 'id=eq.' + id, { activa: false });
  }

  // ── Config / Empresa activa ───────────────────────────────────────────────
  async function getEmpresaActiva() {
    const rows = await _get('gps_config', 'id=eq.singleton&select=empresa_activa');
    return rows[0]?.empresa_activa || 'ETN';
  }

  async function setEmpresaActiva(emp) {
    await _patch('gps_config', 'id=eq.singleton', { empresa_activa: emp });
  }

  async function getConfig() {
    const rows = await _get('gps_config', 'id=eq.singleton&select=config');
    return rows[0]?.config || { diasLinea: 1, diasAtencion: 4 };
  }

  async function setConfig(cfg) {
    await _patch('gps_config', 'id=eq.singleton', { config: cfg });
  }

  async function getCatalogo(tipo) {
    const rows = await _get('gps_config', 'id=eq.singleton&select=catalogos');
    const cats = rows[0]?.catalogos || {};
    return cats[tipo] || [];
  }

  // ── Unidades ──────────────────────────────────────────────────────────────
  async function getUnidadesList(emp) {
    return _get('gps_unidades',
      `empresa_id=eq.${encodeURIComponent(emp)}&activa=eq.true&order=num_economico`
    );
  }

  async function getUnidad(num, emp) {
    const rows = await _get('gps_unidades',
      `num_economico=eq.${num}&empresa_id=eq.${encodeURIComponent(emp)}&activa=eq.true&limit=1`
    );
    return rows[0] || null;
  }

  async function upsertUnidad(unidad, emp) {
    const row = {
      num_economico: String(unidad.num || unidad.num_economico),
      empresa_id:    emp,
      base:          unidad.base || null,
      cromatica:     unidad.cromatica || null,
      modelo:        unidad.modelo || null,
      estatus:       unidad.estatus || 'EN_OPERACION',
      rol:           unidad.rol || null,
      mes_asig:      unidad.mesAsig || unidad.mes_asig || null,
      serie_vin:     unidad.serieVin || unidad.serie_vin || null,
      motor:         unidad.motor || null,
      placa:         unidad.placa || null,
      asientos:      unidad.asientos ? String(unidad.asientos) : null,
      observaciones: unidad.observaciones || null,
      datos_extra:   unidad.datos_extra || {},
      activa:        true,
      updated_at:    new Date().toISOString()
    };
    const result = await _upsert('gps_unidades', row);
    return result[0] || row;
  }

  async function eliminarUnidad(num, emp) {
    await _patch('gps_unidades',
      `num_economico=eq.${num}&empresa_id=eq.${encodeURIComponent(emp)}`,
      { activa: false }
    );
  }

  // ── Barridos GPS ──────────────────────────────────────────────────────────
  async function getBarridos(emp) {
    const rows = await _get('gps_barridos',
      `empresa_id=eq.${encodeURIComponent(emp)}&order=cargado_at.desc`
    );
    // Agrupar por plataforma → { CEIBA: {registros:[...]}, ... }
    const result = {};
    rows.forEach(r => {
      if (!result[r.plataforma]) result[r.plataforma] = { registros: [] };
      result[r.plataforma].registros.push({
        num: r.num_economico,
        ultimaConexion: r.ultima_conexion,
        tieneDatos: r.tiene_datos,
        ...r.datos_raw
      });
    });
    return result;
  }

  // Convierte un Date a string de hora local "YYYY-MM-DD HH:MM:SS"
  // sin usar toISOString() que convierte a UTC.
  function _dateToLocalStr(d) {
    if (!(d instanceof Date) || isNaN(d)) return null;
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ` +
           `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  async function saveBarrido(plataforma, registros, emp) {
    if (!registros || registros.length === 0) return { actualizadas: 0, total: 0 };
    const now = new Date().toISOString();

    // 1. Traer registros existentes para preservar observaciones
    let existentes = {};
    try {
      const rows = await _getRaw('gps_barridos',
        `empresa_id=eq.${encodeURIComponent(emp)}&plataforma=eq.${encodeURIComponent(plataforma)}&activa=eq.true`
      );
      rows.forEach(r => { existentes[String(r.num_economico)] = r; });
    } catch(e) { console.warn('[GPS_SB] getBarridos prev:', e); }

    // 2. Preparar filas para UPSERT
    const rows = registros.map(r => {
      const num = String(r.num || r.placa || r.vehiculo || r.numero || '').trim();
      if (!num) return null;

      const prev = existentes[num];
      // Preservar observaciones: columna dedicada > datos_raw legacy > null
      const observaciones = r.observaciones || prev?.observaciones || prev?.datos_raw?.observaciones || null;

      const ultimaConexion = r.fecha || r.ultimaConexion || r.ultima_conexion || null;

      // FIX FECHA: convertir siempre a hora local antes de guardar en Supabase.
      // El parser entrega r.fecha como ISO UTC string ("2024-08-19T11:02:30.000Z").
      // Si se guarda directo en TIMESTAMP WITHOUT TIME ZONE, Postgres lo muestra desplazado.
      // _dateToLocalStr convierte a "YYYY-MM-DD HH:MM:SS" en hora local del cliente.
      let ultimaConexionStr = null;
      if (ultimaConexion) {
        if (ultimaConexion instanceof Date) {
          ultimaConexionStr = _dateToLocalStr(ultimaConexion);
        } else {
          const d = new Date(ultimaConexion);
          ultimaConexionStr = isNaN(d) ? String(ultimaConexion) : _dateToLocalStr(d);
        }
      }

      // datos_raw NO debe incluir observaciones (evita corrupción en PATCH parciales)
      const { observaciones: _omit, ...rLimpio } = r;

      return {
        empresa_id:      emp,
        plataforma,
        num_economico:   num,
        ultima_conexion: ultimaConexionStr || null,
        tiene_datos:     !!ultimaConexionStr,
        activa:          true,
        observaciones,
        datos_raw:       rLimpio,
        cargado_at:      now
      };
    }).filter(Boolean);

    if (rows.length === 0) return { total: registros.length, upserted: 0 };

    // FIX DEDUP: eliminar duplicados por num_economico ANTES del upsert.
    // Si el mismo num aparece dos veces en el archivo (ej: Samsara con dos VG),
    // PostgREST falla el lote completo al detectar duplicate key en el batch.
    // Nos quedamos con el último registro (generalmente el más reciente).
    const rowsMap = new Map();
    rows.forEach(r => rowsMap.set(r.num_economico, r));
    const rowsUniq = Array.from(rowsMap.values());
    console.log(`[GPS_SB] ${rows.length} filas → ${rowsUniq.length} únicas después de dedup`);

    // FIX: usar ?on_conflict= explícito para que PostgREST resuelva el UNIQUE correcto.
    // Sin esto PostgREST no puede inferir qué constraint usar cuando hay FK + UNIQUE.
    const ON_CONFLICT = 'on_conflict=empresa_id%2Cplataforma%2Cnum_economico';
    const lotes = [];
    for (let i = 0; i < rowsUniq.length; i += 200) lotes.push(rowsUniq.slice(i, i + 200));

    // Enviar lotes SECUENCIALMENTE para evitar conflictos de concurrencia en el upsert
    for (const lote of lotes) {
      try {
        const resp = await fetch(`${BASE}/gps_barridos?${ON_CONFLICT}`, {
          method: 'POST',
          headers: { ...HEADERS, 'Prefer': 'return=minimal,resolution=merge-duplicates' },
          body: JSON.stringify(lote)
        });
        if (!resp.ok) {
          const t = await resp.text();
          console.error(`[GPS_SB barrido upsert] ERROR HTTP ${resp.status} — lote ${lote.length} filas, plat: ${plataforma}, emp: ${emp}:`, t.substring(0,300));
        } else {
          console.log(`[GPS_SB barrido upsert] OK — ${lote.length} filas, plataforma: ${plataforma}, empresa: ${emp}`);
        }
      } catch(e) {
        console.error('[GPS_SB barrido upsert] FETCH ERROR:', e);
      }
    }

    return {
      total: registros.length,
      upserted: rowsUniq.length,
      eliminados: 0
    };
  }

  // ── Asignaciones ─────────────────────────────────────────────────────────
  async function getAsignaciones(emp) {
    const rows = await _get('gps_asignaciones',
      `empresa_id=eq.${encodeURIComponent(emp)}&activa=eq.true&order=mes_label.desc,num_economico`
    );
    // Agrupar por mes { 'Mayo 2026': { filas: [...] } }
    const result = {};
    rows.forEach(r => {
      if (!result[r.mes_label]) result[r.mes_label] = { filas: [] };
      result[r.mes_label].filas.push({
        num:      r.num_economico,
        base:     r.base,
        cromatica: r.cromatica,
        modelo:   r.modelo,
        estatus:  r.estatus,
        rol:      r.rol,
        ...r.datos_extra
      });
    });
    return result;
  }

  async function saveAsignacion(mesLabel, filas, emp) {
    // Desactivar asignación anterior del mismo mes
    await _patch('gps_asignaciones',
      `empresa_id=eq.${encodeURIComponent(emp)}&mes_label=eq.${encodeURIComponent(mesLabel)}`,
      { activa: false }
    ).catch(() => {});

    const rows = filas.map(f => ({
      empresa_id:    emp,
      mes_label:     mesLabel,
      num_economico: String(f.num || f.economico || ''),
      base:          f.base || null,
      cromatica:     f.cromatica || null,
      modelo:        f.modelo || null,
      estatus:       f.estatus || null,
      rol:           f.rol || null,
      datos_extra:   f,
      activa:        true,
      created_at:    new Date().toISOString()
    }));

    await _upsert('gps_asignaciones', rows);
    return { total: rows.length, creadas: rows.length, actualizadas: 0, inactivadas: 0 };
  }

  // ── Historial ─────────────────────────────────────────────────────────────
  async function addLog(tipo, mensaje, datos = {}, emp = null) {
    await _upsert('gps_historial', {
      empresa_id: emp,
      tipo,
      mensaje,
      datos,
      created_at: new Date().toISOString()
    });
  }

  async function getHistorialGlobal(limit = 50) {
    const rows = await _get('gps_historial',
      `order=created_at.desc&limit=${limit}`
    );
    return rows.map(r => ({
      tipo:    r.tipo,
      msg:     r.mensaje,
      ts:      r.created_at,
      empresa: r.empresa_id,
      ...r.datos
    }));
  }

  // ── Fallas ────────────────────────────────────────────────────────────────
  async function getFallas(emp) {
    return _get('gps_fallas',
      `empresa_id=eq.${encodeURIComponent(emp)}&order=created_at.desc`
    );
  }

  async function getFallasActivas(emp) {
    return _get('gps_fallas',
      `empresa_id=eq.${encodeURIComponent(emp)}&activa=eq.true&order=created_at.desc`
    );
  }

  async function registrarFalla(num, falla, emp) {
    return _insert('gps_fallas', {
      num_economico: String(num),
      empresa_id:    emp,
      tipo:          falla.esSiniestro ? 'SINIESTRO' : (falla.tipo || 'AFR'),
      etiqueta:      falla.motivo || falla.etiqueta || null,
      descripcion:   falla.descripcion || null,
      activa:        true,
      resuelta:      false,
      datos_extra:   falla,
      created_at:    new Date().toISOString()
    });
  }

  async function resolverFalla(id, motivo) {
    return _patch('gps_fallas', 'id=eq.' + id, {
      activa: false,
      resuelta: true,
      datos_extra: { motivo_resolucion: motivo || '' }
    });
  }

  async function eliminarFallaDB(id) {
    return _delete('gps_fallas', 'id=eq.' + id);
  }

  /**
   * Actualiza el campo `observaciones` en gps_barridos para TODAS las plataformas
   * de una unidad. Usa la columna dedicada (no datos_raw) para evitar corrupción.
   */
  async function patchDesinstalacionBarrido(num, emp, plat, datos) {
    const payload = datos
      ? {
          desinstalado:               true,
          desinstalacion_fecha:       datos.fecha       || null,
          desinstalacion_comentario:  datos.comentario  || null,
          desinstalacion_ts:          datos.ts          || new Date().toISOString()
        }
      : {
          desinstalado:               false,
          desinstalacion_fecha:       null,
          desinstalacion_comentario:  null,
          desinstalacion_ts:          null
        };
    await _patch(
      'gps_barridos',
      `empresa_id=eq.${encodeURIComponent(emp)}&plataforma=eq.${encodeURIComponent(plat)}&num_economico=eq.${encodeURIComponent(num)}`,
      payload
    ).catch(err => console.warn('[GPS_SB] patchDesinstalacionBarrido:', err));
  }

  async function patchObservacionesBarrido(num, emp, texto) {
    const plataformas = ["CEIBA","SAMSARA","AVL","SCANIA","MAN","VOLVO","MOTIVE"];
    await Promise.all(plataformas.map(plat =>
      _patch("gps_barridos",
        `empresa_id=eq.${encodeURIComponent(emp)}&plataforma=eq.${plat}&num_economico=eq.${encodeURIComponent(num)}`,
        { observaciones: texto || null }
      ).catch(() => {})
    ));
  }

  // ── SIMs ──────────────────────────────────────────────────────────────────
  async function getSims(emp) {
    return _get('gps_sims',
      `empresa_id=eq.${encodeURIComponent(emp)}&order=created_at.desc`
    );
  }

  async function saveSim(sim, emp) {
    return _upsert('gps_sims', {
      ...sim,
      empresa_id:  emp,
      updated_at:  new Date().toISOString()
    });
  }

  async function deleteSim(id) {
    return _delete('gps_sims', 'id=eq.' + id);
  }

  // ── Exponer API pública ───────────────────────────────────────────────────
  return {
    // Empresas
    getEmpresas, getEmpresasList, addEmpresa, removeEmpresa,
    // Config
    getEmpresaActiva, setEmpresaActiva, getConfig, setConfig, getCatalogo,
    // Unidades
    getUnidadesList, getUnidad, upsertUnidad, eliminarUnidad,
    // Barridos
    getBarridos, saveBarrido,
    // Asignaciones
    getAsignaciones, saveAsignacion,
    // Historial
    addLog, getHistorialGlobal,
    // Fallas
    getFallas, getFallasActivas, registrarFalla, resolverFalla, eliminarFallaDB,
    // SIMs
    getSims, saveSim, deleteSim,
    // Barridos — observaciones y desinstalación
    patchObservacionesBarrido, patchDesinstalacionBarrido,
    // Helper: saber si Supabase está disponible
    _getRaw, _patch, _delete,
    isAvailable: () => true,
    // Save dummy (compatibilidad — Supabase no necesita save() manual)
    save: () => true
  };
})();
window.GPS_SB = GPS_SB;
