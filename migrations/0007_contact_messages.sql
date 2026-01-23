-- Migration: 0007_contact_messages.sql
-- Description: Contact form messages and support tickets
-- Date: 2026-01-20

-- Contact form messages from public website
CREATE TABLE IF NOT EXISTS mensajes_contacto (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    email TEXT NOT NULL,
    telefono TEXT,
    asunto TEXT NOT NULL,
    mensaje TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'nuevo' CHECK (estado IN ('nuevo', 'leido', 'respondido', 'cerrado', 'spam')),
    ip_origen TEXT,
    user_agent TEXT,
    respondido_por INTEGER REFERENCES usuarios(id),
    respuesta TEXT,
    fecha_creacion TEXT NOT NULL DEFAULT (datetime('now')),
    fecha_respuesta TEXT,
    fecha_lectura TEXT
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_mensajes_contacto_estado ON mensajes_contacto(estado);
CREATE INDEX IF NOT EXISTS idx_mensajes_contacto_fecha ON mensajes_contacto(fecha_creacion);
CREATE INDEX IF NOT EXISTS idx_mensajes_contacto_email ON mensajes_contacto(email);

-- Contact form subjects/categories
CREATE TABLE IF NOT EXISTS asuntos_contacto (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    activo INTEGER NOT NULL DEFAULT 1,
    orden INTEGER NOT NULL DEFAULT 0
);

-- Seed default contact subjects
INSERT OR IGNORE INTO asuntos_contacto (codigo, nombre, descripcion, orden) VALUES
('consulta', 'Consulta general', 'Preguntas generales sobre nuestros servicios', 1),
('envio', 'Problema con un envio', 'Reportar un problema con una remesa existente', 2),
('pago', 'Consulta sobre pagos', 'Preguntas sobre metodos de pago y procesamiento', 3),
('cuenta', 'Problema con mi cuenta', 'Problemas de acceso o configuracion de cuenta', 4),
('sugerencia', 'Sugerencia', 'Sugerencias para mejorar nuestro servicio', 5),
('reclamo', 'Reclamo formal', 'Presentar un reclamo formal', 6),
('otro', 'Otro', 'Otros temas no listados', 99);

-- Trigger to generate contact message number
CREATE TRIGGER IF NOT EXISTS generar_numero_mensaje
AFTER INSERT ON mensajes_contacto
WHEN NEW.numero IS NULL OR NEW.numero = ''
BEGIN
    UPDATE mensajes_contacto
    SET numero = 'MSG-' || strftime('%Y%m', 'now') || '-' || printf('%04d', NEW.id)
    WHERE id = NEW.id;
END;
