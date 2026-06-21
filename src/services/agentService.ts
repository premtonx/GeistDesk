import { 
  doc, 
  setDoc, 
  updateDoc, 
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  orderBy
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User, OperationType } from '../types';
import { logAudit, handleFirestoreError } from './auditService';

const USERS_COLLECTION = 'users';

export const agentService = {
  onboardAgent: async (agentData: Partial<User>) => {
    try {
      if (!agentData.email) throw new Error("Agent email is required");
      
      const cleanEmail = agentData.email.toLowerCase().trim();
      let id = agentData.id;
      if (!id) {
        // Find if a profile with this exact email already exists in Firestore to prevent collisions
        const q = query(collection(db, USERS_COLLECTION), where('email', '==', cleanEmail));
        const snap = await getDocs(q);
        if (!snap.empty) {
          id = snap.docs[0].id;
        } else {
          id = 'user-' + Math.random().toString(36).substring(2, 11);
        }
      }
      
      const docRef = doc(db, USERS_COLLECTION, id);

      // Credentials are never stored on the profile record. The server strips
      // any password field; password setup happens via the hashed auth flow.
      const { password: _ignoredPassword, ...agentProfile } = agentData as any;
      const fullData = {
        ...agentProfile,
        id,
        email: cleanEmail,
        isDeactivated: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastActiveAt: serverTimestamp()
      };
      
      await setDoc(docRef, fullData);
      
      await logAudit({
        module: 'workforce',
        action: 'onboard_agent',
        details: { agentId: id, email: cleanEmail, role: agentData.role }
      });
      
      return id;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, USERS_COLLECTION);
    }
  },

  updateAgent: async (agentId: string, updates: Partial<User>) => {
    try {
      const docRef = doc(db, USERS_COLLECTION, agentId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
      
      await logAudit({
        module: 'workforce',
        action: 'update_agent',
        details: { agentId, updates }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, USERS_COLLECTION);
    }
  },

  toggleDeactivation: async (agentId: string, isDeactivated: boolean) => {
    try {
      const docRef = doc(db, USERS_COLLECTION, agentId);
      await updateDoc(docRef, { isDeactivated, updatedAt: serverTimestamp() });
      
      await logAudit({
        module: 'workforce',
        action: isDeactivated ? 'deactivate_agent' : 'reactivate_agent',
        details: { agentId }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, USERS_COLLECTION);
    }
  }
};
