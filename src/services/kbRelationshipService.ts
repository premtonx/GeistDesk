import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  getDocs,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export type NodeType = 'Article' | 'SOP' | 'System' | 'Team' | 'Integration' | 'Vendor' | 'Ticket';

export type RelationshipType = 'depends_on' | 'related_to' | 'causes' | 'solves' | 'references' | 'owned_by' | 'used_by';

export interface KBRelationship {
  id: string;
  sourceName: string;
  sourceType: NodeType;
  targetName: string;
  targetType: NodeType;
  type: RelationshipType;
  confidence: number;
  detectedBy: 'AI' | 'Manual';
  createdAt?: any;
}

const RELATIONSHIPS_COLLECTION = 'kb_relationships';

const SEED_RELATIONSHIPS: Omit<KBRelationship, 'id'>[] = [
  {
    sourceName: "Azure MFA",
    sourceType: "System",
    targetName: "Entra ID",
    targetType: "System",
    type: "depends_on",
    confidence: 0.98,
    detectedBy: 'AI'
  },
  {
    sourceName: "Azure MFA",
    sourceType: "System",
    targetName: "Conditional Access Policy",
    targetType: "System",
    type: "related_to",
    confidence: 0.92,
    detectedBy: 'AI'
  },
  {
    sourceName: "Azure MFA",
    sourceType: "System",
    targetName: "MFA Login Failures & Reset Guide",
    targetType: "Article",
    type: "solves",
    confidence: 0.88,
    detectedBy: 'AI'
  },
  {
    sourceName: "SOP-011: VPN Tunnel Validation",
    sourceType: "SOP",
    targetName: "Enterprise VPN Cluster",
    targetType: "System",
    type: "references",
    confidence: 0.95,
    detectedBy: 'AI'
  },
  {
    sourceName: "Enterprise VPN Cluster",
    sourceType: "System",
    targetName: "Network Operations Center",
    targetType: "Team",
    type: "owned_by",
    confidence: 0.95,
    detectedBy: 'Manual'
  },
  {
    sourceName: "GitHub Enterprise",
    sourceType: "Integration",
    targetName: "DevOps Engineering Team",
    targetType: "Team",
    type: "used_by",
    confidence: 0.90,
    detectedBy: 'AI'
  },
  {
    sourceName: "Enterprise VPN Cluster",
    sourceType: "System",
    targetName: "Fortinet Firewalls",
    targetType: "System",
    type: "depends_on",
    confidence: 0.95,
    detectedBy: 'Manual'
  },
  {
    sourceName: "Slack Ticket Sync Integration",
    sourceType: "Integration",
    targetName: "IT Support Desk Team",
    targetType: "Team",
    type: "used_by",
    confidence: 0.95,
    detectedBy: 'Manual'
  },
  {
    sourceName: "MFA Login Failures & Reset Guide",
    sourceType: "Article",
    targetName: "Okta Identity Cloud",
    targetType: "Vendor",
    type: "references",
    confidence: 0.85,
    detectedBy: 'AI'
  },
  {
    sourceName: "SOP-022: Multi-Tenant SSO Rotation",
    sourceType: "SOP",
    targetName: "Security Operations Team",
    targetType: "Team",
    type: "owned_by",
    confidence: 0.95,
    detectedBy: 'Manual'
  }
];

export const kbRelationshipService = {
  subscribeToRelationships: (callback: (relationships: KBRelationship[]) => void) => {
    const q = query(collection(db, RELATIONSHIPS_COLLECTION));
    
    // Subscribe in real-time
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as KBRelationship[];
      
      // If collection is completely empty, seed standard records
      if (items.length === 0) {
        kbRelationshipService.seedDefaultRelationships().then(() => {
          // Default ones are seeding. The next snapshot trigger will load them.
        });
      }
      
      callback(items);
    }, (error) => {
      console.warn("Error subscribing to kb_relationships:", error);
    });

    return unsubscribe;
  },

  seedDefaultRelationships: async () => {
    try {
      const q = query(collection(db, RELATIONSHIPS_COLLECTION));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        console.log("[KB Graph Service] Seeding enterprise baseline relationship graph...");
        for (const rel of SEED_RELATIONSHIPS) {
          await addDoc(collection(db, RELATIONSHIPS_COLLECTION), {
            ...rel,
            createdAt: serverTimestamp()
          });
        }
        console.log("[KB Graph Service] Enterprise baseline graph seeding complete.");
      }
    } catch (err) {
      console.warn("Failed to seed default relationships:", err);
    }
  },

  getAllRelationships: async (): Promise<KBRelationship[]> => {
    try {
      const q = query(collection(db, RELATIONSHIPS_COLLECTION));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as KBRelationship[];
    } catch (error) {
      console.error("Failed to load KB relationships:", error);
      return [];
    }
  },

  addRelationship: async (rel: Omit<KBRelationship, 'id' | 'createdAt'>) => {
    try {
      const docRef = await addDoc(collection(db, RELATIONSHIPS_COLLECTION), {
        ...rel,
        createdAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error("Failed to create KB relationship:", error);
      throw error;
    }
  },

  deleteRelationship: async (id: string) => {
    try {
      await deleteDoc(doc(db, RELATIONSHIPS_COLLECTION, id));
    } catch (error) {
      console.error("Failed to delete KB relationship:", error);
      throw error;
    }
  },

  /**
   * Calls server-side Gemini 3.5 Flash analyzer to extract connections dynamically.
   */
  extractRelationshipsFromAI: async (articleTitle: string, articleContent: string, articleId?: string): Promise<Omit<KBRelationship, 'id' | 'createdAt'>[]> => {
    try {
      const res = await fetch("/api/kb/extract-relationships", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          articleTitle,
          articleContent,
          articleId
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to extract relationships");
      }

      const data = await res.json();
      if (data.success && Array.isArray(data.relationships)) {
        return data.relationships.map((r: any) => ({
          sourceName: r.sourceName || articleTitle,
          sourceType: r.sourceType || 'Article',
          targetName: r.targetName,
          targetType: r.targetType || 'System',
          type: r.type || 'related_to',
          confidence: r.confidence || 0.85,
          detectedBy: 'AI'
        }));
      }
      return [];
    } catch (err: any) {
      console.error("Error in extractRelationshipsFromAI:", err);
      throw err;
    }
  }
};
