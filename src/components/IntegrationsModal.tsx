import React, { useState } from 'react';
import { Database, X, Github, CreditCard, ShieldCheck, Check, Key } from 'lucide-react';
import { Language } from '../types';

interface IntegrationsModalProps {
  onClose: () => void;
  language: Language;
}

export const IntegrationsModal: React.FC<IntegrationsModalProps> = ({
  onClose,
  language,
}) => {
  const [supabaseConnected, setSupabaseConnected] = useState(true);
  const [githubConnected, setGithubConnected] = useState(false);
  const [stripeConnected, setStripeConnected] = useState(false);

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">
                {language === 'ar' ? 'التكاملات وقواعد البيانات' : 'Integrations & Backend'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {language === 'ar' ? 'ربط السحابة، قواعد البيانات، وبوابات الدفع عبر منصة ابنيلي' : 'Connect Supabase, GitHub, and backend integrations with Ibni-li'}
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

        <div className="space-y-3">
          {/* Supabase */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-base">
                ⚡
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-xs text-white">Supabase PostgreSQL</h4>
                  {supabaseConnected && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-1.5 py-0.2 rounded">
                      {language === 'ar' ? 'متصل' : 'Connected'}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  {language === 'ar' ? 'قاعدة بيانات علائقية وجداول ومصادقة المستخدمين' : 'Relational tables, authentication, and vector store'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setSupabaseConnected(!supabaseConnected)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                supabaseConnected
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {supabaseConnected ? (language === 'ar' ? 'إدارة' : 'Manage') : (language === 'ar' ? 'ربط' : 'Connect')}
            </button>
          </div>

          {/* GitHub Sync */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-white">
                <Github className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-white">GitHub 2-Way Sync</h4>
                <p className="text-[11px] text-slate-400">
                  {language === 'ar' ? 'مزامنة الكود تلقائياً في مستودع GitHub لكل تعديل' : 'Auto-commit every prompt revision to your GitHub repo'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setGithubConnected(!githubConnected)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                githubConnected
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
              }`}
            >
              {githubConnected ? (language === 'ar' ? 'متصل ✔' : 'Synced') : (language === 'ar' ? 'مزامنة' : 'Connect')}
            </button>
          </div>

          {/* Stripe */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-400">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-white">Stripe Checkout</h4>
                <p className="text-[11px] text-slate-400">
                  {language === 'ar' ? 'قبول المدفوعات والاشتراكات لجميع الدول' : 'Accept global payments and recurring subscriptions'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setStripeConnected(!stripeConnected)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                stripeConnected
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  : 'bg-violet-600 hover:bg-violet-500 text-white'
              }`}
            >
              {stripeConnected ? (language === 'ar' ? 'مفعل' : 'Active') : (language === 'ar' ? 'تفعيل' : 'Enable')}
            </button>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
          >
            {language === 'ar' ? 'تم' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
};
