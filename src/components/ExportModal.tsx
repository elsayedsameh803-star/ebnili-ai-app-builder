import React, { useState } from 'react';
import { Download, X, Copy, Check, FileArchive, Terminal, Code } from 'lucide-react';
import JSZip from 'jszip';
import { Language } from '../types';

interface ExportModalProps {
  projectName: string;
  files: Record<string, string>;
  onClose: () => void;
  language: Language;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  projectName,
  files,
  onClose,
  language,
}) => {
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  const embedSnippet = `<iframe src="https://ibnili.app/embed/${encodeURIComponent(
    projectName.toLowerCase().replace(/\s+/g, '-')
  )}" width="100%" height="650" frameborder="0"></iframe>`;

  const handleDownloadZip = async () => {
    try {
      setIsZipping(true);
      const zip = new JSZip();

      // Add all project files
      Object.entries(files).forEach(([fileName, content]) => {
        zip.file(fileName, String(content));
      });

      // Add standard package.json
      const packageJson = {
        name: projectName.toLowerCase().replace(/\s+/g, '-'),
        version: '1.0.0',
        description: 'Generated with ابنيلي (Ibni-li) AI App Builder',
        scripts: {
          dev: 'vite',
          build: 'vite build',
          preview: 'vite preview',
        },
        dependencies: {
          react: '^18.3.1',
          'react-dom': '^18.3.1',
          'lucide-react': '^0.400.0',
        },
        devDependencies: {
          tailwindcss: '^3.4.0',
          vite: '^5.0.0',
        },
      };
      zip.file('package.json', JSON.stringify(packageJson, null, 2));

      // Add README.md
      const readme = `# ${projectName}\n\nThis application was generated using [ابنيلي AI App Builder](https://ibnili.app).\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\nOpen http://localhost:3000 to preview.\n`;
      zip.file('README.md', readme);

      // Generate blob
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${projectName.toLowerCase().replace(/\s+/g, '-')}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export zip failed:', err);
      alert('Failed to generate ZIP archive.');
    } finally {
      setIsZipping(false);
    }
  };

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(embedSnippet);
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
                {language === 'ar' ? 'تحميل كود المنصة بالكامل لـ GitHub و Vercel' : 'Full Project Archive (ZIP)'}
              </h4>
              <p className="text-[11px] text-slate-400">
                {language === 'ar'
                  ? 'ملف مضغوط جاهز للرفع على GitHub ثم Vercel مباشرة (يتضمن vercel.json و server.ts)'
                  : 'Complete package with vercel.json, backend, and frontend ready for Vercel'}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <a
              href="/download-project-zip"
              download="project-source.zip"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer text-center"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{language === 'ar' ? 'تحميل ملف ZIP الكامل' : 'Download ZIP'}</span>
            </a>
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
            unzip {projectName.toLowerCase().replace(/\s+/g, '-')}.zip{'\n'}
            npm install{'\n'}
            npm run dev
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
