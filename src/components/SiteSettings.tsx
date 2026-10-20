import { useCallback, useEffect, useState } from 'react';
import {
  X,
  Settings,
  Globe,
  Link,
  AlertTriangle,
  Loader2,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import type { RemoteProject } from '../lib/projects';
import { DbUnavailableError, fetchRemoteProject, fetchRemoteProjects } from '../lib/projects';
import { CustomDomainCard } from './CustomDomainCard';

interface SiteSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  language: 'ar' | 'en';
  projectId: string;
  onDomainChanged?: () => void;
}

export function SiteSettings({
  isOpen,
  onClose,
  language,
  projectId,
  onDomainChanged,
}: SiteSettingsProps) {
  const ar = language === 'ar';
  const [project, setProject] = useState<RemoteProject | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // WHY A SEPARATE FLAG: the empty-state heading used to say "مشروع غير موجود"
  // even when the account simply has no saved project yet — two very different
  // situations that need two different messages.
  const [noSavedProject, setNoSavedProject] = useState(false);
  // Set when the requested id was stale and we fell back to another project,
  // so the UI can say which project is actually being shown.
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);

  const fetchProject = useCallback(async () => {
    // Guard: empty projectId means "no saved project yet" — never hit the API
    // with `/api/projects/` (empty id) which returns 404/NOT_FOUND and shows
    // the misleading "مشروع غير موجود".
    setError(null);
    setNoSavedProject(false);
    setFallbackNotice(null);
    // Set BEFORE the branches: otherwise the modal paints the "not found"
    // empty state for one frame while the request is still in flight.
    setLoading(true);

    if (!projectId?.trim()) {
      // The id is missing. Before giving up, try the account's own list — the
      // id may simply not have reached the modal yet (it is set on click).
      const list = await fetchRemoteProjects().catch(() => [] as RemoteProject[]);
      const newest = list[0] ?? null;
      if (newest) {
        setProject(newest);
        setLoading(false);
        return;
      }
      setProject(null);
      setNoSavedProject(true);
      setLoading(false);
      return;
    }

    try {
      const direct = await fetchRemoteProject(projectId);
      if (direct) {
        setProject(direct);
        return;
      }
      // SELF-HEAL: the id is stale (guest-era local id, deleted row, or a row
      // owned by another account — `GET /api/projects/:id` filters
      // `ebnily_projects` by owner_id so all three come back NOT_FOUND → null).
      // Fall back to the newest saved project so the domain form loads instead
      // of the dead-end "مشروع غير موجود".
      const list = await fetchRemoteProjects().catch(() => [] as RemoteProject[]);
      const newest = list[0] ?? null;
      if (newest) {
        const full = await fetchRemoteProject(newest.id).catch(() => null);
        setProject(full ?? newest);
        setFallbackNotice(
          ar
            ? `المشروع المطلوب غير موجود، وتم فتح أحدث مشروع محفوظ لديك: ${newest.name}`
            : `The requested project was not found; showing your most recently saved project: ${newest.name}`,
        );
      } else {
        setProject(null);
        setNoSavedProject(true);
        setError(
          ar
            ? 'لم نتمكن من العثور على المشروع المطلوب. تأكد أن المشروع محفوظ بنفس الحساب.'
            : 'We could not find the requested project. Make sure it is saved under this account.',
        );
      }
    } catch (e) {
      setProject(null);
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'AUTH_REQUIRED') {
        setError(ar ? 'انتهت الجلسة — سجّل الدخول ثم أعد فتح الإعدادات.' : 'Session expired — sign in again, then reopen settings.');
      } else if (msg === 'DB_UNAVAILABLE' || e instanceof DbUnavailableError) {
        setError(ar ? 'قاعدة البيانات غير متاحة حالياً — حاول بعد قليل.' : 'Database unavailable right now — try again shortly.');
      } else {
        setError(ar ? 'تعذّر تحميل المشروع — تحقق من الاتصال وحاول مجدداً.' : 'Could not load the project — check your connection and retry.');
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, ar]);

  useEffect(() => {
    // Run even when projectId is '' so the guard above sets the honest
    // "no saved project" message instead of a blank modal.
    if (isOpen) {
      fetchProject();
    }
  }, [isOpen, projectId, fetchProject]);

  const handleDomainChanged = useCallback(() => {
    void fetchProject();
    onDomainChanged?.();
  }, [fetchProject, onDomainChanged]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={ar ? 'إعدادات الموقع' : 'Site Settings'}
    >
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-2xl mx-4 sm:mx-6 lg:mx-8 max-h-[90vh] overflow-y-auto">
        <div className="rounded-xl border border-slate-800 bg-slate-950 shadow-2xl p-6 sm:p-8 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2.5">
              <Settings className="w-5 h-5 text-rose-400" aria-hidden="true" />
              <h2 className="text-lg font-black text-white">{ar ? 'إعدادات الموقع' : 'Site Settings'}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:text-white hover:bg-slate-800 transition"
              aria-label={ar ? 'إغلاق' : 'Close'}
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8 text-slate-400 text-xs">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
              {ar ? 'جارٍ تحميل المشروع...' : 'Loading project...'}
            </div>
          ) : project ? (
            <>
              {fallbackNotice && (
                <div
                  role="status"
                  className="mb-4 rounded-lg border border-amber-700/60 bg-amber-950/40 px-3 py-2 text-[11px] text-amber-200"
                >
                  {fallbackNotice}
                </div>
              )}
              <div className="flex items-center gap-3 mb-6 px-2">
                <Globe className="w-5 h-5 text-slate-400" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-black text-white truncate">{project.name}</h3>
                  <p className="text-[11px] text-slate-500 truncate">
                    {project.id} · {ar ? 'معرف المشروع' : 'Project ID'}
                  </p>
                </div>
                <a
                  href={project.custom_domain ? `https://${project.custom_domain}` : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-disabled={!project.custom_domain}
                  onClick={(e) => { if (!project.custom_domain) e.preventDefault(); }}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    project.custom_domain
                      ? 'bg-rose-600 text-white hover:bg-rose-500'
                      : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-50'
                  }`}
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                  {ar ? 'فتح الموقع' : 'Open site'}
                </a>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 md:p-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Link className="w-5 h-5 text-rose-400" aria-hidden="true" />
                  <h3 className="text-sm font-black text-white">{ar ? 'الدومين الخاص' : 'Custom Domain'}</h3>
                </div>
                <CustomDomainCard
                  project={project}
                  language={language}
                  onDomainChanged={handleDomainChanged}
                />
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4 mt-4">
                <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider mb-2">
                  {ar ? 'ملاحظات هامة' : 'Important notes'}
                </h4>
                <ul className="text-xs text-slate-400 space-y-1 list-disc pl-4">
                  <li>
                    {ar ? 'تأكد أن الموقع منشور قبل ربط الدومين الخاص.' : 'Make sure your site is published before linking a custom domain.'}
                  </li>
                  <li>
                    {ar ? 'بعد إضافة سجل CNAME في لوحة نطاقاتك (مثل GoDaddy أو Namecheap)، انتظر بضع دقائق ثم اضغط "تحقق من الدومين".' : 'After adding the CNAME record at your domain registrar (e.g. GoDaddy, Namecheap), wait a few minutes then click "Verify domain".'}
                  </li>
                  <li>
                    {ar ? 'في حال ظهور خطأ، راجع الرسالة أسفل الكارت لمعرفة السبب والحل المقترح.' : 'If an error appears, read the message below the card for the cause and suggested fix.'}
                  </li>
                </ul>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-6 text-center">
              <AlertTriangle className="w-6 h-6 mx-auto text-rose-400 mb-3" aria-hidden="true" />
              <h3 className="text-sm font-black text-white mb-2">
                {noSavedProject
                  ? (ar ? 'لا يوجد مشروع محفوظ' : 'No saved project')
                  : (ar ? 'مشروع غير موجود' : 'Project not found')}
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                {error ?? (
                  noSavedProject
                    ? (ar
                        ? 'لم تحفظ أي مشروع على هذا الحساب بعد. أنشئ مشروعاً ثم احفظه لتتمكن من ربط دومين خاص.'
                        : 'You have not saved a project on this account yet. Create and save a project to link a custom domain.')
                    : (ar ? 'لم نتمكن من العثور على المشروع المطلوب.' : 'We could not find the requested project.')
                )}
              </p>
              <button
                type="button"
                onClick={() => void fetchProject()}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                {ar ? 'إعادة المحاولة' : 'Retry'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SiteSettings;