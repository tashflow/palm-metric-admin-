import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, CheckCircle2, Coffee, Eye, Sparkles } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ResolvedImage } from './ResolvedMedia';
import {
  calculateCustomizationExtraPrice,
  getInitialSelectionsForCustomization,
  resolveSelectedCustomizationOptions,
  validateCustomerSelection,
} from '../lib/productCustomizations';
import {
  CustomizationGroup,
  MenuItem,
  ProductCustomization,
  VALIDATION_LIMITS,
  formatPrice,
} from '../types';

interface CustomizationCustomerPreviewProps {
  product: MenuItem;
  config: ProductCustomization;
}

export function CustomizationCustomerPreview({
  product,
  config,
}: CustomizationCustomerPreviewProps) {
  const { lang, t, localizedItemName } = useLanguage();
  const [previewLang, setPreviewLang] = useState<'en' | 'ar'>(lang);
  const [selectedByGroup, setSelectedByGroup] = useState<Record<string, string[]>>(() =>
    getInitialSelectionsForCustomization(config)
  );
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [testResult, setTestResult] = useState<{
    type: 'success' | 'error';
    messages: string[];
  } | null>(null);

  // Keep defaults synced when switching products or toggling defaults/enabled flags
  const defaultsSignature = useMemo(
    () =>
      JSON.stringify({
        productId: config.productId,
        enabled: config.enabled,
        groups: config.groups.map((g) => ({
          id: g.id,
          type: g.type,
          enabled: g.enabled,
          max: g.maxSelections,
          opts: g.options.map((o) => ({
            id: o.id,
            enabled: o.enabled,
            isDefault: o.isDefault,
          })),
        })),
      }),
    [config]
  );

  useEffect(() => {
    setSelectedByGroup(getInitialSelectionsForCustomization(config));
    setTestResult(null);
  }, [defaultsSignature]);

  const enabledGroups = useMemo(
    () =>
      [...config.groups]
        .filter((g) => g.enabled)
        .sort((a, b) => a.displayOrder - b.displayOrder),
    [config.groups]
  );

  const extraPrice = useMemo(
    () => (config.enabled ? calculateCustomizationExtraPrice(config, selectedByGroup) : 0),
    [config, selectedByGroup]
  );

  const unitTotal = Number((product.price + extraPrice).toFixed(2));

  const resolvedSelections = useMemo(
    () => (config.enabled ? resolveSelectedCustomizationOptions(config, selectedByGroup) : []),
    [config, selectedByGroup]
  );

  const isPreviewRtl = previewLang === 'ar';
  const productDisplayName =
    previewLang === 'ar'
      ? product.nameAr?.trim() || localizedItemName(product)
      : product.name;

  const toggleOption = (group: CustomizationGroup, optionId: string) => {
    setTestResult(null);
    setSelectedByGroup((prev) => {
      const current = prev[group.id] || [];
      if (group.type === 'single') {
        const isAlreadySelected = current[0] === optionId;
        if (isAlreadySelected && !group.required && group.minSelections === 0) {
          return { ...prev, [group.id]: [] };
        }
        return { ...prev, [group.id]: [optionId] };
      }

      if (current.includes(optionId)) {
        return {
          ...prev,
          [group.id]: current.filter((id) => id !== optionId),
        };
      }

      if (current.length >= group.maxSelections) {
        return prev;
      }

      return {
        ...prev,
        [group.id]: [...current, optionId],
      };
    });
  };

  const handleRunValidationTest = () => {
    const check = validateCustomerSelection(config, selectedByGroup);
    if (check.valid) {
      setTestResult({
        type: 'success',
        messages: [
          previewLang === 'ar'
            ? `الاختيار صالح · الإجمالي ${formatPrice(unitTotal)}`
            : `${t.previewValidationPassed} (${formatPrice(unitTotal)})`,
        ],
      });
    } else {
      setTestResult({
        type: 'error',
        messages: check.errorMessages.map((m) => (previewLang === 'ar' ? m.ar : m.en)),
      });
    }
  };

  const formatConstraintText = (group: CustomizationGroup): string => {
    const parts: string[] = [];
    if (group.required) {
      parts.push(previewLang === 'ar' ? 'إلزامي' : 'Required');
    } else {
      parts.push(previewLang === 'ar' ? 'اختياري' : 'Optional');
    }

    if (group.type === 'single') {
      parts.push(previewLang === 'ar' ? 'اختر 1' : 'Select 1');
    } else if (group.minSelections > 0) {
      parts.push(
        previewLang === 'ar'
          ? `من ${group.minSelections} إلى ${group.maxSelections}`
          : `${group.minSelections}–${group.maxSelections} selections`
      );
    } else {
      parts.push(
        previewLang === 'ar'
          ? `حتى ${group.maxSelections}`
          : `Up to ${group.maxSelections}`
      );
    }
    return parts.join(' · ');
  };

  return (
    <aside className="bg-white border border-[#E1E5E0] rounded-xl overflow-hidden">
      {/* Preview Toolbar */}
      <div className="px-4 py-3 border-b border-[#E1E5E0] bg-[#F9FAF8] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Eye className="w-4 h-4 text-[#2C4435] shrink-0" />
          <h3 className="font-display text-sm font-semibold text-[#162019] truncate">
            {t.previewTitle}
          </h3>
        </div>
        <div
          className="inline-flex items-center p-0.5 rounded-lg border border-[#E1E5E0] bg-white shrink-0"
          aria-label={t.previewLanguageLabel}
        >
          <button
            type="button"
            onClick={() => setPreviewLang('en')}
            className={`px-2 py-0.5 rounded-md text-[11px] font-medium cursor-pointer transition-colors ${
              previewLang === 'en'
                ? 'bg-[#2C4435] text-white'
                : 'text-[#6B786F] hover:text-[#162019]'
            }`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setPreviewLang('ar')}
            className={`px-2 py-0.5 rounded-md text-[11px] font-medium cursor-pointer transition-colors ${
              previewLang === 'ar'
                ? 'bg-[#2C4435] text-white'
                : 'text-[#6B786F] hover:text-[#162019]'
            }`}
          >
            عربي
          </button>
        </div>
      </div>

      {/* Simulated Mobile Customer Sheet */}
      <div dir={isPreviewRtl ? 'rtl' : 'ltr'} className="p-4 space-y-4">
        {/* Product Header */}
        <div className="flex items-center gap-3 pb-3 border-b border-[#E1E5E0]">
          <div className="w-14 h-14 rounded-xl bg-[#E8EFEA] border border-[#E1E5E0] overflow-hidden shrink-0 flex items-center justify-center">
            {product.imageUrl ? (
              <ResolvedImage
                src={product.imageUrl}
                alt={productDisplayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <Coffee className="w-5 h-5 text-[#4A6B56]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-display text-sm font-semibold text-[#162019] truncate">
              {productDisplayName}
            </h4>
            <p className="text-xs text-[#6B786F] tabular-nums">
              {previewLang === 'ar' ? 'السعر الأساسي' : 'Base'}:{' '}
              <span className="font-mono font-medium text-[#2C4435]">
                {formatPrice(product.price)}
              </span>
            </p>
          </div>
        </div>

        {!config.enabled ? (
          <div className="p-4 rounded-xl bg-[#F5F6F4] border border-[#E1E5E0] text-center space-y-1">
            <p className="text-xs font-medium text-[#162019]">
              {previewLang === 'ar'
                ? 'التخصيص معطّل لهذا المنتج'
                : 'Customization disabled for this item'}
            </p>
            <p className="text-[11px] text-[#6B786F]">
              {previewLang === 'ar'
                ? 'سيُضاف المنتج مباشرة بالسعر الأساسي في تطبيق العملاء.'
                : 'Customers add this item directly at its base price.'}
            </p>
          </div>
        ) : enabledGroups.length === 0 ? (
          <div className="p-4 rounded-xl bg-[#F5F6F4] border border-dashed border-[#CBD4CD] text-center space-y-1">
            <p className="text-xs font-medium text-[#162019]">
              {previewLang === 'ar'
                ? 'لا توجد مجموعات نشطة حالياً'
                : 'No enabled groups to show'}
            </p>
            <p className="text-[11px] text-[#6B786F]">
              {previewLang === 'ar'
                ? 'أضف مجموعة أو فعّلها لتظهر في هذه المعاينة.'
                : 'Add or enable at least one group to preview choices.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {enabledGroups.map((group) => {
              const enabledOpts = [...group.options]
                .filter((o) => o.enabled)
                .sort((a, b) => a.displayOrder - b.displayOrder);
              const chosen = selectedByGroup[group.id] || [];
              const groupTitle =
                previewLang === 'ar' ? group.nameAr || group.name : group.name || group.nameAr;
              const isMaxReached =
                group.type === 'multiple' && chosen.length >= group.maxSelections;

              return (
                <div key={group.id} className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <h5 className="text-xs font-semibold text-[#162019]">{groupTitle}</h5>
                    <span
                      className={`text-[11px] ${
                        group.required ? 'text-[#2C4435] font-medium' : 'text-[#6B786F]'
                      }`}
                    >
                      {formatConstraintText(group)}
                    </span>
                  </div>

                  {enabledOpts.length === 0 ? (
                    <p className="text-[11px] text-[#991B1B]">
                      {previewLang === 'ar'
                        ? 'لا توجد خيارات نشطة في هذه المجموعة.'
                        : 'No enabled options in this group.'}
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {enabledOpts.map((opt) => {
                        const isSelected = chosen.includes(opt.id);
                        const disabledByLimit = !isSelected && isMaxReached;
                        const optLabel =
                          previewLang === 'ar'
                            ? opt.nameAr || opt.name
                            : opt.name || opt.nameAr;

                        return (
                          <button
                            key={opt.id}
                            type="button"
                            disabled={disabledByLimit}
                            onClick={() => toggleOption(group, opt.id)}
                            className={`w-full px-3 py-2 rounded-xl border text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                              isSelected
                                ? 'bg-[#E8EFEA] border-[#2C4435] text-[#162019]'
                                : 'bg-white border-[#E1E5E0] text-[#39463D] hover:border-[#BFCAC2]'
                            }`}
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <span
                                className={`w-4 h-4 shrink-0 border flex items-center justify-center ${
                                  group.type === 'single' ? 'rounded-full' : 'rounded'
                                } ${
                                  isSelected
                                    ? 'bg-[#2C4435] border-[#2C4435] text-white'
                                    : 'border-[#BFCAC2] bg-white'
                                }`}
                              >
                                {isSelected && <Check className="w-2.5 h-2.5" />}
                              </span>
                              <span className="font-medium truncate">{optLabel}</span>
                              {opt.isDefault && (
                                <span className="text-[10px] text-[#4A6B56]">
                                  · {previewLang === 'ar' ? 'افتراضي' : 'Default'}
                                </span>
                              )}
                            </span>

                            <span className="font-mono text-[11px] tabular-nums shrink-0 text-[#2C4435]">
                              {opt.additionalPrice > 0
                                ? `+${formatPrice(opt.additionalPrice)}`
                                : previewLang === 'ar'
                                ? 'مجاني'
                                : 'Free'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Special Instructions */}
        {config.enabled && config.allowSpecialInstructions && (
          <div className="space-y-1.5 pt-2 border-t border-[#E1E5E0]">
            <label
              htmlFor="preview-special-instructions"
              className="block text-xs font-medium text-[#39463D]"
            >
              {previewLang === 'ar' ? 'تعليمات خاصة' : 'Special Instructions'}
            </label>
            <textarea
              id="preview-special-instructions"
              rows={2}
              maxLength={VALIDATION_LIMITS.productCustomization.specialInstructionsMaxLength}
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder={
                previewLang === 'ar'
                  ? 'مثال: بدون سكر، ثلج قليل...'
                  : 'e.g. Light ice, extra hot...'
              }
              className="w-full px-3 py-2 rounded-xl border border-[#E1E5E0] bg-[#F9FAF8] text-xs text-[#162019] focus:outline-none focus:border-[#2C4435] resize-none"
            />
          </div>
        )}

        {/* Summary & Validation Check */}
        <div className="pt-3 border-t border-[#E1E5E0] space-y-3">
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-[#6B786F] tabular-nums">
              <span>{previewLang === 'ar' ? 'السعر الأساسي' : 'Base Price'}</span>
              <span className="font-mono">{formatPrice(product.price)}</span>
            </div>
            {config.enabled && (
              <div className="flex justify-between text-[#6B786F] tabular-nums">
                <span>{previewLang === 'ar' ? 'الإضافات' : 'Add-ons'}</span>
                <span className="font-mono">+{formatPrice(extraPrice)}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline pt-1 border-t border-[#E1E5E0]">
              <span className="font-medium text-[#162019]">
                {previewLang === 'ar' ? 'إجمالي الوحدة' : 'Unit Total'}
              </span>
              <span className="font-mono text-base font-semibold text-[#2C4435] tabular-nums">
                {formatPrice(unitTotal)}
              </span>
            </div>
          </div>

          {resolvedSelections.length > 0 && (
            <p className="text-[11px] text-[#6B786F] leading-relaxed">
              {resolvedSelections
                .map((sel) =>
                  previewLang === 'ar'
                    ? sel.optionNameAr || sel.optionName
                    : sel.optionName || sel.optionNameAr
                )
                .join(' · ')}
            </p>
          )}

          {testResult && (
            <div
              className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
                testResult.type === 'success'
                  ? 'bg-[#E8EFEA] border-[#B6C7BC] text-[#223629]'
                  : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
              }`}
            >
              {testResult.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                {testResult.messages.map((msg, idx) => (
                  <p key={idx}>{msg}</p>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleRunValidationTest}
            className="w-full py-2 px-3 rounded-xl bg-[#2C4435] hover:bg-[#223629] text-white text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              {previewLang === 'ar'
                ? 'اختبار التحقق والسعر'
                : t.testSelectionBtn}
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}
