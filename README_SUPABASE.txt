CCTV Fleet Control - conexión Supabase preparada SIN esquema SQL

Cambios realizados en este ZIP:
1. Se eliminó la carpeta/archivo supabase/schema.sql.
2. Se conserva js/supabase-config.js con la URL y anon key del proyecto.
3. Se conserva js/supabaseService.js con las funciones/adaptador preparado para Supabase.
4. index.html, app.html y tecnico.html siguen cargando Supabase CDN, supabase-config.js, supabaseService.js y dataService.js en el orden correcto.
5. js/dataService.js sigue preparado para trabajar con localStorage o con Supabase según el modo configurado.

Modo actual:
- window.__DATA_MODE__ está en 'local' dentro de js/supabase-config.js.
- Esto evita bugs por tablas inexistentes mientras todavía no quieres crear el esquema de base de datos.
- Puedes seguir probando la app de forma local sin depender de Supabase.

Cuando ya quieras conectar la base de datos real:
1. Primero se debe crear un esquema SQL correcto y revisado para tus tablas reales.
2. Después cambia en js/supabase-config.js:
   window.__DATA_MODE__ = 'local';
   por:
   window.__DATA_MODE__ = 'supabase';
3. Si las tablas aún no existen y activas 'supabase', aparecerán errores de sesión, login o guardado porque la app intentará leer tablas que todavía no están creadas.

Archivos importantes conservados:
- js/supabase-config.js
- js/supabaseService.js
- js/dataService.js

Nota:
Este ZIP deja la conexión y funciones listas en código, pero no incluye ni ejecuta ningún esquema de base de datos para evitar que te perjudique o genere bugs en esta etapa.
