-- Migration: Production Hardening
-- Created: 2026-01-19
-- Adds missing indexes, constraints via triggers, and system user

-- ============ Additional Indexes for Performance ============

-- Index for active users (frequently filtered)
CREATE INDEX IF NOT EXISTS usuarios_activo_idx ON usuarios(activo);

-- Compound index for repartidor queries (estado + repartidor_id)
CREATE INDEX IF NOT EXISTS remesas_repartidor_estado_idx ON remesas(repartidor_id, estado);

-- Compound index for revendedor queries (estado + revendedor_id)
CREATE INDEX IF NOT EXISTS remesas_revendedor_estado_idx ON remesas(revendedor_id, estado);

-- Index for accounting movements by user
CREATE INDEX IF NOT EXISTS contables_usuario_idx ON movimientos_contables(usuario_id);

-- Index for sessions expiry cleanup
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires_at);

-- Index for facturada remittances
CREATE INDEX IF NOT EXISTS remesas_facturada_idx ON remesas(facturada);

-- ============ System User for Public Operations ============

-- Create system user for public solicitations (ID will be consistent)
INSERT OR IGNORE INTO usuarios (
    id, username, password_hash, nombre, rol, activo, debe_cambiar_password
) VALUES (
    999999,
    '_system',
    'SYSTEM_USER_NO_LOGIN_ALLOWED',
    'Sistema',
    'admin',
    0,  -- Inactive - cannot login
    0
);

-- ============ Triggers for Business Rule Enforcement ============

-- Trigger: Prevent negative USD balance on update
CREATE TRIGGER IF NOT EXISTS check_saldo_usd_update
BEFORE UPDATE OF saldo_usd ON usuarios
FOR EACH ROW
WHEN NEW.saldo_usd < 0
BEGIN
    SELECT RAISE(ABORT, 'Saldo USD no puede ser negativo');
END;

-- Trigger: Prevent negative CUP balance on update
CREATE TRIGGER IF NOT EXISTS check_saldo_cup_update
BEFORE UPDATE OF saldo_cup ON usuarios
FOR EACH ROW
WHEN NEW.saldo_cup < 0
BEGIN
    SELECT RAISE(ABORT, 'Saldo CUP no puede ser negativo');
END;

-- Trigger: Prevent negative pending balance on update
CREATE TRIGGER IF NOT EXISTS check_saldo_pendiente_update
BEFORE UPDATE OF saldo_pendiente ON usuarios
FOR EACH ROW
WHEN NEW.saldo_pendiente < 0
BEGIN
    SELECT RAISE(ABORT, 'Saldo pendiente no puede ser negativo');
END;

-- Trigger: Validate remesa state transitions
-- Only allow valid transitions: solicitud->pendiente, pendiente->en_proceso, etc.
CREATE TRIGGER IF NOT EXISTS check_remesa_state_transition
BEFORE UPDATE OF estado ON remesas
FOR EACH ROW
BEGIN
    SELECT CASE
        -- From solicitud: can go to pendiente or cancelada
        WHEN OLD.estado = 'solicitud' AND NEW.estado NOT IN ('pendiente', 'cancelada')
        THEN RAISE(ABORT, 'Transición de estado inválida desde solicitud')
        -- From pendiente: can go to en_proceso or cancelada
        WHEN OLD.estado = 'pendiente' AND NEW.estado NOT IN ('en_proceso', 'cancelada')
        THEN RAISE(ABORT, 'Transición de estado inválida desde pendiente')
        -- From en_proceso: can go to entregada, pendiente (unassign), or cancelada
        WHEN OLD.estado = 'en_proceso' AND NEW.estado NOT IN ('entregada', 'pendiente', 'cancelada')
        THEN RAISE(ABORT, 'Transición de estado inválida desde en_proceso')
        -- From entregada: can only go to facturada
        WHEN OLD.estado = 'entregada' AND NEW.estado NOT IN ('facturada')
        THEN RAISE(ABORT, 'Transición de estado inválida desde entregada')
        -- From facturada or cancelada: no transitions allowed (final states)
        WHEN OLD.estado IN ('facturada', 'cancelada') AND OLD.estado != NEW.estado
        THEN RAISE(ABORT, 'No se puede cambiar estado desde estado final')
    END;
END;

-- Trigger: Validate monetary amounts are positive on insert
CREATE TRIGGER IF NOT EXISTS check_remesa_amounts_insert
BEFORE INSERT ON remesas
FOR EACH ROW
WHEN NEW.monto_envio <= 0 OR NEW.monto_entrega < 0 OR NEW.total_cobrado <= 0
BEGIN
    SELECT RAISE(ABORT, 'Los montos deben ser positivos');
END;

-- Trigger: Validate cash movement amounts are positive
CREATE TRIGGER IF NOT EXISTS check_movimiento_efectivo_amount
BEFORE INSERT ON movimientos_efectivo
FOR EACH ROW
WHEN NEW.monto <= 0
BEGIN
    SELECT RAISE(ABORT, 'El monto del movimiento debe ser positivo');
END;

-- Trigger: Validate payment amounts are positive
CREATE TRIGGER IF NOT EXISTS check_pago_revendedor_amount
BEFORE INSERT ON pagos_revendedor
FOR EACH ROW
WHEN NEW.monto <= 0
BEGIN
    SELECT RAISE(ABORT, 'El monto del pago debe ser positivo');
END;

-- Trigger: Auto-cleanup expired sessions (on any session insert)
CREATE TRIGGER IF NOT EXISTS cleanup_expired_sessions
AFTER INSERT ON sessions
BEGIN
    DELETE FROM sessions WHERE expires_at < datetime('now');
END;

-- ============ Exchange Rate History Table ============
-- For audit trail of rate changes

CREATE TABLE IF NOT EXISTS tasas_cambio_historial (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tasa_id INTEGER NOT NULL,
    moneda_origen TEXT NOT NULL,
    moneda_destino TEXT NOT NULL,
    tasa_anterior REAL NOT NULL,
    tasa_nueva REAL NOT NULL,
    fecha_cambio TEXT NOT NULL DEFAULT (datetime('now')),
    cambiado_por INTEGER REFERENCES usuarios(id)
);

CREATE INDEX IF NOT EXISTS tasas_historial_tasa_idx ON tasas_cambio_historial(tasa_id);
CREATE INDEX IF NOT EXISTS tasas_historial_fecha_idx ON tasas_cambio_historial(fecha_cambio);

-- Trigger: Log exchange rate changes
CREATE TRIGGER IF NOT EXISTS log_tasa_cambio_update
AFTER UPDATE OF tasa ON tasas_cambio
FOR EACH ROW
WHEN OLD.tasa != NEW.tasa
BEGIN
    INSERT INTO tasas_cambio_historial (tasa_id, moneda_origen, moneda_destino, tasa_anterior, tasa_nueva)
    VALUES (OLD.id, OLD.moneda_origen, OLD.moneda_destino, OLD.tasa, NEW.tasa);
END;

-- ============ Audit Log Table ============
-- For tracking important operations

CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tabla TEXT NOT NULL,
    operacion TEXT NOT NULL CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE')),
    registro_id INTEGER NOT NULL,
    usuario_id INTEGER,
    datos_anteriores TEXT,  -- JSON
    datos_nuevos TEXT,      -- JSON
    ip_address TEXT,
    fecha TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS audit_log_tabla_idx ON audit_log(tabla);
CREATE INDEX IF NOT EXISTS audit_log_fecha_idx ON audit_log(fecha);
CREATE INDEX IF NOT EXISTS audit_log_usuario_idx ON audit_log(usuario_id);
