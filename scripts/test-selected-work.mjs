import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const home = read('index.html');
const section = home.match(/<!-- SELECTED-WORK:START -->([\s\S]*?)<!-- SELECTED-WORK:END -->/)[1];
assert.equal((section.match(/class="sw-card"/g) || []).length, 4);
assert(home.indexOf('id="selected-work"') > home.indexOf('class="intro"'));
assert(home.indexOf('id="selected-work"') < home.indexOf('class="identity"'));
assert.equal((home.match(/id="selected-work"/g) || []).length, 1);

const slugs = ['voice-interview-agent', 'booking-partner-platform', 'carez-ai', 'gtm-workflow-engine'];
const pages = slugs.map(slug => `work/${slug}/index.html`);
for (const path of pages) {
  const html = read(path);
  assert.equal((html.match(/<h1>/g) || []).length, 1, path);
  assert.equal((html.match(/class="case-section"/g) || []).length, 6, path);
  assert(html.includes('Evidence to add'), path);
  assert(html.includes('name="robots" content="noindex"'), path);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, `Duplicate IDs: ${path}`);
  for (const [, ref] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (/^(https?:|mailto:|data:)/.test(ref)) continue;
    const [file, fragment] = ref.split('#');
    if (file) assert(existsSync(resolve(root, dirname(path), file.split('?')[0])), `Missing target ${ref} in ${path}`);
    else if (fragment) assert(ids.includes(fragment), `Missing anchor ${ref} in ${path}`);
  }
}
for (const slug of slugs.filter(slug => slug !== 'carez-ai')) {
  assert(read(`work/${slug}/index.html`).includes('Demo reconstruction'));
}
assert(!section.includes('codex-clipboard'), 'Reference images must not become project evidence');
assert(section.includes('$500K+ ARR'));
assert(!section.includes('142'), 'No sample metrics copied from design references');

const button = { hidden: true, attributes: {}, setAttribute(name, value) { this.attributes[name] = value; }, addEventListener(event, fn) { this.click = fn; } };
const document = { documentElement: { dataset: { theme: 'dark' } }, querySelector: () => button };
runInNewContext(read('assets/case-study.js'), { document });
assert.equal(button.hidden, false);
button.click();
assert.equal(document.documentElement.dataset.theme, 'light');
assert.equal(button.attributes['aria-label'], 'Switch to dark theme');
button.click();
assert.equal(document.documentElement.dataset.theme, 'dark');
assert.equal(button.attributes['aria-label'], 'Switch to light theme');

const before = pages.map(read);
execFileSync(process.execPath, [resolve(root, 'scripts/build-selected-work.mjs')]);
assert.equal(read('index.html'), home, 'Homepage generation must be idempotent');
pages.forEach((path, i) => assert.equal(read(path), before[i], `Non-deterministic page: ${path}`));

const baselinePath = process.argv[2];
if (baselinePath) {
  const baseline = readFileSync(baselinePath, 'utf8');
  for (const id of ['legacy-carez', 'legacy-spendlens']) {
    const pattern = new RegExp(`<template id="${id}">[\\s\\S]*?<\\/template>`);
    assert.equal(home.match(pattern)?.[0], baseline.match(pattern)?.[0], `Existing ${id} demo changed`);
  }
  for (const id of ['work', 'elsewhere']) {
    const pattern = new RegExp(`<section[^>]*id="${id}"[^>]*>[\\s\\S]*?<\\/section>`);
    assert.equal(home.match(pattern)?.[0], baseline.match(pattern)?.[0], `Existing ${id} mount changed`);
  }
}
console.log('PASS: four case studies, six sections each, valid local links, evidence labels, theme toggle, idempotent build, and original demo mounts.');
