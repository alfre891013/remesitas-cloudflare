import { eq } from 'drizzle-orm';
import { usuarios, suscripcionesPush } from '../db/schema';
import type { Database } from '../types';
import type { Remesa, Usuario } from '../db/schema';
import { sendPushNotification } from './webpush.service';

/**
 * Detect country from phone number
 */
export function detectarPais(telefono: string): 'usa' | 'cuba' | 'otro' {
  const cleaned = telefono.replace(/\D/g, '');

  if (cleaned.startsWith('1') || cleaned.startsWith('001')) {
    return 'usa';
  }
  if (cleaned.startsWith('53') || cleaned.startsWith('5353')) {
    return 'cuba';
  }
  return 'otro';
}

/**
 * Clean phone number to international format
 */
function limpiarTelefono(telefono: string): string {
  let cleaned = telefono.replace(/\D/g, '');

  // Add country code if missing
  if (cleaned.length === 10 && !cleaned.startsWith('1') && !cleaned.startsWith('53')) {
    // Assume USA
    cleaned = '1' + cleaned;
  }

  return '+' + cleaned;
}

/**
 * Generate WhatsApp link
 */
export function generarLinkWhatsApp(telefono: string, mensaje: string): string {
  const cleaned = telefono.replace(/\D/g, '');
  const encoded = encodeURIComponent(mensaje);
  return `https://wa.me/${cleaned}?text=${encoded}`;
}

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  smsFrom: string;
  whatsappFrom: string;
}

export interface NotificationResult {
  success: boolean;
  sid?: string;
  error?: string;
  fallback_link?: string;
}

export class NotificacionesService {
  constructor(
    private db: Database,
    private twilioConfig: TwilioConfig
  ) {}

  /**
   * Send SMS via Twilio
   */
  async enviarSMS(telefono: string, mensaje: string): Promise<NotificationResult> {
    if (!this.twilioConfig.accountSid || !this.twilioConfig.authToken) {
      return { success: false, error: 'Twilio not configured' };
    }

    try {
      const to = limpiarTelefono(telefono);
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
            To: to,
            Body: mensaje,
          }),
        }
      );

      const data = await response.json() as any;

      if (!response.ok) {
        console.error('Twilio SMS error:', data);
        return { success: false, error: data.message || 'SMS failed' };
      }

      return { success: true, sid: data.sid };
    } catch (error) {
      console.error('SMS send error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send WhatsApp via Twilio
   */
  async enviarWhatsApp(telefono: string, mensaje: string): Promise<NotificationResult> {
    if (!this.twilioConfig.accountSid || !this.twilioConfig.authToken) {
      // Return manual link as fallback
      return {
        success: false,
        error: 'Twilio not configured',
        fallback_link: generarLinkWhatsApp(telefono, mensaje),
      };
    }

    try {
      const cleaned = telefono.replace(/\D/g, '');
      const to = `whatsapp:+${cleaned}`;
      const from = `whatsapp:${this.twilioConfig.whatsappFrom}`;

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
            From: from,
            To: to,
            Body: mensaje,
          }),
        }
      );

      const data = await response.json() as any;

      if (!response.ok) {
        console.error('Twilio WhatsApp error:', data);
        return {
          success: false,
          error: data.message || 'WhatsApp failed',
          fallback_link: generarLinkWhatsApp(telefono, mensaje),
        };
      }

      return { success: true, sid: data.sid };
    } catch (error) {
      console.error('WhatsApp send error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        fallback_link: generarLinkWhatsApp(telefono, mensaje),
      };
    }
  }

  /**
   * Auto-select channel based on phone country
   */
  async enviarNotificacion(telefono: string, mensaje: string): Promise<NotificationResult> {
    const pais = detectarPais(telefono);

    if (pais === 'usa') {
      return this.enviarSMS(telefono, mensaje);
    } else if (pais === 'cuba') {
      return this.enviarWhatsApp(telefono, mensaje);
    } else {
      // Try WhatsApp first for unknown, fallback to SMS
      const result = await this.enviarWhatsApp(telefono, mensaje);
      if (result.success) return result;
      return this.enviarSMS(telefono, mensaje);
    }
  }

  // ============ Specific notification functions ============

  /**
   * Notify distributor of new assignment
   */
  async notificarNuevaRemesa(repartidor: Usuario, remesa: Remesa): Promise<NotificationResult> {
    const mensaje = `Remesitas: Nueva remesa ${remesa.codigo} asignada.\n` +
      `Beneficiario: ${remesa.beneficiario_nombre}\n` +
      `Dirección: ${remesa.beneficiario_direccion}\n` +
      `Monto: ${remesa.monto_entrega} ${remesa.moneda_entrega}`;

    if (repartidor.telefono) {
      return this.enviarWhatsApp(repartidor.telefono, mensaje);
    }
    return { success: false, error: 'Repartidor sin teléfono' };
  }

  /**
   * Notify remitter that remittance was created
   */
  async notificarRemitente(remesa: Remesa): Promise<NotificationResult> {
    const mensaje = `Remesitas: Su remesa ${remesa.codigo} ha sido registrada.\n` +
      `Beneficiario: ${remesa.beneficiario_nombre}\n` +
      `Monto a entregar: ${remesa.monto_entrega} ${remesa.moneda_entrega}\n` +
      `Le notificaremos cuando sea entregada.`;

    return this.enviarNotificacion(remesa.remitente_telefono, mensaje);
  }

  /**
   * Notify beneficiary that delivery is on the way
   */
  async notificarBeneficiario(remesa: Remesa): Promise<NotificationResult> {
    const mensaje = `Remesitas: Tiene una remesa en camino.\n` +
      `Código: ${remesa.codigo}\n` +
      `Monto: ${remesa.monto_entrega} ${remesa.moneda_entrega}\n` +
      `Por favor esté atento, nuestro repartidor llegará pronto.`;

    return this.enviarWhatsApp(remesa.beneficiario_telefono, mensaje);
  }

  /**
   * Notify remitter of delivery completion
   */
  async notificarEntregaRemitente(remesa: Remesa): Promise<NotificationResult> {
    const mensaje = `Remesitas: Su remesa ${remesa.codigo} ha sido entregada exitosamente a ${remesa.beneficiario_nombre}.\n` +
      `Gracias por confiar en nosotros.`;

    return this.enviarNotificacion(remesa.remitente_telefono, mensaje);
  }

  /**
   * Get all notification links for manual sending
   */
  obtenerLinksNotificacion(
    remesa: Remesa,
    repartidor?: Usuario | null
  ): {
    link_remitente: string;
    link_beneficiario: string;
    link_repartidor?: string;
  } {
    const msgRemitente = `Remesitas: Remesa ${remesa.codigo}\n` +
      `Monto: $${remesa.monto_envio} USD\n` +
      `Beneficiario: ${remesa.beneficiario_nombre}`;

    const msgBeneficiario = `Remesitas: Tiene una remesa\n` +
      `Código: ${remesa.codigo}\n` +
      `Monto: ${remesa.monto_entrega} ${remesa.moneda_entrega}`;

    const result: any = {
      link_remitente: generarLinkWhatsApp(remesa.remitente_telefono, msgRemitente),
      link_beneficiario: generarLinkWhatsApp(remesa.beneficiario_telefono, msgBeneficiario),
    };

    if (repartidor?.telefono) {
      const msgRepartidor = `Nueva asignación: ${remesa.codigo}\n` +
        `${remesa.beneficiario_nombre}\n` +
        `${remesa.beneficiario_direccion}\n` +
        `${remesa.monto_entrega} ${remesa.moneda_entrega}`;
      result.link_repartidor = generarLinkWhatsApp(repartidor.telefono, msgRepartidor);
    }

    return result;
  }
}

// ============ Push Notifications ============

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  email: string;
}

export class PushService {
  constructor(
    private db: Database,
    private vapidConfig: VapidConfig
  ) {}

  /**
   * Send push notification to a user
   */
  async notificarUsuario(
    usuarioId: number,
    titulo: string,
    mensaje: string,
    url?: string
  ): Promise<{ sent: number; failed: number }> {
    const suscripciones = await this.db
      .select()
      .from(suscripcionesPush)
      .where(eq(suscripcionesPush.usuario_id, usuarioId));

    let sent = 0;
    let failed = 0;

    for (const sub of suscripciones) {
      const success = await this.enviarPush(sub, titulo, mensaje, url);
      if (success) sent++;
      else failed++;
    }

    return { sent, failed };
  }

  /**
   * Send push to all admins
   */
  async notificarAdmins(
    titulo: string,
    mensaje: string,
    url?: string
  ): Promise<{ sent: number; failed: number }> {
    // Get admin user IDs
    const admins = await this.db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(eq(usuarios.rol, 'admin'));

    let sent = 0;
    let failed = 0;

    for (const admin of admins) {
      const result = await this.notificarUsuario(admin.id, titulo, mensaje, url);
      sent += result.sent;
      failed += result.failed;
    }

    return { sent, failed };
  }

  /**
   * Send push to a distributor
   */
  async notificarRepartidor(
    repartidorId: number,
    titulo: string,
    mensaje: string,
    url?: string
  ): Promise<{ sent: number; failed: number }> {
    return this.notificarUsuario(repartidorId, titulo, mensaje, url);
  }

  /**
   * Low-level push send with full VAPID and encryption
   */
  private async enviarPush(
    suscripcion: { endpoint: string; p256dh: string; auth: string; id: number },
    titulo: string,
    mensaje: string,
    url?: string
  ): Promise<boolean> {
    try {
      const result = await sendPushNotification(
        {
          endpoint: suscripcion.endpoint,
          p256dh: suscripcion.p256dh,
          auth: suscripcion.auth,
        },
        {
          title: titulo,
          body: mensaje,
          icon: '/icon-192.png',
          badge: '/icon-72.png',
          data: url ? { url } : undefined,
        },
        {
          publicKey: this.vapidConfig.publicKey,
          privateKey: this.vapidConfig.privateKey,
          email: this.vapidConfig.email,
        }
      );

      if (!result.success) {
        console.error('Push failed:', result.error);
        // Remove invalid subscription if endpoint is gone
        if (result.error?.includes('404') || result.error?.includes('410')) {
          await this.db
            .delete(suscripcionesPush)
            .where(eq(suscripcionesPush.id, suscripcion.id));
        }
        return false;
      }

      return true;
    } catch (error) {
      console.error('Push send error:', error);
      return false;
    }
  }

  /**
   * Subscribe to push notifications
   */
  async suscribir(
    usuarioId: number | null,
    endpoint: string,
    p256dh: string,
    auth: string
  ): Promise<boolean> {
    try {
      // Check if already exists
      const [existing] = await this.db
        .select()
        .from(suscripcionesPush)
        .where(eq(suscripcionesPush.endpoint, endpoint))
        .limit(1);

      if (existing) {
        // Update if exists
        await this.db
          .update(suscripcionesPush)
          .set({ usuario_id: usuarioId, activa: true })
          .where(eq(suscripcionesPush.id, existing.id));
      } else {
        // Insert new
        await this.db.insert(suscripcionesPush).values({
          usuario_id: usuarioId,
          endpoint,
          p256dh,
          auth,
          activa: true,
        });
      }

      return true;
    } catch (error) {
      console.error('Push subscribe error:', error);
      return false;
    }
  }

  /**
   * Unsubscribe from push
   */
  async desuscribir(endpoint: string): Promise<boolean> {
    try {
      await this.db
        .update(suscripcionesPush)
        .set({ activa: false })
        .where(eq(suscripcionesPush.endpoint, endpoint));
      return true;
    } catch {
      return false;
    }
  }

  // ============ Event-specific push functions ============

  async pushNuevaRemesaAdmin(remesa: Remesa): Promise<void> {
    await this.notificarAdmins(
      'Nueva Remesa',
      `${remesa.codigo}: $${remesa.monto_envio} USD para ${remesa.beneficiario_nombre}`,
      `/admin/remesas/${remesa.id}`
    );
  }

  async pushRemesaAsignada(remesa: Remesa): Promise<void> {
    if (remesa.repartidor_id) {
      await this.notificarRepartidor(
        remesa.repartidor_id,
        'Nueva Entrega Asignada',
        `${remesa.codigo}: ${remesa.monto_entrega} ${remesa.moneda_entrega}`,
        `/repartidor/entregas/${remesa.id}`
      );
    }
  }

  async pushRemesaEntregadaAdmin(remesa: Remesa): Promise<void> {
    await this.notificarAdmins(
      'Remesa Entregada',
      `${remesa.codigo} entregada a ${remesa.beneficiario_nombre}`,
      `/admin/remesas/${remesa.id}`
    );
  }

  async pushNuevaSolicitudAdmin(remesa: Remesa): Promise<void> {
    await this.notificarAdmins(
      'Nueva Solicitud',
      `$${remesa.monto_envio} USD de ${remesa.remitente_nombre}`,
      `/admin/solicitudes/${remesa.id}`
    );
  }
}
