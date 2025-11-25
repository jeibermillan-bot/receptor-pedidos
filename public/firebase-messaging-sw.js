// -------------------------------------------
// Service Worker para notificaciones Firebase
// -------------------------------------------

// 1. Firebase Compat
// Importamos solo el SDK de APP y MESSAGING.
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// 2. Configuración de Firebase (debe ser la misma que usas en el frontend)
const firebaseConfig = {
    apiKey: "AIzaSyCAsTQl_uOZwupLwOJjBZZJKWkGd5YVhXs",
    authDomain: "mi-menu-app-9c084.firebaseapp.com",
    projectId: "mi-menu-app-9c084",
    storageBucket: "mi-menu-app-9c084.firebasestorage.app",
    messagingSenderId: "947666434839",
    appId: "1:947666434839:web:8f6ba1701ac8128d1f9552",
};

// 3. Inicializar Firebase
// IMPORTANTE: Inicializamos sin el chequeo 'if (typeof firebase !== 'undefined'...)'.
// El Service Worker es un entorno diferente.
firebase.initializeApp(firebaseConfig);

// 4. Firebase Messaging: Obtener la instancia
const messaging = firebase.messaging();

// -------------------------------------------
// 5. Función para mostrar la notificación con sonido
// -------------------------------------------
function showNotificationWithSound(payload) {
    console.log('[SW] Mensaje recibido:', payload);

    const title = payload.notification?.title || payload.data?.title || "🔔 ¡Nuevo Pedido!";
    const body = payload.notification?.body || payload.data?.body || "Se ha recibido una nueva orden de compra.";

    const options = {
        body: body,
        icon: "/logo.png",
        data: payload.data || {},
        // La propiedad 'sound' en Web Push API no es estándar, pero la dejaremos.
        // Lo que realmente controla el sonido en la web es la lógica de la App.
        requireInteraction: true, 
        tag: "pedido-recibido",
        // El channel_id es ignorado por el navegador, es para Android/iOS nativo.
    };

    // Retornamos la promesa de la notificación
    return self.registration.showNotification(title, options);
}

// -------------------------------------------
// 6. Listener OFICIAL de Firebase (cuando el navegador está cerrado)
// -------------------------------------------
messaging.onBackgroundMessage((payload) => {
    // Retornamos la promesa para asegurar que el Service Worker se mantenga activo
    // hasta que se muestre la notificación.
    return showNotificationWithSound(payload);
});


// -------------------------------------------
// 7. Listener de PUSH Nativo (para mayor compatibilidad, aunque Firebase debería bastar)
// -------------------------------------------
self.addEventListener("push", (event) => {
    if (!event.data) return;

    try {
        const payload = event.data.json();
        event.waitUntil(showNotificationWithSound(payload));
    } catch (e) {
        console.error("[SW] Error procesando push:", e);
    }
});

// -------------------------------------------
// 8. 'activate' para depuración
// -------------------------------------------
self.addEventListener("activate", (event) => {
    console.log("[SW] Service Worker activado y listo.");
});