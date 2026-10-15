import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import User from '../models/User.js';

const router = Router();
const codeTtlMinutes = Math.min(30, Math.max(5, Number(process.env.EMAIL_CODE_TTL_MINUTES || 10)));
const resendCooldownSeconds = Math.max(30, Number(process.env.EMAIL_RESEND_COOLDOWN_SECONDS || 60));
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const usernamePattern = /^[a-zA-Z0-9_.]{3,24}$/;
const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please wait before trying again.' },
});

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}
function normalizeUsername(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}
function codeHash(email, code) {
  return createHmac('sha256', process.env.JWT_SECRET).update(`${email}:${code}`).digest('hex');
}
function safeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}
function issueToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '2h', issuer: 'kingshall-auth-api', audience: 'kingshall-app' },
  );
}
function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    isEmailVerified: user.isEmailVerified,
    createdAt: user.createdAt,
  };
}
function passwordProblem(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    return 'Password must be between 12 and 128 characters.';
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return 'Use uppercase and lowercase letters, a number, and a symbol in your password.';
  }
  return null;
}
async function sendVerificationEmail(email, name, code) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [email],
      subject: 'Your KingsHall email verification code',
      text: `Hello ${name},\n\nYour KingsHall verification code is: ${code}\n\nIt expires in ${codeTtlMinutes} minutes. If you did not request this, you can ignore this email.\n\nKingsHall`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#171525"><h2>Verify your KingsHall email</h2><p>Hello ${escapeHtml(name)},</p><p>Enter this code in KingsHall to verify your email address:</p><div style="font-size:30px;font-weight:700;letter-spacing:8px;padding:18px;background:#f2efff;border-radius:12px;text-align:center">${code}</div><p>This code expires in ${codeTtlMinutes} minutes. If you did not request this, you can ignore this email.</p></div>`,
    }),
  });
  if (!response.ok) {
    const details = await response.text().catch(() => '');
    console.error('Email provider rejected verification message:', response.status, details.slice(0, 400));
    throw new Error('Email delivery failed.');
  }
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
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

    const existing = await User.findOne({ $or: [{ email }, { username }] }).select('+emailVerificationSentAt');
    if (existing) {
      if (existing.email === email && !existing.isEmailVerified) {
        const elapsed = existing.emailVerificationSentAt ? (Date.now() - existing.emailVerificationSentAt.getTime()) / 1000 : Infinity;
        if (elapsed < resendCooldownSeconds) {
          return res.status(409).json({ error: 'An account with this email is already awaiting verification. Check your inbox or try resending the code shortly.', code: 'VERIFICATION_PENDING' });
        }
      }
      return res.status(409).json({ error: existing.email === email ? 'An account with this email already exists.' : 'That username is already taken.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    const user = await User.create({
      name,
      username,
      email,
      passwordHash,
      isEmailVerified: false,
      emailVerificationCodeHash: codeHash(email, code),
      emailVerificationExpiresAt: new Date(Date.now() + codeTtlMinutes * 60 * 1000),
      emailVerificationSentAt: new Date(),
    });

    try {
      await sendVerificationEmail(email, name, code);
    } catch {
      // Keep the pending account so the user can request another code after the cooldown.
      return res.status(503).json({
        error: 'Your account was created but the verification email could not be sent. Please try resending the code later.',
        code: 'EMAIL_DELIVERY_FAILED',
      });
    }

    return res.status(201).json({
      message: 'Account created. Enter the verification code sent to your email before logging in.',
      email,
      verificationRequired: true,
      expiresInSeconds: codeTtlMinutes * 60,
    });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ error: 'That email or username is already registered.' });
    return next(error);
  }
});

router.post('/verify-email', emailLimiter, async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    if (!emailPattern.test(email) || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Enter a valid email address and the six-digit verification code.' });
    }

    const user = await User.findOne({ email })
      .select('+emailVerificationCodeHash +emailVerificationExpiresAt');
    if (!user) return res.status(400).json({ error: 'The code is invalid or expired. Request a new code and try again.' });
    if (user.isEmailVerified) return res.status(200).json({ message: 'Email is already verified. You can log in now.' });

    const expectedHash = codeHash(email, code);
    if (!user.emailVerificationCodeHash || !user.emailVerificationExpiresAt ||
        user.emailVerificationExpiresAt.getTime() < Date.now() ||
        !safeEqual(user.emailVerificationCodeHash, expectedHash)) {
      return res.status(400).json({ error: 'The code is invalid or expired. Request a new code and try again.' });
    }

    user.isEmailVerified = true;
    user.emailVerificationCodeHash = undefined;
    user.emailVerificationExpiresAt = undefined;
    user.emailVerificationSentAt = undefined;
    await user.save();
    return res.status(200).json({ message: 'Email verified successfully. You can now log in.' });
  } catch (error) {
    return next(error);
  }
});

router.post('/resend-verification', emailLimiter, async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!emailPattern.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });

    const user = await User.findOne({ email }).select('+emailVerificationSentAt');
    if (!user || user.isEmailVerified) {
      return res.status(200).json({ message: 'If that address has a pending KingsHall account, a verification email will be sent when eligible.' });
    }

    const elapsed = user.emailVerificationSentAt ? (Date.now() - user.emailVerificationSentAt.getTime()) / 1000 : Infinity;
    if (elapsed < resendCooldownSeconds) {
      return res.status(429).json({ error: `Please wait ${Math.ceil(resendCooldownSeconds - elapsed)} seconds before requesting another code.` });
    }

    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    user.emailVerificationCodeHash = codeHash(email, code);
    user.emailVerificationExpiresAt = new Date(Date.now() + codeTtlMinutes * 60 * 1000);
    user.emailVerificationSentAt = new Date();
    await user.save();

    try {
      await sendVerificationEmail(email, user.name, code);
    } catch {
      return res.status(503).json({ error: 'The verification email could not be sent. Please try again later.' });
    }

    return res.status(200).json({ message: 'A new verification code has been sent if the account is eligible.' });
  } catch (error) {
    return next(error);
  }
});

router.post('/login', emailLimiter, async (req, res, next) => {
  try {
    const identity = typeof req.body?.identity === 'string' ? req.body.identity.trim() : '';
    const password = req.body?.password;
    if (!identity || typeof password !== 'string' || password.length > 128) {
      return res.status(400).json({ error: 'Enter your email or username and password.' });
    }

    const isEmail = identity.includes('@');
    const lookup = isEmail ? normalizeEmail(identity) : normalizeUsername(identity);
    const user = await User.findOne(isEmail ? { email: lookup } : { username: lookup })
      .select('+passwordHash +failedLoginCount +loginBlockedUntil');

    if (!user) return res.status(401).json({ error: 'Email/username or password is incorrect.' });
    if (user.loginBlockedUntil && user.loginBlockedUntil.getTime() > Date.now()) {
      return res.status(429).json({ error: 'Too many unsuccessful attempts. Please wait before trying again.' });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      user.failedLoginCount = (user.failedLoginCount || 0) + 1;
      if (user.failedLoginCount >= 8) {
        user.failedLoginCount = 0;
        user.loginBlockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
      await user.save();
      return res.status(401).json({ error: 'Email/username or password is incorrect.' });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        error: 'Verify your email before logging in.',
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email,
      });
    }

    user.failedLoginCount = 0;
    user.loginBlockedUntil = undefined;
    await user.save();

    return res.status(200).json({
      message: 'Login successful.',
      token: issueToken(user),
      tokenType: 'Bearer',
      expiresInSeconds: 7200,
      user: publicUser(user),
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
