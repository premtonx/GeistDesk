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
  addDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Group, GroupMember, OperationType } from '../types';
import { handleFirestoreError } from './auditService';

const GROUPS_COLLECTION = 'groups';

export const groupService = {
  subscribeToGroups: (callback: (groups: Group[]) => void) => {
    const q = query(collection(db, GROUPS_COLLECTION), orderBy('name', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const groups = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Group[];
      callback(groups);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, GROUPS_COLLECTION);
    });
  },

  getGroups: async (): Promise<Group[]> => {
    try {
      const q = query(collection(db, GROUPS_COLLECTION), orderBy('name', 'asc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, GROUPS_COLLECTION);
      return [];
    }
  },

  createGroup: async (data: Omit<Group, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    try {
      const docRef = await addDoc(collection(db, GROUPS_COLLECTION), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, GROUPS_COLLECTION);
      throw error;
    }
  },

  updateGroup: async (id: string, data: Partial<Group>) => {
    try {
      const docRef = doc(db, GROUPS_COLLECTION, id);
      await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
      
      // Handle setting default
      if (data.isDefault) {
        const otherGroups = await groupService.getGroups();
        for (const g of otherGroups) {
          if (g.id !== id && g.isDefault) {
            await updateDoc(doc(db, GROUPS_COLLECTION, g.id), { isDefault: false });
          }
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${GROUPS_COLLECTION}/${id}`);
    }
  },

  deleteGroup: async (id: string) => {
    try {
      await deleteDoc(doc(db, GROUPS_COLLECTION, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${GROUPS_COLLECTION}/${id}`);
    }
  },

  // Members
  subscribeToMembers: (groupId: string, callback: (members: GroupMember[]) => void) => {
    const q = query(collection(db, GROUPS_COLLECTION, groupId, 'members'));
    return onSnapshot(q, (snapshot) => {
      const members = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as GroupMember[];
      callback(members);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `${GROUPS_COLLECTION}/${groupId}/members`);
    });
  },

  getMembers: async (groupId: string): Promise<GroupMember[]> => {
    try {
      const q = query(collection(db, GROUPS_COLLECTION, groupId, 'members'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GroupMember));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, `${GROUPS_COLLECTION}/${groupId}/members`);
      return [];
    }
  },

  addMember: async (groupId: string, userId: string) => {
    try {
      const id = `${groupId}_${userId}`;
      await setDoc(doc(db, GROUPS_COLLECTION, groupId, 'members', id), {
        groupId,
        userId,
        joinedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `${GROUPS_COLLECTION}/${groupId}/members`);
    }
  },

  removeMember: async (groupId: string, userId: string) => {
    try {
      const id = `${groupId}_${userId}`;
      await deleteDoc(doc(db, GROUPS_COLLECTION, groupId, 'members', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${GROUPS_COLLECTION}/${groupId}/members`);
    }
  },

  getDefaultGroup: async (): Promise<Group | null> => {
    try {
      const q = query(collection(db, GROUPS_COLLECTION), where('isDefault', '==', true));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return { id: snap.docs[0].id, ...snap.docs[0].data() } as Group;
      }
      return null;
    } catch (error) {
      return null;
    }
  }
};
