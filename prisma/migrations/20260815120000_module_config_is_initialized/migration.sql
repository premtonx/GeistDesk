-- First-run wizard flag lives on module_config/global JSONB (geistdesk_documents).
-- Default is false. Only POST /api/admin/onboarding/complete may set is_initialized = true.
-- Also revert the former boot heuristic that stamped true with initializedBy=legacy-migration.

UPDATE geistdesk_documents
   SET data = jsonb_set(
         jsonb_set(
           jsonb_set(COALESCE(data, '{}'::jsonb), '{is_initialized}', 'false'::jsonb, true),
           '{initializedBy}',
           'null'::jsonb,
           true
         ),
         '{initializedAt}',
         'null'::jsonb,
         true
       ),
       updated_at = NOW()
 WHERE collection = 'module_config'
   AND id = 'global'
   AND (
     COALESCE(data->>'is_initialized', '') NOT IN ('true', 'false')
     OR data->>'initializedBy' = 'legacy-migration'
   );
