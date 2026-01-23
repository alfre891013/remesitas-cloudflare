/**
 * Enhanced Notification Service v2
 *
 * Unified multi-channel notification system with:
 * - Template-based messages with variable substitution
 * - Retry logic with exponential backoff
 * - Delivery status tracking and logging
 * - User preference handling
 * - Support for SMS, WhatsApp, Push, and Email
 */

import { eq, and, lte, inArray, desc, sql } from 'drizzle-orm';
import {
  notificaciones,
  tiposNotificacion,
  usuarios,
  suscripcionesPush,
  remesas,
  type TipoNotificacion,
  type Notificacion,
  type Remesa,
  type Usuario,
} from '../db/schema';
import type { Database, Env } from '../types';
import { sendPushNotification } from './webpush.service';

// ============ Types ============

export type NotificationChannel = 'sms' | 'whatsapp' | 'push' | 'email';

export interface NotificationData {
  // Core identifiers
  codigo?: string;
  remesa_id?: number;
  usuario_id?: number;

  // Remittance data
  monto_envio?: number;
  monto_entrega?: number;
  moneda_entrega?: string;
  comision?: number;
  tasa_cambio?: number;

  // People data
  remitente_nombre?: string;
  remitente_telefono?: string;
  beneficiario_nombre?: string;
  beneficiario_telefono?: string;
  beneficiario_direccion?: string;
  repartidor_nombre?: string;

  // Dates
  fecha_entrega?: string;
  fecha_creacion?: string;

  // URLs
  url_rastreo?: string;
  url_factura?: string;

  // Payment data
  monto?: number;
  saldo_pendiente?: number;

  // Custom fields
  [key: string]: string | number | undefined;
}

export interface SendOptions {
  channels?: NotificationChannel[];
  skipPreferences?: boolean;
  priority?: 'low' | 'normal' | 'high';
  maxRetries?: number;
  scheduleFor?: Date;
}

export interface SendResult {
  success: boolean;
  notificationId?: number;
  channel?: NotificationChannel;
  providerId?: string;
  error?: string;
}

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  smsFrom: string;
  whatsappFrom: string;
}

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  email: string;
}

export interface EmailConfig {
  provider: 'resend' | 'sendgrid' | 'mailgun';
  apiKey: string;
  fromEmail: string;
  fromName: string;
}

// ============ Notification Codes ============

export const NotificationCode = {
  REMESA_CREADA: 'REMESA_CREADA',
  REMESA_APROBADA: 'REMESA_APROBADA',
  REMESA_EN_PROCESO: 'REMESA_EN_PROCESO',
  REMESA_ENTREGADA: 'REMESA_ENTREGADA',
  NUEVA_SOLICITUD_ADMIN: 'NUEVA_SOLICITUD_ADMIN',
  NUEVA_ASIGNACION_REPARTIDOR: 'NUEVA_ASIGNACION_REPARTIDOR',
  PAGO_RECIBIDO: 'PAGO_RECIBIDO',
} as const;

export type NotificationCodeType = (typeof NotificationCode)[keyof typeof NotificationCode];

// ============ Utility Functions ============

/**
 * Detect country from phone number prefix
 */
export function detectCountry(phone: string): 'usa' | 'cuba' | 'unknown' {
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.startsWith('1') || cleaned.startsWith('001')) {
    return 'usa';
  }
  if (cleaned.startsWith('53') || cleaned.startsWith('5353')) {
    return 'cuba';
  }
  return 'unknown';
}

/**
 * Clean and format phone number for international use
 */
export function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');

  // Add country code if missing (assume USA for 10-digit numbers)
  if (cleaned.length === 10 && !cleaned.startsWith('1') && !cleaned.startsWith('53')) {
    cleaned = '1' + cleaned;
  }

  return '+' + cleaned;
}

/**
 * Generate WhatsApp link for manual sending
 */
export function generateWhatsAppLink(phone: string, message: string): string {
  const cleaned = phone.replace(/\D/g, '');
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${cleaned}?text=${encoded}`;
}

/**
 * Replace template variables with actual values
 */
export function interpolateTemplate(template: string, data: NotificationData): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = data[key];
    if (value !== undefined && value !== null) {
      return String(value);
    }
    return match; // Keep original if no replacement found
  });
}

/**
 * Calculate next retry time using exponential backoff
 */
export function calculateNextRetry(attempts: number): Date {
  // Base delay of 30 seconds, doubles each attempt, max 1 hour
  const baseDelay = 30 * 1000;
  const maxDelay = 60 * 60 * 1000;
  const delay = Math.min(baseDelay * Math.pow(2, attempts), maxDelay);

  // Add some jitter (up to 10% of delay)
  const jitter = Math.random() * delay * 0.1;

  return new Date(Date.now() + delay + jitter);
}

// ============ Main Service Class ============

export class NotificationServiceV2 {
  private db: Database;
  private twilioConfig: TwilioConfig | null = null;
  private vapidConfig: VapidConfig | null = null;
  private emailConfig: EmailConfig | null = null;
  private baseUrl: string = 'https://remesitas-web.pages.dev';
  private typesCache: Map<string, TipoNotificacion> = new Map();

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Configure Twilio for SMS/WhatsApp
   */
  configureTwilio(config: TwilioConfig): this {
    this.twilioConfig = config;
    return this;
  }

  /**
   * Configure VAPID for Web Push
   */
  configureVapid(config: VapidConfig): this {
    this.vapidConfig = config;
    return this;
  }

  /**
   * Configure email provider
   */
  configureEmail(config: EmailConfig): this {
    this.emailConfig = config;
    return this;
  }

  /**
   * Set base URL for tracking links
   */
  setBaseUrl(url: string): this {
    this.baseUrl = url;
    return this;
  }

  // ============ Core Send Methods ============

  /**
   * Send notification by type code
   */
  async send(
    typeCode: NotificationCodeType,
    recipient: string,
    data: NotificationData,
    options: SendOptions = {}
  ): Promise<SendResult[]> {
    // Load notification type
    const type = await this.getNotificationType(typeCode);
    if (!type) {
      return [{ success: false, error: `Unknown notification type: ${typeCode}` }];
    }

    // Determine channels
    let channels = options.channels;
    if (!channels || channels.length === 0) {
      channels = this.determineChannels(recipient, data);
    }

    // Check user preferences
    if (!options.skipPreferences && data.usuario_id) {
      channels = await this.filterByPreferences(data.usuario_id, channels);
    }

    // Send to each channel
    const results: SendResult[] = [];
    for (const channel of channels) {
      const result = await this.sendToChannel(channel, type, recipient, data, options);
      results.push(result);
    }

    return results;
  }

  /**
   * Send notification for a remesa event
   */
  async sendRemesaNotification(
    typeCode: NotificationCodeType,
    remesa: Remesa,
    recipientType: 'remitente' | 'beneficiario' | 'repartidor' | 'admin',
    additionalData: NotificationData = {}
  ): Promise<SendResult[]> {
    // Build notification data from remesa
    const data: NotificationData = {
      remesa_id: remesa.id,
      codigo: remesa.codigo,
      monto_envio: remesa.monto_envio,
      monto_entrega: remesa.monto_entrega,
      moneda_entrega: remesa.moneda_entrega,
      remitente_nombre: remesa.remitente_nombre,
      remitente_telefono: remesa.remitente_telefono,
      beneficiario_nombre: remesa.beneficiario_nombre,
      beneficiario_telefono: remesa.beneficiario_telefono,
      beneficiario_direccion: remesa.beneficiario_direccion,
      url_rastreo: `${this.baseUrl}/rastrear?codigo=${remesa.codigo}`,
      ...additionalData,
    };

    // Determine recipient
    let recipient: string;
    switch (recipientType) {
      case 'remitente':
        recipient = remesa.remitente_telefono;
        break;
      case 'beneficiario':
        recipient = remesa.beneficiario_telefono;
        break;
      case 'repartidor':
        if (!remesa.repartidor_id) {
          return [{ success: false, error: 'No repartidor assigned' }];
        }
        // Get repartidor phone
        const repartidor = await this.db
          .select()
          .from(usuarios)
          .where(eq(usuarios.id, remesa.repartidor_id))
          .limit(1);
        if (!repartidor[0]?.telefono) {
          return [{ success: false, error: 'Repartidor has no phone' }];
        }
        recipient = repartidor[0].telefono;
        data.usuario_id = remesa.repartidor_id;
        data.repartidor_nombre = repartidor[0].nombre;
        break;
      case 'admin':
        // For admin notifications, we'll send to all admin push subscriptions
        return this.sendToAdmins(typeCode, data);
      default:
        return [{ success: false, error: 'Invalid recipient type' }];
    }

    return this.send(typeCode, recipient, data);
  }

  /**
   * Send notification to all admins
   */
  async sendToAdmins(
    typeCode: NotificationCodeType,
    data: NotificationData
  ): Promise<SendResult[]> {
    const type = await this.getNotificationType(typeCode);
    if (!type) {
      return [{ success: false, error: `Unknown notification type: ${typeCode}` }];
    }

    // Get all admin users
    const admins = await this.db
      .select({ id: usuarios.id, telefono: usuarios.telefono, email: usuarios.email })
      .from(usuarios)
      .where(and(eq(usuarios.rol, 'admin'), eq(usuarios.activo, true)));

    const results: SendResult[] = [];

    for (const admin of admins) {
      // Send push notification
      if (this.vapidConfig) {
        const pushResult = await this.sendPush(
          admin.id,
          type.plantilla_push_titulo ? interpolateTemplate(type.plantilla_push_titulo, data) : type.nombre,
          type.plantilla_push_cuerpo ? interpolateTemplate(type.plantilla_push_cuerpo, data) : '',
          data
        );
        results.push(...pushResult);
      }

      // Optionally send email
      if (this.emailConfig && admin.email) {
        const emailResult = await this.sendEmail(
          admin.email,
          type.plantilla_email_asunto ? interpolateTemplate(type.plantilla_email_asunto, data) : type.nombre,
          type.plantilla_email_cuerpo ? interpolateTemplate(type.plantilla_email_cuerpo, data) : '',
          data
        );
        results.push(emailResult);
      }
    }

    return results;
  }

  // ============ Channel-Specific Send Methods ============

  /**
   * Send to a specific channel
   */
  private async sendToChannel(
    channel: NotificationChannel,
    type: TipoNotificacion,
    recipient: string,
    data: NotificationData,
    options: SendOptions
  ): Promise<SendResult> {
    // Create notification record
    const [notification] = await this.db
      .insert(notificaciones)
      .values({
        usuario_id: data.usuario_id || null,
        remesa_id: data.remesa_id || null,
        tipo_notificacion_id: type.id,
        canal: channel,
        destinatario: recipient,
        mensaje: this.getMessageForChannel(channel, type, data),
        estado: 'pendiente',
        max_intentos: options.maxRetries || 3,
      })
      .returning();

    // Send notification
    let result: SendResult;
    switch (channel) {
      case 'sms':
        result = await this.sendSMS(recipient, notification.mensaje);
        break;
      case 'whatsapp':
        result = await this.sendWhatsApp(recipient, notification.mensaje);
        break;
      case 'push':
        const pushResults = await this.sendPush(
          data.usuario_id!,
          type.plantilla_push_titulo ? interpolateTemplate(type.plantilla_push_titulo, data) : type.nombre,
          type.plantilla_push_cuerpo ? interpolateTemplate(type.plantilla_push_cuerpo, data) : notification.mensaje,
          data
        );
        result = pushResults[0] || { success: false, error: 'No push subscriptions' };
        break;
      case 'email':
        result = await this.sendEmail(
          recipient,
          type.plantilla_email_asunto ? interpolateTemplate(type.plantilla_email_asunto, data) : type.nombre,
          notification.mensaje,
          data
        );
        break;
      default:
        result = { success: false, error: 'Unknown channel' };
    }

    // Update notification record
    await this.db
      .update(notificaciones)
      .set({
        estado: result.success ? 'enviado' : 'fallido',
        error_mensaje: result.error || null,
        provider_message_id: result.providerId || null,
        fecha_envio: result.success ? new Date().toISOString() : null,
        intentos: 1,
        siguiente_intento: !result.success
          ? calculateNextRetry(1).toISOString()
          : null,
      })
      .where(eq(notificaciones.id, notification.id));

    return {
      ...result,
      notificationId: notification.id,
      channel,
    };
  }

  /**
   * Send SMS via Twilio
   */
  private async sendSMS(to: string, message: string): Promise<SendResult> {
    if (!this.twilioConfig?.accountSid || !this.twilioConfig?.authToken) {
      return { success: false, error: 'Twilio not configured' };
    }

    try {
      const formattedTo = formatPhoneNumber(to);
      const auth = btoa(`${this.twilioConfig.accountSid}:${this.twilioConfig.authToken}`);

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.twilioConfig.accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            From: this.twilioConfig.smsFrom,
            To: formattedTo,
            Body: message,
          }),
        }
      );

      const data = (await response.json()) as { sid?: string; message?: string };

      if (!response.ok) {
        return { success: false, error: data.message || 'SMS failed' };
      }

      return { success: true, providerId: data.sid, channel: 'sms' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SMS error',
        channel: 'sms',
      };
    }
  }

  /**
   * Send WhatsApp via Twilio
   */
  private async sendWhatsApp(to: string, message: string): Promise<SendResult> {
    if (!this.twilioConfig?.accountSid || !this.twilioConfig?.authToken) {
      return {
        success: false,
        error: 'Twilio not configured',
      };
    }

    try {
      const cleaned = to.replace(/\D/g, '');
      const whatsappTo = `whatsapp:+${cleaned}`;
      const whatsappFrom = `whatsapp:${this.twilioConfig.whatsappFrom}`;
      const auth = btoa(`${this.twilioConfig.accountSid}:${this.twilioConfig.authToken}`);

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.twilioConfig.accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            From: whatsappFrom,
            To: whatsappTo,
            Body: message,
          }),
        }
      );

      const data = (await response.json()) as { sid?: string; message?: string };

      if (!response.ok) {
        return { success: false, error: data.message || 'WhatsApp failed' };
      }

      return { success: true, providerId: data.sid, channel: 'whatsapp' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'WhatsApp error',
        channel: 'whatsapp',
      };
    }
  }

  /**
   * Send Push notification
   */
  private async sendPush(
    userId: number,
    title: string,
    body: string,
    data: NotificationData
  ): Promise<SendResult[]> {
    if (!this.vapidConfig) {
      return [{ success: false, error: 'VAPID not configured', channel: 'push' }];
    }

    // Get user's push subscriptions
    const subscriptions = await this.db
      .select()
      .from(suscripcionesPush)
      .where(and(eq(suscripcionesPush.usuario_id, userId), eq(suscripcionesPush.activa, true)));

    if (subscriptions.length === 0) {
      return [{ success: false, error: 'No push subscriptions', channel: 'push' }];
    }

    const results: SendResult[] = [];

    for (const sub of subscriptions) {
      try {
        const result = await sendPushNotification(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          {
            title,
            body,
            icon: '/icon-192.png',
            badge: '/icon-72.png',
            data: {
              url: data.url_rastreo || '/',
              remesa_id: data.remesa_id,
              codigo: data.codigo,
            },
          },
          this.vapidConfig
        );

        if (result.success) {
          results.push({ success: true, channel: 'push' });
        } else {
          // Remove invalid subscription
          if (result.statusCode === 404 || result.statusCode === 410) {
            await this.db
              .delete(suscripcionesPush)
              .where(eq(suscripcionesPush.id, sub.id));
          }
          results.push({ success: false, error: result.error, channel: 'push' });
        }
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Push error',
          channel: 'push',
        });
      }
    }

    return results;
  }

  /**
   * Send Email via configured provider
   */
  private async sendEmail(
    to: string,
    subject: string,
    body: string,
    data: NotificationData
  ): Promise<SendResult> {
    if (!this.emailConfig) {
      return { success: false, error: 'Email not configured', channel: 'email' };
    }

    try {
      let response: Response;
      let providerId: string | undefined;

      // Generate HTML email
      const htmlBody = this.generateEmailHtml(subject, body, data);

      switch (this.emailConfig.provider) {
        case 'resend':
          response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.emailConfig.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: `${this.emailConfig.fromName} <${this.emailConfig.fromEmail}>`,
              to: [to],
              subject,
              html: htmlBody,
              text: body,
            }),
          });
          if (response.ok) {
            const result = (await response.json()) as { id: string };
            providerId = result.id;
          }
          break;

        case 'sendgrid':
          response = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.emailConfig.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              personalizations: [{ to: [{ email: to }] }],
              from: { email: this.emailConfig.fromEmail, name: this.emailConfig.fromName },
              subject,
              content: [
                { type: 'text/plain', value: body },
                { type: 'text/html', value: htmlBody },
              ],
            }),
          });
          break;

        case 'mailgun':
          const formData = new FormData();
          formData.append('from', `${this.emailConfig.fromName} <${this.emailConfig.fromEmail}>`);
          formData.append('to', to);
          formData.append('subject', subject);
          formData.append('text', body);
          formData.append('html', htmlBody);

          response = await fetch(
            `https://api.mailgun.net/v3/${this.emailConfig.fromEmail.split('@')[1]}/messages`,
            {
              method: 'POST',
              headers: {
                Authorization: `Basic ${btoa(`api:${this.emailConfig.apiKey}`)}`,
              },
              body: formData,
            }
          );
          if (response.ok) {
            const result = (await response.json()) as { id: string };
            providerId = result.id;
          }
          break;

        default:
          return { success: false, error: 'Unknown email provider', channel: 'email' };
      }

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: errorText, channel: 'email' };
      }

      return { success: true, providerId, channel: 'email' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Email error',
        channel: 'email',
      };
    }
  }

  // ============ Helper Methods ============

  /**
   * Get notification type from cache or database
   */
  private async getNotificationType(code: string): Promise<TipoNotificacion | null> {
    // Check cache
    if (this.typesCache.has(code)) {
      return this.typesCache.get(code)!;
    }

    // Load from database
    const [type] = await this.db
      .select()
      .from(tiposNotificacion)
      .where(eq(tiposNotificacion.codigo, code))
      .limit(1);

    if (type) {
      this.typesCache.set(code, type);
    }

    return type || null;
  }

  /**
   * Determine best channels based on recipient
   */
  private determineChannels(recipient: string, data: NotificationData): NotificationChannel[] {
    const country = detectCountry(recipient);
    const channels: NotificationChannel[] = [];

    // USA: SMS preferred
    if (country === 'usa') {
      channels.push('sms');
    }
    // Cuba: WhatsApp preferred
    else if (country === 'cuba') {
      channels.push('whatsapp');
    }
    // Unknown: WhatsApp first, fallback to SMS
    else {
      channels.push('whatsapp');
    }

    // Add push if user is logged in
    if (data.usuario_id) {
      channels.push('push');
    }

    return channels;
  }

  /**
   * Filter channels based on user preferences
   */
  private async filterByPreferences(
    userId: number,
    channels: NotificationChannel[]
  ): Promise<NotificationChannel[]> {
    const [user] = await this.db
      .select({ preferencias_notificacion: usuarios.preferencias_notificacion })
      .from(usuarios)
      .where(eq(usuarios.id, userId))
      .limit(1);

    if (!user?.preferencias_notificacion) {
      return channels;
    }

    try {
      const prefs = JSON.parse(user.preferencias_notificacion) as Record<string, boolean>;
      return channels.filter((channel) => prefs[channel] !== false);
    } catch {
      return channels;
    }
  }

  /**
   * Get message for specific channel
   */
  private getMessageForChannel(
    channel: NotificationChannel,
    type: TipoNotificacion,
    data: NotificationData
  ): string {
    let template: string | null = null;

    switch (channel) {
      case 'sms':
        template = type.plantilla_sms;
        break;
      case 'whatsapp':
        template = type.plantilla_whatsapp;
        break;
      case 'push':
        template = type.plantilla_push_cuerpo;
        break;
      case 'email':
        template = type.plantilla_email_cuerpo;
        break;
    }

    if (!template) {
      template = type.plantilla_sms || type.plantilla_whatsapp || type.nombre;
    }

    return interpolateTemplate(template, data);
  }

  /**
   * Generate HTML email
   */
  private generateEmailHtml(subject: string, body: string, data: NotificationData): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1a1a2e; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #ffffff; padding: 32px 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .header p { margin: 8px 0 0; opacity: 0.9; font-size: 14px; }
    .content { padding: 32px 24px; }
    .message { font-size: 16px; margin-bottom: 24px; white-space: pre-line; }
    .info-card { background-color: #f8f9fa; border-radius: 12px; padding: 20px; margin: 24px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e9ecef; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #6b7280; font-size: 14px; }
    .info-value { font-weight: 600; color: #1a1a2e; }
    .btn { display: inline-block; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin: 16px 0; }
    .footer { background-color: #f8f9fa; padding: 24px; text-align: center; font-size: 12px; color: #6b7280; }
    .footer a { color: #1a1a2e; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Remesitas</h1>
      <p>Envios de dinero a Cuba</p>
    </div>
    <div class="content">
      <div class="message">${body.replace(/\n/g, '<br>')}</div>
      ${data.codigo ? `
      <div class="info-card">
        <div class="info-row">
          <span class="info-label">Codigo de Remesa</span>
          <span class="info-value">${data.codigo}</span>
        </div>
        ${data.monto_envio ? `
        <div class="info-row">
          <span class="info-label">Monto Enviado</span>
          <span class="info-value">$${data.monto_envio} USD</span>
        </div>
        ` : ''}
        ${data.monto_entrega ? `
        <div class="info-row">
          <span class="info-label">Monto a Entregar</span>
          <span class="info-value">${data.monto_entrega} ${data.moneda_entrega || 'CUP'}</span>
        </div>
        ` : ''}
        ${data.beneficiario_nombre ? `
        <div class="info-row">
          <span class="info-label">Beneficiario</span>
          <span class="info-value">${data.beneficiario_nombre}</span>
        </div>
        ` : ''}
      </div>
      ` : ''}
      ${data.url_rastreo ? `
      <p style="text-align: center;">
        <a href="${data.url_rastreo}" class="btn">Rastrear Remesa</a>
      </p>
      ` : ''}
    </div>
    <div class="footer">
      <p>Este es un mensaje automatico de Remesitas.</p>
      <p>Si tiene alguna pregunta, contactenos en <a href="mailto:soporte@remesitas.com">soporte@remesitas.com</a></p>
      <p>&copy; ${new Date().getFullYear()} Remesitas. Todos los derechos reservados.</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  // ============ Retry and Queue Methods ============

  /**
   * Process pending/failed notifications for retry
   */
  async processRetryQueue(): Promise<{ processed: number; succeeded: number; failed: number }> {
    const now = new Date().toISOString();

    // Get notifications ready for retry
    const pendingNotifications = await this.db
      .select()
      .from(notificaciones)
      .where(
        and(
          inArray(notificaciones.estado, ['pendiente', 'fallido']),
          lte(notificaciones.siguiente_intento, now),
          sql`${notificaciones.intentos} < ${notificaciones.max_intentos}`
        )
      )
      .limit(50);

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (const notification of pendingNotifications) {
      processed++;

      // Mark as sending
      await this.db
        .update(notificaciones)
        .set({ estado: 'enviando' })
        .where(eq(notificaciones.id, notification.id));

      let result: SendResult;

      switch (notification.canal) {
        case 'sms':
          result = await this.sendSMS(notification.destinatario, notification.mensaje);
          break;
        case 'whatsapp':
          result = await this.sendWhatsApp(notification.destinatario, notification.mensaje);
          break;
        case 'email':
          result = await this.sendEmail(notification.destinatario, 'Remesitas', notification.mensaje, {});
          break;
        case 'push':
          // Push requires user context, skip in retry queue
          result = { success: false, error: 'Push requires user context' };
          break;
        default:
          result = { success: false, error: 'Unknown channel' };
      }

      // Update notification
      const newAttempts = notification.intentos + 1;
      const reachedMaxAttempts = newAttempts >= notification.max_intentos;

      await this.db
        .update(notificaciones)
        .set({
          estado: result.success ? 'enviado' : reachedMaxAttempts ? 'fallido' : 'pendiente',
          error_mensaje: result.error || null,
          provider_message_id: result.providerId || notification.provider_message_id,
          fecha_envio: result.success ? now : notification.fecha_envio,
          intentos: newAttempts,
          siguiente_intento: !result.success && !reachedMaxAttempts
            ? calculateNextRetry(newAttempts).toISOString()
            : null,
        })
        .where(eq(notificaciones.id, notification.id));

      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }
    }

    return { processed, succeeded, failed };
  }

  /**
   * Get notification statistics
   */
  async getStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byChannel: Record<string, number>;
    recentFailures: number;
  }> {
    // Total count
    const [{ count: total }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(notificaciones);

    // By status
    const statusCounts = await this.db
      .select({
        estado: notificaciones.estado,
        count: sql<number>`count(*)`,
      })
      .from(notificaciones)
      .groupBy(notificaciones.estado);

    const byStatus: Record<string, number> = {};
    for (const row of statusCounts) {
      byStatus[row.estado] = row.count;
    }

    // By channel
    const channelCounts = await this.db
      .select({
        canal: notificaciones.canal,
        count: sql<number>`count(*)`,
      })
      .from(notificaciones)
      .groupBy(notificaciones.canal);

    const byChannel: Record<string, number> = {};
    for (const row of channelCounts) {
      byChannel[row.canal] = row.count;
    }

    // Recent failures (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [{ count: recentFailures }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(notificaciones)
      .where(
        and(
          eq(notificaciones.estado, 'fallido'),
          sql`${notificaciones.fecha_creacion} >= ${yesterday}`
        )
      );

    return { total, byStatus, byChannel, recentFailures };
  }

  /**
   * Get recent notifications
   */
  async getRecent(limit: number = 50): Promise<Notificacion[]> {
    return this.db
      .select()
      .from(notificaciones)
      .orderBy(desc(notificaciones.fecha_creacion))
      .limit(limit);
  }
}

// ============ Factory Function ============

/**
 * Create configured notification service from environment
 */
export function createNotificationService(db: Database, env: Env): NotificationServiceV2 {
  const service = new NotificationServiceV2(db);

  // Configure Twilio if available
  if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) {
    service.configureTwilio({
      accountSid: env.TWILIO_ACCOUNT_SID,
      authToken: env.TWILIO_AUTH_TOKEN,
      smsFrom: env.TWILIO_SMS_FROM || '',
      whatsappFrom: env.TWILIO_WHATSAPP_FROM || '',
    });
  }

  // Configure VAPID if available
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
    service.configureVapid({
      publicKey: env.VAPID_PUBLIC_KEY,
      privateKey: env.VAPID_PRIVATE_KEY,
      email: env.VAPID_EMAIL || 'admin@remesitas.com',
    });
  }

  // Configure email if available
  if (env.RESEND_API_KEY) {
    service.configureEmail({
      provider: 'resend',
      apiKey: env.RESEND_API_KEY,
      fromEmail: env.EMAIL_FROM || 'noreply@remesitas.com',
      fromName: env.EMAIL_FROM_NAME || 'Remesitas',
    });
  } else if (env.SENDGRID_API_KEY) {
    service.configureEmail({
      provider: 'sendgrid',
      apiKey: env.SENDGRID_API_KEY,
      fromEmail: env.EMAIL_FROM || 'noreply@remesitas.com',
      fromName: env.EMAIL_FROM_NAME || 'Remesitas',
    });
  }

  // Set base URL
  if (env.URL_BASE) {
    service.setBaseUrl(env.URL_BASE);
  }

  return service;
}
