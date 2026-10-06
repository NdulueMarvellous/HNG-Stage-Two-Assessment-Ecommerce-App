/**
 * Temporary credential check for the SMTP (Gmail) setup.
 * Mirrors the transport options built by api/send-order-email.js.
 * Run: node verify-smtp.mjs
 */
import fs from 'node:fs';
import nodemailer from 'nodemailer';

// Read the files directly (Vite's loadEnv merges process.env, and this shell
// preloaded the *old* .env at startup, so its stale empty values would win).
function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

// .env.local wins over .env, matching Vite. A *non-empty* value already present in
// the shell wins over both, so alternative credentials can be tested without
// editing .env (the empty SMTP_* vars this shell preloaded are ignored).
const KEYS = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_SERVICE',
  'SMTP_URL',
  'SMTP_USER',
  'SMTP_PASS',
  'MAIL_FROM_EMAIL',
  'MAIL_FROM_NAME',
  'MAIL_REPLY_TO',
];

const fromShell = {};
for (const key of KEYS) {
  const value = process.env[key];
  if (value && value.trim()) fromShell[key] = value;
}

const fromFiles = Object.assign({}, readEnvFile('.env'), readEnvFile('.env.local'));

for (const key of KEYS) {
  process.env[key] = fromShell[key] ?? fromFiles[key] ?? '';
}

const SMTP_SERVICE = process.env.SMTP_SERVICE;
const SMTP_URL = process.env.SMTP_URL;
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE_RAW = process.env.SMTP_SECURE;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM_EMAIL = process.env.MAIL_FROM_EMAIL;

function parseBool(value) {
  if (value === undefined || value === null || String(value).trim() === '') return undefined;
  return /^(1|true|yes|on)$/i.test(String(value).trim());
}

const SMTP_SECURE = parseBool(SMTP_SECURE_RAW);

const options = { connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000 };
if (SMTP_SERVICE) options.service = SMTP_SERVICE;
if (SMTP_URL) {
  options.url = SMTP_URL;
} else {
  options.host = SMTP_HOST;
  options.port = SMTP_PORT;
  options.secure = SMTP_SECURE === undefined ? SMTP_PORT === 465 : SMTP_SECURE;
}
if (SMTP_USER) options.auth = { user: SMTP_USER, pass: SMTP_PASS };

console.log('resolved transport options:');
console.log(`  url set    : ${Boolean(SMTP_URL)}`);
console.log(`  service    : ${SMTP_SERVICE || '(none)'}`);
console.log(`  host       : ${SMTP_HOST}`);
console.log(`  port       : ${SMTP_PORT}`);
console.log(`  secure     : ${options.secure} (SMTP_SECURE raw: ${JSON.stringify(SMTP_SECURE_RAW ?? '')})`);
console.log(`  user       : ${SMTP_USER || '(MISSING)'}`);
console.log(`  pass       : ${SMTP_PASS ? `<set, ${SMTP_PASS.length} chars>` : '(MISSING)'}`);
console.log(`  from email : ${FROM_EMAIL || '(MISSING)'}`);

const missing = [];
if (!FROM_EMAIL) missing.push('MAIL_FROM_EMAIL');
if (!SMTP_URL && !SMTP_HOST && !SMTP_SERVICE) missing.push('SMTP_HOST (or SMTP_URL / SMTP_SERVICE)');
if (!SMTP_USER) missing.push('SMTP_USER');
if (!SMTP_PASS) missing.push('SMTP_PASS');
if (missing.length) {
  console.error(`MISSING CONFIG: ${missing.join(', ')}`);
  process.exitCode = 1;
} else {
  const transporter = nodemailer.createTransport(options);

  try {
    await transporter.verify();
    console.log('AUTH OK - Gmail accepted SMTP_USER + SMTP_PASS');
  } catch (error) {
    console.error(`AUTH FAILED: ${error.code || ''} ${error.message}`);
    process.exitCode = 1;
  }

  if (!process.exitCode) {
    try {
      const info = await transporter.sendMail({
        from: { name: process.env.MAIL_FROM_NAME || 'TechMart Orders', address: FROM_EMAIL },
        to: { name: 'TechMart test', address: SMTP_USER },
        replyTo: process.env.MAIL_REPLY_TO || undefined,
        subject: 'TechMart SMTP test',
        text: [
          'This is a one-off test message sent while wiring up the TechMart order-receipt emails.',
          '',
          'If you are reading this, Nodemailer + Gmail SMTP is working.',
        ].join('\n'),
      });
      console.log(`SEND OK - messageId ${info.messageId}`);
      console.log(`  accepted: ${JSON.stringify(info.accepted)}`);
    } catch (error) {
      console.error(`SEND FAILED: ${error.code || ''} ${error.message}`);
      process.exitCode = 1;
    }
  }
}

// Let sockets close rather than hanging the shell.
setTimeout(() => process.exit(process.exitCode || 0), 200);