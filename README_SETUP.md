# CCTV Fleet Control — Guía de configuración Supabase

## Estado actual
- ✅ Esquema SQL aplicado en Supabase: `sxzhmcrpeyuqslupttby`
- ✅ Administrador Master creado en auth.users y tabla usuarios
- ✅ Modo Supabase activado en `js/supabase-config.js`
- ✅ Bugs de login corregidos en `js/auth.js`

---

## Credenciales del Administrador Master

| Campo | Valor |
|-------|-------|
| **Usuario** | `admin#.` |
| **Contraseña** | `J4ndr030..` |
| Nombre | Alejandro Vazquez Sarabia |
| Base | Tapachula |
| Email | jsarabiamx@gmail.com |
| Teléfono | +529621775024 |
| Fecha nac. | 30/10/2001 |
| ID empleado | 41001939 |

---

## Login inicial

1. Abre `index.html` en el navegador.
2. Ingresa usuario: `admin#.`
3. Ingresa contraseña: `J4ndr030..`
4. El sistema autenticará contra Supabase y redirigirá a `app.html`.

> ⚠️ Si intentas entrar con `admin` / `admin`, el sistema te indicará que uses `admin#.`  
> ya que el Administrador Master ya fue configurado.

---

## Crear un técnico de prueba

Desde el panel del Administrador Master (`app.html`):
1. Ve a **Usuarios** en el menú lateral.
2. Haz clic en **Agregar usuario**.
3. Llena nombre, email único, contraseña temporal, rol = Técnico.
4. El técnico recibirá `firstLogin = true` y deberá cambiar contraseña al primer acceso.

---

## Tablas creadas en Supabase

| Tabla | Descripción |
|-------|-------------|
| `usuarios` | Perfiles de usuario (vinculados a auth.users) |
| `roles` | Catálogo: master, admin, tecnico, plataforma |
| `empresas` | GHO, ETN, AERS, AMEALSENSE + nuevas |
| `bases` | Bases operativas por empresa |
| `unidades` | Vehículos/activos con CCTV |
| `reportes` | Tickets de servicio (preventivo/correctivo) |
| `mantenimientos` | Detalle de mantenimientos |
| `asignaciones` | Técnico asignado a reporte |
| `notificaciones` | Notificaciones por usuario/rol |
| `auditoria` | Historial de acciones |
| `app_config` | KV store: sesiones, recovery, selectores |
| `plataformas` | Plataformas de monitoreo |
| `tipo_servicio` | Catálogo de tipos de servicio |
| `estatus_ticket` | Estados de ticket |
| `tipo_incidencia` | Tipos de falla |
| `categorias` | Categorías de componentes |
| `componentes` | Piezas/componentes |
| `proveedores_equipo` | Proveedores |
| `ubicaciones_camara` | Ubicaciones de cámaras |
| `estado_dvr/disco/gps/sim` | Estados de equipos |
| `opciones_piso` | Pisos de edificio |
| `recovery_codes` | Códigos de recuperación de contraseña |
| `tecnico_empresa` | Relación M2M técnico-empresa |

---

## Si necesitas recrear el esquema desde cero

1. Borra todas las tablas en Supabase (o crea un proyecto nuevo).
2. Ejecuta `supabase/schema.sql` en el SQL Editor de Supabase.
3. Crea el usuario master en **Authentication > Users**: email `jsarabiamx@gmail.com`, contraseña `J4ndr030..`.
4. Ejecuta este SQL para vincular el perfil:
```sql
INSERT INTO usuarios (auth_user_id, username, nombre, email, telefono, 
  fecha_nacimiento, "fechaNacimiento", empleado_id, "empleadoId",
  role, base, empresas, activo, is_active, first_login, "firstLogin")
VALUES (
  '<ID-DE-AUTH-USER>',
  'admin#.', 'Alejandro Vazquez Sarabia', 'jsarabiamx@gmail.com',
  '+529621775024', '2001-10-30', '30/10/2001', '41001939', '41001939',
  'master', 'Tapachula', ARRAY['GHO','ETN','AERS','AMEALSENSE'],
  true, true, false, false
);
```

---

## Variables de entorno

La app usa anon key directamente en `js/supabase-config.js`. **Nunca** uses la `service_role_key` en el frontend.

Si necesitas operaciones con privilegios elevados (ej. crear usuarios Auth desde admin),
se recomienda implementar un Edge Function de Supabase que reciba los datos y use la service key del lado servidor.

---

## Flujo de recuperación de contraseña

Solo el Administrador Master (`role = 'master'`) puede ver el enlace "Olvidé mi contraseña" en el login.
Los técnicos y admins normales deben solicitar recuperación al Administrador Master directamente.

