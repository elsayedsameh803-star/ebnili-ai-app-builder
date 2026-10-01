import { useState, useCallback } from 'react';
import { Share2, X, Check, Copy, QrCode, Globe, Info } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Language } from '../types';
import { useModalAccessibility } from './useModalAccessibility';

interface DeployModalProps {
  projectName: string;
  onClose: () => void;
  language: Language;
}

/**
 * /api/projects/export hands the project to the server, but there is no public
 * hosting route behind this modal yet. The previous version invented a
 * `https://ibnili.app/p/<slug>` link that has never existed and a box with
 * `[QR]` printed in it, then labelled the result "منشور ونشط" — so a visitor
 * copied a dead URL and scanned a fake code.
 *
 * The feature is kept (it is a real part of the product), but it now only ever
 * shows something that is true:
 *  • the app's own origin is the only host we can promise, so the share action
 *    is driven by a real, openable link plus a genuine scannable QR of it;
 *  • anything not yet available is labelled as such instead of faking success.
 */
export const DeployModal = ({
  projectName,
  onClose,
  language,
}: DeployModalProps) => {
  const [copied, setCopied] = useState(false);
  const handleClose = useCallback(() => onClose(), [onClose]);
  const dialogRef = useModalAccessibility(true, handleClose);
  const slug = projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'app';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const publicUrl = `${origin}/preview/${slug}`;

  const handleCopy = () => {
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
        className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 text-slate-100 animate-in fade-in zoom-in-95 duration-150"
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

        {/* Status badge — honest wording.
            The old badge claimed the app was "live on the global edge" before
            anything was published, which is a promise the platform cannot keep. */}
        <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-300 truncate">
              {language === 'ar'
                ? 'النشر على نطاق عام غير متاح بعد — استخدم المعاينة المباشرة أو صدّر المشروع'
                : 'Public hosting is not available yet — use the live preview or export the project'}
            </span>
          </div>
          <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono shrink-0">
            {language === 'ar' ? 'قريباً' : 'Coming soon'}
          </span>
        </div>

        {/* Preview link box — a URL that actually resolves. */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300">
            {language === 'ar' ? 'رابط المعاينة:' : 'Preview link:'}
          </label>
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl p-2">
            <Globe className="w-4 h-4 text-slate-500 ms-1 shrink-0" />
            <input
              type="text"
              readOnly
              value={publicUrl}
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

        {/* Mobile QR — a REAL, scannable code for the link above. The previous
            markup rendered a literal "[QR]" placeholder, so scanning it did
            nothing at all. */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="font-bold text-xs text-white flex items-center gap-1.5">
              <QrCode className="w-3.5 h-3.5 text-rose-400" />
              <span>{language === 'ar' ? 'افتح على هاتفك' : 'Open on your phone'}</span>
            </h4>
            <p className="text-[11px] text-slate-400">
              {language === 'ar' ? 'امسح الرمز بكاميرا الهاتف لفتح المعاينة' : 'Scan with your phone camera to open the preview'}
            </p>
          </div>
          <div className="w-20 h-20 bg-white p-1.5 rounded-lg flex items-center justify-center shrink-0">
            <QRCodeSVG
              value={publicUrl}
              size={68}
              level="M"
              bgColor="#ffffff"
              fgColor="#020617"
              title={language === 'ar' ? 'رمز الاستجابة السريعة للمعاينة' : 'Preview QR code'}
            />
          </div>
        </div>

        {/* Honest note about what this does and does not do yet. */}
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[11px] text-amber-100 leading-relaxed">
          <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            {language === 'ar'
              ? 'النشر على نطاق خاص والدومين المخصص غير مفعّلين بعد. للحصول على موقع يعمل دائماً، صدّر المشروع كملف ZIP من نافذة التصدير.'
              : 'Custom-domain publishing is not enabled yet. For a site that is always online, export the project as a ZIP from the export dialog.'}
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
      </div>
    </div>
  );
};
