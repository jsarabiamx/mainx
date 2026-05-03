(function () {
  'use strict';

  const USER_CONFIG = window.CCTV_SUPABASE_CONFIG || {};
  const CONFIG = {
    url: USER_CONFIG.url || '',
    anonKey: USER_CONFIG.anonKey || '',
    options: {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'cctv_supabase_auth'
      }
    }
  };

  const TABLE_CANDIDATES = {
    users: [USER_CONFIG.tables?.users, 'usuarios', 'profiles', 'perfiles'].filter(Boolean),
    reportes: [USER_CONFIG.tables?.reportes, 'reportes', 'fallas', 'tickets'].filter(Boolean),
    notificaciones: [USER_CONFIG.tables?.notificaciones, 'notificaciones'].filter(Boolean),
    audit: [USER_CONFIG.tables?.audit, 'auditoria', 'audit'].filter(Boolean),
    config: [USER_CONFIG.tables?.config, 'app_config', 'config_store', 'app_state', 'kv_store', 'key_value'].filter(Boolean)
  };

  const CONFIG_KEYS = {
    empresas: 'gho_empresas',
    selectores: 'gho_selectores',
    session: 'cctv_session',
    superAdmin: 'cctv_sa',
    recovery: 'cctv_recovery',
    failedAttempts: 'cctv_failed_attempts'
  };

  let client = null;
  let isolatedAuthClient = null;
  const resolvedTables = {};

  function ensureLibrary() {
    if (!CONFIG.url || !CONFIG.anonKey || CONFIG.url.includes('TU-PROYECTO') || CONFIG.anonKey.includes('TU_SUPABASE')) {
      throw new Error('Falta configurar js/supabase-config.js con URL y anon key de Supabase.');
    }
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      throw new Error('Supabase JS no esta cargado. Revisa el script CDN antes de supabaseService.js');
    }
  }

  function getClient() {
    if (client) return client;
    ensureLibrary();
    client = window.supabase.createClient(CONFIG.url, CONFIG.anonKey, CONFIG.options);
    return client;
  }

  function getIsolatedAuthClient() {
    if (isolatedAuthClient) return isolatedAuthClient;
    ensureLibrary();
    isolatedAuthClient = window.supabase.createClient(CONFIG.url, CONFIG.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: 'cctv_supabase_auth_isolated'
      }
    });
    return isolatedAuthClient;
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function uid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    // RFC-4122 v4 UUID fallback
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function normalizeUsername(username) {
    return String(username || '').trim().toLowerCase().replace(/\s+/g, '');
  }

  function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  function isMissingRelationError(error) {
    if (!error) return false;
    const msg = String(error.message || '').toLowerCase();
    return error.code === 'PGRST205' ||
      msg.includes('could not find the table') ||
      msg.includes('relation') ||
      msg.includes('does not exist') ||
      msg.includes('schema cache');
  }

  function safeArray(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === 'string') {
      return value.split(',').map(v => v.trim()).filter(Boolean);
    }
    return [];
  }

  function isObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
  }

  function cloneJson(value, fallback) {
    if (value === undefined) return fallback;
    return JSON.parse(JSON.stringify(value));
  }

  function extractPayload(row) {
    if (isObject(row?.payload)) return row.payload;
    if (isObject(row?.value)) return row.value;
    return {};
  }

  function normalizeProfile(row) {
    if (!row) return null;
    const activo = row.activo !== false && row.is_active !== false;
    // Convertir fecha_nacimiento ISO a DD/MM/YYYY para el frontend
    let fechaNacTexto = row.fecha_nacimiento || '';
    if (fechaNacTexto && /^\d{4}-\d{2}-\d{2}/.test(String(fechaNacTexto))) {
      const [y, m, d] = String(fechaNacTexto).split('T')[0].split('-');
      fechaNacTexto = d + '/' + m + '/' + y;
    }
    return {
      ...row,
      id: row.id || row.auth_user_id,
      auth_user_id: row.auth_user_id || row.user_id || row.auth_id || row.id || null,
      username: normalizeUsername(row.username || row.user_name),
      nombre: row.nombre || row.name || '',
      email: normalizeEmail(row.email),
      role: row.role || 'tecnico',
      base: row.base || '',
      telefono: row.telefono || '',
      empleado_id: row.empleado_id || '',
      empleadoId: row.empleado_id || '',
      fecha_nacimiento: row.fecha_nacimiento || null,
      fechaNacimiento: fechaNacTexto,
      empresas: safeArray(row.empresas),
      activo,
      is_active: row.is_active !== false && activo,
      first_login: row.first_login === true,
      firstLogin: row.first_login === true,
      login_history: Array.isArray(row.login_history) ? row.login_history : [],
      loginHistory: Array.isArray(row.login_history) ? row.login_history : []
    };
  }

  function normalizeReporte(row) {
    if (!row) return null;
    const payload = extractPayload(row);
    const isActive = row.is_active !== false && payload.is_active !== false;
    return {
      ...payload,
      id: row.id || payload.id,
      empresa: row.empresa || payload.empresa || 'GHO',
      is_active: isActive,
      deleted_at: row.deleted_at || payload.deleted_at || null,
      deleted_by: row.deleted_by || payload.deleted_by || null,
      created_at: row.created_at || payload.created_at || payload.createdAt || null,
      updated_at: row.updated_at || payload.updated_at || payload.updatedAt || null
    };
  }

  function normalizeNotificacion(row) {
    if (!row) return null;
    const payload = extractPayload(row);
    return {
      ...payload,
      id: row.id || payload.id,
      reporteId: row.reporte_id || payload.reporteId || payload.reporte_id || null,
      destino: row.destino || payload.destino || '',
      leida: row.leida === true || payload.leida === true,
      fecha: row.fecha || payload.fecha || row.created_at || nowISO()
    };
  }

  function normalizeAuditEntry(row) {
    if (!row) return null;
    const detalle =
      row.detalle ||
      (isObject(row.valor_nuevo) ? row.valor_nuevo.detalle : '') ||
      (isObject(row.valorNuevo) ? row.valorNuevo.detalle : '') ||
      row.tabla ||
      row.registro_id ||
      '';

    return {
      ...row,
      id: row.id || uid(),
      fecha: row.fecha || row.created_at || nowISO(),
      usuario: row.usuario || 'sistema',
      accion: row.accion || row.tipo || 'AUDIT',
      tipo: row.tipo || row.accion || 'AUDIT',
      tabla: row.tabla || '',
      registro_id: row.registro_id || '',
      empresa: row.empresa || '',
      detalle
    };
  }

  async function resolveTable(kind) {
    if (resolvedTables[kind]) return resolvedTables[kind];

    const sb = getClient();
    const candidates = TABLE_CANDIDATES[kind] || [];
    let lastError = null;

    for (const table of candidates) {
      const { error } = await sb.from(table).select('*').limit(1);
      if (!error || !isMissingRelationError(error)) {
        if (error) throw error;
        resolvedTables[kind] = table;
        return table;
      }
      lastError = error;
    }

    throw lastError || new Error(`No se encontro una tabla Supabase para "${kind}"`);
  }

  async function getUsersTable() {
    return resolveTable('users');
  }

  async function getReportesTable() {
    return resolveTable('reportes');
  }

  async function getNotificacionesTable() {
    return resolveTable('notificaciones');
  }

  async function getAuditTable() {
    return resolveTable('audit');
  }

  async function getConfigTable() {
    return resolveTable('config');
  }

  async function readConfigValue(key, fallback = null) {
    const sb = getClient();
    const table = await getConfigTable();
    const { data, error } = await sb
      .from(table)
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (error) throw error;
    return data ? data.value : fallback;
  }

  async function writeConfigValue(key, value) {
    const sb = getClient();
    const table = await getConfigTable();
    const row = { key, value, updated_at: nowISO() };
    const { error } = await sb.from(table).upsert(row, { onConflict: 'key' });
    if (error) throw error;
    return value;
  }

  async function clearConfigValue(key) {
    const sb = getClient();
    const table = await getConfigTable();
    const { error } = await sb.from(table).delete().eq('key', key);
    if (error) throw error;
    return true;
  }

  async function selectProfiles(filters = null) {
    const sb = getClient();
    const table = await getUsersTable();
    let query = sb.from(table).select('*');
    if (typeof filters === 'function') query = filters(query) || query;
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(normalizeProfile).filter(Boolean);
  }

  async function getUserById(id) {
    const users = await selectProfiles(q => q.or(`id.eq.${id},auth_user_id.eq.${id}`).limit(1));
    return users[0] || null;
  }

  async function getUserByUsername(username) {
    const normalized = normalizeUsername(username);
    if (!normalized) return null;
    const users = await selectProfiles(q => q.eq('username', normalized).limit(1));
    return users[0] || null;
  }

  async function getUserByEmail(email) {
    const normalized = normalizeEmail(email);
    if (!normalized) return null;
    const users = await selectProfiles(q => q.eq('email', normalized).limit(1));
    return users[0] || null;
  }

  async function getUsers() {
    const list = await selectProfiles();
    return { list };
  }

  async function getUsersActivos() {
    const store = await getUsers();
    return { ...store, list: store.list.filter(u => u.is_active !== false && u.activo !== false) };
  }

  function toUserRow(user) {
    // Solo columnas snake_case que existen realmente en la tabla usuarios de Supabase
    const normalized = normalizeProfile(user) || {};
    const fechaNac = normalized.fecha_nacimiento || normalized.fechaNacimiento ||
                     user.fecha_nacimiento || user.fechaNacimiento || null;
    // Convertir fecha texto 'DD/MM/YYYY' a formato ISO si viene así
    let fechaNacISO = null;
    if (fechaNac) {
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(fechaNac)) {
        const [d, m, y] = fechaNac.split('/');
        fechaNacISO = `${y}-${m}-${d}`;
      } else {
        fechaNacISO = fechaNac;
      }
    }
    return {
      id: normalized.id || user.id || undefined,
      auth_user_id: normalized.auth_user_id || user.auth_user_id || null,
      username: normalizeUsername(normalized.username || user.username),
      nombre: String(normalized.nombre || user.nombre || '').trim(),
      email: normalizeEmail(normalized.email || user.email),
      role: normalized.role || user.role || 'tecnico',
      base: normalized.base || user.base || '',
      telefono: normalized.telefono || user.telefono || '',
      empleado_id: normalized.empleado_id || normalized.empleadoId || user.empleado_id || user.empleadoId || '',
      fecha_nacimiento: fechaNacISO,
      empresas: safeArray(normalized.empresas || user.empresas),
      activo: normalized.activo !== false,
      is_active: normalized.is_active !== false,
      first_login: normalized.firstLogin === true || normalized.first_login === true || user.first_login === true,
      password: user.password || null,
      password_hash: user.password_hash || null,
      login_history: Array.isArray(user.loginHistory) ? user.loginHistory :
                     Array.isArray(user.login_history) ? user.login_history : [],
      created_at: user.created_at || user.createdAt || nowISO(),
      created_by: user.created_by || user.createdBy || user._createdBy || 'sistema',
      updated_at: user.updated_at || user.updatedAt || null,
      deleted_at: user.deleted_at || null,
      deleted_by: user.deleted_by || null
    };
  }

  async function saveUsers(data) {
    const incoming = Array.isArray(data?.list) ? data.list : [];
    const rows = incoming.map(toUserRow);
    const idsToKeep = rows.map(row => row.id).filter(Boolean);
    const sb = getClient();
    const table = await getUsersTable();

    if (rows.length) {
      const { error } = await sb.from(table).upsert(rows, { onConflict: 'id' });
      if (error) throw error;
    }

    const current = await getUsers();
    const stale = current.list.filter(user => !idsToKeep.includes(user.id));
    for (const user of stale) {
      await updateUser(user.id, {
        activo: false,
        is_active: false,
        deleted_at: nowISO(),
        deleted_by: 'system_sync'
      }, { usuario: 'system_sync' });
    }

    return { list: (await getUsers()).list };
  }

  async function validateUniqueUsername(username, excludeId = null) {
    const normalized = normalizeUsername(username);
    const current = await getUserByUsername(normalized);
    return !current || current.id === excludeId || current.auth_user_id === excludeId;
  }

  async function validateUniqueEmail(email, excludeId = null) {
    const normalized = normalizeEmail(email);
    const current = await getUserByEmail(normalized);
    return !current || current.id === excludeId || current.auth_user_id === excludeId;
  }

  async function signInWithUsername(username, password) {
    const profile = await getUserByUsername(username);
    if (!profile) {
      return { ok: false, error: 'Usuario o contrasena incorrectos' };
    }
    if (profile.activo === false || profile.is_active === false) {
      return { ok: false, error: 'El usuario esta inactivo' };
    }
    if (!profile.email) {
      return { ok: false, error: 'El perfil no tiene un email vinculado en Supabase' };
    }

    const sb = getClient();
    const { data, error } = await sb.auth.signInWithPassword({
      email: profile.email,
      password
    });
    if (error || !data?.user) {
      return { ok: false, error: 'Usuario o contrasena incorrectos' };
    }

    const freshProfile = await getUserById(data.user.id) || await getUserByUsername(profile.username);
    if (!freshProfile) {
      await sb.auth.signOut();
      return { ok: false, error: 'No se encontro el perfil del usuario autenticado' };
    }
    if (freshProfile.activo === false || freshProfile.is_active === false) {
      await sb.auth.signOut();
      return { ok: false, error: 'El usuario esta inactivo' };
    }

    return {
      ok: true,
      authUser: data.user,
      session: data.session,
      profile: freshProfile
    };
  }

  async function createManagedUser(payload) {
    const username = normalizeUsername(payload.username);
    const email = normalizeEmail(payload.email);

    if (!(await validateUniqueUsername(username))) {
      return { ok: false, error: 'El nombre de usuario ya existe' };
    }
    if (!(await validateUniqueEmail(email))) {
      return { ok: false, error: 'El correo ya existe' };
    }

    // ── Crear usuario en auth.users via RPC para evitar el rate limit de email.
    // Usamos la función de Postgres directamente — no signUp() que dispara email.
    const sb = getClient();
    const newAuthId = uid();
    const { error: rpcError } = await sb.rpc('create_auth_user_no_email', {
      p_id: newAuthId,
      p_email: email,
      p_password: payload.password,
      p_username: username,
      p_nombre: payload.nombre || '',
      p_role: payload.role || 'tecnico'
    });

    if (rpcError) {
      // Fallback: intentar signUp normal pero sin options.emailRedirectTo
      const isolated = getIsolatedAuthClient();
      const signup = await isolated.auth.signUp({ email, password: payload.password });
      if (signup.error || !signup.data?.user) {
        return { ok: false, error: signup.error?.message || 'No se pudo crear la cuenta de acceso' };
      }
      // Confirmar email inmediatamente via update directo
      // (Solo funciona si el usuario tiene permisos — en proyectos gratuitos puede fallar)
      const signupUser = signup.data.user;
      // Continuar con el perfil usando el ID del signUp
      const table = await getUsersTable();
      const fechaNac = (() => {
        const fn = payload.fechaNacimiento || payload.fecha_nacimiento || null;
        if (!fn) return null;
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(fn)) {
          const [d, m, y] = fn.split('/');
          return y + '-' + m + '-' + d;
        }
        return fn;
      })();
      const profileRow = {
        auth_user_id: signupUser.id,
        username, nombre: String(payload.nombre || '').trim(), email,
        role: payload.role || 'tecnico', base: payload.base || '',
        telefono: payload.telefono || '',
        empleado_id: payload.empleadoId || payload.empleado_id || '',
        fecha_nacimiento: fechaNac,
        empresas: safeArray(payload.empresas),
        activo: payload.activo !== false, is_active: payload.activo !== false,
        first_login: payload.firstLogin === true,
        created_at: nowISO(), created_by: payload.createdBy || 'sistema'
      };
      const { data: pd, error: pe } = await sb.from(table).insert(profileRow).select().single();
      if (pe) return { ok: false, error: pe.message };
      return { ok: true, user: normalizeProfile(pd) };
    }

    // RPC exitoso — insertar perfil con el ID que generamos
    const table = await getUsersTable();
    const fechaNac = (() => {
      const fn = payload.fechaNacimiento || payload.fecha_nacimiento || null;
      if (!fn) return null;
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(fn)) {
        const [d, m, y] = fn.split('/');
        return y + '-' + m + '-' + d;
      }
      return fn;
    })();
    const profileRow = {
      auth_user_id: newAuthId,
      username,
      nombre: String(payload.nombre || '').trim(),
      email,
      role: payload.role || 'tecnico',
      base: payload.base || '',
      telefono: payload.telefono || '',
      empleado_id: payload.empleadoId || payload.empleado_id || '',
      fecha_nacimiento: fechaNac,
      empresas: safeArray(payload.empresas),
      activo: payload.activo !== false,
      is_active: payload.activo !== false,
      first_login: payload.firstLogin === true,
      created_at: nowISO(),
      created_by: payload.createdBy || payload._createdBy || 'sistema'
    };

    const { data, error } = await sb.from(table).insert(profileRow).select().single();
    if (error) {
      return { ok: false, error: error.message || 'Cuenta creada pero fallo el perfil en la tabla de usuarios' };
    }

    return {
      ok: true,
      user: normalizeProfile(data)
    };
  }

  async function updateManagedUser(userId, changes) {
    const current = await getUserById(userId);
    if (!current) {
      return { ok: false, error: 'Usuario no encontrado' };
    }

    if (Object.prototype.hasOwnProperty.call(changes, 'username')) {
      const nextUsername = normalizeUsername(changes.username);
      if (nextUsername && nextUsername !== current.username && !(await validateUniqueUsername(nextUsername, userId))) {
        return { ok: false, error: 'El nombre de usuario ya existe' };
      }
    }

    if (Object.prototype.hasOwnProperty.call(changes, 'email')) {
      const nextEmail = normalizeEmail(changes.email);
      const sameEmail = nextEmail === normalizeEmail(current.email);
      if (!sameEmail) {
        return {
          ok: false,
          error: 'El email no se puede cambiar desde esta pantalla en modo Supabase. Usa el mismo correo actual.'
        };
      }
    }

    const patch = { ...changes };
    // Mapear camelCase -> snake_case para columnas reales de la BD
    if (Object.prototype.hasOwnProperty.call(patch, 'empleadoId')) {
      patch.empleado_id = patch.empleadoId;
      delete patch.empleadoId;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'fechaNacimiento')) {
      let fn = patch.fechaNacimiento || null;
      if (fn && /^\d{2}\/\d{2}\/\d{4}$/.test(fn)) {
        const [d, m, y] = fn.split('/');
        fn = y + '-' + m + '-' + d;
      }
      patch.fecha_nacimiento = fn;
      delete patch.fechaNacimiento;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'firstLogin')) {
      patch.first_login = patch.firstLogin === true;
      delete patch.firstLogin;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'loginHistory')) {
      patch.login_history = Array.isArray(patch.loginHistory) ? patch.loginHistory : [];
      delete patch.loginHistory;
    }
    // Eliminar columnas que ya no existen en la BD
    delete patch.password;
    delete patch.password_hash;
    if (Object.prototype.hasOwnProperty.call(patch, 'username')) patch.username = normalizeUsername(patch.username);
    if (Object.prototype.hasOwnProperty.call(patch, 'nombre')) patch.nombre = String(patch.nombre || '').trim();
    if (Object.prototype.hasOwnProperty.call(patch, 'email')) patch.email = normalizeEmail(patch.email);
    if (Object.prototype.hasOwnProperty.call(patch, 'empresas')) patch.empresas = safeArray(patch.empresas);
    if (Object.prototype.hasOwnProperty.call(patch, 'activo')) patch.is_active = patch.activo !== false;
    if (Object.prototype.hasOwnProperty.call(patch, 'is_active')) patch.activo = patch.is_active !== false;
    patch.updated_at = nowISO();

    const table = await getUsersTable();
    const sb = getClient();
    const { data, error } = await sb
      .from(table)
      .update(patch)
      .or(`id.eq.${current.id},auth_user_id.eq.${current.auth_user_id}`)
      .select()
      .single();

    if (error) {
      return { ok: false, error: error.message || 'No se pudo actualizar el usuario en Supabase' };
    }

    return { ok: true, user: normalizeProfile(data) };
  }

  async function softDeleteUser(userId, deletedBy) {
    return updateManagedUser(userId, {
      activo: false,
      is_active: false,
      deleted_at: nowISO(),
      deleted_by: deletedBy || 'sistema'
    });
  }

  async function getReportes(filters = null) {
    const sb = getClient();
    const table = await getReportesTable();
    let query = sb.from(table).select('*').order('created_at', { ascending: false });
    if (typeof filters === 'function') query = filters(query) || query;
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(normalizeReporte).filter(Boolean);
  }

  function toReporteRow(record) {
    const normalized = cloneJson(record, {});
    const createdAt = normalized.created_at || normalized.createdAt || nowISO();
    const updatedAt = normalized.updated_at || normalized.updatedAt || null;
    const isActive = normalized.is_active !== false;
    return {
      id: normalized.id || uid(),
      empresa: normalized.empresa || 'GHO',
      is_active: isActive,
      created_at: createdAt,
      updated_at: updatedAt,
      deleted_at: normalized.deleted_at || null,
      deleted_by: normalized.deleted_by || null,
      payload: {
        ...normalized,
        id: normalized.id || undefined,
        empresa: normalized.empresa || 'GHO',
        is_active: isActive,
        created_at: createdAt,
        updated_at: updatedAt,
        deleted_at: normalized.deleted_at || null,
        deleted_by: normalized.deleted_by || null
      }
    };
  }

  async function writeReporteRow(record) {
    const sb = getClient();
    const table = await getReportesTable();
    const row = toReporteRow(record);
    row.payload.id = row.id;
    const { data, error } = await sb.from(table).upsert(row, { onConflict: 'id' }).select().single();
    if (error) throw error;
    return normalizeReporte(data);
  }

  async function getAllReportes() {
    return getReportes();
  }

  async function getAllReportesActivos() {
    return getReportes(q => q.or('is_active.is.null,is_active.eq.true'));
  }

  async function getReportesByEmpresa(empresa) {
    return getReportes(q => q.eq('empresa', empresa).or('is_active.is.null,is_active.eq.true'));
  }

  async function getReporteById(id) {
    const sb = getClient();
    const table = await getReportesTable();
    const { data, error } = await sb.from(table).select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? normalizeReporte(data) : null;
  }

  async function createReporte(data) {
    const createdBy = data?._createdBy || data?.createdBy || 'sistema';
    const record = cloneJson(data, {});
    delete record._createdBy;
    if (!record.id) record.id = uid();
    if (!record.created_at && !record.createdAt) record.created_at = nowISO();
    if (record.is_active === undefined) record.is_active = true;

    const created = await writeReporteRow(record);
    await logAudit({
      accion: 'REPORT_CREATE',
      tabla: 'reportes',
      id: created.id,
      valorNuevo: created,
      empresa: created.empresa,
      usuario: createdBy
    });
    return created;
  }

  async function updateReporte(id, changes, meta = {}) {
    const current = await getReporteById(id);
    if (!current) throw new Error(`Reporte ${id} no encontrado`);

    const updated = await writeReporteRow({
      ...current,
      ...cloneJson(changes, {}),
      id,
      updated_at: nowISO()
    });

    await logAudit({
      accion: 'REPORT_UPDATE',
      tabla: 'reportes',
      id,
      valorAnterior: current,
      valorNuevo: changes,
      empresa: updated.empresa,
      usuario: meta.usuario || 'sistema'
    });
    return updated;
  }

  async function softDeleteReporte(id, deletedBy) {
    const current = await getReporteById(id);
    if (!current) throw new Error(`Reporte ${id} no encontrado`);

    await writeReporteRow({
      ...current,
      id,
      is_active: false,
      deleted_at: nowISO(),
      deleted_by: deletedBy || 'sistema',
      updated_at: nowISO()
    });

    await logAudit({
      accion: 'REPORT_DELETE',
      tabla: 'reportes',
      id,
      valorAnterior: current,
      empresa: current.empresa,
      usuario: deletedBy || 'sistema'
    });
    return true;
  }

  async function softDeleteReportesByEmpresa(empresa, deletedBy) {
    const active = await getReportes(q => q.eq('empresa', empresa).or('is_active.is.null,is_active.eq.true'));
    const now = nowISO();
    for (const reporte of active) {
      await writeReporteRow({
        ...reporte,
        is_active: false,
        deleted_at: now,
        deleted_by: deletedBy || 'sistema',
        updated_at: now
      });
    }

    await logAudit({
      accion: 'REPORT_DELETE_EMPRESA',
      tabla: 'reportes',
      valorNuevo: { empresa, count: active.length },
      empresa,
      usuario: deletedBy || 'sistema'
    });
    return active.length;
  }

  async function softDeleteAllReportes(deletedBy) {
    const active = await getAllReportesActivos();
    const now = nowISO();
    for (const reporte of active) {
      await writeReporteRow({
        ...reporte,
        is_active: false,
        deleted_at: now,
        deleted_by: deletedBy || 'sistema',
        updated_at: now
      });
    }

    await logAudit({
      accion: 'REPORT_DELETE_ALL',
      tabla: 'reportes',
      valorNuevo: { count: active.length },
      usuario: deletedBy || 'sistema'
    });
    return active.length;
  }

  async function getEmpresas() {
    return readConfigValue(CONFIG_KEYS.empresas, null);
  }

  async function saveEmpresas(list) {
    return writeConfigValue(CONFIG_KEYS.empresas, Array.isArray(list) ? list : []);
  }

  async function createEmpresa(nombre, createdBy) {
    const empresas = (await getEmpresas()) || ['GHO', 'ETN', 'AERS', 'AMEALSENSE'];
    if (empresas.includes(nombre)) throw new Error(`La empresa "${nombre}" ya existe`);
    const next = [...empresas, nombre];
    await saveEmpresas(next);
    // También insertar en tabla empresas de Supabase
    try {
      const sb = getClient();
      const { error: insErr } = await sb.from('empresas').insert({ nombre, codigo: nombre });
      if (insErr && insErr.code !== '23505') { // 23505 = unique violation (ya existe)
        console.warn('No se pudo insertar en tabla empresas:', insErr.message);
      }
    } catch(e) {
      console.warn('createEmpresa tabla insert warning:', e.message || e);
    }
    await logAudit({
      accion: 'EMPRESA_CREATE',
      tabla: 'empresas',
      valorNuevo: { nombre },
      usuario: createdBy || 'sistema'
    });
    return nombre;
  }

  async function renameEmpresa(oldNombre, newNombre, updatedBy) {
    const empresas = (await getEmpresas()) || [];
    const idx = empresas.indexOf(oldNombre);
    if (idx < 0) throw new Error(`Empresa "${oldNombre}" no encontrada`);
    if (empresas.includes(newNombre)) throw new Error(`Ya existe una empresa "${newNombre}"`);

    const nextEmpresas = [...empresas];
    nextEmpresas[idx] = newNombre;
    await saveEmpresas(nextEmpresas);

    const reportes = await getAllReportes();
    const afectados = reportes.filter(reporte => reporte.empresa === oldNombre);
    for (const reporte of afectados) {
      await writeReporteRow({
        ...reporte,
        empresa: newNombre,
        updated_at: nowISO()
      });
    }

    const selectores = (await getSelectores()) || {};
    if (selectores[oldNombre]) {
      selectores[newNombre] = selectores[oldNombre];
      delete selectores[oldNombre];
      await saveSelectores(selectores);
    }

    await logAudit({
      accion: 'EMPRESA_RENAME',
      tabla: 'empresas',
      valorAnterior: { nombre: oldNombre },
      valorNuevo: { nombre: newNombre },
      usuario: updatedBy || 'sistema'
    });
    return newNombre;
  }

  async function softDeleteEmpresa(nombre, deletedBy) {
    const BASE = ['GHO', 'ETN', 'AERS', 'AMEALSENSE'];
    if (BASE.includes(nombre)) throw new Error('No se puede eliminar una empresa base');

    const reportesActivos = await getReportesByEmpresa(nombre);
    if (reportesActivos.length > 0) {
      throw new Error(`"${nombre}" tiene ${reportesActivos.length} reporte(s) activo(s). Elimínalos primero.`);
    }

    const users = await getUsers();
    const usersActivos = users.list.filter(u => u.is_active !== false && safeArray(u.empresas).includes(nombre));
    if (usersActivos.length > 0) {
      const nombres = usersActivos.map(u => u.username).join(', ');
      throw new Error(`"${nombre}" tiene usuario(s) asignado(s): ${nombres}. Reasígnalos primero en la sección Usuarios.`);
    }

    // Actualizar app_config eliminando la empresa del array
    const empresas = ((await getEmpresas()) || []).filter(empresa => empresa !== nombre);
    await saveEmpresas(empresas);

    // También eliminar de la tabla empresas en Supabase
    try {
      const sb = getClient();
      const { error: delErr } = await sb.from('empresas').delete().eq('nombre', nombre);
      if (delErr) console.warn('softDeleteEmpresa tabla delete warning:', delErr.message);
    } catch(e) {
      console.warn('softDeleteEmpresa tabla delete exception:', e.message || e);
    }

    await logAudit({
      accion: 'EMPRESA_DELETE',
      tabla: 'empresas',
      valorAnterior: { nombre },
      empresa: nombre,
      usuario: deletedBy || 'sistema'
    });
    return true;
  }

  // ─── MAPA modulo → tabla real en Supabase ───────────────────────────────────
  const MODULO_TABLA = {
    base:      'bases',
    servicio:  'tipo_servicio',
    tipo:      'tipo_incidencia',
    piso:      'opciones_piso',
    proveedor: 'proveedores_equipo',
    categoria: 'categorias',
    componente:'componentes',
    estatus:   'estatus_ticket',
  };

  // Caché de empresa_id por codigo (evita N queries)
  const _empresaIdCache = {};

  async function _getEmpresaId(codigo) {
    if (_empresaIdCache[codigo]) return _empresaIdCache[codigo];
    const sb = getClient();
    const { data, error } = await sb.from('empresas').select('id').eq('codigo', codigo).maybeSingle();
    if (error || !data) throw new Error(`Empresa "${codigo}" no encontrada en BD`);
    _empresaIdCache[codigo] = data.id;
    return data.id;
  }

  // ─── LEER selectores desde tablas reales → armar JSON por empresa ───────────
  async function getSelectores() {
    const sb = getClient();
    try {
      // Leer todas las empresas conocidas
      const empresasList = (await readConfigValue(CONFIG_KEYS.empresas, null)) || [];
      if (!empresasList.length) return null;

      // Leer IDs de todas las empresas de una sola vez
      const { data: empRows, error: empErr } = await sb
        .from('empresas').select('id,codigo').in('codigo', empresasList);
      if (empErr) throw empErr;

      // Mapas bidireccionales  codigo↔uuid
      const codigoToId = {};
      const idToCodigo = {};
      (empRows || []).forEach(r => { codigoToId[r.codigo] = r.id; idToCodigo[r.id] = r.codigo; });

      // Resultado base: una entrada vacía por cada empresa
      const result = {};
      empresasList.forEach(e => {
        result[e] = { base:[], servicio:[], tipo:[], piso:[], proveedor:[], categoria:[], componente:{}, estatus:[] };
      });

      // Leer cada tabla filtrada por los IDs de empresa
      const empresaIds = Object.values(codigoToId);
      if (!empresaIds.length) return result;

      const lecturas = await Promise.all(
        Object.entries(MODULO_TABLA).map(async ([modulo, tabla]) => {
          // solo componentes tiene categoria_id; el resto solo nombre,empresa_id
          const cols = modulo === 'componente' ? 'nombre,empresa_id,categoria_id' : 'nombre,empresa_id';
          const { data, error } = await sb
            .from(tabla).select(cols).eq('is_active', true).in('empresa_id', empresaIds);
          if (error) { console.warn(`[getSelectores] error leyendo ${tabla}:`, error.message); return { modulo, rows: [] }; }
          return { modulo, rows: data || [] };
        })
      );

      // Poblar resultado
      lecturas.forEach(({ modulo, rows }) => {
        rows.forEach(row => {
          const codigo = idToCodigo[row.empresa_id];
          if (!codigo || !result[codigo]) return;
          if (modulo === 'componente') {
            // componentes se agrupan por categoria_id → nombre de categoría
            // Se resuelven después cuando ya tenemos las categorías
            result[codigo]._rawComponentes = result[codigo]._rawComponentes || [];
            result[codigo]._rawComponentes.push(row);
          } else {
            if (!result[codigo][modulo]) result[codigo][modulo] = [];
            if (!result[codigo][modulo].includes(row.nombre)) result[codigo][modulo].push(row.nombre);
          }
        });
      });

      // Resolver componentes por nombre de categoría
      // Necesitamos mapear categoria_id → nombre
      const allCatIds = [];
      empresasList.forEach(e => {
        (result[e]._rawComponentes || []).forEach(r => { if (r.categoria_id) allCatIds.push(r.categoria_id); });
      });
      if (allCatIds.length) {
        const { data: catRows } = await sb.from('categorias').select('id,nombre').in('id', allCatIds);
        const catIdToNombre = {};
        (catRows || []).forEach(r => { catIdToNombre[r.id] = r.nombre; });
        empresasList.forEach(e => {
          (result[e]._rawComponentes || []).forEach(row => {
            const catNombre = catIdToNombre[row.categoria_id] || 'Sin categoría';
            if (!result[e].componente[catNombre]) result[e].componente[catNombre] = [];
            if (!result[e].componente[catNombre].includes(row.nombre)) result[e].componente[catNombre].push(row.nombre);
          });
          delete result[e]._rawComponentes;
        });
      } else {
        empresasList.forEach(e => delete result[e]._rawComponentes);
      }

      return result;
    } catch (err) {
      console.error('[getSelectores] error, fallback a app_config:', err);
      return readConfigValue(CONFIG_KEYS.selectores, null);
    }
  }

  async function saveSelectores(data) {
    // saveSelectores ya no escribe el blob; las escrituras van directo por upsertSelectorItem.
    // Solo sincronizamos el blob como backup para compatibilidad con funciones que lo lean directo.
    return writeConfigValue(CONFIG_KEYS.selectores, isObject(data) ? data : {});
  }

  async function upsertSelectorItem(empresa, modulo, valor, meta = {}) {
    console.log('[upsertSelectorItem] empresa:', empresa, 'modulo:', modulo, 'valor:', valor);
    const tabla = MODULO_TABLA[modulo];
    if (!tabla) throw new Error(`Módulo "${modulo}" no tiene tabla asignada`);

    const sb = getClient();
    const empresa_id = await _getEmpresaId(empresa);

    if (modulo === 'componente') {
      // Para componentes necesitamos el categoria_id
      if (!meta.categoria) throw new Error('Para componentes se requiere meta.categoria');
      const { data: catRow, error: catErr } = await sb
        .from('categorias').select('id').eq('nombre', meta.categoria).eq('empresa_id', empresa_id).maybeSingle();
      if (catErr || !catRow) throw new Error(`Categoría "${meta.categoria}" no encontrada para empresa ${empresa}`);
      const { error } = await sb.from('componentes').upsert(
        { nombre: valor, empresa_id, categoria_id: catRow.id, is_active: true },
        { onConflict: 'nombre,empresa_id,categoria_id', ignoreDuplicates: true }
      );
      if (error) throw error;
    } else {
      const { error } = await sb.from(tabla).upsert(
        { nombre: valor, empresa_id, is_active: true },
        { onConflict: 'nombre,empresa_id', ignoreDuplicates: true }
      );
      if (error) throw error;
    }

    console.log('[upsertSelectorItem] guardado OK en tabla', tabla);
    await logAudit({
      accion: 'CATALOG_ADD',
      tabla,
      valorNuevo: { empresa, modulo, valor, ...meta },
      usuario: meta.usuario || 'sistema'
    });
    return true;
  }

  async function updateSelectorItem(empresa, modulo, valorViejo, valorNuevo, meta = {}) {
    const tabla = MODULO_TABLA[modulo];
    if (!tabla) throw new Error(`Módulo "${modulo}" no tiene tabla asignada`);
    const sb = getClient();
    const empresa_id = await _getEmpresaId(empresa);

    if (modulo === 'componente') {
      if (!meta.categoria) throw new Error('Para componentes se requiere meta.categoria');
      const { data: catRow } = await sb
        .from('categorias').select('id').eq('nombre', meta.categoria).eq('empresa_id', empresa_id).maybeSingle();
      if (!catRow) throw new Error(`Categoría "${meta.categoria}" no encontrada`);
      const { error } = await sb.from('componentes')
        .update({ nombre: valorNuevo })
        .eq('nombre', valorViejo).eq('empresa_id', empresa_id).eq('categoria_id', catRow.id);
      if (error) throw error;
    } else {
      const { error } = await sb.from(tabla)
        .update({ nombre: valorNuevo })
        .eq('nombre', valorViejo).eq('empresa_id', empresa_id);
      if (error) throw error;
    }

    await logAudit({
      accion: 'CATALOG_EDIT',
      tabla,
      valorAnterior: { empresa, modulo, valor: valorViejo },
      valorNuevo: { empresa, modulo, valor: valorNuevo },
      usuario: meta.usuario || 'sistema'
    });
    return true;
  }

  async function deleteSelectorItem(empresa, modulo, valor, meta = {}) {
    const tabla = MODULO_TABLA[modulo];
    if (!tabla) return false;

    const sb = getClient();
    const empresa_id = await _getEmpresaId(empresa);

    if (!meta.force && modulo !== 'componente') {
      const fallas = await getAllReportesActivos();
      const enUso = fallas.some(f => f.empresa === empresa && f[modulo] === valor);
      if (enUso) throw new Error(`"${valor}" está en uso en reportes activos.`);
    }

    if (modulo === 'componente' && meta.categoria) {
      const { data: catRow } = await sb
        .from('categorias').select('id').eq('nombre', meta.categoria).eq('empresa_id', empresa_id).maybeSingle();
      if (catRow) {
        await sb.from('componentes').delete()
          .eq('nombre', valor).eq('empresa_id', empresa_id).eq('categoria_id', catRow.id);
      }
    } else {
      await sb.from(tabla).delete().eq('nombre', valor).eq('empresa_id', empresa_id);
    }

    await logAudit({
      accion: 'CATALOG_DELETE',
      tabla,
      valorAnterior: { empresa, modulo, valor, ...meta },
      usuario: meta.usuario || 'sistema'
    });
    return true;
  }

  async function getNotificaciones() {
    const sb = getClient();
    const table = await getNotificacionesTable();
    const { data, error } = await sb.from(table).select('*').order('fecha', { ascending: false });
    if (error) throw error;
    return (data || []).map(normalizeNotificacion).filter(Boolean);
  }

  function toNotificacionRow(data) {
    const normalized = cloneJson(data, {});
    const fecha = normalized.fecha || normalized.created_at || nowISO();
    return {
      id: normalized.id || uid(),
      reporte_id: normalized.reporteId || normalized.reporte_id || null,
      destino: normalized.destino || '',
      leida: normalized.leida === true,
      fecha,
      created_at: normalized.created_at || fecha,
      updated_at: normalized.updated_at || normalized.updatedAt || null,
      payload: {
        ...normalized,
        id: normalized.id || undefined,
        reporteId: normalized.reporteId || normalized.reporte_id || null,
        leida: normalized.leida === true,
        fecha
      }
    };
  }

  async function trimNotificaciones(max = 200) {
    const notificaciones = await getNotificaciones();
    if (notificaciones.length <= max) return;
    const sb = getClient();
    const table = await getNotificacionesTable();
    const extraIds = notificaciones.slice(max).map(notif => notif.id);
    const { error } = await sb.from(table).delete().in('id', extraIds);
    if (error) throw error;
  }

  async function saveNotificaciones(data) {
    const sb = getClient();
    const table = await getNotificacionesTable();
    const rows = Array.isArray(data) ? data.map(toNotificacionRow) : [];
    const { error: deleteError } = await sb.from(table).delete().not('id', 'is', null);
    if (deleteError) throw deleteError;
    if (rows.length) {
      const { error } = await sb.from(table).upsert(rows, { onConflict: 'id' });
      if (error) throw error;
    }
    await trimNotificaciones(200);
    return Array.isArray(data) ? data : [];
  }

  async function createNotificacion(data) {
    const sb = getClient();
    const table = await getNotificacionesTable();
    const row = toNotificacionRow(data);
    row.payload.id = row.id;
    const { data: inserted, error } = await sb.from(table).insert(row).select().single();
    if (error) throw error;
    await trimNotificaciones(200);
    return normalizeNotificacion(inserted);
  }

  async function markNotifRead(id) {
    const sb = getClient();
    const table = await getNotificacionesTable();
    const current = await sb.from(table).select('*').eq('id', id).maybeSingle();
    if (current.error) throw current.error;
    if (!current.data) return true;
    const notif = normalizeNotificacion(current.data);
    const row = toNotificacionRow({
      ...notif,
      leida: true,
      updated_at: nowISO()
    });
    row.payload.id = row.id;
    const { error } = await sb.from(table).upsert(row, { onConflict: 'id' });
    if (error) throw error;
    return true;
  }

  async function markNotifByReporte(reporteId) {
    const list = await getNotificaciones();
    const pending = list.filter(notif => notif.reporteId === reporteId && !notif.leida);
    for (const notif of pending) {
      await markNotifRead(notif.id);
    }
    return pending.length;
  }

  async function markAllNotifRead(filter = null) {
    const list = await getNotificaciones();
    const pending = list.filter(notif => !filter || filter(notif));
    for (const notif of pending) {
      if (!notif.leida) await markNotifRead(notif.id);
    }
    return true;
  }

  async function getSession() {
    return readConfigValue(CONFIG_KEYS.session, null);
  }

  async function saveSession(data) {
    return writeConfigValue(CONFIG_KEYS.session, data);
  }

  async function clearSession() {
    return clearConfigValue(CONFIG_KEYS.session);
  }

  async function getAudit() {
    const sb = getClient();
    const table = await getAuditTable();
    const { data, error } = await sb.from(table).select('*').order('fecha', { ascending: false }).limit(2000);
    if (error) throw error;
    return (data || []).map(normalizeAuditEntry).filter(Boolean);
  }

  function toAuditRow(entry) {
    const normalized = cloneJson(entry, {});
    const valorAnterior = normalized.valorAnterior ?? normalized.valor_anterior ?? null;
    const valorNuevo = normalized.valorNuevo ?? normalized.valor_nuevo ?? null;
    return {
      id: uid(),  // siempre UUID nuevo — nunca reutilizar el id del reporte
      fecha: normalized.fecha || normalized.created_at || nowISO(),
      usuario: normalized.usuario || 'sistema',
      accion: normalized.accion || normalized.tipo || 'AUDIT',
      tabla: normalized.tabla || '',
      registro_id: normalized.idRegistro || normalized.registro_id || normalized.idRef || normalized.id || '',
      empresa: normalized.empresa || '',
      valor_anterior: valorAnterior,
      valor_nuevo: valorNuevo,
      detalle:
        normalized.detalle ||
        (isObject(valorNuevo) ? valorNuevo.detalle : '') ||
        normalized.tabla ||
        ''
    };
  }

  async function trimAudit(max = 2000) {
    const audit = await getAudit();
    if (audit.length <= max) return;
    const sb = getClient();
    const table = await getAuditTable();
    const extraIds = audit.slice(max).map(item => item.id);
    const { error } = await sb.from(table).delete().in('id', extraIds);
    if (error) throw error;
  }

  async function saveAudit(data) {
    const sb = getClient();
    const table = await getAuditTable();
    const rows = Array.isArray(data) ? data.map(toAuditRow) : [];
    const { error: deleteError } = await sb.from(table).delete().not('id', 'is', null);
    if (deleteError) throw deleteError;
    if (rows.length) {
      const { error } = await sb.from(table).upsert(rows, { onConflict: 'id' });
      if (error) throw error;
    }
    await trimAudit(2000);
    return Array.isArray(data) ? data : [];
  }

  async function logAudit(entry) {
    const sb = getClient();
    const table = await getAuditTable();
    const row = toAuditRow(entry);
    const { error } = await sb.from(table).insert(row);
    if (error) throw error;
    await trimAudit(2000);
    return true;
  }

  async function getSuperAdmin() {
    return readConfigValue(CONFIG_KEYS.superAdmin, null);
  }

  async function saveSuperAdmin(data) {
    return writeConfigValue(CONFIG_KEYS.superAdmin, data);
  }

  async function getRecovery() {
    return readConfigValue(CONFIG_KEYS.recovery, null);
  }

  async function saveRecovery(data) {
    return writeConfigValue(CONFIG_KEYS.recovery, data);
  }

  async function clearRecovery() {
    return clearConfigValue(CONFIG_KEYS.recovery);
  }

  async function getFailedAttempts() {
    return readConfigValue(CONFIG_KEYS.failedAttempts, {});
  }

  async function saveFailedAttempts(data) {
    return writeConfigValue(CONFIG_KEYS.failedAttempts, isObject(data) ? data : {});
  }

  async function getUiSetting(key, fallback = null) {
    return readConfigValue(key, fallback);
  }

  async function saveUiSetting(key, value) {
    return writeConfigValue(key, value);
  }

  async function hardResetAll(confirmedBy) {
    const sb = getClient();
    const reportesTable = await getReportesTable();
    const notificacionesTable = await getNotificacionesTable();
    const auditTable = await getAuditTable();
    const configTable = await getConfigTable();

    const { error: reportesError } = await sb.from(reportesTable).delete().not('id', 'is', null);
    if (reportesError) throw reportesError;

    const { error: notifsError } = await sb.from(notificacionesTable).delete().not('id', 'is', null);
    if (notifsError) throw notifsError;

    const { error: auditError } = await sb.from(auditTable).delete().not('id', 'is', null);
    if (auditError) throw auditError;

    const keysToClear = [
      CONFIG_KEYS.empresas,
      CONFIG_KEYS.selectores,
      CONFIG_KEYS.session,
      CONFIG_KEYS.superAdmin,
      CONFIG_KEYS.recovery,
      CONFIG_KEYS.failedAttempts,
      'gho_current_empresa',
      'gho_view_mode'
    ];
    const { error: configError } = await sb.from(configTable).delete().in('key', keysToClear);
    if (configError) throw configError;

    await logAudit({
      accion: 'SYSTEM_RESET',
      tabla: 'sistema',
      valorNuevo: { confirmedBy },
      usuario: confirmedBy || 'sistema'
    });
    return true;
  }

  async function setPasswordForCurrentUser(newPassword) {
    const sb = getClient();
    const { data, error } = await sb.auth.updateUser({ password: newPassword });
    if (error) return { ok: false, error: error.message || 'No se pudo actualizar la contrasena' };
    return { ok: true, user: data?.user || null };
  }

  async function requestPasswordReset(email) {
    const sb = getClient();
    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await sb.auth.resetPasswordForEmail(normalizeEmail(email), { redirectTo });
    if (error) return { ok: false, error: error.message || 'No se pudo enviar el correo de restablecimiento' };
    return { ok: true, message: 'Se envio un correo de restablecimiento al usuario.' };
  }

  async function signOut() {
    const sb = getClient();
    const { error } = await sb.auth.signOut();
    if (error) throw error;
    return true;
  }

  async function getAuthSession() {
    const sb = getClient();
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    return data?.session || null;
  }

  async function getCurrentAuthUser() {
    const sb = getClient();
    const { data, error } = await sb.auth.getUser();
    if (error) throw error;
    return data?.user || null;
  }

  async function testConnection() {
    const session = await getAuthSession().catch(() => null);
    const tables = {};
    for (const kind of Object.keys(TABLE_CANDIDATES)) {
      try {
        tables[kind] = await resolveTable(kind);
      } catch (error) {
        tables[kind] = `ERROR: ${error.message || error}`;
      }
    }
    return {
      ok: true,
      url: CONFIG.url,
      hasSession: Boolean(session),
      tables,
      message: 'Cliente Supabase listo con adaptador persistente para la app.'
    };
  }

  window.CCTV_SUPABASE = {
    config: { url: CONFIG.url },
    getClient,
    testConnection,
    getAuthSession,
    getCurrentAuthUser,
    signOut,
    signInWithUsername,
    createManagedUser,
    updateManagedUser,
    validateUniqueUsername,
    validateUniqueEmail,
    requestPasswordReset,
    setPasswordForCurrentUser,
    getUserById,
    getUserByUsername,
    normalizeUsername,
    resolveTable
  };

  window.CCTV_DB_ADAPTER = {
    testConnection,

    getUsers,
    getUsersActivos,
    getUserById,
    saveUsers,
    async createUser(data) {
      const result = await createManagedUser(data);
      if (!result.ok) throw new Error(result.error);
      return result.user;
    },
    async updateUser(userId, changes) {
      const result = await updateManagedUser(userId, changes);
      if (!result.ok) throw new Error(result.error);
      return result.user;
    },
    async softDeleteUser(userId, deletedBy) {
      const result = await softDeleteUser(userId, deletedBy);
      if (!result.ok) throw new Error(result.error);
      return true;
    },

    getAllReportes,
    getAllReportesActivos,
    getReportesByEmpresa,
    getReporteById,
    createReporte,
    updateReporte,
    softDeleteReporte,
    softDeleteReportesByEmpresa,
    softDeleteAllReportes,

    getEmpresas,
    saveEmpresas,
    createEmpresa,
    renameEmpresa,
    softDeleteEmpresa,

    getSelectores,
    saveSelectores,
    upsertSelectorItem,
    updateSelectorItem,
    deleteSelectorItem,

    getNotificaciones,
    saveNotificaciones,
    createNotificacion,
    markNotifRead,
    markNotifByReporte,
    markAllNotifRead,

    getSession,
    saveSession,
    clearSession,

    getAudit,
    saveAudit,
    _logAudit: logAudit,

    getSuperAdmin,
    saveSuperAdmin,
    getRecovery,
    saveRecovery,
    clearRecovery,
    getFailedAttempts,
    saveFailedAttempts,

    getUiSetting,
    saveUiSetting,

    hardResetAll
  };
})();
