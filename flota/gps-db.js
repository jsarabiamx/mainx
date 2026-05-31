/**
 * gps-db.js — Módulo Supabase para Mesa de Control GPS
 * Expone window.GPS_SB con métodos para leer/escribir en Supabase
 * v4.1 — Reemplaza la versión que fue sobreescrita por error con db.js
 */
const GPS_SB = (() => {
  const BASE_URL = 'https://sxzhmcrpeyuqslupttby.supabase.co';
  const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4emhtY3JwZXl1cXNsdXB0dGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MjQ5MDgsImV4cCI6MjA5MzAwMDkwOH0.-muAjBKc2PekqbgRltLVBnUCdxfQlHNxmVruXrw_sl8';

  const HEADERS = {
    'apikey':        ANON_KEY,
    'Authorization': 'Bearer ' + ANON_KEY,
    'Content-Type':  'application/json',
    'Prefer':        'return=representation'
  };

  // ── Primitivas REST ───────────────────────────────────────────────────────

  async function _getRaw(table, query) {
    const url = `${BASE_URL}/rest/v1/${table}?${query}`;
    const res = await fetch(url, {
      headers: { ...HEADERS, 'Range': '0-9999' }
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`[GPS_SB._getRaw] ${table} ${res.status}: ${body}`);
    }
    return res.json();
  }

  async function _delete(table, query) {
    const res = await fetch(`${BASE_URL}/rest/v1/${table}?${query}`, {
      method:  'DELETE',
      headers: HEADERS
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`[GPS_SB._delete] ${table} ${res.status}: ${body}`);
    }
    return res.json().catch(() => null);
  }

  async function _upsert(table, rows, onConflict) {
    const headers = { ...HEADERS };
    if (onConflict) {
      headers['Prefer'] = `resolution=merge-duplicates,return=representation`;
    }
    const qs = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : '';
    const res = await fetch(`${BASE_URL}/rest/v1/${table}${qs}`, {
      method:  'POST',
      headers,
      body:    JSON.stringify(rows)
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`[GPS_SB._upsert] ${table} ${res.status}: ${body}`);
    }
    return res.json().catch(() => null);
  }

  async function _patch(table, query, data) {
    const res = await fetch(`${BASE_URL}/rest/v1/${table}?${query}`, {
      method:  'PATCH',
      headers: HEADERS,
      body:    JSON.stringify(data)
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`[GPS_SB._patch] ${table} ${res.status}: ${body}`);
    }
    return res.json().catch(() => null);
  }

  // ── Empresa activa (gps_config singleton) ────────────────────────────────

  async function setEmpresaActiva(emp) {
    try {
      return await _patch('gps_config', 'id=eq.singleton', {
        empresa_activa: emp,
        updated_at:     new Date().toISOString()
      });
    } catch(e) {
      console.warn('[GPS_SB.setEmpresaActiva]', e.message);
    }
  }

  // ── Asignaciones ─────────────────────────────────────────────────────────

  async function saveAsignacion(mesLabel, filas, emp) {
    const BATCH = 200;
    const rows = filas
      .map(f => ({
        empresa_id:    emp,
        mes_label:     mesLabel,
        num_economico: String(f.num || f.numEco || '').trim(),
        base:          f.base       || null,
        cromatica:     f.cromatica  || null,
        modelo:        f.modelo     || null,
        estatus:       f.estatus    || f.estatusInforme || null,
        rol:           f.rol        || null,
        datos_extra:   { ...f },
        activa:        true,
        created_at:    new Date().toISOString()
      }))
      .filter(r => r.num_economico);

    // Borrar las anteriores del mismo mes+empresa para hacer un reemplazo limpio
    await _delete(
      'gps_asignaciones',
      `empresa_id=eq.${encodeURIComponent(emp)}&mes_label=eq.${encodeURIComponent(mesLabel)}`
    ).catch(() => {});

    for (let i = 0; i < rows.length; i += BATCH) {
      await _upsert('gps_asignaciones', rows.slice(i, i + BATCH),
        'empresa_id,num_economico,mes_label');
    }
    return { total: rows.length };
  }

  // ── Barridos GPS ─────────────────────────────────────────────────────────

  async function saveBarrido(plataforma, registros, emp) {
    const BATCH = 200;

    // Convertir fecha local a string ISO o null
    const toISOSafe = fecha => {
      if (!fecha) return null;
      try {
        const d = fecha instanceof Date ? fecha : new Date(fecha);
        return isNaN(d) ? null : d.toISOString();
      } catch { return null; }
    };

    const rows = registros
      .map(r => ({
        empresa_id:     emp,
        plataforma:     plataforma,
        num_economico:  String(r.num || '').trim(),
        ultima_conexion: toISOSafe(r.fecha)
          ? toISOSafe(r.fecha).replace('T', ' ').slice(0, 19)
          : null,
        tiene_datos:    !!r.fecha,
        datos_raw:      { ...r },
        activa:         true,
        cargado_at:     new Date().toISOString()
      }))
      .filter(r => r.num_economico);

    for (let i = 0; i < rows.length; i += BATCH) {
      await _upsert(
        'gps_barridos',
        rows.slice(i, i + BATCH),
        'empresa_id,plataforma,num_economico'
      );
    }
    return { total: rows.length };
  }

  // ── Fallas / Siniestros ──────────────────────────────────────────────────

  async function registrarFalla(num, falla, emp) {
    return _upsert('gps_fallas', [{
      empresa_id:    emp,
      num_economico: String(num),
      tipo:          falla.esSiniestro ? 'SINIESTRO' : 'AFR',
      etiqueta:      falla.motivo      || '',
      descripcion:   falla.descripcion || '',
      activa:        true,
      resuelta:      false,
      datos_extra:   falla,
      created_at:    new Date().toISOString()
    }]);
  }

  async function resolverFalla(sbId, motivo) {
    return _patch('gps_fallas', `id=eq.${sbId}`, {
      resuelta:    true,
      activa:      false,
      updated_at:  new Date().toISOString(),
      datos_extra: { motivoResolucion: motivo || '' }
    });
  }

  async function eliminarFallaDB(sbId) {
    return _delete('gps_fallas', `id=eq.${sbId}`);
  }

  async function getFallasActivas(emp) {
    return _getRaw(
      'gps_fallas',
      `empresa_id=eq.${encodeURIComponent(emp)}&activa=eq.true`
    );
  }

  // ── Observaciones y Notas ────────────────────────────────────────────────

  async function patchObservacionesBarrido(num, emp, obs) {
    try {
      return await _patch(
        'gps_barridos',
        `empresa_id=eq.${encodeURIComponent(emp)}&num_economico=eq.${encodeURIComponent(num)}`,
        { observaciones: obs, updated_at: new Date().toISOString() }
      );
    } catch(e) {
      console.warn('[GPS_SB.patchObservaciones]', e.message);
    }
  }

  // ── Notas permanentes de unidad ──────────────────────────────────────────

  async function patchNotasBarrido(num, emp, notas) {
    try {
      return await _patch(
        'gps_barridos',
        `empresa_id=eq.${encodeURIComponent(emp)}&num_economico=eq.${encodeURIComponent(num)}`,
        { notas, updated_at: new Date().toISOString() }
      );
    } catch(e) {
      console.warn('[GPS_SB.patchNotas]', e.message);
    }
  }

  // ── SIMs ─────────────────────────────────────────────────────────────────

  async function saveSim(simData, emp) {
    const row = {
      empresa_id:     emp,
      num_economico:  simData.unidad  || null,
      iccid:          simData.iccid   || null,
      operadora:      simData.operadora || null,
      estado:         simData.estado  || 'SIN_ASIGNAR',
      base:           simData.base    || null,
      cromatica:      simData.cromatica || null,
      equipo_dvr:     simData.equipoDvr || null,
      observaciones:  simData.observaciones || null,
      movimiento:     simData.movimiento || null,
      destino_retiro: simData.destino_retiro || null,
      gb:             simData.gb || null,
      activa:         true,
      updated_at:     new Date().toISOString()
    };
    if (simData._sbId) {
      return _patch('gps_sims', `id=eq.${simData._sbId}`, row);
    }
    return _upsert('gps_sims', [row]);
  }

  async function deleteSim(sbId) {
    return _patch('gps_sims', `id=eq.${sbId}`, {
      activa:     false,
      updated_at: new Date().toISOString()
    });
  }

  // ── Unidades (gps_unidades) ──────────────────────────────────────────────

  async function upsertUnidad(num, emp, datos) {
    return _upsert('gps_unidades', [{
      num_economico: String(num),
      empresa_id:    emp,
      ...datos,
      updated_at:    new Date().toISOString()
    }], 'empresa_id,num_economico');
  }

  // ── Notas de unidad (gps_notas) ──────────────────────────────────────────

  async function saveNota(num, emp, nota, usuario) {
    // gps_notas tiene un registro por unidad; hacer upsert
    try {
      const existing = await _getRaw(
        'gps_notas',
        `empresa_id=eq.${encodeURIComponent(emp)}&num_economico=eq.${encodeURIComponent(num)}`
      );
      if (existing && existing.length > 0) {
        return _patch(
          'gps_notas',
          `empresa_id=eq.${encodeURIComponent(emp)}&num_economico=eq.${encodeURIComponent(num)}`,
          { nota, updated_by: usuario || 'sistema', updated_at: new Date().toISOString() }
        );
      }
      return _upsert('gps_notas', [{
        empresa_id:    emp,
        num_economico: String(num),
        nota,
        updated_by:    usuario || 'sistema',
        updated_at:    new Date().toISOString()
      }]);
    } catch(e) {
      console.warn('[GPS_SB.saveNota]', e.message);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  return {
    // Primitivas (usadas por db.js initFromSupabase)
    _getRaw,
    _delete,
    _upsert,
    _patch,
    // Empresa
    setEmpresaActiva,
    // Asignaciones
    saveAsignacion,
    // Barridos
    saveBarrido,
    // Fallas
    registrarFalla,
    resolverFalla,
    eliminarFallaDB,
    getFallasActivas,
    // Observaciones/Notas
    patchObservacionesBarrido,
    patchNotasBarrido,
    saveNota,
    // SIMs
    saveSim,
    deleteSim,
    // Unidades
    upsertUnidad
  };
})();

// Exponer globalmente para que db.js y app.js puedan usar window.GPS_SB
window.GPS_SB = GPS_SB;
