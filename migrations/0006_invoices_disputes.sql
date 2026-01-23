-- Migration: Invoices and Disputes
-- Created: 2026-01-20
-- Adds invoice generation and dispute resolution system

-- ============ Invoice Types ============

CREATE TABLE IF NOT EXISTS tipos_factura (
    id INTEGER PRIMARY KEY,
    codigo TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    prefijo_numero TEXT NOT NULL,
    plantilla_pdf TEXT
);

INSERT OR IGNORE INTO tipos_factura (id, codigo, nombre, prefijo_numero) VALUES
    (1, 'remesa', 'Factura de Remesa', 'REM'),
    (2, 'comision', 'Factura de Comisión', 'COM'),
    (3, 'pago_revendedor', 'Recibo de Pago Revendedor', 'PAG'),
    (4, 'liquidacion', 'Liquidación de Efectivo', 'LIQ');

-- ============ Invoices ============

CREATE TABLE IF NOT EXISTS facturas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero TEXT NOT NULL UNIQUE,
    tipo_factura_id INTEGER NOT NULL REFERENCES tipos_factura(id),
    remesa_id INTEGER REFERENCES remesas(id),
    usuario_id INTEGER REFERENCES usuarios(id),
    pago_revendedor_id INTEGER REFERENCES pagos_revendedor(id),
    -- Amounts
    subtotal REAL NOT NULL,
    descuento REAL NOT NULL DEFAULT 0,
    impuesto REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL,
    moneda TEXT NOT NULL DEFAULT 'USD',
    -- State
    estado TEXT NOT NULL DEFAULT 'emitida' CHECK (estado IN ('borrador', 'emitida', 'pagada', 'cancelada', 'anulada')),
    -- Details
    notas TEXT,
    condiciones TEXT,
    -- PDF storage
    ruta_pdf TEXT,
    -- Dates
    fecha_emision TEXT NOT NULL DEFAULT (datetime('now')),
    fecha_vencimiento TEXT,
    fecha_pago TEXT,
    fecha_anulacion TEXT,
    -- Metadata
    datos_json TEXT,
    creado_por INTEGER NOT NULL REFERENCES usuarios(id)
);

CREATE INDEX IF NOT EXISTS facturas_numero_idx ON facturas(numero);
CREATE INDEX IF NOT EXISTS facturas_remesa_idx ON facturas(remesa_id);
CREATE INDEX IF NOT EXISTS facturas_usuario_idx ON facturas(usuario_id);
CREATE INDEX IF NOT EXISTS facturas_estado_idx ON facturas(estado);
CREATE INDEX IF NOT EXISTS facturas_fecha_idx ON facturas(fecha_emision);
CREATE INDEX IF NOT EXISTS facturas_tipo_idx ON facturas(tipo_factura_id);

-- Trigger: Auto-generate invoice number
CREATE TRIGGER IF NOT EXISTS generate_invoice_number
AFTER INSERT ON facturas
FOR EACH ROW
WHEN NEW.numero IS NULL OR NEW.numero = ''
BEGIN
    UPDATE facturas
    SET numero = (
        SELECT prefijo_numero || '-' || strftime('%Y%m', 'now') || '-' ||
               printf('%04d', COALESCE(
                   (SELECT COUNT(*) + 1 FROM facturas f2
                    WHERE f2.tipo_factura_id = NEW.tipo_factura_id
                    AND strftime('%Y%m', f2.fecha_emision) = strftime('%Y%m', 'now')),
                   1
               ))
        FROM tipos_factura WHERE id = NEW.tipo_factura_id
    )
    WHERE id = NEW.id;
END;

-- ============ Invoice Line Items ============

CREATE TABLE IF NOT EXISTS lineas_factura (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    factura_id INTEGER NOT NULL REFERENCES facturas(id) ON DELETE CASCADE,
    descripcion TEXT NOT NULL,
    cantidad REAL NOT NULL DEFAULT 1,
    precio_unitario REAL NOT NULL,
    subtotal REAL NOT NULL,
    orden INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS lineas_factura_idx ON lineas_factura(factura_id);

-- ============ Dispute Types ============

CREATE TABLE IF NOT EXISTS tipos_disputa (
    id INTEGER PRIMARY KEY,
    codigo TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    prioridad_default TEXT NOT NULL DEFAULT 'normal',
    sla_horas INTEGER NOT NULL DEFAULT 48
);

INSERT OR IGNORE INTO tipos_disputa (id, codigo, nombre, descripcion, prioridad_default, sla_horas) VALUES
    (1, 'no_entregado', 'No Entregado', 'El beneficiario reporta no haber recibido la remesa', 'alta', 24),
    (2, 'monto_incorrecto', 'Monto Incorrecto', 'El monto entregado no coincide con el esperado', 'alta', 24),
    (3, 'destinatario_incorrecto', 'Destinatario Incorrecto', 'La remesa fue entregada a la persona equivocada', 'urgente', 12),
    (4, 'demora', 'Demora en Entrega', 'La entrega está tardando más de lo esperado', 'normal', 48),
    (5, 'mal_trato', 'Mal Trato', 'Queja sobre el servicio o trato del repartidor', 'normal', 72),
    (6, 'cobro_indebido', 'Cobro Indebido', 'Se cobró un monto diferente al acordado', 'alta', 24),
    (7, 'otro', 'Otro', 'Otro tipo de problema no categorizado', 'normal', 48);

-- ============ Disputes ============

CREATE TABLE IF NOT EXISTS disputas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero TEXT NOT NULL UNIQUE,
    remesa_id INTEGER NOT NULL REFERENCES remesas(id),
    tipo_disputa_id INTEGER NOT NULL REFERENCES tipos_disputa(id),
    reportado_por INTEGER NOT NULL REFERENCES usuarios(id),
    asignado_a INTEGER REFERENCES usuarios(id),
    -- Details
    descripcion TEXT NOT NULL,
    evidencia_urls TEXT,  -- JSON array of file URLs
    -- State
    estado TEXT NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'en_investigacion', 'pendiente_cliente', 'resuelta', 'rechazada', 'escalada')),
    prioridad TEXT NOT NULL DEFAULT 'normal' CHECK (prioridad IN ('baja', 'normal', 'alta', 'urgente')),
    -- Resolution
    resolucion TEXT,
    tipo_resolucion TEXT CHECK (tipo_resolucion IN ('reembolso_total', 'reembolso_parcial', 'reenvio', 'compensacion', 'sin_accion', 'otro')),
    monto_reembolso REAL,
    resuelto_por INTEGER REFERENCES usuarios(id),
    -- Dates
    fecha_creacion TEXT NOT NULL DEFAULT (datetime('now')),
    fecha_limite TEXT,
    fecha_ultima_actualizacion TEXT,
    fecha_resolucion TEXT,
    -- Metadata
    datos_json TEXT
);

CREATE INDEX IF NOT EXISTS disputas_numero_idx ON disputas(numero);
CREATE INDEX IF NOT EXISTS disputas_remesa_idx ON disputas(remesa_id);
CREATE INDEX IF NOT EXISTS disputas_estado_idx ON disputas(estado);
CREATE INDEX IF NOT EXISTS disputas_prioridad_idx ON disputas(prioridad);
CREATE INDEX IF NOT EXISTS disputas_asignado_idx ON disputas(asignado_a);
CREATE INDEX IF NOT EXISTS disputas_fecha_idx ON disputas(fecha_creacion);

-- Compound index for dashboard queries
CREATE INDEX IF NOT EXISTS disputas_estado_prioridad_idx ON disputas(estado, prioridad, fecha_creacion);

-- Trigger: Auto-generate dispute number
CREATE TRIGGER IF NOT EXISTS generate_dispute_number
AFTER INSERT ON disputas
FOR EACH ROW
WHEN NEW.numero IS NULL OR NEW.numero = ''
BEGIN
    UPDATE disputas
    SET numero = 'DIS-' || strftime('%Y%m%d', 'now') || '-' || printf('%04d', NEW.id)
    WHERE id = NEW.id;
END;

-- Trigger: Set fecha_limite based on SLA
CREATE TRIGGER IF NOT EXISTS set_dispute_deadline
AFTER INSERT ON disputas
FOR EACH ROW
WHEN NEW.fecha_limite IS NULL
BEGIN
    UPDATE disputas
    SET fecha_limite = datetime('now', '+' || (SELECT sla_horas FROM tipos_disputa WHERE id = NEW.tipo_disputa_id) || ' hours')
    WHERE id = NEW.id;
END;

-- ============ Dispute Comments/Activity ============

CREATE TABLE IF NOT EXISTS comentarios_disputa (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    disputa_id INTEGER NOT NULL REFERENCES disputas(id) ON DELETE CASCADE,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    tipo TEXT NOT NULL DEFAULT 'comentario' CHECK (tipo IN ('comentario', 'cambio_estado', 'asignacion', 'evidencia', 'sistema')),
    contenido TEXT NOT NULL,
    es_interno INTEGER NOT NULL DEFAULT 0,  -- Internal notes not visible to customer
    archivos_urls TEXT,  -- JSON array
    fecha TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS comentarios_disputa_idx ON comentarios_disputa(disputa_id);
CREATE INDEX IF NOT EXISTS comentarios_fecha_idx ON comentarios_disputa(fecha);

-- Trigger: Update disputa fecha_ultima_actualizacion on new comment
CREATE TRIGGER IF NOT EXISTS update_disputa_timestamp
AFTER INSERT ON comentarios_disputa
FOR EACH ROW
BEGIN
    UPDATE disputas
    SET fecha_ultima_actualizacion = datetime('now')
    WHERE id = NEW.disputa_id;
END;

-- ============ File Attachments ============

CREATE TABLE IF NOT EXISTS archivos_adjuntos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    remesa_id INTEGER REFERENCES remesas(id),
    disputa_id INTEGER REFERENCES disputas(id),
    factura_id INTEGER REFERENCES facturas(id),
    -- File details
    tipo TEXT NOT NULL CHECK (tipo IN ('foto_entrega', 'firma', 'comprobante', 'factura_pdf', 'evidencia', 'otro')),
    nombre_archivo TEXT NOT NULL,
    nombre_original TEXT NOT NULL,
    ruta_r2 TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    tamano_bytes INTEGER NOT NULL,
    -- Metadata
    subido_por INTEGER NOT NULL REFERENCES usuarios(id),
    fecha_subida TEXT NOT NULL DEFAULT (datetime('now')),
    -- Soft delete
    eliminado INTEGER NOT NULL DEFAULT 0,
    fecha_eliminacion TEXT
);

CREATE INDEX IF NOT EXISTS archivos_remesa_idx ON archivos_adjuntos(remesa_id);
CREATE INDEX IF NOT EXISTS archivos_disputa_idx ON archivos_adjuntos(disputa_id);
CREATE INDEX IF NOT EXISTS archivos_factura_idx ON archivos_adjuntos(factura_id);
CREATE INDEX IF NOT EXISTS archivos_tipo_idx ON archivos_adjuntos(tipo);

-- ============ System Configuration Updates ============

-- Add business rules to configuracion table
INSERT OR IGNORE INTO configuracion (clave, valor, descripcion) VALUES
    ('COMISION_USD_PORCENTAJE', '5', 'Porcentaje de comisión para entregas en USD'),
    ('DESCUENTO_MN_CUP', '15', 'Descuento en CUP por USD para entregas en MN'),
    ('MONTO_MINIMO', '10', 'Monto mínimo de envío en USD'),
    ('MONTO_MAXIMO', '10000', 'Monto máximo de envío en USD'),
    ('DIAS_VENCIMIENTO_FACTURA', '30', 'Días para vencimiento de facturas'),
    ('URL_BASE', 'https://remesitas-web.pages.dev', 'URL base para enlaces de rastreo'),
    ('HABILITAR_NOTIFICACIONES_SMS', '1', 'Habilitar notificaciones por SMS'),
    ('HABILITAR_NOTIFICACIONES_WHATSAPP', '1', 'Habilitar notificaciones por WhatsApp'),
    ('HABILITAR_NOTIFICACIONES_PUSH', '1', 'Habilitar notificaciones push'),
    ('HABILITAR_GPS_TRACKING', '1', 'Habilitar seguimiento GPS de repartidores');
