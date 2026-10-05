// TYPE-ONLY: written as a plain `import type` with an explicit `.ts` extension
// so this module can be loaded by Node's test runner (`node --test
// --experimental-strip-types`) as well as by Vite.
//
// WHY: a value import of `'../types'` (no extension) resolves fine under Vite's
// bundler but throws ERR_MODULE_NOT_FOUND under Node's ESM resolver, which made
// the pricing data untestable from `npm test`. `import type` is erased at
// compile time, so nothing is added to the bundle either.
import type { SubscriptionPlan } from '../types.ts';

export const ORANGE_CASH_WALLET_NUMBER = '01207782741';
export const ORANGE_CASH_USSD_CODE = '#115#';

/**
 * PRICING — single source of truth for the whole site.
 *
 * List prices are quoted in USD (Pro $9.99 / Business $14.99). Payments are
 * collected through Orange Cash, an EGYPTIAN wallet that can only receive
 * Egyptian pounds, so each plan also carries the exact EGP amount to transfer.
 * Both numbers are derived here and nowhere else — the old 249 / 2,490 /
 * 599 / 5,990 EGP prices are gone from the entire codebase.
 *
 * TO UPDATE THE RATE: change USD_TO_EGP only. Every EGP figure recalculates.
 */
export const USD_TO_EGP = 50;

/** Yearly billing is charged for 10 months (two months free), in USD. */
const YEARLY_MONTHS = 10;

/** USD list price → the exact EGP amount to send to the wallet. */
export function egpAmount(usd: number): number {
  // Round to a clean, memorable transfer amount.
  const raw = usd * USD_TO_EGP;
  return Math.round(raw) === raw ? raw : Math.round(raw);
}

const PRO_USD = 9.99;
const BUSINESS_USD = 14.99;
const PRO_USD_YEARLY = Number((PRO_USD * YEARLY_MONTHS).toFixed(2));
const BUSINESS_USD_YEARLY = Number((BUSINESS_USD * YEARLY_MONTHS).toFixed(2));

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    nameAr: 'الباقة المجانية',
    nameEn: 'Starter Free',
    taglineAr: 'لتجربة المنصة وبناء نماذج أولية سريعة',
    taglineEn: 'For exploring Ebnili and building quick prototypes',
    priceMonthly: 0,
    priceYearly: 0,
    currency: 'USD',
    payEgpMonthly: 0,
    payEgpYearly: 0,
    badgeAr: 'للمبتدئين',
    badgeEn: 'Starter',
    featuresAr: [
      'توليد حتى 5 تطبيقات يومياً عبر الذكاء الاصطناعي',
      'المعاينة الفورية على مختلف أحجام الشاشات',
      'محرر كود متكامل مع التعديل اليدوي',
      'وضع المعاينة البصرية التجريبي',
      'تخزين محلي للمشاريع والإصدارات',
      'دعم عبر المجتمع وقاعدة المعرفة'
    ],
    featuresEn: [
      'Generate up to 5 AI apps per day',
      'Instant live preview on Desktop, Tablet & Mobile',
      'Built-in Code Editor with live synchronization',
      'Basic visual inspector tool',
      'Local revision history and snapshot restore',
      'Community knowledge base & guides'
    ],
    limitsAr: '5 طلبات ذكاء اصطناعي يومياً',
    limitsEn: '5 AI generations / day'
  },
  {
    id: 'pro',
    nameAr: 'باقة المحترفين (Pro)',
    nameEn: 'Professional Pro',
    taglineAr: 'للمطورين ورواد الأعمال وصناع المنتجات الرقمية',
    taglineEn: 'For creators, developers and indie hackers shipping fast',
    priceMonthly: PRO_USD,
    priceYearly: PRO_USD_YEARLY,
    currency: 'USD',
    payEgpMonthly: egpAmount(PRO_USD),
    payEgpYearly: egpAmount(PRO_USD_YEARLY),
    badgeAr: 'الأكثر طلباً 🔥',
    badgeEn: 'Most Popular 🔥',
    isPopular: true,
    featuresAr: [
      'توليد وتعديل لا محدود للتطبيقات بالذكاء الاصطناعي (Unlimited)',
      'تصدير كود المشروع بالكامل كملف ZIP نظيف جاهز للنشر (React + Tailwind)',
      'تعديل بصري مباشر على أي عنصر بنقرة زر (Visual Inspector Pro)',
      'ربط قواعد بيانات Supabase و PostgreSQL و APIs خارجية',
      'نشر مباشر على نطاقات مخصصة وتضمين (Embed) في المواقع',
      'أولوية معالجة قصوى وسرعة استجابة فائقة بمحرك إبنيلي الذكي',
      'حفظ ومزامنة لا محدودة لسجل الإصدارات والتراجع',
      'تفعيل فوري ومباشر عبر فودافون كاش أو أورانج كاش (01207782741)'
    ],
    featuresEn: [
      'Unlimited AI app prompts and iterative refinements',
      'Full source code ZIP export ready for production (React & Tailwind)',
      'Advanced Visual Inspector: Click & modify any element directly',
      'Connect Supabase, PostgreSQL schemas & external APIs',
      'Deploy to live global preview & embed iframe widgets',
      'Priority Ebnili AI processing pipeline with zero wait times',
      'Unlimited revision history and rollback checkpoints',
      'Fast activation via Orange Cash wallet (01207782741) after transfer review'
    ],
    limitsAr: 'توليد غير محدود + تصدير كامل',
    limitsEn: 'Unlimited prompts + Full code export'
  },
  {
    id: 'business',
    nameAr: 'باقة الأعمال والشركات',
    nameEn: 'Business & Agency',
    taglineAr: 'للشركات والوكالات التي تبني تطبيقات لعملائها',
    taglineEn: 'For agencies and studios building software for clients',
    priceMonthly: BUSINESS_USD,
    priceYearly: BUSINESS_USD_YEARLY,
    currency: 'USD',
    payEgpMonthly: egpAmount(BUSINESS_USD),
    payEgpYearly: egpAmount(BUSINESS_USD_YEARLY),
    badgeAr: 'للوكالات والفرق',
    badgeEn: 'Agencies',
    featuresAr: [
      'كل مزايا باقة المحترفين Pro بلا أي حدود',
      'تصدير كود White-label بدون شعارات المنصة',
      'أولوية حصرية في خوادم المعالجة السريعة (Dedicated Priority Queue)',
      'دعم فني خاص ومباشر عبر واتساب وأورانج كاش VIP',
      'إمكانية توليد لوحات تحكم وأنظمة معقدة وتطبيقات SaaS كاملة',
      'تفعيل فوري لعدة مشاريع مع إمكانية استخراج فواتير ضريبية للمؤسسات'
    ],
    featuresEn: [
      'Everything in Pro tier with zero restrictions',
      'White-label source code exports (no platform watermark)',
      'Dedicated priority queue for instant generation',
      'Direct VIP tech support via WhatsApp & Orange Cash desk',
      'Complex multi-tier SaaS and CRM full-stack generation',
      'Corporate invoicing & priority payment validation'
    ],
    limitsAr: 'غير محدود + دعم VIP + White-label',
    limitsEn: 'Unlimited + VIP support + White-label'
  }
];

export const ORANGE_CASH_STEPS_AR = [
  {
    step: 1,
    title: 'افتح محفظة Orange Cash',
    desc: 'افتح تطبيق Orange Cash على هاتفك، أو اطلب الكود السريع #115# من خط أورانج الخاص بك.'
  },
  {
    step: 2,
    title: 'اختر تحويل أموال',
    desc: 'من القائمة الرئيسية، اختر "تحويل أموال" (Money Transfer).'
  },
  {
    step: 3,
    title: 'أدخل رقم محفظة الاستلام',
    desc: `أدخل رقم المحفظة المعتمد لمنصة إبنيلي: ${ORANGE_CASH_WALLET_NUMBER} وتأكد من صحة الرقم.`
  },
  {
    step: 4,
    title: 'أدخل المبلغ المطلوب',
    desc: 'أدخل قيمة الباقة المختارة بالجنيه المصري كما هي معروضة في صفحة الدفع.'
  },
  {
    step: 5,
    title: 'اكتب الرقم السري لمحفظتك',
    desc: 'أدخل الرقم السري (PIN) لمحفظتك لتأكيد التحويل.'
  },
  {
    step: 6,
    title: 'سجل تفاصيل المعاملة هنا',
    desc: 'احتفظ برسالة التأكيد النصية SMS وانسخ "الرقم المرجعي / كود العملية" وأدخله في النموذج أدناه لتفعيل اشتراكك فورياً.'
  }
];

export const ORANGE_CASH_STEPS_EN = [
  {
    step: 1,
    title: 'Open Orange Cash',
    desc: 'Launch the Orange Cash mobile app, or dial #115# from your registered Orange line.'
  },
  {
    step: 2,
    title: 'Select Money Transfer',
    desc: 'From the main service menu, choose "Money Transfer".'
  },
  {
    step: 3,
    title: 'Enter Destination Wallet',
    desc: `Input the official Ebnili wallet number: ${ORANGE_CASH_WALLET_NUMBER} and confirm.`
  },
  {
    step: 4,
    title: 'Enter Exact Amount',
    desc: 'Enter the plan amount in Egyptian pounds exactly as shown on the payment page.'
  },
  {
    step: 5,
    title: 'Confirm with PIN',
    desc: 'Enter your personal wallet PIN code to authorize the transfer.'
  },
  {
    step: 6,
    title: 'Submit Reference Code',
    desc: 'Copy the Transaction Reference / Operation ID from your SMS confirmation and submit it below to activate your subscription instantly.'
  }
];
