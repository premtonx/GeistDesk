export interface AdminHubTelemetry {
  activeAgents: number;
  ticketsProcessed: number;
  assetsManaged: number;
  vaultSecrets: number;
  knowledgeArticles: number;
  aiRequests: number;
  systemHealth: number;
  latencyMs: number;
  activeVectors: number;
  primaryModel: string | null;
  providers: AdminHubProviderHealth[];
}

export interface AdminHubProviderHealth {
  provider: string;
  label: string;
  status: 'online' | 'offline' | 'degraded' | 'missing_key';
  latencyMs?: number;
}
