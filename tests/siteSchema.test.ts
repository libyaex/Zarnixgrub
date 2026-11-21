import test from 'node:test';
import assert from 'node:assert/strict';
import { SETTINGS_SCHEMA, defaultSettings, mergeSettings, validateSettingsUpdate, SETTING_KEYS } from '../src/shared/siteSchema.ts';

test('schema keys are unique and every default passes its own validation', () => {
  assert.equal(new Set(SETTING_KEYS).size, SETTING_KEYS.length);
  for (const field of SETTINGS_SCHEMA) {
    const r = validateSettingsUpdate({ [field.key]: field.default });
    assert.equal(r.ok, true, `${field.key}: ${r.errors.join(',')}`);
  }
});

test('unknown keys are rejected', () => {
  const r = validateSettingsUpdate({ evil_key: 'x', store_name: 'OK' });
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /evil_key/);
});

test('types and formats are enforced', () => {
  assert.equal(validateSettingsUpdate({ accent_color: 'red' }).ok, false);
  assert.equal(validateSettingsUpdate({ accent_color: '#AABBCC' }).values.accent_color, '#aabbcc');
  assert.equal(validateSettingsUpdate({ support_email: 'nope' }).ok, false);
  assert.equal(validateSettingsUpdate({ support_email: '' }).ok, true);
  assert.equal(validateSettingsUpdate({ default_download_limit: 0 }).ok, false);
  assert.equal(validateSettingsUpdate({ default_download_limit: '7' }).values.default_download_limit, 7);
  assert.equal(validateSettingsUpdate({ maintenance_mode: 'yes' }).ok, false);
  assert.equal(validateSettingsUpdate({ store_name: 'x'.repeat(81) }).ok, false);
});

test('javascript:/data: URLs and inline images are refused', () => {
  assert.equal(validateSettingsUpdate({ facebook_url: 'javascript:alert(1)' }).ok, false);
  assert.equal(validateSettingsUpdate({ facebook_url: 'https://facebook.com/x' }).ok, true);
  assert.equal(validateSettingsUpdate({ logo_url: 'data:image/png;base64,AAAA' }).ok, false);
  assert.equal(validateSettingsUpdate({ logo_url: '/logo.png' }).ok, true);
  assert.equal(validateSettingsUpdate({ seo_og_image: 'ftp://x/y.png' }).ok, false);
});

test('mergeSettings: stored values override defaults, bad stored values fall back', () => {
  const merged = mergeSettings({ store_name: 'My Shop', accent_color: 'not-a-color', default_download_limit: 9, junk: 1 });
  assert.equal(merged.store_name, 'My Shop');
  assert.equal(merged.accent_color, defaultSettings().accent_color);
  assert.equal(merged.default_download_limit, 9);
  assert.equal('junk' in merged, false);
});
