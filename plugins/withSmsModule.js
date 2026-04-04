const { withMainApplication, withAndroidManifest, withDangerousMod } = require('@expo/config-plugins')
const fs = require('fs')
const path = require('path')

/**
 * Expo Config Plugin — auto-applies all SmsModule changes on every prebuild:
 *  1. Copies android-src-staging/**  →  android/app/src/main/java/com/securesms/
 *  2. Adds SmsPackage import + registration in MainApplication.kt
 *  3. Adds SmsReceiver + HeadlessSmsSendService to AndroidManifest.xml
 *  4. Adds SENDTO intent filter on MainActivity
 *  5. Adds all required SMS permissions
 *
 * `expo prebuild --clean` is fully safe — everything is restored automatically.
 */
const withSmsModule = (config) => {
  config = withStagingFiles(config)
  config = withSmsMainApplication(config)
  config = withSmsManifest(config)
  return config
}

// ── Copy android-src-staging → android/app/src/main/java/com/securesms/ ──────

const withStagingFiles = (config) => {
  return withDangerousMod(config, [
    'android',
    (mod) => {
      const stagingDir = path.join(__dirname, '..', 'android-src-staging')
      const destBase = path.join(
        mod.modRequest.platformProjectRoot,
        'app', 'src', 'main', 'java', 'com', 'securesms'
      )

      function copyDir(src, dest) {
        fs.mkdirSync(dest, { recursive: true })
        for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
          const srcPath = path.join(src, entry.name)
          const destPath = path.join(dest, entry.name)
          if (entry.isDirectory()) {
            copyDir(srcPath, destPath)
          } else {
            fs.copyFileSync(srcPath, destPath)
            console.log(`[withSmsModule] Copied ${entry.name} → ${destPath}`)
          }
        }
      }

      if (fs.existsSync(stagingDir)) {
        copyDir(stagingDir, destBase)
      } else {
        console.warn(`[withSmsModule] android-src-staging not found at ${stagingDir}`)
      }

      return mod
    },
  ])
}

// ── MainApplication.kt patch ────────────────────────────────────────────────

const withSmsMainApplication = (config) => {
  return withMainApplication(config, (mod) => {
    let contents = mod.modResults.contents

    // 1. Import
    const importLine = 'import com.securesms.modules.SmsPackage'
    if (!contents.includes(importLine)) {
      contents = contents.replace(
        'import com.facebook.react.PackageList',
        `import com.facebook.react.PackageList\n${importLine}`
      )
    }

    // 2. Register in getPackages()
    const addLine = 'add(SmsPackage())'
    if (!contents.includes(addLine)) {
      contents = contents.replace(
        'PackageList(this).packages.apply {',
        `PackageList(this).packages.apply {\n              ${addLine}`
      )
    }

    mod.modResults.contents = contents
    return mod
  })
}

// ── AndroidManifest.xml patch ────────────────────────────────────────────────

const withSmsManifest = (config) => {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest
    const app = manifest.application[0]

    // ── Ensure all required SMS permissions are present ──
    if (!manifest['uses-permission']) manifest['uses-permission'] = []
    const requiredPerms = [
      'android.permission.READ_SMS',
      'android.permission.SEND_SMS',
      'android.permission.RECEIVE_SMS',
      'android.permission.RECEIVE_MMS',
      'android.permission.RECEIVE_WAP_PUSH',
      'android.permission.WRITE_SMS',
      'android.permission.RECEIVE_BOOT_COMPLETED',
    ]
    for (const perm of requiredPerms) {
      const exists = manifest['uses-permission'].some(
        (p) => p.$?.['android:name'] === perm
      )
      if (!exists) {
        manifest['uses-permission'].push({ $: { 'android:name': perm } })
        console.log(`[withSmsModule] Added permission: ${perm}`)
      }
    }

    // Ensure receiver and service arrays exist
    if (!app.receiver) app.receiver = []
    if (!app.service) app.service = []

    // ── SmsReceiver — required for default SMS app ──
    const receiverName = '.SmsReceiver'
    if (!app.receiver.some((r) => r.$?.['android:name'] === receiverName)) {
      app.receiver.push({
        $: {
          'android:name': receiverName,
          'android:exported': 'true',
          'android:permission': 'android.permission.BROADCAST_SMS',
        },
        'intent-filter': [
          {
            $: { 'android:priority': '1000' },
            action: [{ $: { 'android:name': 'android.provider.Telephony.SMS_DELIVER' } }],
          },
        ],
      })
    }

    // ── MmsReceiver — required for default SMS app ──
    const mmsReceiverName = '.MmsReceiver'
    if (!app.receiver.some((r) => r.$?.['android:name'] === mmsReceiverName)) {
      app.receiver.push({
        $: {
          'android:name': mmsReceiverName,
          'android:exported': 'true',
          'android:permission': 'android.permission.BROADCAST_WAP_PUSH',
        },
        'intent-filter': [
          {
            $: { 'android:priority': '1000' },
            action: [{ $: { 'android:name': 'android.provider.Telephony.WAP_PUSH_DELIVER' } }],
            data: [{ $: { 'android:mimeType': 'application/vnd.wap.mms-message' } }],
          },
        ],
      })
    }

    // ── HeadlessSmsSendService — required for default SMS app ──
    const serviceName = '.HeadlessSmsSendService'
    if (!app.service.some((s) => s.$?.['android:name'] === serviceName)) {
      app.service.push({
        $: {
          'android:name': serviceName,
          'android:exported': 'true',
          'android:permission': 'android.permission.SEND_RESPOND_VIA_MESSAGE',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'android.intent.action.RESPOND_VIA_MESSAGE' } }],
            category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
            data: [
              { $: { 'android:scheme': 'sms' } },
              { $: { 'android:scheme': 'smsto' } },
              { $: { 'android:scheme': 'mms' } },
              { $: { 'android:scheme': 'mmsto' } },
            ],
          },
        ],
      })
    }

    // ── SENDTO intent filter on MainActivity ──
    const mainActivity = app.activity?.find(
      (a) => a.$?.['android:name'] === '.MainActivity'
    )
    if (mainActivity) {
      if (!mainActivity['intent-filter']) mainActivity['intent-filter'] = []
      const alreadyHasSendTo = mainActivity['intent-filter'].some((f) =>
        f.action?.some((a) => a.$?.['android:name'] === 'android.intent.action.SENDTO')
      )
      if (!alreadyHasSendTo) {
        mainActivity['intent-filter'].push({
          action: [
            { $: { 'android:name': 'android.intent.action.SEND' } },
            { $: { 'android:name': 'android.intent.action.SENDTO' } },
          ],
          category: [
            { $: { 'android:name': 'android.intent.category.DEFAULT' } },
            { $: { 'android:name': 'android.intent.category.BROWSABLE' } },
          ],
          data: [
            { $: { 'android:scheme': 'sms' } },
            { $: { 'android:scheme': 'smsto' } },
            { $: { 'android:scheme': 'mms' } },
            { $: { 'android:scheme': 'mmsto' } },
          ],
        })
      }
    }

    return mod
  })
}

module.exports = withSmsModule
