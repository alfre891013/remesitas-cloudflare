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
    email: text('email'),
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
    // Notification preferences
    preferencias_notificacion: text('preferencias_notificacion'),
    // Two-factor authentication
    two_factor_enabled: integer('two_factor_enabled', { mode: 'boolean' }).notNull().default(false),
    two_factor_secret: text('two_factor_secret'),
    two_factor_backup_codes: text('two_factor_backup_codes'),
  },
  (table) => ({
    usernameIdx: uniqueIndex('usuarios_username_idx').on(table.username),
    rolIdx: index('usuarios_rol_idx').on(table.rol),
    emailIdx: index('usuarios_email_idx').on(table.email),
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
    beneficiario_provincia_id: integer('beneficiario_provincia_id'),
    beneficiario_municipio_id: integer('beneficiario_municipio_id'),
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
    firma_entrega: text('firma_entrega'),
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

// ============ Cuba Provinces ============
export const provincias = sqliteTable(
  'provincias',
  {
    id: integer('id').primaryKey(),
    nombre: text('nombre').notNull().unique(),
    codigo: text('codigo').notNull().unique(),
    activa: integer('activa', { mode: 'boolean' }).notNull().default(true),
  },
  (table) => ({
    activaIdx: index('provincias_activa_idx').on(table.activa),
  })
);

// ============ Cuba Municipalities ============
export const municipios = sqliteTable(
  'municipios',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    provincia_id: integer('provincia_id')
      .notNull()
      .references(() => provincias.id),
    nombre: text('nombre').notNull(),
    codigo_postal: text('codigo_postal'),
    activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
  },
  (table) => ({
    provinciaIdx: index('municipios_provincia_idx').on(table.provincia_id),
    activoIdx: index('municipios_activo_idx').on(table.activo),
    uniqueNombre: uniqueIndex('municipios_nombre_unique').on(
      table.provincia_id,
      table.nombre
    ),
  })
);

// ============ Frequent Senders ============
export const remitentesFrecuentes = sqliteTable(
  'remitentes_frecuentes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    nombre: text('nombre').notNull(),
    telefono: text('telefono').notNull(),
    email: text('email'),
    usuario_id: integer('usuario_id').references(() => usuarios.id),
    total_remesas: integer('total_remesas').notNull().default(0),
    ultima_remesa: text('ultima_remesa'),
    fecha_creacion: text('fecha_creacion')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    telefonoIdx: index('remitentes_telefono_idx').on(table.telefono),
    usuarioIdx: index('remitentes_usuario_idx').on(table.usuario_id),
    nombreIdx: index('remitentes_nombre_idx').on(table.nombre),
    uniqueTelefono: uniqueIndex('remitentes_telefono_unique').on(
      table.telefono,
      table.usuario_id
    ),
  })
);

// ============ Frequent Beneficiaries ============
export const beneficiariosFrecuentes = sqliteTable(
  'beneficiarios_frecuentes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    nombre: text('nombre').notNull(),
    telefono: text('telefono').notNull(),
    direccion: text('direccion').notNull(),
    provincia_id: integer('provincia_id').references(() => provincias.id),
    municipio_id: integer('municipio_id').references(() => municipios.id),
    usuario_id: integer('usuario_id').references(() => usuarios.id),
    total_remesas: integer('total_remesas').notNull().default(0),
    ultima_remesa: text('ultima_remesa'),
    fecha_creacion: text('fecha_creacion')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    telefonoIdx: index('beneficiarios_telefono_idx').on(table.telefono),
    usuarioIdx: index('beneficiarios_usuario_idx').on(table.usuario_id),
    provinciaIdx: index('beneficiarios_provincia_idx').on(table.provincia_id),
    nombreIdx: index('beneficiarios_nombre_idx').on(table.nombre),
  })
);

// ============ Notification Types ============
export const tiposNotificacion = sqliteTable('tipos_notificacion', {
  id: integer('id').primaryKey(),
  codigo: text('codigo').notNull().unique(),
  nombre: text('nombre').notNull(),
  descripcion: text('descripcion'),
  plantilla_sms: text('plantilla_sms'),
  plantilla_whatsapp: text('plantilla_whatsapp'),
  plantilla_email_asunto: text('plantilla_email_asunto'),
  plantilla_email_cuerpo: text('plantilla_email_cuerpo'),
  plantilla_push_titulo: text('plantilla_push_titulo'),
  plantilla_push_cuerpo: text('plantilla_push_cuerpo'),
  activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
});

// ============ Notifications Log ============
export const notificaciones = sqliteTable(
  'notificaciones',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    usuario_id: integer('usuario_id').references(() => usuarios.id),
    remesa_id: integer('remesa_id').references(() => remesas.id),
    tipo_notificacion_id: integer('tipo_notificacion_id').references(
      () => tiposNotificacion.id
    ),
    canal: text('canal', {
      enum: ['sms', 'whatsapp', 'push', 'email'],
    }).notNull(),
    destinatario: text('destinatario').notNull(),
    mensaje: text('mensaje').notNull(),
    estado: text('estado', {
      enum: ['pendiente', 'enviando', 'enviado', 'fallido', 'entregado'],
    })
      .notNull()
      .default('pendiente'),
    error_mensaje: text('error_mensaje'),
    provider_message_id: text('provider_message_id'),
    fecha_creacion: text('fecha_creacion')
      .notNull()
      .default(sql`(datetime('now'))`),
    fecha_envio: text('fecha_envio'),
    fecha_entrega: text('fecha_entrega'),
    intentos: integer('intentos').notNull().default(0),
    max_intentos: integer('max_intentos').notNull().default(3),
    siguiente_intento: text('siguiente_intento'),
  },
  (table) => ({
    usuarioIdx: index('notificaciones_usuario_idx').on(table.usuario_id),
    remesaIdx: index('notificaciones_remesa_idx').on(table.remesa_id),
    estadoIdx: index('notificaciones_estado_idx').on(table.estado),
    fechaIdx: index('notificaciones_fecha_idx').on(table.fecha_creacion),
    canalIdx: index('notificaciones_canal_idx').on(table.canal),
  })
);

// ============ GPS Device Tracking ============
export const dispositivosRepartidor = sqliteTable(
  'dispositivos_repartidor',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    repartidor_id: integer('repartidor_id')
      .notNull()
      .references(() => usuarios.id),
    device_id: text('device_id').notNull(),
    nombre_dispositivo: text('nombre_dispositivo'),
    platform: text('platform', { enum: ['ios', 'android', 'web'] }),
    push_token: text('push_token'),
    last_latitude: real('last_latitude'),
    last_longitude: real('last_longitude'),
    last_accuracy: real('last_accuracy'),
    last_location_update: text('last_location_update'),
    compartir_ubicacion: integer('compartir_ubicacion', { mode: 'boolean' })
      .notNull()
      .default(false),
    activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
    fecha_registro: text('fecha_registro')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    repartidorIdx: index('dispositivos_repartidor_idx').on(table.repartidor_id),
    activoIdx: index('dispositivos_activo_idx').on(table.activo),
    uniqueDevice: uniqueIndex('dispositivos_device_unique').on(
      table.repartidor_id,
      table.device_id
    ),
  })
);

// ============ Location History ============
export const ubicacionesHistorial = sqliteTable(
  'ubicaciones_historial',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    repartidor_id: integer('repartidor_id')
      .notNull()
      .references(() => usuarios.id),
    dispositivo_id: integer('dispositivo_id').references(
      () => dispositivosRepartidor.id
    ),
    remesa_id: integer('remesa_id').references(() => remesas.id),
    latitude: real('latitude').notNull(),
    longitude: real('longitude').notNull(),
    accuracy: real('accuracy'),
    speed: real('speed'),
    heading: real('heading'),
    altitude: real('altitude'),
    timestamp: text('timestamp')
      .notNull()
      .default(sql`(datetime('now'))`),
    tipo: text('tipo', {
      enum: ['tracking', 'delivery_start', 'delivery_complete', 'manual'],
    }).default('tracking'),
  },
  (table) => ({
    repartidorIdx: index('ubicaciones_repartidor_idx').on(table.repartidor_id),
    remesaIdx: index('ubicaciones_remesa_idx').on(table.remesa_id),
    timestampIdx: index('ubicaciones_timestamp_idx').on(table.timestamp),
    recentIdx: index('ubicaciones_recent_idx').on(
      table.repartidor_id,
      table.timestamp
    ),
  })
);

// ============ Invoice Types ============
export const tiposFactura = sqliteTable('tipos_factura', {
  id: integer('id').primaryKey(),
  codigo: text('codigo').notNull().unique(),
  nombre: text('nombre').notNull(),
  descripcion: text('descripcion'),
  prefijo_numero: text('prefijo_numero').notNull(),
  plantilla_pdf: text('plantilla_pdf'),
});

// ============ Invoices ============
export const facturas = sqliteTable(
  'facturas',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    numero: text('numero').notNull().unique(),
    tipo_factura_id: integer('tipo_factura_id')
      .notNull()
      .references(() => tiposFactura.id),
    remesa_id: integer('remesa_id').references(() => remesas.id),
    usuario_id: integer('usuario_id').references(() => usuarios.id),
    pago_revendedor_id: integer('pago_revendedor_id').references(
      () => pagosRevendedor.id
    ),
    subtotal: real('subtotal').notNull(),
    descuento: real('descuento').notNull().default(0),
    impuesto: real('impuesto').notNull().default(0),
    total: real('total').notNull(),
    moneda: text('moneda').notNull().default('USD'),
    estado: text('estado', {
      enum: ['borrador', 'emitida', 'pagada', 'cancelada', 'anulada'],
    })
      .notNull()
      .default('emitida'),
    notas: text('notas'),
    condiciones: text('condiciones'),
    ruta_pdf: text('ruta_pdf'),
    fecha_emision: text('fecha_emision')
      .notNull()
      .default(sql`(datetime('now'))`),
    fecha_vencimiento: text('fecha_vencimiento'),
    fecha_pago: text('fecha_pago'),
    fecha_anulacion: text('fecha_anulacion'),
    datos_json: text('datos_json'),
    creado_por: integer('creado_por')
      .notNull()
      .references(() => usuarios.id),
  },
  (table) => ({
    numeroIdx: uniqueIndex('facturas_numero_idx').on(table.numero),
    remesaIdx: index('facturas_remesa_idx').on(table.remesa_id),
    usuarioIdx: index('facturas_usuario_idx').on(table.usuario_id),
    estadoIdx: index('facturas_estado_idx').on(table.estado),
    fechaIdx: index('facturas_fecha_idx').on(table.fecha_emision),
    tipoIdx: index('facturas_tipo_idx').on(table.tipo_factura_id),
  })
);

// ============ Invoice Line Items ============
export const lineasFactura = sqliteTable(
  'lineas_factura',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    factura_id: integer('factura_id')
      .notNull()
      .references(() => facturas.id),
    descripcion: text('descripcion').notNull(),
    cantidad: real('cantidad').notNull().default(1),
    precio_unitario: real('precio_unitario').notNull(),
    subtotal: real('subtotal').notNull(),
    orden: integer('orden').notNull().default(0),
  },
  (table) => ({
    facturaIdx: index('lineas_factura_idx').on(table.factura_id),
  })
);

// ============ Dispute Types ============
export const tiposDisputa = sqliteTable('tipos_disputa', {
  id: integer('id').primaryKey(),
  codigo: text('codigo').notNull().unique(),
  nombre: text('nombre').notNull(),
  descripcion: text('descripcion'),
  prioridad_default: text('prioridad_default').notNull().default('normal'),
  sla_horas: integer('sla_horas').notNull().default(48),
});

// ============ Disputes ============
export const disputas = sqliteTable(
  'disputas',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    numero: text('numero').notNull().unique(),
    remesa_id: integer('remesa_id')
      .notNull()
      .references(() => remesas.id),
    tipo_disputa_id: integer('tipo_disputa_id')
      .notNull()
      .references(() => tiposDisputa.id),
    reportado_por: integer('reportado_por')
      .notNull()
      .references(() => usuarios.id),
    asignado_a: integer('asignado_a').references(() => usuarios.id),
    descripcion: text('descripcion').notNull(),
    evidencia_urls: text('evidencia_urls'),
    estado: text('estado', {
      enum: [
        'abierta',
        'en_investigacion',
        'pendiente_cliente',
        'resuelta',
        'rechazada',
        'escalada',
      ],
    })
      .notNull()
      .default('abierta'),
    prioridad: text('prioridad', {
      enum: ['baja', 'normal', 'alta', 'urgente'],
    })
      .notNull()
      .default('normal'),
    resolucion: text('resolucion'),
    tipo_resolucion: text('tipo_resolucion', {
      enum: [
        'reembolso_total',
        'reembolso_parcial',
        'reenvio',
        'compensacion',
        'sin_accion',
        'otro',
      ],
    }),
    monto_reembolso: real('monto_reembolso'),
    resuelto_por: integer('resuelto_por').references(() => usuarios.id),
    fecha_creacion: text('fecha_creacion')
      .notNull()
      .default(sql`(datetime('now'))`),
    fecha_limite: text('fecha_limite'),
    fecha_ultima_actualizacion: text('fecha_ultima_actualizacion'),
    fecha_resolucion: text('fecha_resolucion'),
    datos_json: text('datos_json'),
  },
  (table) => ({
    numeroIdx: uniqueIndex('disputas_numero_idx').on(table.numero),
    remesaIdx: index('disputas_remesa_idx').on(table.remesa_id),
    estadoIdx: index('disputas_estado_idx').on(table.estado),
    prioridadIdx: index('disputas_prioridad_idx').on(table.prioridad),
    asignadoIdx: index('disputas_asignado_idx').on(table.asignado_a),
    fechaIdx: index('disputas_fecha_idx').on(table.fecha_creacion),
  })
);

// ============ Dispute Comments ============
export const comentariosDisputa = sqliteTable(
  'comentarios_disputa',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    disputa_id: integer('disputa_id')
      .notNull()
      .references(() => disputas.id),
    usuario_id: integer('usuario_id')
      .notNull()
      .references(() => usuarios.id),
    tipo: text('tipo', {
      enum: ['comentario', 'cambio_estado', 'asignacion', 'evidencia', 'sistema'],
    })
      .notNull()
      .default('comentario'),
    contenido: text('contenido').notNull(),
    es_interno: integer('es_interno', { mode: 'boolean' }).notNull().default(false),
    archivos_urls: text('archivos_urls'),
    fecha: text('fecha')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    disputaIdx: index('comentarios_disputa_idx').on(table.disputa_id),
    fechaIdx: index('comentarios_fecha_idx').on(table.fecha),
  })
);

// ============ File Attachments ============
export const archivosAdjuntos = sqliteTable(
  'archivos_adjuntos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    remesa_id: integer('remesa_id').references(() => remesas.id),
    disputa_id: integer('disputa_id').references(() => disputas.id),
    factura_id: integer('factura_id').references(() => facturas.id),
    tipo: text('tipo', {
      enum: ['foto_entrega', 'firma', 'comprobante', 'factura_pdf', 'evidencia', 'otro'],
    }).notNull(),
    nombre_archivo: text('nombre_archivo').notNull(),
    nombre_original: text('nombre_original').notNull(),
    ruta_r2: text('ruta_r2').notNull(),
    mime_type: text('mime_type').notNull(),
    tamano_bytes: integer('tamano_bytes').notNull(),
    subido_por: integer('subido_por')
      .notNull()
      .references(() => usuarios.id),
    fecha_subida: text('fecha_subida')
      .notNull()
      .default(sql`(datetime('now'))`),
    eliminado: integer('eliminado', { mode: 'boolean' }).notNull().default(false),
    fecha_eliminacion: text('fecha_eliminacion'),
  },
  (table) => ({
    remesaIdx: index('archivos_remesa_idx').on(table.remesa_id),
    disputaIdx: index('archivos_disputa_idx').on(table.disputa_id),
    facturaIdx: index('archivos_factura_idx').on(table.factura_id),
    tipoIdx: index('archivos_tipo_idx').on(table.tipo),
  })
);

// ============ Contact Form Subjects ============
export const asuntosContacto = sqliteTable(
  'asuntos_contacto',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    codigo: text('codigo').notNull().unique(),
    nombre: text('nombre').notNull(),
    descripcion: text('descripcion'),
    activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
    orden: integer('orden').notNull().default(0),
  },
  (table) => ({
    codigoIdx: uniqueIndex('asuntos_codigo_idx').on(table.codigo),
    activoIdx: index('asuntos_activo_idx').on(table.activo),
  })
);

// ============ Contact Form Messages ============
export const mensajesContacto = sqliteTable(
  'mensajes_contacto',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    numero: text('numero').notNull().unique(),
    nombre: text('nombre').notNull(),
    email: text('email').notNull(),
    telefono: text('telefono'),
    asunto: text('asunto').notNull(),
    mensaje: text('mensaje').notNull(),
    estado: text('estado', {
      enum: ['nuevo', 'leido', 'respondido', 'cerrado', 'spam'],
    })
      .notNull()
      .default('nuevo'),
    ip_origen: text('ip_origen'),
    user_agent: text('user_agent'),
    respondido_por: integer('respondido_por').references(() => usuarios.id),
    respuesta: text('respuesta'),
    fecha_creacion: text('fecha_creacion')
      .notNull()
      .default(sql`(datetime('now'))`),
    fecha_respuesta: text('fecha_respuesta'),
    fecha_lectura: text('fecha_lectura'),
  },
  (table) => ({
    numeroIdx: uniqueIndex('mensajes_numero_idx').on(table.numero),
    estadoIdx: index('mensajes_estado_idx').on(table.estado),
    fechaIdx: index('mensajes_fecha_idx').on(table.fecha_creacion),
    emailIdx: index('mensajes_email_idx').on(table.email),
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

// New type exports
export type Provincia = typeof provincias.$inferSelect;
export type Municipio = typeof municipios.$inferSelect;
export type RemitenteFrecuente = typeof remitentesFrecuentes.$inferSelect;
export type BeneficiarioFrecuente = typeof beneficiariosFrecuentes.$inferSelect;
export type TipoNotificacion = typeof tiposNotificacion.$inferSelect;
export type Notificacion = typeof notificaciones.$inferSelect;
export type DispositivoRepartidor = typeof dispositivosRepartidor.$inferSelect;
export type UbicacionHistorial = typeof ubicacionesHistorial.$inferSelect;
export type TipoFactura = typeof tiposFactura.$inferSelect;
export type Factura = typeof facturas.$inferSelect;
export type FacturaInsert = typeof facturas.$inferInsert;
export type LineaFactura = typeof lineasFactura.$inferSelect;
export type TipoDisputa = typeof tiposDisputa.$inferSelect;
export type Disputa = typeof disputas.$inferSelect;
export type DisputaInsert = typeof disputas.$inferInsert;
export type ComentarioDisputa = typeof comentariosDisputa.$inferSelect;
export type ArchivoAdjunto = typeof archivosAdjuntos.$inferSelect;
export type AsuntoContacto = typeof asuntosContacto.$inferSelect;
export type MensajeContacto = typeof mensajesContacto.$inferSelect;
export type MensajeContactoInsert = typeof mensajesContacto.$inferInsert;
