import { useCallback, useEffect, useState } from 'react';
import { Rocket, Check, Copy, ExternalLink, Loader2, AlertCircle, Globe } from 'lucide-react';
import type { Language } from '../types';
import type { PublishState } from '../lib/projects';
import { DbUnavailableError, fetchPublishState, publishRemoteProject } from '../lib/projects';

interface PublishButtonProps {
  /** The project to publish. `null` (starter screen) renders nothing. */
  projectId: string | null;
  language: Language;
  className?: string;
}

/**
 * PUBLISH — the real, one-click "make it live" button.
 *
 * WHY THIS REPLACED THE OLD SHARE FLOW: the previous UI only ever showed an
 * invented `/preview/<name>` link built in the browser from the project's NAME,
 * never calling the publish API — so a visitor copied a dead URL and the server
 * never learned the project was "live". The DeployModal even admitted it out
 * loud ("النشر على نطاق عام غير متاح بعد").
 *
 * THE REAL PATH: this button calls `POST /api/projects/:id/publish`, which
 * freezes the draft into `published_html`, mints a unique slug and flips
 * `published` to true. The link it then shows is the one the server will
 * actually serve at `GET /preview/:slug`. Nothing here is invented: the URL
 * comes back from the database, and on load the button re-reads the stored
 * state so it never claims a project is live when it is not.
 */
export const PublishButton = ({ projectId, language, className = '' }: PublishButtonProps) => {
  const ar = language === 'ar';
  const [state, setState] = useState<PublishState | null>(null);
  const [busy, setBusy] = useState<'reading' | 'publishing' | null>('reading');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Read the stored publish state whenever the project changes, so a project
  // that is already live shows its link immediately — and one that is not never
  // pretends to be. A failure here is not fatal: it just leaves the button in
  // its "not published yet" state rather than inventing a link.
  useEffect(() => {
    let cancelled = false;
    if (!projectId) {
      setState(null);
      setBusy(null);
      return;
    }
    setBusy('reading');
    setError(null);
    fetchPublishState(projectId)
      .then((s) => {
        if (!cancelled) setState(s);
      })
      .catch(() => {
        if (!cancelled) setState(null);
      })
      .finally(() => {
        if (!cancelled) setBusy(null);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const handlePublish = useCallback(async () => {
    if (!projectId) return;
    setBusy('publishing');
    setError(null);
    try {
      const s = await publishRemoteProject(projectId);
      setState(s);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      // Classify the error for a clear, user-facing message.
      let detail = '';
      if (e instanceof DbUnavailableError) {
        detail = ar ? 'قاعدة البيانات غير متوفرة لحظياً — حاول مرة أخرى في لحظة.' : 'Database unavailable for a moment — please try again shortly.';
      } else if (msg === 'AUTH_REQUIRED') {
        detail = ar ? 'انتهت الجلسة — سجّل الدخول ثم أعد النشر.' : 'Signed out — sign in again to publish.';
      } else if (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('404')) {
        detail = ar ? 'المشروع غير موجود، يرجى اختيار مشروع آخر.' : 'Project not found. Please select a different project.';
      } else if (msg.toLowerCase().includes('nothing to publish') || msg.includes('لا يوجد محتوى')) {
        detail = ar ? 'لا يوجد محتوى للنشر في هذا المشروع بعد.' : 'Nothing to publish yet in this project.';
      } else if (msg.toLowerCase().includes('rate') || msg.toLowerCase().includes('too many')) {
        detail = ar ? 'تجاوزت الحد المسموح، يرجى الانتظار ثم أعد المحاولة.' : 'Too many attempts. Wait a moment, then retry.';
      } else if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('forbidden')) {
        detail = ar ? 'بيانات الاعتماد غير صالحة، تحقق من الإعدادات ثم أعد المحاولة.' : 'Invalid credentials. Check your setup and retry.';
      } else if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('connection')) {
        detail = ar ? 'لا يمكن الوصول للخادم، تحقق من اتصالك بالإنترنت ثم أعد المحاولة.' : 'Cannot reach the server. Check your internet connection and retry.';
      } else {
        detail = ar ? `تعذّر النشر: ${msg}` : `Publish failed: ${msg}`;
      }
      setError(detail);
    } finally {
      setBusy(null);
    }
  }, [projectId, ar]);

  const handleCopy = useCallback(() => {
    if (!state?.url) return;
    navigator.clipboard?.writeText(state.url).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [state?.url]);

  // Starter screen / no project: nothing to publish.
  if (!projectId) return null;

  const isLive = state?.published === true && !!state.url;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {isLive ? (
        <>
          {/* LIVE: show the REAL public link, openable and copyable. */}
          <span
            className="hidden md:inline-flex items-center gap-1.5 max-w-[200px] lg:max-w-[280px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold px-2.5 py-1 rounded-full"
            title={state.url}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <Globe className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span className="truncate font-mono">{state.url}</span>
          </span>
          <button
            onClick={handleCopy}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
            title={language === 'ar' ? 'نسخ الرابط العام' : 'Copy public link'}
            aria-label={language === 'ar' ? 'نسخ الرابط العام' : 'Copy public link'}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <a
            href={state.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded hover:bg-slate-800 text-emerald-300 hover:text-emerald-200 transition"
            title={language === 'ar' ? 'فتح الموقع المنشور' : 'Open published site'}
            aria-label={language === 'ar' ? 'فتح الموقع المنشور' : 'Open published site'}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={handlePublish}
            disabled={busy !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title={language === 'ar' ? 'إعادة النشر بآخر التعديلات' : 'Re-publish latest changes'}
          >
            {busy === 'publishing' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Rocket className="w-3.5 h-3.5" />
            )}
            <span>{language === 'ar' ? 'تحديث' : 'Update'}</span>
          </button>
        </>
      ) : (
        /* NOT LIVE: one clear button that really publishes. */
        <button
          onClick={handlePublish}
          disabled={busy !== null}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-rose-500 to-orange-500 text-white text-[11px] font-black hover:brightness-110 transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
          title={language === 'ar' ? 'نشر الموقع فعليًا على رابط عام' : 'Publish the site to a real public link'}
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5" />}
          <span>{language === 'ar' ? 'نشر الموقع' : 'Publish'}</span>
        </button>
      )}

      {error && (
        <span className="flex items-center gap-1 text-[10px] text-rose-300" role="alert">
          <AlertCircle className="w-3 h-3 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </span>
      )}
    </div>
  );
};

export default PublishButton;
