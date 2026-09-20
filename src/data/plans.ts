import { SubscriptionPlan } from '../types';

export const ORANGE_CASH_WALLET_NUMBER = '01207782741';
export const ORANGE_CASH_USSD_CODE = '#115#';

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    nameAr: 'الباقة المجانية',
    nameEn: 'Starter Free',
    taglineAr: 'لتجربة المنصة وبناء نماذج أولية سريعة',
    taglineEn: 'For exploring Ebnili and building quick prototypes',
    priceMonthly: 0,
    priceYearly: 0,
    currency: 'EGP',
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
    priceMonthly: 249,
    priceYearly: 2490, // 2 months free
    currency: 'EGP',
    badgeAr: 'الأكثر طلباً 🔥',
    badgeEn: 'Most Popular 🔥',
    isPopular: true,
    featuresAr: [
      'توليد وتعديل لا محدود للتطبيقات بالذكاء الاصطناعي (Unlimited)',
      'تصدير كود المشروع بالكامل كملف ZIP نظيف جاهز للنشر (React + Tailwind)',
      'تعديل بصري مباشر على أي عنصر بنقرة زر (Visual Inspector Pro)',
      'ربط قواعد بيانات Supabase و PostgreSQL و APIs خارجية',
      'نشر مباشر على نطاقات مخصصة وتضمين (Embed) في المواقع',
      'أولوية معالجة قصوى وسرعة استجابة فائقة بمحركات Gemini Flash',
      'حفظ ومزامنة لا محدودة لسجل الإصدارات والتراجع',
      'تفعيل فوري ومباشر عبر فودافون كاش أو أورانج كاش (01207782741)'
    ],
    featuresEn: [
      'Unlimited AI app prompts and iterative refinements',
      'Full source code ZIP export ready for production (React & Tailwind)',
      'Advanced Visual Inspector: Click & modify any element directly',
      'Connect Supabase, PostgreSQL schemas & external APIs',
      'Deploy to live global preview & embed iframe widgets',
      'Priority Gemini processing pipeline with zero wait times',
      'Unlimited revision history and rollback checkpoints',
      'Instant activation via Orange Cash wallet (01207782741)'
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
    priceMonthly: 599,
    priceYearly: 5990,
    currency: 'EGP',
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
    desc: 'أدخل قيمة الباقة المختارة (مثلاً 249 ج.م للباقة الشهرية، أو 2490 ج.م للباقة السنوية).'
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
    desc: 'Enter the exact plan amount (e.g., 249 EGP for Pro Monthly, or 2,490 EGP for Yearly).'
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
