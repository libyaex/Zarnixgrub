import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidLibyaIban, normalizeIban, formatIban, parsePaymentAccount, PAYMENT_METHODS, methodMeta,
} from '../src/shared/paymentMethods.ts';

const IBAN = 'LY83002048000020100120361'; // ISO 13616 registry example for Libya

test('Libya IBAN: 25 chars, mod-97 checked, spaces/dashes/lowercase tolerated', () => {
  assert.equal(isValidLibyaIban(IBAN), true);
  assert.equal(isValidLibyaIban('ly83 0020 4800 0020 1001 2036 1'), true);
  assert.equal(isValidLibyaIban('LY83-0020-4800-0020-1001-2036-1'), true);
  assert.equal(isValidLibyaIban('LY84002048000020100120361'), false, 'one wrong check digit');
  assert.equal(isValidLibyaIban('LY83002048000020100120316'), false, 'transposed digits');
  assert.equal(isValidLibyaIban('LY8300204800002010012036'), false, 'too short');
  assert.equal(isValidLibyaIban('TN5914207207100707012345'), false, 'other country');
  assert.equal(isValidLibyaIban(''), false);
});
test('IBAN display groups of four', () => {
  assert.equal(normalizeIban('ly83 0020-4800'), 'LY8300204800');
  assert.equal(formatIban(IBAN), 'LY83 0020 4800 0020 1001 2036 1');
});

const base = { account_holder: 'نزار الهواري' };

test('OnePay needs an account number; LYPay needs a valid IBAN; labels come from the catalogue', () => {
  assert.equal(PAYMENT_METHODS.onepay.latin, 'OnePay');
  assert.equal(PAYMENT_METHODS.lypay.latin, 'LYPay');
  assert.equal(methodMeta('nonsense').type, 'bank_transfer');

  assert.equal(parsePaymentAccount({ ...base, method_type: 'onepay' }, false).ok, false);
  const one: any = parsePaymentAccount({ ...base, method_type: 'onepay', account_number: '1020 3040 55' }, false);
  assert.equal(one.ok, true);
  assert.equal(one.value.bank_name, 'OnePay', 'name defaults to the service for OnePay/LYPay');
  assert.equal(one.value.account_number, '1020 3040 55');

  assert.equal(parsePaymentAccount({ ...base, method_type: 'lypay', account_number: '123' }, false).ok, false, 'IBAN is mandatory for LYPay');
  const ly: any = parsePaymentAccount({ ...base, method_type: 'lypay', iban: 'ly83 0020 4800 0020 1001 2036 1' }, false);
  assert.equal(ly.ok, true);
  assert.equal(ly.value.iban, IBAN, 'stored normalised');
  assert.equal(ly.value.account_number, null);
  assert.equal(parsePaymentAccount({ ...base, method_type: 'lypay', iban: 'LY00000000000000000000000' }, false).ok, false);
});

test('bank transfer needs a bank name and an identifier; holder is always required', () => {
  assert.equal(parsePaymentAccount({ ...base, method_type: 'bank_transfer', account_number: '1' }, false).ok, false, 'bank name missing');
  assert.equal(parsePaymentAccount({ ...base, method_type: 'bank_transfer', bank_name: 'مصرف الأمان' }, false).ok, false, 'no identifier');
  assert.equal(parsePaymentAccount({ ...base, method_type: 'bank_transfer', bank_name: 'مصرف الأمان', account_number: '102-1' }, false).ok, true);
  assert.equal(parsePaymentAccount({ method_type: 'onepay', account_number: '1' }, false).ok, false, 'holder missing');
  assert.equal(parsePaymentAccount({ ...base, method_type: 'weird', account_number: '1' }, false).ok, false);
});

test('logo urls are validated; sort order clamps; partial updates touch only sent keys', () => {
  assert.equal(parsePaymentAccount({ ...base, method_type: 'onepay', account_number: '1', logo_url: 'javascript:alert(1)' }, false).ok, false);
  const ok: any = parsePaymentAccount({ ...base, method_type: 'onepay', account_number: '1', logo_url: 'https://x.test/l.png', sort_order: 5000 }, false);
  assert.equal(ok.value.logo_url, 'https://x.test/l.png');
  assert.equal(ok.value.sort_order, 999);
  const partial: any = parsePaymentAccount({ is_active: false }, true);
  assert.deepEqual(Object.keys(partial.value), ['is_active']);
  const clear: any = parsePaymentAccount({ logo_url: '', instructions: '' }, true);
  assert.equal(clear.value.logo_url, null, 'an empty string clears the logo');
  assert.equal(parsePaymentAccount({ iban: 'LY99' }, true).ok, false, 'an edited IBAN is still validated');
});
