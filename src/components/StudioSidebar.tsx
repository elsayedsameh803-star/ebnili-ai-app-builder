/**
 * Studio sidebar ΓÇö the single home for every workspace control.
 *
 * WHY THIS REPLACED THE TOP BAR
 * ----------------------------
 * The header was a single 56px row holding thirteen controls. Below ~1100px they
 * no longer fitted, so the row was made horizontally scrollable and labels were
 * progressively hidden behind `hidden lg:inline`, `hidden sm:inline`, `hidden
 * md:inline`ΓÇª What survived was a strip of unlabelled icons, and because the bar
 * is a scroll container its height could not grow ΓÇö so a long project name
 * overlapped the device buttons next to it. That overlap is what this removes.
 *
 * A vertical rail gives every control its own row: a label never competes with
 * an icon, and a long project name truncates inside its own box instead of
 * running across the toolbar. No control is hidden behind a breakpoint.
 *
 * LAYOUT RULES THAT MUST NOT BE BROKEN
 * ------------------------------------
 *  ΓÇó Never put an absolutely-positioned panel inside an `overflow` container ΓÇö
 *    it gets clipped. The panels are siblings rendered after the scroll area,
 *    inside the sidebar's own `relative` box.
 *  ΓÇó `min-w-0` on every flex child holding text, otherwise `truncate` has no
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
  LayoutDashboard,
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
import { isOwnerAccount, isAdminAccount } from '../lib/auth';
import type { ProjectSummary } from '../lib/projects';

/** "┘à┘å╪░ 5 ╪»┘é╪º╪ª┘é" / "2 hours ago" ΓÇö the project list is a recency list. */
function formatRelative(iso: string, language: Language): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) return language === 'ar' ? '╪º┘ä╪ó┘å' : 'now';
  if (minutes < 60) return language === 'ar' ? `┘à┘å╪░ ${minutes} ╪»` : `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return language === 'ar' ? `┘à┘å╪░ ${hours} ╪│` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return language === 'ar' ? `┘à┘å╪░ ${days} ┘è┘ê┘à` : `${days}d ago`;
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
  /**
   * Opens «لوحة المستخدم» — the signed-in customer's own dashboard (plan,
   * balance, quota meter, projects). Never rendered without a session: App only
   * passes this when `authUser` exists, and the modal itself re-checks.
   */
  onOpenUserDashboard?: () => void;
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

/**
 * One full-width row. The icon and the label can never fight for pixels.
 *
 * `active` is what separates the two kinds of row in this rail:
 *   ΓÇó `true` / `false` ΓåÆ a toggle (Preview / Split / Code, Desktop / Tablet /
 *     Mobile, Visual edit). `aria-pressed` is then meaningful and the state is
 *     announced.
 *   ΓÇó omitted          ΓåÆ a plain action (New project, Publish, Export, Open
 *     in tab). These have no on/off state, and announcing one is worse than
 *     announcing nothing.
 *
 * The prop is therefore spread conditionally rather than passed straight
 * through: React renders `aria-pressed="false"` for `aria-pressed={undefined}`
 * only when it is written literally, which would tell a screen reader that
 * "New project" is currently not pressed.
 */
const Row = ({
  icon: Icon,
  label,
  hint,
  onClick,
  active,
  iconClass = 'text-slate-400',
  title,
}: {
  icon: typeof Eye;
  label: string;
  hint?: string;
  onClick: () => void;
  /** `undefined` = plain action, `true`/`false` = toggle button. */
  active?: boolean;
  iconClass?: string;
  title?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title ?? label}
    {...(active === undefined ? {} : { 'aria-pressed': active })}
    className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-semibold transition cursor-pointer text-start ${
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
  onOpenUserDashboard,
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
  // into these buttons ΓÇö and server-side `requireAdmin` remains the real boundary.
  const isOwner = isOwnerAccount(authUser);

  // Console access: the owner OR an active delegate. This only decides what to
  // RENDER ΓÇö `requireAdmin` on the server is the real boundary, and the
  // owner-only tools below stay gated on `isOwner`.
  const canOpenAdmin = isAdminAccount(authUser);

  const ar = language === 'ar';

  useEffect(() => {
    setNameInput(projectName);
  }, [projectName]);

  // Close both panels on any outside click. The panels are siblings AFTER the
  // scroll area, so the check covers the triggers AND the panels themselves ΓÇö
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
    // container ΓÇö overflow lives on an inner box, otherwise the panels clip.
    <aside className="relative shrink-0 w-64 bg-slate-900 text-slate-100 border-e border-slate-800 flex flex-col z-30">
      {/* ΓöÇΓöÇ Brand + project name ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
          `relative` here ΓÇö not on the rail ΓÇö is what anchors the project
          switcher. See the panel note further down for why the rail cannot
          be the anchor. */}
      <div ref={projectsMenuRef} className="relative shrink-0 border-b border-slate-800 p-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-tr from-rose-500 via-pink-500 to-amber-400 flex items-center justify-center shadow-md shadow-rose-500/20">
            <span className="text-white text-base font-bold">ΓÖÑ</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-extrabold text-sm tracking-tight text-white font-['Cairo',sans-serif] truncate">
                ╪Ñ╪¿┘å┘è┘ä┘è
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
              aria-label={ar ? '╪º╪│┘à ╪º┘ä┘à╪┤╪▒┘ê╪╣' : 'Project name'}
              className="w-full bg-slate-800 text-xs font-semibold px-2.5 py-2 rounded-lg border border-slate-700 text-white outline-none focus:ring-1 focus:ring-rose-500"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingName(true)}
              title={ar ? '╪º┘å┘é╪▒ ┘ä╪¬╪║┘è┘è╪▒ ╪º╪│┘à ╪º┘ä┘à╪┤╪▒┘ê╪╣' : 'Click to rename'}
              className="w-full text-start px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 transition cursor-pointer min-w-0"
            >
              <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500">
                {ar ? '╪º┘ä┘à╪┤╪▒┘ê╪╣' : 'Project'}
              </span>
              <span className="block text-xs font-bold text-slate-200 truncate">
                {projectName || (ar ? '┘à╪┤╪▒┘ê╪╣ ╪¿╪»┘ê┘å ╪º╪│┘à' : 'Untitled project')}
              </span>
            </button>
          )}

          <div className="mt-2 flex items-center gap-2 min-w-0">
            {isGenerating ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-1 rounded-full border border-amber-500/20 animate-pulse min-w-0">
                <Sparkles className="w-3 h-3 animate-spin shrink-0" aria-hidden="true" />
                <span className="truncate">{ar ? '╪¼╪º╪▒┘ì ╪º┘ä╪¿┘å╪º╪íΓÇª' : 'BuildingΓÇª'}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="truncate">{ar ? '╪¼╪º┘ç╪▓' : 'Ready'}</span>
              </span>
            )}

            {projects.length > 1 && (
              <button
                type="button"
                onClick={() => setShowProjectsMenu((v) => !v)}
                className="shrink-0 text-[10px] font-bold text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-800 transition cursor-pointer"
                title={ar ? '╪¬╪¿╪»┘è┘ä ╪º┘ä┘à╪┤╪▒┘ê╪╣' : 'Switch project'}
                aria-expanded={showProjectsMenu}
              >
                Γû╛
              </button>
            )}
          </div>
        </div>

        {/* Project switcher ΓÇö anchored to THIS header, not to the rail.
            `top-full` drops it directly under the button it belongs to. It used
            to be a sibling of the scroll area using `bottom-full`, which
            resolved against the full-height `<aside>` and pushed the whole
            panel above the top of the viewport: the click registered, the
            state flipped, and nothing was ever visible. */}
        {showProjectsMenu && (
          <div className="absolute top-full inset-x-2 mt-1 max-h-80 overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-[60] p-1.5">
            <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase flex items-center justify-between gap-2">
              <span className="truncate">{ar ? '┘à╪┤╪º╪▒┘è╪╣┘è' : 'My projects'}</span>
              <span className="text-slate-600 normal-case font-medium truncate shrink-0">
                {ar ? '┘à╪¡┘ü┘ê╪╕╪⌐ ╪╣┘ä┘ë ┘ç╪░╪º ╪º┘ä╪¼┘ç╪º╪▓' : 'saved on this device'}
              </span>
            </div>

            {projects.length === 0 ? (
              <div className="px-3 py-6 text-center">
                <div className="w-10 h-10 mx-auto rounded-xl bg-slate-800 flex items-center justify-center mb-2">
                  <FolderTree className="w-5 h-5 text-slate-500" />
                </div>
                <p className="text-[11px] text-slate-400 leading-5">
                  {ar
                    ? '┘ä╪│┘ç ┘à┘ü┘è╪┤ ┘à╪┤╪º╪▒┘è╪╣ ┘à╪¡┘ü┘ê╪╕╪⌐. ╪ú┘ê┘ä ┘à╪º ╪¬┘ê┘ä┘æ╪» ┘à┘ê┘é╪╣ ┘ç┘è╪¬╪¡┘ü╪╕ ┘ç┘å╪º ╪¬┘ä┘é╪º╪ª┘è╪º┘ï.'
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
                          {isActive && <span className="text-rose-400 text-[10px] shrink-0">{ar ? '┘à┘ü╪¬┘ê╪¡' : 'open'}</span>}
                        </span>
                        <span className="block text-[10px] text-slate-500 truncate">
                          {p.versionCount ?? 0} {ar ? '╪Ñ╪╡╪»╪º╪▒╪º╪¬' : 'versions'} ┬╖ {formatRelative(p.updatedAt, language)}
                        </span>
                      </button>

                      {onRenameStoredProject && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = window.prompt(ar ? '╪º╪│┘à ╪º┘ä┘à╪┤╪▒┘ê╪╣ ╪º┘ä╪¼╪»┘è╪»' : 'New project name', p.name);
                            if (next && next.trim()) onRenameStoredProject(p.id, next.trim());
                          }}
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition shrink-0"
                          title={ar ? '╪Ñ╪╣╪º╪»╪⌐ ╪¬╪│┘à┘è╪⌐' : 'Rename'}
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
                                ? `╪¡╪░┘ü ╪º┘ä┘à╪┤╪▒┘ê╪╣ "${p.name}" ┘å┘ç╪º╪ª┘è╪º┘ï╪ƒ ┘ä╪º ┘è┘à┘â┘å ╪º┘ä╪¬╪▒╪º╪¼╪╣.`
                                : `Permanently delete "${p.name}"? This cannot be undone.`,
                            );
                            if (ok) onDeleteProject(p.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded-md text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition shrink-0"
                          title={ar ? '╪¡╪░┘ü' : 'Delete'}
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
                <span className="truncate">{ar ? '┘à╪┤╪▒┘ê╪╣ ╪¼╪»┘è╪»' : 'New project'}</span>
              </button>
            </div>
          </div>
        )}
      </div>


      {/* ΓöÇΓöÇ The rail ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2 space-y-0.5">
        <Row icon={Plus} label={ar ? '┘à╪┤╪▒┘ê╪╣ ╪¼╪»┘è╪»' : 'New project'} onClick={onNewProject} iconClass="text-rose-400" />

        <SectionLabel>{ar ? '╪╖╪▒┘è┘é╪⌐ ╪º┘ä╪╣╪▒╪╢' : 'View'}</SectionLabel>
        <Row icon={Eye} label={ar ? '┘à╪╣╪º┘è┘å╪⌐' : 'Preview'} onClick={() => onViewModeChange('preview')} active={viewMode === 'preview'} />
        <Row icon={Columns2} label={ar ? '┘à┘é╪│┘æ┘à' : 'Split'} onClick={() => onViewModeChange('split')} active={viewMode === 'split'} />
        <Row icon={Code2} label={ar ? '╪º┘ä┘â┘ê╪»' : 'Code'} onClick={() => onViewModeChange('code')} active={viewMode === 'code'} />

        <SectionLabel>{ar ? '┘à┘é╪º╪│ ╪º┘ä╪┤╪º╪┤╪⌐' : 'Screen size'}</SectionLabel>
        <Row icon={Monitor} label={ar ? '╪│╪╖╪¡ ╪º┘ä┘à┘â╪¬╪¿' : 'Desktop'} hint="100%" onClick={() => onDeviceModeChange('desktop')} active={deviceMode === 'desktop'} />
        <Row icon={Tablet} label={ar ? '╪¬╪º╪¿┘ä╪¬' : 'Tablet'} hint="768px" onClick={() => onDeviceModeChange('tablet')} active={deviceMode === 'tablet'} />
        <Row icon={Smartphone} label={ar ? '┘ç╪º╪¬┘ü' : 'Mobile'} hint="375px" onClick={() => onDeviceModeChange('mobile')} active={deviceMode === 'mobile'} />

        <SectionLabel>{ar ? '╪º┘ä╪¬╪╣╪»┘è┘ä' : 'Edit'}</SectionLabel>
        <Row
          icon={MousePointerClick}
          label={ar ? '╪¬╪╣╪»┘è┘ä ╪¿╪╡╪▒┘è' : 'Visual edit'}
          onClick={onToggleInspectMode}
          active={isInspectMode}
          iconClass="text-rose-400"
          title={ar ? '╪º┘å┘é╪▒ ╪ú┘è ╪╣┘å╪╡╪▒ ┘ü┘è ╪º┘ä┘à╪╣╪º┘è┘å╪⌐ ┘ä╪¬╪╣╪»┘è┘ä┘ç' : 'Click any element in the preview to edit it'}
        />

        <SectionLabel>{ar ? '╪º┘ä╪Ñ╪¼╪▒╪º╪í╪º╪¬' : 'Actions'}</SectionLabel>
        <Row icon={Share2} label={ar ? '┘å╪┤╪▒ ┘ê┘à╪┤╪º╪▒┘â╪⌐' : 'Publish'} onClick={onOpenDeploy} iconClass="text-rose-400" />
        <Row icon={Download} label={ar ? '╪¬╪╡╪»┘è╪▒ ZIP' : 'Export ZIP'} onClick={onOpenExport} iconClass="text-emerald-400" />
        {onOpenInNewTab && (
          <Row icon={ExternalLink} label={ar ? '┘ü╪¬╪¡ ┘ü┘è ╪¬╪¿┘ê┘è╪¿' : 'Open in tab'} onClick={onOpenInNewTab} iconClass="text-cyan-400" />
        )}
        {onOpenGeminiStudio && (
          <Row icon={Sparkles} label={ar ? '╪º╪│╪¬┘ê╪»┘è┘ê ╪Ñ╪¿┘å┘è┘ä┘è' : 'Ebnili Studio'} onClick={onOpenGeminiStudio} iconClass="text-amber-400" />
        )}
        {/* «لوحة المستخدم» — the customer's OWN dashboard. Gated on the session:
            a guest has no account to show, so the row simply does not exist. */}
        {authUser && onOpenUserDashboard && (
          <Row
            icon={LayoutDashboard}
            label={ar ? 'لوحة المستخدم' : 'My dashboard'}
            onClick={onOpenUserDashboard}
            iconClass="text-rose-400"
            title={ar ? 'باقتك ورصيدك واستهلاك الكوتة ومشاريعك' : 'Your plan, balance, quota and projects'}
          />
        )}
        {onOpenSubscription && (
          <Row
            icon={Crown}
            label={subscription && subscription.tier !== 'free' ? `${subscription.tier.toUpperCase()} Γ£ô` : ar ? '╪¬╪▒┘é┘è╪⌐ ╪º┘ä╪¿╪º┘é╪⌐' : 'Upgrade plan'}
            onClick={onOpenSubscription}
            iconClass="text-orange-400"
          />
        )}

        {/* ΓöÇΓöÇ Legal & support ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
            These four documents used to exist ONLY inside the account
            dropdown, behind a toggle. A privacy policy, terms of service and
            contact page that a visitor has to find and open a menu to reach
            are, in practice, not published at all ΓÇö and this is exactly what
            the owner asked to be fixed. They now have their own always-
            visible section here, in the footer of the marketing hero, and at
            the bottom of the sign-in gate. */}
        {onOpenInfoPage && (
          <>
            <SectionLabel>{ar ? '╪º┘ä┘à┘å╪╡╪⌐ ┘ê╪º┘ä┘é╪º┘å┘ê┘å' : 'Platform & legal'}</SectionLabel>
            {[
              { key: 'about' as const, ar: '┘à┘å ┘å╪¡┘å', en: 'About', icon: Info },
              { key: 'contact' as const, ar: '╪º╪¬╪╡┘ä ╪¿┘å╪º', en: 'Contact', icon: Phone },
              { key: 'privacy' as const, ar: '╪│┘è╪º╪│╪⌐ ╪º┘ä╪«╪╡┘ê╪╡┘è╪⌐', en: 'Privacy', icon: ShieldCheck },
              { key: 'terms' as const, ar: '╪º┘ä╪┤╪▒┘ê╪╖ ┘ê╪º┘ä╪ú╪¡┘â╪º┘à', en: 'Terms', icon: Scale },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Row
                  key={item.key}
                  icon={Icon}
                  label={ar ? item.ar : item.en}
                  onClick={() => onOpenInfoPage(item.key)}
                  iconClass="text-slate-400"
                />
              );
            })}

            {/* The support number is also a tap target. A phone number printed
                as plain digits is unusable on a phone, which is the one device
                a support link is most likely to be read on. */}
            <a
              href="tel:+201207782741"
              dir="ltr"
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] font-bold text-emerald-400 hover:bg-emerald-500/10 transition min-w-0"
              title={ar ? '╪º╪¬╪╡┘ä ╪¿╪º┘ä╪»╪╣┘à ╪º┘ä┘ü┘å┘è' : 'Call support'}
            >
              <Phone className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">01207782741</span>
            </a>
          </>
        )}
      </div>

      {/* ΓöÇΓöÇ Account block, pinned to the bottom ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
          `relative` here is load-bearing: it is the positioning context for
          the account panel rendered at the end of this block. See the note on
          that panel for the bug this fixes. */}
      <div className="relative shrink-0 border-t border-slate-800 p-2 space-y-1">
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
          /* A guest still needs this row to be a REAL button, so it is rendered
             unconditionally and the prop decides only whether the click does
             something. It used to be `onOpenAuth && <Row ΓÇª/>`, which rendered
             NOTHING whenever the callback was absent ΓÇö and that is exactly the
             guest's case, so the rail showed an empty strip where the sign-in
             control belonged and tapping it did nothing on any screen size. */
          <Row
            icon={LogIn}
            label={ar ? '╪¬╪│╪¼┘è┘ä ╪º┘ä╪»╪«┘ê┘ä' : 'Sign in'}
            onClick={() => onOpenAuth?.()}
            iconClass="text-indigo-400"
          />
        )}

        <Row icon={Globe} label={ar ? 'English' : '╪º┘ä╪╣╪▒╪¿┘è╪⌐'} onClick={onToggleLanguage} />

        {/* Switch account ΓÇö the action that was impossible to reach.
            Signing in with a second Google/GitHub identity means replacing the
            session cookie, and the only path to that used to be: sign out
            (losing the session), reload, and hunt for the sign-in button again.
            Opening the auth dialog from inside the account panel does it in one
            tap, and OAuth will hand back the *other* account the user picks. */}
        {authUser && onOpenAuth && (
          <button
            type="button"
            onClick={() => {
              setShowUserMenu(false);
              onOpenAuth();
            }}
            className="w-full text-start px-2.5 py-2 rounded-lg text-[11px] font-bold text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2 transition cursor-pointer min-w-0"
            title={ar ? '╪º╪│╪¬╪«╪»┘à ╪¡╪│╪º╪¿ ╪ó╪«╪▒' : 'Use a different account'}
          >
            <UserIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{ar ? '╪¬╪║┘è┘è╪▒ ╪º┘ä╪¡╪│╪º╪¿' : 'Switch account'}</span>
          </button>
        )}

        {/* Account panel ΓÇö anchored to THIS account block, not to the rail.
            This is the root cause of "the sign-in button opens no window": as a
            sibling of the scroll area, `bottom-full` resolved against the
            full-height `<aside>`, so the panel was laid out entirely ABOVE the
            top of the viewport and clipped away. The click registered, the
            state flipped, and the user saw nothing at all. `bottom-full` is
            only correct when the containing block is the small box the panel
            actually belongs to. */}
        {showUserMenu && (
          <div
            ref={userMenuRef}
            className="absolute bottom-full left-1 right-1 mb-1 max-h-[70vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-[60] p-1.5"
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
                {ar ? '╪╣┘å ╪º┘ä┘à┘å╪╡╪⌐' : 'About Ebnili'}
              </div>
              {(
                [
                  { key: 'about', ar: '┘à┘å ┘å╪¡┘å', en: 'About', icon: Info },
                  { key: 'contact', ar: '╪º╪¬╪╡┘ä ╪¿┘å╪º', en: 'Contact', icon: Phone },
                  { key: 'privacy', ar: '╪º┘ä╪«╪╡┘ê╪╡┘è╪⌐', en: 'Privacy', icon: ShieldCheck },
                  { key: 'terms', ar: '╪º┘ä╪┤╪▒┘ê╪╖', en: 'Terms', icon: Scale },
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

          {/* ΓöÇΓöÇ Owner-only tools ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
              Owner surfaces live HERE, inside the account panel, and only for
              the site owner. `isOwner` is the server-issued flag ΓÇö see
              `isOwnerAccount`; server-side `requireAdmin` is the real boundary. */}
          {canOpenAdmin && onOpenAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenAdmin();
                      }}
                      className="w-full text-start px-2.5 py-2 rounded-lg text-xs font-bold text-rose-300 hover:bg-rose-500/10 flex items-center gap-2 transition cursor-pointer min-w-0"
                      title={ar ? '┘ä┘ê╪¡╪⌐ ╪¬╪¡┘â┘à ╪º┘ä┘à┘ê┘é╪╣' : 'Admin dashboard'}
                    >
                      <Shield className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span className="truncate">{ar ? '┘ä┘ê╪¡╪⌐ ╪º┘ä╪¬╪¡┘â┘à' : 'Admin dashboard'}</span>
                    </button>
                  )}

          {/* ΓöÇΓöÇ Owner-only tools ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
              Owner surfaces live HERE, inside the account panel, and only for
              the site owner. `isOwner` is the server-issued flag ΓÇö see
              `isOwnerAccount`; server-side `requireOwner` is the real boundary. */}
          {isOwner && onOpenIntegrations && (
            <div className="mt-1 pt-1 border-t border-slate-800">
              <div className="px-2.5 py-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                {ar ? '╪ú╪»┘ê╪º╪¬ ╪º┘ä┘à╪º┘ä┘â ┘ü┘é╪╖' : 'Owner tools only'}
              </div>

              {onOpenIntegrations && (
                <button
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    onOpenIntegrations();
                  }}
                  className="w-full text-start px-2.5 py-2 rounded-lg text-xs font-bold text-slate-200 hover:bg-slate-800 flex items-center gap-2 transition cursor-pointer min-w-0"
                  title={ar ? '┘é┘ê╪º╪╣╪» ╪º┘ä╪¿┘è╪º┘å╪º╪¬ ┘ê╪º┘ä╪¬┘â╪º┘à┘ä╪º╪¬' : 'Database & integrations'}
                >
                  <Database className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="truncate">{ar ? '┘é╪º╪╣╪»╪⌐ ╪º┘ä╪¿┘è╪º┘å╪º╪¬' : 'Database & integrations'}</span>
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
            <span className="truncate">{ar ? '╪¬╪│╪¼┘è┘ä ╪º┘ä╪«╪▒┘ê╪¼' : 'Sign out'}</span>
          </button>
        </div>
        )}
      </div>
    </aside>
  );
};
