import { useCallback, useEffect, useState } from 'react';
import {
  X,
  Github,
  FolderGit2,
  Lock,
  Globe,
  Search,
  Link2,
  Loader2,
  AlertTriangle,
  Star,
} from 'lucide-react';
import { Language } from '../types';
import {
  disconnectGitHub,
  fetchGitHubStatus,
  fetchMyRepos,
  importRepo,
  startGitHubLink,
  GitHubImportError,
  GitHubNotLinkedError,
  type GitHubRepo,
  type GitHubImportResult,
} from '../lib/projects';

interface GitHubImportModalProps {
  onClose: () => void;
  language: Language;
  /** Hands the imported files to the studio. */
  onImported: (result: GitHubImportResult) => void;
}

/**
 * GitHub repository import.
 *
 * Two explicit paths, because they need different permissions:
 *   • Linked GitHub → the user's own repositories, including private ones.
 *   • Not linked (typical for a Google-only account) → a clear prompt to connect
 *     GitHub, plus a public-repository URL that works with no connection at all.
 *
 * The token stays on the server; this component only ever sees names and text.
 */
export const GitHubImportModal = ({ onClose, language, onImported }: GitHubImportModalProps) => {
  const ar = language === 'ar';
  const [status, setStatus] = useState<{ linked: boolean; login: string } | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [repoInput, setRepoInput] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const t = useCallback((en: string, arabic: string) => (ar ? arabic : en), [ar]);

  // Ask whether GitHub is linked, then load the list only when it is.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const s = await fetchGitHubStatus();
      if (cancelled) return;
      setStatus({ linked: s.linked, login: s.login });
      if (!s.linked) {
        setLoading(false);
        return;
      }
      try {
        const data = await fetchMyRepos();
        if (cancelled) return;
        setRepos(data.repos);
        setListError(null);
      } catch (err) {
        if (cancelled) return;
        setListError(
          err instanceof GitHubNotLinkedError
            ? t('Reconnect your GitHub account.', 'اربط حساب GitHub من جديد.')
            : t('Could not load your repositories.', 'تعذر تحميل مستودعاتك.'),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const runImport = useCallback(
    async (fullName: string) => {
      setError(null);
      setBusy(fullName);
      try {
        const result = await importRepo(fullName);
        onImported(result);
        onClose();
      } catch (err) {
        setError(
          err instanceof GitHubImportError
            ? err.message
            : t('Import failed.', 'فشل الاستيراد.'),
        );
      } finally {
        setBusy(null);
      }
    },
    [onClose, onImported, t],
  );

  const visible = repos.filter((r) =>
    query.trim()
      ? `${r.name} ${r.description} ${r.language}`
          .toLowerCase()
          .includes(query.trim().toLowerCase())
      : true,
  );

  // Retry after a failed list load, without closing and reopening the modal.
  const retryList = () => {
    setListError(null);
    setLoading(true);
    void fetchMyRepos()
      .then((d) => {
        setRepos(d.repos);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl text-slate-100">
        <div className="flex items-center justify-between p-5 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
              <Github className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">
                {t('Import from GitHub', 'استيراد من GitHub')}
              </h3>
              <p className="text-[11px] text-slate-400">
                {t(
                  'Read an existing repository and edit it here.',
                  'اقرأ مستودعاً موجوداً وحرّره هنا.',
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
            aria-label={t('Close', 'إغلاق')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-slate-400 text-xs">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('Loading…', 'جارٍ التحميل…')}
            </div>
          ) : null}

          {status?.linked ? (
            <>
              <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                <span className="text-[11px] text-emerald-300 truncate">
                  {t('Connected as', 'مرتبط بحساب')} <strong>@{status.login}</strong>
                </span>
                <button
                  onClick={() => {
                    void disconnectGitHub().then(() => {
                      setStatus({ linked: false, login: '' });
                      setRepos([]);
                    });
                  }}
                  className="text-[11px] text-slate-400 hover:text-white shrink-0 transition"
                >
                  {t('Disconnect', 'إلغاء الربط')}
                </button>
              </div>

              {listError ? (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-2">
                  <span className="truncate">{listError}</span>
                  <button onClick={retryList} className="shrink-0 font-bold">
                    {t('Retry', 'إعادة المحاولة')}
                  </button>
                </div>
              ) : null}
              {!listError && (
                <>
                  <div className="relative">
                    <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-3.5 h-3.5 text-slate-500" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={t('Search repositories…', 'ابحث في المستودعات…')}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl ps-9 pe-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/60"
                    />
                  </div>

                  {visible.length === 0 ? (
                    <p className="text-center text-xs text-slate-500 py-8">
                      {t('No repositories match.', 'لا توجد مستودعات مطابقة.')}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {visible.map((repo) => (
                        <button
                          key={repo.id}
                          disabled={busy !== null}
                          onClick={() => void runImport(repo.fullName)}
                          className="w-full text-start p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-950 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <div className="flex items-center gap-2">
                            {busy === repo.fullName ? (
                              <Loader2 className="w-4 h-4 animate-spin text-emerald-400 shrink-0" />
                            ) : (
                              <FolderGit2 className="w-4 h-4 text-slate-400 shrink-0" />
                            )}
                            <span className="font-semibold text-xs text-slate-100 truncate">
                              {repo.name}
                            </span>
                            {repo.private ? (
                              <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                            ) : (
                              <Globe className="w-3 h-3 text-slate-500 shrink-0" />
                            )}
                            {repo.stars > 0 && (
                              <span className="flex items-center gap-0.5 text-[10px] text-slate-500 shrink-0">
                                <Star className="w-2.5 h-2.5" />
                                {repo.stars}
                              </span>
                            )}
                          </div>
                          {repo.description && (
                            <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                              {repo.description}
                            </p>
                          )}
                          <p className="text-[10px] text-slate-600 mt-1">
                            {repo.fullName} · {repo.defaultBranch}
                            {repo.language ? ` · ${repo.language}` : ''}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}

                  <PublicRepoInput
                    value={repoInput}
                    onChange={setRepoInput}
                    busy={busy}
                    onImport={(name) => void runImport(name)}
                    t={t}
                  />
                </>
              )}
            </>
          ) : null}

          {status && !status.linked ? (
            <div className="space-y-3">
              {/* Not linked — the Google-only case. Say what to do, and offer
                  the alternative that needs no permissions at all. */}
              <div className="flex items-start gap-3 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30">
                <Link2 className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-indigo-200">
                    {t('Your account is not linked to GitHub', 'حسابك غير مرتبط بـ GitHub')}
                  </p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {t(
                      'Connect GitHub to browse your own repositories, including private ones. The connection is read-only.',
                      'اربط GitHub لعرض مستودعاتك الخاصة والعامة. الربط للقراءة فقط ولا يمكنه تعديل أي مستودع.',
                    )}
                  </p>
                </div>
              </div>

              <button
                onClick={startGitHubLink}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-bold transition cursor-pointer"
              >
                <Github className="w-4 h-4" />
                {t('Connect GitHub', 'ربط حساب GitHub')}
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-800" />
                <span className="text-[10px] text-slate-500">
                  {t('or import a public repository', 'أو استورد مستودعاً عاماً')}
                </span>
                <div className="flex-1 h-px bg-slate-800" />
              </div>

              <PublicRepoInput
                value={repoInput}
                onChange={setRepoInput}
                busy={busy}
                onImport={(name) => void runImport(name)}
                t={t}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

/** The no-permission path: paste any public repository URL. */
const PublicRepoInput = ({
  value,
  onChange,
  busy,
  onImport,
  t,
}: {
  value: string;
  onChange: (v: string) => void;
  busy: string | null;
  onImport: (name: string) => void;
  t: (en: string, ar: string) => string;
}) => (
  <div className="pt-2 border-t border-slate-800 space-y-2">
    <label className="text-[11px] text-slate-400">
      {t('Public repository URL', 'رابط مستودع عام')}
    </label>
    <div className="flex gap-2">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value.trim()) onImport(value.trim());
        }}
        placeholder="owner/repository"
        dir="ltr"
        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/60 font-mono"
      />
      <button
        disabled={!value.trim() || busy !== null}
        onClick={() => onImport(value.trim())}
        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition shrink-0"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('Import', 'استيراد')}
      </button>
    </div>
  </div>
);
