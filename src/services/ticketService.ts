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
import { Ticket, Message, OperationType, TicketChecklistItem } from '../types';
import { ensureChecklistTaskIds, normalizeChecklistItems, createChecklistTask } from '../lib/ticket-checklist-utils';
import { handleFirestoreError, logAudit } from './auditService';
import { groupService } from './groupService';
import { notificationService } from './notificationService';
import { autopilotService } from './autopilotService';
import axios from 'axios';

const TICKETS_COLLECTION = 'tickets';

function enqueueTicketVector(
  sourceId: string,
  type: 'INDEX_RESOLVED_TICKET' | 'DELETE_EMBEDDINGS',
) {
  void axios
    .post(
      '/api/vectors/enqueue',
      {
        type,
        sourceId,
        sourceType: 'RESOLVED_TICKET',
      },
      { withCredentials: true },
    )
    .catch(() => {
      /* non-fatal — /api/db hook is authoritative */
    });
}

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
        include_in_rag: true,
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

  updateTicket: async (id: string, updates: Partial<Ticket>): Promise<{ success: boolean; ticket?: Ticket }> => {
    try {
      // REST-first update against the PostgreSQL backend.
      const res = await fetch(`/api/tickets/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string })?.error || `Ticket update failed (${res.status})`);
      }

      const ticketSubject = (data as { ticket?: Ticket })?.ticket?.subject || 'Ticket';
      const ticketDescription = (data as { ticket?: Ticket })?.ticket?.description || '';

      // Hook newly solved tickets into autopilot + vector RAG index
      if (updates.status === 'resolved' || updates.status === 'closed') {
        try {
          if (updates.status === 'resolved') {
            await autopilotService.processNewlySolvedTicket(id, ticketSubject, ticketDescription);
          }
        } catch (e) {
          console.warn("Autopilot processing failed silently:", e);
        }
        enqueueTicketVector(id, 'INDEX_RESOLVED_TICKET');
      } else if (updates.status === 'trash' || updates.status === 'deleted') {
        enqueueTicketVector(id, 'DELETE_EMBEDDINGS');
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

      return { success: true, ticket: (data as { ticket?: Ticket }).ticket };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${TICKETS_COLLECTION}/${id}`);
      throw error;
    }
  },

  /**
   * Bulk update via POST /api/tickets/bulk-update (PostgreSQL backend).
   * Returns the updated tickets.
   */
  bulkUpdate: async (
    ids: string[],
    updates: Partial<Ticket>,
  ): Promise<{ success: boolean; updated: number; failed: number; tickets?: (Ticket & { id: string })[] }> => {
    const res = await fetch('/api/tickets/bulk-update', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, updates }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as { error?: string })?.error || `Bulk update failed (${res.status})`);
    }
    return data as {
      success: boolean;
      updated: number;
      failed: number;
      tickets?: (Ticket & { id: string })[];
    };
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
    // Prefer database-first reply API (graceful when SMTP is unavailable).
    if (message.senderType === 'agent' && message.content) {
      return ticketService.sendReply(ticketId, {
        content: message.content,
        originalContent: message.originalContent,
        senderId: message.senderId || auth.currentUser?.uid || 'agent',
        senderName: message.senderName,
        senderType: 'agent',
      });
    }

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
      return {
        success: true,
        savedToDb: true,
        delivered: true,
        deliveryStatus: 'delivered' as const,
        deliveryReason: null as string | null,
        message: { id: msgRef.id, ...message },
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  /**
   * Von:/An: labels for the ticket reply composer.
   * Resolves the channel forwarding alias (not a hardcoded support@ address).
   */
  getComposerAddresses: async (
    ticketId: string,
  ): Promise<{ from: string; to: string }> => {
    const res = await fetch(
      `/api/tickets/${encodeURIComponent(ticketId)}/composer-addresses`,
      { credentials: 'include' },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        (data as { error?: string })?.error || `Composer addresses failed (${res.status})`,
      );
    }
    return {
      from: String((data as { from?: string }).from || ''),
      to: String((data as { to?: string }).to || ''),
    };
  },

  /**
   * Database-first agent reply via POST /api/tickets/:id/replies.
   * Always persists; returns delivered=false when outbound mail is unavailable.
   */
  sendReply: async (
    ticketId: string,
    payload: {
      content: string;
      originalContent?: string;
      senderId: string;
      senderName?: string;
      senderType?: 'agent' | 'customer' | 'ai';
    },
  ): Promise<{
    success: boolean;
    savedToDb: boolean;
    delivered: boolean;
    deliveryStatus: 'delivered' | 'saved_locally' | 'pending';
    deliveryReason?: string | null;
    message: Partial<Message> & { id: string };
  }> => {
    const res = await fetch(`/api/tickets/${encodeURIComponent(ticketId)}/replies`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as { error?: string })?.error || `Reply failed (${res.status})`);
    }
    return data as {
      success: boolean;
      savedToDb: boolean;
      delivered: boolean;
      deliveryStatus: 'delivered' | 'saved_locally' | 'pending';
      deliveryReason?: string | null;
      message: Partial<Message> & { id: string };
    };
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

  mergeTickets: async (
    sourceId: string,
    destinationId: string,
    snapshots?: { source?: Ticket | null; dest?: Ticket | null },
  ) => {
    if (!sourceId || !destinationId || sourceId === destinationId) {
      throw new Error('Invalid merge targets');
    }

    try {
      const sourceTicket =
        snapshots?.source ||
        (await ticketService.getTicket(sourceId).catch(() => null));
      const destTicket =
        snapshots?.dest ||
        (await ticketService.getTicket(destinationId).catch(() => null));

      if (!sourceTicket && !destTicket && !snapshots) {
        throw new Error('Tickets not found');
      }

      try {
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
      } catch (messageError) {
        console.warn('Merge: could not copy Firestore messages', messageError);
      }

      if (sourceTicket?.agentComments && sourceTicket.agentComments.length > 0) {
        for (const comment of sourceTicket.agentComments) {
          try {
            await ticketService.addAgentComment(destinationId, {
              ...comment,
              content: `[Merged from #${sourceId.slice(-5)}]: ${comment.content}`
            });
          } catch (commentError) {
            console.warn('Merge: could not copy agent comment', commentError);
          }
        }
      }

      const stamp = new Date().toLocaleString();
      const sourceRef = `#${sourceId.slice(-5).toUpperCase()}`;
      const destRef = `#${destinationId.slice(-5).toUpperCase()}`;
      const timelineBlock = [
        `[Zusammengeführt von ${sourceRef} am ${stamp}]`,
        sourceTicket?.subject ? `Betreff: ${sourceTicket.subject}` : '',
        sourceTicket?.description ? String(sourceTicket.description) : '',
        sourceTicket?.internalNotes ? `Notizen:\n${sourceTicket.internalNotes}` : '',
      ].filter(Boolean).join('\n\n');

      const destNotes = [destTicket?.internalNotes, timelineBlock]
        .filter(Boolean)
        .join('\n\n');
      const sourceNotes = [
        sourceTicket?.internalNotes,
        `[Zusammengeführt]: Dieses Ticket wurde am ${stamp} in ${destRef} überführt.`,
      ].filter(Boolean).join('\n\n');

      const destLinked = Array.from(
        new Set([...(destTicket?.linkedTicketIds || []), sourceId]),
      );

      await ticketService.updateTicket(destinationId, {
        internalNotes: destNotes,
        linkedTicketIds: destLinked,
        isMasterTicket: true,
      });

      await ticketService.updateTicket(sourceId, {
        status: 'merged',
        mergedIntoId: destinationId,
        masterTicketId: destinationId,
        internalNotes: sourceNotes,
      });

      try {
        await ticketService.addAgentComment(destinationId, {
          content: timelineBlock,
          agentName: 'System',
          agentId: 'system-merge',
        });
      } catch {
        /* timeline note already stored on internalNotes */
      }

      await logAudit({
        module: 'tickets',
        action: 'TICKETS_MERGED',
        severity: 'high',
        details: { sourceId, destinationId }
      });

      return { destNotes, destLinked };
    } catch (error) {
      console.error("Merge failed:", error);
      throw error;
    }
  },

  mergeTicketsIntoPrimary: async (
    primaryId: string,
    sourceIds: string[],
    ticketsById?: Map<string, Ticket>,
  ) => {
    const uniqueSources = [...new Set(sourceIds)].filter((id) => id && id !== primaryId);
    if (!primaryId || uniqueSources.length === 0) {
      throw new Error('Select a primary ticket and at least one ticket to merge.');
    }
    let dest = ticketsById?.get(primaryId) ?? null;
    for (const sourceId of uniqueSources) {
      const result = await ticketService.mergeTickets(sourceId, primaryId, {
        source: ticketsById?.get(sourceId) ?? null,
        dest,
      });
      if (dest) {
        dest = {
          ...dest,
          isMasterTicket: true,
          linkedTicketIds: result.destLinked,
          internalNotes: result.destNotes,
        };
      }
    }
    return true;
  },

  async getTicketChecklist(ticketId: string): Promise<TicketChecklistItem[]> {
    const ticket = await ticketService.getTicket(ticketId);
    return ensureChecklistTaskIds(normalizeChecklistItems(ticket?.aiChecklist));
  },

  async persistTicketChecklist(ticketId: string, checklist: TicketChecklistItem[]): Promise<TicketChecklistItem[]> {
    const normalized = ensureChecklistTaskIds(checklist);
    await ticketService.updateTicket(ticketId, { aiChecklist: normalized });
    return normalized;
  },

  async toggleTaskCompletion(ticketId: string, taskId: string): Promise<TicketChecklistItem[]> {
    const checklist = await ticketService.getTicketChecklist(ticketId);
    const next = checklist.map((item) =>
      item.id === taskId ? { ...item, completed: !item.completed } : item,
    );
    return ticketService.persistTicketChecklist(ticketId, next);
  },

  async addChecklistTask(ticketId: string, taskText: string): Promise<TicketChecklistItem[]> {
    const trimmed = taskText.trim();
    if (!trimmed) return ticketService.getTicketChecklist(ticketId);
    const checklist = await ticketService.getTicketChecklist(ticketId);
    const next = [...checklist, createChecklistTask(trimmed, 'manual')];
    return ticketService.persistTicketChecklist(ticketId, next);
  },

  async updateChecklistTask(
    ticketId: string,
    taskId: string,
    taskText: string,
  ): Promise<TicketChecklistItem[]> {
    const trimmed = taskText.trim();
    if (!trimmed) return ticketService.getTicketChecklist(ticketId);
    const checklist = await ticketService.getTicketChecklist(ticketId);
    const next = checklist.map((item) => (item.id === taskId ? { ...item, task: trimmed } : item));
    return ticketService.persistTicketChecklist(ticketId, next);
  },

  async deleteChecklistTask(ticketId: string, taskId: string): Promise<TicketChecklistItem[]> {
    const checklist = await ticketService.getTicketChecklist(ticketId);
    const next = checklist.filter((item) => item.id !== taskId);
    return ticketService.persistTicketChecklist(ticketId, next);
  },

  /**
   * Mark ticket as spam and blacklist the sender via POST /api/tickets/:id/spam.
   */
  markAsSpam: async (
    ticketId: string,
  ): Promise<{
    success: boolean;
    ticketId: string;
    status: 'spam';
    blocked_value: string;
    blacklistId: string;
  }> => {
    const res = await fetch(`/api/tickets/${encodeURIComponent(ticketId)}/spam`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as { error?: string })?.error || `Mark as spam failed (${res.status})`);
    }
    await logAudit({
      module: 'tickets',
      action: 'TICKET_MARKED_SPAM',
      severity: 'high',
      details: {
        ticketId,
        blocked_value: (data as { blocked_value?: string }).blocked_value,
      },
    });
    return data as {
      success: boolean;
      ticketId: string;
      status: 'spam';
      blocked_value: string;
      blacklistId: string;
    };
  },
};
