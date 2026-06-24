import { registerUser, loginUser, googleLogin, signToken, getUsers, saveUsers } from '../services/userService.js';

export async function register(req, res) {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'username, email and password are required' });
  try {
    const user  = await registerUser({ username, email, password });
    const token = signToken(user);
    res.json({ ok: true, token, user: { id: user.id, username: user.username, email: user.email, role: user.role } });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
}

export async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
  try {
    const user  = await loginUser({ email, password });
    const token = signToken(user);
    res.json({ ok: true, token, user: { id: user.id, username: user.username, email: user.email, role: user.role } });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
}

export async function googleAuth(req, res) {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'Missing Google credential' });
  try {
    const user  = await googleLogin(credential);
    const token = signToken(user);
    res.json({ ok: true, token, user: { id: user.id, username: user.username, email: user.email, role: user.role } });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
}

export function me(req, res) {
  const user = getUsers().find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, username: user.username, email: user.email, role: user.role });
}

export function listUsers(req, res) {
  res.json(getUsers().map(({ passwordHash, ...u }) => u));
}

export function updateUserRole(req, res) {
  const { role } = req.body;
  if (!['admin', 'viewer'].includes(role)) return res.status(400).json({ error: 'Role must be admin or viewer' });
  const users = getUsers();
  const user  = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.role = role;
  saveUsers(users);
  res.json({ ok: true });
}

export function deleteUser(req, res) {
  const users = getUsers();
  const idx   = users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  users.splice(idx, 1);
  saveUsers(users);
  res.json({ ok: true });
}
