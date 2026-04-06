import * as TaskManager from 'expo-task-manager'
import * as BackgroundFetch from 'expo-background-fetch'
// Importing task.definition triggers the TaskManager.defineTask side-effect
import { AUTOBACKUP_TASK_NAME } from './task.definition'

export { AUTOBACKUP_TASK_NAME }

/** Register (or re-register) the background task. Safe to call multiple times. */
export async function registerAutoBackupTask() {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(AUTOBACKUP_TASK_NAME)
  if (isRegistered) {
    await BackgroundFetch.unregisterTaskAsync(AUTOBACKUP_TASK_NAME)
  }
  await BackgroundFetch.registerTaskAsync(AUTOBACKUP_TASK_NAME, {
    minimumInterval: 15 * 60, // 15 minutes in seconds
    stopOnTerminate: false,
    startOnBoot: true,
  })
}

export async function unregisterAutoBackupTask() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(AUTOBACKUP_TASK_NAME)
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(AUTOBACKUP_TASK_NAME)
    }
  } catch (error) {
    console.warn('Silent failure unregistering task:', error)
  }
}
