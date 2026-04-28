#!/usr/bin/env node
/**
 * Converts all docs/*.md and the Install+Use HTML guide to PDF.
 * Run from project root: npm run generate-docs-pdf
 * Requires: npm install (root package.json with md-to-pdf and puppeteer)
 */
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(ROOT, 'docs');

const MD_IN_DOCS = [
  'INSTALLATION.md',
  'HOW_TO_USE.md',
  'MAPPING.md',
  'FEATURES_FREE_PAID.md',
];

const ROOT_MD = ['WINDOWS_STORE.md', 'IMPROVEMENTS.md'];

function run(cmd, opts) {
  try {
    execSync(cmd, { stdio: 'inherit', cwd: ROOT, ...opts });
    return true;
  } catch (e) {
    return false;
  }
}

async function main() {
  console.log('Converting Markdown to PDF...');
  const toConvert = [];
  for (const name of MD_IN_DOCS) {
    const p = path.join(DOCS_DIR, name);
    if (fs.existsSync(p)) toConvert.push(p);
  }
  for (const name of ROOT_MD) {
    const p = path.join(ROOT, name);
    if (fs.existsSync(p)) toConvert.push(p);
  }

  for (const inputPath of toConvert) {
    const base = path.basename(inputPath, '.md');
    const cwd = path.dirname(inputPath);
    const ok = run(`npx md-to-pdf "${path.basename(inputPath)}"`, { cwd });
    if (ok && cwd !== DOCS_DIR) {
      const from = path.join(cwd, base + '.pdf');
      if (fs.existsSync(from)) fs.renameSync(from, path.join(DOCS_DIR, base + '.pdf'));
    }
    console.log(ok ? '  OK: ' + base + '.pdf' : '  FAIL: ' + inputPath);
  }

  // HTML guide -> PDF via Puppeteer
  const htmlPath = path.join(DOCS_DIR, 'BOM_Compare_Tool_Install_and_Use_Guide.html');
  const pdfPath = path.join(DOCS_DIR, 'BOM_Compare_Tool_Install_and_Use_Guide.pdf');
  if (fs.existsSync(htmlPath)) {
    console.log('Converting HTML guide to PDF...');
    try {
      const puppeteer = require('puppeteer');
      const browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();
      const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');
      await page.goto(fileUrl, { waitUntil: 'networkidle0' });
      await page.pdf({
        path: pdfPath,
        format: 'A4',
        margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
        printBackground: true,
      });
      await browser.close();
      console.log('  OK: BOM_Compare_Tool_Install_and_Use_Guide.pdf');
    } catch (err) {
      console.error('  FAIL HTML:', err.message);
    }
  }

  console.log('Done. PDFs are in docs/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
