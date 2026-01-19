-- Migration: Initial Schema for Remesitas (matching Flask models exactly)
-- Created: 2026-01-19

-- ============ Users Table ============
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    nombre TEXT NOT NULL,
    telefono TEXT,
    rol TEXT NOT NULL DEFAULT 'repartidor' CHECK (rol IN ('admin', 'repartidor', 'revendedor')),
    activo INTEGER NOT NULL DEFAULT 1,
    debe_cambiar_password INTEGER NOT NULL DEFAULT 1,
    fecha_creacion TEXT NOT NULL DEFAULT (datetime('now')),
    -- Revendedor fields
    comision_revendedor REAL NOT NULL DEFAULT 2.0,
    saldo_pendiente REAL NOT NULL DEFAULT 0,
    usa_logistica INTEGER NOT NULL DEFAULT 1,
    -- Repartidor fields
    saldo_usd REAL NOT NULL DEFAULT 0,
    saldo_cup REAL NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS usuarios_username_idx ON usuarios(username);
CREATE INDEX IF NOT EXISTS usuarios_rol_idx ON usuarios(rol);

-- ============ Remesas (Remittances) Table ============
CREATE TABLE IF NOT EXISTS remesas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT NOT NULL UNIQUE,
    -- Remitente
    remitente_nombre TEXT NOT NULL,
    remitente_telefono TEXT NOT NULL,
    -- Beneficiario
    beneficiario_nombre TEXT NOT NULL,
    beneficiario_telefono TEXT NOT NULL,
    beneficiario_direccion TEXT NOT NULL,
    -- Delivery type
    tipo_entrega TEXT NOT NULL DEFAULT 'MN' CHECK (tipo_entrega IN ('MN', 'USD')),
    -- Amounts
    monto_envio REAL NOT NULL,
    tasa_cambio REAL NOT NULL,
    monto_entrega REAL NOT NULL,
    moneda_entrega TEXT NOT NULL DEFAULT 'CUP' CHECK (moneda_entrega IN ('CUP', 'USD')),
    -- Commission
    comision_porcentaje REAL NOT NULL DEFAULT 0,
    comision_fija REAL NOT NULL DEFAULT 0,
    total_comision REAL NOT NULL DEFAULT 0,
    total_cobrado REAL NOT NULL,
    comision_plataforma REAL NOT NULL DEFAULT 0,
    -- State
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('solicitud', 'pendiente', 'en_proceso', 'entregada', 'facturada', 'cancelada')),
    -- Assignment
    repartidor_id INTEGER REFERENCES usuarios(id),
    creado_por INTEGER NOT NULL REFERENCES usuarios(id),
    revendedor_id INTEGER REFERENCES usuarios(id),
    -- Dates
    fecha_creacion TEXT NOT NULL DEFAULT (datetime('now')),
    fecha_entrega TEXT,
    fecha_aprobacion TEXT,
    -- Billing
    facturada INTEGER NOT NULL DEFAULT 0,
    fecha_facturacion TEXT,
    -- Other
    notas TEXT,
    foto_entrega TEXT,
    es_solicitud INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS remesas_codigo_idx ON remesas(codigo);
CREATE INDEX IF NOT EXISTS remesas_estado_idx ON remesas(estado);
CREATE INDEX IF NOT EXISTS remesas_repartidor_idx ON remesas(repartidor_id);
CREATE INDEX IF NOT EXISTS remesas_revendedor_idx ON remesas(revendedor_id);
CREATE INDEX IF NOT EXISTS remesas_fecha_idx ON remesas(fecha_creacion);
CREATE INDEX IF NOT EXISTS remesas_remitente_idx ON remesas(remitente_telefono);

-- ============ Exchange Rates Table ============
CREATE TABLE IF NOT EXISTS tasas_cambio (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    moneda_origen TEXT NOT NULL DEFAULT 'USD',
    moneda_destino TEXT NOT NULL,
    tasa REAL NOT NULL,
    activa INTEGER NOT NULL DEFAULT 1,
    fecha_actualizacion TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS tasas_activa_idx ON tasas_cambio(activa);
CREATE INDEX IF NOT EXISTS tasas_moneda_idx ON tasas_cambio(moneda_origen, moneda_destino);

-- ============ Commissions Table ============
CREATE TABLE IF NOT EXISTS comisiones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    rango_minimo REAL NOT NULL DEFAULT 0,
    rango_maximo REAL,
    porcentaje REAL NOT NULL DEFAULT 0,
    monto_fijo REAL NOT NULL DEFAULT 0,
    activa INTEGER NOT NULL DEFAULT 1
);

-- ============ Reseller Payments ============
CREATE TABLE IF NOT EXISTS pagos_revendedor (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    revendedor_id INTEGER NOT NULL REFERENCES usuarios(id),
    monto REAL NOT NULL,
    metodo_pago TEXT NOT NULL,
    referencia TEXT,
    notas TEXT,
    fecha TEXT NOT NULL DEFAULT (datetime('now')),
    registrado_por INTEGER NOT NULL REFERENCES usuarios(id)
);

CREATE INDEX IF NOT EXISTS pagos_revendedor_idx ON pagos_revendedor(revendedor_id);

-- ============ Accounting Movements ============
CREATE TABLE IF NOT EXISTS movimientos_contables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
    concepto TEXT NOT NULL,
    monto REAL NOT NULL,
    remesa_id INTEGER REFERENCES remesas(id),
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    fecha TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS contables_tipo_idx ON movimientos_contables(tipo);
CREATE INDEX IF NOT EXISTS contables_fecha_idx ON movimientos_contables(fecha);

-- ============ Cash Movements (for Repartidores) ============
CREATE TABLE IF NOT EXISTS movimientos_efectivo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repartidor_id INTEGER NOT NULL REFERENCES usuarios(id),
    tipo TEXT NOT NULL CHECK (tipo IN ('asignacion', 'retiro', 'entrega', 'recogida', 'venta_usd')),
    moneda TEXT NOT NULL CHECK (moneda IN ('USD', 'CUP')),
    monto REAL NOT NULL,
    saldo_anterior REAL NOT NULL,
    saldo_nuevo REAL NOT NULL,
    tasa_cambio REAL,
    remesa_id INTEGER REFERENCES remesas(id),
    notas TEXT,
    fecha TEXT NOT NULL DEFAULT (datetime('now')),
    registrado_por INTEGER NOT NULL REFERENCES usuarios(id)
);

CREATE INDEX IF NOT EXISTS movimientos_repartidor_idx ON movimientos_efectivo(repartidor_id);
CREATE INDEX IF NOT EXISTS movimientos_fecha_idx ON movimientos_efectivo(fecha);

-- ============ Configuration ============
CREATE TABLE IF NOT EXISTS configuracion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clave TEXT NOT NULL UNIQUE,
    valor TEXT NOT NULL,
    descripcion TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS configuracion_clave_idx ON configuracion(clave);

-- ============ Push Subscriptions ============
CREATE TABLE IF NOT EXISTS suscripciones_push (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER REFERENCES usuarios(id),
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    activa INTEGER NOT NULL DEFAULT 1,
    fecha_creacion TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS push_usuario_idx ON suscripciones_push(usuario_id);
CREATE UNIQUE INDEX IF NOT EXISTS push_endpoint_idx ON suscripciones_push(endpoint);

-- ============ Sessions ============
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    refresh_token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_idx ON sessions(refresh_token);
CREATE INDEX IF NOT EXISTS sessions_usuario_idx ON sessions(usuario_id);

-- ============ Seed Data ============

-- Admin user (password: admin123) - debe_cambiar_password=0 for admin
INSERT OR IGNORE INTO usuarios (username, password_hash, nombre, rol, activo, debe_cambiar_password)
VALUES (
    'admin',
    '240be518fabd2724ddb6f04eeb9d5b054a0b74a0d0b2b1bff9cb6e9e5c6b9e5a', -- SHA-256 of admin123
    'Administrador',
    'admin',
    1,
    0
);

-- Default commission (3% + $2)
INSERT OR IGNORE INTO comisiones (nombre, rango_minimo, rango_maximo, porcentaje, monto_fijo, activa)
VALUES ('Comision Estandar', 0, NULL, 3.0, 2.0, 1);

-- Default exchange rate (435 CUP/USD)
INSERT OR IGNORE INTO tasas_cambio (moneda_origen, moneda_destino, tasa, activa)
VALUES ('USD', 'CUP', 435, 1);

-- Default EUR rate
INSERT OR IGNORE INTO tasas_cambio (moneda_origen, moneda_destino, tasa, activa)
VALUES ('EUR', 'CUP', 470, 1);

-- Default MLC rate
INSERT OR IGNORE INTO tasas_cambio (moneda_origen, moneda_destino, tasa, activa)
VALUES ('MLC', 'CUP', 300, 1);

-- Default configuration
INSERT OR IGNORE INTO configuracion (clave, valor, descripcion)
VALUES
    ('moneda_local', 'CUP', 'Moneda local'),
    ('nombre_negocio', 'Remesitas', 'Nombre del negocio');
