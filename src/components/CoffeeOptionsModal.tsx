import React, { useEffect, useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Check, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { FirestoreRulesNotice } from './FirestoreRulesNotice';
import { OperationType, db, handleFirestoreError } from '../lib/firebase';
import { CoffeeOptionsSettings, VALIDATION_LIMITS } from '../types';

interface CoffeeOptionsModalProps {
  open: boolean;
  onClose: () => void;
  coffeeOptions: CoffeeOptionsSettings;
  rulesUpdateRequired?: boolean;
}

export function CoffeeOptionsModal({
  open,
  onClose,
  coffeeOptions,
  rulesUpdateRequired = false,
}: CoffeeOptionsModalProps) {
  const { lang, t } = useLanguage();
  const [milkSelectionEnabled, setMilkSelectionEnabled] = useState(
    coffeeOptions.milkSelectionEnabled
  );
  const [coconutMilkExtraPrice, setCoconutMilkExtraPrice] = useState(
    String(coffeeOptions.coconutMilkExtraPrice)
  );
  const [hotColdSelectionEnabled, setHotColdSelectionEnabled] = useState(
    coffeeOptions.hotColdSelectionEnabled
  );
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [needsRulesPublish, setNeedsRulesPublish] = useState(rulesUpdateRequired);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setMilkSelectionEnabled(coffeeOptions.milkSelectionEnabled);
      setCoconutMilkExtraPrice(String(coffeeOptions.coconutMilkExtraPrice));
      setHotColdSelectionEnabled(coffeeOptions.hotColdSelectionEnabled);
      setSavedNotice(false);
      setNeedsRulesPublish(rulesUpdateRequired);
      setError(null);
    }
  }, [open, coffeeOptions, rulesUpdateRequired]);

  if (!open) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavedNotice(false);

    const parsedExtra = Number(coconutMilkExtraPrice);
    if (
      Number.isNaN(parsedExtra) ||
      parsedExtra < 0 ||
      parsedExtra > VALIDATION_LIMITS.menuItem.coconutMilkPriceMax
    ) {
      setError(
        lang === 'ar'
          ? `يجب أن تكون رسوم حليب جوز الهند بين 0 و ${VALIDATION_LIMITS.menuItem.coconutMilkPriceMax} ﷼.`
          : `Coconut milk extra charge must be between 0 and ${VALIDATION_LIMITS.menuItem.coconutMilkPriceMax} ﷼.`
      );
      return;
    }

    setSaving(true);
    const path = 'settings/coffeeOptions';
    try {
      await setDoc(doc(db, 'settings', 'coffeeOptions'), {
        milkSelectionEnabled,
        coconutMilkExtraPrice: Number(parsedExtra.toFixed(2)),
        hotColdSelectionEnabled,
        updatedAt: serverTimestamp(),
      });
      setNeedsRulesPublish(false);
      setSavedNotice(true);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const msg = err instanceof Error ? err.message : String(err);
      if (code === 'permission-denied' || msg.toLowerCase().includes('insufficient permissions')) {
        setNeedsRulesPublish(true);
        setError(
          lang === 'ar'
            ? 'تعذر الحفظ لأن قواعد Firestore في مشروع palm-metric-app لم يتم تحديثها بعد. انسخ القواعد أدناه وانشرها في Firebase Console ثم أعد المحاولة.'
            : 'Save blocked by current Firestore rules in palm-metric-app. Copy and publish the updated rules below in Firebase Console, then try again.'
        );
      } else {
        setError(
          err instanceof Error
            ? err.message
            : lang === 'ar'
            ? 'تعذر حفظ الإعدادات.'
            : 'Unable to save coffee options.'
        );
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.coffeeOptionsTitle}
      className="fixed inset-0 z-50 bg-[#162019]/40 backdrop-blur-[2px] flex items-center justify-center p-4"
    >
      <div className="bg-white border border-[#E1E5E0] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-[#E1E5E0] flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#162019]">
              {t.coffeeOptionsTitle}
            </h2>
            <p className="text-xs text-[#6B786F] mt-0.5">{t.coffeeOptionsDesc}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.dismiss}
            className="p-1.5 rounded-lg text-[#6B786F] hover:bg-[#F5F6F4] hover:text-[#162019] cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5">
          {needsRulesPublish && <FirestoreRulesNotice />}

          {error && (
            <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B]">
              {error}
            </div>
          )}

          {savedNotice && (
            <div className="p-3 rounded-xl bg-[#E8EFEA] border border-[#B6C7BC] text-xs text-[#223629] flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{t.optionsSavedSuccess}</span>
            </div>
          )}

          {/* Milk Option Toggle + Coconut Milk Surcharge */}
          <div className="p-4 rounded-xl border border-[#E1E5E0] bg-[#F9FAF8] space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-[#162019]">
                  {t.enableMilkSystemLabel}
                </p>
                <p className="text-xs text-[#6B786F]">{t.enableMilkSystemHint}</p>
              </div>
              <button
                type="button"
                aria-pressed={milkSelectionEnabled}
                onClick={() => setMilkSelectionEnabled((v) => !v)}
                className="shrink-0 cursor-pointer"
              >
                <span
                  className={`w-10 h-6 rounded-full p-0.5 transition-colors flex items-center ${
                    milkSelectionEnabled ? 'bg-[#2C4435]' : 'bg-[#C7CEC9]'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      milkSelectionEnabled
                        ? 'translate-x-4 rtl:-translate-x-4'
                        : 'translate-x-0'
                    }`}
                  />
                </span>
              </button>
            </div>

            <div className="pt-3 border-t border-[#E1E5E0] space-y-1.5">
              <label
                htmlFor="coconut-extra-price"
                className="block text-xs font-medium text-[#39463D]"
              >
                {t.coconutMilkChargeLabel}
              </label>
              <input
                id="coconut-extra-price"
                type="number"
                step="0.5"
                min="0"
                max={VALIDATION_LIMITS.menuItem.coconutMilkPriceMax}
                required
                value={coconutMilkExtraPrice}
                onChange={(e) => setCoconutMilkExtraPrice(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E1E5E0] bg-white text-sm font-mono tabular-nums text-[#162019] focus:outline-none focus:border-[#2C4435]"
              />
              <p className="text-xs text-[#6B786F]">{t.coconutMilkChargeHint}</p>
            </div>
          </div>

          {/* Hot / Cold Toggle */}
          <div className="p-4 rounded-xl border border-[#E1E5E0] bg-[#F9FAF8]">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-[#162019]">
                  {t.enableHotColdSystemLabel}
                </p>
                <p className="text-xs text-[#6B786F]">{t.enableHotColdSystemHint}</p>
              </div>
              <button
                type="button"
                aria-pressed={hotColdSelectionEnabled}
                onClick={() => setHotColdSelectionEnabled((v) => !v)}
                className="shrink-0 cursor-pointer"
              >
                <span
                  className={`w-10 h-6 rounded-full p-0.5 transition-colors flex items-center ${
                    hotColdSelectionEnabled ? 'bg-[#2C4435]' : 'bg-[#C7CEC9]'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      hotColdSelectionEnabled
                        ? 'translate-x-4 rtl:-translate-x-4'
                        : 'translate-x-0'
                    }`}
                  />
                </span>
              </button>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-[#E1E5E0]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#E1E5E0] text-xs font-medium text-[#4A584F] hover:bg-[#F5F6F4] cursor-pointer"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-[#2C4435] hover:bg-[#223629] disabled:opacity-60 text-white text-xs font-medium transition-colors cursor-pointer"
            >
              {saving ? t.saving : t.saveOptionsBtn}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
