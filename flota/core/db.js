/**
 * db.js v4 — Base de datos localStorage — Mesa de Control GPS
 */
const DB = (() => {
  const KEY = 'mc_v4';

  const schema = () => ({
    version: 4,
    empresaActiva: 'ETN',
    empresas: {
      ETN:        { nombre:'ETN',        color:'#3b82f6' },
      AERS:       { nombre:'AERS',       color:'#10b981' },
      GHO:        { nombre:'GHO',        color:'#8b5cf6' },
      AMEALCENSEN:{ nombre:'AMEALCENSEN',color:'#f59e0b' },
      SAME:       { nombre:'SAME',       color:'#ef4444' }
    },
    unidades: {},
    barridos: {},
    asignaciones: {},
    viajes: {},
    sims: {},
    historialGlobal: [],
    catalogos: {
      bases: ['MTY','LEON','ACAY','TAPA','QUER','SAT','MEXP','MEST','TOAC','MVTU','ODLJ','PUEB'],
      cromaticas: ['ETN','Turistar','Turismo','Migración (INM)','ETNC','Unidades en Renta']
    },
    config: { diasLinea: 1, diasAtencion: 4 },
    fallaStats: {}    // { [emp]: { [etiqueta]: { activos:N, totalHistorico:N } } }
  });

  let _s;
  function _load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return schema();
      const d = JSON.parse(raw);
      if (!d.version || d.version < 4) return schema();
      // Recuperación: si empresas está vacío o corrupto, restaurar desde schema
      if (!d.empresas || Object.keys(d.empresas).length === 0) {
        d.empresas = schema().empresas;
        d.empresaActiva = d.empresaActiva || 'ETN';
      }
      // Recuperación: si empresaActiva está vacía o no existe en empresas, restaurar
      if (!d.empresaActiva || !d.empresas[d.empresaActiva]) {
        d.empresaActiva = Object.keys(d.empresas)[0] || 'ETN';
      }
      // Migración: limpiar observaciones duplicadas que fueron copiadas desde notas por bug anterior
      if (!d._cleanedObsNotas) {
        Object.values(d.unidades || {}).forEach(empUnits => {
          Object.values(empUnits || {}).forEach(u => {
            if (u.observaciones && u.notas && u.observaciones === u.notas) {
              const fallaActiva = (u.fallas||[]).find(f => !f.resuelta);
              if (!fallaActiva || fallaActiva.motivo !== u.observaciones) {
                u.observaciones = '';
              }
            }
          });
        });
        d._cleanedObsNotas = true;
      }
      // Migración defensiva
      if (!d.catalogos) d.catalogos = schema().catalogos;
      if (!d.catalogos.bases) d.catalogos.bases = schema().catalogos.bases;
      if (!d.catalogos.cromaticas) d.catalogos.cromaticas = schema().catalogos.cromaticas;
      if (!d.viajes) d.viajes = {};
      if (!d.sims) d.sims = {};
      if (!d.fallaStats) d.fallaStats = {};
      // Migración v8
      if (!d._migratedV8) {
        Object.keys(d.unidades || {}).forEach(emp => {
          Object.values(d.unidades[emp] || {}).forEach(u => {
            if (!u.historialFallas) u.historialFallas = [];
            if (u.siniestroCount === undefined) u.siniestroCount = 0;
            if (u.afrCount === undefined) u.afrCount = 0;
            if (u.totalEventosFalla === undefined) u.totalEventosFalla = u.fallaCount || 0;
            (u.fallas || []).filter(f => f.resuelta).forEach(f => {
              const yaEsta = (u.historialFallas||[]).some(h => h.fallaId === f.id);
              if (!yaEsta) {
                u.historialFallas.push({
                  fallaId: f.id,
                  tipo: f.esSiniestro ? 'SINIESTRO' : 'AFR',
                  motivo: f.motivo || '',
                  descripcion: f.descripcion || '',
                  ubicacion: f.ubicacion || '',
                  fechaInicio: f.fechaOcurrencia || f.fecha,
                  fechaLiberacion: f.fechaResolucion || new Date().toISOString(),
                  motivoLiberacion: f.motivoResolucion || '',
                  tiempoEnFallaMs: f.fechaResolucion
                    ? new Date(f.fechaResolucion) - new Date(f.fechaOcurrencia || f.fecha)
                    : 0
                });
              }
            });
          });
        });
        d._migratedV8 = true;
      }
      // Migración v7
      if (!d._migratedV7) {
        Object.keys(d.unidades || {}).forEach(emp => {
          Object.values(d.unidades[emp] || {}).forEach(u => {
            if (u.ultima_act_ceiba && !u.dvr_ceiba && u.serie) {
              const s = String(u.serie).trim().toUpperCase();
              if (/^[0-9A-F]{9,12}$/.test(s) && !/^[0-9]+$/.test(s)) u.dvr_ceiba = u.serie;
            }
            if (u.ultima_act_samsara && !u.vin_samsara && u.serie) {
              const s = String(u.serie).trim().toUpperCase();
              if (/^G[A-Z0-9]{3}[-_]?[A-Z0-9]{3,5}[-_]?[A-Z0-9]{3,5}/.test(s)) u.vin_samsara = u.serie;
            }
            if (u.ultima_act_man && !u.placa_man && u.serie) {
              const s = String(u.serie).trim().toUpperCase();
              if (/^[A-HJ-NPR-Z0-9]{15,17}$/.test(s)) u.placa_man = u.serie;
            }
          });
        });
        d._migratedV7 = true;
      }
      return d;
    } catch(e) { return schema(); }
  }
  _s = _load();

  // ── Carga inicial desde Supabase ──────────────────────────────────────────
  async function initFromSupabase() {
    if (!window.GPS_SB) return;
    try {
      if (!_s.empresas || Object.keys(_s.empresas).length === 0) {
        _s.empresas = {
          ETN:  { nombre:'ETN',  color:'#3b82f6' },
          GHO:  { nombre:'GHO',  color:'#8b5cf6' },
          AERS: { nombre:'AERS', color:'#10b981' },
          SAME: { nombre:'SAME', color:'#ef4444' }
        };
      }
      const empresas = Object.keys(_s.empresas);
      for (const emp of empresas) {
        // ── 1. Asignaciones ───────────────────────────────────────────────
        const asigRows = await GPS_SB._getRaw('gps_asignaciones',
          `empresa_id=eq.${encodeURIComponent(emp)}&activa=eq.true&order=mes_label.desc,num_economico`
        );
        // Siempre inicializar unidades para esta empresa — incluso si no hay asignaciones
        // (GHO puede tener solo barridos sin asignación subida aún)
        if (!_s.unidades) _s.unidades = {};
        if (!_s.unidades[emp]) _s.unidades[emp] = {};
        if (asigRows && asigRows.length > 0) {
          const meses = {};
          asigRows.forEach(r => {
            if (!meses[r.mes_label]) meses[r.mes_label] = [];
            meses[r.mes_label].push(r);
          });
          const mesReciente = Object.keys(meses).sort().reverse()[0];
          const filas = meses[mesReciente];
          // NO limpiar _s.unidades[emp] aquí — construir nuevo objeto y asignar al final
          // Esto evita que el usuario vea 0 mientras Supabase carga
          const _nuevasUnidades = {};

          filas.forEach(r => {
            const extra = r.datos_extra || {};
            const num = String(r.num_economico);
            _nuevasUnidades[num] = {
              num,
              economico:    extra.economico || num,
              cromatica:    r.cromatica || extra.cromatica || '',
              estatus:      r.estatus   || extra.estatus   || '',
              modelo:       r.modelo    || extra.modelo    || '',
              rol:          r.rol       || extra.rol       || '',
              base:         r.base      || extra.base      || '',
              empresa_asig: extra.empresa || emp,
              serie:        extra.serie   || '',
              motor:        extra.motor   || '',
              placa:        extra.placa   || '',
              asientos:     extra.asientos || '',
              observaciones:extra.observaciones || '',
              notas:        extra.notas             || '',
              mes:          r.mes_label,
              activa:       true,
              fallas:       [],
              historialFallas: [],
              historial:    [],
              siniestro:    false,
              siniestroDesc:'',
              fallaCount:   0,
              _fuente:      'supabase_asignacion'
            };
          });

          // Asignación atómica: reemplazar solo cuando todo está listo
          _s.unidades[emp] = _nuevasUnidades;
          if (!_s.asignaciones) _s.asignaciones = {};
          if (!_s.asignaciones[emp]) _s.asignaciones[emp] = [];
          if (_s.asignaciones[emp].length === 0) {
            _s.asignaciones[emp] = [{ id: Date.now(), mes: mesReciente, fecha: new Date().toISOString(), empresa: emp, total: filas.length, creadas: filas.length, actualizadas: 0, inactivadas: 0 }];
          }
        }

        // ── 3. Fallas activas ─────────────────────────────────────────────
        const fallaRows = await GPS_SB._getRaw('gps_fallas',
          `empresa_id=eq.${encodeURIComponent(emp)}&activa=eq.true`
        );
        if (fallaRows && fallaRows.length > 0) {
          fallaRows.forEach(r => {
            const num = String(r.num_economico);
            let u = (_s.unidades[emp] || {})[num];
            if (!u) {
              if (!_s.unidades[emp]) _s.unidades[emp] = {};
              _s.unidades[emp][num] = {
                num, activa: true, fallas: [], historialFallas: [], historial: [],
                siniestro: false, siniestroDesc: '', fallaCount: 0,
                base: '', cromatica: '', estatus: '', modelo: '', rol: '',
                empresa_asig: emp, _fuente: 'supabase_falla'
              };
              u = _s.unidades[emp][num];
            }
            u.fallas = u.fallas || [];
            const existe = u.fallas.find(f => f._sbId === r.id);
            const esSiniestroRow = r.tipo === 'SINIESTRO';
            if (!existe) {
              const extra = r.datos_extra || {};
              const falla = {
                id: extra.id || r.id,
                _sbId: r.id,
                motivo: r.etiqueta || extra.motivo || '',
                descripcion: r.descripcion || extra.descripcion || '',
                ubicacion: extra.ubicacion || '',
                esSiniestro: esSiniestroRow,
                resuelta: false,
                fecha: r.created_at,
                fechaOcurrencia: extra.fechaOcurrencia || r.created_at
              };
              u.fallas.push(falla);
              if (esSiniestroRow) { u.siniestro = true; u.siniestroDesc = falla.motivo; }
              u.fallaCount = u.fallas.length;
              // Solo asignar observación desde falla si no es un ID numérico
              const _motFalla = falla.motivo || '';
              if (!u.observaciones && _motFalla && !/^\d{5,}$/.test(_motFalla.trim())) {
                u.observaciones = esSiniestroRow ? ('🚨 ' + _motFalla) : _motFalla;
              }
            } else {
              if (!existe._sbId) existe._sbId = r.id;
              if (esSiniestroRow && !u.siniestro) { u.siniestro = true; u.siniestroDesc = existe.motivo || r.etiqueta || ''; }
              const _motExiste = existe.motivo || r.etiqueta || '';
              if (!u.observaciones && _motExiste && !/^\d{5,}$/.test(_motExiste.trim())) {
                u.observaciones = esSiniestroRow ? ('🚨 ' + _motExiste) : _motExiste;
              }
            }
          });
        }

        // ── 4. Notas de unidades ─────────────────────────────────────────────
        try {
          const notaRows = await GPS_SB._getRaw('gps_notas',
            `empresa_id=eq.${encodeURIComponent(emp)}`
          );
          if (notaRows && notaRows.length > 0) {
            notaRows.forEach(r => {
              if (!r.nota) return;
              const num = String(r.num_economico);
              if (!_s.unidades[emp]) _s.unidades[emp] = {};
              if (!_s.unidades[emp][num]) {
                _s.unidades[emp][num] = {
                  num, activa: true, fallas: [], historial: [],
                  base: '', cromatica: '', estatus: '', modelo: '',
                  empresa_asig: emp, _fuente: 'supabase_nota'
                };
              }
              _s.unidades[emp][num].notas = r.nota;
              // La nota es la fuente de verdad para observaciones — sobreescribe IDs numéricos
              _s.unidades[emp][num].observaciones = r.nota;
              // Limpiar cualquier ID numérico que hubiera quedado en notas anteriores
              if (_s.unidades[emp][num].notas && /^\d{5,}$/.test(String(_s.unidades[emp][num].notas).trim())) {
                _s.unidades[emp][num].notas = r.nota;
              }
            });
          }
        } catch(en) { console.warn('[DB] initFromSupabase notas:', en); }
      }

      // ── PASO 1b: Merge gps_unidades — ediciones manuales / captura individual ──
      // gps_unidades almacena unidades creadas/editadas manualmente (una por una).
      // Sus campos sobrescriben lo que vino de gps_asignaciones si son más recientes.
      try {
        for (const emp of empresas) {
          const uRows = await GPS_SB._getRaw('gps_unidades',
            `empresa_id=eq.${encodeURIComponent(emp)}&order=num_economico`
          );
          if (!uRows || !uRows.length) continue;
          if (!_s.unidades[emp]) _s.unidades[emp] = {};
          uRows.forEach(r => {
            const num = String(r.num_economico);
            const existing = _s.unidades[emp][num];
            if (existing) {
              // Unidad ya existe (viene de asignación masiva) — aplicar solo los campos
              // que tienen valor en gps_unidades (edición manual tiene prioridad)
              if (r.base)          existing.base          = r.base;
              if (r.cromatica)     existing.cromatica     = r.cromatica;
              if (r.modelo)        existing.modelo        = r.modelo;
              if (r.estatus)       existing.estatus       = r.estatus;
              if (r.rol)           existing.rol           = r.rol;
              if (r.placa)         existing.placa         = r.placa;
              if (r.serie_vin)     existing.serie         = r.serie_vin;
              if (r.motor)         existing.motor         = r.motor;
              if (r.asientos)      existing.asientos      = r.asientos;
              if (r.mes_asig)      existing.mes           = r.mes_asig;
              if (r.observaciones) existing.observaciones = r.observaciones;
              if (r.notas)         existing.notas         = r.notas;
              existing._fuente = 'supabase_merged';
            } else {
              // Unidad nueva — no viene de asignación masiva, fue creada manualmente
              _s.unidades[emp][num] = {
                num,
                economico:     num,
                base:          r.base          || '',
                cromatica:     r.cromatica     || '',
                modelo:        r.modelo        || '',
                estatus:       r.estatus       || '',
                rol:           r.rol           || '',
                placa:         r.placa         || '',
                serie:         r.serie_vin     || '',
                motor:         r.motor         || '',
                asientos:      r.asientos      || '',
                mes:           r.mes_asig      || '',
                observaciones: r.observaciones || '',
                notas:         r.notas         || '',
                empresa_asig:  emp,
                activa:        r.activa !== false,
                fallas: [], historialFallas: [], historial: [],
                siniestro: false, siniestroDesc: '', fallaCount: 0,
                _fuente: 'supabase_unidades'
              };
            }
          });
        }
      } catch(eu) { console.warn('[DB] initFromSupabase gps_unidades merge:', eu); }

      // ── PASO 2: Barridos GPS — Supabase es fuente de verdad ──────────────
      // Carga Supabase primero, luego limpia solo las plataformas que vienen de Supabase.
      // El usuario ve datos del localStorage durante la carga, no 0.
      try {
        // Cargar barridos POR EMPRESA para evitar que el paginado corte registros
        // (ETN ~1570 filas + GHO ~1690 filas = 3259 total, supera el pageSize de 1000)
        const barridoRows = [];
        for (const _empB of empresas) {
          try {
            const _rows = await GPS_SB._getRaw('gps_barridos',
              `activa=eq.true&empresa_id=eq.${encodeURIComponent(_empB)}`
            );
            if (_rows && _rows.length) barridoRows.push(..._rows);
          } catch(eB) { console.warn('[DB] barridos empresa', _empB, eB.message); }
        }
        // Registrar qué plataformas tiene Supabase y limpiarlas antes de aplicar
        const _sbPlats = {}; // { ETN: Set(['ceiba','samsara',...]) }
        const _ALL_P = ['ceiba','samsara','avl','scania','man','volvo','motive'];
        if (barridoRows && barridoRows.length > 0) {
          barridoRows.forEach(r => {
            const _eR = String(r.empresa_id || ''), _pR = (r.plataforma||'').toLowerCase();
            if (_eR && _pR) { if (!_sbPlats[_eR]) _sbPlats[_eR] = new Set(); _sbPlats[_eR].add(_pR); }
          });
        }
        // SIEMPRE limpiar las plataformas de Supabase antes de aplicar
        Object.keys(_s.empresas || {}).forEach(_eR => {
          if (!_s.unidades[_eR]) return;
          Object.values(_s.unidades[_eR]).forEach(u => {
            const _platsASB = _sbPlats[_eR] || new Set();
            const _platsAClear = _platsASB.size > 0 ? _platsASB : new Set(_ALL_P);
            _platsAClear.forEach(p => { delete u['ultima_act_' + p]; });
            let _maxF = null;
            _ALL_P.forEach(pp => { const f = u['ultima_act_'+pp]; if (f && (!_maxF || new Date(f)>new Date(_maxF))) _maxF=f; });
            u.ultima_act = _maxF;
          });
        });
        if (barridoRows && barridoRows.length > 0) {
          const idFieldByPlat = { CEIBA:'dvr_ceiba', SAMSARA:'vin_samsara', MAN:'placa_man', SCANIA:'placa_scania' };
          barridoRows.forEach(r => {
            const num = String(r.num_economico);
            const empR = String(r.empresa_id || '');
            const plat = (r.plataforma || '').toUpperCase();
            const platKey = 'ultima_act_' + plat.toLowerCase();
            const raw = r.datos_raw || {};

            if (!empR || !_s.empresas[empR]) return;
            if (!_s.unidades[empR]) _s.unidades[empR] = {};
            let u = _s.unidades[empR][num];
            if (!u) {
              const rawDatos = r.datos_raw || {};
              u = {
                num, economico: num,
                cromatica: rawDatos.cromatica || '', estatus: rawDatos.estatus || '',
                modelo: rawDatos.modelo || '', rol: '', base: rawDatos.base || '',
                empresa_asig: empR, activa: true,
                fallas: [], historialFallas: [], historial: [],
                siniestro: false, siniestroDesc: '', fallaCount: 0,
                _soloBarrido: true, _fuente: 'supabase_barrido'
              };
              _s.unidades[empR][num] = u;
            }

            const fechaStr = r.ultima_conexion || null;
            if (fechaStr) {
              if (!u[platKey] || new Date(fechaStr) > new Date(u[platKey])) u[platKey] = fechaStr;
              if (!u.ultima_act || new Date(fechaStr) > new Date(u.ultima_act)) u.ultima_act = fechaStr;
            } else if (r.tiene_datos === false || r.ultima_conexion === null) {
              delete u[platKey];
              const PLATS2 = ['ceiba','samsara','avl','scania','man','volvo','motive'];
              let maxF = null;
              PLATS2.forEach(pp => {
                const f2 = u['ultima_act_' + pp];
                if (f2 && (!maxF || new Date(f2) > new Date(maxF))) maxF = f2;
              });
              u.ultima_act = maxF;
            }
            const idField = idFieldByPlat[plat];
            if (idField && raw.serie && !u[idField]) u[idField] = raw.serie;
            const obsBarrido = r.observaciones || null;
            if (obsBarrido && !u.observaciones) u.observaciones = obsBarrido;
            if (r.notas) u.notas = r.notas;
            const desKey = 'desinstalacion_' + plat.toLowerCase();
            if (r.desinstalado) {
              u[desKey] = {
                fecha:      r.desinstalacion_fecha      || null,
                comentario: r.desinstalacion_comentario || '',
                ts:         r.desinstalacion_ts         || null
              };
            } else if (u[desKey]) { delete u[desKey]; }
            if (plat === 'SAMSARA') { if (raw.estadoSamsara) u.estado_samsara = raw.estadoSamsara; else if (r.datos_raw?.estadoSamsara) u.estado_samsara = r.datos_raw.estadoSamsara; }
            if (plat === 'MOTIVE') {
              if (raw.serieGateway) u.motive_vg = raw.serieGateway;
              if (raw.serieDashcam) u.motive_cam = raw.serieDashcam;
              if (raw.estado) u.estado_motive = raw.estado;
              if (raw.empresa) u.empresa_motive = raw.empresa;
              u._motiveRaw = raw;
            }
          });
        }
      } catch(eb) { console.warn('[DB] initFromSupabase barridos:', eb); }

      save();
      console.log('[DB] initFromSupabase: carga completa');
      // Migración: limpiar nombres de personas de observaciones GHO
      try { _limpiarNombrePersonas(); } catch(em) {}
      return true;
    } catch(e) {
      console.warn('[DB] initFromSupabase error:', e);
      return false;
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(_s));
      if (typeof GPS_SB !== 'undefined') {
        GPS_SB.setEmpresaActiva(_s.empresaActiva).catch(()=>{});
      }
      return true;
    }
    catch(e) { console.error('DB save error', e); return false; }
  }

  /* ─── EMPRESA ────────────────────────────────────────── */
  function getUltimaActualizacion() { return _s._ultimaActualizacion || null; }
  function _marcarActualizacion() { _s._ultimaActualizacion = new Date().toISOString(); save(); }
  function getEmpresaActiva() { return _s.empresaActiva; }
  function setEmpresaActiva(k) { _s.empresaActiva = k; save(); }
  function getEmpresas() { return _s.empresas; }
  function _toLocalStr(d) {
    if (!d) return null;
    if (typeof d === 'string') return d;
    if (!(d instanceof Date) || isNaN(d)) return null;
    const p = n => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  // ── Migración única: limpiar nombres de personas de observaciones GHO ──────
  // Solo corre si no se ha ejecutado antes. Borra notas/obs que sean solo un nombre
  // de persona (1 palabra, solo letras, no técnica). Preserva: GPS MAL, SIM BAJA, etc.
  function _limpiarNombrePersonas() {
    const _migKey = 'mainx_migr_obs_nombres_v1';
    if (localStorage.getItem(_migKey)) return; // ya corrió
    const TECNICOS = new Set([
      'afr','gps','sim','dvr','baja','mal','revisar','siniestro','taller',
      'remodelacion','energia','motor','carroceria','pintura','alineacion',
      'candado','juridico','venta','fuera','inactivo','pendiente','corralon',
      'datos','señal','antena','bateria','camara','equipo','wifi','conexion',
      'retarder','daño','falla','problema','reporte','espera','salida','viajes',
      'local','bloqueada','slot','dañado','quemado','imagen','transmision',
      'accidente','colision','mecanica','electrica','fusible','corto'
    ]);
    const _esNombrePersona = (v) => {
      if (!v) return false;
      const s = String(v).trim();
      // Solo una palabra de 3-12 letras, sin números ni caracteres especiales
      if (!/^[A-ZÁÉÍÓÚÜÑ]{3,12}$/i.test(s)) return false;
      // No es término técnico
      return !TECNICOS.has(s.toLowerCase());
    };
    // Aplicar solo a GHO
    if (_s.unidades && _s.unidades['GHO']) {
      Object.values(_s.unidades['GHO']).forEach(u => {
        if (u.observaciones && _esNombrePersona(u.observaciones)) {
          console.log(`[Migración] Borrando nombre "${u.observaciones}" de obs unidad ${u.num}`);
          u.observaciones = '';
        }
        if (u.notas && _esNombrePersona(u.notas)) {
          console.log(`[Migración] Borrando nombre "${u.notas}" de notas unidad ${u.num}`);
          u.notas = '';
        }
      });
      save();
    }
    localStorage.setItem(_migKey, '1');
  }

  function getEmpresasList() { return Object.keys(_s.empresas); }

  function addEmpresa(nombre, color) {
    const k = nombre.trim().toUpperCase().replace(/\s+/g,'_');
    if (!_s.empresas[k]) _s.empresas[k] = { nombre: nombre.trim().toUpperCase(), color: color || '#6b7280' };
    save(); return k;
  }

  function removeEmpresa(k) {
    if (Object.keys(_s.empresas).length <= 1) return false;
    delete _s.empresas[k]; delete _s.unidades[k];
    delete _s.barridos[k]; delete _s.asignaciones[k];
    if (_s.empresaActiva === k) _s.empresaActiva = Object.keys(_s.empresas)[0];
    save(); return true;
  }

  /* ─── UNIDADES ───────────────────────────────────────── */
  function _empU(emp) {
    emp = emp || _s.empresaActiva;
    if (!_s.unidades[emp]) _s.unidades[emp] = {};
    return _s.unidades[emp];
  }

  function getUnidades(emp) { return _empU(emp); }
  function getUnidadesList(emp) { return Object.values(_empU(emp)); }
  function getUnidad(num, emp) { return _empU(emp)[String(num)] || null; }

  function upsertUnidad(num, datos, emp) {
    emp = emp || _s.empresaActiva;
    const store = _empU(emp);
    const k = String(num);
    const now = new Date().toISOString();

    if (store[k]) {
      const cambios = {};
      const tracked = ['base','cromatica','modelo','estatus','economico','rol','placa','empresa_asig'];
      tracked.forEach(f => {
        if (datos[f] !== undefined && datos[f] !== '' && datos[f] !== null && store[k][f] !== datos[f]) {
          cambios[f] = { de: store[k][f], a: datos[f] };
        }
      });
      if (Object.keys(cambios).length > 0) {
        store[k].historial = store[k].historial || [];
        store[k].historial.push({ fecha: now, tipo: 'actualizacion', cambios });
      }
      Object.keys(datos).forEach(f => {
        if (datos[f] !== undefined) {
          if (f.startsWith('ultima_act_') || f === 'ultima_act') {
            if (datos[f] === null) { delete store[k][f]; }
            else if (datos[f]) store[k][f] = datos[f];
          } else if (f.startsWith('desinstalacion_')) {
            if (datos[f] === null) { delete store[k][f]; } else { store[k][f] = datos[f]; }
          } else if (f === 'siniestro' || f === 'fallas') {
            if (datos[f]) store[k][f] = datos[f];
          } else if (f === 'notas') {
            store[k][f] = datos[f];
          } else if (datos[f] !== null && datos[f] !== '') {
            store[k][f] = datos[f];
          }
        }
      });
      store[k].updatedAt = now;
    } else {
      store[k] = {
        num: k, empresa: emp,
        base:'', cromatica:'', modelo:'', estatus:'', economico:'',
        observaciones:'', rol:'', placa:'', serie:'', asientos:'',
        motor:'', empresa_asig:'', mes:'', notas:'',
        plataforma:'', ultima_act: null,
        siniestro: false, siniestroDesc: '',
        activa: true, fallaCount: 0, fallas: [],
        historialFallas: [],
        siniestroCount: 0,
        afrCount: 0,
        totalEventosFalla: 0,
        historial: [], ausenciasContadas: 0,
        createdAt: now, updatedAt: now,
        ...datos
      };
      store[k].historial.push({ fecha: now, tipo: 'creacion', fuente: datos._fuente || 'manual' });
    }
    delete store[k]._fuente;
    save();

    if (window.GPS_SB && datos.observaciones !== undefined) {
      GPS_SB.patchObservacionesBarrido(k, emp, datos.observaciones || null).catch(() => {});
    }

    return store[k];
  }

  function marcarInactiva(num, emp) {
    const u = getUnidad(num, emp);
    if (!u) return;
    u.activa = false;
    u.ausenciasContadas = (u.ausenciasContadas || 0) + 1;
    u.historial = u.historial || [];
    u.historial.push({ fecha: new Date().toISOString(), tipo: 'inactivacion', ausencias: u.ausenciasContadas });
    u.updatedAt = new Date().toISOString();
    save();
  }

  function reactivarUnidad(num, emp) {
    const u = getUnidad(num, emp);
    if (!u) return;
    u.activa = true;
    u.ausenciasContadas = 0;
    u.historial.push({ fecha: new Date().toISOString(), tipo: 'reactivacion' });
    u.updatedAt = new Date().toISOString();
    save();
  }

  function eliminarUnidad(num, emp) {
    emp = emp || _s.empresaActiva;
    delete _empU(emp)[String(num)];
    save();
  }

  function registrarFalla(num, emp, fichaFalla) {
    const u = getUnidad(num, emp);
    if (!u) return;
    emp = emp || _s.empresaActiva;

    u.historialFallas = u.historialFallas || [];
    u.siniestroCount  = u.siniestroCount  || 0;
    u.afrCount        = u.afrCount        || 0;
    u.totalEventosFalla = (u.totalEventosFalla || 0) + 1;
    u.fallaCount      = u.totalEventosFalla;
    u.fallas = u.fallas || [];

    const esReincidencia = u.historialFallas.length > 0 || u.fallas.filter(f => f.resuelta).length > 0;

    if (fichaFalla.esSiniestro) u.siniestroCount++;
    else u.afrCount++;

    const falla = {
      id: Date.now(),
      fecha: new Date().toISOString(),
      motivo: fichaFalla.motivo || '',
      ubicacion: fichaFalla.ubicacion || '',
      fechaOcurrencia: fichaFalla.fechaOcurrencia || new Date().toISOString(),
      esSiniestro: fichaFalla.esSiniestro || false,
      descripcion: fichaFalla.descripcion || '',
      resuelta: false,
      fechaResolucion: null,
      motivoResolucion: '',
      esReincidencia,
      numeroEvento: u.totalEventosFalla
    };
    u.fallas.push(falla);
    u.historial = u.historial || [];
    u.historial.push({ fecha: falla.fecha, tipo: 'falla', ...falla });

    if (fichaFalla.esSiniestro) {
      u.siniestro = true;
      u.siniestroDesc = fichaFalla.motivo || fichaFalla.descripcion || 'Siniestro';
      setEtiquetaUnidad(num, emp, 'SINIESTRO', fichaFalla.motivo || '');
    } else {
      setEtiquetaUnidad(num, emp, 'AFR', fichaFalla.motivo || '');
    }

    _incrementarFallaStats(emp, fichaFalla.esSiniestro ? 'SINIESTRO' : 'AFR');
    u.updatedAt = new Date().toISOString();
    save();

    if (window.GPS_SB) {
      GPS_SB.registrarFalla(num, falla, emp || _s.empresaActiva)
        .then(rows => {
          if (rows && rows[0] && rows[0].id) { falla._sbId = rows[0].id; save(); }
        })
        .catch(e => console.warn('[DB] registrarFalla Supabase:', e));
    }

    return falla;
  }

  function resolverFalla(num, emp, fallaId, motivo) {
    const u = getUnidad(num, emp);
    if (!u || !u.fallas) return false;
    emp = emp || _s.empresaActiva;
    const f = u.fallas.find(x => x.id === fallaId || String(x.id) === String(fallaId));
    if (!f) return false;

    const ahora = new Date().toISOString();
    f.resuelta = true;
    f.fechaResolucion = ahora;
    f.motivoResolucion = motivo || '';

    u.historialFallas = u.historialFallas || [];
    u.historialFallas.push({
      fallaId: f.id,
      tipo: f.esSiniestro ? 'SINIESTRO' : 'AFR',
      motivo: f.motivo || '',
      descripcion: f.descripcion || '',
      ubicacion: f.ubicacion || '',
      fechaInicio: f.fechaOcurrencia || f.fecha,
      fechaLiberacion: ahora,
      motivoLiberacion: motivo || '',
      tiempoEnFallaMs: new Date(ahora) - new Date(f.fechaOcurrencia || f.fecha),
      esReincidencia: f.esReincidencia || false,
      numeroEvento: f.numeroEvento || 0
    });

    u.historial = u.historial || [];
    u.historial.push({ fecha: ahora, tipo: 'falla_resuelta', fallaId: f.id, motivo: motivo || '' });

    if (f.esSiniestro) {
      const otrosSinResolver = (u.fallas || []).some(x => x.esSiniestro && !x.resuelta && x.id !== f.id);
      if (!otrosSinResolver) {
        u.siniestro = false; u.siniestroDesc = '';
        removeEtiquetaUnidad(num, emp, 'SINIESTRO');
      }
    } else {
      const otrasAFR = (u.fallas || []).some(x => !x.esSiniestro && !x.resuelta && x.id !== f.id);
      if (!otrasAFR) removeEtiquetaUnidad(num, emp, 'AFR');
    }

    const _fallasRestantes = (u.fallas || []).filter(x => !x.resuelta && x.id !== f.id);
    if (_fallasRestantes.length === 0) {
      u.observaciones = '';
      if (window.GPS_SB) GPS_SB.patchObservacionesBarrido(num, emp, null).catch(() => {});
    } else {
      const _sig = _fallasRestantes[_fallasRestantes.length - 1];
      const _newObs = _sig.esSiniestro ? ('🚨 ' + (_sig.motivo || '')) : (_sig.motivo || '');
      u.observaciones = _newObs;
      if (window.GPS_SB) GPS_SB.patchObservacionesBarrido(num, emp, _newObs).catch(() => {});
    }

    u.etiquetas = u.etiquetas || [];
    u._ultimaLiberacion = ahora;
    _decrementarFallaStats(emp, f.esSiniestro ? 'SINIESTRO' : 'AFR');
    u.updatedAt = ahora;
    save();

    if (window.GPS_SB && f._sbId) {
      GPS_SB.resolverFalla(f._sbId, motivo).catch(e => console.warn('[DB] resolverFalla Supabase:', e));
    }

    return true;
  }

  function eliminarFalla(num, emp, fallaId) {
    const u = getUnidad(num, emp);
    if (!u || !u.fallas) return false;
    const before = u.fallas.length;
    const fallaAEliminar = u.fallas.find(x => x.id === fallaId || String(x.id) === String(fallaId));
    u.fallas = u.fallas.filter(x => x.id !== fallaId && String(x.id) !== String(fallaId));
    if (u.fallas.length === before) return false;
    u.fallaCount = u.fallas.length;
    const haySiniestroActivo = u.fallas.some(f => f.esSiniestro && !f.resuelta);
    if (!haySiniestroActivo) { u.siniestro = false; u.siniestroDesc = ''; }
    u.historial = u.historial || [];
    u.historial.push({ fecha: new Date().toISOString(), tipo: 'falla_eliminada', fallaId });
    u.updatedAt = new Date().toISOString();
    save();

    if (window.GPS_SB && fallaAEliminar && fallaAEliminar._sbId) {
      GPS_SB.eliminarFallaDB(fallaAEliminar._sbId).catch(e => console.warn('[DB] eliminarFalla Supabase:', e));
    }

    return true;
  }

  /* ─── FALLA STATS ── */
  function _initFallaStats(emp) {
    if (!_s.fallaStats) _s.fallaStats = {};
    if (!_s.fallaStats[emp]) _s.fallaStats[emp] = {};
    return _s.fallaStats[emp];
  }
  function _incrementarFallaStats(emp, tipo) {
    const st = _initFallaStats(emp);
    if (!st[tipo]) st[tipo] = { activos: 0, totalHistorico: 0 };
    st[tipo].activos++; st[tipo].totalHistorico++;
    save();
  }
  function _decrementarFallaStats(emp, tipo) {
    const st = _initFallaStats(emp);
    if (!st[tipo]) st[tipo] = { activos: 0, totalHistorico: 0 };
    if (st[tipo].activos > 0) st[tipo].activos--;
    save();
  }

  function getFallasStats(emp) {
    emp = emp || _s.empresaActiva;
    const uns = getUnidadesList(emp);
    const tagStats = {};
    let tiempoTotal = 0, tiempoCount = 0;
    const reincidentes = [], liberadas = [], topProblematicas = [];

    uns.forEach(u => {
      const fallasActivas = (u.fallas || []).filter(f => !f.resuelta);
      const tieneHistorial = (u.historialFallas || []).length > 0;

      fallasActivas.forEach(f => {
        const tipo = f.esSiniestro ? 'SINIESTRO' : 'AFR';
        if (!tagStats[tipo]) tagStats[tipo] = { activos: 0, totalHistorico: 0 };
        tagStats[tipo].activos++;
      });

      (u.historialFallas || []).forEach(h => {
        const tipo = h.tipo || 'AFR';
        if (!tagStats[tipo]) tagStats[tipo] = { activos: 0, totalHistorico: 0 };
        tagStats[tipo].totalHistorico++;
        if (h.tiempoEnFallaMs && h.tiempoEnFallaMs > 0) { tiempoTotal += h.tiempoEnFallaMs; tiempoCount++; }
      });

      if (fallasActivas.length === 0 && tieneHistorial) {
        liberadas.push({ num: u.num, base: u.base, cromatica: u.cromatica, modelo: u.modelo,
          totalEventosFalla: u.totalEventosFalla || 0, siniestroCount: u.siniestroCount || 0,
          afrCount: u.afrCount || 0, ultimaLiberacion: u._ultimaLiberacion || null,
          historialFallas: u.historialFallas || [] });
      }

      const totalEvt = u.totalEventosFalla || 0;
      if (totalEvt > 0) {
        topProblematicas.push({ num: u.num, base: u.base, cromatica: u.cromatica,
          totalEventosFalla: totalEvt, siniestroCount: u.siniestroCount || 0,
          afrCount: u.afrCount || 0, tieneActiva: fallasActivas.length > 0 });
        if (totalEvt > 1) reincidentes.push(u.num);
      }
    });

    topProblematicas.sort((a, b) => b.totalEventosFalla - a.totalEventosFalla);
    liberadas.sort((a, b) => (b.ultimaLiberacion || '') > (a.ultimaLiberacion || '') ? 1 : -1);

    return {
      tagStats,
      topProblematicas: topProblematicas.slice(0, 10),
      liberadas, reincidentes,
      tiempoPromedioFallaMs: tiempoCount > 0 ? Math.round(tiempoTotal / tiempoCount) : 0,
      totalReincidentes: reincidentes.length
    };
  }

  function getCatalogo(tipo) {
    if (!_s.catalogos) _s.catalogos = { bases: [], cromaticas: [] };
    return _s.catalogos[tipo] || [];
  }
  function addCatalogo(tipo, valor) {
    if (!valor) return;
    const v = String(valor).trim();
    if (!v) return;
    if (!_s.catalogos) _s.catalogos = { bases: [], cromaticas: [] };
    if (!_s.catalogos[tipo]) _s.catalogos[tipo] = [];
    if (!_s.catalogos[tipo].some(x => x.toLowerCase() === v.toLowerCase())) {
      _s.catalogos[tipo].push(v); _s.catalogos[tipo].sort(); save();
    }
  }
  function removeCatalogo(tipo, valor) {
    if (!_s.catalogos || !_s.catalogos[tipo]) return;
    _s.catalogos[tipo] = _s.catalogos[tipo].filter(x => x !== valor);
    save();
  }

  /* ─── VIAJES ─────────────────────────────────────────── */
  function _empV(emp) {
    emp = emp || _s.empresaActiva;
    if (!_s.viajes) _s.viajes = {};
    if (!_s.viajes[emp]) _s.viajes[emp] = [];
    return _s.viajes[emp];
  }
  function getViajes(emp) { return _empV(emp).slice(); }
  function saveViaje(viaje, emp) {
    emp = emp || _s.empresaActiva;
    const arr = _empV(emp);
    const v = {
      id: viaje.id || Date.now(), num: viaje.num,
      plataforma: viaje.plataforma || '', salidaLugar: viaje.salidaLugar || '',
      salidaHora: viaje.salidaHora || '', destino: viaje.destino || '',
      llegadaHora: viaje.llegadaHora || '', fechaAtencion: viaje.fechaAtencion || '',
      motivo: viaje.motivo || '', observaciones: viaje.observaciones || '',
      estado: viaje.estado || 'programado',
      creadoEn: viaje.creadoEn || new Date().toISOString(),
      actualizadoEn: new Date().toISOString(), empresa: emp
    };
    const idx = arr.findIndex(x => x.id === v.id);
    if (idx >= 0) arr[idx] = v; else arr.unshift(v);
    _logGlobal('viaje', `Viaje ${v.estado} → Unidad ${v.num} (${v.plataforma || 'sin plataforma'}): ${v.salidaLugar || '—'} → ${v.destino || '—'}`, emp);
    save();
    return v;
  }

  function getViajeActivoDe(num, emp) {
    emp = emp || _s.empresaActiva;
    return _empV(emp).find(v => v.num === String(num) && v.estado !== 'finalizado' && v.estado !== 'cancelado') || null;
  }

  function eliminarViaje(id, emp) {
    emp = emp || _s.empresaActiva;
    const arr = _empV(emp);
    const before = arr.length;
    _s.viajes[emp] = arr.filter(v => v.id !== id && String(v.id) !== String(id));
    if (_s.viajes[emp].length !== before) { save(); return true; }
    return false;
  }

  function setEtiquetaUnidad(num, emp, etiqueta, detalles) {
    const u = getUnidad(num, emp);
    if (!u) return false;
    const et = String(etiqueta || '').toUpperCase().trim();
    if (!et) return false;
    u.etiquetas = u.etiquetas || [];
    const idx = u.etiquetas.findIndex(e => e.tipo === et);
    const tag = { tipo: et, detalles: detalles || '', fecha: new Date().toISOString(), color: _colorEtiqueta(et) };
    if (idx >= 0) u.etiquetas[idx] = tag; else u.etiquetas.push(tag);
    if (et === 'SINIESTRO') u.siniestro = true;
    u.historial = u.historial || [];
    u.historial.push({ fecha: tag.fecha, tipo: 'etiqueta', etiqueta: et, detalles });
    u.updatedAt = new Date().toISOString();
    save();
    return true;
  }

  function removeEtiquetaUnidad(num, emp, etiqueta) {
    const u = getUnidad(num, emp);
    if (!u || !u.etiquetas) return false;
    const et = String(etiqueta).toUpperCase();
    u.etiquetas = u.etiquetas.filter(e => e.tipo !== et);
    if (et === 'SINIESTRO') { u.siniestro = false; u.siniestroDesc = ''; }
    u.historial = u.historial || [];
    u.historial.push({ fecha: new Date().toISOString(), tipo: 'etiqueta_quitada', etiqueta: et });
    u.updatedAt = new Date().toISOString();
    save();
    return true;
  }

  function _colorEtiqueta(et) {
    const map = {
      SINIESTRO:'#ef4444', ALINEACION:'#3b82f6', AFR:'#f59e0b', SIN_SIM:'#8b5cf6',
      TALLER:'#06b6d4', SIN_VIN:'#9ca3af', SIN_DATOS:'#9ca3af',
      EN_LINEA:'#10b981', EN_ALINEACION:'#3b82f6', VENTA:'#8b5cf6'
    };
    return map[et] || '#a78bfa';
  }

  /**
   * registrarBarridoManual — guarda el resultado del procesador manual de texto
   * ✅ FIX: también guarda en Supabase
   */
  function registrarBarridoManual(plataforma, filas, emp) {
    emp = emp || _s.empresaActiva;
    let procesadas = 0, etiquetadas = 0;
    filas.forEach(r => {
      if (!r.num) return;
      const datos = {};
      if (r.fecha) {
        datos['ultima_act_' + plataforma.toLowerCase()] = _toLocalStr(r.fecha);
        const u = getUnidad(r.num, emp);
        if (!u || !u.ultima_act || new Date(r.fecha) > new Date(u.ultima_act)) {
          datos.ultima_act = _toLocalStr(r.fecha);
        }
        datos.plataforma = plataforma;
      }
      if (Object.keys(datos).length) {
        upsertUnidad(r.num, { ...datos, _fuente: 'barrido_manual_' + plataforma }, emp);
        procesadas++;
      }
      if (r.etiqueta) {
        setEtiquetaUnidad(r.num, emp, r.etiqueta, r.detalles || '');
        etiquetadas++;
      }
    });
    _logGlobal('barrido_manual', `Barrido manual ${plataforma}: ${filas.length} filas, ${procesadas} procesadas, ${etiquetadas} etiquetadas`, emp);
    save();
    // GPS_SB.saveBarrido se llama desde ui.js con await
    if (window.GPS_SB) {
      GPS_SB.saveBarrido(plataforma, filas, emp)
        .catch(e => console.warn('[DB.registrarBarridoManual] Supabase error:', e));
    }
    return { procesadas, etiquetadas, total: filas.length };
  }

  function _empB(emp) {
    emp = emp || _s.empresaActiva;
    if (!_s.barridos[emp]) _s.barridos[emp] = [];
    return _s.barridos[emp];
  }

  function getBarridos(emp) { return _empB(emp); }

  function saveBarrido(plataforma, registros, emp) {
    emp = emp || _s.empresaActiva;

    // GPS_SB.saveBarrido lo llama ui.js con await — no duplicar aquí

    const now = new Date().toISOString();
    let actualizadas = 0, noEncontradas = 0, vinActualizados = 0;

    const idFieldByPlat = {
      CEIBA:'dvr_ceiba', SAMSARA:'vin_samsara', MAN:'placa_man', SCANIA:'placa_scania',
      AVL:null, VOLVO:null, MOTIVE:null
    };
    const idField = idFieldByPlat[plataforma];

    registros.forEach(r => {
      if (!r.num) return;
      let empTarget = emp;
      if (!getUnidad(r.num, emp) && r.empresa && r.empresa !== emp) empTarget = r.empresa;
      const u = getUnidad(r.num, empTarget);
      const platKey = 'ultima_act_' + plataforma.toLowerCase();

      if (u) {
        const datos = { plataforma };
        if (r.fecha) {
          datos[platKey] = _toLocalStr(r.fecha);
          if (!u.ultima_act || new Date(r.fecha) > new Date(u.ultima_act)) datos.ultima_act = _toLocalStr(r.fecha);
        }
        if (idField && r.serie) { datos[idField] = r.serie; vinActualizados++; }
        if (plataforma === 'SAMSARA' && r.estadoSamsara) datos.estado_samsara = r.estadoSamsara;
        if (plataforma === 'MOTIVE') {
          if (r.serieGateway) datos.motive_vg = r.serieGateway;
          if (r.serieDashcam) datos.motive_cam = r.serieDashcam;
          if (r.estado)       datos.estado_motive = r.estado;
          if (r.empresa)      datos.empresa_motive = r.empresa;
        }
        upsertUnidad(r.num, { ...datos, _fuente: 'barrido_' + plataforma }, empTarget);
        actualizadas++;
      } else {
        noEncontradas++;
        const extras = { plataforma, activa: true, _fuente: 'barrido_' + plataforma, _soloBarrido: true };
        if (r.fecha) { extras[platKey] = r.fecha; extras.ultima_act = r.fecha; }
        if (idField && r.serie) extras[idField] = r.serie;
        if (plataforma === 'SAMSARA' && r.estadoSamsara) extras.estado_samsara = r.estadoSamsara;
        if (plataforma === 'MOTIVE') {
          if (r.serieGateway) extras.motive_vg = r.serieGateway;
          if (r.serieDashcam) extras.motive_cam = r.serieDashcam;
          if (r.estado)       extras.estado_motive = r.estado;
          if (r.empresa)      extras.empresa_motive = r.empresa;
        }
        upsertUnidad(r.num, extras, empTarget);
      }
    });

    const barrido = {
      id: Date.now(), plataforma, fecha: now, empresa: emp,
      totalRegistros: registros.length, actualizadas, noEncontradas, vinActualizados
    };
    _empB(emp).unshift(barrido);
    if (_s.barridos[emp].length > 100) _s.barridos[emp] = _s.barridos[emp].slice(0, 100);

    _logGlobal('barrido', `Barrido ${plataforma}: ${registros.length} registros → ${actualizadas} unidades act., ${noEncontradas} sin asignación`, emp);
    save();
    return { actualizadas, noEncontradas, vinActualizados, total: registros.length };
  }

  /* ─── ASIGNACIONES ───────────────────────────────────── */
  function _empA(emp) {
    emp = emp || _s.empresaActiva;
    if (!_s.asignaciones[emp]) _s.asignaciones[emp] = [];
    return _s.asignaciones[emp];
  }

  function getAsignaciones(emp) { return _empA(emp); }

  function saveAsignacion(mesLabel, filas, emp, opciones) {
    if (typeof GPS_SB !== 'undefined') {
      GPS_SB.saveAsignacion(mesLabel, filas, emp || _s.empresaActiva).catch(e=>console.warn('[GPS_SB asig]',e));
    }
    emp = emp || _s.empresaActiva;
    opciones = opciones || { marcarInactivas: true };
    const now = new Date().toISOString();
    _marcarActualizacion();

    const numeros = new Set(filas.map(f => String(f.num)));
    let creadas = 0, actualizadas = 0, inactivadas = 0;

    if (opciones.marcarInactivas) {
      Object.keys(_empU(emp)).forEach(k => {
        const u = _empU(emp)[k];
        if (u.activa && !numeros.has(k)) { marcarInactiva(k, emp); inactivadas++; }
      });
    }

    filas.forEach(f => {
      const existe = getUnidad(f.num, emp);
      upsertUnidad(f.num, {
        economico: f.economico || f.num,
        cromatica: Parsers.normalizarCromatica(f.cromatica),
        estatus:   Parsers.normalizarEstatus(f.estatus),
        modelo: f.modelo, rol: f.rol, base: f.base,
        empresa_asig: f.empresa || emp,
        serie: f.serie, motor: f.motor, placa: f.placa,
        asientos: f.asientos, observaciones: f.observaciones,
        mes: mesLabel, activa: true, _fuente: 'asignacion'
      }, emp);
      if (existe) actualizadas++; else creadas++;
    });

    _empA(emp).unshift({ id: Date.now(), mes: mesLabel, fecha: now, empresa: emp,
      total: filas.length, creadas, actualizadas, inactivadas });

    _logGlobal('asignacion', `Asignación "${mesLabel}": ${filas.length} unidades (${creadas} nuevas, ${actualizadas} actualizadas, ${inactivadas} inactivadas)`, emp);
    save();
    return { total: filas.length, creadas, actualizadas, inactivadas };
  }

  /* ─── HISTORIAL / LOG ────────────────────────────────── */
  function _logGlobal(tipo, mensaje, empresa) {
    _s.historialGlobal.unshift({ fecha: new Date().toISOString(), tipo, mensaje, empresa: empresa || _s.empresaActiva });
    if (_s.historialGlobal.length > 500) _s.historialGlobal = _s.historialGlobal.slice(0, 500);
  }

  function addLog(tipo, mensaje, empresa) { _logGlobal(tipo, mensaje, empresa); save(); }
  function getHistorialGlobal(limit, filtro) {
    let hist = _s.historialGlobal;
    if (filtro) {
      if (filtro.tipo) hist = hist.filter(h => h.tipo === filtro.tipo);
      if (filtro.empresa) hist = hist.filter(h => h.empresa === filtro.empresa);
      if (filtro.desde) hist = hist.filter(h => h.fecha >= filtro.desde);
      if (filtro.hasta) hist = hist.filter(h => h.fecha <= filtro.hasta);
      if (filtro.texto) hist = hist.filter(h => h.mensaje.toLowerCase().includes(filtro.texto.toLowerCase()));
    }
    return hist.slice(0, limit || 100);
  }

  /* ─── ESTADÍSTICAS ───────────────────────────────────── */
  function getStats(emp) {
    emp = emp || _s.empresaActiva;
    const cfg = _s.config;
    const todas = Object.values(_empU(emp));
    const activas = todas.filter(u => u.activa);
    const operativas = activas.filter(u => Parsers.categorizarEstatus(u.estatus) !== 'Para venta');
    const paraVenta  = activas.filter(u => Parsers.categorizarEstatus(u.estatus) === 'Para venta');

    const hoy = Date.now();
    let enLinea = 0, atencion = 0, fuera = 0, sinDatos = 0;
    const operativasGPS = operativas.filter(u => !u.siniestro);
    operativasGPS.forEach(u => {
      if (!u.ultima_act) { sinDatos++; return; }
      const d = Math.floor((hoy - new Date(u.ultima_act)) / 86400000);
      if (d <= cfg.diasLinea) enLinea++;
      else if (d <= cfg.diasAtencion) atencion++;
      else fuera++;
    });

    const porBase = {}, porCromatica = {}, porEstatus = {}, porEmpresa = {};
    operativas.forEach(u => {
      if (u.base)      { porBase[u.base]           = (porBase[u.base]||0)+1; }
      if (u.cromatica) { porCromatica[u.cromatica] = (porCromatica[u.cromatica]||0)+1; }
      const sk = Parsers ? Parsers.categorizarEstatus(u.estatus) : (u.estatus||'Sin estatus');
      porEstatus[sk] = (porEstatus[sk]||0)+1;
      const e2 = u.empresa_asig || emp;
      porEmpresa[e2] = (porEmpresa[e2]||0)+1;
    });
    activas.forEach(u => {
      const sk = Parsers.categorizarEstatus(u.estatus);
      if (sk === 'Para venta') porEstatus[sk] = (porEstatus[sk]||0)+1;
    });

    return {
      total: todas.length, activas: activas.length, inactivas: todas.length - activas.length,
      operativas: operativas.length, paraVenta: paraVenta.length,
      enLinea, atencion, fuera, sinDatos,
      sinVIN:    operativas.filter(u=>!u.serie).length,
      sinPlaca:  operativas.filter(u=>!u.placa).length,
      siniestros:operativas.filter(u=>u.siniestro).length,
      fallasActivas: operativas.filter(u => (u.fallas||[]).some(f => !f.resuelta)).length,
      conViaje: operativas.filter(u => getViajeActivoDe(u.num, emp)).length,
      porBase, porCromatica, porEstatus, porEmpresa
    };
  }

  /* ─── REPORTES ───────────────────────────────────────── */
  function getReporte(emp, tipo) {
    emp = emp || _s.empresaActiva;
    const cfg = _s.config;
    const uns = getUnidadesList(emp);
    const activas = uns.filter(u => u.activa);
    const hoy = Date.now();
    const withDias = u => ({ ...u, dias: u.ultima_act ? Math.floor((hoy-new Date(u.ultima_act))/86400000) : null });

    if (tipo === 'fuera_linea')    return activas.map(withDias).filter(u => u.dias === null || u.dias > cfg.diasAtencion).sort((a,b) => (b.dias??9999)-(a.dias??9999));
    if (tipo === 'op_fuera_linea') return activas.map(withDias).filter(u => {
      const est = String(u.estatus||'').toUpperCase();
      return (est.includes('OPERACI') || est.includes('ARREND')) && (u.dias === null || u.dias > cfg.diasAtencion);
    }).sort((a,b) => (b.dias??9999)-(a.dias??9999));
    if (tipo === 'sin_datos')  return activas.filter(u => !u.ultima_act);
    if (tipo === 'fallas')     return uns.filter(u => u.fallaCount > 0).sort((a,b)=>b.fallaCount-a.fallaCount);
    if (tipo === 'inactivas')  return uns.filter(u => !u.activa);
    if (tipo === 'siniestros') return activas.filter(u => u.siniestro);
    if (tipo === 'para_venta') return activas.filter(u => Parsers.categorizarEstatus(u.estatus) === 'Para venta');
    if (tipo === 'fuera_op')   return activas.filter(u => Parsers.categorizarEstatus(u.estatus) === 'Fuera de operación');
    if (tipo === 'en_op')      return activas.filter(u => Parsers.categorizarEstatus(u.estatus) === 'En operación');
    return activas.map(withDias);
  }

  /* ─── ALERTAS ────────────────────────────────────────── */
  function getAlertas(emp) {
    emp = emp || _s.empresaActiva;
    const cfg = _s.config;
    const hoy = Date.now();
    const todas = getUnidadesList(emp);
    const uns = todas.filter(u => u.activa && Parsers.categorizarEstatus(u.estatus) !== 'Para venta');
    const alertas = [];
    const diasDe = u => { if (!u.ultima_act) return null; return Math.floor((hoy - new Date(u.ultima_act)) / 86400000); };

    const sins = uns.filter(u => u.siniestro);
    if (sins.length) alertas.push({ tipo:'siniestro', nivel:'critico', grupo:'Crítico',
      titulo:'Siniestros activos', accion:'Requieren atención técnica',
      unidades: sins.map(u => ({...u, dias: diasDe(u)})), count: sins.length });

    const fueraLargo = uns.map(u => ({...u, dias: diasDe(u)}))
      .filter(u => u.dias !== null && u.dias > cfg.diasAtencion).sort((a,b) => (b.dias||0) - (a.dias||0));
    if (fueraLargo.length) alertas.push({ tipo:'fuera_largo', nivel:'critico', grupo:'Crítico',
      titulo:`Unidades fuera de línea (+${cfg.diasAtencion} días)`, accion:'Requieren atención técnica',
      unidades: fueraLargo, count: fueraLargo.length });

    const PLATS = ['ceiba','samsara','avl','scania','man','volvo','motive'];
    const opSinGPS = uns.filter(u => {
      const est = String(u.estatus||'').toUpperCase();
      if (!est.includes('OPERACI') && !est.includes('ARREND')) return false;
      return !u.ultima_act && !PLATS.some(p => u['ultima_act_'+p]);
    });
    if (opSinGPS.length) alertas.push({ tipo:'op_sin_gps', nivel:'critico', grupo:'Crítico',
      titulo:'En operación sin GPS', accion:'Requieren instalación',
      unidades: opSinGPS.map(u => ({...u, dias: null})), count: opSinGPS.length });

    const sinGPS = uns.filter(u => !u.ultima_act);
    if (sinGPS.length) alertas.push({ tipo:'sin_gps', nivel:'atencion', grupo:'Atención',
      titulo:'Sin datos GPS', accion:'Requieren actualización de datos',
      unidades: sinGPS.map(u => ({...u, dias: null})), count: sinGPS.length });

    const sinPlaca = uns.filter(u => !u.placa);
    if (sinPlaca.length) alertas.push({ tipo:'sin_placa', nivel:'atencion', grupo:'Atención',
      titulo:'Sin placa registrada', accion:'Requieren actualización de datos',
      unidades: sinPlaca.map(u => ({...u, dias: diasDe(u)})), count: sinPlaca.length });

    const sinVIN = uns.filter(u => u['ultima_act_samsara'] && !u.serie);
    if (sinVIN.length) alertas.push({ tipo:'sin_vin', nivel:'atencion', grupo:'Atención',
      titulo:'Sin VIN (Samsara)', accion:'Requieren actualización de datos',
      unidades: sinVIN.map(u => ({...u, dias: diasDe(u)})), count: sinVIN.length });

    const huerfanas = uns.filter(u => !u.estatus && !u.base);
    if (huerfanas.length) alertas.push({ tipo:'huerfanas', nivel:'atencion', grupo:'Atención',
      titulo:'Unidades en plataforma sin asignación', accion:'Revisar origen',
      unidades: huerfanas.map(u => ({...u, dias: diasDe(u)})), count: huerfanas.length });

    const inexistentes = todas.filter(u => !u.activa && (u.ausenciasContadas||0) >= 2);
    if (inexistentes.length) alertas.push({ tipo:'inexistente', nivel:'info', grupo:'Informativo',
      titulo:'Posibles unidades inexistentes', accion:'Fuera de servicio',
      unidades: inexistentes.map(u => ({...u, dias: diasDe(u)})), count: inexistentes.length });

    const hace48h = hoy - 48*3600000;
    const cambiosRecientes = [];
    uns.forEach(u => {
      (u.historial||[]).forEach(h => {
        if (new Date(h.fecha).getTime() > hace48h && (h.tipo === 'actualizacion' || h.tipo === 'falla')) {
          cambiosRecientes.push({...u, _cambio: h});
        }
      });
    });
    if (cambiosRecientes.length) alertas.push({ tipo:'cambios_recientes', nivel:'info', grupo:'Informativo',
      titulo:'Cambios recientes (últimas 48h)', accion:'Actualizaciones manuales',
      unidades: cambiosRecientes.slice(0, 30).map(u => ({...u, dias: diasDe(u)})),
      count: cambiosRecientes.length });

    alertas.forEach(a => { a.unidades.sort((x, y) => { const dx = x.dias === null ? 9999 : x.dias; const dy = y.dias === null ? 9999 : y.dias; return dy - dx; }); });
    return alertas;
  }

  /* ─── SIMS ───────────────────────────────────────────── */
  function _empSims(emp) {
    emp = emp || _s.empresaActiva;
    if (!_s.sims) _s.sims = {};
    if (!_s.sims[emp]) _s.sims[emp] = [];
    return _s.sims[emp];
  }

  function getSims(emp) { return _empSims(emp).slice(); }

  function saveSim(sim, emp) {
    emp = emp || _s.empresaActiva;
    const arr = _empSims(emp);
    const now = new Date().toISOString();
    const registro = {
      id: sim.id || Date.now(), unidad: sim.unidad || '', base: sim.base || '',
      cromatica: sim.cromatica || '', equipoDvr: sim.equipoDvr || '',
      empresa: sim.empresa || emp, iccid: sim.iccid || '', operadora: sim.operadora || '',
      estado: sim.estado || 'SIM SIN ASIGNAR', observaciones: sim.observaciones || '',
      movimiento: sim.movimiento || 'Asignación',
      creadoEn: sim.creadoEn || now, actualizadoEn: now
    };
    const idx = arr.findIndex(x => x.id === registro.id);
    if (idx >= 0) {
      if (arr[idx].estado !== registro.estado) registro.movimiento = _movimientoDeEstado(arr[idx].estado, registro.estado);
      arr[idx] = registro;
    } else { arr.unshift(registro); }
    _logGlobal('sim', `SIM ${registro.iccid || registro.id} → Unidad ${registro.unidad || '—'} [${registro.estado}]`, emp);
    save();
    return registro;
  }

  function _movimientoDeEstado(estadoAntes, estadoDespues) {
    const e = (estadoDespues || '').toUpperCase();
    if (e.includes('INSTALAD')) return 'Instalación';
    if (e.includes('RETIR'))    return 'Retiro';
    if (e.includes('INSTALAR')) return 'Para instalar';
    if (e.includes('SIN ASIG')) return 'Sin asignar';
    return 'Cambio de estado';
  }

  function deleteSim(id, emp) {
    emp = emp || _s.empresaActiva;
    const arr = _empSims(emp);
    const before = arr.length;
    _s.sims[emp] = arr.filter(x => x.id !== id && String(x.id) !== String(id));
    if (_s.sims[emp].length !== before) { save(); return true; }
    return false;
  }

  function getSimStats(emp) {
    const sims = _empSims(emp);
    const stats = { total: sims.length, instaladas: 0, retiradas: 0, sinAsignar: 0, paraInstalar: 0, otras: 0 };
    const byOperadora = {}, byBase = {}, byEstado = {};
    sims.forEach(s => {
      const est = (s.estado || '').toUpperCase();
      if (est.includes('INSTALAD') && !est.includes('PARA')) stats.instaladas++;
      else if (est.includes('RETIR'))    stats.retiradas++;
      else if (est.includes('SIN ASIG')) stats.sinAsignar++;
      else if (est.includes('INSTALAR')) stats.paraInstalar++;
      else stats.otras++;
      const op = s.operadora || 'Sin operadora'; byOperadora[op] = (byOperadora[op] || 0) + 1;
      const base = s.base || 'Sin base'; byBase[base] = (byBase[base] || 0) + 1;
      const estLabel = s.estado || 'Sin estado'; byEstado[estLabel] = (byEstado[estLabel] || 0) + 1;
    });
    return { ...stats, byOperadora, byBase, byEstado };
  }

  /* ─── CONFIG ─────────────────────────────────────────── */
  function getConfig() { return _s.config; }
  function setConfig(updates) { Object.assign(_s.config, updates); save(); }

  /* ─── RESET / EXPORT / IMPORT ────────────────────────── */
  function resetEmpresa(emp) {
    emp = emp || _s.empresaActiva;
    _s.unidades[emp] = {};
    _s.barridos[emp] = [];
    _s.asignaciones[emp] = [];
    _logGlobal('reset', `Reset completo de ${emp}`, emp);
    save();
    if (window.GPS_SB) {
      Promise.all([
        GPS_SB._delete('gps_barridos',     `empresa_id=eq.${encodeURIComponent(emp)}`),
        GPS_SB._delete('gps_asignaciones', `empresa_id=eq.${encodeURIComponent(emp)}`),
        GPS_SB._delete('gps_unidades',     `empresa_id=eq.${encodeURIComponent(emp)}`),
        GPS_SB._delete('gps_fallas',       `empresa_id=eq.${encodeURIComponent(emp)}`)
      ]).catch(e => console.warn('[DB] resetEmpresa Supabase:', e));
    }
  }

  function exportData() { return JSON.stringify(_s, null, 2); }
  function importData(jsonStr) {
    try { const d = JSON.parse(jsonStr); if (d.version) { _s = d; save(); return true; } return false; }
    catch(e) { return false; }
  }

  function eliminarDatosPlataforma(plataforma, emp) {
    emp = emp || _s.empresaActiva;
    const key = 'ultima_act_' + String(plataforma).toLowerCase();
    const store = _empU(emp);
    let afectadas = 0;
    Object.values(store).forEach(u => {
      if (u[key]) {
        delete u[key];
        afectadas++;
        const PLATS = ['ceiba','samsara','avl','scania','man','volvo','motive'];
        let maxFecha = null;
        PLATS.forEach(p => {
          const f = u['ultima_act_' + p];
          if (f && (!maxFecha || new Date(f) > new Date(maxFecha))) maxFecha = f;
        });
        u.ultima_act = maxFecha;
        if (u.plataforma === plataforma) u.plataforma = '';
        u.updatedAt = new Date().toISOString();
      }
    });
    _s.barridos[emp] = (_s.barridos[emp] || []).filter(b => b.plataforma !== plataforma);
    _logGlobal('reset', `Eliminados datos de plataforma ${plataforma}: ${afectadas} unidades afectadas`, emp);
    save();
    return afectadas;
  }

  /**
   * eliminarTodasAsignaciones — borra el historial de asignaciones (sin tocar unidades)
   * ✅ FIX: también borra en Supabase para que initFromSupabase no restaure las filas
   */
  function eliminarTodasAsignaciones(emp) {
    emp = emp || _s.empresaActiva;
    const count = (_s.asignaciones[emp] || []).length;
    _s.asignaciones[emp] = [];
    _logGlobal('reset', `Historial de asignaciones eliminado (${count} registros)`, emp);
    save();
    // ✅ FIX: borrar también en Supabase
    if (window.GPS_SB) {
      GPS_SB._delete('gps_asignaciones', `empresa_id=eq.${encodeURIComponent(emp)}`)
        .catch(e => console.warn('[DB] eliminarTodasAsignaciones Supabase:', e));
    }
    return count;
  }

  function renombrarEmpresa(oldKey, newName) {
    if (!_s.empresas[oldKey]) return false;
    const newKey = newName.trim().toUpperCase().replace(/\s+/g, '_');
    if (newKey === oldKey) { _s.empresas[oldKey].nombre = newName.trim().toUpperCase(); save(); return true; }
    if (_s.empresas[newKey]) return false;
    _s.empresas[newKey] = { ..._s.empresas[oldKey], nombre: newName.trim().toUpperCase() };
    delete _s.empresas[oldKey];
    ['unidades','barridos','asignaciones','viajes'].forEach(bucket => {
      if (_s[bucket] && _s[bucket][oldKey]) {
        _s[bucket][newKey] = _s[bucket][oldKey];
        delete _s[bucket][oldKey];
      }
    });
    if (_s.unidades[newKey]) {
      Object.values(_s.unidades[newKey]).forEach(u => {
        if (u.empresa === oldKey) u.empresa = newKey;
        if (u.empresa_asig === oldKey) u.empresa_asig = newKey;
      });
    }
    if (_s.empresaActiva === oldKey) _s.empresaActiva = newKey;
    save();
    return newKey;
  }

  return {
    getEmpresaActiva, setEmpresaActiva, getEmpresas, getEmpresasList, addEmpresa, removeEmpresa, renombrarEmpresa, getUltimaActualizacion,
    getUnidades, getUnidadesList, getUnidad, upsertUnidad, initFromSupabase,
    marcarInactiva, reactivarUnidad, eliminarUnidad, registrarFalla, resolverFalla, eliminarFalla,
    getBarridos, saveBarrido,
    getAsignaciones, saveAsignacion, eliminarTodasAsignaciones,
    addLog, getHistorialGlobal,
    getStats, getReporte, getAlertas, getFallasStats,
    getConfig, setConfig,
    getCatalogo, addCatalogo, removeCatalogo,
    getViajes, saveViaje, eliminarViaje, getViajeActivoDe,
    setEtiquetaUnidad, removeEtiquetaUnidad,
    registrarBarridoManual,
    eliminarDatosPlataforma,
    getSims, saveSim, deleteSim, getSimStats,
    resetEmpresa, exportData, importData, save
  };
})();
