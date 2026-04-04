package com.securesms.app

import android.app.IntentService
import android.content.Intent
import android.telephony.SmsManager
import android.util.Log

/**
 * Headless service that handles the RESPOND_VIA_MESSAGE intent.
 *
 * This is triggered when the user taps "Reply" from an incoming-call
 * notification to send a quick text reply. Android requires this service
 * to be declared for an app to qualify as the default SMS application.
 */
class HeadlessSmsSendService : IntentService("HeadlessSmsSendService") {

    companion object {
        private const val TAG = "HeadlessSmsSend"
    }

    @Deprecated("Deprecated in Java")
    override fun onHandleIntent(intent: Intent?) {
        if (intent == null) return

        // The recipient is encoded in the intent data URI (sms:<number>, smsto:<number>, etc.)
        val recipientUri = intent.dataString
        val message = intent.getStringExtra(Intent.EXTRA_TEXT)

        if (recipientUri.isNullOrBlank() || message.isNullOrBlank()) {
            Log.w(TAG, "Missing recipient or message body")
            return
        }

        // Extract the phone number from the URI
        val recipient = recipientUri
            .replace("sms:", "")
            .replace("smsto:", "")
            .replace("mms:", "")
            .replace("mmsto:", "")
            .trim()

        if (recipient.isBlank()) {
            Log.w(TAG, "Could not extract recipient from URI: $recipientUri")
            return
        }

        try {
            @Suppress("DEPRECATION")
            val smsManager = SmsManager.getDefault()
            val parts = smsManager.divideMessage(message)
            smsManager.sendMultipartTextMessage(recipient, null, parts, null, null)
            Log.d(TAG, "Quick-reply sent to $recipient")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send quick-reply SMS", e)
        }
    }
}
