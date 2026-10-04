import { useMemo, useState } from 'react';
import { Copy, Check, Terminal, AlertTriangle, Github, Server, Package, GitBranch, Rocket, ChevronDown, ChevronRight } from 'lucide-react';
import type { Language } from '../types';
import { buildCommandBundle, safeRepoSlug, type CommandEntry, type DeployProvider } from '../lib/commands';

interface CommandTerminalProps {
  projectName: string;
  language: Language;
}

type SectionKey = 'local' | 'build' | 'git' | 'deploy';

const SECTION_META: Record<SectionKey, { label: string; labelAr: string; icon: typeof Terminal }> = {
  local: { label: 'Local setup', labelAr: 'التشغيل المحلي', icon: Terminal },
  build: { label: 'Production build', labelAr: 'بناء الإنتاج', icon: Package },
  git: { label: 'Version control', labelAr: 'التحكم بالإصدارات', icon: GitBranch },
  deploy: { label: 'Deploy', labelAr: 'النشر', icon: Rocket },
};

/** One command row with its own copy button and state. */
const CommandRow = ({ entry, language }: { entry: CommandEntry; language: Language }) => {
  const [copied, setCopied] = useState(false);
  const ar = language === 'ar';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(entry.command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — the text is selectable on screen anyway */
    }
  };

  return (
    <div className="group rounded-lg border border-slate-800 bg-slate-950/70 overflow-hidden">
      <div className="flex items-start gap-2 px-3 pt-2.5 pb-1.5">
        <span className="font-mono text-emerald-400 select-none shrink-0" aria-hidden="true">$</span>
        <code className="font-mono text-[11px] text-slate-200 break-all flex-1 select-all" dir="ltr">
          {entry.command}
        </code>
      </div>
      <div className="flex items-center justify-between gap-2 px-3 pb-2">
        <p className="text-[10px] text-slate-500 leading-snug min-w-0">
          {ar ? entry.noteAr : entry.note}
        </p>
        <button
          type="button"
          onClick={copy}
          aria-label={ar ? 'نسخ الأمر' : 'Copy command'}
          className="shrink-0 inline-flex items-center gap-1 rounded-md bg-slate-800 hover:bg-slate-700 px-2 py-1 text-[10px] font-bold text-slate-200 transition cursor-pointer"
        >
          {copied ? (
            <><Check className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400">{ar ? 'تم' : 'Copied'}</span></>
          ) : (
            <><Copy className="w-3 h-3" /><span>{ar ? 'نسخ' : 'Copy'}</span></>
          )}
        </button>
      </div>
      {entry.blockedReason && (
        <p className="mx-3 mb-2.5 flex items-start gap-1.5 rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-200 leading-snug">
          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{ar ? entry.blockedReasonAr : entry.blockedReason}</span>
        </p>
      )}
    </div>
  );
};

/**
 * Build, publish and version-control panel.
 *
 * SECURITY — this component NEVER executes anything. Every button copies text
 * to the clipboard; the visitor runs it in a terminal they own. See
 * `src/lib/commands.ts` for why a server-side shell was refused outright.
 */
export const CommandTerminal = ({ projectName, language }: CommandTerminalProps) => {
  const ar = language === 'ar';
  const [provider, setProvider] = useState<DeployProvider>('vercel');
  const [repoInput, setRepoInput] = useState('');
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    local: true,
    build: true,
    git: true,
    deploy: true,
  });

  // The typed repo slug is validated before it reaches a command line, so a
  // half-typed or hostile value can never be pasted into a shell instruction.
  const validRepo = useMemo(() => safeRepoSlug(repoInput), [repoInput]);
  const bundle = useMemo(
    () => buildCommandBundle(projectName, provider, validRepo ?? ''),
    [projectName, provider, validRepo],
  );

  const toggle = (key: SectionKey) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(bundle.allScript);
    } catch {
      /* clipboard blocked — the script stays selectable below */
    }
  };

  return (
    <div className="space-y-3">
      {/* Honest scope note. Without this the panel reads as "the site runs
          commands for you", which is exactly the misunderstanding that makes a
          copy-paste command dangerous. */}
      <p className="flex items-start gap-1.5 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-[11px] text-slate-400 leading-relaxed">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" aria-hidden="true" />
        <span>
          {ar
            ? 'هذه أوامر جاهزة للنسخ — اضغط «نسخ» ثم الصقها في الطرفية على جهازك. الموقع لا ينفّذ أي أمر نيابة عنك ولا يلمس ملفاتك.'
            : 'These are copy-ready commands — hit Copy, then paste them into a terminal on your own machine. The site never runs anything for you and never touches your files.'}
        </span>
      </p>

      {/* Host picker — changes the deploy command only. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
          <Server className="w-3.5 h-3.5" aria-hidden="true" />
          {ar ? 'مزود النشر:' : 'Deploy to:'}
        </span>
        {(['vercel', 'netlify'] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setProvider(id)}
            aria-pressed={provider === id}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
              provider === id
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
            }`}
          >
            {id === 'vercel' ? 'Vercel' : 'Netlify'}
          </button>
        ))}
      </div>


      {/* Optional GitHub repo — unlocks the exact push commands. */}
      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5">
        <label htmlFor="repo-slug" className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 mb-1.5">
          <Github className="w-3.5 h-3.5" aria-hidden="true" />
          {ar ? 'مستودع GitHub (اختياري)' : 'GitHub repository (optional)'}
        </label>
        <input
          id="repo-slug"
          type="text"
          value={repoInput}
          onChange={(e) => setRepoInput(e.target.value)}
          placeholder="owner/repository"
          dir="ltr"
          spellCheck={false}
          autoComplete="off"
          className="w-full rounded-md bg-slate-900 border border-slate-700 px-2.5 py-1.5 font-mono text-[11px] text-white outline-none focus:border-rose-500/50"
        />
        <p className={`mt-1 text-[10px] ${validRepo ? 'text-emerald-400' : 'text-slate-500'}`}>
          {validRepo
            ? (ar ? '✓ سيُبنى أمر الدفع تلقائياً' : '✓ push commands will be generated')
            : (ar ? 'اكتب owner/repository لتوليد أمر دفع دقيق' : 'Enter owner/repository for exact push commands')}
        </p>
      </div>

      {/* Command groups. */}
      {(Object.keys(SECTION_META) as SectionKey[]).map((key) => {
        const meta = SECTION_META[key];
        const Icon = meta.icon;
        const entries = bundle[key];
        const isOpen = open[key];
        return (
          <section key={key} className="rounded-lg border border-slate-800 overflow-hidden">
            <button
              type="button"
              onClick={() => toggle(key)}
              aria-expanded={isOpen}
              className="w-full flex items-center gap-2 bg-slate-900 hover:bg-slate-800/70 px-3 py-2 text-start transition cursor-pointer"
            >
              {isOpen
                ? <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
                : <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />}
              <Icon className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
              <span className="text-[12px] font-bold text-slate-200">{ar ? meta.labelAr : meta.label}</span>
              <span className="ms-auto text-[10px] text-slate-500 font-mono">{entries.length}</span>
            </button>
            {isOpen && (
              <div className="p-2 space-y-1.5 bg-slate-900/40">
                {entries.map((entry) => (
                  <CommandRow key={entry.id} entry={entry} language={language} />
                ))}
              </div>
            )}
          </section>
        );
      })}

      {/* Everything at once. */}
      <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-[11px] font-bold text-slate-300">
            {ar ? 'كل الأوامر مرة واحدة' : 'All commands at once'}
          </span>
          <button
            type="button"
            onClick={copyAll}
            className="inline-flex items-center gap-1 rounded-md bg-slate-800 hover:bg-slate-700 px-2 py-1 text-[10px] font-bold text-slate-200 transition cursor-pointer"
          >
            <Copy className="w-3 h-3" aria-hidden="true" />
            {ar ? 'نسخ الكل' : 'Copy all'}
          </button>
        </div>
        <pre className="font-mono text-[10px] leading-relaxed text-slate-400 whitespace-pre-wrap break-all select-all" dir="ltr">
          {bundle.allScript}
        </pre>
      </div>
    </div>
  );
};

