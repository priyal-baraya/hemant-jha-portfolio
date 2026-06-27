import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USERS_PATH = path.join(__dirname, '../../data/users.json');
const JWT_SECRET  = process.env.JWT_SECRET || 'hemant-secret-key-change-me';

export const getUsers  = () => { try { return JSON.parse(fs.readFileSync(USERS_PATH, 'utf-8')); } catch { return []; } };
export const saveUsers = (u) => fs.writeFileSync(USERS_PATH, JSON.stringify(u, null, 2));

export function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

export async function registerUser({ username, email, password }) {
  const users = getUsers();
  if (users.find(u => u.email === email))     throw Object.assign(new Error('Email already registered'), { status: 409 });
  if (users.find(u => u.username === username)) throw Object.assign(new Error('Username already taken'), { status: 409 });
  const hash = await bcrypt.hash(password, 10);
  const role = users.length === 0 ? 'admin' : 'viewer';
  const user = { id: Date.now().toString(), username, email, passwordHash: hash, role, createdAt: new Date().toISOString() };
  users.push(user);
  saveUsers(users);
  return user;
}

export async function loginUser({ email, password }) {
  const users = getUsers();
  const user  = users.find(u => u.email === email);
  if (!user) throw Object.assign(new Error('Invalid email or password'), { status: 401 });
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw Object.assign(new Error('Invalid email or password'), { status: 401 });
  return user;
}

const getGoogleClient = () => process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;
const getAdminEmails  = () => (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

export async function googleLogin(credential) {
  const googleClient = getGoogleClient();
  if (!googleClient) throw Object.assign(new Error('Google login not configured. Set GOOGLE_CLIENT_ID in .env'), { status: 503 });
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch { throw Object.assign(new Error('Invalid Google credential'), { status: 401 }); }

  const email = (payload.email || '').toLowerCase();
  if (!payload.email_verified) throw Object.assign(new Error('Google email not verified'), { status: 401 });
  if (!getAdminEmails().includes(email)) throw Object.assign(new Error('This Google account is not authorized for admin access'), { status: 403 });

  const users = getUsers();
  let user = users.find(u => u.email.toLowerCase() === email);
  if (!user) {
    user = { id: Date.now().toString(), username: payload.name || email.split('@')[0], email, passwordHash: null, role: 'admin', authProvider: 'google', createdAt: new Date().toISOString() };
    users.push(user);
  } else {
    user.role = 'admin';
  }
  saveUsers(users);
  return user;
}
