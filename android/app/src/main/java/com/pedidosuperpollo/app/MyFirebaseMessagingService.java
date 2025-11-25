package com.pedidosuperpollo.app;

import android.app.NotificationChannel; // Nuevo
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes; // Nuevo
import android.media.RingtoneManager; // Nuevo
import android.net.Uri;
import android.os.Build; // Nuevo
import android.util.Log;
import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import com.google.firebase.firestore.FirebaseFirestore;
import java.util.HashMap;
import java.util.Map;

public class MyFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "CapacitorReceptor";
    
    // He cambiado el ID para forzar al sistema a reconocer la nueva configuración de sonido.
    // Si dejas el ID anterior, el celular recordará el sonido viejo.
    private static final String CHANNEL_ID = "pedidos_urgentes_sys_sound"; 
    
    private static int NOTIFICATION_ID = 1;
    private static final String ADMIN_UID = "superAdmin01";

    @Override
    public void onCreate() {
        super.onCreate();
        // ⚠️ No pedir token aquí.
        // NO se garantiza que onCreate() del servicio FCM se ejecute siempre.
    }

    @Override
    public void onNewToken(String token) {
        Log.d(TAG, "Nuevo Token generado: " + token);
        updateFirestoreToken(token, ADMIN_UID);
    }

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {

        Map<String, String> data = remoteMessage.getData();

        if (data == null || data.isEmpty()) {
            Log.w(TAG, "Mensaje vacío");
            return;
        }

        Log.d(TAG, "Pedido recibido. ID: " + data.get("orderId"));

        sendNotification(
                data.get("title"),
                data.get("body"),
                data.get("orderId")
        );
    }

    private void sendNotification(String title, String body, String orderId) {

        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("orderId", orderId);

        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                NOTIFICATION_ID,
                intent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_ONE_SHOT
        );

        // CAMBIO 1: Usar el sonido predeterminado del sistema (Notificación)
        Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

        NotificationManager nm =
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        // CAMBIO 2: Configurar el canal para Android 8.0+ (Oreo y superiores)
        // Sin esto, el sonido personalizado NO funciona en teléfonos modernos.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Pedidos Urgentes", // Nombre visible en ajustes
                    NotificationManager.IMPORTANCE_HIGH
            );

            // Configurar atributos de audio para asegurar que suene
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .build();

            channel.setSound(soundUri, audioAttributes);
            channel.enableVibration(true); // Opcional, pero recomendado

            if (nm != null) {
                nm.createNotificationChannel(channel);
            }
        }

        NotificationCompat.Builder builder =
                new NotificationCompat.Builder(this, CHANNEL_ID)
                        .setSmallIcon(R.drawable.ic_stat_notification)
                        .setContentTitle(title)
                        .setContentText(body)
                        .setSound(soundUri) // Para versiones antiguas de Android (< 8.0)
                        .setAutoCancel(true)
                        .setPriority(NotificationCompat.PRIORITY_MAX)
                        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                        .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                        .setCategory(NotificationCompat.CATEGORY_CALL)
                        .setContentIntent(pendingIntent);

        if (nm != null) {
            nm.notify(NOTIFICATION_ID++, builder.build());
        }
    }

    private void updateFirestoreToken(String token, String adminUid) {
        FirebaseFirestore db = FirebaseFirestore.getInstance();

        Map<String, Object> data = new HashMap<>();
        data.put("fcmToken", token);
        data.put("fechaActualizacion", System.currentTimeMillis());

        db.collection("administradores")
                .document(adminUid)
                .set(data, com.google.firebase.firestore.SetOptions.merge())
                .addOnSuccessListener(v -> Log.d(TAG, "Token guardado correctamente en Firestore."))
                .addOnFailureListener(e -> Log.e(TAG, "Error guardando token en Firestore", e));
    }
}