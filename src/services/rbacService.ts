import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  query, 
  orderBy, 
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserRole, OperationType } from '../types';
import { logAudit, handleFirestoreError } from './auditService';

const ROLES_COLLECTION = 'roles';

export const rbacService = {
  getRoles: async () => {
    try {
      const q = query(collection(db, ROLES_COLLECTION), orderBy('name', 'asc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserRole));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, ROLES_COLLECTION);
      return [];
    }
  },

  subscribeToRoles: (callback: (roles: UserRole[]) => void) => {
    const q = query(collection(db, ROLES_COLLECTION), orderBy('name', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const roles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserRole));
      callback(roles);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, ROLES_COLLECTION);
    });
  },

  getRole: async (roleId: string) => {
    try {
      const docRef = doc(db, ROLES_COLLECTION, roleId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as UserRole;
      }
      return null;
    } catch (error) {
       handleFirestoreError(error, OperationType.GET, ROLES_COLLECTION);
       return null;
    }
  },

  createRole: async (roleData: Partial<UserRole>) => {
    try {
      const id = roleData.id || Math.random().toString(36).substr(2, 9);
      const docRef = doc(db, ROLES_COLLECTION, id);
      const fullData = {
        ...roleData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      await setDoc(docRef, fullData);
      
      await logAudit({
        module: 'rbac',
        action: 'create_role',
        details: { roleId: id, name: roleData.name }
      });
      return id;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, ROLES_COLLECTION);
    }
  },

  updateRole: async (roleId: string, updates: Partial<UserRole>) => {
    try {
      const docRef = doc(db, ROLES_COLLECTION, roleId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
      
      await logAudit({
        module: 'rbac',
        action: 'update_role',
        details: { roleId, updates }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, ROLES_COLLECTION);
    }
  },

  deleteRole: async (roleId: string) => {
    try {
      const docRef = doc(db, ROLES_COLLECTION, roleId);
      await deleteDoc(docRef);
      
      await logAudit({
        module: 'rbac',
        action: 'delete_role',
        details: { roleId }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, ROLES_COLLECTION);
    }
  }
};
