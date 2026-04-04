package com.securesms.modules

import android.app.role.RoleManager
import android.content.ActivityNotFoundException
import android.content.ContentValues
import android.content.Intent
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.provider.Telephony
import com.facebook.react.bridge.*
import org.json.JSONArray
import org.json.JSONObject

class SmsModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "SmsModule"

    private val activityListener = object : BaseActivityEventListener() {
        override fun onActivityResult(activity: android.app.Activity, requestCode: Int, resultCode: Int, data: Intent?) {
            if (requestCode == REQUEST_DEFAULT_SMS) {
                val promise = defaultSmsPromise ?: return
                defaultSmsPromise = null
                // Check if we are now the default
                promise.resolve(isDefault())
            }
        }
    }

    init {
        reactContext.addActivityEventListener(activityListener)
    }

    // ─── SMS Read ─────────────────────────────────────────────────────────────

    @ReactMethod
    fun readSmsPage(offset: Int, limit: Int, promise: Promise) {
        try {
            val cursor: Cursor? = reactContext.contentResolver.query(
                Uri.parse("content://sms"),
                arrayOf("_id", "address", "body", "date", "type", "thread_id", "read", "date_sent", "service_center"),
                null, null,
                "date DESC LIMIT $limit OFFSET $offset"
            )
            val results = JSONArray()
            cursor?.use {
                while (it.moveToNext()) {
                    val obj = JSONObject()
                    obj.put("id", it.getString(it.getColumnIndexOrThrow("_id")))
                    obj.put("address", it.getString(it.getColumnIndexOrThrow("address")) ?: "")
                    obj.put("body", it.getString(it.getColumnIndexOrThrow("body")) ?: "")
                    obj.put("date", it.getLong(it.getColumnIndexOrThrow("date")))
                    obj.put("type", it.getInt(it.getColumnIndexOrThrow("type")))
                    obj.put("threadId", it.getString(it.getColumnIndexOrThrow("thread_id")))
                    obj.put("read", it.getInt(it.getColumnIndexOrThrow("read")))
                    obj.put("dateSent", it.getLong(it.getColumnIndexOrThrow("date_sent")))
                    val scIdx = it.getColumnIndex("service_center")
                    if (scIdx >= 0) obj.put("serviceCenter", it.getString(scIdx) ?: "")
                    results.put(obj)
                }
            }
            promise.resolve(results.toString())
        } catch (e: Exception) {
            promise.reject("READ_SMS_ERROR", e.message, e)
        }
    }

    // ─── SMS Write ────────────────────────────────────────────────────────────

    @ReactMethod
    fun insertSms(jsonMessage: String, promise: Promise) {
        try {
            if (!isDefault()) {
                promise.reject("NOT_DEFAULT", "App is not the default SMS handler")
                return
            }
            val msg = JSONObject(jsonMessage)
            val values = ContentValues().apply {
                put("address", msg.getString("address"))
                put("body", msg.getString("body"))
                put("date", msg.getLong("date"))
                put("type", msg.getInt("type"))
                put("thread_id", msg.optString("threadId", ""))
                put("read", msg.getInt("read"))
                if (msg.has("dateSent")) put("date_sent", msg.getLong("dateSent"))
            }
            val uri = reactContext.contentResolver.insert(Uri.parse("content://sms"), values)
            if (uri != null) promise.resolve(uri.toString())
            else promise.reject("INSERT_FAILED", "Insert returned null URI")
        } catch (e: Exception) {
            promise.reject("INSERT_SMS_ERROR", e.message, e)
        }
    }

    // ─── Default SMS App ──────────────────────────────────────────────────────

    companion object {
        private const val REQUEST_DEFAULT_SMS = 42001
    }

    private var defaultSmsPromise: Promise? = null

    @ReactMethod
    fun isDefaultSmsApp(promise: Promise) {
        promise.resolve(isDefault())
    }

    /**
     * Show the system "Change default SMS app" dialog.
     *
     * On Android 10+ uses RoleManager.createRequestRoleIntent(ROLE_SMS),
     * which launches a proper system dialog via startActivityForResult.
     * On older versions falls back to ACTION_CHANGE_DEFAULT.
     */
    @ReactMethod
    fun requestDefaultSmsApp(promise: Promise) {
        val activity = reactContext.currentActivity ?: run {
            promise.reject("NO_ACTIVITY", "No current activity")
            return
        }
        defaultSmsPromise = promise
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val roleManager = reactContext.getSystemService(RoleManager::class.java)
                if (roleManager.isRoleAvailable(RoleManager.ROLE_SMS)) {
                    val intent = roleManager.createRequestRoleIntent(RoleManager.ROLE_SMS)
                    activity.startActivityForResult(intent, REQUEST_DEFAULT_SMS)
                    return
                }
            }
            // Fallback for pre-Q or if ROLE_SMS not available
            @Suppress("DEPRECATION")
            val intent = Intent(Telephony.Sms.Intents.ACTION_CHANGE_DEFAULT).apply {
                putExtra(Telephony.Sms.Intents.EXTRA_PACKAGE_NAME, reactContext.packageName)
            }
            activity.startActivityForResult(intent, REQUEST_DEFAULT_SMS)
        } catch (e: ActivityNotFoundException) {
            defaultSmsPromise = null
            openSettingsFallback(activity, promise)
        } catch (e: Exception) {
            defaultSmsPromise = null
            promise.reject("REQUEST_DEFAULT_ERROR", e.message, e)
        }
    }

    /**
     * Navigate to Android settings so the user can set the default SMS app.
     *
     * Tries three intents in order, falling back to the next if unavailable:
     * 1. ACTION_MANAGE_DEFAULT_APPS_SETTINGS  (direct "Default apps" page)
     * 2. ACTION_APPLICATION_DETAILS_SETTINGS  (this app's detail page)
     * 3. ACTION_SETTINGS                       (general settings root)
     */
    @ReactMethod
    fun openDefaultSmsSettings(promise: Promise) {
        val activity = reactContext.currentActivity ?: run {
            promise.reject("NO_ACTIVITY", "No current activity")
            return
        }
        openSettingsFallback(activity, promise)
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private fun openSettingsFallback(activity: android.app.Activity, promise: Promise) {
        val intents = listOf(
            Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS),
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.parse("package:${reactContext.packageName}")
            },
            Intent(Settings.ACTION_SETTINGS)
        )
        for (intent in intents) {
            try {
                if (intent.resolveActivity(activity.packageManager) != null) {
                    activity.startActivity(intent)
                    promise.resolve(null)
                    return
                }
            } catch (_: Exception) { /* try next */ }
        }
        promise.reject("NO_SETTINGS", "Could not open any settings screen")
    }

    private fun isDefault(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val roleManager = reactContext.getSystemService(RoleManager::class.java)
            roleManager.isRoleHeld(RoleManager.ROLE_SMS)
        } else {
            Telephony.Sms.getDefaultSmsPackage(reactContext) == reactContext.packageName
        }
    }
}
