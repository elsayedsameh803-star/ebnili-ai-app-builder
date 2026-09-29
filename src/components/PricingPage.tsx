import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react';
import { Language, BillingCycle } from '../types';
import { SUBSCRIPTION_PLANS, USD_TO_EGP } from '../data/plans';

/**
 * /pricing — the public price list.
 *
 * The site has no router: `vercel.json` already rewrites every non-/api path to
 * index.html, so `/pricing` is a client-side route (see the path handling in
 * App.tsx). Prices come from `data/plans.ts` only — there is no second copy.
 */
export const PricingPage = ({ language, onNavigate }: { language: Language; onNavigate: (p: string) => void }) => {
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const ar = language === 'ar';
  const Arrow = ar ? ArrowLeft : ArrowRight;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100" dir={ar ? 'rtl' : 'ltr'}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="text-center mb-10">
          <span className="inline-block text-[11px] font-bold text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-full px-3 py-1">
            {ar ? 'الأسعار' : 'Pricing'}
          </span>
          <h1 className="mt-4 text-3xl sm:text-4xl font-black text-white">
            {ar ? 'اختر الباقة المناسبة لك' : 'Pick the plan that fits'}
          </h1>
          <p className="mt-3 text-sm text-slate-400 max-w-2xl mx-auto leading-7">
            {ar
              ? 'الأسعار بالدولار الأمريكي، والدفع عبر محفظة أورانج كاش بالجنيه المصري.'
              : 'Prices are in USD, paid through the Orange Cash wallet in Egyptian pounds.'}
          </p>

          <div className="inline-flex items-center gap-1 mt-6 p-1 rounded-xl bg-slate-900 border border-slate-800">
            {(['monthly', 'yearly'] as BillingCycle[]).map((c) => (
              <button
                key={c}
                onClick={() => setCycle(c)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                  cycle === c ? 'bg-rose-500/20 text-rose-300' : 'text-slate-400 hover:text-white'
                }`}
              >
                {c === 'monthly' ? (ar ? 'شهري' : 'Monthly') : (ar ? 'سنوي' : 'Yearly')}
                {c === 'yearly' && (
                  <span className="ms-1.5 text-[10px] text-emerald-400">
                    {ar ? 'وفّر شهرين' : 'save 2 months'}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>


        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const usd = cycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
            const egp = cycle === 'yearly' ? plan.payEgpYearly : plan.payEgpMonthly;
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl p-6 border transition ${
                  plan.isPopular
                    ? 'bg-gradient-to-b from-rose-950/40 via-slate-900 to-slate-900 border-rose-500/50 ring-1 ring-rose-500/30'
                    : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                {plan.badgeAr && (
                  <span className="absolute -top-3 right-5 bg-gradient-to-r from-rose-500 to-amber-500 text-slate-950 text-[10px] font-extrabold px-3 py-0.5 rounded-full">
                    {ar ? plan.badgeAr : plan.badgeEn}
                  </span>
                )}
                <h2 className="text-base font-extrabold text-white">{ar ? plan.nameAr : plan.nameEn}</h2>
                <p className="text-xs text-slate-400 mt-1.5 min-h-[38px] leading-relaxed">
                  {ar ? plan.taglineAr : plan.taglineEn}
                </p>

                <div className="mt-5 py-3 border-y border-slate-800/80 flex items-baseline gap-1">
                  {usd === 0 ? (
                    <span className="text-2xl font-black text-white">{ar ? 'مجاناً' : 'Free'}</span>
                  ) : (
                    <>
                      <span className="text-4xl font-black text-white font-mono">${usd.toFixed(2)}</span>
                      <span className="text-xs text-slate-400">
                        /{cycle === 'yearly' ? (ar ? 'سنة' : 'yr') : (ar ? 'شهر' : 'mo')}
                      </span>
                    </>
                  )}
                </div>
                {usd !== 0 && (
                  <p className="text-[11px] text-orange-300/90 mt-2">
                    {ar ? `المبلغ المطلوب تحويله: ${egp} ج.م` : `Transfer ${egp} EGP`}
                  </p>
                )}

                <ul className="mt-5 space-y-2 text-xs flex-1">
                  {(ar ? plan.featuresAr : plan.featuresEn).map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-slate-300 leading-snug">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {plan.id === 'free' ? (
                  <button
                    onClick={() => onNavigate('/')}
                    className="mt-6 w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition"
                  >
                    {ar ? 'ابدأ مجاناً' : 'Start free'}
                  </button>
                ) : (
                  <button
                    onClick={() => onNavigate(`/pay?plan=${plan.id}&cycle=${cycle}`)}
                    className={`mt-6 w-full py-3 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-2 ${
                      plan.isPopular
                        ? 'bg-gradient-to-r from-rose-500 via-pink-600 to-amber-500 text-slate-950'
                        : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {ar ? 'اشترِ الآن' : 'Buy now'}
                    <Arrow className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-center text-[11px] text-slate-500 mt-8">
          {ar
            ? `سعر الصرف المعتمد ${USD_TO_EGP} جنيه للدولار. الدفع عبر محفظة أورانج كاش فقط.`
            : `Reference rate ${USD_TO_EGP} EGP per USD. Payment is via the Orange Cash wallet only.`}
        </p>
      </div>
    </div>
  );
};

