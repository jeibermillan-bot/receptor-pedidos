// En functions/index.js

const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');

// Inicialización de Admin
initializeApp(); 

exports.notificarNuevoPedido = onDocumentCreated('orders/{orderId}', async (event) => {

    // 1. Validación de seguridad: Si no hay datos, no hacemos nada
    if (!event.data) {
        return null;
    }

    // 2. Obtener datos del pedido
    const nuevoPedido = event.data.data();
    // Asegúrate de que los campos coincidan con tu BD (customerName, total, etc.)
    const { customerName, total, items } = nuevoPedido;

    // ID del administrador (Si esto varía por restaurante, debería venir dentro del pedido)
    const ADMIN_UID_PARA_TOKEN = 'superAdmin01';

    // 3. Obtener el token FCM actual de la base de datos
    const db = getFirestore();
    const adminDoc = await db.collection('administradores').doc(ADMIN_UID_PARA_TOKEN).get();
    const fcmToken = adminDoc.data()?.fcmToken;

    if (!fcmToken) {
        console.log('❌ Token FCM no encontrado. No se puede enviar la alerta.');
        return null;
    }

    console.log(`📨 Preparando envío al token: ${fcmToken.substring(0, 10)}...`);

    // Formatear datos para el mensaje (Ajusta la división /100 según cómo guardes el dinero)
    const totalFormateado = (total / 100).toFixed(2);
    const notificationTitle = `🚨 ¡NUEVO PEDIDO DE ${customerName || 'CLIENTE'}!`;
    const notificationBody = `Total: $${totalFormateado} - Items: ${items ? items.length : 0}`;

    // 4. Construcción del Mensaje BLINDADO
    const message = {
        // A. Datos para tu App (lógica interna cuando el usuario toca la notificación)
        data: {
            orderId: event.params.orderId,
            type: 'new_order',
            title: notificationTitle,
            body: notificationBody, 
            priority: "high",
            sound: "alerta_pedido", 
            channel_id: "pedidos_urgentes" // CORREGIDO: Mismo ID que abajo
        },
        
        // B. Configuración NATIVA (Android System Tray) - Esto suena con App cerrada
        android: {
            priority: "high", // CRÍTICO: Despierta al teléfono del modo ahorro
            notification: {
                title: notificationTitle,
                body: notificationBody,
                channelId: "pedidos_urgentes", // CORREGIDO: Coincide con 'data'
                
                // IMPORTANTE: El archivo 'alerta_pedido.mp3' debe estar en /res/raw/ en Android
                sound: "alerta_pedido", 
                
                clickAction: "FCM_PLUGIN_ACTIVITY", // Acción estándar para abrir la app
                visibility: "PUBLIC",   // Se ve en pantalla de bloqueo
                icon: "ic_stat_icon_name" // Asegúrate de tener un ícono configurado, o borra esta línea
            }
        },
        
        // C. Token de destino
        token: fcmToken
    };

    try {
        await getMessaging().send(message);
        console.log('✅ Notificación enviada con éxito (Prioridad ALTA).');
    } catch (error) {
        console.error('❌ Error enviando la notificación:', error);
        // Importante: Si el token es inválido (usuario desinstaló), aquí podrías borrarlo de la BD
    }

    return null;
});