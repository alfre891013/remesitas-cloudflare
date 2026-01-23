// Re-export Cuba geography
export * from './cuba-geography';

// User roles
export const ROLES = {
  ADMIN: 'admin',
  REPARTIDOR: 'repartidor',
  REVENDEDOR: 'revendedor',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// Remittance states
export const REMESA_ESTADOS = {
  SOLICITUD: 'solicitud',
  PENDIENTE: 'pendiente',
  EN_PROCESO: 'en_proceso',
  ENTREGADA: 'entregada',
  FACTURADA: 'facturada',
  CANCELADA: 'cancelada',
} as const;

export type RemesaEstado = (typeof REMESA_ESTADOS)[keyof typeof REMESA_ESTADOS];

// Delivery type - determines commission model
export const TIPO_ENTREGA = {
  MN: 'MN', // Moneda Nacional (CUP) - tasa - 15 CUP discount
  USD: 'USD', // USD delivery - 5% commission
} as const;

export type TipoEntrega = (typeof TIPO_ENTREGA)[keyof typeof TIPO_ENTREGA];

// Currency for delivery
export const MONEDA_ENTREGA = {
  CUP: 'CUP',
  USD: 'USD',
} as const;

export type MonedaEntrega = (typeof MONEDA_ENTREGA)[keyof typeof MONEDA_ENTREGA];

// Supported currencies for exchange rates
export const CURRENCIES = {
  USD: 'USD',
  EUR: 'EUR',
  MLC: 'MLC',
} as const;

export type Currency = (typeof CURRENCIES)[keyof typeof CURRENCIES];

// Exchange rate sources
export const RATE_SOURCES = {
  ELTOQUE: 'eltoque',
  CIBERCUBA: 'cibercuba',
  MANUAL: 'manual',
} as const;

export type RateSource = (typeof RATE_SOURCES)[keyof typeof RATE_SOURCES];

// Cash movement types for distributors
export const MOVIMIENTO_EFECTIVO_TIPOS = {
  ASIGNACION: 'asignacion',
  RETIRO: 'retiro',
  ENTREGA: 'entrega',
  RECOGIDA: 'recogida',
  VENTA_USD: 'venta_usd',
} as const;

export type MovimientoEfectivoTipo =
  (typeof MOVIMIENTO_EFECTIVO_TIPOS)[keyof typeof MOVIMIENTO_EFECTIVO_TIPOS];

// Accounting movement types
export const MOVIMIENTO_CONTABLE_TIPOS = {
  INGRESO: 'ingreso',
  EGRESO: 'egreso',
} as const;

export type MovimientoContableTipo =
  (typeof MOVIMIENTO_CONTABLE_TIPOS)[keyof typeof MOVIMIENTO_CONTABLE_TIPOS];

// Notification channels
export const NOTIFICATION_CHANNELS = {
  SMS: 'sms',
  WHATSAPP: 'whatsapp',
  PUSH: 'push',
} as const;

export type NotificationChannel =
  (typeof NOTIFICATION_CHANNELS)[keyof typeof NOTIFICATION_CHANNELS];

// API pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

// JWT token expiry
export const JWT_EXPIRY = {
  ACCESS_TOKEN: '15m',
  REFRESH_TOKEN: '7d',
} as const;

// Country codes for phone detection
export const COUNTRY_CODES = {
  USA: '+1',
  CUBA: '+53',
} as const;

// File upload limits
export const UPLOAD_LIMITS = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
} as const;

// Business logic constants (matching Flask app)
export const BUSINESS_RULES = {
  COMISION_USD_PORCENTAJE: 5, // 5% for USD delivery
  DESCUENTO_MN_CUP: 15, // 15 CUP discount per USD for MN delivery
  DEFAULT_COMISION_REVENDEDOR: 2, // 2% default reseller commission
} as const;

// Rate validation ranges
export const RATE_RANGES = {
  USD: { min: 300, max: 600 },
  EUR: { min: 300, max: 700 },
  MLC: { min: 200, max: 500 },
} as const;

// Fallback ratios when scraping fails
export const FALLBACK_RATIOS = {
  EUR: 1.05, // EUR = USD * 1.05
  MLC: 0.7, // MLC = USD * 0.70
} as const;

// Notification types
export const NOTIFICATION_TYPES = {
  REMESA_CREADA: 'REMESA_CREADA',
  REMESA_APROBADA: 'REMESA_APROBADA',
  REMESA_EN_PROCESO: 'REMESA_EN_PROCESO',
  REMESA_ENTREGADA: 'REMESA_ENTREGADA',
  NUEVA_SOLICITUD_ADMIN: 'NUEVA_SOLICITUD_ADMIN',
  NUEVA_ASIGNACION_REPARTIDOR: 'NUEVA_ASIGNACION_REPARTIDOR',
  PAGO_RECIBIDO: 'PAGO_RECIBIDO',
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

// Dispute states
export const DISPUTA_ESTADOS = {
  ABIERTA: 'abierta',
  EN_INVESTIGACION: 'en_investigacion',
  PENDIENTE_CLIENTE: 'pendiente_cliente',
  RESUELTA: 'resuelta',
  RECHAZADA: 'rechazada',
  ESCALADA: 'escalada',
} as const;

export type DisputaEstado = (typeof DISPUTA_ESTADOS)[keyof typeof DISPUTA_ESTADOS];

// Dispute priorities
export const DISPUTA_PRIORIDADES = {
  BAJA: 'baja',
  NORMAL: 'normal',
  ALTA: 'alta',
  URGENTE: 'urgente',
} as const;

export type DisputaPrioridad = (typeof DISPUTA_PRIORIDADES)[keyof typeof DISPUTA_PRIORIDADES];

// Dispute resolution types
export const DISPUTA_RESOLUCIONES = {
  REEMBOLSO_TOTAL: 'reembolso_total',
  REEMBOLSO_PARCIAL: 'reembolso_parcial',
  REENVIO: 'reenvio',
  COMPENSACION: 'compensacion',
  SIN_ACCION: 'sin_accion',
  OTRO: 'otro',
} as const;

export type DisputaResolucion = (typeof DISPUTA_RESOLUCIONES)[keyof typeof DISPUTA_RESOLUCIONES];

// Invoice states
export const FACTURA_ESTADOS = {
  BORRADOR: 'borrador',
  EMITIDA: 'emitida',
  PAGADA: 'pagada',
  CANCELADA: 'cancelada',
  ANULADA: 'anulada',
} as const;

export type FacturaEstado = (typeof FACTURA_ESTADOS)[keyof typeof FACTURA_ESTADOS];

// Invoice types
export const FACTURA_TIPOS = {
  REMESA: 'remesa',
  COMISION: 'comision',
  PAGO_REVENDEDOR: 'pago_revendedor',
  LIQUIDACION: 'liquidacion',
} as const;

export type FacturaTipo = (typeof FACTURA_TIPOS)[keyof typeof FACTURA_TIPOS];

// File attachment types
export const ARCHIVO_TIPOS = {
  FOTO_ENTREGA: 'foto_entrega',
  FIRMA: 'firma',
  COMPROBANTE: 'comprobante',
  FACTURA_PDF: 'factura_pdf',
  EVIDENCIA: 'evidencia',
  OTRO: 'otro',
} as const;

export type ArchivoTipo = (typeof ARCHIVO_TIPOS)[keyof typeof ARCHIVO_TIPOS];

// Location tracking types
export const UBICACION_TIPOS = {
  TRACKING: 'tracking',
  DELIVERY_START: 'delivery_start',
  DELIVERY_COMPLETE: 'delivery_complete',
  MANUAL: 'manual',
} as const;

export type UbicacionTipo = (typeof UBICACION_TIPOS)[keyof typeof UBICACION_TIPOS];

// System user ID for public operations
export const SYSTEM_USER_ID = 999999;
