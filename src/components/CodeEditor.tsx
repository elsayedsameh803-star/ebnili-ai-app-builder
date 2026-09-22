import { useState } from 'react';
import {
  Copy,
  Check,
  FileCode,
  GitCompare
} from 'lucide-react';
import { Language } from '../types';

interface CodeEditorProps {
  files: Record<string, string>;
  activeFile: string;
  onSelectFile: (fileName: string) => void;
  onUpdateCode: (fileName: string, newContent: string) => void;
  previousCode?: string;
  language: Language;
}

export const CodeEditor = ({
  files,
  activeFile,
  onSelectFile,
  onUpdateCode,
  previousCode,
  language,
}: CodeEditorProps) => {
  const [copied, setCopied] = useState(false);
  const [showDiff, setShowDiff] = useState(false);

  const currentContent = files[activeFile] || '';

  const handleCopy = () => {
    navigator.clipboard?.writeText(currentContent).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Simple clean line diff generation
  const computeDiffLines = () => {
    if (!previousCode) return [];
    const prevLines = previousCode.split('\n');
    const currLines = currentContent.split('\n');
    const result: { type: 'same' | 'added' | 'removed'; text: string; num: number }[] = [];

    let cIdx = 0;
    for (let pIdx = 0; pIdx < prevLines.length; pIdx++) {
      if (currLines[cIdx] === prevLines[pIdx]) {
        result.push({ type: 'same', text: currLines[cIdx] || '', num: cIdx + 1 });
        cIdx++;
      } else {
        result.push({ type: 'removed', text: prevLines[pIdx], num: pIdx + 1 });
        if (cIdx < currLines.length) {
          result.push({ type: 'added', text: currLines[cIdx], num: cIdx + 1 });
          cIdx++;
        }
      }
    }

    while (cIdx < currLines.length) {
      result.push({ type: 'added', text: currLines[cIdx], num: cIdx + 1 });
      cIdx++;
    }

    return result;
  };

  const diffLines = computeDiffLines();

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 border-r border-slate-800 select-text overflow-hidden">
      {/* File Tabs & Actions */}
      <div className="h-10 bg-slate-900 border-b border-slate-800 px-3 flex items-center justify-between shrink-0 select-none">
        {/* Tab List */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-1">
          {Object.keys(files).map((file) => {
            const isActive = file === activeFile;
            return (
              <button
                key={file}
                onClick={() => onSelectFile(file)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono transition cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-slate-950 text-rose-400 border border-slate-800 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <FileCode className="w-3 h-3" />
                <span>{file}</span>
              </button>
            );
          })}
        </div>

        {/* Tools (Copy, Diff View Toggle) */}
        <div className="flex items-center gap-2">
          {previousCode && previousCode !== currentContent && (
            <button
              onClick={() => setShowDiff((v) => !v)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition cursor-pointer ${
                showDiff
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
              title={language === 'ar' ? 'عرض الفروقات بين النسخ' : 'Toggle Diff View'}
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Diff</span>
            </button>
          )}

          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-md text-xs transition cursor-pointer"
            title={language === 'ar' ? 'نسخ الكود' : 'Copy code'}
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">{language === 'ar' ? 'تم النسخ' : 'Copied'}</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>{language === 'ar' ? 'نسخ' : 'Copy'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Editor Main Canvas */}
      <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed text-slate-300">
        {showDiff ? (
          <div className="space-y-0.5">
            {diffLines.map((line, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 px-2 py-0.5 rounded ${
                  line.type === 'added'
                    ? 'bg-emerald-950/60 text-emerald-300 border-l-2 border-emerald-500'
                    : line.type === 'removed'
                    ? 'bg-rose-950/60 text-rose-300 line-through opacity-70 border-l-2 border-rose-500'
                    : 'text-slate-400'
                }`}
              >
                <span className="w-8 text-slate-600 text-right select-none shrink-0">{line.num}</span>
                <span className="w-3 select-none text-slate-500">
                  {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                </span>
                <pre className="whitespace-pre-wrap font-mono flex-1">{line.text}</pre>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex">
            {/* Line Numbers */}
            <div className="select-none text-slate-600 text-right pr-4 border-r border-slate-800 space-y-0.5 font-mono">
              {currentContent.split('\n').map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>

            {/* Editable Codearea */}
            <textarea
              value={currentContent}
              onChange={(e) => onUpdateCode(activeFile, e.target.value)}
              spellCheck={false}
              className="flex-1 bg-transparent text-slate-200 pl-4 focus:outline-none resize-none font-mono whitespace-pre overflow-x-auto min-h-[600px]"
            />
          </div>
        )}
      </div>
    </div>
  );
};
