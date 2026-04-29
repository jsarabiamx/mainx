/* Configuración Supabase - CCTV Fleet Control */
// MODO SUPABASE ACTIVADO — El esquema ya fue creado en la base de datos.
window.__DATA_MODE__ = 'supabase';

window.CCTV_SUPABASE_CONFIG = {
  url: 'https://sxzhmcrpeyuqslupttby.supabase.co',
  restUrl: 'https://sxzhmcrpeyuqslupttby.supabase.co/rest/v1',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4emhtY3JwZXl1cXNsdXB0dGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MjQ5MDgsImV4cCI6MjA5MzAwMDkwOH0.-muAjBKc2PekqbgRltLVBnUCdxfQlHNxmVruXrw_sl8',
  tables: {
    users: 'usuarios',
    reportes: 'reportes',
    notificaciones: 'notificaciones',
    audit: 'auditoria',
    config: 'app_config'
  }
};
