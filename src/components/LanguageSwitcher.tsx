import { useLanguage } from '../contexts/LanguageContext';

interface LanguageSwitcherProps {
  compact?: boolean;
}

export function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const { lang, setLang } = useLanguage();

  return (
    <div
      role="group"
      aria-label="Language switcher"
      className={`inline-flex items-center p-0.5 bg-[#F5F6F4] border border-[#E1E5E0] rounded-lg shrink-0 ${
        compact ? 'text-[11px]' : 'text-xs'
      }`}
    >
      <button
        type="button"
        onClick={() => setLang('ar')}
        className={`px-2 py-1 rounded-md font-medium whitespace-nowrap transition-colors cursor-pointer ${
          lang === 'ar'
            ? 'bg-white text-[#223629] border border-[#E1E5E0]'
            : 'text-[#6B786F] hover:text-[#162019] border border-transparent'
        }`}
      >
        العربية
      </button>
      <button
        type="button"
        onClick={() => setLang('en')}
        className={`px-2 py-1 rounded-md font-medium whitespace-nowrap transition-colors cursor-pointer ${
          lang === 'en'
            ? 'bg-white text-[#223629] border border-[#E1E5E0]'
            : 'text-[#6B786F] hover:text-[#162019] border border-transparent'
        }`}
      >
        EN
      </button>
    </div>
  );
}
