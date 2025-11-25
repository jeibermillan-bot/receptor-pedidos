package com.pedidosuperpollo.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.widget.Toast;

// Importaciones NUEVAS para el sonido del sistema
import android.media.AudioAttributes; 
import android.media.RingtoneManager; 

import com.getcapacitor.BridgeActivity;
import com.google.android.gms.tasks.OnCompleteListener;
import com.google.android.gms.tasks.Task;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.SetOptions;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "CapacitorReceptor"; 
    
    // Debe coincidir EXACTAMENTE con el ID que pusimos en MyFirebaseMessagingService
    private static final String CHANNEL_ID = "pedidos_urgentes_sys_sound"; 
   
    private static final String TEST_TOPIC = "test_alarm";
    private static final String ADMIN_DOC_ID = "superAdmin01"; 

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // 1. Crear el canal de notificaciones (CONFIGURADO PARA SONIDO DE SISTEMA)
        createNotificationChannel();

        // 2. Obtener el Token y Guardarlo Automáticamente
        obtenerYGuardarToken();
    }

    private void obtenerYGuardarToken() {
        FirebaseMessaging.getInstance().getToken()
            .addOnCompleteListener(new OnCompleteListener<String>() {
                @Override
                public void onComplete(Task<String> task) {
                    if (!task.isSuccessful()) {
                        Log.e(TAG, "❌ ERROR: No se pudo obtener el token FCM", task.getException());
                        return;
                    }

                    String token = task.getResult();
                    Log.d(TAG, "✅ Token obtenido: " + token);

                    subscribeToTopic();
                    saveTokenToFirestore(token);
                }
            });
    }

    private void saveTokenToFirestore(String token) {
        FirebaseFirestore db = FirebaseFirestore.getInstance();
        
        Map<String, Object> data = new HashMap<>();
        data.put("fcmToken", token);
        data.put("updatedAt", System.currentTimeMillis()); 
        data.put("device", Build.MODEL); 

        db.collection("administradores").document(ADMIN_DOC_ID)
            .set(data, SetOptions.merge()) 
            .addOnSuccessListener(aVoid -> {
                Log.d(TAG, "🔥 FIRESTORE: Token actualizado correctamente para " + ADMIN_DOC_ID);
            })
            .addOnFailureListener(e -> {
                Log.e(TAG, "❌ FIRESTORE ERROR: No se pudo guardar el token.", e);
            });
    }

    private void subscribeToTopic() {
        FirebaseMessaging.getInstance().subscribeToTopic(TEST_TOPIC);
    }

    // --- AQUÍ ESTÁ LA CORRECCIÓN IMPORTANTE ---
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                // CAMBIO: Usar RingtoneManager para obtener el sonido predeterminado del sistema
                Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                
                NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Pedidos Urgentes", // Nombre visible en ajustes
                    NotificationManager.IMPORTANCE_HIGH
                );
                
                channel.setDescription("Notificaciones de pedidos nuevos con sonido del sistema.");
                channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC); 
                channel.enableLights(true);
                channel.enableVibration(true);

                // CAMBIO: Configurar atributos de audio (Obligatorio para que funcione bien el sonido del sistema)
                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                        .build();

                // Asignar sonido y atributos al canal
                channel.setSound(soundUri, audioAttributes);

                NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                if (notificationManager != null) {
                    notificationManager.createNotificationChannel(channel);
                    Log.d(TAG, "🔊 Canal de notificación creado usando SONIDO DEL SISTEMA.");
                }
            } catch (Exception e) {
                Log.e(TAG, "Error creando canal de notificación", e);
            }
        }
    }
}