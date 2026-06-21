import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  getDoc,
  getDocs,
  arrayUnion,
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Ticket, Message, OperationType } from '../types';
import { handleFirestoreError, logAudit } from './auditService';
import { groupService } from './groupService';
import { notificationService } from './notificationService';
import { autopilotService } from './autopilotService';

const TICKETS_COLLECTION = 'tickets';

export const ticketService = {
  subscribeToTickets: (callback: (tickets: Ticket[]) => void, filters?: { agentId?: string; scope?: 'all' | 'assigned' }) => {
    const user = auth.currentUser;
    if (!user) return () => {};

    let q;
    const baseRef = collection(db, TICKETS_COLLECTION);

    if (filters?.scope === 'assigned' && filters.agentId) {
      q = query(baseRef, where('agentId', '==', filters.agentId), orderBy('updatedAt', 'desc'));
    } else {
      q = query(baseRef, orderBy('updatedAt', 'desc'));
    }

    return onSnapshot(q, (snapshot) => {
      const tickets = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Ticket[];
      callback(tickets);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, TICKETS_COLLECTION);
    });
  },

  subscribeToTicketsByCompany: (companyId: string, callback: (tickets: Ticket[]) => void) => {
    const q = query(
      collection(db, TICKETS_COLLECTION), 
      where('companyId', '==', companyId),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const tickets = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Ticket[];
      callback(tickets);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, TICKETS_COLLECTION);
    });
  },

  getTicket: async (id: string): Promise<Ticket | null> => {
    try {
      const docRef = doc(db, TICKETS_COLLECTION, id);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        await logAudit({
          module: 'tickets',
          action: 'TICKET_ACCESSED',
          severity: 'low',
          details: { ticketId: id }
        });
        return { id: snapshot.id, ...snapshot.data() } as Ticket;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${TICKETS_COLLECTION}/${id}`);
      return null;
    }
  },

  createTicket: async (ticket: Partial<Ticket>) => {
    try {
      let finalTicket = { ...ticket };
      
      if (!finalTicket.groupId && !finalTicket.agentId) {
        const defaultGroup = await groupService.getDefaultGroup();
        if (defaultGroup) {
          finalTicket.groupId = defaultGroup.id;
          finalTicket.groupName = defaultGroup.name;
        }
      }

      const docRef = await addDoc(collection(db, TICKETS_COLLECTION), {
        ...finalTicket,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await logAudit({
        module: 'tickets',
        action: 'TICKET_CREATED',
        severity: 'medium',
        details: { ticketId: docRef.id, subject: ticket.subject, customerId: ticket.customerId }
      });

      if (finalTicket.groupId) {
        console.log(`[Notification] New ticket ${docRef.id} assigned to group ${finalTicket.groupName}`);
      }

      // Send a notification to the current user
      const user = auth.currentUser;
      if (user) {
        await notificationService.sendNotification({
          userId: user.uid,
          title: `Neues Ticket erstellt: #${docRef.id.slice(0, 6)}`,
          message: `Ticket "${ticket.subject || 'Unbenannt'}" wurde erfolgreich im System hinterlegt. Status: ${ticket.status || 'open'}.`,
          category: 'ticket',
          priority: 'medium',
          link: `/tickets/${docRef.id}`
        });
      }

      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, TICKETS_COLLECTION);
    }
  },

  updateTicket: async (id: string, updates: Partial<Ticket>) => {
    try {
      const docRef = doc(db, TICKETS_COLLECTION, id);
      
      // Fetch ticket snapshot to get its subject before update
      const ticketSnap = await getDoc(docRef);
      const ticketData = ticketSnap.data();
      const ticketSubject = ticketData?.subject || 'Ticket';

      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });

      // Hook newly solved tickets into autopilot
      if (updates.status === 'resolved') {
        try {
          await autopilotService.processNewlySolvedTicket(id, ticketSubject, ticketData?.description || '');
        } catch (e) {
          console.warn("Autopilot processing failed silently:", e);
        }
      }

      await logAudit({
        module: 'tickets',
        action: 'TICKET_UPDATED',
        severity: 'medium',
        details: { ticketId: id, updates: Object.keys(updates) }
      });

      // Send update notification to current user
      const user = auth.currentUser;
      if (user) {
        let updateMsg = `Ticket "${ticketSubject}" wurde im System aktualisiert.`;
        if (updates.status) {
          updateMsg = `Der Status von Ticket "${ticketSubject}" wurde auf "${updates.status}" geändert.`;
        } else if (updates.priority) {
          updateMsg = `Die Priorität von Ticket "${ticketSubject}" wurde auf "${updates.priority}" geändert.`;
        } else if (updates.agentName) {
          updateMsg = `Ticket "${ticketSubject}" wurde an "${updates.agentName}" übergeben.`;
        }

        await notificationService.sendNotification({
          userId: user.uid,
          title: `Ticket aktualisiert: #${id.slice(0, 6)}`,
          message: updateMsg,
          category: 'ticket',
          priority: 'medium',
          link: `/tickets/${id}`
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${TICKETS_COLLECTION}/${id}`);
    }
  },

  subscribeToMessages: (ticketId: string, callback: (messages: Message[]) => void) => {
    const path = `${TICKETS_COLLECTION}/${ticketId}/messages`;
    const q = query(collection(db, path), orderBy('createdAt', 'asc'));

    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      callback(messages);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  sendMessage: async (ticketId: string, message: Partial<Message>) => {
    const path = `${TICKETS_COLLECTION}/${ticketId}/messages`;
    try {
      const msgRef = await addDoc(collection(db, path), {
        ...message,
        createdAt: serverTimestamp()
      });
      
      await updateDoc(doc(db, TICKETS_COLLECTION, ticketId), {
        updatedAt: serverTimestamp()
      });

      await logAudit({
        module: 'tickets',
        action: 'MESSAGE_SENT',
        severity: 'low',
        details: { ticketId, messageId: msgRef.id, senderType: message.senderType }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  setPresence: async (ticketId: string, isPresent: boolean) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const docRef = doc(db, TICKETS_COLLECTION, ticketId);
      const presenceInfo = {
        uid: user.uid,
        name: user.displayName || user.email?.split('@')[0] || 'Unknown',
        avatar: user.photoURL || undefined,
        lastActive: new Date().toISOString()
      };

      if (isPresent) {
        await updateDoc(docRef, {
          activeAgents: arrayUnion(presenceInfo)
        });
      } else {
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data() as Ticket;
          const newActive = (data.activeAgents || []).filter(a => a.uid !== user.uid);
          await updateDoc(docRef, {
            activeAgents: newActive
          });
        }
      }
    } catch (error) {
      console.error('Error setting presence:', error);
    }
  },
  
  addAgentComment: async (ticketId: string, comment: { content: string; agentName: string; agentId: string }) => {
    try {
      const docRef = doc(db, TICKETS_COLLECTION, ticketId);
      await updateDoc(docRef, {
        agentComments: arrayUnion({
          ...comment,
          id: Math.random().toString(36).substring(7),
          createdAt: new Date().toISOString()
        }),
        updatedAt: serverTimestamp()
      });

      await logAudit({
        module: 'tickets',
        action: 'AGENT_COMMENT_ADDED',
        severity: 'medium',
        details: { ticketId, agentId: comment.agentId }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${TICKETS_COLLECTION}/${ticketId}`);
    }
  },

  mergeTickets: async (sourceId: string, destinationId: string) => {
    try {
      const sourceTicket = await ticketService.getTicket(sourceId);
      const destTicket = await ticketService.getTicket(destinationId);
      
      if (!sourceTicket || !destTicket) throw new Error("Tickets not found");

      const messagesRef = collection(db, `${TICKETS_COLLECTION}/${sourceId}/messages`);
      const messagesSnap = await getDocs(messagesRef);
      const messages = messagesSnap.docs.map(d => d.data() as Message);

      for (const msg of messages) {
        await ticketService.sendMessage(destinationId, {
          ...msg,
          id: undefined,
          content: `[Merged from #${sourceId.slice(-5)}]: ${msg.content}`
        });
      }

      if (sourceTicket.agentComments && sourceTicket.agentComments.length > 0) {
        for (const comment of sourceTicket.agentComments) {
          await ticketService.addAgentComment(destinationId, {
            ...comment,
            content: `[Merged from #${sourceId.slice(-5)}]: ${comment.content}`
          });
        }
      }

      await ticketService.updateTicket(sourceId, {
        status: 'merged',
        mergedIntoId: destinationId,
        internalNotes: `${sourceTicket.internalNotes || ''}\n\n[Unifier]: This ticket was merged into #${destinationId.slice(-5)} on ${new Date().toLocaleString()}`
      });

      await ticketService.updateTicket(destinationId, {
        internalNotes: `${destTicket.internalNotes || ''}\n\n[Unifier]: Ticket #${sourceId.slice(-5)} was merged into this ticket on ${new Date().toLocaleString()}`
      });

      await logAudit({
        module: 'tickets',
        action: 'TICKETS_MERGED',
        severity: 'high',
        details: { sourceId, destinationId }
      });

      return true;
    } catch (error) {
      console.error("Merge failed:", error);
      throw error;
    }
  }
};
