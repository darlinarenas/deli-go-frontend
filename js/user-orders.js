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


  const TIMELINE_STEPS = [
    { key: "recibido", label: "Recibido", timeField: "createdAt" },
    { key: "aceptado", label: "Aceptado", timeField: "acceptedAt" },
    { key: "preparando", label: "En preparación", timeField: "preparingAt" },
    { key: "retirado", label: "Retirado", timeField: "pickedUpAt" },
    { key: "en_camino", label: "En camino", timeField: "enRouteAt" },
    { key: "entregado", label: "Entregado", timeField: "deliveredAt" }
  ];

  function getTimelineIndex(status) {
    const normalized = String(status || "").toLowerCase();
    if (normalized === "entregado") return 5;
    if (normalized === "en_camino") return 4;
    if (normalized === "retirado") return 3;
    if (["preparando", "listo"].includes(normalized)) return 2;
    if (normalized === "aceptado") return 1;
    return 0;
  }

  function formatTimelineTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
  }

  function renderTimeline(order) {
    const currentIndex = getTimelineIndex(order.status);
    return `
      <div class="bhuz-order-progress" aria-label="Progreso del pedido">
        ${TIMELINE_STEPS.map((step, index) => {
          const state = index < currentIndex ? "is-complete" : index === currentIndex ? "is-current" : "is-pending";
          const time = formatTimelineTime(order[step.timeField]);
          return `
            <div class="bhuz-progress-step ${state}">
              <div class="bhuz-progress-marker"><span>${index < currentIndex ? "✓" : ""}</span></div>
              <div class="bhuz-progress-label">${step.label}</div>
              <div class="bhuz-progress-time">${time || "&nbsp;"}</div>
            </div>`;
        }).join("")}
      </div>`;
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

          ${renderTimeline(order)}

          ${order.status === "entregado" ? `
            <div class="bhuz-delivery-verified">
              <div class="bhuz-verified-icon">✓</div>
              <div>
                <strong>Entrega verificada</strong>
                <span>Pedido entregado correctamente mediante el código de seguridad.</span>
                ${order.deliveryCode ? `<small class="bhuz-verified-code">Código validado: <b>${order.deliveryCode}</b></small>` : ""}
              </div>
            </div>` : ''}

          ${order.deliveryCode && !order.deliveryCodeUsed && !["entregado","cancelado"].includes(order.status) ? `
            <div style="margin:14px 0;padding:14px;border-radius:16px;background:rgba(20,255,120,.08);border:1px solid rgba(20,255,120,.28);text-align:center;">
              <div style="font-size:.78rem;letter-spacing:.08em;text-transform:uppercase;opacity:.75;">Código para entregar al repartidor</div>
              <strong style="display:block;margin-top:6px;font-size:1.8rem;letter-spacing:.28em;">${order.deliveryCode}</strong>
              <small style="display:block;margin-top:6px;opacity:.72;">Entrégalo únicamente cuando recibas tu pedido.</small>
            </div>` : ''}

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











