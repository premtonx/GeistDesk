import { db } from '../lib/firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  updateDoc, 
  query, 
  where, 
  getDoc, 
  addDoc, 
  serverTimestamp, 
  onSnapshot, 
  orderBy, 
  limit,
  writeBatch
} from 'firebase/firestore';
import { SystemNotification } from '../types';

export interface NotificationTemplate {
  id: string;
  name: string;
  description: string;
  category: 'agent' | 'customer' | 'cc' | 'master';
  subject: string;
  body: string;
  enabled: boolean;
  placeholders: string[];
  trigger: string;
}

const DEFAULT_TEMPLATES: NotificationTemplate[] = [
  {
    id: 'agent-new-ticket',
    name: 'New Ticket Assigned',
    description: 'Sent to an agent when a ticket is assigned to them.',
    category: 'agent',
    subject: 'New Ticket Assigned: {{ticket.id}} - {{ticket.subject}}',
    body: 'Hi {{agent.name}},\n\nA new ticket has been assigned to you.\n\nTicket ID: {{ticket.id}}\nSubject: {{ticket.subject}}\nCustomer: {{customer.name}}\n\nView ticket: {{ticket.url}}',
    enabled: true,
    placeholders: ['agent.name', 'ticket.id', 'ticket.subject', 'customer.name', 'ticket.url'],
    trigger: 'ticket.assigned'
  },
  {
    id: 'customer-ticket-received',
    name: 'Ticket Received',
    description: 'Auto-response sent to customers when they open a new ticket.',
    category: 'customer',
    subject: 'We received your request: {{ticket.subject}}',
    body: 'Hi {{customer.firstname}},\n\nThanks for reaching out! We have received your ticket regarding "{{ticket.subject}}" and our team is looking into it.\n\nYour Ticket ID is: {{ticket.id}}\n\nBest regards,\n{{helpdesk_name}}',
    enabled: true,
    placeholders: ['customer.firstname', 'ticket.subject', 'ticket.id', 'helpdesk_name'],
    trigger: 'ticket.created'
  },
  {
    id: 'customer-ticket-solved',
    name: 'Ticket Solved',
    description: 'Sent to customers when their ticket is marked as solved.',
    category: 'customer',
    subject: 'Your request has been solved: {{ticket.subject}}',
    body: 'Hi {{customer.firstname}},\n\nYour ticket "{{ticket.subject}}" has been marked as solved. We hope we were able to assist you effectively.\n\nIf you have further questions, just reply to this email.\n\nBest,\n{{helpdesk_name}} Team',
    enabled: true,
    placeholders: ['customer.firstname', 'ticket.subject', 'helpdesk_name'],
    trigger: 'ticket.solved'
  }
];

export enum FirestoreOperation {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: FirestoreOperation, path: string | null) {
  console.error(`Firestore Error [${operationType}] at ${path}:`, error);
  throw error;
}

export const notificationService = {
  async getTemplates(): Promise<NotificationTemplate[]> {
    const colRef = collection(db, 'notification_templates');
    try {
      const snapshot = await getDocs(colRef);
      if (snapshot.empty) {
        return DEFAULT_TEMPLATES;
      }
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NotificationTemplate));
    } catch (error) {
      handleFirestoreError(error, FirestoreOperation.LIST, 'notification_templates');
      return DEFAULT_TEMPLATES;
    }
  },

  async updateTemplate(id: string, updates: Partial<NotificationTemplate>) {
    const docRef = doc(db, 'notification_templates', id);
    try {
      await updateDoc(docRef, updates);
    } catch (error) {
      handleFirestoreError(error, FirestoreOperation.UPDATE, `notification_templates/${id}`);
    }
  },

  hydrate(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{(.*?)\}\}/g, (match, key) => {
      const parts = key.trim().split('.');
      let value = data;
      for (const part of parts) {
        value = value?.[part];
      }
      return value !== undefined ? String(value) : match;
    });
  },

  // In-App Notifications
  async sendNotification(notification: Omit<SystemNotification, 'id' | 'createdAt' | 'read'>) {
    if (!notification.userId) {
      console.warn("Attempted to send notification without userId");
      return;
    }
    const colRef = collection(db, 'notifications');
    try {
      await addDoc(colRef, {
        ...notification,
        read: false,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, FirestoreOperation.CREATE, 'notifications');
    }
  },

  subscribeToNotifications(userId: string, callback: (notifications: SystemNotification[]) => void) {
    if (!userId) {
      console.warn("Attempted to subscribe to notifications without userId");
      return () => {};
    }
    const colRef = collection(db, 'notifications');
    const q = query(
      colRef,
      where('userId', '==', userId),
      limit(50)
    );

    return onSnapshot(q, (snapshot) => {
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt
      } as SystemNotification));

      // Sort client-side: newest first
      notifications.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });

      callback(notifications);
    }, (error) => {
      console.error("Notification subscription error:", error);
    });
  },

  async markAsRead(notificationId: string) {
    const docRef = doc(db, 'notifications', notificationId);
    try {
      await updateDoc(docRef, { 
        read: true,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, FirestoreOperation.UPDATE, `notifications/${notificationId}`);
    }
  },

  async markAllAsRead(userId: string) {
    if (!userId) {
      console.warn("Attempted to mark all notifications read without userId");
      return;
    }
    const colRef = collection(db, 'notifications');
    const q = query(colRef, where('userId', '==', userId));
    
    try {
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      let count = 0;
      snapshot.docs.forEach((doc) => {
        if (doc.data().read === false) {
          batch.update(doc.ref, { 
            read: true,
            updatedAt: serverTimestamp()
          });
          count++;
        }
      });
      if (count > 0) {
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, FirestoreOperation.UPDATE, 'notifications (batch mark as read)');
    }
  },

  async seedMockNotifications(userId: string) {
    if (!userId) return;
    const mocks: Omit<SystemNotification, 'id' | 'createdAt' | 'read'>[] = [
      {
        userId,
        title: 'Level 4 Security Breach Prevented',
        message: 'A Master Secret shard was accessed via an unverified vLLM endpoint. GeistDesk autonomous proxy successfully intercepted the request.',
        category: 'security',
        priority: 'high'
      },
      {
        userId,
        title: 'Priority Ticket Assigned',
        message: 'You have been assigned to Ticket #NX-2026-08 (Apex Corp: LLM Hallucinated in PII redaction).',
        category: 'ticket',
        priority: 'medium'
      },
      {
        userId,
        title: 'System Update: Lexical Redaction V4',
        message: 'GeistDesk has updated its global entity schema to include 2026 GDPR-V2 compliance requirements.',
        category: 'system',
        priority: 'low'
      }
    ];

    for (const mock of mocks) {
      await this.sendNotification(mock);
    }
  }
};
