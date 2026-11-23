import {
  CategoryItem,
  CoffeeOptionsSettings,
  DEFAULT_COFFEE_OPTIONS,
  MenuItem,
  OrderRequest,
  OrderRequestItemInput,
  PricingConfigSettings,
  PricingValidationIssue,
  ProductCustomization,
  SelectedCustomizationOption,
  VALIDATION_LIMITS,
  VerifiedOrderLineItem,
  VerifiedPricingBreakdown,
} from '../types';
import { getMilkExtraPrice, resolveItemModifiers } from './modifiers';

export const HALALAS_PER_SAR = 100;
export const AUTHORITATIVE_PRICING_VERSION = 2;
export const MAX_ORDER_AMOUNT_SAR = 100000;
export const MAX_ORDER_AMOUNT_HALALAS = MAX_ORDER_AMOUNT_SAR * HALALAS_PER_SAR;

export function sarToHalalasStrict(
  rawAmount: unknown,
  maxSar: number = MAX_ORDER_AMOUNT_SAR
): number | null {
  if (typeof rawAmount !== 'number' || !Number.isFinite(rawAmount) || rawAmount < 0) {
    return null;
  }
  const halalas = Math.round(rawAmount * HALALAS_PER_SAR);
  if (!Number.isSafeInteger(halalas) || halalas > maxSar * HALALAS_PER_SAR) {
    return null;
  }
  return halalas;
}

export function halalasToSar(halalas: number): number {
  if (!Number.isFinite(halalas)) return 0;
  return Math.round(halalas) / HALALAS_PER_SAR;
}

export function isMenuItemAvailableForOrder(item: MenuItem): boolean {
  if (item.outOfStock === true) return false;
  if (item.inStock === false) return false;
  if (item.isAvailable === false) return false;
  if (item.available === false) return false;
  return true;
}

export interface AuthoritativeCatalogContext {
  menuById: Map<string, MenuItem> | Record<string, MenuItem>;
  customizationsByProductId?:
    | Map<string, ProductCustomization>
    | Record<string, ProductCustomization>;
  categories?: CategoryItem[];
  coffeeOptions?: CoffeeOptionsSettings;
  pricingConfig?: PricingConfigSettings | null;
}

export interface AuthoritativeVerificationResult {
  ok: boolean;
  blockingIssues: PricingValidationIssue[];
  warnings: PricingValidationIssue[];
  verifiedItems: VerifiedOrderLineItem[];
  breakdown: VerifiedPricingBreakdown;
}

function getFromMapOrRecord<T>(
  source: Map<string, T> | Record<string, T> | undefined,
  key: string
): T | undefined {
  if (!source || !key) return undefined;
  if (source instanceof Map) return source.get(key);
  return Object.prototype.hasOwnProperty.call(source, key) ? source[key] : undefined;
}

function normalizeRequestedCustomizations(
  itemInput: OrderRequestItemInput
): { groupId: string; optionId: string }[] {
  const pairs: { groupId: string; optionId: string }[] = [];
  if (Array.isArray(itemInput.selectedCustomizations)) {
    for (const sel of itemInput.selectedCustomizations) {
      if (
        sel &&
        typeof sel.groupId === 'string' &&
        sel.groupId.trim() &&
        typeof sel.optionId === 'string' &&
        sel.optionId.trim()
      ) {
        pairs.push({
          groupId: sel.groupId.trim(),
          optionId: sel.optionId.trim(),
        });
      }
    }
  }
  if (
    pairs.length === 0 &&
    itemInput.selectedByGroup &&
    typeof itemInput.selectedByGroup === 'object'
  ) {
    for (const [groupId, optionIds] of Object.entries(itemInput.selectedByGroup)) {
      if (!groupId.trim() || !Array.isArray(optionIds)) continue;
      for (const optionId of optionIds) {
        if (typeof optionId === 'string' && optionId.trim()) {
          pairs.push({
            groupId: groupId.trim(),
            optionId: optionId.trim(),
          });
        }
      }
    }
  }
  return pairs;
}

function formatCustomSummary(
  selectedCustomizations?: SelectedCustomizationOption[]
): string {
  if (!selectedCustomizations || selectedCustomizations.length === 0) return '';
  return selectedCustomizations
    .map((c) => c.optionName || c.optionNameAr || c.optionId)
    .filter(Boolean)
    .join(', ');
}

export function verifyAndPriceOrderRequest(
  request: Pick<OrderRequest, 'items' | 'clientEstimatedTotal'>,
  catalog: AuthoritativeCatalogContext,
  verifiedAtIso = new Date().toISOString()
): AuthoritativeVerificationResult {
  const blockingIssues: PricingValidationIssue[] = [];
  const warnings: PricingValidationIssue[] = [];
  const verifiedItems: VerifiedOrderLineItem[] = [];

  const categories = catalog.categories ?? [];
  const coffeeOptions = catalog.coffeeOptions ?? DEFAULT_COFFEE_OPTIONS;
  const rawItems = Array.isArray(request.items) ? request.items : [];

  if (rawItems.length === 0) {
    blockingIssues.push({
      code: 'EMPTY_ITEMS',
      severity: 'error',
      en: 'Order request contains no requested products.',
      ar: 'لا يحتوي طلب العميل على أي أصناف.',
    });
  } else if (rawItems.length > VALIDATION_LIMITS.orderRequest.maxItems) {
    blockingIssues.push({
      code: 'TOO_MANY_ITEMS',
      severity: 'error',
      en: `Order request exceeds the maximum of ${VALIDATION_LIMITS.orderRequest.maxItems} line items.`,
      ar: `يتجاوز الطلب الحد الأقصى البالغ ${VALIDATION_LIMITS.orderRequest.maxItems} أصناف.`,
    });
  }

  let subtotalHalalas = 0;
  let clientSubmittedSumHalalas = 0;
  let hasAnyClientSubmittedLinePrice = false;
  const requestedStockByItemId = new Map<string, number>();

  for (const itemInput of rawItems.slice(0, VALIDATION_LIMITS.orderRequest.maxItems)) {
    const resolvedItemId = (itemInput.itemId || itemInput.productId || '').trim();
    const displayFallbackName = itemInput.name?.trim() || resolvedItemId || 'Unknown Item';

    if (!resolvedItemId) {
      blockingIssues.push({
        code: 'UNKNOWN_PRODUCT',
        severity: 'error',
        itemName: displayFallbackName,
        en: 'A requested item is missing its catalog product ID.',
        ar: 'أحد الأصناف المطلوبة يفتقد معرّف المنتج.',
      });
      continue;
    }

    if (
      !Number.isInteger(itemInput.quantity) ||
      itemInput.quantity < 1 ||
      itemInput.quantity > VALIDATION_LIMITS.orderRequest.maxQuantityPerItem
    ) {
      blockingIssues.push({
        code: 'INVALID_QUANTITY',
        severity: 'error',
        itemId: resolvedItemId,
        itemName: displayFallbackName,
        en: `Invalid quantity (${itemInput.quantity}) for "${displayFallbackName}". Must be 1–${VALIDATION_LIMITS.orderRequest.maxQuantityPerItem}.`,
        ar: `الكمية غير صالحة (${itemInput.quantity}) للصنف "${displayFallbackName}".`,
      });
      continue;
    }

    const menuDoc = getFromMapOrRecord(catalog.menuById, resolvedItemId);
    if (!menuDoc) {
      blockingIssues.push({
        code: 'UNKNOWN_PRODUCT',
        severity: 'error',
        itemId: resolvedItemId,
        itemName: displayFallbackName,
        en: `Product "${displayFallbackName}" (${resolvedItemId}) does not exist in Admin menu catalog.`,
        ar: `الصنف "${displayFallbackName}" غير موجود في قائمة الإدارة الحالية.`,
      });
      continue;
    }

    if (!isMenuItemAvailableForOrder(menuDoc)) {
      blockingIssues.push({
        code: 'OUT_OF_STOCK',
        severity: 'error',
        itemId: menuDoc.id,
        itemName: menuDoc.name,
        en: `Product "${menuDoc.name}" is currently marked out of stock or unavailable.`,
        ar: `الصنف "${menuDoc.nameAr || menuDoc.name}" غير متوفر حالياً في المخزون.`,
      });
    }

    const totalQtyForProduct =
      (requestedStockByItemId.get(menuDoc.id) ?? 0) + itemInput.quantity;
    requestedStockByItemId.set(menuDoc.id, totalQtyForProduct);

    if (
      typeof menuDoc.stockQuantity === 'number' &&
      Number.isFinite(menuDoc.stockQuantity) &&
      totalQtyForProduct > Math.max(0, Math.floor(menuDoc.stockQuantity))
    ) {
      blockingIssues.push({
        code: 'INSUFFICIENT_STOCK',
        severity: 'error',
        itemId: menuDoc.id,
        itemName: menuDoc.name,
        en: `Requested quantity (${totalQtyForProduct}) for "${menuDoc.name}" exceeds available stock (${Math.max(0, Math.floor(menuDoc.stockQuantity))}).`,
        ar: `الكمية المطلوبة (${totalQtyForProduct}) للصنف "${menuDoc.nameAr || menuDoc.name}" تتجاوز المخزون المتاح (${Math.max(0, Math.floor(menuDoc.stockQuantity))}).`,
      });
    }

    const basePriceHalalas = sarToHalalasStrict(
      menuDoc.price,
      VALIDATION_LIMITS.menuItem.priceMax
    );
    if (basePriceHalalas === null) {
      blockingIssues.push({
        code: 'INVALID_CATALOG_PRICE',
        severity: 'error',
        itemId: menuDoc.id,
        itemName: menuDoc.name,
        en: `Catalog base price for "${menuDoc.name}" is missing or invalid.`,
        ar: `السعر الأساسي للصنف "${menuDoc.nameAr || menuDoc.name}" غير صالح في الكتالوج.`,
      });
      continue;
    }

    const customConfig = getFromMapOrRecord(
      catalog.customizationsByProductId,
      menuDoc.id
    );
    const requestedCustomPairs = normalizeRequestedCustomizations(itemInput);
    const authoritativeCustomizations: SelectedCustomizationOption[] = [];
    let customizationHalalas = 0;

    if (customConfig && customConfig.enabled) {
      if (
        customConfig.allowSpecialInstructions === false &&
        itemInput.specialInstructions &&
        itemInput.specialInstructions.trim().length > 0
      ) {
        blockingIssues.push({
          code: 'SPECIAL_INSTRUCTIONS_DISABLED',
          severity: 'error',
          itemId: menuDoc.id,
          itemName: menuDoc.name,
          en: `Special instructions are disabled for "${menuDoc.name}".`,
          ar: `الملاحظات الخاصة غير مفعلة للصنف "${menuDoc.nameAr || menuDoc.name}".`,
        });
      }

      const groupById = new Map(customConfig.groups.map((g) => [g.id, g]));
      const chosenOptionIdsByGroup = new Map<string, Set<string>>();

      for (const pair of requestedCustomPairs) {
        const group = groupById.get(pair.groupId);
        if (!group || !group.enabled) {
          blockingIssues.push({
            code: 'INVALID_OR_DISABLED_GROUP',
            severity: 'error',
            itemId: menuDoc.id,
            itemName: menuDoc.name,
            en: `Customization group "${pair.groupId}" on "${menuDoc.name}" is invalid or disabled.`,
            ar: `مجموعة التخصيص "${pair.groupId}" للصنف "${menuDoc.nameAr || menuDoc.name}" غير صالحة أو معطلة.`,
          });
          continue;
        }
        const opt = group.options.find((o) => o.id === pair.optionId);
        if (!opt || !opt.enabled) {
          blockingIssues.push({
            code: 'INVALID_OR_DISABLED_OPTION',
            severity: 'error',
            itemId: menuDoc.id,
            itemName: menuDoc.name,
            en: `Customization option "${pair.optionId}" in "${group.name}" on "${menuDoc.name}" is invalid or disabled.`,
            ar: `الخيار "${pair.optionId}" في "${group.nameAr || group.name}" غير متاح أو معطل.`,
          });
          continue;
        }
        const chosenSet = chosenOptionIdsByGroup.get(group.id) ?? new Set<string>();
        chosenSet.add(opt.id);
        chosenOptionIdsByGroup.set(group.id, chosenSet);
      }

      const sortedEnabledGroups = [...customConfig.groups]
        .filter((g) => g.enabled)
        .sort((a, b) => a.displayOrder - b.displayOrder);

      for (const group of sortedEnabledGroups) {
        const enabledOptions = [...group.options]
          .filter((o) => o.enabled)
          .sort((a, b) => a.displayOrder - b.displayOrder);

        const minReq = group.required ? Math.max(1, group.minSelections) : group.minSelections;
        const maxAllowed = group.type === 'single' ? 1 : Math.max(1, group.maxSelections);

        if (group.required && enabledOptions.length < minReq) {
          blockingIssues.push({
            code: 'BROKEN_REQUIRED_GROUP',
            severity: 'error',
            itemId: menuDoc.id,
            itemName: menuDoc.name,
            en: `Required group "${group.name}" on "${menuDoc.name}" has insufficient enabled options.`,
            ar: `المجموعة الإلزامية "${group.nameAr || group.name}" لا تحتوي على خيارات مفعلة كافية.`,
          });
          continue;
        }

        const chosenSet = chosenOptionIdsByGroup.get(group.id) ?? new Set<string>();
        if (chosenSet.size < minReq) {
          blockingIssues.push({
            code: 'REQUIRED_GROUP_MISSING',
            severity: 'error',
            itemId: menuDoc.id,
            itemName: menuDoc.name,
            en: `"${menuDoc.name}" requires at least ${minReq} selection(s) in "${group.name}".`,
            ar: `الصنف "${menuDoc.nameAr || menuDoc.name}" يتطلب ${minReq} اختيار(ات) على الأقل في "${group.nameAr || group.name}".`,
          });
          continue;
        }

        if (chosenSet.size > maxAllowed) {
          blockingIssues.push({
            code: 'MAX_SELECTIONS_EXCEEDED',
            severity: 'error',
            itemId: menuDoc.id,
            itemName: menuDoc.name,
            en: `"${menuDoc.name}" allows at most ${maxAllowed} selection(s) in "${group.name}".`,
            ar: `الصنف "${menuDoc.nameAr || menuDoc.name}" يسمح بـ ${maxAllowed} اختيار(ات) كحد أقصى في "${group.nameAr || group.name}".`,
          });
          continue;
        }

        for (const opt of enabledOptions) {
          if (!chosenSet.has(opt.id)) continue;
          const optPriceHalalas = sarToHalalasStrict(
            opt.additionalPrice,
            VALIDATION_LIMITS.productCustomization.maxAdditionalPrice
          );
          if (optPriceHalalas === null) {
            blockingIssues.push({
              code: 'INVALID_CATALOG_PRICE',
              severity: 'error',
              itemId: menuDoc.id,
              itemName: menuDoc.name,
              en: `Customization option "${opt.name}" on "${menuDoc.name}" has invalid catalog price.`,
              ar: `سعر الخيار "${opt.nameAr || opt.name}" غير صالح.`,
            });
            continue;
          }
          customizationHalalas += optPriceHalalas;
          authoritativeCustomizations.push({
            groupId: group.id,
            groupName: group.name,
            groupNameAr: group.nameAr,
            optionId: opt.id,
            optionName: opt.name,
            optionNameAr: opt.nameAr,
            additionalPrice: halalasToSar(optPriceHalalas),
          });
        }
      }
    } else {
      // Customizations doc is absent or disabled: reject any injected custom options
      if (requestedCustomPairs.length > 0) {
        blockingIssues.push({
          code: 'CUSTOMIZATIONS_DISABLED',
          severity: 'error',
          itemId: menuDoc.id,
          itemName: menuDoc.name,
          en: `Product customizations are currently disabled for "${menuDoc.name}".`,
          ar: `التخصيصات الإضافية معطلة حالياً للصنف "${menuDoc.nameAr || menuDoc.name}".`,
        });
      }

      const resolvedMods = resolveItemModifiers(menuDoc, categories, coffeeOptions);
      if (itemInput.temperature && !resolvedMods.temperatureEnabled) {
        blockingIssues.push({
          code: 'INVALID_MODIFIER',
          severity: 'error',
          itemId: menuDoc.id,
          itemName: menuDoc.name,
          en: `Temperature selection is not enabled for "${menuDoc.name}".`,
          ar: `خيار درجة الحرارة غير مفعل للصنف "${menuDoc.nameAr || menuDoc.name}".`,
        });
      }
      if (
        itemInput.milkOption &&
        itemInput.milkOption !== 'none' &&
        !resolvedMods.milkEnabled
      ) {
        blockingIssues.push({
          code: 'INVALID_MODIFIER',
          severity: 'error',
          itemId: menuDoc.id,
          itemName: menuDoc.name,
          en: `Milk selection is not enabled for "${menuDoc.name}".`,
          ar: `خيار الحليب غير مفعل للصنف "${menuDoc.nameAr || menuDoc.name}".`,
        });
      } else if (resolvedMods.milkEnabled && itemInput.milkOption) {
        const milkExtraSar = getMilkExtraPrice(
          itemInput.milkOption,
          resolvedMods.coconutMilkPrice
        );
        const milkHalalas = sarToHalalasStrict(
          milkExtraSar,
          VALIDATION_LIMITS.menuItem.coconutMilkPriceMax
        );
        if (milkHalalas === null) {
          blockingIssues.push({
            code: 'INVALID_CATALOG_PRICE',
            severity: 'error',
            itemId: menuDoc.id,
            itemName: menuDoc.name,
            en: `Invalid coconut milk catalog charge for "${menuDoc.name}".`,
            ar: `رسوم حليب جوز الهند غير صالحة للصنف "${menuDoc.nameAr || menuDoc.name}".`,
          });
        } else {
          customizationHalalas += milkHalalas;
        }
      }
    }

    const unitPriceHalalas = basePriceHalalas + customizationHalalas;
    const lineTotalHalalas = unitPriceHalalas * itemInput.quantity;
    if (lineTotalHalalas > MAX_ORDER_AMOUNT_HALALAS) {
      blockingIssues.push({
        code: 'INVALID_CATALOG_PRICE',
        severity: 'error',
        itemId: menuDoc.id,
        itemName: menuDoc.name,
        en: `Line total for "${menuDoc.name}" exceeds maximum SAR order bound.`,
        ar: `إجمالي الصنف "${menuDoc.nameAr || menuDoc.name}" يتجاوز الحد الأقصى المسموح.`,
      });
      continue;
    }

    subtotalHalalas += lineTotalHalalas;

    const unitPriceSar = halalasToSar(unitPriceHalalas);
    const basePriceSar = halalasToSar(basePriceHalalas);
    const customizationTotalSar = halalasToSar(customizationHalalas);
    const lineTotalSar = halalasToSar(lineTotalHalalas);

    const submittedUnitRaw =
      typeof itemInput.submittedUnitPrice === 'number' &&
      Number.isFinite(itemInput.submittedUnitPrice)
        ? itemInput.submittedUnitPrice
        : typeof itemInput.price === 'number' && Number.isFinite(itemInput.price)
        ? itemInput.price
        : undefined;

    let priceAdjustedFromSubmitted = false;
    if (submittedUnitRaw !== undefined) {
      hasAnyClientSubmittedLinePrice = true;
      const submittedUnitHalalas = Math.round(submittedUnitRaw * HALALAS_PER_SAR);
      clientSubmittedSumHalalas += submittedUnitHalalas * itemInput.quantity;
      if (submittedUnitHalalas !== unitPriceHalalas) {
        priceAdjustedFromSubmitted = true;
      }
    }

    const trimmedSpecialInstructions = itemInput.specialInstructions
      ? itemInput.specialInstructions
          .trim()
          .slice(0, VALIDATION_LIMITS.productCustomization.specialInstructionsMaxLength)
      : undefined;

    // Derive legacy milk fields safely from authoritative customizations if present
    let milkOption = itemInput.milkOption;
    let milkExtraPrice: number | undefined =
      !customConfig?.enabled && milkOption === 'coconut' && customizationTotalSar > 0
        ? customizationTotalSar
        : undefined;

    if (authoritativeCustomizations.length > 0) {
      const milkSel = authoritativeCustomizations.find(
        (c) =>
          c.groupId === 'milk' ||
          /milk|حليب/i.test(`${c.groupId} ${c.groupName} ${c.optionName}`)
      );
      if (milkSel) {
        if (
          milkSel.optionId === 'coconut' ||
          /coconut|جوز\s*الهند/i.test(`${milkSel.optionName} ${milkSel.optionNameAr || ''}`)
        ) {
          milkOption = 'coconut';
          milkExtraPrice = milkSel.additionalPrice;
        } else if (
          milkSel.optionId === 'full-cream' ||
          milkSel.optionId === 'regular' ||
          /regular|full\s*cream|عادي|كامل/i.test(
            `${milkSel.optionName} ${milkSel.optionNameAr || ''}`
          )
        ) {
          milkOption = 'regular';
          milkExtraPrice = milkSel.additionalPrice;
        }
      }
    }

    const customSummary = formatCustomSummary(authoritativeCustomizations);
    const mergedNote = [itemInput.temperature, customSummary, trimmedSpecialInstructions]
      .filter(Boolean)
      .join(' · ')
      .slice(0, 240);

    const rawImage = typeof menuDoc.imageUrl === 'string' ? menuDoc.imageUrl.trim() : '';
    const safeImageUrl = rawImage.startsWith('data:') ? '' : rawImage.slice(0, 512);

    verifiedItems.push({
      itemId: menuDoc.id,
      name: menuDoc.name,
      ...(menuDoc.nameAr ? { nameAr: menuDoc.nameAr } : {}),
      price: unitPriceSar,
      basePrice: basePriceSar,
      customizationTotal: customizationTotalSar,
      lineTotal: lineTotalSar,
      quantity: itemInput.quantity,
      inStockVerified: isMenuItemAvailableForOrder(menuDoc),
      ...(milkOption ? { milkOption } : {}),
      ...(milkExtraPrice !== undefined ? { milkExtraPrice } : {}),
      ...(itemInput.temperature ? { temperature: itemInput.temperature } : {}),
      ...(authoritativeCustomizations.length > 0
        ? { selectedCustomizations: authoritativeCustomizations }
        : {}),
      ...(trimmedSpecialInstructions
        ? { specialInstructions: trimmedSpecialInstructions }
        : {}),
      ...(mergedNote ? { note: mergedNote } : {}),
      ...(safeImageUrl ? { imageUrl: safeImageUrl } : {}),
      ...(submittedUnitRaw !== undefined ? { submittedUnitPrice: submittedUnitRaw } : {}),
      ...(priceAdjustedFromSubmitted ? { priceAdjustedFromSubmitted: true } : {}),
    });
  }

  // Optional configured discount (never invented)
  let discountHalalas = 0;
  let appliedDiscountLabel: string | undefined;
  const cfg = catalog.pricingConfig;
  if (
    cfg?.discountEnabled === true &&
    typeof cfg.discountValue === 'number' &&
    Number.isFinite(cfg.discountValue) &&
    cfg.discountValue > 0 &&
    subtotalHalalas > 0
  ) {
    if (cfg.discountType === 'percent') {
      const pct = Math.min(100, Math.max(0, cfg.discountValue));
      discountHalalas = Math.round((subtotalHalalas * pct) / 100);
      appliedDiscountLabel = cfg.discountLabel || `${pct}%`;
    } else {
      const fixedHalalas = sarToHalalasStrict(cfg.discountValue);
      if (fixedHalalas !== null) {
        discountHalalas = Math.min(subtotalHalalas, fixedHalalas);
        appliedDiscountLabel = cfg.discountLabel || `${halalasToSar(discountHalalas)} SAR`;
      }
    }
  }

  const taxableBaseHalalas = Math.max(0, subtotalHalalas - discountHalalas);

  // Optional configured tax (never invented; default 0 unless explicitly configured)
  let taxHalalas = 0;
  let appliedTaxRatePercent: number | undefined;
  if (
    cfg?.taxEnabled === true &&
    typeof cfg.taxRatePercent === 'number' &&
    Number.isFinite(cfg.taxRatePercent) &&
    cfg.taxRatePercent > 0 &&
    cfg.taxRatePercent <= 100
  ) {
    taxHalalas = Math.round((taxableBaseHalalas * cfg.taxRatePercent) / 100);
    appliedTaxRatePercent = cfg.taxRatePercent;
  }

  const totalHalalas = Math.min(
    MAX_ORDER_AMOUNT_HALALAS,
    Math.max(0, taxableBaseHalalas + taxHalalas)
  );

  const clientSubmittedTotalSar =
    typeof request.clientEstimatedTotal === 'number' &&
    Number.isFinite(request.clientEstimatedTotal)
      ? Number(request.clientEstimatedTotal.toFixed(2))
      : hasAnyClientSubmittedLinePrice
      ? halalasToSar(clientSubmittedSumHalalas)
      : undefined;

  const clientSubmittedHalalas =
    clientSubmittedTotalSar !== undefined
      ? Math.round(clientSubmittedTotalSar * HALALAS_PER_SAR)
      : undefined;

  const clientPriceMismatch =
    clientSubmittedHalalas !== undefined && clientSubmittedHalalas !== totalHalalas;

  if (clientPriceMismatch) {
    warnings.push({
      code: 'CLIENT_PRICE_MISMATCH',
      severity: 'warning',
      en: `Client-submitted estimate (${halalasToSar(clientSubmittedHalalas!)} SAR) differs from Admin catalog total (${halalasToSar(totalHalalas)} SAR). Official order will strictly use Admin prices.`,
      ar: `الإجمالي المرسل من العميل (${halalasToSar(clientSubmittedHalalas!)} ﷼) يختلف عن السعر المعتمد في الإدارة (${halalasToSar(totalHalalas)} ﷼). سيتم اعتماد أسعار الإدارة فقط.`,
    });
  }

  return {
    ok: blockingIssues.length === 0 && verifiedItems.length > 0,
    blockingIssues,
    warnings,
    verifiedItems,
    breakdown: {
      currency: 'SAR',
      pricingVersion: AUTHORITATIVE_PRICING_VERSION,
      subtotalHalalas,
      discountHalalas,
      taxHalalas,
      totalHalalas,
      subtotalSar: halalasToSar(subtotalHalalas),
      discountSar: halalasToSar(discountHalalas),
      taxSar: halalasToSar(taxHalalas),
      totalSar: halalasToSar(totalHalalas),
      ...(appliedDiscountLabel ? { appliedDiscountLabel } : {}),
      ...(appliedTaxRatePercent !== undefined ? { appliedTaxRatePercent } : {}),
      ...(clientSubmittedTotalSar !== undefined ? { clientSubmittedTotalSar } : {}),
      clientPriceMismatch,
      verifiedAtIso,
    },
  };
}
