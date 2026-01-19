import { sql } from 'drizzle-orm';
import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

// ============ Users Table ============
export const usuarios = sqliteTable(
  'usuarios',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    username: text('username').notNull().unique(),
    password_hash: text('password_hash').notNull(),
    nombre: text('nombre').notNull(),
    telefono: text('telefono'),
    rol: text('rol', { enum: ['admin', 'repartidor', 'revendedor'] })
      .notNull()
      .default('repartidor'),
    activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
    debe_cambiar_password: integer('debe_cambiar_password', { mode: 'boolean' })
      .notNull()
      .default(true),
    fecha_creacion: text('fecha_creacion')
      .notNull()
      .default(sql`(datetime('now'))`),
    // Revendedor fields
    comision_revendedor: real('comision_revendedor').notNull().default(2.0),
    saldo_pendiente: real('saldo_pendiente').notNull().default(0),
    usa_logistica: integer('usa_logistica', { mode: 'boolean' })
      .notNull()
      .default(true),
    // Repartidor fields - cash balances
    saldo_usd: real('saldo_usd').notNull().default(0),
    saldo_cup: real('saldo_cup').notNull().default(0),
  },
  (table) => ({
    usernameIdx: uniqueIndex('usuarios_username_idx').on(table.username),
    rolIdx: index('usuarios_rol_idx').on(table.rol),
  })
);

// ============ Remesas (Remittances) Table ============
export const remesas = sqliteTable(
  'remesas',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    codigo: text('codigo').notNull().unique(),
    // Remitente (sender)
    remitente_nombre: text('remitente_nombre').notNull(),
    remitente_telefono: text('remitente_telefono').notNull(),
    // Beneficiario (recipient)
    beneficiario_nombre: text('beneficiario_nombre').notNull(),
    beneficiario_telefono: text('beneficiario_telefono').notNull(),
    beneficiario_direccion: text('beneficiario_direccion').notNull(),
    // Delivery type
    tipo_entrega: text('tipo_entrega', { enum: ['MN', 'USD'] })
      .notNull()
      .default('MN'),
    // Amounts
    monto_envio: real('monto_envio').notNull(), // USD received
    tasa_cambio: real('tasa_cambio').notNull(), // Exchange rate applied
    monto_entrega: real('monto_entrega').notNull(), // Amount to deliver
    moneda_entrega: text('moneda_entrega', { enum: ['CUP', 'USD'] })
      .notNull()
      .default('CUP'),
    // Commission
    comision_porcentaje: real('comision_porcentaje').notNull().default(0),
    comision_fija: real('comision_fija').notNull().default(0),
    total_comision: real('total_comision').notNull().default(0),
    total_cobrado: real('total_cobrado').notNull(), // monto_envio + total_comision
    comision_plataforma: real('comision_plataforma').notNull().default(0), // For reseller remittances
    // State
    estado: text('estado', {
      enum: ['solicitud', 'pendiente', 'en_proceso', 'entregada', 'facturada', 'cancelada'],
    })
      .notNull()
      .default('pendiente'),
    // Assignment
    repartidor_id: integer('repartidor_id').references(() => usuarios.id),
    creado_por: integer('creado_por')
      .notNull()
      .references(() => usuarios.id),
    revendedor_id: integer('revendedor_id').references(() => usuarios.id),
    // Dates
    fecha_creacion: text('fecha_creacion')
      .notNull()
      .default(sql`(datetime('now'))`),
    fecha_entrega: text('fecha_entrega'),
    fecha_aprobacion: text('fecha_aprobacion'),
    // Billing
    facturada: integer('facturada', { mode: 'boolean' }).notNull().default(false),
    fecha_facturacion: text('fecha_facturacion'),
    // Other
    notas: text('notas'),
    foto_entrega: text('foto_entrega'),
    es_solicitud: integer('es_solicitud', { mode: 'boolean' })
      .notNull()
      .default(false),
  },
  (table) => ({
    codigoIdx: uniqueIndex('remesas_codigo_idx').on(table.codigo),
    estadoIdx: index('remesas_estado_idx').on(table.estado),
    repartidorIdx: index('remesas_repartidor_idx').on(table.repartidor_id),
    revendedorIdx: index('remesas_revendedor_idx').on(table.revendedor_id),
    fechaIdx: index('remesas_fecha_idx').on(table.fecha_creacion),
    remitenteIdx: index('remesas_remitente_idx').on(table.remitente_telefono),
  })
);

// ============ Exchange Rates Table ============
export const tasasCambio = sqliteTable(
  'tasas_cambio',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    moneda_origen: text('moneda_origen').notNull().default('USD'),
    moneda_destino: text('moneda_destino').notNull(),
    tasa: real('tasa').notNull(),
    activa: integer('activa', { mode: 'boolean' }).notNull().default(true),
    fecha_actualizacion: text('fecha_actualizacion')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    activaIdx: index('tasas_activa_idx').on(table.activa),
    monedaIdx: index('tasas_moneda_idx').on(table.moneda_origen, table.moneda_destino),
  })
);

// ============ Commissions Table ============
export const comisiones = sqliteTable('comisiones', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nombre: text('nombre').notNull(),
  rango_minimo: real('rango_minimo').notNull().default(0),
  rango_maximo: real('rango_maximo'),
  porcentaje: real('porcentaje').notNull().default(0),
  monto_fijo: real('monto_fijo').notNull().default(0),
  activa: integer('activa', { mode: 'boolean' }).notNull().default(true),
});

// ============ Reseller Payments ============
export const pagosRevendedor = sqliteTable(
  'pagos_revendedor',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    revendedor_id: integer('revendedor_id')
      .notNull()
      .references(() => usuarios.id),
    monto: real('monto').notNull(),
    metodo_pago: text('metodo_pago').notNull(), // 'Zelle', 'efectivo', etc.
    referencia: text('referencia'), // Confirmation number
    notas: text('notas'),
    fecha: text('fecha')
      .notNull()
      .default(sql`(datetime('now'))`),
    registrado_por: integer('registrado_por')
      .notNull()
      .references(() => usuarios.id),
  },
  (table) => ({
    revendedorIdx: index('pagos_revendedor_idx').on(table.revendedor_id),
  })
);

// ============ Accounting Movements ============
export const movimientosContables = sqliteTable(
  'movimientos_contables',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tipo: text('tipo', { enum: ['ingreso', 'egreso'] }).notNull(),
    concepto: text('concepto').notNull(),
    monto: real('monto').notNull(),
    remesa_id: integer('remesa_id').references(() => remesas.id),
    usuario_id: integer('usuario_id')
      .notNull()
      .references(() => usuarios.id),
    fecha: text('fecha')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    tipoIdx: index('contables_tipo_idx').on(table.tipo),
    fechaIdx: index('contables_fecha_idx').on(table.fecha),
  })
);

// ============ Cash Movements (for Repartidores) ============
export const movimientosEfectivo = sqliteTable(
  'movimientos_efectivo',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    repartidor_id: integer('repartidor_id')
      .notNull()
      .references(() => usuarios.id),
    tipo: text('tipo', {
      enum: ['asignacion', 'retiro', 'entrega', 'recogida', 'venta_usd'],
    }).notNull(),
    moneda: text('moneda', { enum: ['USD', 'CUP'] }).notNull(),
    monto: real('monto').notNull(),
    saldo_anterior: real('saldo_anterior').notNull(),
    saldo_nuevo: real('saldo_nuevo').notNull(),
    tasa_cambio: real('tasa_cambio'), // For USD sales
    remesa_id: integer('remesa_id').references(() => remesas.id),
    notas: text('notas'),
    fecha: text('fecha')
      .notNull()
      .default(sql`(datetime('now'))`),
    registrado_por: integer('registrado_por')
      .notNull()
      .references(() => usuarios.id),
  },
  (table) => ({
    repartidorIdx: index('movimientos_repartidor_idx').on(table.repartidor_id),
    fechaIdx: index('movimientos_fecha_idx').on(table.fecha),
  })
);

// ============ Configuration Key-Value ============
export const configuracion = sqliteTable(
  'configuracion',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    clave: text('clave').notNull().unique(),
    valor: text('valor').notNull(),
    descripcion: text('descripcion'),
  },
  (table) => ({
    claveIdx: uniqueIndex('configuracion_clave_idx').on(table.clave),
  })
);

// ============ Push Subscriptions ============
export const suscripcionesPush = sqliteTable(
  'suscripciones_push',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    usuario_id: integer('usuario_id').references(() => usuarios.id),
    endpoint: text('endpoint').notNull().unique(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    activa: integer('activa', { mode: 'boolean' }).notNull().default(true),
    fecha_creacion: text('fecha_creacion')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    usuarioIdx: index('push_usuario_idx').on(table.usuario_id),
    endpointIdx: uniqueIndex('push_endpoint_idx').on(table.endpoint),
  })
);

// ============ Sessions (for JWT refresh tokens) ============
export const sessions = sqliteTable(
  'sessions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    usuario_id: integer('usuario_id')
      .notNull()
      .references(() => usuarios.id),
    refresh_token: text('refresh_token').notNull().unique(),
    expires_at: text('expires_at').notNull(),
    created_at: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    tokenIdx: uniqueIndex('sessions_token_idx').on(table.refresh_token),
    usuarioIdx: index('sessions_usuario_idx').on(table.usuario_id),
  })
);

// Type exports
export type Usuario = typeof usuarios.$inferSelect;
export type UsuarioInsert = typeof usuarios.$inferInsert;
export type Remesa = typeof remesas.$inferSelect;
export type RemesaInsert = typeof remesas.$inferInsert;
export type TasaCambio = typeof tasasCambio.$inferSelect;
export type TasaCambioInsert = typeof tasasCambio.$inferInsert;
export type Comision = typeof comisiones.$inferSelect;
export type ComisionInsert = typeof comisiones.$inferInsert;
export type PagoRevendedor = typeof pagosRevendedor.$inferSelect;
export type MovimientoContable = typeof movimientosContables.$inferSelect;
export type MovimientoEfectivo = typeof movimientosEfectivo.$inferSelect;
export type Configuracion = typeof configuracion.$inferSelect;
export type SuscripcionPush = typeof suscripcionesPush.$inferSelect;
export type Session = typeof sessions.$inferSelect;
