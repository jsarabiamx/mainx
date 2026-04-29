/* ═══════════════════════════════════════════════════════════════════
   CCTV Fleet Control — dataService.js v2.0
   ─────────────────────────────────────────────────────────────────
   Capa CRUD centralizada lista para base de datos persistente.

   PATRÓN:
     HOY  → localStorage (síncrono, envuelto en Promise.resolve)
     MAÑANA → cambia solo el bloque `adapters.supabase`; botones y
              vistas no se tocan.

   MÉTODOS por entidad (todas retornan Promise):
     Reportes  : createReporte · updateReporte · softDeleteReporte
                 getReporteById · getReportesByEmpresa · getAllReportes
     Usuarios  : createUser · updateUser · softDeleteUser · getUsers
     Empresas  : createEmpresa · updateEmpresa · softDeleteEmpresa
                 getEmpresas
     Selectores: getSelectores · upsertSelectorItem · deleteSelectorItem
     Notif.    : createNotificacion · markNotifRead · markAllNotifRead
     Sesión    : getSession · saveSession · clearSession
     Auditoría : logAudit · getAudit
     Misc      : getSuperAdmin · saveSuperAdmin · getRecovery
                 saveRecovery · clearRecovery · getFailedAttempts
                 saveFailedAttempts

   BORRADO LÓGICO (soft delete):
     Los registros nunca se eliminan físicamente.
     Se marcan con: deleted_at · deleted_by · is_active = false
     Para borrado real en emergencias: hardResetAll()

   AUDITORÍA:
     logAudit({ usuario, accion, tabla, id, valorAnterior,
                valorNuevo, empresa })
     Cada operación importante la llama internamente.
═══════════════════════════════════════════════════════════════════ */

const DS = (() => {

  /* ─── ADAPTADOR ACTIVO ───────────────────────────────────────────
     'localStorage' → desarrollo / demo sin servidor
     'supabase'     → producción (descomentar bloque supabase abajo)
  ──────────────────────────────────────────────────────────────── */
  const MODE_LOCAL = 'local';
  const MODE_DATABASE = 'database';
  const MODE_SUPABASE = 'supabase';

  function resolveAdapter() {
    const configured =
      window.__DATA_MODE__ ||
      localStorage.getItem('gho_data_mode') ||
      MODE_LOCAL;

    return (configured === MODE_DATABASE || configured === MODE_SUPABASE) ? MODE_DATABASE : MODE_LOCAL;
  }

  const ADAPTER = resolveAdapter();

  /* ─── UTILIDADES INTERNAS ─────────────────────────────────────── */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }
  function nowISO() { return new Date().toISOString(); }
  function lsGet(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback; }
    catch { return fallback; }
  }
  function lsSet(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

  function softMark(record, deletedBy) {
    return { ...record, is_active: false, deleted_at: nowISO(), deleted_by: deletedBy || 'sistema' };
  }

  function activeOnly(list) {
    return (list || []).filter(item => item && item.is_active !== false);
  }

  /* ═══════════════════════════════════════════════════════════════
     ADAPTADOR localStorage
     Todas las funciones retornan Promise para que el código
     cliente sea idéntico al que usará Supabase (async/await).
  ═══════════════════════════════════════════════════════════════ */
  const localStorageAdapter = {

    /* ── REPORTES ─────────────────────────────────────────────── */
    async getAllReportes() { return lsGet('gho_fallas', []); },

    async getAllReportesActivos() { return activeOnly(lsGet('gho_fallas', [])); },

    async getReportesByEmpresa(empresa) {
      return activeOnly(lsGet('gho_fallas', [])).filter(f => f.empresa === empresa);
    },

    async getReporteById(id) {
      return lsGet('gho_fallas', []).find(f => f.id === id) ?? null;
    },

    async createReporte(data) {
      const all   = lsGet('gho_fallas', []);
      const nuevo = { id: uid(), is_active: true, created_at: nowISO(), ...data };
      all.unshift(nuevo);
      lsSet('gho_fallas', all);
      await this._logAudit({ accion: 'REPORT_CREATE', tabla: 'reportes', id: nuevo.id,
        valorNuevo: nuevo, empresa: nuevo.empresa, usuario: data._createdBy || 'sistema' });
      return nuevo;
    },

    async updateReporte(id, changes, meta = {}) {
      const all = lsGet('gho_fallas', []);
      const idx = all.findIndex(f => f.id === id);
      if (idx < 0) throw new Error(`Reporte ${id} no encontrado`);
      const anterior = { ...all[idx] };
      all[idx] = { ...all[idx], ...changes, updated_at: nowISO() };
      lsSet('gho_fallas', all);
      await this._logAudit({ accion: 'REPORT_UPDATE', tabla: 'reportes', id,
        valorAnterior: anterior, valorNuevo: changes,
        empresa: all[idx].empresa, usuario: meta.usuario || 'sistema' });
      return all[idx];
    },

    async softDeleteReporte(id, deletedBy) {
      const all = lsGet('gho_fallas', []);
      const idx = all.findIndex(f => f.id === id);
      if (idx < 0) throw new Error(`Reporte ${id} no encontrado`);
      const anterior = { ...all[idx] };
      all[idx] = softMark(all[idx], deletedBy);
      lsSet('gho_fallas', all);
      await this._logAudit({ accion: 'REPORT_DELETE', tabla: 'reportes', id,
        valorAnterior: anterior, empresa: anterior.empresa, usuario: deletedBy || 'sistema' });
      return true;
    },

    async softDeleteReportesByEmpresa(empresa, deletedBy) {
      const all = lsGet('gho_fallas', []);
      let count = 0;
      const updated = all.map(f => {
        if (f.empresa === empresa && f.is_active !== false) { count++; return softMark(f, deletedBy); }
        return f;
      });
      lsSet('gho_fallas', updated);
      await this._logAudit({ accion: 'REPORT_DELETE_EMPRESA', tabla: 'reportes',
        valorNuevo: { empresa, count }, empresa, usuario: deletedBy || 'sistema' });
      return count;
    },

    async softDeleteAllReportes(deletedBy) {
      const all = lsGet('gho_fallas', []);
      let count = 0;
      const updated = all.map(f => {
        if (f.is_active !== false) {
          count++;
          return softMark(f, deletedBy);
        }
        return f;
      });
      lsSet('gho_fallas', updated);
      await this._logAudit({
        accion: 'REPORT_DELETE_ALL',
        tabla: 'reportes',
        valorNuevo: { count },
        usuario: deletedBy || 'sistema'
      });
      return count;
    },

    /* ── USUARIOS ─────────────────────────────────────────────── */
    async getUsers() { return lsGet('cctv_users', { list: [] }); },

    async saveUsers(data) {
      lsSet('cctv_users', data);
      return data;
    },

    async getUsersActivos() {
      const store = lsGet('cctv_users', { list: [] });
      return { ...store, list: activeOnly(store.list).filter(u => u.activo !== false) };
    },

    async getUserById(id) {
      const { list } = lsGet('cctv_users', { list: [] });
      return list.find(u => u.id === id) ?? null;
    },

    async createUser(data) {
      const store = lsGet('cctv_users', { list: [] });
      if (store.list.find(u => u.username === data.username && u.is_active !== false))
        throw new Error(`El usuario "${data.username}" ya existe`);
      const nuevo = { id: uid(), is_active: true, activo: true, created_at: nowISO(), ...data };
      store.list.push(nuevo);
      lsSet('cctv_users', store);
      await this._logAudit({ accion: 'USER_CREATE', tabla: 'usuarios', id: nuevo.id,
        valorNuevo: { ...nuevo, password: '***' }, usuario: data._createdBy || 'sistema' });
      return nuevo;
    },

    async updateUser(id, changes, meta = {}) {
      const store = lsGet('cctv_users', { list: [] });
      const idx   = store.list.findIndex(u => u.id === id);
      if (idx < 0) throw new Error(`Usuario ${id} no encontrado`);
      const anterior = { ...store.list[idx] };
      store.list[idx] = { ...store.list[idx], ...changes, updated_at: nowISO() };
      if ('is_active' in changes) store.list[idx].activo = changes.is_active;
      lsSet('cctv_users', store);
      await this._logAudit({ accion: 'USER_UPDATE', tabla: 'usuarios', id,
        valorAnterior: { ...anterior, password: '***' },
        valorNuevo:    { ...changes,  password: changes.password ? '***' : undefined },
        usuario: meta.usuario || 'sistema' });
      return store.list[idx];
    },

    async softDeleteUser(id, deletedBy) {
      const store = lsGet('cctv_users', { list: [] });
      const target = store.list.find(u => u.id === id);
      if (!target) throw new Error(`Usuario ${id} no encontrado`);

      const adminsActivos = store.list.filter(
        u => u.is_active !== false && u.activo &&
             (u.role === 'admin' || u.role === 'master') && u.id !== id
      );
      if ((target.role === 'admin' || target.role === 'master') && adminsActivos.length === 0)
        throw new Error('No puedes eliminar el último administrador activo');

      const reportes = lsGet('gho_fallas', []);
      const reportesActivos = reportes.filter(
        f => f.is_active !== false &&
             (f.tecnicoUsername === target.username || f.tecnico === target.nombre) &&
             f.estatus !== 'Atendido'
      );
      if (reportesActivos.length > 0)
        throw new Error(
          `El usuario tiene ${reportesActivos.length} reporte(s) activo(s). Reasigna antes de eliminar.`
        );

      return this.updateUser(id, softMark(target, deletedBy), { usuario: deletedBy });
    },

    /* ── EMPRESAS ─────────────────────────────────────────────── */
    async getEmpresas()     { return lsGet('gho_empresas', null); },
    async saveEmpresas(list){ lsSet('gho_empresas', list); return list; },

    async createEmpresa(nombre, createdBy) {
      const empresas = lsGet('gho_empresas', null) ?? ['GHO','ETN','AERS','AMEALSENSE'];
      if (empresas.includes(nombre)) throw new Error(`La empresa "${nombre}" ya existe`);
      empresas.push(nombre);
      lsSet('gho_empresas', empresas);
      await this._logAudit({ accion: 'EMPRESA_CREATE', tabla: 'empresas',
        valorNuevo: { nombre }, usuario: createdBy || 'sistema' });
      return nombre;
    },

    async renameEmpresa(oldNombre, newNombre, updatedBy) {
      const empresas = lsGet('gho_empresas', null) ?? [];
      const idx = empresas.indexOf(oldNombre);
      if (idx < 0) throw new Error(`Empresa "${oldNombre}" no encontrada`);
      if (empresas.includes(newNombre)) throw new Error(`Ya existe una empresa "${newNombre}"`);
      empresas[idx] = newNombre;
      lsSet('gho_empresas', empresas);
      const fallas = lsGet('gho_fallas', []).map(f =>
        f.empresa === oldNombre ? { ...f, empresa: newNombre, updated_at: nowISO() } : f
      );
      lsSet('gho_fallas', fallas);
      const sels = lsGet('gho_selectores', null);
      if (sels && sels[oldNombre]) {
        sels[newNombre] = sels[oldNombre];
        delete sels[oldNombre];
        lsSet('gho_selectores', sels);
      }
      await this._logAudit({ accion: 'EMPRESA_RENAME', tabla: 'empresas',
        valorAnterior: { nombre: oldNombre }, valorNuevo: { nombre: newNombre },
        usuario: updatedBy || 'sistema' });
      return newNombre;
    },

    async softDeleteEmpresa(nombre, deletedBy) {
      const BASE = ['GHO','ETN','AERS','AMEALSENSE'];
      if (BASE.includes(nombre)) throw new Error('No se puede eliminar una empresa base');
      const fallas = lsGet('gho_fallas', []).filter(f => f.empresa === nombre && f.is_active !== false);
      if (fallas.length > 0)
        throw new Error(`"${nombre}" tiene ${fallas.length} reporte(s) activo(s). Elimínalos primero.`);
      const { list } = lsGet('cctv_users', { list: [] });
      const usersActivos = list.filter(u => u.is_active !== false && (u.empresas || []).includes(nombre));
      if (usersActivos.length > 0)
        throw new Error(`"${nombre}" tiene ${usersActivos.length} usuario(s) asignado(s). Reasígnalos primero.`);
      const empresas = (lsGet('gho_empresas', null) ?? []).filter(e => e !== nombre);
      lsSet('gho_empresas', empresas);
      await this._logAudit({ accion: 'EMPRESA_DELETE', tabla: 'empresas',
        valorAnterior: { nombre }, empresa: nombre, usuario: deletedBy || 'sistema' });
      return true;
    },

    /* ── SELECTORES ───────────────────────────────────────────── */
    async getSelectores()     { return lsGet('gho_selectores', null); },
    async saveSelectores(data){ lsSet('gho_selectores', data); return data; },

    async upsertSelectorItem(empresa, modulo, valor, meta = {}) {
      const sels = lsGet('gho_selectores', {});
      if (!sels[empresa]) sels[empresa] = {};
      if (!sels[empresa][modulo]) sels[empresa][modulo] = [];
      if (Array.isArray(sels[empresa][modulo])) {
        if (!sels[empresa][modulo].includes(valor)) sels[empresa][modulo].push(valor);
      } else {
        if (!sels[empresa][modulo][meta.categoria]) sels[empresa][modulo][meta.categoria] = [];
        if (!sels[empresa][modulo][meta.categoria].includes(valor))
          sels[empresa][modulo][meta.categoria].push(valor);
      }
      lsSet('gho_selectores', sels);
      await this._logAudit({ accion: 'CATALOG_ADD', tabla: 'selectores',
        valorNuevo: { empresa, modulo, valor, ...meta }, usuario: meta.usuario || 'sistema' });
      return true;
    },

    async deleteSelectorItem(empresa, modulo, valor, meta = {}) {
      const sels = lsGet('gho_selectores', {});
      if (!sels[empresa] || !sels[empresa][modulo]) return false;
      if (Array.isArray(sels[empresa][modulo])) {
        if (!meta.force) {
          const fallas = lsGet('gho_fallas', []);
          const enUso = fallas.some(f => f.empresa === empresa && f.is_active !== false && f[modulo] === valor);
          if (enUso) throw new Error(`"${valor}" está en uso en reportes activos. Usa force:true para forzar.`);
        }
        sels[empresa][modulo] = sels[empresa][modulo].filter(v => v !== valor);
      } else if (meta.categoria && sels[empresa][modulo][meta.categoria]) {
        sels[empresa][modulo][meta.categoria] = sels[empresa][modulo][meta.categoria].filter(v => v !== valor);
      }
      lsSet('gho_selectores', sels);
      await this._logAudit({ accion: 'CATALOG_DELETE', tabla: 'selectores',
        valorAnterior: { empresa, modulo, valor, ...meta }, usuario: meta.usuario || 'sistema' });
      return true;
    },

    /* ── NOTIFICACIONES ───────────────────────────────────────── */
    async getNotificaciones() { return lsGet('gho_notificaciones', []); },

    async saveNotificaciones(data) {
      lsSet('gho_notificaciones', data);
      return data;
    },

    async createNotificacion(data) {
      const notifs = lsGet('gho_notificaciones', []);
      const nueva  = { id: uid(), fecha: nowISO(), leida: false, ...data };
      notifs.unshift(nueva);
      if (notifs.length > 200) notifs.splice(200);
      lsSet('gho_notificaciones', notifs);
      return nueva;
    },

    async markNotifRead(id) {
      const notifs = lsGet('gho_notificaciones', []);
      const n = notifs.find(x => x.id === id);
      if (n) { n.leida = true; lsSet('gho_notificaciones', notifs); }
      return true;
    },

    async markNotifByReporte(reporteId) {
      const notifs = lsGet('gho_notificaciones', []);
      let changed = 0;
      notifs.forEach(n => {
        if (n.reporteId === reporteId && !n.leida) {
          n.leida = true;
          changed++;
        }
      });
      if (changed > 0) lsSet('gho_notificaciones', notifs);
      return changed;
    },

    async markAllNotifRead(filter = null) {
      const notifs = lsGet('gho_notificaciones', []);
      notifs.forEach(n => {
        if (!filter || filter(n)) n.leida = true;
      });
      lsSet('gho_notificaciones', notifs);
      return true;
    },

    /* ── SESIÓN ───────────────────────────────────────────────── */
    async getSession()  { return lsGet('cctv_session', null); },
    async saveSession(d){ lsSet('cctv_session', d); return d; },
    async clearSession(){ localStorage.removeItem('cctv_session'); return true; },

    /* ── AUDITORÍA ────────────────────────────────────────────── */
    async getAudit() { return lsGet('cctv_audit', []); },

    async saveAudit(data) {
      lsSet('cctv_audit', data);
      return data;
    },

    async _logAudit({ usuario, accion, tabla, id, valorAnterior, valorNuevo, empresa }) {
      const audit = lsGet('cctv_audit', []);
      audit.unshift({
        id: uid(), fecha: nowISO(),
        usuario: usuario || 'sistema', accion,
        tabla: tabla || '', registro_id: id || '', empresa: empresa || '',
        valor_anterior: valorAnterior ? JSON.stringify(valorAnterior) : null,
        valor_nuevo:    valorNuevo    ? JSON.stringify(valorNuevo)    : null,
      });
      if (audit.length > 2000) audit.splice(2000);
      lsSet('cctv_audit', audit);
    },

    /* ── SUPER ADMIN / RECOVERY / FAILED ATTEMPTS ─────────────── */
    async getSuperAdmin()      { return lsGet('cctv_sa', null); },
    async saveSuperAdmin(d)    { lsSet('cctv_sa', d); return d; },
    async getRecovery()        { return lsGet('cctv_recovery', null); },
    async saveRecovery(d)      { lsSet('cctv_recovery', d); return d; },
    async clearRecovery()      { localStorage.removeItem('cctv_recovery'); return true; },
    async getFailedAttempts()  { return lsGet('cctv_failed_attempts', {}); },
    async saveFailedAttempts(d){ lsSet('cctv_failed_attempts', d); return d; },

    async getUiSetting(key, fallback = null) {
      return lsGet(key, fallback);
    },

    async saveUiSetting(key, value) {
      lsSet(key, value);
      return value;
    },

    /* ── RESET TOTAL (solo master / desarrollo) ───────────────── */
    async hardResetAll(confirmedBy) {
      ['gho_fallas','gho_selectores','gho_empresas','gho_notificaciones',
       'cctv_users','cctv_session','cctv_audit','cctv_sa',
       'cctv_recovery','cctv_failed_attempts',
       'gho_current_empresa','gho_view_mode'].forEach(k => localStorage.removeItem(k));
      await this._logAudit({ accion: 'SYSTEM_RESET', tabla: 'sistema',
        valorNuevo: { confirmedBy }, usuario: confirmedBy || 'sistema' });
      return true;
    },
  };

  function createDatabaseAdapter() {
    const externalAdapter = window.CCTV_DB_ADAPTER || null;
    const strictMissing = (method) => async () => {
      throw new Error(`DS: el adaptador de base de datos no implementa "${method}" y no se permite fallback a localStorage en modo database/supabase.`);
    };
    const strictAdapter = {
      getAllReportes: strictMissing('getAllReportes'),
      getAllReportesActivos: strictMissing('getAllReportesActivos'),
      getReportesByEmpresa: strictMissing('getReportesByEmpresa'),
      getReporteById: strictMissing('getReporteById'),
      createReporte: strictMissing('createReporte'),
      updateReporte: strictMissing('updateReporte'),
      softDeleteReporte: strictMissing('softDeleteReporte'),
      softDeleteReportesByEmpresa: strictMissing('softDeleteReportesByEmpresa'),
      softDeleteAllReportes: strictMissing('softDeleteAllReportes'),
      getUsers: strictMissing('getUsers'),
      saveUsers: strictMissing('saveUsers'),
      getUsersActivos: strictMissing('getUsersActivos'),
      getUserById: strictMissing('getUserById'),
      createUser: strictMissing('createUser'),
      updateUser: strictMissing('updateUser'),
      softDeleteUser: strictMissing('softDeleteUser'),
      getEmpresas: strictMissing('getEmpresas'),
      saveEmpresas: strictMissing('saveEmpresas'),
      createEmpresa: strictMissing('createEmpresa'),
      renameEmpresa: strictMissing('renameEmpresa'),
      softDeleteEmpresa: strictMissing('softDeleteEmpresa'),
      getSelectores: strictMissing('getSelectores'),
      saveSelectores: strictMissing('saveSelectores'),
      upsertSelectorItem: strictMissing('upsertSelectorItem'),
      deleteSelectorItem: strictMissing('deleteSelectorItem'),
      getNotificaciones: strictMissing('getNotificaciones'),
      saveNotificaciones: strictMissing('saveNotificaciones'),
      createNotificacion: strictMissing('createNotificacion'),
      markNotifRead: strictMissing('markNotifRead'),
      markNotifByReporte: strictMissing('markNotifByReporte'),
      markAllNotifRead: strictMissing('markAllNotifRead'),
      getSession: strictMissing('getSession'),
      saveSession: strictMissing('saveSession'),
      clearSession: strictMissing('clearSession'),
      getAudit: strictMissing('getAudit'),
      saveAudit: strictMissing('saveAudit'),
      _logAudit: strictMissing('_logAudit'),
      getSuperAdmin: strictMissing('getSuperAdmin'),
      saveSuperAdmin: strictMissing('saveSuperAdmin'),
      getRecovery: strictMissing('getRecovery'),
      saveRecovery: strictMissing('saveRecovery'),
      clearRecovery: strictMissing('clearRecovery'),
      getFailedAttempts: strictMissing('getFailedAttempts'),
      saveFailedAttempts: strictMissing('saveFailedAttempts'),
      getUiSetting: strictMissing('getUiSetting'),
      saveUiSetting: strictMissing('saveUiSetting'),
      hardResetAll: strictMissing('hardResetAll'),
    };

    if (!externalAdapter) return strictAdapter;
    return { ...strictAdapter, ...externalAdapter };
  }

  /* ─── SELECTOR DE ADAPTADOR ───────────────────────────────────── */
  const adapters = {
    [MODE_LOCAL]: localStorageAdapter,
    [MODE_DATABASE]: createDatabaseAdapter(),
  };

  const a = adapters[ADAPTER];
  if (!a) throw new Error(`DS: adaptador "${ADAPTER}" no encontrado`);

  /* ─── API PÚBLICA ─────────────────────────────────────────────── */
  return {
    /* Reportes */
    getAllReportes:               ()              => a.getAllReportes(),
    getAllReportesActivos:        ()              => a.getAllReportesActivos(),
    getReportesByEmpresa:        (emp)            => a.getReportesByEmpresa(emp),
    getReporteById:              (id)             => a.getReporteById(id),
    createReporte:               (data)           => a.createReporte(data),
    updateReporte:               (id, ch, meta)   => a.updateReporte(id, ch, meta),
    softDeleteReporte:           (id, by)         => a.softDeleteReporte(id, by),
    softDeleteReportesByEmpresa: (emp, by)        => a.softDeleteReportesByEmpresa(emp, by),
    softDeleteAllReportes:       (by)             => a.softDeleteAllReportes(by),

    /* Usuarios */
    getUsers:       ()             => a.getUsers(),
    getUsersActivos:()             => a.getUsersActivos(),
    getUserById:    (id)           => a.getUserById(id),
    createUser:     (data)         => a.createUser(data),
    updateUser:     (id, ch, meta) => a.updateUser(id, ch, meta),
    softDeleteUser: (id, by)       => a.softDeleteUser(id, by),

    /* Empresas */
    getEmpresas:       ()           => a.getEmpresas(),
    saveEmpresas:      (list)       => a.saveEmpresas(list),
    createEmpresa:     (n, by)      => a.createEmpresa(n, by),
    renameEmpresa:     (o, n, by)   => a.renameEmpresa(o, n, by),
    softDeleteEmpresa: (n, by)      => a.softDeleteEmpresa(n, by),

    /* Selectores */
    getSelectores:      ()               => a.getSelectores(),
    saveSelectores:     (d)              => a.saveSelectores(d),
    upsertSelectorItem: (e, m, v, meta)  => a.upsertSelectorItem(e, m, v, meta),
    deleteSelectorItem: (e, m, v, meta)  => a.deleteSelectorItem(e, m, v, meta),

    /* Notificaciones */
    getNotificaciones:  ()   => a.getNotificaciones(),
    createNotificacion: (d)  => a.createNotificacion(d),
    markNotifRead:      (id) => a.markNotifRead(id),
    marcarNotificacionLeida: (id) => a.markNotifRead(id),
    marcarNotificacionesPorReporte: (reporteId) => a.markNotifByReporte(reporteId),
    markAllNotifRead:   (filter) => a.markAllNotifRead(filter),

    /* Sesión */
    getSession:   ()  => a.getSession(),
    saveSession:  (d) => a.saveSession(d),
    clearSession: ()  => a.clearSession(),

    /* Auditoría */
    getAudit:  ()     => a.getAudit(),
    logAudit:  (data) => a._logAudit(data),

    /* Super Admin / Recovery / Failed */
    getSuperAdmin:      ()  => a.getSuperAdmin(),
    saveSuperAdmin:     (d) => a.saveSuperAdmin(d),
    getRecovery:        ()  => a.getRecovery(),
    saveRecovery:       (d) => a.saveRecovery(d),
    clearRecovery:      ()  => a.clearRecovery(),
    getFailedAttempts:  ()  => a.getFailedAttempts(),
    saveFailedAttempts: (d) => a.saveFailedAttempts(d),

    /* UI settings */
    getUiSetting: (key, fallback) => a.getUiSetting(key, fallback),
    saveUiSetting: (key, value) => a.saveUiSetting(key, value),

    /* Reset */
    hardResetAll: (by) => a.hardResetAll(by),

    /* Diagnóstico de conexión */
    testDatabaseConnection: () => {
      if (typeof a.testConnection === 'function') return a.testConnection();
      if (window.CCTV_SUPABASE && typeof window.CCTV_SUPABASE.testConnection === 'function') {
        return window.CCTV_SUPABASE.testConnection();
      }
      return Promise.resolve({ ok: false, message: 'No hay servicio Supabase cargado.' });
    },

    /* Adaptador activo */
    adapter: ADAPTER,
    isLocalMode:    () => ADAPTER === MODE_LOCAL,
    isDatabaseMode: () => ADAPTER === MODE_DATABASE,

    /* ── COMPATIBILIDAD LEGACY v1 ─────────────────────────────────
       Los módulos actuales (app-data.js, auth.js, etc.) siguen
       funcionando sin cambios mientras migras gradualmente.
       Nota: estos son síncronos — no retornan Promise.
    ──────────────────────────────────────────────────────────────── */
    saveUsers:          (d) => a.saveUsers(d),
    saveAudit:          (d) => a.saveAudit(d),
    saveNotificaciones: (d) => a.saveNotificaciones(d),
  };

})();

window.DS = DS;

