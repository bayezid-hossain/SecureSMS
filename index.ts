import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { useAppStore } from './src/store/useAppStore';
import { checkRedundancy, createBackup } from './src/services/backup.service';

export const AUTOBACKUP_TASK_NAME = 'securesms-auto-backup';

/**
 * Task body — must be defined at module load time (top level of the entry file),
 * before any BackgroundFetch.registerTaskAsync call.
 * When Android/iOS wakes the app in the background, it re-runs this entry point
 * before executing the task handler.
 */
TaskManager.defineTask(AUTOBACKUP_TASK_NAME, async () => {
  const { autoBackupEnabled, autoBackupIntervalDays, lastAutoBackupAt, setLastAutoBackupAt } =
    useAppStore.getState();

  if (!autoBackupEnabled) return BackgroundFetch.BackgroundFetchResult.NoData;

  const now = Date.now();
  const intervalMs = autoBackupIntervalDays * 24 * 60 * 60 * 1000;
  if (now - (lastAutoBackupAt ?? 0) < intervalMs) return BackgroundFetch.BackgroundFetchResult.NoData;

  try {
    const { needed } = await checkRedundancy();
    if (!needed) {
      await setLastAutoBackupAt(now);
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }
    await createBackup();
    await setLastAutoBackupAt(now);
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('Auto backup task failed:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

import 'expo-router/entry';
