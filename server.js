const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');

const app = express();
const port = process.env.PORT || 3000;
const rootDir = __dirname;
const usersFile = path.join(rootDir, 'users.json');
const sessionCookie = 'taxcup_session';
const protectedPages = new Set(['index.html', 'employees.html', 'company.html', 'payroll.html']);

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
    const payload = JSON.parse(Buffer.from(sessionValue, 'base64').toString('utf8'));
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
  const payload = Buffer.from(JSON.stringify({ id: user.id, name: user.name, email: user.email, role: user.role })).toString('base64');
  res.cookie(sessionCookie, payload, {
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

app.use((req, res, next) => {
  const requestedPage = path.basename(req.path || '');
  const needsAuth = protectedPages.has(requestedPage) && !req.path.startsWith('/api/');
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
  res.sendFile(path.join(rootDir, 'index.html'));
});

app.listen(port, () => {
  console.log(`Tax Cup auth server is running on http://localhost:${port}`);
});
