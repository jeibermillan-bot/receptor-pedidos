// En functions/index.js

const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');

// Inicialización de Admin
initializeApp(); 

// 🚨 ESTA ES LA SINTAXIS DE GENERACIÓN 2 🚨
exports.notificarNuevoPedido = onDocumentCreated('orders/{orderId}', async (event) => {
    
    // Si no hay datos, salimos
    if (!event.data) {
        return null;
    }

    const nuevoPedido = event.data.data();
    const { customerName, total, items } = nuevoPedido;

    const ADMIN_UID_PARA_TOKEN = 'superAdmin01'; 

    // 1. Obtener el Token FCM del administrador
    const db = getFirestore();
    const adminDoc = await db.collection('administradores').doc(ADMIN_UID_PARA_TOKEN).get();
    const fcmToken = adminDoc.data()?.fcmToken;

    if (!fcmToken) {
        console.log('Token FCM no encontrado. Notificación no enviada.');
        return null;
    }

    const totalFormateado = (total / 100).toFixed(2);
    
    // 2. Definir el Payload
    const payload = {
        notification: {
            title: `🚨 ¡NUEVO PEDIDO DE ${customerName}!`,
            body: `Total: $${totalFormateado} - Items: ${items.length}`,
            
        },
        data: {
            orderId: event.params.orderId,
            type: 'new_order'
        }
    };

    // 3. Enviar la notificación
   try {
    const message = {
        notification: {
            title: `🚨 ¡NUEVO PEDIDO DE ${customerName}!`,
            body: `Total: $${totalFormateado} - Items: ${items.length}`,
            // ❌ ¡ESTA LÍNEA DEBE SER ELIMINADA!
        },
        data: {
            orderId: event.params.orderId,
            type: 'new_order'
        },
        token: fcmToken
    };
    
    await getMessaging().send(message); 
    console.log('Notificación de pedido enviada exitosamente.'); 
    
} catch (error) {
    console.error('Error al enviar la notificación:', error);
}

    return null;
});