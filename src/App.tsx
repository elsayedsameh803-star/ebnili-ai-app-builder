import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { Sparkles } from 'lucide-react';
import { Header } from './components/Header';
import { ChatSidebar } from './components/ChatSidebar';
import { PreviewFrame } from './components/PreviewFrame';
import { CodeEditor } from './components/CodeEditor';
import { NewProjectHero } from './components/NewProjectHero';
import { AuthGate } from './components/AuthGate';
import { InfoPagesModal, type PageKey } from './components/InfoPagesModal';
import { getDeviceFingerprint } from './utils/fingerprint';
import { fetchCurrentUser, logout as authLogout, isOwnerAccount, fetchWithTimeout } from './lib/auth';
import {
  cacheProjectBody,
  createRemoteProject,
  deleteProject,
  deleteRemoteProject,
  fetchRemoteProject,
  fetchRemoteProjects,
  getActiveId,
  hasRealContent,
  listProjects,
  loadProject,
  newProjectId,
  readCachedProjectBody,
  renameProject,
  saveProject,
  setActiveId,
  updateRemoteProject,
  type ProjectSummary,
  type RemoteProject,
  type GitHubImportResult,
  pickEntryFile,
} from './lib/projects';

// ── Code splitting ───────────────────────────────────────────────────────────
// These surfaces are modal and rarely opened, yet each one used to be part of
// the first paint. Loading them on demand keeps the initial bundle small, which
// is the single biggest win for visitors on a phone.
const VisualInspectorModal = lazy(() => import('./components/VisualInspectorModal').then((m) => ({ default: m.VisualInspectorModal })));
const ExportModal = lazy(() => import('./components/ExportModal').then((m) => ({ default: m.ExportModal })));
const DeployModal = lazy(() => import('./components/DeployModal').then((m) => ({ default: m.DeployModal })));
const IntegrationsModal = lazy(() => import('./components/IntegrationsModal').then((m) => ({ default: m.IntegrationsModal })));
const SubscriptionModal = lazy(() => import('./components/SubscriptionModal').then((m) => ({ default: m.SubscriptionModal })));
const GeminiStudioModal = lazy(() => import('./components/GeminiStudioModal').then((m) => ({ default: m.GeminiStudioModal })));
const GitHubImportModal = lazy(() => import('./components/GitHubImportModal').then((m) => ({ default: m.GitHubImportModal })));
const AdminDashboardModal = lazy(() => import('./components/AdminDashboardModal').then((m) => ({ default: m.AdminDashboardModal })));
const PricingPage = lazy(() => import('./components/PricingPage').then((m) => ({ default: m.PricingPage })));
const PayPage = lazy(() => import('./components/PayPage').then((m) => ({ default: m.PayPage })));
const AuthModal = lazy(() => import('./components/AuthModal').then((m) => ({ default: m.AuthModal })));
const NotFoundPage = lazy(() => import('./components/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));
import { 
  AppProject, 
  ChatMessage, 
  DeviceMode, 
  ViewMode, 
  Language, 
  SelectedElementInfo, 
  VersionHistoryItem,
  UserSubscription,
  AuthUser
} from './types';

/**
 * Make a partially-received document renderable.
 *
 * While the model streams, the HTML we hold is almost always incomplete (no
 * `</body>`, no `</html>`, maybe not even `<head>` yet). Feeding that straight
 * into the preview iframe shows a blank page, so we close the tags ourselves
 * while the stream is still running. The final commit runs the same function,
 * which makes a truncated answer degrade into a working page instead of a
 * blank one.
 */
function closeDocument(raw: string): string {
  let out = (raw || '').trim();
  if (!out) return '';
  if (!/<html[\s>]/i.test(out)) {
    out =
      `<!DOCTYPE html>\n<html lang="ar" dir="rtl">\n<head>\n<meta charset="UTF-8">\n` +
      `<meta name="viewport" content="width=device-width, initial-scale=1.0">\n</head>\n<body>\n${out}`;
  } else if (!/<!DOCTYPE/i.test(out)) {
    out = `<!DOCTYPE html>\n${out}`;
  }
  if (!/<\/body>/i.test(out)) out += '\n</body>';
  if (!/<\/html>/i.test(out)) out += '\n</html>';
  return out;
}

/**
 * Absolute ceiling for the session probe, independent of the fetch timeout.
 * If `/api/auth/me` has not answered by now we stop waiting and let the app
 * render anyway — a guest sees the login wall, a signed-in user sees the
 * studio. Nothing about identity may hold the interface hostage.
 */
const AUTH_WATCHDOG_MS = 6_000;

/**
 * Public routes.
 *
 * This app has no router on purpose — `vercel.json` already rewrites every
 * non-/api path to index.html, so `/pricing` and `/pay` are real URLs handled
 * here. They render BEFORE the auth gate on purpose: a pricing page and a
 * checkout page must be reachable by someone who has not signed in yet.
 */
function currentRoute(): { path: string; params: URLSearchParams } {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  return { path, params: new URLSearchParams(window.location.search) };
}

/**
 * The "no project yet" document. It is deliberately an honest, empty state — the
 * studio never pretends a placeholder is a generated site.
 */
function createBlankProject(): AppProject {
  const code = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ابدأ مشروعك</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #020617;
      color: #e2e8f0;
      font-family: "Cairo", system-ui, -apple-system, sans-serif;
      padding: 24px;
      text-align: center;
    }
    .wrap { max-width: 520px; }
    .badge {
      display: inline-block;
      font-size: 11px;
      letter-spacing: .08em;
      color: #fda4af;
      border: 1px solid #fb7185;
      background: rgba(244,63,94,.1);
      border-radius: 999px;
      padding: 4px 12px;
      margin-bottom: 18px;
    }
    h1 { font-size: 26px; font-weight: 800; margin-bottom: 12px; }
    p { font-size: 14px; line-height: 1.9; color: #94a3b8; }
    .hint { margin-top: 18px; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="wrap">
    <span class="badge">لم يتم توليد أي موقع بعد</span>
    <h1>اكتب فكرتك في مربع المحادثة</h1>
    <p>صف الموقع أو التطبيق اللي تريده بالتفصيل — الصفحات، الألوان، المحتوى، والتفاعلات — وسيتم بناء موقع حقيقي يعمل داخل هذه المعاينة.</p>
    <p class="hint">لا يوجد محتوى تجريبي مسبق — كل ما تراه هنا سيأتي من الذكاء الاصطناعي.</p>
  </div>
</body>
</html>`;

  return {
    id: 'draft',
    name: 'مشروع جديد',
    description: 'معاينة جاهزة للتطوير المباشر.',
    code,
    files: { 'index.html': code },
    activeFile: 'index.html',
    versions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    theme: { primaryColor: '#6366f1', borderRadius: '12px', darkMode: false },
  };
}

export default function App() {
  const [language, setLanguage] = useState<Language>('ar');
  const [hasStarted, setHasStarted] = useState<boolean>(true); // start right into the working studio or hero
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop');
  const [isInspectMode, setIsInspectMode] = useState<boolean>(false);

  // Inspector & Modal States
  const [selectedElement, setSelectedElement] = useState<SelectedElementInfo | null>(null);
  const [showExport, setShowExport] = useState<boolean>(false);
  const [showDeploy, setShowDeploy] = useState<boolean>(false);
  const [showIntegrations, setShowIntegrations] = useState<boolean>(false);
  const [showSubscription, setShowSubscription] = useState<boolean>(false);
  const [showGeminiStudio, setShowGeminiStudio] = useState<boolean>(false);
  const [showGitHubImport, setShowGitHubImport] = useState<boolean>(false);
  /** Why a GitHub link attempt came back failed, shown inside the import dialog. */
  const [gitHubLinkError, setGitHubLinkError] = useState<string | null>(null);
  const [showAdminDashboard, setShowAdminDashboard] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  // Which of the site pages is open (About / Contact / Privacy / Terms).
  const [infoPage, setInfoPage] = useState<PageKey | null>(null);

  // ── User authentication (Google / GitHub) ─────────────────────────────────
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  // `null` until /api/auth/me answers, so the gate doesn't flash for a
  // returning user who already has a valid session cookie.
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  // Set when the session check could not complete. The studio still opens — a
  // failed identity lookup is not a reason to block the user; the error is
  // surfaced only when they actually try to use the engine.
  const [authProbeFailed, setAuthProbeFailed] = useState<boolean>(false);

  // ── Session bootstrap (never blocks the UI) ─────────────────────────────────
  // Two independent guarantees, because a stuck splash is the worst failure
  // this app can have:
  //   1. `fetchCurrentUser()` is deadline-bounded (AUTH_INIT_TIMEOUT_MS).
  //   2. `finally` always clears the gate, and a hard watchdog clears it even
  //      if the fetch somehow never settles.
  useEffect(() => {
    let settled = false;
    fetchCurrentUser()
      .then((user) => {
        settled = true;
        if (user) setAuthUser(user);
      })
      .catch(() => {
        settled = true;
        setAuthProbeFailed(true);
      })
      .finally(() => {
        if (settled) setAuthChecked(true);
      });

    // Hard watchdog: whatever happens upstream, the studio becomes reachable.
    const watchdog = setTimeout(() => {
      setAuthChecked(true);
      if (!settled) setAuthProbeFailed(true);
    }, AUTH_WATCHDOG_MS);
    return () => clearTimeout(watchdog);
  }, []);

  // The server redirects back to `/?auth=success` or `/?auth_error=<code>`.
  // Read it once, surface the outcome, then scrub it from the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('auth_error');
    const success = params.get('auth');
    if (!error && !success) return;

    if (error) setAuthError(error);
    if (success) {
      setAuthError(null);
      fetchCurrentUser()
        .then((user) => {
          if (user) setAuthUser(user);
        })
        .catch(() => setAuthProbeFailed(true))
        .finally(() => setAuthChecked(true));
    }
    setShowAuthModal(Boolean(error));

    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  // Returning from the GitHub link: `/?github=linked` or `/?github_error=<code>`.
  // The importer opens straight away so the user picks a repository next, and
  // the query string is scrubbed exactly like the auth one.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linked = params.get('github');
    const failure = params.get('github_error');
    if (!linked && !failure) return;

    setShowGitHubImport(true);
    if (failure) {
      // GitHub itself refuses to even show its consent screen when the callback
      // URL is not registered, so it never redirects back here — meaning the
      // visitor lands on github.com's error page with no idea what to change.
      // These codes are the ones our own callback produces; explain each one in
      // plain language instead of showing a raw identifier.
      const messages: Record<string, string> = {
        auth_required:
          'انتهت جلستك قبل اكتمال الربط مع GitHub. سجّل الدخول مجدداً ثم أعد المحاولة.',
        state_mismatch:
          'انتهت صلاحية طلب الربط. أعد المحاولة من جديد.',
        exchange_failed:
          'تعذّر إتمام الربط مع GitHub. تأكد من صحة مفاتيح GITHUB_CLIENT_ID و GITHUB_CLIENT_SECRET.',
        not_configured:
          'الربط مع GitHub غير مُعد على الخادم. أضف مفاتيح GITHUB_CLIENT_ID و GITHUB_CLIENT_SECRET في Vercel.',
        account_required:
          'الربط متاح فقط بعد تسجيل الدخول بحسابك أولاً.',
      };
      setGitHubLinkError(
        messages[failure] ||
          (language === 'ar'
            ? 'تعذّر إتمام الربط مع GitHub. حاول مرة أخرى.'
            : 'Could not complete the GitHub link. Please try again.'),
      );
    }
    window.history.replaceState({}, '', window.location.pathname);
  }, [language]);

  const handleLogout = useCallback(async () => {
    await authLogout();
    setAuthUser(null);
  }, []);

  /**
   * The session expired while the tab was open (cookie TTL, sign-out elsewhere).
   * Re-probe once to be sure, and only then drop to the sign-in wall — the
   * studio is never blocked by a service hiccup, and the user is never shown a
   * misleading "server error".
   */
  const handleSessionExpired = useCallback(async (lang: Language) => {
    const user = await fetchCurrentUser().catch(() => null);
    if (user) {
      // The cookie is actually fine (a transient blip) — keep working.
      setAuthUser(user);
      setAuthProbeFailed(false);
      return;
    }
    setAuthUser(null);
    setAuthProbeFailed(false);
    setAuthError(lang === 'ar' ? 'انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى.' : 'Session expired — please sign in again.');
    setChatMessages((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        sender: 'assistant',
        text:
          lang === 'ar'
            ? '⚠️ انتهت جلستك. سجّل الدخول مرة أخرى للمتابعة.'
            : '⚠️ Your session expired. Please sign in again to continue.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  }, []);

  // Owner-only surfaces (admin panel, backend/database console). The verdict is
  // the server's — see `isOwnerAccount` — and it gates both the header buttons
  // and the modals themselves, so an ordinary user never mounts them at all.
  const isOwner = isOwnerAccount(authUser);

  // Subscription State with Orange Cash support
  const [subscription, setSubscription] = useState<UserSubscription>({
    tier: 'free',
    planName: 'Starter Free (المجانية)',
    status: 'active',
    generationsUsedToday: 1,
    generationsLimitToday: 5,
    canExportZip: false,
    canDeployCustomDomain: false,
    canUseVisualInspector: true,
    priorityAiModel: false,
    transactions: [],
  });

  // Fetch current subscription from backend.
  // NON-CRITICAL: this only decorates the UI (badge, limits), so it is bounded
  // and fails silently — a slow billing service must never delay the studio.
  useEffect(() => {
    fetchWithTimeout('/api/subscriptions/current', {}, 10_000)
      .then((res) => res.json().catch(() => null))
      .then((data) => {
        if (data && data.subscription) {
          setSubscription(data.subscription);
        }
      })
      .catch((err) => {
        console.warn('Could not fetch current subscription:', err);
      });
  }, []);

  // Keep <html lang> in sync with the active language (a11y & font selection).
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  // Live "building…" timer: a silent 100-second wait feels broken, so the
  // counter is what tells the user the engine is still working.
  useEffect(() => {
    if (!isGenerating) return;
    const id = setInterval(() => {
      setStreamSeconds((Date.now() - streamStartedAt.current) / 1000);
    }, 1000);
    return () => clearInterval(id);
  }, [isGenerating]);

  const AUTOSAVE_KEY = 'ebnili_autosave_v1';


  const [currentPlanSteps, setCurrentPlanSteps] = useState<string[]>([]);
  // Prompt of the last generation that failed, so the chat can offer a real
  // "try again" instead of making the user retype a long specification.
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  // Streaming progress: seconds elapsed and whether tokens are arriving.
  const [streamSeconds, setStreamSeconds] = useState<number>(0);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const streamStartedAt = useRef<number>(Date.now());

  // Active Project State — starts on the honest empty state (see createBlankProject).
  const [project, setProject] = useState<AppProject>(createBlankProject);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'm-1',
      sender: 'assistant',
      text: 'أهلاً بك! اكتب فكرة تطبيقك أو موقعك في مربع النص أدناه، وسأقوم ببنائه وتطويره لك فورياً مع المعاينة الحية وإمكانية التعديل المباشر.',
      timestamp: 'الآن',
    },
  ]);

  // ── Multi-project store ───────────────────────────────────────────────────
  // `projectId` is null while the user is still on the starter screen; the first
  // real generation mints an id, and everything after that is saved against it.
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectList, setProjectList] = useState<ProjectSummary[]>([]);
  // Set when the server store cannot be reached, so the UI can say so honestly
  // instead of pretending the save landed.
  const [projectsSyncError, setProjectsSyncError] = useState<string | null>(null);

  // Signed-in accounts read and write the server database; a guest keeps the
  // on-device store so the studio still works before anyone logs in.
  const useRemoteStore = Boolean(authUser);

  const toSummary = (row: RemoteProject): ProjectSummary => ({
    id: row.id,
    name: row.name,
    description: '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    preview: row.preview ?? '',
    chatCount: 0,
    versionCount: Array.isArray(row.versions) ? row.versions.length : 0,
    hasContent: hasRealContent(row.code ?? ''),
  });

  const refreshProjectList = useCallback(async () => {
    if (!authUser) {
      try {
        setProjectList(listProjects());
      } catch {
        setProjectList([]);
      }
      return;
    }
    try {
      const rows = await fetchRemoteProjects();
      setProjectList(rows.map(toSummary));
      setProjectsSyncError(null);
    } catch {
      // Do NOT fall back to a stale local list here — that is exactly how one
      // account ends up seeing another's projects.
      setProjectList([]);
      setProjectsSyncError('تعذّر تحميل مشاريعك من الخادم.');
    }
  }, [authUser]);

  // Auto-save: every project is stored under its own id, debounced, so a
  // refresh (or a crashed tab) never costs a generated site.
  useEffect(() => {
    if (!projectId || isGenerating) return;
    if (!hasRealContent(project.code)) return;
    const timer = setTimeout(() => {
      if (authUser) {
        // The server owns the row; the id came from it, so this is an update.
        void updateRemoteProject(projectId, {
          name: project.name,
          code: project.code,
          files: project.files,
          versions: project.versions,
          theme: project.theme,
        })
          .then(() => {
            cacheProjectBody(projectId, project);
            void refreshProjectList();
          })
          .catch(() => setProjectsSyncError('تعذّر حفظ المشروع على الخادم.'));
        return;
      }
      saveProject(projectId, project, chatMessages);
      void refreshProjectList();
    }, 800);
    return () => clearTimeout(timer);
  }, [projectId, project, chatMessages, isGenerating, authUser, refreshProjectList]);

  // Restore the last project on load. For a signed-in account the server is the
  // source of truth; the on-device copy is only a cache of what it confirmed.
  useEffect(() => {
    void (async () => {
      await refreshProjectList();
      const activeId = getActiveId();
      if (!activeId) return;

      if (authUser) {
        const remote = await fetchRemoteProject(activeId).catch(() => null);
        if (remote) {
          setProjectId(remote.id);
          setProject((prev) => ({
            ...prev,
            name: remote.name,
            code: remote.code,
            files: remote.files ?? prev.files,
            versions: remote.versions ?? prev.versions,
            theme: remote.theme ?? prev.theme,
          }));
          setHasStarted(true);
        }
        return;
      }

      const stored = loadProject(activeId);
      if (!stored?.project) return;
      setProjectId(activeId);
      setProject(stored.project);
      setHasStarted(true);
      if (Array.isArray(stored.chatMessages) && stored.chatMessages.length > 0) {
        setChatMessages(stored.chatMessages);
      }
    })();
    // Restore pass — runs once on mount, not as a sync loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  // Switch to another project from the list.
  const handleSelectProject = useCallback(
    (id: string) => {
      if (id === projectId) return;
      if (!authUser) {
        const stored = loadProject(id);
        if (!stored?.project) {
          deleteProject(id);
          void refreshProjectList();
          return;
        }
        setProjectId(id);
        setActiveId(id);
        setProject(stored.project);
        setChatMessages(
          Array.isArray(stored.chatMessages) && stored.chatMessages.length > 0
            ? stored.chatMessages
            : [
                {
                  id: 'm-1',
                  sender: 'assistant',
                  text: `تم فتح المشروع "${stored.project.name}". اطلب أي تعديل وأنا جاهز.`,
                  timestamp: 'الآن',
                },
              ],
        );
        setHasStarted(true);
        setSelectedElement(null);
        void refreshProjectList();
        return;
      }

      // Server-side open. A 404 means the row is not this account's, so the
      // list is refreshed rather than opening anything.
      void (async () => {
        const remote = await fetchRemoteProject(id).catch(() => null);
        if (!remote) {
          void refreshProjectList();
          return;
        }
        const local = readCachedProjectBody(id);
        setProjectId(remote.id);
        setActiveId(remote.id);
        setProject((prev) => ({
          ...(local ?? prev),
          name: remote.name,
          code: remote.code,
          files: remote.files ?? prev.files,
          versions: remote.versions ?? prev.versions,
          theme: remote.theme ?? prev.theme,
        }));
        setChatMessages([
          {
            id: 'm-1',
            sender: 'assistant',
            text: `تم فتح المشروع "${remote.name}". اطلب أي تعديل وأنا جاهز.`,
            timestamp: 'الآن',
          },
        ]);
        setHasStarted(true);
        setSelectedElement(null);
        void refreshProjectList();
      })();
    },
    [projectId, authUser, refreshProjectList],
  );

  // Start a clean project. The id is minted on the first real generation, so
  // the list never fills up with empty placeholders.
  const handleStartNewProject = useCallback(() => {
    setProjectId(null);
    setActiveId(null);
    setProject(createBlankProject());
    setChatMessages([
      {
        id: 'm-1',
        sender: 'assistant',
        text: 'مشروع جديد جاهز. صف اللي عايزه وأنا هبنيه من الصفر.',
        timestamp: 'الآن',
      },
    ]);
    setSelectedElement(null);
    setHasStarted(false);
    setLastFailedPrompt(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDeleteProject = useCallback(
    (id: string) => {
      const wasActive = id === projectId;
      const advance = () => {
        const next = projectList.find((p) => p.id !== id);
        if (next) handleSelectProject(next.id);
        else handleStartNewProject();
      };

      if (authUser) {
        void deleteRemoteProject(id)
          .then(() => {
            void refreshProjectList().then(() => {
              if (wasActive) advance();
            });
          })
          .catch(() => setProjectsSyncError('تعذّر حذف المشروع.'));
        return;
      }

      deleteProject(id);
      void refreshProjectList();
      if (wasActive) advance();
    },
    [projectId, projectList, authUser, refreshProjectList, handleSelectProject, handleStartNewProject],
  );

  /**
   * Take a repository's files and drop them straight into the studio.
   *
   * The imported tree becomes the project's `files`, and `code` (the document the
   * preview renders) points at the real entry file. A brand-new project id is
   * minted so the import lands in its own saved project rather than overwriting
   * whatever was open.
   */
  const handleGitHubImported = useCallback(
    (result: GitHubImportResult) => {
      const files = result.files;
      const activeFile = pickEntryFile(files);
      const name = result.repo.name;
      const importedAt = new Date().toISOString();

      setProject({
        id: '',
        name,
        description: `مستورد من ${result.repo.fullName} (${result.repo.branch})`,
        code: files[activeFile] ?? '',
        files,
        activeFile,
        versions: [],
        createdAt: importedAt,
        updatedAt: importedAt,
        theme: createBlankProject().theme,
      });
      setProjectId(null);
      setActiveId(null);
      setSelectedElement(null);
      setHasStarted(true);
      setLastFailedPrompt(null);
      setChatMessages([
        {
          id: 'm-1',
          sender: 'assistant',
          text:
            language === 'ar'
              ? `تم استيراد ${result.stats.imported} ملف من ${result.repo.fullName}. عدّل عليه مباشرة أو اطلب مني أي تعديل.`
              : `Imported ${result.stats.imported} files from ${result.repo.fullName}. Edit them directly or ask me for any change.`,
          timestamp: 'الآن',
        },
      ]);
      void refreshProjectList();
    },
    [language, refreshProjectList],
  );

  const handleRenameStoredProject = useCallback(
    (id: string, name: string) => {
      if (id === projectId) setProject((prev) => ({ ...prev, name }));
      if (authUser) {
        // The name is written to the database, so it survives signing out.
        void updateRemoteProject(id, { name })
          .then(() => void refreshProjectList())
          .catch(() => setProjectsSyncError('تعذّر حفظ الاسم الجديد.'));
        return;
      }
      renameProject(id, name);
      void refreshProjectList();
    },
    [projectId, authUser, refreshProjectList],
  );


  // Streaming finaliser shared by the SSE path and the fallback path: takes the
  // complete document, closes it if the model stopped mid-file, and commits it
  // as version v1.0.
  const commitGeneratedSite = (prompt: string, rawCode: string, appName?: string) => {
    const updatedCode = closeDocument(rawCode) || project.code;
    const name = appName || prompt.slice(0, 25);
    // The first real generation mints the project id, so the list never fills
    // up with empty placeholders and the work is saved from the first second.
    if (!projectId) {
      const id = newProjectId();
      setProjectId(id);
      setActiveId(id);
    }
    const newVersionNum = `v1.0`;

    const newVersion: VersionHistoryItem = {
      id: String(Date.now()),
      version: newVersionNum,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      title: name,
      prompt,
      code: updatedCode,
      files: {
        'index.html': updatedCode,
        'App.tsx': `// App.tsx\nimport React from 'react';\n\nexport default function App() {\n  return <main>/* Generated with Ebnili */</main>;\n}`,
        'schema.sql': `-- Supabase Schema\nCREATE TABLE records (id SERIAL PRIMARY KEY, data JSONB);`,
      },
    };

    setProject((prev) => ({
      ...prev,
      // The stored id is the source of truth, so a re-opened project is saved
      // back to the right slot instead of creating a duplicate.
      id: projectId ?? prev.id,
      name,
      description: prompt.slice(0, 80),
      code: updatedCode,
      files: { ...prev.files, 'index.html': updatedCode },
      versions: [newVersion, ...prev.versions],
      updatedAt: new Date().toISOString(),
    }));

    // A signed-in account's first generation CREATES the row on the server, and
    // the server mints the id. That is what guarantees one row per project with
    // a real owner — a reload can never leave a phantom or a duplicate behind.
    if (authUser && !projectId) {
      const nextProject: AppProject = {
        ...project,
        name,
        description: prompt.slice(0, 80),
        code: updatedCode,
        files: { ...project.files, 'index.html': updatedCode },
        versions: [newVersion, ...project.versions],
      };
      void createRemoteProject(nextProject)
        .then((created) => {
          setProjectId(created.id);
          setActiveId(created.id);
          cacheProjectBody(created.id, nextProject);
          void refreshProjectList();
        })
        .catch(() => setProjectsSyncError('تعذّر إنشاء المشروع على الخادم.'));
    }

    const assistantMsg: ChatMessage = {
      id: String(Date.now() + 1),
      sender: 'assistant',
      text: language === 'ar'
        ? `تم إنشاء الموقع بنجاح! استغرق البناء ${Math.round(streamSeconds)} ثانية.`
        : `Website generated successfully in ${Math.round(streamSeconds)}s!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      versionTag: newVersionNum,
      plan: currentPlanSteps,
    };
    setChatMessages((prev) => [...prev, assistantMsg]);
    setLastFailedPrompt(null);
  };

  // Consume /api/ai/generate-app/stream and paint the preview as tokens arrive.
  // Returns false when the stream never produced a single token, which tells
  // the caller to use the non-streaming endpoint instead.
  const tryStreamedGeneration = async (
    prompt: string,
    templateId: string | undefined,
    devFp: { deviceId: string; fingerprintHash: string },
  ): Promise<boolean> => {
    const res = await fetch('/api/ai/generate-app/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-id': devFp.deviceId,
        'x-fingerprint-hash': devFp.fingerprintHash,
      },
      body: JSON.stringify({ prompt, templateId, language }),
    });
    if (!res.ok || !res.body) return false;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let received = '';
    let done = false;
    let failureMessage = '';
    setIsStreaming(true);

    // Paint at most every ~450ms: fast enough to feel alive, slow enough that
    // the iframe is not re-parsed on every single token.
    let lastPaint = 0;
    const paint = (force: boolean) => {
      const now = Date.now();
      if (!force && now - lastPaint < 450) return;
      lastPaint = now;
      setProject((prev) => ({ ...prev, code: closeDocument(received) }));
    };

    try {
      while (!done) {
        const { done: finished, value } = await reader.read();
        if (finished) break;
        buffer += decoder.decode(value, { stream: true });
        // SSE frames are separated by a blank line.
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';
        for (const frame of frames) {
          const eventLine = frame.split('\n').find((l) => l.startsWith('event: '));
          const dataLine = frame.split('\n').find((l) => l.startsWith('data: '));
          if (!eventLine || !dataLine) continue;
          const event = eventLine.slice(7).trim();
          let payload: { text?: string; message?: string; ok?: boolean } = {};
          try {
            payload = JSON.parse(dataLine.slice(6));
          } catch {
            continue;
          }
          if (event === 'delta' && payload.text) {
            received += payload.text;
            paint(false);
          } else if (event === 'failed') {
            failureMessage = payload.message ?? '';
            done = true;
          } else if (event === 'done') {
            done = true;
          }
        }
      }
    } catch (err) {
      console.error('stream read failed', err);
      setIsStreaming(false);
      return false;
    }

    setIsStreaming(false);

    if (!received.trim()) {
      // Nothing came through — let the caller fall back to the normal call.
      if (failureMessage) {
        setChatMessages((prev) => [
          ...prev,
          {
            id: String(Date.now() + 1),
            sender: 'assistant',
            text: failureMessage,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
      return false;
    }

    paint(true);
    setStreamSeconds((Date.now() - streamStartedAt.current) / 1000);
    commitGeneratedSite(prompt, received);
    return true;
  };

  // Handle New App Generation
  const handleStartProject = async (prompt: string, templateId?: string) => {
    setIsGenerating(true);
    setHasStarted(true);

    // Initial plan placeholder
    setCurrentPlanSteps([
      language === 'ar' ? 'تحليل الطلب وتوليد المكونات...' : 'Analyzing prompt & crafting components...',
      language === 'ar' ? 'تطبيق أنماط Tailwind CSS المتجاوبة...' : 'Applying responsive Tailwind CSS styling...',
      language === 'ar' ? 'ربط دوال الحالة التفاعلية...' : 'Wiring interactive state & handlers...',
    ]);

    // Add user message
    const userMsg: ChatMessage = {
      id: String(Date.now()),
      sender: 'user',
      text: prompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setChatMessages((prev) => [...prev, userMsg]);

    try {
      const devFp = getDeviceFingerprint();
      streamStartedAt.current = Date.now();
      setStreamSeconds(0);

      // STREAMING FIRST — the preview paints while the model is still writing.
      // If the stream endpoint is missing or dies before the first token, we
      // transparently fall back to the non-streaming call below, so this can
      // never be worse than the previous behaviour.
      let streamed = false;
      try {
        streamed = await tryStreamedGeneration(prompt, templateId, devFp);
      } catch (streamErr) {
        console.error('streaming path unavailable, falling back', streamErr);
        streamed = false;
      }

      if (streamed) return;

      const res = await fetch('/api/ai/generate-app', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-device-id': devFp.deviceId,
          'x-fingerprint-hash': devFp.fingerprintHash,
        },
        body: JSON.stringify({ prompt, templateId, language, deviceId: devFp.deviceId, fingerprintHash: devFp.fingerprintHash }),
      });
      // Defensive JSON parse: the server always returns JSON, but a CDN/proxy
      // 404 page would be HTML — never crash, show the real server message.
      const data = await res.json().catch(() => ({ success: false as const, message: '' as string }));

      if (!res.ok) {
        // An expired/missing session is the ONE failure that must reach the
        // user: the engine now requires a signed-in session, so a stale cookie
        // would otherwise look like a generic server error. Re-probe the
        // session and send them back to the sign-in wall.
        if ((data as { code?: string }).code === 'AUTH_REQUIRED' || res.status === 401) {
          handleSessionExpired(language);
          return;
        }
        const errorMsg = (data as { message?: string }).message || (language === 'ar'
          ? '⚠️ حدث خطأ في الخادم أثناء التوليد. حاول مرة أخرى بعد قليل.'
          : '⚠️ Server error during generation. Please try again.');
        const assistantMsg: ChatMessage = {
          id: String(Date.now() + 1),
          sender: 'assistant',
          text: errorMsg,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setChatMessages((prev) => [...prev, assistantMsg]);
        // Keep the prompt around so the chat can offer a one-tap retry.
        setLastFailedPrompt(prompt);
        // Only open the subscription modal for quota errors, not server/key errors.
        if (/QUOTA|quota|استنفذت|الرصيد/.test(errorMsg)) setShowSubscription(true);
        return;
      }

      if ((data as { error?: string }).error === 'QUOTA_EXCEEDED') {
        const errorMsg = (data as { message?: string }).message || (language === 'ar'
          ? '⚠️ لقد استنفذت الرصيد المجاني المخصص لجهازك (لحماية المنصة من الاستخدام المتكرر). يرجى الترقية إلى باقة المحترفين Pro عبر محفظة أورانج كاش (01207782741) للاستمتاع بإنشاء غير محدود وبدون علامة مائية.'
          : '⚠️ Free generation quota exceeded for this device. Please upgrade to Pro via Orange Cash (01207782741) to unlock unlimited creations without watermark.');
        
        const assistantMsg: ChatMessage = {
          id: String(Date.now() + 1),
          sender: 'assistant',
          text: errorMsg,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setChatMessages((prev) => [...prev, assistantMsg]);
        setShowSubscription(true);
        return;
      }

      // Non-streaming fallback reached — same finaliser as the SSE path.
      setStreamSeconds((Date.now() - streamStartedAt.current) / 1000);
      commitGeneratedSite(
        prompt,
        (data as { code?: string }).code || '',
        (data as { appName?: string }).appName,
      );
    } catch (err) {
      console.error(err);
      const networkMsg: ChatMessage = {
        id: String(Date.now() + 1),
        sender: 'assistant',
        text: language === 'ar'
          ? '⚠️ تعذر الاتصال بالخادم. تحقق من اتصال الإنترنت وحاول مرة أخرى.'
          : '⚠️ Could not reach the server. Check your connection and try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, networkMsg]);
      setLastFailedPrompt(prompt);
    } finally {
      setIsGenerating(false);
      setCurrentPlanSteps([]);
    }
  };

  // Handle Iterative Prompt Refinement
  const handleRefinePrompt = async (prompt: string, elementContext?: SelectedElementInfo) => {
    // Check free plan generation limit
    if (subscription.tier === 'free' && subscription.generationsUsedToday >= subscription.generationsLimitToday) {
      const limitMsg: ChatMessage = {
        id: String(Date.now()),
        sender: 'assistant',
        text: language === 'ar'
          ? '⚠️ لقد استهلكت رصيدك اليومي المجاني (5 طلبات). يرجى الترقية إلى باقة المحترفين Pro عبر محفظة Orange Cash (01207782741) للحصول على طلبات ذكاء اصطناعي غير محدودة وتصدير كامل للكود.'
          : '⚠️ You have reached your daily free generation limit (5 prompts). Please upgrade to Pro via Orange Cash (01207782741) for unlimited AI building and full ZIP export.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, limitMsg]);
      setShowSubscription(true);
      return;
    }

    setIsGenerating(true);

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      sender: 'user',
      text: prompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      selectedElementRef: elementContext?.selector,
    };
    setChatMessages((prev) => [...prev, userMsg]);

    setCurrentPlanSteps([
      language === 'ar' ? 'فحص الكود الحالي وتحديد موضع التعديل...' : 'Inspecting current code and element location...',
      language === 'ar' ? 'تطبيق التعديلات البرمجية والأنماط...' : 'Applying styling and code diffs...',
      language === 'ar' ? 'تحديث المعاينة المباشرة...' : 'Refreshing live preview...',
    ]);

    try {
      const devFp = getDeviceFingerprint();
      const res = await fetch('/api/ai/refine-app', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-device-id': devFp.deviceId,
          'x-fingerprint-hash': devFp.fingerprintHash,
        },
        body: JSON.stringify({
          prompt,
          currentCode: project.code,
          selectedElement: elementContext,
          language,
          deviceId: devFp.deviceId,
          fingerprintHash: devFp.fingerprintHash,
        }),
      });
      const data = await res.json().catch(() => ({ success: false as const, message: '' as string }));

      if (!res.ok) {
        if ((data as { code?: string }).code === 'AUTH_REQUIRED' || res.status === 401) {
          handleSessionExpired(language);
          return;
        }
        const errorMsg = (data as { message?: string }).message || (language === 'ar'
          ? '⚠️ حدث خطأ في الخادم أثناء التعديل. حاول مرة أخرى بعد قليل.'
          : '⚠️ Server error during refinement. Please try again.');
        const assistantMsg: ChatMessage = {
          id: String(Date.now() + 1),
          sender: 'assistant',
          text: errorMsg,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setChatMessages((prev) => [...prev, assistantMsg]);
        if (/QUOTA|quota|استنفذت|الرصيد/.test(errorMsg)) setShowSubscription(true);
        return;
      }

      if ((data as { error?: string }).error === 'QUOTA_EXCEEDED') {
        const errorMsg = (data as { message?: string }).message || (language === 'ar'
          ? '⚠️ لقد استنفذت الرصيد المجاني المخصص لجهازك (لحماية المنصة من الاستخدام المتكرر). يرجى الترقية إلى باقة المحترفين Pro عبر محفظة أورانج كاش (01207782741).'
          : '⚠️ Free generation quota exceeded for this device. Please upgrade to Pro via Orange Cash (01207782741).');
        
        const assistantMsg: ChatMessage = {
          id: String(Date.now() + 1),
          sender: 'assistant',
          text: errorMsg,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setChatMessages((prev) => [...prev, assistantMsg]);
        setShowSubscription(true);
        return;
      }

      // The server tells us honestly whether the edit really happened. When the
      // AI engine is unavailable it returns `applied: false` with the ORIGINAL
      // code — we surface that message and keep the project untouched instead
      // of announcing a change that never occurred.
      if ((data as { applied?: boolean }).applied === false) {
        const notApplied: ChatMessage = {
          id: String(Date.now() + 1),
          sender: 'assistant',
          text: (data as { explanation?: string }).explanation
            || (language === 'ar' ? '⚠️ لم يتم تطبيق التعديل.' : '⚠️ Change not applied.'),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setChatMessages((prev) => [...prev, notApplied]);
        setLastFailedPrompt(prompt);
        return;
      }

      const updatedCode = (data as { code?: string }).code || project.code;
      const nextVer = `v1.${project.versions.length}`;

      const newVersion: VersionHistoryItem = {
        id: String(Date.now()),
        version: nextVer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        title: prompt.slice(0, 20),
        prompt,
        code: updatedCode,
        files: {
          ...project.files,
          'index.html': updatedCode,
        },
      };

      setProject((prev) => ({
        ...prev,
        code: updatedCode,
        files: {
          ...prev.files,
          'index.html': updatedCode,
        },
        versions: [newVersion, ...prev.versions],
      }));

      // Increment generations count
      setSubscription((prev) => ({
        ...prev,
        generationsUsedToday: prev.generationsUsedToday + 1,
      }));

      const assistantMsg: ChatMessage = {
        id: String(Date.now() + 1),
        sender: 'assistant',
        text: (data as { explanation?: string }).explanation || (language === 'ar' ? 'تم تطبيق التعديلات بنجاح.' : 'Modifications applied successfully.'),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        versionTag: nextVer,
        plan: (data as { plan?: string[] }).plan || currentPlanSteps,
      };
      setChatMessages((prev) => [...prev, assistantMsg]);

      // Clear inspected element
      setSelectedElement(null);
      setIsInspectMode(false);
    } catch (err) {
      console.error(err);
      const networkMsg: ChatMessage = {
        id: String(Date.now() + 1),
        sender: 'assistant',
        text: language === 'ar'
          ? '⚠️ تعذر الاتصال بالخادم. تحقق من اتصال الإنترنت وحاول مرة أخرى.'
          : '⚠️ Could not reach the server. Check your connection and try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, networkMsg]);
    } finally {
      setIsGenerating(false);
      setCurrentPlanSteps([]);
    }
  };

  // Restore snapshot version
  const handleRestoreVersion = (ver: VersionHistoryItem) => {
    setProject((prev) => ({
      ...prev,
      code: ver.code,
      files: {
        ...prev.files,
        'index.html': ver.code,
      },
    }));

    const noticeMsg: ChatMessage = {
      id: String(Date.now()),
      sender: 'system',
      text: language === 'ar'
        ? `تم استرجاع الإصدار (${ver.version}) بنجاح.`
        : `Successfully rolled back to version (${ver.version}).`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setChatMessages((prev) => [...prev, noticeMsg]);
  };

  // Manual code edits inside the CodeEditor
  const handleUpdateCode = (fileName: string, newContent: string) => {
    setProject((prev) => ({
      ...prev,
      code: fileName === 'index.html' ? newContent : prev.code,
      files: {
        ...prev.files,
        [fileName]: newContent,
      },
    }));
  };

  // Apply code generated from Gemini 3.8 Flash Studio
  const handleApplyGeneratedCodeFromStudio = (code: string, appName?: string, plan?: string[]) => {
    const nextVer = `v1.${project.versions.length}`;
    const newVersion: VersionHistoryItem = {
      id: String(Date.now()),
      version: nextVer,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      title: appName || (language === 'ar' ? 'توليد عبر إبنيلي' : 'Synthesized via Ebnili'),
      prompt: appName ? `توليد تطبيق ${appName} عبر محرك إبنيلي الذكي` : 'Ebnili AI Code Synthesis',
      code,
      files: {
        ...project.files,
        'index.html': code,
      },
    };

    setProject((prev) => ({
      ...prev,
      name: appName || prev.name,
      code,
      files: {
        ...prev.files,
        'index.html': code,
      },
      versions: [newVersion, ...prev.versions],
    }));

    if (plan && plan.length > 0) {
      setCurrentPlanSteps(plan);
    }

    const assistantMsg: ChatMessage = {
      id: String(Date.now() + 1),
      sender: 'assistant',
      text: language === 'ar'
        ? `⚡ تم بناء وتطبيق كود "${appName || project.name}" بنجاح بواسطة محرك إبنيلي الذكي!`
        : `⚡ Successfully synthesized and deployed "${appName || project.name}" via the Ebnili AI engine!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      versionTag: nextVer,
      plan: plan || (language === 'ar' ? ['توليد الكود التفاعلي بنظام Tailwind', 'تجهيز المعاينة المباشرة'] : ['Interactive Tailwind Synthesis', 'Live Preview Setup']),
    };
    setChatMessages((prev) => [...prev, assistantMsg]);
  };

  if (!hasStarted) {
    return (
      <>
        <NewProjectHero
          onStartProject={handleStartProject}
          isGenerating={isGenerating}
          language={language}
          onToggleLanguage={() => setLanguage((l) => (l === 'ar' ? 'en' : 'ar'))}
          subscription={subscription}
          onOpenSubscription={() => setShowSubscription(true)}
          onOpenGitHubImport={() => setShowGitHubImport(true)}
        />
        {showGitHubImport && (
          <GitHubImportModal
            onClose={() => {
              setShowGitHubImport(false);
              // Clear the failure so it does not reappear next time the dialog opens.
              setGitHubLinkError(null);
            }}
            language={language}
            onImported={handleGitHubImported}
            initialError={gitHubLinkError}
          />
        )}
        {showSubscription && (
          <SubscriptionModal
            currentSubscription={subscription}
            onClose={() => setShowSubscription(false)}
            onSubscriptionUpdated={(newSub) => setSubscription(newSub)}
            language={language}
          />
        )}
      </>
    );
  }

  // ── Public routes: /pricing, /pay and /404 ──────────────────────────────────
  // Rendered above the auth gate so a visitor can read the prices and pay
  // without an account; the studio itself still requires a session.
  const { path, params } = currentRoute();
  const navigate = (to: string) => {
    window.history.pushState({}, '', to);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  // A mistyped or dead link used to land on the full studio / login wall, which
  // looks like the site is broken. A real 404 page says what happened and
  // offers a way back.
  if (path === '/404' || path === '/not-found') {
    return (
      <Suspense
        fallback={
          <div className="h-screen bg-slate-950 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-slate-800 border-t-indigo-400 animate-spin" />
          </div>
        }
      >
        <NotFoundPage language={language} onNavigate={navigate} />
      </Suspense>
    );
  }

  if (path === '/pricing' || path === '/pay') {
    return (
      <Suspense
        fallback={
          <div className="h-screen bg-slate-950 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-slate-800 border-t-indigo-400 animate-spin" />
          </div>
        }
      >
        {path === '/pricing' ? (
          <PricingPage language={language} onNavigate={navigate} />
        ) : (
          <PayPage
            language={language}
            initialPlan={params.get('plan') === 'business' ? 'business' : 'pro'}
            initialCycle={params.get('cycle') === 'yearly' ? 'yearly' : 'monthly'}
            onNavigate={navigate}
          />
        )}
      </Suspense>
    );
  }

  // ── Gate: nobody reaches the studio without a session ─────────────────────
  // While /api/auth/me is in flight we show a neutral splash rather than the
  // gate, otherwise a signed-in user would see the login wall flash. It is
  // deadline-bounded (see AUTH_WATCHDOG_MS) and can never stay on screen.
  if (!authChecked) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500 via-pink-500 to-amber-400 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="w-6 h-6 rounded-full border-2 border-slate-800 border-t-indigo-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (!authUser) {
    return <AuthGate language={language} errorCode={authError} />;
  }

  return (
    <div
      className={`h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden ${
        language === 'ar' ? 'font-sans' : 'font-sans'
      }`}
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      {/* Session probe notice — NON-BLOCKING. The studio is fully usable; we
          only tell the user that identity could not be confirmed, so the first
          AI request does not surprise them. */}
      {authProbeFailed && !isGenerating && (
        <div className="shrink-0 px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 text-[11px] text-amber-200 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
          <span className="truncate">
            {language === 'ar'
              ? 'تعذّر تأكيد الجلسة. الاستوديو يعمل بشكل طبيعي، وقد تحتاج لتسجيل الدخول عند استخدام الذكاء الاصطناعي.'
              : 'Could not confirm your session. The studio works normally; you may need to sign in before using the AI.'}
          </span>
          <button
            onClick={() => setAuthProbeFailed(false)}
            className="ms-auto text-amber-300 hover:text-white font-bold shrink-0"
          >
            {language === 'ar' ? 'إخفاء' : 'Dismiss'}
          </button>
        </div>
      )}
      {/* Honest failure notice: if the project store could not be reached we say
          so, because a silent "saved" while nothing was stored is the one thing
          a user must never be told. */}
      {projectsSyncError && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 text-amber-200 text-xs shrink-0">
          <span className="shrink-0">⚠</span>
          <span className="truncate">{projectsSyncError}</span>
          <button
            onClick={() => {
              setProjectsSyncError(null);
              void refreshProjectList();
            }}
            className="ms-auto text-amber-300 hover:text-white font-bold shrink-0"
          >
            {language === 'ar' ? 'إعادة المحاولة' : 'Retry'}
          </button>
        </div>
      )}
      {/* Top Application Header */}
      <Header
        projectName={project.name}
        // Renaming from the studio writes through to the database (or the
        // on-device store for a guest), so the new name is still there after a
        // sign-out, another device, or a reload.
        onRenameProject={(newName) => {
          setProject((p) => ({ ...p, name: newName }));
          if (projectId) handleRenameStoredProject(projectId, newName);
        }}
        isGenerating={isGenerating}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        deviceMode={deviceMode}
        onDeviceModeChange={setDeviceMode}
        isInspectMode={isInspectMode}
        onToggleInspectMode={() => setIsInspectMode((m) => !m)}
        language={language}
        onToggleLanguage={() => setLanguage((l) => (l === 'ar' ? 'en' : 'ar'))}
        onNewProject={handleStartNewProject}
        onOpenExport={() => setShowExport(true)}
        onOpenDeploy={() => setShowDeploy(true)}
        onOpenIntegrations={() => setShowIntegrations(true)}
        subscription={subscription}
        onOpenSubscription={() => setShowSubscription(true)}
        onOpenGeminiStudio={() => setShowGeminiStudio(true)}
        onOpenAdmin={() => setShowAdminDashboard(true)}
        authUser={authUser}
        onOpenAuth={() => setShowAuthModal(true)}
        onLogout={handleLogout}
        onOpenInfoPage={setInfoPage}
        onOpenInNewTab={() => {
          // The preview is a full HTML document; open it as a real page in a new
          // tab. A blob URL carries the whole document without the browser
          // truncating a large srcdoc.
          const blob = new Blob([project.code], { type: 'text/html;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank', 'noopener');
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
        }}
        projects={projectList}
        activeProjectId={projectId ?? undefined}
        onSelectProject={handleSelectProject}
        onDeleteProject={handleDeleteProject}
        onRenameStoredProject={handleRenameStoredProject}
      />

      {/* Main Studio Body: Left Sidebar + Right Workspace */}
      {/* `min-h-0` on both wrappers is what lets the flex children actually
          shrink: without it a column flex container refuses to shrink below
          its content and the preview gets clipped off-screen on a phone. */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden relative">
        {/* Left Side: Copilot, Prompts, Files, History, Subscription */}
        <ChatSidebar
          messages={chatMessages}
          versions={project.versions}
          files={project.files}
          activeFile={project.activeFile}
          onSelectFile={(fileName) => setProject((p) => ({ ...p, activeFile: fileName }))}
          onRestoreVersion={handleRestoreVersion}
          onSubmitPrompt={(prompt) => handleRefinePrompt(prompt, selectedElement || undefined)}
          isGenerating={isGenerating}
          currentPlanSteps={currentPlanSteps}
          language={language}
          selectedElementRef={selectedElement?.selector}
          onClearSelectedElement={() => setSelectedElement(null)}
          subscription={subscription}
          onOpenSubscription={() => setShowSubscription(true)}
          onOpenGeminiStudio={() => setShowGeminiStudio(true)}
          retryPrompt={lastFailedPrompt}
          onRetryPrompt={() => {
            if (lastFailedPrompt) handleStartProject(lastFailedPrompt);
          }}
          isStreaming={isStreaming}
          streamSeconds={streamSeconds}
        />

        {/* Right Workspace: Preview, Code Editor, or Split View.
            `id` is the skip-link target declared in main.tsx. */}
        <main id="main-content" tabIndex={-1} className="flex-1 min-h-0 flex overflow-hidden relative focus:outline-none">
          {viewMode === 'preview' && (
            <PreviewFrame
              code={project.code}
              deviceMode={deviceMode}
              isInspectMode={isInspectMode}
              onElementSelect={(info) => setSelectedElement(info)}
              language={language}
              subscriptionTier={subscription.tier}
              onOpenSubscription={() => setShowSubscription(true)}
            />
          )}

          {viewMode === 'code' && (
            <CodeEditor
              files={project.files}
              activeFile={project.activeFile}
              onSelectFile={(fileName) => setProject((p) => ({ ...p, activeFile: fileName }))}
              onUpdateCode={handleUpdateCode}
              previousCode={project.versions[1]?.code}
              language={language}
            />
          )}

          {viewMode === 'split' && (
            <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden">
              <div className="w-full lg:w-1/2 h-1/2 lg:h-full border-b lg:border-b-0 lg:border-r border-slate-800">
                <CodeEditor
                  files={project.files}
                  activeFile={project.activeFile}
                  onSelectFile={(fileName) => setProject((p) => ({ ...p, activeFile: fileName }))}
                  onUpdateCode={handleUpdateCode}
                  previousCode={project.versions[1]?.code}
                  language={language}
                />
              </div>
              <div className="w-full lg:w-1/2 h-1/2 lg:h-full">
                <PreviewFrame
                  code={project.code}
                  deviceMode={deviceMode}
                  isInspectMode={isInspectMode}
                  onElementSelect={(info) => setSelectedElement(info)}
                  language={language}
                  subscriptionTier={subscription.tier}
                  onOpenSubscription={() => setShowSubscription(true)}
                  isStreaming={isStreaming}
                />
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Visual Inspector Popup Modal */}
      {/* ── Lazily loaded modals ───────────────────────────────────────────
          Wrapped in one Suspense so a chunk that is still downloading shows a
          quiet spinner instead of blanking the studio. */}
      <Suspense fallback={null}>
        {selectedElement && (
          <VisualInspectorModal
            elementInfo={selectedElement}
            onClose={() => setSelectedElement(null)}
            onSubmitRefinement={(prompt, el) => handleRefinePrompt(prompt, el)}
            language={language}
          />
        )}

        {showExport && (
          <ExportModal
            projectName={project.name}
            files={project.files}
            onClose={() => setShowExport(false)}
            language={language}
          />
        )}

        {showDeploy && (
          <DeployModal
            projectName={project.name}
            onClose={() => setShowDeploy(false)}
            language={language}
          />
        )}

        {/* Backend & Supabase Integrations Modal — owner only */}
        {isOwner && showIntegrations && (
          <IntegrationsModal
            onClose={() => setShowIntegrations(false)}
            onOpenGitHubImport={() => {
              setShowIntegrations(false);
              setShowGitHubImport(true);
            }}
            language={language}
          />
        )}

        {showSubscription && (
          <SubscriptionModal
            currentSubscription={subscription}
            onClose={() => setShowSubscription(false)}
            onSubscriptionUpdated={(newSub) => setSubscription(newSub)}
            language={language}
          />
        )}

        {/* Owner Admin Dashboard Modal — owner only */}
        {isOwner && (
          <AdminDashboardModal
            isOpen={showAdminDashboard}
            onClose={() => setShowAdminDashboard(false)}
            language={language}
          />
        )}

        {/* Google / GitHub sign-in modal */}
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => {
            setShowAuthModal(false);
            setAuthError(null);
          }}
          language={language}
          errorCode={authError}
        />
      </Suspense>

      {/* Site pages: About / Contact / Privacy / Terms.
          Replaces the old floating WhatsApp bubble — the support number now
          lives in a real Contact page (and the legal pages the bubble never had). */}
      {infoPage && (
        <InfoPagesModal
          language={language}
          initialPage={infoPage}
          onClose={() => setInfoPage(null)}
        />
      )}

      {/* Gemini 3.8 Flash AI Studio Modal */}
      {showGeminiStudio && (
        <GeminiStudioModal
          isOpen={showGeminiStudio}
          onClose={() => setShowGeminiStudio(false)}
          language={language}
          currentCode={project.code}
          onApplyGeneratedCode={handleApplyGeneratedCodeFromStudio}
          subscription={subscription}
          onOpenSubscription={() => {
            setShowGeminiStudio(false);
            setShowSubscription(true);
          }}
        />
      )}
    </div>
  );
}
