export type PiiShieldUiStatus = 'active' | 'standby' | 'inactive';
export type ProcessingRouteKind = 'local' | 'cloud';

export interface SanitizationCounts {
  emails: number;
  passwords: number;
  apiKeys: number;
  ipAddresses: number;
}

export interface HeaderTelemetrySnapshot {
  pii: {
    enabled: boolean;
    status: PiiShieldUiStatus;
    counts: SanitizationCounts;
  };
  sovereignty: {
    deploymentType: string;
    dataResidency: string;
    dataResidencyCode: string;
    processingRoute: ProcessingRouteKind;
    processingRouteLabel: string;
    auditEnabled: boolean;
    auditActive: boolean;
  };
}

export const EMPTY_SANITIZATION_COUNTS: SanitizationCounts = {
  emails: 0,
  passwords: 0,
  apiKeys: 0,
  ipAddresses: 0,
};

export const EMPTY_HEADER_TELEMETRY: HeaderTelemetrySnapshot = {
  pii: {
    enabled: false,
    status: 'inactive',
    counts: { ...EMPTY_SANITIZATION_COUNTS },
  },
  sovereignty: {
    deploymentType: 'Docker (Self-Hosted)',
    dataResidency: 'Lokaler Server / On-Premise',
    dataResidencyCode: 'local',
    processingRoute: 'local',
    processingRouteLabel: '100% Lokale Inferenz (Ollama)',
    auditEnabled: false,
    auditActive: false,
  },
};
