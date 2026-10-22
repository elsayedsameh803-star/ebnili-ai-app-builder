import { readFileSync, writeFileSync } from 'fs';
const f = 'c:\\Users\\Fast\\OneDrive\\Desktop\\ebnily\\src\\components\\GitHubImporter.tsx';
const lines = readFileSync(f, 'utf8').split('\n');
const slice = lines.slice(92, 135).map((l, i) => `${93 + i}: ${l}`).join('\n');
writeFileSync('c:\\Users\\Fast\\OneDrive\\Desktop\\ebnily\\_imp.txt', slice + '\n');
console.log('WROTE', slice.length, 'chars');
