/**
 * PostgreSQL-backed database client shim.
 * Re-exports the Firebase-compatible client — no real Firebase SDK is loaded.
 */
import {
  auth,
  db,
  GoogleAuthProvider,
  signInWithPopup,
} from './firebase-custom-client';

export * from './firebase-custom-client';

export { auth, db };

export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    const result: any = await signInWithPopup(auth, googleProvider);
    return result?.user;
  } catch (error) {
    console.error('Auth Error:', error);
    throw error;
  }
};
