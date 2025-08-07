#!/usr/bin/env node
/**
 * Bulk WhatsApp Sender via WhatsApp Web (Puppeteer)
 *
 * Features:
 * - Read phone numbers from an Excel file (.xlsx/.xls)
 * - Send multi-line text messages
 * - Optionally attach an image and/or a video (WhatsApp Web limits may still apply)
 * - Works for unsaved numbers using ?phone= URLs
 * - Human-like randomized delays between messages
 *
 * Usage examples:
 *   node scripts/whatsapp-bulk-sender.mjs \
 *     --excel /absolute/path/contacts.xlsx \
 *     --message "Hello there\nThis is a multiline message." \
 *     --image /absolute/path/promo.jpg \
 *     --video /absolute/path/demo.mp4 \
 *     --delayMin 2.5 --delayMax 6.5
 *
 * Or read message from a file:
 *   node scripts/whatsapp-bulk-sender.mjs --excel ./contacts.xlsx --messageFile ./message.txt
 */

import fs from 'fs';
import path from 'path';
import process from 'process';
import puppeteer from 'puppeteer';
import xlsx from 'xlsx';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';

const argv = yargs(hideBin(process.argv))
  .scriptName('whatsapp-bulk-sender')
  .usage('$0 --excel <path> [--message <text> | --messageFile <path>] [--image <path>] [--video <path>] [--delayMin <sec>] [--delayMax <sec>] [--countryCode <cc>] [--headless]')
  .option('excel', { type: 'string', demandOption: true, describe: 'Absolute or relative path to Excel file with contacts' })
  .option('message', { type: 'string', describe: 'Text message to send (supports \n for new lines)' })
  .option('messageFile', { type: 'string', describe: 'Path to a text file with the message content (multiline supported)' })
  .option('image', { type: 'string', describe: 'Optional path to an image to attach' })
  .option('video', { type: 'string', describe: 'Optional path to a video to attach' })
  .option('delayMin', { type: 'number', default: 2.0, describe: 'Minimum delay (seconds) between messages' })
  .option('delayMax', { type: 'number', default: 5.0, describe: 'Maximum delay (seconds) between messages' })
  .option('countryCode', { type: 'string', default: '', describe: 'Default country calling code to prepend if numbers omit it (e.g., 1, 44, 91). No leading +' })
  .option('headless', { type: 'boolean', default: false, describe: 'Run Chrome in headless mode (not recommended for first-time login)' })
  .check((args) => {
    if (!args.message && !args.messageFile && !args.image && !args.video) {
      throw new Error('Provide at least one of: --message, --messageFile, --image, --video');
    }
    if (args.message && args.messageFile) {
      throw new Error('Use either --message or --messageFile, not both');
    }
    if (args.delayMin > args.delayMax) {
      throw new Error('--delayMin cannot be greater than --delayMax');
    }
    return true;
  })
  .help()
  .argv;

function ensureAbs(p) {
  return p ? path.resolve(process.cwd(), p) : undefined;
}

function fileExists(p) {
  try { return !!p && fs.existsSync(p); } catch { return false; }
}

function normalizePhone(raw, countryCode = '') {
  if (!raw) return null;
  const digits = String(raw).replace(/[^\\d+]/g, '');
  if (!digits) return null;
  if (digits.startsWith('+')) return digits.replace(/\\+/g, '');
  // If starts with country code already (heuristic): keep as is
  if (countryCode && !digits.startsWith(countryCode)) {
    // Prepend country code if looks like local number (length <= 10-11 typical)
    if (digits.length <= 11) return `${countryCode}${digits}`;
  }
  return digits;
}

function readMessage({ message, messageFile }) {
  if (message) return message;
  if (messageFile) {
    const p = ensureAbs(messageFile);
    if (!fileExists(p)) throw new Error(`Message file not found: ${p}`);
    return fs.readFileSync(p, 'utf8');
  }
  return '';
}

function readExcelPhones(excelPath, countryCode) {
  const wb = xlsx.readFile(excelPath);
  const firstSheet = wb.SheetNames[0];
  const ws = wb.Sheets[firstSheet];
  const rows = xlsx.utils.sheet_to_json(ws, { defval: '' });

  const numbers = new Set();
  for (const row of rows) {
    // Accept common column names or first cell fallback
    const val = row.phone ?? row.Phone ?? row.number ?? row.Number ?? Object.values(row)[0];
    const n = normalizePhone(val, countryCode);
    if (n) numbers.add(n);
  }
  return Array.from(numbers);
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function randomBetween(min, max) { return min + Math.random() * (max - min); }

async function waitForAny(page, selectors, options = {}) {
  const promises = selectors.map(sel => page.waitForSelector(sel, options).then(h => ({ sel, handle: h })).catch(() => null));
  const result = (await Promise.race([Promise.all(promises), sleep(options.timeout || 0)])) || [];
  return result.find(Boolean);
}

async function openChat(page, phone) {
  const url = `https://web.whatsapp.com/send?phone=${encodeURIComponent(phone)}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  // Wait for chat box or an error state
  await page.waitForSelector('body');
  await page.waitForFunction(() => document.readyState === 'complete');
  // Try multiple selectors for the composer to ensure chat is loaded
  const composerSelectors = [
    'div[contenteditable="true"][data-tab="10"]',
    'div[contenteditable="true"][data-tab="6"]',
    'div[aria-placeholder="Type a message"]',
    'div[role="textbox"][contenteditable="true"]'
  ];
  await waitForAny(page, composerSelectors, { timeout: 30000 });
}

async function typeMultiline(page, text) {
  const composerSelectors = [
    'div[contenteditable="true"][data-tab="10"]',
    'div[contenteditable="true"][data-tab="6"]',
    'div[aria-placeholder="Type a message"]',
    'div[role="textbox"][contenteditable="true"]'
  ];
  const target = await waitForAny(page, composerSelectors, { timeout: 15000 });
  if (!target) throw new Error('Composer not found');
  const box = target.handle;
  await box.focus();

  const lines = String(text).split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line) {
      await page.keyboard.type(line, { delay: 10 + Math.floor(Math.random() * 80) });
    }
    if (i < lines.length - 1) {
      await page.keyboard.down('Shift');
      await page.keyboard.press('Enter');
      await page.keyboard.up('Shift');
      await sleep(50 + Math.random() * 150);
    }
  }
}

async function clickSend(page) {
  const sendSelectors = [
    'button[data-testid="compose-btn-send"]',
    'span[data-icon="send"]',
    'div[aria-label="Send"] button'
  ];
  const sendBtn = await waitForAny(page, sendSelectors, { timeout: 10000 });
  if (!sendBtn) throw new Error('Send button not found');
  await sendBtn.handle.click();
}

async function attachFiles(page, files = []) {
  if (!files.length) return;
  // Try opening the attach menu
  const clipSelectors = [
    'button[data-testid="attach-button"]',
    'span[data-icon="clip"]',
    'div[title="Attach"]'
  ];
  const clip = await waitForAny(page, clipSelectors, { timeout: 10000 });
  if (!clip) throw new Error('Attach button not found');
  await clip.handle.click();

  // Wait for the hidden file input and upload files
  const fileInput = await page.waitForSelector('input[type="file"][accept="image/*,video/mp4,video/3gpp,video/quicktime"]', { timeout: 10000 });
  if (!fileInput) throw new Error('File input not found');
  await fileInput.uploadFile(...files);

  // Wait for preview to be ready (thumbnail or caption box visible)
  await waitForAny(page, [
    'div[aria-label="Add a caption"]',
    'div[aria-label="Send"]',
    'div[data-animate-media-preview]'
  ], { timeout: 30000 });
}

async function ensureLoggedIn(page) {
  await page.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded' });
  console.log(chalk.cyan('If this is your first run, scan the QR code in the opened browser.'));
  // Ready when the chat sidebar shows up or the search bar is available
  await waitForAny(page, [
    'div[data-testid="chatlist"]',
    'div[title="Search input textbox"]',
    'div[aria-label="Search or start new chat"]'
  ], { timeout: 0 });
}

async function main() {
  const excelPath = ensureAbs(argv.excel);
  if (!fileExists(excelPath)) {
    console.error(chalk.red(`Excel file not found: ${excelPath}`));
    process.exit(1);
  }

  const msgText = readMessage({ message: argv.message, messageFile: argv.messageFile });
  const imagePath = ensureAbs(argv.image);
  const videoPath = ensureAbs(argv.video);

  const attachments = [];
  if (imagePath) {
    if (!fileExists(imagePath)) { console.error(chalk.red(`Image not found: ${imagePath}`)); process.exit(1); }
    attachments.push(imagePath);
  }
  if (videoPath) {
    if (!fileExists(videoPath)) { console.error(chalk.red(`Video not found: ${videoPath}`)); process.exit(1); }
    attachments.push(videoPath);
  }

  const numbers = readExcelPhones(excelPath, argv.countryCode || '');
  if (!numbers.length) {
    console.error(chalk.red('No phone numbers found in the Excel file. Expected a column named "phone"/"number" or first column to contain numbers.'));
    process.exit(1);
  }

  console.log(chalk.green(`Loaded ${numbers.length} unique numbers from Excel.`));

  const browser = await puppeteer.launch({
    headless: argv.headless,
    defaultViewport: null,
    args: ['--start-maximized']
  });
  const [page] = await browser.pages();
  await ensureLoggedIn(page);

  const results = { sent: 0, failed: 0, errors: [] };
  const minMs = Math.round((argv.delayMin || 2) * 1000);
  const maxMs = Math.round((argv.delayMax || 5) * 1000);

  for (let i = 0; i < numbers.length; i++) {
    const phone = numbers[i];
    console.log(chalk.gray(`\n[${i + 1}/${numbers.length}] Sending to ${phone} ...`));

    try {
      await openChat(page, phone);

      if (attachments.length) {
        await attachFiles(page, attachments);
        if (msgText) {
          await typeMultiline(page, msgText);
        }
        await clickSend(page);
      } else if (msgText) {
        await typeMultiline(page, msgText);
        await clickSend(page);
      } else {
        console.log(chalk.yellow('Nothing to send for this contact (no message and no attachments). Skipping.'));
      }

      results.sent++;
      const delay = Math.round(randomBetween(minMs, maxMs));
      console.log(chalk.cyan(`Waiting ${Math.round(delay / 1000)}s before next message...`));
      await sleep(delay);
    } catch (err) {
      console.error(chalk.red(`Failed to send to ${phone}: ${err && err.message ? err.message : err}`));
      results.failed++;
      results.errors.push({ phone, error: String(err?.message || err) });
      // Small backoff on error
      await sleep(1500 + Math.random() * 2000);
    }
  }

  console.log('\n' + chalk.bold('Done!'));
  console.log(chalk.green(`Sent:   ${results.sent}`));
  console.log(chalk.red(`Failed: ${results.failed}`));
  if (results.errors.length) {
    console.log(chalk.yellow('\nErrors:'));
    for (const e of results.errors) {
      console.log(` - ${e.phone}: ${e.error}`);
    }
  }
  await browser.close();
}

main().catch((e) => {
  console.error(chalk.red(e?.stack || e));
  process.exit(1);
});
