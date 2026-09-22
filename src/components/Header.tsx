import { useState, useEffect } from 'react';
import {
  Monitor,
  Tablet,
  Smartphone,
  Eye,
  Code2,
  Columns2,
  Download,
  Share2,
  Database,
  Plus,
  Globe,
  Sparkles,
  MousePointerClick,
  Crown,
  Shield
} from 'lucide-react';
import { DeviceMode, ViewMode, Language, UserSubscription, AppProject } from '../types';

interface HeaderProps {
  projectName: string;
  onRenameProject: (newName: string) => void;
  isGenerating: boolean;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  deviceMode: DeviceMode;
  onDeviceModeChange: (mode: DeviceMode) => void;
  isInspectMode: boolean;
  onToggleInspectMode: () => void;
  language: Language;
  onToggleLanguage: () => void;
  onNewProject: () => void;
  onOpenExport: () => void;
  onOpenDeploy: () => void;
  onOpenIntegrations: () => void;
  subscription?: UserSubscription;
  onOpenSubscription?: () => void;
  onOpenGeminiStudio?: () => void;
  onOpenAdmin?: () => void;
  projects?: AppProject[];
  activeProjectId?: string;
  onSelectProject?: (id: string) => void;
}

export const Header = ({
  projectName,
  onRenameProject,
  isGenerating,
  viewMode,
  onViewModeChange,
  deviceMode,
  onDeviceModeChange,
  isInspectMode,
  onToggleInspectMode,
  language,
  onToggleLanguage,
  onNewProject,
  onOpenExport,
  onOpenDeploy,
  onOpenIntegrations,
  subscription,
  onOpenSubscription,
  onOpenGeminiStudio,
  onOpenAdmin,
  projects = [],
  activeProjectId,
  onSelectProject,
}: HeaderProps) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(projectName);
  const [showProjectsMenu, setShowProjectsMenu] = useState(false);

  useEffect(() => {
    setNameInput(projectName);
  }, [projectName]);

  const handleNameSubmit = () => {
    setIsEditingName(false);
    if (nameInput.trim()) {
      onRenameProject(nameInput.trim());
    }
  };

  return (
    <header className="h-14 bg-slate-900 text-slate-100 border-b border-slate-800 px-4 flex items-center justify-between shrink-0 select-none z-20">
      {/* Left: Brand & Project Name */}
      <div className="flex items-center gap-3">
        <button
          onClick={onNewProject}
          title={language === 'ar' ? 'مشروع جديد' : 'New Project'}
          className="flex items-center gap-2 group hover:opacity-90 transition cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-rose-500 via-pink-500 to-amber-400 flex items-center justify-center shadow-md shadow-rose-500/20">
            <span className="text-white text-base font-bold">♥</span>
          </div>
          <div className="flex flex-col text-left">
            <span className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5 font-['Cairo',sans-serif]">
              إبنيلي <span className="text-[11px] text-slate-400 font-semibold hidden sm:inline">Ebnili</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-orange-500/20 text-orange-300 font-semibold border border-orange-500/30">AI</span>
            </span>
          </div>
        </button>

        <div className="h-4 w-px bg-slate-800" />

        {/* Project Name & Selector */}
        <div className="relative flex items-center gap-2">
          {isEditingName ? (
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
              autoFocus
              className="bg-slate-800 text-xs font-semibold px-2 py-1 rounded border border-slate-700 text-white outline-none focus:ring-1 focus:ring-rose-500 w-48"
            />
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsEditingName(true)}
                className="text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/80 px-2 py-1 rounded transition max-w-[170px] truncate"
                title={language === 'ar' ? 'انقر لتغيير اسم المشروع' : 'Click to rename'}
              >
                {projectName}
              </button>

              {projects.length > 1 && (
                <button
                  onClick={() => setShowProjectsMenu(!showProjectsMenu)}
                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
                  title={language === 'ar' ? 'تبديل المشروع' : 'Switch Project'}
                >
                  ▾
                </button>
              )}
            </div>
          )}

          {/* Projects Dropdown */}
          {showProjectsMenu && projects.length > 0 && (
            <div className="absolute top-full left-0 mt-1.5 w-60 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 p-1.5 space-y-1">
              <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase">
                {language === 'ar' ? 'مشاريعك المحفوظة' : 'Saved Projects'}
              </div>
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    if (onSelectProject) onSelectProject(p.id);
                    setShowProjectsMenu(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition ${
                    p.id === activeProjectId
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span className="truncate">{p.name}</span>
                  {p.id === activeProjectId && <span className="text-rose-400 text-xs">✓</span>}
                </button>
              ))}
              <div className="border-t border-slate-800 pt-1 mt-1">
                <button
                  onClick={() => {
                    onNewProject();
                    setShowProjectsMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-400 hover:bg-rose-500/10 flex items-center gap-1.5 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{language === 'ar' ? 'مشروع جديد' : 'New Project'}</span>
                </button>
              </div>
            </div>
          )}

          {isGenerating ? (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 animate-pulse">
              <Sparkles className="w-3 h-3 animate-spin" />
              <span>{language === 'ar' ? 'جاري البناء...' : 'Building...'}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>{language === 'ar' ? 'جاهز' : 'Ready'}</span>
            </span>
          )}
        </div>
      </div>

      {/* Center: View Modes & Device Controls */}
      <div className="hidden md:flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
        {/* Device Controls */}
        <div className="flex items-center bg-slate-900 rounded-lg p-0.5">
          <button
            onClick={() => onDeviceModeChange('desktop')}
            className={`p-1.5 rounded-md text-xs transition ${
              deviceMode === 'desktop' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Desktop (100%)"
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDeviceModeChange('tablet')}
            className={`p-1.5 rounded-md text-xs transition ${
              deviceMode === 'tablet' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Tablet (768px)"
          >
            <Tablet className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDeviceModeChange('mobile')}
            className={`p-1.5 rounded-md text-xs transition ${
              deviceMode === 'mobile' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Mobile (375px)"
          >
            <Smartphone className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="h-4 w-px bg-slate-800" />

        {/* View Layout Modes */}
        <div className="flex items-center bg-slate-900 rounded-lg p-0.5">
          <button
            onClick={() => onViewModeChange('preview')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition ${
              viewMode === 'preview' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'معاينة' : 'Preview'}</span>
          </button>

          <button
            onClick={() => onViewModeChange('split')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition ${
              viewMode === 'split' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'تقسيم' : 'Split'}</span>
          </button>

          <button
            onClick={() => onViewModeChange('code')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition ${
              viewMode === 'code' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'الكود' : 'Code'}</span>
          </button>
        </div>

        <div className="h-4 w-px bg-slate-800" />

        {/* Visual Edit / Select Element Tool (Lovable flagship feature) */}
        <button
          onClick={onToggleInspectMode}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
            isInspectMode
              ? 'bg-rose-500 text-white shadow-sm shadow-rose-500/30 ring-2 ring-rose-400/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-850'
          }`}
          title={language === 'ar' ? 'وضع التعديل البصري (انقر لتعديل أي عنصر)' : 'Visual Edit (Click element in preview)'}
        >
          <MousePointerClick className="w-3.5 h-3.5" />
          <span>{language === 'ar' ? 'تعديل بصري' : 'Visual Edit'}</span>
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Gemini 3.8 Flash AI Studio Button */}
        {onOpenGeminiStudio && (
          <button
            onClick={onOpenGeminiStudio}
            className="flex items-center gap-1.5 text-xs font-black text-white bg-gradient-to-r from-purple-600 via-rose-500 to-amber-500 hover:from-purple-500 hover:to-amber-400 px-3 py-1.5 rounded-lg shadow-sm shadow-purple-500/20 transition cursor-pointer border border-white/10"
            title={language === 'ar' ? 'فتح استوديو ومولد جيميناي 3.8 Flash المتطور' : 'Open Gemini 3.8 Flash AI Studio'}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin-slow" />
            <span className="hidden sm:inline font-['Cairo',sans-serif]">
              {language === 'ar' ? 'استوديو Gemini 3.8' : 'Gemini 3.8 Studio'}
            </span>
            <span className="sm:hidden font-mono font-bold">3.8</span>
          </button>
        )}

        {/* Subscription / Orange Cash Upgrade Button */}
        {onOpenSubscription && (
          subscription && subscription.tier !== 'free' ? (
            <button
              onClick={onOpenSubscription}
              className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1.5 rounded-lg border border-emerald-500/30 transition cursor-pointer"
              title={language === 'ar' ? 'عرض تفاصيل الاشتراك' : 'View Subscription'}
            >
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span className="uppercase">{subscription.tier}</span>
              <span className="hidden md:inline text-[10px] text-emerald-400">✓</span>
            </button>
          ) : (
            <button
              onClick={onOpenSubscription}
              className="flex items-center gap-1.5 text-xs font-black text-slate-950 bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500 hover:from-orange-300 hover:to-amber-300 px-3 py-1.5 rounded-lg shadow-sm shadow-orange-500/30 transition cursor-pointer"
              title={language === 'ar' ? 'الترقية عبر محفظة Orange Cash (01207782741)' : 'Upgrade with Orange Cash (01207782741)'}
            >
              <Crown className="w-3.5 h-3.5 text-slate-950" />
              <span>{language === 'ar' ? 'ترقية الباقة' : 'Upgrade'}</span>
              <span className="hidden lg:inline text-[10px] bg-slate-950/20 text-slate-950 px-1 rounded font-bold">Orange Cash</span>
            </button>
          )
        )}

        {/* Owner Admin Button */}
        {onOpenAdmin && (
          <button
            onClick={onOpenAdmin}
            className="flex items-center gap-1.5 text-xs text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1.5 rounded-lg border border-rose-500/30 transition cursor-pointer"
            title={language === 'ar' ? 'لوحة تحكم صاحب الموقع (إحصائيات حقيقية وحماية الأجهزة)' : 'Owner Admin Dashboard'}
          >
            <Shield className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden md:inline font-bold">{language === 'ar' ? 'لوحة المالك' : 'Admin'}</span>
          </button>
        )}

        {/* Integrations (Supabase / DB / Auth) */}
        <button
          onClick={onOpenIntegrations}
          className="hidden sm:flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-700/60 transition"
          title={language === 'ar' ? 'قواعد البيانات والتكاملات' : 'Integrations & Supabase'}
        >
          <Database className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden lg:inline">{language === 'ar' ? 'قاعدة البيانات' : 'Backend'}</span>
        </button>

        {/* Export ZIP */}
        <button
          onClick={onOpenExport}
          className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-700/60 transition cursor-pointer"
          title={language === 'ar' ? 'تصدير الكود والمشروع' : 'Export project files'}
        >
          <Download className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">{language === 'ar' ? 'تصدير ZIP' : 'Export'}</span>
        </button>

        {/* Deploy & Share */}
        <button
          onClick={onOpenDeploy}
          className="flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 px-3 py-1.5 rounded-lg shadow-sm shadow-rose-600/30 transition cursor-pointer"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>{language === 'ar' ? 'نشر ومشاركة' : 'Publish'}</span>
        </button>

        {/* Language switch */}
        <button
          onClick={onToggleLanguage}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          title={language === 'ar' ? 'Switch to English' : 'التحويل للعربية'}
        >
          <Globe className="w-4 h-4" />
        </button>

        {/* New Project Quick Button */}
        <button
          onClick={onNewProject}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          title={language === 'ar' ? 'بدء مشروع جديد' : 'New Project'}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
