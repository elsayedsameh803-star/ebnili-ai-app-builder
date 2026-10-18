import { useCallback, useEffect, useState } from 'react';
import {
  X,
  Settings,
  Globe,
  Link,
  AlertTriangle,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import type { RemoteProject } from '../lib/projects';
import { fetchRemoteProject } from '../lib/projects';
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

  const fetchProject = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchRemoteProject(projectId);
      setProject(data);
    } catch {
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isOpen && projectId) {
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
                  disabled={!project.custom_domain}
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
              <h3 className="text-sm font-black text-white mb-2">{ar ? 'مشروع غير موجود' : 'Project not found'}</h3>
              <p className="text-xs text-slate-400">{ar ? 'لم نتمكن من العثور على المشروع المطلوب.' : 'We could not find the requested project.'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SiteSettings;