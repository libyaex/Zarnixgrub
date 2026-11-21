/**
 * Web Push without third-party packages (Node `crypto` only).
 *  - Payload encryption: RFC 8291 (aes128gcm content coding, RFC 8188)
 *  - Sender identification: VAPID, RFC 8292 (ES256 JWT)
 * Verified against the RFC 8291 Appendix A test vector (tests/webpush.test.ts).
 */
import crypto from 'node:crypto';

const b64u = (b: Buffer | Uint8Array): string => Buffer.from(b).toString('base64url');
const fromB64u = (s: string): Buffer => Buffer.from(s, 'base64url');
const hkdf = (ikm: Buffer, salt: Buffer, info: Buffer, len: number): Buffer =>
  Buffer.from(crypto.hkdfSync('sha256', ikm, salt, info, len));

export const MAX_PAYLOAD_BYTES = 3800; // record size 4096 - header/tag/padding headroom

export interface EncryptInput {
  plaintext: Buffer;
  uaPublic: Buffer; // subscriber p256dh (65 bytes, uncompressed)
  authSecret: Buffer; // subscriber auth (16 bytes)
  // Test hooks (fixed values reproduce the RFC vector); production leaves them undefined.
  asPrivate?: Buffer;
  salt?: Buffer;
}

export function encryptPayload(input: EncryptInput): Buffer {
  if (input.plaintext.length > MAX_PAYLOAD_BYTES) throw new Error('push payload too large');
  if (input.uaPublic.length !== 65 || input.uaPublic[0] !== 0x04) throw new Error('invalid p256dh key');
  if (input.authSecret.length !== 16) throw new Error('invalid auth secret');

  const ecdh = crypto.createECDH('prime256v1');
  if (input.asPrivate) ecdh.setPrivateKey(input.asPrivate); else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey(); // 65 bytes uncompressed
  const salt = input.salt ?? crypto.randomBytes(16);

  const shared = ecdh.computeSecret(input.uaPublic);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), input.uaPublic, asPublic]);
  const ikm = hkdf(shared, input.authSecret, keyInfo, 32);
  const cek = hkdf(ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12);

  // Single record: plaintext followed by the 0x02 "last record" delimiter.
  const padded = Buffer.concat([input.plaintext, Buffer.from([0x02])]);
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const encrypted = Buffer.concat([cipher.update(padded), cipher.final(), cipher.getAuthTag()]);

  const header = Buffer.alloc(16 + 4 + 1);
  salt.copy(header, 0);
  header.writeUInt32BE(4096, 16);
  header.writeUInt8(asPublic.length, 20);
  return Buffer.concat([header, asPublic, encrypted]);
}

/** Inverse of encryptPayload for the subscriber side (used by tests to prove round-trips). */
export function decryptPayload(body: Buffer, uaPrivate: Buffer, uaPublic: Buffer, authSecret: Buffer): Buffer {
  const salt = body.subarray(0, 16);
  const idLen = body.readUInt8(20);
  const asPublic = body.subarray(21, 21 + idLen);
  const ciphertext = body.subarray(21 + idLen);

  const ecdh = crypto.createECDH('prime256v1');
  ecdh.setPrivateKey(uaPrivate);
  const shared = ecdh.computeSecret(asPublic);
  const ikm = hkdf(shared, authSecret, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]), 32);
  const cek = hkdf(ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12);
  const decipher = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
  decipher.setAuthTag(ciphertext.subarray(ciphertext.length - 16));
  const padded = Buffer.concat([decipher.update(ciphertext.subarray(0, ciphertext.length - 16)), decipher.final()]);
  let end = padded.length;
  while (end > 0 && padded[end - 1] === 0) end--;
  return padded.subarray(0, end - 1); // drop the 0x02 delimiter
}

export interface VapidKeys { publicKey: string; privateKey: string; subject: string }

export function generateVapidKeys(): { publicKey: string; privateKey: string } {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  return { publicKey: b64u(ecdh.getPublicKey()), privateKey: b64u(ecdh.getPrivateKey()) };
}

export function vapidFromEnv(env: Record<string, string | undefined> = process.env): VapidKeys | null {
  const publicKey = (env.VAPID_PUBLIC_KEY || '').trim();
  const privateKey = (env.VAPID_PRIVATE_KEY || '').trim();
  if (!publicKey || !privateKey) return null;
  const subject = (env.VAPID_SUBJECT || '').trim() || `mailto:${env.OWNER_EMAIL || 'admin@example.com'}`;
  return { publicKey, privateKey, subject };
}

export function createVapidJwt(endpoint: string, keys: VapidKeys, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const aud = new URL(endpoint).origin;
  const header = b64u(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(Buffer.from(JSON.stringify({ aud, exp: nowSeconds + 12 * 3600, sub: keys.subject })));
  const pub = fromB64u(keys.publicKey);
  const key = crypto.createPrivateKey({
    key: { kty: 'EC', crv: 'P-256', x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)), d: keys.privateKey },
    format: 'jwk',
  });
  const signature = crypto.sign('sha256', Buffer.from(`${header}.${claims}`), { key, dsaEncoding: 'ieee-p1363' });
  return `${header}.${claims}.${b64u(signature)}`;
}

export interface PushSubscriptionRow { endpoint: string; p256dh: string; auth: string }
export type PushResult = 'sent' | 'gone' | 'retry' | 'failed';

export interface SendOptions { ttl?: number; urgency?: 'very-low' | 'low' | 'normal' | 'high'; topic?: string }

export async function sendPush(
  sub: PushSubscriptionRow,
  payload: Record<string, unknown>,
  keys: VapidKeys,
  opts: SendOptions = {},
  fetchImpl: typeof fetch = fetch
): Promise<PushResult> {
  let body: Buffer;
  try {
    body = encryptPayload({
      plaintext: Buffer.from(JSON.stringify(payload)),
      uaPublic: fromB64u(sub.p256dh),
      authSecret: fromB64u(sub.auth),
    });
  } catch {
    return 'failed';
  }
  const headers: Record<string, string> = {
    Authorization: `vapid t=${createVapidJwt(sub.endpoint, keys)}, k=${keys.publicKey}`,
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    TTL: String(opts.ttl ?? 86400),
    Urgency: opts.urgency ?? 'normal',
  };
  if (opts.topic && /^[A-Za-z0-9_-]{1,32}$/.test(opts.topic)) headers.Topic = opts.topic;
  try {
    const res = await fetchImpl(sub.endpoint, { method: 'POST', headers, body, signal: AbortSignal.timeout(8000) });
    if (res.status === 201 || res.status === 200 || res.status === 202) return 'sent';
    if (res.status === 404 || res.status === 410) return 'gone';
    if (res.status === 429 || res.status >= 500) return 'retry';
    return 'failed';
  } catch {
    return 'retry';
  }
}
