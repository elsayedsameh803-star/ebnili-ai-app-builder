import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Application-level error boundary — guarantees the studio never shows a blank
 * white screen. Any uncaught render/lifecycle error is replaced with a
 * professional, bilingual recovery screen (Arabic default, English subtitle).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[Ebnili] Uncaught application error:', error, errorInfo.componentStack);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        dir="rtl"
        className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6"
      >
        <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center text-white shadow-xl shadow-rose-500/20 mb-5">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <h1 className="text-xl font-extrabold text-white mb-2">حدث خطأ غير متوقع</h1>
          <p className="text-sm text-slate-400 leading-relaxed mb-1">
            عذراً، واجهنا خطأً داخل الاستوديو. لا تقلق — مشروعك المحفوظ في المعاينة لم يتأثر.
          </p>
          <p className="text-xs text-slate-500 leading-relaxed mb-6" lang="en">
            Something went wrong inside the studio. Your project is safe — try again or reload.
          </p>

          {this.state.error && (
            <details className="mb-6 text-right">
              <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300 transition select-none">
                تفاصيل تقنية (للمطوّرين)
              </summary>
              <pre
                dir="ltr"
                className="mt-3 max-h-40 overflow-auto rounded-xl bg-slate-950 border border-slate-800 p-3 text-[11px] font-mono text-rose-400 whitespace-pre-wrap text-left"
              >
                {this.state.error.message || String(this.state.error)}
              </pre>
            </details>
          )}

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition shadow-lg shadow-indigo-600/20"
            >
              <RotateCcw className="w-4 h-4" />
              إعادة المحاولة
            </button>
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold transition border border-slate-700"
            >
              إعادة تحميل الصفحة
            </button>
          </div>
        </div>
      </div>
    );
  }
}