import React, { useState } from 'react';
import { Share2, X, Check, Copy, ExternalLink, QrCode, Globe, Sparkles } from 'lucide-react';
import { Language } from '../types';

interface DeployModalProps {
  projectName: string;
  onClose: () => void;
  language: Language;
}

export const DeployModal: React.FC<DeployModalProps> = ({
  projectName,
  onClose,
  language,
}) => {
  const [copied, setCopied] = useState(false);
  const slug = projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'app';
  const publicUrl = `https://ibnili.app/p/${slug}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">
                {language === 'ar' ? 'نشر التطبيق ومشاركته' : 'Publish & Share App'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {language === 'ar' ? 'تطبيقك منشور الآن ومتاح عالمياً' : 'Your application is live on the cloud'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Status Badge */}
        <div className="bg-emerald-950/40 border border-emerald-500/30 p-3 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-semibold text-emerald-300">
              {language === 'ar' ? 'منشور ونشط على سحابة ابنيلي' : 'Live on Ibni-li Global Edge'}
            </span>
          </div>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-mono">
            HTTPS Ready
          </span>
        </div>

        {/* Public Share URL Box */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300">
            {language === 'ar' ? 'رابط المشاركة العام:' : 'Public Share Link:'}
          </label>
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl p-2">
            <Globe className="w-4 h-4 text-slate-500 ml-1 shrink-0" />
            <input
              type="text"
              readOnly
              value={publicUrl}
              className="bg-transparent text-xs text-white font-mono flex-1 outline-none truncate"
            />
            <button
              onClick={handleCopy}
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

        {/* Mobile QR Code Preview */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="font-bold text-xs text-white flex items-center gap-1.5">
              <QrCode className="w-3.5 h-3.5 text-rose-400" />
              <span>{language === 'ar' ? 'معاينة على هاتفك المحمول' : 'Scan to Test on Mobile'}</span>
            </h4>
            <p className="text-[11px] text-slate-400">
              {language === 'ar' ? 'امسح الرمز بكاميرا الهاتف لتجربة التطبيق' : 'Scan QR code with your phone camera'}
            </p>
          </div>
          {/* Stylized QR Code placeholder */}
          <div className="w-16 h-16 bg-white p-1 rounded-lg flex items-center justify-center shrink-0">
            <div className="w-full h-full border-2 border-slate-900 border-dashed rounded flex items-center justify-center text-slate-900 font-mono text-[10px] font-bold">
              [QR]
            </div>
          </div>
        </div>

        {/* Custom Domain Section */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>{language === 'ar' ? 'دومين مخصص (Custom Domain)' : 'Custom domain'}</span>
          <span className="text-rose-400 hover:underline cursor-pointer">
            {language === 'ar' ? 'إعداد النطاق ←' : 'Configure DNS →'}
          </span>
        </div>
      </div>
    </div>
  );
};
