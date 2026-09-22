import { useState, useRef, useEffect } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import {
  Send,
  Sparkles,
  MessageSquare,
  FolderTree,
  History,
  RotateCcw,
  Mic,
  MicOff,
  CheckCircle2,
  Clock,
  FileCode,
  Crown,
  Smartphone,
  Copy,
  Check,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { ChatMessage, VersionHistoryItem, Language, UserSubscription } from '../types';
import { QUICK_PROMPT_SUGGESTIONS } from '../data/templates';
import { ORANGE_CASH_WALLET_NUMBER, ORANGE_CASH_USSD_CODE } from '../data/plans';

interface ChatSidebarProps {
  messages: ChatMessage[];
  versions: VersionHistoryItem[];
  files: Record<string, string>;
  activeFile: string;
  onSelectFile: (fileName: string) => void;
  onRestoreVersion: (version: VersionHistoryItem) => void;
  onSubmitPrompt: (prompt: string) => void;
  isGenerating: boolean;
  currentPlanSteps: string[];
  language: Language;
  selectedElementRef?: string | null;
  onClearSelectedElement?: () => void;
  subscription?: UserSubscription;
  onOpenSubscription?: () => void;
  onOpenGeminiStudio?: () => void;
}

export const ChatSidebar = ({
  messages,
  versions,
  files,
  activeFile,
  onSelectFile,
  onRestoreVersion,
  onSubmitPrompt,
  isGenerating,
  currentPlanSteps,
  language,
  selectedElementRef,
  onClearSelectedElement,
  subscription,
  onOpenSubscription,
  onOpenGeminiStudio,
}: ChatSidebarProps) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'files' | 'history' | 'subscription'>('chat');
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [copiedWallet, setCopiedWallet] = useState(false);
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  const handleEnhanceCurrentPrompt = async () => {
    if (!inputText.trim() || isEnhancingPrompt) return;
    setIsEnhancingPrompt(true);
    try {
      const res = await fetch('/api/ai/gemini-enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: inputText.trim(), language }),
      });
      const data = await res.json().catch(() => ({}));
      if (data && (data as { enhancedPrompt?: string }).enhancedPrompt) {
        setInputText((data as { enhancedPrompt: string }).enhancedPrompt);
      }
    } catch (e) {
      console.warn('Enhance prompt failed:', e);
    } finally {
      setIsEnhancingPrompt(false);
    }
  };

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentPlanSteps]);

  // Speech to Text support
  const toggleSpeechRecognition = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    type SpeechRecognitionInstance = {
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      onstart: (() => void) | null;
      onend: (() => void) | null;
      onerror: (() => void) | null;
      onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
      start: () => void;
      stop: () => void;
    };
    const win = window as unknown as Record<string, (new () => SpeechRecognitionInstance) | undefined>;
    const SpeechRecognitionCtor = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      alert(language === 'ar' ? 'متصفحك لا يدعم التعرف الصوتي المباشر.' : 'Speech recognition not supported in this browser.');
      return;
    }

    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = language === 'ar' ? 'ar-SA' : 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognition.onresult = (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => {
        const transcript = event.results[0][0].transcript;
        setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error(e);
      setIsListening(false);
    }
  };

  const handleSend = (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isGenerating) return;
    onSubmitPrompt(inputText.trim());
    setInputText('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <aside className="w-full md:w-96 lg:w-[410px] bg-slate-900 border-r border-slate-800 flex flex-col h-full shrink-0 select-none text-slate-200">
      {/* Sidebar Header Tabs */}
      <div className="flex items-center border-b border-slate-800 bg-slate-950 px-2 pt-2">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 ${
            activeTab === 'chat'
              ? 'border-rose-500 text-white bg-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 text-rose-400" />
          <span>{language === 'ar' ? 'المحادثة والذكاء' : 'Chat & AI'}</span>
        </button>

        <button
          onClick={() => setActiveTab('files')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 ${
            activeTab === 'files'
              ? 'border-rose-500 text-white bg-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FolderTree className="w-3.5 h-3.5 text-blue-400" />
          <span>{language === 'ar' ? 'الملفات' : 'Files'}</span>
          <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 rounded-full text-slate-400">
            {Object.keys(files).length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 ${
            activeTab === 'history'
              ? 'border-rose-500 text-white bg-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-3.5 h-3.5 text-emerald-400" />
          <span>{language === 'ar' ? 'الإصدارات' : 'History'}</span>
          <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 rounded-full text-slate-400">
            {versions.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('subscription')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 ${
            activeTab === 'subscription'
              ? 'border-orange-500 text-white bg-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5 text-orange-400" />
          <span>{language === 'ar' ? 'الاشتراك' : 'Billing'}</span>
          {subscription && (subscription.tier === 'pro' || subscription.tier === 'business') ? (
            <span className="text-[9px] px-1 py-0.2 bg-emerald-500/20 text-emerald-300 rounded font-bold uppercase">
              PRO
            </span>
          ) : (
            <span className="text-[9px] px-1 py-0.2 bg-orange-500/20 text-orange-300 rounded font-bold">
              Orange
            </span>
          )}
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Quick subscription banner inside Chat tab */}
        {activeTab === 'chat' && subscription && subscription.tier === 'free' && onOpenSubscription && (
          <div 
            onClick={onOpenSubscription}
            className="p-2.5 rounded-xl bg-gradient-to-r from-orange-950/40 via-slate-900 to-slate-900 border border-orange-500/30 flex items-center justify-between cursor-pointer hover:border-orange-500/60 transition group"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
              <div className="text-[11px]">
                <span className="font-bold text-white">
                  {language === 'ar' ? 'الباقة المجانية' : 'Starter Plan'}
                </span>
                <span className="text-slate-400 mx-1">•</span>
                <span className="text-slate-400 font-mono">{subscription.generationsUsedToday}/{subscription.generationsLimitToday}</span>
              </div>
            </div>

            <div className="flex items-center gap-1 text-[11px] font-bold text-orange-400 group-hover:text-orange-300">
              <span>{language === 'ar' ? 'ترقية عبر Orange Cash' : 'Upgrade Pro'}</span>
              {language === 'ar' ? <ArrowLeft className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
            </div>
          </div>
        )}
        {/* Tab 1: Chat & Reasoning Stream */}
        {activeTab === 'chat' && (
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-12 px-4 text-slate-400 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto text-xl">
                  ✨
                </div>
                <h4 className="font-bold text-white text-sm">
                  {language === 'ar' ? 'مساعد ابنيلي الذكي جاهز' : 'ابنيلي AI Copilot Ready'}
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {language === 'ar'
                    ? 'صف ما تريد إضافته أو تعديله، أو استخدم مؤشر الفحص لاختيار أي عنصر وتعديله فورياً.'
                    : 'Describe what feature or adjustment you need, or click any element in the live preview to inspect and modify it.'}
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.sender === 'user' ? 'items-end' : 'items-start'
                  } space-y-1.5`}
                >
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <span className="font-semibold">
                      {msg.sender === 'user'
                        ? language === 'ar' ? 'أنت' : 'You'
                        : language === 'ar' ? 'محرك ابنيلي' : 'ابنيلي Engine'}
                    </span>
                    <span>•</span>
                    <span>{msg.timestamp}</span>
                    {msg.versionTag && (
                      <span className="bg-slate-800 text-rose-300 text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-700">
                        {msg.versionTag}
                      </span>
                    )}
                  </div>

                  {msg.selectedElementRef && (
                    <div className="text-[11px] bg-rose-500/10 border border-rose-500/30 text-rose-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <span>🎯 {language === 'ar' ? 'عنصر مستهدف:' : 'Target:'}</span>
                      <code className="font-mono">{msg.selectedElementRef}</code>
                    </div>
                  )}

                  <div
                    className={`rounded-2xl p-3.5 text-xs leading-relaxed max-w-[95%] select-text ${
                      msg.sender === 'user'
                        ? 'bg-rose-600 text-white shadow-xs rounded-tr-xs'
                        : 'bg-slate-800/90 text-slate-100 border border-slate-700/70 rounded-tl-xs'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>

                  {/* Plan steps for assistant messages if present */}
                  {msg.plan && msg.plan.length > 0 && (
                    <div className="w-full bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
                        <span className="flex items-center gap-1.5 text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {language === 'ar' ? 'خطوات التنفيذ والإنجاز' : 'Implementation Plan'}
                        </span>
                        <span>{msg.plan.length} {language === 'ar' ? 'خطوات' : 'steps'}</span>
                      </div>
                      <div className="space-y-1.5">
                        {msg.plan.map((step, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-slate-300 text-[11px]">
                            <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[10px] mt-0.5">
                              ✓
                            </span>
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Live Progress Card when generating */}
            {isGenerating && (
              <div className="bg-slate-950 border border-rose-500/30 rounded-2xl p-4 space-y-3 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-rose-400 text-xs font-bold">
                    <Sparkles className="w-4 h-4 animate-spin text-rose-400" />
                    <span>{language === 'ar' ? 'جاري التفكير والتوليد عبر ابنيلي...' : 'Ibni-li AI Generating...'}</span>
                  </div>
                  <span className="text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full font-mono">
                    gemini-3.8-flash
                  </span>
                </div>

                <div className="space-y-2 pt-1">
                  {(currentPlanSteps.length > 0 ? currentPlanSteps : [
                    language === 'ar' ? 'تحليل الطلب وتجهيز المعمارية...' : 'Analyzing prompt & architecture...',
                    language === 'ar' ? 'إنشاء عناصر الواجهة بنظام Tailwind...' : 'Generating interactive Tailwind components...',
                    language === 'ar' ? 'ربط دوال الحالة والمعاينة الحية...' : 'Wiring state handlers & sandbox preview...'
                  ]).map((step, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-slate-300">
                      <div className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Tab 2: Files Explorer */}
        {activeTab === 'files' && (
          <div className="space-y-3">
            <div className="text-xs text-slate-400 font-medium px-1">
              {language === 'ar' ? 'ملفات المشروع المهيئة' : 'Project Files'}
            </div>

            <div className="space-y-1">
              {Object.keys(files).map((fileName) => {
                const isActive = activeFile === fileName;
                return (
                  <button
                    key={fileName}
                    onClick={() => onSelectFile(fileName)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition cursor-pointer ${
                      isActive
                        ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileCode className={`w-3.5 h-3.5 ${isActive ? 'text-rose-400' : 'text-slate-400'}`} />
                      <span className="truncate">{fileName}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      {Math.round((files[fileName]?.length || 0) / 1024 * 10) / 10} KB
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3: Version History */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            <div className="text-xs text-slate-400 font-medium px-1">
              {language === 'ar' ? 'نقاط الاسترجاع وسجل التعديلات' : 'Revisions & Snapshots'}
            </div>

            <div className="space-y-2">
              {versions.map((ver, idx) => (
                <div
                  key={ver.id}
                  className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2 hover:border-slate-700 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      {ver.version}
                    </span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {ver.timestamp}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 line-clamp-2 italic">
                    "{ver.prompt}"
                  </p>

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => onRestoreVersion(ver)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1 rounded-lg border border-rose-500/30 transition cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>{language === 'ar' ? 'استرجاع هذه النسخة' : 'Restore Version'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: Subscription & Orange Cash Details */}
        {activeTab === 'subscription' && (
          <div className="space-y-4">
            <div className="text-xs text-slate-400 font-medium px-1">
              {language === 'ar' ? 'تفاصيل الاشتراك ومحفظة الدفع' : 'Subscription & Wallet'}
            </div>

            {/* Plan Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-orange-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    {subscription?.planName || (language === 'ar' ? 'الباقة المجانية' : 'Starter Free')}
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  {language === 'ar' ? 'حساب نشط' : 'Active'}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-300 border-y border-slate-800 py-2">
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>{language === 'ar' ? 'توليد الذكاء اليومي:' : 'Daily AI Prompts:'}</span>
                  <strong className="text-white">
                    {subscription && subscription.generationsLimitToday > 100
                      ? (language === 'ar' ? 'غير محدود ∞' : 'Unlimited ∞')
                      : `${subscription?.generationsUsedToday || 0}/${subscription?.generationsLimitToday || 5}`}
                  </strong>
                </div>
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>{language === 'ar' ? 'تصدير الكود (ZIP):' : 'Full ZIP Export:'}</span>
                  <strong className="text-emerald-400">
                    {subscription?.canExportZip ? (language === 'ar' ? 'متاح ✅' : 'Unlocked ✅') : (language === 'ar' ? 'يتطلب باقة Pro' : 'Requires Pro')}
                  </strong>
                </div>
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>{language === 'ar' ? 'التعديل البصري المباشر:' : 'Visual Inspector:'}</span>
                  <strong className="text-rose-400">
                    {subscription?.canUseVisualInspector ? (language === 'ar' ? 'متاح ✅' : 'Enabled ✅') : (language === 'ar' ? 'غير متاح' : 'Locked')}
                  </strong>
                </div>
              </div>

              {onOpenSubscription && (
                <button
                  onClick={onOpenSubscription}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-400 hover:to-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20 transition cursor-pointer"
                >
                  <Crown className="w-3.5 h-3.5" />
                  <span>
                    {subscription?.tier === 'pro' || subscription?.tier === 'business'
                      ? (language === 'ar' ? 'إدارة الاشتراك وسجل المعاملات' : 'Manage Subscription & Invoices')
                      : (language === 'ar' ? 'ترقية الحساب الآن (Orange Cash)' : 'Upgrade to Pro with Orange Cash')}
                  </span>
                </button>
              )}
            </div>

            {/* Official Orange Cash Box */}
            <div className="p-4 rounded-2xl bg-gradient-to-b from-orange-950/40 to-slate-950 border border-orange-500/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-orange-300 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-orange-400" />
                  <span>Orange Cash Mobile Wallet</span>
                </span>
                <span className="text-[10px] bg-orange-500/20 text-orange-300 font-mono px-1.5 py-0.5 rounded">
                  {ORANGE_CASH_USSD_CODE}
                </span>
              </div>

              <div className="bg-slate-950 px-3 py-2.5 rounded-xl border border-orange-500/50 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block">{language === 'ar' ? 'رقم محفظة التحويل:' : 'Recipient Wallet:'}</span>
                  <span className="text-base font-mono font-black text-white tracking-wider">
                    {ORANGE_CASH_WALLET_NUMBER}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(ORANGE_CASH_WALLET_NUMBER).catch(() => undefined);
                    setCopiedWallet(true);
                    setTimeout(() => setCopiedWallet(false), 2000);
                  }}
                  className="px-2.5 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1"
                >
                  {copiedWallet ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedWallet ? (language === 'ar' ? 'تم' : 'Done') : (language === 'ar' ? 'نسخ' : 'Copy')}</span>
                </button>
              </div>

              <div className="text-[11px] text-slate-400 space-y-1">
                <p>
                  {language === 'ar'
                    ? '1. حول قيمة الباقة (249 ج.م أو 599 ج.م) إلى الرقم أعلاه.'
                    : '1. Transfer the plan amount to the wallet number above.'}
                </p>
                <p>
                  {language === 'ar'
                    ? '2. أدخل الرقم المرجعي من رسالة التأكيد لتفعيل حسابك فورياً.'
                    : '2. Submit your transaction reference code for instant activation.'}
                </p>
              </div>

              {onOpenSubscription && (
                <button
                  onClick={onOpenSubscription}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition cursor-pointer flex items-center justify-center gap-1"
                >
                  <span>{language === 'ar' ? 'نموذج إدخال كود المعاملة المرجعي' : 'Submit Reference Code'}</span>
                  {language === 'ar' ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Selected Element Floating Bar (when Visual Inspect mode is triggered) */}
      {selectedElementRef && (
        <div className="mx-3 p-2.5 bg-rose-500/10 border border-rose-500/40 rounded-xl flex items-center justify-between text-xs text-rose-200">
          <div className="flex items-center gap-2 truncate">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping shrink-0" />
            <span className="truncate">
              {language === 'ar' ? 'عنصر محدد للتعديل:' : 'Inspecting element:'}{' '}
              <strong className="text-white font-mono">{selectedElementRef}</strong>
            </span>
          </div>
          {onClearSelectedElement && (
            <button
              onClick={onClearSelectedElement}
              className="text-rose-400 hover:text-white text-xs font-bold px-2 py-0.5 rounded hover:bg-rose-500/20"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Quick Suggestions Chips & AI Enhance */}
      <div className="px-3 py-1 flex items-center justify-between gap-1.5 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1.5 shrink-0">
          {QUICK_PROMPT_SUGGESTIONS.slice(0, 2).map((sug, i) => (
            <button
              key={i}
              onClick={() => setInputText(language === 'ar' ? sug.ar : sug.en)}
              className="text-[10px] whitespace-nowrap bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white px-2 py-0.5 rounded-full border border-slate-700/60 transition cursor-pointer"
            >
              {language === 'ar' ? sug.ar : sug.en}
            </button>
          ))}
        </div>

        {onOpenGeminiStudio && (
          <button
            onClick={onOpenGeminiStudio}
            className="text-[10px] font-bold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30 transition flex items-center gap-1 shrink-0"
          >
            <Sparkles className="w-2.5 h-2.5" />
            <span>Gemini 3.8 Studio</span>
          </button>
        )}
      </div>

      {/* Bottom Prompt Input */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/80">
        <form onSubmit={handleSend} className="space-y-2">
          {/* Engine Ribbon */}
          <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
            <div className="flex items-center gap-1 font-mono text-[10px] text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Gemini 3.8 Flash (DeepMind)</span>
            </div>

            {inputText.trim() && (
              <button
                type="button"
                onClick={handleEnhanceCurrentPrompt}
                disabled={isEnhancingPrompt}
                className="text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1 transition"
                title={language === 'ar' ? 'تحسين صياغة البرومبت بذكاء Gemini 3.8' : 'Enhance prompt with Gemini 3.8'}
              >
                <Sparkles className={`w-2.5 h-2.5 ${isEnhancingPrompt ? 'animate-spin' : ''}`} />
                <span>{isEnhancingPrompt ? (language === 'ar' ? 'جاري التحسين...' : 'Optimizing...') : (language === 'ar' ? '⚡ تحسين البرومبت' : '⚡ Enhance')}</span>
              </button>
            )}
          </div>

          <div className="relative bg-slate-900 border border-slate-800 rounded-xl focus-within:border-rose-500/70 focus-within:ring-1 focus-within:ring-rose-500/50 transition">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedElementRef
                  ? language === 'ar'
                    ? `اطلب تعديل العنصر المحدد (${selectedElementRef})...`
                    : `Prompt changes for inspected ${selectedElementRef}...`
                  : language === 'ar'
                  ? 'اطلب ميزة جديدة، تعديل تصميم، أو إضافة تفاعل...'
                  : 'Ask to add a feature, refine layout, or wire data...'
              }
              rows={2}
              className="w-full bg-transparent text-xs text-white placeholder-slate-500 p-3 pr-10 focus:outline-none resize-none"
            />

            {/* Voice Dictation Button */}
            <button
              type="button"
              onClick={toggleSpeechRecognition}
              className={`absolute right-2.5 bottom-2.5 p-1.5 rounded-lg transition cursor-pointer ${
                isListening
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title={language === 'ar' ? 'إملاء صوتي' : 'Speech to text'}
            >
              {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="hidden sm:inline">
              {language === 'ar' ? 'اضغط Enter للإرسال' : 'Press Enter to generate'}
            </span>

            <button
              type="submit"
              disabled={!inputText.trim() || isGenerating}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer ${
                inputText.trim() && !isGenerating
                  ? 'bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white shadow-sm shadow-rose-500/30'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <span>{language === 'ar' ? 'تطبيق التعديل' : 'Update App'}</span>
              <Send className="w-3 h-3" />
            </button>
          </div>
        </form>
      </div>
    </aside>
  );
};
