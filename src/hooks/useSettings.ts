import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { UserSettings } from '@/db/types';

export function useSettings() {
  const settings = useLiveQuery(() => db.settings.get('singleton'));

  async function updateSettings(updates: Partial<UserSettings>) {
    await db.settings.update('singleton', updates);
  }

  return { settings, updateSettings };
}
