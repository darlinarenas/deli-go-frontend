/* ======================================================
   DELI FOODS
   user-orders.js

   HISTORIAL DE PEDIDOS DEL USUARIO
====================================================== */

document.addEventListener("DOMContentLoaded", async () => {

  if (!window.DELI_SESSION_READY && typeof loadCurrentSession === "function") {
    await loadCurrentSession();
  }

  const ordersList = document.getElementById("ordersList");
  const totalOrdersElement = document.getElementById("totalOrders");
  const totalSpentElement = document.getElementById("totalSpent");
  const lastStatusElement = document.getElementById("lastStatus");
  const userNameText = document.getElementById("userNameText");

  function renderMessage(message) {
    if (!ordersList) return;

    ordersList.innerHTML = `
      <div style="background:#fff;padding:20px;border-radius:16px;">
        ${message}
      </div>
    `;
  }

  function formatPriceSafe(value) {
    if (window.DELI_ORDERS && typeof window.DELI_ORDERS.formatPrice === "function") {
      return window.DELI_ORDERS.formatPrice(value);
    }

    return `$${Number(value || 0)}`;
  }

  function getStatusLabelSafe(status) {
    if (window.DELI_ORDERS && typeof window.DELI_ORDERS.getStatusLabel === "function") {
      return window.DELI_ORDERS.getStatusLabel(status);
    }

    return status || "Pendiente";
  }

  function getStatusClassSafe(status) {
    if (window.DELI_ORDERS && typeof window.DELI_ORDERS.getStatusClass === "function") {
      return window.DELI_ORDERS.getStatusClass(status);
    }

    return "status-pendiente";
  }

  function setSummary(totalOrders, totalSpent, lastStatus) {

    if (totalOrdersElement) {
      totalOrdersElement.textContent = String(totalOrders || 0);
    }

    if (totalSpentElement) {
      totalSpentElement.textContent = formatPriceSafe(totalSpent || 0);
    }

    if (lastStatusElement) {
      lastStatusElement.textContent = lastStatus || "-";
    }

  }

  function getCurrentUserSafe() {

    if (window.DELI_ORDERS && typeof window.DELI_ORDERS.getCurrentUser === "function") {
      return window.DELI_ORDERS.getCurrentUser();
    }

    if (typeof window.getCurrentUser === "function") {
      return window.getCurrentUser();
    }

    return window.DELI_CURRENT_USER || null;

  }

  async function loadUserOrders() {

    const currentUser = getCurrentUserSafe();

    if (!currentUser || !currentUser.email) {

      if (userNameText) {
        userNameText.textContent = "Inicia sesión para ver tus pedidos.";
      }

      setSummary(0, 0, "-");
      renderMessage("No has iniciado sesión.");
      return;
    }

    if (userNameText) {
      userNameText.textContent = `${currentUser.fullName || currentUser.name || "Usuario"}, aquí verás tus pedidos realizados en Deli.`;
    }

    if (!window.DELI_ORDERS || typeof window.DELI_ORDERS.getOrdersByCustomer !== "function") {
      console.error("DELI_ORDERS no está disponible.");
      setSummary(0, 0, "-");
      renderMessage("No se pudo cargar el historial de pedidos.");
      return;
    }

    let orders = [];

    try {
      orders = await window.DELI_ORDERS.getOrdersByCustomer(currentUser.email);
    } catch (error) {
      console.error("Error obteniendo pedidos del cliente:", error);
      orders = [];
    }

    if (!Array.isArray(orders)) {
      orders = [];
    }

    orders.sort((a, b) => {
      const aTime = new Date(a.createdAt || 0).getTime() || 0;
      const bTime = new Date(b.createdAt || 0).getTime() || 0;
      return bTime - aTime;
    });

    const totalSpent = orders.reduce((sum, order) => {
      return sum + Number(order?.total || 0);
    }, 0);

    const lastStatus = orders.length
      ? getStatusLabelSafe(orders[0].status)
      : "-";

    setSummary(orders.length, totalSpent, lastStatus);

    if (!orders.length) {
      renderMessage("Aún no has realizado pedidos.");
      return;
    }

    ordersList.innerHTML = orders.map((order) => {

      const restaurantName =
        order.restaurant?.name ||
        order.restaurantName ||
        "Restaurante";

      const statusClass = getStatusClassSafe(order.status);
      const statusLabel = getStatusLabelSafe(order.status);
      const totalFormatted = formatPriceSafe(order.total);

      const itemsHtml = (order.items || []).map((item) => {

        const subtotal = Number(
          item.subtotal != null
            ? item.subtotal
            : Number(item.qty || 0) * Number(item.price || 0)
        );

        return `
          <div class="order-item">
            <span>${item.name} x${item.qty}</span>
            <strong>${formatPriceSafe(subtotal)}</strong>
          </div>
        `;

      }).join("");

      return `
        <article class="order-card">

          <div class="order-top">

            <div>
              <div class="order-title">${restaurantName}</div>
              <div class="order-sub">Pedido ${order.id || "-"}</div>
            </div>

            <div class="order-status ${statusClass}">
              ${statusLabel}
            </div>

          </div>

          <div class="order-items">
            ${itemsHtml}
          </div>

          <div class="order-footer">
            <div class="order-total">Total: ${totalFormatted}</div>
            <div class="order-sub">
              ${order.date || "-"} ${order.time || ""}
            </div>
          </div>

        </article>
      `;

    }).join("");

  }

  await loadUserOrders();

});

