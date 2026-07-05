/**
 * Lightweight on-read migration helper: re-encrypt legacy v1 vault payloads to hybrid v2.
 * Safe to run repeatedly — skips rows already on v2.
 *
 * Usage: VAULT_ENCRYPTION_KEY=<hex> DATABASE_URL=<pg> node scripts/migrate-vault-payloads.mjs
 */
import 'dotenv/config';
import { initDb, getDocsDirect, getDocDirect, updateDocDirect } from '../src/lib/postgres-backend.ts';
import { isHybridEncryptedPayload } from '../src/lib/crypto-payload.ts';
import { decryptPayloadAuto, encryptPayloadPreferred } from '../src/lib/crypto.ts';

const VAULT_SECRETS = 'vault_item_secrets';
const VAULT_ITEMS = 'vault_items';

function assertEnv(name) {
  if (!process.env[name]) throw new Error(`${name} is required`);
}

async function migrateField(value, provenance) {
  if (!value) return { changed: false, value };
  if (isHybridEncryptedPayload(value)) return { changed: false, value };

  const plaintext = decryptPayloadAuto(value);
  return { changed: true, value: encryptPayloadPreferred(plaintext, provenance) };
}

async function main() {
  assertEnv('VAULT_ENCRYPTION_KEY');
  assertEnv('DATABASE_URL');
  await initDb();

  const items = await getDocsDirect(VAULT_ITEMS, []);
  let migratedRows = 0;

  for (const item of items) {
    if (!item?.secretRef) continue;
    const secret = await getDocDirect(VAULT_SECRETS, item.secretRef);
    if (!secret) continue;

    const provenance = `exchange:${item.createdBy ?? 'unknown'}:${item.id}`;
    let changed = false;
    const next = { ...secret };

    if (Array.isArray(secret.encryptedShares)) {
      const shares = [];
      for (const share of secret.encryptedShares) {
        const result = await migrateField(share, provenance);
        shares.push(result.value);
        if (result.changed) changed = true;
      }
      next.encryptedShares = shares;
    }

    if (secret.encryptedContent) {
      const result = await migrateField(secret.encryptedContent, provenance);
      next.encryptedContent = result.value;
      if (result.changed) changed = true;
    }

    if (changed) {
      await updateDocDirect(VAULT_SECRETS, item.secretRef, next);
      migratedRows += 1;
      console.log(`Migrated secret ${item.secretRef} for item ${item.id}`);
    }
  }

  console.log(`Done. Migrated ${migratedRows} secret row(s) to hybrid v2.`);
}

main().catch((error) => {
  console.error('Migration failed:', error.message || error);
  process.exit(1);
});
