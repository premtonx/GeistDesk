import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  orderBy,
  where,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch,
  increment,
  setDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { KBArticle, OperationType, KBTag } from '../types';
import { handleFirestoreError } from './auditService';
import axios from 'axios';

const KB_COLLECTION = 'kb_articles';
const TAGS_COLLECTION = 'tags';

function enqueueKbIndex(sourceId: string, type: 'INDEX_KB_ARTICLE' | 'DELETE_EMBEDDINGS' = 'INDEX_KB_ARTICLE') {
  void axios
    .post(
      '/api/vectors/enqueue',
      {
        type,
        sourceId,
        sourceType: 'KB_ARTICLE',
      },
      { withCredentials: true },
    )
    .catch(() => {
      /* non-fatal — /api/db hook is the authoritative path */
    });
}

/** Prefer ragService.indexArticle for new call sites; kept for firestore writers. */
export function indexKbArticleForRag(articleId: string) {
  enqueueKbIndex(articleId, 'INDEX_KB_ARTICLE');
}

export const kbService = {
  subscribeToArticles: (callback: (articles: KBArticle[]) => void, visibility?: 'Public' | 'Private') => {
    let q = query(collection(db, KB_COLLECTION), orderBy('createdAt', 'desc'));
    
    if (visibility) {
      q = query(collection(db, KB_COLLECTION), where('visibility', '==', visibility), orderBy('createdAt', 'desc'));
    }

    return onSnapshot(q, (snapshot) => {
      const articles = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as KBArticle[];
      callback(articles);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, KB_COLLECTION);
    });
  },

  getPublicArticles: async (): Promise<KBArticle[]> => {
    try {
      const q = query(collection(db, KB_COLLECTION), where('visibility', '==', 'Public'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as KBArticle[];
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, KB_COLLECTION);
      return [];
    }
  },

  createArticle: async (article: Partial<KBArticle>) => {
    try {
      const docRef = await addDoc(collection(db, KB_COLLECTION), {
        ...article,
        visibility: article.visibility || 'Private',
        tags: article.tags || [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Update tag counts
      if (article.tags && article.tags.length > 0) {
        for (const tagName of article.tags) {
          const tagId = tagName.toLowerCase().replace(/[^a-z0-9]/g, '-');
          const tagRef = doc(db, TAGS_COLLECTION, tagId);
          await setDoc(tagRef, { name: tagName, count: increment(1) }, { merge: true });
        }
      }
      enqueueKbIndex(docRef.id, 'INDEX_KB_ARTICLE');
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, KB_COLLECTION);
    }
  },

  updateArticle: async (id: string, updates: Partial<KBArticle>, oldTags: string[] = []) => {
    try {
      const docRef = doc(db, KB_COLLECTION, id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });

      // Handle tag changes
      if (updates.tags) {
        const added = updates.tags.filter(t => !oldTags.includes(t));
        const removed = oldTags.filter(t => !updates.tags!.includes(t));

        for (const tagName of added) {
          const tagId = tagName.toLowerCase().replace(/[^a-z0-9]/g, '-');
          const tagRef = doc(db, TAGS_COLLECTION, tagId);
          await setDoc(tagRef, { name: tagName, count: increment(1) }, { merge: true });
        }

        for (const tagName of removed) {
          const tagId = tagName.toLowerCase().replace(/[^a-z0-9]/g, '-');
          const tagRef = doc(db, TAGS_COLLECTION, tagId);
          await setDoc(tagRef, { count: increment(-1) }, { merge: true });
        }
      }
      enqueueKbIndex(id, 'INDEX_KB_ARTICLE');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, KB_COLLECTION);
    }
  },

  deleteArticle: async (id: string, tags: string[] = []) => {
    try {
      const docRef = doc(db, KB_COLLECTION, id);
      await deleteDoc(docRef);
      for (const tagName of tags) {
        const tagId = tagName.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const tagRef = doc(db, TAGS_COLLECTION, tagId);
        await setDoc(tagRef, { count: increment(-1) }, { merge: true });
      }
      enqueueKbIndex(id, 'DELETE_EMBEDDINGS');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, KB_COLLECTION);
      throw error;
    }
  },

  deleteArticles: async (items: { id: string; tags?: string[] }[]) => {
    try {
      const batch = writeBatch(db);
      const tagDeltas = new Map<string, number>();

      for (const item of items) {
        batch.delete(doc(db, KB_COLLECTION, item.id));
        for (const tagName of item.tags ?? []) {
          const tagId = tagName.toLowerCase().replace(/[^a-z0-9]/g, '-');
          tagDeltas.set(tagId, (tagDeltas.get(tagId) ?? 0) - 1);
        }
      }

      await batch.commit();

      for (const [tagId, delta] of tagDeltas) {
        const tagRef = doc(db, TAGS_COLLECTION, tagId);
        await setDoc(tagRef, { count: increment(delta) }, { merge: true });
      }
      for (const item of items) {
        enqueueKbIndex(item.id, 'DELETE_EMBEDDINGS');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, KB_COLLECTION);
      throw error;
    }
  },

  reassignCategory: async (fromCategoryId: string, toCategoryId: string) => {
    try {
      const q = query(collection(db, KB_COLLECTION), where('category', '==', fromCategoryId));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return 0;

      const batch = writeBatch(db);
      snapshot.docs.forEach((d) => {
        batch.update(d.ref, { category: toCategoryId, updatedAt: serverTimestamp() });
      });
      await batch.commit();
      return snapshot.docs.length;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, KB_COLLECTION);
      throw error;
    }
  },

  subscribeToTags: (callback: (tags: KBTag[]) => void) => {
    const q = query(collection(db, TAGS_COLLECTION), orderBy('count', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const tags = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as KBTag[];
      callback(tags);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, TAGS_COLLECTION);
    });
  }
};
