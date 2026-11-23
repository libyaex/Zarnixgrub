import test from 'node:test';
import assert from 'node:assert/strict';
import { describeOrder } from '../src/lib/orderStatus.ts';

const states = (p: ReturnType<typeof describeOrder>) => p.steps.map((s) => s.state);

test('REGRESSION: before a receipt is uploaded the order is NOT "under review"', () => {
  const p = describeOrder({ payment_status: 'unsubmitted', order_status: 'pending' });
  assert.equal(p.stage, 'awaiting_proof');
  assert.equal(p.action, 'upload_proof');
  assert.equal(p.waitingOnUs, false);
  assert.deepEqual(states(p), ['done', 'current', 'todo', 'todo']);
  assert.ok(!p.headline.includes('جارٍ التحقق'));
  assert.ok(p.message.includes('لم يبدأ التحقق'));
});

test('after upload: verifying, nothing for the customer to do, ETA from settings is shown', () => {
  for (const status of ['submitted', 'under_review']) {
    const p = describeOrder({ payment_status: status }, 'خلال ساعتين');
    assert.equal(p.stage, 'verifying');
    assert.equal(p.action, null);
    assert.equal(p.waitingOnUs, true);
    assert.deepEqual(states(p), ['done', 'done', 'current', 'todo']);
    assert.ok(p.message.includes('خلال ساعتين'));
  }
});

test('approved -> download CTA; completed -> all done', () => {
  const a = describeOrder({ payment_status: 'paid', order_status: 'processing' });
  assert.equal(a.stage, 'approved');
  assert.equal(a.action, 'open_downloads');
  assert.deepEqual(states(a), ['done', 'done', 'done', 'current']);
  const d = describeOrder({ payment_status: 'paid', order_status: 'completed' });
  assert.equal(d.stage, 'delivered');
  assert.deepEqual(states(d), ['done', 'done', 'done', 'done']);
});

test('rejected: shows the reviewer\'s reason, flags the upload step, invites re-upload', () => {
  const p = describeOrder({ payment_status: 'rejected', payment_submission: { rejection_reason: 'المبلغ غير مطابق' } });
  assert.equal(p.stage, 'rejected');
  assert.equal(p.action, 'reupload_proof');
  assert.deepEqual(states(p), ['done', 'attention', 'todo', 'todo']);
  assert.ok(p.message.includes('المبلغ غير مطابق'));
  assert.ok(describeOrder({ payment_status: 'rejected' }).message.includes('لم يُلغَ'));
});

test('cancelled and refunded orders ask for nothing', () => {
  assert.equal(describeOrder({ payment_status: 'unsubmitted', order_status: 'cancelled' }).stage, 'cancelled');
  assert.equal(describeOrder({ payment_status: 'refunded', order_status: 'cancelled' }).stage, 'refunded');
  assert.equal(describeOrder({ payment_status: 'paid', order_status: 'cancelled' }).action, null);
});

test('every status the API can produce maps to a defined stage', () => {
  for (const pay of ['unsubmitted', 'submitted', 'under_review', 'paid', 'rejected', 'refunded', 'weird']) {
    for (const ord of ['pending', 'processing', 'completed', 'cancelled', undefined]) {
      const p = describeOrder({ payment_status: pay, order_status: ord });
      assert.ok(p.stage && p.headline && p.steps.length === 4, `${pay}/${ord}`);
    }
  }
});
