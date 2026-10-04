import { useState, useCallback, type ReactNode } from 'react';
import {
  X, Phone, Mail, MapPin, Clock, Building2, ShieldCheck, Scale, Info, Copy, Check, ExternalLink,
} from 'lucide-react';
import { Language } from '../types';
import { useModalAccessibility } from './useModalAccessibility';

/**
 * SITE PAGES — About / Contact / Privacy / Terms.
 *
 * Replaces the old floating WhatsApp bubble with the kind of company + legal
 * footer every professional SaaS ships. The content is real (business name,
 * the live Orange Cash / support number, how billing actually works, what is
 * and is not stored) rather than filler, because a policy that contradicts the
 * product is worse than no policy at all.
 *
 * OWNER NOTE: update the three constants below when business details change.
 */

const SUPPORT_PHONE = '01207782741';
const SUPPORT_PHONE_INTL = '+201207782741';
const SUPPORT_EMAIL = 'elsayedsameh803@gmail.com';

export type PageKey = 'about' | 'contact' | 'privacy' | 'terms';

interface InfoPagesModalProps {
  onClose: () => void;
  language: Language;
  /** Open straight on one page (used by the header links). */
  initialPage?: PageKey;
}

const TABS: { key: PageKey; ar: string; en: string; icon: typeof Info }[] = [
  { key: 'about', ar: 'من نحن', en: 'About', icon: Info },
  { key: 'contact', ar: 'اتصل بنا', en: 'Contact', icon: Phone },
  { key: 'privacy', ar: 'سياسة الخصوصية', en: 'Privacy', icon: ShieldCheck },
  { key: 'terms', ar: 'الشروط والأحكام', en: 'Terms', icon: Scale },
];

export const InfoPagesModal = ({ onClose, language, initialPage = 'about' }: InfoPagesModalProps) => {
  const [page, setPage] = useState<PageKey>(initialPage);
  const [copied, setCopied] = useState(false);
  const ar = language === 'ar';
  const handleClose = useCallback(() => onClose(), [onClose]);
  const dialogRef = useModalAccessibility(true, handleClose);

  const copyPhone = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_PHONE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the number is on screen anyway */
    }
  };

  const Section = ({ title, children }: { title: string; children: ReactNode }) => (
    <section className="mb-6">
      <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
        <span className="w-1 h-4 rounded bg-rose-500" />
        {title}
      </h3>
      <div className="text-[13px] leading-8 text-slate-300 space-y-2 ps-3">{children}</div>
    </section>
  );

  // WHY z-[300]: this dialog is opened FROM the AuthGate, which is itself
  // `z-[200]`. At the old `z-[120]` the entire legal page rendered BEHIND
  // the sign-in wall, so clicking Privacy / Terms / Contact did nothing
  // visible — the exact symptom that was reported. It must outrank every
  // surface that can sit underneath it.
  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-3 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={ar ? 'معلومات المنصة' : 'Site information'}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        className="w-full max-w-3xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-400 flex items-center justify-center text-white text-base font-bold shrink-0">
              ⚡
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white truncate">
                {ar ? 'إبنيلي | Ebnili AI' : 'Ebnili | AI App Builder'}
              </h2>
              <p className="text-[11px] text-slate-400 truncate">
                {ar ? 'المنصة، الدعم، الخصوصية والشروط' : 'About, support, privacy and terms'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition shrink-0"
            aria-label={ar ? 'إغلاق' : 'Close'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 px-3 py-2 bg-slate-950/60 border-b border-slate-800 overflow-x-auto shrink-0">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setPage(t.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 ${
                  page === t.key
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{ar ? t.ar : t.en}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 select-text">
          {page === 'about' && (
            <div>
              <Section title={ar ? 'من نحن' : 'About us'}>
                <p>
                  {ar
                    ? 'إبنيلي (Ebnili) منصة مصرية لبناء مواقع وتطبيقات الويب بالذكاء الاصطناعي. تكتب فكرتك بالعربية أو الإنجليزية، ويكتب الذكاء الاصطناعي الكود الفعلي كاملاً — صفحات، تصميم متجاوب، وتفاعلات حقيقية — داخل معاينة حية تعمل في المتصفح مباشرة.'
                    : 'Ebnili is an Egyptian AI platform for building real websites and web apps. You describe the idea, and the engine writes the complete working code — pages, responsive design and real interactions — inside a live in-browser preview.'}
                </p>
              </Section>

              <Section title={ar ? 'ماذا نفعل بالضبط' : 'What we actually do'}>
                <ul className="list-disc ps-5 space-y-1">
                  <li>{ar ? 'توليد ملف HTML واحد متكامل يعمل مباشرة في المتصفح.' : 'Generate one complete HTML file that runs straight in the browser.'}</li>
                  <li>{ar ? 'تعديل الكود بالكلام، أو بالنقر على أي عنصر في المعاينة.' : 'Edit the result by typing, or by clicking any element in the preview.'}</li>
                  <li>{ar ? 'تصدير المشروع كملفات مصدر حقيقية (ZIP) جاهزة للنشر.' : 'Export the project as real source files (ZIP), ready to deploy.'}</li>
                  <li>{ar ? 'نشر ومشاركة المشروع على رابط مباشر.' : 'Publish and share the project on a direct link.'}</li>
                </ul>
              </Section>

              <Section title={ar ? 'كيف تُحتسب الباقات' : 'How billing works'}>
                <p>
                  {ar
                    ? 'الاستخدام المجاني محدود بعدد طلبات يومي. الباقات المدفوعة (Pro / Business) تُشترى عبر محفظة أورانج كاش على الرقم 01207782741. لا يتم تفعيل أي باقة تلقائياً: يتم التحقق من التحويل يدوياً من قبل إدارة المنصة ثم تفعيلها. لا نخزّن أي بيانات بطاقة بنكية.'
                    : 'Free usage is capped per day. Paid plans (Pro / Business) are bought through the Orange Cash wallet at 01207782741. No plan is ever activated automatically: the transfer is verified manually by the team and then granted. We never store card details.'}
                </p>
              </Section>

              <Section title={ar ? 'مركز العمليات' : 'Operations'}>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Building2 className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{ar ? 'إدارة المنصة: سامح السيد' : 'Operated by: Sameh Elsayed'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span dir="ltr">{SUPPORT_PHONE_INTL}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <Mail className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span dir="ltr" className="truncate">{SUPPORT_EMAIL}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{ar ? 'يومياً 9 ص – 11 م (بتوقيت مصر)' : 'Daily 9:00 – 23:00 (Egypt time)'}</span>
                  </div>
                </div>
              </Section>
            </div>
          )}

          {page === 'contact' && (
            <div>
              <Section title={ar ? 'تواصل معنا مباشرة' : 'Talk to us directly'}>
                <p>
                  {ar
                    ? 'لو عندك سؤال عن التوليد، أو مشكلة في الدفع، أو طلب خاص — كلّمونا على الخط المخصص أو ابعتلنا إيميل، والرد خلال ساعات العمل نفسها.'
                    : 'Questions about generation, a payment issue or a special request — call the dedicated line or email us, and expect a reply within working hours.'}
                </p>
              </Section>

              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/25 p-4 mb-5">
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="w-11 h-11 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] text-emerald-300/80 font-bold mb-1">
                      {ar ? 'الخط المخصص للدعم والتفعيل' : 'Dedicated support & activation line'}
                    </div>
                    <a
                      href={`tel:${SUPPORT_PHONE_INTL}`}
                      dir="ltr"
                      className="text-2xl font-black text-white hover:text-emerald-300 transition tracking-wider inline-block"
                    >
                      {SUPPORT_PHONE}
                    </a>
                    <div className="text-[11px] text-emerald-300/70 mt-1">
                      {ar ? 'متاح للاتصال والواتساب' : 'Calls and WhatsApp'}
                    </div>
                  </div>
                  <button
                    onClick={copyPhone}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shrink-0"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? (ar ? 'تم النسخ' : 'Copied') : (ar ? 'نسخ الرقم' : 'Copy')}
                  </button>
                </div>
              </div>

              <Section title={ar ? 'طرق التواصل' : 'Ways to reach us'}>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[11px] text-slate-400">{ar ? 'البريد الإلكتروني' : 'Email'}</div>
                      <a href={`mailto:${SUPPORT_EMAIL}`} dir="ltr" className="text-[13px] text-white hover:text-rose-300 transition break-all">
                        {SUPPORT_EMAIL}
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <div className="text-[11px] text-slate-400">{ar ? 'ساعات العمل' : 'Working hours'}</div>
                      <div className="text-[13px] text-white">
                        {ar ? 'يومياً 9 ص – 11 م (بتوقيت مصر)' : 'Daily 9:00 – 23:00 (Egypt time)'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
                    <div>
                      <div className="text-[11px] text-slate-400">{ar ? 'النطاق' : 'Coverage'}</div>
                      <div className="text-[13px] text-white">
                        {ar ? 'الجمهورية العربية مصر — خدمة أونلاين عن بُعد' : 'Arab Republic of Egypt — fully online / remote'}
                      </div>
                    </div>
                  </div>
                </div>
              </Section>

              <Section title={ar ? 'دفع الاشتراكات' : 'Subscription payments'}>
                <div className="rounded-xl border border-orange-500/30 bg-orange-950/20 p-3 flex items-center gap-3 flex-wrap">
                  <div className="text-[11px] text-orange-300/80 font-bold">
                    {ar ? 'محفظة أورانج كاش' : 'Orange Cash wallet'}
                  </div>
                  <a href={`tel:${SUPPORT_PHONE_INTL}`} dir="ltr" className="text-lg font-black text-white hover:text-orange-300 transition tracking-wider">
                    {SUPPORT_PHONE}
                  </a>
                  <span className="text-[11px] text-slate-400">
                    {ar ? 'ثم أرسل الإيصال على نفس الرقم والتفعيل خلال ساعة' : 'then send the receipt to the same number — activated within an hour'}
                  </span>
                </div>
              </Section>
            </div>
          )}

          {page === 'privacy' && (
            <div>
              <Section title={ar ? 'ملخص' : 'Summary'}>
                <p>
                  {ar
                    ? 'نجمع أقل قدر ممكن من البيانات. لا نبيع بياناتك ولا نشاركها مع أي طرف ثالث عدا مزوّد الدفع عند تنفيذ عملية اشتراك مدفوعة.'
                    : 'We collect the minimum. We never sell your data and never share it with third parties, except with the payment provider when you buy a paid plan.'}
                </p>
              </Section>

              <Section title={ar ? 'البيانات التي نحفظها' : 'What we store'}>
                <ul className="list-disc ps-5 space-y-1">
                  <li>
                    {ar
                      ? 'حسابك: الاسم والبريد الإلكتروني وصورة الحساب — يقرؤها مزوّد الدخول (Google أو GitHub) عند تسجيل الدخول.'
                      : 'Your account: name, e-mail and avatar — read from the sign-in provider when you log in.'}
                  </li>
                  <li>
                    {ar
                      ? 'مشاريعك وملفاتك ورسائل المحادثة — محفوظة في متصفحك (localStorage) على جهازك، ولا يُرسل إلى خوادمنا إلا نص البرومبت الذي تكتبه.'
                      : 'Your projects, files and chat — kept in your browser (localStorage). Only the prompt you type is sent to our servers.'}
                  </li>
                  <li>
                    {ar
                      ? 'معرّف جهاز مجهول وعدّاد استخدام — لتطبيق الحد اليومي ومنع إساءة الاستخدام.'
                      : 'An anonymous device id and usage counters — to enforce the daily limit and prevent abuse.'}
                  </li>
                </ul>
              </Section>

              <Section title={ar ? 'ما لا نخزّنه' : 'What we never store'}>
                <ul className="list-disc ps-5 space-y-1">
                  <li>{ar ? 'أي بيانات بطاقة بنكية — الدفع يتم عبر أورانج كاش.' : 'No card data — payments run through Orange Cash.'}</li>
                  <li>{ar ? 'كلمات مرور — الدخول بجوجل / جيت هاب فقط.' : 'No passwords — sign-in is Google / GitHub only.'}</li>
                  <li>{ar ? 'أي محتوى لم تكتبه أنت في خانة الإدخال.' : 'Anything you did not type yourself.'}</li>
                </ul>
              </Section>

              <Section title={ar ? 'الكوكيز وحقوقك' : 'Cookies & your rights'}>
                <p>
                  {ar
                    ? 'نستخدم كوكيز HttpOnly للجلسة ولحساب الإدارة فقط، بدون كوكيز تتبع أو إعلانات. ويمكنك في أي وقت طلب حذف بياناتك أو تصدير مشاريعك — راسلنا على 01207782741.'
                    : 'We use HttpOnly cookies for your session and the admin console only — no tracking or advertising cookies. You may request deletion of your data or an export of your projects at any time: contact 01207782741.'}
                </p>
              </Section>
            </div>
          )}

          {page === 'terms' && (
            <div>
              <Section title={ar ? 'قبول الشروط' : 'Acceptance'}>
                <p>
                  {ar
                    ? 'باستخدامك منصة إبنيلي فإنك توافق على هذه الشروط. إن لم توافق، يرجى عدم استخدام المنصة.'
                    : 'By using Ebnili you agree to these terms. If you do not agree, please do not use the platform.'}
                </p>
              </Section>

              <Section title={ar ? 'استخدام المنصة' : 'Use of the platform'}>
                <ul className="list-disc ps-5 space-y-1">
                  <li>{ar ? 'لكل مستخدم حساب واحد. مشاركة الحساب أو بيعه مخالفة.' : 'One account per user. Sharing or reselling an account is a violation.'}</li>
                  <li>{ar ? 'الاستخدام الآلي المكثف (سكربتات / بوتات) ممنوع لأنه يكسر خطة الاستخدام العادل.' : 'Heavy automated use (scripts/bots) is prohibited — it breaks fair use.'}</li>
                  <li>{ar ? 'ممنوع إنتاج محتوى غير قانوني أو مضلل أو ينتهك حقوق الآخرين.' : 'Do not produce illegal, deceptive or infringing content.'}</li>
                </ul>
              </Section>

              <Section title={ar ? 'الملكية الفكرية' : 'Intellectual property'}>
                <p>
                  {ar
                    ? 'يحق لك ملكية كل ما تولّده من مشاريع وأكواد. اسم "إبنيلي" وشعاره ومحرك المنصة مملوك لنا ولا يجوز استخدامه بدون إذن.'
                    : 'You own everything you generate. The "Ebnili" name, logo and platform engine belong to us.'}
                </p>
              </Section>

              <Section title={ar ? 'المدفوعات والاسترجاع' : 'Payments & refunds'}>
                <ul className="list-disc ps-5 space-y-1">
                  <li>{ar ? 'الدفع عبر محفظة أورانج كاش على 01207782741 فقط.' : 'Payment is by Orange Cash wallet at 01207782741 only.'}</li>
                  <li>{ar ? 'لا يتم التفعيل تلقائياً — التحقق يدوي ثم التفعيل.' : 'No auto-activation: the transfer is verified manually, then granted.'}</li>
                  <li>{ar ? 'الاسترجاع ممكن خلال 14 يوماً إذا لم يتجاوز الاستهلاك حداً معقولاً.' : 'Refunds are considered within 14 days if usage was reasonable.'}</li>
                </ul>
              </Section>

              <Section title={ar ? 'حدود المسؤولية والتغييرات' : 'Liability & changes'}>
                <p>
                  {ar
                    ? 'الخدمة تُقدَّم "كما هي"، ومسؤوليتنا محدودة بقيمة ما دفعته في آخر 30 يوماً. قد نحدّث هذه الشروط عند الحاجة — آخر تحديث: 27 سبتمبر 2026.'
                    : 'The service is provided "as is"; liability is capped at what you paid in the last 30 days. We may update these terms — last updated 27 September 2026.'}
                </p>
              </Section>
            </div>
          )}
        </div>


        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-3 flex-wrap shrink-0">
          <span className="text-[11px] text-slate-500">
            © 2026 {ar ? 'إبنيلي' : 'Ebnili'} — {ar ? 'كل الحقوق محفوظة' : 'All rights reserved'}
          </span>
          <a
            href={`tel:${SUPPORT_PHONE_INTL}`}
            dir="ltr"
            className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition"
          >
            <Phone className="w-3.5 h-3.5" />
            {SUPPORT_PHONE}
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
        </div>
      </div>
    </div>
  );
};

