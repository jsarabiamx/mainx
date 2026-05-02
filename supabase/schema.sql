-- CCTV Fleet Control — Schema completo v1.0
-- Ver README_SETUP.md para instrucciones completas
-- Ejecutar completo en Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TABLE roles (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), nombre text NOT NULL UNIQUE, descripcion text, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
INSERT INTO roles (nombre, descripcion) VALUES ('master','Administrador Master'),('admin','Administrador'),('tecnico','Técnico de campo'),('plataforma','Operador de plataforma');

CREATE TABLE tipo_servicio (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), nombre text NOT NULL UNIQUE, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
INSERT INTO tipo_servicio (nombre) VALUES ('Preventivo'),('Correctivo'),('Instalación'),('Revisión'),('Emergencia');

CREATE TABLE estatus_ticket (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), nombre text NOT NULL UNIQUE, color text, orden int DEFAULT 0, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
INSERT INTO estatus_ticket (nombre, color, orden) VALUES ('Pendiente','#f59e0b',1),('En proceso','#3b82f6',2),('Resuelto','#22c55e',3),('Cancelado','#6b7280',4),('Escalado','#ef4444',5);

CREATE TABLE tipo_incidencia (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), nombre text NOT NULL UNIQUE, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
INSERT INTO tipo_incidencia (nombre) VALUES ('Cámara sin imagen'),('DVR sin señal'),('Pérdida de video'),('Daño físico'),('Falla eléctrica'),('Falla de red'),('Disco duro'),('Otro');

CREATE TABLE opciones_piso (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), nombre text NOT NULL UNIQUE, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
INSERT INTO opciones_piso (nombre) VALUES ('PB'),('1'),('2'),('3'),('4'),('5'),('Azotea'),('Sótano'),('Exterior');

CREATE TABLE proveedores_equipo (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), nombre text NOT NULL UNIQUE, contacto text, telefono text, email text, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz);

CREATE TABLE categorias (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), nombre text NOT NULL UNIQUE, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
INSERT INTO categorias (nombre) VALUES ('Cámaras'),('DVR/NVR'),('Cables'),('Conectores'),('Fuentes de poder'),('Discos duros'),('GPS'),('SIM 3G');

CREATE TABLE componentes (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), nombre text NOT NULL, categoria_id uuid REFERENCES categorias(id) ON DELETE SET NULL, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE ubicaciones_camara (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), nombre text NOT NULL UNIQUE, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
INSERT INTO ubicaciones_camara (nombre) VALUES ('Interior'),('Exterior'),('Pasillo'),('Entrada principal'),('Estacionamiento'),('Bodega'),('Oficina'),('Recepción');

CREATE TABLE estado_dvr (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), nombre text NOT NULL UNIQUE, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
INSERT INTO estado_dvr (nombre) VALUES ('Operativo'),('Falla parcial'),('Sin señal'),('Apagado'),('En reparación');

CREATE TABLE estado_disco (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), nombre text NOT NULL UNIQUE, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
INSERT INTO estado_disco (nombre) VALUES ('Operativo'),('Con errores'),('Lleno'),('Fallo'),('Reemplazado');

CREATE TABLE estado_gps (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), nombre text NOT NULL UNIQUE, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
INSERT INTO estado_gps (nombre) VALUES ('Activo'),('Sin señal'),('Inactivo'),('Sin dispositivo');

CREATE TABLE estado_sim (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), nombre text NOT NULL UNIQUE, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
INSERT INTO estado_sim (nombre) VALUES ('Activa'),('Sin saldo'),('Inactiva'),('Sin SIM');

CREATE TABLE empresas (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), nombre text NOT NULL UNIQUE, codigo text, direccion text, telefono text, email text, contacto text, notas text, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz, deleted_at timestamptz, deleted_by text);
INSERT INTO empresas (nombre, codigo) VALUES ('GHO','GHO'),('ETN','ETN'),('AERS','AERS'),('AMEALSENSE','AMEALSENSE');
CREATE TRIGGER empresas_updated_at BEFORE UPDATE ON empresas FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE bases (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), nombre text NOT NULL, empresa_id uuid REFERENCES empresas(id) ON DELETE SET NULL, ciudad text, estado text, direccion text, telefono text, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz, deleted_at timestamptz, deleted_by text);
INSERT INTO bases (nombre, ciudad, estado) VALUES ('Tapachula','Tapachula','Chiapas'),('CDMX','Ciudad de México','CDMX'),('Guadalajara','Guadalajara','Jalisco');
CREATE TRIGGER bases_updated_at BEFORE UPDATE ON bases FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE usuarios (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), auth_user_id uuid UNIQUE, username text NOT NULL UNIQUE, nombre text NOT NULL DEFAULT '', email text NOT NULL DEFAULT '', telefono text, fecha_nacimiento date, "fechaNacimiento" text, empleado_id text, "empleadoId" text, role text NOT NULL DEFAULT 'tecnico' REFERENCES roles(nombre) ON UPDATE CASCADE, base text, bases_ids uuid[], empresas text[], activo boolean NOT NULL DEFAULT true, is_active boolean NOT NULL DEFAULT true, first_login boolean NOT NULL DEFAULT false, "firstLogin" boolean NOT NULL DEFAULT false, password text, password_hash text, auth_provider text DEFAULT 'supabase', "loginHistory" jsonb DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz, created_by text DEFAULT 'sistema', deleted_at timestamptz, deleted_by text);
CREATE INDEX idx_usuarios_username ON usuarios(username);
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_role ON usuarios(role);
CREATE INDEX idx_usuarios_active ON usuarios(is_active);
CREATE TRIGGER usuarios_updated_at BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE unidades (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), empresa_id uuid REFERENCES empresas(id) ON DELETE SET NULL, base_id uuid REFERENCES bases(id) ON DELETE SET NULL, numero_unidad text NOT NULL, placas text, modelo text, anio int, num_camaras int DEFAULT 0, num_dvr int DEFAULT 0, estado_dvr_id uuid REFERENCES estado_dvr(id) ON DELETE SET NULL, estado_disco_id uuid REFERENCES estado_disco(id) ON DELETE SET NULL, estado_gps_id uuid REFERENCES estado_gps(id) ON DELETE SET NULL, estado_sim_id uuid REFERENCES estado_sim(id) ON DELETE SET NULL, notas text, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz, deleted_at timestamptz, deleted_by text);
CREATE TRIGGER unidades_updated_at BEFORE UPDATE ON unidades FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE reportes (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), empresa text NOT NULL DEFAULT 'GHO', empresa_id uuid REFERENCES empresas(id) ON DELETE SET NULL, base_id uuid REFERENCES bases(id) ON DELETE SET NULL, unidad_id uuid REFERENCES unidades(id) ON DELETE SET NULL, tipo_servicio_id uuid REFERENCES tipo_servicio(id) ON DELETE SET NULL, tipo_incidencia_id uuid REFERENCES tipo_incidencia(id) ON DELETE SET NULL, estatus_id uuid REFERENCES estatus_ticket(id) ON DELETE SET NULL, titulo text, descripcion text, numero_economico text, placas text, piso text, ubicacion_camara text, num_camara text, falla_descripcion text, componente_id uuid REFERENCES componentes(id) ON DELETE SET NULL, tecnico_asignado uuid REFERENCES usuarios(id) ON DELETE SET NULL, creado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL, cerrado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL, fecha_asignacion timestamptz, fecha_atencion timestamptz, fecha_cierre timestamptz, solucion text, imagenes text[], notas text, prioridad text DEFAULT 'normal', payload jsonb DEFAULT '{}', is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz, deleted_at timestamptz, deleted_by text);
CREATE INDEX idx_reportes_empresa ON reportes(empresa);
CREATE INDEX idx_reportes_tecnico ON reportes(tecnico_asignado);
CREATE INDEX idx_reportes_active ON reportes(is_active);
CREATE TRIGGER reportes_updated_at BEFORE UPDATE ON reportes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE mantenimientos (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), reporte_id uuid REFERENCES reportes(id) ON DELETE CASCADE, unidad_id uuid REFERENCES unidades(id) ON DELETE SET NULL, tecnico_id uuid REFERENCES usuarios(id) ON DELETE SET NULL, tipo text NOT NULL DEFAULT 'preventivo', descripcion text, componentes_rev jsonb DEFAULT '[]', resultado text, proxima_revision date, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz);
CREATE TRIGGER mantenimientos_updated_at BEFORE UPDATE ON mantenimientos FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE asignaciones (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), reporte_id uuid REFERENCES reportes(id) ON DELETE CASCADE, tecnico_id uuid REFERENCES usuarios(id) ON DELETE SET NULL, asignado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL, fecha timestamptz NOT NULL DEFAULT now(), notas text, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX idx_asignaciones_reporte ON asignaciones(reporte_id);
CREATE INDEX idx_asignaciones_tecnico ON asignaciones(tecnico_id);

CREATE TABLE notificaciones (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), reporte_id uuid REFERENCES reportes(id) ON DELETE CASCADE, destino text NOT NULL, tipo text DEFAULT 'info', titulo text, mensaje text, leida boolean NOT NULL DEFAULT false, fecha timestamptz NOT NULL DEFAULT now(), payload jsonb DEFAULT '{}', is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX idx_notif_destino ON notificaciones(destino);

CREATE TABLE auditoria (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), usuario text NOT NULL DEFAULT 'sistema', accion text NOT NULL, tipo text, tabla text, registro_id text, empresa text, detalle text, valor_anterior jsonb, valor_nuevo jsonb, ip text, created_at timestamptz NOT NULL DEFAULT now(), fecha timestamptz NOT NULL DEFAULT now());
CREATE INDEX idx_auditoria_usuario ON auditoria(usuario);
CREATE INDEX idx_auditoria_fecha ON auditoria(fecha);

CREATE TABLE app_config (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), key text NOT NULL UNIQUE, value jsonb, updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX idx_app_config_key ON app_config(key);

CREATE TABLE plataformas (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), nombre text NOT NULL, empresa_id uuid REFERENCES empresas(id) ON DELETE SET NULL, url text, usuario_acc text, notas text, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz, deleted_at timestamptz, deleted_by text);
CREATE TRIGGER plataformas_updated_at BEFORE UPDATE ON plataformas FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE tecnico_empresa (tecnico_id uuid REFERENCES usuarios(id) ON DELETE CASCADE, empresa_id uuid REFERENCES empresas(id) ON DELETE CASCADE, PRIMARY KEY (tecnico_id, empresa_id));

CREATE TABLE recovery_codes (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), username text NOT NULL, code text NOT NULL, usado boolean NOT NULL DEFAULT false, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX idx_recovery_username ON recovery_codes(username);

-- RLS
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE reportes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipo_servicio ENABLE ROW LEVEL SECURITY;
ALTER TABLE estatus_ticket ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipo_incidencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE componentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE plataformas ENABLE ROW LEVEL SECURITY;
ALTER TABLE mantenimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE asignaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_usuarios" ON usuarios FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_reportes" ON reportes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_notificaciones" ON notificaciones FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_auditoria" ON auditoria FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_app_config" ON app_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON empresas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON bases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON unidades FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON tipo_servicio FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON estatus_ticket FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON tipo_incidencia FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON categorias FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON componentes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON plataformas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON mantenimientos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON asignaciones FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON recovery_codes FOR ALL USING (true) WITH CHECK (true);
