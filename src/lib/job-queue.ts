/**
 * Durable background job queue backed by the `background_jobs` Postgres table.
 *
 * Provides `enqueueJob` / `leaseNextJob` (advisory `SKIP LOCKED`) /
 * `completeJob` / `failJob` (exponential backoff via `run_after`), and
 * `getJobQueueDepth` for health endpoints. All four in-process workers
 * (vector queue, external-source sync, email polling, swarm detection) are
 * migrated onto this queue so jobs survive process restarts and are
 * lease-guarded against duplicate concurrent execution across processes.
 */

import { queryDb, withPgTransaction } from './postgres-backend.js';
import { safeErrorMessage } from './safe-log.js';

export type BackgroundJobStatus = 'pending' | 'running' | 'done' | 'failed';

export type BackgroundJobType =
  | 'VECTOR_INDEX'
  | 'VECTOR_DELETE'
  | 'EXTERNAL_SOURCE_SYNC'
  | 'EMAIL_POLL'
  | 'SWARM_DETECTION';

export interface BackgroundJobRow {
  id: string;
  job_type: BackgroundJobType;
  payload: Record<string, unknown> | null;
  status: BackgroundJobStatus;
  attempts: number;
  max_attempts: number;
  run_after: string;
  last_error: string | null;
  worker_id: string | null;
  created_at: string;
  updated_at: string;
}

const DEFAULT_MAX_ATTEMPTS = 3;

/** Insert one durable job. */
export async function enqueueJob(
  type: BackgroundJobType,
  payload: Record<string, unknown> | null = null,
  options: { maxAttempts?: number; runAfter?: Date } = {},
): Promise<string> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const runAfter = options.runAfter ?? new Date();
  const res = await queryDb(
    `INSERT INTO background_jobs (job_type, payload, status, attempts, max_attempts, run_after, worker_id)
     VALUES ($1, $2, 'pending', 0, $3, $4, NULL)
     RETURNING id`,
    [type, payload ? JSON.stringify(payload) : null, maxAttempts, runAfter.toISOString()],
  );
  return res.rows[0] ? String(res.rows[0].id) : '';
}

/**
 * Atomically claim the next due job of the given types for `workerId`.
 * Uses `FOR UPDATE SKIP LOCKED` so concurrent workers never double-claim.
 */
export async function leaseNextJob(
  workerId: string,
  types: BackgroundJobType[],
): Promise<BackgroundJobRow | null> {
  return withPgTransaction(async (client) => {
    const res = await client.query(
      `UPDATE background_jobs
         SET status = 'running', worker_id = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = (
         SELECT id
         FROM background_jobs
         WHERE status = 'pending'
           AND run_after <= CURRENT_TIMESTAMP
           AND job_type = ANY($2::text[])
         ORDER BY created_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       RETURNING *`,
      [workerId, types],
    );
    if (!res.rows[0]) return null;
    return mapRow(res.rows[0]);
  });
}

/** Mark a leased job as completed. */
export async function completeJob(id: string): Promise<void> {
  await queryDb(
    `UPDATE background_jobs
       SET status = 'done', worker_id = NULL, last_error = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [id],
  );
}

/**
 * Mark a leased job as failed, applying exponential backoff to `run_after`
 * (500ms * 2^(attempt-1)) until `max_attempts` is exhausted.
 */
export async function failJob(id: string, error: unknown): Promise<void> {
  const message = safeErrorMessage(error);
  const res = await queryDb(
    `UPDATE background_jobs
       SET attempts = attempts + 1,
           last_error = $2,
           worker_id = NULL,
           updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING attempts, max_attempts`,
    [id, message],
  );
  const row = res.rows[0];
  if (!row) return;
  const attempts = Number(row.attempts);
  const maxAttempts = Number(row.max_attempts) || DEFAULT_MAX_ATTEMPTS;
  if (attempts >= maxAttempts) {
    await queryDb(
      `UPDATE background_jobs
         SET status = 'failed', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id],
    );
    return;
  }
  const backoffMs = 500 * 2 ** (attempts - 1);
  await queryDb(
    `UPDATE background_jobs
       SET status = 'pending', run_after = CURRENT_TIMESTAMP + make_interval(secs => $2), updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [id, backoffMs / 1000],
  );
}

/** Depth of pending/running jobs for health telemetry. */
export async function getJobQueueDepth(): Promise<number> {
  const res = await queryDb(
    `SELECT COUNT(*)::int AS depth
     FROM background_jobs
     WHERE status IN ('pending', 'running')`,
  );
  return Number(res.rows[0]?.depth || 0);
}

/** Requeue jobs that were left `running` by a crashed worker (startup recovery). */
export async function recoverOrphanedJobs(workerIdPrefix = 'worker'): Promise<number> {
  const res = await queryDb(
    `UPDATE background_jobs
       SET status = 'pending', worker_id = NULL, run_after = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE status = 'running'
       AND updated_at < CURRENT_TIMESTAMP - interval '10 minutes'
     RETURNING id`,
  );
  return res.rowCount || 0;
}

function mapRow(row: Record<string, unknown>): BackgroundJobRow {
  return {
    id: String(row.id),
    job_type: row.job_type as BackgroundJobType,
    payload: (row.payload as Record<string, unknown> | null) ?? null,
    status: row.status as BackgroundJobStatus,
    attempts: Number(row.attempts) || 0,
    max_attempts: Number(row.max_attempts) || DEFAULT_MAX_ATTEMPTS,
    run_after: row.run_after ? new Date(row.run_after as string).toISOString() : new Date().toISOString(),
    last_error: row.last_error ? String(row.last_error) : null,
    worker_id: row.worker_id ? String(row.worker_id) : null,
    created_at: row.created_at ? new Date(row.created_at as string).toISOString() : new Date().toISOString(),
    updated_at: row.updated_at ? new Date(row.updated_at as string).toISOString() : new Date().toISOString(),
  };
}
