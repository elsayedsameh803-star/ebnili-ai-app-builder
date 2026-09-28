import type { AppProject, ChatMessage } from '../types';

/**
 * REAL PROJECT STORE (multi-project, local-first)
 * ────────────────────────────────────────────
 * Before this there was exactly one implicit project living in a single
 * localStorage key: starting a second site silently overwrote the first, and the
 * header's project list could never be populated. This is a small, honest
 * database on the user's own device:
 *
 *   ebnili_projects_index_v1   → the list (id, name, timestamps…)
 *   ebnili_project_<id>        → one full project + its chat
 *   ebnili_active_project_v1   → which one to reopen
 *
 * DESIGN NOTES
 *  • The index is stored separately from the bodies so listing/sorting never has
 *    to parse megabytes of HTML.
 *  • localStorage is ~5MB and a generated site is 50–150KB, so a save can hit
 *    the quota. `saveProject` prunes the least recently used project and retries
 *    rather than losing the work in front of the user.
 *  • Every function is defensive: private mode, disabled storage and corrupt
 *    JSON all degrade to "no projects" instead of breaking the studio.
 */

export interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  /** Plain-text excerpt of the document, used for the list preview. */
  preview: string;
  chatCount: number;
  versionCount: number;
  /** True once the project holds real generated output (not the placeholder). */
  hasContent: boolean;
}

export interface StoredProject {
  project: AppProject;
  chatMessages: ChatMessage[];
}

const INDEX_KEY = 'ebnili_projects_index_v1';
const BODY_PREFIX = 'ebnili_project_';
const ACTIVE_KEY = 'ebnili_active_project_v1';
/** A project is "real" once its document is bigger than the start placeholder. */
const MIN_CONTENT_CHARS = 400;

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

/** localStorage access can throw outright in some privacy modes. */
function readItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeItem(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeItem(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* nothing to do */
  }
}

/** Strip tags so the list preview reads as text, not markup. */
function toPreview(code: string): string {
  const text = (code || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, 160);
}

export function hasRealContent(code: string): boolean {
  const t = (code || '').trim();
  if (t.length < MIN_CONTENT_CHARS) return false;
  // The untouched starter says "ابدأ مشروعك" — that is not saved content.
  return !/ابدأ مشروعك/.test(t);
}

export function newProjectId(): string {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function listProjects(): ProjectSummary[] {
  const index = safeParse<ProjectSummary[]>(readItem(INDEX_KEY), []);
  if (!Array.isArray(index)) return [];
  return index
    .filter((p) => p && typeof p.id === 'string')
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

function writeIndex(index: ProjectSummary[]): boolean {
  return writeItem(INDEX_KEY, JSON.stringify(index));
}

/** Oldest first; the caller decides how many to keep. */
function leastRecentlyUsedFirst(index: ProjectSummary[]): ProjectSummary[] {
  return [...index].sort((a, b) => (a.updatedAt || '').localeCompare(b.updatedAt || ''));
}

export function saveProject(
  id: string,
  project: AppProject,
  chatMessages: ChatMessage[],
): ProjectSummary {
  const body = JSON.stringify({ project, chatMessages } satisfies StoredProject);

  // Quota handling: drop the oldest OTHER project and retry, so the work in
  // front of the user is never the thing that fails.
  let ok = writeItem(BODY_PREFIX + id, body);
  if (!ok) {
    const victims = leastRecentlyUsedFirst(listProjects()).filter((p) => p.id !== id);
    for (const victim of victims) {
      removeItem(BODY_PREFIX + victim.id);
      if (writeItem(BODY_PREFIX + id, body)) {
        ok = true;
        break;
      }
    }
  }

  const summary: ProjectSummary = {
    id,
    name: project.name || 'مشروع بدون اسم',
    description: project.description || '',
    createdAt: project.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    preview: toPreview(project.code),
    chatCount: chatMessages.length,
    versionCount: project.versions?.length ?? 0,
    hasContent: hasRealContent(project.code),
  };

  const index = listProjects().filter((p) => p.id !== id);
  index.unshift(summary);
  writeIndex(index);
  return summary;
}

export function loadProject(id: string): StoredProject | null {
  const raw = readItem(BODY_PREFIX + id);
  if (!raw) return null;
  const stored = safeParse<StoredProject | null>(raw, null);
  return stored?.project ? stored : null;
}

export function deleteProject(id: string): void {
  removeItem(BODY_PREFIX + id);
  writeIndex(listProjects().filter((p) => p.id !== id));
  if (getActiveId() === id) setActiveId(null);
}

export function renameProject(id: string, name: string): void {
  const index = listProjects();
  const target = index.find((p) => p.id === id);
  if (!target) return;
  target.name = name;
  target.updatedAt = new Date().toISOString();
  writeIndex(index);

  const stored = loadProject(id);
  if (stored) {
    stored.project.name = name;
    writeItem(BODY_PREFIX + id, JSON.stringify(stored));
  }
}

export function getActiveId(): string | null {
  return readItem(ACTIVE_KEY);
}

export function setActiveId(id: string | null): void {
  if (id) writeItem(ACTIVE_KEY, id);
  else removeItem(ACTIVE_KEY);
}

/** Total bytes used by the store, for the projects panel. */
export function storageUsedBytes(): number {
  let total = 0;
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key || (!key.startsWith(BODY_PREFIX) && key !== INDEX_KEY)) continue;
    total += key.length + (window.localStorage.getItem(key)?.length ?? 0);
  }
  return total * 2; // UTF-16 code units
}

