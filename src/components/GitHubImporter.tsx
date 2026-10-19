import { useState } from 'react';
import { Github, Loader2, GithubLogoIcon } from 'lucide-react';

interface GitHubImporterProps {
  language: 'ar' | 'en';
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.message || body?.error || `请求失败 (${res.status})`);
  return body as T;
}

export function GitHubImporter({ language }: GitHubImporterProps) {
  const [step, setStep] = useState<'idle' | 'linking' | 'repos' | 'importing' | 'done'>('idle');
  const [loading, setLoading] = useState(false);
  const [repos, setRepos] = useState<{ full_name: string; description: string | null; html_url: string }[]>([]);
  const [files, setFiles] = useState<{ path: string; type: string; size: number }[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const t = {
    title: 'استيراد من GitHub',
    btnLink: 'ربط الحساب بـ GitHub',
    listTitle: 'المستودعات المتاحة',
    noRepos: 'لا توجد مستودعات مرئية.',
    noRepo: 'لم يتم العثور على أي مستودع.',
    files: 'الملفات المستوردة',
    importing: 'استيراد الملفات...',
    done: 'تم الانتهاء',
  };

  const handleLink = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/github/link', { method: 'POST', credentials: 'same-origin' });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || 'HTTP ' + res.status); }
      const d = await res.json();
      if (d.redirect) { window.location.href = d.redirect; return; }
      setLoading(false);
    } catch { setError(t.error); setLoading(false); }
  };

  const handleRepos = async () => {
    setLoading(true); setError(null);
    try { setRepos(await fetchJson<{ repos: typeof repos }>('/api/github/repos').then(d => d.repos || [])); setStep('repos'); }
    catch { setError(t.error); setLoading(false); }
  };

  const handleImport = async (url: string) => {
    setLoading(true); setError(null); setFiles([]);
    try {
      const m = url.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!m) throw new Error(t.noRepo);
      const [_, o, r] = m;
      const tree = await fetchJson<{ tree: { path: string; type: string }[] }>(`/api/github/read?owner=${o}&repo=${r}&recursive=1`);
      if (!tree.tree) throw new Error(t.noRepo);
      setFiles(tree.tree.filter(f => f.type === 'blob' && !f.path.includes('.git/') && !f.path.includes('node_modules/')));
      setActive(files[0]?.path ?? null); setStep('importing');
    } catch { setError(t.error); setLoading(false); }
  };

  const t2 = { title: 'استيراد من GitHub', listTitle: 'المستودعات المتاحة', noRepos: 'لا توجد مستودعات مرئية.', noRepo: 'لم يتم العثور على أي مستودع.', files: 'الملفات المستوردة', importing: 'استيراد الملفات...', done: 'تم الانتهاء' };
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 sm:p-5" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-3 mb-3">
        <GithubLogoIcon className="w-5 h-5 text-rose-400 shrink-0" />
        <h3 className="text-sm font-black text-white">{t.title}</h3>
      </div>

      {step === 'idle' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-400 leading-relaxed" dir="ltr">اربط حسابك بـ GitHub لاستيراد الملفات إلى استوديو إبنيلي.</p>
          <button type="button" onClick={handleLink} disabled={loading} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-500 transition disabled:opacity-60">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GithubLogoIcon className="w-4 h-4" />}
            {loading ? 'جاري الربط...' : t.btnLink}
          </button>
          {error && <p className="text-xs text-rose-400">{error}</p>}
        </div>
      )}

      {step === 'repos' && (
        <div className="space-y-3">
          <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider">{t.listTitle}</h4>
          {repos.length === 0 ? <p className="text-xs text-slate-500">{t.noRepos}</p> : (
            <div className="max-h-48 overflow-y-auto pe-1 space-y-1.5">
              {repos.map(r => (
                <button key={r.full_name} type="button" onClick={() => handleImport(r.html_url)} className="w-full flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-slate-800/60 transition text-left">
                  <GithubLogoIcon className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="block text-xs font-bold text-white truncate">{r.full_name}</span>
                  <span className="block text-[10px] text-slate-500 truncate">{r.description || ''}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 'importing' && (
        <div className="space-y-3">
          <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider">{t.importing}</h4>
          <div className="max-h-60 overflow-y-auto pe-1 space-y-1.5">
            {files.map(f => (
              <button key={f.path} type="button" onClick={() => {}} className="w-full flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-slate-800/40 transition text-left">
                <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-xs text-slate-300" dir="ltr">{f.path}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
