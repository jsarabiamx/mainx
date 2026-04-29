/* ═══════════════════════════════════════════════════════════════
   CCTV Fleet Control — supabaseService.js v7.0
   Adaptador real Supabase. Tablas: usuarios, reportes,
   notificaciones, auditoria, app_config.
   Expone: window.CCTV_SUPABASE  (funciones de auth)
           window.CCTV_DB_ADAPTER (adaptador para dataService.js)
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const CFG = window.CCTV_SUPABASE_CONFIG || {};
  const URL     = CFG.url     || '';
  const ANONKEY = CFG.anonKey || '';
  const TABLES  = CFG.tables  || {};

  const T = {
    USUARIOS:      TABLES.users          || 'usuarios',
    REPORTES:      TABLES.reportes       || 'reportes',
    NOTIF:         TABLES.notificaciones || 'notificaciones',
    AUDIT:         TABLES.audit          || 'auditoria',
    CONFIG:        TABLES.config         || 'app_config',
  };

  /* ─── Supabase clients ─────────────────────────────────────── */
  let _client = null;
  let _isolatedClient = null;

  function ensureLib() {
    if (!URL || !ANONKEY)
      throw new Error('supabase-config.js: falta URL o anonKey.');
    if (!window.supabase || typeof window.supabase.createClient !== 'function')
      throw new Error('Supabase JS no cargado. Revisa el CDN en el HTML.');
  }

  function sb() {
    if (_client) return _client;
    ensureLib();
    _client = window.supabase.createClient(URL, ANONKEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'cctv_sb_auth' }
    });
    return _client;
  }

  function sbIsolated() {
    if (_isolatedClient) return _isolatedClient;
    ensureLib();
    _isolatedClient = window.supabase.createClient(URL, ANONKEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'cctv_sb_auth_iso' }
    });
    return _isolatedClient;
  }

  /* ─── Helpers ──────────────────────────────────────────────── */
  function nowISO() { return new Date().toISOString(); }

  function uid() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  }

  function norm(u) { return String(u||'').trim().toLowerCase().replace(/\s+/g,''); }
  function normEmail(e) { return String(e||'').trim().toLowerCase(); }
  function safeArr(v) {
    if (Array.isArray(v)) return v.filter(Boolean);
    if (typeof v === 'string') return v.split(',').map(x=>x.trim()).filter(Boolean);
    return [];
  }

  function normalizeProfile(row) {
    if (!row) return null;
    const activo = row.activo !== false && row.is_active !== false;
    return {
      ...row,
      id:              row.auth_user_id || row.id,
      auth_user_id:    row.auth_user_id || row.id,
      username:        norm(row.username),
      nombre:          row.nombre  || '',
      email:           normEmail(row.email),
      role:            row.role    || 'tecnico',
      base:            row.base    || '',
      telefono:        row.telefono || '',
      empleadoId:      row.empleado_id || row.empleadoId || '',
      empleado_id:     row.empleado_id || row.empleadoId || '',
      fechaNacimiento: row.fecha_nacimiento ? String(row.fecha_nacimiento).slice(0,10) : '',
      fecha_nacimiento:row.fecha_nacimiento || null,
      empresas:        safeArr(row.empresas),
      activo,
      is_active:       activo,
      firstLogin:      row.first_login === true || row.firstLogin === true,
      first_login:     row.first_login === true || row.firstLogin === true,
    };
  }

  function normalizeReporte(row) {
    if (!row) return null;
    const payload = (row.payload && typeof row.payload === 'object') ? row.payload : {};
    return {
      ...payload,
      ...row,
      id:         row.id,
      is_active:  row.is_active !== false,
      created_at: row.created_at || nowISO(),
      updated_at: row.updated_at || null,
    };
  }

  function normalizeNotif(row) {
    if (!row) return null;
    const payload = (row.payload && typeof row.payload === 'object') ? row.payload : {};
    return {
      ...payload,
      ...row,
      id:        row.id,
      reporteId: row.reporte_id || payload.reporteId || null,
      reporte_id:row.reporte_id || null,
      leida:     row.leida === true,
      fecha:     row.fecha || row.created_at || nowISO(),
    };
  }

  function normalizeAudit(row) {
    if (!row) return null;
    const vn = row.valor_nuevo || {};
    return {
      ...row,
      id:       row.id || uid(),
      fecha:    row.created_at || nowISO(),
      usuario:  row.usuario || 'sistema',
      accion:   row.accion  || '',
      tipo:     row.accion  || '',
      tabla:    row.tabla   || '',
      detalle:  (typeof vn === 'object' ? vn.detalle : '') || row.tabla || '',
    };
  }

  /* ─── testConnection ───────────────────────────────────────── */
  async function testConnection() {
    try {
      const { error } = await sb().from(T.CONFIG).select('key').limit(1);
      if (error) return { ok: false, message: error.message };
      return { ok: true, message: 'Conexión exitosa' };
    } catch(e) { return { ok: false, message: e.message }; }
  }

  /* ─── Auth helpers ─────────────────────────────────────────── */
  async function getAuthSession() {
    try {
      const { data } = await sb().auth.getSession();
      return data?.session || null;
    } catch { return null; }
  }

  async function getCurrentAuthUser() {
    try {
      const { data } = await sb().auth.getUser();
      return data?.user || null;
    } catch { return null; }
  }

  async function signOut() {
    try { await sb().auth.signOut(); } catch {}
  }

  /* ─── Usuarios ─────────────────────────────────────────────── */
  async function getUserById(authUserId) {
    if (!authUserId) return null;
    try {
      const { data, error } = await sb()
        .from(T.USUARIOS)
        .select('*')
        .eq('auth_user_id', authUserId)
        .maybeSingle();
      if (error || !data) return null;
      return normalizeProfile(data);
    } catch { return null; }
  }

  async function getUserByUsername(username) {
    if (!username) return null;
    try {
      const { data, error } = await sb()
        .from(T.USUARIOS)
        .select('*')
        .eq('username', norm(username))
        .eq('is_active', true)
        .maybeSingle();
      if (error || !data) return null;
      return normalizeProfile(data);
    } catch { return null; }
  }

  async function getUsers() {
    try {
      const { data, error } = await sb()
        .from(T.USUARIOS)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) return { list: [] };
      return { list: (data || []).map(normalizeProfile) };
    } catch { return { list: [] }; }
  }

  async function getUsersActivos() {
    try {
      const { data, error } = await sb()
        .from(T.USUARIOS)
        .select('*')
        .eq('is_active', true)
        .eq('activo', true)
        .order('nombre');
      if (error) return { list: [] };
      return { list: (data || []).map(normalizeProfile) };
    } catch { return { list: [] }; }
  }

  async function saveUsers(data) {
    // No-op in Supabase mode – users are managed individually
    return data;
  }

  async function validateUniqueUsername(username, excludeAuthId) {
    try {
      let q = sb().from(T.USUARIOS).select('auth_user_id').eq('username', norm(username)).eq('is_active', true);
      if (excludeAuthId) q = q.neq('auth_user_id', excludeAuthId);
      const { data } = await q;
      return !data || data.length === 0;
    } catch { return true; }
  }

  async function validateUniqueEmail(email, excludeAuthId) {
    if (!email) return true;
    try {
      let q = sb().from(T.USUARIOS).select('auth_user_id').eq('email', normEmail(email)).eq('is_active', true);
      if (excludeAuthId) q = q.neq('auth_user_id', excludeAuthId);
      const { data } = await q;
      return !data || data.length === 0;
    } catch { return true; }
  }

  /* ─── signInWithUsername ───────────────────────────────────── */
  async function signInWithUsername(username, password) {
    try {
      const profile = await getUserByUsername(username);
      if (!profile)
        return { ok: false, error: 'Usuario o contraseña incorrectos' };
      if (!profile.activo || !profile.is_active)
        return { ok: false, error: 'El usuario está inactivo' };
      if (!profile.email)
        return { ok: false, error: 'El perfil no tiene correo vinculado' };

      const { data, error } = await sb().auth.signInWithPassword({
        email:    profile.email,
        password,
      });
      if (error || !data?.user)
        return { ok: false, error: 'Usuario o contraseña incorrectos' };

      const fresh = await getUserById(data.user.id) || profile;
      if (!fresh.activo || !fresh.is_active) {
        await sb().auth.signOut();
        return { ok: false, error: 'El usuario está inactivo' };
      }
      return { ok: true, authUser: data.user, session: data.session, profile: fresh };
    } catch(e) {
      return { ok: false, error: e.message || 'Error de autenticación' };
    }
  }

  /* ─── createManagedUser ─────────────────────────────────────── */
  async function createManagedUser(payload) {
    try {
      const username = norm(payload.username);
      const email    = normEmail(payload.email);

      if (!email) return { ok: false, error: 'El correo es obligatorio' };
      if (!(await validateUniqueUsername(username)))
        return { ok: false, error: 'El nombre de usuario ya existe' };
      if (!(await validateUniqueEmail(email)))
        return { ok: false, error: 'El correo ya está registrado' };

      // Crear en Auth con cliente aislado (no afecta sesión activa)
      const isolated = sbIsolated();
      const { data: signupData, error: signupErr } = await isolated.auth.signUp({
        email,
        password: payload.password,
        options: { data: { username, nombre: payload.nombre || '', role: payload.role || 'tecnico' } }
      });

      if (signupErr || !signupData?.user)
        return { ok: false, error: signupErr?.message || 'No se pudo crear la cuenta en Auth' };

      const authUser = signupData.user;

      // Insertar perfil en tabla usuarios
      const row = {
        auth_user_id:    authUser.id,
        username,
        nombre:          String(payload.nombre || '').trim(),
        email,
        role:            payload.role     || 'tecnico',
        base:            payload.base     || '',
        telefono:        payload.telefono || '',
        empleado_id:     payload.empleadoId || payload.empleado_id || '',
        fecha_nacimiento:payload.fechaNacimiento || payload.fecha_nacimiento || null,
        empresas:        safeArr(payload.empresas),
        activo:          payload.activo !== false,
        is_active:       payload.activo !== false,
        first_login:     payload.firstLogin !== false,
        created_by:      payload.createdBy || payload._createdBy || 'sistema',
      };

      const { data, error } = await sb().from(T.USUARIOS).insert(row).select().single();
      if (error) {
        // intento limpiar auth user si falla el perfil — best effort
        return { ok: false, error: error.message || 'Perfil no creado en tabla usuarios' };
      }
      return { ok: true, user: normalizeProfile(data) };
    } catch(e) {
      return { ok: false, error: e.message || 'Error creando usuario' };
    }
  }

  /* ─── updateManagedUser ─────────────────────────────────────── */
  async function updateManagedUser(userId, changes) {
    try {
      const dbChanges = {};
      if (changes.nombre      !== undefined) dbChanges.nombre       = changes.nombre;
      if (changes.base        !== undefined) dbChanges.base         = changes.base;
      if (changes.telefono    !== undefined) dbChanges.telefono     = changes.telefono;
      if (changes.role        !== undefined) dbChanges.role         = changes.role;
      if (changes.empresas    !== undefined) dbChanges.empresas     = safeArr(changes.empresas);
      if (changes.activo      !== undefined) { dbChanges.activo = changes.activo; dbChanges.is_active = changes.activo; }
      if (changes.is_active   !== undefined) { dbChanges.is_active = changes.is_active; dbChanges.activo = changes.is_active; }
      if (changes.firstLogin  !== undefined) dbChanges.first_login  = changes.firstLogin;
      if (changes.first_login !== undefined) dbChanges.first_login  = changes.first_login;
      if (changes.empleadoId  !== undefined) dbChanges.empleado_id  = changes.empleadoId;
      if (changes.fecha_nacimiento !== undefined) dbChanges.fecha_nacimiento = changes.fecha_nacimiento;
      if (changes.fechaNacimiento  !== undefined) dbChanges.fecha_nacimiento = changes.fechaNacimiento;
      if (changes.deleted_at  !== undefined) dbChanges.deleted_at   = changes.deleted_at;
      if (changes.deleted_by  !== undefined) dbChanges.deleted_by   = changes.deleted_by;

      const { data, error } = await sb()
        .from(T.USUARIOS)
        .update(dbChanges)
        .eq('auth_user_id', userId)
        .select()
        .single();

      if (error) return { ok: false, error: error.message };
      return { ok: true, user: normalizeProfile(data) };
    } catch(e) {
      return { ok: false, error: e.message };
    }
  }

  async function softDeleteUser(userId, deletedBy) {
    try {
      const { error } = await sb()
        .from(T.USUARIOS)
        .update({ is_active: false, activo: false, deleted_at: nowISO(), deleted_by: deletedBy || 'sistema' })
        .eq('auth_user_id', userId);
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    } catch(e) { return { ok: false, error: e.message }; }
  }

  /* ─── setPasswordForCurrentUser ────────────────────────────── */
  async function setPasswordForCurrentUser(newPassword) {
    try {
      const { error } = await sb().auth.updateUser({ password: newPassword });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    } catch(e) { return { ok: false, error: e.message }; }
  }

  async function requestPasswordReset(email) {
    try {
      const { error } = await sb().auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/index.html'
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true, message: 'Correo de restablecimiento enviado' };
    } catch(e) { return { ok: false, error: e.message }; }
  }

  /* ─── Reportes ─────────────────────────────────────────────── */
  async function getAllReportes() {
    try {
      const { data, error } = await sb().from(T.REPORTES).select('*').order('created_at', { ascending: false });
      if (error) return [];
      return (data || []).map(normalizeReporte);
    } catch { return []; }
  }

  async function getAllReportesActivos() {
    try {
      const { data, error } = await sb()
        .from(T.REPORTES).select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) return [];
      return (data || []).map(normalizeReporte);
    } catch { return []; }
  }

  async function getReportesByEmpresa(empresa) {
    try {
      const { data, error } = await sb()
        .from(T.REPORTES).select('*')
        .eq('empresa', empresa).eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) return [];
      return (data || []).map(normalizeReporte);
    } catch { return []; }
  }

  async function getReporteById(id) {
    try {
      const { data, error } = await sb().from(T.REPORTES).select('*').eq('id', id).maybeSingle();
      if (error || !data) return null;
      return normalizeReporte(data);
    } catch { return null; }
  }

  async function createReporte(data) {
    try {
      const { _createdBy, ...rest } = data;
      const row = {
        empresa:          rest.empresa          || '',
        base:             rest.base             || '',
        unidad:           rest.unidad           || '',
        tipo_servicio:    rest.tipoServicio     || rest.tipo_servicio    || '',
        tipo_incidencia:  rest.tipoIncidencia   || rest.tipo_incidencia  || '',
        estatus:          rest.estatus          || 'Pendiente',
        descripcion:      rest.descripcion      || '',
        tecnico:          rest.tecnico          || '',
        tecnico_username: rest.tecnicoUsername  || rest.tecnico_username || '',
        prioridad:        rest.prioridad        || 'Normal',
        categoria:        rest.categoria        || '',
        componente:       rest.componente       || '',
        piso:             rest.piso             || '',
        ubicacion_camara: rest.ubicacionCamara  || rest.ubicacion_camara || '',
        estado_dvr:       rest.estadoDVR        || rest.estado_dvr       || '',
        estado_disco:     rest.estadoDisco      || rest.estado_disco      || '',
        gps:              rest.gps              || '',
        sim_3g:           rest.sim3g            || rest.sim_3g           || '',
        proveedor:        rest.proveedor        || '',
        fecha_reporte:    rest.fechaReporte     || rest.fecha_reporte    || new Date().toLocaleDateString('es-MX'),
        fecha_atencion:   rest.fechaAtencion    || rest.fecha_atencion   || null,
        notas:            rest.notas            || '',
        payload:          rest,
        is_active:        true,
        created_by:       _createdBy            || 'sistema',
      };

      const { data: inserted, error } = await sb().from(T.REPORTES).insert(row).select().single();
      if (error) throw new Error(error.message);
      return normalizeReporte(inserted);
    } catch(e) { throw e; }
  }

  async function updateReporte(id, changes, meta = {}) {
    try {
      const dbChanges = { ...changes };
      // map camelCase → snake_case for known fields
      if (changes.tipoServicio    !== undefined) dbChanges.tipo_servicio    = changes.tipoServicio;
      if (changes.tipoIncidencia  !== undefined) dbChanges.tipo_incidencia  = changes.tipoIncidencia;
      if (changes.tecnicoUsername !== undefined) dbChanges.tecnico_username = changes.tecnicoUsername;
      if (changes.ubicacionCamara !== undefined) dbChanges.ubicacion_camara = changes.ubicacionCamara;
      if (changes.estadoDVR       !== undefined) dbChanges.estado_dvr       = changes.estadoDVR;
      if (changes.estadoDisco     !== undefined) dbChanges.estado_disco     = changes.estadoDisco;
      if (changes.sim3g           !== undefined) dbChanges.sim_3g           = changes.sim3g;
      if (changes.fechaReporte    !== undefined) dbChanges.fecha_reporte    = changes.fechaReporte;
      if (changes.fechaAtencion   !== undefined) dbChanges.fecha_atencion   = changes.fechaAtencion;

      // also update payload blob
      const current = await getReporteById(id);
      if (current) dbChanges.payload = { ...current, ...changes };

      const { data, error } = await sb().from(T.REPORTES).update(dbChanges).eq('id', id).select().single();
      if (error) throw new Error(error.message);
      return normalizeReporte(data);
    } catch(e) { throw e; }
  }

  async function softDeleteReporte(id, deletedBy) {
    try {
      const { error } = await sb().from(T.REPORTES)
        .update({ is_active: false, deleted_at: nowISO(), deleted_by: deletedBy || 'sistema' })
        .eq('id', id);
      if (error) throw new Error(error.message);
      return true;
    } catch(e) { throw e; }
  }

  async function softDeleteReportesByEmpresa(empresa, deletedBy) {
    try {
      const { data, error } = await sb().from(T.REPORTES)
        .update({ is_active: false, deleted_at: nowISO(), deleted_by: deletedBy || 'sistema' })
        .eq('empresa', empresa).eq('is_active', true).select('id');
      if (error) throw new Error(error.message);
      return (data || []).length;
    } catch(e) { throw e; }
  }

  async function softDeleteAllReportes(deletedBy) {
    try {
      const { data, error } = await sb().from(T.REPORTES)
        .update({ is_active: false, deleted_at: nowISO(), deleted_by: deletedBy || 'sistema' })
        .eq('is_active', true).select('id');
      if (error) throw new Error(error.message);
      return (data || []).length;
    } catch(e) { throw e; }
  }

  /* ─── Empresas ─────────────────────────────────────────────── */
  async function getEmpresas() {
    try {
      // Intenta desde tabla empresas primero
      const { data, error } = await sb().from('empresas').select('nombre').eq('is_active', true).order('nombre');
      if (!error && data && data.length > 0) return data.map(r => r.nombre);
    } catch {}
    // fallback → app_config
    return getConfigKey('gho_empresas', ['GHO','ETN','AERS','AMEALSENSE']);
  }

  async function saveEmpresas(list) {
    try {
      await setConfigKey('gho_empresas', list, 'sistema');
      return list;
    } catch { return list; }
  }

  async function createEmpresa(nombre, createdBy) {
    try {
      const { error } = await sb().from('empresas').insert({ nombre, created_by: createdBy || 'sistema' });
      if (error) throw new Error(error.message);
      await logAudit({ usuario: createdBy, accion: 'EMPRESA_CREATE', tabla: 'empresas', valorNuevo: { nombre } });
      return nombre;
    } catch(e) { throw e; }
  }

  async function renameEmpresa(oldNombre, newNombre, updatedBy) {
    try {
      const { error } = await sb().from('empresas').update({ nombre: newNombre }).eq('nombre', oldNombre);
      if (error) throw new Error(error.message);
      // Actualizar reportes con empresa vieja
      await sb().from(T.REPORTES).update({ empresa: newNombre }).eq('empresa', oldNombre);
      return newNombre;
    } catch(e) { throw e; }
  }

  async function softDeleteEmpresa(nombre, deletedBy) {
    try {
      const { error } = await sb().from('empresas')
        .update({ is_active: false, deleted_at: nowISO(), deleted_by: deletedBy || 'sistema' })
        .eq('nombre', nombre);
      if (error) throw new Error(error.message);
      return true;
    } catch(e) { throw e; }
  }

  /* ─── Selectores (en app_config como JSON) ─────────────────── */
  async function getConfigKey(key, fallback) {
    try {
      const { data, error } = await sb().from(T.CONFIG).select('value').eq('key', key).maybeSingle();
      if (error || !data) return fallback;
      return data.value ?? fallback;
    } catch { return fallback; }
  }

  async function setConfigKey(key, value, updatedBy) {
    try {
      const { error } = await sb().from(T.CONFIG).upsert({ key, value, updated_by: updatedBy || 'sistema' });
      if (error) throw new Error(error.message);
      return value;
    } catch(e) { throw e; }
  }

  async function getSelectores() {
    return getConfigKey('gho_selectores', {});
  }

  async function saveSelectores(data) {
    return setConfigKey('gho_selectores', data, 'sistema');
  }

  async function upsertSelectorItem(empresa, modulo, valor, meta = {}) {
    try {
      const sels = await getSelectores() || {};
      if (!sels[empresa]) sels[empresa] = {};
      if (!sels[empresa][modulo]) sels[empresa][modulo] = [];
      if (Array.isArray(sels[empresa][modulo])) {
        if (!sels[empresa][modulo].includes(valor)) sels[empresa][modulo].push(valor);
      }
      await saveSelectores(sels);
      await logAudit({ usuario: meta.usuario, accion: 'CATALOG_ADD', tabla: 'selectores', valorNuevo: { empresa, modulo, valor } });
      return true;
    } catch(e) { throw e; }
  }

  async function deleteSelectorItem(empresa, modulo, valor, meta = {}) {
    try {
      const sels = await getSelectores() || {};
      if (!sels[empresa] || !sels[empresa][modulo]) return false;
      if (Array.isArray(sels[empresa][modulo])) {
        sels[empresa][modulo] = sels[empresa][modulo].filter(v => v !== valor);
      }
      await saveSelectores(sels);
      return true;
    } catch(e) { throw e; }
  }

  /* ─── Notificaciones ───────────────────────────────────────── */
  async function getNotificaciones() {
    try {
      const { data, error } = await sb().from(T.NOTIF).select('*').order('created_at', { ascending: false }).limit(200);
      if (error) return [];
      return (data || []).map(normalizeNotif);
    } catch { return []; }
  }

  async function saveNotificaciones(data) {
    // No-op en Supabase — se manejan individualmente
    return data;
  }

  async function createNotificacion(data) {
    try {
      const row = {
        tipo:       data.tipo    || '',
        titulo:     data.titulo  || data.tipo || '',
        mensaje:    data.mensaje || data.texto || data.detalle || '',
        destino:    data.destino || '',
        reporte_id: data.reporteId || data.reporte_id || null,
        leida:      false,
        payload:    data,
        fecha:      data.fecha || nowISO(),
      };
      const { data: inserted, error } = await sb().from(T.NOTIF).insert(row).select().single();
      if (error) throw new Error(error.message);
      return normalizeNotif(inserted);
    } catch(e) { throw e; }
  }

  async function markNotifRead(id) {
    try {
      const { error } = await sb().from(T.NOTIF).update({ leida: true }).eq('id', id);
      if (error) throw new Error(error.message);
      return true;
    } catch { return false; }
  }

  async function markNotifByReporte(reporteId) {
    try {
      const { data, error } = await sb().from(T.NOTIF).update({ leida: true }).eq('reporte_id', reporteId).eq('leida', false).select('id');
      return (data || []).length;
    } catch { return 0; }
  }

  async function markAllNotifRead(filter = null) {
    try {
      // Si no hay filtro, marca todas
      const { error } = await sb().from(T.NOTIF).update({ leida: true }).eq('leida', false);
      return !error;
    } catch { return false; }
  }

  /* ─── Sesión (en app_config) ───────────────────────────────── */
  async function getSession() {
    return getConfigKey('cctv_session', null);
  }

  async function saveSession(d) {
    return setConfigKey('cctv_session', d, 'sistema');
  }

  async function clearSession() {
    try {
      await sb().from(T.CONFIG).upsert({ key: 'cctv_session', value: null, updated_by: 'sistema' });
      return true;
    } catch { return false; }
  }

  /* ─── Auditoría ────────────────────────────────────────────── */
  async function getAudit() {
    try {
      const { data, error } = await sb()
        .from(T.AUDIT).select('*')
        .order('created_at', { ascending: false }).limit(500);
      if (error) return [];
      return (data || []).map(normalizeAudit);
    } catch { return []; }
  }

  async function saveAudit(data) {
    return data; // No-op — se insertan individualmente
  }

  async function logAudit({ usuario, accion, tabla, id, valorAnterior, valorNuevo, empresa }) {
    try {
      await sb().from(T.AUDIT).insert({
        usuario:        usuario || 'sistema',
        accion:         accion || '',
        tabla:          tabla  || '',
        registro_id:    id     || '',
        empresa:        empresa || '',
        valor_anterior: valorAnterior || null,
        valor_nuevo:    valorNuevo    || null,
      });
    } catch(e) {
      console.warn('[AUDIT] No se pudo registrar:', e.message);
    }
  }

  /* ─── Super admin / Recovery / Failed (en app_config) ──────── */
  async function getSuperAdmin()       { return getConfigKey('cctv_sa', null); }
  async function saveSuperAdmin(d)     { return setConfigKey('cctv_sa', d, 'sistema'); }
  async function getRecovery()         { return getConfigKey('cctv_recovery', null); }
  async function saveRecovery(d)       { return setConfigKey('cctv_recovery', d, 'sistema'); }
  async function clearRecovery()       { return setConfigKey('cctv_recovery', null, 'sistema'); }
  async function getFailedAttempts()   { return getConfigKey('cctv_failed_attempts', {}); }
  async function saveFailedAttempts(d) { return setConfigKey('cctv_failed_attempts', d, 'sistema'); }

  async function getUiSetting(key, fallback) { return getConfigKey(key, fallback); }
  async function saveUiSetting(key, value)   { return setConfigKey(key, value, 'sistema'); }

  async function hardResetAll(confirmedBy) {
    try {
      const keys = ['gho_empresas','gho_selectores','cctv_session','cctv_sa','cctv_recovery','cctv_failed_attempts'];
      for (const k of keys) {
        await sb().from(T.CONFIG).update({ value: null }).eq('key', k);
      }
      await sb().from(T.REPORTES).update({ is_active: false, deleted_at: nowISO(), deleted_by: confirmedBy || 'sistema' }).eq('is_active', true);
      await logAudit({ accion: 'SYSTEM_RESET', tabla: 'sistema', usuario: confirmedBy, valorNuevo: { confirmedBy } });
      return true;
    } catch(e) { throw e; }
  }

  /* ─── Exponer globalmente ──────────────────────────────────── */
  window.CCTV_SUPABASE = {
    config: { url: URL },
    getClient:              sb,
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
    resolveTable: (kind) => Promise.resolve(T[kind?.toUpperCase()] || kind),
  };

  window.CCTV_DB_ADAPTER = {
    testConnection,

    /* Usuarios */
    getUsers,
    getUsersActivos,
    getUserById,
    saveUsers,
    async createUser(data) {
      const r = await createManagedUser(data);
      if (!r.ok) throw new Error(r.error);
      return r.user;
    },
    async updateUser(userId, changes) {
      const r = await updateManagedUser(userId, changes);
      if (!r.ok) throw new Error(r.error);
      return r.user;
    },
    async softDeleteUser(userId, deletedBy) {
      const r = await softDeleteUser(userId, deletedBy);
      if (!r.ok) throw new Error(r.error);
      return true;
    },

    /* Reportes */
    getAllReportes,
    getAllReportesActivos,
    getReportesByEmpresa,
    getReporteById,
    createReporte,
    updateReporte,
    softDeleteReporte,
    softDeleteReportesByEmpresa,
    softDeleteAllReportes,

    /* Empresas */
    getEmpresas,
    saveEmpresas,
    createEmpresa,
    renameEmpresa,
    softDeleteEmpresa,

    /* Selectores */
    getSelectores,
    saveSelectores,
    upsertSelectorItem,
    deleteSelectorItem,

    /* Notificaciones */
    getNotificaciones,
    saveNotificaciones,
    createNotificacion,
    markNotifRead,
    markNotifByReporte,
    markAllNotifRead,

    /* Sesión */
    getSession,
    saveSession,
    clearSession,

    /* Auditoría */
    getAudit,
    saveAudit,
    _logAudit: logAudit,

    /* Config misc */
    getSuperAdmin,
    saveSuperAdmin,
    getRecovery,
    saveRecovery,
    clearRecovery,
    getFailedAttempts,
    saveFailedAttempts,
    getUiSetting,
    saveUiSetting,
    hardResetAll,
  };

})();
