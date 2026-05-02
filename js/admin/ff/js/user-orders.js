document.addEventListener("DOMContentLoaded", () => {
  const ordersList = document.getElementById("ordersList");
  const totalOrdersElement = document.getElementById("totalOrders");
  const totalSpentElement = document.getElementById("totalSpent");
  const lastStatusElement = document.getElementById("lastStatus");
  const userNameText = document.getElementById("userNameText");

  function loadUserOrders() {
    const currentUser = window.DELI_ORDERS.getCurrentUser();

    if (!currentUser || !currentUser.email) {
      if (userNameText) {
        userNameText.textContent = "Inicia sesión para ver tus pedidos.";
      }

      if (ordersList) {
        ordersList.innerHTML = `
          <div style="background:#fff;padding:20px;border-radius:16px;">
            No has iniciado sesión.
          </div>
        `;
      }

      return;
    }

    if (userNameText) {
      userNameText.textContent = `${currentUser.fullName || currentUser.name || "Usuario"}, aquí verás tus pedidos realizados en Deli.`;
    }

    const orders = window.DELI_ORDERS.getOrdersByCustomer(currentUser.email);

    if (totalOrdersElement) {
      totalOrdersElement.textContent = orders.length;
    }

    const totalSpent = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);

    if (totalSpentElement) {
      totalSpentElement.textContent = window.DELI_ORDERS.formatPrice(totalSpent);
    }

    if (lastStatusElement) {
      lastStatusElement.textContent = orders.length
        ? window.DELI_ORDERS.getStatusLabel(orders[0].status)
        : "-";
    }

    if (!orders.length) {
      ordersList.innerHTML = `
        <div style="background:#fff;padding:20px;border-radius:16px;">
          Aún no has realizado pedidos.
        </div>
      `;
      return;
    }

    ordersList.innerHTML = orders.map(order => `
      <div style="background:#fff;padding:18px;border-radius:16px;margin-bottom:14px;border:1px solid #eee;">
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
          <div>
            <h3 style="margin:0 0 6px 0;">${order.restaurant?.name || "Restaurante"}</h3>
            <p style="margin:0;color:#666;">Pedido ${order.id}</p>
          </div>

          <div class="${window.DELI_ORDERS.getStatusClass(order.status)}" style="padding:8px 12px;border-radius:999px;font-weight:bold;">
            ${window.DELI_ORDERS.getStatusLabel(order.status)}
          </div>
        </div>

        <div style="margin-bottom:10px;">
          ${(order.items || []).map(item => `
            <p style="margin:6px 0;">• ${item.name} x${item.qty} — ${window.DELI_ORDERS.formatPrice(item.subtotal)}</p>
          `).join("")}
        </div>

        <div>
          <p style="margin:6px 0;"><strong>Total:</strong> ${window.DELI_ORDERS.formatPrice(order.total)}</p>
          <p style="margin:6px 0;"><strong>Dirección:</strong> ${order.customer?.address || "-"}</p>
          <p style="margin:6px 0;"><strong>Fecha:</strong> ${order.date || "-"} ${order.time || ""}</p>
        </div>
      </div>
    `).join("");
  }

  loadUserOrders();
});