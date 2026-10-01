import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

/**
 * A keyboard user arriving in the studio would otherwise have to Tab through the
 * entire header — every device switcher, view toggle and icon button — before
 * reaching the chat or the preview. The link is visually hidden until focused,
 * so it costs sighted users nothing.
 */
function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-[300] focus:px-4 focus:py-2 focus:rounded-xl focus:bg-rose-600 focus:text-white focus:text-sm focus:font-bold"
    >
      تخطَّ إلى المحتوى
    </a>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <SkipLink />
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
