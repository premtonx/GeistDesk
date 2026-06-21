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
  addDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Customer, Company, Contact, OperationType } from '../types';
import { handleFirestoreError } from './auditService';

const CUSTOMERS_COLLECTION = 'customers';
const COMPANIES_COLLECTION = 'companies';
const CONTACTS_COLLECTION = 'contacts';

export const customerService = {
  // Companies
  subscribeToCompanies: (callback: (companies: Company[]) => void) => {
    const q = query(collection(db, COMPANIES_COLLECTION), orderBy('name', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const companies = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Company[];
      callback(companies);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, COMPANIES_COLLECTION);
    });
  },

  getCompany: async (id: string): Promise<Company | null> => {
    try {
      const docRef = doc(db, COMPANIES_COLLECTION, id);
      const snapshot = await getDoc(docRef);
      return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } as Company : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${COMPANIES_COLLECTION}/${id}`);
      return null;
    }
  },

  findCompanyByDomain: async (domain: string): Promise<Company | null> => {
    try {
      const q = query(collection(db, COMPANIES_COLLECTION), where('domain', '==', domain.toLowerCase()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return { id: snap.docs[0].id, ...snap.docs[0].data() } as Company;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, COMPANIES_COLLECTION);
      return null;
    }
  },

  createCompany: async (data: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    try {
      const docRef = await addDoc(collection(db, COMPANIES_COLLECTION), {
        ...data,
        domain: data.domain.toLowerCase(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, COMPANIES_COLLECTION);
      throw error;
    }
  },

  updateCompany: async (id: string, data: Partial<Company>) => {
    try {
      const docRef = doc(db, COMPANIES_COLLECTION, id);
      await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${COMPANIES_COLLECTION}/${id}`);
    }
  },

  // Contacts
  subscribeToContacts: (companyId: string | null, callback: (contacts: Contact[]) => void) => {
    const contactsRef = collection(db, CONTACTS_COLLECTION);
    const q = companyId 
      ? query(contactsRef, where('companyId', '==', companyId), orderBy('name', 'asc'))
      : query(contactsRef, orderBy('name', 'asc'));

    return onSnapshot(q, (snapshot) => {
      const contacts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Contact[];
      callback(contacts);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, CONTACTS_COLLECTION);
    });
  },

  getContact: async (id: string): Promise<Contact | null> => {
    try {
      const docRef = doc(db, CONTACTS_COLLECTION, id);
      const snapshot = await getDoc(docRef);
      return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } as Contact : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${CONTACTS_COLLECTION}/${id}`);
      return null;
    }
  },

  findContactByEmail: async (email: string): Promise<Contact | null> => {
    try {
      const q = query(collection(db, CONTACTS_COLLECTION), where('email', '==', email.toLowerCase()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return { id: snap.docs[0].id, ...snap.docs[0].data() } as Contact;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, CONTACTS_COLLECTION);
      return null;
    }
  },

  createContact: async (data: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    try {
      const docRef = await addDoc(collection(db, CONTACTS_COLLECTION), {
        ...data,
        email: data.email.toLowerCase(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, CONTACTS_COLLECTION);
      throw error;
    }
  },

  // Legacy Customers (could be mapped to Contacts if needed)
  subscribeToCustomers: (callback: (customers: Customer[]) => void) => {
    const q = query(collection(db, CUSTOMERS_COLLECTION), orderBy('name', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const customers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Customer[];
      callback(customers);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, CUSTOMERS_COLLECTION);
    });
  },

  getCustomer: async (id: string): Promise<Customer | null> => {
    try {
      const docRef = doc(db, CUSTOMERS_COLLECTION, id);
      const snapshot = await getDoc(docRef);
      return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } as Customer : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${CUSTOMERS_COLLECTION}/${id}`);
      return null;
    }
  }
};
