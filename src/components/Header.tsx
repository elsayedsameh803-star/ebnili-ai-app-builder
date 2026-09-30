import { useState, useEffect, useRef } from 'react';
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
  ExternalLink,
  Info,
  Phone,
  Scale,
  FolderTree,
  Pencil,
  Trash2,
  Plus,
  Globe,
  Sparkles,
  MousePointerClick,
  Crown,
  Shield,
  ShieldCheck,
  LogIn,
  LogOut,
  User as UserIcon
} from 'lucide-react';
import { DeviceMode, ViewMode, Language, UserSubscription, AppProject, AuthUser } from '../types';
import { isOwnerAccount } from '../lib/auth';
import type { ProjectSummary } from '../lib/projects';

/** "منذ 5 دقائق" / "2 hours ago" — the project list is a recency list. */
function formatRelative(iso: string, language: Language): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) return language === 'ar' ? 'الآن' : 'now';
  if (minutes < 60) return language === 'ar' ? `منذ ${minutes} د` : `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return language === 'ar' ? `منذ ${hours} س` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return language === 'ar' ? `منذ ${days} يوم` : `${days}d ago`;
  return new Date(iso).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-GB');
}

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
  authUser?: AuthUser | null;
  onOpenAuth?: () => void;
  onLogout?: () => void;
  /** Opens one of the site pages (about / contact / privacy / terms). */
  onOpenInfoPage?: (page: 'about' | 'contact' | 'privacy' | 'terms') => void;
  /** Opens the current site in a new browser tab (real preview, not the iframe). */
  onOpenInNewTab?: () => void;
  projects?: ProjectSummary[];
  activeProjectId?: string;
  onSelectProject?: (id: string) => void;
  /** Deletes a stored project (only for non-active ones in the list UI). */
  onDeleteProject?: (id: string) => void;
  /** Renames a stored project from the list. */
  onRenameStoredProject?: (id: string, name: string) => void;
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
  authUser = null,
  onOpenAuth,
  onLogout,
  onOpenInfoPage,
  onOpenInNewTab,
  projects = [],
  activeProjectId,
  onSelectProject,
  onDeleteProject,
  onRenameStoredProject,
}: HeaderProps) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(projectName);
  const [showProjectsMenu, setShowProjectsMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const projectsMenuRef = useRef<HTMLDivElement | null>(null);

  // Owner-only controls (admin dashboard, backend/database console) stay hidden
  // from ordinary users. `authUser.isOwner` is stamped by the server on
  // `/api/auth/me`, so the browser cannot talk its way into these buttons —
  // and server-side `requireAdmin` remains the real boundary.
  const isOwner = isOwnerAccount(authUser);

  // Close both menus on any outside click. The menu panels are rendered as
  // direct children of <header> (outside the scrolling bar), so the check has
  // to cover the trigger buttons AND the panels themselves — otherwise the
  // very first click on an item would register as "outside" and close the menu
  // before the click landed.
  useEffect(() => {
    if (!showUserMenu && !showProjectsMenu) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setShowUserMenu(false);
      }
      if (projectsMenuRef.current && !projectsMenuRef.current.contains(target)) {
        setShowProjectsMenu(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowUserMenu(false);
        setShowProjectsMenu(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [showUserMenu, showProjectsMenu]);

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
    // MOBILE: the bar used to overflow sideways (the actions alone needed ~460px
    // on a 375px phone), so half the controls were cut off / unreachable and the
    // layout felt broken. It is now horizontally scrollable as a safety net, and
    // the labels that do not fit are dropped below `sm` (see each button).
    // The bar scrolls sideways on narrow screens, but the two dropdowns are
    // rendered OUTSIDE that scroller (at the end of this file). Putting them
    // inside made `overflow-x-auto` on the ancestor compute `overflow-y: auto`
    // too, which clipped every menu to the 56px bar height — the owner tools
    // looked unopenable. Never put an absolutely-positioned menu inside a
    // scroll container.
    <header className="relative h-14 bg-slate-900 text-slate-100 border-b border-slate-800 shrink-0 select-none z-30">
      <div className="h-full flex items-center justify-between gap-2 px-2 sm:px-4 overflow-x-auto">
      {/* Left: Brand & Project Name */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">
        <button
          onClick={onNewProject}
          title={language === 'ar' ? 'مشروع جديد' : 'New Project'}
          className="flex items-center gap-2 group hover:opacity-90 transition cursor-pointer shrink-0"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-rose-500 via-pink-500 to-amber-400 flex items-center justify-center shadow-md shadow-rose-500/20">
            <span className="text-white text-base font-bold">♥</span>
          </div>
          <div className="hidden sm:flex flex-col text-left">
            <span className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5 font-['Cairo',sans-serif]">
              إبنيلي <span className="text-[11px] text-slate-400 font-semibold hidden md:inline">Ebnili</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-orange-500/20 text-orange-300 font-semibold border border-orange-500/30">AI</span>
            </span>
          </div>
        </button>

        <div className="h-4 w-px bg-slate-800 shrink-0" />

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
                className="text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/80 px-2 py-1 rounded transition max-w-[72px] sm:max-w-[170px] truncate"
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

          {/* Projects Dropdown — see the end of <header>, outside the scroller. */}

          {isGenerating ? (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 animate-pulse shrink-0">
              <Sparkles className="w-3 h-3 animate-spin" />
              <span>{language === 'ar' ? 'جاري البناء...' : 'Building...'}</span>
            </span>
          ) : (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>{language === 'ar' ? 'جاهز' : 'Ready'}</span>
            </span>
          )}
        </div>
      </div>

      {/* Center: View Modes & Device Controls */}
      <div className="hidden md:flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
        {/* Device Controls.
            The three buttons are icon-only, so each needs an accessible name —
            a `title` alone is not announced reliably by screen readers. */}
        <div className="flex items-center bg-slate-900 rounded-lg p-0.5" role="group" aria-label={language === 'ar' ? 'حجم الشاشة' : 'Preview size'}>
          <button
            onClick={() => onDeviceModeChange('desktop')}
            aria-label={language === 'ar' ? 'معاينة سطح المكتب' : 'Desktop preview'}
            aria-pressed={deviceMode === 'desktop'}
            className={`p-1.5 rounded-md text-xs transition ${
              deviceMode === 'desktop' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Desktop (100%)"
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDeviceModeChange('tablet')}
            aria-label={language === 'ar' ? 'معاينة التابلت' : 'Tablet preview'}
            aria-pressed={deviceMode === 'tablet'}
            className={`p-1.5 rounded-md text-xs transition ${
              deviceMode === 'tablet' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Tablet (768px)"
          >
            <Tablet className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDeviceModeChange('mobile')}
            aria-label={language === 'ar' ? 'معاينة الهاتف' : 'Mobile preview'}
            aria-pressed={deviceMode === 'mobile'}
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
        <div className="flex items-center bg-slate-900 rounded-lg p-0.5" role="group" aria-label={language === 'ar' ? 'طريقة العرض' : 'View mode'}>
          <button
            onClick={() => onViewModeChange('preview')}
            aria-pressed={viewMode === 'preview'}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition ${
              viewMode === 'preview' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'معاينة' : 'Preview'}</span>
          </button>

          <button
            onClick={() => onViewModeChange('split')}
            aria-pressed={viewMode === 'split'}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition ${
              viewMode === 'split' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'تقسيم' : 'Split'}</span>
          </button>

          <button
            onClick={() => onViewModeChange('code')}
            aria-pressed={viewMode === 'code'}
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
      <div className="flex items-center gap-2 shrink-0">
        {/* Gemini 3.8 Flash AI Studio Button — icon-only on phones (the full
            studio is still one tap away from the chat sidebar). */}
        {onOpenGeminiStudio && (
          <button
            onClick={onOpenGeminiStudio}
            className="flex items-center gap-1.5 text-xs font-black text-white bg-gradient-to-r from-purple-600 via-rose-500 to-amber-500 hover:from-purple-500 hover:to-amber-400 px-2.5 sm:px-3 py-1.5 rounded-lg shadow-sm shadow-purple-500/20 transition cursor-pointer border border-white/10 shrink-0"
            title={language === 'ar' ? 'فتح استوديو الذكاء الاصطناعي المتطور' : 'Open Ebnili AI Studio'}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin-slow" />
            <span className="hidden sm:inline font-['Cairo',sans-serif]">
              {language === 'ar' ? 'استوديو إبنيلي' : 'Ebnili Studio'}
            </span>
            <span className="sm:hidden font-mono font-bold">AI</span>
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
              <span className="sm:hidden">{language === 'ar' ? 'ترقية' : 'Upgrade'}</span>
              <span className="hidden sm:inline">{language === 'ar' ? 'ترقية الباقة' : 'Upgrade'}</span>
              <span className="hidden lg:inline text-[10px] bg-slate-950/20 text-slate-950 px-1 rounded font-bold">Orange Cash</span>
            </button>
          )
        )}

        {/* User account: sign-in button (guest) or avatar menu (signed in) */}
        {authUser ? (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu((v) => !v)}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition cursor-pointer"
              title={authUser.name}
            >
              {authUser.picture ? (
                <img
                  src={authUser.picture}
                  alt={authUser.name}
                  referrerPolicy="no-referrer"
                  className="w-6 h-6 rounded-full object-cover ring-1 ring-rose-500/40"
                />
              ) : (
                <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-rose-500 to-amber-400 flex items-center justify-center">
                  <UserIcon className="w-3.5 h-3.5 text-white" />
                </span>
              )}
              <span className="hidden lg:inline text-[11px] font-bold text-slate-200 max-w-[110px] truncate">
                {authUser.name}
              </span>
            </button>

            {/* Account dropdown — see the end of <header>, outside the scroller. */}
          </div>
        ) : (
          onOpenAuth && (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-700/60 transition cursor-pointer"
              title={language === 'ar' ? 'تسجيل الدخول بجوجل أو جيت هاب' : 'Sign in with Google or GitHub'}
            >
              <LogIn className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden md:inline font-bold">
                {language === 'ar' ? 'تسجيل الدخول' : 'Sign in'}
              </span>
            </button>
          )
        )}

      {/* Owner tools are NOT in the top bar — see the account dropdown below.
          A shared header must never carry owner surfaces in front of ordinary
          users, and on a phone the bar has no room to spare anyway. */}

        {/* Open the generated site in a real browser tab — the fastest way to
            check the result on a phone or share a clean link. */}
        {onOpenInNewTab && (
          <button
            onClick={onOpenInNewTab}
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-700/60 transition cursor-pointer shrink-0"
            title={language === 'ar' ? 'فتح الموقع في تبويب جديد' : 'Open site in a new tab'}
          >
            <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden lg:inline">{language === 'ar' ? 'فتح الموقع' : 'Open'}</span>
          </button>
        )}

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
          <span className="sm:hidden">{language === 'ar' ? 'نشر' : 'Publish'}</span>
          <span className="hidden sm:inline">{language === 'ar' ? 'نشر ومشاركة' : 'Publish'}</span>
        </button>

        {/* Language switch */}
        <button
          onClick={onToggleLanguage}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition shrink-0"
          title={language === 'ar' ? 'Switch to English' : 'التحويل للعربية'}
        >
          <Globe className="w-4 h-4" />
        </button>

        {/* New Project Quick Button — the brand button already starts a new
            project, so this duplicate is dropped on the narrowest screens. */}
        <button
          onClick={onNewProject}
          className="hidden sm:inline-flex p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition shrink-0"
          title={language === 'ar' ? 'بدء مشروع جديد' : 'New Project'}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      </div>{/* /scroller */}

      {/* ── Dropdowns: OUTSIDE the horizontally scrolling bar ────────────────
          A scroll container clips absolutely-positioned children, so these
          live as direct children of <header> (which is `relative`). */}
      {showProjectsMenu && (
        <div
          ref={projectsMenuRef}
          className="absolute top-full left-2 sm:left-4 mt-1.5 w-72 max-w-[calc(100vw-1rem)] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-[60] p-1.5"
        >
          <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase flex items-center justify-between">
            <span>{language === 'ar' ? 'مشاريعي' : 'My projects'}</span>
            <span className="text-slate-600 normal-case font-medium">
              {language === 'ar' ? 'محفوظة على هذا الجهاز' : 'saved on this device'}
            </span>
          </div>

          {projects.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <div className="w-10 h-10 mx-auto rounded-xl bg-slate-800 flex items-center justify-center mb-2">
                <FolderTree className="w-5 h-5 text-slate-500" />
              </div>
              <p className="text-[11px] text-slate-400 leading-5">
                {language === 'ar'
                  ? 'لسه مفيش مشاريع محفوظة. أول ما تولّد موقع هيتحفظ هنا تلقائياً.'
                  : 'No saved projects yet. Your first generated site is saved here automatically.'}
              </p>
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto space-y-0.5 pe-0.5">
              {projects.map((p) => {
                const isActive = p.id === activeProjectId;
                return (
                  <div
                    key={p.id}
                    className={`group flex items-center gap-1 rounded-lg px-1.5 py-1 transition ${
                      isActive ? 'bg-rose-500/15 border border-rose-500/30' : 'hover:bg-slate-800'
                    }`}
                  >
                    <button
                      onClick={() => {
                        if (onSelectProject) onSelectProject(p.id);
                        setShowProjectsMenu(false);
                      }}
                      className="flex-1 text-right px-1 py-1 min-w-0"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-bold truncate ${isActive ? 'text-rose-300' : 'text-slate-200'}`}>
                          {p.name}
                        </span>
                        {isActive && <span className="text-rose-400 text-[10px] shrink-0">مفتوح</span>}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {language === 'ar'
                          ? `${p.versionCount ?? 0} إصدارات · ${formatRelative(p.updatedAt, language)}`
                          : `${p.versionCount ?? 0} versions · ${formatRelative(p.updatedAt, language)}`}
                      </div>
                    </button>

                    {onRenameStoredProject && (
                      <button
                        onClick={() => {
                          const next = window.prompt(
                            language === 'ar' ? 'اسم المشروع الجديد' : 'New project name',
                            p.name,
                          );
                          if (next && next.trim()) onRenameStoredProject(p.id, next.trim());
                        }}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition shrink-0"
                        title={language === 'ar' ? 'إعادة تسمية' : 'Rename'}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {onDeleteProject && (
                      <button
                        onClick={() => {
                          const ok = window.confirm(
                            language === 'ar'
                              ? `حذف المشروع "${p.name}" نهائياً؟ لا يمكن التراجع.`
                              : `Permanently delete "${p.name}"? This cannot be undone.`,
                          );
                          if (ok) onDeleteProject(p.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded-md text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition shrink-0"
                        title={language === 'ar' ? 'حذف' : 'Delete'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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

      {showUserMenu && (
        <div
          ref={userMenuRef}
          className="absolute top-full right-2 sm:right-4 mt-1.5 w-64 max-w-[calc(100vw-1rem)] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-[60] p-1.5"
        >
          <div className="px-2.5 py-2 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              {authUser?.picture ? (
                <img
                  src={authUser.picture}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-full object-cover"
                />
              ) : (
                <span className="w-9 h-9 rounded-full bg-gradient-to-tr from-rose-500 to-amber-400 flex items-center justify-center">
                  <UserIcon className="w-4 h-4 text-white" />
                </span>
              )}
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">{authUser?.name}</div>
                {authUser?.email && (
                  <div className="text-[10px] text-slate-400 truncate" dir="ltr">
                    {authUser.email}
                  </div>
                )}
              </div>
            </div>
            {authUser?.provider && (
              <div className="mt-2 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                {authUser.provider === 'google' ? 'Google' : 'GitHub'}
              </div>
            )}
          </div>

          {onOpenInfoPage && (
            <div className="mt-1 pt-1 border-t border-slate-800">
              <div className="px-2.5 py-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                {language === 'ar' ? 'المنصة' : 'The platform'}
              </div>
              <div className="grid grid-cols-2 gap-1 p-0.5">
                {(
                  [
                    { key: 'about', ar: 'من نحن', en: 'About', icon: Info },
                    { key: 'contact', ar: 'اتصل بنا', en: 'Contact', icon: Phone },
                    { key: 'privacy', ar: 'الخصوصية', en: 'Privacy', icon: ShieldCheck },
                    { key: 'terms', ar: 'الشروط', en: 'Terms', icon: Scale },
                  ] as const
                ).map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenInfoPage(item.key);
                      }}
                      className="flex items-center gap-1.5 px-2 py-2 rounded-lg text-[11px] font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition text-right"
                    >
                      <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{language === 'ar' ? item.ar : item.en}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Owner-only tools ────────────────────────────────────────────
              Owner surfaces live HERE, inside the account dropdown, and only
              for the site owner. `isOwner` is the server-issued flag — see
              `isOwnerAccount`. */}
          {isOwner && (onOpenAdmin || onOpenIntegrations) && (
            <div className="mt-1 pt-1 border-t border-slate-800">
              <div className="px-2.5 py-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                {language === 'ar' ? 'أدوات المالك فقط' : 'Owner tools only'}
              </div>

              {onOpenAdmin && (
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onOpenAdmin();
                  }}
                  className="w-full text-right px-2.5 py-2 rounded-lg text-xs font-bold text-rose-300 hover:bg-rose-500/10 flex items-center gap-2 transition"
                  title={language === 'ar' ? 'لوحة تحكم صاحب الموقع (إحصائيات وحماية الأجهزة)' : 'Owner admin dashboard'}
                >
                  <Shield className="w-3.5 h-3.5 text-rose-400" />
                  <span>{language === 'ar' ? 'لوحة المالك' : 'Owner admin panel'}</span>
                </button>
              )}

              {onOpenIntegrations && (
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onOpenIntegrations();
                  }}
                  className="w-full text-right px-2.5 py-2 rounded-lg text-xs font-bold text-slate-200 hover:bg-slate-800 flex items-center gap-2 transition"
                  title={language === 'ar' ? 'قواعد البيانات والتكاملات' : 'Database & integrations'}
                >
                  <Database className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{language === 'ar' ? 'قاعدة البيانات والتكاملات' : 'Database & integrations'}</span>
                </button>
              )}
            </div>
          )}

          <button
            onClick={() => {
              setShowUserMenu(false);
              onLogout?.();
            }}
            className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-bold text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 transition mt-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'تسجيل الخروج' : 'Sign out'}</span>
          </button>
        </div>
      )}
    </header>
  );
};
