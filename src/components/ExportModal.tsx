import { useState } from 'react';
import { Download, X, Copy, Check, FileArchive, Terminal, Code } from 'lucide-react';
import JSZip from 'jszip';
import { Language } from '../types';
import { buildProjectExport, slugify } from '../lib/auth';
import { exportProjectFiles } from '../lib/projects';

interface ExportModalProps {
  projectName: string;
  files: Record<string, string>;
  onClose: () => void;
  language: Language;
}

export const ExportModal = ({
  projectName,
  files,
  onClose,
  language,
}: ExportModalProps) => {
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  const embedSnippet = `<iframe src="https://ibnili.app/embed/${encodeURIComponent(
    projectName.toLowerCase().replace(/\s+/g, '-')
  )}" width="100%" height="650" frameborder="0"></iframe>`;

  const handleDownloadZip = async () => {
    try {
      setIsZipping(true);
      // Build a real multi-file project (index.html + src/styles.css +
      // src/app.js + package.json + README) instead of zipping the single
      // generated HTML page, which is what made the download look "broken".
      const project = buildProjectExport(projectName, files);

      // The files are produced by the SERVER, which decides the watermark from
      // this account's real subscription. Zipping the browser's own copy would
      // hand every user a clean, mark-free export.
      const result = await exportProjectFiles(project.files);
      const zip = new JSZip();

      Object.entries(result.files).forEach(([path, content]) => {
        zip.file(path, content);
      });

      // Generate blob — compression keeps large projects fast to build and small
      // to download. `streamFiles: true` is the default, but being explicit
      // documents the intent and avoids holding every entry in memory.
      const content = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${project.rootDir}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Give the browser a tick to start the download before releasing the blob.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('Export zip failed:', err);
      alert(
        language === 'ar'
          ? 'تعذر إنشاء ملف ZIP. يرجى المحاولة مرة أخرى.'
          : 'Failed to generate the ZIP archive. Please try again.',
      );
    } finally {
      setIsZipping(false);
    }
  };

  const handleCopySnippet = () => {
    navigator.clipboard?.writeText(embedSnippet).catch(() => undefined);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">
                {language === 'ar' ? 'تصدير مشروع التطبيق' : 'Export Project Code'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {language === 'ar' ? 'تحميل الكود المصدري كاملاً وتشغيله محلياً' : 'Download full source code to run locally'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Option 1: ZIP Archive */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FileArchive className="w-8 h-8 text-rose-400 shrink-0" />
            <div>
              <h4 className="font-bold text-xs text-white">
                {language === 'ar' ? 'تحميل كود مشروعك كملف ZIP' : 'Download Your Project as ZIP'}
              </h4>
              <p className="text-[11px] text-slate-400">
                {language === 'ar'
                  ? 'ملف مضغوط يحتوي على ملفات مشروعك التي أنشأتها، جاهز للتشغيل محلياً'
                  : 'A compressed archive of the project files you generated, ready to run locally'}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleDownloadZip}
              disabled={isZipping}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer text-center"
            >
              <Download className={`w-3.5 h-3.5 ${isZipping ? 'animate-bounce' : ''}`} />
              <span>
                {isZipping
                  ? (language === 'ar' ? 'جارٍ التحضير...' : 'Preparing...')
                  : (language === 'ar' ? 'تحميل ملف ZIP' : 'Download ZIP')}
              </span>
            </button>
          </div>
        </div>

        {/* Option 2: Embed Snippet */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span className="flex items-center gap-1.5">
              <Code className="w-3.5 h-3.5 text-indigo-400" />
              <span>{language === 'ar' ? 'كود التضمين (Embed iframe)' : 'Embed in your site'}</span>
            </span>
            <button
              onClick={handleCopySnippet}
              className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px] transition cursor-pointer"
            >
              {copiedSnippet ? (
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
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 break-all select-all">
            {embedSnippet}
          </div>
        </div>

        {/* Option 3: Terminal Quick Start */}
        <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-1 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <Terminal className="w-3 h-3 text-amber-400" />
            <span>{language === 'ar' ? 'التشغيل المحلي عبر الطرفية:' : 'Terminal Quickstart:'}</span>
          </div>
          <pre className="font-mono text-[11px] text-slate-300 pt-1">
            unzip {slugify(projectName)}.zip
            {'\n'}cd {slugify(projectName)}
            {'\n'}npm install
            {'\n'}npm run dev
          </pre>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
          >
            {language === 'ar' ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
