// Custom high-performance Client-Side Database & Authentication Adaptor
// Emulates the Firebase SDK interface but resolves queries on standard PostgreSQL / SQL backend APIs.

import firebaseConfig from '../../firebase-applet-config.json';

// Simple Auth State Store. Credentials are NEVER stored client-side; the only
// persisted artifact is the server-issued signed session token.
const USER_KEY = 'geistdesk_auth_user';
const TOKEN_KEY = 'geistdesk_token';

export function getSessionToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setSessionToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore storage errors */
  }
}

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  isAnonymous: boolean;
  tenantId?: string | null;
  providerData?: any[];
}

class FirebaseAuth {
  private listeners: ((user: User | null) => void)[] = [];
  public currentUser: User | null = null;

  constructor() {
    const saved = localStorage.getItem(USER_KEY);
    if (saved) {
      try {
        this.currentUser = JSON.parse(saved);
      } catch (e) {
        this.currentUser = null;
      }
    } else {
      // Do not automatically log in - wait for user interaction to preserve Multi-User Privacy Schema
      this.currentUser = null;
    }
  }

  onAuthStateChanged(callback: (user: User | null) => void) {
    this.listeners.push(callback);
    // Instant initial trigger
    setTimeout(() => callback(this.currentUser), 0);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  updateUser(user: User | null) {
    this.currentUser = user;
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
    this.listeners.forEach(l => l(this.currentUser));
  }
}

export const auth = new FirebaseAuth();

export function getAuth(...args: any[]) {
  return auth;
}

export class GoogleAuthProvider {}

export class OAuthProvider {
  constructor(public providerId: string) {}
  setCustomParameters(params: any) {}
}

function userFromServer(payload: any): User {
  return {
    uid: payload.id || payload.uid,
    email: payload.email,
    displayName: payload.name || payload.displayName || (payload.email ? payload.email.split('@')[0] : null),
    photoURL: payload.avatar || payload.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
    emailVerified: true,
    isAnonymous: false,
    tenantId: null,
    providerData: []
  };
}

export async function signInWithEmailAndPassword(authObj: FirebaseAuth, email: string, password: string) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || 'Invalid credentials.');
  }
  setSessionToken(data.token);
  const user = userFromServer(data.user);
  authObj.updateUser(user);
  return { user };
}

export async function createUserWithEmailAndPassword(authObj: FirebaseAuth, email: string, password: string) {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || 'Registration failed.');
  }
  setSessionToken(data.token);
  const user = userFromServer(data.user);
  authObj.updateUser(user);
  return { user };
}

export async function updateProfile(user: User, profile: { displayName?: string; photoURL?: string }) {
  if (auth.currentUser && auth.currentUser.uid === user.uid) {
    auth.currentUser.displayName = profile.displayName ?? auth.currentUser.displayName;
    auth.currentUser.photoURL = profile.photoURL ?? auth.currentUser.photoURL;
    auth.updateUser({ ...auth.currentUser });
  }
}

export async function updateEmail(user: User, newEmail: string) {
  if (auth.currentUser && auth.currentUser.uid === user.uid) {
    auth.currentUser.email = newEmail;
    auth.updateUser({ ...auth.currentUser });
  }
}

export async function updatePassword(_user: User, newPassword: string) {
  // Password changes are performed server-side against the Argon2id hash.
  const res = await fetch('/api/auth/change-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(getSessionToken() ? { Authorization: `Bearer ${getSessionToken()}` } : {})
    },
    body: JSON.stringify({ newPassword })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || 'Failed to update password.');
  }
}

export async function signInWithPopup(_authObj: FirebaseAuth, _provider: any) {
  // SSO must be performed against a real Microsoft Entra ID tenant; the server
  // validates the resulting RS256 token. There is no local mock-admin shortcut.
  throw new Error(
    'Single sign-on is not configured in this build. Configure Microsoft Entra ID (MICROSOFT_PROVIDER_CLIENT_ID) or sign in with email and password.'
  );
}

export async function signOut(authObj: FirebaseAuth) {
  setSessionToken(null);
  authObj.updateUser(null);
}

export function onAuthStateChanged(authObj: FirebaseAuth, callback: (user: User | null) => void) {
  return authObj.onAuthStateChanged(callback);
}

// -----------------------------------------------------------------------------
// FIRESTORE COMPATIBILITY LAYER - MAPS TO BACKEND POSTGRESQL / FILE STORE
// -----------------------------------------------------------------------------

export function getFirestore(...args: any[]) {
  return { id: firebaseConfig?.firestoreDatabaseId || 'default' };
}

export class Query {
  constructor(
    public rawPath: string,
    public constraints: any[] = []
  ) {}

  get path(): string {
    return this.rawPath;
  }
}

export class DocumentReference {
  constructor(
    public collectionName: string,
    public id: string
  ) {}
}

export function collection(db: any, path: string, ...segments: string[]) {
  const fullPath = [path, ...segments].filter(Boolean).join('/');
  return new Query(fullPath);
}

export function doc(dbOrQuery: any, collectionOrId?: string, ...segments: string[]) {
  if (dbOrQuery instanceof Query && !collectionOrId) {
    const generatedId = Math.random().toString(36).substring(2, 15) + '-' + Date.now();
    return new DocumentReference(dbOrQuery.rawPath, generatedId);
  }
  
  const fullSegments = [collectionOrId, ...segments].filter(Boolean);
  
  if (fullSegments.length === 1 && typeof dbOrQuery === 'object' && dbOrQuery instanceof Query) {
    // doc(query, "id")
    return new DocumentReference(dbOrQuery.path, fullSegments[0]);
  }

  const fullPath = fullSegments.join('/');
  const parts = fullPath.split('/');
  const id = parts[parts.length - 1];
  const collectionName = parts.slice(0, -1).join('/');
  return new DocumentReference(collectionName, id);
}

export function query(q: Query, ...constraints: any[]) {
  return new Query(q.rawPath, [...q.constraints, ...constraints]);
}

export function where(field: string, op: string, value: any) {
  return { type: 'where', field, op, value };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
  return { type: 'orderBy', field, direction };
}

export function limit(count: number) {
  return { type: 'limit', count };
}

export function serverTimestamp() {
  return { _type: 'serverTimestamp' };
}

export function arrayUnion(...values: any[]) {
  return { _type: 'arrayUnion', values };
}

export function increment(value: number) {
  return { _type: 'increment', value };
}

export function deleteField() {
  return { _type: 'deleteField' };
}

export function getDocFromServer(ref: DocumentReference) {
  return getDoc(ref);
}

// Low-level HTTP requests to Express generic SQL coordinator backend with transient retry logic
async function execDbAction(action: string, payload: any, retries = 5, delayMs = 1500) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const token = getSessionToken();
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ action, ...payload })
      });
      
      let errorBody = '';
      let data: any = null;
      try {
        data = await res.json();
        if (data && data.error) {
          errorBody = data.error;
        }
      } catch (e) {
        // ignore JSON parse error
      }

      if (!res.ok) {
        throw new Error(`DB Server error (${res.status}): ${errorBody || res.statusText || 'Unknown Error'}`);
      }
      if (data && data.error) {
        throw new Error(data.error);
      }
      return data ? data.result : null;
    } catch (err: any) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const isTransientNetwork = 
        errMsg.includes('Failed to fetch') || 
        errMsg.includes('NetworkError') || 
        errMsg.includes('fetch failed') ||
        errMsg.includes('network error') ||
        errMsg.includes('Load failed') ||
        errMsg.includes('type error') ||
        errMsg.includes('CORS') ||
        errMsg.includes('429') ||
        errMsg.includes('502') ||
        errMsg.includes('503') ||
        errMsg.includes('504') ||
        errMsg.includes('rate-limit') ||
        errMsg.includes('Too Many Requests');

      if (isTransientNetwork && attempt < retries) {
        console.warn(`[Mock DB Adapter] Action ${action} failed due to transient state/rate-limit (attempt ${attempt}/${retries}). Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      console.error(`[Mock DB Adapter Exception] Action ${action} failed after ${attempt} attempts:`, err);
      throw err;
    }
  }
}

export class DocumentSnapshot {
  constructor(
    private rawId: string,
    private rawData: any,
    private existsCheck = true
  ) {}

  get id() {
    return this.rawId;
  }

  get ref() {
    // In service files, some notifications/activities access DocSnapshot.ref
    return new DocumentReference('general', this.rawId);
  }

  exists() {
    return this.existsCheck && !!this.rawData;
  }

  data() {
    return this.rawData || {};
  }
}

export class QuerySnapshot {
  public docs: DocumentSnapshot[] = [];
  public empty = false;
  constructor(rawDocs: any[]) {
    this.docs = (rawDocs || []).map(d => new DocumentSnapshot(d.id, d.data || d));
    this.empty = this.docs.length === 0;
  }
}

export async function getDoc(ref: DocumentReference): Promise<DocumentSnapshot> {
  const result = await execDbAction('get_doc', { collection: ref.collectionName, id: ref.id });
  return new DocumentSnapshot(ref.id, result, !!result);
}

export async function getDocs(q: Query): Promise<QuerySnapshot> {
  const result = await execDbAction('get_docs', { collection: q.rawPath, constraints: q.constraints });
  return new QuerySnapshot(result);
}

export async function addDoc(q: Query, data: any) {
  const result = await execDbAction('add_doc', { collection: q.rawPath, data });
  return { id: result.id };
}

export async function updateDoc(ref: DocumentReference, data: any) {
  await execDbAction('update_doc', { collection: ref.collectionName, id: ref.id, data });
}

export async function setDoc(ref: DocumentReference, data: any, options?: any) {
  await execDbAction('set_doc', { collection: ref.collectionName, id: ref.id, data, options });
}

export async function deleteDoc(ref: DocumentReference) {
  await execDbAction('delete_doc', { collection: ref.collectionName, id: ref.id });
}

export function writeBatch(db: any) {
  const ops: { ref: DocumentReference; data: any; type: 'set' | 'update' | 'delete' }[] = [];
  return {
    set(ref: DocumentReference, data: any) {
      ops.push({ ref, data, type: 'set' });
    },
    update(ref: DocumentReference, data: any) {
      ops.push({ ref, data, type: 'update' });
    },
    delete(ref: DocumentReference) {
      ops.push({ ref, data: null, type: 'delete' });
    },
    async commit() {
      for (const op of ops) {
        if (op.type === 'set') {
          await setDoc(op.ref, op.data);
        } else if (op.type === 'update') {
          await updateDoc(op.ref, op.data);
        } else if (op.type === 'delete') {
          await deleteDoc(op.ref);
        }
      }
    }
  };
}

export function onSnapshot(
  target: Query | DocumentReference,
  onNext: (snapshot: any) => void,
  onError?: (error: any) => void
) {
  let isStopped = false;
  let lastHash = '';

  const checkUpdates = async () => {
    if (isStopped) return;
    try {
      if (target instanceof DocumentReference) {
        const snap = await getDoc(target);
        if (isStopped) return;
        const currentHash = JSON.stringify(snap.data());
        if (currentHash !== lastHash) {
          lastHash = currentHash;
          onNext(snap);
        }
      } else {
        const snap = await getDocs(target);
        if (isStopped) return;
        const currentHash = JSON.stringify(snap.docs.map(d => d.data()));
        if (currentHash !== lastHash) {
          lastHash = currentHash;
          onNext(snap);
        }
      }
    } catch (e: any) {
      const errMsg = e instanceof Error ? e.message : String(e);
      const isTransientNetwork = 
        errMsg.includes('Failed to fetch') || 
        errMsg.includes('NetworkError') || 
        errMsg.includes('fetch failed') ||
        errMsg.includes('network error') ||
        errMsg.includes('Load failed') ||
        errMsg.includes('type error') ||
        errMsg.includes('CORS') ||
        errMsg.includes('429') ||
        errMsg.includes('502') ||
        errMsg.includes('503') ||
        errMsg.includes('504') ||
        errMsg.includes('rate-limit') ||
        errMsg.includes('Too Many Requests');
      
      if (isTransientNetwork) {
        console.warn(`[onSnapshot] Database rate-limited, offline or server restarting (${errMsg}). Retrying on next background poll...`);
        return;
      }
      if (onError) onError(e);
    }
  };

  // Immediate fetch of current data 
  checkUpdates();

  // Poll database every 3 seconds representing real-time synchronization
  const intervalId = setInterval(checkUpdates, 3000);

  return () => {
    isStopped = true;
    clearInterval(intervalId);
  };
}

export function initializeApp(...args: any[]) {
  return {};
}

export function handleFirestoreError(error: unknown, operationType: string, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('Database Operation Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
