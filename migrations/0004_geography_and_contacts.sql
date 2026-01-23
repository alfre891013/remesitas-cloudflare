-- Migration: Geography and Contacts
-- Created: 2026-01-20
-- Adds Cuba provinces/municipalities and frequent contacts tables

-- ============ Cuba Provinces (15 + 1 Special Municipality) ============

CREATE TABLE IF NOT EXISTS provincias (
    id INTEGER PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    codigo TEXT NOT NULL UNIQUE,
    activa INTEGER NOT NULL DEFAULT 1
);

-- Seed 16 provinces (using fixed IDs for referential integrity)
INSERT OR IGNORE INTO provincias (id, nombre, codigo) VALUES
    (1, 'Pinar del Río', 'PR'),
    (2, 'Artemisa', 'AR'),
    (3, 'La Habana', 'LH'),
    (4, 'Mayabeque', 'MY'),
    (5, 'Matanzas', 'MT'),
    (6, 'Cienfuegos', 'CF'),
    (7, 'Villa Clara', 'VC'),
    (8, 'Sancti Spíritus', 'SS'),
    (9, 'Ciego de Ávila', 'CA'),
    (10, 'Camagüey', 'CM'),
    (11, 'Las Tunas', 'LT'),
    (12, 'Holguín', 'HO'),
    (13, 'Granma', 'GR'),
    (14, 'Santiago de Cuba', 'SC'),
    (15, 'Guantánamo', 'GT'),
    (16, 'Isla de la Juventud', 'IJ');

-- Index for active provinces
CREATE INDEX IF NOT EXISTS provincias_activa_idx ON provincias(activa);

-- ============ Cuba Municipalities (168 total) ============

CREATE TABLE IF NOT EXISTS municipios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provincia_id INTEGER NOT NULL REFERENCES provincias(id),
    nombre TEXT NOT NULL,
    codigo_postal TEXT,
    activo INTEGER NOT NULL DEFAULT 1,
    UNIQUE(provincia_id, nombre)
);

CREATE INDEX IF NOT EXISTS municipios_provincia_idx ON municipios(provincia_id);
CREATE INDEX IF NOT EXISTS municipios_activo_idx ON municipios(activo);

-- Seed municipalities for each province
-- Pinar del Río (11 municipalities)
INSERT OR IGNORE INTO municipios (provincia_id, nombre) VALUES
    (1, 'Pinar del Río'), (1, 'Sandino'), (1, 'Mantua'), (1, 'Minas de Matahambre'),
    (1, 'Viñales'), (1, 'La Palma'), (1, 'Bahía Honda'), (1, 'Candelaria'),
    (1, 'San Cristóbal'), (1, 'Los Palacios'), (1, 'Consolación del Sur');

-- Artemisa (11 municipalities)
INSERT OR IGNORE INTO municipios (provincia_id, nombre) VALUES
    (2, 'Artemisa'), (2, 'Bahía Honda'), (2, 'Candelaria'), (2, 'Mariel'),
    (2, 'Guanajay'), (2, 'Caimito'), (2, 'Bauta'), (2, 'San Antonio de los Baños'),
    (2, 'Güira de Melena'), (2, 'Alquízar'), (2, 'San Cristóbal');

-- La Habana (15 municipalities)
INSERT OR IGNORE INTO municipios (provincia_id, nombre) VALUES
    (3, 'Playa'), (3, 'Plaza de la Revolución'), (3, 'Centro Habana'), (3, 'La Habana Vieja'),
    (3, 'Regla'), (3, 'La Habana del Este'), (3, 'Guanabacoa'), (3, 'San Miguel del Padrón'),
    (3, 'Diez de Octubre'), (3, 'Cerro'), (3, 'Marianao'), (3, 'La Lisa'),
    (3, 'Boyeros'), (3, 'Arroyo Naranjo'), (3, 'Cotorro');

-- Mayabeque (11 municipalities)
INSERT OR IGNORE INTO municipios (provincia_id, nombre) VALUES
    (4, 'San José de las Lajas'), (4, 'Bejucal'), (4, 'Quivicán'), (4, 'Melena del Sur'),
    (4, 'Batabanó'), (4, 'Güines'), (4, 'San Nicolás'), (4, 'Madruga'),
    (4, 'Nueva Paz'), (4, 'Santa Cruz del Norte'), (4, 'Jaruco');

-- Matanzas (13 municipalities)
INSERT OR IGNORE INTO municipios (provincia_id, nombre) VALUES
    (5, 'Matanzas'), (5, 'Cárdenas'), (5, 'Varadero'), (5, 'Martí'),
    (5, 'Colón'), (5, 'Perico'), (5, 'Jovellanos'), (5, 'Pedro Betancourt'),
    (5, 'Limonar'), (5, 'Unión de Reyes'), (5, 'Ciénaga de Zapata'),
    (5, 'Jagüey Grande'), (5, 'Calimete');

-- Cienfuegos (8 municipalities)
INSERT OR IGNORE INTO municipios (provincia_id, nombre) VALUES
    (6, 'Cienfuegos'), (6, 'Palmira'), (6, 'Rodas'), (6, 'Lajas'),
    (6, 'Cruces'), (6, 'Cumanayagua'), (6, 'Abreus'), (6, 'Aguada de Pasajeros');

-- Villa Clara (13 municipalities)
INSERT OR IGNORE INTO municipios (provincia_id, nombre) VALUES
    (7, 'Santa Clara'), (7, 'Caibarién'), (7, 'Camajuaní'), (7, 'Cifuentes'),
    (7, 'Corralillo'), (7, 'Encrucijada'), (7, 'Manicaragua'), (7, 'Placetas'),
    (7, 'Quemado de Güines'), (7, 'Ranchuelo'), (7, 'Remedios'),
    (7, 'Sagua la Grande'), (7, 'Santo Domingo');

-- Sancti Spíritus (8 municipalities)
INSERT OR IGNORE INTO municipios (provincia_id, nombre) VALUES
    (8, 'Sancti Spíritus'), (8, 'Trinidad'), (8, 'Cabaiguán'), (8, 'Fomento'),
    (8, 'Jatibonico'), (8, 'La Sierpe'), (8, 'Taguasco'), (8, 'Yaguajay');

-- Ciego de Ávila (10 municipalities)
INSERT OR IGNORE INTO municipios (provincia_id, nombre) VALUES
    (9, 'Ciego de Ávila'), (9, 'Morón'), (9, 'Bolivia'), (9, 'Chambas'),
    (9, 'Ciro Redondo'), (9, 'Florencia'), (9, 'Majagua'), (9, 'Primero de Enero'),
    (9, 'Baraguá'), (9, 'Venezuela');

-- Camagüey (13 municipalities)
INSERT OR IGNORE INTO municipios (provincia_id, nombre) VALUES
    (10, 'Camagüey'), (10, 'Carlos Manuel de Céspedes'), (10, 'Esmeralda'), (10, 'Florida'),
    (10, 'Guáimaro'), (10, 'Jimaguayú'), (10, 'Minas'), (10, 'Najasa'),
    (10, 'Nuevitas'), (10, 'Santa Cruz del Sur'), (10, 'Sibanicú'),
    (10, 'Sierra de Cubitas'), (10, 'Vertientes');

-- Las Tunas (8 municipalities)
INSERT OR IGNORE INTO municipios (provincia_id, nombre) VALUES
    (11, 'Las Tunas'), (11, 'Puerto Padre'), (11, 'Jesús Menéndez'), (11, 'Manatí'),
    (11, 'Majibacoa'), (11, 'Jobabo'), (11, 'Colombia'), (11, 'Amancio');

-- Holguín (14 municipalities)
INSERT OR IGNORE INTO municipios (provincia_id, nombre) VALUES
    (12, 'Holguín'), (12, 'Gibara'), (12, 'Rafael Freyre'), (12, 'Banes'),
    (12, 'Antilla'), (12, 'Báguanos'), (12, 'Calixto García'), (12, 'Cacocum'),
    (12, 'Urbano Noris'), (12, 'Cueto'), (12, 'Mayarí'), (12, 'Frank País'),
    (12, 'Sagua de Tánamo'), (12, 'Moa');

-- Granma (13 municipalities)
INSERT OR IGNORE INTO municipios (provincia_id, nombre) VALUES
    (13, 'Bayamo'), (13, 'Manzanillo'), (13, 'Campechuela'), (13, 'Media Luna'),
    (13, 'Niquero'), (13, 'Pilón'), (13, 'Bartolomé Masó'), (13, 'Buey Arriba'),
    (13, 'Guisa'), (13, 'Jiguaní'), (13, 'Cauto Cristo'), (13, 'Río Cauto'),
    (13, 'Yara');

-- Santiago de Cuba (9 municipalities)
INSERT OR IGNORE INTO municipios (provincia_id, nombre) VALUES
    (14, 'Santiago de Cuba'), (14, 'Palma Soriano'), (14, 'Contramaestre'), (14, 'Mella'),
    (14, 'San Luis'), (14, 'Segundo Frente'), (14, 'Songo-La Maya'), (14, 'Tercer Frente'),
    (14, 'Guamá');

-- Guantánamo (10 municipalities)
INSERT OR IGNORE INTO municipios (provincia_id, nombre) VALUES
    (15, 'Guantánamo'), (15, 'Baracoa'), (15, 'El Salvador'), (15, 'Imías'),
    (15, 'Maisí'), (15, 'Manuel Tames'), (15, 'Niceto Pérez'), (15, 'San Antonio del Sur'),
    (15, 'Caimanera'), (15, 'Yateras');

-- Isla de la Juventud (1 special municipality)
INSERT OR IGNORE INTO municipios (provincia_id, nombre) VALUES
    (16, 'Nueva Gerona');

-- ============ Frequent Senders (Remitentes) ============

CREATE TABLE IF NOT EXISTS remitentes_frecuentes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    telefono TEXT NOT NULL,
    email TEXT,
    usuario_id INTEGER REFERENCES usuarios(id),
    total_remesas INTEGER NOT NULL DEFAULT 0,
    ultima_remesa TEXT,
    fecha_creacion TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(telefono, usuario_id)
);

CREATE INDEX IF NOT EXISTS remitentes_telefono_idx ON remitentes_frecuentes(telefono);
CREATE INDEX IF NOT EXISTS remitentes_usuario_idx ON remitentes_frecuentes(usuario_id);
CREATE INDEX IF NOT EXISTS remitentes_nombre_idx ON remitentes_frecuentes(nombre);

-- ============ Frequent Beneficiaries ============

CREATE TABLE IF NOT EXISTS beneficiarios_frecuentes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    telefono TEXT NOT NULL,
    direccion TEXT NOT NULL,
    provincia_id INTEGER REFERENCES provincias(id),
    municipio_id INTEGER REFERENCES municipios(id),
    usuario_id INTEGER REFERENCES usuarios(id),
    total_remesas INTEGER NOT NULL DEFAULT 0,
    ultima_remesa TEXT,
    fecha_creacion TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(telefono, direccion, usuario_id)
);

CREATE INDEX IF NOT EXISTS beneficiarios_telefono_idx ON beneficiarios_frecuentes(telefono);
CREATE INDEX IF NOT EXISTS beneficiarios_usuario_idx ON beneficiarios_frecuentes(usuario_id);
CREATE INDEX IF NOT EXISTS beneficiarios_provincia_idx ON beneficiarios_frecuentes(provincia_id);
CREATE INDEX IF NOT EXISTS beneficiarios_nombre_idx ON beneficiarios_frecuentes(nombre);

-- ============ Add Geography to Remesas ============

-- Add province and municipality columns to remesas
ALTER TABLE remesas ADD COLUMN beneficiario_provincia_id INTEGER REFERENCES provincias(id);
ALTER TABLE remesas ADD COLUMN beneficiario_municipio_id INTEGER REFERENCES municipios(id);

-- Index for geographic queries
CREATE INDEX IF NOT EXISTS remesas_provincia_idx ON remesas(beneficiario_provincia_id);
CREATE INDEX IF NOT EXISTS remesas_municipio_idx ON remesas(beneficiario_municipio_id);
