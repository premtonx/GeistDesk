import { useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { isMacPlatform, isTypingHotkeyTarget } from './vault-utils';
import type { VaultAsset } from './VaultAssetViews';

interface UseVaultAssetHotkeysOptions {
  enabled: boolean;
  assets: VaultAsset[];
  selectedId: string | number | null | undefined;
  onSelectIndex: (index: number) => void;
  onOpen: (asset: VaultAsset) => void;
  onDecryptPassword: (asset: VaultAsset) => Promise<string | null>;
}

function hasTextSelection(): boolean {
  if (typeof window === 'undefined') return false;
  const text = window.getSelection()?.toString() ?? '';
  return text.trim().length > 0;
}

export function useVaultAssetHotkeys({
  enabled,
  assets,
  selectedId,
  onSelectIndex,
  onOpen,
  onDecryptPassword,
}: UseVaultAssetHotkeysOptions) {
  const copyToClipboard = useCallback(async (value: string, success: string, empty: string) => {
    if (!value) {
      toast.error(empty);
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast.success(success);
    } catch {
      toast.error('Zwischenablage nicht verfügbar.');
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingHotkeyTarget(e.target)) return;
      const selectedIndex = assets.findIndex((a) => String(a.id) === String(selectedId));
      const selected = selectedIndex >= 0 ? assets[selectedIndex] : undefined;
      const meta = e.metaKey || e.ctrlKey;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (assets.length === 0) return;
        const next = selectedIndex < 0 ? 0 : Math.min(assets.length - 1, selectedIndex + 1);
        onSelectIndex(next);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (assets.length === 0) return;
        const next = selectedIndex < 0 ? 0 : Math.max(0, selectedIndex - 1);
        onSelectIndex(next);
        return;
      }
      if (e.key === 'Enter' && selected) {
        e.preventDefault();
        onOpen(selected);
        return;
      }

      if (!meta || !selected) return;
      const key = e.key.toLowerCase();
      if (key === 'c') {
        if (hasTextSelection()) return;
        e.preventDefault();
        if (selected.securitySettings?.disableCopy) {
          toast.error('Kopieren ist für dieses Asset deaktiviert.');
          return;
        }
        void onDecryptPassword(selected).then((plain) => {
          void copyToClipboard(
            plain || '',
            'Passwort in die Zwischenablage kopiert',
            'Passwort konnte nicht entschlüsselt werden.',
          );
        });
        return;
      }
      if (key === 'b') {
        e.preventDefault();
        void copyToClipboard(
          selected.username,
          'Benutzername in die Zwischenablage kopiert',
          'Kein Benutzername hinterlegt.',
        );
        return;
      }
      if (key === 'l') {
        e.preventDefault();
        void copyToClipboard(
          selected.host || '',
          'URL / Host in die Zwischenablage kopiert',
          'Kein Host hinterlegt.',
        );
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, assets, selectedId, onSelectIndex, onOpen, onDecryptPassword, copyToClipboard]);
}

export function vaultHotkeyModLabel(): string {
  return isMacPlatform() ? '⌘' : 'Ctrl';
}
