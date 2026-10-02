/**
 * Studio sidebar — the single home for every workspace control.
 *
 * WHY THIS REPLACED THE TOP BAR
 * ----------------------------
 * The header was a single 56px row holding thirteen controls. Below ~1100px they
 * no longer fitted, so the row was made horizontally scrollable and labels were
 * progressively hidden behind `hidden lg:inline`, `hidden sm:inline`, `hidden
 * md:inline`… What survived was a strip of unlabelled icons, and because the bar
 * is a scroll container its height could not grow — so a long project name
 * overlapped the device buttons next to it. That overlap is what this removes.
 *
 * A vertical rail gives every control its own row: a label never competes with
 * an icon, and a long project name truncates inside its own box instead of
 * running across the toolbar. No control is hidden behind a breakpoint.
 *
 * LAYOUT RULES THAT MUST NOT BE BROKEN
 * ------------------------------------
 *  • Never put an absolutely-positioned panel inside an `overflow` container —
 *    it gets clipped. The panels are siblings rendered after the scroll area,
 *    inside the sidebar's own `relative` box.
 *  • `min-w-0` on every flex child holding text, otherwise `truncate` has no
 *    effect and the text escapes its box. This is the real cause of most
 *    "text overlapping icons" reports in flex toolbars.
 */
import { useState, useEffect, useRef, type ReactNode } from 'react';
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
  User as UserIcon,
  Phone,
} from 'lucide-react';
import { DeviceMode, ViewMode, Language, UserSubscription, AuthUser } from '../types';
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

export interface StudioSidebarProps {
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
  onOpenInfoPage?: (page: 'about' | 'contact' | 'privacy' | 'terms') => void;
  onOpenInNewTab?: () => void;
  projects?: ProjectSummary[];
  activeProjectId?: string;
  onSelectProject?: (id: string) => void;
  onDeleteProject?: (id: string) => void;
  onRenameStoredProject?: (id: string, name: string) => void;
}

/** One full-width row. The icon and the label can never fight for pixels. */
const Row = ({
  icon: Icon,
  label,
  hint,
  onClick,
  active,
  iconClass = 'text-slate-400',
  disabled,
  title,
}: {
  icon: typeof Eye;
  label: string;
  hint?: string;
  onClick: () => void;
  active?: boolean;
  iconClass?: string;
  disabled?: boolean;
  title?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title ?? label}
    aria-pressed={active}
    className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-semibold transition cursor-pointer text-start disabled:opacity-40 disabled:cursor-not-allowed ${
      active ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
    }`}
  >
    <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : iconClass}`} aria-hidden="true" />
    {/* min-w-0 is what makes truncation work inside a flex row. */}
    <span className="flex-1 min-w-0 truncate">{label}</span>
    {hint ? <span className="text-[10px] text-slate-500 shrink-0 font-mono">{hint}</span> : null}
  </button>
);

/** A section heading inside the rail. */
const SectionLabel = ({ children }: { children: ReactNode }) => (
  <div className="px-2.5 pt-4 pb-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-500 select-none">
    {children}
  </div>
);

export const StudioSidebar = ({
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
}: StudioSidebarProps) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(projectName);
  const [showProjectsMenu, setShowProjectsMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const projectsMenuRef = useRef<HTMLDivElement | null>(null);

  // Owner-only controls stay hidden from ordinary users. `authUser.isOwner` is
  // stamped by the server on `/api/auth/me`, so the browser cannot talk its way
  // into these buttons — and server-side `requireAdmin` remains the real boundary.
  const isOwner = isOwnerAccount(authUser);

  const ar = language === 'ar';

  useEffect(() => {
    setNameInput(projectName);
  }, [projectName]);

  // Close both panels on any outside click. The panels are siblings AFTER the
  // scroll area, so the check covers the triggers AND the panels themselves —
  // otherwise the first click on an item would register as "outside" and close
  // the panel before the click landed.
  useEffect(() => {
    if (!showUserMenu && !showProjectsMenu) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (userMenuRef.current && !userMenuRef.current.contains(target)) setShowUserMenu(false);
      if (projectsMenuRef.current && !projectsMenuRef.current.contains(target))
        setShowProjectsMenu(false);
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

  const handleNameSubmit = () => {
    setIsEditingName(false);
    if (nameInput.trim()) onRenameProject(nameInput.trim());
  };

  return (
    // `relative` anchors the two panels. The rail itself must NOT be the scroll
    // container — overflow lives on an inner box, otherwise the panels clip.
    <aside className="relative shrink-0 w-64 bg-slate-900 text-slate-100 border-e border-slate-800 flex flex-col z-30">
      {/* ── Brand + project name ───────────────────────────────────────── */}
      <div className="shrink-0 border-b border-slate-800 p-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-tr from-rose-500 via-pink-500 to-amber-400 flex items-center justify-center shadow-md shadow-rose-500/20">
            <span className="text-white text-base font-bold">♥</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-extrabold text-sm tracking-tight text-white font-['Cairo',sans-serif] truncate">
                إبنيلي
              </span>
              <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 font-semibold border border-orange-500/30">
                AI
              </span>
            </div>
            <span className="block text-[10px] text-slate-400 truncate">Ebnili App Builder</span>
          </div>
        </div>

        {/* The project name lives in its own box with `min-w-0`, so a long name
            truncates here instead of running across the toolbar. */}
        <div className="mt-3">
          {isEditingName ? (
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
              autoFocus
              aria-label={ar ? 'اسم المشروع' : 'Project name'}
              className="w-full bg-slate-800 text-xs font-semibold px-2.5 py-2 rounded-lg border border-slate-700 text-white outline-none focus:ring-1 focus:ring-rose-500"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingName(true)}
              title={ar ? 'انقر لتغيير اسم المشروع' : 'Click to rename'}
              className="w-full text-start px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 transition cursor-pointer min-w-0"
            >
              <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500">
                {ar ? 'المشروع' : 'Project'}
              </span>
              <span className="block text-xs font-bold text-slate-200 truncate">
                {projectName || (ar ? 'مشروع بدون اسم' : 'Untitled project')}
              </span>
            </button>
          )}

          <div className="mt-2 flex items-center gap-2 min-w-0">
            {isGenerating ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-1 rounded-full border border-amber-500/20 animate-pulse min-w-0">
                <Sparkles className="w-3 h-3 animate-spin shrink-0" aria-hidden="true" />
                <span className="truncate">{ar ? 'جارٍ البناء…' : 'Building…'}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="truncate">{ar ? 'جاهز' : 'Ready'}</span>
              </span>
            )}

            {projects.length > 1 && (
              <button
                type="button"
                onClick={() => setShowProjectsMenu((v) => !v)}
                className="shrink-0 text-[10px] font-bold text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-800 transition cursor-pointer"
                title={ar ? 'تبديل المشروع' : 'Switch project'}
              >
                ▾
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── The rail ───────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2 space-y-0.5">
        <Row icon={Plus} label={ar ? 'مشروع جديد' : 'New project'} onClick={onNewProject} iconClass="text-rose-400" />

        <SectionLabel>{ar ? 'طريقة العرض' : 'View'}</SectionLabel>
        <Row icon={Eye} label={ar ? 'معاينة' : 'Preview'} onClick={() => onViewModeChange('preview')} active={viewMode === 'preview'} />
        <Row icon={Columns2} label={ar ? 'مقسّم' : 'Split'} onClick={() => onViewModeChange('split')} active={viewMode === 'split'} />
        <Row icon={Code2} label={ar ? 'الكود' : 'Code'} onClick={() => onViewModeChange('code')} active={viewMode === 'code'} />

        <SectionLabel>{ar ? 'مقاس الشاشة' : 'Screen size'}</SectionLabel>
        <Row icon={Monitor} label={ar ? 'سطح المكتب' : 'Desktop'} hint="100%" onClick={() => onDeviceModeChange('desktop')} active={deviceMode === 'desktop'} />
        <Row icon={Tablet} label={ar ? 'تابلت' : 'Tablet'} hint="768px" onClick={() => onDeviceModeChange('tablet')} active={deviceMode === 'tablet'} />
        <Row icon={Smartphone} label={ar ? 'هاتف' : 'Mobile'} hint="375px" onClick={() => onDeviceModeChange('mobile')} active={deviceMode === 'mobile'} />

        <SectionLabel>{ar ? 'التعديل' : 'Edit'}</SectionLabel>
        <Row
          icon={MousePointerClick}
          label={ar ? 'تعديل بصري' : 'Visual edit'}
          onClick={onToggleInspectMode}
          active={isInspectMode}
          iconClass="text-rose-400"
          title={ar ? 'انقر أي عنصر في المعاينة لتعديله' : 'Click any element in the preview to edit it'}
        />

        <SectionLabel>{ar ? 'الإجراءات' : 'Actions'}</SectionLabel>
        <Row icon={Share2} label={ar ? 'نشر ومشاركة' : 'Publish'} onClick={onOpenDeploy} iconClass="text-rose-400" />
        <Row icon={Download} label={ar ? 'تصدير ZIP' : 'Export ZIP'} onClick={onOpenExport} iconClass="text-emerald-400" />
        {onOpenInNewTab && (
          <Row icon={ExternalLink} label={ar ? 'فتح في تبويب' : 'Open in tab'} onClick={onOpenInNewTab} iconClass="text-cyan-400" />
        )}
        {onOpenGeminiStudio && (
          <Row icon={Sparkles} label={ar ? 'استوديو إبنيلي' : 'Ebnili Studio'} onClick={onOpenGeminiStudio} iconClass="text-amber-400" />
        )}
        {onOpenSubscription && (
          <Row
            icon={Crown}
            label={subscription && subscription.tier !== 'free' ? `${subscription.tier.toUpperCase()} ✓` : ar ? 'ترقية الباقة' : 'Upgrade plan'}
            onClick={onOpenSubscription}
            iconClass="text-orange-400"
          />
        )}
      </div>

      {/* ── Account block, pinned to the bottom ────────────────────────── */}
      <div className="shrink-0 border-t border-slate-800 p-2 space-y-1">
        {authUser ? (
          <button
            type="button"
            onClick={() => setShowUserMenu((v) => !v)}
            className="w-full flex items-center gap-2.5 p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition cursor-pointer min-w-0"
            title={authUser.name}
          >
            {authUser.picture ? (
              <img src={authUser.picture} alt="" referrerPolicy="no-referrer" className="w-7 h-7 shrink-0 rounded-full object-cover ring-1 ring-rose-500/40" />
            ) : (
              <span className="w-7 h-7 shrink-0 rounded-full bg-gradient-to-tr from-rose-500 to-amber-400 flex items-center justify-center">
                <UserIcon className="w-3.5 h-3.5 text-white" />
              </span>
            )}
            <span className="min-w-0 flex-1 text-start">
              <span className="block text-[11px] font-bold text-slate-200 truncate">{authUser.name}</span>
              {authUser.email && (
                <span className="block text-[9px] text-slate-500 truncate" dir="ltr">
                  {authUser.email}
                </span>
              )}
            </span>
          </button>
        ) : (
          onOpenAuth && (
            <Row icon={LogIn} label={ar ? 'تسجيل الدخول' : 'Sign in'} onClick={onOpenAuth} iconClass="text-indigo-400" />
          )
        )}

        <Row icon={Globe} label={ar ? 'English' : 'العربية'} onClick={onToggleLanguage} />
      </div>

      {/* ── Panels — siblings of the scroll area, inside the `relative` rail ── */}
      {showProjectsMenu && (
        <div
          ref={projectsMenuRef}
          className="absolute bottom-full left-2 right-2 mb-1 max-h-80 overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-[60] p-1.5"
        >
          <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase flex items-center justify-between gap-2">
            <span className="truncate">{ar ? 'مشاريعي' : 'My projects'}</span>
            <span className="text-slate-600 normal-case font-medium truncate shrink-0">
              {ar ? 'محفوظة على هذا الجهاز' : 'saved on this device'}
            </span>
          </div>

          {projects.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <div className="w-10 h-10 mx-auto rounded-xl bg-slate-800 flex items-center justify-center mb-2">
                <FolderTree className="w-5 h-5 text-slate-500" />
              </div>
              <p className="text-[11px] text-slate-400 leading-5">
                {ar
                  ? 'لسه مفيش مشاريع محفوظة. أول ما تولّد موقع هيتحفظ هنا تلقائياً.'
                  : 'No saved projects yet. Your first generated site is saved here automatically.'}
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {projects.map((p) => {
                const isActive = p.id === activeProjectId;
                return (
                  <div
                    key={p.id}
                    className={`group flex items-center gap-1 rounded-lg px-1.5 py-1 transition min-w-0 ${
                      isActive ? 'bg-rose-500/15 border border-rose-500/30' : 'hover:bg-slate-800'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectProject) onSelectProject(p.id);
                        setShowProjectsMenu(false);
                      }}
                      className="flex-1 text-start px-1 py-1 min-w-0"
                    >
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className={`text-xs font-bold truncate min-w-0 ${isActive ? 'text-rose-300' : 'text-slate-200'}`}>
                          {p.name}
                        </span>
                        {isActive && <span className="text-rose-400 text-[10px] shrink-0">{ar ? 'مفتوح' : 'open'}</span>}
                      </span>
                      <span className="block text-[10px] text-slate-500 truncate">
                        {p.versionCount ?? 0} {ar ? 'إصدارات' : 'versions'} · {formatRelative(p.updatedAt, language)}
                      </span>
                    </button>

                    {onRenameStoredProject && (
                      <button
                        type="button"
                        onClick={() => {
                          const next = window.prompt(ar ? 'اسم المشروع الجديد' : 'New project name', p.name);
                          if (next && next.trim()) onRenameStoredProject(p.id, next.trim());
                        }}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition shrink-0"
                        title={ar ? 'إعادة تسمية' : 'Rename'}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {onDeleteProject && (
                      <button
                        type="button"
                        onClick={() => {
                          const ok = window.confirm(
                            ar
                              ? `حذف المشروع "${p.name}" نهائياً؟ لا يمكن التراجع.`
                              : `Permanently delete "${p.name}"? This cannot be undone.`,
                          );
                          if (ok) onDeleteProject(p.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded-md text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition shrink-0"
                        title={ar ? 'حذف' : 'Delete'}
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
              type="button"
              onClick={() => {
                onNewProject();
                setShowProjectsMenu(false);
              }}
              className="w-full text-start px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-400 hover:bg-rose-500/10 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{ar ? 'مشروع جديد' : 'New project'}</span>
            </button>
          </div>
        </div>
      )}

      {showUserMenu && (
        <div
          ref={userMenuRef}
          className="absolute bottom-full left-2 right-2 mb-1 max-h-[70vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-[60] p-1.5"
        >
          <div className="px-2.5 py-2 border-b border-slate-800">
            <div className="flex items-center gap-2.5 min-w-0">
              {authUser?.picture ? (
                <img src={authUser.picture} alt="" referrerPolicy="no-referrer" className="w-9 h-9 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="w-9 h-9 shrink-0 rounded-full bg-gradient-to-tr from-rose-500 to-amber-400 flex items-center justify-center">
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
                {ar ? 'عن المنصة' : 'About Ebnili'}
              </div>
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
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      onOpenInfoPage(item.key);
                    }}
                    className="flex items-center gap-2 px-2 py-2 rounded-lg text-[11px] font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition text-start w-full cursor-pointer min-w-0"
                  >
                    <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{ar ? item.ar : item.en}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Owner-only tools ──────────────────────────────────────────
              Owner surfaces live HERE, inside the account panel, and only for
              the site owner. `isOwner` is the server-issued flag — see
              `isOwnerAccount`; server-side `requireAdmin` is the real boundary. */}
          {isOwner && (onOpenAdmin || onOpenIntegrations) && (
            <div className="mt-1 pt-1 border-t border-slate-800">
              <div className="px-2.5 py-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                {ar ? 'أدوات المالك فقط' : 'Owner tools only'}
              </div>

              {onOpenAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    onOpenAdmin();
                  }}
                  className="w-full text-start px-2.5 py-2 rounded-lg text-xs font-bold text-rose-300 hover:bg-rose-500/10 flex items-center gap-2 transition cursor-pointer min-w-0"
                  title={ar ? 'لوحة تحكم صاحب الموقع' : 'Owner admin dashboard'}
                >
                  <Shield className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="truncate">{ar ? 'لوحة المالك' : 'Owner admin panel'}</span>
                </button>
              )}

              {onOpenIntegrations && (
                <button
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    onOpenIntegrations();
                  }}
                  className="w-full text-start px-2.5 py-2 rounded-lg text-xs font-bold text-slate-200 hover:bg-slate-800 flex items-center gap-2 transition cursor-pointer min-w-0"
                  title={ar ? 'قواعد البيانات والتكاملات' : 'Database & integrations'}
                >
                  <Database className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="truncate">{ar ? 'قاعدة البيانات' : 'Database & integrations'}</span>
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setShowUserMenu(false);
              onLogout?.();
            }}
            className="w-full text-start px-2.5 py-2 rounded-lg text-xs font-bold text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 transition mt-1 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{ar ? 'تسجيل الخروج' : 'Sign out'}</span>
          </button>
        </div>
      )}
    </aside>
  );
};