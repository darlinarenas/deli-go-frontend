/* BHUZ PREMIUM USER ORDERS */

document.addEventListener("DOMContentLoaded", async () => {

  const ordersList = document.getElementById("ordersList");
  const totalOrdersElement = document.getElementById("totalOrders");
  const activeOrdersElement = document.getElementById("activeOrders");
  const lastStatusElement = document.getElementById("lastStatus");
  const userNameText = document.getElementById("userNameText");

  let currentFilter = "all";
  let currentOrders = [];

  function getCurrentUserSafe() {
    if (window.DELI_ORDERS?.getCurrentUser) {
      return window.DELI_ORDERS.getCurrentUser();
    }

    return window.DELI_CURRENT_USER || null;
  }

  function formatPriceSafe(value) {
    return window.DELI_ORDERS.formatPrice(value || 0);
  }

  function getStatusLabelSafe(status) {
    return window.DELI_ORDERS.getStatusLabel(status);
  }

  function getStatusClassSafe(status) {
    return window.DELI_ORDERS.getStatusClass(status);
  }

  async function loadOrders(silent = false){

    const currentUser = getCurrentUserSafe();

    if(!currentUser || !currentUser.email){
      ordersList.innerHTML = '<div class="order-card">Debes iniciar sesión.</div>';
      return;
    }

    const orders = await window.DELI_ORDERS.getOrdersByCustomer(currentUser.email);

    currentOrders = Array.isArray(orders) ? orders : [];

    currentOrders.sort((a,b)=>{
      return new Date(b.createdAt||0) - new Date(a.createdAt||0);
    });

    renderOrders();

    if(!silent){
      userNameText.textContent = `${currentUser.fullName || 'Usuario'}, aquí podrás seguir tus pedidos automáticamente.`;
    }
  }

  function renderOrders(){

    const filtered = currentFilter === "all"
      ? currentOrders
      : currentOrders.filter(o => o.status === currentFilter);

    totalOrdersElement.textContent = currentOrders.length;

    const activeOrders = currentOrders.filter(order=>{
      return !["entregado","cancelado"].includes(order.status);
    });

    activeOrdersElement.textContent = activeOrders.length;

    lastStatusElement.textContent = currentOrders.length
      ? getStatusLabelSafe(currentOrders[0].status)
      : "-";

    if(!filtered.length){
      ordersList.innerHTML = '<div class="order-card">No hay pedidos.</div>';
      return;
    }

    const html = filtered.map(order=>{

      const itemsHtml = (order.items || []).map(item=>`
        <div class="order-item">
          <span>${item.name} x${item.qty}</span>
          <strong>${formatPriceSafe(item.subtotal || 0)}</strong>
        </div>
      `).join("");

      return `
        <article class="order-card" data-order-id="${order.id || ''}">

          <div class="order-top">
            <div>
              <div class="order-title">${order.restaurantName || "Restaurante"}</div>
              <div class="order-sub">Pedido #${order.id || "-"}</div>
            </div>

            <div class="order-status ${getStatusClassSafe(order.status)}">
              ${getStatusLabelSafe(order.status)}
            </div>
          </div>

          <div class="order-items">
            ${itemsHtml}
          </div>

          ${!["entregado","cancelado"].includes(order.status)?`<button class="bhuz-track-btn" data-track-order="${order.id||''}">📍 Ver repartidor en tiempo real</button>`:''}

          <div class="order-footer">
            <div class="order-total">
              ${formatPriceSafe(order.total || 0)}
            </div>

            <div class="order-sub">
              ${order.date || ""}
              ${order.time || ""}
            </div>
          </div>

        </article>
      `;
    }).join("");

    /*
      FIX BHUZ LIVE:
      Evita destruir/recrear toda la vista mientras un popup live está activo.
      Eso hacía que el popup desapareciera demasiado rápido en "Mis pedidos".
    */
    const popupActivo = document.querySelector(".bhuz-live-toast");

    if (popupActivo && ordersList.innerHTML.trim() === html.trim()) {
      return;
    }

    if (ordersList.innerHTML.trim() !== html.trim()) {
      ordersList.innerHTML = html;
    }
  }

  document.querySelectorAll(".tab-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{

      document.querySelectorAll(".tab-btn").forEach(b=>{
        b.classList.remove("active");
      });

      btn.classList.add("active");

      currentFilter = btn.dataset.filter;

      renderOrders();
    });
  });

  document.addEventListener("click",event=>{const btn=event.target.closest("[data-track-order]");if(btn&&window.BHUZ_TRACKING)window.BHUZ_TRACKING.open("FOOD_ORDER",btn.dataset.trackOrder,{title:"Seguimiento de tu pedido"});});

  await loadOrders();

  setInterval(()=>{
    loadOrders(true);
  }, 8000);

});











