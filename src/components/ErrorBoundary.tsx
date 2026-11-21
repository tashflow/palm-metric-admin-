import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

function ErrorFallback({ displayMessage }: { displayMessage: string }) {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen bg-[#F5F6F4] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-[#E1E5E0] rounded-2xl p-6 space-y-4">
        <div className="w-10 h-10 rounded-xl bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="space-y-1.5">
          <h1 className="font-display text-lg font-semibold text-[#162019]">
            {t.operationInterrupted}
          </h1>
          <p dir="ltr" className="text-sm text-[#4A584F] break-words leading-relaxed">
            {displayMessage}
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2C4435] hover:bg-[#223629] text-white text-xs font-medium transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{t.reloadConsole}</span>
        </button>
      </div>
    </div>
  );
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected application error occurred.',
    };
  }

  render() {
    if (this.state.hasError) {
      let displayMessage = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed && parsed.error) {
          displayMessage = `Firestore ${parsed.operationType || 'operation'} failed (${parsed.path || 'unknown path'}): ${parsed.error}`;
        }
      } catch {
        // Use raw message
      }

      return <ErrorFallback displayMessage={displayMessage} />;
    }

    return this.props.children;
  }
}
