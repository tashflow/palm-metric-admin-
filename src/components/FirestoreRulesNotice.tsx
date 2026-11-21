import { useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  FIREBASE_CONSOLE_RULES_URL,
  FIRESTORE_RULES_TEXT,
} from '../lib/firestoreRulesText';

interface FirestoreRulesNoticeProps {
  compact?: boolean;
}

export function FirestoreRulesNotice({ compact = false }: FirestoreRulesNoticeProps) {
  const { lang } = useLanguage();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(FIRESTORE_RULES_TEXT);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  return (
    <div className="p-3.5 rounded-xl bg-[#FFFBEB] border border-[#FCD34D] text-xs text-[#78350F] space-y-2.5">
      <div className="space-y-1">
        <p className="font-semibold text-[#92400E]">
          {lang === 'ar'
            ? 'يلزم تحديث قواعد Firestore في مشروع palm-metric-app'
            : 'Firestore Rules update required in palm-metric-app'}
        </p>
        {!compact && (
          <p className="leading-relaxed">
            {lang === 'ar'
              ? 'لحفظ الفئات المخصصة وإعدادات القهوة والحليب، انسخ قواعد الأمان المحدّثة والصقها ثم اضغط Publish في Firebase Console → Firestore Database → Rules.'
              : 'To save custom categories and coffee/milk settings, copy the updated rules, paste them into Firebase Console → Firestore Database → Rules, and click Publish.'}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#92400E] hover:bg-[#78350F] text-white font-medium cursor-pointer transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          <span>
            {copied
              ? lang === 'ar'
                ? 'تم نسخ القواعد'
                : 'Rules Copied'
              : lang === 'ar'
              ? 'نسخ قواعد Firestore'
              : 'Copy Firestore Rules'}
          </span>
        </button>

        <a
          href={FIREBASE_CONSOLE_RULES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#F59E0B] bg-white hover:bg-[#FEF3C7] text-[#92400E] font-medium transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>
            {lang === 'ar' ? 'فتح Firebase Rules' : 'Open Firebase Rules'}
          </span>
        </a>
      </div>
    </div>
  );
}
