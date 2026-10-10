import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { Sparkles, Menu, Eye, Code2 } from 'lucide-react';
import { StudioSidebar } from './components/StudioSidebar';
import { ChatSidebar } from './components/ChatSidebar';
import { PreviewFrame } from './components/PreviewFrame';
import { CodeEditor } from './components/CodeEditor';
import { NewProjectHero } from './components/NewProjectHero';
import { AuthGate } from './components/AuthGate';
import { InfoPagesModal, type PageKey } from './components/InfoPagesModal';
import { getDeviceFingerprint } from './utils/fingerprint';
import { fetchCurrentUser, logout as authLogout, isOwnerAccount, isAdminAccount, fetchWithTimeout } from './lib/auth';
import { registerDevice } from './lib/protection';
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
// «لوحة المستخدم» — the signed-in customer's dashboard. Lazy like every other
// overlay so it stays out of the first paint.
const UserDashboardModal = lazy(() => import('./components/UserDashboardModal').then((m) => ({ default: m.UserDashboardModal })));
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
  /** «لوحة المستخدم» — only ever opened by a signed-in account. */
  const [showUserDashboard, setShowUserDashboard] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  // Which of the site pages is open (About / Contact / Privacy / Terms).
  const [infoPage, setInfoPage] = useState<PageKey | null>(null);

  // ── User authentication (Google / GitHub) ─────────────────────────────────
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  // `null` until /api/auth/me answers, so the gate doesn't flash for a
  // returning user who already has a valid session cookie.
  const [authChecked, setAuthChecked] = useState<boolean>(false);

  /**
   * Mobile drawer state for the control rail.
   *
   * WHY it exists: the rail is a permanent 256px column on desktop, but on a
   * phone that would leave almost nothing for the preview, so below `md` it
   * slides over the workspace instead and this flag drives it.
   */
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // While the drawer is open the page behind it must not scroll, otherwise a
  // swipe scrolls the workspace and the rail appears frozen.
  useEffect(() => {
    if (!sidebarOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [sidebarOpen]);
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
        // A returning visitor already has a valid cookie but has NOT gone through
        // the sign-in success path, so without this their device would never be
        // recorded on a plain page reload. Also refreshes `last_seen_at`.
        if (user) void registerDevice();
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
      // Record this device against the account the moment sign-in succeeds.
      // This is the ONLY caller of /api/protection/status, and without it the
      // owner dashboard shows a permanent 0 devices and the block / quota / tier
      // buttons have no row to act on.
      //
      // Fire-and-forget: it must never delay or block the session, and a failure
      // here only costs the abuse-protection signal, not the user's access.
      void registerDevice();
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

  // Console access: owner OR an active delegate. The admin MODAL mounts for
  // either, but the owner-only sub-tools inside it stay gated on `isOwner` and
  // every route re-checks server-side, so this is a rendering hint only.
  const canOpenAdmin = isAdminAccount(authUser);

  // ── `?admin=1` — the deep link inside the "you are an admin now" e-mail ────
  // WHY: the invitation button pointed at a POST-only API route, so a newly
  // added administrator who clicked it got a bare 404 and could never find the
  // PIN form — the reported "لا أستطيع تسجيل الدخول إلى لوحة التحكم".
  //
  // The flag is HELD until the session resolves rather than consumed on mount:
  // a guest is sent to sign in first, and the console then opens by itself once
  // `/api/auth/me` stamps `isAdmin`. It is cleared the moment it is acted on, so
  // it can never re-open the modal after the user closes it.
  const [pendingAdminDeepLink, setPendingAdminDeepLink] = useState<boolean>(() => {
    // Read on every mount, INCLUDING the return leg of the OAuth round trip:
    // signing in navigates away to the provider and comes back on a different
    // query string, so `?admin=1` alone would be lost exactly when it matters.
    const ADMIN_DEEP_LINK_KEY = 'ebnili_admin_deep_link';
    try {
      if (new URLSearchParams(window.location.search).get('admin') === '1') {
        window.sessionStorage.setItem(ADMIN_DEEP_LINK_KEY, '1');
        return true;
      }
      return window.sessionStorage.getItem(ADMIN_DEEP_LINK_KEY) === '1';
    } catch {
      return false;
    }
  });

  const clearAdminDeepLink = useCallback(() => {
    setPendingAdminDeepLink(false);
    try {
      window.sessionStorage.removeItem('ebnili_admin_deep_link');
    } catch {
      /* storage may be disabled; the state flag is the authoritative one */
    }
  }, []);

  useEffect(() => {
    if (!pendingAdminDeepLink || !authChecked) return;
    // Scrub the address bar exactly like the auth/github query params: a flag
    // that stays in the URL would re-fire on every reload.
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('admin');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    } catch {
      /* history is best-effort; the flag below is what actually matters */
    }
    if (!authUser) {
      // Not signed in: ask for sign-in and KEEP the flag (also in sessionStorage)
      // so the console opens by itself after the provider round trip.
      setShowAuthModal(true);
      return;
    }
    if (canOpenAdmin) setShowAdminDashboard(true);
    clearAdminDeepLink();
  }, [pendingAdminDeepLink, authChecked, authUser, canOpenAdmin, clearAdminDeepLink]);


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

  // NOTE: the old `AUTOSAVE_KEY` constant here was never read or written by any
  // code — it was a leftover from a localStorage autosave that the server store
  // replaced. It is removed so nobody assumes a second save path exists.
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
  //
  // WHY A REF, NOT A DEPENDENCY: `projectId` flips from null to a real id in the
  // same tick a generation finishes, and the id the SERVER issues arrives later
  // still. Reading the state variable inside the timer body would save a project
  // under whichever id happened to be current when the 800ms elapsed — which is
  // how an update ended up PATCHing a row that did not exist yet, silently
  // dropping the save. The ref is read at the moment of writing instead.
  const projectIdRef = useRef<string | null>(null);
  useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);

  useEffect(() => {
    if (!projectId || isGenerating) return;
    if (!hasRealContent(project.code)) return;
    const timer = setTimeout(() => {
      // The id is re-read here, at write time, not captured at schedule time.
      const id = projectIdRef.current ?? projectId;
      if (authUser) {
        // The server owns the row; the id came from it, so this is an update.
        void updateRemoteProject(id, {
          name: project.name,
          code: project.code,
          files: project.files,
          versions: project.versions,
          theme: project.theme,
        })
          .then(() => {
            cacheProjectBody(id, project);
            void refreshProjectList();
          })
          // A 404 means the row was never created — the first-generation create
          // did not land. Fall back to creating it so a generated site is never
          // lost to a race between "mint the id" and "write the row".
          .catch(async () => {
            try {
              const created = await createRemoteProject({
                ...project,
                id,
                name: project.name,
                code: project.code,
                files: project.files,
                versions: project.versions,
                theme: project.theme,
              });
              projectIdRef.current = created.id;
              setProjectId(created.id);
              setActiveId(created.id);
              cacheProjectBody(created.id, project);
              void refreshProjectList();
            } catch {
              cacheProjectBody(id, project);
              setProjectsSyncError('تعذّر حفظ المشروع على الخادم — حُفظ على هذا الجهاز فقط.');
            }
          });
        return;
      }
      saveProject(id, project, chatMessages);
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
      // SECURITY / CORRECTNESS — mint the id HERE instead of clearing it.
      // `setProjectId(null)` used to run right after `setProject`, which left the
      // import with no id at all: the auto-save effect bails out on a falsy
      // `projectId`, so an imported repository was never persisted and vanished
      // the moment the user left the page. Minting it here means the imported
      // tree lands in its own saved project and is listed like any other.
      const importedId = newProjectId();
      setProjectId(importedId);
      setActiveId(importedId);
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
      // `localId` (not the stale `projectId` state) is the id this project is
      // being saved under, so the row the server creates and the state the UI
      // renders always point at the same slot.
      id: localId,
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
    //
    // SECURITY / CORRECTNESS — why `localId` is carried alongside `projectId`
    // ------------------------------------------------------------------------
    // `projectId` is React state, so the `setProjectId(id)` above has NOT taken
    // effect yet when the next line reads it. The `if (!projectId)` branch
    // therefore ran with the OLD value: on a fresh start that is `null`, so
    // `setProjectId(localId)` was issued AND `createRemoteProject` ran — and the
    // two ids competed for `getActiveId()`. Whichever lost, a later reload read a
    // different id than the row the server had just created, so the project came
    // back empty and the user was told to start over.
    //
    // `localId` is the id minted in THIS call, so it is never stale. Both the
    // guest path and the server path now agree on one id, and the server id
    // replaces it as soon as the row exists.
    const localId = projectId ?? newProjectId();
    setProjectId(localId);
    setActiveId(localId);

    // IMMEDIATE PERSIST, THEN DEBOUNCED
    // -------------------------------
    // The auto-save effect above deliberately skips while `isGenerating` is true,
    // so it only runs 800ms AFTER this function returns. A user who generates a
    // site and immediately closes the tab, switches projects, or loses signal
    // loses the whole thing — which is exactly the reported "built it and it was
    // gone" symptom. Saving the finished document here means the work is durable
    // the moment it exists, and the debounced effect only handles later edits.
    //
    // The guest store is synchronous and safe to call directly. For a signed-in
    // account the row is created below, which is what gives it a real owner.
    if (!authUser) {
      const nextProject: AppProject = {
        ...project,
        id: localId,
        name,
        description: prompt.slice(0, 80),
        code: updatedCode,
        files: { ...project.files, 'index.html': updatedCode },
        versions: [newVersion, ...project.versions],
        updatedAt: new Date().toISOString(),
      };
      saveProject(localId, nextProject, chatMessages);
      void refreshProjectList();
    }

    if (authUser && !projectId) {
      const nextProject: AppProject = {
        ...project,
        // Seed the row with the id we just chose so the client's state and the
        // server's row agree from the very first byte.
        id: localId,
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
        .catch(() => {
          // SECURITY / HONESTY: a failed create must not leave the browser
          // pointing at an id the server never issued. Falling back to the local
          // id keeps the guest cache usable, and `projectsSyncError` above tells
          // the owner the server copy is missing instead of silently diverging.
          cacheProjectBody(localId, nextProject);
          setProjectsSyncError('تعذّر إنشاء المشروع على الخادم — حُفظ محلياً فقط.');
          void refreshProjectList();
        });
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

    // SINGLE-SPEND RULE: the stream already consumed one allowance credit in its
    // middleware. Falling back to the non-streaming route would consume a
    // SECOND credit for the same user request, so the fallback only runs when
    // the stream never started (HTTP error / no body). A started-but-failed
    // stream surfaces its failure message instead of spending again.
    const devFp = getDeviceFingerprint();
    streamStartedAt.current = Date.now();
    setStreamSeconds(0);

    // ONE try/catch for the whole generation, INCLUDING the streaming attempt:
    // `finally` is what guarantees `isGenerating` is cleared on every exit path.
    try {
      let streamed = false;
      let streamAttempted = false;
      try {
        streamed = await tryStreamedGeneration(prompt, templateId, devFp);
      streamAttempted = true;
    } catch (streamErr) {
      console.error('streaming path unavailable, falling back', streamErr);
      streamed = false;
    }

    if (streamed) return;

    // The stream endpoint ran but produced no usable output: it already spent
    // the credit, so show its failure instead of spending a second one.
    if (streamAttempted) {
      const assistantMsg: ChatMessage = {
        id: String(Date.now() + 1),
        sender: 'assistant',
        text: language === 'ar'
          ? '⚠️ تعذر إكمال التوليد المباشر. حاول مرة أخرى بطلب جديد.'
          : '⚠️ Live generation could not finish. Please try again with a new request.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, assistantMsg]);
      return;
    }

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
          ? '⚠️ لقد استنفذت رصيدك اليومي. يرجى الترقية إلى باقة أعلى عبر محفظة أورانج كاش (01207782741).'
          : '⚠️ Daily AI quota exceeded. Please upgrade via Orange Cash (01207782741).');
        
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
    // لا فحص محلي للرصيد هنا — الخادم هو المرجع الوحيد (middleware يخصم
    // ويرد 429/AI_QUOTA_EXCEEDED عند النفاد). الفحص المحلي كان يستخدم أرقاماً
    // قديمة ويعرض "غير محدود" بشكل مضلل.
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
          ? '⚠️ لقد استنفذت رصيدك اليومي. يرجى الترقية إلى باقة أعلى عبر محفظة أورانج كاش (01207782741).'
          : '⚠️ Daily AI quota exceeded. Please upgrade via Orange Cash (01207782741).');
        
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

  // ── Public routes: /pricing, /pay and /404 ──────────────────────────────────
  // Rendered ABOVE the auth gate and ABOVE the `!hasStarted` hero check, so a
  // visitor can read the prices and pay without an account.
  //
  // ORDER MATTERS: this block used to sit below `if (!hasStarted)`, which meant
  // a cold visit to /pricing rendered the marketing hero instead of the price
  // list — Google fetched a page whose entire body was the hero. Both the route
  // table and the `!hasStarted` early return are below it now.
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
// ── Marketing hero — a guest's landing view, and the only crawlable page
  //    carrying real marketing copy. It MUST stay below the public-route checks
  //    above, or a cold visit to /pricing would render this instead of the prices.
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
          // The hero is the guest's landing page and the studio rail (which also
          // offers sign-in) is not mounted until a session exists, so the button
          // has to be wired here or a visitor has no visible way to sign in.
          onOpenAuth={() => setShowAuthModal(true)}
          onOpenInfoPage={setInfoPage}
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

        {/* The sign-in dialog must be mounted HERE as well.
            This branch returns before the studio tree, so the copy further down
            the component (which is inside that tree) never rendered for a guest
            — the header button set `showAuthModal` and nothing happened, on any
            screen size. Both branches now mount it exactly once. */}
        <Suspense fallback={null}>
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

        {/* The footer on the marketing page opens the same site pages. Without
            this the new footer links would be dead buttons for a guest. */}
        {infoPage && (
          <InfoPagesModal
            language={language}
            initialPage={infoPage}
            onClose={() => setInfoPage(null)}
          />
        )}
      </>
    );
  }

  // ── Gate: nobody reaches the studio without a session ─────────────────────
  // WHY THIS BLOCK IS SKIPPED FOR GUESTS: the rail's "تسجيل الدخول" row lives in
  // the sidebar, and the sidebar only renders inside the branch below, which is
  // guarded by `authUser`. A signed-out visitor therefore never saw that row —
  // the sign-in affordance existed only in the markup, which is why clicking it
  // did nothing on any screen size. Guests get AuthGate below, which owns the
  // same action, so this early return is correct; the sidebar copy is a
  // convenience for a session that expired mid-session.
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

  // The sign-in wall is the FIRST thing a guest ever sees, so it is the screen
  // that most needed a visible route to the privacy policy and the terms —
  // and it had none. `InfoPagesModal` must be mounted HERE, not only in the
  // studio tree below: this branch returns before that tree exists, so a guest
  // clicking a footer link would flip state and see nothing.
  if (!authUser) {
    return (
      <>
        <AuthGate language={language} errorCode={authError} onOpenInfoPage={setInfoPage} />
        {infoPage && (
          <InfoPagesModal
            language={language}
            initialPage={infoPage}
            onClose={() => setInfoPage(null)}
          />
        )}
      </>
    );
  }

  return (
    <div
      className={`h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden ${
        language === 'ar' ? 'font-sans' : 'font-sans'
      }`}
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      {/* ── Studio layout ────────────────────────────────────────────────
          A horizontal flex row: the rail on one side, the workspace on the
          other. The old shape was a full-width bar stacked above a row, which
          is what forced thirteen controls into 56px of height.

          On a phone the rail becomes an overlay drawer (`sidebarOpen`),
          because a permanent 256px column would leave no room for a preview. */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        {/* The rail: static on desktop, slide-over on small screens. */}
        <div
          className={`${
            sidebarOpen ? 'flex' : 'hidden'
          } md:flex absolute md:static inset-y-0 start-0 z-40 shrink-0`}
        >
          <StudioSidebar
            projectName={project.name}
            // Renaming from the studio writes through to the database (or the
            // on-device store for a guest), so the new name is still there after
            // a sign-out, another device, or a reload.
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
            // The row only exists for a signed-in account (see StudioSidebar),
            // and the modal refuses to render without `authUser`.
            onOpenUserDashboard={() => {
              setSidebarOpen(false);
              setShowUserDashboard(true);
            }}
            authUser={authUser}
            onOpenAuth={() => setShowAuthModal(true)}
            onLogout={handleLogout}
            onOpenInfoPage={setInfoPage}
            onOpenInNewTab={() => {
              // The preview is a full HTML document; open it as a real page in a
              // new tab. A blob URL carries the whole document without the
              // browser truncating a large srcdoc.
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
        </div>

        {/* Scrim: phones only, and only while the drawer is open. It closes the
            drawer without covering it, so the rail stays usable. */}
        {sidebarOpen && (
          <button
            type="button"
            aria-label={language === 'ar' ? 'إغلاق القائمة' : 'Close sidebar'}
            onClick={() => setSidebarOpen(false)}
            className="md:hidden absolute inset-0 bg-slate-950/70 backdrop-blur-sm z-30 cursor-pointer"
          />
        )}

        {/* Workspace column: notices, mobile toggle, then the body. */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
      {/* __NOTICES__ */}
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
          <span className="truncate min-w-0">{projectsSyncError}</span>
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

      {/* The mobile drawer toggle. On desktop the rail is always visible, so the
          button is `md:hidden` — there is nothing to open. */}
      <div className="md:hidden shrink-0 flex items-center gap-2 px-3 py-2 border-b border-slate-800 bg-slate-900">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          aria-label={language === 'ar' ? 'فتح القائمة' : 'Open sidebar'}
          aria-expanded={sidebarOpen}
          className="shrink-0 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition cursor-pointer"
        >
          <Menu className="w-4 h-4" />
          <span className="text-xs font-bold">{language === 'ar' ? 'القائمة' : 'Menu'}</span>
        </button>
        <span className="text-xs font-bold text-slate-300 truncate min-w-0 flex-1">
          {project.name || (language === 'ar' ? 'مشروع بدون اسم' : 'Untitled project')}
        </span>
        {/* The one control worth keeping on the bar itself: switching between the
            preview and the code is the most repeated action in the studio. */}
        <button
          type="button"
          onClick={() => setViewMode(viewMode === 'code' ? 'preview' : 'code')}
          className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition cursor-pointer"
        >
          {viewMode === 'code' ? <Eye className="w-4 h-4" /> : <Code2 className="w-4 h-4" />}
          <span className="text-xs font-bold">
            {viewMode === 'code'
              ? language === 'ar' ? 'معاينة' : 'Preview'
              : language === 'ar' ? 'الكود' : 'Code'}
          </span>
        </button>
      </div>

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
        </div>{/* /workspace column */}
      </div>{/* /studio row: rail + workspace */}

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

        {/* Admin Dashboard Modal — owner or active delegate */}
        {canOpenAdmin && (
          <AdminDashboardModal
            isOpen={showAdminDashboard}
            onClose={() => setShowAdminDashboard(false)}
            language={language}
          />
        )}

        {/* User dashboard — «لوحة المستخدم».
            Mounted ONLY while a verified session exists, so a guest (or an
            expired cookie) can never reach it. Every figure inside it is read
            server-side from this session's own rows — there is no id anywhere
            in the request that could point at another account. */}
        {authUser && (
          <UserDashboardModal
            isOpen={showUserDashboard}
            onClose={() => setShowUserDashboard(false)}
            language={language}
            authUser={authUser}
            subscription={subscription}
            projects={projectList}
            onOpenSubscription={() => {
              setShowUserDashboard(false);
              setShowSubscription(true);
            }}
            onSelectProject={(id) => {
              setShowUserDashboard(false);
              handleSelectProject(id);
            }}
            onRefreshProjects={refreshProjectList}
          />
        )}

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

      {/* The sign-in dialog, mounted in the STUDIO tree as well.
          It was mounted only in the guest branch above, so every signed-in
          control that sets `showAuthModal` — the rail's "تسجيل الدخول" row and
          the account panel's "تغيير الحساب" — flipped the flag and rendered
          nothing, on any screen size. This is the same unreachable-modal class
          of bug fixed for guests in 72eedbe; the signed-in side was missed.
          Both branches mount it exactly once. */}
      <Suspense fallback={null}>
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
    </div>
  );
}
