/**
 * gps-db.js — Módulo Supabase para Mesa de Control GPS
 * v4.3 — Fix: deduplicar registros antes de upsert (ON CONFLICT row second time)
 */
const GPS_SB = (() => {
  const BASE_URL = 'https://sxzhmcrpeyuqslupttby.supabase.co';
  const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4emhtY3JwZXl1cXNsdXB0dGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MjQ5MDgsImV4cCI6MjA5MzAwMDkwOH0.-muAjBKc2PekqbgRltLVBnUCdxfQlHNxmVruXrw_sl8';

  const HEADERS = {
    'apikey':        ANON_KEY,
    'Authorization': 'Bearer ' + ANON_KEY,
    'Content-Type':  'application/json'
  };

  async function _getRaw(table, query) {
    const res = await fetch(`${BASE_URL}/rest/v1/${table}?${query}`, {
      headers: { ...HEADERS, 'Range': '0-9999', 'Prefer': 'return=representation' }
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
      headers: { ...HEADERS, 'Prefer': 'return=minimal' }
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`[GPS_SB._delete] ${table} ${res.status}: ${body}`);
    }
    return res.json().catch(() => null);
  }

  async function _upsert(table, rows, onConflict) {
    const qs = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : '';
    const res = await fetch(`${BASE_URL}/rest/v1/${table}${qs}`, {
      method:  'POST',
      headers: {
        ...HEADERS,
        'Prefer': onConflict
          ? 'resolution=merge-duplicates,return=minimal'
          : 'return=representation'
      },
      body: JSON.stringify(rows)
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
      headers: { ...HEADERS, 'Prefer': 'return=minimal' },
      body:    JSON.stringify(data)
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`[GPS_SB._patch] ${table} ${res.status}: ${body}`);
    }
    return res.json().catch(() => null);
  }

  async function setEmpresaActiva(emp) {
    try {
      return await _patch('gps_config', 'id=eq.singleton', {
        empresa_activa: emp,
        updated_at: new Date().toISOString()
      });
    } catch(e) {
      console.warn('[GPS_SB.setEmpresaActiva]', e.message);
    }
  }

  async function saveAsignacion(mesLabel, filas, emp) {
    const BATCH = 200;
    const rows = filas
      .map(f => ({
        empresa_id:    emp,
        mes_label:     mesLabel,
        num_economico: String(f.num || f.numEco || '').trim(),
        base:          f.base      || null,
        cromatica:     f.cromatica || null,
        modelo:        f.modelo    || null,
        estatus:       f.estatus   || f.estatusInforme || null,
        rol:           f.rol       || null,
        datos_extra:   { ...f },
        activa:        true,
        created_at:    new Date().toISOString()
      }))
      .filter(r => r.num_economico);

    await _delete(
      'gps_asignaciones',
      `empresa_id=eq.${encodeURIComponent(emp)}&mes_label=eq.${encodeURIComponent(mesLabel)}`
    ).catch(() => {});

    for (let i = 0; i < rows.length; i += BATCH) {
      await _upsert('gps_asignaciones', rows.slice(i, i + BATCH));
    }
    console.log(`[GPS_SB.saveAsignacion] OK — ${emp} ${mesLabel}: ${rows.length} filas`);
    return { total: rows.length };
  }

  async function saveBarrido(plataforma, registros, emp) {
    if (!emp || !emp.trim()) {
      console.error('[GPS_SB.saveBarrido] empresa vacía — abortando');
      return { total: 0 };
    }

    const BATCH = 150;

    const toISOSafe = fecha => {
      if (!fecha) return null;
      try {
        const d = fecha instanceof Date ? fecha : new Date(fecha);
        return isNaN(d) ? null : d.toISOString();
      } catch { return null; }
    };

    const buildRaw = r => {
      const raw = {};
      if (r.serie)         raw.serie = r.serie;
      if (r.estadoSamsara) raw.estadoSamsara = r.estadoSamsara;
      if (r.estado)        raw.estado = r.estado;
      if (r.serieGateway)  raw.serieGateway = r.serieGateway;
      if (r.serieDashcam)  raw.serieDashcam = r.serieDashcam;
      if (r.empresa)       raw.empresa = r.empresa;
      return raw;
    };

    // Construir filas
    const rawRows = registros
      .map(r => ({
        empresa_id:      emp,
        plataforma:      plataforma,
        num_economico:   String(r.num || '').trim(),
        ultima_conexion: (() => {
          const iso = toISOSafe(r.fecha);
          return iso ? iso.replace('T', ' ').slice(0, 19) : null;
        })(),
        tiene_datos: !!r.fecha,
        datos_raw:   buildRaw(r),
        activa:      true,
        cargado_at:  new Date().toISOString()
      }))
      .filter(r => r.num_economico);

    if (!rawRows.length) {
      console.warn(`[GPS_SB.saveBarrido] 0 filas válidas para ${plataforma}/${emp}`);
      return { total: 0 };
    }

    // ── DEDUPLICAR por (empresa_id, plataforma, num_economico) ───────────
    // Si el archivo tiene la misma unidad dos veces, Supabase falla con
    // "ON CONFLICT DO UPDATE command cannot affect row a second time"
    // Solución: conservar solo la fila con fecha más reciente por num_economico
    const deduped = Object.values(
      rawRows.reduce((map, row) => {
        const key = `${row.empresa_id}|${row.plataforma}|${row.num_economico}`;
        const prev = map[key];
        if (!prev) {
          map[key] = row;
        } else {
          // Conservar la fila con ultima_conexion más reciente
          const prevDate = prev.ultima_conexion ? new Date(prev.ultima_conexion) : new Date(0);
          const curDate  = row.ultima_conexion  ? new Date(row.ultima_conexion)  : new Date(0);
          if (curDate > prevDate) map[key] = row;
        }
        return map;
      }, {})
    );

    const duplicados = rawRows.length - deduped.length;
    if (duplicados > 0) {
      console.warn(`[GPS_SB.saveBarrido] ${duplicados} duplicados eliminados en ${plataforma}/${emp}`);
    }

    let enviados = 0;
    for (let i = 0; i < deduped.length; i += BATCH) {
      const batch = deduped.slice(i, i + BATCH);
      try {
        await _upsert('gps_barridos', batch, 'empresa_id,plataforma,num_economico');
        enviados += batch.length;
        console.log(`[GPS_SB.saveBarrido] ${plataforma}/${emp} batch ${Math.floor(i/BATCH)+1}: ${batch.length} OK (${enviados}/${deduped.length})`);
      } catch(e) {
        console.error(`[GPS_SB.saveBarrido] ERROR ${plataforma}/${emp} batch ${Math.floor(i/BATCH)+1}:`, e.message);
        throw e;
      }
    }

    return { total: deduped.length };
  }

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
    return _getRaw('gps_fallas',
      `empresa_id=eq.${encodeURIComponent(emp)}&activa=eq.true`
    );
  }

  async function patchObservacionesBarrido(num, emp, obs) {
    try {
      await _patch('gps_barridos',
        `empresa_id=eq.${encodeURIComponent(emp)}&num_economico=eq.${encodeURIComponent(num)}`,
        { observaciones: obs, updated_at: new Date().toISOString() }
      );
    } catch(e) { console.warn('[GPS_SB.patchObservaciones]', e.message); }
  }

  async function patchNotasBarrido(num, emp, notas) {
    try {
      await _patch('gps_barridos',
        `empresa_id=eq.${encodeURIComponent(emp)}&num_economico=eq.${encodeURIComponent(num)}`,
        { notas, updated_at: new Date().toISOString() }
      );
    } catch(e) { console.warn('[GPS_SB.patchNotas]', e.message); }
  }

  async function saveSim(simData, emp) {
    const row = {
      empresa_id:     emp,
      num_economico:  simData.unidad     || null,
      iccid:          simData.iccid      || null,
      operadora:      simData.operadora  || null,
      estado:         simData.estado     || 'SIN_ASIGNAR',
      base:           simData.base       || null,
      cromatica:      simData.cromatica  || null,
      equipo_dvr:     simData.equipoDvr  || null,
      observaciones:  simData.observaciones || null,
      movimiento:     simData.movimiento || null,
      destino_retiro: simData.destino_retiro || null,
      gb:             simData.gb         || null,
      activa:         true,
      updated_at:     new Date().toISOString()
    };
    if (simData._sbId) return _patch('gps_sims', `id=eq.${simData._sbId}`, row);
    return _upsert('gps_sims', [row]);
  }

  async function deleteSim(sbId) {
    return _patch('gps_sims', `id=eq.${sbId}`, {
      activa:     false,
      updated_at: new Date().toISOString()
    });
  }

  async function upsertUnidad(num, emp, datos) {
    return _upsert('gps_unidades', [{
      num_economico: String(num),
      empresa_id:    emp,
      ...datos,
      updated_at:    new Date().toISOString()
    }], 'empresa_id,num_economico');
  }

  async function saveNota(num, emp, nota, usuario) {
    try {
      const existing = await _getRaw('gps_notas',
        `empresa_id=eq.${encodeURIComponent(emp)}&num_economico=eq.${encodeURIComponent(num)}`
      );
      if (existing && existing.length > 0) {
        return _patch('gps_notas',
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
    } catch(e) { console.warn('[GPS_SB.saveNota]', e.message); }
  }

  return {
    _getRaw, _delete, _upsert, _patch,
    setEmpresaActiva,
    saveAsignacion,
    saveBarrido,
    registrarFalla, resolverFalla, eliminarFallaDB, getFallasActivas,
    patchObservacionesBarrido, patchNotasBarrido, saveNota,
    saveSim, deleteSim,
    upsertUnidad
  };
})();

window.GPS_SB = GPS_SB;
