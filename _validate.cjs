// Validate: type-check the whole project, then run the security test suite.
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const log = [];
function run(cmd) {
  try {
    const out = execSync(cmd, { cwd: __dirname, stdio: 'pipe', encoding: 'utf8', timeout: 240000 });
    log.push('=== OK: ' + cmd + ' ===');
    log.push(out.split('\n').slice(-60).join('\n'));
    return true;
  } catch (e) {
    log.push('=== FAIL: ' + cmd + ' ===');
    log.push((e.stdout || '') + (e.stderr || ''));
    return false;
  }
}
run('npx tsc --noEmit');
run('node --experimental-strip-types --test tests/*.test.ts');
fs.writeFileSync('_validate_out.txt', log.join('\n\n'));
console.log('DONE');


