import React, { useState, useRef } from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  ArrowLeft,
  Mic, 
  MicOff, 
  Paperclip, 
  Layers, 
  Globe,
  Zap,
  CheckCircle,
  Play,
  Crown
} from 'lucide-react';
import { StarterTemplate, Language, UserSubscription } from '../types';
import { STARTER_TEMPLATES } from '../data/templates';

interface NewProjectHeroProps {
  onStartProject: (prompt: string, templateId?: string) => void;
  isGenerating: boolean;
  language: Language;
  onToggleLanguage: () => void;
  subscription?: UserSubscription;
  onOpenSubscription?: () => void;
}

export const NewProjectHero: React.FC<NewProjectHeroProps> = ({
  onStartProject,
  isGenerating,
  language,
  onToggleLanguage,
  subscription,
  onOpenSubscription,
}) => {
  const [promptText, setPromptText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const recognitionRef = useRef<any>(null);

  const toggleSpeech = () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(language === 'ar' ? 'المتصفح لا يدعم التسجيل الصوتي' : 'Speech recognition not supported');
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.lang = language === 'ar' ? 'ar-SA' : 'en-US';
      rec.onstart = () => setIsListening(true);
      rec.onend = () => setIsListening(false);
      rec.onerror = () => setIsListening(false);
      rec.onresult = (e: any) => {
        const text = e.results[0][0].transcript;
        setPromptText((prev) => (prev ? `${prev} ${text}` : text));
      };
      recognitionRef.current = rec;
      rec.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptText.trim() || isGenerating) return;
    onStartProject(promptText.trim());
  };

  const handleSelectTemplate = (tpl: StarterTemplate) => {
    const prompt = language === 'ar' ? tpl.promptAr : tpl.promptEn;
    onStartProject(prompt, tpl.id);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-rose-500 selection:text-white">
      {/* Top Bar */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/90 sticky top-0 z-30 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-500 via-pink-500 to-amber-400 flex items-center justify-center shadow-lg shadow-rose-500/25">
            <span className="text-white text-lg font-bold">♥</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-extrabold tracking-tight text-white font-['Cairo',sans-serif]">
              إبنيلي <span className="text-xs text-slate-400 font-semibold hidden sm:inline">Ebnili</span>
            </span>
            <span className="text-[11px] bg-orange-500/20 text-orange-300 font-semibold px-2 py-0.5 rounded-full border border-orange-500/30">
              AI App Builder
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onOpenSubscription && (
            <button
              onClick={onOpenSubscription}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-slate-950 text-xs font-black transition cursor-pointer shadow-sm shadow-orange-500/20 hover:brightness-110"
              title={language === 'ar' ? 'الترقية ومحفظة Orange Cash (01207782741)' : 'Pricing & Orange Cash'}
            >
              <Crown className="w-3.5 h-3.5" />
              <span>{language === 'ar' ? 'الاشتراكات (Orange Cash)' : 'Plans & Orange Cash'}</span>
            </button>
          )}

          <button
            onClick={onToggleLanguage}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold transition cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'English' : 'العربية (RTL)'}</span>
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-16 flex flex-col items-center justify-center text-center space-y-8">
        <div className="space-y-3 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-rose-300">
            <Sparkles className="w-3.5 h-3.5 text-rose-400" />
            <span>
              {language === 'ar' ? 'مدعوم بنموذج الذكاء الاصطناعي الفائق Gemini' : 'Powered by Gemini 3.8 Flash AI'}
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            {language === 'ar' ? (
              <>
                ابنِ أي فكرة تطبيق ويب <br className="hidden sm:inline" />
                <span className="bg-gradient-to-r from-rose-400 via-pink-400 to-amber-300 bg-clip-text text-transparent">
                  خلال ثوانٍ معدودة بكلماتك
                </span>
              </>
            ) : (
              <>
                Build any web application <br className="hidden sm:inline" />
                <span className="bg-gradient-to-r from-rose-400 via-pink-400 to-amber-300 bg-clip-text text-transparent">
                  in seconds with plain words
                </span>
              </>
            )}
          </h1>

          <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto leading-relaxed">
            {language === 'ar'
              ? 'صف فكرة تطبيقك، متجرك، أو لوحة تحكمك، ودع "ابنيلي" ينشئ الواجهة التفاعلية والكود وقاعدة البيانات مع معاينة حية وتعديل فوري.'
              : 'Describe your idea, CRM, dashboard, or store. Ibni-li (ابنيلي) builds the complete interactive frontend, logic, and layout ready to customize.'}
          </p>
        </div>

        {/* Central Glowing Prompt Box */}
        <div className="w-full max-w-3xl">
          <form
            onSubmit={handleSubmit}
            className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-3 sm:p-4 shadow-2xl shadow-rose-950/20 focus-within:border-rose-500/80 focus-within:ring-2 focus-within:ring-rose-500/20 transition backdrop-blur-xl"
          >
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder={
                language === 'ar'
                  ? 'صف التطبيق الذي تريد بناءه... (مثال: لوحة تحكم لإدارة المبيعات والعملاء مع فلترة وحساب إجمالي الأرباح وتصميم متناسق)'
                  : 'Describe what you want to build... (e.g. A modern CRM dashboard with customer records, live search, sales metrics, and responsive sidebar)'
              }
              rows={3}
              className="w-full bg-transparent text-sm sm:text-base text-white placeholder-slate-500 focus:outline-none resize-none p-2 leading-relaxed"
            />

            <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleSpeech}
                  className={`p-2 rounded-xl text-xs transition cursor-pointer ${
                    isListening
                      ? 'bg-rose-500 text-white animate-pulse'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title={language === 'ar' ? 'إملاء صوتي' : 'Voice input'}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                <span className="hidden sm:inline text-xs text-slate-500 font-mono bg-slate-950 px-2 py-1 rounded-md border border-slate-800">
                  ⚡ gemini-3.8-flash
                </span>
              </div>

              <button
                type="submit"
                disabled={!promptText.trim() || isGenerating}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition shadow-lg cursor-pointer ${
                  promptText.trim() && !isGenerating
                    ? 'bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-white shadow-rose-500/30 hover:scale-[1.02]'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <span>{language === 'ar' ? 'إنشاء التطبيق الآن' : 'Generate App'}</span>
                {language === 'ar' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </form>
        </div>

        {/* Starter Templates Grid */}
        <div className="w-full space-y-4 pt-4">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold px-2">
            <span>
              {language === 'ar' ? 'أو اختر من أفكار وتطبيقات Lovable الجاهزة:' : 'Or start from popular Lovable templates:'}
            </span>
            <span className="text-rose-400">{STARTER_TEMPLATES.length} {language === 'ar' ? 'قوالب تفاعلية' : 'templates'}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {STARTER_TEMPLATES.map((tpl) => (
              <div
                key={tpl.id}
                onClick={() => handleSelectTemplate(tpl)}
                className="group bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-rose-500/40 rounded-2xl p-5 text-right transition cursor-pointer hover:shadow-xl hover:shadow-rose-950/10 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl p-2 rounded-xl bg-slate-800/80 group-hover:scale-110 transition">
                      {tpl.icon}
                    </span>
                    <div className="flex gap-1">
                      {tpl.tags.map((tag) => (
                        <span key={tag} className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md font-mono">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <h3 className="font-bold text-sm text-white group-hover:text-rose-300 transition">
                    {language === 'ar' ? tpl.titleAr : tpl.titleEn}
                  </h3>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    {language === 'ar' ? tpl.descAr : tpl.descEn}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-800/60 text-xs font-semibold text-rose-400 group-hover:text-rose-300">
                  <span>{language === 'ar' ? 'تشغيل وتعديل الفكرة' : 'Launch & Customize'}</span>
                  <Play className="w-3.5 h-3.5 fill-current" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-slate-900 text-center text-xs text-slate-500 font-['Cairo',sans-serif]">
        <p>منصة ابنيلي لتطوير التطبيقات بالذكاء الاصطناعي &bull; Ibni-li Web Studio</p>
      </footer>
    </div>
  );
};
