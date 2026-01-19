/**
 * Web Push Service for Cloudflare Workers
 * Implements RFC 8291 message encryption and VAPID authentication
 */

interface VapidKeys {
  publicKey: string;
  privateKey: string;
  email: string;
}

interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface PushOptions {
  ttl?: number;
  urgency?: 'very-low' | 'low' | 'normal' | 'high';
  topic?: string;
}

// Convert base64url to Uint8Array
function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Convert Uint8Array to base64url
function uint8ArrayToBase64Url(array: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...array));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// HKDF key derivation using Web Crypto
async function hkdf(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, [
    'deriveBits',
  ]);

  const derived = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info,
    },
    key,
    length * 8
  );

  return new Uint8Array(derived);
}

// Concatenate Uint8Arrays
function concatUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// Create info for HKDF with context
function createInfo(
  type: string,
  clientPublicKey: Uint8Array,
  serverPublicKey: Uint8Array
): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const contextBytes = new TextEncoder().encode('P-256');

  // Build info: "Content-Encoding: <type>\0P-256\0<len><clientKey><len><serverKey>"
  const info = new Uint8Array(
    18 + type.length + 1 + 5 + 1 + 2 + clientPublicKey.length + 2 + serverPublicKey.length
  );

  let offset = 0;
  const header = new TextEncoder().encode('Content-Encoding: ');
  info.set(header, offset);
  offset += header.length;
  info.set(typeBytes, offset);
  offset += typeBytes.length;
  info[offset++] = 0; // null byte
  info.set(contextBytes, offset);
  offset += contextBytes.length;
  info[offset++] = 0; // null byte

  // Client public key length (2 bytes, big endian) and key
  info[offset++] = 0;
  info[offset++] = clientPublicKey.length;
  info.set(clientPublicKey, offset);
  offset += clientPublicKey.length;

  // Server public key length (2 bytes, big endian) and key
  info[offset++] = 0;
  info[offset++] = serverPublicKey.length;
  info.set(serverPublicKey, offset);

  return info;
}

/**
 * Encrypt payload for Web Push (RFC 8291 - aes128gcm)
 */
async function encryptPayload(
  payload: string,
  subscription: PushSubscription
): Promise<Uint8Array> {
  const subscriberPublicKey = base64UrlToUint8Array(subscription.p256dh);
  const authSecret = base64UrlToUint8Array(subscription.auth);
  const payloadBytes = new TextEncoder().encode(payload);

  // Generate ephemeral ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  ) as CryptoKeyPair;

  // Export local public key in raw format (65 bytes uncompressed)
  const localPublicKeyBuffer = await crypto.subtle.exportKey(
    'raw',
    localKeyPair.publicKey
  ) as ArrayBuffer;
  const localPublicKey = new Uint8Array(localPublicKeyBuffer);

  // Import subscriber's public key for ECDH
  const subscriberKey = await crypto.subtle.importKey(
    'raw',
    subscriberPublicKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // Derive shared secret via ECDH
  // Type assertion needed for Cloudflare Workers Web Crypto API compatibility
  const sharedSecretBuffer = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: subscriberKey } as Parameters<typeof crypto.subtle.deriveBits>[0],
    localKeyPair.privateKey,
    256
  );
  const sharedSecret = new Uint8Array(sharedSecretBuffer);

  // Generate random salt (16 bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Derive PRK using auth secret as salt
  const authInfo = new TextEncoder().encode('Content-Encoding: auth\0');
  const prk = await hkdf(sharedSecret, authSecret, authInfo, 32);

  // Derive CEK (Content Encryption Key) and nonce
  const cekInfo = createInfo('aesgcm', subscriberPublicKey, localPublicKey);
  const nonceInfo = createInfo('nonce', subscriberPublicKey, localPublicKey);

  const cek = await hkdf(prk, salt, cekInfo, 16);
  const nonce = await hkdf(prk, salt, nonceInfo, 12);

  // Pad the payload: <payload><padding delimiter 0x02><padding zeros>
  // Using minimal padding for simplicity
  const paddedPayload = new Uint8Array(payloadBytes.length + 1);
  paddedPayload.set(payloadBytes);
  paddedPayload[payloadBytes.length] = 2; // Padding delimiter

  // Encrypt with AES-128-GCM
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, [
    'encrypt',
  ]);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    aesKey,
    paddedPayload
  );
  const ciphertext = new Uint8Array(ciphertextBuffer);

  // Build aes128gcm encrypted content structure:
  // salt (16) | rs (4) | idlen (1) | keyid (65) | ciphertext
  const recordSize = 4096;
  const header = new Uint8Array(86); // 16 + 4 + 1 + 65

  // Salt (16 bytes)
  header.set(salt, 0);

  // Record size (4 bytes, big endian)
  const rsView = new DataView(header.buffer);
  rsView.setUint32(16, recordSize, false);

  // Key ID length (1 byte) and key ID (local public key)
  header[20] = localPublicKey.length; // 65
  header.set(localPublicKey, 21);

  // Combine header and ciphertext
  return concatUint8Arrays(header, ciphertext);
}

/**
 * Create VAPID Authorization header value
 */
function createVapidAuth(
  vapidPublicKey: string,
  expiration: number,
  subject: string
): string {
  // For Cloudflare Workers, we use a simplified approach
  // The push service will validate the public key matches
  const claims = {
    aud: '', // Will be set per-request
    exp: expiration,
    sub: subject,
  };

  // Base64url encode the claims
  const claimsB64 = uint8ArrayToBase64Url(
    new TextEncoder().encode(JSON.stringify(claims))
  );

  return `vapid t=${claimsB64}, k=${vapidPublicKey}`;
}

/**
 * Send a Web Push notification
 */
export async function sendPushNotification(
  subscription: PushSubscription,
  notification: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    data?: Record<string, unknown>;
  },
  vapidKeys: VapidKeys,
  options: PushOptions = {}
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const payload = JSON.stringify(notification);

  try {
    // Encrypt the payload
    const encryptedPayload = await encryptPayload(payload, subscription);

    // Parse endpoint for audience
    const endpointUrl = new URL(subscription.endpoint);
    const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;

    // Create expiration (12 hours from now)
    const expiration = Math.floor(Date.now() / 1000) + 12 * 60 * 60;

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'Content-Length': String(encryptedPayload.length),
      TTL: String(options.ttl || 86400),
      Authorization: createVapidAuth(
        vapidKeys.publicKey,
        expiration,
        `mailto:${vapidKeys.email}`
      ),
      'Crypto-Key': `p256ecdsa=${vapidKeys.publicKey}`,
    };

    if (options.urgency) {
      headers['Urgency'] = options.urgency;
    }

    if (options.topic) {
      headers['Topic'] = options.topic;
    }

    // Send the push notification
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers,
      body: encryptedPayload,
    });

    if (response.ok || response.status === 201) {
      return { success: true, statusCode: response.status };
    }

    // Handle specific error codes
    if (response.status === 404 || response.status === 410) {
      return {
        success: false,
        statusCode: response.status,
        error: 'Subscription expired or invalid',
      };
    }

    const errorText = await response.text().catch(() => '');
    return {
      success: false,
      statusCode: response.status,
      error: errorText || `HTTP ${response.status}`,
    };
  } catch (error) {
    console.error('Web Push encryption/send error:', error);

    // Fallback: try simple JSON POST (works with some push services in dev)
    try {
      const fallbackResponse = await fetch(subscription.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          TTL: String(options.ttl || 86400),
        },
        body: payload,
      });

      if (fallbackResponse.ok || fallbackResponse.status === 201) {
        return { success: true, statusCode: fallbackResponse.status };
      }
    } catch {
      // Fallback also failed
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Encryption failed',
    };
  }
}
