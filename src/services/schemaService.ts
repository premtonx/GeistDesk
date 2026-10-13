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
    try {
      const docRef = doc(db, 'settings', 'company_schema');
      const snapshot = await getDoc(docRef);

      if (!snapshot.exists()) {
        return [];
      }

      return (snapshot.data().fields || []) as CustomField[];
    } catch (e) {
      // A 403 from the generic /api/db router (or any transient read error)
      // must never block the ticket workspace — fall back to an empty schema.
      console.warn('[schemaService] getCompanySchema failed, falling back to empty schema.', e);
      return [];
    }
  },

  async saveCompanySchema(fields: CustomField[]) {
    const docRef = doc(db, 'settings', 'company_schema');
    await setDoc(docRef, { fields });
  },

  async getContactSchema(): Promise<CustomField[]> {
    try {
      const docRef = doc(db, 'settings', 'contact_schema');
      const snapshot = await getDoc(docRef);

      if (!snapshot.exists()) {
        return [];
      }

      return (snapshot.data().fields || []) as CustomField[];
    } catch (e) {
      // A 403 from the generic /api/db router (or any transient read error)
      // must never block the ticket workspace — fall back to an empty schema.
      console.warn('[schemaService] getContactSchema failed, falling back to empty schema.', e);
      return [];
    }
  },

  async saveContactSchema(fields: CustomField[]) {
    const docRef = doc(db, 'settings', 'contact_schema');
    await setDoc(docRef, { fields });
  }
};
