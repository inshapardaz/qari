// tsc (moduleResolution: "bundler") emits relative import/export specifiers
// without file extensions, which Node's native ESM resolver rejects at
// runtime. This rewrites emitted specifiers in dist/**/*.js to point at the
// concrete .js file or directory index, so the published package works for
// consumers that don't run it through a bundler.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');

const SPECIFIER_RE = /(import\(\s*|(?:import|export)(?:[\s\S]*?\bfrom)?\s+)(['"])(\.\.?\/[^'"]+)\2/g;

function resolveSpecifier(fileDir, specifier) {
  const abs = path.resolve(fileDir, specifier);
  if (existsSync(`${abs}.js`)) return `${specifier}.js`;
  if (existsSync(path.join(abs, 'index.js'))) {
    return `${specifier.replace(/\/$/, '')}/index.js`;
  }
  throw new Error(`Cannot resolve relative specifier "${specifier}" from ${fileDir}`);
}

const entries = await readdir(distDir, { recursive: true, withFileTypes: true });
const jsFiles = entries.filter((e) => e.isFile() && e.name.endsWith('.js'));

for (const entry of jsFiles) {
  const filePath = path.join(entry.parentPath ?? entry.path, entry.name);
  const fileDir = path.dirname(filePath);
  const original = await readFile(filePath, 'utf8');

  const updated = original.replace(SPECIFIER_RE, (match, prefix, quote, specifier) => {
    if (/\.[a-z]+$/i.test(specifier)) return match;
    return `${prefix}${quote}${resolveSpecifier(fileDir, specifier)}${quote}`;
  });

  if (updated !== original) {
    await writeFile(filePath, updated, 'utf8');
  }
}
