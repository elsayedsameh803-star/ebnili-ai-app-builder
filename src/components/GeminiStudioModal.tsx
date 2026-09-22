import { useState } from 'react';
import {
  Sparkles,
  Cpu,
  Zap,
  Layers,
  Check,
  Copy,
  RefreshCw,
  Wand2,
  CheckCircle2,
  FileCode,
  Crown
} from 'lucide-react';
import { Language, UserSubscription } from '../types';
import { STARTER_TEMPLATES } from '../data/templates';
import { ORANGE_CASH_WALLET_NUMBER } from '../data/plans';

interface GeminiStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  currentCode: string;
  onApplyGeneratedCode: (code: string, appName?: string, plan?: string[]) => void;
  subscription?: UserSubscription;
  onOpenSubscription?: () => void;
}

export const GeminiStudioModal = ({
  isOpen,
  onClose,
  language,
  currentCode,
  onApplyGeneratedCode,
  subscription,
  onOpenSubscription,
}: GeminiStudioModalProps) => {
  const [activeTab, setActiveTab] = useState<'generator' | 'architect' | 'doctor' | 'quota'>('generator');
  
  // Prompt Generator State
  const [prompt, setPrompt] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('saas-dashboard');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [thinkingSteps, setThinkingSteps] = useState<string[]>([]);
  const [enhancedSuccess, setEnhancedSuccess] = useState(false);

  // Architect State
  const [architectPrompt, setArchitectPrompt] = useState('');
  const [isArchitecting, setIsArchitecting] = useState(false);
  const [architectResult, setArchitectResult] = useState<{
    appName?: string;
    thinkingSteps?: string[];
    htmlCode?: string;
    reactComponent?: string;
    apiEndpoint?: string;
    databaseSchema?: string;
    model?: string;
  } | null>(null);
  const [architectTab, setArchitectTab] = useState<'html' | 'react' | 'api' | 'sql' | 'steps'>('html');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Code Doctor State
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [doctorResult, setDoctorResult] = useState<{
    diagnosis?: string;
    improvements?: string[];
    fixedCode?: string;
  } | null>(null);
  const [doctorSuccess, setDoctorSuccess] = useState(false);

  if (!isOpen) return null;

  // Handle AI Prompt Enhancement with Gemini 3.8 Flash
  const handleEnhancePrompt = async () => {
    if (!prompt.trim() || isEnhancing) return;
    setIsEnhancing(true);
    setEnhancedSuccess(false);

    try {
      const res = await fetch('/api/ai/gemini-enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          category: selectedCategory,
          language,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if ((data as { enhancedPrompt?: string }).enhancedPrompt) {
        setPrompt((data as { enhancedPrompt: string }).enhancedPrompt);
        setSuggestedTags((data as { suggestedTags?: string[] }).suggestedTags || []);
        setEnhancedSuccess(true);
        setTimeout(() => setEnhancedSuccess(false), 4000);
      }
    } catch (err) {
      console.error('Enhance error:', err);
    } finally {
      setIsEnhancing(false);
    }
  };

  // Handle Full App Generation with Gemini 3.8 Flash
  const handleGenerateApp = async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    setThinkingSteps([
      language === 'ar' ? 'تهيئة نموذج Gemini 3.8 Flash وتحليل متطلبات التطبيق' : 'Initializing Gemini 3.8 Flash & parsing prompt specifications',
      language === 'ar' ? 'صياغة نظام الألوان والتصميم المتجاوب بنظام Tailwind CSS' : 'Synthesizing responsive visual layout with Tailwind CSS',
      language === 'ar' ? 'توليد منطق التفاعل وحفظ البيانات في الذاكرة المحلية' : 'Writing dynamic interactive state & event handlers',
      language === 'ar' ? 'تجهيز المعاينة الحية للاستخدام الفوري' : 'Finalizing single-page interactive bundle for live preview',
    ]);

    try {
      const res = await fetch('/api/ai/generate-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          templateId: selectedCategory,
          language,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if ((data as { code?: string }).code) {
        onApplyGeneratedCode(
          (data as { code: string }).code,
          (data as { appName?: string }).appName,
          (data as { plan?: string[] }).plan,
        );
        onClose();
      }
    } catch (err) {
      console.error('Generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle Multi-Tier Architect Generation
  const handleRunArchitect = async () => {
    if (!architectPrompt.trim() || isArchitecting) return;
    setIsArchitecting(true);

    try {
      const res = await fetch('/api/ai/gemini-architect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: architectPrompt.trim(),
          language,
        }),
      });
      const data = await res.json().catch(() => null);
      if (data) {
        setArchitectResult(data);
      }
    } catch (err) {
      console.error('Architect error:', err);
    } finally {
      setIsArchitecting(false);
    }
  };

  // Handle Code Doctor
  const handleRunDoctor = async () => {
    if (isDiagnosing || !currentCode) return;
    setIsDiagnosing(true);
    setDoctorSuccess(false);

    try {
      const res = await fetch('/api/ai/gemini-code-doctor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: currentCode,
          issueDescription: 'Check for layout bugs, responsiveness, and optimize script performance',
          language,
        }),
      });
      const data = await res.json().catch(() => null);
      if (data) {
        setDoctorResult(data);
        setDoctorSuccess(true);
      }
    } catch (err) {
      console.error('Doctor error:', err);
    } finally {
      setIsDiagnosing(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard?.writeText(text).catch(() => undefined);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        
        {/* Modal Top Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500 via-purple-600 to-amber-400 flex items-center justify-center shadow-lg shadow-rose-500/20">
              <Sparkles className="w-5 h-5 text-white animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  {language === 'ar' ? 'استوديو ومولد جيميناي 3.8 Flash' : 'Gemini 3.8 Flash AI Studio'}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{language === 'ar' ? 'أحدث إصدار نشط' : 'Latest Model Active'}</span>
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {language === 'ar' 
                  ? 'محرك الذكاء الاصطناعي الفائق لتوليد التطبيقات الكاملة وهندسة البرمجيات المتعددة'
                  : 'DeepMind Gemini 3.8 Flash engine for full-stack code synthesis and architectural design'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
          >
            ✕
          </button>
        </div>

        {/* Engine Specs Ribbon */}
        <div className="px-6 py-2 bg-slate-900/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-slate-300 font-mono text-[11px]">
              <Cpu className="w-3.5 h-3.5 text-rose-400" />
              <span>Model: gemini-3.8-flash</span>
            </span>
            <span className="flex items-center gap-1 text-slate-400 text-[11px]">
              <Zap className="w-3 h-3 text-amber-400" />
              <span>Ultra-Fast Latency (~0.4s)</span>
            </span>
          </div>

          {subscription && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">
                {language === 'ar' ? 'الخطة:' : 'Plan:'} <strong className="text-white uppercase font-mono">{subscription.tier}</strong>
              </span>
              {subscription.tier === 'free' && onOpenSubscription && (
                <button
                  onClick={onOpenSubscription}
                  className="text-[10px] font-bold text-orange-400 hover:text-orange-300 bg-orange-500/10 hover:bg-orange-500/20 px-2 py-0.5 rounded border border-orange-500/30 transition flex items-center gap-1"
                >
                  <Crown className="w-2.5 h-2.5" />
                  <span>Orange Cash (01207782741)</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-slate-800 bg-slate-950/70 px-6">
          <button
            onClick={() => setActiveTab('generator')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition ${
              activeTab === 'generator'
                ? 'border-rose-500 text-white bg-slate-900/50'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5 text-rose-400" />
            <span>{language === 'ar' ? 'مولد التطبيقات الذكي' : 'App Builder Studio'}</span>
          </button>

          <button
            onClick={() => setActiveTab('architect')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition ${
              activeTab === 'architect'
                ? 'border-rose-500 text-white bg-slate-900/50'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>{language === 'ar' ? 'مهندس الأكواد (React + API + SQL)' : 'Multi-Tier Architect'}</span>
          </button>

          <button
            onClick={() => setActiveTab('doctor')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition ${
              activeTab === 'doctor'
                ? 'border-rose-500 text-white bg-slate-900/50'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5 text-emerald-400" />
            <span>{language === 'ar' ? 'طبيب الأكواد والفحص' : 'Code Doctor'}</span>
          </button>

          <button
            onClick={() => setActiveTab('quota')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition ${
              activeTab === 'quota'
                ? 'border-orange-500 text-white bg-slate-900/50'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Crown className="w-3.5 h-3.5 text-orange-400" />
            <span>{language === 'ar' ? 'الاشتراك ومحفظة Orange Cash' : 'Billing & Wallet'}</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* TAB 1: Smart App Builder */}
          {activeTab === 'generator' && (
            <div className="space-y-6">
              {/* Category selector */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">
                  {language === 'ar' ? '1. اختر نمط أو نموذج التطبيق الأساسي:' : '1. Select Base Application Archetype:'}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {STARTER_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      onClick={() => {
                        setSelectedCategory(tmpl.id);
                        setPrompt(language === 'ar' ? tmpl.promptAr : tmpl.promptEn);
                      }}
                      className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition cursor-pointer ${
                        selectedCategory === tmpl.id
                          ? 'bg-rose-500/10 border-rose-500 text-white shadow-sm'
                          : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <span className="text-xl">{tmpl.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate">
                          {language === 'ar' ? tmpl.titleAr : tmpl.titleEn}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          {tmpl.tags.join(' • ')}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Prompt Box */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-300">
                    {language === 'ar' ? '2. صف تطبيقك بالتفصيل (أو اطلب تحسينه بـ Gemini 3.8):' : '2. Describe Your Application:'}
                  </label>

                  {/* AI Prompt Optimizer Button */}
                  <button
                    type="button"
                    onClick={handleEnhancePrompt}
                    disabled={!prompt.trim() || isEnhancing}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      prompt.trim() && !isEnhancing
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isEnhancing ? 'animate-spin' : 'text-amber-300'}`} />
                    <span>
                      {isEnhancing
                        ? language === 'ar' ? 'جاري التحسين بـ Gemini 3.8...' : 'Optimizing with Gemini 3.8...'
                        : language === 'ar' ? '⚡ تحسين البرومبت بـ Gemini 3.8' : '⚡ Enhance Prompt with Gemini'}
                    </span>
                  </button>
                </div>

                <div className="relative">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={4}
                    placeholder={
                      language === 'ar'
                        ? 'مثال: ابني لي متجر إلكتروني فخم للهواتف الذكية مع سلة مشتريات جانبية، جدول مقارنة مواصفات، وفلترة حسب السعر والماركة وتصميم داكن أنيق...'
                        : 'Example: Build a modern e-commerce platform with slide-over cart, product specs comparator, and dark sleek design...'
                    }
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-3.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/50 leading-relaxed font-sans"
                  />

                  {enhancedSuccess && (
                    <div className="absolute top-2 left-2 bg-emerald-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{language === 'ar' ? 'تم تحسين البرومبت بنجاح بواسطة Gemini 3.8' : 'Prompt Enhanced by Gemini 3.8'}</span>
                    </div>
                  )}
                </div>

                {/* Suggested Tags */}
                {suggestedTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="text-[10px] text-slate-400 font-semibold self-center">
                      {language === 'ar' ? 'العناصر المدمجة:' : 'Integrated Features:'}
                    </span>
                    {suggestedTags.map((tag, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Live Generation Progress Steps */}
              {isGenerating && (
                <div className="p-4 rounded-xl bg-slate-950/80 border border-rose-500/30 space-y-2.5 animate-pulse">
                  <div className="flex items-center gap-2 text-rose-400 text-xs font-bold">
                    <Sparkles className="w-4 h-4 animate-spin" />
                    <span>{language === 'ar' ? 'Gemini 3.8 Flash يقوم ببناء وتجميع تطبيقك الآن...' : 'Gemini 3.8 Flash is crafting your application...'}</span>
                  </div>
                  <div className="space-y-1 text-xs text-slate-300 pl-6">
                    {thinkingSteps.map((step, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Button */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white rounded-lg transition"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>

                <button
                  type="button"
                  onClick={handleGenerateApp}
                  disabled={!prompt.trim() || isGenerating}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                    prompt.trim() && !isGenerating
                      ? 'bg-gradient-to-r from-rose-500 via-pink-600 to-amber-500 hover:from-rose-400 hover:to-pink-500 text-white shadow-md shadow-rose-500/30'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Wand2 className="w-4 h-4" />
                  <span>
                    {isGenerating 
                      ? language === 'ar' ? 'جاري التوليد بـ Gemini 3.8...' : 'Generating with Gemini 3.8...'
                      : language === 'ar' ? '🚀 توليد التطبيق وتطبيقه في المعاينة' : '🚀 Build & Mount into Live Preview'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Multi-Tier Architect */}
          {activeTab === 'architect' && (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">
                  {language === 'ar' ? 'أدخل فكرة الميزة أو النظام المعماري المطلوب:' : 'Enter Target System Specification:'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={architectPrompt}
                    onChange={(e) => setArchitectPrompt(e.target.value)}
                    placeholder={
                      language === 'ar'
                        ? 'مثال: نظام إدارة الاشتراكات والمدفوعات الإلكترونية مع جدول المعاملات...'
                        : 'Example: Subscription billing & transactions ledger system...'
                    }
                    className="flex-1 bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={handleRunArchitect}
                    disabled={!architectPrompt.trim() || isArchitecting}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs transition flex items-center gap-2 disabled:opacity-50"
                  >
                    <Layers className="w-4 h-4" />
                    <span>{isArchitecting ? (language === 'ar' ? 'جاري الهندسة...' : 'Synthesizing...') : (language === 'ar' ? 'هندسة الكود' : 'Architect Code')}</span>
                  </button>
                </div>
              </div>

              {architectResult && (
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                  {/* Sub Tabs */}
                  <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-3 py-1.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setArchitectTab('html')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                          architectTab === 'html' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        🌐 HTML App
                      </button>
                      <button
                        onClick={() => setArchitectTab('react')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                          architectTab === 'react' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        ⚛️ React Component
                      </button>
                      <button
                        onClick={() => setArchitectTab('api')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                          architectTab === 'api' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        🚀 Express Route
                      </button>
                      <button
                        onClick={() => setArchitectTab('sql')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                          architectTab === 'sql' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        🗄️ SQL Schema
                      </button>
                      <button
                        onClick={() => setArchitectTab('steps')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                          architectTab === 'steps' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        🧠 Reasoning
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {architectTab === 'html' && architectResult.htmlCode && (
                        <button
                          onClick={() => {
                            if (architectResult.htmlCode) {
                              onApplyGeneratedCode(architectResult.htmlCode, architectResult.appName);
                              onClose();
                            }
                          }}
                          className="px-2.5 py-1 rounded bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold transition flex items-center gap-1"
                        >
                          <span>{language === 'ar' ? 'تطبيق في المعاينة الحية' : 'Mount into Live Preview'}</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          const currentText = architectTab === 'html' ? architectResult.htmlCode :
                            architectTab === 'react' ? architectResult.reactComponent :
                            architectTab === 'api' ? architectResult.apiEndpoint :
                            architectTab === 'sql' ? architectResult.databaseSchema :
                            architectResult.thinkingSteps?.join('\n') || '';
                          copyToClipboard(currentText || '', architectTab);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1"
                      >
                        {copiedKey === architectTab ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedKey === architectTab ? (language === 'ar' ? 'تم النسخ' : 'Copied') : (language === 'ar' ? 'نسخ الكود' : 'Copy')}</span>
                      </button>
                    </div>
                  </div>

                  {/* Code Viewer */}
                  <div className="p-4 max-h-96 overflow-y-auto font-mono text-xs text-slate-300 leading-relaxed">
                    {architectTab === 'html' && <pre className="whitespace-pre-wrap">{architectResult.htmlCode}</pre>}
                    {architectTab === 'react' && <pre className="whitespace-pre-wrap">{architectResult.reactComponent}</pre>}
                    {architectTab === 'api' && <pre className="whitespace-pre-wrap">{architectResult.apiEndpoint}</pre>}
                    {architectTab === 'sql' && <pre className="whitespace-pre-wrap">{architectResult.databaseSchema}</pre>}
                    {architectTab === 'steps' && (
                      <div className="space-y-2">
                        <div className="font-bold text-white mb-2">{architectResult.appName}</div>
                        {architectResult.thinkingSteps?.map((step, i) => (
                          <div key={i} className="flex items-start gap-2 text-slate-300">
                            <span className="text-emerald-400 font-bold font-sans">✓</span>
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Code Doctor */}
          {activeTab === 'doctor' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-white flex items-center gap-2">
                    <span>{language === 'ar' ? 'فحص وصيانة كود المشروع المباشر' : 'Active Project Code Diagnostic'}</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {language === 'ar'
                      ? 'يقوم نموذج Gemini 3.8 بفحص الكود وتصحيح أي أخطاء في الاستجابة أو التنسيق أو منطق العمليات.'
                      : 'Gemini 3.8 scans and remedies syntax errors, layout shifts, and event listener discrepancies.'}
                  </p>
                </div>

                <button
                  onClick={handleRunDoctor}
                  disabled={isDiagnosing}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center gap-2"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isDiagnosing ? 'animate-spin' : ''}`} />
                  <span>{isDiagnosing ? (language === 'ar' ? 'جاري الفحص...' : 'Diagnosing...') : (language === 'ar' ? 'فحص وتحسين الكود' : 'Run Diagnostic')}</span>
                </button>
              </div>

              {doctorResult && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-2">
                    <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{language === 'ar' ? 'تقرير التشخيص والتحسين:' : 'Diagnosis & Improvement Report:'}</span>
                    </div>
                    <p className="text-xs text-slate-300">{doctorResult.diagnosis}</p>
                    
                    {doctorResult.improvements && doctorResult.improvements.length > 0 && (
                      <div className="pt-2 border-t border-slate-800 space-y-1">
                        <div className="text-[11px] font-bold text-slate-400">
                          {language === 'ar' ? 'التحسينات التي تم تطبيقها:' : 'Applied Improvements:'}
                        </div>
                        {doctorResult.improvements.map((imp, idx) => (
                          <div key={idx} className="text-xs text-slate-300 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span>{imp}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {doctorResult.fixedCode && (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          if (doctorResult.fixedCode) {
                            onApplyGeneratedCode(doctorResult.fixedCode);
                            onClose();
                          }
                        }}
                        className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{language === 'ar' ? 'تطبيق الكود المحسّن في المعاينة' : 'Apply Fixed Code to Live Preview'}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Billing & Orange Cash (01207782741) */}
          {activeTab === 'quota' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-gradient-to-r from-orange-950/40 via-slate-900 to-slate-900 border border-orange-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-orange-400 uppercase tracking-wide">
                      {language === 'ar' ? 'بوابة الدفع الرسمية' : 'Official Payment Gateway'}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 font-bold border border-orange-500/30">
                      Orange Cash
                    </span>
                  </div>
                  <h4 className="text-base font-extrabold text-white mt-1">
                    {language === 'ar' ? 'الترقية الفورية عبر محفظة أورانج كاش' : 'Instant Upgrade via Orange Cash'}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    {language === 'ar'
                      ? 'حول قيمة الاشتراك إلى رقم المحفظة أدناه، وأرسل الرقم المرجعي لتفعيل باقة PRO الفورية.'
                      : 'Transfer plan fee to the mobile wallet number below and submit transaction reference.'}
                  </p>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-orange-500/30 text-center shrink-0">
                  <div className="text-[10px] text-slate-400">{language === 'ar' ? 'رقم محفظة التحويل' : 'Wallet Transfer Number'}</div>
                  <div className="text-base font-black text-orange-400 font-mono tracking-wider">{ORANGE_CASH_WALLET_NUMBER}</div>
                </div>
              </div>

              {/* Plans Quick View */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400">الباقة المجانية (Starter)</span>
                    <span className="text-xs font-bold text-white">0 ج.م / شهرياً</span>
                  </div>
                  <ul className="text-xs text-slate-400 space-y-1.5">
                    <li>✓ 5 أوامر توليد يومياً</li>
                    <li>✓ محرك Gemini 3.8 Flash الأساسي</li>
                    <li>✓ معاينة حية ومحرر الكود</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-gradient-to-b from-orange-950/20 to-slate-950 border border-orange-500/50 space-y-3 relative">
                  <div className="absolute top-3 left-3 bg-orange-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded">
                    الأكثر طلباً
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-orange-400">الباقة الاحترافية (PRO)</span>
                    <span className="text-xs font-black text-white">299 ج.م / شهرياً</span>
                  </div>
                  <ul className="text-xs text-slate-300 space-y-1.5">
                    <li>✓ توليد غير محدود بالذكاء الاصطناعي</li>
                    <li>✓ أولوية قصوى على محرك Gemini 3.8 Flash</li>
                    <li>✓ تصدير كامل لملفات المشروع ZIP & Git</li>
                    <li>✓ مهندس الأكواد الشامل (React + Express + SQL)</li>
                  </ul>

                  {onOpenSubscription && (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenSubscription();
                      }}
                      className="w-full py-2 rounded-lg bg-gradient-to-r from-orange-400 to-amber-400 hover:from-orange-300 hover:to-amber-300 text-slate-950 font-black text-xs transition cursor-pointer"
                    >
                      {language === 'ar' ? 'ترقية الآن عبر Orange Cash (01207782741)' : 'Upgrade via Orange Cash'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
