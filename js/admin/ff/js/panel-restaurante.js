/* =====================================================
   DELI FOODS
   PANEL RESTAURANTE - PEDIDOS
   ESTE ARCHIVO SOLO CONTROLA PEDIDOS
===================================================== */

document.addEventListener("DOMContentLoaded", () => {

  const API_URL = "http://localhost:3000";

  const restaurantOrdersList = document.getElementById("restaurantOrdersList");
  const overviewOrdersList = document.getElementById("overviewOrdersList");

  const pendingOrdersCount = document.getElementById("pendingOrdersCount");
  const preparingOrdersCount = document.getElementById("preparingOrdersCount");
  const readyOrdersCount = document.getElementById("readyOrdersCount");

  const orderSearchInput = document.getElementById("orderSearchInput");
  const orderStatusFilter = document.getElementById("orderStatusFilter");
  const clearOrderFiltersBtn = document.getElementById("clearOrderFiltersBtn");

  let allOrders = [];

  /* =====================================================
     OBTENER RESTAURANTE LOGUEADO
  ===================================================== */
  function getRestaurant() {

    try {

      return (
        JSON.parse(localStorage.getItem("deliCurrentUser")) ||
        JSON.parse(localStorage.getItem("deliUser")) ||
        JSON.parse(localStorage.getItem("user")) ||
        null
      );

    } catch {

      return null;

    }

  }

  /* =====================================================
     NORMALIZAR PEDIDO
  ===================================================== */

  function normalizeOrder(order){

    return {

      id: order.id || "",
      total: Number(order.total || 0),
      status: (order.status || "pendiente").toLowerCase(),
      date: order.date || "",
      time: order.time || "",

      customer: {

        fullName: order.customer?.fullName || "Cliente",
        phone: order.customer?.phone || "-",
        address: order.customer?.address || "-"

      },

      items: Array.isArray(order.items) ? order.items : []

    };

  }

  /* =====================================================
     CARGAR PEDIDOS
  ===================================================== */

  async function loadOrders(){

    const restaurant = getRestaurant();

    if(!restaurant || !restaurant.email){

      console.warn("No hay restaurante logueado");

      return;

    }

    try{

      const response = await fetch(
        `${API_URL}/orders/restaurant/${encodeURIComponent(restaurant.email)}`
      );

      const data = await response.json();

      if(!response.ok){

        console.error("Error backend");

        return;

      }

      allOrders = data.orders.map(normalizeOrder);

      renderAll();

    }
    catch(error){

      console.error("Error cargando pedidos",error);

    }

  }

  /* =====================================================
     FILTROS
  ===================================================== */

  function getFilteredOrders(){

    const search = (orderSearchInput?.value || "").toLowerCase();
    const status = (orderStatusFilter?.value || "todos");

    return allOrders.filter(order => {

      const matchSearch =
        order.id.toLowerCase().includes(search) ||
        order.customer.fullName.toLowerCase().includes(search) ||
        order.customer.phone.toLowerCase().includes(search);

      const matchStatus =
        status === "todos" || order.status === status;

      return matchSearch && matchStatus;

    });

  }

  /* =====================================================
     ESTADISTICAS
  ===================================================== */

  function renderStats(){

    const pending = allOrders.filter(o => o.status === "pendiente").length;

    const preparing = allOrders.filter(o =>
      o.status === "aceptado" || o.status === "preparando"
    ).length;

    const ready = allOrders.filter(o => o.status === "listo").length;

    if(pendingOrdersCount) pendingOrdersCount.textContent = pending;
    if(preparingOrdersCount) preparingOrdersCount.textContent = preparing;
    if(readyOrdersCount) readyOrdersCount.textContent = ready;

  }

  /* =====================================================
     PEDIDOS RESUMEN
  ===================================================== */

  function renderOverviewOrders(){

    if(!overviewOrdersList) return;

    const orders = allOrders.slice(0,2);

    if(!orders.length){

      overviewOrdersList.innerHTML = `
      <div class="empty-box">
      Sin pedidos recientes
      </div>
      `;

      return;

    }

    overviewOrdersList.innerHTML = orders.map(order => `

      <article class="order-card">

        <div class="order-top">

          <div>

            <h3>Pedido #${order.id}</h3>
            <p>${order.customer.fullName}</p>

          </div>

          <span class="tag">${order.status}</span>

        </div>

        <div>Total $${order.total}</div>

      </article>

    `).join("");

  }

  /* =====================================================
     BOTONES SEGUN ESTADO
  ===================================================== */

  function getButtons(order){

    if(order.status === "pendiente"){

      return `
      <button class="mini-btn accept" data-id="${order.id}" data-action="aceptado">
      Aceptar
      </button>
      `;

    }

    if(order.status === "aceptado"){

      return `
      <button class="mini-btn secondary" data-id="${order.id}" data-action="preparando">
      Preparando
      </button>
      `;

    }

    if(order.status === "preparando"){

      return `
      <button class="mini-btn secondary" data-id="${order.id}" data-action="listo">
      Listo
      </button>
      `;

    }

    if(order.status === "listo"){

      return `
      <button class="mini-btn secondary" data-id="${order.id}" data-action="finalizado">
      Finalizar
      </button>
      `;

    }

    return "";

  }

  /* =====================================================
     RENDER PEDIDOS
  ===================================================== */

  function renderOrders(){

    if(!restaurantOrdersList) return;

    const orders = getFilteredOrders();

    if(!orders.length){

      restaurantOrdersList.innerHTML = `
      <div class="empty-box">
      No hay pedidos
      </div>
      `;

      return;

    }

    restaurantOrdersList.innerHTML = orders.map(order => {

      const items = order.items.map(item => `
      <div>
      ${item.name} x${item.qty}
      </div>
      `).join("");

      return `

      <article class="order-card">

        <div class="order-top">

          <div>

            <h3>Pedido #${order.id}</h3>
            <p>${order.customer.fullName}</p>

          </div>

          <span class="tag">${order.status}</span>

        </div>

        <div>${items}</div>

        <div>Total $${order.total}</div>

        <div>${order.customer.address}</div>

        <div class="order-actions">

        ${getButtons(order)}

        </div>

      </article>

      `;

    }).join("");

    bindButtons();

  }

  /* =====================================================
     ACTUALIZAR ESTADO
  ===================================================== */

  async function updateStatus(id,status){

    try{

      await fetch(

        `${API_URL}/orders/${id}/status`,

        {

          method:"PATCH",

          headers:{ "Content-Type":"application/json" },

          body:JSON.stringify({status})

        }

      );

      loadOrders();

    }
    catch(err){

      console.error(err);

    }

  }

  /* =====================================================
     BIND BOTONES
  ===================================================== */

  function bindButtons(){

    document.querySelectorAll("[data-action]").forEach(btn => {

      btn.addEventListener("click", () => {

        const id = btn.dataset.id;
        const action = btn.dataset.action;

        updateStatus(id,action);

      });

    });

  }

  /* =====================================================
     RENDER GENERAL
  ===================================================== */

  function renderAll(){

    renderStats();
    renderOverviewOrders();
    renderOrders();

  }

  /* =====================================================
     FILTROS
  ===================================================== */

  orderSearchInput?.addEventListener("input",renderOrders);
  orderStatusFilter?.addEventListener("change",renderOrders);

  clearOrderFiltersBtn?.addEventListener("click",()=>{

    orderSearchInput.value="";
    orderStatusFilter.value="todos";

    renderOrders();

  });

  loadOrders();

});