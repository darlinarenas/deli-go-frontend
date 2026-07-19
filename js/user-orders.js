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

  async function ensureVisibleDeliveryCodes(orders = []) {
    // La ruta principal /orders/customer/:email ya genera y devuelve la clave.
    // No hacemos una segunda petición por pedido: evitamos 404, duplicidad y carreras.
    for (const order of orders) {
      const status = String(order.status || "").toLowerCase();
      if (["entregado", "cancelado"].includes(status)) continue;
      const code = String(order.deliveryCode || order.delivery_code || "").trim();
      if (/^\d{6}$/.test(code)) {
        order.deliveryCode = code;
        order.deliveryCodeError = "";
      } else {
        // Respaldo directo: el mismo backend genera y guarda una sola clave en BD.
        try {
          const response = await fetch(`${window.DELI_API_URL || "https://deligo-backend-i554.onrender.com"}/orders/${encodeURIComponent(order.id)}/delivery-code`, {
            credentials: "include",
            cache: "no-store"
          });
          const data = await response.json().catch(() => ({}));
          const repairedCode = String(data.deliveryCode || "").trim();
          if (response.ok && /^\d{6}$/.test(repairedCode)) {
            order.deliveryCode = repairedCode;
            order.delivery_code = repairedCode;
            order.deliveryCodeError = "";
            continue;
          }
          throw new Error(data.message || `HTTP ${response.status}`);
        } catch (error) {
          order.deliveryCode = "";
          order.deliveryCodeError = `No se pudo obtener la clave (${error.message || "sin conexión"}).`;
        }
      }
    }
    return orders;
  }

  async function loadOrders(silent = false){

    const currentUser = getCurrentUserSafe();

    if(!currentUser || !currentUser.email){
      userNameText.textContent = "No encontramos una sesión activa en este navegador.";
      ordersList.innerHTML = '<div class="order-card">Debes iniciar sesión nuevamente para ver tus pedidos.</div>';
      return;
    }

    try {
      const orders = await window.DELI_ORDERS.getOrdersByCustomer(currentUser.email);
      currentOrders = Array.isArray(orders) ? orders : [];
      await ensureVisibleDeliveryCodes(currentOrders);
    } catch (error) {
      console.error("Error cargando Mis pedidos:", error);
      userNameText.textContent = `${currentUser.fullName || 'Usuario'}, no pudimos cargar tus pedidos.`;
      ordersList.innerHTML = `<div class="order-card">${error.message || 'No se pudo conectar con el servidor.'}</div>`;
      return;
    }

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
              <div class="order-sub">Pedido #${order.orderNumber || order.id || "-"}</div>
            </div>

            <div class="order-status ${getStatusClassSafe(order.status)}">
              ${getStatusLabelSafe(order.status)}
            </div>
          </div>

          <div class="order-items">
            ${itemsHtml}
          </div>

          ${!["entregado","cancelado"].includes(order.status) ? `
            <section class="bhuz-delivery-code ${order.deliveryCode ? '' : 'is-loading'}" aria-label="Clave de entrega del pedido">
              <span class="bhuz-code-kicker">🔐 CLAVE DE ENTREGA DEL PEDIDO</span>
              ${order.deliveryCode ? `<strong class="bhuz-delivery-code-value">${order.deliveryCode}</strong>` : order.deliveryCodeError ? `<strong class="bhuz-delivery-code-pending">No se pudo generar</strong><small class="bhuz-code-error">${order.deliveryCodeError}</small><button type="button" class="bhuz-code-retry" data-retry-code="${order.id||''}">Reintentar</button>` : `<strong class="bhuz-delivery-code-pending">Generando clave…</strong>`}
              <p><b>Esta es la clave de 6 dígitos que debes darle al repartidor.</b><br>Entrégala únicamente cuando tengas la comida en tus manos. No es el número del pedido.</p>
            </section>` : ''}
          ${!["entregado","cancelado"].includes(order.status)?`
            <section class="bhuz-live-card">
              <div><span>SEGUIMIENTO DEL PEDIDO</span><strong>${["retirado","en_camino"].includes(order.status)?"Tu repartidor va en camino":"Consulta cuándo se asigne el repartidor"}</strong><small>Ubicación actualizada desde el teléfono del repartidor.</small></div>
              <button class="bhuz-track-btn" data-track-order="${order.id||''}">Ver recorrido en vivo <b>→</b></button>
            </section>`:''}

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
  document.addEventListener("click",async event=>{const btn=event.target.closest("[data-retry-code]");if(!btn)return;btn.disabled=true;btn.textContent="Actualizando…";await loadOrders(true);btn.disabled=false;btn.textContent="Reintentar";});


  function ensureCustomerPushButton(){
    if(document.getElementById("bhuzCustomerPushCard")) return;
    const card=document.createElement("section");
    card.id="bhuzCustomerPushCard";
    card.className="bhuz-push-card";
    const enabled=("Notification" in window) && Notification.permission==="granted" && localStorage.getItem("bhuz_push_enabled")==="1";
    card.innerHTML=`<div class="bhuz-push-icon">🔔</div><div class="bhuz-push-copy"><span>AVISOS DE TUS PEDIDOS</span><strong>${enabled?"Notificaciones activadas":"Recibe alertas aunque BHUZ esté cerrada"}</strong><small>${enabled?"Este dispositivo está vinculado a tu cuenta.":"Te avisaremos cuando acepten, preparen, retiren o entreguen tu pedido."}</small></div><button id="bhuzCustomerPushBtn" type="button" ${enabled?"disabled":""}>${enabled?"✓ Activadas":"Activar avisos"}</button>`;
    const anchor=document.querySelector(".user-summary")||ordersList.parentElement;
    anchor?.insertAdjacentElement("afterend",card);
    const btn=card.querySelector("#bhuzCustomerPushBtn");
    btn?.addEventListener("click",async()=>{
      try{
        const u=getCurrentUserSafe();
        btn.disabled=true;btn.textContent="Activando…";
        await window.BHUZ_PWA.subscribe({userEmail:u?.email||""});
        card.querySelector(".bhuz-push-copy strong").textContent="Notificaciones activadas";
        card.querySelector(".bhuz-push-copy small").textContent="Este dispositivo está vinculado a tu cuenta.";
        btn.textContent="✓ Activadas";
        if(navigator.vibrate) navigator.vibrate([120,60,120]);
      }catch(error){btn.disabled=false;btn.textContent="Activar avisos";alert(error.message||"No se pudieron activar las notificaciones.");}
    });
  }

  async function refreshCustomerPushBinding(){
    if(!("Notification" in window) || Notification.permission!=="granted" || localStorage.getItem("bhuz_push_enabled")!=="1") return;
    try{const u=getCurrentUserSafe();await window.BHUZ_PWA?.subscribe?.({userEmail:u?.email||""});}catch(error){console.warn("No se pudo renovar la suscripción push:",error.message);}
  }


  if (!window.DELI_SESSION_READY) {
    await new Promise(resolve => {
      const timeout = setTimeout(resolve, 2500);
      window.addEventListener("deli:session-ready", () => { clearTimeout(timeout); resolve(); }, { once:true });
    });
  }

  ensureCustomerPushButton();
  await refreshCustomerPushBinding();
  await loadOrders();

  setInterval(()=>{
    loadOrders(true);
  }, 8000);

});











