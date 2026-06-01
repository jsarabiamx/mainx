# CHANGELOG — CCTV Fleet Control / Mesa de Control GPS

## v5.0 — 2026-06-01
### Arquitectura
- Split `ui.js` en módulos independientes: `ui.js` + `ui-plataformas.js` + `ui-analisis.js` + `ui-fallas.js`
- Renombrado `sims.js` → `ui-sims.js` y `sims-historial.js` → `ui-sims-historial.js`
- Fusionado `empresa-themes.css` en `styles.css`
- Backend migrado de localStorage a Supabase como fuente de verdad

### Fixes
- Fix: GHO muestra datos desde Supabase aunque no tenga asignación subida
- Fix: VOLVO parser detecta formato GHO (sin prefijo ETN-, headers en fila 0)
- Fix: Botón "Eliminar selec." resetea contador después de eliminar
- Fix: GHO asignación llega a Supabase (era `null` como empresa_id)
- Fix: MOTIVE usa empresa activa como empresa_id (no el fabricante del archivo)
- Fix: Paginación automática en `_getRaw` para +1000 filas Supabase
- Fix: Carga atómica evita mostrar 0 unidades durante sync Supabase

## v4.0 — 2026-05-31
### Fixes
- Fix: `gps-db.js` restaurado (había sido sobreescrito con `db.js`)
- Fix: `forzarRecargaSupabase` definida en `app.js`
- Fix: Deduplicar registros SAMSARA antes de upsert (ON CONFLICT batch)
- Fix: Parser VOLVO agregado para archivo tracking-report de Volvo Connect
- Fix: Barridos ETN/GHO llegan a Supabase (await en ui.js)
- Fix: MOTIVE foreign key constraint (empresa_id era fabricante del equipo)

## v3.0 — 2026-05-15
### Supabase integration
- Migración completa de localStorage a Supabase
- Tablas: `gps_asignaciones`, `gps_barridos`, `gps_fallas`, `gps_sims`, `gps_notas`
- Paginación automática `_getRaw` para tablas grandes
- Sync background cada 2s para barridos, 15s para fallas

## v2.0 — 2026-04-01
### Features
- Parser MOTIVE para devices_report Excel
- Parser SCANIA, MAN, VOLVO
- Módulo SIMs (control + historial)
- Panel de Fallas AFR/Siniestros
- Barrido Manual desde texto de técnicos
