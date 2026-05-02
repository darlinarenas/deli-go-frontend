/* ======================================================
   DELI - restaurant-page.js
   Página pública del restaurante
   - Carga restaurante, perfil, promociones y platos
   - Controla carrito y checkout
   - Guarda pedido localmente
   - Envía pedido al backend
====================================================== */

document.addEventListener("DOMContentLoaded", () => {

  /* ======================================================
     ELEMENTOS DEL DOM
  ====================================================== */
  const restaurantNameEl = document.getElementById("restaurantName");
  const restaurantMetaEl = document.getElementById("restaurantMeta");
  const menuEl = document.getElementById("menu");
  const categoriesEl = document.getElementById("menuCategories");
  const promotionsEl = document.getElementById("restaurantPromotions");
  const cartEl = document.getElementById("cart");
  const cartPanelEl = document.getElementById("cartPanel");

  const checkoutModal = document.getElementById("checkoutModal");
  const checkoutForm = document.getElementById("checkoutForm");
  const checkoutName = document.getElementById("checkoutName");
  const checkoutPhone = document.getElementById("checkoutPhone");
  const checkoutAddress = document.getElementById("checkoutAddress");
  const checkoutEmail = document.getElementById("checkoutEmail");
  const checkoutOrderSummary = document.getElementById("checkoutOrderSummary");
  const checkoutTotal = document.getElementById("checkoutTotal");
  const restoreAddressBtn = document.getElementById("restoreAddressBtn");

  /* ======================================================
     CONFIGURACIÓN
  ====================================================== */
  const API_URL = "http://localhost:3000";

  const urlParams = new URLSearchParams(window.location.search);
  const restaurantParam = (urlParams.get("restaurant") || "").toLowerCase().trim();
  const restaurantNameParam = (urlParams.get("name") || "").toLowerCase().trim();

  const PROFILE_KEY = "deliRestaurantProfiles";
  const STORE_STATUS_KEY = "deliRestaurantStatus";
  const PROMOTIONS_KEY = "deliRestaurantPromotions";
  const DISHES_KEY = "deliRestaurantDishes";
  const CURRENT_USER_KEY = "deliCurrentUser";
  const ORDERS_KEY = "deliOrders";
  const LEGACY_ORDERS_KEY = "orders";

  /* ======================================================
     ESTADO DE LA PÁGINA
  ====================================================== */
  let selectedRestaurant = null;
  let restaurantProfile = null;
  let restaurantPromotions = [];
  let restaurantDishes = [];
  let selectedCategory = "Todos";
  let cart = [];

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

  function formatPrice(value) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function escapeHtml(text) {
    return String(text || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  /* ======================================================
     USUARIO ACTUAL
  ====================================================== */
  function getCurrentUserSafe() {
    if (typeof getCurrentUser === "function") return getCurrentUser();
    return safeParse(localStorage.getItem(CURRENT_USER_KEY), null);
  }

  /* ======================================================
     LECTURA DE MAPAS LOCALES
  ====================================================== */
  function getProfilesMap() {
    return safeParse(localStorage.getItem(PROFILE_KEY), {}) || {};
  }

  function getStoreStatusMap() {
    return safeParse(localStorage.getItem(STORE_STATUS_KEY), {}) || {};
  }

  function getPromotionsMap() {
    return safeParse(localStorage.getItem(PROMOTIONS_KEY), {}) || {};
  }

  function getDishesMap() {
    return safeParse(localStorage.getItem(DISHES_KEY), {}) || {};
  }

  /* ======================================================
     IDENTIFICADORES Y NORMALIZACIÓN
  ====================================================== */
  function getRestaurantIdentifier(restaurant) {
    return (restaurant?.email || restaurant?.id || restaurant?.name || "")
      .toString()
      .toLowerCase()
      .trim();
  }

  function normalizeDish(dish, fallbackRestaurant) {
    return {
      id: dish.id || Date.now().toString(),
      name: dish.name || "Producto",
      description: dish.description || "",
      price: Number(dish.price || 0),
      category: dish.category || "Otros",
      emoji: dish.emoji || "🍽️",
      prepTime: dish.prepTime || "",
      available: dish.available !== false,
      restaurantName: dish.restaurantName || fallbackRestaurant?.name || "",
      restaurantEmail: (dish.restaurantEmail || fallbackRestaurant?.email || "").toLowerCase().trim(),
      restaurantAddress: dish.restaurantAddress || fallbackRestaurant?.address || ""
    };
  }

  /* ======================================================
     OBTENER RESTAURANTES DISPONIBLES
  ====================================================== */
  function getAllRestaurants() {
    if (window.DELI_DB?.restaurants && Array.isArray(window.DELI_DB.restaurants)) {
      return window.DELI_DB.restaurants;
    }

    const restaurantAccounts =
      safeParse(localStorage.getItem("deliRestaurantAccounts"), []) || [];

    const restaurantUsers =
      safeParse(localStorage.getItem("deliRestaurants"), []) || [];

    return [...restaurantAccounts, ...restaurantUsers];
  }

  /* ======================================================
     BUSCAR RESTAURANTE ACTUAL
  ====================================================== */
  function findRestaurant() {
    const restaurants = getAllRestaurants();

    let found = restaurants.find((restaurant) => {
      const email = (restaurant.email || "").toLowerCase().trim();
      const name = (restaurant.name || "").toLowerCase().trim();

      return (
        (restaurantParam && email === restaurantParam) ||
        (restaurantNameParam && name === restaurantNameParam)
      );
    });

    if (!found) {
      const profilesMap = getProfilesMap();
      const profileKey = Object.keys(profilesMap).find((key) => {
        const profile = profilesMap[key];
        const email = (profile?.email || "").toLowerCase().trim();
        const name = (profile?.name || "").toLowerCase().trim();

        return (
          (restaurantParam && email === restaurantParam) ||
          (restaurantNameParam && name === restaurantNameParam) ||
          (restaurantParam && key === restaurantParam)
        );
      });

      if (profileKey) {
        const profile = profilesMap[profileKey];
        found = {
          id: profileKey,
          name: profile.name || "Restaurante",
          email: profile.email || profileKey,
          address: profile.address || "Punto Fijo",
          category: profile.category || "Comida rápida"
        };
      }
    }

    return found;
  }

  /* ======================================================
     PERFIL, PROMOCIONES Y PLATOS DEL RESTAURANTE
  ====================================================== */
  function getProfileForRestaurant(restaurant) {
    const profilesMap = getProfilesMap();
    const key = getRestaurantIdentifier(restaurant);

    return profilesMap[key] || {
      name: restaurant?.name || "Restaurante",
      address: restaurant?.address || "Punto Fijo",
      email: restaurant?.email || "",
      phone: "",
      description: "",
      category: restaurant?.category || "Comida rápida",
      bannerText: "Las mejores opciones del local"
    };
  }

  function getPromotionsForRestaurant(restaurant) {
    const promotionsMap = getPromotionsMap();
    const key = getRestaurantIdentifier(restaurant);
    const list = promotionsMap[key] || [];
    return list.filter((promo) => promo.status === "active");
  }

  function getDishesForRestaurant(restaurant) {
    const dishesMap = getDishesMap();
    const key = getRestaurantIdentifier(restaurant);

    const localDishes = (dishesMap[key] || [])
      .map((dish) => normalizeDish(dish, restaurant))
      .filter((dish) => dish.available !== false);

    if (localDishes.length) {
      return localDishes;
    }

    if (window.DELI_DB?.dishes && Array.isArray(window.DELI_DB.dishes)) {
      return window.DELI_DB.dishes
        .filter((dish) => {
          const dishRestaurantEmail = (dish.restaurantEmail || "").toLowerCase().trim();
          const dishRestaurantName = (dish.restaurantName || "").toLowerCase().trim();
          const currentEmail = (restaurant.email || "").toLowerCase().trim();
          const currentName = (restaurant.name || "").toLowerCase().trim();

          return dishRestaurantEmail === currentEmail || dishRestaurantName === currentName;
        })
        .map((dish) => normalizeDish(dish, restaurant))
        .filter((dish) => dish.available !== false);
    }

    return [];
  }

  function isRestaurantOpen(restaurant) {
    const statusMap = getStoreStatusMap();
    const key = (restaurant?.email || "").toLowerCase().trim();
    return statusMap[key] !== false;
  }

  /* ======================================================
     RENDER CABECERA DEL RESTAURANTE
  ====================================================== */
  function renderRestaurantHeader() {
    if (!selectedRestaurant) return;

    const profile = restaurantProfile;
    const open = isRestaurantOpen(selectedRestaurant);

    if (restaurantNameEl) {
      restaurantNameEl.textContent = profile.name || selectedRestaurant.name || "Restaurante";
    }

    if (restaurantMetaEl) {
      restaurantMetaEl.textContent = profile.address || selectedRestaurant.address || "Punto Fijo";
    }

    const badges = document.querySelectorAll(".hero-badge");
    if (badges.length >= 4) {
      badges[0].textContent = profile.address || selectedRestaurant.address || "Punto Fijo";
      badges[2].textContent = open ? "🛵 Delivery" : "🔴 Cerrado";
    }
  }

  /* ======================================================
     RENDER PROMOCIONES
  ====================================================== */
  function renderPromotions() {
    if (!promotionsEl) return;

    if (!restaurantPromotions.length) {
      promotionsEl.innerHTML = `
        <div class="promo-card">
          <div class="promo-title">🔥 Promociones</div>
          <div class="promo-text">Este restaurante aún no tiene promociones activas.</div>
        </div>
      `;
      return;
    }

    promotionsEl.innerHTML = restaurantPromotions.map((promo) => `
      <div class="promo-card">
        <div class="promo-title">${escapeHtml(promo.title || "Promoción")}</div>
        <div class="promo-text">${escapeHtml(promo.description || promo.value || "")}</div>
      </div>
    `).join("");
  }

  /* ======================================================
     CATEGORÍAS DEL MENÚ
  ====================================================== */
  function getCategoriesFromDishes(dishes) {
    const set = new Set();
    dishes.forEach((dish) => {
      set.add((dish.category || "Otros").trim());
    });
    return ["Todos", ...Array.from(set)];
  }

  function renderCategories() {
    if (!categoriesEl) return;

    const categories = getCategoriesFromDishes(restaurantDishes);

    categoriesEl.innerHTML = categories.map((category) => `
      <button
        type="button"
        class="cat ${selectedCategory === category ? "active" : ""}"
        data-category="${escapeHtml(category)}"
      >
        ${escapeHtml(category)}
      </button>
    `).join("");

    categoriesEl.querySelectorAll(".cat").forEach((button) => {
      button.addEventListener("click", () => {
        selectedCategory = button.dataset.category || "Todos";
        renderCategories();
        renderMenu();
      });
    });
  }

  function getFilteredDishes() {
    if (selectedCategory === "Todos") return restaurantDishes;

    return restaurantDishes.filter(
      (dish) => (dish.category || "Otros").trim() === selectedCategory
    );
  }

  /* ======================================================
     CARRITO
  ====================================================== */
  function getCartQty(productId) {
    const item = cart.find((cartItem) => String(cartItem.id) === String(productId));
    return item ? item.qty : 0;
  }

  function addToCart(dish) {
    const existing = cart.find((item) => String(item.id) === String(dish.id));

    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({
        id: dish.id,
        name: dish.name,
        price: Number(dish.price || 0),
        qty: 1,
        emoji: dish.emoji || "🍽️"
      });
    }

    renderMenu();
    updateCartUI();
  }

  function removeFromCart(dishId) {
    const existing = cart.find((item) => String(item.id) === String(dishId));
    if (!existing) return;

    existing.qty -= 1;

    if (existing.qty <= 0) {
      cart = cart.filter((item) => String(item.id) !== String(dishId));
    }

    renderMenu();
    updateCartUI();
  }

  /* ======================================================
     RENDER MENÚ
  ====================================================== */
  function renderMenu() {
    if (!menuEl) return;

    const filteredDishes = getFilteredDishes();

    if (!filteredDishes.length) {
      menuEl.innerHTML = `
        <div class="item">
          <div class="info">
            <div class="title">Sin productos</div>
            <div class="desc">No hay platos disponibles en esta categoría.</div>
          </div>
        </div>
      `;
      return;
    }

    menuEl.innerHTML = filteredDishes.map((dish) => {
      const qty = getCartQty(dish.id);

      return `
        <article class="item">
          <div class="info">
            <div class="title">${escapeHtml(dish.emoji || "🍽️")} ${escapeHtml(dish.name)}</div>
            <div class="desc">${escapeHtml(dish.description || "")}</div>
            <div class="price">
              <strong>Precio:</strong> ${formatPrice(dish.price)}
              &nbsp;&nbsp;
              <strong>Categoría:</strong> ${escapeHtml(dish.category || "Otros")}
              &nbsp;&nbsp;
              <strong>Tiempo:</strong> ${escapeHtml(dish.prepTime || "-")}
            </div>
          </div>

          <div class="actions">
            <button class="minus" type="button" data-id="${escapeHtml(dish.id)}">-</button>
            <div class="counter">${qty}</div>
            <button class="add" type="button" data-id="${escapeHtml(dish.id)}">+</button>
          </div>
        </article>
      `;
    }).join("");

    menuEl.querySelectorAll(".add").forEach((button) => {
      button.addEventListener("click", () => {
        const dish = restaurantDishes.find((item) => String(item.id) === String(button.dataset.id));
        if (dish) addToCart(dish);
      });
    });

    menuEl.querySelectorAll(".minus").forEach((button) => {
      button.addEventListener("click", () => {
        removeFromCart(button.dataset.id);
      });
    });
  }

  /* ======================================================
     UI DEL CARRITO
  ====================================================== */
  function updateCartUI() {
    const totalItems = cart.reduce((acc, item) => acc + item.qty, 0);
    const totalPrice = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);

    if (!cartEl) return;

    if (totalItems === 0) {
      cartEl.style.display = "none";
      if (cartPanelEl) {
        cartPanelEl.style.display = "none";
        cartPanelEl.innerHTML = "";
      }
      return;
    }

    cartEl.style.display = "block";
    cartEl.innerHTML = `Ver carrito • ${formatPrice(totalPrice)}`;

    renderCartPanel();
  }

  function renderCartPanel() {
    if (!cartPanelEl) return;

    if (!cart.length) {
      cartPanelEl.innerHTML = "";
      cartPanelEl.style.display = "none";
      return;
    }

    const itemsHtml = cart.map((item) => `
      <div class="cart-item">
        <span>${escapeHtml(item.emoji || "🍽️")} ${escapeHtml(item.name)} x${item.qty}</span>
        <strong>${formatPrice(item.price * item.qty)}</strong>
      </div>
    `).join("");

    const totalPrice = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);

    cartPanelEl.innerHTML = `
      <div class="cart-panel-header">
        <div class="cart-panel-title">Tu carrito</div>
        <button class="cart-close" id="closeCartPanelBtn" type="button">×</button>
      </div>

      ${itemsHtml}

      <div class="cart-total">
        <span>Total</span>
        <strong>${formatPrice(totalPrice)}</strong>
      </div>

      <div class="cart-actions">
        <button class="continue-btn" id="continueShoppingBtn" type="button">Seguir comprando</button>
        <button class="checkout-btn" id="openCheckoutBtn" type="button">Continuar pedido</button>
      </div>
    `;

    document.getElementById("closeCartPanelBtn")?.addEventListener("click", () => {
      cartPanelEl.style.display = "none";
    });

    document.getElementById("continueShoppingBtn")?.addEventListener("click", () => {
      cartPanelEl.style.display = "none";
    });

    document.getElementById("openCheckoutBtn")?.addEventListener("click", () => {
      cartPanelEl.style.display = "none";
      openCheckout();
    });
  }

  /* ======================================================
     CHECKOUT
  ====================================================== */
  function fillCheckoutUserData() {
    const currentUser = getCurrentUserSafe();
    if (!currentUser) return;

    if (checkoutName && !checkoutName.value) {
      checkoutName.value = currentUser.fullName || currentUser.name || "";
    }

    if (checkoutPhone && !checkoutPhone.value) {
      checkoutPhone.value = currentUser.phone || "";
    }

    if (checkoutAddress && !checkoutAddress.value) {
      checkoutAddress.value = currentUser.address || "";
    }

    if (checkoutEmail && !checkoutEmail.value) {
      checkoutEmail.value = currentUser.email || "";
    }
  }

  function renderCheckoutSummary() {
    if (!checkoutOrderSummary || !checkoutTotal) return;

    checkoutOrderSummary.innerHTML = cart.map((item) => `
      <div class="checkout-item">
        <span>${escapeHtml(item.name)} x${item.qty}</span>
        <strong>${formatPrice(item.price * item.qty)}</strong>
      </div>
    `).join("");

    const totalPrice = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    checkoutTotal.textContent = `Total: ${formatPrice(totalPrice)}`;
  }

  function openCheckout() {
    if (!cart.length) return;

    fillCheckoutUserData();
    renderCheckoutSummary();

    if (checkoutModal) {
      checkoutModal.style.display = "flex";
    }
  }

  window.closeCheckout = function () {
    if (checkoutModal) {
      checkoutModal.style.display = "none";
    }
  };

  /* ======================================================
     PEDIDOS LOCALES Y LEGACY
  ====================================================== */
  function getStoredOrders() {
    return safeParse(localStorage.getItem(ORDERS_KEY), []) || [];
  }

  function setStoredOrders(orders) {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  }

  function getLegacyOrders() {
    return safeParse(localStorage.getItem(LEGACY_ORDERS_KEY), []) || [];
  }

  function setLegacyOrders(orders) {
    localStorage.setItem(LEGACY_ORDERS_KEY, JSON.stringify(orders));
  }

  function writeOrderToAllStores(order) {
    const deliOrders = getStoredOrders();
    deliOrders.unshift(order);
    setStoredOrders(deliOrders);

    const legacyOrders = getLegacyOrders();
    legacyOrders.unshift(order);
    setLegacyOrders(legacyOrders);

    if (window.DELI_DB) {
      if (!Array.isArray(window.DELI_DB.orders)) {
        window.DELI_DB.orders = [];
      }
      window.DELI_DB.orders.unshift(order);
    }
  }

  /* ======================================================
     API GLOBAL DE PEDIDOS
     Compatibilidad con otras vistas del sistema
  ====================================================== */
  function ensureOrdersApi() {
    window.DELI_ORDERS = {
      createOrder(orderData) {
        writeOrderToAllStores(orderData);
        return orderData;
      },

      getOrdersByRestaurant(restaurantEmail) {
        const email = String(restaurantEmail || "").toLowerCase().trim();
        return getStoredOrders().filter(
          (order) => String(order.restaurantEmail || "").toLowerCase().trim() === email
        );
      },

      getOrdersByCustomer(customerEmail) {
        const email = String(customerEmail || "").toLowerCase().trim();
        return getStoredOrders().filter(
          (order) => String(order.customer?.email || "").toLowerCase().trim() === email
        );
      },

      updateOrderStatus(orderId, newStatus) {
        const updated = getStoredOrders().map((order) => {
          if (String(order.id) === String(orderId)) {
            return { ...order, status: newStatus };
          }
          return order;
        });

        setStoredOrders(updated);
        setLegacyOrders(updated);

        if (window.DELI_DB && Array.isArray(window.DELI_DB.orders)) {
          window.DELI_DB.orders = updated;
        }
      }
    };
  }

  /* ======================================================
     GUARDAR PEDIDO
     1) Envía al backend
     2) Guarda localmente para compatibilidad
  ====================================================== */
  async function saveOrder(orderData) {
    const normalizedOrder = {
      id: orderData.id,
      restaurantEmail: String(orderData.restaurantEmail || "").toLowerCase().trim(),
      restaurantName: orderData.restaurantName || "",
      items: Array.isArray(orderData.items) ? orderData.items : [],
      total: Number(orderData.total || 0),
      status: orderData.status || "pendiente",
      date: orderData.date || "",
      time: orderData.time || "",
      createdAt: orderData.createdAt || new Date().toISOString(),
      customer: {
        fullName: orderData.customer?.fullName || "",
        phone: orderData.customer?.phone || "",
        address: orderData.customer?.address || "",
        email: String(orderData.customer?.email || "").toLowerCase().trim()
      }
    };

    try {
      const response = await fetch(`${API_URL}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(normalizedOrder)
      });

      if (!response.ok) {
        throw new Error(`Error backend: ${response.status}`);
      }

      console.log("Pedido enviado al backend");
    } catch (error) {
      console.warn("No se pudo enviar el pedido al backend:", error);
    }

    writeOrderToAllStores(normalizedOrder);
    return normalizedOrder;
  }

  /* ======================================================
     ENVIAR CHECKOUT
  ====================================================== */
  async function handleCheckoutSubmit(event) {
    event.preventDefault();

    if (!selectedRestaurant || !cart.length) return;

    const currentUser = getCurrentUserSafe();

    const order = {
      id: "DL-" + Date.now(),
      restaurantEmail: (selectedRestaurant.email || "").toLowerCase().trim(),
      restaurantName: restaurantProfile?.name || selectedRestaurant.name || "Restaurante",
      items: cart.map((item) => ({
        id: item.id,
        name: item.name,
        qty: item.qty,
        price: item.price,
        subtotal: item.qty * item.price
      })),
      total: cart.reduce((acc, item) => acc + (item.price * item.qty), 0),
      status: "pendiente",
      date: new Date().toLocaleDateString("es-VE"),
      time: new Date().toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" }),
      createdAt: new Date().toISOString(),
      customer: {
        fullName: checkoutName?.value.trim() || currentUser?.fullName || currentUser?.name || "",
        phone: checkoutPhone?.value.trim() || currentUser?.phone || "",
        address: checkoutAddress?.value.trim() || currentUser?.address || "",
        email: checkoutEmail?.value.trim() || currentUser?.email || ""
      }
    };

    if (!order.customer.fullName || !order.customer.phone || !order.customer.address) {
      alert("Completa nombre, teléfono y dirección para confirmar el pedido.");
      return;
    }

    const savedOrder = await saveOrder(order);

    cart = [];
    updateCartUI();
    renderMenu();
    window.closeCheckout();

    console.log("Pedido guardado:", savedOrder);
    alert("Pedido confirmado correctamente.");

    window.location.href = "mis-pedidos.html";
  }

  /* ======================================================
     EVENTOS ESTÁTICOS
  ====================================================== */
  function bindStaticEvents() {
    if (cartEl) {
      cartEl.addEventListener("click", () => {
        if (!cart.length || !cartPanelEl) return;

        const isOpen = cartPanelEl.style.display === "block";
        cartPanelEl.style.display = isOpen ? "none" : "block";
      });
    }

    if (checkoutForm) {
      checkoutForm.addEventListener("submit", handleCheckoutSubmit);
    }

    if (restoreAddressBtn) {
      restoreAddressBtn.addEventListener("click", () => {
        const currentUser = getCurrentUserSafe();
        if (currentUser && checkoutAddress) {
          checkoutAddress.value = currentUser.address || "";
        }
      });
    }

    if (checkoutModal) {
      checkoutModal.addEventListener("click", (event) => {
        if (event.target === checkoutModal) {
          window.closeCheckout();
        }
      });
    }
  }

  /* ======================================================
     INICIALIZACIÓN
  ====================================================== */
  function init() {
    ensureOrdersApi();

    selectedRestaurant = findRestaurant();

    if (!selectedRestaurant) {
      if (restaurantNameEl) restaurantNameEl.textContent = "Restaurante no encontrado";
      if (restaurantMetaEl) restaurantMetaEl.textContent = "No fue posible cargar este restaurante.";
      if (menuEl) {
        menuEl.innerHTML = `
          <div class="item">
            <div class="info">
              <div class="title">No disponible</div>
              <div class="desc">No se encontró la información del restaurante.</div>
            </div>
          </div>
        `;
      }
      return;
    }

    restaurantProfile = getProfileForRestaurant(selectedRestaurant);
    restaurantPromotions = getPromotionsForRestaurant(selectedRestaurant);
    restaurantDishes = getDishesForRestaurant(selectedRestaurant);

    renderRestaurantHeader();
    renderPromotions();
    renderCategories();
    renderMenu();
    updateCartUI();
    bindStaticEvents();
    fillCheckoutUserData();
  }

  init();
});