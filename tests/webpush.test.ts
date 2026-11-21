import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  encryptPayload, decryptPayload, generateVapidKeys, createVapidJwt, sendPush, vapidFromEnv, MAX_PAYLOAD_BYTES,
} from '../server/lib/webpush.ts';

const b = (s: string) => Buffer.from(s, 'base64url');

test('RFC 8291 Appendix A test vector is reproduced byte-for-byte', () => {
  const body = encryptPayload({
    plaintext: Buffer.from('When I grow up, I want to be a watermelon'),
    uaPublic: b('BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4'),
    authSecret: b('BTBZMqHH6r4Tts7J_aSIgg'),
    asPrivate: b('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw'),
    salt: b('DGv6ra1nlYgDCS1FRnbzlw'),
  });
  assert.equal(
    body.toString('base64url'),
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN'
  );
});

test('round trip with fresh keys (Arabic + emoji payload)', () => {
  const ua = crypto.createECDH('prime256v1'); ua.generateKeys();
  const auth = crypto.randomBytes(16);
  const text = JSON.stringify({ title: 'تم اعتماد الدفع ✅', body: 'طلبك ZNX-123 جاهز للتحميل' });
  const body = encryptPayload({ plaintext: Buffer.from(text), uaPublic: ua.getPublicKey(), authSecret: auth });
  assert.equal(decryptPayload(body, ua.getPrivateKey(), ua.getPublicKey(), auth).toString(), text);
  // every message uses a fresh ephemeral key + salt
  const again = encryptPayload({ plaintext: Buffer.from(text), uaPublic: ua.getPublicKey(), authSecret: auth });
  assert.notEqual(body.toString('hex'), again.toString('hex'));
});

test('tampering is detected and bad inputs are refused', () => {
  const ua = crypto.createECDH('prime256v1'); ua.generateKeys();
  const auth = crypto.randomBytes(16);
  const body = encryptPayload({ plaintext: Buffer.from('hi'), uaPublic: ua.getPublicKey(), authSecret: auth });
  body[body.length - 1] ^= 0xff;
  assert.throws(() => decryptPayload(body, ua.getPrivateKey(), ua.getPublicKey(), auth));
  assert.throws(() => encryptPayload({ plaintext: Buffer.alloc(MAX_PAYLOAD_BYTES + 1), uaPublic: ua.getPublicKey(), authSecret: auth }), /too large/);
  assert.throws(() => encryptPayload({ plaintext: Buffer.from('x'), uaPublic: Buffer.alloc(10), authSecret: auth }), /p256dh/);
  assert.throws(() => encryptPayload({ plaintext: Buffer.from('x'), uaPublic: ua.getPublicKey(), authSecret: Buffer.alloc(3) }), /auth/);
});

test('VAPID JWT is a valid ES256 token the push service can verify', () => {
  const keys = { ...generateVapidKeys(), subject: 'mailto:owner@example.com' };
  const jwt = createVapidJwt('https://fcm.googleapis.com/fcm/send/abc', keys, 1_700_000_000);
  const [h, c, s] = jwt.split('.');
  assert.deepEqual(JSON.parse(b(h).toString()), { typ: 'JWT', alg: 'ES256' });
  const claims = JSON.parse(b(c).toString());
  assert.equal(claims.aud, 'https://fcm.googleapis.com');
  assert.equal(claims.sub, 'mailto:owner@example.com');
  assert.ok(claims.exp - 1_700_000_000 <= 24 * 3600, 'RFC 8292: exp must be within 24h');
  const pub = b(keys.publicKey);
  const publicKey = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: pub.subarray(1, 33).toString('base64url'), y: pub.subarray(33, 65).toString('base64url') }, format: 'jwk' });
  assert.equal(crypto.verify('sha256', Buffer.from(`${h}.${c}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, b(s)), true);
  assert.equal(b(s).length, 64);
});

test('sendPush: sets the protocol headers and maps push-service responses', async () => {
  const keys = { ...generateVapidKeys(), subject: 'mailto:a@b.co' };
  const ua = crypto.createECDH('prime256v1'); ua.generateKeys();
  const sub = { endpoint: 'https://push.example/send/1', p256dh: ua.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') };
  let seen: any;
  const mk = (status: number) => (async (url: string, init: any) => { seen = { url, init }; return { status }; }) as unknown as typeof fetch;

  assert.equal(await sendPush(sub, { title: 't' }, keys, { urgency: 'high', topic: 'orders-1' }, mk(201)), 'sent');
  assert.equal(seen.init.headers['Content-Encoding'], 'aes128gcm');
  assert.equal(seen.init.headers.Urgency, 'high');
  assert.equal(seen.init.headers.Topic, 'orders-1');
  assert.match(seen.init.headers.Authorization, /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=/);
  assert.ok(Buffer.isBuffer(seen.init.body));

  assert.equal(await sendPush(sub, {}, keys, {}, mk(410)), 'gone');
  assert.equal(await sendPush(sub, {}, keys, {}, mk(404)), 'gone');
  assert.equal(await sendPush(sub, {}, keys, {}, mk(429)), 'retry');
  assert.equal(await sendPush(sub, {}, keys, {}, mk(503)), 'retry');
  assert.equal(await sendPush(sub, {}, keys, {}, mk(400)), 'failed');
  assert.equal(await sendPush(sub, {}, keys, {}, (async () => { throw new Error('net'); }) as unknown as typeof fetch), 'retry');
  assert.equal(await sendPush({ ...sub, p256dh: 'bad' }, {}, keys, {}, mk(201)), 'failed');
});

test('vapidFromEnv is null until both keys are configured', () => {
  assert.equal(vapidFromEnv({}), null);
  assert.equal(vapidFromEnv({ VAPID_PUBLIC_KEY: 'a' } as any), null);
  assert.equal(vapidFromEnv({ VAPID_PUBLIC_KEY: 'a', VAPID_PRIVATE_KEY: 'b', OWNER_EMAIL: 'o@x.co' } as any)?.subject, 'mailto:o@x.co');
});
