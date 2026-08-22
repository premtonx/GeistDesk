export interface AdminHubTelemetry {
  activeAgents: number;
  ticketsProcessed: number;
  assetsManaged: number;
  vaultSecrets: number;
  knowledgeArticles: number;
  aiRequests: number;
  systemHealth: number;
  latencyMs: number;
}
