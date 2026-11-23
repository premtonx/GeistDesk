import axios from 'axios';
import type { Ticket, TicketPriority, TicketStatus } from '../types';

export interface PortalMember {
  id: string;
  name: string;
  email: string;
  role: string;
  isDeactivated?: boolean;
}

export interface PortalTicketAttachment {
  filename: string;
  contentType: string;
  size: number;
  contentBase64: string;
}

async function dbAction<T = unknown>(payload: Record<string, unknown>): Promise<T> {
  const res = await axios.post('/api/db', payload, { withCredentials: true });
  return res.data?.result as T;
}

export const clientPortalApi = {
  async listMembers(): Promise<PortalMember[]> {
    const res = await axios.get('/api/portal/members', { withCredentials: true });
    return res.data?.members || [];
  },

  async inviteMember(payload: {
    name: string;
    email: string;
    role: 'CLIENT_SUPPORTER' | 'CLIENT_USER';
  }): Promise<{ member: PortalMember; temporaryPassword?: string }> {
    const res = await axios.post('/api/portal/members', payload, { withCredentials: true });
    return {
      member: res.data?.member,
      temporaryPassword: res.data?.temporaryPassword,
    };
  },

  async listTickets(): Promise<Ticket[]> {
    const docs = await dbAction<Ticket[]>({
      action: 'get_docs',
      collection: 'tickets',
      constraints: [],
    });
    return Array.isArray(docs) ? docs : [];
  },

  async getTicket(id: string): Promise<Ticket | null> {
    const doc = await dbAction<Ticket | null>({
      action: 'get_doc',
      collection: 'tickets',
      id,
    });
    return doc || null;
  },

  async createTicket(payload: {
    subject: string;
    description: string;
    priority: TicketPriority;
    category?: string;
    status?: TicketStatus;
    requesterId?: string;
    participantIds?: string[];
    attachments?: PortalTicketAttachment[];
    customerName?: string;
    customerEmail?: string;
  }): Promise<string> {
    const created = await dbAction<{ id: string }>({
      action: 'add_doc',
      collection: 'tickets',
      data: {
        subject: payload.subject,
        description: payload.description,
        html_content: payload.description,
        priority: payload.priority,
        status: payload.status || 'open',
        tags: payload.category ? ['client-portal', `category:${payload.category}`] : ['client-portal'],
        channel: 'portal',
        type: 'incident',
        ticketKind: 'support',
        customerName: payload.customerName || '',
        customerEmail: payload.customerEmail || '',
        requesterId: payload.requesterId,
        attachments: payload.attachments || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    const ticketId = created?.id;
    if (!ticketId) throw new Error('Ticket create failed — missing id.');

    // Add participants after create (server stamps organizationId).
    for (const userId of payload.participantIds || []) {
      if (!userId || userId === payload.requesterId) continue;
      try {
        await axios.post(
          `/api/tickets/${encodeURIComponent(ticketId)}/participants`,
          { userId },
          { withCredentials: true },
        );
      } catch {
        /* non-fatal — ticket already exists */
      }
    }

    return ticketId;
  },

  async listMessages(ticketId: string): Promise<any[]> {
    const docs = await dbAction<any[]>({
      action: 'get_docs',
      collection: `tickets/${ticketId}/messages`,
      constraints: [],
    });
    return Array.isArray(docs) ? docs : [];
  },

  async reply(
    ticketId: string,
    payload: { content: string; senderId: string; senderName?: string },
  ) {
    const res = await axios.post(
      `/api/tickets/${encodeURIComponent(ticketId)}/replies`,
      {
        content: payload.content,
        senderId: payload.senderId,
        senderName: payload.senderName,
        senderType: 'customer',
      },
      { withCredentials: true },
    );
    return res.data;
  },

  async updateTicketStatus(ticketId: string, status: TicketStatus) {
    const res = await axios.patch(
      `/api/tickets/${encodeURIComponent(ticketId)}`,
      { status },
      { withCredentials: true },
    );
    return res.data?.ticket;
  },

  async listParticipants(ticketId: string) {
    const res = await axios.get(`/api/tickets/${encodeURIComponent(ticketId)}/participants`, {
      withCredentials: true,
    });
    return (res.data?.participants || []) as Array<{
      ticket_id: string;
      user_id: string;
      added_by: string | null;
      created_at: string;
    }>;
  },

  async addParticipant(ticketId: string, userId: string) {
    const res = await axios.post(
      `/api/tickets/${encodeURIComponent(ticketId)}/participants`,
      { userId },
      { withCredentials: true },
    );
    return res.data?.participant;
  },

  async removeParticipant(ticketId: string, userId: string) {
    await axios.delete(
      `/api/tickets/${encodeURIComponent(ticketId)}/participants/${encodeURIComponent(userId)}`,
      { withCredentials: true },
    );
  },
};
