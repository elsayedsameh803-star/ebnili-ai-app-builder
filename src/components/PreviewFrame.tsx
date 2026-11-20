import { useRef, useEffect, useState, useMemo } from 'react';
import { RotateCw, ExternalLink, Terminal, MousePointerClick, Crown, X } from 'lucide-react';
import { DeviceMode, ConsoleLog, SelectedElementInfo, Language } from '../types';
import { stripCodeForDisplay } from '../lib/projects';
import { PublishButton } from './PublishButton';

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
  /** The project id, so the Publish button can publish the real project. */
  projectId?: string | null;
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
  projectId = null,
}: PreviewFrameProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([]);
  const [showConsole, setShowConsole] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isPinned, setIsPinned] = useState(false);

  // REACTIVE narrow flag.
  const [isNarrow, setIsNarrow] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth < 640,
  );

  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 640);
    onResize();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  // Listen for messages from inside the preview iframe.
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow) return;
      if (!e.data || typeof e.data !== 'object') return;
      if (!e.data.code && !e.data.html) return;
      // ... rest of the message handling
    };

    if (iframeRef.current) {
      iframeRef.current.contentWindow.addEventListener('message', handleMessage);
    }
    return () => {
      if (iframeRef.current) {
        iframeRef.current.contentWindow.removeEventListener('message', handleMessage);
      }
    };
  }, []);

  return (
    <div className="relative">
      <div className="relative overflow-hidden">
        <iframe
          ref={iframeRef}
          srcDoc={code || ''}
          className="w-full h-full border-0 bg-white"
          sandbox="allow-scripts allow-forms allow-modals"
        />
        {isStreaming && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-slate-950/90 border border-rose-500/40 shadow-2xl px-3 py-1.5 rounded-full text-[11px] font-bold text-rose-200 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
            <span>{language === 'ar' ? 'يكتب الموقع الآن…' : 'Building your site…'}</span>
          </div>
        )}
      </div>

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
                  className="flex items-start gap-2 text-[11px]">
                  <span className="text-slate-500 shrink-0">[{log.time}]</span>
                  <span className="break-all">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="pt-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="p-1 hover:text-white rounded hover:bg-slate-800 transition"
            title={language === 'ar' ? 'إعادة تحميل' : 'Reload'}
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsPinned((p) => !p)}
            className={`p-1 rounded transition-all duration-300 ${isPinned ? 'bg-slate-700 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
            title={isPinned ? (language === 'ar' ? 'إلغاء التثبيت' : 'Unpin') : (language === 'ar' ? 'تثبيت المعاينة' : 'Pin preview')}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
