import { Home, Search, Sparkles, ArrowLeft, ArrowRight } from 'lucide-react';
import type { Language } from '../types';

interface NotFoundPageProps {
  language: Language;
  onNavigate: (path: string) => void;
}

/**
 * 404 — a real "page not found" instead of a dead end.
 *
 * WHY this exists: `vercel.json` rewrites every non-API path to index.html, so a
 * mistyped or retired URL used to boot the whole studio and drop the visitor on
 * the sign-in wall. From the outside that is indistinguishable from the site
 * being broken. This page states what happened, keeps the brand styling, and
 * gives two real ways forward.
 *
 * It also handles the case where the app is served at a URL that is not one of
 * the known routes, by offering the two paths that always exist.
 */
export const NotFoundPage = ({ language, onNavigate }: NotFoundPageProps) => {
  const ar = language === 'ar';
  const Arrow = ar ? ArrowRight : ArrowLeft;

  const links = [
    { label: ar ? 'الاستوديو' : 'Studio', path: '/' },
    { label: ar ? 'الأسعار' : 'Pricing', path: '/pricing' },
  ];

  return (
    <div
      dir={ar ? 'rtl' : 'ltr'}
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center px-5 py-12 text-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-rose-500 via-pink-500 to-amber-400 flex items-center justify-center text-white shadow-xl shadow-rose-500/20 mb-6">
        <Search className="w-7 h-7" aria-hidden="true" />
      </div>

      <p className="font-mono text-6xl sm:text-7xl font-black bg-gradient-to-r from-rose-400 via-pink-400 to-amber-300 bg-clip-text text-transparent leading-none">
        404
      </p>

      <h1 className="mt-5 text-xl sm:text-2xl font-extrabold text-white">
        {ar ? 'الصفحة غير موجودة' : 'This page does not exist'}
      </h1>

      <p className="mt-3 text-sm text-slate-400 max-w-md leading-8">
        {ar
          ? 'الرابط الذي فتحته غير صحيح أو تم حذف الصفحة. يمكنك العودة إلى الاستوديو أو متابعة التصفح من الروابط أدناه.'
          : 'The link you opened is incorrect or the page has been removed. Head back to the studio or keep browsing below.'}
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-white text-sm font-bold transition shadow-lg shadow-rose-500/25 cursor-pointer"
        >
          <Home className="w-4 h-4" aria-hidden="true" />
          <span>{ar ? 'العودة إلى الاستوديو' : 'Back to the studio'}</span>
        </button>

        {links.slice(1).map((link) => (
          <button
            key={link.path}
            type="button"
            onClick={() => onNavigate(link.path)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-bold transition cursor-pointer"
          >
            <span>{link.label}</span>
            <Arrow className="w-4 h-4" aria-hidden="true" />
          </button>
        ))}
      </div>

      <p className="mt-10 flex items-center gap-2 text-[11px] text-slate-600">
        <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
        <span>{ar ? 'إبنيلي | Ebnili AI' : 'Ebnili | AI App Builder'}</span>
      </p>
    </div>
  );
};
