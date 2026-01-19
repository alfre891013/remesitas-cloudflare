-- Migration: Additional Seed Data
-- Created: 2026-01-19
-- Note: Initial seed data is in 0001_initial_schema.sql

-- Additional exchange rates
INSERT OR IGNORE INTO tasas_cambio (moneda_origen, moneda_destino, tasa, activa)
VALUES
    ('USD', 'CAD', 320, 1),
    ('USD', 'MXN', 25, 1),
    ('USD', 'BRL', 85, 1),
    ('USD', 'ZELLE', 420, 1);

-- Test repartidor user (password: repartidor123)
INSERT OR IGNORE INTO usuarios (username, password_hash, nombre, rol, activo, debe_cambiar_password, saldo_usd, saldo_cup)
VALUES (
    'repartidor1',
    '240be518fabd2724ddb6f04eeb9d5b054a0b74a0d0b2b1bff9cb6e9e5c6b9e5a',
    'Repartidor Demo',
    'repartidor',
    1,
    0,
    500,
    50000
);

-- Test revendedor user (password: revendedor123)
INSERT OR IGNORE INTO usuarios (username, password_hash, nombre, rol, activo, debe_cambiar_password, comision_revendedor, usa_logistica)
VALUES (
    'revendedor1',
    '240be518fabd2724ddb6f04eeb9d5b054a0b74a0d0b2b1bff9cb6e9e5c6b9e5a',
    'Revendedor Demo',
    'revendedor',
    1,
    0,
    2.0,
    1
);

-- Additional configuration
INSERT OR IGNORE INTO configuracion (clave, valor, descripcion)
VALUES
    ('auto_update_tasas', '1', 'Activar actualización automática de tasas'),
    ('notificaciones_activas', '1', 'Activar notificaciones SMS/WhatsApp'),
    ('url_base', 'https://remesitas.pages.dev', 'URL base para enlaces de seguimiento'),
    ('tasa_margen', '15', 'Margen aplicado a la tasa para entregas CUP'),
    ('comision_usd', '5', 'Porcentaje de comisión para entregas USD');
