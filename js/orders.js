/* ======================================================
   DELI FOODS
   orders.js

   PUENTE ENTRE FRONTEND Y BACKEND
   - Crear pedido
   - Obtener pedidos por restaurante
   - Obtener pedidos por cliente
   - Actualizar estado
   - Helpers para historial y panel
   - Backend como única fuente real de pedidos
====================================================== */

/* ======================================================
   BLOQUE 0
   CONFIGURACIÓN BACKEND
====================================================== */
const DELI_ORDERS_API_URL = "https://deligo-backend-i554.onrender.com"; // CAMBIO: conectar frontend con backend Render
// IMPORTANTE: Los pedidos NO se guardan en localStorage.
// La única fuente real de pedidos es el backend Node + JSON.
const ORDERS_KEY = "deliOrders"; // Se conserva solo por compatibilidad, no se usa como fuente de datos.

/* ======================================================
   BLOQUE 1
   HELPERS GENERALES
====================================================== */
function ordersSafeParse(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

/* ======================================================
   BLOQUE 2
   SESIÓN ACTUAL
====================================================== */
function getCurrentUser() {
  return (
    ordersSafeParse(localStorage.getItem("deliCurrentUser"), null) ||
    ordersSafeParse(localStorage.getItem("deliUser"), null) ||
    ordersSafeParse(localStorage.getItem("user"), null) ||
    null
  );
}

/* ======================================================
   BLOQUE 3
   FORMATO DE PRECIO
====================================================== */
function formatPrice(value) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

/* ======================================================
   BLOQUE 4
   ESTADOS
====================================================== */
function normalizeOrderStatus(status) {
  const normalized = normalizeText(status);

  switch (normalized) {
    case "pending":
      return "pendiente";

    case "accepted":
      return "aceptado";

    case "preparing":
      return "preparando";

    case "ready":
      return "listo";

    case "on_the_way":
    case "on-the-way":
    case "en camino":
      return "en_camino";

    case "delivered":
    case "completed":
    case "finished":
      return "entregado";

    case "pendiente":
    case "aceptado":
    case "preparando":
    case "listo":
    case "en_camino":
    case "entregado":
      return normalized;

    default:
      return "pendiente";
  }
}

function getStatusLabel(status) {
  switch (normalizeOrderStatus(status)) {
    case "pendiente":
      return "Pendiente";

    case "aceptado":
      return "Aceptado";

    case "preparando":
      return "Preparando";

    case "listo":
      return "Listo";

    case "en_camino":
      return "En camino";

    case "entregado":
      return "Entregado";

    default:
      return "Pendiente";
  }
}

function getStatusClass(status) {
  switch (normalizeOrderStatus(status)) {
    case "pendiente":
      return "status-pendiente";

    case "aceptado":
    case "preparando":
      return "status-preparando";

    case "listo":
      return "status-listo";

    case "en_camino":
      return "status-camino";

    case "entregado":
      return "status-entregado";

    default:
      return "status-pendiente";
  }
}

/* ======================================================
   BLOQUE 5
   COMPATIBILIDAD SIN LOCALSTORAGE OPERATIVO
   - Se mantienen estas funciones para no romper dependencias viejas.
   - Ya NO leen ni escriben pedidos reales en el navegador.
   - Backend es la única fuente de verdad.
====================================================== */
function getLocalOrders() {
  // Backend puro:
  // No se leen pedidos desde localStorage para evitar datos viejos,
  // pedidos fantasmas o diferencias entre dispositivos.
  return [];
}

function saveLocalOrders(orders) {
  // Backend puro:
  // No se guardan pedidos en localStorage.
  // Se deja la función para no romper llamadas existentes dentro del proyecto.
  return orders;
}

/* ======================================================
   BLOQUE 6
   NORMALIZAR ESTRUCTURA DE PEDIDO
====================================================== */
function normalizeOrder(order) {
  if (!order || typeof order !== "object") return null;

  const restaurantObject =
    order.restaurant && typeof order.restaurant === "object"
      ? order.restaurant
      : {};

  const customerObject =
    order.customer && typeof order.customer === "object"
      ? order.customer
      : {};

  const items = Array.isArray(order.items)
    ? order.items.map((item) => {
        const qty = Number(item?.qty || 0);
        const price = Number(item?.price || 0);

        return {
          id: item?.id || "",
          name: item?.name || "Producto",
          qty,
          price,
          subtotal: Number(
            item?.subtotal != null ? item.subtotal : qty * price
          )
        };
      })
    : [];

  return {
    id: order.id || `order_${Date.now()}`,
    restaurantEmail: normalizeText(
      order.restaurantEmail || restaurantObject.email || ""
    ),
    restaurantName:
      order.restaurantName || restaurantObject.name || "Restaurante",
    restaurant: {
      email: normalizeText(
        restaurantObject.email || order.restaurantEmail || ""
      ),
      name: restaurantObject.name || order.restaurantName || "Restaurante",
      id: restaurantObject.id || order.restaurantId || ""
    },
    items,
    total: Number(order.total || 0),
    customer: {
      fullName:
        customerObject.fullName ||
        customerObject.name ||
        order.fullName ||
        "",
      phone:
        customerObject.phone ||
        order.phone ||
        "",
      address:
        customerObject.address ||
        order.address ||
        "",
      email:
        customerObject.email ||
        order.email ||
        ""
    },
    status: normalizeOrderStatus(order.status),
    paymentMethod: order.paymentMethod || "pendiente",
    notes: order.notes || "",
    date: order.date || "",
    time: order.time || "",
    createdAt: order.createdAt || new Date().toISOString()
  };
}

function normalizeOrdersList(list) {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeOrder).filter(Boolean);
}

/* ======================================================
   BLOQUE 7
   CREAR PEDIDO
====================================================== */
async function createOrder(order) {
  const normalizedOrder = normalizeOrder(order);

  try {
    const response = await fetch(`${DELI_ORDERS_API_URL}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(normalizedOrder)
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      console.error("Error backend al crear pedido:", data.message);
      return null;
    }

    const savedOrder = normalizeOrder(data.order);

    if (!savedOrder) {
      console.error("El backend no devolvió un pedido válido.");
      return null;
    }

    // IMPORTANTE:
    // El pedido ya fue guardado por el backend en orders.json.
    // No duplicamos el pedido en localStorage.
    return savedOrder;
  } catch (error) {
    console.error("No se pudo conectar con el backend al crear pedido:", error);
    return null;
  }
}

/* ======================================================
   BLOQUE 8
   PEDIDOS DEL RESTAURANTE
====================================================== */
async function getOrdersByRestaurant(email) {
  const normalizedEmail = normalizeText(email);

  try {
    const response = await fetch(
      `${DELI_ORDERS_API_URL}/orders/restaurant/${encodeURIComponent(normalizedEmail)}`
    );

    const data = await response.json();

    if (response.ok && data.ok) {
      const normalizedOrders = normalizeOrdersList(data.orders);
      return normalizedOrders;
    }
  } catch (error) {
    console.warn("No se pudo leer pedidos del restaurante desde backend:", error);
  }

  // CAMBIO: conectar frontend con backend Render - no usar localStorage como fuente principal si falla el backend
  return [];
}

/* ======================================================
   BLOQUE 9
   PEDIDOS DEL CLIENTE
====================================================== */
async function getOrdersByCustomer(email) {
  const normalizedEmail = normalizeText(email);

  try {
    const response = await fetch(
      `${DELI_ORDERS_API_URL}/orders/customer/${encodeURIComponent(normalizedEmail)}`
    );

    const data = await response.json();

    if (response.ok && data.ok) {
      const normalizedOrders = normalizeOrdersList(data.orders);
      return normalizedOrders;
    }
  } catch (error) {
    console.warn("No se pudo leer pedidos del cliente desde backend:", error);
  }

  // CAMBIO: conectar frontend con backend Render - no usar localStorage como fuente principal si falla el backend
  return [];
}

/* ======================================================
   BLOQUE 10
   ACTUALIZAR ESTADO
====================================================== */
async function updateOrderStatus(orderId, status) {
  const normalizedStatus = normalizeOrderStatus(status);

  try {
    const response = await fetch(
      `${DELI_ORDERS_API_URL}/orders/${encodeURIComponent(orderId)}/status`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status: normalizedStatus })
      }
    );

    const data = await response.json();

    if (response.ok && data.ok) {
      const updatedOrder = normalizeOrder(data.order);

      if (
        updatedOrder &&
        normalizeOrderStatus(updatedOrder.status) === normalizedStatus
      ) {
        const orders = getLocalOrders();

        const index = orders.findIndex(
          (order) => String(order.id) === String(orderId)
        );

        if (index >= 0) {
          orders[index] = updatedOrder;
        } else {
          orders.unshift(updatedOrder);
        }

        saveLocalOrders(orders);
        return updatedOrder;
      }

      console.warn(
        "El backend respondió, pero no confirmó el estado esperado:",
        {
          esperado: normalizedStatus,
          recibido: updatedOrder?.status || data?.order?.status || null
        }
      );
    }
  } catch (error) {
    console.warn("No se pudo actualizar estado en backend:", error);
  }

  // Backend puro:
  // Si el backend no confirmó el cambio, NO actualizamos localmente.
  // Esto evita que el panel muestre estados falsos que no existen en orders.json.
  return null;
}

/* ======================================================
   BLOQUE 11
   EXPORT GLOBAL
====================================================== */
window.DELI_ORDERS = {
  createOrder,
  getOrdersByRestaurant,
  getOrdersByCustomer,
  updateOrderStatus,
  getCurrentUser,
  formatPrice,
  getStatusLabel,
  getStatusClass,
  normalizeOrderStatus
};






