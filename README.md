# CCTV Fleet Control v7.0

Sistema de control de mantenimientos preventivos/correctivos CCTV.  
Conectado a Supabase · Login funcional · Persistencia real.

---

## Configuración rápida

### 1. Variables de Supabase
El proyecto ya está preconfigurado en `js/supabase-config.js`:
```
URL:      https://sxzhmcrpeyuqslupttby.supabase.co
Proyecto: sxzhmcrpeyuqslupttby
```
> Solo modifica el archivo si cambias de proyecto Supabase.

### 2. Ejecutar migraciones (ya aplicadas al proyecto)
Si necesitas aplicar el esquema en un proyecto nuevo:
```bash
# Ejecuta el contenido de:
supabase/migrations/20250428000001_initial_schema.sql
# En: Supabase Dashboard → SQL Editor
```

### 3. Tablas creadas
| Tabla | Descripción |
|---|---|
| `usuarios` | Perfiles de usuario vinculados a auth.users |
| `empresas` | Catálogo de empresas (GHO, ETN, AERS, AMEALSENSE) |
| `bases` | Bases operativas por empresa |
| `reportes` | Tickets/reportes de fallas CCTV |
| `notificaciones` | Notificaciones del sistema |
| `auditoria` | Historial de acciones |
| `app_config` | Configuración global (selectores, sesión, etc.) |

---

## Login inicial

1. Abre `index.html`
2. **Usuario:** `admin` · **Contraseña:** `admin`
3. Completa el formulario del Administrador Master:
   - Nombre completo
   - Base, correo, teléfono, fecha de nacimiento, ID empleado
   - Nueva contraseña
4. Para siguientes accesos: **Usuario:** `admin#.` y tu nueva contraseña

---

## Crear usuarios

Desde el panel Master → Módulo **Usuarios** → botón **Nuevo usuario**.  
Campos: nombre, username, email (obligatorio), rol, base, contraseña inicial.

---

## Estructura de archivos
```
├── index.html          → Login
├── app.html            → Panel Admin/Master
├── tecnico.html        → Panel Técnico
├── css/                → Estilos
└── js/
    ├── supabase-config.js    → URL y anon key
    ├── supabaseService.js    → Adaptador Supabase real
    ├── dataService.js        → Capa CRUD (usa supabaseService en modo 'supabase')
    ├── auth.js               → Autenticación y sesión
    ├── login.js              → Lógica pantalla login
    ├── app-main.js           → Controlador panel principal
    └── tecnico.js            → Panel técnico
```

---

## Verificar persistencia
1. Inicia sesión como admin master
2. Crea un reporte o usuario
3. Cierra sesión (o cierra el navegador)
4. Vuelve a entrar → los datos persisten en Supabase

---

## Notas de seguridad
- Solo se usa la **anon key** en el frontend (nunca service_role_key)
- RLS habilitado en todas las tablas
- Las contraseñas nunca se almacenan en texto plano
- La sesión se guarda en Supabase (`app_config`) + localStorage como caché
