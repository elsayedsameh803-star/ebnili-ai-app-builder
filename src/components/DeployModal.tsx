import { useState, useCallback, useEffect } from 'react';
import { Share2, X, Check, Copy, QrCode, Globe, Info, Terminal, Rocket, Loader2, AlertCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Language } from '../types';
import { useModalAccessibility } from './useModalAccessibility';
import { CommandTerminal } from './CommandTerminal';
import type { PublishState } from '../lib/projects';
import { DbUnavailableError, fetchPublishState, publishRemoteProject, unpublishRemoteProject } from '../lib/projects';

interface DeployModalProps {
  projectName: string;
  /** The project to publish. `null` means there is nothing to publish yet. */
  projectId: string | null;
  onClose: () => void;
  language: Language;
}

/**
 * Share & publish — now backed by the REAL publish API.
 *
 * The previous version invented a `/preview/<name-of-project>` link in the
 * browser, never called the server, and stamped a QR on it — so a visitor
 * copied a dead URL while the modal claimed the app was live.
 *
 * This version drives everything off the server: `fetchPublishState` reads the
 * stored slug (if any), `publishRemoteProject` freezes the draft and mints the
 * slug, and the link it shows is the one `GET /preview/:slug` actually serves.
 * Nothing is invented; a project that is not published says so.
 */
export const DeployModal = ({
  projectName,
  projectId,
  onClose,
  language,
}: DeployModalProps) => {
  const ar = language === 'ar';
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<'share' | 'deploy'>('share');
  const [state, setState] = useState<PublishState | null>(null);
  const [busy, setBusy] = useState<'reading' | 'publishing' | 'unpublishing' | null>('reading');
  const [error, setError] = useState<string | null>(null);
  const handleClose = useCallback(() => onClose(), [onClose]);
  const dialogRef = useModalAccessibility(true, handleClose);

  // Read the stored publish state on mount so the modal never claims a project
  // is live when it is not, and shows the real link when it is.
  useEffect(() => {
    let cancelled = false;
    if (!projectId) {
      setState(null);
      setBusy(null);
      return;
    }
    setBusy('reading');
    fetchPublishState(projectId)
      .then((s) => !cancelled && setState(s))
      .catch(() => !cancelled && setState(null))
      .finally(() => !cancelled && setBusy(null));
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const classifyPublishError = useCallback(
    (e: unknown): string => {
      const msg = e instanceof Error ? e.message : '';
      if (e instanceof DbUnavailableError) {
        // DbUnavailableError now carries the EXACT backend detail
        // (PostgREST error + dbStatus) — show it, don't mask it.
        return ar ? `تعذّر النشر — السبب: ${msg}` : `Publish failed — cause: ${msg}`;
      }
      if (msg === 'AUTH_REQUIRED') {
        return ar ? 'انتهت الجلسة — سجّل الدخول ثم أعد النشر.' : 'Signed out — sign in again to publish.';
      }
      if (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('404')) {
        return ar ? 'المشروع غير موجود، يرجى اختيار مشروع آخر.' : 'Project not found. Please select a different project.';
      }
      if (msg.toLowerCase().includes('nothing to publish') || msg.includes('لا يوجد محتوى')) {
        return ar ? 'لا يوجد محتوى للنشر في هذا المشروع بعد.' : 'Nothing to publish yet in this project.';
      }
      if (msg.toLowerCase().includes('rate') || msg.toLowerCase().includes('too many')) {
        return ar ? 'تجاوزت الحد المسموح، يرجى الانتظار ثم أعد المحاولة.' : 'Too many attempts. Wait a moment, then retry.';
      }
      if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('forbidden')) {
        return ar ? 'بيانات الاعتماد غير صالحة، تحقق من الإعدادات ثم أعد المحاولة.' : 'Invalid credentials. Check your setup and retry.';
      }
      if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('connection')) {
        return ar ? 'لا يمكن الوصول للخادم، تحقق من اتصالك بالإنترنت ثم أعد المحاولة.' : 'Cannot reach the server. Check your internet connection and retry.';
      }
      return ar ? `تعذّر النشر: ${msg}` : `Publish failed: ${msg}`;
    },
    [ar],
  );

  const handlePublish = useCallback(async () => {
    if (!projectId) return;
    setBusy('publishing');
    setError(null);
    try {
      setState(await publishRemoteProject(projectId));
    } catch (e) {
      setError(classifyPublishError(e));
    } finally {
      setBusy(null);
    }
  }, [projectId, classifyPublishError]);

  const handleUnpublish = useCallback(async () => {
    if (!projectId) return;
    setBusy('unpublishing');
    setError(null);
    try {
      setState(await unpublishRemoteProject(projectId));
    } catch (e) {
      setError(classifyPublishError(e));
    } finally {
      setBusy(null);
    }
  }, [projectId, classifyPublishError]);

  const isLive = state?.published === true && !!state.url;
  const publicUrl = state?.url ?? '';

  const handleCopy = () => {
    if (!publicUrl) return;
    navigator.clipboard?.writeText(publicUrl).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={language === 'ar' ? 'مشاركة التطبيق' : 'Share your app'}
        className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto shadow-2xl space-y-5 text-slate-100 animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">
                {language === 'ar' ? 'مشاركة التطبيق' : 'Share Your App'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {language === 'ar' ? 'شارك رابط المعاينة أو امسح الرمز لفتحه على هاتفك' : 'Share the preview link or scan the code to open it on your phone'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={language === 'ar' ? 'إغلاق' : 'Close'}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Two tabs: share now vs. deploy for good. */}
        <div className="flex gap-1 p-1 bg-slate-950/70 rounded-xl border border-slate-800">
          {([['share', language === 'ar' ? 'مشاركة' : 'Share'], ['deploy', language === 'ar' ? 'نشر ودفع' : 'Deploy & push']] as const).map(
            ([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-selected={tab === id}
                role="tab"
                className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition cursor-pointer ${
                  tab === id ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {id === 'deploy' && <Terminal className="w-3.5 h-3.5" aria-hidden="true" />}
                {label}
              </button>
            ),
          )}
        </div>

        {tab === 'deploy' ? (
          <CommandTerminal projectName={projectName} language={language} />
        ) : (
          <>
        {/* Status badge — driven by the SERVER's real publish state. */}
        <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${isLive ? 'bg-emerald-400' : 'bg-amber-400'}`}
            />
            <span className="text-xs font-semibold text-slate-300 truncate">
              {isLive
                ? language === 'ar'
                  ? 'الموقع منشور ونشط الآن — الرابط العام يعمل.'
                  : 'Published and live — the public link below is active.'
                : language === 'ar'
                  ? 'غير منشور بعد — اضغط «نشر الموقع» لجعله عاماً.'
                  : 'Not published yet — press “Publish site” to make it public.'}
            </span>
          </div>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-mono shrink-0 ${
              isLive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-300'
            }`}
          >
            {isLive ? (language === 'ar' ? 'منشور' : 'Live') : language === 'ar' ? 'مسودة' : 'Draft'}
          </span>
        </div>

        {/* Real publish / unpublish controls — one click, server-backed. */}
        <div className="flex items-center gap-2">
          {isLive ? (
            <>
              <button
                onClick={handlePublish}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer disabled:opacity-50"
              >
                {busy === 'publishing' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5" />}
                {language === 'ar' ? 'إعادة النشر بآخر التعديلات' : 'Re-publish latest'}
              </button>
              <button
                onClick={handleUnpublish}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-rose-300 text-xs font-bold transition cursor-pointer disabled:opacity-50 border border-rose-500/30"
              >
                {busy === 'unpublishing' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {language === 'ar' ? 'إلغاء النشر' : 'Unpublish'}
              </button>
            </>
          ) : (
            <button
              onClick={handlePublish}
              disabled={busy !== null || !projectId}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-400 to-violet-500 text-white text-xs font-black hover:brightness-110 transition cursor-pointer disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5" />}
              {language === 'ar' ? 'نشر الموقع الآن' : 'Publish site now'}
            </button>
          )}
        </div>

         {/* Publish error — a clear, user-friendly message, never swallowed. */}
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2.5 text-[11px] text-rose-200 leading-relaxed">
            <span className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" aria-hidden="true" />
              <span>{error}</span>
            </span>
          </div>
        )}


        {/* Preview link box — the REAL public URL (empty until published). */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300">
            {language === 'ar' ? 'الرابط العام:' : 'Public link:'}
          </label>
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl p-2">
            <Globe className="w-4 h-4 text-slate-500 ms-1 shrink-0" />
            <input
              type="text"
              readOnly
              value={publicUrl}
              placeholder={language === 'ar' ? 'لم يُنشر بعد' : 'Not published yet'}
              dir="ltr"
              className="bg-transparent text-xs text-white font-mono flex-1 outline-none truncate"
            />
            <button
              onClick={handleCopy}
              aria-label={language === 'ar' ? 'نسخ الرابط' : 'Copy link'}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition shrink-0 flex items-center gap-1 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  <span>{language === 'ar' ? 'تم النسخ' : 'Copied'}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>{language === 'ar' ? 'نسخ' : 'Copy'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Mobile QR — a REAL, scannable code for the link above. It only
            appears once the project is actually published, so a scan can never
            resolve to a dead or empty URL. */}
        {isLive && publicUrl && (
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="font-bold text-xs text-white flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-rose-400" />
                <span>{language === 'ar' ? 'افتح على هاتفك' : 'Open on your phone'}</span>
              </h4>
              <p className="text-[11px] text-slate-400">
                {language === 'ar' ? 'امسح الرمز بكاميرا الهاتف لفتح الموقع المنشور' : 'Scan with your phone camera to open the published site'}
              </p>
            </div>
            <div className="w-20 h-20 bg-white p-1.5 rounded-lg flex items-center justify-center shrink-0">
              <QRCodeSVG
                value={publicUrl}
                size={68}
                level="M"
                bgColor="#ffffff"
                fgColor="#020617"
                title={language === 'ar' ? 'رمز الاستجابة السريعة للموقع المنشور' : 'Published site QR code'}
              />
            </div>
          </div>
        )}

        {/* Honest note: the on-platform publish above is the real, one-click way
            live. The custom-domain feature is the only part still unavailable,
            and it is named as such rather than hidden. */}
        <div className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2.5 text-[11px] text-slate-300 leading-relaxed">
          <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            {language === 'ar'
              ? '«نشر الموقع» ينشئ رابطاً عاماً فعلياً يمكنك مشاركته. الدومين المخصص (Custom Domain) غير مفعّل حالياً.'
              : '“Publish site” creates a real public link you can share. A custom domain is not enabled yet.'}
          </span>
        </div>

        {/* Custom Domain Section — clearly marked as unavailable, not a link
            that goes nowhere. */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 gap-2">
          <span>{language === 'ar' ? 'دومين مخصص (Custom Domain)' : 'Custom domain'}</span>
          <span className="text-slate-500">
            {language === 'ar' ? 'غير متاح حالياً' : 'Not available yet'}
          </span>
        </div>
          </>
        )}
      </div>
    </div>
  );
};
