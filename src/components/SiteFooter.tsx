import { Phone, Mail, ShieldCheck, Scale, Info, type LucideIcon } from 'lucide-react';
import type { Language } from '../types';

export type FooterPageKey = 'about' | 'contact' | 'privacy' | 'terms';

export interface SiteFooterProps {
  language: Language;
  onOpenInfoPage?: (page: FooterPageKey) => void;
  /** Extra classes for the <footer> element itself. */
  className?: string;
}

/** Support number — the same one the checkout and the contact page use. */
const SUPPORT_PHONE = '01207782741';
const SUPPORT_PHONE_INTL = '+201207782741';

const LINKS: { key: FooterPageKey; ar: string; en: string; icon: LucideIcon }[] = [
  { key: 'about', ar: 'من نحن', en: 'About', icon: Info },
  { key: 'contact', ar: 'اتصل بنا', en: 'Contact', icon: Phone },
  { key: 'privacy', ar: 'سياسة الخصوصية', en: 'Privacy', icon: ShieldCheck },
  { key: 'terms', ar: 'الشروط والأحكام', en: 'Terms', icon: Scale },
];

/**
 * SITE FOOTER — the always-visible legal bar.
 *
 * WHY THIS EXISTS
 * ---------------
 * Privacy, Terms, Contact and About used to live ONLY inside a dropdown in the
 * account panel of the studio sidebar. That panel is hidden behind a toggle,
 * which means for a first-time visitor those documents were effectively
 * unreachable: a legal page nobody can find is not a legal page. Every
 * professional storefront puts them in the footer, permanently on screen.
 *
 * It is rendered in both places a user can actually land — the guest's
 * AuthGate and the marketing hero — and as a compact bar in the studio rail,
 * so there is no screen in this app without a visible route to them.
 *
 * SUPPORT NOTE: when a link has no handler (the static SEO pages, which are
 * plain HTML with no React) the item is still rendered as a labelled span
 * rather than a dead button, so the bar never shows a control that does
 * nothing when tapped.
 */
export const SiteFooter = ({ language, onOpenInfoPage, className = '' }: SiteFooterProps) => {
  const ar = language === 'ar';

  return (
    <footer
      className={`border-t border-slate-800/80 pt-4 pb-5 text-center font-['Cairo',sans-serif] ${className}`}
    >
      {/* Legal / company links — the whole point of the component. */}
      <nav aria-label={ar ? 'روابط الموقع' : 'Site links'} className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
        {LINKS.map((l) => {
          const Icon = l.icon;
          const label = ar ? l.ar : l.en;
          return onOpenInfoPage ? (
            <button
              key={l.key}
              type="button"
              onClick={() => onOpenInfoPage(l.key)}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] sm:text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{label}</span>
            </button>
          ) : (
            <span
              key={l.key}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] sm:text-xs font-semibold text-slate-500"
            >
              <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{label}</span>
            </span>
          );
        })}
      </nav>

      {/* Real, tappable contact details — never a bare string of digits. */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-slate-500">
        <a
          href={`tel:${SUPPORT_PHONE_INTL}`}
          dir="ltr"
          className="inline-flex items-center gap-1.5 font-bold text-emerald-400 hover:text-emerald-300 transition"
        >
          <Phone className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          {SUPPORT_PHONE}
        </a>
        <a
          href="mailto:elsayedsameh803@gmail.com"
          dir="ltr"
          className="inline-flex items-center gap-1.5 hover:text-white transition min-w-0"
        >
          <Mail className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">elsayedsameh803@gmail.com</span>
        </a>
      </div>

      <p className="mt-3 text-[10px] sm:text-[11px] text-slate-600 leading-relaxed">
        © 2026 {ar ? 'إبنيلي' : 'Ebnili'} — {ar ? 'كل الحقوق محفوظة' : 'All rights reserved'}
        <span className="mx-1.5 text-slate-700">·</span>
        {ar ? 'الجمهورية العربية مصر' : 'Arab Republic of Egypt'}
      </p>
    </footer>
  );
};