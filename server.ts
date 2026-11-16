import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'vmsm-db.json');
const FIREBASE_CONFIG_FILE = path.resolve(process.cwd(), 'firebase-applet-config.json');

interface OfficerRecord {
  id: string;
  fullName: string;
  grade: string;
  badgeNo: string;
  email: string;
  role: 'ADMIN' | 'PEGAWAI';
  passwordHash: string;
  firebaseSynced: boolean;
  localResetPending: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

interface VehicleLogItem {
  id: string;
  direction: 'IN' | 'OUT';
  boothNo: string;
  plateNo: string;
  notes: string;
  eventTimestamp: string;
  officerName: string;
  createdBy: string;
  createdByEmail: string;
  createdAtMs: number;
  updatedAtMs: number;
}

interface SessionItem {
  token: string;
  officerId: string;
  email: string;
  expiresAtMs: number;
}

interface DatabaseSchema {
  officers: OfficerRecord[];
  logs: VehicleLogItem[];
  sessions: SessionItem[];
}

const DEFAULT_OFFICER_SEED: Array<{
  id: string;
  fullName: string;
  grade: string;
  badgeNo: string;
  email: string;
  role: 'ADMIN' | 'PEGAWAI';
}> = [
  {
    id: 'off_admin_kastam',
    fullName: 'ADMIN VMSM (PENTADBIR SISTEM)',
    grade: 'PENTADBIR SISTEM',
    badgeNo: '',
    email: 'admin.apps.kastam@gmail.com',
    role: 'ADMIN',
  },
  {
    id: 'off_01',
    fullName: 'DOEHAILEE BIN BUJID',
    grade: 'PENOLONG PENGARAH KASTAM WK10',
    badgeNo: '',
    email: 'doehailee.bujid@customs.gov.my',
    role: 'PEGAWAI',
  },
  {
    id: 'off_02',
    fullName: 'PATRICK ANAK NUING',
    grade: 'PENGUASA KASTAM WK9',
    badgeNo: '',
    email: 'patrick.nuing@customs.gov.my',
    role: 'PEGAWAI',
  },
  {
    id: 'off_03',
    fullName: 'DAYANG HILFEE SIQDIQQA BT MOSTALI',
    grade: 'PENOLONG PENGUASA KASTAM KANAN WK6',
    badgeNo: '',
    email: 'hilfee.mustali@customs.gov.my',
    role: 'PEGAWAI',
  },
  {
    id: 'off_04',
    fullName: 'ABDUL HADI BIN ABDUL SAMAD',
    grade: 'PEGAWAI KASTAM KANAN TINGGI WK3',
    badgeNo: '9807',
    email: 'abd_hadi.samad@customs.gov.my',
    role: 'PEGAWAI',
  },
  {
    id: 'off_05',
    fullName: 'ZULKIFLEE BIN ADENAN',
    grade: 'PEGAWAI KASTAM KANAN WK2',
    badgeNo: '9921',
    email: 'zulkiflee.adenan@customs.gov.my',
    role: 'PEGAWAI',
  },
  {
    id: 'off_06',
    fullName: 'UNDY ANAK JALAI',
    grade: 'PEGAWAI KASTAM KANAN WK2',
    badgeNo: '10551',
    email: 'undy.jalai@customs.gov.my',
    role: 'PEGAWAI',
  },
  {
    id: 'off_07',
    fullName: 'NORHASYIMAH BINTI SOPIN',
    grade: 'PEGAWAI KASTAM KANAN WK2',
    badgeNo: '12609',
    email: 'nhasyimah.sopin@customs.gov.my',
    role: 'PEGAWAI',
  },
  {
    id: 'off_08',
    fullName: 'MOHAMAD FAIZZIL BIN AFFANDI',
    grade: 'PEGAWAI KASTAM KANAN WK2',
    badgeNo: '13308',
    email: 'faizzil.affandi@customs.gov.my',
    role: 'PEGAWAI',
  },
  {
    id: 'off_09',
    fullName: 'KAZA BIN MADI',
    grade: 'PEMBANTU PENGUASA KASTAM WK1',
    badgeNo: '15982',
    email: 'kaza.madi@customs.gov.my',
    role: 'PEGAWAI',
  },
  {
    id: 'off_10',
    fullName: 'SITI FARIZA BINTI KASIMAN',
    grade: 'PEMBANTU PENGUASA KASTAM WK1',
    badgeNo: '15989',
    email: 'fariza.kasiman@customs.gov.my',
    role: 'PEGAWAI',
  },
  {
    id: 'off_11',
    fullName: 'NOR SUHANA BINTI SUALIN',
    grade: 'PEMBANTU PENGUASA KASTAM WK1',
    badgeNo: '17108',
    email: 'suhanasualin@customs.gov.my',
    role: 'PEGAWAI',
  },
  {
    id: 'off_12',
    fullName: 'MOHAMAD TAUFIQ BIN SULAIMAN',
    grade: 'PEMBANTU PENGUASA KASTAM WK1',
    badgeNo: '17110',
    email: 'taufiq@customs.gov.my',
    role: 'PEGAWAI',
  },
  {
    id: 'off_13',
    fullName: 'MAS SAWAHNI BINTI MUNDING',
    grade: 'PEMBANTU PENGUASA KASTAM WK1',
    badgeNo: '17111',
    email: 'sawahni.munding@customs.gov.my',
    role: 'PEGAWAI',
  },
  {
    id: 'off_14',
    fullName: 'MOHD HASRUL LIZAM BIN HASSAN',
    grade: 'PEMBANTU PENGUASA KASTAM WK1',
    badgeNo: '17121',
    email: 'hasrullizam.hassan@customs.gov.my',
    role: 'PEGAWAI',
  },
  {
    id: 'off_15',
    fullName: 'MOHAMAD IZZAT AMIR BIN ROZAIDI',
    grade: 'PEMBANTU PENGUASA KASTAM WK1',
    badgeNo: '17137',
    email: 'izzat.amir@customs.gov.my',
    role: 'PEGAWAI',
  },
  {
    id: 'off_16',
    fullName: 'AZIZI SYAMINI SAHRAN BIN ADENAN',
    grade: 'PEMBANTU PENGUASA KASTAM WK1',
    badgeNo: '17143',
    email: 'azizi.adenan@customs.gov.my',
    role: 'PEGAWAI',
  },
  {
    id: 'off_17',
    fullName: 'NASRUL BIN ABDULLAH',
    grade: 'PEMBANTU PENGUASA KASTAM WK1',
    badgeNo: '19288',
    email: 'nasrul.abdullah@customs.gov.my',
    role: 'PEGAWAI',
  },
  {
    id: 'off_18',
    fullName: 'NICHOLAS BANAI',
    grade: 'PEMBANTU PENGUASA KASTAM WK1',
    badgeNo: '19290',
    email: 'nicholas.banai@customs.gov.my',
    role: 'PEGAWAI',
  },
  {
    id: 'off_19',
    fullName: 'NURUL FARIHA BINTI BAKAR',
    grade: 'PEMBANTU PENGUASA KASTAM WK1',
    badgeNo: '19396',
    email: 'fariha.bakar@customs.gov.my',
    role: 'PEGAWAI',
  },
];

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

function getFirebaseApiKey(): string {
  try {
    if (fs.existsSync(FIREBASE_CONFIG_FILE)) {
      const cfg = JSON.parse(fs.readFileSync(FIREBASE_CONFIG_FILE, 'utf8'));
      return String(cfg.apiKey || '');
    }
  } catch {
    // ignore
  }
  return '';
}

async function firebaseIdentityCall(
  endpoint: string,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; data: Record<string, unknown>; errorCode: string }> {
  const apiKey = getFirebaseApiKey();
  if (!apiKey) {
    return { ok: false, data: {}, errorCode: 'MISSING_API_KEY' };
  }
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      const errObj = data.error as { message?: string } | undefined;
      return { ok: false, data, errorCode: String(errObj?.message || 'FIREBASE_ERROR') };
    }
    return { ok: true, data, errorCode: '' };
  } catch {
    return { ok: false, data: {}, errorCode: 'NETWORK_ERROR' };
  }
}

function loadDb(): DatabaseSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const now = Date.now();
    const initial: DatabaseSchema = {
      officers: DEFAULT_OFFICER_SEED.map((o) => ({
        ...o,
        passwordHash: hashPassword('123456'),
        firebaseSynced: false,
        localResetPending: false,
        createdAtMs: now,
        updatedAtMs: now,
      })),
      logs: [],
      sessions: [],
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }

  const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) as DatabaseSchema;
  let dirty = false;

  // Ensure all default officers exist if missing
  const existingEmails = new Set(parsed.officers.map((o) => o.email.toLowerCase()));
  const now = Date.now();
  for (const seed of DEFAULT_OFFICER_SEED) {
    if (!existingEmails.has(seed.email.toLowerCase())) {
      parsed.officers.push({
        ...seed,
        passwordHash: hashPassword('123456'),
        firebaseSynced: false,
        localResetPending: false,
        createdAtMs: now,
        updatedAtMs: now,
      });
      dirty = true;
    }
  }

  // Prune expired sessions
  const activeSessions = (parsed.sessions || []).filter((s) => s.expiresAtMs > now);
  if (activeSessions.length !== (parsed.sessions || []).length) {
    parsed.sessions = activeSessions;
    dirty = true;
  }

  if (dirty) {
    saveDb(parsed);
  }
  return parsed;
}

function saveDb(db: DatabaseSchema) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

function sanitizeOfficer(o: OfficerRecord) {
  return {
    id: o.id,
    fullName: o.fullName,
    grade: o.grade,
    badgeNo: o.badgeNo,
    email: o.email,
    role: o.role,
    firebaseSynced: o.firebaseSynced,
    updatedAtMs: o.updatedAtMs,
  };
}

function extractToken(req: express.Request): string {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookieHeader = req.headers.cookie || '';
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [k, ...rest] = part.trim().split('=');
    if (k === 'vmsm_session') {
      return decodeURIComponent(rest.join('='));
    }
  }
  return '';
}

function getAuthenticatedOfficer(
  req: express.Request,
  db: DatabaseSchema
): OfficerRecord | null {
  const token = extractToken(req);
  if (!token) return null;
  const now = Date.now();
  const session = db.sessions.find((s) => s.token === token && s.expiresAtMs > now);
  if (!session) return null;
  return db.officers.find((o) => o.id === session.officerId) || null;
}

function getEffectiveMs(log: VehicleLogItem): number {
  const t = Date.parse(log.eventTimestamp);
  return Number.isNaN(t) ? log.createdAtMs : t;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Public Directory for Login Page Search + Dropdown (works in Guest Mode!)
  app.get('/api/auth/directory', (_req, res) => {
    const db = loadDb();
    const list = db.officers.map((o) => ({
      id: o.id,
      fullName: o.fullName,
      grade: o.grade,
      badgeNo: o.badgeNo,
      email: o.email,
      role: o.role,
    }));
    res.json({ officers: list });
  });

  // Current Session Check
  app.get('/api/auth/me', (req, res) => {
    const db = loadDb();
    const officer = getAuthenticatedOfficer(req, db);
    if (!officer) {
      res.status(401).json({ error: 'Tidak disahkan' });
      return;
    }
    res.json({ officer: sanitizeOfficer(officer) });
  });

  // Login (Verifies against Server + Firebase Auth when Email/Password is enabled)
  app.post('/api/auth/login', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      res.status(400).json({ error: 'Sila masukkan e-mel dan kata laluan.' });
      return;
    }

    const db = loadDb();
    const officer = db.officers.find((o) => o.email.toLowerCase() === email);
    if (!officer) {
      res.status(401).json({ error: 'E-mel tidak berdaftar dalam sistem ini.' });
      return;
    }

    // Attempt Firebase signInWithPassword first to stay 100% synced
    const fbSignIn = await firebaseIdentityCall('accounts:signInWithPassword', {
      email: officer.email,
      password,
      returnSecureToken: true,
    });

    let authenticated = false;
    let firebaseIdToken = '';

    if (fbSignIn.ok) {
      // Firebase accepted this password! Update local hash to match Firebase so both stay synced
      authenticated = true;
      firebaseIdToken = String(fbSignIn.data.idToken || '');
      officer.passwordHash = hashPassword(password);
      officer.firebaseSynced = true;
      officer.localResetPending = false;
      officer.updatedAtMs = Date.now();
      saveDb(db);
    } else if (
      fbSignIn.errorCode === 'PASSWORD_LOGIN_DISABLED' ||
      fbSignIn.errorCode === 'OPERATION_NOT_ALLOWED' ||
      fbSignIn.errorCode === 'MISSING_API_KEY' ||
      fbSignIn.errorCode === 'NETWORK_ERROR'
    ) {
      // Firebase Email/Password provider is disabled; authenticate against server scrypt hash
      authenticated = verifyPassword(password, officer.passwordHash);
    } else if (fbSignIn.errorCode === 'EMAIL_NOT_FOUND') {
      // User does not exist in Firebase Auth yet -> check server hash and auto-register in Firebase
      if (verifyPassword(password, officer.passwordHash)) {
        authenticated = true;
        const fbSignUp = await firebaseIdentityCall('accounts:signUp', {
          email: officer.email,
          password,
          displayName: officer.fullName,
          returnSecureToken: true,
        });
        if (fbSignUp.ok) {
          firebaseIdToken = String(fbSignUp.data.idToken || '');
          officer.firebaseSynced = true;
          officer.localResetPending = false;
          officer.updatedAtMs = Date.now();
          saveDb(db);
        }
      }
    } else {
      // Firebase rejected the password (e.g. INVALID_LOGIN_CREDENTIALS / INVALID_PASSWORD)
      // Only allow local hash if Admin explicitly did a local reset pending Firebase sync
      if (officer.localResetPending && verifyPassword(password, officer.passwordHash)) {
        authenticated = true;
      }
    }

    if (!authenticated) {
      res.status(401).json({ error: 'E-mel atau kata laluan salah.' });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAtMs = Date.now() + 1000 * 60 * 60 * 24 * 7; // 7 days
    db.sessions.push({
      token,
      officerId: officer.id,
      email: officer.email,
      expiresAtMs,
    });
    saveDb(db);

    res.setHeader(
      'Set-Cookie',
      `vmsm_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`
    );
    res.json({
      token,
      officer: sanitizeOfficer(officer),
      firebaseIdToken: firebaseIdToken || null,
    });
  });

  // Logout
  app.post('/api/auth/logout', (req, res) => {
    const token = extractToken(req);
    if (token) {
      const db = loadDb();
      db.sessions = db.sessions.filter((s) => s.token !== token);
      saveDb(db);
    }
    res.setHeader('Set-Cookie', 'vmsm_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
    res.json({ ok: true });
  });

  // Self-Service Change Password (Old Password, New Password, Confirm Password)
  app.post('/api/auth/change-password', async (req, res) => {
    const db = loadDb();
    const officer = getAuthenticatedOfficer(req, db);
    if (!officer) {
      res.status(401).json({ error: 'Sila log masuk terlebih dahulu.' });
      return;
    }

    const oldPassword = String(req.body?.oldPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    const confirmPassword = String(req.body?.confirmPassword || '');

    if (!oldPassword || !newPassword || !confirmPassword) {
      res.status(400).json({ error: 'Semua medan kata laluan diperlukan.' });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: 'Kata laluan baru mestilah sekurang-kurangnya 6 aksara.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      res.status(400).json({ error: 'Pengesahan kata laluan baru tidak sepadan.' });
      return;
    }
    if (!verifyPassword(oldPassword, officer.passwordHash)) {
      res.status(400).json({ error: 'Kata laluan lama tidak betul.' });
      return;
    }

    // Update server hash immediately so old password cannot be used anymore
    officer.passwordHash = hashPassword(newPassword);
    officer.updatedAtMs = Date.now();

    // Sync update to Firebase Auth if Email/Password is enabled
    let firebaseUpdated = false;
    let firebaseStatusNote = '';
    const fbLogin = await firebaseIdentityCall('accounts:signInWithPassword', {
      email: officer.email,
      password: oldPassword,
      returnSecureToken: true,
    });

    if (fbLogin.ok && fbLogin.data.idToken) {
      const fbUpdate = await firebaseIdentityCall('accounts:update', {
        idToken: fbLogin.data.idToken,
        password: newPassword,
        returnSecureToken: true,
      });
      if (fbUpdate.ok) {
        firebaseUpdated = true;
        officer.firebaseSynced = true;
        officer.localResetPending = false;
      } else {
        firebaseStatusNote = fbUpdate.errorCode;
      }
    } else if (fbLogin.errorCode === 'EMAIL_NOT_FOUND') {
      const fbSignUp = await firebaseIdentityCall('accounts:signUp', {
        email: officer.email,
        password: newPassword,
        displayName: officer.fullName,
        returnSecureToken: true,
      });
      if (fbSignUp.ok) {
        firebaseUpdated = true;
        officer.firebaseSynced = true;
        officer.localResetPending = false;
      }
    } else if (
      fbLogin.errorCode === 'PASSWORD_LOGIN_DISABLED' ||
      fbLogin.errorCode === 'OPERATION_NOT_ALLOWED'
    ) {
      firebaseStatusNote = 'PASSWORD_LOGIN_DISABLED';
    }

    saveDb(db);
    res.json({
      ok: true,
      firebaseUpdated,
      firebaseStatusNote,
    });
  });

  // Forgot Password -> Sends Firebase Password Reset URL
  app.post('/api/auth/forgot-password', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) {
      res.status(400).json({ error: 'Sila masukkan alamat e-mel berdaftar.' });
      return;
    }

    const db = loadDb();
    const officer = db.officers.find((o) => o.email.toLowerCase() === email);
    if (!officer) {
      res.status(404).json({ error: 'E-mel tersebut tidak ditemui dalam rekod pegawai sistem ini.' });
      return;
    }

    // Ensure account exists in Firebase before sending reset email (if Email/Password is enabled)
    await firebaseIdentityCall('accounts:signUp', {
      email: officer.email,
      password: crypto.randomBytes(12).toString('hex'),
      displayName: officer.fullName,
      returnSecureToken: false,
    });

    const origin = `${req.protocol}://${req.get('host')}`;
    const fbReset = await firebaseIdentityCall('accounts:sendOobCode', {
      requestType: 'PASSWORD_RESET',
      email: officer.email,
      continueUrl: origin,
    });

    if (!fbReset.ok) {
      if (
        fbReset.errorCode === 'PASSWORD_LOGIN_DISABLED' ||
        fbReset.errorCode === 'OPERATION_NOT_ALLOWED'
      ) {
        res.status(400).json({
          error:
            'Penghantaran URL set semula kata laluan Firebase memerlukan penyedia Email/Password diaktifkan di Firebase Console (Authentication > Sign-in method > Email/Password). Anda juga boleh meminta Admin (admin.apps.kastam@gmail.com) menetapkan semula kata laluan anda melalui menu Data Pegawai.',
          code: fbReset.errorCode,
        });
        return;
      }
      res.status(400).json({
        error: `Gagal menghantar pautan tetapan semula Firebase (${fbReset.errorCode}).`,
        code: fbReset.errorCode,
      });
      return;
    }

    res.json({
      ok: true,
      message: `Pautan tetapan semula kata laluan telah dihantar oleh Firebase ke ${officer.email}.`,
    });
  });

  // Confirm Firebase Password Reset URL (New Password + Confirm Password) & Sync Server Hash
  app.post('/api/auth/confirm-reset', async (req, res) => {
    const oobCode = String(req.body?.oobCode || '').trim();
    const newPassword = String(req.body?.newPassword || '');
    const confirmPassword = String(req.body?.confirmPassword || '');

    if (!oobCode) {
      res.status(400).json({ error: 'Kod pengesahan tetapan semula tidak sah.' });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: 'Kata laluan baru mestilah sekurang-kurangnya 6 aksara.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      res.status(400).json({ error: 'Pengesahan kata laluan baru tidak sepadan.' });
      return;
    }

    const fbConfirm = await firebaseIdentityCall('accounts:resetPassword', {
      oobCode,
      newPassword,
    });

    if (!fbConfirm.ok) {
      res.status(400).json({
        error: `Pautan tetapan semula tidak sah atau telah tamat tempoh (${fbConfirm.errorCode}).`,
      });
      return;
    }

    const resetEmail = String(fbConfirm.data.email || '').trim().toLowerCase();
    if (resetEmail) {
      const db = loadDb();
      const officer = db.officers.find((o) => o.email.toLowerCase() === resetEmail);
      if (officer) {
        officer.passwordHash = hashPassword(newPassword);
        officer.firebaseSynced = true;
        officer.localResetPending = false;
        officer.updatedAtMs = Date.now();
        // Invalidate existing sessions for security
        db.sessions = db.sessions.filter((s) => s.officerId !== officer.id);
        saveDb(db);
      }
    }

    res.json({
      ok: true,
      email: resetEmail,
      message: 'Kata laluan baru berjaya dikemas kini di Firebase dan sistem VMSM. Sila log masuk dengan kata laluan baru.',
    });
  });

  // Admin: List All Officers
  app.get('/api/officers', (req, res) => {
    const db = loadDb();
    const actor = getAuthenticatedOfficer(req, db);
    if (!actor) {
      res.status(401).json({ error: 'Sila log masuk.' });
      return;
    }
    res.json({ officers: db.officers.map(sanitizeOfficer) });
  });

  // Admin: Add Officer
  app.post('/api/officers', async (req, res) => {
    const db = loadDb();
    const actor = getAuthenticatedOfficer(req, db);
    if (!actor || actor.role !== 'ADMIN') {
      res.status(403).json({ error: 'Hanya Admin dibenarkan menambah pegawai.' });
      return;
    }

    const fullName = String(req.body?.fullName || '').trim().toUpperCase();
    const grade = String(req.body?.grade || '').trim().toUpperCase();
    const badgeNo = String(req.body?.badgeNo || '').trim().toUpperCase();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const role = req.body?.role === 'ADMIN' ? 'ADMIN' : 'PEGAWAI';
    const initialPassword = String(req.body?.password || '123456');

    if (!fullName || !email) {
      res.status(400).json({ error: 'Nama penuh dan e-mel rasmi diperlukan.' });
      return;
    }
    if (db.officers.some((o) => o.email.toLowerCase() === email)) {
      res.status(409).json({ error: 'E-mel ini telah berdaftar dalam sistem.' });
      return;
    }

    const now = Date.now();
    const newOfficer: OfficerRecord = {
      id: `off_${now}_${Math.random().toString(36).slice(2, 7)}`,
      fullName,
      grade: grade || 'PEMBANTU PENGUASA KASTAM WK1',
      badgeNo,
      email,
      role,
      passwordHash: hashPassword(initialPassword),
      firebaseSynced: false,
      localResetPending: false,
      createdAtMs: now,
      updatedAtMs: now,
    };

    const fbSignUp = await firebaseIdentityCall('accounts:signUp', {
      email: newOfficer.email,
      password: initialPassword,
      displayName: newOfficer.fullName,
      returnSecureToken: false,
    });
    if (fbSignUp.ok || fbSignUp.errorCode === 'EMAIL_EXISTS') {
      newOfficer.firebaseSynced = true;
    }

    db.officers.push(newOfficer);
    saveDb(db);
    res.status(201).json({ officer: sanitizeOfficer(newOfficer) });
  });

  // Admin: Edit Officer
  app.put('/api/officers/:id', (req, res) => {
    const db = loadDb();
    const actor = getAuthenticatedOfficer(req, db);
    if (!actor || actor.role !== 'ADMIN') {
      res.status(403).json({ error: 'Hanya Admin dibenarkan menyunting data pegawai.' });
      return;
    }

    const officer = db.officers.find((o) => o.id === req.params.id);
    if (!officer) {
      res.status(404).json({ error: 'Pegawai tidak ditemui.' });
      return;
    }

    const fullName = String(req.body?.fullName ?? officer.fullName).trim().toUpperCase();
    const grade = String(req.body?.grade ?? officer.grade).trim().toUpperCase();
    const badgeNo = String(req.body?.badgeNo ?? officer.badgeNo).trim().toUpperCase();
    const email = String(req.body?.email ?? officer.email).trim().toLowerCase();
    const role = req.body?.role === 'ADMIN' ? 'ADMIN' : 'PEGAWAI';

    if (!fullName || !email) {
      res.status(400).json({ error: 'Nama penuh dan e-mel tidak boleh kosong.' });
      return;
    }
    if (
      db.officers.some(
        (o) => o.id !== officer.id && o.email.toLowerCase() === email
      )
    ) {
      res.status(409).json({ error: 'E-mel tersebut telah digunakan oleh pegawai lain.' });
      return;
    }

    officer.fullName = fullName;
    officer.grade = grade;
    officer.badgeNo = badgeNo;
    officer.email = email;
    if (officer.email !== 'admin.apps.kastam@gmail.com') {
      officer.role = role;
    }
    officer.updatedAtMs = Date.now();
    saveDb(db);

    res.json({ officer: sanitizeOfficer(officer) });
  });

  // Admin: Delete Officer
  app.delete('/api/officers/:id', (req, res) => {
    const db = loadDb();
    const actor = getAuthenticatedOfficer(req, db);
    if (!actor || actor.role !== 'ADMIN') {
      res.status(403).json({ error: 'Hanya Admin dibenarkan memadam pegawai.' });
      return;
    }

    const officer = db.officers.find((o) => o.id === req.params.id);
    if (!officer) {
      res.status(404).json({ error: 'Pegawai tidak ditemui.' });
      return;
    }
    if (officer.email.toLowerCase() === 'admin.apps.kastam@gmail.com') {
      res.status(400).json({ error: 'Akaun pentadbir utama tidak boleh dipadam.' });
      return;
    }

    db.officers = db.officers.filter((o) => o.id !== req.params.id);
    db.sessions = db.sessions.filter((s) => s.officerId !== req.params.id);
    saveDb(db);
    res.json({ ok: true });
  });

  // Admin: Reset Officer Password
  app.post('/api/officers/:id/reset-password', async (req, res) => {
    const db = loadDb();
    const actor = getAuthenticatedOfficer(req, db);
    if (!actor || actor.role !== 'ADMIN') {
      res.status(403).json({ error: 'Hanya Admin dibenarkan menetapkan semula kata laluan pegawai.' });
      return;
    }

    const officer = db.officers.find((o) => o.id === req.params.id);
    if (!officer) {
      res.status(404).json({ error: 'Pegawai tidak ditemui.' });
      return;
    }

    const newPassword = String(req.body?.newPassword || '123456');
    if (newPassword.length < 6) {
      res.status(400).json({ error: 'Kata laluan baru mestilah sekurang-kurangnya 6 aksara.' });
      return;
    }

    officer.passwordHash = hashPassword(newPassword);
    officer.localResetPending = true;
    officer.updatedAtMs = Date.now();
    db.sessions = db.sessions.filter((s) => s.officerId !== officer.id);

    // Attempt to sync if Firebase still had default 123456 or doesn't exist yet
    let firebaseResetSent = false;
    const fbDefaultLogin = await firebaseIdentityCall('accounts:signInWithPassword', {
      email: officer.email,
      password: '123456',
      returnSecureToken: true,
    });

    if (fbDefaultLogin.ok && fbDefaultLogin.data.idToken) {
      const fbUpdate = await firebaseIdentityCall('accounts:update', {
        idToken: fbDefaultLogin.data.idToken,
        password: newPassword,
        returnSecureToken: true,
      });
      if (fbUpdate.ok) {
        officer.firebaseSynced = true;
        officer.localResetPending = false;
      }
    } else if (fbDefaultLogin.errorCode === 'EMAIL_NOT_FOUND') {
      const fbSignUp = await firebaseIdentityCall('accounts:signUp', {
        email: officer.email,
        password: newPassword,
        displayName: officer.fullName,
        returnSecureToken: false,
      });
      if (fbSignUp.ok) {
        officer.firebaseSynced = true;
        officer.localResetPending = false;
      }
    } else if (req.body?.sendFirebaseResetEmail) {
      const origin = `${req.protocol}://${req.get('host')}`;
      const fbReset = await firebaseIdentityCall('accounts:sendOobCode', {
        requestType: 'PASSWORD_RESET',
        email: officer.email,
        continueUrl: origin,
      });
      firebaseResetSent = fbReset.ok;
    }

    saveDb(db);
    res.json({
      ok: true,
      officer: sanitizeOfficer(officer),
      firebaseResetSent,
    });
  });

  // Admin: Sync All Registered Officers + Default Password (123456) to Firebase Auth
  app.post('/api/officers/sync-firebase', async (req, res) => {
    const db = loadDb();
    const actor = getAuthenticatedOfficer(req, db);
    if (!actor || actor.role !== 'ADMIN') {
      res.status(403).json({ error: 'Hanya Admin dibenarkan menyegerakkan ke Firebase.' });
      return;
    }

    let createdCount = 0;
    let existsCount = 0;
    let disabledInConsole = false;
    const errors: string[] = [];

    for (const officer of db.officers) {
      const fbRes = await firebaseIdentityCall('accounts:signUp', {
        email: officer.email,
        password: '123456',
        displayName: officer.fullName,
        returnSecureToken: false,
      });
      if (fbRes.ok) {
        createdCount += 1;
        officer.firebaseSynced = true;
      } else if (fbRes.errorCode === 'EMAIL_EXISTS') {
        existsCount += 1;
        officer.firebaseSynced = true;
      } else if (
        fbRes.errorCode === 'PASSWORD_LOGIN_DISABLED' ||
        fbRes.errorCode === 'OPERATION_NOT_ALLOWED' ||
        fbRes.errorCode === 'ADMIN_ONLY_OPERATION'
      ) {
        disabledInConsole = true;
        errors.push(`${officer.email}: ${fbRes.errorCode}`);
        break;
      } else {
        errors.push(`${officer.email}: ${fbRes.errorCode}`);
      }
    }

    saveDb(db);
    res.json({
      ok: !disabledInConsole,
      disabledInConsole,
      createdCount,
      existsCount,
      total: db.officers.length,
      errors,
    });
  });

  // Vehicle Logs: List All
  app.get('/api/logs', (req, res) => {
    const db = loadDb();
    const actor = getAuthenticatedOfficer(req, db);
    if (!actor) {
      res.status(401).json({ error: 'Sila log masuk.' });
      return;
    }
    const sorted = [...db.logs].sort((a, b) => getEffectiveMs(b) - getEffectiveMs(a));
    res.json({ logs: sorted });
  });

  // Vehicle Logs: Create (Auto stamps officerName & officerEmail + 5-min dedup check)
  app.post('/api/logs', (req, res) => {
    const db = loadDb();
    const actor = getAuthenticatedOfficer(req, db);
    if (!actor) {
      res.status(401).json({ error: 'Sila log masuk.' });
      return;
    }

    const direction = req.body?.direction === 'OUT' ? 'OUT' : 'IN';
    const boothNo = String(req.body?.boothNo || '');
    const plateNo = String(req.body?.plateNo || '').trim().toUpperCase().slice(0, 64);
    const notes = String(req.body?.notes || '').trim().slice(0, 200);
    const eventTimestamp = String(req.body?.eventTimestamp || new Date().toISOString()).slice(0, 40);

    const validBooth =
      (direction === 'IN' && ['5', '6', '7', '8', '9', '10'].includes(boothNo)) ||
      (direction === 'OUT' && ['1', '2', '3', '4'].includes(boothNo));

    if (!validBooth || !plateNo) {
      res.status(400).json({ error: 'Nombor plat atau booth tidak sah.' });
      return;
    }

    const nowMs = Date.now();
    const targetMs = Date.parse(eventTimestamp) || nowMs;
    const duplicate = db.logs.find(
      (l) =>
        l.direction === direction &&
        l.plateNo.trim().toUpperCase() === plateNo &&
        Math.abs(targetMs - getEffectiveMs(l)) <= 5 * 60 * 1000
    );

    if (duplicate) {
      res.status(409).json({
        error: 'Pendua dalam tempoh 5 minit dihapuskan secara automatik.',
        duplicate,
      });
      return;
    }

    const newLog: VehicleLogItem = {
      id: `log_${nowMs}_${Math.random().toString(36).slice(2, 8)}`,
      direction,
      boothNo,
      plateNo,
      notes,
      eventTimestamp,
      officerName: actor.fullName,
      createdBy: actor.id,
      createdByEmail: actor.email,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    };

    db.logs.unshift(newLog);
    saveDb(db);
    res.status(201).json({ log: newLog });
  });

  // Vehicle Logs: Inline Update
  app.put('/api/logs/:id', (req, res) => {
    const db = loadDb();
    const actor = getAuthenticatedOfficer(req, db);
    if (!actor) {
      res.status(401).json({ error: 'Sila log masuk.' });
      return;
    }

    const log = db.logs.find((l) => l.id === req.params.id);
    if (!log) {
      res.status(404).json({ error: 'Rekod tidak ditemui.' });
      return;
    }

    if (req.body?.boothNo !== undefined) {
      const nextBooth = String(req.body.boothNo);
      const validBooth =
        (log.direction === 'IN' && ['5', '6', '7', '8', '9', '10'].includes(nextBooth)) ||
        (log.direction === 'OUT' && ['1', '2', '3', '4'].includes(nextBooth));
      if (validBooth) log.boothNo = nextBooth;
    }
    if (req.body?.plateNo !== undefined) {
      const nextPlate = String(req.body.plateNo).trim().toUpperCase().slice(0, 64);
      if (nextPlate) log.plateNo = nextPlate;
    }
    if (req.body?.notes !== undefined) {
      log.notes = String(req.body.notes).trim().slice(0, 200);
    }
    if (req.body?.eventTimestamp !== undefined) {
      const nextTs = String(req.body.eventTimestamp).slice(0, 40);
      if (nextTs) log.eventTimestamp = nextTs;
    }
    log.updatedAtMs = Date.now();
    saveDb(db);
    res.json({ log });
  });

  // Vehicle Logs: Delete
  app.delete('/api/logs/:id', (req, res) => {
    const db = loadDb();
    const actor = getAuthenticatedOfficer(req, db);
    if (!actor) {
      res.status(401).json({ error: 'Sila log masuk.' });
      return;
    }

    const beforeLen = db.logs.length;
    db.logs = db.logs.filter((l) => l.id !== req.params.id);
    if (db.logs.length === beforeLen) {
      res.status(404).json({ error: 'Rekod tidak ditemui.' });
      return;
    }
    saveDb(db);
    res.json({ ok: true });
  });

  // Vite dev middleware vs static production dist
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VMSM server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
