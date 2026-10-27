import { useEffect, useRef, useState } from 'react';
import { Terminal as TerminalIcon, X } from 'lucide-react';
import type { Language } from '../types';

interface Props {
  language: Language;
  open: boolean;
  onClose: () => void;
}

interface Line { text: string; kind?: 'input' | 'output' | 'error' | 'info' }

export const InteractiveTerminal = ({ language, open, onClose }: Props) => {
  const ar = language === 'ar';
  const [lines, setLines] = useState<Line[]>([
    { text: ar ? 'Ebnili Terminal v1.0 — اكتب "help" لعرض الأوامر' : 'Ebnili Terminal v1.0 — type "help" for commands', kind: 'info' },
  ]);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [lines]);

  const push = (l: Line) => setLines((prev) => [...prev, l]);

  const run = async (cmd: string) => {
    const trimmed = cmd.trim();
    push({ text: `$ ${trimmed}`, kind: 'input' });
    if (!trimmed) return;
    const [head, ...rest] = trimmed.split(/\s+/);
    const arg = rest.join(' ');
    switch (head) {
      case 'help':
        push({ text: ar ? 'الأوامر: help, clear, status, git add ., git commit -m "...", git push, vercel --prod, ebnily generate "اسم", exit' : 'Commands: help, clear, status, git add ., git commit -m "...", git push, vercel --prod, ebnily generate "name", exit', kind: 'output' });
        break;
      case 'clear':
        setLines([]);
        break;
      case 'python':
        if (arg === '-m venv venv') push({ text: ar ? 'تم إنشاء البيئة الافتراضية (venv)' : 'Virtual environment created (venv)', kind: 'output' });
        else if (arg.startsWith('-m pdb')) push({ text: ar ? 'تم تشغيل pdb (محاكاة)' : 'pdb started (simulated)', kind: 'output' });
        else if (arg) push({ text: ar ? `تشغيل ${arg}... (محاكاة)` : `Running ${arg}... (simulated)`, kind: 'output' });
        else push({ text: ar ? 'استخدم: python <file.py>' : 'Use: python <file.py>', kind: 'error' });
        break;
      case 'pip':
        if (arg.startsWith('install')) push({ text: ar ? `تم تثبيت ${arg.replace('install', '').trim() || 'package'}` : `Installed ${arg.replace('install', '').trim() || 'package'}`, kind: 'output' });
        else if (arg === 'freeze') push({ text: ar ? 'requirements.txt (محاكاة)' : 'requirements.txt (simulated)', kind: 'output' });
        else push({ text: ar ? 'استخدم: pip install <pkg> | pip freeze' : 'Use: pip install <pkg> | pip freeze', kind: 'error' });
        break;
      case 'flake8':
      case 'pylint':
        push({ text: ar ? `${head}: لا توجد أخطاء (محاكاة)` : `${head}: no issues (simulated)`, kind: 'output' });
        break;
      case 'pytest':
        push({ text: ar ? 'pytest: 1 passed (محاكاة)' : 'pytest: 1 passed (simulated)', kind: 'output' });
        break;
      case 'exit':
        onClose();
        break;
      case 'status':
        push({ text: ar ? 'السيرفر: OK · API: connected · Credits: OK' : 'Server: OK · API: connected · Credits: OK', kind: 'output' });
        break;
      case 'git':
        if (arg === 'add .') push({ text: ar ? 'تم تجهيز الملفات (snapshot staged)' : 'Files staged (snapshot)', kind: 'output' });
        else if (arg.startsWith('commit -m')) push({ text: ar ? `تم الـ commit: ${arg.replace('commit -m', '').trim()}` : `Committed: ${arg.replace('commit -m', '').trim()}`, kind: 'output' });
        else if (arg === 'push') push({ text: ar ? 'تم رفع اللقطة إلى GitHub (محاكاة)' : 'Pushed snapshot to GitHub (simulated)', kind: 'output' });
        else push({ text: ar ? 'أمر git غير معروف' : 'Unknown git command', kind: 'error' });
        break;
      case 'vercel':
        if (arg === '--prod') push({ text: ar ? 'تم نشر الموقع إلى Vercel (محاكاة)' : 'Deployed to Vercel (simulated)', kind: 'output' });
        else push({ text: ar ? 'استخدم: vercel --prod' : 'Use: vercel --prod', kind: 'error' });
        break;
      case 'ebnily':
        if (arg.startsWith('generate')) push({ text: ar ? `تم توليد مكون: ${arg.replace('generate', '').trim()}` : `Generated component: ${arg.replace('generate', '').trim()}`, kind: 'output' });
        else push({ text: ar ? 'استخدم: ebnily generate "اسم"' : 'Use: ebnily generate "name"', kind: 'error' });
        break;
      default:
        push({ text: ar ? `أمر غير معروف: ${head}` : `Unknown command: ${head}`, kind: 'error' });
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(input);
    setInput('');
  };

  if (!open) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] h-72 bg-slate-950 border-t border-slate-700 shadow-2xl flex flex-col">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-700">
        <span className="flex items-center gap-2 text-xs font-bold text-slate-300">
          <TerminalIcon className="w-3.5 h-3.5" /> {ar ? 'تيرمينال' : 'Terminal'}
        </span>
        <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-auto p-3 font-mono text-xs text-slate-200">
        {lines.map((l, i) => (
          <div key={i} className={l.kind === 'error' ? 'text-rose-400' : l.kind === 'info' ? 'text-sky-400' : l.kind === 'input' ? 'text-emerald-400' : 'text-slate-200'}>{l.text}</div>
        ))}
      </div>
      <form onSubmit={submit} className="flex items-center gap-2 px-3 py-2 border-t border-slate-800">
        <span className="text-emerald-400 font-mono">$</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 bg-transparent outline-none text-slate-200 font-mono text-xs"
          spellCheck={false}
          autoComplete="off"
        />
      </form>
    </div>
  );
};