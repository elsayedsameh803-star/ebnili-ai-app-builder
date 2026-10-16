import { useState, useCallback } from 'react';
import { Download, X, Copy, Check, FileArchive, Code, AlertCircle, Lock, Sparkles } from 'lucide-react';
import JSZip from 'jszip';
import { Language, SubscriptionTier } from '../types';
import { buildProjectExport } from '../lib/auth';
import { exportProjectFiles } from '../lib/projects';
import { useModalAccessibility } from './useModalAccessibility';
import { CommandTerminal } from './CommandTerminal';

interface ExportModalProps {
  projectName: string;
  files: Record<string, string>;
  onClose: () => void;
  language: Language;
  /**
   * The account's real tier, resolved server-side on `/api/auth/me` and passed
   * down. FREE is a PREVIEW-ONLY trial: the ZIP, the embed snippet and the
   * quick-start commands are all hidden behind an upgrade notice.
   *
   * This is defence-in-depth only — `/api/projects/export` already refuses a
   * free account with a 403 and resolves the tier from the signed session, so a
   * tampered client that hides this gate still cannot download anything.
   */
  tier: SubscriptionTier;
}

/**
 * Shown to a FREE account wherever a download/embed feature would otherwise be.
 *
 * FREE is a preview-only trial: the visitor can generate and preview, but every
 * control that hands them the source (ZIP, embed iframe, quick-start commands)
 * is replaced by this notice. `/api/projects/export` enforces the identical rule
 * server-side, so this is a clear message rather than the security boundary —
 * hiding it here would only produce an unexplained 403.
 */
const FreeUpgradeNotice = ({ language }: { language: Language }) => (
  <div className="bg-slate-950/60 p-4 rounded-xl border border-amber-500/30 flex items-start gap-3">
    <div className="w-9 h-9 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
      <Lock className="w-4 h-4" aria-hidden="true" />
    </div>
    <div className="space-y-1">
      <h4 className="font-bold text-xs text-white flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
        {language === 'ar' ? 'متاح في الباقة المدفوعة' : 'Available on a paid plan'}
      </h4>
      <p className="text-[11px] text-slate-400 leading-relaxed">
        {language === 'ar'
          ? 'الحساب المجاني للمعاينة فقط. ترقَّ إلى Pro أو Business لتحميل الكود المصدري (ZIP) وتضمين الموقع وتشغيله محلياً.'
          : 'The free plan is preview-only. Upgrade to Pro or Business to download the source (ZIP), embed the site and run it locally.'}
      </p>
    </div>
  </div>
);

export const ExportModal = ({
  projectName,
  files,
  onClose,
  language,
  tier,
}: ExportModalProps) => {
  // FREE = preview only. Anything that hands the user the source (ZIP, embed,
  // CLI commands) is gated here so a free visitor never meets a 403 they did
  // not expect; the server enforces the same rule regardless of this flag.
  const isPaid = tier === 'pro' || tier === 'business';
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const handleClose = useCallback(() => onClose(), [onClose]);
  const dialogRef = useModalAccessibility(true, handleClose);
  /**
   * A failed export used to call the native `alert()`, which is jarring, can be
   * suppressed by the browser, and carries no recovery hint. The reason is now
   * rendered inside the dialog next to the button that failed.
   */
  const [exportError, setExportError] = useState<string | null>(null);

  /**
   * Embed snippet.
   *
   * The old value pointed at `https://ibnili.app/embed/<name>`, a host that has
   * never existed — anyone who pasted it got a DNS failure. A snippet is only
   * worth copying if it works, so the iframe now targets the real, reachable
   * origin of the running app.
   */
  const embedPath = `/preview/${encodeURIComponent(
    projectName.toLowerCase().replace(/\s+/g, '-')
  )}`;
  const embedUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}${embedPath}`;
  const embedSnippet = `<iframe src="${embedUrl}" width="100%" height="650" frameborder="0" loading="lazy" title="${projectName}"></iframe>`;

  const handleDownloadZip = async () => {
    setExportError(null);
    try {
      setIsZipping(true);
      // Build a real multi-file project (index.html + src/styles.css +
      // src/app.js + package.json + README) instead of zipping the single
      // generated HTML page, which is what made the download look "broken".
      const project = buildProjectExport(projectName, files);

      // The files are produced by the SERVER, which decides the watermark from
      // this account's real subscription. Zipping the browser's own copy would
      // hand every user a clean, mark-free export.
      const result = await exportProjectFiles(project.files);
      const zip = new JSZip();

      // ZIP-SLIP + SIZE GUARDS: file names arrive from the generated project,
      // so treat them as untrusted. Reject absolute paths, `..` escapes and
      // backslashes, cap entries and bytes — a malicious project must not
      // write outside the archive or OOM the tab.
      const MAX_ZIP_FILES = 500;
      const MAX_ZIP_BYTES = 20 * 1024 * 1024;
      let zipBytes = 0;
      const entries = Object.entries(result.files);
      if (entries.length > MAX_ZIP_FILES) throw new Error('ZIP_TOO_MANY_FILES');
      for (const [rawPath, content] of entries) {
        const name = String(rawPath ?? "").replace(/\\/g, "/").trim();
        if (!name || name.startsWith("/") || /(^|\/)\.\.(\/|$)/.test(name)) continue;
        const text = String(content ?? "");
        zipBytes += name.length + text.length;
        if (zipBytes > MAX_ZIP_BYTES) throw new Error('ZIP_TOO_LARGE');
        zip.file(name, text);
      }

      // Generate blob — compression keeps large projects fast to build and small
      // to download. `streamFiles: true` is the default, but being explicit
      // documents the intent and avoids holding every entry in memory.
      const content = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${project.rootDir}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Give the browser a tick to start the download before releasing the blob.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      // `AUTH_REQUIRED` is the common case and deserves a real instruction
      // rather than "try again" — retrying without signing in never works.
      const message =
        err instanceof Error && err.message === 'AUTH_REQUIRED'
          ? language === 'ar'
            ? 'سجّل الدخول أولاً ثم أعد المحاولة لتصدير المشروع.'
            : 'Sign in first, then try exporting again.'
          : language === 'ar'
            ? 'تعذر إنشاء ملف ZIP. تأكد من تسجيل الدخول واتصال الإنترنت ثم أعد المحاولة.'
            : 'Could not build the ZIP. Check your connection and try again.';
      setExportError(message);
    } finally {
      setIsZipping(false);
    }
  };

  const handleCopySnippet = () => {
    navigator.clipboard?.writeText(embedSnippet).catch(() => undefined);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={language === 'ar' ? 'تصدير مشروع التطبيق' : 'Export project code'}
        className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto shadow-2xl space-y-5 text-slate-100 animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">
                {language === 'ar' ? 'تصدير مشروع التطبيق' : 'Export Project Code'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {language === 'ar' ? 'تحميل الكود المصدري كاملاً وتشغيله محلياً' : 'Download full source code to run locally'}
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

        {/* Export failure — shown inline instead of a native alert() the browser
            may suppress, so the user always learns why nothing downloaded. */}
        {exportError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2.5 text-[11px] text-rose-100 leading-relaxed"
          >
            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
            <span className="flex-1 min-w-0 break-words">{exportError}</span>
            <button
              onClick={() => setExportError(null)}
              aria-label={language === 'ar' ? 'إخفاء' : 'Dismiss'}
              className="shrink-0 text-rose-300 hover:text-white transition"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Option 1: ZIP Archive — PAID ONLY. FREE is a preview trial and gets
            an upgrade notice in its place. The server refuses the request too. */}
        {isPaid ? (
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <FileArchive className="w-8 h-8 text-rose-400 shrink-0" />
              <div>
                <h4 className="font-bold text-xs text-white">
                  {language === 'ar' ? 'تحميل كود مشروعك كملف ZIP' : 'Download Your Project as ZIP'}
                </h4>
                <p className="text-[11px] text-slate-400">
                  {language === 'ar'
                    ? 'ملف مضغوط يحتوي على ملفات مشروعك التي أنشأتها، جاهز للتشغيل محلياً'
                    : 'A compressed archive of the project files you generated, ready to run locally'}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleDownloadZip}
                disabled={isZipping}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer text-center"
              >
                <Download className={`w-3.5 h-3.5 ${isZipping ? 'animate-bounce' : ''}`} />
                <span>
                  {isZipping
                    ? (language === 'ar' ? 'جارٍ التحضير...' : 'Preparing...')
                    : (language === 'ar' ? 'تحميل ملف ZIP' : 'Download ZIP')}
                </span>
              </button>
            </div>
          </div>
        ) : (
          <FreeUpgradeNotice language={language} />
        )}

        {/* Option 2: Embed Snippet — PAID ONLY. FREE gets the same upgrade notice
            in its place, so every locked control reads the same way. */}
        {isPaid ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <span className="flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-indigo-400" />
                <span>{language === 'ar' ? 'كود التضمين (Embed iframe)' : 'Embed in your site'}</span>
              </span>
            <button
              onClick={handleCopySnippet}
              className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px] transition cursor-pointer"
            >
              {copiedSnippet ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">{language === 'ar' ? 'تم النسخ' : 'Copied'}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>{language === 'ar' ? 'نسخ' : 'Copy'}</span>
                </>
              )}
            </button>
          </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 break-all select-all">
              {embedSnippet}
            </div>
          </div>
        ) : (
          <FreeUpgradeNotice language={language} />
        )}

        {/* Option 3: Quick Start commands — PAID ONLY. Same `CommandTerminal` used
            by the deploy dialog, gated behind the same preview-only free rule. */}
        {isPaid ? (
          <CommandTerminal projectName={projectName} language={language} />
        ) : (
          <FreeUpgradeNotice language={language} />
        )}

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
          >
            {language === 'ar' ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
