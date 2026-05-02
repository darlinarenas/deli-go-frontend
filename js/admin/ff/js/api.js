const API_URL = "http://localhost:3000";

/* =========================
   CREAR PEDIDO
========================= */
async function apiCreateOrder(order) {

  const response = await fetch(`${API_URL}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(order)
  });

  return response.json();
}

/* =========================
   PEDIDOS DEL RESTAURANTE
========================= */
async function apiGetRestaurantOrders(email) {

  const response = await fetch(
    `${API_URL}/orders/restaurant/${email}`
  );

  return response.json();
}

/* =========================
   PEDIDOS DEL CLIENTE
========================= */
async function apiGetCustomerOrders(email) {

  const response = await fetch(
    `${API_URL}/orders/customer/${email}`
  );

  return response.json();
}