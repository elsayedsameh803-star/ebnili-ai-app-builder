import { Language } from '../types';

interface GitHubImportModalProps {
  onClose: () => void;
  language: Language;
  /** No-op after GitHub import was removed. */
  onImported?: (result: { files: Record<string, string> }) => void;
  /** No-op after GitHub import was removed. */
  initialError?: string | null;
}

/**
 * GitHub import modal — retired (replaced by Supabase OAuth).
 * Kept as a no-op stub so nothing referencing it breaks at build time.
 */
export const GitHubImportModal = ({
  onClose,
  language,
  onImported,
  initialError,
}: GitHubImportModalProps) => {
  onClose?.();
  return null;
};
