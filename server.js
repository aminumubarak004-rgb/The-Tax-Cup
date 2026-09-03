const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');

const app = express();
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
const rootDir = __dirname;
const usersFile = path.join(rootDir, 'users.json');
const sessionCookie = 'taxcup_session';
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

function readUsers() {
  try {
    const raw = fs.readFileSync(usersFile, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

function hashPassword(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function ensureDemoUser() {
  const users = readUsers();
  const exists = users.some((user) => user.email === 'admin@taxcup.local');
  if (!exists) {
    users.unshift({
      id: 'USR-ADMIN',
      name: 'Demo administrator',
      email: 'admin@taxcup.local',
      department: 'Finance',
      title: 'System administrator',
      role: 'Super Administrator',
      passwordHash: hashPassword('demo-password'),
      active: true,
      createdAt: new Date().toISOString(),
      lastActivity: null,
    });
    writeUsers(users);
  }
}

function getSessionUser(req) {
  const sessionValue = req.cookies && req.cookies[sessionCookie];
  if (!sessionValue) return null;
  try {
    const [encodedPayload, signature] = sessionValue.split('.');
    if (!encodedPayload || !signature) return null;
    const expectedSignature = crypto.createHmac('sha256', sessionSecret).update(encodedPayload).digest('base64url');
    if (signature.length !== expectedSignature.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) return null;
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (!payload || !payload.id) return null;
    const users = readUsers();
    const user = users.find((item) => item.id === payload.id && item.active !== false);
    if (!user) return null;
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  } catch (error) {
    return null;
  }
}

function setSessionCookie(res, user) {
  const encodedPayload = Buffer.from(JSON.stringify({ id: user.id, name: user.name, email: user.email, role: user.role })).toString('base64url');
  const signature = crypto.createHmac('sha256', sessionSecret).update(encodedPayload).digest('base64url');
  res.cookie(sessionCookie, `${encodedPayload}.${signature}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 1000 * 60 * 60 * 12,
  });
}

function clearSessionCookie(res) {
  res.clearCookie(sessionCookie, { httpOnly: true, sameSite: 'lax', secure: false });
}

ensureDemoUser();
app.use(express.json());
app.use(cookieParser());

function requireSession(req, res, next) {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ ok: false, message: 'Please sign in first.' });
  req.sessionUser = user;
  next();
}

function requireAdministrator(req, res, next) {
  if (req.sessionUser?.role !== 'Super Administrator') return res.status(403).json({ ok: false, message: 'Only a Super Administrator can manage users.' });
  next();
}

app.use((req, res, next) => {
  const requestedPage = path.basename(req.path || '') || 'index.html';
  const needsAuth = req.method === 'GET' && requestedPage.endsWith('.html') && requestedPage !== 'login.html' && !req.path.startsWith('/api/');
  if (needsAuth) {
    const user = getSessionUser(req);
    if (!user) {
      const redirectTarget = `login.html?redirect=${encodeURIComponent(requestedPage)}`;
      return res.redirect(redirectTarget);
    }
  }
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, name: 'Tax Cup API' });
});

app.get('/api/session', (req, res) => {
  const user = getSessionUser(req);
  res.json({ authenticated: !!user, user: user || null });
});

app.get('/api/users', requireSession, requireAdministrator, (req, res) => {
  const users = readUsers().map(({ id, name, email, department, title, role, active, createdAt, lastActivity }) => ({ id, name, email, department, title, role, active, createdAt, lastActivity }));
  res.json({ ok: true, users });
});

app.post('/api/users', requireSession, requireAdministrator, (req, res) => {
  const payload = req.body || {};
  const name = String(payload.name || '').trim();
  const email = String(payload.email || '').trim().toLowerCase();
  const password = String(payload.password || '');
  const department = String(payload.department || '').trim();
  const title = String(payload.title || '').trim();
  const role = String(payload.role || 'HR Manager').trim();

  if (!name || !email || !password) {
    return res.status(400).json({ ok: false, message: 'Name, email and password are required.' });
  }

  const users = readUsers();
  const duplicate = users.some((item) => item.email && item.email.toLowerCase() === email);
  if (duplicate) {
    return res.status(409).json({ ok: false, message: 'A user with this email already exists.' });
  }

  const newUser = {
    id: `USR-${Date.now()}`,
    name,
    email,
    department,
    title,
    role,
    passwordHash: hashPassword(password),
    active: true,
    createdAt: new Date().toISOString(),
    lastActivity: null,
  };

  users.unshift(newUser);
  writeUsers(users);
  res.json({ ok: true, user: { id: newUser.id, name: newUser.name, email: newUser.email, department: newUser.department, title: newUser.title, role: newUser.role, active: newUser.active, createdAt: newUser.createdAt } });
});

app.post('/api/login', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const users = readUsers();
  const user = users.find((item) => item.email && item.email.toLowerCase() === email && item.active !== false && item.passwordHash === hashPassword(password));

  if (!user) {
    return res.status(401).json({ ok: false, message: 'The email or password is incorrect, or the account is inactive.' });
  }

  const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role };
  setSessionCookie(res, safeUser);
  user.lastActivity = new Date().toISOString();
  writeUsers(users.map((item) => (item.id === user.id ? user : item)));
  const redirectTo = req.body?.redirect || 'index.html';
  res.json({ ok: true, user: safeUser, redirect: redirectTo });
});

app.post('/api/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.use((req, res, next) => {
  const blockedFiles = new Set(['users.json', 'server.js', 'package.json', 'package-lock.json']);
  if (blockedFiles.has(path.basename(req.path))) return res.status(404).end();
  next();
});

app.use(express.static(rootDir, { index: false }));

app.get('/login.html', (req, res, next) => {
  if (getSessionUser(req)) {
    return res.redirect('/index.html');
  }
  next();
});

app.get('/index.html', (req, res) => {
  if (!getSessionUser(req)) {
    return res.redirect('/login.html?redirect=index.html');
  }
  res.sendFile(path.join(rootDir, 'index.html'));
});

app.get('/employees.html', (req, res) => {
  if (!getSessionUser(req)) {
    return res.redirect('/login.html?redirect=employees.html');
  }
  res.sendFile(path.join(rootDir, 'employees.html'));
});

app.get('/company.html', (req, res) => {
  if (!getSessionUser(req)) {
    return res.redirect('/login.html?redirect=company.html');
  }
  res.sendFile(path.join(rootDir, 'company.html'));
});

app.get('/payroll.html', (req, res) => {
  if (!getSessionUser(req)) {
    return res.redirect('/login.html?redirect=payroll.html');
  }
  res.sendFile(path.join(rootDir, 'payroll.html'));
});

app.get('*', (req, res) => {
  if (!getSessionUser(req)) return res.redirect('/login.html?redirect=index.html');
  res.sendFile(path.join(rootDir, 'index.html'));
});

app.listen(port, host, () => {
  console.log(`Tax Cup auth server is running on http://localhost:${port}`);
  console.log('Network access is enabled on all interfaces. Use this computer\'s LAN IPv4 address with port 3000.');
});
