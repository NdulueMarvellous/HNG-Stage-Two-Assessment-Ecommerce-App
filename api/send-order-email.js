/**
 * POST /api/send-order-email
 * ---------------------------------------------------------------------------
 * Serverless function (runs on Vercel, and locally via the vite.config.js
 * middleware) that emails an order confirmation over SMTP with Nodemailer.
 *
 * It never runs in the browser, so the SMTP password stays on the server.
 * There is no service-role key here either: the function forwards the
 * caller's own Supabase access token to PostgREST, so Row Level Security
 * decides what can be read and a user can only ever email their own order.
 *
 * Request  { orderId: "<uuid>" }   with header  Authorization: Bearer <access_token>
 * Response { emailSent: true, message: "..." }
 */
import nodemailer from 'nodemailer';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

// ---- SMTP (server only - see README "Email setup") -------------------------
const SMTP_SERVICE = process.env.SMTP_SERVICE;
const SMTP_URL = process.env.SMTP_URL;
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = parseBool(process.env.SMTP_SECURE);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

const FROM_EMAIL = process.env.MAIL_FROM_EMAIL;
const FROM_NAME = process.env.MAIL_FROM_NAME || 'TechMart Orders';
const REPLY_TO = process.env.MAIL_REPLY_TO;

const APP_URL = String(process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '');
const STORE_NAME = process.env.VITE_STORE_NAME || 'TechMart';
const CURRENCY = process.env.VITE_CURRENCY || 'NGN';

/** Parses an optional boolean env var. Returns undefined when unset or blank. */
function parseBool(value) {
  if (value === undefined || value === null || String(value).trim() === '') return undefined;
  return /^(1|true|yes|on)$/i.test(String(value).trim());
}

/**
 * Builds the Nodemailer transport, once per invocation.
 *
 * `SMTP_URL` (a single connection string) wins when both styles are supplied;
 * otherwise `SMTP_HOST`/`SMTP_PORT` are used, and `SMTP_SERVICE` (e.g. "Gmail")
 * fills host/port/secure in for a well-known provider. `secure: true` means
 * implicit TLS - what port 465 speaks - while 587 upgrades through STARTTLS on
 * its own, so it is derived from the port unless SMTP_SECURE overrides it.
 *
 * Pooling is deliberately off: a serverless invocation sends one message and
 * returns, and a pool would keep the socket - and the function - alive.
 */
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const options = {
    // Fail fast rather than holding the invocation open until it is killed.
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  };

  if (SMTP_SERVICE) options.service = SMTP_SERVICE;

  if (SMTP_URL) {
    options.url = SMTP_URL;
  } else {
    options.host = SMTP_HOST;
    options.port = SMTP_PORT;
    options.secure = SMTP_SECURE === undefined ? SMTP_PORT === 465 : SMTP_SECURE;
  }

  if (SMTP_USER) options.auth = { user: SMTP_USER, pass: SMTP_PASS };

  transporter = nodemailer.createTransport(options);
  return transporter;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json');
  return res.json(payload);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function money(value) {
  const amount = Number(value);
  try {
    return new Intl.NumberFormat(CURRENCY === 'NGN' ? 'en-NG' : 'en-US', {
      style: 'currency',
      currency: CURRENCY,
      minimumFractionDigits: 2,
    }).format(Number.isFinite(amount) ? amount : 0);
  } catch {
    return `${CURRENCY} ${Number.isFinite(amount) ? amount.toFixed(2) : '0.00'}`;
  }
}

function longDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed. Use POST.' });
  }

  // ---- 1. configuration check (fail loudly, with the missing key names) ----
  const missing = [];
  if (!SUPABASE_URL) missing.push('VITE_SUPABASE_URL');
  if (!SUPABASE_ANON_KEY) missing.push('VITE_SUPABASE_ANON_KEY');
  if (!FROM_EMAIL) missing.push('MAIL_FROM_EMAIL');
  if (!SMTP_URL && !SMTP_HOST && !SMTP_SERVICE) {
    missing.push('SMTP_HOST (or SMTP_URL / SMTP_SERVICE)');
  }
  if (missing.length > 0) {
    console.error('[send-order-email] missing env vars:', missing.join(', '));
    return json(res, 500, {
      error: `The email service is not configured. Missing environment variable(s): ${missing.join(', ')}.`,
    });
  }

  // ---- 2. authenticate the caller ----------------------------------------
  const header = String(req.headers.authorization || req.headers.Authorization || '');
  const accessToken = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!accessToken) {
    return json(res, 401, { error: 'You must be signed in to receive an order confirmation.' });
  }

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body || {};
  const orderId = String(body.orderId || '').trim();
  if (!UUID_RE.test(orderId)) {
    return json(res, 400, { error: 'A valid orderId is required.' });
  }

  const authHeaders = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` };

  let user;
  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: authHeaders });
    if (!userRes.ok) {
      return json(res, 401, { error: 'Your session has expired. Please sign in again.' });
    }
    user = await userRes.json();
  } catch (error) {
    console.error('[send-order-email] auth lookup failed:', error);
    return json(res, 502, { error: 'We could not verify your session. Please try again.' });
  }

  if (!user?.id) {
    return json(res, 401, { error: 'Your session has expired. Please sign in again.' });
  }

  // ---- 3. load the order (RLS scopes this to the caller's own orders) -----
  let order;
  try {
    const orderRes = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=*,order_items(*)`,
      { headers: authHeaders },
    );
    if (!orderRes.ok) {
      console.error('[send-order-email] order lookup failed:', orderRes.status, await orderRes.text());
      return json(res, 502, { error: 'We could not load your order details.' });
    }
    const rows = await orderRes.json();
    order = Array.isArray(rows) ? rows[0] : null;
  } catch (error) {
    console.error('[send-order-email] order fetch failed:', error);
    return json(res, 502, { error: 'We could not load your order details.' });
  }

  if (!order) {
    return json(res, 404, { error: 'Order not found. It may belong to a different account.' });
  }
  if (order.user_id !== user.id) {
    return json(res, 403, { error: 'You are not allowed to email this order.' });
  }

  // ---- 4. build and send the confirmation email ---------------------------
  const items = Array.isArray(order.order_items) ? order.order_items : [];
  const toEmail = order.email || user.email;
  const toName = order.full_name || 'there';
  const subject = `Order confirmed - ${order.order_number} | ${STORE_NAME}`;

  try {
    const info = await getTransporter().sendMail({
      from: { name: FROM_NAME, address: FROM_EMAIL },
      to: { name: toName, address: toEmail },
      replyTo: REPLY_TO || undefined,
      subject,
      text: buildTextEmail({ order, items, toName }),
      html: buildHtmlEmail({ order, items, toName }),
    });

    console.log(
      `[send-order-email] confirmation for ${order.order_number} sent to ${toEmail} ` +
        `(messageId ${info?.messageId || 'unknown'})`,
    );
    return json(res, 200, {
      emailSent: true,
      message: `A confirmation email has been sent to ${toEmail}.`,
    });
  } catch (error) {
    console.error('[send-order-email] SMTP send failed:', error?.message || error);
    return json(res, 502, {
      emailSent: false,
      error:
        'Your order was placed successfully, but we could not send the confirmation email. ' +
        'The store has been notified.',
    });
  }
}

function safeJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function buildTextEmail({ order, items, toName }) {
  const lines = [
    `Hi ${toName},`,
    '',
    `Thanks for shopping with ${STORE_NAME}. Your order has been received.`,
    '',
    `Order number : ${order.order_number}`,
    `Placed on    : ${longDate(order.created_at)}`,
    `Status       : ${order.status}`,
    '',
    'Items',
    ...items.map(
      (item) =>
        `  ${item.quantity} x ${item.product_name} - ${money(item.line_total)} (${money(item.unit_price)} each)`,
    ),
    '',
    `Subtotal     : ${money(order.subtotal)}`,
    `Delivery     : ${Number(order.delivery_fee) === 0 ? 'FREE' : money(order.delivery_fee)}`,
    `Total        : ${money(order.total)}`,
    '',
    'Delivering to',
    `  ${order.full_name}`,
    `  ${order.address}`,
    `  ${order.city}, ${order.state}`,
    `  ${order.country}`,
    `  Phone: ${order.phone}`,
    '',
    `Track your orders: ${APP_URL}/orders`,
    '',
    `${FROM_NAME}`,
    STORE_NAME,
  ];
  return lines.join('\n');
}

function buildHtmlEmail({ order, items, toName }) {
  const rows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #e2e8f0;font-size:14px;color:#0f172a;">
            <strong style="font-weight:600;">${escapeHtml(item.product_name)}</strong>
            <div style="color:#64748b;font-size:13px;margin-top:4px;">
              ${escapeHtml(money(item.unit_price))} &times; ${escapeHtml(item.quantity)}
            </div>
          </td>
          <td style="padding:14px 0;border-bottom:1px solid #e2e8f0;text-align:right;font-size:14px;
                     font-weight:600;color:#0f172a;white-space:nowrap;">
            ${escapeHtml(money(item.line_total))}
          </td>
        </tr>`,
    )
    .join('');

  const deliveryLabel = Number(order.delivery_fee) === 0 ? 'FREE' : escapeHtml(money(order.delivery_fee));

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="display:none;font-size:1px;color:#f1f5f9;">
      Your ${escapeHtml(STORE_NAME)} order ${escapeHtml(order.order_number)} is confirmed.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0"
                 style="width:600px;max-width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.08);">
            <tr>
              <td style="background:#4f46e5;padding:28px 32px;">
                <div style="color:#c7d2fe;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;">Order confirmation</div>
                <div style="color:#ffffff;font-size:24px;font-weight:700;margin-top:6px;">${escapeHtml(STORE_NAME)}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 8px;font-size:16px;color:#0f172a;">Hi ${escapeHtml(toName)},</p>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#475569;">
                  Thank you for your order. We have received it and it is now being prepared.
                  Here is a copy of your receipt.
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                       style="background:#eef2ff;border-radius:12px;padding:16px 20px;margin-bottom:8px;">
                  <tr>
                    <td style="font-size:13px;color:#4338ca;padding:4px 0;">
                      <strong>Order number:</strong> ${escapeHtml(order.order_number)}
                    </td>
                  </tr>
                  <tr>
                    <td style="font-size:13px;color:#4338ca;padding:4px 0;">
                      <strong>Date:</strong> ${escapeHtml(longDate(order.created_at))}
                    </td>
                  </tr>
                  <tr>
                    <td style="font-size:13px;color:#4338ca;padding:4px 0;text-transform:capitalize;">
                      <strong>Status:</strong> ${escapeHtml(order.status)}
                    </td>
                  </tr>
                </table>
<h2 style="font-size:15px;color:#0f172a;margin:28px 0 4px;text-transform:uppercase;letter-spacing:0.08em;">
                  Your items
                </h2>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${rows}
                </table>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
                  <tr>
                    <td style="font-size:14px;color:#475569;padding:6px 0;">Subtotal</td>
                    <td style="font-size:14px;color:#0f172a;text-align:right;padding:6px 0;">${escapeHtml(money(order.subtotal))}</td>
                  </tr>
                  <tr>
                    <td style="font-size:14px;color:#475569;padding:6px 0;">Delivery fee</td>
                    <td style="font-size:14px;color:#0f172a;text-align:right;padding:6px 0;">${deliveryLabel}</td>
                  </tr>
                  <tr>
                    <td style="font-size:16px;font-weight:700;color:#0f172a;padding:14px 0 0;border-top:2px solid #0f172a;">Total</td>
                    <td style="font-size:16px;font-weight:700;color:#0f172a;text-align:right;padding:14px 0 0;border-top:2px solid #0f172a;">
                      ${escapeHtml(money(order.total))}
                    </td>
                  </tr>
                </table>
                <h2 style="font-size:15px;color:#0f172a;margin:32px 0 12px;text-transform:uppercase;letter-spacing:0.08em;">
                  Delivery details
                </h2>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                       style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
                  <tr>
                    <td style="padding:16px 20px;font-size:14px;line-height:1.7;color:#334155;">
                      <strong style="color:#0f172a;">${escapeHtml(order.full_name)}</strong><br />
                      ${escapeHtml(order.address)}<br />
                      ${escapeHtml(order.city)}, ${escapeHtml(order.state)}<br />
                      ${escapeHtml(order.country)}<br />
                      ${escapeHtml(order.phone)}
                    </td>
                  </tr>
                </table>
                <p style="text-align:center;margin:32px 0 0;">
                  <a href="${escapeHtml(`${APP_URL}/orders`)}"
                     style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;
                            font-size:14px;font-weight:600;padding:14px 28px;border-radius:10px;">
                    View my orders
                  </a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;text-align:center;">
                <p style="margin:0;font-size:12px;color:#64748b;line-height:1.6;">
                  Need help? Reply to this email or contact ${escapeHtml(REPLY_TO || FROM_EMAIL)}.<br />
                  &copy; ${new Date().getFullYear()} ${escapeHtml(STORE_NAME)}. Thank you for shopping with us.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}