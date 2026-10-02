/**
 * Post-build SEO generator.
 *
 * WHY THIS EXISTS
 * ---------------
 * This is a client-rendered SPA: every URL returns the same `index.html`, whose
 * `<head>` carries one title and one description. Google's crawler therefore
 * saw `Ebnili - AI App Builder` for `/pricing`, `/pay` and `/` alike, with a body
 * containing only a loading spinner. A page with no text is a page with nothing
 * to rank, so the site was effectively invisible in search.
 *
 * This script writes REAL static HTML next to the SPA for the public routes:
 * the real marketing copy, the price list, the FAQ, and matching JSON-LD. It
 * runs after `vite build`, so the files ship as plain files in `dist/` — no
 * JavaScript required for a crawler (or one that never finishes rendering) to
 * read them.
 *
 * The React app still handles all interaction; these pages exist to be indexed
 * and the client takes over from there.
 *
 * Usage:  node scripts/generate-seo-pages.mjs
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '..', 'dist');

/**
 * The public origin.
 *
 * Read from the environment so a staging deployment never emits canonical tags
 * pointing at production — a wrong canonical is how a site gets de-indexed.
 */
const ORIGIN = (process.env.APP_URL || 'https://ebnily.vercel.app').replace(/\/+$/, '');

/** Escape for use inside a double-quoted HTML attribute. */
const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Escape for a `<script type="application/ld+json">` block. */
const jsonLd = (obj) => JSON.stringify(obj, null, 2).replace(/</g, '\\u003c');

const GRADIENT = 'linear-gradient(135deg,#f43f5e 0%,#ec4899 50%,#f59e0b 100%)';

const CTA = `      <p style="margin:32px 0 0">
        <a href="/" style="display:inline-block;padding:13px 30px;border-radius:14px;background:${GRADIENT};color:#fff;font-weight:800;text-decoration:none">ابدأ الآن مجاناً</a>
        <a href="/pricing" style="display:inline-block;padding:13px 24px;border-radius:14px;border:1px solid #334155;color:#cbd5e1;font-weight:700;text-decoration:none;margin-inline-start:10px">عرض الأسعار</a>
      </p>`;

/**
 * The persistent footer every generated static page carries.
 *
 * WHY: these pages are plain HTML with no React, so they cannot open the
 * InfoPagesModal. Without a footer they were a dead end — a visitor landing on
 * /pricing from Google had no way to reach the privacy policy, the terms or
 * the support number from that page at all. The links are real URLs so a
 * crawler follows them and the documents are indexable in their own right.
 */
const FOOTER = `      <footer style="margin-top:56px;padding-top:24px;border-top:1px solid #1e293b;text-align:center;font-size:13px;color:#64748b">
        <nav style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:14px">
          <a href="${ORIGIN}/about" style="padding:7px 12px;border-radius:8px;color:#94a3b8;text-decoration:none;font-weight:700">من نحن</a>
          <a href="${ORIGIN}/contact" style="padding:7px 12px;border-radius:8px;color:#94a3b8;text-decoration:none;font-weight:700">اتصل بنا</a>
          <a href="${ORIGIN}/privacy" style="padding:7px 12px;border-radius:8px;color:#94a3b8;text-decoration:none;font-weight:700">سياسة الخصوصية</a>
          <a href="${ORIGIN}/terms" style="padding:7px 12px;border-radius:8px;color:#94a3b8;text-decoration:none;font-weight:700">الشروط والأحكام</a>
        </nav>
        <p style="margin:0 0 6px">
          <a href="tel:+201207782741" dir="ltr" style="color:#34d399;font-weight:700;text-decoration:none">01207782741</a>
          <span style="margin:0 8px;color:#334155">·</span>
          <a href="mailto:elsayedsameh803@gmail.com" dir="ltr" style="color:#94a3b8;text-decoration:none">elsayedsameh803@gmail.com</a>
        </p>
        <p style="margin:0;font-size:12px;color:#475569">© 2026 إبنيلي — كل الحقوق محفوظة</p>
      </footer>`;

function page({ path, title, description, inner, nav = '', jsonLdBlocks }) {
  return `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${ORIGIN}${path}" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Ebnili" />
    <meta property="og:locale" content="ar_EG" />
    <meta property="og:url" content="${ORIGIN}${path}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <!-- PNG, not SVG: every social platform that matters here (WhatsApp above
         all) refuses an SVG and silently renders a bare text row instead. -->
    <meta property="og:image" content="${ORIGIN}/og-image.png" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${ORIGIN}/og-image.png" />
    <link rel="icon" href="/icon.svg" type="image/svg+xml" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet" />
${jsonLdBlocks.map((b) => `    <script type="application/ld+json">${jsonLd(b)}</script>`).join('\n')}
  </head>
  <body style="margin:0;background:#020617;color:#e2e8f0;font-family:'Cairo',system-ui,sans-serif;line-height:1.9">
    <div style="max-width:1000px;margin:0 auto;padding:48px 20px">
${nav}${inner}
${FOOTER}
    </div>
  </body>
</html>
`;
}

const FAQS = [
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
];

const PLANS = [
  {
    name: 'الباقة المجانية',
    price: 'مجاناً',
    egp: '',
    feats: ['5 عمليات توليد ذكاء اصطناعي يومياً', 'معاينة فورية على كل أحجام الشاشات', 'محرر كود متكامل مع التعديل اليدوي', 'تخزين مشاريعك وإصداراتك', 'دعم عبر المجتمع وقاعدة المعرفة'],
  },
  {
    name: 'باقة المحترفين Pro',
    price: '$9.99',
    egp: 'حوّل 500 ج.م شهرياً',
    popular: true,
    feats: ['توليد وتعديل لا محدود للتطبيقات', 'تصدير كود المشروع كملف ZIP جاهز للنشر', 'تعديل بصري مباشر لأي عنصر بنقرة', 'ربط Supabase و PostgreSQL و APIs خارجية', 'نشر على نطاقات مخصصة', 'سجل إصدارات لا محدود', 'تفعيل فوري عبر أورانج كاش 01207782741'],
  },
  {
    name: 'باقة الأعمال Business',
    price: '$14.99',
    egp: 'حوّل 750 ج.م شهرياً',
    feats: ['كل مزايا Pro بلا حدود', 'تصدير White-label بدون شعار المنصة', 'طابور معالجة أولوية مخصص', 'دعم VIP مباشر عبر واتساب', 'توليد أنظمة SaaS و CRM متكاملة', 'فوترة مؤسسية وتفعيل لعدة مشاريع'],
  },
];

const planCards = () =>
  PLANS.map(
    (p) => `        <div style="border:1px solid ${p.popular ? '#f43f5e' : '#1e293b'};border-radius:18px;padding:22px;background:#0f172a">
${p.popular ? `          <div style="display:inline-block;background:${GRADIENT};color:#020617;font-size:11px;font-weight:800;padding:3px 12px;border-radius:99px;margin-bottom:10px">الأكثر طلباً</div>\n` : ''}          <h2 style="font-size:17px;font-weight:800;margin:0 0 12px;color:#fff">${p.name}</h2>
          <div style="font-size:32px;font-weight:800;color:#fff;font-family:monospace">${p.price}</div>
${p.egp ? `          <div style="color:#fb923c;font-size:13px;margin-top:4px">${p.egp}</div>\n` : ''}          <ul style="list-style:none;padding:0;margin:18px 0 0;font-size:13px;color:#cbd5e1">
${p.feats.map((f) => `            <li style="margin-bottom:9px">✓ ${f}</li>`).join('\n')}
          </ul>
        </div>`,
  ).join('\n');

const faqList = () =>
  FAQS.map(
    (f) => `        <div style="border:1px solid #1e293b;border-radius:14px;padding:16px 18px;margin-bottom:10px;background:#0f172a">
          <dt style="font-weight:700;color:#f1f5f9;margin-bottom:6px">${f.q}</dt>
          <dd style="margin:0;color:#94a3b8;font-size:14px">${f.a}</dd>
        </div>`,
  ).join('\n');

const FEATURES = [
  'توليد تطبيق ويب كامل من وصف نصي واحد',
  'معاينة فورية على سطح المكتب والتابلت والهاتف',
  'محرر كود مدمج مع سجل إصدارات وتراجع',
  'تعديل بصري مباشر لأي عنصر بنقرة واحدة',
  'تصدير المشروع كملف ZIP جاهز للنشر',
  'استيراد مستودع من GitHub وتحريره فوراً',
];

/** Breadcrumb markup. */
const crumb = (label) =>
  `      <nav style="font-size:13px;color:#64748b;margin-bottom:26px"><a href="/" style="color:#94a3b8">إبنيلي</a> › <span style="color:#cbd5e1">${label}</span></nav>`;

const PAGES = [
  // ── The legal / company pages ──────────────────────────────────────────────
  // WHY THEY ARE GENERATED STATICALLY: the footer links to them by real URL,
  // so /privacy, /terms, /contact and /about must resolve to a document with
  // actual text. A dead-end link on a legal page is worse than no link, and a
  // crawler following the footer needs a real body to index.
  {
    file: 'privacy.html',
    path: '/privacy',
    nav: crumb('سياسة الخصوصية'),
    title: 'سياسة الخصوصية | إبنيلي',
    description:
      'سياسة خصوصية منصة إبنيلي: ما البيانات التي نجمعها (البريد الإلكتروني واسم الحساب فقط)، لماذا نستخدم كوكيز HttpOnly للجلسة، وكيف نطلب حذف بياناتك أو تصدير مشاريعك.',
    inner: `      <h1 style="font-size:34px;font-weight:800;margin:0 0 10px">سياسة الخصوصية</h1>
      <p style="color:#94a3b8;margin:0 0 26px">آخر تحديث: 27 سبتمبر 2026 — هذه السياسة تشرح بالضبط ما نجمعه منك ولماذا.</p>

      <h2 style="font-size:20px;font-weight:800;margin:32px 0 12px;color:#fff">البيانات التي نجمعها</h2>
      <ul style="color:#cbd5e1;font-size:15px;padding-inline-start:22px">
        <li style="margin-bottom:8px">عند تسجيل الدخول عبر Google أو GitHub: اسم حسابك وبريدك الإلكتروني وصورتك الرمزية فقط.</li>
        <li style="margin-bottom:8px">المشاريع التي تنشئها داخل المنصة، ومحتوى محادثاتك مع محرك البناء.</li>
        <li>سجل الاشتراك وحالة الدفع (الباقة، تاريخ التجديد، عدد عمليات التوليد).</li>
      </ul>

      <h2 style="font-size:20px;font-weight:800;margin:32px 0 12px;color:#fff">ما لا نجمعه ولا نشاركه</h2>
      <ul style="color:#cbd5e1;font-size:15px;padding-inline-start:22px">
        <li style="margin-bottom:8px">لا نحفظ كلمة مرورك إطلاقاً — تسجيل الدخول يتم عبر مزوّد OAuth مباشرة.</li>
        <li style="margin-bottom:8px">لا نبيع بياناتك ولا نشاركها مع أي طرف ثالث لأغراض تسويقية.</li>
        <li>لا نستخدم أدوات تتبع إعلانية.</li>
      </ul>

      <h2 style="font-size:20px;font-weight:800;margin:32px 0 12px;color:#fff">ملفات الارتباط (Cookies)</h2>
      <p style="color:#cbd5e1;font-size:15px;margin:0">نستخدم كوكيز HttpOnly للجلسة ولحساب الإدارة فقط. لا توجد كوكيز تتبع أو إعلانات.</p>

      <h2 style="font-size:20px;font-weight:800;margin:32px 0 12px;color:#fff">حقوقك</h2>
      <p style="color:#cbd5e1;font-size:15px;margin:0">يمكنك في أي وقت طلب حذف بياناتك أو تصدير مشاريعك. راسلنا على الرقم <a href="tel:+201207782741" dir="ltr" style="color:#34d399;font-weight:700">01207782741</a> وسننفّذ الطلب.${CTA}</p>`,
    jsonLd: [
      { '@context': 'https://schema.org', '@type': 'WebPage', name: 'سياسة الخصوصية — إبنيلي', url: `${ORIGIN}/privacy`, inLanguage: 'ar' },
    ],
  },
  {
    file: 'terms.html',
    path: '/terms',
    nav: crumb('الشروط والأحكام'),
    title: 'الشروط والأحكام | إبنيلي',
    description:
      'شروط استخدام منصة إبنيلي: قبول الشروط، قواعد الاستخدام العادل، ملكية المخرجات، سياسة الدفع عبر أورانج كاش والاسترجاع خلال 14 يوماً، وحدود المسؤولية.',
    inner: `      <h1 style="font-size:34px;font-weight:800;margin:0 0 10px">الشروط والأحكام</h1>
      <p style="color:#94a3b8;margin:0 0 26px">آخر تحديث: 27 سبتمبر 2026 — باستخدامك منصة إبنيلي فإنك توافق على هذه الشروط.</p>

      <h2 style="font-size:20px;font-weight:800;margin:32px 0 12px;color:#fff">قبول الشروط</h2>
      <p style="color:#cbd5e1;font-size:15px;margin:0">باستخدامك منصة إبنيلي فإنك توافق على هذه الشروط. إن لم توافق، يرجى عدم استخدام المنصة.</p>

      <h2 style="font-size:20px;font-weight:800;margin:32px 0 12px;color:#fff">استخدام المنصة</h2>
      <ul style="color:#cbd5e1;font-size:15px;padding-inline-start:22px">
        <li style="margin-bottom:8px">لكل مستخدم حساب واحد. مشاركة الحساب أو بيعه مخالفة.</li>
        <li style="margin-bottom:8px">الاستخدام الآلي المكثف (سكربتات / بوتات) ممنوع لأنه يكسر خطة الاستخدام العادل.</li>
        <li>ممنوع إنتاج محتوى غير قانوني أو مضلل أو ينتهك حقوق الآخرين.</li>
      </ul>

      <h2 style="font-size:20px;font-weight:800;margin:32px 0 12px;color:#fff">الملكية الفكرية</h2>
      <p style="color:#cbd5e1;font-size:15px;margin:0">يحق لك ملكية كل ما تولّده من مشاريع وأكواد. اسم "إبنيلي" وشعاره ومحرك المنصة مملوك لنا ولا يجوز استخدامه بدون إذن.</p>

      <h2 style="font-size:20px;font-weight:800;margin:32px 0 12px;color:#fff">المدفوعات والاسترجاع</h2>
      <ul style="color:#cbd5e1;font-size:15px;padding-inline-start:22px">
        <li style="margin-bottom:8px">الدفع عبر محفظة أورانج كاش على 01207782741 فقط.</li>
        <li style="margin-bottom:8px">لا يتم التفعيل تلقائياً — التحقق يدوي ثم التفعيل.</li>
        <li>الاسترجاع ممكن خلال 14 يوماً إذا لم يتجاوز الاستهلاك حداً معقولاً.</li>
      </ul>

      <h2 style="font-size:20px;font-weight:800;margin:32px 0 12px;color:#fff">حدود المسؤولية</h2>
      <p style="color:#cbd5e1;font-size:15px;margin:0">الخدمة تُقدَّم "كما هي"، ومسؤوليتنا محدودة بقيمة ما دفعته في آخر 30 يوماً.${CTA}</p>`,
    jsonLd: [
      { '@context': 'https://schema.org', '@type': 'WebPage', name: 'الشروط والأحكام — إبنيلي', url: `${ORIGIN}/terms`, inLanguage: 'ar' },
    ],
  },
  {
    file: 'contact.html',
    path: '/contact',
    nav: crumb('اتصل بنا'),
    title: 'اتصل بنا | إبنيلي — الدعم الفني',
    description:
      'تواصل مع فريق إبنيلي: الدعم الفني عبر واتساب والرقم 01207782741، والبريد الإلكتروني elsayedsameh803@gmail.com، وخطوات التحويل عبر محفظة أورانج كاش وتفعيل الاشتراك.',
    inner: `      <h1 style="font-size:34px;font-weight:800;margin:0 0 10px">اتصل بنا</h1>
      <p style="color:#94a3b8;margin:0 0 26px">فريق الدعم متاح للرد على استفساراتك حول الاشتراك، التحويل عبر أورانج كاش، أو مشاكل في البناء.</p>

      <h2 style="font-size:20px;font-weight:800;margin:32px 0 12px;color:#fff">طرق التواصل</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px">
        <div style="background:#0b1220;border:1px solid #1e293b;border-radius:14px;padding:18px">
          <div style="font-weight:800;color:#fff;margin-bottom:6px">واتساب / هاتف</div>
          <a href="tel:+201207782741" dir="ltr" style="color:#34d399;font-weight:700;font-size:18px;text-decoration:none">01207782741</a>
          <p style="color:#64748b;font-size:13px;margin:8px 0 0">للدعم الفني والتفعيل الفوري.</p>
        </div>
        <div style="background:#0b1220;border:1px solid #1e293b;border-radius:14px;padding:18px">
          <div style="font-weight:800;color:#fff;margin-bottom:6px">البريد الإلكتروني</div>
          <a href="mailto:elsayedsameh803@gmail.com" dir="ltr" style="color:#94a3b8;text-decoration:none;word-break:break-all">elsayedsameh803@gmail.com</a>
          <p style="color:#64748b;font-size:13px;margin:8px 0 0">للاستفسارات العامة والخاصة.</p>
        </div>
      </div>

      <h2 style="font-size:20px;font-weight:800;margin:32px 0 12px;color:#fff">تحويل الاشتراك عبر أورانج كاش</h2>
      <ol style="color:#cbd5e1;font-size:15px;padding-inline-start:22px">
        <li style="margin-bottom:8px">حوّل المبلغ على الرقم <a href="tel:+201207782741" dir="ltr" style="color:#34d399;font-weight:700">01207782741</a>.</li>
        <li style="margin-bottom:8px">من صفحة الاشتراك داخل الاستوديو، أرسل طلب التفعيل.</li>
        <li>يتم التحقق من التحويل يدوياً ثم تفعيل الباقة.</li>
      </ol>${CTA}`,
    jsonLd: [
      { '@context': 'https://schema.org', '@type': 'ContactPage', name: 'اتصل بنا — إبنيلي', url: `${ORIGIN}/contact`, inLanguage: 'ar' },
    ],
  },
  {
    file: 'about.html',
    path: '/about',
    nav: crumb('من نحن'),
    title: 'من نحن | إبنيلي — منصة بناء التطبيقات بالذكاء الاصطناعي',
    description:
      'إبنيلي منصة عربية لبناء المواقع والتطبيقات بالذكاء الاصطناعي: تصف فكرتك بالعربي فتحصل على تطبيق ويب كامل بمعاينة فورية ومحرر كود وتصدير ZIP ونشر مباشر.',
    inner: `      <h1 style="font-size:34px;font-weight:800;margin:0 0 10px">من نحن</h1>
      <p style="color:#94a3b8;margin:0 0 26px;max-width:720px">إبنيلي منصة عربية مبنية في مصر لبناء المواقع والتطبيقات بالذكاء الاصطناعي.</p>

      <h2 style="font-size:20px;font-weight:800;margin:32px 0 12px;color:#fff">رسالتنا</h2>
      <p style="color:#cbd5e1;font-size:15px;margin:0">أن نجعل بناء منتج ويب حقيقياً متاحاً لأي شخص يكتب بالعربية — بدون فريق تقني وبدون انتظار أسابيع.</p>

      <h2 style="font-size:20px;font-weight:800;margin:32px 0 12px;color:#fff">ماذا نقدّم</h2>
      <ul style="color:#cbd5e1;font-size:15px;padding-inline-start:22px">
${FEATURES.map((f) => `        <li style="margin-bottom:8px">${f}</li>`).join('\n')}
      </ul>${CTA}`,
    jsonLd: [
      { '@context': 'https://schema.org', '@type': 'AboutPage', name: 'من نحن — إبنيلي', url: `${ORIGIN}/about`, inLanguage: 'ar' },
    ],
  },
  {
    file: 'pricing.html',
    path: '/pricing',
    nav: crumb('الأسعار'),
    title: 'أسعار إبنيلي | باقات بناء المواقع والتطبيقات بالذكاء الاصطناعي',
    description:
      'أسعار باقات إبنيلي لبناء المواقع والتطبيقات بالذكاء الاصطناعي: مجانية بحد 5 تطبيقات يومياً، Pro بـ 9.99$ لتوليد غير محدود وتصدير ZIP ونشر على نطاق مخصص، Business بـ 14.99$ للوكالات. الدفع عبر أورانج كاش بالجنيه المصري.',
    inner: `      <h1 style="font-size:34px;font-weight:800;margin:0 0 10px">أسعار إبنيلي لبناء التطبيقات بالذكاء الاصطناعي</h1>
      <p style="color:#94a3b8;margin:0;max-width:720px">ابدأ مجاناً بـ 5 عمليات توليد يومياً، بدون أي بطاقة بنكية. الخطط المدفوعة تفتح التوليد غير المحدود وتصدير الكود والنشر على نطاق خاص، والدفع يتم عبر محفظة أورانج كاش بالجنيه المصري.</p>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin-top:28px">
${planCards()}
      </div>

      <h2 style="font-size:22px;font-weight:800;margin:44px 0 14px;color:#fff">أسئلة شائعة قبل الاشتراك</h2>
      <dl style="margin:0">
${faqList()}
      </dl>${CTA}`,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: FAQS.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: 'Ebnili AI App Builder',
        description:
          'منصة لبناء مواقع وتطبيقات الويب بالذكاء الاصطناعي مع معاينة فورية ومحرر كود وتصدير مشروع كامل.',
        brand: { '@type': 'Brand', name: 'Ebnili' },
        offers: {
          '@type': 'AggregateOffer',
          priceCurrency: 'USD',
          lowPrice: '0',
          highPrice: '14.99',
          offerCount: '3',
        },
      },
    ],
  },
  {
    file: 'pay.html',
    path: '/pay',
    nav: crumb('الدفع عبر أورانج كاش'),
    title: 'الدفع والتفعيل | إبنيلي — محفظة أورانج كاش 01207782741',
    description:
      'طريقة الدفع في إبنيلي: حوّل قيمة الباقة عبر محفظة أورانج كاش على الرقم 01207782741 أو الكود السريع #115#، ثم أرسل الرقم المرجعي من رسالة التأكيد لتفعيل اشتراكك فوراً.',
    inner: `      <h1 style="font-size:32px;font-weight:800;margin:0 0 10px">الدفع عبر محفظة أورانج كاش</h1>
      <p style="color:#94a3b8;margin:0 0 24px;max-width:720px">كل الاشتراكات تُفعَّل عبر محفظة أورانج كاش بالجنيه المصري. حوّل المبلغ، ثم أرسل الرقم المرجعي من رسالة التأكيد ليُفعَّل اشتراكك فوراً.</p>

      <div style="border:1px solid #fb923c;border-radius:18px;padding:24px;background:#0f172a;margin-bottom:28px">
        <div style="font-size:13px;color:#fb923c;font-weight:700">رقم المحفظة</div>
        <div style="font-size:34px;font-weight:800;color:#fff;font-family:monospace;direction:ltr;text-align:right">01207782741</div>
        <div style="font-size:13px;color:#94a3b8;margin-top:8px">أو اطلب الكود السريع <b style="color:#fff">#115#</b> من خط أورانج الخاص بك</div>
      </div>

      <h2 style="font-size:20px;font-weight:800;margin:0 0 14px;color:#fff">خطوات التفعيل</h2>
      <ol style="color:#cbd5e1;font-size:15px;padding-inline-start:22px">
        <li style="margin-bottom:10px">افتح تطبيق Orange Cash على هاتفك.</li>
        <li style="margin-bottom:10px">اختر خدمة «تحويل أموال».</li>
        <li style="margin-bottom:10px">أدخل رقم المحفظة <b style="color:#fff">01207782741</b>.</li>
        <li style="margin-bottom:10px">أدخل قيمة الباقة بالجنيه المصري كما هي معروضة في صفحة الأسعار.</li>
        <li style="margin-bottom:10px">أكّد التحويل بالرقم السري لمحفظتك.</li>
        <li>انسخ «الرقم المرجعي / كود العملية» من رسالة SMS وأرسله في صفحة الدفع.</li>
      </ol>${CTA}`,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: 'كيف أشترك في إبنيلي عبر محفظة أورانج كاش؟',
        step: [
          'افتح تطبيق Orange Cash',
          'اختر تحويل أموال',
          'أدخل رقم المحفظة 01207782741',
          'أدخل قيمة الباقة بالجنيه المصري',
          'أكّد التحويل بالرقم السري',
          'أرسل الرقم المرجعي من رسالة SMS',
        ].map((s, i) => ({ '@type': 'HowToStep', position: i + 1, text: s })),
      },
    ],
  },
  {
    file: 'ai-app-builder.html',
    path: '/ai-app-builder',
    nav: crumb('بناء التطبيقات بالذكاء الاصطناعي'),
    title: 'إبنيلي | ابنِ أي موقع أو تطبيق بالذكاء الاصطناعي خلال ثوانٍ',
    description:
      'منصة إبنيلي لبناء المواقع والتطبيقات بالذكاء الاصطناعي: اكتب فكرتك بالعربي أو بالإنجليزي واحصل على تطبيق ويب كامل بمعاينة فورية ومحرر كود وتصدير ZIP ونشر على نطاق مخصص. مجاني للبدء.',
    inner: `      <h1 style="font-size:34px;font-weight:800;margin:0 0 12px">ابنِ أي موقع أو تطبيق بالذكاء الاصطناعي خلال ثوانٍ</h1>
      <p style="color:#94a3b8;margin:0 0 26px;max-width:760px">إبنيلي منصة عربية لبناء المواقع والتطبيقات: تصف فكرتك بالعربي أو بالإنجليزي، فتحصل على تطبيق ويب كامل ومتجاوب مع معاينة حية وتعديل فوري وتصدير الكود.</p>

      <h2 style="font-size:20px;font-weight:800;margin:0 0 14px;color:#fff">ماذا يقدّم إبنيلي</h2>
      <ul style="color:#cbd5e1;font-size:15px;padding-inline-start:22px">
${FEATURES.map((f) => `        <li style="margin-bottom:10px">✓ ${f}</li>`).join('\n')}
      </ul>

      <h2 style="font-size:20px;font-weight:800;margin:32px 0 14px;color:#fff">مناسب لمن</h2>
      <p style="color:#94a3b8;font-size:15px">رواد الأعمال وأصحاب المتاجر الإلكترونية، المطورون المستقلون، المصممون، والوكالات التي تبني تطبيقات لعملائها — كل من يريد نموذجاً أولياً أو منتجاً حقيقياً بسرعة دون فريق تقني كامل.</p>${CTA}`,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Ebnili AI App Builder',
        alternateName: 'إبنيلي',
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Web',
        description:
          'منصة لبناء مواقع وتطبيقات الويب بالذكاء الاصطناعي مع معاينة فورية ومحرر كود وتصدير مشروع كامل.',
        offers: {
          '@type': 'AggregateOffer',
          priceCurrency: 'USD',
          lowPrice: '0',
          highPrice: '14.99',
          offerCount: '3',
        },
      },
    ],
  },
];

/** Build one page: breadcrumbs + the page's own JSON-LD. */
const render = (p) =>
  page({
    path: p.path,
    title: p.title,
    description: p.description,
    inner: p.inner,
    nav: p.nav,
    jsonLdBlocks: [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'إبنيلي', item: `${ORIGIN}/` },
          {
            '@type': 'ListItem',
            position: 2,
            name: p.title.split('|').pop().trim(),
            item: `${ORIGIN}${p.path}`,
          },
        ],
      },
      ...p.jsonLd,
    ],
  });

// ── Write ───────────────────────────────────────────────────────────────────
if (!existsSync(DIST)) {
  console.error('[seo] dist/ not found — run `npm run build` first.');
  process.exit(1);
}

const written = [];
for (const p of PAGES) {
  const html = render(p);
  writeFileSync(join(DIST, p.file), html, 'utf8');
  written.push(p.file);
  // A directory copy too: some crawlers request `/pricing/` with a trailing
  // slash, and without it that request 404s.
  const dir = join(DIST, p.file.replace(/\.html$/, ''));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html, 'utf8');
  written.push(`${p.file.replace(/\.html$/, '')}/index.html`);
}

console.log(`[seo] wrote ${written.length} files for ${ORIGIN}:`);
for (const w of written) console.log(`  · ${w}`);