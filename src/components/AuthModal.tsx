import { useEffect, useState } from 'react';
import { Loader2, LogIn, X, ShieldCheck, AlertCircle } from 'lucide-react';
import { GoogleIcon, GitHubIcon } from './AuthIcons';
import { fetchAuthProviders, getAuthErrorMessage, startOAuth } from '../lib/auth';
import type { AuthProviderId, AuthProviderInfo, Language } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  errorCode?: string | null;
}

const PROVIDER_META: Record<AuthProviderId, { labelAr: string; labelEn: string }> = {
  google: { labelAr: 'المتابعة باستخدام جوجل', labelEn: 'Continue with Google' },
  github: { labelAr: 'المتابعة باستخدام جيت هاب', labelEn: 'Continue with GitHub' },
};

export const AuthModal = ({ isOpen, onClose, language, errorCode }: AuthModalProps) => {
  const [providers, setProviders] = useState<AuthProviderInfo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setIsLoading(true);
    fetchAuthProviders().then((list) => {
      if (cancelled) return;
      setProviders(list.filter((p) => p.configured));
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={language === 'ar' ? 'تسجيل الدخول' : 'Sign in'}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[400px] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Gradient accent line */}
        <div className="h-1 w-full bg-gradient-to-l from-rose-500 via-pink-500 to-amber-400" />

        <div className="p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-rose-500 via-pink-500 to-amber-400 flex items-center justify-center shadow-md shadow-rose-500/20">
                <LogIn className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-white font-['Cairo',sans-serif]">
                  {language === 'ar' ? 'تسجيل الدخول' : 'Sign in'}
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {language === 'ar'
                    ? 'تابع إلى استوديو إبنيلي الخاص بك'
                    : 'Continue to your Ebnili studio'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition"
              title={language === 'ar' ? 'إغلاق' : 'Close'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {errorCode && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-rose-200 leading-relaxed">
                {getAuthErrorMessage(errorCode, language)}
              </p>
            </div>
          )}

          <div className="mt-6 space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">{language === 'ar' ? 'جارٍ التحميل…' : 'Loading…'}</span>
              </div>
            ) : providers.length > 0 ? (
              providers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => startOAuth(p.id)}
                  className={`w-full flex items-center justify-center gap-2.5 rounded-xl px-4 py-3 text-sm font-bold transition cursor-pointer ${
                    p.id === 'google'
                      ? 'bg-white text-slate-900 hover:bg-slate-100 shadow-sm'
                      : 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700'
                  }`}
                >
                  {p.id === 'google' ? <GoogleIcon /> : <GitHubIcon />}
                  <span>{language === 'ar' ? PROVIDER_META[p.id].labelAr : PROVIDER_META[p.id].labelEn}</span>
                </button>
              ))
            ) : (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-center">
                <p className="text-[11px] text-amber-200 leading-relaxed font-['Cairo',sans-serif]">
                  {language === 'ar'
                    ? 'لم يتم إعداد تسجيل الدخول بجوجل أو جيت هاب بعد. أضف المفاتيح التالية في إعدادات Vercel:'
                    : 'Google and GitHub sign-in are not configured yet. Add these keys in your Vercel settings:'}
                </p>
                <code className="mt-2 block text-[10px] text-amber-300/90 font-mono break-all" dir="ltr">
                  GOOGLE_CLIENT_ID · GOOGLE_CLIENT_SECRET
                  <br />
                  GITHUB_CLIENT_ID · GITHUB_CLIENT_SECRET
                </code>
              </div>
            )}
          </div>

          <div className="mt-5 flex items-start gap-2 text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-500" />
            <p className="text-[10px] leading-relaxed">
              {language === 'ar'
                ? 'نتحقق من الحساب فقط — لا نحفظ كلمة مرورك ولا نشارك بياناتك مع أي جهة.'
                : 'We only verify your account — your password is never stored or shared.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

