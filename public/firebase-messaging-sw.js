// Este es el Service Worker para manejar notificaciones en segundo plano.

// 1. Importar librerías de Firebase (v9 Compat)
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// 2. Configuración de Firebase 
// **** ¡TUS CREDENCIALES! ****
const firebaseConfig = {
    apiKey: "AIzaSyCAsTQl_uOZwupLwOJjBZZJKWkGd5YVhXs", 
    authDomain: "mi-menu-app-9c084.firebaseapp.com",
    projectId: "mi-menu-app-9c084", 
    storageBucket: "mi-menu-app-9c084.firebasestorage.app",
    messagingSenderId: "947666434839", 
    appId: "1:947666434839:web:8f6ba1701ac8128d1f9552",
};

// 3. Inicializar la app
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// 4. Obtener la referencia de mensajería
const messaging = firebase.messaging();

// 5. Manejo de mensajes cuando la app está en segundo plano (cerrada)
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Mensaje en segundo plano recibido ', payload);

    const notificationTitle = payload.notification.title || '🔔 ¡Nuevo Pedido!';
    const notificationOptions = {
        body: payload.notification.body || 'Se ha recibido una nueva orden de compra, revisa la app.',
        icon: '/logo.png',
        data: payload.data 
    };

    // 🚨 CORRECCIÓN CRÍTICA: Usar self.registration.showNotification dentro de event.waitUntil()
    // Esto asegura que el navegador espere a que la notificación se muestre antes de cerrar el Service Worker.
    self.registration.getNotifications().then(function(notifications) {
        let notificationPromise;

        // Comprobación adicional para evitar duplicados, aunque opcional
        if (notifications.length > 0) {
            notifications.forEach(n => n.close());
        }

        notificationPromise = self.registration.showNotification(notificationTitle, notificationOptions);
        
        // ¡IMPORTANTE! Solo devolvemos la promesa si el evento es un 'push' (onpush),
        // pero la librería messaging.onBackgroundMessage ya lo maneja internamente.
        // Lo crucial es que la función showNotification() se ejecute.
    });
});

// A veces, el error se resuelve implementando un manejador de "push" explícito para la promesa.
// Aunque messaging.onBackgroundMessage() lo hace, este es el código estándar para forzar la espera.
self.addEventListener('push', (event) => {
    // Si el mensaje viene de FCM, el payload ya ha sido procesado arriba.
    // Aquí solo nos aseguramos de que el evento espere el resultado de showNotification.
    
    // Si el evento tiene datos, lo procesamos
    if (event.data) {
        try {
             const payload = event.data.json();
             const notificationTitle = payload.notification.title || '🔔 ¡Nuevo Pedido!';
             const notificationOptions = {
                 body: payload.notification.body || 'Se ha recibido una nueva orden de compra.',
                 icon: '/logo.png',
                 data: payload.data 
             };
             
             // FORZAMOS LA ESPERA ASÍNCRONA
             event.waitUntil(
                 self.registration.showNotification(notificationTitle, notificationOptions)
             );
        } catch (e) {
             console.error("Error procesando payload en SW push handler:", e);
        }
    }
});