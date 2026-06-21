import { db } from '../lib/firebase';
import { collection, doc, getDocs, updateDoc, setDoc, query, where, getDoc } from 'firebase/firestore';

export interface CustomField {
  id: string;
  type: 'text' | 'paragraph' | 'dropdown' | 'checkbox' | 'date' | 'phone' | 'number' | 'url' | string;
  label: string;
  internalName: string;
  required: boolean;
  visibility: 'agent' | 'admin';
  unique: boolean;
  options?: string[]; // For dropdowns
  placeholder?: string;
  order: number;
  system?: boolean;
}

export const schemaService = {
  async getCompanySchema(): Promise<CustomField[]> {
    const docRef = doc(db, 'settings', 'company_schema');
    const snapshot = await getDoc(docRef);
    
    if (!snapshot.exists()) {
      return [];
    }
    
    return (snapshot.data().fields || []) as CustomField[];
  },

  async saveCompanySchema(fields: CustomField[]) {
    const docRef = doc(db, 'settings', 'company_schema');
    await setDoc(docRef, { fields });
  },

  async getContactSchema(): Promise<CustomField[]> {
    const docRef = doc(db, 'settings', 'contact_schema');
    const snapshot = await getDoc(docRef);
    
    if (!snapshot.exists()) {
      return [];
    }
    
    return (snapshot.data().fields || []) as CustomField[];
  },

  async saveContactSchema(fields: CustomField[]) {
    const docRef = doc(db, 'settings', 'contact_schema');
    await setDoc(docRef, { fields });
  }
};
