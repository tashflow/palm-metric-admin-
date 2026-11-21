import { useState } from 'react';
import { Check, Coffee, Copy, ArrowRight, LogOut, ShieldAlert } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { BOOTSTRAPPED_ADMIN_EMAILS } from '../lib/firebase';
import loginCoffeeBarImg from '../assets/images/login_coffee_bar_1794541456987.jpg';
import { LanguageSwitcher } from './LanguageSwitcher';

export function LoginScreen() {
  const {
    user,
    resolvedEmail,
    isAdmin,
    denialReason,
    authDiagnostics,
    authError,
    signInWithGoogle,
    logout,
    clearAuthError,
  } = useAuth();
  const { t } = useLanguage();
  const [imageFailed, setImageFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);

  const handleSignIn = async () => {
    setSubmitting(true);
    try {
      await signInWithGoogle();
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyUid = async () => {
    if (!user?.uid) return;
    try {
      await navigator.clipboard.writeText(user.uid);
      setCopiedUid(true);
      window.setTimeout(() => setCopiedUid(false), 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  const unauthorizedSignedIn = Boolean(user && !isAdmin);

  return (
    <div className="min-h-screen bg-[#F5F6F4] flex flex-col justify-center p-4 sm:p-8">
      <div className="mx-auto w-full max-w-5xl bg-white border border-[#E1E5E0] rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-2 items-stretch">
        {/* Visual Editorial Panel */}
        <div className="relative min-h-[260px] lg:min-h-[600px] bg-[#E8EFEA] overflow-hidden">
          {!imageFailed ? (
            <img
              src={loginCoffeeBarImg}
              alt={`${t.brandName} specialty coffee and matcha counter`}
              referrerPolicy="no-referrer"
              onError={() => setImageFailed(true)}
              className="w-full h-full lg:h-full object-cover object-center"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-10 bg-gradient-to-br from-[#E8EFEA] to-[#D2DFD6] text-[#2C4435]">
              <Coffee className="w-10 h-10 mb-3 opacity-80" />
              <p className="font-display text-lg font-semibold">{t.brandName}</p>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#162019]/80 via-[#162019]/20 to-transparent" />
          <div className="absolute bottom-0 start-0 end-0 p-6 sm:p-8 text-white">
            <p className="text-xs font-medium tracking-wide text-[#DCE7DF] mb-2">
              {t.loginTagline}
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold leading-tight text-balance">
              {t.loginHeroHeadline}
            </h2>
          </div>
        </div>

        {/* Auth Interaction Panel */}
        <div className="p-8 sm:p-12 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 mb-12">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={`${import.meta.env.BASE_URL}assets/aistudio/IMG-20261021-WA0006_53f18f59.jpg`}
                  alt="Palm Metric logo"
                  className="w-8 h-8 rounded-lg object-cover border border-[#E1E5E0] shrink-0"
                />
                <span className="font-display text-xl font-bold tracking-tight text-[#162019] whitespace-nowrap">
                  {t.brandName}
                </span>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <span className="text-xs text-[#6B786F] hidden sm:inline">
                  {t.adminConsole}
                </span>
                <LanguageSwitcher compact />
              </div>
            </div>

            {unauthorizedSignedIn ? (
              <div className="space-y-5">
                <div className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] space-y-2.5">
                  <div className="flex items-center gap-2 font-medium text-sm">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>{t.adminAccessRequired}</span>
                  </div>
                  <p className="text-sm leading-relaxed text-[#7F1D1D]">
                    {resolvedEmail ? (
                      <>
                        <span className="font-mono font-medium" dir="ltr">
                          {resolvedEmail}
                        </span>{' '}
                      </>
                    ) : null}
                    {denialReason === 'unverified' ? t.unverifiedEmailDesc : t.adminAccessDesc}
                  </p>
                  <p className="text-xs leading-relaxed text-[#7F1D1D]/90">
                    {t.adminAccessHint}{' '}
                    <span className="font-mono font-semibold" dir="ltr">
                      {BOOTSTRAPPED_ADMIN_EMAILS.join(' · ')}
                    </span>
                  </p>
                  {authDiagnostics && (
                    <p dir="ltr" className="text-[11px] font-mono text-[#7F1D1D]/80 text-start">
                      provider: {authDiagnostics.providerIds.join(', ') || 'none'} · tokenEmail:{' '}
                      {String(authDiagnostics.tokenHasEmail)} · verified:{' '}
                      {String(authDiagnostics.tokenEmailVerified)}
                    </p>
                  )}
                  {user?.uid && (
                    <div className="pt-1 flex items-center justify-between gap-2 bg-white/80 border border-[#FECACA] rounded-lg px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-[11px] text-[#7F1D1D]/80">{t.signedInUidLabel}</p>
                        <p dir="ltr" className="text-xs font-mono text-[#7F1D1D] truncate text-start">
                          {user.uid}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyUid}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-[#FECACA] text-[11px] font-medium text-[#991B1B] hover:bg-[#FEF2F2] shrink-0 cursor-pointer"
                      >
                        {copiedUid ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>{t.copiedUid}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>{t.copyUid}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={logout}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#2C4435] text-white text-sm font-medium hover:bg-[#223629] transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>{t.signOutSwitch}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2.5">
                  <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[#162019] text-balance">
                    {t.loginTitle}
                  </h1>
                  <p className="text-sm sm:text-[15px] leading-relaxed text-[#4A584F]">
                    {t.loginSubtitle}
                  </p>
                </div>

                {authError && (
                  <div className="p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-sm text-[#991B1B] flex items-start justify-between gap-3">
                    <span>{authError}</span>
                    <button
                      type="button"
                      onClick={clearAuthError}
                      className="text-xs font-medium underline shrink-0 cursor-pointer"
                    >
                      {t.dismiss}
                    </button>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleSignIn}
                    className="w-full inline-flex items-center justify-between px-5 py-3.5 rounded-xl bg-[#2C4435] hover:bg-[#223629] disabled:opacity-60 text-white text-sm font-medium transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-3">
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81Z"
                        />
                      </svg>
                      <span>{submitting ? t.connectingGoogle : t.continueWithGoogle}</span>
                    </span>
                    <ArrowRight className="w-4 h-4 shrink-0 rtl:rotate-180" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="pt-8 mt-8 border-t border-[#E1E5E0] flex flex-wrap items-center justify-between gap-2 text-xs text-[#6B786F]">
            <span dir="ltr">{t.loginFooterLeft}</span>
            <span>{t.loginFooterRight}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
