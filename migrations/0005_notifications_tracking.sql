-- Migration: Notifications and GPS Tracking
-- Created: 2026-01-20
-- Adds notification log, device tracking, and location history

-- ============ Notification Types ============

CREATE TABLE IF NOT EXISTS tipos_notificacion (
    id INTEGER PRIMARY KEY,
    codigo TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    plantilla_sms TEXT,
    plantilla_whatsapp TEXT,
    plantilla_email_asunto TEXT,
    plantilla_email_cuerpo TEXT,
    plantilla_push_titulo TEXT,
    plantilla_push_cuerpo TEXT,
    activo INTEGER NOT NULL DEFAULT 1
);

-- Seed notification types
INSERT OR IGNORE INTO tipos_notificacion (id, codigo, nombre, plantilla_sms, plantilla_whatsapp, plantilla_push_titulo, plantilla_push_cuerpo) VALUES
    (1, 'REMESA_CREADA', 'Remesa Creada',
        'Su remesa {codigo} ha sido creada. Monto: ${monto_envio}. Seguimiento: {url_rastreo}',
        'Su remesa *{codigo}* ha sido creada. Monto: *${monto_envio}*. Seguimiento: {url_rastreo}',
        'Remesa Creada',
        'Su remesa {codigo} ha sido creada por ${monto_envio}'),
    (2, 'REMESA_APROBADA', 'Remesa Aprobada',
        'Su solicitud {codigo} ha sido aprobada. Pronto será asignada a un repartidor.',
        'Su solicitud *{codigo}* ha sido aprobada. Pronto será asignada a un repartidor.',
        'Solicitud Aprobada',
        'Su solicitud {codigo} ha sido aprobada'),
    (3, 'REMESA_EN_PROCESO', 'Remesa en Proceso',
        'Su remesa {codigo} está en camino. El repartidor la entregará pronto.',
        'Su remesa *{codigo}* está en camino. El repartidor la entregará pronto.',
        'Remesa en Camino',
        'Su remesa {codigo} está siendo entregada'),
    (4, 'REMESA_ENTREGADA', 'Remesa Entregada',
        'Su remesa {codigo} ha sido entregada exitosamente a {beneficiario_nombre}.',
        'Su remesa *{codigo}* ha sido entregada exitosamente a *{beneficiario_nombre}*.',
        'Remesa Entregada',
        'Su remesa {codigo} ha sido entregada'),
    (5, 'NUEVA_SOLICITUD_ADMIN', 'Nueva Solicitud (Admin)',
        'Nueva solicitud de remesa {codigo} - ${monto_envio} para {beneficiario_nombre}',
        'Nueva solicitud de remesa *{codigo}* - *${monto_envio}* para *{beneficiario_nombre}*',
        'Nueva Solicitud',
        'Nueva solicitud {codigo} por ${monto_envio}'),
    (6, 'NUEVA_ASIGNACION_REPARTIDOR', 'Nueva Asignación (Repartidor)',
        'Nueva remesa asignada: {codigo} - {monto_entrega} {moneda_entrega} para {beneficiario_nombre} en {beneficiario_direccion}',
        'Nueva remesa asignada: *{codigo}* - *{monto_entrega} {moneda_entrega}* para *{beneficiario_nombre}* en {beneficiario_direccion}',
        'Nueva Remesa Asignada',
        '{codigo} - {monto_entrega} {moneda_entrega}'),
    (7, 'PAGO_RECIBIDO', 'Pago Recibido',
        'Hemos recibido su pago de ${monto}. Su saldo pendiente es ${saldo_pendiente}.',
        'Hemos recibido su pago de *${monto}*. Su saldo pendiente es *${saldo_pendiente}*.',
        'Pago Recibido',
        'Pago de ${monto} recibido');

-- ============ Notification Log ============

CREATE TABLE IF NOT EXISTS notificaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER REFERENCES usuarios(id),
    remesa_id INTEGER REFERENCES remesas(id),
    tipo_notificacion_id INTEGER REFERENCES tipos_notificacion(id),
    canal TEXT NOT NULL CHECK (canal IN ('sms', 'whatsapp', 'push', 'email')),
    destinatario TEXT NOT NULL,
    mensaje TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'enviando', 'enviado', 'fallido', 'entregado')),
    error_mensaje TEXT,
    provider_message_id TEXT,
    fecha_creacion TEXT NOT NULL DEFAULT (datetime('now')),
    fecha_envio TEXT,
    fecha_entrega TEXT,
    intentos INTEGER NOT NULL DEFAULT 0,
    max_intentos INTEGER NOT NULL DEFAULT 3,
    siguiente_intento TEXT
);

CREATE INDEX IF NOT EXISTS notificaciones_usuario_idx ON notificaciones(usuario_id);
CREATE INDEX IF NOT EXISTS notificaciones_remesa_idx ON notificaciones(remesa_id);
CREATE INDEX IF NOT EXISTS notificaciones_estado_idx ON notificaciones(estado);
CREATE INDEX IF NOT EXISTS notificaciones_fecha_idx ON notificaciones(fecha_creacion);
CREATE INDEX IF NOT EXISTS notificaciones_canal_idx ON notificaciones(canal);
CREATE INDEX IF NOT EXISTS notificaciones_pendientes_idx ON notificaciones(estado, siguiente_intento)
    WHERE estado IN ('pendiente', 'fallido');

-- ============ GPS Device Tracking ============

CREATE TABLE IF NOT EXISTS dispositivos_repartidor (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repartidor_id INTEGER NOT NULL REFERENCES usuarios(id),
    device_id TEXT NOT NULL,
    nombre_dispositivo TEXT,
    platform TEXT CHECK (platform IN ('ios', 'android', 'web')),
    push_token TEXT,
    last_latitude REAL,
    last_longitude REAL,
    last_accuracy REAL,
    last_location_update TEXT,
    compartir_ubicacion INTEGER NOT NULL DEFAULT 0,
    activo INTEGER NOT NULL DEFAULT 1,
    fecha_registro TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(repartidor_id, device_id)
);

CREATE INDEX IF NOT EXISTS dispositivos_repartidor_idx ON dispositivos_repartidor(repartidor_id);
CREATE INDEX IF NOT EXISTS dispositivos_activo_idx ON dispositivos_repartidor(activo);
CREATE INDEX IF NOT EXISTS dispositivos_compartiendo_idx ON dispositivos_repartidor(compartir_ubicacion)
    WHERE compartir_ubicacion = 1;

-- ============ Location History ============

CREATE TABLE IF NOT EXISTS ubicaciones_historial (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repartidor_id INTEGER NOT NULL REFERENCES usuarios(id),
    dispositivo_id INTEGER REFERENCES dispositivos_repartidor(id),
    remesa_id INTEGER REFERENCES remesas(id),
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    accuracy REAL,
    speed REAL,
    heading REAL,
    altitude REAL,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    tipo TEXT DEFAULT 'tracking' CHECK (tipo IN ('tracking', 'delivery_start', 'delivery_complete', 'manual'))
);

CREATE INDEX IF NOT EXISTS ubicaciones_repartidor_idx ON ubicaciones_historial(repartidor_id);
CREATE INDEX IF NOT EXISTS ubicaciones_remesa_idx ON ubicaciones_historial(remesa_id);
CREATE INDEX IF NOT EXISTS ubicaciones_timestamp_idx ON ubicaciones_historial(timestamp);

-- Partition-like index for recent data (most queries are for recent locations)
CREATE INDEX IF NOT EXISTS ubicaciones_recent_idx ON ubicaciones_historial(repartidor_id, timestamp DESC);

-- ============ User Notification Preferences ============

-- Add notification preferences to usuarios table
ALTER TABLE usuarios ADD COLUMN email TEXT;
ALTER TABLE usuarios ADD COLUMN preferencias_notificacion TEXT DEFAULT '{"sms":true,"whatsapp":true,"push":true,"email":false}';

-- Index for email lookups
CREATE INDEX IF NOT EXISTS usuarios_email_idx ON usuarios(email);

-- ============ Triggers ============

-- Trigger: Update device last location when inserting location history
CREATE TRIGGER IF NOT EXISTS update_device_location
AFTER INSERT ON ubicaciones_historial
FOR EACH ROW
WHEN NEW.dispositivo_id IS NOT NULL
BEGIN
    UPDATE dispositivos_repartidor
    SET last_latitude = NEW.latitude,
        last_longitude = NEW.longitude,
        last_accuracy = NEW.accuracy,
        last_location_update = NEW.timestamp
    WHERE id = NEW.dispositivo_id;
END;

-- Trigger: Increment notification attempt count
CREATE TRIGGER IF NOT EXISTS increment_notification_attempts
BEFORE UPDATE OF estado ON notificaciones
FOR EACH ROW
WHEN NEW.estado = 'enviando' AND OLD.estado != 'enviando'
BEGIN
    SELECT CASE
        WHEN OLD.intentos >= OLD.max_intentos
        THEN RAISE(ABORT, 'Maximum notification attempts exceeded')
    END;
END;

-- Trigger: Clean old location history (keep only 30 days)
CREATE TRIGGER IF NOT EXISTS cleanup_old_locations
AFTER INSERT ON ubicaciones_historial
WHEN (SELECT COUNT(*) FROM ubicaciones_historial) > 10000
BEGIN
    DELETE FROM ubicaciones_historial
    WHERE timestamp < datetime('now', '-30 days')
    AND tipo = 'tracking';
END;
