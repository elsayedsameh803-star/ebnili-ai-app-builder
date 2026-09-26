import { useEffect, useState } from 'react';
import { Loader2, ShieldCheck, AlertCircle, Sparkles } from 'lucide-react';
import { GoogleIcon, GitHubIcon } from './AuthIcons';
import { fetchAuthProviders, fetchAuthCallbacks, getAuthErrorMessage, startOAuth } from '../lib/auth';
import type { AuthProviderId, AuthProviderInfo, Language } from '../types';

interface AuthGateProps {
  language: Language;
  errorCode?: string | null;
}

/**
 * Full-screen "sign in to continue" wall.
 *
 * Rendered by App whenever there is no session, so the studio (chat sidebar,
 * preview, code editor) never mounts for a guest. Hiding it with CSS instead
 * would still ship every data fetch and expose the workspace markup, so the
 * gate is a real branch in the render tree.
 */
export const AuthGate = ({ language, errorCode }: AuthGateProps) => {
  const [providers, setProviders] = useState<AuthProviderInfo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [callbacks, setCallbacks] = useState<{ google: string; github: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAuthProviders().then((list) => {
      if (cancelled) return;
      setProviders(list.filter((p) => p.configured));
      setIsLoading(false);
    });
    fetchAuthCallbacks().then((c) => {
      if (!cancelled) setCallbacks(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const isAr = language === 'ar';
  const t = {
    title: isAr ? 'سجّل الدخول للمتابعة' : 'Sign in to continue',
    subtitle: isAr
      ? 'استوديو بناء التطبيقات محمي — سجّل الدخول مرة واحدة فقط ثم اعمل مباشرة.'
      : 'The app-building studio is protected. One sign-in, then you can work freely.',
    badge: isAr ? 'منصة إبنيلي' : 'Ebnili Platform',
    google: isAr ? 'المتابعة باستخدام Google' : 'Continue with Google',
    github: isAr ? 'المتابعة باستخدام GitHub' : 'Continue with GitHub',
    checking: isAr ? 'جارٍ التحقق من طرق الدخول…' : 'Checking sign-in options…',
    notReady: isAr ? 'طرق الدخول غير مفعّلة بعد.' : 'Sign-in is not enabled yet.',
    notReadyHint: isAr
      ? 'أضف هذه المتغيّرات في Vercel ثم أعد النشر:'
      : 'Add these variables in Vercel, then redeploy:',
    privacy: isAr
      ? 'لا نحفظ كلمة مرورك ولا نشارك بياناتك مع أي جهة.'
      : 'Your password is never stored, and your data is never shared.',
    tip: isAr
      ? 'عند ظهور خطأ في redirect_uri، تأكد أن رابط الرجوع مسجّل حرفياً في إعدادات Google أو GitHub.'
      : 'If you hit a redirect_uri error, make sure the callback URL is registered exactly as shown in Google or GitHub settings.',
  };

  const COPY = { isAr, t, callbacks, errorCode };
  return <AuthGateView {...COPY} providers={providers} isLoading={isLoading} />;
};

type Copy = {
  isAr: boolean;
  t: Record<string, string>;
  callbacks: { google: string; github: string } | null;
  errorCode?: string | null;
};

/** Pure markup for the gate — split out to keep each piece readable. */
const AuthGateView = ({
  isAr,
  t,
  callbacks,
  errorCode,
  providers,
  isLoading,
}: Copy & {
  providers: AuthProviderInfo[];
  isLoading: boolean;
}) => (
  <div className="fixed inset-0 z-[200] overflow-y-auto bg-slate-950">
    {/* Ambient background glow */}
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute -top-40 -right-32 h-[28rem] w-[28rem] rounded-full bg-rose-500/15 blur-3xl" />
      <div className="absolute -bottom-40 -left-32 h-[28rem] w-[28rem] rounded-full bg-amber-500/10 blur-3xl" />
    </div>

    <div className="relative flex min-h-full items-center justify-center p-5">
      <div className="w-full max-w-[440px]">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-rose-500 via-pink-500 to-amber-400 flex items-center justify-center shadow-lg shadow-rose-500/25">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="mt-5 text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {t.title}
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-400 max-w-sm">{t.subtitle}</p>
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {t.badge}
          </span>
        </div>

        <div className="mt-7 rounded-2xl border border-slate-800 bg-slate-900/70 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-l from-rose-500 via-pink-500 to-amber-400" />

          <div className="p-6 sm:p-7">
            {errorCode && (
              <div className="mb-5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-3">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-rose-200 leading-relaxed">
                    {getAuthErrorMessage(errorCode, isAr ? 'ar' : 'en')}
                  </p>
                </div>

                {/* Show the exact strings to paste into the provider's console. */}
                {callbacks && (
                  <div className="mt-3 space-y-2 border-t border-rose-500/20 pt-3">
                    <p className="text-[10px] text-rose-300/80 leading-relaxed">
                      {isAr
                        ? 'أضف هذه الروابط كما هي في إعدادات المزوّد:'
                        : 'Add these URLs exactly as shown in your provider settings:'}
                    </p>
                    {(['google', 'github'] as const).map((p) => (
                      <div key={p} className="flex items-center gap-2">
                        <span className="w-12 shrink-0 text-[9px] font-bold uppercase text-rose-300/70">
                          {p}
                        </span>
                        <code
                          dir="ltr"
                          className="flex-1 select-all break-all rounded bg-slate-950/60 px-1.5 py-1 text-[9px] text-rose-200 font-mono"
                        >
                          {callbacks[p]}
                        </code>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">{t.checking}</span>
              </div>
            ) : providers.length > 0 ? (
              <div className="space-y-3">
                {providers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => startOAuth(p.id as AuthProviderId)}
                    className={`w-full flex items-center justify-center gap-3 rounded-xl px-4 py-3.5 text-sm font-bold transition cursor-pointer active:scale-[0.99] ${
                      p.id === 'google'
                        ? 'bg-white text-slate-900 hover:bg-slate-100 shadow-sm'
                        : 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700'
                    }`}
                  >
                    {p.id === 'google' ? (
                      <GoogleIcon className="w-5 h-5" />
                    ) : (
                      <GitHubIcon className="w-5 h-5" />
                    )}
                    <span>{p.id === 'google' ? t.google : t.github}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-center">
                <p className="text-[11px] text-amber-200 leading-relaxed">{t.notReady}</p>
                <p className="mt-1.5 text-[11px] text-amber-200/80 leading-relaxed">{t.notReadyHint}</p>
                <code className="mt-2.5 block text-[10px] text-amber-300/90 font-mono break-all" dir="ltr">
                  GOOGLE_CLIENT_ID · GOOGLE_CLIENT_SECRET
                  <br />
                  GITHUB_CLIENT_ID · GITHUB_CLIENT_SECRET
                </code>
              </div>
            )}

            {providers.length > 0 && (
              <p className="mt-5 flex items-start gap-2 text-[10px] leading-relaxed text-slate-500">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-500" />
                <span>{t.privacy}</span>
              </p>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-[10px] leading-relaxed text-slate-600">{t.tip}</p>
      </div>
    </div>
  </div>
);
