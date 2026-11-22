import {
  CustomizationGroup,
  CustomizationGroupType,
  CustomizationOption,
  MenuItem,
  ProductCustomization,
  SelectedCustomizationOption,
  VALIDATION_LIMITS,
} from '../types';

export interface CustomizationValidationError {
  groupId?: string;
  optionId?: string;
  en: string;
  ar: string;
}

const LIMITS = VALIDATION_LIMITS.productCustomization;

export function slugifyCustomizationId(
  input: string,
  fallbackPrefix = 'item'
): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  if (normalized && LIMITS.idPattern.test(normalized)) {
    return normalized;
  }
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${fallbackPrefix}-${suffix}`.slice(0, LIMITS.idMaxLength);
}

export function createMilkTemplateGroup(
  coconutExtraPrice = 3,
  displayOrder = 1
): CustomizationGroup {
  const safeExtra =
    Number.isFinite(coconutExtraPrice) && coconutExtraPrice >= 0
      ? Number(coconutExtraPrice.toFixed(2))
      : 3;
  return {
    id: 'milk',
    name: 'Milk Selection',
    nameAr: 'اختيار الحليب',
    type: 'single',
    required: true,
    minSelections: 1,
    maxSelections: 1,
    displayOrder,
    enabled: true,
    options: [
      {
        id: 'full-cream',
        name: 'Full Cream',
        nameAr: 'حليب كامل الدسم',
        additionalPrice: 0,
        enabled: true,
        isDefault: true,
        displayOrder: 1,
      },
      {
        id: 'coconut',
        name: 'Coconut Milk',
        nameAr: 'حليب جوز الهند',
        additionalPrice: safeExtra,
        enabled: true,
        isDefault: false,
        displayOrder: 2,
      },
    ],
  };
}

export function createTemperatureTemplateGroup(
  displayOrder = 1
): CustomizationGroup {
  return {
    id: 'temperature',
    name: 'Temperature',
    nameAr: 'درجة التقديم',
    type: 'single',
    required: true,
    minSelections: 1,
    maxSelections: 1,
    displayOrder,
    enabled: true,
    options: [
      {
        id: 'hot',
        name: 'Hot',
        nameAr: 'حار',
        additionalPrice: 0,
        enabled: true,
        isDefault: true,
        displayOrder: 1,
      },
      {
        id: 'cold',
        name: 'Cold',
        nameAr: 'بارد',
        additionalPrice: 0,
        enabled: true,
        isDefault: false,
        displayOrder: 2,
      },
    ],
  };
}

export function createSizeTemplateGroup(displayOrder = 1): CustomizationGroup {
  return {
    id: 'size',
    name: 'Cup Size',
    nameAr: 'حجم الكوب',
    type: 'single',
    required: true,
    minSelections: 1,
    maxSelections: 1,
    displayOrder,
    enabled: true,
    options: [
      {
        id: 'regular',
        name: 'Regular',
        nameAr: 'عادي',
        additionalPrice: 0,
        enabled: true,
        isDefault: true,
        displayOrder: 1,
      },
      {
        id: 'large',
        name: 'Large',
        nameAr: 'كبير',
        additionalPrice: 4,
        enabled: true,
        isDefault: false,
        displayOrder: 2,
      },
    ],
  };
}

export function createExtrasTemplateGroup(displayOrder = 1): CustomizationGroup {
  return {
    id: 'extras',
    name: 'Add-ons & Extras',
    nameAr: 'إضافات اختيارية',
    type: 'multiple',
    required: false,
    minSelections: 0,
    maxSelections: 3,
    displayOrder,
    enabled: true,
    options: [
      {
        id: 'extra-espresso-shot',
        name: 'Extra Espresso Shot',
        nameAr: 'جرعة إسبريسو إضافية',
        additionalPrice: 5,
        enabled: true,
        isDefault: false,
        displayOrder: 1,
      },
      {
        id: 'vanilla-syrup',
        name: 'Vanilla Syrup',
        nameAr: 'شراب الفانيلا',
        additionalPrice: 3,
        enabled: true,
        isDefault: false,
        displayOrder: 2,
      },
      {
        id: 'caramel-drizzle',
        name: 'Caramel Drizzle',
        nameAr: 'صوص الكراميل',
        additionalPrice: 3,
        enabled: true,
        isDefault: false,
        displayOrder: 3,
      },
    ],
  };
}

export function createEmptyCustomizationForProduct(
  productId: string,
  updatedBy = ''
): ProductCustomization {
  return {
    productId,
    enabled: false,
    schemaVersion: 1,
    allowSpecialInstructions: true,
    updatedBy,
    updatedAt: null,
    groups: [],
  };
}

export function createDefaultCustomizationForProduct(
  product: Pick<MenuItem, 'id' | 'category' | 'coconutMilkPrice'>,
  updatedBy: string
): ProductCustomization {
  const cat = product.category.trim().toLowerCase();
  const isCoffeeLike = ['v60', 'espresso', 'matcha', 'specialty', 'coffee'].includes(cat);
  return {
    productId: product.id,
    enabled: true,
    schemaVersion: 1,
    allowSpecialInstructions: true,
    updatedBy,
    updatedAt: null,
    groups: isCoffeeLike
      ? [createMilkTemplateGroup(product.coconutMilkPrice ?? 3, 1)]
      : [],
  };
}

export function normalizeCustomizationConfig(
  config: ProductCustomization,
  updatedByUid: string
): ProductCustomization {
  const sortedGroups = [...config.groups].sort(
    (a, b) => a.displayOrder - b.displayOrder
  );

  const normalizedGroups: CustomizationGroup[] = sortedGroups.map((group, gIdx) => {
    const sortedOptions = [...group.options].sort(
      (a, b) => a.displayOrder - b.displayOrder
    );

    const type = group.type === 'multiple' ? 'multiple' : 'single';
    const required = Boolean(group.required);
    const maxSelections =
      type === 'single'
        ? 1
        : Math.max(1, Math.min(LIMITS.maxOptionsPerGroup, Math.trunc(group.maxSelections || 1)));

    let minSelections = Math.max(
      0,
      Math.min(maxSelections, Math.trunc(group.minSelections || 0))
    );
    if (required && minSelections < 1) {
      minSelections = 1;
    }
    if (type === 'single' && !required) {
      minSelections = 0;
    }

    let defaultApplied = 0;
    const normalizedOptions: CustomizationOption[] = sortedOptions.map((opt, oIdx) => {
      const safePrice = Number.isFinite(opt.additionalPrice)
        ? Number(Math.max(0, opt.additionalPrice).toFixed(2))
        : 0;
      const enabled = Boolean(opt.enabled);
      let isDefault = Boolean(opt.isDefault) && enabled;
      if (isDefault) {
        if (defaultApplied >= maxSelections) {
          isDefault = false;
        } else {
          defaultApplied += 1;
        }
      }
      return {
        id: opt.id.trim(),
        name: opt.name.trim(),
        nameAr: opt.nameAr.trim(),
        additionalPrice: safePrice,
        enabled,
        isDefault,
        displayOrder: oIdx + 1,
      };
    });

    return {
      id: group.id.trim(),
      name: group.name.trim(),
      nameAr: group.nameAr.trim(),
      type,
      required,
      minSelections,
      maxSelections,
      displayOrder: gIdx + 1,
      enabled: Boolean(group.enabled),
      options: normalizedOptions,
    };
  });

  return {
    productId: config.productId.trim(),
    enabled: Boolean(config.enabled),
    schemaVersion: 1,
    allowSpecialInstructions: Boolean(config.allowSpecialInstructions),
    updatedBy: updatedByUid,
    groups: normalizedGroups,
  };
}

export function validateProductCustomization(
  config: ProductCustomization
): { valid: boolean; errors: CustomizationValidationError[] } {
  const errors: CustomizationValidationError[] = [];

  const pid = config.productId.trim();
  if (
    !pid ||
    pid.length > LIMITS.productIdMaxLength ||
    !LIMITS.idPattern.test(pid)
  ) {
    errors.push({
      en: 'Product ID must be 1–128 alphanumeric, underscore, or hyphen characters.',
      ar: 'معرّف المنتج يجب أن يكون بين 1 و128 حرفاً إنجليزياً أو رقماً أو شرطة.',
    });
  }

  if (config.schemaVersion !== 1) {
    errors.push({
      en: 'Unsupported customization schema version (expected 1).',
      ar: 'إصدار مخطط التخصيص غير مدعوم (المتوقع 1).',
    });
  }

  if (config.groups.length > LIMITS.maxGroups) {
    errors.push({
      en: `You can configure at most ${LIMITS.maxGroups} customization groups per product.`,
      ar: `الحد الأقصى لمجموعات التخصيص لكل منتج هو ${LIMITS.maxGroups} مجموعة.`,
    });
  }

  const seenGroupIds = new Set<string>();
  for (const group of config.groups) {
    const gid = group.id.trim();
    if (!gid || gid.length > LIMITS.idMaxLength || !LIMITS.idPattern.test(gid)) {
      errors.push({
        groupId: group.id,
        en: `Group "${group.name || gid || 'Untitled'}" needs a valid ID (letters, numbers, _ or -, max ${LIMITS.idMaxLength} chars).`,
        ar: `المجموعة "${group.nameAr || group.name || gid || 'بدون اسم'}" تحتاج معرّفاً صالحاً (أحرف إنجليزية وأرقام و _ أو -).`,
      });
    } else if (seenGroupIds.has(gid)) {
      errors.push({
        groupId: group.id,
        en: `Duplicate group ID "${gid}". Each group ID must be unique.`,
        ar: `معرّف المجموعة "${gid}" مكرر. يجب أن يكون كل معرّف فريداً.`,
      });
    }
    seenGroupIds.add(gid);

    const gName = group.name.trim();
    const gNameAr = group.nameAr.trim();
    if (!gName || gName.length > LIMITS.nameMaxLength) {
      errors.push({
        groupId: group.id,
        en: `Group "${gid || 'Untitled'}" requires an English name (1–${LIMITS.nameMaxLength} chars).`,
        ar: `المجموعة "${gid || 'بدون اسم'}" تتطلب اسماً بالإنجليزية (1–${LIMITS.nameMaxLength} حرفاً).`,
      });
    }
    if (!gNameAr || gNameAr.length > LIMITS.nameMaxLength) {
      errors.push({
        groupId: group.id,
        en: `Group "${gName || gid || 'Untitled'}" requires an Arabic name (1–${LIMITS.nameMaxLength} chars).`,
        ar: `المجموعة "${gName || gid || 'بدون اسم'}" تتطلب اسماً بالعربية (1–${LIMITS.nameMaxLength} حرفاً).`,
      });
    }

    if (group.type !== 'single' && group.type !== 'multiple') {
      errors.push({
        groupId: group.id,
        en: `Group "${gName || gid}" has an invalid selection type.`,
        ar: `نوع الاختيار في المجموعة "${gNameAr || gName}" غير صالح.`,
      });
    }

    if (
      !Number.isInteger(group.minSelections) ||
      group.minSelections < 0 ||
      !Number.isInteger(group.maxSelections) ||
      group.maxSelections < 1
    ) {
      errors.push({
        groupId: group.id,
        en: `Group "${gName || gid}" requires whole-number min (≥ 0) and max (≥ 1) selections.`,
        ar: `المجموعة "${gNameAr || gName}" تتطلب قيماً صحيحة للحد الأدنى (0 أو أكثر) والأقصى (1 أو أكثر).`,
      });
    } else if (group.minSelections > group.maxSelections) {
      errors.push({
        groupId: group.id,
        en: `In group "${gName || gid}", minimum selections cannot exceed maximum selections.`,
        ar: `في المجموعة "${gNameAr || gName}"، لا يمكن أن يتجاوز الحد الأدنى للاختيارات الحد الأقصى.`,
      });
    }

    if (group.type === 'single' && group.maxSelections !== 1) {
      errors.push({
        groupId: group.id,
        en: `Single-choice group "${gName || gid}" must have maximum selections set to 1.`,
        ar: `مجموعة الاختيار الفردي "${gNameAr || gName}" يجب أن يكون الحد الأقصى فيها 1.`,
      });
    }

    if (group.required && group.minSelections < 1) {
      errors.push({
        groupId: group.id,
        en: `Required group "${gName || gid}" must require at least 1 selection.`,
        ar: `المجموعة الإلزامية "${gNameAr || gName}" يجب أن تتطلب اختياراً واحداً على الأقل.`,
      });
    }

    if (group.options.length === 0) {
      errors.push({
        groupId: group.id,
        en: `Group "${gName || gid}" must include at least 1 option.`,
        ar: `المجموعة "${gNameAr || gName}" يجب أن تحتوي على خيار واحد على الأقل.`,
      });
    } else if (group.options.length > LIMITS.maxOptionsPerGroup) {
      errors.push({
        groupId: group.id,
        en: `Group "${gName || gid}" cannot exceed ${LIMITS.maxOptionsPerGroup} options.`,
        ar: `المجموعة "${gNameAr || gName}" لا يمكن أن تتجاوز ${LIMITS.maxOptionsPerGroup} خياراً.`,
      });
    }

    const enabledOptionsCount = group.options.filter((o) => o.enabled).length;
    if (group.enabled && group.required && enabledOptionsCount < Math.max(1, group.minSelections)) {
      errors.push({
        groupId: group.id,
        en: `Enabled required group "${gName || gid}" needs at least ${Math.max(1, group.minSelections)} enabled option(s).`,
        ar: `المجموعة الإلزامية النشطة "${gNameAr || gName}" تحتاج إلى ${Math.max(1, group.minSelections)} خياراً نشطاً على الأقل.`,
      });
    }

    const seenOptionIds = new Set<string>();
    let defaultCount = 0;

    for (const opt of group.options) {
      const oid = opt.id.trim();
      if (!oid || oid.length > LIMITS.idMaxLength || !LIMITS.idPattern.test(oid)) {
        errors.push({
          groupId: group.id,
          optionId: opt.id,
          en: `Option "${opt.name || oid || 'Untitled'}" in "${gName || gid}" needs a valid ID (letters, numbers, _ or -).`,
          ar: `الخيار "${opt.nameAr || opt.name || oid || 'بدون اسم'}" في "${gNameAr || gName}" يحتاج معرّفاً صالحاً.`,
        });
      } else if (seenOptionIds.has(oid)) {
        errors.push({
          groupId: group.id,
          optionId: opt.id,
          en: `Duplicate option ID "${oid}" in group "${gName || gid}".`,
          ar: `معرّف الخيار "${oid}" مكرر داخل المجموعة "${gNameAr || gName}".`,
        });
      }
      seenOptionIds.add(oid);

      const oName = opt.name.trim();
      const oNameAr = opt.nameAr.trim();
      if (!oName || oName.length > LIMITS.nameMaxLength) {
        errors.push({
          groupId: group.id,
          optionId: opt.id,
          en: `Option "${oid || 'Untitled'}" in "${gName || gid}" requires an English name (1–${LIMITS.nameMaxLength} chars).`,
          ar: `الخيار "${oid || 'بدون اسم'}" في "${gNameAr || gName}" يتطلب اسماً بالإنجليزية.`,
        });
      }
      if (!oNameAr || oNameAr.length > LIMITS.nameMaxLength) {
        errors.push({
          groupId: group.id,
          optionId: opt.id,
          en: `Option "${oName || oid}" in "${gName || gid}" requires an Arabic name (1–${LIMITS.nameMaxLength} chars).`,
          ar: `الخيار "${oName || oid}" في "${gNameAr || gName}" يتطلب اسماً بالعربية.`,
        });
      }

      if (
        !Number.isFinite(opt.additionalPrice) ||
        opt.additionalPrice < 0 ||
        opt.additionalPrice > LIMITS.maxAdditionalPrice
      ) {
        errors.push({
          groupId: group.id,
          optionId: opt.id,
          en: `Price for "${oName || oid}" must be between 0 and ${LIMITS.maxAdditionalPrice} SAR.`,
          ar: `السعر الإضافي للخيار "${oNameAr || oName}" يجب أن يكون بين 0 و ${LIMITS.maxAdditionalPrice} ﷼.`,
        });
      }

      if (opt.isDefault) {
        defaultCount += 1;
        if (!opt.enabled) {
          errors.push({
            groupId: group.id,
            optionId: opt.id,
            en: `Disabled option "${oName || oid}" cannot be marked as default.`,
            ar: `لا يمكن تعيين الخيار المعطّل "${oNameAr || oName}" كخيار افتراضي.`,
          });
        }
      }
    }

    if (defaultCount > group.maxSelections) {
      errors.push({
        groupId: group.id,
        en: `Group "${gName || gid}" has more default options (${defaultCount}) than max selections (${group.maxSelections}).`,
        ar: `المجموعة "${gNameAr || gName}" تحتوي على خيارات افتراضية (${defaultCount}) أكثر من الحد الأقصى (${group.maxSelections}).`,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

export function getInitialSelectionsForCustomization(
  config: ProductCustomization
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  const enabledGroups = [...config.groups]
    .filter((g) => g.enabled)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  for (const group of enabledGroups) {
    const enabledOptions = [...group.options]
      .filter((o) => o.enabled)
      .sort((a, b) => a.displayOrder - b.displayOrder);

    const defaults = enabledOptions
      .filter((o) => o.isDefault)
      .slice(0, group.type === 'single' ? 1 : Math.max(1, group.maxSelections))
      .map((o) => o.id);

    result[group.id] = defaults;
  }

  return result;
}

export function calculateCustomizationExtraPrice(
  config: ProductCustomization,
  selectedByGroup: Record<string, string[]>
): number {
  let extra = 0;
  for (const group of config.groups) {
    if (!group.enabled) continue;
    const chosenIds = new Set(selectedByGroup[group.id] || []);
    const allowedLimit =
      group.type === 'single' ? 1 : Math.max(1, group.maxSelections);
    let applied = 0;
    for (const opt of group.options) {
      if (!opt.enabled || !chosenIds.has(opt.id)) continue;
      if (applied >= allowedLimit) break;
      const price =
        Number.isFinite(opt.additionalPrice) && opt.additionalPrice > 0
          ? opt.additionalPrice
          : 0;
      extra += price;
      applied += 1;
    }
  }
  return Number(extra.toFixed(2));
}

export function resolveSelectedCustomizationOptions(
  config: ProductCustomization,
  selectedByGroup: Record<string, string[]>
): SelectedCustomizationOption[] {
  const list: SelectedCustomizationOption[] = [];
  const sortedGroups = [...config.groups]
    .filter((g) => g.enabled)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  for (const group of sortedGroups) {
    const chosenIds = new Set(selectedByGroup[group.id] || []);
    const allowedLimit =
      group.type === 'single' ? 1 : Math.max(1, group.maxSelections);
    let applied = 0;
    const sortedOptions = [...group.options]
      .filter((o) => o.enabled)
      .sort((a, b) => a.displayOrder - b.displayOrder);

    for (const opt of sortedOptions) {
      if (!chosenIds.has(opt.id)) continue;
      if (applied >= allowedLimit) break;
      list.push({
        groupId: group.id,
        groupName: group.name,
        groupNameAr: group.nameAr,
        optionId: opt.id,
        optionName: opt.name,
        optionNameAr: opt.nameAr,
        additionalPrice:
          Number.isFinite(opt.additionalPrice) && opt.additionalPrice > 0
            ? Number(opt.additionalPrice.toFixed(2))
            : 0,
      });
      applied += 1;
    }
  }
  return list;
}

export function validateCustomerSelection(
  config: ProductCustomization,
  selectedByGroup: Record<string, string[]>
): {
  valid: boolean;
  missingGroupIds: string[];
  errorMessages: { groupId: string; en: string; ar: string }[];
} {
  const missingGroupIds: string[] = [];
  const errorMessages: { groupId: string; en: string; ar: string }[] = [];

  if (!config.enabled) {
    return { valid: true, missingGroupIds, errorMessages };
  }

  const enabledGroups = [...config.groups]
    .filter((g) => g.enabled)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  for (const group of enabledGroups) {
    const validOptionIds = new Set(
      group.options.filter((o) => o.enabled).map((o) => o.id)
    );
    const chosenCount = (selectedByGroup[group.id] || []).filter((id) =>
      validOptionIds.has(id)
    ).length;

    const minRequired = group.required ? Math.max(1, group.minSelections) : group.minSelections;
    if (chosenCount < minRequired) {
      missingGroupIds.push(group.id);
      errorMessages.push({
        groupId: group.id,
        en:
          group.type === 'single'
            ? `Please select an option for "${group.name}".`
            : `Please select at least ${minRequired} option(s) for "${group.name}".`,
        ar:
          group.type === 'single'
            ? `يرجى اختيار أحد الخيارات في "${group.nameAr || group.name}".`
            : `يرجى اختيار ${minRequired} على الأقل في "${group.nameAr || group.name}".`,
      });
    } else if (chosenCount > group.maxSelections) {
      missingGroupIds.push(group.id);
      errorMessages.push({
        groupId: group.id,
        en: `You can select at most ${group.maxSelections} option(s) for "${group.name}".`,
        ar: `يمكنك اختيار ${group.maxSelections} بحد أقصى في "${group.nameAr || group.name}".`,
      });
    }
  }

  return {
    valid: missingGroupIds.length === 0,
    missingGroupIds,
    errorMessages,
  };
}

export function sanitizeFirestoreCustomization(
  docId: string,
  raw: Record<string, unknown>
): ProductCustomization {
  const rawGroups = Array.isArray(raw.groups) ? raw.groups : [];
  const groups: CustomizationGroup[] = rawGroups
    .filter((g): g is Record<string, unknown> => Boolean(g && typeof g === 'object'))
    .map((g, gIdx) => {
      const rawOptions = Array.isArray(g.options) ? g.options : [];
      const options: CustomizationOption[] = rawOptions
        .filter((o): o is Record<string, unknown> => Boolean(o && typeof o === 'object'))
        .map((o, oIdx) => ({
          id: typeof o.id === 'string' ? o.id : `opt-${oIdx + 1}`,
          name: typeof o.name === 'string' ? o.name : '',
          nameAr: typeof o.nameAr === 'string' ? o.nameAr : '',
          additionalPrice:
            typeof o.additionalPrice === 'number' && Number.isFinite(o.additionalPrice)
              ? o.additionalPrice
              : 0,
          enabled: typeof o.enabled === 'boolean' ? o.enabled : true,
          isDefault: typeof o.isDefault === 'boolean' ? o.isDefault : false,
          displayOrder:
            typeof o.displayOrder === 'number' && Number.isFinite(o.displayOrder)
              ? o.displayOrder
              : oIdx + 1,
        }))
        .sort((a, b) => a.displayOrder - b.displayOrder);

      const type: CustomizationGroupType = g.type === 'multiple' ? 'multiple' : 'single';
      const required = typeof g.required === 'boolean' ? g.required : false;
      const minSelections =
        typeof g.minSelections === 'number' && Number.isFinite(g.minSelections)
          ? g.minSelections
          : required
          ? 1
          : 0;
      const maxSelections =
        type === 'single'
          ? 1
          : typeof g.maxSelections === 'number' && Number.isFinite(g.maxSelections)
          ? Math.max(1, g.maxSelections)
          : Math.max(1, options.length || 1);

      return {
        id: typeof g.id === 'string' ? g.id : `group-${gIdx + 1}`,
        name: typeof g.name === 'string' ? g.name : '',
        nameAr: typeof g.nameAr === 'string' ? g.nameAr : '',
        type,
        required,
        minSelections,
        maxSelections,
        displayOrder:
          typeof g.displayOrder === 'number' && Number.isFinite(g.displayOrder)
            ? g.displayOrder
            : gIdx + 1,
        enabled: typeof g.enabled === 'boolean' ? g.enabled : true,
        options,
      };
    })
    .sort((a, b) => a.displayOrder - b.displayOrder);

  return {
    productId: typeof raw.productId === 'string' && raw.productId ? raw.productId : docId,
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
    schemaVersion:
      typeof raw.schemaVersion === 'number' && Number.isFinite(raw.schemaVersion)
        ? raw.schemaVersion
        : 1,
    allowSpecialInstructions:
      typeof raw.allowSpecialInstructions === 'boolean'
        ? raw.allowSpecialInstructions
        : true,
    updatedBy: typeof raw.updatedBy === 'string' ? raw.updatedBy : '',
    updatedAt: (raw.updatedAt as ProductCustomization['updatedAt']) ?? null,
    groups,
  };
}
