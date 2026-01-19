import { eq } from 'drizzle-orm';
import { suscripcionesPush } from '../db/schema';
import type { Database } from '../types';

// Country detection based on phone prefix
function detectCountry(phone: string): 'USA' | 'CUBA' | 'UNKNOWN' {
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.startsWith('1') || cleaned.startsWith('001')) {
    return 'USA';
  }
  if (cleaned.startsWith('53') || cleaned.startsWith('5353')) {
    return 'CUBA';
  }
  return 'UNKNOWN';
}

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  smsFrom: string;
  whatsappFrom: string;
}

export interface NotificationResult {
  success: boolean;
  channel?: 'sms' | 'whatsapp' | 'push';
  error?: string;
}

export class NotificationService {
  constructor(
    private db: Database,
    private twilioConfig: TwilioConfig
  ) {}

  // Send SMS via Twilio
  async sendSMS(to: string, message: string): Promise<NotificationResult> {
    try {
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
            Body: message,
          }),
        }
      );

      if (!response.ok) {
        const errorData = (await response.json()) as { message?: string };
        throw new Error(errorData.message || 'SMS sending failed');
      }

      return { success: true, channel: 'sms' };
    } catch (err) {
      console.error('SMS error:', err);
      return {
        success: false,
        channel: 'sms',
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  // Send WhatsApp via Twilio
  async sendWhatsApp(to: string, message: string): Promise<NotificationResult> {
    try {
      const auth = btoa(`${this.twilioConfig.accountSid}:${this.twilioConfig.authToken}`);

      // Format WhatsApp number
      const whatsappTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.twilioConfig.accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            From: `whatsapp:${this.twilioConfig.whatsappFrom}`,
            To: whatsappTo,
            Body: message,
          }),
        }
      );

      if (!response.ok) {
        const errorData = (await response.json()) as { message?: string };
        throw new Error(errorData.message || 'WhatsApp sending failed');
      }

      return { success: true, channel: 'whatsapp' };
    } catch (err) {
      console.error('WhatsApp error:', err);
      return {
        success: false,
        channel: 'whatsapp',
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  // Auto-detect and send
  async send(to: string, message: string): Promise<NotificationResult> {
    const country = detectCountry(to);

    if (country === 'USA') {
      // USA: Send SMS
      return this.sendSMS(to, message);
    } else if (country === 'CUBA') {
      // Cuba: Send WhatsApp
      return this.sendWhatsApp(to, message);
    }

    // Unknown: Try WhatsApp first, fallback to SMS
    const whatsappResult = await this.sendWhatsApp(to, message);
    if (whatsappResult.success) return whatsappResult;

    return this.sendSMS(to, message);
  }

  // Generate manual WhatsApp link (fallback)
  generateWhatsAppLink(phone: string, message: string): string {
    const cleaned = phone.replace(/\D/g, '');
    const encoded = encodeURIComponent(message);
    return `https://wa.me/${cleaned}?text=${encoded}`;
  }

  // Notification templates
  static templates = {
    remesaCreada: (codigo: string, monto: number) =>
      `Remesitas: Se ha creado la remesa ${codigo} por ${monto} CUP. Le notificaremos cuando esté en camino.`,

    remesaEnProceso: (codigo: string, repartidor: string) =>
      `Remesitas: Su remesa ${codigo} está en camino con ${repartidor}. Pronto recibirá su dinero.`,

    remesaEntregada: (codigo: string) =>
      `Remesitas: Su remesa ${codigo} ha sido entregada exitosamente. Gracias por confiar en nosotros!`,

    nuevaSolicitud: (codigo: string, remitente: string) =>
      `Nueva solicitud de remesa ${codigo} de ${remitente}. Revisar en el panel de administración.`,
  };
}

// Push notification service using Web Push
export class PushService {
  constructor(
    private db: Database,
    private vapidPublicKey: string,
    private vapidPrivateKey: string,
    private vapidEmail: string
  ) {}

  // Send push notification
  async sendPush(
    userId: number,
    title: string,
    body: string,
    data?: Record<string, any>
  ): Promise<NotificationResult[]> {
    // Get user's subscriptions
    const subscriptions = await this.db
      .select()
      .from(suscripcionesPush)
      .where(eq(suscripcionesPush.usuario_id, userId));

    if (subscriptions.length === 0) {
      return [{ success: false, channel: 'push', error: 'No subscriptions found' }];
    }

    const results: NotificationResult[] = [];

    for (const sub of subscriptions) {
      try {
        // Create the push payload
        const payload = JSON.stringify({
          title,
          body,
          icon: '/icon-192.png',
          badge: '/icon-72.png',
          data,
        });

        // Send using Web Push (simplified - in production use proper VAPID signing)
        const response = await fetch(sub.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'TTL': '86400',
            // VAPID headers would go here in production
          },
          body: payload,
        });

        if (response.ok || response.status === 201) {
          results.push({ success: true, channel: 'push' });
        } else {
          // If subscription is gone, remove it
          if (response.status === 404 || response.status === 410) {
            await this.db
              .delete(suscripcionesPush)
              .where(eq(suscripcionesPush.id, sub.id));
          }
          results.push({
            success: false,
            channel: 'push',
            error: `HTTP ${response.status}`,
          });
        }
      } catch (error) {
        results.push({
          success: false,
          channel: 'push',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  // Subscribe user to push notifications
  async subscribe(
    userId: number,
    endpoint: string,
    p256dh: string,
    auth: string
  ): Promise<boolean> {
    try {
      await this.db.insert(suscripcionesPush).values({
        usuario_id: userId,
        endpoint,
        p256dh,
        auth,
      });
      return true;
    } catch (error) {
      console.error('Push subscription error:', error);
      return false;
    }
  }

  // Unsubscribe
  async unsubscribe(endpoint: string): Promise<boolean> {
    try {
      await this.db
        .delete(suscripcionesPush)
        .where(eq(suscripcionesPush.endpoint, endpoint));
      return true;
    } catch {
      return false;
    }
  }
}
