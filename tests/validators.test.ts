import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isOwnReceiptPath, safeFileName, isAllowedProjectFile, isAllowedReceiptMime,
  base64ByteLength, isEmail, isUuid,
} from '../server/lib/validators.ts';

const uid = '11111111-1111-4111-8111-111111111111';

test('receipt path must live under the caller folder', () => {
  assert.equal(isOwnReceiptPath(`${uid}/123-receipt.png`, uid), true);
  assert.equal(isOwnReceiptPath(`22222222-2222-4222-8222-222222222222/x.png`, uid), false);
  assert.equal(isOwnReceiptPath(`${uid}/../other/x.png`, uid), false);
  assert.equal(isOwnReceiptPath(`/${uid}/x.png`, uid), false);
  assert.equal(isOwnReceiptPath(uid, uid), false);
  assert.equal(isOwnReceiptPath(undefined, uid), false);
});
test('file names are sanitised', () => {
  assert.equal(safeFileName('../../etc/passwd'), 'passwd');
  assert.equal(safeFileName('تقرير نهائي.zip').endsWith('.zip'), true);
  assert.equal(safeFileName('...'), 'file');
  assert.ok(safeFileName('a'.repeat(500)).length <= 120);
});
test('project archives by extension, receipts by mime', () => {
  for (const n of ['a.zip', 'B.RAR', 'c.7z', 'd.tar.gz', 'e.tgz']) assert.equal(isAllowedProjectFile(n), true, n);
  for (const n of ['a.exe', 'a.zip.exe', 'a.html']) assert.equal(isAllowedProjectFile(n), false, n);
  assert.equal(isAllowedReceiptMime('image/png'), true);
  assert.equal(isAllowedReceiptMime('application/pdf'), true);
  assert.equal(isAllowedReceiptMime('text/html'), false);
  assert.equal(isAllowedReceiptMime('image/svg+xml'), false);
});
test('base64 length is computed from the payload, not trusted from the client', () => {
  const buf = Buffer.from('hello world!!');
  assert.equal(base64ByteLength(buf.toString('base64')), buf.length);
  assert.equal(base64ByteLength('data:image/png;base64,' + buf.toString('base64')), buf.length);
});
test('email / uuid', () => {
  assert.equal(isEmail('a@b.co'), true);
  assert.equal(isEmail('a@b'), false);
  assert.equal(isUuid(uid), true);
  assert.equal(isUuid('not-a-uuid'), false);
});
