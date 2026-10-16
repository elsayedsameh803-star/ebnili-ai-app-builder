import { motion, useScroll, useTransform } from 'motion/react';
import { Sparkles, ArrowRight, Shield, Zap, Layers, Globe, BarChart3 } from 'lucide-react';
import { SiteFooter } from './SiteFooter';
import { PricingPage } from './PricingPage';

interface LandingPageProps {
  initialLanguage: 'ar' | 'en';
  onNavigateToLogin: () => void;
  onNavigateToPricing: () => void;
  /** Opens Privacy / Terms / Contact / About — wired to App's InfoPagesModal. */
  onOpenInfoPage: (page: 'about' | 'contact' | 'privacy' | 'terms') => void;
  /** Passed straight to the embedded PricingPage (App's navigate()). */
  onNavigate: (to: string) => void;
}

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  // The bezier must be a fixed-length tuple: motion types `ease` as
  // Easing | Easing[], and a plain inferred number[] never matches Easing.
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
};

export const LandingPage = ({ initialLanguage, onNavigateToLogin, onNavigateToPricing, onOpenInfoPage, onNavigate }: LandingPageProps) => {
  const isAr = initialLanguage === 'ar';

  const t = isAr ? {
    navSignIn: 'تسجيل الدخول',
    navRegister: 'إنشاء حساب',
    heroTitle: 'ابني موقعك الإلكتروني بذكاء اصطناعي في ثوانٍ',
    heroSubtitle: 'منصة إبنيلي الذكية تجمع بين بناء المواقع وتحليلات البيانات — أنشئ تجارب رقمية احترافية بسهولة.',
    heroCta: 'ابدأ مجانًا الآن',
    heroCtaSecondary: 'سجل الآن',
    heroTrust: 'مئات المشاريع المُنشأة',
    featuresTitle: 'المزايا الرئيسية',
    howItWorksTitle: 'كيف تعمل؟',
    onboardingTitle: 'الدليل الخطوة بخطوة',
    onboardingSubtitle: 'احجز دقيقة وستكون لديك موقعك في أقل من دقيقتين',
    pricingPreview: 'عرض الخطط والأسعار',
    privacy: 'سياسة الخصوصية',
    terms: 'الشروط والأحكام',
    contact: 'اتصل بنا',
    about: 'من نحن',
    qaTitle: 'أسئلة شائعة',
    moreQty: 'مزيد من الأسئلة؟',
  } : {
    navSignIn: 'Sign In',
    navRegister: 'Register',
    heroTitle: 'Build your website with AI in seconds',
    heroSubtitle: 'Ebnili combines website building and analytics in one intelligent studio.',
    heroCta: 'Start building free',
    heroCtaSecondary: 'Sign up now',
    heroTrust: '10,000+ projects launched',
    featuresTitle: 'Key Features',
    howItWorksTitle: 'How it works?',
    onboardingTitle: 'Step-by-step onboarding guide',
    onboardingSubtitle: 'Take a minute & you will have your site in less than 2 minutes',
    pricingPreview: 'View Plans & Pricing',
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
    contact: 'Contact Us',
    about: 'About Us',
    qaTitle: 'Frequently Asked Questions',
    moreQty: 'More questions?',
  };

  // The nav dips slightly as the page scrolls — driven purely by motion values,
  // so no React state or scroll listener is involved.
  const { scrollY: scrollYRef } = useScroll();
  const scrollTransform = useTransform(scrollYRef, [0, 100], [0, 40]);

  const featuresAr = [
    { icon: Zap, title: 'ذكاء اصطناعي لبناء المواقع', desc: 'أنشئ مواقع كاملة من وصف نصي بسيط بثانية واحدة.' },
    { icon: BarChart3, title: 'تحليلات في الوقت الحقيقي', desc: 'تتبع حركة الزوار ومصادرهم باستخدام لوحة تحكم متقدمة.' },
    { icon: Globe, title: 'دعم لغوي كامل', desc: 'مواقع متعددة اللغات مع دعم عربي إنجليزي.' },
    { icon: Layers, title: 'قوالب احترافية', desc: 'قوالب مصممة لمتاجر ومدونات وصالات عرض.' },
  ];

  const featuresEn = [
    { icon: Zap, title: 'AI-Powered Building', desc: 'Create complete websites from simple text descriptions in seconds.' },
    { icon: BarChart3, title: 'Real-time Analytics', desc: 'Track visitor behavior and sources with an intuitive dashboard.' },
    { icon: Globe, title: 'Full bilingual support', desc: 'Multi-language sites with full Arabic and English support.' },
    { icon: Layers, title: 'Professional templates', desc: 'Templates designed for stores, blogs, and portfolios.' },
  ];

  const stepsAr = [
    { num: '01', title: 'أدخل وصف مشروعك', desc: 'اكتب ما تريده باللغة العربية أو الإنجليزية - الموقع، المتجر، المدونة، أو أي شيء آخر.', icon: '✏️' },
    { num: '02', title: 'أنتج الذكاء الاصطناعي الموقع', desc: 'يحلل النموذج طلبك ويولد هيكل الصفحة، المحتوى، الألوان، والخط، ويعرض النتيجة فورًا.', icon: '🤖' },
    { num: '03', title: 'عدل وتفاعل مع المشروع', desc: 'استخدم المحرر المتكامل لتعديل الصفحة بكود HTML صالح للنشر.', icon: '🛠️' },
    { num: '04', title: 'نشر ومشاركة', desc: 'ارفع المشروع على أي مشغل أو استخدم الرابط الخاص بالمنصة للوصول المباشر.', icon: '🚀' },
  ];

  const stepsEn = [
    { num: '01', title: 'Describe your project', desc: 'Write what you want in Arabic or English - a site, store, blog, or anything else.', icon: '✏️' },
    { num: '02', title: 'AI generates the site', desc: 'The model analyzes your request and generates page structure, content, colors, and fonts.', icon: '🤖' },
    { num: '03', title: 'Edit & interact', desc: 'Use the integrated editor to customize the page with publish-ready HTML code.', icon: '🛠️' },
    { num: '04', title: 'Publish & share', desc: 'Upload your project to any host, or use the platform link for direct access.', icon: '🚀' },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased overflow-x-hidden">
      <motion.header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300" style={{ y: scrollTransform }}>
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 via-cyan-300 to-violet-500 flex items-center justify-center shadow-md shadow-sky-400/20 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-extrabold tracking-tight font-['Cairo',sans-serif]">
              إبنيلي<span className="text-rose-500">.</span>
            </span>
          </a>

          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-slate-900 transition">{t.featuresTitle}</a>
            <a href="#how-it-works" className="hover:text-slate-900 transition">{t.howItWorksTitle}</a>
            <a href="#onboarding" className="hover:text-slate-900 transition">{t.onboardingTitle}</a>
            <a href="#pricing" className="hover:text-slate-900 transition">{t.pricingPreview}</a>
            <a href="#faq" className="hover:text-slate-900 transition">{t.qaTitle}</a>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={onNavigateToLogin} className="hidden md:inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition">
              <Shield className="w-4 h-4" />
              {t.navSignIn}
            </button>
            <button
              onClick={onNavigateToLogin}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 transition shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              {t.navRegister}
            </button>
          </div>
        </nav>
      </motion.header>

      <section className="relative pt-24 sm:pt-28 pb-16 sm:pb-24 px-4">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-rose-100/30 blur-3xl" />
          <div className="absolute top-10 right-0 w-[400px] h-[400px] rounded-full bg-pink-100/20 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full bg-amber-100/20 blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="text-center lg:text-left">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={fadeUp.transition}>
              <span className="inline-flex items-center gap-2 rounded-full bg-rose-500/10 border border-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-600 tracking-wide uppercase">
                <Sparkles className="w-3.5 h-3.5" />
                Powered by AI
              </span>
            </motion.div>

            <motion.h1
              className="mt-6 text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold leading-tight tracking-tight font-['Cairo',sans-serif]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={fadeUp.transition}
            >
              {t.heroTitle}
            </motion.h1>

            <motion.p
              className="mt-6 text-lg sm:text-xl text-slate-600 leading-relaxed max-w-xl mx-auto lg:mx-0"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={fadeUp.transition}
            >
              {t.heroSubtitle}
            </motion.p>

            <motion.div
              className="mt-8 flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={fadeUp.transition}
            >
              <button
                onClick={onNavigateToLogin}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-l from-sky-400 via-cyan-300 to-violet-500 px-7 py-3.5 text-base font-bold text-white shadow-lg shadow-sky-400/25 hover:shadow-xl hover:shadow-violet-500/30 hover:from-sky-300 hover:via-cyan-200 hover:to-violet-400 transition-all duration-300"
              >
                {t.heroCta}
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={onNavigateToPricing}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-7 py-3.5 text-base font-semibold text-slate-700 hover:bg-white hover:shadow-md transition-all duration-300 backdrop-blur-sm"
              >
                {t.heroCtaSecondary}
                <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      <section id="features" className="py-16 sm:py-24 px-4 bg-slate-50/50">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={fadeUp.transition}>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-center font-['Cairo',sans-serif]">{t.featuresTitle}</h2>
          </motion.div>

          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {(isAr ? featuresAr : featuresEn).map((f, i) => (
              <motion.div
                key={f.title}
                className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...fadeUp.transition, delay: i * 0.1 }}
              >
                <div className="w-12 h-12 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-600 mb-4">
                  <f.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>


      <section id="how-it-works" className="py-16 sm:py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={fadeUp.transition}>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-center font-['Cairo',sans-serif]">{t.howItWorksTitle}</h2>
          </motion.div>

          <div className="mt-12 grid md:grid-cols-4 gap-8">
            {['01', '02', '03', '04'].map((num, i) => (
              <motion.div
                key={num}
                className="relative text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...fadeUp.transition, delay: i * 0.15 }}
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-400 via-cyan-300 to-violet-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-violet-500/20 mx-auto mb-4">
                  {num}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{i === 0 ? 'أدخل وصف مشروعك' : i === 1 ? 'أنتج الذكاء الاصطناعي الموقع' : i === 2 ? 'عدل وتفاعل مع المشروع' : 'نشر ومشاركة'}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{i === 0 ? 'اكتب ما تريده بالعربية أو الإنجليزية' : i === 1 ? 'يحلل النموذج طلبك وينشئ الصفحة' : i === 2 ? 'استخدم المحرر المتكامل للتعديل' : 'ارفع المشروع وشاركه مع العالم'}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="onboarding" className="py-16 sm:py-24 px-4 bg-slate-50/50">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={fadeUp.transition}>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-center font-['Cairo',sans-serif]">{t.onboardingTitle}</h2>
          </motion.div>

          <div className="mt-12 grid md:grid-cols-2 gap-6">
            {['01', '02', '03', '04'].map((num, i) => (
              <motion.div
                key={num}
                className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...fadeUp.transition, delay: i * 0.1 }}
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-400 via-cyan-300 to-violet-500 flex items-center justify-center text-white text-xl mb-4">
                  {i === 0 ? '✏️' : i === 1 ? '🤖' : i === 2 ? '🛠️' : '🚀'}
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-bold text-rose-600 bg-rose-500/10 px-2 py-1 rounded">{num}</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">{i === 0 ? 'أدخل وصف مشروعك' : i === 1 ? 'أنتج الذكاء الاصطناعي الموقع' : i === 2 ? 'عدل وتفاعل مع المشروع' : 'نشر ومشاركة'}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{i === 0 ? 'اكتب ما تريده باللغة العربية أو الإنجليزية' : i === 1 ? 'ينشئ النموذج هيكل الصفحة والمحتوى' : i === 2 ? 'استخدم المحرر المتكامل للتعديل' : 'ارفع المشروع على أي مشغل أو استخدم الرابط المباشر'}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="py-16 sm:py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={fadeUp.transition}>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-center font-['Cairo',sans-serif]">{t.pricingPreview}</h2>
          </motion.div>

          <motion.div
            className="mt-10 max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={fadeUp.transition}
          >
            <PricingPage language={isAr ? 'ar' : 'en'} onNavigate={onNavigate} />
          </motion.div>
        </div>
      </section>

      <section id="faq" className="py-16 sm:py-24 px-4 bg-slate-50/50">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={fadeUp.transition}>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-center font-['Cairo',sans-serif]">{t.qaTitle}</h2>
          </motion.div>

          <div className="mt-10 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h3 className="font-bold text-slate-900">كيف تعمل المنصة؟</h3>
              <p className="text-slate-600 text-sm mt-2">نوفر استوديو ذكاء اصطناعي يحول وصف مشروعك المكتوب إلى كود كامل وجاهز للنشر مع دعم كامل للغة العربية والإنجليزية.</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h3 className="font-bold text-slate-900">هل يمكنني استضافة الموقع؟</h3>
              <p className="text-slate-600 text-sm mt-2">نعم! بعد إنشاء مشروعك، يمكنك نشره على أي خادم أو hosting أو استخدام الرابط المباشر.</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h3 className="font-bold text-slate-900">هل هناك قيود على الباقة المجانية؟</h3>
              <p className="text-slate-600 text-sm mt-2">الباقة المجانية تسمح بتجربة كاملة: توليد حتى 5 تطبيقات يومياً، محرر كود كامل، معاينة فورية، ودعم مجتمعي.</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h3 className="font-bold text-slate-900">هل يمكنني ترجمة الموقع؟</h3>
              <p className="text-slate-600 text-sm mt-2">نعم، يدعم إبنيلي إنشاء مواقع متعددة اللغات مع دعم لغوي كامل للعربية والإنجليزية والفرنسية والإسبانية.</p>
            </div>
          </div>

          <div className="text-center mt-8">
            <button className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition">
              {t.moreQty} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      <SiteFooter language={isAr ? 'ar' : 'en'} onOpenInfoPage={onOpenInfoPage} />
    </div>
  );
};
