import { EMPTY_HEADER_TELEMETRY, type HeaderTelemetrySnapshot } from '../types/headerTelemetry';

export type { HeaderTelemetrySnapshot };
export { EMPTY_HEADER_TELEMETRY };

export async function fetchHeaderTelemetry(): Promise<HeaderTelemetrySnapshot> {
  try {
    const res = await fetch('/api/header/telemetry', { credentials: 'include' });
    if (!res.ok) return EMPTY_HEADER_TELEMETRY;
    const data = (await res.json()) as HeaderTelemetrySnapshot;
    return {
      ...EMPTY_HEADER_TELEMETRY,
      ...data,
      pii: {
        ...EMPTY_HEADER_TELEMETRY.pii,
        ...(data.pii || {}),
        counts: {
          ...EMPTY_HEADER_TELEMETRY.pii.counts,
          ...(data.pii?.counts || {}),
        },
      },
      sovereignty: {
        ...EMPTY_HEADER_TELEMETRY.sovereignty,
        ...(data.sovereignty || {}),
      },
    };
  } catch {
    return EMPTY_HEADER_TELEMETRY;
  }
}
