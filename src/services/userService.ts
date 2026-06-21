import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  where,
  getDocs,
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User, OperationType } from '../types';
import { handleFirestoreError } from './auditService';

const USERS_COLLECTION = 'users';

export const userService = {
  subscribeToUsers: (callback: (users: User[]) => void) => {
    const q = query(collection(db, USERS_COLLECTION), orderBy('name', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as User[];
      callback(users);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, USERS_COLLECTION);
    });
  },

  getAgents: async (): Promise<User[]> => {
    try {
      const q = query(collection(db, USERS_COLLECTION), where('role', 'in', ['agent', 'team_lead', 'admin']), orderBy('name', 'asc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, USERS_COLLECTION);
      return [];
    }
  },

  syncProfile: async (user: { uid: string; displayName: string | null; email: string | null; photoURL: string | null }) => {
    try {
      const docRef = doc(db, USERS_COLLECTION, user.uid);
      const snap = await getDoc(docRef);

      if (!snap.exists()) {
        // Search if we already have an onboarded document for this email
        let existingPreCreatedDoc: any = null;
        if (user.email) {
          const q = query(collection(db, USERS_COLLECTION), where('email', '==', user.email.toLowerCase().trim()));
          const results = await getDocs(q);
          if (!results.empty) {
            // Find the pre-created document that has a different ID (random)
            const preCreated = results.docs.find(d => d.id !== user.uid);
            if (preCreated) {
              existingPreCreatedDoc = { id: preCreated.id, ...preCreated.data() };
            }
          }
        }

        if (existingPreCreatedDoc) {
          console.log("[Identity Synthesis] SSO profile match found! Merging roles, alignment, and credentials...");
          // Clone the profile to the new authenticated uid document and delete the pre-created random ID document
          const clonedData = {
            ...existingPreCreatedDoc,
            id: user.uid,
            name: user.displayName || existingPreCreatedDoc.name || user.email?.split('@')[0],
            avatar: user.photoURL || existingPreCreatedDoc.avatar || '',
            role: existingPreCreatedDoc.role || 'agent',
            is_admin: existingPreCreatedDoc.is_admin === true || existingPreCreatedDoc.role === 'admin',
            updatedAt: serverTimestamp()
          };
          delete clonedData.id;

          await setDoc(docRef, clonedData);
          
          // Delete old doc
          try {
            const oldDocRef = doc(db, USERS_COLLECTION, existingPreCreatedDoc.id);
            await deleteDoc(oldDocRef);
          } catch (deleteErr) {
            console.error("Failed to delete stale pre-created user record:", deleteErr);
          }
        } else {
          // Standard auto-provision fallback (least-privilege by default)
          await setDoc(docRef, {
            name: user.displayName || user.email?.split('@')[0] || 'Unknown User',
            email: user.email || '',
            avatar: user.photoURL || '',
            role: 'agent',
            is_admin: false,
            createdAt: serverTimestamp()
          });
        }
      }
    } catch (error) {
      console.error("Profile sync failed:", error);
    }
  },

  getUser: async (id: string): Promise<User | null> => {
    try {
      const docRef = doc(db, USERS_COLLECTION, id);
      const snapshot = await getDoc(docRef);
      return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } as User : null;
    } catch (error) {
      return null;
    }
  },

  updateUser: async (id: string, updates: Partial<User>) => {
    try {
      // Never route credentials through the profile update path. Password
      // changes go exclusively through the server-side hashed endpoint.
      const { password: _ignoredPassword, ...safeUpdates } = updates as any;
      const docRef = doc(db, USERS_COLLECTION, id);
      await updateDoc(docRef, {
        ...safeUpdates,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, USERS_COLLECTION);
    }
  },

  deleteUser: async (id: string) => {
    try {
      const docRef = doc(db, USERS_COLLECTION, id);
      await updateDoc(docRef, {
        deactivated: true,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, USERS_COLLECTION);
    }
  }
};
