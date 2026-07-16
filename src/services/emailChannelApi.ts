import axios from 'axios';
import type { EmailChannelConfig, EmailConnectionType } from '../lib/email-ingestion/types';

export type { EmailChannelConfig, EmailConnectionType };

export interface DomainVerifyResult {
  success: boolean;
  dnsVerified: boolean;
  domain: string;
  message: string;
  checks?: {
    verificationTxt: boolean;
    dkim: boolean;
    spf: boolean;
  };
  records?: {
    verificationToken?: string | null;
    verificationTxt?: string;
    dkimRecordName?: string | null;
    dkimRecordValue?: string | null;
    spfRecordValue?: string | null;
  };
  channel?: {
    id: string;
    email: string;
    dnsVerified: boolean;
    dnsVerifiedAt: string | null;
  };
  error?: string;
}

export const emailChannelApi = {
  async list(): Promise<EmailChannelConfig[]> {
    const res = await axios.get('/api/email-channels', { withCredentials: true });
    return res.data?.channels || [];
  },

  async create(payload: Partial<EmailChannelConfig>): Promise<EmailChannelConfig> {
    const res = await axios.post('/api/email-channels', payload, { withCredentials: true });
    return res.data.channel;
  },

  async update(id: string, payload: Partial<EmailChannelConfig>): Promise<EmailChannelConfig> {
    const res = await axios.put(`/api/email-channels/${encodeURIComponent(id)}`, payload, {
      withCredentials: true,
    });
    return res.data.channel;
  },

  async remove(id: string): Promise<void> {
    await axios.delete(`/api/email-channels/${encodeURIComponent(id)}`, { withCredentials: true });
  },

  async test(
    id: string,
    overrides?: Partial<EmailChannelConfig>,
  ): Promise<{ ok: boolean; message: string }> {
    const res = await axios.post(
      `/api/email-channels/${encodeURIComponent(id)}/test`,
      overrides || {},
      { withCredentials: true },
    );
    return {
      ok: Boolean(res.data?.ok ?? res.data?.success),
      message: res.data?.message || res.data?.error || '',
    };
  },

  async verifyDomain(channelId: string): Promise<DomainVerifyResult> {
    const res = await axios.post(
      `/api/mail/verify-domain/${encodeURIComponent(channelId)}`,
      {},
      { withCredentials: true },
    );
    return res.data as DomainVerifyResult;
  },
};
