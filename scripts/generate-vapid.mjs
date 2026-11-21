// Generates a VAPID key pair for Web Push. Run once, then add the values to your
// environment (Vercel -> Settings -> Environment Variables) and redeploy.
//   node scripts/generate-vapid.mjs
import crypto from 'node:crypto';

const ecdh = crypto.createECDH('prime256v1');
ecdh.generateKeys();
const b64u = (b) => Buffer.from(b).toString('base64url');

console.log('VAPID_PUBLIC_KEY=' + b64u(ecdh.getPublicKey()));
console.log('VAPID_PRIVATE_KEY=' + b64u(ecdh.getPrivateKey()) + '   # secret: never commit it');
console.log('VAPID_SUBJECT=mailto:you@example.com');
