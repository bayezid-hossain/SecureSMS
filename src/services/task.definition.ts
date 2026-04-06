/**
 * Shared task name constant.
 * The actual TaskManager.defineTask call lives in index.ts (app entry point)
 * so it always runs before any registerTaskAsync call, including when the OS
 * wakes the app in the background.
 */
export const AUTOBACKUP_TASK_NAME = 'securesms-auto-backup'
