import React, { useState } from 'react';
import { MessageCircle, Phone, Sparkles, X, ExternalLink, ShieldCheck } from 'lucide-react';
import { Language } from '../types';

interface WhatsAppSupportButtonProps {
  language: Language;
  walletNumber?: string;
}

export const WhatsAppSupportButton: React.FC<WhatsAppSupportButtonProps> = ({
  language,
  walletNumber = '01207782741',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const cleanPhone = walletNumber.replace(/\D/g, '');
  // Format international Egypt number: 012... -> 2012...
  const intlPhone = cleanPhone.startsWith('0') ? '2' + cleanPhone : cleanPhone;

  const defaultMsg = language === 'ar'
    ? 'مرحباً، أود الاستفسار بخصوص منصة إبنيلي AI وتفعيل اشتراك أورانج كاش.'
    : 'Hello, I have an inquiry regarding Ebnili AI and Orange Cash subscription.';

  const waUrl = `https://wa.me/${intlPhone}?text=${encodeURIComponent(defaultMsg)}`;

  return (
    <div className="fixed bottom-5 left-5 z-40 flex flex-col items-start select-none" dir="rtl">
      {/* Expanded Quick Support Card */}
      {isOpen && (
        <div className="mb-3 w-80 bg-slate-900/95 border border-emerald-500/30 rounded-2xl shadow-2xl p-4 backdrop-blur-xl animate-fadeIn transition-all">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/30">
                <MessageCircle className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>الدعم المباشر لصاحب الموقع</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                </h4>
                <p className="text-[10px] text-slate-400 font-mono">واتساب: {walletNumber}</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="py-3 text-xs text-slate-300 space-y-2">
            <p className="leading-relaxed">
              تواصل مباشرة مع إدارة المنصة عبر واتساب للتفعيل الفوري للاشتراك، المساعدة في عمليات التحويل عبر محفظة أورانج كاش، أو تقديم أي استفسار.
            </p>
            <div className="flex items-center gap-2 text-[11px] text-emerald-400 bg-emerald-950/40 px-2.5 py-1.5 rounded-lg border border-emerald-500/20">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>رد سريع ومباشر على مدار الساعة</span>
            </div>
          </div>

          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/30 text-xs transition duration-200"
          >
            <MessageCircle className="w-4 h-4" />
            <span>بدء المحادثة على واتساب الآن</span>
            <ExternalLink className="w-3 h-3 opacity-70" />
          </a>
        </div>
      )}

      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group relative flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 text-white rounded-full shadow-xl shadow-emerald-600/40 hover:shadow-emerald-500/60 hover:scale-105 active:scale-95 transition-all duration-300 border border-emerald-400/30"
        title="تواصل معنا عبر واتساب"
        id="whatsapp-support-btn"
      >
        <div className="relative">
          <MessageCircle className="w-5 h-5 transition-transform group-hover:rotate-12" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-emerald-900 animate-ping"></span>
        </div>
        <span className="font-bold text-xs whitespace-nowrap">
          دعم واتساب ({walletNumber})
        </span>
      </button>
    </div>
  );
};
