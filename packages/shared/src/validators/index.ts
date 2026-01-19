import { z } from 'zod';
import {
  ROLES,
  REMESA_ESTADOS,
  TIPO_ENTREGA,
  MONEDA_ENTREGA,
  CURRENCIES,
  MOVIMIENTO_EFECTIVO_TIPOS,
  MOVIMIENTO_CONTABLE_TIPOS,
} from '../constants';

// ============ Auth Validators ============
export const loginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6),
});

export const passwordChangeSchema = z.object({
  current_password: z.string().min(6),
  new_password: z.string().min(6),
});

export const refreshTokenSchema = z.object({
  refresh_token: z.string(),
});

// ============ User Validators ============
export const userCreateSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9_]+$/, 'Solo letras, numeros y guion bajo'),
  password: z.string().min(6),
  nombre: z.string().min(2).max(100),
  rol: z.enum([ROLES.ADMIN, ROLES.REPARTIDOR, ROLES.REVENDEDOR]),
  telefono: z.string().optional().nullable(),
  // Revendedor fields
  comision_revendedor: z.number().min(0).max(100).optional(),
  usa_logistica: z.boolean().optional(),
});

export const userUpdateSchema = z.object({
  nombre: z.string().min(2).max(100).optional(),
  telefono: z.string().optional().nullable(),
  activo: z.boolean().optional(),
  debe_cambiar_password: z.boolean().optional(),
  // Revendedor fields
  comision_revendedor: z.number().min(0).max(100).optional(),
  usa_logistica: z.boolean().optional(),
  // Balance adjustments (admin only)
  saldo_usd: z.number().optional(),
  saldo_cup: z.number().optional(),
  saldo_pendiente: z.number().optional(),
});

// ============ Remesa Validators ============
export const remesaCreateSchema = z.object({
  // Delivery type
  tipo_entrega: z.enum([TIPO_ENTREGA.MN, TIPO_ENTREGA.USD]).default(TIPO_ENTREGA.MN),
  // Remitente (sender)
  remitente_nombre: z.string().min(2).max(100),
  remitente_telefono: z.string().min(8).max(20),
  // Beneficiario (recipient)
  beneficiario_nombre: z.string().min(2).max(100),
  beneficiario_telefono: z.string().min(8).max(20),
  beneficiario_direccion: z.string().min(5).max(300),
  // Amount to send (USD)
  monto_envio: z.number().positive().max(10000),
  // Optional rate override
  tasa_cambio: z.number().positive().optional(),
  // Notes
  notas: z.string().max(500).optional().nullable(),
  // For reseller
  revendedor_id: z.number().optional().nullable(),
  // For public request
  es_solicitud: z.boolean().default(false),
});

export const remesaUpdateSchema = z.object({
  estado: z
    .enum([
      REMESA_ESTADOS.SOLICITUD,
      REMESA_ESTADOS.PENDIENTE,
      REMESA_ESTADOS.EN_PROCESO,
      REMESA_ESTADOS.ENTREGADA,
      REMESA_ESTADOS.FACTURADA,
      REMESA_ESTADOS.CANCELADA,
    ])
    .optional(),
  repartidor_id: z.number().optional().nullable(),
  notas: z.string().max(500).optional().nullable(),
  facturada: z.boolean().optional(),
});

export const remesaDeliverySchema = z.object({
  notas: z.string().max(500).optional().nullable(),
});

export const remesaAsignarSchema = z.object({
  repartidor_id: z.number().positive(),
});

export const remesaTrackSchema = z.object({
  codigo: z.string().min(5).max(20),
});

// ============ Exchange Rate Validators ============
export const tasaCambioUpdateSchema = z.object({
  tasa: z.number().positive(),
});

export const tasasBulkUpdateSchema = z.object({
  usd: z.number().positive().optional(),
  eur: z.number().positive().optional(),
  mlc: z.number().positive().optional(),
});

// ============ Commission Validators ============
export const comisionCreateSchema = z.object({
  nombre: z.string().min(2).max(100),
  rango_minimo: z.number().min(0).default(0),
  rango_maximo: z.number().positive().optional().nullable(),
  porcentaje: z.number().min(0).max(100).default(0),
  monto_fijo: z.number().min(0).default(0),
  activa: z.boolean().default(true),
});

export const comisionUpdateSchema = z.object({
  nombre: z.string().min(2).max(100).optional(),
  rango_minimo: z.number().min(0).optional(),
  rango_maximo: z.number().positive().optional().nullable(),
  porcentaje: z.number().min(0).max(100).optional(),
  monto_fijo: z.number().min(0).optional(),
  activa: z.boolean().optional(),
});

// ============ Cash Movement Validators ============
export const movimientoEfectivoCreateSchema = z.object({
  repartidor_id: z.number().positive(),
  tipo: z.enum([
    MOVIMIENTO_EFECTIVO_TIPOS.ASIGNACION,
    MOVIMIENTO_EFECTIVO_TIPOS.RETIRO,
    MOVIMIENTO_EFECTIVO_TIPOS.ENTREGA,
    MOVIMIENTO_EFECTIVO_TIPOS.RECOGIDA,
    MOVIMIENTO_EFECTIVO_TIPOS.VENTA_USD,
  ]),
  moneda: z.enum([MONEDA_ENTREGA.USD, MONEDA_ENTREGA.CUP]),
  monto: z.number().positive(),
  tasa_cambio: z.number().positive().optional(), // For USD sales
  notas: z.string().max(300).optional().nullable(),
});

// ============ Reseller Payment Validators ============
export const pagoRevendedorCreateSchema = z.object({
  revendedor_id: z.number().positive(),
  monto: z.number().positive(),
  metodo_pago: z.string().min(2).max(50), // 'Zelle', 'efectivo', etc.
  referencia: z.string().max(100).optional().nullable(),
  notas: z.string().max(300).optional().nullable(),
});

// ============ Push Subscription Validators ============
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string(),
  auth: z.string(),
});

// ============ Query Validators ============
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const reportFiltersSchema = z.object({
  fecha_inicio: z.string().optional(),
  fecha_fin: z.string().optional(),
  estado: z
    .enum([
      REMESA_ESTADOS.SOLICITUD,
      REMESA_ESTADOS.PENDIENTE,
      REMESA_ESTADOS.EN_PROCESO,
      REMESA_ESTADOS.ENTREGADA,
      REMESA_ESTADOS.FACTURADA,
      REMESA_ESTADOS.CANCELADA,
    ])
    .optional(),
  repartidor_id: z.coerce.number().optional(),
  revendedor_id: z.coerce.number().optional(),
  facturada: z.coerce.boolean().optional(),
});

// ============ Calculator Validators ============
export const calculatorSchema = z.object({
  monto: z.number().positive(),
  tipo_entrega: z.enum([TIPO_ENTREGA.MN, TIPO_ENTREGA.USD]).default(TIPO_ENTREGA.MN),
});

export const calculatorRevendedorSchema = z.object({
  monto: z.number().positive(),
  tipo_entrega: z.enum([TIPO_ENTREGA.MN, TIPO_ENTREGA.USD]).default(TIPO_ENTREGA.MN),
});

// Type exports from validators
export type LoginInput = z.infer<typeof loginSchema>;
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;
export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type RemesaCreateInput = z.infer<typeof remesaCreateSchema>;
export type RemesaUpdateInput = z.infer<typeof remesaUpdateSchema>;
export type RemesaAsignarInput = z.infer<typeof remesaAsignarSchema>;
export type TasaCambioUpdateInput = z.infer<typeof tasaCambioUpdateSchema>;
export type ComisionCreateInput = z.infer<typeof comisionCreateSchema>;
export type ComisionUpdateInput = z.infer<typeof comisionUpdateSchema>;
export type MovimientoEfectivoInput = z.infer<typeof movimientoEfectivoCreateSchema>;
export type PagoRevendedorInput = z.infer<typeof pagoRevendedorCreateSchema>;
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type ReportFiltersInput = z.infer<typeof reportFiltersSchema>;
export type CalculatorInput = z.infer<typeof calculatorSchema>;
