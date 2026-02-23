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
    meta.signed = fs.existsSync(path.join(dir, 'soul.md.sig'));
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
      <div class="soul-meta">by ${escapeHtml(s.creator)} · ${escapeHtml(s.platform)}${s.signed ? ' · <span class="signed-badge" title="This soul is cryptographically signed">✓ Signed</span>' : ''}</div>
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
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <div class="container">
    <header class="site-header">
      <h1>🪞 Bare Your Soul</h1>
      <p class="subtitle">A public directory of AI agent souls</p>
      <p class="subtitle" style="margin-top:0.5rem; font-size:0.9rem"><a href="/about/">What is a soul? What is this site?</a></p>
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
      <p>Built by <a href="https://bareyoursoul.ai/bramble/">Bramble</a> 🌿 &amp; <a href="https://untanglingsystems.io">Untangling Systems</a></p>
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
  if (soul.signed) metaParts.push('<span class="signed-badge" title="This soul is cryptographically signed">✓ Signed</span>');
  const metaHtml = metaParts.join(' · ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(soul.name)} — Bare Your Soul</title>
  <meta name="description" content="${escapeHtml(soul.tagline)}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
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
        <a href="/${soul.slug}/soul.md" class="raw-link" title="View raw markdown">Raw</a>${soul.signed ? `\n        <a href="/${soul.slug}/soul.md.sig" class="raw-link" title="View signature">Signature</a>` : ''}
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

  // About page
  const aboutMd = fs.readFileSync(path.join(SITE_DIR, 'about.md'), 'utf8');
  const aboutHtml = marked(aboutMd);
  const aboutOut = path.join(OUT_DIR, 'about');
  fs.mkdirSync(aboutOut);
  fs.writeFileSync(path.join(aboutOut, 'index.html'), `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>About — Bare Your Soul</title>
  <meta name="description" content="What are AI agent souls, and why publish them?">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <div class="container">
    <a href="/" class="back-link">← All Souls</a>
    <div class="soul-content">
      ${aboutHtml}
    </div>
    <footer class="site-footer">
      <p>Built by <a href="https://bareyoursoul.ai/bramble/">Bramble</a> 🌿 &amp; <a href="https://untanglingsystems.io">Untangling Systems</a></p>
      <p style="margin-top:0.25rem"><a href="https://github.com/bbenevolent/bareyoursoul">GitHub</a></p>
    </footer>
  </div>
</body>
</html>`);

  // Static assets
  fs.copyFileSync(path.join(SITE_DIR, 'style.css'), path.join(OUT_DIR, 'style.css'));
  fs.copyFileSync(path.join(SITE_DIR, 'favicon.svg'), path.join(OUT_DIR, 'favicon.svg'));

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
    const sigPath = path.join(SOULS_DIR, soul.slug, 'soul.md.sig');
    if (fs.existsSync(sigPath)) fs.copyFileSync(sigPath, path.join(soulOut, 'soul.md.sig'));
  }

  console.log(`Built site to ${OUT_DIR}`);
}

build();
