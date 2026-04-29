/* ═══════════════════════════════════════════════
   CCTV Fleet Control — Auth Module v6.0
   Dispositivo único · Recuperación por código · Auditoría
═══════════════════════════════════════════════ */

/* ─── ROLES ─────────────────────────────────── */
const ROLES = {
  MASTER: 'master',
  ADMIN:  'admin',
  TECH:   'tecnico'
};

const ROLE_LABELS = {
  master:  'Administrador Master',
  admin:   'Administrador',
  tecnico: 'Técnico'
};

/* ─── SUPER ADMIN ────────────────────────────── */
const SUPER_ADMIN = {
  username: 'admin#.',
  bootstrapUsername: 'admin',
  bootstrapPassword: 'admin',
  email:    'ti.mesa.control@gmail.com',
  nombre:   'Administrador Principal'
};

/* ─── EMPRESAS DEFAULT ───────────────────────── */
const EMPRESAS_DEFAULT = ['GHO', 'ETN', 'AERS', 'AMEALSENSE'];

const AUTH_PROVIDER = 'local-demo';

function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase().replace(/\s+/g, '');
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isSupabaseMode() {
  return DS.isDatabaseMode() && !!window.CCTV_SUPABASE;
}

function buildInternalSession(user) {
  return {
    userId:     user.auth_user_id || user.id,
    username:   user.username,
    nombre:     user.nombre,
    role:       user.role,
    empresas:   Array.isArray(user.empresas) ? user.empresas : [],
    base:       user.base || '',
    loginAt:    new Date().toISOString(),
    firstLogin: user.firstLogin === true
  };
}

/* ─── ALMACENAMIENTO — usa dataService.js como capa única ────────
   DS es el único punto de contacto con el origen de datos.
   Para migrar a Supabase/API solo se cambia dataService.js.
────────────────────────────────────────────────────────────────── */
const AUTH_CACHE = {
  loaded: false,
  users: { list: [] },
  session: null,
  audit: [],
  superAdmin: null,
  recovery: null,
  failedAttempts: {},
};

async function loadAuthCache(force = false) {
  if (AUTH_CACHE.loaded && !force) return AUTH_CACHE;

  const [users, session, audit, superAdmin, recovery, failedAttempts] = await Promise.all([
    DS.getUsers(),
    DS.getSession(),
    DS.getAudit(),
    DS.getSuperAdmin(),
    DS.getRecovery(),
    DS.getFailedAttempts(),
  ]);

  AUTH_CACHE.users = users || { list: [] };
  AUTH_CACHE.session = session || null;
  AUTH_CACHE.audit = audit || [];
  AUTH_CACHE.superAdmin = superAdmin || null;
  AUTH_CACHE.recovery = recovery || null;
  AUTH_CACHE.failedAttempts = failedAttempts || {};
  AUTH_CACHE.loaded = true;
  return AUTH_CACHE;
}

function getCachedUsersStore() {
  return AUTH_CACHE.users || { list: [] };
}

function getCachedSession() {
  return AUTH_CACHE.session || null;
}

function getCachedAudit() {
  return AUTH_CACHE.audit || [];
}

function getCachedSuperAdmin() {
  return AUTH_CACHE.superAdmin || null;
}

async function saveUsersStore(data) {
  AUTH_CACHE.users = data || { list: [] };
  AUTH_CACHE.loaded = true;
  await DS.saveUsers(AUTH_CACHE.users);
  return AUTH_CACHE.users;
}

async function saveSessionStore(data) {
  AUTH_CACHE.session = data || null;
  AUTH_CACHE.loaded = true;
  await DS.saveSession(AUTH_CACHE.session);
  return AUTH_CACHE.session;
}

async function saveSuperAdminStore(data) {
  AUTH_CACHE.superAdmin = data || null;
  AUTH_CACHE.loaded = true;
  await DS.saveSuperAdmin(AUTH_CACHE.superAdmin);
  return AUTH_CACHE.superAdmin;
}

async function saveRecoveryStore(data) {
  AUTH_CACHE.recovery = data || null;
  AUTH_CACHE.loaded = true;
  await DS.saveRecovery(AUTH_CACHE.recovery);
  return AUTH_CACHE.recovery;
}

async function clearRecoveryStore() {
  AUTH_CACHE.recovery = null;
  AUTH_CACHE.loaded = true;
  await DS.clearRecovery();
}

async function clearSessionStore() {
  AUTH_CACHE.session = null;
  AUTH_CACHE.loaded = true;
  await DS.clearSession();
}

const STORE = {
  users:       () => getCachedUsersStore(),
  session:     () => getCachedSession(),
  audit:       () => getCachedAudit(),
  superAdmin:  () => getCachedSuperAdmin(),
  recoverCode: () => AUTH_CACHE.recovery || null,
  failedAttempts: () => AUTH_CACHE.failedAttempts || {},

  saveUsers:          (d) => saveUsersStore(d),
  saveSession:        (d) => saveSessionStore(d),
  saveAudit: async (d) => {
    AUTH_CACHE.audit = d || [];
    AUTH_CACHE.loaded = true;
    return DS.saveAudit(AUTH_CACHE.audit);
  },
  saveSuperAdmin:     (d) => saveSuperAdminStore(d),
  saveRecoverCode:    (d) => saveRecoveryStore(d),
  saveFailedAttempts: async (d) => {
    AUTH_CACHE.failedAttempts = d || {};
    AUTH_CACHE.loaded = true;
    return DS.saveFailedAttempts(AUTH_CACHE.failedAttempts);
  },

  clearSession:       () => clearSessionStore(),
  clearRecoverCode:   () => clearRecoveryStore(),
};

async function hashPassword(password) {
  if (!window.crypto?.subtle) return `local-demo:${password}`;
  const data = new TextEncoder().encode(password);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return `sha256:${hashArray.map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

async function verifyPassword(user, plainPassword) {
  if (!user) return false;
  if (user.password_hash) {
    return (await hashPassword(plainPassword)) === user.password_hash;
  }
  return user.password === plainPassword;
}

async function buildStoredPasswordFields(password) {
  return {
    password_hash: await hashPassword(password),
    auth_provider: AUTH_PROVIDER,
    password: undefined
  };
}

async function persistSession(session) {
  AUTH_CACHE.session = session || null;
  AUTH_CACHE.loaded = true;
  await DS.saveSession(session);
  return session;
}

/* ─── HUELLA DE DISPOSITIVO ──────────────────── */
function generateDeviceFingerprint() {
  const ua      = navigator.userAgent;
  const lang    = navigator.language || '';
  const tz      = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  const screen_ = `${screen.width}x${screen.height}x${screen.colorDepth}`;
  const cores   = navigator.hardwareConcurrency || 0;
  const mem     = navigator.deviceMemory || 0;
  const plugins = Array.from(navigator.plugins || []).map(p => p.name).join(',');

  const raw = [ua, lang, tz, screen_, cores, mem, plugins].join('|');

  // Simple non-crypto hash (djb2)
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash) ^ raw.charCodeAt(i);
    hash = hash >>> 0; // unsigned
  }
  return 'fp_' + hash.toString(36);
}

/* ─── INICIALIZAR USUARIOS ───────────────────── */
function initUsers() {
  const users = getCachedUsersStore();
  if (users && Array.isArray(users.list)) return users;
  AUTH_CACHE.users = { list: [] };
  return AUTH_CACHE.users;
}

/* ════════════════════════════════════════════════
   SUPER ADMIN — Acceso de primer dispositivo
════════════════════════════════════════════════ */

function getSuperAdminRecord() {
  return getCachedSuperAdmin();
}

function isInitialAdminUsername(username) {
  return normalizeUsername(username) === normalizeUsername(SUPER_ADMIN.bootstrapUsername);
}

function isFinalMasterUsername(username) {
  return normalizeUsername(username) === normalizeUsername(SUPER_ADMIN.username);
}

function isSuperAdminUsername(username) {
  return isFinalMasterUsername(username);
}

async function getInitialMasterUser() {
  const users = await DS.getUsers();
  const list = Array.isArray(users?.list) ? users.list : [];
  const normalizedAdmin = normalizeUsername(SUPER_ADMIN.username);
  return list.find(u =>
    normalizeUsername(u?.username) === normalizedAdmin &&
    u.role === ROLES.MASTER &&
    u.is_active !== false &&
    u.activo !== false
  ) || null;
}

/* Verifica si el dispositivo actual es el autorizado */
function isAuthorizedDevice() {
  const sa = getSuperAdminRecord();
  if (!sa || !sa.authorizedDevice) return false;
  return generateDeviceFingerprint() === sa.authorizedDevice;
}

/* Registrar intento fallido de dispositivo no autorizado */
async function recordFailedAttempt(username, reason) {
  const fp      = generateDeviceFingerprint();
  const data    = await DS.getFailedAttempts();
  const key     = fp;
  if (!data[key]) data[key] = [];
  data[key].push({ username, reason, fecha: new Date().toISOString() });
  if (data[key].length > 100) data[key].splice(0, data[key].length - 100);
  await DS.saveFailedAttempts(data);
  AUTH_CACHE.failedAttempts = data;
  AUTH_CACHE.loaded = true;
  await authLog('UNAUTHORIZED_ATTEMPT', `Intento no autorizado: ${username} — ${reason}`, 'sistema');
}

/* ─── LOGIN SUPER ADMIN ──────────────────────── */
async function authLoginSuperAdmin(username, password) {
  await loadAuthCache();
  if (!isSuperAdminUsername(username)) return null;

  const fp = generateDeviceFingerprint();
  const sa = getSuperAdminRecord();

  // ── Primera vez: ningún registro SA ────────────
  if (!sa) {
    if (password !== SUPER_ADMIN.password) {
      return { ok: false, error: 'Usuario o contraseña incorrectos' };
    }
    const newSA = {
      authorizedDevice: fp,
      password_hash:    await hashPassword(SUPER_ADMIN.password),
      auth_provider:    AUTH_PROVIDER,
      registeredAt:     new Date().toISOString(),
      nombre:           SUPER_ADMIN.nombre,
      email:            SUPER_ADMIN.email
    };
    await STORE.saveSuperAdmin(newSA);
    await authLog('SA_FIRST_LOGIN', 'Primer acceso super admin — Dispositivo registrado', 'admin#.');
    return { ok: true, isSuperAdmin: true, session: _buildSASession() };
  }

  // ── SA ya existe — validar con contraseña actual (puede haber cambiado) ──
  const matchesSAPassword = sa.password_hash
    ? (await hashPassword(password)) === sa.password_hash
    : password === (sa.password || SUPER_ADMIN.password);
  if (!matchesSAPassword) {
    await recordFailedAttempt(username, 'Contraseña incorrecta');
    return { ok: false, error: 'Usuario o contraseña incorrectos' };
  }

  // ── Verificar dispositivo ───────────────────────
  if (sa.authorizedDevice === fp) {
    await authLog('SA_LOGIN', 'Inicio de sesión super admin', 'admin#.');
    return { ok: true, isSuperAdmin: true, session: _buildSASession() };
  }

  // Dispositivo diferente — BLOQUEAR
  await recordFailedAttempt(username, 'Dispositivo no autorizado');
  return {
    ok: false,
    blocked: true,
    error: 'Acceso restringido. Solo el administrador principal puede ingresar desde el dispositivo autorizado.'
  };
}

function _buildSASession() {
  const sa = getSuperAdminRecord();
  return {
    userId:    'u_super_admin',
    username:  'admin#.',
    nombre:    sa ? sa.nombre : SUPER_ADMIN.nombre,
    role:      ROLES.MASTER,
    empresas:  [...EMPRESAS_DEFAULT],
    base:      '',
    loginAt:   new Date().toISOString(),
    isSuperAdmin: true
  };
}


/* ─── BOOTSTRAP ADMIN INICIAL COMO USUARIO NORMAL ───────────────
   Corrige la lógica anterior donde el admin inicial vivía separado en cctv_sa.
   Ahora el primer acceso crea un usuario real en cctv_users con rol master.
   Así los permisos siguen dependiendo del rol, no de una contraseña fija ni dispositivo.
──────────────────────────────────────────────────────────────── */
async function ensureInitialMasterUser(username, password) {
  if (!isInitialAdminUsername(username)) return null;

  const existingAdmin = await getInitialMasterUser();
  if (existingAdmin) return null;
  if (password !== SUPER_ADMIN.bootstrapPassword) return null;

  const initialUser = {
    username: normalizeUsername(SUPER_ADMIN.username),
    nombre: SUPER_ADMIN.nombre,
    email: '',
    telefono: '',
    fechaNacimiento: '',
    empleadoId: '',
    role: ROLES.MASTER,
    empresas: [...EMPRESAS_DEFAULT],
    base: '',
    activo: true,
    is_active: true,
    firstLogin: true,
    createdAt: new Date().toISOString(),
    createdBy: 'bootstrap'
  };
  Object.assign(initialUser, await buildStoredPasswordFields(SUPER_ADMIN.bootstrapPassword));

  if (isSupabaseMode()) {
    const bootstrapSession = {
      userId: 'bootstrap_master_pending',
      username: SUPER_ADMIN.username,
      nombre: SUPER_ADMIN.nombre,
      role: ROLES.MASTER,
      empresas: [...EMPRESAS_DEFAULT],
      base: '',
      loginAt: new Date().toISOString(),
      firstLogin: true,
      bootstrapMaster: true
    };
    await persistSession(bootstrapSession);
    await authLog('BOOTSTRAP_MASTER_PENDING', 'Primer acceso Administrador Master pendiente de completar perfil Supabase', SUPER_ADMIN.username);
    return { ok: true, user: bootstrapSession, session: bootstrapSession, bootstrapMaster: true };
  }

  const created = await DS.createUser({ ...initialUser, _createdBy: 'bootstrap' });
  AUTH_CACHE.users = await DS.getUsers();
  AUTH_CACHE.loaded = true;
  await authLog('BOOTSTRAP_MASTER', 'Administrador Master inicial creado con usuario temporal admin/admin', created.username);
  return { ok: true, user: created };
}

/* ─── LOGIN NORMAL ───────────────────────────── */
async function authLogin(username, password) {
  await loadAuthCache();

  // En modo Supabase, si intentan entrar con "admin"/"admin" y el master ya existe,
  // informar que deben usar "admin#." con su contraseña configurada.
  if (isSupabaseMode() && isInitialAdminUsername(username)) {
    const existingAdmin = await getInitialMasterUser();
    if (existingAdmin) {
      return { ok: false, error: 'El Administrador Master ya fue configurado. Ingresa con usuario: admin#.' };
    }
    // Si no existe, continuar con bootstrap normal (para reinstalación limpia)
  }

  const bootstrap = await ensureInitialMasterUser(username, password);
  if (bootstrap && !bootstrap.ok) return bootstrap;
  if (bootstrap && bootstrap.ok && bootstrap.user) {
    const session = bootstrap.session || buildInternalSession(bootstrap.user);
    await persistSession(session);
    return { ok: true, session, firstLogin: true };
  }

  if (isSupabaseMode()) {
    const result = await window.CCTV_SUPABASE.signInWithUsername(username, password);
    if (!result.ok) return result;

    const user = result.profile;
    const session = buildInternalSession(user);
    await persistSession(session);

    if (!user.firstLogin) {
      await authLog('LOGIN', `Inicio de sesiÃ³n de ${user.nombre}`, user.username);
    }

    AUTH_CACHE.users = await DS.getUsers();
    AUTH_CACHE.loaded = true;
    return { ok: true, session, firstLogin: user.firstLogin === true };
  }

  const users = await DS.getUsers();
  const normalized = normalizeUsername(username);
  const candidates = users.list.filter(u =>
    normalizeUsername(u.username) === normalized &&
    u.activo !== false &&
    u.is_active !== false
  );
  let user = null;
  for (const candidate of candidates) {
    if (await verifyPassword(candidate, password)) {
      user = candidate;
      break;
    }
  }

  if (!user) return { ok: false, error: 'Usuario o contraseña incorrectos' };

  if (!user.password_hash) {
    const migratedFields = await buildStoredPasswordFields(password);
    Object.assign(user, migratedFields);
    await DS.updateUser(user.id, migratedFields, { usuario: user.username });
  }

  const session = buildInternalSession(user);

  await persistSession(session);

  if (!user.firstLogin) {
    await authLog('LOGIN', `Inicio de sesión de ${user.nombre}`, user.username);
  }

  AUTH_CACHE.users = await DS.getUsers();
  AUTH_CACHE.loaded = true;
  return { ok: true, session, firstLogin: user.firstLogin === true };
}

/* ─── CAMBIAR CONTRASEÑA SUPER ADMIN ─────────── */
async function authChangeSAPassword(newPass) {
  await loadAuthCache();
  const sa = getSuperAdminRecord();
  if (!sa) return { ok: false, error: 'Super admin no configurado' };
  if (!isAuthorizedDevice()) return { ok: false, error: 'Dispositivo no autorizado' };

  sa.password = newPass;
  sa.password_hash = await hashPassword(newPass);
  sa.auth_provider = AUTH_PROVIDER;
  delete sa.password;
  await STORE.saveSuperAdmin(sa);

  // Actualizar sesión activa
  const session = STORE.session();
  if (session && session.isSuperAdmin) await persistSession(session);

  await authLog('SA_PASS_CHANGE', 'Contraseña de super admin actualizada', 'admin#.');
  return { ok: true };
}

/* ─── RESETEAR DISPOSITIVO AUTORIZADO ────────── */
async function authResetAuthorizedDevice(newDeviceFingerprint) {
  await loadAuthCache();
  const session = STORE.session();
  if (!session || !session.isSuperAdmin || !isAuthorizedDevice())
    return { ok: false, error: 'Sin permisos o dispositivo no autorizado' };

  const sa = getSuperAdminRecord();
  if (!sa) return { ok: false, error: 'No hay registro de super admin' };

  const oldFP = sa.authorizedDevice;
  sa.authorizedDevice = newDeviceFingerprint || generateDeviceFingerprint();
  sa.resetAt = new Date().toISOString();
  await STORE.saveSuperAdmin(sa);

  await authLog('SA_DEVICE_RESET', `Dispositivo autorizado restablecido`, 'admin#.');
  return { ok: true };
}

/* ════════════════════════════════════════════════
   RECUPERACIÓN DE CONTRASEÑA
   (genera código temporal, valida, redirige)
════════════════════════════════════════════════ */

const RECOVERY_EXPIRY_MS = 10 * 60 * 1000; // 10 minutos
const RECOVERY_MAX_ATTEMPTS = 5;

/* Genera y "envía" (simula) el código al correo del SA */
async function authRequestRecoveryCode(emailInput = '') {
  await loadAuthCache();
  const master = await getInitialMasterUser();
  if (!master || master.firstLogin === true) {
    return { ok: false, error: 'Primero configura el Administrador Master con usuario admin y contraseña admin.' };
  }

  const registeredEmail = normalizeEmail(master.email);
  const providedEmail = normalizeEmail(emailInput);
  if (!registeredEmail) return { ok: false, error: 'El Administrador Master no tiene correo registrado.' };
  if (!providedEmail) return { ok: false, error: 'Ingresa el correo electrónico registrado.' };
  if (providedEmail !== registeredEmail) {
    await authLog('SA_RECOVERY_EMAIL_FAIL', 'Correo de recuperación no coincide', SUPER_ADMIN.username);
    return { ok: false, error: 'El correo no coincide con el registrado para el Administrador Master.' };
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const record = {
    username: SUPER_ADMIN.username,
    userId: master.id || master.auth_user_id,
    code,
    expiresAt: Date.now() + RECOVERY_EXPIRY_MS,
    attempts: 0,
    used: false
  };

  await STORE.saveRecoverCode(record);
  await authLog('SA_RECOVERY_REQUESTED', 'Código de recuperación generado', SUPER_ADMIN.username);

  return { ok: true, email: maskEmail(registeredEmail), code, expiresInMin: RECOVERY_EXPIRY_MS / 60000 };
}
function maskEmail(email) {
  if (!email) return '***@***.***';
  const [user, domain] = email.split('@');
  const maskedUser = user.length <= 3
    ? user[0] + '***'
    : user.slice(0, 3) + '*'.repeat(Math.min(user.length - 3, 5));
  return `${maskedUser}@${domain}`;
}

/* Valida el código de recuperación */
async function authValidateRecoveryCode(inputCode) {
  await loadAuthCache();
  const rec = await DS.getRecovery();
  if (!rec) return { ok: false, error: 'No hay código de recuperación activo' };
  if (rec.used)  return { ok: false, error: 'El código ya fue utilizado' };
  if (Date.now() > rec.expiresAt)
    return { ok: false, error: 'El código ha expirado. Solicita uno nuevo.' };

  rec.attempts = (rec.attempts || 0) + 1;

  if (rec.attempts > RECOVERY_MAX_ATTEMPTS) {
    await STORE.clearRecoverCode();
    await authLog('SA_RECOVERY_BLOCKED', 'Demasiados intentos de código — código invalidado', 'admin#.');
    return { ok: false, error: 'Demasiados intentos fallidos. Solicita un nuevo código.' };
  }

  if (inputCode.trim() !== rec.code) {
    await STORE.saveRecoverCode(rec);
    const left = RECOVERY_MAX_ATTEMPTS - rec.attempts;
    return { ok: false, error: `Código incorrecto. Intentos restantes: ${left}` };
  }

  // Código correcto
  rec.used = true;
  await STORE.saveRecoverCode(rec);
  await authLog('SA_RECOVERY_VALIDATED', 'Código de recuperación validado', SUPER_ADMIN.username);
  const master = await getInitialMasterUser();
  if (!master) return { ok: false, error: 'Administrador Master no encontrado' };

  const tempSession = { ...buildInternalSession(master), recoveryMode: true };
  await persistSession(tempSession);

  return { ok: true };
}

/* Establece nueva contraseña tras recuperación */
async function authSetRecoveredPassword(newPass) {
  await loadAuthCache();
  const session = STORE.session();
  if (!session || !session.recoveryMode)
    return { ok: false, error: 'Sesión de recuperación inválida' };

  const master = await getInitialMasterUser();
  if (!master) return { ok: false, error: 'Administrador Master no encontrado' };

  const passwordFields = await buildStoredPasswordFields(newPass);
  await DS.updateUser(master.id || master.auth_user_id, { ...passwordFields, firstLogin: false, first_login: false }, { usuario: SUPER_ADMIN.username });
  AUTH_CACHE.users = await DS.getUsers();
  await STORE.clearRecoverCode();

  delete session.recoveryMode;
  session.firstLogin = false;
  await persistSession(session);

  await authLog('SA_PASS_RECOVERED', 'Contraseña restablecida mediante recuperación', SUPER_ADMIN.username);
  return { ok: true };
}

/* ─── CAMBIAR CONTRASEÑA (primer login usuarios normales) ── */
async function authSetPassword(newPass, profileData = {}) {
  await loadAuthCache();
  const session = STORE.session();
  if (!session) return { ok: false, error: 'Sesion invalida' };

  if (session.isSuperAdmin) return authChangeSAPassword(newPass);

  if (isSupabaseMode()) {
    if (session.bootstrapMaster) {
      const cleanProfile = {
        nombre: String(profileData.nombre || SUPER_ADMIN.nombre || "").trim(),
        base: String(profileData.base || "").trim(),
        email: normalizeEmail(profileData.email || ""),
        telefono: String(profileData.telefono || "").trim(),
        fechaNacimiento: String(profileData.fechaNacimiento || "").trim(),
        empleadoId: String(profileData.empleadoId || "").trim()
      };
      if (!cleanProfile.email) return { ok: false, error: "El correo es obligatorio para crear el Administrador Master en Supabase" };
      const createResult = await window.CCTV_SUPABASE.createManagedUser({
        username: SUPER_ADMIN.username,
        password: newPass,
        role: ROLES.MASTER,
        empresas: [...EMPRESAS_DEFAULT],
        activo: true,
        firstLogin: false,
        createdBy: "bootstrap",
        ...cleanProfile
      });
      if (!createResult.ok) return createResult;
      const loginResult = await window.CCTV_SUPABASE.signInWithUsername(SUPER_ADMIN.username, newPass);
      if (!loginResult.ok) return loginResult;
      const finalSession = buildInternalSession(loginResult.profile);
      finalSession.firstLogin = false;
      await persistSession(finalSession);
      AUTH_CACHE.users = await DS.getUsers();
      AUTH_CACHE.loaded = true;
      await authLog("BOOTSTRAP_MASTER_COMPLETE", "Administrador Master creado en Supabase", SUPER_ADMIN.username);
      return { ok: true };
    }

    const result = await window.CCTV_SUPABASE.setPasswordForCurrentUser(newPass);
    if (!result.ok) return result;

    const user = await DS.getUserById(session.userId);
    if (user) {
      await DS.updateUser(user.id, { ...profileData, firstLogin: false, first_login: false }, { usuario: session.username });
      AUTH_CACHE.users = await DS.getUsers();
    }

    session.firstLogin = false;
    await persistSession(session);

    await authLog('PASS_CHANGE', `Contrasena establecida en primer inicio de sesion`, session.username);
    return { ok: true };
  }

  const users = STORE.users();
  const user  = users.list.find(u => u.id === session.userId);
  if (!user)  return { ok: false, error: 'Usuario no encontrado' };

  const passwordFields = await buildStoredPasswordFields(newPass);
  const cleanProfile = {
    nombre: String(profileData.nombre || user.nombre || '').trim(),
    base: String(profileData.base || user.base || '').trim(),
    email: normalizeEmail(profileData.email || user.email || ''),
    telefono: String(profileData.telefono || user.telefono || '').trim(),
    fechaNacimiento: String(profileData.fechaNacimiento || user.fechaNacimiento || '').trim(),
    empleadoId: String(profileData.empleadoId || user.empleadoId || '').trim()
  };
  user.firstLogin = false;
  Object.assign(user, cleanProfile, passwordFields);
  await DS.updateUser(user.id, { ...cleanProfile, ...passwordFields, firstLogin: false, first_login: false }, { usuario: user.username });
  AUTH_CACHE.users = await DS.getUsers();

  session.firstLogin = false;
  if (typeof cleanProfile !== "undefined") {
    session.nombre = cleanProfile.nombre || session.nombre;
    session.base = cleanProfile.base || session.base;
  }
  await persistSession(session);

  await authLog('PASS_CHANGE', `Contrasena establecida en primer inicio de sesion`, user.username);
  return { ok: true };
}

/* ─── LOGOUT ─────────────────────────────────── */
async function authLogout() {
  await loadAuthCache();
  const session = STORE.session();
  if (session) await authLog('LOGOUT', `Cierre de sesion de ${session.nombre}`, session.username);
  if (isSupabaseMode()) {
    await window.CCTV_SUPABASE.signOut().catch(err => console.warn('No se pudo cerrar sesion Supabase:', err));
  }
  await STORE.clearSession();
}

/* ─── VALIDAR SESIÓN ACTIVA ──────────────────── */
function authCheckSession() {
  const session = STORE.session();
  if (!session) return null;

  // Si es super admin en modo local, verificar que el dispositivo sigue siendo el autorizado
  if (session.isSuperAdmin && !session.recoveryMode && !isSupabaseMode()) {
    if (!isAuthorizedDevice()) {
      AUTH_CACHE.session = null;
      void DS.clearSession().catch(err => console.error('No se pudo limpiar sesión:', err));
      return null;
    }
  }
  return session;
}

async function authCheckSessionAsync() {
  await loadAuthCache(true);
  const session = STORE.session();
  if (!session) return null;
  if (session.isSuperAdmin && !session.recoveryMode && !isSupabaseMode() && !isAuthorizedDevice()) {
    await clearSessionStore();
    return null;
  }
  if (isSupabaseMode() && !session.isSuperAdmin && !session.bootstrapMaster) {
    const authSession = await window.CCTV_SUPABASE.getAuthSession().catch(() => null);
    if (!authSession || !authSession.user) {
      await clearSessionStore();
      return null;
    }
    if (session.userId !== authSession.user.id) {
      const profile = await window.CCTV_SUPABASE.getUserById(authSession.user.id).catch(() => null);
      if (!profile || profile.activo === false || profile.is_active === false) {
        await clearSessionStore();
        return null;
      }
      const syncedSession = buildInternalSession(profile);
      await persistSession(syncedSession);
      return syncedSession;
    }
  }
  return session;
}

/* ─── PERMISOS ───────────────────────────────── */
function authCan(action) {
  const s = STORE.session();
  if (!s) return false;
  const r = s.role;

  const perms = {
    manageUsers:         r === ROLES.MASTER,
    manageRoles:         r === ROLES.MASTER,
    viewAudit:           r === ROLES.MASTER,
    changeStatus:        r === ROLES.MASTER,
    createMaster:        r === ROLES.MASTER,
    resetPassword:       r === ROLES.MASTER,
    configEmpresaAccess: r === ROLES.MASTER,
    resetDevice:         r === ROLES.MASTER && (s.isSuperAdmin === true),

    editReports:   r === ROLES.MASTER || r === ROLES.ADMIN,
    addReports:    r === ROLES.MASTER || r === ROLES.ADMIN,
    viewDashboard: r === ROLES.MASTER || r === ROLES.ADMIN,
    viewConfig:    r === ROLES.MASTER || r === ROLES.ADMIN,
    exportData:    r === ROLES.MASTER || r === ROLES.ADMIN,

    viewAttention: true,
  };

  return perms[action] === true;
}

/* ─── GESTIÓN DE USUARIOS ────────────────────── */
async function authCreateUser(data) {
  await loadAuthCache();
  const session = STORE.session();
  if (!session || session.role !== ROLES.MASTER)
    return { ok: false, error: 'Sin permisos' };

  const username = normalizeUsername(data.username);
  const email = normalizeEmail(data.email);
  const users = await DS.getUsers();
  if (users.list.find(u => u.username === username))
    return { ok: false, error: 'El nombre de usuario ya existe' };

  if (isSupabaseMode()) {
    if (!email) return { ok: false, error: 'El correo es obligatorio en modo Supabase' };
    const result = await window.CCTV_SUPABASE.createManagedUser({
      nombre: data.nombre,
      username,
      password: data.password,
      role: data.role,
      empresas: data.empresas || [...EMPRESAS_DEFAULT],
      base: data.base || '',
      email,
      activo: true,
      firstLogin: true,
      createdBy: session.username
    });
    if (!result.ok) return result;
    AUTH_CACHE.users = await DS.getUsers();
    await authLog('USER_CREATE', `Usuario creado: ${result.user.nombre} (${ROLE_LABELS[result.user.role]})`, session.username);
    return { ok: true, user: result.user };
  }

  const newUser = {
    username,
    role:       data.role,
    empresas:   data.empresas || [...EMPRESAS_DEFAULT],
    base:       data.base || '',
    nombre:     data.nombre.trim(),
    email,
    activo:     true,
    firstLogin: true,
    createdAt:  new Date().toISOString(),
    createdBy:  session.username
  };
  Object.assign(newUser, await buildStoredPasswordFields(data.password));
  const created = await DS.createUser({ ...newUser, _createdBy: session.username });
  AUTH_CACHE.users = await DS.getUsers();
  await authLog('USER_CREATE', `Usuario creado: ${created.nombre} (${ROLE_LABELS[created.role]})`, session.username);
  return { ok: true, user: created };
}

async function authUpdateUser(userId, data) {
  await loadAuthCache();
  const session = STORE.session();
  if (!session || session.role !== ROLES.MASTER)
    return { ok: false, error: 'Sin permisos' };

  const users = await DS.getUsers();
  const idx   = users.list.findIndex(u => (u.id === userId || u.auth_user_id === userId));
  if (idx < 0) return { ok: false, error: 'Usuario no encontrado' };

  const old = { ...users.list[idx] };

  if (old.role === ROLES.MASTER && data.role && data.role !== ROLES.MASTER) {
    const masterCount = users.list.filter(u => u.role === ROLES.MASTER && u.activo).length;
    if (masterCount <= 1) return { ok: false, error: 'Debe existir al menos un Administrador Master' };
  }

  const changes = { ...data, id: userId };
  if (Object.prototype.hasOwnProperty.call(changes, 'email')) {
    changes.email = normalizeEmail(changes.email);
  }
  await DS.updateUser(userId, changes, { usuario: session.username });
  AUTH_CACHE.users = await DS.getUsers();
  Object.assign(users.list[idx], changes);
  await authLog('USER_EDIT', `Usuario editado: ${users.list[idx].nombre}`, session.username);

  return { ok: true };
}

async function authToggleUser(userId) {
  await loadAuthCache();
  const session = STORE.session();
  if (!session || session.role !== ROLES.MASTER)
    return { ok: false, error: 'Sin permisos' };

  const users = await DS.getUsers();
  const user  = users.list.find(u => u.id === userId);
  if (!user) return { ok: false, error: 'Usuario no encontrado' };
  if (user.id === session.userId) return { ok: false, error: 'No puedes desactivarte a ti mismo' };

  if (user.role === ROLES.MASTER && user.activo !== false && user.is_active !== false) {
    const activeMasterCount = users.list.filter(u =>
      u.role === ROLES.MASTER && u.activo !== false && u.is_active !== false
    ).length;
    if (activeMasterCount <= 1) return { ok: false, error: 'Debe existir al menos un Administrador Master activo' };
  }

  user.activo = !user.activo;
  await DS.updateUser(userId, { activo: user.activo, is_active: user.activo }, { usuario: session.username });
  AUTH_CACHE.users = await DS.getUsers();
  const accion = user.activo ? 'activado' : 'desactivado';
  await authLog('USER_STATUS', `Usuario ${accion}: ${user.nombre}`, session.username);

  return { ok: true, activo: user.activo };
}

async function authResetPassword(userId, newPass) {
  await loadAuthCache();
  const session = STORE.session();
  if (!session || session.role !== ROLES.MASTER)
    return { ok: false, error: 'Sin permisos' };

  const users = await DS.getUsers();
  const user  = users.list.find(u => u.id === userId || u.auth_user_id === userId);
  if (!user) return { ok: false, error: 'Usuario no encontrado' };

  if (isSupabaseMode()) {
    if (!user.email) return { ok: false, error: 'El usuario no tiene correo registrado para Supabase Auth' };
    const result = await window.CCTV_SUPABASE.requestPasswordReset(user.email);
    if (!result.ok) return result;
    await authLog('PASS_RESET', `Correo de restablecimiento enviado para: ${user.nombre}`, session.username);
    return { ok: true, message: result.message };
  }

  const passwordFields = await buildStoredPasswordFields(newPass);
  Object.assign(user, passwordFields);
  await DS.updateUser(userId, { ...passwordFields, firstLogin: true, first_login: true }, { usuario: session.username });
  AUTH_CACHE.users = await DS.getUsers();
  await authLog('PASS_RESET', `Contrasena restablecida para: ${user.nombre}`, session.username);

  return { ok: true };
}

async function authDeleteUser(userId) {
  await loadAuthCache();
  const session = STORE.session();
  if (!session || session.role !== ROLES.MASTER)
    return { ok: false, error: 'Sin permisos' };

  const users = await DS.getUsers();
  const idx   = users.list.findIndex(u => u.id === userId);
  if (idx < 0) return { ok: false, error: 'Usuario no encontrado' };

  const user = users.list[idx];
  if (user.id === session.userId) return { ok: false, error: 'No puedes eliminarte a ti mismo' };

  if (user.role === ROLES.MASTER) {
    const masterCount = users.list.filter(u => u.role === ROLES.MASTER && u.activo && u.is_active !== false).length;
    if (masterCount <= 1) return { ok: false, error: 'Debe existir al menos un Administrador Master' };
  }

  // Borrado lógico: no se elimina el registro
  await DS.softDeleteUser(userId, session.username);
  AUTH_CACHE.users = await DS.getUsers();
  await authLog('USER_DELETE', `Usuario eliminado (soft): ${user.nombre}`, session.username);

  return { ok: true };
}

function authGetUsers() {
  const users = initUsers();
  return users.list.filter(u => u && u.is_active !== false);
}

async function authGetUsersAsync() {
  await loadAuthCache();
  const users = await DS.getUsers();
  return users.list.filter(u => u && u.is_active !== false);
}

function authGetUser(userId) {
  const users = initUsers();
  return users.list.find(u => u.id === userId && u.is_active !== false) || null;
}

async function authGetUserAsync(userId) {
  await loadAuthCache();
  const user = await DS.getUserById(userId);
  return user && user.is_active !== false ? user : null;
}

/* ─── AUDITORÍA ──────────────────────────────── */
async function authLog(tipo, detalle, usuario) {
  const session = STORE.session();
  const entry = {
    usuario: usuario || (session ? session.username : 'sistema'),
    accion: tipo,
    tabla: 'auth',
    valorNuevo: {
      tipo,
      detalle,
      nombre: session ? session.nombre : 'Sistema',
      fecha: new Date().toISOString()
    }
  };
  await DS.logAudit(entry);
  AUTH_CACHE.audit = await DS.getAudit();
  AUTH_CACHE.loaded = true;
}

function authGetAudit(limit = 200) {
  const audit = STORE.audit();
  return audit.slice(0, limit).map(a => ({
    ...a,
    tipo: a.tipo || a.accion || 'AUDIT',
    detalle: a.detalle || a.tabla || a.registro_id || '',
    fecha: a.fecha || a.created_at || new Date().toISOString(),
    usuario: a.usuario || 'sistema',
    nombre: a.nombre || a.usuario || 'Sistema'
  }));
}

/* ─── REDIRECCIÓN ────────────────────────────── */
function authRedirect(session) {
  if (!session) { window.location.href = 'index.html'; return; }

  switch (session.role) {
    case ROLES.MASTER:
    case ROLES.ADMIN:
      window.location.href = 'app.html';
      break;
    case ROLES.TECH:
    case 'tecnico':
      window.location.href = 'tecnico.html';
      break;
    default:
      window.location.href = 'index.html';
  }
}

/* ─── DEVICE / IP TRACKING ───────────────────── */
async function authTrackDeviceInfo() {
  await loadAuthCache();
  const session = STORE.session();
  if (!session) return;

  const ua = navigator.userAgent;
  let deviceType = 'Desktop';
  if (/Mobi|Android/i.test(ua)) deviceType = 'Móvil';
  else if (/Tablet|iPad/i.test(ua)) deviceType = 'Tablet';

  let browser = 'Desconocido';
  if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Edg/i.test(ua)) browser = 'Edge';

  const screenRes = `${screen.width}×${screen.height}`;
  const deviceLabel = `${deviceType} · ${browser} · ${screenRes}`;

  session.deviceType = deviceType;
  session.browser    = browser;
  session.screenRes  = screenRes;
  session.loginAt    = session.loginAt || new Date().toISOString();
  await persistSession(session);

  const audit = await DS.getAudit();
  const lastLogin = audit.find(a => a.tipo === 'LOGIN' && a.usuario === session.username);
  if (lastLogin && !lastLogin.device)
    await DS.logAudit({ usuario: session.username, accion: 'LOGIN_DEVICE', tabla: 'auth', valorNuevo: { device: deviceLabel } });

  if (!session.isSuperAdmin) {
    const users = await DS.getUsers();
    const user  = users.list.find(u => u.id === session.userId);
    if (user) {
      if (!user.loginHistory) user.loginHistory = [];
      user.loginHistory.unshift({ fecha: new Date().toISOString(), deviceType, browser, screenRes });
      if (user.loginHistory.length > 50) user.loginHistory.splice(50);
      await DS.updateUser(user.id, { loginHistory: user.loginHistory }, { usuario: session.username });
      AUTH_CACHE.users = await DS.getUsers();
    }
  }
}

/* ─── LIMPIAR DATOS POR EMPRESA ──────────────── */
async function authClearEmpresaData(empresa) {
  await loadAuthCache();
  const session = STORE.session();
  if (!session || session.role !== ROLES.MASTER)
    return { ok: false, error: 'Sin permisos' };

  // Borrado lógico: marca todos los reportes de la empresa como eliminados
  const removed = await DS.softDeleteReportesByEmpresa(empresa, session.username);
  await authLog('DATA_CLEAR', `Reportes eliminados (soft) para empresa: ${empresa} (${removed} registros)`, session.username);
  return { ok: true, removed };
}

async function authClearAllData() {
  await loadAuthCache();
  const session = STORE.session();
  if (!session || session.role !== ROLES.MASTER)
    return { ok: false, error: 'Sin permisos' };

  // Borrado lógico: no se vacía el array, se marcan todos como eliminados
  const removed = await DS.softDeleteAllReportes(session.username);
  await authLog('DATA_CLEAR_ALL', `TODOS los reportes eliminados (soft): ${removed} registros`, session.username);
  return { ok: true, removed };
}

async function authSyncSessionEmpresas(allEmpresas) {
  await loadAuthCache();
  // For master/admin users, sync their session empresas to include all system empresas
  const session = STORE.session();
  if (!session) return;
  if (session.role === 'master' || session.role === 'admin') {
    session.empresas = [...allEmpresas];
    await persistSession(session);
    // Also update user record so next login reflects this
    const users = await DS.getUsers();
    const user = users.list.find(u => u.id === session.userId); // CORREGIDO: users.list.find (no users.find)
    if (user && (user.role === 'master' || user.role === 'admin')) {
      user.empresas = [...allEmpresas];
      await DS.updateUser(user.id, { empresas: [...allEmpresas] }, { usuario: session.username });
      AUTH_CACHE.users = await DS.getUsers();
    }
  }
}

/* ─── EXPONER GLOBALMENTE ────────────────────── */
window.AUTH = {

  login:                  authLogin,
  logout:                 authLogout,
  setPassword:            authSetPassword,
  checkSession:           authCheckSession,
  checkSessionAsync:      authCheckSessionAsync,
  syncSessionEmpresas:    authSyncSessionEmpresas,
  can:                    authCan,
  createUser:             authCreateUser,
  updateUser:             authUpdateUser,
  toggleUser:             authToggleUser,
  resetPassword:          authResetPassword,
  deleteUser:             authDeleteUser,
  getUsers:               authGetUsers,
  getUsersAsync:          authGetUsersAsync,
  getUser:                authGetUser,
  getUserAsync:           authGetUserAsync,
  log:                    authLog,
  getAudit:               authGetAudit,
  redirect:               authRedirect,
  trackDeviceInfo:        authTrackDeviceInfo,
  clearEmpresaData:       authClearEmpresaData,
  clearAllData:           authClearAllData,

  /* Super admin */
  isSuperAdminUsername:   isSuperAdminUsername,
  isAuthorizedDevice:     isAuthorizedDevice,
  getSuperAdminRecord:    getSuperAdminRecord,
  changeSAPassword:       authChangeSAPassword,
  resetAuthorizedDevice:  authResetAuthorizedDevice,
  getDeviceFingerprint:   generateDeviceFingerprint,

  /* Recuperación */
  requestRecoveryCode:    authRequestRecoveryCode,
  validateRecoveryCode:   authValidateRecoveryCode,
  setRecoveredPassword:   authSetRecoveredPassword,

  ROLES,
  ROLE_LABELS,
  EMPRESAS_DEFAULT,
  SUPER_ADMIN_EMAIL: SUPER_ADMIN.email
};

