package com.securesms.app

import android.content.BroadcastReceiver
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Telephony
import android.util.Log

/**
 * BroadcastReceiver for SMS_DELIVER and WAP_PUSH_DELIVER intents.
 *
 * This component is required by Android for an app to be eligible as
 * the default SMS application. When set as default, the system delivers
 * incoming SMS/MMS messages here instead of to the stock app.
 */
class SmsReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "SmsReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Telephony.Sms.Intents.SMS_DELIVER_ACTION -> handleSmsDeliver(context, intent)
            else -> Log.w(TAG, "Unexpected action: ${intent.action}")
        }
    }

    /**
     * Handle incoming SMS. Write it to the system SMS content provider
     * so the message appears in the device's SMS database.
     */
    private fun handleSmsDeliver(context: Context, intent: Intent) {
        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        if (messages.isNullOrEmpty()) return

        for (sms in messages) {
            try {
                val values = ContentValues().apply {
                    put(Telephony.Sms.ADDRESS, sms.displayOriginatingAddress)
                    put(Telephony.Sms.BODY, sms.displayMessageBody)
                    put(Telephony.Sms.DATE, System.currentTimeMillis())
                    put(Telephony.Sms.DATE_SENT, sms.timestampMillis)
                    put(Telephony.Sms.TYPE, Telephony.Sms.MESSAGE_TYPE_INBOX)
                    put(Telephony.Sms.READ, 0)
                    put(Telephony.Sms.SEEN, 0)
                    sms.serviceCenterAddress?.let {
                        put(Telephony.Sms.SERVICE_CENTER, it)
                    }
                }
                context.contentResolver.insert(
                    Telephony.Sms.CONTENT_URI,
                    values
                )
                Log.d(TAG, "SMS saved from: ${sms.displayOriginatingAddress}")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to save incoming SMS", e)
            }
        }
    }

}
