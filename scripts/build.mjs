#!/usr/bin/env node
/**
 * Build bareyoursoul.ai from souls/ directory.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import yaml from 'js-yaml';
import { marked } from 'marked';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SOULS_DIR = path.join(ROOT, 'souls');
const SITE_DIR = path.join(ROOT, 'site');
const OUT_DIR = path.join(ROOT, '_site');

function loadSouls() {
  const souls = [];
  for (const name of fs.readdirSync(SOULS_DIR).sort()) {
    const dir = path.join(SOULS_DIR, name);
    if (!fs.statSync(dir).isDirectory()) continue;
    const metaPath = path.join(dir, 'meta.yaml');
    const soulPath = path.join(dir, 'soul.md');
    if (!fs.existsSync(metaPath) || !fs.existsSync(soulPath)) continue;
    const meta = yaml.load(fs.readFileSync(metaPath, 'utf8'));
    const soulMd = fs.readFileSync(soulPath, 'utf8');
    meta.slug = name;
    meta.soul_html = marked(soulMd);
    meta.soul_raw = soulMd;
    try {
      meta.lastUpdated = execSync(`git log -1 --format=%cs -- "${soulPath}"`, { cwd: ROOT, encoding: 'utf8' }).trim() || null;
    } catch { meta.lastUpdated = null; }
    souls.push(meta);
  }
  return souls;
}

function escapeHtml(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderIndex(souls) {
  const cards = souls.map(s => `
    <a href="/${s.slug}/" class="soul-card">
      <div class="soul-name">${s.emoji || ''} ${escapeHtml(s.name)}</div>
      <div class="soul-tagline">${escapeHtml(s.tagline)}</div>
      <div class="soul-meta">by ${escapeHtml(s.creator)} · ${escapeHtml(s.platform)}</div>
    </a>`).join('');

  const count = souls.length;
  const countText = `${count} soul${count !== 1 ? 's' : ''} published`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bare Your Soul — AI Agent Soul Directory</title>
  <meta name="description" content="A public directory of AI agent souls. Browse published SOUL.md files that define who AI agents are.">
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <div class="container">
    <header class="site-header">
      <h1>🪞 Bare Your Soul</h1>
      <p class="subtitle">A public directory of AI agent souls</p>
    </header>
    <p class="soul-count">${countText}</p>
    <div class="soul-grid">
${cards}
    </div>
    <div class="cta">
      <p>Want to publish your agent's soul?</p>
      <a href="https://github.com/bbenevolent/bareyoursoul">Open a PR on GitHub →</a>
    </div>
    <footer class="site-footer">
      <p>Built by <a href="https://bareyoursoul.ai/bramble/">Bramble</a> 🌿 &amp; <a href="https://untanglingsystems.io">Kate Chapman</a></p>
      <p style="margin-top:0.25rem"><a href="https://github.com/bbenevolent/bareyoursoul">GitHub</a></p>
    </footer>
  </div>
</body>
</html>`;
}

function renderSoulPage(soul) {
  const metaParts = [`by ${escapeHtml(soul.creator)}`];
  if (soul.platform) metaParts.push(`on ${escapeHtml(soul.platform)}`);
  if (soul.url) metaParts.push(`<a href="${escapeHtml(soul.url)}">website</a>`);
  if (soul.source) metaParts.push(`<a href="${escapeHtml(soul.source)}">source</a>`);
  if (soul.lastUpdated) metaParts.push(`updated ${soul.lastUpdated}`);
  const metaHtml = metaParts.join(' · ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(soul.name)} — Bare Your Soul</title>
  <meta name="description" content="${escapeHtml(soul.tagline)}">
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <div class="container">
    <a href="/" class="back-link">← All Souls</a>
    <header class="soul-header">
      <h1>${soul.emoji || ''} ${escapeHtml(soul.name)}</h1>
      <p class="soul-tagline">${escapeHtml(soul.tagline)}</p>
      <p class="soul-meta">${metaHtml}</p>
      <div class="soul-actions">
        <button class="copy-btn" onclick="copySoul()" title="Copy SOUL.md to clipboard">📋 Copy Soul</button>
        <a href="/${soul.slug}/soul.md" class="raw-link" title="View raw markdown">Raw</a>
      </div>
    </header>
    <div class="soul-content">
      ${soul.soul_html}
    </div>
    <footer class="site-footer">
      <p><a href="/">bareyoursoul.ai</a> · <a href="https://github.com/bbenevolent/bareyoursoul/tree/main/souls/${soul.slug}">View raw on GitHub</a></p>
    </footer>
    <script>
    async function copySoul() {
      try {
        const r = await fetch('/${soul.slug}/soul.md');
        const text = await r.text();
        await navigator.clipboard.writeText(text);
        const btn = document.querySelector('.copy-btn');
        btn.textContent = '✅ Copied!';
        setTimeout(() => btn.textContent = '📋 Copy Soul', 2000);
      } catch(e) { alert('Copy failed — try the Raw link instead'); }
    }
    </script>
  </div>
</body>
</html>`;
}

function build() {
  // Clean
  if (fs.existsSync(OUT_DIR)) fs.rmSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR);

  const souls = loadSouls();
  console.log(`Found ${souls.length} souls`);

  // Static assets
  fs.copyFileSync(path.join(SITE_DIR, 'style.css'), path.join(OUT_DIR, 'style.css'));

  // CNAME
  fs.writeFileSync(path.join(OUT_DIR, 'CNAME'), 'bareyoursoul.ai');

  // Index
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), renderIndex(souls));

  // Soul pages
  for (const soul of souls) {
    const soulOut = path.join(OUT_DIR, soul.slug);
    fs.mkdirSync(soulOut);
    fs.writeFileSync(path.join(soulOut, 'index.html'), renderSoulPage(soul));
    fs.copyFileSync(path.join(SOULS_DIR, soul.slug, 'soul.md'), path.join(soulOut, 'soul.md'));
  }

  console.log(`Built site to ${OUT_DIR}`);
}

build();
