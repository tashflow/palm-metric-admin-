import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { FIRESTORE_RULES_TEXT } from './firestoreRulesText';
import { buildCartLineKey, getMilkExtraPrice, resolveItemModifiers } from './modifiers';
import {
  calculateCustomizationExtraPrice,
  createExtrasTemplateGroup,
  createMilkTemplateGroup,
  createSizeTemplateGroup,
  getInitialSelectionsForCustomization,
  normalizeCustomizationConfig,
  resolveSelectedCustomizationOptions,
  sanitizeFirestoreCustomization,
  validateCustomerSelection,
  validateProductCustomization,
} from './productCustomizations';
import { DEFAULT_COFFEE_OPTIONS, ProductCustomization, formatPrice } from '../types';

function makeSampleConfig(): ProductCustomization {
  return {
    productId: 'specialty-iced-spanish-latte',
    enabled: true,
    schemaVersion: 1,
    allowSpecialInstructions: true,
    updatedBy: 'jPgFPc8KbsXaPrdkyrbCQSFDMOP2',
    groups: [
      createMilkTemplateGroup(3, 1),
      createSizeTemplateGroup(2),
      createExtrasTemplateGroup(3),
    ],
  };
}

test('creates valid customization group with bilingual fields and additional prices', () => {
  const config = makeSampleConfig();
  const normalized = normalizeCustomizationConfig(config, 'jPgFPc8KbsXaPrdkyrbCQSFDMOP2');
  const validation = validateProductCustomization(normalized);
  assert.equal(validation.valid, true, JSON.stringify(validation.errors));
  assert.equal(normalized.groups.length, 3);
  assert.equal(normalized.groups[0].name, 'Milk Selection');
  assert.equal(normalized.groups[0].nameAr, 'اختيار الحليب');
  assert.equal(normalized.groups[0].options[1].additionalPrice, 3);
  assert.equal(normalized.groups[0].options[1].nameAr, 'حليب جوز الهند');
});

test('normalizes displayOrder sequentially and preserves round-trip persistence via Firestore sanitizer', () => {
  const config = makeSampleConfig();
  config.groups[0].displayOrder = 10;
  config.groups[1].displayOrder = 2;
  const normalized = normalizeCustomizationConfig(config, 'admin-uid-1');

  assert.deepEqual(
    normalized.groups.map((g) => [g.id, g.displayOrder]),
    [
      ['size', 1],
      ['extras', 2],
      ['milk', 3],
    ]
  );

  // Simulate Firestore read after write
  const roundTripped = sanitizeFirestoreCustomization(
    normalized.productId,
    normalized as unknown as Record<string, unknown>
  );
  assert.equal(roundTripped.productId, 'specialty-iced-spanish-latte');
  assert.equal(roundTripped.schemaVersion, 1);
  assert.equal(roundTripped.groups[0].id, 'size');
  assert.equal(roundTripped.groups[2].options[1].additionalPrice, 3);
});

test('rejects invalid prices, duplicate IDs, missing Arabic/English names, and inconsistent min/max constraints', () => {
  const config = makeSampleConfig();
  config.groups[0].options[1].additionalPrice = -5;
  config.groups[1].nameAr = '';
  config.groups[2].minSelections = 5;
  config.groups[2].maxSelections = 2;
  config.groups[2].options.push({ ...config.groups[2].options[0] });

  const validation = validateProductCustomization(config);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((e) => e.en.includes('Price')));
  assert.ok(validation.errors.some((e) => e.en.includes('Arabic name')));
  assert.ok(validation.errors.some((e) => e.en.includes('minimum selections cannot exceed maximum')));
  assert.ok(validation.errors.some((e) => e.en.includes('Duplicate option ID')));
});

test('rejects NaN, Infinity, -Infinity, and over-limit SAR prices', () => {
  for (const badPrice of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -0.01, 501]) {
    const config = makeSampleConfig();
    config.groups[0].options[1].additionalPrice = badPrice;
    const validation = validateProductCustomization(config);
    assert.equal(validation.valid, false, `Expected price ${badPrice} to fail validation`);
    assert.ok(validation.errors.some((e) => e.en.includes('Price')));
  }
});

test('enforces single-choice maxSelections = 1 and disabled option cannot be default', () => {
  const config = makeSampleConfig();
  config.groups[0].type = 'single';
  config.groups[0].maxSelections = 2;
  config.groups[0].options[0].enabled = false;
  config.groups[0].options[0].isDefault = true;

  const validation = validateProductCustomization(config);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((e) => e.en.includes('maximum selections set to 1')));
  assert.ok(validation.errors.some((e) => e.en.includes('Disabled option')));
});

test('computes default selections, disables disabled options, and calculates authoritative SAR price', () => {
  const config = makeSampleConfig();
  // Disable vanilla syrup even if selected in payload
  config.groups[2].options[1].enabled = false;

  const defaults = getInitialSelectionsForCustomization(config);
  assert.deepEqual(defaults.milk, ['full-cream']);
  assert.deepEqual(defaults.size, ['regular']);
  assert.deepEqual(defaults.extras, []);

  // Select coconut (+3), large (+4), and extras: espresso (+5) + disabled vanilla (+3 ignored)
  const customerSelection = {
    milk: ['coconut'],
    size: ['large'],
    extras: ['extra-espresso-shot', 'vanilla-syrup'],
  };

  const extraSar = calculateCustomizationExtraPrice(config, customerSelection);
  assert.equal(extraSar, 12);

  const resolvedOptions = resolveSelectedCustomizationOptions(config, customerSelection);
  assert.equal(resolvedOptions.length, 3);
  assert.equal(
    resolvedOptions.some((o) => o.optionId === 'vanilla-syrup'),
    false
  );
});

test('calculates Stage 04C SAR decimal prices accurately without floating-point drift', () => {
  const config = makeSampleConfig();
  // Set Vanilla Syrup additionalPrice to 2.50 SAR
  config.groups[2].options[1].additionalPrice = 2.5;
  const basePrice = 18.0;
  const selection = {
    milk: ['coconut'], // +3.00
    size: ['regular'], // +0.00
    extras: ['vanilla-syrup'], // +2.50
  };

  const extra = calculateCustomizationExtraPrice(config, selection);
  assert.equal(extra, 5.5);

  const unitTotal = Number((basePrice + extra).toFixed(2));
  assert.equal(unitTotal, 23.5);
  assert.equal(formatPrice(unitTotal), '23.50 ﷼');

  const qty2Total = Number((unitTotal * 2).toFixed(2));
  assert.equal(qty2Total, 47);
  assert.equal(formatPrice(qty2Total), '47 ﷼');
});

test('validates required, optional, min, and max customer selections accurately', () => {
  const config = makeSampleConfig();
  config.groups[2].required = true;
  config.groups[2].minSelections = 1;
  config.groups[2].maxSelections = 2;

  // Missing required milk + missing min extras
  const missingResult = validateCustomerSelection(config, {
    milk: [],
    size: ['regular'],
    extras: [],
  });
  assert.equal(missingResult.valid, false);
  assert.deepEqual(missingResult.missingGroupIds, ['milk', 'extras']);

  // Exceeding maxSelections on extras
  const overMaxResult = validateCustomerSelection(config, {
    milk: ['coconut'],
    size: ['regular'],
    extras: ['extra-espresso-shot', 'vanilla-syrup', 'caramel-drizzle'],
  });
  assert.equal(overMaxResult.valid, false);
  assert.deepEqual(overMaxResult.missingGroupIds, ['extras']);

  // Valid selection
  const okResult = validateCustomerSelection(config, {
    milk: ['coconut'],
    size: ['regular'],
    extras: ['extra-espresso-shot', 'caramel-drizzle'],
  });
  assert.equal(okResult.valid, true);
});

test('preserves legacy coffeeOptions and category modifier compatibility when productCustomizations is absent', () => {
  const resolved = resolveItemModifiers(
    { category: 'Espresso' },
    [],
    DEFAULT_COFFEE_OPTIONS
  );
  assert.equal(resolved.milkEnabled, true);
  assert.equal(resolved.temperatureEnabled, true);
  assert.equal(resolved.coconutMilkPrice, 3);
  assert.equal(getMilkExtraPrice('coconut', resolved.coconutMilkPrice), 3);
  assert.equal(getMilkExtraPrice('regular', resolved.coconutMilkPrice), 0);
  assert.notEqual(
    buildCartLineKey('espresso-flat-white', 'Hot', 'regular'),
    buildCartLineKey('espresso-flat-white', 'Hot', 'coconut')
  );
});

test('firestore.rules fixes sign_in_provider privilege escalation and secures productCustomizations', () => {
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const rulesText = fs.readFileSync(rulesPath, 'utf8');

  // Exact match between firestore.rules and FIRESTORE_RULES_TEXT helper
  assert.equal(rulesText.trim(), FIRESTORE_RULES_TEXT.trim());

  // Vulnerability removed
  assert.equal(
    rulesText.includes('request.auth.token.firebase.sign_in_provider is string'),
    false,
    'sign_in_provider is string must NOT grant admin privileges'
  );

  // Legitimate owner & verified allowlist preserved
  assert.ok(rulesText.includes("request.auth.uid == 'jPgFPc8KbsXaPrdkyrbCQSFDMOP2'"));
  assert.ok(rulesText.includes("'tashflow26@gmail.com', 'palmmetric1@gmail.com'"));
  assert.ok(rulesText.includes('request.auth.token.email_verified == true'));

  // Default deny preserved
  assert.ok(rulesText.includes('allow read, write: if false;'));

  // productCustomizations collection rules and validations present
  assert.ok(rulesText.includes('match /productCustomizations/{productId}'));
  assert.ok(rulesText.includes('isValidProductCustomization(incoming(), productId)'));
  assert.ok(rulesText.includes('existing().enabled == true'));
  assert.ok(rulesText.includes('resource.data.enabled == true'));
});

