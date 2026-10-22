import { useCallback, useEffect, useState } from 'react';
import { Github, Loader2 } from 'lucide-react';

interface GitHubRepo {
  full_name: string;
  description: string | null;
  html_url: string;
  default_branch: string;
  private: boolean;
}

interface GitHubImporterProps {
  language: 'ar' | 'en';
  onImported?: (files: Record<string, string>, repoFullName: string) => void;
  authUser: { id: string; email?: string } | null;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || body?.message || `HTTP ${res.status}`);
  return body as T;
}

function repoRefFromUrl(url: string): string | null {
  const m = String(url || '').match(/github\.com\/([^/]+)\/([^/]+)/);
  return m ? `${m[1]}/${m[2].replace(/\.git$/i, '')}` : null;
}

export function GitHubImporter({ language, onImported, authUser }: GitHubImporterProps) {
  const isAr = language === 'ar';
  const [step, setStep] = useState<'idle' | 'repos' | 'importing' | 'done'>('idle');
  const [loading, setLoading] = useState(false);
  const [linked, setLinked] = useState<boolean | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [files, setFiles] = useState<{ path: string; size: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [callbackUrl, setCallbackUrl] = useState<string | null>(null);
  const [urlDraft, setUrlDraft] = useState('');

  const t = {
    title: isAr ? 'استيراد من GitHub' : 'Import from GitHub',
    intro: isAr
      ? 'اربط حسابك بـ GitHub لاستيراد مستودعاتك، أو الصق رابط مستودع عام مباشرة.'
      : 'Connect your GitHub account to import your repositories, or paste a public repository URL.',
    btnLink: isAr ? 'ربط الحساب بـ GitHub' : 'Connect GitHub',
    linking: isAr ? 'جاري الربط...' : 'Connecting...',
    btnPublic: isAr ? 'استيراد مستودع عام بالرابط' : 'Import a public repo by URL',
    placeholder: isAr ? 'https://github.com/owner/repo' : 'https://github.com/owner/repo',
    importUrl: isAr ? 'استيراد' : 'Import',
    listTitle: isAr ? 'المستودعات المتاحة' : 'Your repositories',
    noRepos: isAr ? 'لا توجد مستودعات مرئية.' : 'No visible repositories.',
    noFiles: isAr ? 'لم يتم العثور على ملفات قابلة للاستيراد.' : 'No importable files were found in this repository.',
    files: isAr ? 'الملفات المستوردة' : 'Imported files',
    importing: isAr ? 'جاري استيراد الملفات...' : 'Importing files...',
    done: isAr ? 'تم الاستيراد بنجاح' : 'Import complete',
    error: isAr ? 'حدث خطأ، حاول مجددًا.' : 'Something went wrong — please try again.',
    privateNote: isAr ? 'الخاصة 🔒' : 'Private 🔒',
    truncated: isAr ? 'تم تجاهل بعض الملفات الكبيرة.' : 'Some large files were skipped.',
  };

  const loadRepos = useCallback(async () => {
    try {
      const d = await fetchJson<{ linked: boolean; repos?: GitHubRepo[] }>('/api/github/repos');
      setLinked(d.linked === true);
      if (d.linked && Array.isArray(d.repos)) { setRepos(d.repos); setStep('repos'); }
      else { setStep('idle'); }
    } catch {
      setLinked(false);
      setStep('idle');
    }
  }, []);

  useEffect(() => {
    void loadRepos();
    void fetchJson<{ configured: boolean; callbackUrl: string | null }>('/api/github/config')
      .then((d) => setCallbackUrl(d.configured ? d.callbackUrl : null))
      .catch(() => setCallbackUrl(null));
  }, [loadRepos]);

  const handleLink = async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await fetchJson<{ redirect: string }>('/api/github/link', { method: 'POST' });
      if (d.redirect) { window.location.href = d.redirect; return; }
    } catch (e) {
      setError(e instanceof Error ? e.message : t.error);
      setLoading(false);
    }
  };

  const handleImport = async (repoRef: string) => {
    const ref = repoRefFromUrl(repoRef) ?? repoRef;
    const [owner, repo] = ref.split('/');
    if (!owner || !repo) { setError(t.noFiles); return; }

    setLoading(true);
    setError(null);
    setFiles([]);
    try {
      const d = await fetchJson<{
        success: boolean;
        error?: string;
        tree?: { path: string; size?: number }[];
        files?: Record<string, string>;
        truncated?: boolean;
      }>(`/api/github/read?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&recursive=1`);

      const contents = d.files ?? {};
      const entries = (d.tree ?? []).filter((f) => typeof contents[f.path] === 'string');
      if (entries.length === 0) { setError(t.noFiles); setLoading(false); return; }
      setFiles(entries.map((f) => ({ path: f.path, size: f.size ?? 0 })));
      setStep('importing');
      onImported?.(contents, ref);
      if (d.truncated) setError(t.truncated);
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : t.error);
    } finally {
      setLoading(false);
    }
  };

  void authUser; // kept for the modal's "signed in as …" line

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 sm:p-5" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-3 mb-3">
        <Github className="w-5 h-5 text-rose-400 shrink-0" />
        <h3 className="text-sm font-black text-white">{t.title}</h3>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed mb-3">{t.intro}</p>

      {(step === 'idle' || linked === false) && (
        <div className="space-y-3">
          {linked === false && callbackUrl && (
            <div className="rounded-lg bg-slate-900/70 border border-slate-800 p-2.5 space-y-1">
              <p className="text-[11px] text-slate-400">
                {isAr ? 'عنوان العودة (Redirect URI) المسجّل لدى GitHub:' : 'Registered GitHub callback URL:'}
              </p>
              <code className="block text-[11px] text-emerald-300 break-all" dir="ltr">{callbackUrl}</code>
            </div>
          )}
          {callbackUrl !== null && (
            <button type="button" onClick={handleLink} disabled={loading} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-500 transition disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Github className="w-4 h-4" />}
              {loading ? t.linking : t.btnLink}
            </button>
          )}
          <div className="space-y-2 pt-1">
            <label className="text-[11px] font-bold text-slate-400" htmlFor="gh-repo-url">{t.btnPublic}</label>
            <div className="flex gap-2">
              <input
                id="gh-repo-url" type="text" dir="ltr" value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)} placeholder={t.placeholder}
                className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-500"
              />
              <button type="button" disabled={loading || !urlDraft.trim()} onClick={() => void handleImport(urlDraft.trim())} className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed">
                {t.importUrl}
              </button>
            </div>
          </div>
          {error && <p className="text-xs text-rose-400">{error}</p>}
        </div>
      )}

      {step === 'repos' && (
        <div className="space-y-3">
          <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider">{t.listTitle}</h4>
          {repos.length === 0 ? <p className="text-xs text-slate-500">{t.noRepos}</p> : (
            <div className="max-h-64 overflow-y-auto pe-1 space-y-1.5">
              {repos.map((r) => (
                <button key={r.full_name} type="button" onClick={() => void handleImport(r.full_name)} disabled={loading} className="w-full flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-slate-800/60 transition text-left cursor-pointer disabled:opacity-60">
                  <Github className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold text-white truncate" dir="ltr">{r.full_name}</span>
                    {r.description && <span className="block text-[10px] text-slate-500 truncate">{r.description}</span>}
                  </span>
                  {r.private && <span className="text-[10px] text-slate-500 shrink-0">{t.privateNote}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {(step === 'importing' || step === 'done') && (
        <div className="space-y-3">
          <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider">{loading ? t.importing : step === 'done' ? t.done : t.files}</h4>
          <div className="max-h-60 overflow-y-auto pe-1 space-y-1.5">
            {files.map((f) => (
              <div key={f.path} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-900/40">
                <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-xs text-slate-300" dir="ltr">{f.path}</span>
                <span className="text-[10px] text-slate-600 shrink-0">{Math.max(1, Math.round(f.size / 1024))} KB</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}