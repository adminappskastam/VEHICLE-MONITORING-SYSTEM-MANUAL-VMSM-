import {
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import {
  auth,
  db,
  firebaseSignInEmail,
  firebaseSignOut,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import {
  BoothNo,
  Direction,
  OfficerProfile,
  OfficerRole,
  VehicleLogRecord,
} from '../types/vms';

const TOKEN_STORAGE_KEY = 'vmsm_auth_token';
let memoryToken = '';

export function getAuthToken(): string {
  if (memoryToken) return memoryToken;
  try {
    const stored = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) {
      memoryToken = stored;
      return stored;
    }
  } catch {
    // Guest/restricted storage fallback to memoryToken
  }
  return '';
}

export function setAuthToken(token: string) {
  memoryToken = token;
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage restriction
  }
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Ralat pelayan (${res.status})`);
  }
  return data as T;
}

export async function fetchOfficerDirectory(): Promise<OfficerProfile[]> {
  const res = await apiFetch<{ officers: OfficerProfile[] }>('/api/auth/directory');
  return res.officers;
}

export async function fetchCurrentSession(): Promise<OfficerProfile | null> {
  try {
    const res = await apiFetch<{ officer: OfficerProfile }>('/api/auth/me');
    return res.officer;
  } catch {
    return null;
  }
}

export async function loginWithCredentials(
  email: string,
  password: string
): Promise<OfficerProfile> {
  const res = await apiFetch<{ token: string; officer: OfficerProfile }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setAuthToken(res.token);

  // Also establish Firebase client auth session silently if Email/Password is enabled
  try {
    await firebaseSignInEmail(email, password);
  } catch {
    // Non-blocking if Email/Password is not yet toggled in Firebase Console
  }

  return res.officer;
}

export async function logoutSession(): Promise<void> {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } finally {
    setAuthToken('');
    try {
      await firebaseSignOut();
    } catch {
      // Ignore
    }
  }
}

export async function changeOwnPassword(params: {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<{ ok: boolean; firebaseUpdated: boolean; firebaseStatusNote?: string }> {
  return apiFetch('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function requestPasswordResetUrl(email: string): Promise<{ ok: boolean; message: string }> {
  return apiFetch('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function confirmPasswordResetUrl(params: {
  oobCode: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<{ ok: boolean; email: string; message: string }> {
  return apiFetch('/api/auth/confirm-reset', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// Admin Officer CRUD
export async function fetchAllOfficers(): Promise<OfficerProfile[]> {
  const res = await apiFetch<{ officers: OfficerProfile[] }>('/api/officers');
  return res.officers;
}

export async function createOfficerAccount(payload: {
  fullName: string;
  grade: string;
  badgeNo: string;
  email: string;
  role: OfficerRole;
  password?: string;
}): Promise<OfficerProfile> {
  const res = await apiFetch<{ officer: OfficerProfile }>('/api/officers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.officer;
}

export async function updateOfficerAccount(
  id: string,
  payload: {
    fullName: string;
    grade: string;
    badgeNo: string;
    email: string;
    role: OfficerRole;
  }
): Promise<OfficerProfile> {
  const res = await apiFetch<{ officer: OfficerProfile }>(`/api/officers/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return res.officer;
}

export async function deleteOfficerAccount(id: string): Promise<void> {
  await apiFetch(`/api/officers/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function adminResetOfficerPassword(
  id: string,
  newPassword: string,
  sendFirebaseResetEmail = false
): Promise<{ ok: boolean; officer: OfficerProfile; firebaseResetSent: boolean }> {
  return apiFetch(`/api/officers/${encodeURIComponent(id)}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ newPassword, sendFirebaseResetEmail }),
  });
}

export async function syncAllOfficersToFirebase(): Promise<{
  ok: boolean;
  disabledInConsole: boolean;
  createdCount: number;
  existsCount: number;
  total: number;
  errors: string[];
}> {
  return apiFetch('/api/officers/sync-firebase', {
    method: 'POST',
  });
}

// Vehicle Logs CRUD + Optional Verified Firestore Mirror
export async function fetchAllVehicleLogs(): Promise<VehicleLogRecord[]> {
  const res = await apiFetch<{ logs: VehicleLogRecord[] }>('/api/logs');
  return res.logs;
}

export async function createVehicleLog(params: {
  direction: Direction;
  boothNo: BoothNo;
  plateNo: string;
  notes: string;
  eventTimestamp: string;
}): Promise<VehicleLogRecord> {
  const res = await apiFetch<{ log: VehicleLogRecord }>('/api/logs', {
    method: 'POST',
    body: JSON.stringify(params),
  });

  // Mirror to Firestore when Firebase user is verified
  if (auth.currentUser && auth.currentUser.emailVerified) {
    const log = res.log;
    try {
      await setDoc(doc(db, 'vehicleLogs', log.id), {
        direction: log.direction,
        boothNo: log.boothNo,
        plateNo: log.plateNo,
        notes: log.notes,
        eventTimestamp: log.eventTimestamp,
        officerName: log.officerName,
        createdBy: auth.currentUser.uid,
        createdByEmail: auth.currentUser.email || log.createdByEmail,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.CREATE, `vehicleLogs/${log.id}`);
      } catch {
        // Keep primary server save intact
      }
    }
  }

  return res.log;
}

export async function updateVehicleLog(
  logId: string,
  updates: {
    boothNo?: BoothNo;
    plateNo?: string;
    notes?: string;
    eventTimestamp?: string;
  }
): Promise<VehicleLogRecord> {
  const res = await apiFetch<{ log: VehicleLogRecord }>(
    `/api/logs/${encodeURIComponent(logId)}`,
    {
      method: 'PUT',
      body: JSON.stringify(updates),
    }
  );

  if (auth.currentUser && auth.currentUser.emailVerified) {
    try {
      const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (updates.boothNo !== undefined) payload.boothNo = updates.boothNo;
      if (updates.plateNo !== undefined) payload.plateNo = updates.plateNo.trim().toUpperCase().slice(0, 64);
      if (updates.notes !== undefined) payload.notes = updates.notes.trim().slice(0, 200);
      if (updates.eventTimestamp !== undefined) payload.eventTimestamp = updates.eventTimestamp.slice(0, 40);
      await updateDoc(doc(db, 'vehicleLogs', logId), payload);
    } catch {
      // Non-blocking mirror
    }
  }

  return res.log;
}

export async function deleteVehicleLog(logId: string): Promise<void> {
  await apiFetch(`/api/logs/${encodeURIComponent(logId)}`, {
    method: 'DELETE',
  });

  if (auth.currentUser && auth.currentUser.emailVerified) {
    try {
      await deleteDoc(doc(db, 'vehicleLogs', logId));
    } catch {
      // Non-blocking mirror
    }
  }
}
