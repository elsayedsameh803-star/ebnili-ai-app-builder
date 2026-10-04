/**
 * Deployment commands — everything the visitor needs to build, publish and
 * version a generated project, as text they can copy and run on their OWN
 * machine.
 *
 * WHY COPY-ONLY, AND NOT A REAL TERMINAL
 * --------------------------------------
 * The obvious feature is "run these commands on the server". It must not be
 * built. These projects are arbitrary user-supplied archives, and a shell on
 * a Vercel function is not a sandbox — `child_process.exec` would hand the
 * caller the whole runtime: the database URL, the S3 token, every
 * `process.env` secret the owner configured. A single crafted filename in an
 * upload would be remote code execution with the owner's privileges.
 *
 * So the boundary is drawn here, in the product: this module only ever
 * PRODUCES TEXT. The visitor copies it into a terminal they control. The
 * platform never touches their files and never learns their credentials.
 *
 * SECURITY — why these strings are built, not interpolated
 * ---------------------------------------------------------
 * `projectName` is attacker-controlled (it is whatever the account typed) and
 * lands inside a shell command line. If it can carry `;` or `&&` or a newline,
 * a project called `my site; rm -rf ~` becomes a command the visitor pastes
 * and runs. Every value that reaches a command therefore goes through
 * `shellToken()`, which rejects anything that is not a plain filename — so a
 * hostile name degrades to a safe placeholder instead of becoming an injection.
 */

export type DeployProvider = 'vercel' | 'netlify' | 'github';

/** A single named command the visitor can copy. */
export interface CommandEntry {
  id: string;
  title: string;
  titleAr: string;
  /** The literal text placed in the terminal. */
  command: string;
  /** One-line explanation of what it does and what it needs. */
  note: string;
  noteAr: string;
  /** Set when the command cannot be produced (e.g. no repo URL yet). */
  blockedReason?: string;
  blockedReasonAr?: string;
}


/**
 * A value safe to paste into a shell command line.
 *
 * Allows letters, digits, dot, dash, underscore and slash — everything a real
 * folder name needs — and refuses everything else. Refusing (rather than
 * escaping) is deliberate: `slugify()` already produced a clean token, so
 * anything else means the input was hostile, and the safest thing to do with
 * hostile input in a shell command is to not run it at all.
 */
export function shellToken(raw: string, fallback = 'my-app'): string {
  const value = String(raw ?? '').trim();
  if (!value) return fallback;
  // A leading dash would be read as a flag by git/zip, so it is refused.
  if (value.startsWith('-')) return fallback;
  if (!/^[A-Za-z0-9._/-]+$/.test(value)) return fallback;
  // Traversal is pointless in a name and dangerous if a path ever joins it.
  if (value.includes('..')) return fallback;
  return value;
}

/**
 * A repository slug typed by the visitor, used for the GitHub remote URL.
 *
 * Stricter than `shellToken`: this value is embedded in a URL as well as a
 * command, so it is limited to `owner/repo` and checked segment by segment.
 */
export function safeRepoSlug(raw: string): string | null {
  const value = String(raw ?? '')
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '');
  const match = /^([A-Za-z0-9][A-Za-z0-9._-]{0,38})\/([A-Za-z0-9._-]{1,100})$/.exec(value);
  if (!match) return null;
  const owner = match[1];
  const repo = match[2];
  if (repo === '.' || repo === '..' || repo.includes('..')) return null;
  return `${owner}/${repo}`;
}

export interface CommandBundle {
  local: CommandEntry[];
  build: CommandEntry[];
  deploy: CommandEntry[];
  git: CommandEntry[];
  /** The whole flow end to end, as one pasteable script. */
  allScript: string;
}

/**
 * Build every command for one project.
 *
 * @param projectName  the account's project name (untrusted — see the header)
 * @param provider     which host to show deploy commands for
 * @param repoSlug     optional `owner/repo`; produces exact git commands
 */
export function buildCommandBundle(
  projectName: string,
  provider: DeployProvider = 'vercel',
  repoSlug = '',
): CommandBundle {
  const dir = shellToken(projectName);

  const local: CommandEntry[] = [
    {
      id: 'unzip',
      title: 'Unzip the downloaded project',
      titleAr: 'فكّ ضغط المشروع المُنزَّل',
      command: `unzip ${dir}.zip && cd ${dir}`,
      note: 'Extracts the archive and moves into the project folder.',
      noteAr: 'يفكّ ضغط الملف ويفتح مجلد المشروع.',
    },
    {
      id: 'install',
      title: 'Install dependencies',
      titleAr: 'تثبيت الحزم',
      command: 'npm install',
      note: 'Requires Node.js 18 or newer.',
      noteAr: 'يتطلب Node.js 18 أو أحدث.',
    },
    {
      id: 'dev',
      title: 'Start the local dev server',
      titleAr: 'تشغيل سيرفر التطوير',
      command: 'npm run dev',
      note: 'Opens on http://localhost:3000 with hot reload.',
      noteAr: 'يفتح على http://localhost:3000 مع تحديث فوري.',
    },
  ];

  const build: CommandEntry[] = [
    {
      id: 'build',
      title: 'Build for production',
      titleAr: 'بناء نسخة الإنتاج',
      command: 'npm run build',
      note: 'Writes the optimised site into dist/.',
      noteAr: 'ينتج الموقع المُحسَّن داخل مجلد dist/.',
    },
    {
      id: 'preview',
      title: 'Preview the production build',
      titleAr: 'معاينة نسخة الإنتاج',
      command: 'npm run preview',
      note: 'Serves dist/ locally exactly as the host will.',
      noteAr: 'يشغّل dist/ محلياً تماماً كما سيعمل على الخادم.',
    },
  ];

  const git: CommandEntry[] = [
    {
      id: 'git-init',
      title: 'Create a git repository',
      titleAr: 'إنشاء مستودع git',
      command: 'git init && git add .',
      note: 'Stages every file so the first commit is complete.',
      noteAr: 'يجهّز كل الملفات لالتزامن الأول.',
    },
    {
      id: 'git-commit',
      title: 'Make the first commit',
      titleAr: 'إنشاء أول التزام (commit)',
      command: 'git commit -m "Initial commit"',
      note: 'Set a global git identity first if the terminal complains.',
      noteAr: 'إذا اشتكى الطرفية، أضف هويتك في git أولاً.',
    },
  ];

  // Without a real repo the remote command still has to be shown — otherwise
  // the visitor sees no push step at all — but it is marked as a placeholder
  // instead of pretending a command that would fail is ready to run.
  const repo = safeRepoSlug(repoSlug);
  if (repo) {
    git.push(
      {
        id: 'git-remote',
        title: 'Connect your GitHub repository',
        titleAr: 'ربط مستودع GitHub',
        command: `git remote add origin https://github.com/${repo}.git`,
        note: 'Runs once per machine. Edit the address if the repo is elsewhere.',
        noteAr: 'تُنفَّذ مرة واحدة. عدّل العنوان إذا كان المستودع في مكان آخر.',
      },
      {
        id: 'git-push',
        title: 'Push to GitHub',
        titleAr: 'الدفع (push) إلى GitHub',
        command: 'git branch -M main && git push -u origin main',
        note: 'After this, every later deploy is simply: git push',
        noteAr: 'بعدها كل نشر جديد يكون ببساطة: git push',
      },
    );
  } else {
    git.push({
      id: 'git-remote',
      title: 'Connect your GitHub repository',
      titleAr: 'ربط مستودع GitHub',
      command: 'git remote add origin https://github.com/OWNER/REPO.git',
      note: 'Replace OWNER and REPO with your own account and repository.',
      noteAr: 'استبدل OWNER و REPO بحسابك ومستودعك.',
      blockedReason: 'Enter your GitHub owner/repo above to generate the exact command.',
      blockedReasonAr: 'اكتب اسم حسابك ومستودعك بالأعلى لإنشاء الأمر الصحيح.',
    });
  }

  const isNetlify = provider === 'netlify';
  const deploy: CommandEntry[] = [
    {
      id: 'deploy',
      title: isNetlify ? 'Deploy to Netlify' : 'Deploy to Vercel',
      titleAr: isNetlify ? 'النشر على Netlify' : 'النشر على Vercel',
      command: isNetlify ? 'npx netlify deploy --prod --dir=dist' : 'npx vercel --prod',
      note: isNetlify
        ? 'One-time browser login, then publishes dist/.'
        : 'One-time browser login, then publishes the project.',
      noteAr: isNetlify
        ? 'تسجيل دخول مرة واحدة عبر المتصفح، ثم ينشر dist/.'
        : 'تسجيل دخول مرة واحدة عبر المتصفح، ثم ينشر المشروع.',
    },
  ];

  const allScript = [
    '# 1) local setup',
    local[0].command,
    local[1].command,
    '',
    '# 2) production build',
    build[0].command,
    '',
    '# 3) version control',
    ...git.map((entry) => entry.command),
    '',
    '# 4) deploy',
    deploy[0].command,
    '',
  ].join('\n');

  return { local, build, git, deploy, allScript };
}

