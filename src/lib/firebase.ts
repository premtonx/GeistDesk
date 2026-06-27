/**
 * PostgreSQL-backed database client entry point.
 * Re-exports the Postgres adapter — no Firebase SDK is loaded on the client.
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
