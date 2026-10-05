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
  /** True while the AI is still streaming the document into this frame. */
  isStreaming?: boolean;
}

export const PreviewFrame = ({
  code,
  deviceMode,
  isInspectMode,
  onElementSelect,
  language,
  subscriptionTier = 'free',
  onOpenSubscription,
  isStreaming = false,
}: PreviewFrameProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([]);
  const [showConsole, setShowConsole] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Listen for messages from inside the preview iframe.
  //
  // SECURITY: this handler used to accept ANY message from ANY window. A
  // `message` event with no origin or source check is a free channel into the
  // app: any tab, opener or embedded frame the user has open can post
  // `LOVABLE_ELEMENT_SELECTED` and drive the inspector, or flood the console
  // drawer with fake output.
  //
  // `e.source` is the check that actually matters here. The frame is rendered
  // with `sandbox` and no `allow-same-origin`, so its origin is the OPAQUE
  // string "null" — comparing `e.origin` against our own origin would therefore
  // reject every legitimate message. Comparing the window identity accepts only
  // our own frame and nothing else.
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      // Only ever our own preview frame.
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow) return;
      if (!e.data || typeof e.data !== 'object') return;

      if (e.data.type === 'LOVABLE_ELEMENT_SELECTED') {
        onElementSelect(e.data.elementInfo);
      } else if (e.data.type === 'LOVABLE_CONSOLE_LOG') {
        setConsoleLogs((prev) => [
          ...prev.slice(-49), // keep last 50 logs
          {
            id: String(Date.now() + Math.random()),
            type: e.data.logType || 'log',
            message: typeof e.data.message === 'string' ? e.data.message.slice(0, 2000) : '',
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

    // SECURITY: the injected bridge used to post every message with targetOrigin
    // `'*'`, which tells the browser "deliver this to whatever window is the
    // parent" with no check on the receiving side. If this document is ever
    // opened directly (the "open in new tab" button), or embedded somewhere
    // unexpected, its logs and element data go anywhere.
    //
    // The parent origin is baked in at injection time and used as the explicit
    // target, so the browser delivers only if the parent really is our app.
    // JSON.stringify keeps it a safely-quoted string literal.
    const parentOrigin = JSON.stringify(window.location.origin);

    const injection = `
      <script>
        (function() {
          var PARENT_ORIGIN = ${parentOrigin};
          function securePost(payload) {
            try { window.parent.postMessage(payload, PARENT_ORIGIN); }
            catch (e) { /* closed or opaque parent — never break the page */ }
          }

          // Intercept Console
          const originalLog = console.log;
          const originalWarn = console.warn;
          const originalError = console.error;

          console.log = function(...args) {
            originalLog.apply(console, args);
            securePost({
              type: 'LOVABLE_CONSOLE_LOG',
              logType: 'log',
              message: args.map(a => {
                try {
                  return typeof a === 'object' ? JSON.stringify(a) : String(a);
                } catch (e) {
                  // A circular object must not throw inside the user's console.
                  return '[unserialisable]';
                }
              }).join(' ').slice(0, 2000)
            });
          };
          console.warn = function(...args) {
            originalWarn.apply(console, args);
            securePost({
              type: 'LOVABLE_CONSOLE_LOG',
              logType: 'warn',
              message: args.map(a => {
                try {
                  return typeof a === 'object' ? JSON.stringify(a) : String(a);
                } catch (e) {
                  return '[unserialisable]';
                }
              }).join(' ').slice(0, 2000)
            });
          };
          console.error = function(...args) {
            originalError.apply(console, args);
            securePost({
              type: 'LOVABLE_CONSOLE_LOG',
              logType: 'error',
              message: args.map(a => {
                try {
                  return typeof a === 'object' ? JSON.stringify(a) : String(a);
                } catch (e) {
                  return '[unserialisable]';
                }
              }).join(' ').slice(0, 2000)
            });
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

              securePost({
                type: 'LOVABLE_ELEMENT_SELECTED',
                elementInfo: {
                  tagName,
                  text,
                  className,
                  selector
                }
              });
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
  //
  // WHY A PHONE ALWAYS SHOWS THE SITE AT FULL WIDTH
  // ------------------------------------------------
  // The mobile frame used to carry `w-[375px] h-[720px] border-4 rounded-[24px]`
  // — a picture of a phone. Inside a real phone that frame is WIDER than the
  // screen, so `max-w-full` clipped it and the visitor saw a sliver of a page
  // squeezed into the left edge, with dead space beside it. That reads as "the
  // preview is broken", which is exactly what was reported.
  //
  // The fix is to drop the mock frame on a phone and let the frame fill the
  // space, because on a phone the phone IS the frame. `max-sm:` keeps the
  // device mock for tablet/desktop widths, where it is still useful.
  //
  // `dvh` is used for the height because `100vh` on mobile browsers includes the
  // collapsing URL bar, which is what pushed the bottom of the page off-screen.
  const isNarrow = typeof window !== 'undefined' && window.innerWidth < 640;
  const getDeviceStyles = () => {
    switch (deviceMode) {
      case 'mobile':
        return isNarrow
          ? 'w-full h-full max-sm:rounded-none max-sm:border-0 bg-white'
          : 'w-[375px] max-w-full h-[720px] max-h-full rounded-[24px] sm:rounded-[36px] border-4 sm:border-8 border-slate-800 shadow-2xl overflow-hidden';
      case 'tablet':
        return isNarrow
          ? 'w-full h-full max-sm:rounded-none max-sm:border-0 bg-white'
          : 'w-[768px] max-w-full h-[86%] max-h-full rounded-xl sm:rounded-2xl border-4 sm:border-8 border-slate-800 shadow-2xl overflow-hidden';
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
        {/* Address Bar — hidden on phones: the mock chrome around it is wider
            than a 375px screen, and every pixel belongs to the preview. */}
        <div className="hidden sm:flex flex-1 max-w-md mx-4 bg-slate-950 px-3 py-1 rounded-md border border-slate-800 text-center font-mono text-[11px] text-slate-300 items-center justify-between">
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

          {/* Live "writing" ribbon over the preview while tokens stream in. */}
          {isStreaming && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-slate-950/90 border border-rose-500/40 shadow-2xl px-3 py-1.5 rounded-full text-[11px] font-bold text-rose-200 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
              <span>{language === 'ar' ? 'يكتب الموقع الآن…' : 'Building your site…'}</span>
            </div>
          )}

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
