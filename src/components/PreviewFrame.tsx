import { useRef, useEffect, useState, useMemo } from 'react';
import {
  RotateCw,
  ExternalLink,
  Terminal,
  MousePointerClick,
  Check,
  Copy,
  Crown
} from 'lucide-react';
import { DeviceMode, ConsoleLog, SelectedElementInfo, Language } from '../types';

interface PreviewFrameProps {
  code: string;
  deviceMode: DeviceMode;
  isInspectMode: boolean;
  onElementSelect: (info: SelectedElementInfo) => void;
  language: Language;
  subscriptionTier?: 'free' | 'pro' | 'business';
  onOpenSubscription?: () => void;
}

export const PreviewFrame = ({
  code,
  deviceMode,
  isInspectMode,
  onElementSelect,
  language,
  subscriptionTier = 'free',
  onOpenSubscription,
}: PreviewFrameProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([]);
  const [showConsole, setShowConsole] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Listen for messages from inside the preview iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== 'object') return;

      if (e.data.type === 'LOVABLE_ELEMENT_SELECTED') {
        onElementSelect(e.data.elementInfo);
      } else if (e.data.type === 'LOVABLE_CONSOLE_LOG') {
        setConsoleLogs((prev) => [
          ...prev.slice(-49), // keep last 50 logs
          {
            id: String(Date.now() + Math.random()),
            type: e.data.logType || 'log',
            message: e.data.message || '',
            time: new Date().toLocaleTimeString(),
          },
        ]);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onElementSelect]);

  // Build enhanced HTML with inspector script & console interceptor
  const buildInjectedCode = (rawHtml: string, inspectActive: boolean) => {
    if (!rawHtml) return '';

    const injection = `
      <script>
        (function() {
          // Intercept Console
          const originalLog = console.log;
          const originalWarn = console.warn;
          const originalError = console.error;

          console.log = function(...args) {
            originalLog.apply(console, args);
            window.parent.postMessage({
              type: 'LOVABLE_CONSOLE_LOG',
              logType: 'log',
              message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
            }, '*');
          };
          console.warn = function(...args) {
            originalWarn.apply(console, args);
            window.parent.postMessage({
              type: 'LOVABLE_CONSOLE_LOG',
              logType: 'warn',
              message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
            }, '*');
          };
          console.error = function(...args) {
            originalError.apply(console, args);
            window.parent.postMessage({
              type: 'LOVABLE_CONSOLE_LOG',
              logType: 'error',
              message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
            }, '*');
          };

          // Visual Edit Inspector
          const isInspectActive = ${inspectActive};
          let hoveredEl = null;

          if (isInspectActive) {
            document.addEventListener('mouseover', function(e) {
              if (hoveredEl && hoveredEl !== e.target) {
                hoveredEl.style.outline = '';
                hoveredEl.style.cursor = '';
              }
              hoveredEl = e.target;
              hoveredEl.style.outline = '2px dashed #f43f5e';
              hoveredEl.style.cursor = 'crosshair';
            }, true);

            document.addEventListener('mouseout', function(e) {
              if (hoveredEl) {
                hoveredEl.style.outline = '';
                hoveredEl.style.cursor = '';
              }
            }, true);

            document.addEventListener('click', function(e) {
              e.preventDefault();
              e.stopPropagation();
              const el = e.target;
              const tagName = el.tagName.toLowerCase();
              const text = (el.innerText || el.textContent || '').slice(0, 60).trim();
              const className = typeof el.className === 'string' ? el.className : '';
              const id = el.id ? '#' + el.id : '';
              const selector = id || (tagName + (className ? '.' + className.split(' ')[0] : ''));

              window.parent.postMessage({
                type: 'LOVABLE_ELEMENT_SELECTED',
                elementInfo: {
                  tagName,
                  text,
                  className,
                  selector
                }
              }, '*');
            }, true);
          }
        })();
      </script>
    `;

    if (rawHtml.includes('</body>')) {
      return rawHtml.replace('</body>', `${injection}</body>`);
    }
    return rawHtml + injection;
  };

  const handleOpenNewTab = () => {
    const blob = new Blob([code], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(window.location.href).catch(() => undefined);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const injectedHtml = useMemo(() => {
    return buildInjectedCode(code, isInspectMode);
  }, [code, isInspectMode, refreshKey]);

  // Determine viewport styles based on deviceMode
  const getDeviceStyles = () => {
    switch (deviceMode) {
      case 'mobile':
        return 'w-[375px] h-[720px] rounded-[36px] border-8 border-slate-800 shadow-2xl overflow-hidden';
      case 'tablet':
        return 'w-[768px] h-[86%] rounded-2xl border-8 border-slate-800 shadow-2xl overflow-hidden';
      case 'desktop':
      default:
        return 'w-full h-full rounded-none border-0';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden relative">
      {/* Mock Browser Bar */}
      <div className="h-10 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0 select-none text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
          </div>

          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="p-1 hover:text-white rounded hover:bg-slate-800 transition"
            title={language === 'ar' ? 'إعادة تحميل' : 'Reload'}
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Address Bar */}
        <div className="flex-1 max-w-md mx-4 bg-slate-950 px-3 py-1 rounded-md border border-slate-800 text-center font-mono text-[11px] text-slate-300 flex items-center justify-between">
          <span className="text-emerald-400 text-xs">🔒</span>
          <span className="truncate">https://ibnili-preview.dev/live-app</span>
          <button
            onClick={handleCopyLink}
            className="text-slate-500 hover:text-slate-300 transition"
            title={language === 'ar' ? 'نسخ الرابط' : 'Copy link'}
          >
            {copiedUrl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>

        {/* Right tools: Console Drawer & Popout */}
        <div className="flex items-center gap-2">
          {isInspectMode && (
            <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-semibold px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1">
              <MousePointerClick className="w-3 h-3" />
              <span>{language === 'ar' ? 'انقر على أي عنصر' : 'Click any element'}</span>
            </span>
          )}

          <button
            onClick={() => setShowConsole((v) => !v)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition ${
              showConsole ? 'bg-slate-800 text-white' : 'hover:text-white hover:bg-slate-800'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Console</span>
            {consoleLogs.length > 0 && (
              <span className="bg-slate-700 text-slate-200 text-[10px] px-1 rounded-full">
                {consoleLogs.length}
              </span>
            )}
          </button>

          <button
            onClick={handleOpenNewTab}
            className="p-1 hover:text-white rounded hover:bg-slate-800 transition"
            title={language === 'ar' ? 'فتح في نافذة جديدة' : 'Open in new tab'}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Device Viewport Container */}
      <div className="flex-1 flex items-center justify-center p-2 sm:p-4 bg-slate-950 overflow-hidden relative">
        <div className={`transition-all duration-300 bg-white ${getDeviceStyles()} relative shadow-2xl`}>
          <iframe
            key={refreshKey}
            ref={iframeRef}
            srcDoc={injectedHtml}
            title="Lovable Application Preview"
            className="w-full h-full border-0 bg-white"
            sandbox="allow-scripts allow-forms allow-modals"
          />

          {/* Watermark Notice for Free Tier */}
          {subscriptionTier === 'free' && (
            <div className="absolute bottom-2.5 right-2.5 z-30 flex items-center gap-2 bg-slate-950/90 border border-slate-700/80 shadow-2xl px-2.5 py-1.5 rounded-xl text-[10px] sm:text-[11px] backdrop-blur-md">
              <span className="text-slate-300 font-medium">
                {language === 'ar' ? 'العلامة المائية نشطة: صنع بواسطة إبنيلي AI' : 'Watermark Active: Made with Ebnili AI'}
              </span>
              {onOpenSubscription && (
                <button
                  onClick={onOpenSubscription}
                  className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 underline decoration-amber-500/50 cursor-pointer ml-1"
                >
                  <Crown className="w-3 h-3 text-amber-400" />
                  <span>{language === 'ar' ? 'إزالة العلامة (ترقية)' : 'Remove watermark'}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Console Drawer */}
      {showConsole && (
        <div className="h-44 bg-slate-900 border-t border-slate-800 flex flex-col shrink-0 select-text text-xs">
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950 border-b border-slate-800 text-[11px] text-slate-400">
            <span className="font-semibold flex items-center gap-1 text-slate-300">
              <Terminal className="w-3 h-3 text-rose-400" />
              <span>Preview Logs ({consoleLogs.length})</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setConsoleLogs([])}
                className="hover:text-white text-[10px] underline"
              >
                Clear
              </button>
              <button
                onClick={() => setShowConsole(false)}
                className="hover:text-white text-xs px-1"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 font-mono space-y-1">
            {consoleLogs.length === 0 ? (
              <div className="text-slate-500 text-[11px] py-4 text-center">
                No errors or warnings recorded. Ready.
              </div>
            ) : (
              consoleLogs.map((log) => (
                <div
                  key={log.id}
                  className={`flex items-start gap-2 text-[11px] ${
                    log.type === 'error'
                      ? 'text-rose-400 bg-rose-500/10 p-1 rounded'
                      : log.type === 'warn'
                      ? 'text-amber-400'
                      : 'text-slate-300'
                  }`}
                >
                  <span className="text-slate-500 shrink-0">[{log.time}]</span>
                  <span className="break-all">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
