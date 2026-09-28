import { useState, useEffect, useCallback, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import { Header } from './components/Header';
import { ChatSidebar } from './components/ChatSidebar';
import { PreviewFrame } from './components/PreviewFrame';
import { CodeEditor } from './components/CodeEditor';
import { VisualInspectorModal } from './components/VisualInspectorModal';
import { ExportModal } from './components/ExportModal';
import { DeployModal } from './components/DeployModal';
import { IntegrationsModal } from './components/IntegrationsModal';
import { SubscriptionModal } from './components/SubscriptionModal';
import { GeminiStudioModal } from './components/GeminiStudioModal';
import { NewProjectHero } from './components/NewProjectHero';
import { AdminDashboardModal } from './components/AdminDashboardModal';
import { AuthModal } from './components/AuthModal';
import { AuthGate } from './components/AuthGate';
import { WhatsAppSupportButton } from './components/WhatsAppSupportButton';
import { getDeviceFingerprint } from './utils/fingerprint';
import { fetchCurrentUser, logout as authLogout, isOwnerAccount } from './lib/auth';
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
  const [showAdminDashboard, setShowAdminDashboard] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);

  // ── User authentication (Google / GitHub) ─────────────────────────────────
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  // `null` until /api/auth/me answers, so the gate doesn't flash for a
  // returning user who already has a valid session cookie.
  const [authChecked, setAuthChecked] = useState<boolean>(false);

  useEffect(() => {
    fetchCurrentUser().then((user) => {
      setAuthUser(user);
      setAuthChecked(true);
    });
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
      fetchCurrentUser().then((user) => {
        setAuthUser(user);
        setAuthChecked(true);
      });
    }
    setShowAuthModal(Boolean(error));

    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  const handleLogout = useCallback(async () => {
    await authLogout();
    setAuthUser(null);
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

  // Fetch current subscription from backend
  useEffect(() => {
    fetch('/api/subscriptions/current')
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

  // Active Project State
  const [project, setProject] = useState<AppProject>(() => {
    // This used to be a hard-coded white page that simply said "Preview". After
    // a failed generation the user was left staring at it and reasonably
    // concluded the builder "made a fake site". The studio now starts on an
    // honest empty state that asks for the first prompt.
    const initialCode = `<!DOCTYPE html>
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
      id: 'demo-1',
      name: 'Preview',
      description: 'معاينة جاهزة للتطوير المباشر.',
      code: initialCode,
      files: {
        'index.html': initialCode,
        'App.tsx': `// React Component
import React from 'react';

export default function App() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-white text-3xl font-bold text-slate-700">
      Preview
    </div>
  );
}`,
        'schema.sql': `-- SQL Schema
CREATE TABLE records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`,
      },
      activeFile: 'index.html',
      versions: [
        {
          id: 'v-1',
          version: 'v1.0',
          timestamp: 'الآن',
          title: 'Preview',
          prompt: 'صفحة بيضاء مع كلمة Preview بالإنجليزية',
          code: initialCode,
          files: { 'index.html': initialCode },
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      theme: {
        primaryColor: '#6366f1',
        borderRadius: '12px',
        darkMode: false,
      },
    };
  });

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'm-1',
      sender: 'assistant',
      text: 'أهلاً بك! اكتب فكرة تطبيقك أو موقعك في مربع النص أدناه، وسأقوم ببنائه وتطويره لك فورياً مع المعاينة الحية وإمكانية التعديل المباشر.',
      timestamp: 'الآن',
    },
  ]);

  // ── Auto-save: a professional builder never loses your work ───────────────
  // Everything lived in React state, so one refresh threw away a site that took
  // a minute of engine time to generate. Persist (debounced) and restore.
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(
          AUTOSAVE_KEY,
          JSON.stringify({ project, chatMessages, savedAt: Date.now() }),
        );
      } catch {
        /* private mode / quota exceeded — the app still works, just no restore */
      }
    }, 800);
    return () => clearTimeout(id);
  }, [project, chatMessages]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { project?: AppProject; chatMessages?: ChatMessage[] };
      // Only restore real generated work, never the untouched placeholder.
      if (saved.project?.code && /<html/i.test(saved.project.code) && !/ابدأ مشروعك/.test(saved.project.code)) {
        setProject(saved.project);
        setHasStarted(true);
      }
      if (Array.isArray(saved.chatMessages) && saved.chatMessages.length > 1) {
        setChatMessages(saved.chatMessages);
      }
    } catch {
      /* ignore an unreadable autosave */
    }
    // Restore pass — runs once on mount, not as a sync loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


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
      name,
      code: updatedCode,
      files: { ...prev.files, 'index.html': updatedCode },
      versions: [newVersion, ...prev.versions],
    }));

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
        />
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

  // ── Gate: nobody reaches the studio without a session ─────────────────────
  // While /api/auth/me is still in flight we show a neutral splash rather than
  // the gate, otherwise a signed-in user would see the login wall flash.
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
      {/* Top Application Header */}
      <Header
        projectName={project.name}
        onRenameProject={(newName) => setProject((p) => ({ ...p, name: newName }))}
        isGenerating={isGenerating}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        deviceMode={deviceMode}
        onDeviceModeChange={setDeviceMode}
        isInspectMode={isInspectMode}
        onToggleInspectMode={() => setIsInspectMode((m) => !m)}
        language={language}
        onToggleLanguage={() => setLanguage((l) => (l === 'ar' ? 'en' : 'ar'))}
        onNewProject={() => setHasStarted(false)}
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

        {/* Right Workspace: Preview, Code Editor, or Split View */}
        <main className="flex-1 min-h-0 flex overflow-hidden relative">
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
      {selectedElement && (
        <VisualInspectorModal
          elementInfo={selectedElement}
          onClose={() => setSelectedElement(null)}
          onSubmitRefinement={(prompt, el) => handleRefinePrompt(prompt, el)}
          language={language}
        />
      )}

      {/* Export ZIP & Embed Modal */}
      {showExport && (
        <ExportModal
          projectName={project.name}
          files={project.files}
          onClose={() => setShowExport(false)}
          language={language}
        />
      )}

      {/* Deploy & Public Share Modal */}
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
          language={language}
        />
      )}

      {/* Subscription & Orange Cash Modal */}
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

      {/* Floating WhatsApp Support Button */}
      <WhatsAppSupportButton
        language={language}
        walletNumber="01207782741"
      />

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
