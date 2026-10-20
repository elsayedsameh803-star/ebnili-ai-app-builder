import { GitHubImporter } from './GitHubImporter';
import type { AuthUser, Language } from '../types';

interface GitHubImportModalProps {
  language: Language;
  authUser?: AuthUser | null;
  onClose: () => void;
  onImported?: (files: Record<string, string>) => void;
}

export const GitHubImportModal = ({ language, authUser, onClose, onImported }: GitHubImportModalProps) => {
  void authUser;
  void onImported;
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <button type="button" aria-label="close" onClick={onClose} className="absolute inset-0 bg-black/70" />
      <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <GitHubImporter language={language} />
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm font-bold hover:bg-slate-800 transition"
        >
          {language === 'ar' ? 'إغلاق' : 'Close'}
        </button>
      </div>
    </div>
  );
};
