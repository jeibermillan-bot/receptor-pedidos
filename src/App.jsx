import React, { useState, useEffect, useCallback, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    signOut
} from 'firebase/auth';
import { 
    getFirestore, 
    collection, 
    query, 
    onSnapshot, 
    doc, 
    setDoc,        // Función para guardar el estado 'isReviewed'
    serverTimestamp, 
    orderBy 
} from 'firebase/firestore'; 
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// =======================================================================
// CONFIGURACIÓN DE FIREBASE (PROYECTO: MI MENU APP)
// =======================================================================
const firebaseConfig = {
    apiKey: "AIzaSyCAsTQl_uOZwupLwOJjBZZJKWkGd5YVhXs",
    authDomain: "mi-menu-app-9c084.firebaseapp.com",
    projectId: "mi-menu-app-9c084",
    storageBucket: "mi-menu-app-9c084.firebasestorage.app",
    messagingSenderId: "947666434839",
    appId: "1:947666434839:web:8f6ba1701ac8128d1f9552",
    measurementId: "G-B7HV822FGJ"
};
// =======================================================================

// ___________________________________________________________________
// Componente de Login (Email/Contraseña) - PANTALLA DE BLOQUEO
// ___________________________________________________________________
const LoginScreen = ({ firebaseAuth }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);

    const handleSignIn = async (e) => {
        e.preventDefault();
        setError(null);

        if (!email || !password) {
            setError('Por favor, ingresa el correo y la clave.');
            return;
        }

        try {
            await signInWithEmailAndPassword(firebaseAuth, email, password);
        } catch (err) {
            console.error("Error de inicio de sesión:", err.code);
            let errorMessage = "Error de autenticación. Verifica tu correo y clave.";
            if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-email') {
                errorMessage = "Usuario no encontrado o correo inválido.";
            } else if (err.code === 'auth/wrong-password') {
                errorMessage = "Clave de ingreso incorrecta.";
            }
            setError(errorMessage);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
            <div className="w-full max-w-sm p-8 space-y-6 bg-white rounded-xl shadow-2xl">
                <h2 className="text-2xl font-bold text-center text-indigo-600">🔐 Acceso de Administrador</h2>
                <p className="text-sm text-center text-gray-500">
                    Ingresa el correo y la clave que registraste en Firebase.
                </p>
                
                <form className="space-y-4" onSubmit={handleSignIn}>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Correo Electrónico</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="mt-1 w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Clave de Ingreso</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="mt-1 w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            required
                        />
                    </div>
                    {error && (
                        <p className="text-sm text-red-600 font-medium p-2 bg-red-50 border border-red-300 rounded-md">
                            {error}
                        </p>
                    )}
                    <button
                        type="submit"
                        className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150"
                    >
                        Ingresar de Forma Segura
                    </button>
                </form>
            </div>
        </div>
    );
};
// ___________________________________________________________________

const App = () => {
    const [firebaseAuth, setFirebaseAuth] = useState(null); 
    const [isAuthenticated, setIsAuthenticated] = useState(false); 
    const [db, setDb] = useState(null);
    const [userId, setUserId] = useState(null);
    const [pendingOrders, setPendingOrders] = useState([]); 
    const [reviewedOrders, setReviewedOrders] = useState([]); 
    const [newOrderCount, setNewOrderCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isReady, setIsReady] = useState(false);
    const [fcmToken, setFcmToken] = useState(null);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [showReviewed, setShowReviewed] = useState(false); 
    const lastOrderTimestampRef = useRef(0);
    
    // 🆕 REFERENCIA PARA EL ELEMENTO DE AUDIO
    const audioRef = useRef(null); 

    // --- Función: Solicitud de Notificaciones (sin cambios) ---
    const requestNotificationPermission = useCallback(async (messaging) => {
        try {
            const permission = await Notification.requestPermission();
            
            if (permission === 'granted') {
                const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
                const currentToken = await getToken(messaging, { 
                    serviceWorkerRegistration: swRegistration,
                    vapidKey: undefined 
                });

                if (currentToken) {
                    console.log('✅ FCM Token obtenido:', currentToken);
                    setFcmToken(currentToken);
                } else {
                    console.log('⚠️ No se pudo obtener el token.');
                }
            } else {
                console.warn('🚫 Permiso de notificación denegado por el usuario.');
            }
            
            onMessage(messaging, (payload) => {
                console.log('🔔 Mensaje en PRIMER PLANO recibido:', payload.notification.title);
                console.log(`🚨 Pedido recibido en vivo: ${payload.notification.body}`);
                setNewOrderCount(prev => prev + 1); 
            });

        } catch (error) {
            console.error('Error al configurar notificaciones:', error);
        }
    }, []);

    // --- Efecto 1: Inicialización de Firebase y Autenticación ---
    useEffect(() => {
        try {
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            setFirebaseAuth(auth);

            const firestoreDb = getFirestore(app);
            setDb(firestoreDb);
            setIsReady(true);
            
            let firebaseMessaging = null;
            if ('serviceWorker' in navigator) {
                try {
                    firebaseMessaging = getMessaging(app);
                } catch (e) {
                    console.error("FCM no soportado en este entorno:", e);
                }
            }

            const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
                if (user) {
                    setUserId(user.uid);
                    setIsAuthenticated(true); 
                    console.log("✅ Conectado a Firebase. UID:", user.uid);
                    
                    if (firebaseMessaging) {
                        requestNotificationPermission(firebaseMessaging);
                    }
                } else {
                    setIsAuthenticated(false);
                    setUserId(null);
                    console.log("❌ Usuario desconectado.");
                }
                setLoading(false);
            });
            
            return () => unsubscribeAuth();
        } catch (e) {
            console.error("❌ Error crítico inicializando Firebase:", e);
            setLoading(false);
        }
    }, [requestNotificationPermission]);

    // 🆕 EFECTO PARA REPRODUCIR AUDIO EN SEGUNDO PLANO
    useEffect(() => {
        if (isAuthenticated && audioRef.current) {
            audioRef.current.volume = 0.3; // Volumen bajo (0.0 a 1.0)
            audioRef.current.play().catch(error => {
                // Manejar error de auto-play (típico en navegadores sin interacción previa)
                console.log("Advertencia: Reproducción automática fallida.", error);
                // Si falla la reproducción automática, el usuario deberá interactuar con la página.
                // Podrías mostrar un botón de "Play Music"
            });
        }
        
        // Opcional: Pausar si el usuario se desautentica
        if (!isAuthenticated && audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0; // Reiniciar
        }
        
    }, [isAuthenticated]);
    // FIN: EFECTO DE AUDIO 🆕

    // --- Efecto 2: Escuchar Pedidos en Firestore ---
    useEffect(() => {
        if (!db || !isReady || !isAuthenticated) return; 

        const FIRESTORE_COLLECTION = 'orders';
        
        const ordersQuery = query(
            collection(db, FIRESTORE_COLLECTION),
            orderBy('timestamp', 'desc') 
        );
        
        console.log("📡 Escuchando en:", FIRESTORE_COLLECTION);
        
        let isInitialLoad = true;

        const unsubscribe = onSnapshot(ordersQuery, (snapshot) => {
            let allOrdersData = [];
            let newPendingOrders = [];
            let newReviewedOrders = [];
            let newOrdersSinceLastLoad = 0;
            let currentMaxTimestamp = 0; 

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const timestampMillis = data.timestamp?.toDate ? data.timestamp.toDate().getTime() : (data.timestamp || Date.now()); 
                
                const order = {
                    id: doc.id,
                    cliente: data.customerName || 'Cliente Anónimo',
                    total: parseFloat(data.total) || 0, 
                    items: data.items || [], 
                    timestamp: timestampMillis,
                    direccion: data.customerAddress || 'No especificada',
                    telefono:data.customerPhone || data.WS || 'No disponible',
                    metodoPago: data.paymentMethod || 'No especificado',
                    notasPedido: data.orderNotes || 'Sin notas adicionales',
                    isReviewed: data.isReviewed || false, 
                };
                
                allOrdersData.push(order);
                
                // Lógica de clasificación usando el campo PERMANENTE: isReviewed
                if (order.isReviewed) {
                    newReviewedOrders.push(order);
                } else {
                    newPendingOrders.push(order);
                }
                
                // Lógica de Notificación de Nuevos Pedidos
                if (!isInitialLoad && order.timestamp > lastOrderTimestampRef.current) {
                    newOrdersSinceLastLoad++;
                }
                
                if (timestampMillis > currentMaxTimestamp) {
                    currentMaxTimestamp = timestampMillis;
                }
            });
            
            setPendingOrders(newPendingOrders); 
            setReviewedOrders(newReviewedOrders); 
            
            if (!isInitialLoad && newOrdersSinceLastLoad > 0) {
                setNewOrderCount(prev => prev + newOrdersSinceLastLoad);
            }

            if (currentMaxTimestamp > lastOrderTimestampRef.current) {
                lastOrderTimestampRef.current = currentMaxTimestamp;
            }

            if (isInitialLoad) {
                isInitialLoad = false;
            }
            
            setLoading(false); 
            console.log(`✅ ${allOrdersData.length} pedidos cargados. ¡Estable!`);

        }, (error) => {
            console.error("❌ Error escuchando órdenes:", error);
            setLoading(false);
        });

        return () => unsubscribe(); 
        
    }, [db, isReady, isAuthenticated]);


    // --- Efecto 3: Guardar Token FCM en Firestore ---
    useEffect(() => {
        if (fcmToken && db) { 
            const ADMIN_ID_FIJO = 'superAdmin01'; 
            const tokenDocRef = doc(db, 'administradores', ADMIN_ID_FIJO); 
            
            setDoc(tokenDocRef, { 
                fcmToken: fcmToken, 
                userId: ADMIN_ID_FIJO,
                lastActive: serverTimestamp(),
                device: navigator.userAgent
            }, { merge: true }) 
            .then(() => console.log("💾 Token guardado en Firestore."))
            .catch(error => console.error("❌ Error guardando token:", error));
        }
    }, [fcmToken, db]);
    
    // ___________________________________________________________________
    // 🆕 FUNCIÓN PARA ALTERNAR LA VISIBILIDAD DE REVISADOS (CORREGIDO el ReferenceError)
    // ___________________________________________________________________
    const toggleReviewedSection = useCallback(() => {
        setShowReviewed(prev => !prev);
    }, []);

    
    // ___________________________________________________________________
    // FUNCIÓN CLAVE: Mover pedido a la lista de revisados (GUARDANDO EN FIRESTORE)
    // ___________________________________________________________________
    const handleMarkAsReviewed = useCallback(async (order) => {
        if (!db) return; 

        try {
            // 1. Obtener la referencia al documento del pedido
            const orderRef = doc(db, 'orders', order.id);
            
            // 2. Actualizar el campo 'isReviewed' a true.
            await setDoc(orderRef, { isReviewed: true }, { merge: true });
            
            // 3. Cerrar la modal
            setSelectedOrder(null);
            
            console.log(`✅ Pedido ${order.id} guardado como revisado en Firebase.`);

        } catch (error) {
            console.error("❌ Error al guardar el estado de revisión:", error);
            alert("Error al guardar el pedido como revisado. Inténtalo de nuevo.");
        }
    }, [db]);
    

    // --- UI Helpers ---
    const clearNotification = useCallback(() => { setNewOrderCount(0); }, []);
    const handleOpenModal = useCallback((order) => { setSelectedOrder(order); }, []);
    const handleCloseModal = useCallback(() => { setSelectedOrder(null); }, []);
    const formatCurrency = (value) => {
        return new Intl.NumberFormat('es-CO', { 
            style: 'currency',
            currency: 'COP', 
            minimumFractionDigits: 0, 
            maximumFractionDigits: 0,
        }).format(value);
    };
    const formatDate = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };
    const getProductDetails = (item) => {
        let name = 'Producto Desconocido';
        let quantity = 1;

        if (typeof item === 'object' && item !== null) {
            name = item.nombre || item.name || name;
            quantity = item.cantidad || item.qty || item.quantity || 1;
        } else {
            name = String(item);
        }
        return `${quantity}x ${name}`;
    };
    const getItemNotes = (item) => {
        if (typeof item === 'object' && item !== null) {
            return item.notas || item.description || item.adiciones || '';
        }
        return '';
    };

    // --- Componente Modal de Detalles ---
    const OrderDetailModal = ({ order, onClose, onReview }) => {
        if (!order) return null;

        const orderTime = new Date(order.timestamp).toLocaleString('es-CO', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
        
        const DetailRow = ({ icon, label, value, colorClass = 'text-gray-800' }) => (
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className={`flex-shrink-0 ${colorClass}`}>
                    {icon}
                </span>
                <div className="flex flex-col">
                    <span className="text-xs font-semibold uppercase text-gray-500">{label}</span>
                    <span className={`text-sm font-medium ${colorClass} break-words`}>{value}</span>
                </div>
            </div>
        );


        return (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50 overflow-y-auto" onClick={onClose}>
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg m-auto transform transition-all duration-300 scale-100 opacity-100" onClick={e => e.stopPropagation()}>
                    
                    <div className="bg-indigo-600 p-5 rounded-t-xl flex justify-between items-center">
                        <h2 className="text-xl font-bold text-white">Detalles del Pedido #{order.id.substring(0, 8)}</h2>
                        <button onClick={onClose} className="text-white hover:text-indigo-200 transition">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="p-6 space-y-6">
                        
                        <section className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-700 border-b pb-2">Información de Cliente</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <DetailRow
                                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>}
                                    label="Cliente"
                                    value={order.cliente}
                                    colorClass="text-indigo-600"
                                />
                                <DetailRow
                                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 3.699a1 1 0 01-.197.925l-1.399 1.432c-.356.36-.012.895.534.978 1.34.204 2.72.355 4.108.385a1 1 0 001.03-.846l.633-3.167a1 1 0 01.986-.836H17a1 1 0 011 1v11a1 1 0 01-1 1h-2a1 1 0 01-1-1v-2.153a1 1 0 00-.836-.986l-3.699-.74a1 1 0 00-.925.197l-1.432 1.399c-.36.356-.895.012-.978-.534-.204-1.34-.355-2.72-.385-4.108a1 1 0 00-.846-1.03l-3.167-.633a1 1 0 01-.836-.986V3z" /></svg>}
                                    label="Teléfono (WS)"
                                    value={order.telefono}
                                    colorClass="text-green-600"
                                />
                            </div>
                            <DetailRow
                                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>}
                                label="Dirección de Envío"
                                value={order.direccion}
                            />
                            <DetailRow
                                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm12 11H4a1 1 0 01-1-1V8.558a2 2 0 01.898-1.742l4.9-2.924C10.158 3.32 11.84 3.32 13.202 3.947l4.9 2.924A2 2 0 0119 8.558V14a1 1 0 01-1 1z" /></svg>}
                                label="Forma de Pago"
                                value={order.metodoPago}
                                colorClass="text-purple-600"
                            />
                        </section>
                        
                        <section className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-700 border-b pb-2">Detalles del Pedido ({order.items.length} ítems)</h3>
                            <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                                {order.items.map((item, index) => {
                                    const notes = getItemNotes(item);
                                    return (
                                        <li key={index} className="flex flex-col p-3 hover:bg-indigo-50 transition">
                                            <div className="flex justify-between items-start text-sm font-medium">
                                                <span className="text-gray-900">{getProductDetails(item)}</span>
                                            </div>
                                            {notes && (
                                                <p className="text-xs text-gray-500 italic mt-0.5 pl-4 border-l-2 border-yellow-400">
                                                    Nota: {notes}
                                                </p>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                        
                        {order.notasPedido && order.notasPedido !== 'Sin notas adicionales' && (
                            <section>
                                <h3 className="text-lg font-bold text-gray-700 border-b pb-2">Notas Generales del Cliente</h3>
                                <p className="p-3 bg-yellow-50 text-yellow-800 border-l-4 border-yellow-500 rounded-r-lg italic text-sm">
                                    {order.notasPedido}
                                </p>
                            </section>
                        )}

                        <div className="pt-4 border-t-2 border-indigo-100 flex justify-between items-center">
                            <div className="flex flex-col">
                                <span className="text-sm font-light text-gray-500">Hora de Pedido:</span>
                                <span className="text-sm font-semibold text-gray-700">{orderTime}</span>
                            </div>
                            
                            <div className="flex flex-col items-end">
                                <span className="text-lg font-bold text-gray-800">TOTAL A PAGAR:</span>
                                <span className="text-2xl font-extrabold text-indigo-700">
                                    {formatCurrency(order.total/100)}
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-col space-y-3 pt-2">
                            {!order.isReviewed ? (
                                <button 
                                    onClick={() => onReview(order)} 
                                    className="w-full p-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition duration-300 flex items-center justify-center gap-2"
                                >
                                    ✔️ Marcar y Guardar como Revisado
                                </button>
                            ) : (
                                <div className="p-3 bg-indigo-500 text-white font-semibold rounded-lg text-center">
                                    📋 Pedido ya revisado
                                </div>
                            )}

                            <button 
                                onClick={onClose} 
                                className="w-full p-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition duration-300"
                            >
                                Cerrar Modal
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // --- Componente de Tarjeta de Pedido (sin cambios) ---
    const OrderCard = ({ order, onClick, isNew }) => (
        <div 
            key={order.id} 
            onClick={() => onClick(order)}
            className={`bg-white rounded-xl p-4 shadow-lg border-l-4 cursor-pointer transition-all duration-300 active:scale-[0.98] ${
                isNew
                    ? 'border-red-500 transform scale-[1.01] animate-in-shake'
                    : order.isReviewed 
                        ? 'border-green-400 opacity-80 hover:shadow-lg' 
                        : 'border-indigo-200 hover:shadow-xl'
            }`}
        >
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                    {order.isReviewed && (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-green-500">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                        </svg>
                    )}
                    Pedido de: 
                    <span className={`ml-1 font-bold capitalize ${order.isReviewed ? 'text-green-700' : 'text-indigo-700'}`}>{order.cliente}</span>
                </span>
                <span className="text-xs text-gray-400 font-mono">
                    {formatDate(order.timestamp)}
                </span>
            </div>
            
            <ul className="py-3 space-y-2 text-sm">
                {order.items.slice(0, 3).map((item, index) => ( 
                    <li key={index} className="flex flex-col text-gray-700">
                        <span className="font-medium text-gray-800">{getProductDetails(item)}</span>
                    </li>
                ))}
                {order.items.length > 3 && <li className="text-xs text-gray-400 italic">... y {order.items.length - 3} ítems más.</li>}
            </ul>

            <div className="pt-3 border-t-2 border-dashed border-gray-200 flex justify-between items-center">
                <span className="text-base font-bold text-gray-800">TOTAL:</span>
                <span className="text-xl font-extrabold text-indigo-600">
                    {formatCurrency(order.total/100)}
                </span>
            </div>
        </div>
    );

    // --- Render del Componente Principal ---
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                    <p className="text-indigo-600 font-semibold">Conectando a Mi Menu App...</p>
                    <p className="text-xs text-gray-500 mt-2">ID: {userId || '...'}</p>
                </div>
            </div>
        );
    }
    
    // PANTALLA DE BLOQUEO: Login
    if (!isAuthenticated) {
        return <LoginScreen firebaseAuth={firebaseAuth} />;
    }

    // 🆕 EL REPRODUCTOR DE AUDIO SE AGREGA AL FINAL DEL COMPONENTE PRINCIPAL
    return (
        <div className="min-h-screen bg-gray-50">
            {/* ... todo el contenido de la aplicación aquí ... */}

            {/* Agregando el elemento de audio */}
            <audio ref={audioRef} loop preload="auto">
                <source public="/notification.mp3" type="audio/mpeg" />
                Tu navegador no soporta el elemento de audio.
            </audio>
            
            {/* Modal de detalles del pedido */}
            <OrderDetailModal
                order={selectedOrder}
                onClose={handleCloseModal}
                onReview={handleMarkAsReviewed}
            />

            {/* Aquí debería ir el resto de tu UI principal, pero lo omito por brevedad,
                asegúrate de que el componente <audio> esté dentro del return de App.
                Por ejemplo, justo antes del return de LoginScreen, agregué esto para seguir tu estructura:
                if (!isAuthenticated) { ... }
                return ( <main>... Tu UI Principal ...</main> )
            */}

            {/* Placeholder de la UI principal, ya que el resto del código no estaba en el return principal */}
            <div className="max-w-7xl mx-auto p-4 sm:px-6 lg:px-8">
                <h1 className="text-3xl font-bold text-gray-900 my-6">Panel de Administración de Pedidos</h1>
                
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-semibold text-indigo-600 flex items-center gap-2">
                        {showReviewed ? '✅ Pedidos Revisados' : `🚨 Pedidos Pendientes (${pendingOrders.length})`}
                        {newOrderCount > 0 && !showReviewed && (
                            <span className="bg-red-500 text-white text-xs font-bold py-1 px-3 rounded-full animate-pulse cursor-pointer" onClick={clearNotification}>
                                +{newOrderCount} NUEVOS
                            </span>
                        )}
                    </h2>
                    <button
                        onClick={toggleReviewedSection}
                        className="py-2 px-4 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition duration-150"
                    >
                        {showReviewed ? 'Mostrar Pendientes' : 'Mostrar Revisados'}
                    </button>
                    <button 
                        onClick={() => signOut(firebaseAuth)}
                        className="py-2 px-4 bg-red-500 text-white rounded-md hover:bg-red-600 transition duration-150"
                    >
                        Salir 🚪
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {(showReviewed ? reviewedOrders : pendingOrders).map(order => (
                        <OrderCard 
                            key={order.id} 
                            order={order} 
                            onClick={handleOpenModal}
                            isNew={!order.isReviewed && order.timestamp > lastOrderTimestampRef.current - 10000 && !showReviewed}
                        />
                    ))}
                    {(showReviewed ? reviewedOrders : pendingOrders).length === 0 && (
                        <p className="col-span-full text-center text-gray-500 p-8 bg-white rounded-xl shadow-lg">
                            {showReviewed ? 'No hay pedidos marcados como revisados.' : '¡Todo despejado! No hay pedidos pendientes. 🥳'}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );


   
};

export default App;