const fs = require('fs');
const p = 'c:/Users/Fast/OneDrive/Desktop/ebnily/.env';
let raw = fs.readFileSync(p, 'utf8');
// Replace the malformed trailing ALLOWED_ORIGINS value (with or without quotes/commas)
raw = raw.replace(/ALLOWED_ORIGINS\s*=\s*["']?\s*,?\s*["']?\s*$/m, 'ALLOWED_ORIGINS=https://ebnily.vercel.app');
if (!raw.endsWith('\n')) raw += '\n';
fs.writeFileSync(p, raw);
console.log('LAST LINE NOW:', JSON.stringify(raw.split(/\r?\n/).slice(-3)));
