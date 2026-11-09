// يجمع ما يحتاجه تطبيق أندرويد في www/، ويكتب bundle.json ببصمة المحتوى.
// يقارن التطبيق هذه البصمة بآخر حزمة منشورة ليعرف أن عنده تحديثاً (js/native.js).
// عامل الخدمة خارجها: لا يعمل داخل التطبيق.
import { rmSync, mkdirSync, cpSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const OUT = 'www';
const ITEMS = ['index.html', 'manifest.webmanifest', 'css', 'fonts', 'icons', 'js'];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
for (const f of ITEMS) cpSync(f, `${OUT}/${f}`, { recursive: true, filter: p => !p.endsWith('.DS_Store') });

const files = readdirSync(OUT, { recursive: true, withFileTypes: true })
  .filter(e => e.isFile())
  .map(e => `${e.parentPath}/${e.name}`)
  .sort();
const h = createHash('sha256');
for (const f of files) { h.update(f.slice(OUT.length + 1)); h.update(readFileSync(f)); }
const id = h.digest('hex').slice(0, 12);
writeFileSync(`${OUT}/bundle.json`, JSON.stringify({ id }) + '\n');
console.log(`www/ جاهز: ${files.length} ملفاً، والحزمة ${id}`);
