import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHmac, createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { pool } from '../db.js';

const router = Router();
const accessMinutes = Math.min(60, Math.max(5, Number(process.env.ACCESS_TOKEN_MINUTES || 10)));
const refreshDays = Math.min(90, Math.max(1, Number(process.env.REFRESH_TOKEN_DAYS || 14)));
const issuer = process.env.JWT_ISSUER || 'https://kingshall.online';
const codeTtlMinutes = 10;
const resendCooldownSeconds = 60;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const usernamePattern = /^[a-zA-Z0-9_.]{3,24}$/;
const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please wait before trying again.' },
});

const normalizeEmail = (value) => typeof value === 'string' ? value.trim().toLowerCase() : '';
const normalizeUsername = (value) => typeof value === 'string' ? value.trim().toLowerCase() : '';
const codeHash = (email, code) => createHmac('sha256', process.env.JWT_SECRET).update(`${email}:${code}`).digest('hex');
const tokenHash = (token) => createHash('sha256').update(token).digest('hex');
function safeEqualHex(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) return false;
  try { return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex')); } catch { return false; }
}
function passwordProblem(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) return 'Password must be between 12 and 128 characters.';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return 'Use uppercase and lowercase letters, a number, and a symbol in your password.';
  }
  return null;
}
function publicUser(user) {
  return {
    id: String(user.id),
    name: user.name,
    username: user.username,
    email: user.email,
    isEmailVerified: user.is_email_verified,
    createdAt: user.created_at,
  };
}
function issueAccessToken(user) {
  return jwt.sign(
    { sub: String(user.id), username: user.username, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: `${accessMinutes}m`, issuer, audience: 'kingshall-app' },
  );
}
async function issueSession(user, client = pool) {
  const refreshToken = randomBytes(48).toString('base64url');
  await client.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + ($3 * INTERVAL \'1 day\'))',
    [user.id, tokenHash(refreshToken), refreshDays],
  );
  return {
    accessToken: issueAccessToken(user),
    refreshToken,
    tokenType: 'Bearer',
    expiresInSeconds: accessMinutes * 60,
    refreshExpiresInSeconds: refreshDays * 86400,
    user: publicUser(user),
  };
}
async function sendVerificationEmail(email, name, code) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [email],
      subject: 'Your KingsHall email verification code',
      text: `Hello ${name},\n\nYour KingsHall verification code is: ${code}\n\nIt expires in ${codeTtlMinutes} minutes. If you did not request this, ignore this email.\n\nKingsHall`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#171525"><h2>Verify your KingsHall email</h2><p>Hello ${escapeHtml(name)},</p><p>Enter this code in KingsHall to verify your email address:</p><div style="font-size:30px;font-weight:700;letter-spacing:8px;padding:18px;background:#f2efff;border-radius:12px;text-align:center">${code}</div><p>This code expires in ${codeTtlMinutes} minutes. If you did not request this, ignore this email.</p></div>`,
    }),
  });
  if (!response.ok) {
    const details = await response.text().catch(() => '');
    console.error('Resend rejected verification email:', response.status, details.slice(0, 250));
    throw new Error('Email delivery failed.');
  }
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
async function authenticate(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Sign in to continue.' });
  try {
    req.auth = jwt.verify(token, process.env.JWT_SECRET, { issuer, audience: 'kingshall-app' });
    return next();
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.', code: 'TOKEN_EXPIRED' });
  }
}

router.post('/signup', emailLimiter, async (req, res, next) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim().replace(/\s+/g, ' ') : '';
    const username = normalizeUsername(req.body?.username);
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;
    const passwordError = passwordProblem(password);
    if (name.length < 2 || name.length > 80) return res.status(400).json({ error: 'Name must be between 2 and 80 characters.' });
    if (!usernamePattern.test(username)) return res.status(400).json({ error: 'Username must be 3–24 characters using letters, numbers, dots or underscores.' });
    if (email.length > 254 || !emailPattern.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (passwordError) return res.status(400).json({ error: passwordError });

    const passwordHash = await bcrypt.hash(password, 12);
    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    const hash = codeHash(email, code);
    const inserted = await pool.query(
      `INSERT INTO users (name, username, email, password_hash, email_verification_code_hash, email_verification_expires_at, email_verification_sent_at)
       VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '10 minutes', NOW())
       RETURNING id, name, username, email`,
      [name, username, email, passwordHash, hash],
    );
    try {
      await sendVerificationEmail(email, name, code);
    } catch {
      return res.status(503).json({ error: 'Your account was created, but the verification email could not be sent. Use Resend code after the cooldown.', code: 'EMAIL_DELIVERY_FAILED', email });
    }
    return res.status(201).json({ message: 'Account created. Enter the six-digit code sent to your email.', email, verificationRequired: true, expiresInSeconds: codeTtlMinutes * 60 });
  } catch (error) {
    if (error?.code === '23505') {
      const email = normalizeEmail(req.body?.email);
      const username = normalizeUsername(req.body?.username);
      const existing = await pool.query('SELECT email, username, is_email_verified FROM users WHERE email = $1 OR username = $2 LIMIT 1', [email, username]).catch(() => ({ rows: [] }));
      if (existing.rows[0]?.email === email && !existing.rows[0].is_email_verified) {
        return res.status(409).json({ error: 'This email already has an account awaiting verification. Verify it or resend the code.', code: 'VERIFICATION_PENDING', email });
      }
      return res.status(409).json({ error: existing.rows[0]?.username === username ? 'That username is already taken.' : 'An account with this email already exists.' });
    }
    return next(error);
  }
});

router.post('/verify-email', emailLimiter, async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    if (!emailPattern.test(email) || !/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Enter a valid email and six-digit verification code.' });
    const result = await pool.query('SELECT id, is_email_verified, email_verification_code_hash, email_verification_expires_at FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) return res.status(400).json({ error: 'The code is invalid or expired. Request a new code and try again.' });
    if (user.is_email_verified) return res.json({ message: 'Email already verified. You can sign in now.' });
    if (!user.email_verification_code_hash || !user.email_verification_expires_at ||
        new Date(user.email_verification_expires_at).getTime() < Date.now() ||
        !safeEqualHex(user.email_verification_code_hash, codeHash(email, code))) {
      return res.status(400).json({ error: 'The code is invalid or expired. Request a new code and try again.' });
    }
    await pool.query(
      'UPDATE users SET is_email_verified = TRUE, email_verification_code_hash = NULL, email_verification_expires_at = NULL, email_verification_sent_at = NULL, updated_at = NOW() WHERE id = $1',
      [user.id],
    );
    return res.json({ message: 'Email verified successfully. You can now sign in.' });
  } catch (error) { return next(error); }
});

router.post('/resend-verification', emailLimiter, async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!emailPattern.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    const result = await pool.query('SELECT id, name, is_email_verified, email_verification_sent_at FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user || user.is_email_verified) return res.json({ message: 'If that address has a pending KingsHall account, a verification email will be sent when eligible.' });
    const elapsed = user.email_verification_sent_at ? (Date.now() - new Date(user.email_verification_sent_at).getTime()) / 1000 : Infinity;
    if (elapsed < resendCooldownSeconds) return res.status(429).json({ error: `Please wait ${Math.ceil(resendCooldownSeconds - elapsed)} seconds before requesting another code.` });
    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    await pool.query(
      'UPDATE users SET email_verification_code_hash = $1, email_verification_expires_at = NOW() + INTERVAL \'10 minutes\', email_verification_sent_at = NOW(), updated_at = NOW() WHERE id = $2',
      [codeHash(email, code), user.id],
    );
    try { await sendVerificationEmail(email, user.name, code); }
    catch { return res.status(503).json({ error: 'The verification email could not be sent. Please try again later.' }); }
    return res.json({ message: 'A new verification code has been sent if the account is eligible.' });
  } catch (error) { return next(error); }
});

router.post('/login', emailLimiter, async (req, res, next) => {
  try {
    const identity = typeof req.body?.identity === 'string' ? req.body.identity.trim() : '';
    const password = req.body?.password;
    if (!identity || typeof password !== 'string' || password.length > 128) return res.status(400).json({ error: 'Enter your email or username and password.' });
    const isEmail = identity.includes('@');
    const lookup = isEmail ? normalizeEmail(identity) : normalizeUsername(identity);
    const result = await pool.query(
      `SELECT id, name, username, email, password_hash, is_email_verified, failed_login_count, login_blocked_until, created_at
       FROM users WHERE ${isEmail ? 'email' : 'username'} = $1 LIMIT 1`,
      [lookup],
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Email/username or password is incorrect.' });
    if (user.login_blocked_until && new Date(user.login_blocked_until).getTime() > Date.now()) return res.status(429).json({ error: 'Too many unsuccessful attempts. Please wait before trying again.' });
    const matches = await bcrypt.compare(password, user.password_hash);
    if (!matches) {
      const failures = Number(user.failed_login_count || 0) + 1;
      await pool.query(
        'UPDATE users SET failed_login_count = $1, login_blocked_until = $2, updated_at = NOW() WHERE id = $3',
        [failures >= 8 ? 0 : failures, failures >= 8 ? new Date(Date.now() + 15 * 60 * 1000) : null, user.id],
      );
      return res.status(401).json({ error: 'Email/username or password is incorrect.' });
    }
    if (!user.is_email_verified) return res.status(403).json({ error: 'Verify your email before signing in.', code: 'EMAIL_NOT_VERIFIED', email: user.email });
    await pool.query('UPDATE users SET failed_login_count = 0, login_blocked_until = NULL, updated_at = NOW() WHERE id = $1', [user.id]);
    return res.json({ message: 'Sign in successful.', ...(await issueSession(user)) });
  } catch (error) { return next(error); }
});

router.post('/refresh', emailLimiter, async (req, res, next) => {
  const refreshToken = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : '';
  if (refreshToken.length < 40 || refreshToken.length > 200) return res.status(401).json({ error: 'Refresh session is invalid. Please sign in again.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query(
      'SELECT u.id, u.name, u.username, u.email, u.is_email_verified, u.created_at, rt.id AS refresh_id FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id WHERE rt.token_hash = $1 AND rt.expires_at > NOW() FOR UPDATE OF rt',
      [tokenHash(refreshToken)],
    );
    const user = found.rows[0];
    if (!user || !user.is_email_verified) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: 'Refresh session is invalid or expired. Please sign in again.' });
    }
    await client.query('DELETE FROM refresh_tokens WHERE id = $1', [user.refresh_id]);
    const session = await issueSession(user, client);
    await client.query('COMMIT');
    return res.json({ message: 'Session refreshed.', ...session });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    return next(error);
  } finally { client.release(); }
});

router.post('/logout', async (req, res, next) => {
  try {
    const refreshToken = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : '';
    if (refreshToken) await pool.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash(refreshToken)]);
    return res.json({ message: 'Signed out.' });
  } catch (error) { return next(error); }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT id, name, username, email, is_email_verified, created_at FROM users WHERE id = $1 LIMIT 1', [req.auth.sub]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Account not found.' });
    return res.json({ user: publicUser(result.rows[0]) });
  } catch (error) { return next(error); }
});

export default router;
