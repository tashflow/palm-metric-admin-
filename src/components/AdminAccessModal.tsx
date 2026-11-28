import { ShieldCheck, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { BOOTSTRAPPED_ADMIN_EMAILS } from '../lib/adminAllowlist';

interface AdminAccessModalProps {
  open: boolean;
  onClose: () => void;
}

export function AdminAccessModal({ open, onClose }: AdminAccessModalProps) {
  const { lang, t } = useLanguage();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#162019]/45 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-admins-title"
        className="bg-white border border-[#E1E5E0] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl"
      >
        <div className="px-6 py-4 border-b border-[#E1E5E0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#2C4435]" />
            <h2 id="manage-admins-title" className="font-display text-base font-semibold text-[#162019]">
              {t.manageAdmins}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6B786F] hover:bg-[#F5F6F4] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-xs text-[#4A584F] leading-relaxed">
            {lang === 'ar'
              ? 'صلاحيات الإدارة في بالم مترك محددة حصرياً عبر قائمة السماح البريدية ومفاتيح التوثيق المعتمدة لضمان الأمان الفائق وحماية العمليات.'
              : 'Palm Metric admin authorization is secured via hardcoded fail-closed allowlists and verified Google accounts.'}
          </p>

          <div className="p-4 rounded-xl bg-[#F5F6F4] border border-[#E1E5E0] space-y-2">
            <p className="text-xs font-semibold text-[#162019]">{t.primaryAdminLabel}</p>
            <div className="space-y-1">
              {BOOTSTRAPPED_ADMIN_EMAILS.map((email) => (
                <p key={email} className="text-xs font-mono font-medium text-[#2C4435]" dir="ltr">
                  {email}
                </p>
              ))}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#FEF3C7] border border-[#F59E0B] text-xs text-[#92400E] space-y-1">
            <p className="font-semibold">
              {lang === 'ar' ? 'أمان حظر التعديل المباشر' : 'Immutable Security Notice'}
            </p>
            <p className="leading-relaxed">
              {lang === 'ar'
                ? 'لأسباب أمنية ومنعاً لتلاعب العملاء، لا يُسمح بتعديل سجلات المدراء من واجهة المتصفح. يتم تعديل المدراء المعتمدين عبر تحديث إعدادات الأمان وقائمة السماح في كود التطبيق حصرياً.'
                : 'For security and anti-tamper compliance, client-side mutations to admin registry documents are disabled by Firestore security rules.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-[#2C4435] hover:bg-[#223629] text-white text-xs font-medium transition-colors cursor-pointer"
          >
            {t.dismiss}
          </button>
        </div>
      </div>
    </div>
  );
}
