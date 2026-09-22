import { useState, useEffect } from 'react';
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
import { WhatsAppSupportButton } from './components/WhatsAppSupportButton';
import { getDeviceFingerprint } from './utils/fingerprint';
import { 
  AppProject, 
  ChatMessage, 
  DeviceMode, 
  ViewMode, 
  Language, 
  SelectedElementInfo, 
  VersionHistoryItem,
  UserSubscription
} from './types';

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

  // Subscription State with Orange Cash support
  const [subscription, setSubscription] = useState<UserSubscription>({
    tier: 'free',
    planName: 'Starter Free (المجانية)',
    status: 'active',
    generationsUsedToday: 1,
    generationsLimitToday: 5,
    canExportZip: false,
    canUseCustomDomain: false,
    canUseVisualInspector: true,
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

  const [currentPlanSteps, setCurrentPlanSteps] = useState<string[]>([]);

  // Active Project State
  const [project, setProject] = useState<AppProject>(() => {
    const initialCode = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      background-color: #ffffff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Helvetica Neue", Arial, sans-serif;
    }
    .preview-text {
      font-size: 2.25rem;
      font-weight: 700;
      color: #334155;
      letter-spacing: -0.02em;
      user-select: none;
    }
  </style>
</head>
<body>
  <div class="preview-text">Preview</div>
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

      const newVersionNum = `v1.0`;
      const updatedCode = (data as { code?: string }).code || project.code;
      const appName = (data as { appName?: string }).appName || prompt.slice(0, 25);

      const newVersion: VersionHistoryItem = {
        id: String(Date.now()),
        version: newVersionNum,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        title: appName,
        prompt,
        code: updatedCode,
        files: {
          'index.html': updatedCode,
          'App.tsx': `// App.tsx\nimport React from 'react';\n\nexport default function App() {\n  return <main>/* Generated with Lovable */</main>;\n}`,
          'schema.sql': `-- Supabase Schema\nCREATE TABLE records (id SERIAL PRIMARY KEY, data JSONB);`,
        },
      };

      setProject((prev) => ({
        ...prev,
        name: appName,
        code: updatedCode,
        files: {
          ...prev.files,
          'index.html': updatedCode,
        },
        versions: [newVersion, ...prev.versions],
      }));

      // Add assistant reply
      const assistantMsg: ChatMessage = {
        id: String(Date.now() + 1),
        sender: 'assistant',
        text: (data as { explanation?: string }).explanation || (language === 'ar' ? 'تم إنشاء التطبيق بنجاح!' : 'App generated successfully!'),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        versionTag: newVersionNum,
        plan: (data as { plan?: string[] }).plan || currentPlanSteps,
      };
      setChatMessages((prev) => [...prev, assistantMsg]);
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
      title: appName || (language === 'ar' ? 'توليد عبر Gemini 3.8' : 'Synthesized via Gemini 3.8'),
      prompt: appName ? `توليد تطبيق ${appName} عبر Gemini 3.8 Flash` : 'Gemini 3.8 Flash Code Synthesis',
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
        ? `⚡ تم بناء وتطبيق كود "${appName || project.name}" بنجاح بواسطة أحدث محرك ذكاء اصطناعي Google Gemini 3.8 Flash!`
        : `⚡ Successfully synthesized and deployed "${appName || project.name}" via the latest Google Gemini 3.8 Flash engine!`,
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
      />

      {/* Main Studio Body: Left Sidebar + Right Workspace */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
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
        />

        {/* Right Workspace: Preview, Code Editor, or Split View */}
        <main className="flex-1 flex overflow-hidden relative">
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

      {/* Backend & Supabase Integrations Modal */}
      {showIntegrations && (
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

      {/* Owner Admin Dashboard Modal */}
      <AdminDashboardModal
        isOpen={showAdminDashboard}
        onClose={() => setShowAdminDashboard(false)}
        language={language}
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
