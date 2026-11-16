import { initializeApp } from 'firebase/app';
import {
  confirmPasswordReset,
  EmailAuthProvider,
  getAuth,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  verifyPasswordResetCode,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export async function firebaseSignInEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function firebaseUpdatePassword(oldPassword: string, newPassword: string) {
  if (!auth.currentUser || !auth.currentUser.email) return;
  const cred = EmailAuthProvider.credential(auth.currentUser.email, oldPassword);
  await reauthenticateWithCredential(auth.currentUser, cred);
  await updatePassword(auth.currentUser, newPassword);
}

export async function firebaseVerifyResetCode(oobCode: string) {
  return verifyPasswordResetCode(auth, oobCode);
}

export async function firebaseConfirmReset(oobCode: string, newPassword: string) {
  return confirmPasswordReset(auth, oobCode, newPassword);
}

export async function firebaseSignOut() {
  return signOut(auth);
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testConnection();
