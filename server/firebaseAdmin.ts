import fs from 'node:fs';
import path from 'node:path';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

interface FirebaseAppletConfig {
  projectId: string;
  firestoreDatabaseId: string;
}

function loadFirebaseAppletConfig(): FirebaseAppletConfig {
  const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as FirebaseAppletConfig;
  return raw;
}

const appletConfig = loadFirebaseAppletConfig();

let adminApp: App | null = null;
let adminDb: Firestore | null = null;
let hasExplicitServiceAccount = false;

function getAdminApp(): App {
  if (adminApp) return adminApp;
  const existing = getApps()[0];
  if (existing) {
    adminApp = existing;
    return adminApp;
  }

  const saJson = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  if (saJson) {
    const parsed = JSON.parse(saJson);
    adminApp = initializeApp({
      credential: cert(parsed),
      projectId: appletConfig.projectId,
    });
    hasExplicitServiceAccount = true;
  } else {
    adminApp = initializeApp({
      projectId: appletConfig.projectId,
    });
  }
  return adminApp;
}

function getAdminFirestore(): Firestore {
  if (adminDb) return adminDb;
  adminDb = getFirestore(getAdminApp(), appletConfig.firestoreDatabaseId);
  return adminDb;
}

export interface VerifiedFirebaseUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  idToken: string;
}

export async function verifyFirebaseBearerToken(authHeader?: string): Promise<VerifiedFirebaseUser> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('AUTH_MISSING');
  }
  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken) {
    throw new Error('AUTH_MISSING');
  }
  const decoded = await getAuth(getAdminApp()).verifyIdToken(idToken);
  return {
    uid: decoded.uid,
    email: decoded.email || '',
    emailVerified: Boolean(decoded.email_verified),
    idToken,
  };
}

// ==================== FIRESTORE REST FALLBACK (USES VERIFIED USER TOKEN + SECURITY RULES) ====================
const FIRESTORE_REST_BASE = `https://firestore.googleapis.com/v1/projects/${appletConfig.projectId}/databases/${appletConfig.firestoreDatabaseId}/documents`;

function decodeFirestoreValue(val: Record<string, unknown>): unknown {
  if ('stringValue' in val) return String(val.stringValue);
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('timestampValue' in val) return String(val.timestampValue);
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) {
    const arr = (val.arrayValue as { values?: Record<string, unknown>[] })?.values || [];
    return arr.map(decodeFirestoreValue);
  }
  if ('mapValue' in val) {
    const fields = (val.mapValue as { fields?: Record<string, Record<string, unknown>> })?.fields || {};
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = decodeFirestoreValue(v);
    }
    return out;
  }
  return null;
}

function decodeFirestoreDoc(docJson: { fields?: Record<string, Record<string, unknown>> }): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(docJson.fields || {})) {
    out[k] = decodeFirestoreValue(v);
  }
  return out;
}

function encodeFirestoreValue(val: unknown): Record<string, unknown> {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(encodeFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, Record<string, unknown>> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== undefined) {
        fields[k] = encodeFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

async function getDocumentViaRest(
  collectionPath: string,
  docId: string,
  idToken: string,
): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${FIRESTORE_REST_BASE}/${collectionPath}/${encodeURIComponent(docId)}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Firestore read failed (${res.status}): ${text}`);
  }
  const json = (await res.json()) as { fields?: Record<string, Record<string, unknown>> };
  return decodeFirestoreDoc(json);
}

async function patchDocumentFieldsViaRest(
  collectionPath: string,
  docId: string,
  fieldsObj: Record<string, unknown>,
  idToken: string,
): Promise<void> {
  const fieldPaths = Object.keys(fieldsObj);
  const maskParams = fieldPaths
    .map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`)
    .join('&');
  const encodedFields: Record<string, Record<string, unknown>> = {};
  for (const [k, v] of Object.entries(fieldsObj)) {
    encodedFields[k] = encodeFirestoreValue(v);
  }
  const res = await fetch(
    `${FIRESTORE_REST_BASE}/${collectionPath}/${encodeURIComponent(docId)}?${maskParams}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields: encodedFields }),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Firestore update failed (${res.status}): ${text}`);
  }
}

async function queryStoresByOwnerViaRest(ownerId: string, idToken: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${FIRESTORE_REST_BASE}:runQuery`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'stores' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'ownerId' },
            op: 'EQUAL',
            value: { stringValue: ownerId },
          },
        },
        limit: 5,
      },
    }),
  });
  if (!res.ok) {
    return [];
  }
  const rows = (await res.json()) as Array<{ document?: { fields?: Record<string, Record<string, unknown>> } }>;
  return rows.filter((r) => r.document).map((r) => decodeFirestoreDoc(r.document!));
}

export async function fetchFirestoreDoc(
  collectionPath: string,
  docId: string,
  idToken: string,
): Promise<Record<string, unknown> | null> {
  if (hasExplicitServiceAccount) {
    const snap = await getAdminFirestore().collection(collectionPath).doc(docId).get();
    return snap.exists ? (snap.data() as Record<string, unknown>) : null;
  }
  try {
    return await getDocumentViaRest(collectionPath, docId, idToken);
  } catch (err) {
    if (String(err).includes('403')) {
      throw new Error('FIRESTORE_FORBIDDEN');
    }
    throw err;
  }
}

export async function patchFirestoreFields(
  collectionPath: string,
  docId: string,
  fieldsObj: Record<string, unknown>,
  idToken: string,
): Promise<void> {
  if (hasExplicitServiceAccount) {
    await getAdminFirestore().collection(collectionPath).doc(docId).update(fieldsObj);
    return;
  }
  await patchDocumentFieldsViaRest(collectionPath, docId, fieldsObj, idToken);
}

export async function fetchOwnerStores(
  ownerId: string,
  idToken: string,
): Promise<Record<string, unknown>[]> {
  if (hasExplicitServiceAccount) {
    const snap = await getAdminFirestore()
      .collection('stores')
      .where('ownerId', '==', ownerId)
      .limit(5)
      .get();
    return snap.docs.map((d) => d.data() as Record<string, unknown>);
  }
  return await queryStoresByOwnerViaRest(ownerId, idToken);
}

export async function createFirestoreDoc(
  collectionPath: string,
  docId: string,
  fieldsObj: Record<string, unknown>,
  idToken: string,
): Promise<void> {
  if (hasExplicitServiceAccount) {
    await getAdminFirestore().collection(collectionPath).doc(docId).set(fieldsObj);
    return;
  }
  const encodedFields: Record<string, Record<string, unknown>> = {};
  for (const [k, v] of Object.entries(fieldsObj)) {
    if (v !== undefined) {
      encodedFields[k] = encodeFirestoreValue(v);
    }
  }
  const res = await fetch(
    `${FIRESTORE_REST_BASE}/${collectionPath}?documentId=${encodeURIComponent(docId)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields: encodedFields }),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 403) {
      throw new Error('FIRESTORE_FORBIDDEN');
    }
    throw new Error(`Firestore create failed (${res.status}): ${text}`);
  }
}

export async function deleteFirestoreDoc(
  collectionPath: string,
  docId: string,
  idToken: string,
): Promise<void> {
  if (hasExplicitServiceAccount) {
    await getAdminFirestore().collection(collectionPath).doc(docId).delete();
    return;
  }
  const res = await fetch(`${FIRESTORE_REST_BASE}/${collectionPath}/${encodeURIComponent(docId)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
  if (res.status === 404) return;
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 403) {
      throw new Error('FIRESTORE_FORBIDDEN');
    }
    throw new Error(`Firestore delete failed (${res.status}): ${text}`);
  }
}

export async function checkIsAdminServer(user: VerifiedFirebaseUser): Promise<boolean> {
  if (user.email === 'support.optigrowth@gmail.com' && user.emailVerified) {
    return true;
  }
  try {
    const docData = await fetchFirestoreDoc('admins', user.uid, user.idToken);
    return docData !== null;
  } catch {
    return false;
  }
}

