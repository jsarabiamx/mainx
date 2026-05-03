/* ═══════════════════════════════════════════════
   CCTV Fleet Control — Data Module v7.0
   + Sistema de notificaciones admin ↔ técnico
   + Técnicos por empresa/base
   + tecnicoAtender()
═══════════════════════════════════════════════ */

const DATA = (() => {

  const DEFAULT_EMPRESAS = ['GHO', 'ETN', 'AERS', 'AMEALSENSE'];

  const EMPRESA_COLORS = {
    'GHO':       { hex: '#4f8ef7', r: 79,  g: 142, b: 247 },
    'ETN':       { hex: '#f59e0b', r: 245, g: 158, b: 11  },
    'AERS':      { hex: '#22c55e', r: 34,  g: 197, b: 94  },
    'AMEALSENSE':{ hex: '#a855f7', r: 168, g: 85,  b: 247 },
  };

  // Catálogos vacíos por defecto: se capturan desde Configuración sin modificar diseño.
  const COMPONENTES_DEFAULT = {};

  const ESTATUS_DEFAULT = [];
  const TIPOS_DEFAULT = [];
  const PROVEEDORES_DEFAULT = [];

  function normalizeFallas(list) {
    return (list || [])
      .filter(x => x && x.is_active !== false)
      .map(x => ({ ...x, empresa: x.empresa || 'GHO' }));
  }

  function getEmpresas() {
    return state.empresas?.length ? state.empresas : [...DEFAULT_EMPRESAS];
  }

  function getSelectores() {
    return state.selectores || buildDefaultSelectores();
  }

  function getFallas() {
    return normalizeFallas(state.fallas);
  }

  // ─── TÉCNICOS POR EMPRESA/BASE (desde usuarios reales) ──
  /**
   * Devuelve usuarios reales activos cuyo rol es 'tecnico' o 'admin',
   * que tengan la empresa dada en su lista de empresas, y cuya base
   * coincida con la base dada (o todos si base está vacío).
   * Retorna array de { nombre, username, base }
   */
  function getTecnicosPorBase(empresa, base) {
    const usersData = { list: AUTH.getUsers() };
    if (!usersData || !usersData.list) return [];

    return usersData.list.filter(u => {
      if (!u.activo) return false;
      // Solo técnicos y admins
      if (u.role !== 'tecnico' && u.role !== 'admin') return false;
      // Debe pertenecer a la empresa
      const userEmpresas = u.empresas || [];
      if (!userEmpresas.includes(empresa)) return false;
      // Si hay base, filtrar por base del usuario
      if (base && u.base && u.base !== base) return false;
      return true;
    }).map(u => ({ nombre: u.nombre, username: u.username, base: u.base || '' }));
  }

  // Alias que devuelve solo los nombres (para compatibilidad con selects)
  function getNombresTecnicosPorBase(empresa, base) {
    return getTecnicosPorBase(empresa, base).map(u => u.nombre);
  }

  // ─── NOTIFICACIONES ──────────────────────────
  function getNotificaciones() {
    return state.notificaciones || [];
  }

  async function crearNotificacion(tipo, data) {
    const nueva = { tipo, ...data };
    const created = await DS.createNotificacion(nueva);
    state.notificaciones = [created, ...(state.notificaciones || [])].slice(0, 200);
    return created;
  }

  async function marcarNotificacionLeida(id) {
    await DS.marcarNotificacionLeida(id);
    state.notificaciones = (state.notificaciones || []).map(n => n.id === id ? { ...n, leida: true } : n);
  }

  async function marcarNotificacionesPorReporte(reporteId) {
    await DS.marcarNotificacionesPorReporte(reporteId);
    state.notificaciones = (state.notificaciones || []).map(n => n.reporteId === reporteId ? { ...n, leida: true } : n);
  }

  async function marcarTodasLeidas(filterFn = null) {
    await DS.markAllNotifRead(filterFn);
    state.notificaciones = (state.notificaciones || []).map(n => (!filterFn || filterFn(n)) ? { ...n, leida: true } : n);
  }

  function getNotificacionesNoLeidas() {
    return getNotificaciones().filter(n => !n.leida);
  }

  async function notificarTecnicoAtendiendo(reporte, tecnicoNombre) {
    return crearNotificacion('TECH_ATENDIENDO', {
      reporteId: reporte.id,
      folio:     reporte.folio,
      unidad:    reporte.unidad,
      empresa:   reporte.empresa,
      tecnico:   tecnicoNombre,
      destino:   'admin',
      titulo:    `${tecnicoNombre} — Unidad ${reporte.unidad} atendiendo`,
      mensaje:   `${tecnicoNombre} está atendiendo la unidad ${reporte.unidad} (${reporte.folio}). Valida cuando esté listo.`,
    });
  }

  async function notificarTecnicoLiberado(reporte, tecnicoUsername) {
    return crearNotificacion('ADMIN_VALIDADO', {
      reporteId: reporte.id,
      folio:     reporte.folio,
      unidad:    reporte.unidad,
      empresa:   reporte.empresa,
      destino:   tecnicoUsername || 'tecnico',
      titulo:    `Unidad ${reporte.unidad} liberada / atendida`,
      mensaje:   `La unidad ${reporte.unidad} (${reporte.folio}) fue validada y marcada como Atendida.`,
    });
  }

  /**
   * Notifica al técnico asignado (NUEVA_UNIDAD_ASIGNADA) y a todos los
   * técnicos de la misma empresa sin asignación específica (NUEVA_UNIDAD_EMPRESA).
   * Respeta el filtro por empresa: GHO→GHO, ETN→ETN, o ambos si el técnico tiene ambas.
   */
  async function notificarNuevaUnidad(reporte) {
    const empresa  = reporte.empresa || state.currentEmpresa;
    const tecAsig  = (reporte.tecnicoUsername || '').trim();
    const promesas = [];

    // 1. Notificación personal al técnico asignado (si hay uno)
    if (tecAsig) {
      promesas.push(crearNotificacion('NUEVA_UNIDAD_ASIGNADA', {
        reporteId: reporte.id,
        folio:     reporte.folio,
        unidad:    reporte.unidad,
        empresa,
        destino:   tecAsig,
        titulo:    `Nueva unidad asignada — Ud. ${reporte.unidad}`,
        mensaje:   `Se te asignó la unidad ${reporte.unidad} (${reporte.folio}) · ${empresa} · ${reporte.categoria || ''} ${reporte.componente || ''}`.trim(),
      }));
    }

    // 2. Notificación broadcast a todos los técnicos de la empresa
    //    (destino especial 'tecnico_empresa:<EMPRESA>' para que el filtro
    //     en tecnico.js pueda discriminar por empresa sin enviar N registros)
    promesas.push(crearNotificacion('NUEVA_UNIDAD_EMPRESA', {
      reporteId: reporte.id,
      folio:     reporte.folio,
      unidad:    reporte.unidad,
      empresa,
      destino:   `tecnico_empresa:${empresa}`,
      titulo:    `Nueva unidad para atender — Ud. ${reporte.unidad}`,
      mensaje:   `Unidad ${reporte.unidad} (${reporte.folio}) registrada en ${empresa} · ${reporte.categoria || ''} ${reporte.componente || ''}`.trim(),
    }));

    await Promise.all(promesas);
  }

  async function saveEmpresas(d)   { await DS.saveEmpresas(d); }
  async function saveSelectores(d) { await DS.saveSelectores(d); }

  function buildDefaultSelectores() {
    const s = {};
    getEmpresas().forEach(e => { s[e] = buildEmpresaSelectores(); });
    return s;
  }

  function buildEmpresaSelectores() {
    return {
      servicio:    [],
      base:        [],
      categoria:   [],
      componente:  {},
      estatus:     [],
      tipo:        [],
      proveedor:   [],
      piso:        [],
    };
  }

  const state = {
    fallas:         [],
    empresas:       [...DEFAULT_EMPRESAS],
    selectores:     null,
    notificaciones: [],
    currentEmpresa: 'GHO',
    viewMode:       'individual',
  };

  function resetDatosBaseVaciosUnaVez() {
    if (typeof DS !== 'undefined' && typeof DS.isDatabaseMode === 'function' && DS.isDatabaseMode()) {
      return;
    }
    try {
      const VERSION = 'catalogos-vacios-2026-04-27-v1';
      if (localStorage.getItem('cctv_empty_seed_version') === VERSION) return;
      localStorage.setItem('gho_empresas', JSON.stringify([...DEFAULT_EMPRESAS]));
      localStorage.setItem('gho_selectores', JSON.stringify(buildDefaultSelectores()));
      localStorage.setItem('gho_fallas', JSON.stringify([]));
      localStorage.setItem('gho_current_empresa', JSON.stringify(DEFAULT_EMPRESAS[0]));
      localStorage.setItem('cctv_empty_seed_version', VERSION);
    } catch (e) {
      console.warn('No se pudo aplicar limpieza inicial de catálogos:', e);
    }
  }

  async function init() {
    resetDatosBaseVaciosUnaVez();
    const safe = fn => fn.catch(e => { console.warn('[DATA.init] partial fail:', e); return null; });
    const [fallas, empresas, selectores, notificaciones, currentEmpresa, viewMode] = await Promise.all([
      safe(DS.getAllReportesActivos()),
      safe(DS.getEmpresas()),
      safe(DS.getSelectores()),
      safe(DS.getNotificaciones()),
      safe(DS.getUiSetting('gho_current_empresa', 'GHO')),
      safe(DS.getUiSetting('gho_view_mode', 'individual'))
    ]);

    state.fallas = normalizeFallas(fallas);
    state.empresas = empresas || [...DEFAULT_EMPRESAS];
    state.selectores = selectores || buildDefaultSelectores();
    state.notificaciones = notificaciones || [];
    state.currentEmpresa = currentEmpresa || state.empresas[0] || 'GHO';
    state.viewMode = viewMode || 'individual';

    state.empresas.forEach(e => {
      if (!state.selectores[e]) state.selectores[e] = buildEmpresaSelectores();
      if (!state.selectores[e].servicio) state.selectores[e].servicio = [];
      if (!state.selectores[e].base) state.selectores[e].base = [];
      if (!state.selectores[e].categoria) state.selectores[e].categoria = [];
      if (!state.selectores[e].componente) state.selectores[e].componente = {};
      if (!state.selectores[e].estatus) state.selectores[e].estatus = [];
      if (!state.selectores[e].tipo) state.selectores[e].tipo = [];
      if (!state.selectores[e].proveedor) state.selectores[e].proveedor = [];
      if (!state.selectores[e].piso) state.selectores[e].piso = [];
    });
    if (!state.empresas.includes(state.currentEmpresa)) state.currentEmpresa = state.empresas[0] || 'GHO';
    return state;
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

  const EXTRA_COLORS = [
    { hex: '#ec4899', r: 236, g: 72,  b: 153 },
    { hex: '#14b8a6', r: 20,  g: 184, b: 166 },
    { hex: '#f97316', r: 249, g: 115, b: 22  },
    { hex: '#84cc16', r: 132, g: 204, b: 22  },
    { hex: '#06b6d4', r: 6,   g: 182, b: 212 },
    { hex: '#e11d48', r: 225, g: 29,  b: 72  },
    { hex: '#8b5cf6', r: 139, g: 92,  b: 246 },
    { hex: '#10b981', r: 16,  g: 185, b: 129 },
  ];

  function getEmpresaColor(emp) {
    if (EMPRESA_COLORS[emp]) return EMPRESA_COLORS[emp];
    let hash = 0;
    for (let i = 0; i < emp.length; i++) hash = (hash * 31 + emp.charCodeAt(i)) >>> 0;
    return EXTRA_COLORS[hash % EXTRA_COLORS.length];
  }

  function getFilteredFallas(empresaFilter) {
    const s = AUTH.checkSession();
    let base = state.fallas;
    if (s && s.empresas && s.empresas.length > 0) {
      base = base.filter(f => s.empresas.includes(f.empresa));
    }
    if (state.viewMode === 'individual' && !empresaFilter) {
      return base.filter(f => f.empresa === state.currentEmpresa);
    }
    if (empresaFilter) return base.filter(f => f.empresa === empresaFilter);
    return base;
  }

  function getSel(key, empresa) {
    const emp = empresa || state.currentEmpresa;
    return (state.selectores[emp] && state.selectores[emp][key]) || [];
  }

  function getComponentes(cat, empresa) {
    const emp = empresa || state.currentEmpresa;
    const comps = (state.selectores[emp] && state.selectores[emp].componente) || {};
    return comps[cat] || [];
  }

  async function crearReporte(data) {
    const session = AUTH.checkSession();
    const folio = generarFolio(data.empresa || state.currentEmpresa, data.unidad);
    const nuevo = {
      id:          uid(),
      folio,
      empresa:     data.empresa || state.currentEmpresa,
      unidad:      data.unidad,
      base:        data.base,
      servicio:    data.servicio,
      fecha:       data.fecha,
      piso:        data.piso || '',
      tipo:        data.tipo || '',
      categoria:   data.categoria,
      componente:  data.componente,
      proveedor:   data.proveedor || '',
      descripcion: data.descripcion || '',
      prioridad:   data.prioridad || 'Media',
      tecnico:     data.tecnico || '',
      tecnicoUsername: data.tecnicoUsername || '',
      estatus:     'Pendiente',
      fechaAtencion: null,
      resultado:   '',
      notas:       '',
      createdAt:   new Date().toISOString(),
      createdBy:   session ? session.username : 'sistema',
      historial:   [{
        fecha:   new Date().toISOString(),
        accion:  'Creado',
        usuario: session ? session.username : 'sistema',
        detalle: 'Reporte creado'
      }]
    };
    const created = await DS.createReporte({ ...nuevo, _createdBy: session ? session.username : 'sistema' });
    state.fallas.unshift({ ...created, empresa: created.empresa || 'GHO' });
    await AUTH.log('REPORT_CREATE', `Reporte creado: Folio ${folio} · Unidad ${nuevo.unidad}`, session ? session.username : 'sistema');
    // Notificar al técnico asignado y a todos los de la empresa
    await notificarNuevaUnidad(created).catch(() => {}); // no bloquear si falla notif
    return created;
  }

  async function actualizarReporte(id, changes) {
    const session = AUTH.checkSession();
    const idx = state.fallas.findIndex(f => f.id === id);
    if (idx < 0) return null;

    const old = { ...state.fallas[idx] };
    // Preparar cambios adicionales por estatus
    const extraChanges = {};
    if (changes.estatus) {
      // Detección dinámica: el estatus "atendido" es cualquiera que contenga
      // "atendid" (case-insensitive) en la lista de la empresa, o el literal 'Atendido' como fallback.
      const _isAtendido = (est) => {
        if (!est) return false;
        const lista = getSel('estatus', old.empresa || state.currentEmpresa);
        const match = lista.find(e => /atendid/i.test(e));
        return match ? est === match : est === 'Atendido';
      };
      if (_isAtendido(changes.estatus)) {
        if (!old.fechaAtencion || !_isAtendido(old.estatus))
          extraChanges.fechaAtencion = new Date().toISOString();
        if (!_isAtendido(old.estatus)) {
          const tecUser = state.fallas[idx].tecnicoUsername || '';
          await notificarTecnicoLiberado({ ...state.fallas[idx], ...changes }, tecUser);
        }
      } else if (_isAtendido(old.estatus) && !_isAtendido(changes.estatus)) {
        extraChanges.fechaAtencion = null;
      }
    }

    if (!state.fallas[idx].historial) state.fallas[idx].historial = [];
    const cambios = [];
    if (changes.estatus && changes.estatus !== old.estatus)
      cambios.push(`Estatus: ${old.estatus} → ${changes.estatus}`);
    if (changes.tecnico !== undefined && changes.tecnico !== old.tecnico)
      cambios.push(`Técnico: ${old.tecnico || '—'} → ${changes.tecnico}`);
    if (changes.resultado !== undefined && changes.resultado !== old.resultado)
      cambios.push(`Resultado actualizado`);

    const historialEntry = cambios.length > 0 ? [{
      fecha:   new Date().toISOString(),
      accion:  'Actualizado',
      usuario: session ? session.username : 'sistema',
      detalle: cambios.join(' | ')
    }] : [];

    const allChanges = {
      ...changes,
      ...extraChanges,
      historial: historialEntry.length > 0
        ? [...historialEntry, ...(state.fallas[idx].historial || [])]
        : state.fallas[idx].historial,
    };

    // Persistir via DS (registro individual)
    const updated = await DS.updateReporte(id, allChanges, { usuario: session ? session.username : 'sistema' });
    // Reflejo local inmediato para UI
    state.fallas[idx] = { ...updated };

    if (cambios.length > 0)
      await AUTH.log('REPORT_EDIT', `Reporte ${state.fallas[idx].folio}: ${cambios.join(' | ')}`, session ? session.username : 'sistema');
    return state.fallas[idx];
  }

  // Técnico presiona "Atender"
  async function tecnicoAtender(id, tecnicoNombre, tecnicoUsername) {
    const session = AUTH.checkSession();
    const idx = state.fallas.findIndex(f => f.id === id);
    if (idx < 0) return null;

    const atenderChanges = {
      estatus:             'En proceso',
      tecnico:             tecnicoNombre,
      tecnicoUsername:     tecnicoUsername || (session ? session.username : ''),
      fechaInicioAtencion: new Date().toISOString(),
      historial: [{
        fecha:   new Date().toISOString(),
        accion:  'Técnico atendiendo',
        usuario: tecnicoNombre || (session ? session.username : 'técnico'),
        detalle: `Técnico ${tecnicoNombre} inició atención`
      }, ...(state.fallas[idx].historial || [])],
    };

    const updated = await DS.updateReporte(id, atenderChanges, { usuario: tecnicoNombre || (session ? session.username : 'sistema') });
    state.fallas[idx] = { ...updated };
    await notificarTecnicoAtendiendo(state.fallas[idx], tecnicoNombre);
    await AUTH.log('TECH_ATENDER', `Técnico ${tecnicoNombre} atiende ${state.fallas[idx].folio}`, tecnicoNombre);
    return state.fallas[idx];
  }

  async function eliminarReporte(id) {
    const session = AUTH.checkSession();
    if (!AUTH.can('manageUsers')) return false;
    const idx = state.fallas.findIndex(f => f.id === id);
    if (idx < 0) return false;
    const folio = state.fallas[idx].folio;
    // Borrado lógico: marca is_active=false, no elimina el registro
    await DS.softDeleteReporte(id, session ? session.username : 'sistema');
    // Reflejo local: ocultar de la lista en memoria
    state.fallas.splice(idx, 1);
    await AUTH.log('REPORT_DELETE', `Reporte eliminado (soft): Folio ${folio}`, session ? session.username : 'sistema');
    return true;
  }

  async function agregarEmpresa(nombre) {
    const val = nombre.trim().toUpperCase();
    if (!val) return { ok: false, error: 'Nombre inválido' };
    if (state.empresas.includes(val)) return { ok: false, error: 'La empresa ya existe' };
    const session = AUTH.checkSession();
    await DS.createEmpresa(val, session ? session.username : 'sistema');
    state.empresas.push(val);
    state.selectores[val] = buildEmpresaSelectores();
    await saveSelectores(state.selectores);
    await AUTH.log('EMPRESA_CREATE', `Empresa creada: ${val}`);
    return { ok: true, nombre: val };
  }

  async function eliminarEmpresa(nombre) {
    const idx = state.empresas.indexOf(nombre);
    if (idx < 0) return { ok: false, error: 'No encontrada' };
    if (['GHO','ETN','AERS','AMEALSENSE'].includes(nombre))
      return { ok: false, error: 'No se puede eliminar empresa base' };

    // Validar: ¿tiene reportes activos? (verificación local rápida)
    const reportesActivos = state.fallas.filter(f => f.empresa === nombre && f.is_active !== false);
    if (reportesActivos.length > 0)
      return { ok: false, error: `"${nombre}" tiene ${reportesActivos.length} reporte(s) activo(s). Elimínalos primero.` };

    const session = AUTH.checkSession();
    try {
      await DS.softDeleteEmpresa(nombre, session ? session.username : 'sistema');
    } catch(e) {
      return { ok: false, error: e.message || String(e) };
    }
    state.empresas.splice(idx, 1);
    delete state.selectores[nombre];
    if (state.currentEmpresa === nombre) state.currentEmpresa = state.empresas[0];
    await saveSelectores(state.selectores);
    await AUTH.log('EMPRESA_DELETE', `Empresa eliminada: ${nombre}`);
    return { ok: true };
  }

  async function renameEmpresa(oldNombre, newNombre) {
    const val = newNombre.trim().toUpperCase();
    if (!val) return { ok: false, error: 'Nombre inválido' };
    if (val === oldNombre) return { ok: false, error: 'El nombre es igual al actual' };
    if (state.empresas.includes(val)) return { ok: false, error: 'Ya existe una empresa con ese nombre' };
    const idx = state.empresas.indexOf(oldNombre);
    if (idx < 0) return { ok: false, error: 'Empresa no encontrada' };
    const session = AUTH.checkSession();
    // DS se encarga de renombrar en fallas y selectores persistidos
    await DS.renameEmpresa(oldNombre, val, session ? session.username : 'sistema');
    // Reflejo local
    state.empresas[idx] = val;
    if (state.selectores[oldNombre]) {
      state.selectores[val] = state.selectores[oldNombre];
      delete state.selectores[oldNombre];
    }
    state.fallas.forEach(f => { if (f.empresa === oldNombre) f.empresa = val; });
    if (state.currentEmpresa === oldNombre) state.currentEmpresa = val;
    await AUTH.log('EMPRESA_RENAME', `Empresa renombrada: ${oldNombre} → ${val}`);
    return { ok: true, newName: val };
  }

  function generarFolio(empresa, unidad) {
    const d  = new Date();
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const yy = String(d.getFullYear()).slice(2);
    // CORREGIDO: usa timestamp + random para evitar folios duplicados
    // cuando dos usuarios guardan al mismo tiempo
    const ts  = Date.now().toString(36).slice(-3).toUpperCase();
    const rnd = Math.random().toString(36).slice(2,4).toUpperCase();
    return `${empresa}-${yy}${mm}${dd}-${ts}${rnd}`;
  }

  async function persistAll() {
    await Promise.all([
      saveEmpresas(state.empresas),
      saveSelectores(state.selectores),
      DS.saveUiSetting('gho_current_empresa', state.currentEmpresa),
      DS.saveUiSetting('gho_view_mode', state.viewMode)
    ]);
  }

  return {
    state,
    init,
    DEFAULT_EMPRESAS,
    ESTATUS_DEFAULT,
    TIPOS_DEFAULT,
    PROVEEDORES_DEFAULT,
    getEmpresaColor,
    getFilteredFallas,
    getSel,
    getComponentes,
    crearReporte,
    actualizarReporte,
    eliminarReporte,
    tecnicoAtender,
    agregarEmpresa,
    renameEmpresa,
    eliminarEmpresa,
    generarFolio,
    buildEmpresaSelectores,
    persistAll,
    uid,
    getTecnicosPorBase,
    getNombresTecnicosPorBase,
    getNotificaciones,
    getNotificacionesNoLeidas,
    crearNotificacion,
    marcarNotificacionLeida,
    marcarNotificacionesPorReporte,
    marcarTodasLeidas,
    notificarTecnicoAtendiendo,
    notificarTecnicoLiberado,
    notificarNuevaUnidad,
  };
})();
