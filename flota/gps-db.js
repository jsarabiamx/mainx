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
    const r = await fetch(`${BASE}/${table}?${filter}`, {
      method: 'PATCH',
      headers: HEADERS,
      body: JSON.stringify({ ...data, updated_at: new Date().toISOString() })
    });
    if (!r.ok) throw new Error(`GPS_SB PATCH ${table}: ${r.status}`);
    return r.json();
  }

  async function _delete(table, filter) {
    const r = await fetch(`${BASE}/${table}?${filter}`, { method: 'DELETE', headers: HEADERS });
    if (!r.ok) throw new Error(`GPS_SB DELETE ${table}: ${r.status}`);
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

  async function saveBarrido(plataforma, registros, emp) {
    // Borrar barrido anterior de esta plataforma/empresa y reemplazar
    await _delete('gps_barridos',
      `empresa_id=eq.${encodeURIComponent(emp)}&plataforma=eq.${plataforma}`
    ).catch(() => {});

    if (!registros || registros.length === 0) return { actualizadas: 0, total: 0 };

    const rows = registros.map(r => ({
      empresa_id:     emp,
      plataforma:     plataforma,
      num_economico:  String(r.num || r.placa || r.vehiculo || r.numero || ''),
      ultima_conexion: r.ultimaConexion || r.ultima_conexion || null,
      tiene_datos:    !!(r.ultimaConexion || r.ultima_conexion),
      datos_raw:      r,
      cargado_at:     new Date().toISOString()
    }));

    await _upsert('gps_barridos', rows);
    return { actualizadas: rows.length, noEncontradas: 0, total: rows.length };
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
    // Helper: saber si Supabase está disponible
    isAvailable: () => true,
    // Save dummy (compatibilidad — Supabase no necesita save() manual)
    save: () => true
  };
})();
window.GPS_SB = GPS_SB;
