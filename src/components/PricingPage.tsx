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
  const BackArrow = ar ? ArrowRight : ArrowLeft;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100" dir={ar ? 'rtl' : 'ltr'}>
      {/* Reached from a search result or a shared link there is no header to go
          back to, so this page carries its own way out. */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition cursor-pointer"
          >
            <BackArrow className="w-3.5 h-3.5" />
            {ar ? 'العودة للرئيسية' : 'Back to home'}
          </button>
          <span className="text-xs font-extrabold text-rose-300">⚡ Ebnili</span>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:px-16">
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

        <p className="text-center text-[11px] text-slate-500 mt-8 leading-6">
          {ar
            ? 'الدفع عبر محفظة أورانج كاش بالجنيه المصري فقط. المرجع المحاسبي المعتمد ' +
              `${USD_TO_EGP} ج.م للدولار، وتظهر القيمة الدقيقة المطلوبة للتحويل في صفحة الدفع.`
            : 'Payment is via the Orange Cash wallet in Egyptian pounds only. The accounting reference rate is ' +
              `${USD_TO_EGP} EGP per USD; the exact amount to transfer is shown on the checkout page.`}
        </p>

        {/* ── Frequently asked questions ────────────────────────────────────
            A pricing page reached from Google gets read by people who cannot
            yet commit. Answering the four questions that actually stop the
            purchase — is it really free, is the money safe, will I be able to
            keep the code, what happens if I stop paying — is worth more than
            another feature list, and it is also valid structured content for
            search engines. */}
        <div className="mt-14 max-w-2xl mx-auto">
          <h2 className="text-center text-base font-extrabold text-white mb-6">
            {ar ? 'أسئلة شائعة قبل الاشتراك' : 'Questions before you subscribe'}
          </h2>
          <dl className="space-y-3">
            {(ar
              ? [
                  {
                    q: 'هل فعلاً يمكنني البدء مجاناً دون بطاقة بنكية؟',
                    a: 'نعم. الباقة المجانية تمنحك 5 عمليات توليد يومياً، ومعاينة فورية، ومحرر كود كاملاً، بلا أي بيانات بطاقة. كل ما تحتاجه هو تسجيل الدخول بحساب Google أو GitHub.',
                  },
                  {
                    q: 'هل أدفع بالدولار أم بالجنيه؟',
                    a: 'الأسعار معروضة بالدولار للشفافية، لكن الدفع يتم فعلياً عبر محفظة أورانج كاش بالجنيه المصري. رقم المحفظة وقيمة التحويل الدقيقة تظهران في صفحة الدفع.',
                  },
                  {
                    q: 'هل أستطيع إلغاء الاشتراك في أي وقت؟',
                    a: 'نعم، الاشتراك شهري أو سنوي بلا التزام طويل. عند التجديد يُفعَّل تلقائياً، ويمكنك إيقافه في أي وقت.',
                  },
                  {
                    q: 'ماذا يحدث إذا تجاوزت عدد التوليدات؟',
                    a: 'تتوقف التوليدات الجديدة فقط، ويبقى كل ما أنشأته محفوظاً في حسابك ومتاحاً للتحميل. يمكنك الترقية في أي لحظة للعودة للبناء بلا حدود.',
                  },
                ]
              : [
                  {
                    q: 'Can I really start free, with no card?',
                    a: 'Yes. The free tier gives you 5 generations per day, the live preview and the full code editor — no payment details required. Just sign in with Google or GitHub.',
                  },
                  {
                    q: 'Do I pay in USD or Egyptian pounds?',
                    a: 'Prices are shown in USD for transparency, but payment happens through the Orange Cash wallet in Egyptian pounds. The wallet number and the exact transfer amount appear on the checkout page.',
                  },
                  {
                    q: 'Can I cancel at any time?',
                    a: 'Yes — monthly or yearly, with no long lock-in. It renews automatically, and you can stop it whenever you like.',
                  },
                  {
                    q: 'What happens if I hit the generation limit?',
                    a: 'Only new generations pause. Everything you already built stays in your account and remains downloadable. Upgrade whenever you want to keep building without limits.',
                  },
                ]
            ).map((item) => (
              <div key={item.q} className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3.5">
                <dt className="text-xs font-bold text-slate-100">{item.q}</dt>
                <dd className="mt-1.5 text-[11px] leading-6 text-slate-400">{item.a}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-white text-xs font-bold transition shadow-lg shadow-rose-500/25 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {ar ? 'ابدأ الآن مجاناً' : 'Start building free'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

