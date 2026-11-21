import test from 'node:test';
import assert from 'node:assert/strict';
import { urlBase64ToUint8Array } from '../src/lib/pwa.ts';

test('VAPID public key decodes to the 65-byte uncompressed P-256 point the push API expects', () => {
  const key = 'BOYwiAfNq_ikI2GlxtCANs8Zu-8yHq1xTcFB5GNb_yTHIFbGJyJRn2zpC4BnCNH-ow6ErW8Lc0uHTa_p8aaCPrE';
  const bytes = urlBase64ToUint8Array(key);
  assert.equal(bytes.length, 65);
  assert.equal(bytes[0], 0x04);
  assert.deepEqual(Array.from(urlBase64ToUint8Array('AQID')), [1, 2, 3]);
  assert.deepEqual(Array.from(urlBase64ToUint8Array('_-8')), [255, 239]);
});
