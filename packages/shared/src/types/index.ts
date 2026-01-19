import type {
  Role,
  RemesaEstado,
  Currency,
  RateSource,
  TipoEntrega,
  MonedaEntrega,
  MovimientoEfectivoTipo,
  MovimientoContableTipo,
} from '../constants';

// ============ User Types ============
export interface Usuario {
  id: number;
  username: string;
  password_hash: string;
  nombre: string;
  telefono: string | null;
  rol: Role;
  activo: boolean;
  debe_cambiar_password: boolean;
  fecha_creacion: string;
  // Revendedor fields
  comision_revendedor: number;
  saldo_pendiente: number;
  usa_logistica: boolean;
  // Repartidor fields
  saldo_usd: number;
  saldo_cup: number;
}

export interface UsuarioPublic {
  id: number;
  username: string;
  nombre: string;
  rol: Role;
  telefono: string | null;
}

// Alias for convenience
export type User = UsuarioPublic;

export interface UsuarioCreate {
  username: string;
  password: string;
  nombre: string;
  rol: Role;
  telefono?: string;
  comision_revendedor?: number;
  usa_logistica?: boolean;
}

export interface UsuarioUpdate {
  nombre?: string;
  telefono?: string;
  activo?: boolean;
  debe_cambiar_password?: boolean;
  comision_revendedor?: number;
  usa_logistica?: boolean;
  saldo_usd?: number;
  saldo_cup?: number;
  saldo_pendiente?: number;
}

// ============ Auth Types ============
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: UsuarioPublic;
  debe_cambiar_password: boolean;
}

export interface TokenPayload {
  sub: number;
  username: string;
  rol: Role;
  iat: number;
  exp: number;
}

export interface PasswordChange {
  current_password: string;
  new_password: string;
}

// ============ Remesa Types ============
export interface Remesa {
  id: number;
  codigo: string;
  // Remitente (sender)
  remitente_nombre: string;
  remitente_telefono: string;
  // Beneficiario (recipient)
  beneficiario_nombre: string;
  beneficiario_telefono: string;
  beneficiario_direccion: string;
  // Delivery type
  tipo_entrega: TipoEntrega;
  // Amounts
  monto_envio: number; // USD received
  tasa_cambio: number; // Exchange rate applied
  monto_entrega: number; // Amount to deliver
  moneda_entrega: MonedaEntrega; // CUP or USD
  // Commission
  comision_porcentaje: number;
  comision_fija: number;
  total_comision: number;
  total_cobrado: number; // monto_envio + total_comision
  comision_plataforma: number; // For reseller remittances
  // State
  estado: RemesaEstado;
  // Assignment
  repartidor_id: number | null;
  creado_por: number;
  revendedor_id: number | null;
  // Dates
  fecha_creacion: string;
  fecha_entrega: string | null;
  fecha_aprobacion: string | null;
  // Billing
  facturada: boolean;
  fecha_facturacion: string | null;
  // Other
  notas: string | null;
  foto_entrega: string | null;
  es_solicitud: boolean;
}

export interface RemesaCreate {
  tipo_entrega?: TipoEntrega;
  remitente_nombre: string;
  remitente_telefono: string;
  beneficiario_nombre: string;
  beneficiario_telefono: string;
  beneficiario_direccion: string;
  monto_envio: number;
  tasa_cambio?: number;
  notas?: string;
  revendedor_id?: number;
  es_solicitud?: boolean;
}

export interface RemesaUpdate {
  estado?: RemesaEstado;
  repartidor_id?: number;
  notas?: string;
  facturada?: boolean;
}

export interface RemesaDelivery {
  notas?: string;
}

export interface RemesaPublicTrack {
  codigo: string;
  estado: RemesaEstado;
  estado_descripcion: string;
  beneficiario_nombre: string;
  monto_entrega: number;
  moneda_entrega: MonedaEntrega;
  fecha_creacion: string;
  fecha_entrega: string | null;
}

// ============ Calculation Types ============
export interface CalculoRemesa {
  monto_envio: number;
  monto_entrega: number;
  moneda_entrega: MonedaEntrega;
  tasa_cambio: number;
  comision_porcentaje: number;
  comision_fija: number;
  total_comision: number;
  total_cobrado: number;
}

export interface CalculoRevendedor extends CalculoRemesa {
  comision_plataforma: number;
}

// ============ Exchange Rate Types ============
export interface TasaCambio {
  id: number;
  moneda_origen: string;
  moneda_destino: string;
  tasa: number;
  activa: boolean;
  fecha_actualizacion: string;
}

export interface TasaCambioUpdate {
  tasa: number;
}

export interface TasasActuales {
  usd: number;
  eur: number;
  mlc: number;
}

export interface TasasExternas {
  usd: number;
  eur: number;
  mlc: number;
}

// ============ Commission Types ============
export interface Comision {
  id: number;
  nombre: string;
  rango_minimo: number;
  rango_maximo: number | null;
  porcentaje: number;
  monto_fijo: number;
  activa: boolean;
}

export interface ComisionCreate {
  nombre: string;
  rango_minimo?: number;
  rango_maximo?: number;
  porcentaje?: number;
  monto_fijo?: number;
  activa?: boolean;
}

// ============ Cash Movement Types ============
export interface MovimientoEfectivo {
  id: number;
  repartidor_id: number;
  tipo: MovimientoEfectivoTipo;
  moneda: MonedaEntrega;
  monto: number;
  saldo_anterior: number;
  saldo_nuevo: number;
  tasa_cambio: number | null;
  remesa_id: number | null;
  notas: string | null;
  fecha: string;
  registrado_por: number;
}

export interface MovimientoEfectivoCreate {
  repartidor_id: number;
  tipo: MovimientoEfectivoTipo;
  moneda: MonedaEntrega;
  monto: number;
  tasa_cambio?: number;
  notas?: string;
}

// ============ Accounting Types ============
export interface MovimientoContable {
  id: number;
  tipo: MovimientoContableTipo;
  concepto: string;
  monto: number;
  remesa_id: number | null;
  usuario_id: number;
  fecha: string;
}

// ============ Reseller Payment Types ============
export interface PagoRevendedor {
  id: number;
  revendedor_id: number;
  monto: number;
  metodo_pago: string;
  referencia: string | null;
  notas: string | null;
  fecha: string;
  registrado_por: number;
}

export interface PagoRevendedorCreate {
  revendedor_id: number;
  monto: number;
  metodo_pago: string;
  referencia?: string;
  notas?: string;
}

// ============ Configuration Types ============
export interface Configuracion {
  id: number;
  clave: string;
  valor: string;
  descripcion: string | null;
}

// ============ Push Subscription Types ============
export interface SuscripcionPush {
  id: number;
  usuario_id: number | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  activa: boolean;
  fecha_creacion: string;
}

export interface PushSubscriptionCreate {
  endpoint: string;
  p256dh: string;
  auth: string;
}

// ============ Session Types ============
export interface Session {
  id: number;
  usuario_id: number;
  refresh_token: string;
  expires_at: string;
  created_at: string;
}

// ============ API Response Types ============
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============ Report Types ============
export interface ReportFilters {
  fecha_inicio?: string;
  fecha_fin?: string;
  estado?: RemesaEstado;
  repartidor_id?: number;
  revendedor_id?: number;
  facturada?: boolean;
}

export interface DashboardStats {
  remesas_pendientes: number;
  remesas_hoy: number;
  total_usd_hoy: number;
  total_cup_hoy: number;
  solicitudes_pendientes: number;
  tasa_actual: number;
}

export interface RepartidorStats {
  entregas_hoy: number;
  entregas_pendientes: number;
  saldo_usd: number;
  saldo_cup: number;
}

export interface RevendedorStats {
  remesas_mes: number;
  total_usd_mes: number;
  comisiones_pendientes: number;
  comisiones_pagadas: number;
  saldo_pendiente: number;
  comision_porcentaje: number;
}

// ============ Notification Types ============
export interface NotificationResult {
  success: boolean;
  sid?: string;
  error?: string;
  fallback_link?: string;
}

export interface NotificationLinks {
  link_remitente: string;
  link_beneficiario: string;
  link_repartidor?: string;
}
