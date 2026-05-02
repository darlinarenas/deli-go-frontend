/* ======================================================
   DELI - orders.js
   Sistema de pedidos central de la aplicación
   (AHORA conectado también al backend)
====================================================== */

/* ======================================================
   CONFIGURACIÓN
====================================================== */

const DELI_ORDERS_KEY = "deliOrders";
const API_URL = "http://localhost:3000";


/* ======================================================
   HELPERS GENERALES
====================================================== */

function safeParse(value, fallback = null) {

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }

}

function normalizeEmail(email) {
  return (email || "").toString().trim().toLowerCase();
}


/* ======================================================
   OBTENER USUARIO ACTUAL
====================================================== */

function getCurrentUser() {

  return (
    safeParse(localStorage.getItem("deliCurrentUser"), null) ||
    safeParse(localStorage.getItem("deliUser"), null) ||
    safeParse(localStorage.getItem("user"), null) ||
    null
  );

}


/* ======================================================
   USUARIO GUARDADO (COMPATIBILIDAD)
====================================================== */

function getSavedUser() {

  const possibleKeys = [
    "deliCurrentUser",
    "deliUser",
    "user",
    "currentUser",
    "usuario",
    "usuarioDeli"
  ];

  for (const key of possibleKeys) {

    const raw = localStorage.getItem(key);

    if (raw) {

      try {

        const user = JSON.parse(raw);

        return {
          fullName: user.fullName || user.name || user.nombre || "",
          address: user.address || user.direccion || "",
          phone: user.phone || user.telefono || "",
          email: user.email || user.correo || "",
          role: user.role || "customer"
        };

      } catch (error) {
        console.error("Error leyendo usuario guardado:", error);
      }

    }

  }

  return {
    fullName: "",
    address: "",
    phone: "",
    email: "",
    role: "customer"
  };

}


/* ======================================================
   PEDIDOS LOCALES
====================================================== */

function getOrders() {

  const raw = localStorage.getItem(DELI_ORDERS_KEY);

  if (!raw) return [];

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error("Error leyendo pedidos:", error);
    return [];
  }

}

function saveOrders(orders) {
  localStorage.setItem(DELI_ORDERS_KEY, JSON.stringify(orders));
}


/* ======================================================
   GENERADORES
====================================================== */

function generateOrderId() {
  return `DL-${Date.now()}`;
}

function getCurrentDateTime() {

  const now = new Date();

  const date = now.toLocaleDateString("es-CL");

  const time = now.toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit"
  });

  return { date, time };

}


/* ======================================================
   CREAR PEDIDO
   (AHORA ENVÍA AL BACKEND)
====================================================== */

async function createOrder(orderData) {

  const { date, time } = getCurrentDateTime();

  const newOrder = {

    id: generateOrderId(),

    createdAt: new Date().toISOString(),

    date,
    time,

    status: "pendiente",

    paymentStatus: "pendiente",

    currency: "USD",

    total: Number(orderData.total || 0),

    restaurant: {
      name: orderData.restaurantName || "Restaurante",
      email: normalizeEmail(orderData.restaurantEmail || ""),
      address: orderData.restaurantAddress || "Punto Fijo"
    },

    customer: {
      fullName: orderData.fullName || "",
      address: orderData.address || "",
      phone: orderData.phone || "",
      email: normalizeEmail(orderData.email || ""),
      userId: orderData.userId || null
    },

    items: (orderData.items || []).map(item => ({
      id: item.id,
      name: item.name,
      price: Number(item.price || 0),
      qty: Number(item.qty || 0),
      subtotal: Number(item.price || 0) * Number(item.qty || 0)
    }))

  };


  /* ==========================================
     1️⃣ ENVIAR PEDIDO AL BACKEND
  ========================================== */

  try {

    await fetch(`${API_URL}/orders`, {

      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({

        restaurantEmail: newOrder.restaurant.email,
        restaurantName: newOrder.restaurant.name,

        items: newOrder.items,

        total: newOrder.total,

        customer: newOrder.customer

      })

    });

  } catch (error) {

    console.warn("Backend no disponible, guardando pedido local");

  }


  /* ==========================================
     2️⃣ GUARDAR PEDIDO LOCAL (COMPATIBILIDAD)
  ========================================== */

  const orders = getOrders();

  orders.unshift(newOrder);

  saveOrders(orders);

  return newOrder;

}


/* ======================================================
   OBTENER PEDIDOS POR CLIENTE
====================================================== */

function getOrdersByCustomer(email) {

  const customerEmail = normalizeEmail(email);

  return getOrders().filter(
    order => normalizeEmail(order.customer?.email) === customerEmail
  );

}


/* ======================================================
   OBTENER PEDIDOS POR RESTAURANTE
====================================================== */

function getOrdersByRestaurant(email) {

  const restaurantEmail = normalizeEmail(email);

  return getOrders().filter(
    order => normalizeEmail(order.restaurant?.email) === restaurantEmail
  );

}


/* ======================================================
   PEDIDOS POR ESTADO
====================================================== */

function getOrdersByStatus(restaurantEmail, status) {

  const email = normalizeEmail(restaurantEmail);

  return getOrders().filter(order =>
    normalizeEmail(order.restaurant?.email) === email &&
    order.status === status
  );

}


/* ======================================================
   ACTUALIZAR ESTADO DEL PEDIDO
====================================================== */

function updateOrderStatus(orderId, newStatus) {

  const orders = getOrders();

  const updated = orders.map(order => {

    if (String(order.id) === String(orderId)) {

      return {
        ...order,
        status: newStatus
      };

    }

    return order;

  });

  saveOrders(updated);

}


/* ======================================================
   FORMATEO DE DATOS
====================================================== */

function formatPrice(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function getStatusLabel(status) {

  const map = {

    pendiente: "Nuevo pedido",

    aceptado: "Aceptado",

    preparando: "En preparación",

    listo: "Listo",

    finalizado: "Finalizado"

  };

  return map[status] || "Pendiente";

}

function getStatusClass(status) {

  const map = {

    pendiente: "status-pendiente",

    aceptado: "status-aceptado",

    preparando: "status-preparando",

    listo: "status-listo",

    finalizado: "status-finalizado"

  };

  return map[status] || "status-pendiente";

}


/* ======================================================
   EXPORTAR SISTEMA GLOBAL
====================================================== */

window.DELI_ORDERS = {

  getSavedUser,
  getCurrentUser,

  getOrders,
  saveOrders,

  createOrder,

  getOrdersByCustomer,
  getOrdersByRestaurant,
  getOrdersByStatus,

  updateOrderStatus,

  formatPrice,
  getStatusLabel,
  getStatusClass,

  normalizeEmail

};