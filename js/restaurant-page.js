/* ======================================================
   BHUZ
   restaurant-page.js

   Página pública del restaurante
   - Carga restaurante desde URL
   - Carga restaurante real desde backend cuando viene por email
   - NO usa almacenamiento del navegador como fuente de restaurantes, perfiles, estados, promociones ni platos
   - Carga platos reales
   - Muestra categorías
   - Maneja carrito
   - Abre panel de carrito
   - Abre checkout
   - Crea pedido DIRECTAMENTE en backend usando DELI_ORDERS
   - Permite entrar con addDish y abrir carrito automático
====================================================== */

document.addEventListener("DOMContentLoaded", () => {
  /* ======================================================
     BLOQUE 1
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
     BLOQUE 2
     CLAVES
  ====================================================== */
  // Restaurantes, platos, promociones, estados, sesión y pedidos deben venir del backend.
  const API_URL = "https://deligo-backend-i554.onrender.com";

  /* ======================================================
     BLOQUE 3
     URL Y ESTADO
  ====================================================== */
  const params = new URLSearchParams(window.location.search);
  const restaurantParam = normalizeText(params.get("restaurant"));
  const restaurantNameParam = normalizeText(params.get("name"));
  const restaurantIdParam = normalizeText(params.get("id"));
  const addDishParam = String(params.get("addDish") || "").trim();
  const addDishNameParam = String(params.get("addDishName") || "").trim();
  const addDishPriceParam = Number(params.get("addDishPrice") || 0);
  const openCartParam = String(params.get("openCart") || "").trim() === "1";

  let selectedRestaurant = null;
  let restaurantProfile = null;
  let restaurantPromotions = [];
  let restaurantDishes = [];
  let selectedCategory = "Todos";
  let cart = [];

  /* ======================================================
     BLOQUE 4
     HELPERS GENERALES
  ====================================================== */
  function safeParse(value, fallback = null) {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
  }

  function escapeHtml(text) {
    return String(text || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatPrice(value) {
    const amount = Number(value || 0);

    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  function getCurrentUserSafe() {
    if (typeof getCurrentUser === "function") {
      return getCurrentUser();
    }

    return window.DELI_CURRENT_USER || null;
  }

  function getProfilesMap() {
    // Backend puro: no leer perfiles desde almacenamiento del navegador.
    // Se conserva la función para no romper referencias internas existentes.
    return {};
  }

  function getStoreStatusMap() {
    // Backend puro: el estado abierto/cerrado debe venir del backend/JSON.
    // Se conserva la función para no romper referencias internas existentes.
    return {};
  }

  function getPromotionsMap() {
    // Backend puro: promociones deben venir del backend/JSON.
    // Se conserva la función para no romper referencias internas existentes.
    return {};
  }

  function getDishesMap() {
    // Backend puro: platos deben venir de /restaurants/:email/dishes.
    // Se conserva la función para no romper referencias internas existentes.
    return {};
  }

  function getAllRestaurants() {
    // Backend puro: no mezclar restaurantes semilla/locales ni cuentas del navegador.
    // Se conserva la función para no romper referencias internas existentes.
    return [];
  }

  function getRestaurantKey(restaurant) {
    return normalizeText(
      restaurant?.email || restaurant?.id || restaurant?.name || ""
    );
  }

  /* ======================================================
     BLOQUE 5
     BUSCAR RESTAURANTE
  ====================================================== */
  async function fetchRestaurantFromBackend() {
    /*
      Backend puro:
      - Si la URL trae ?restaurant=email, intenta primero la ruta directa.
      - Si la URL trae ?id=... o ?name=..., consulta /restaurants y filtra en backend data.
      - NO usa almacenamiento del navegador ni datos semilla como respaldo.
    */
    try {
      if (restaurantParam) {
        const response = await fetch(
          `${API_URL}/restaurants/${encodeURIComponent(restaurantParam)}?t=${Date.now()}`
        );

        if (response.ok) {
          const data = await response.json();

          if (data && data.ok === true && data.restaurant) {
            return data.restaurant;
          }
        }
      }

      const listResponse = await fetch(`${API_URL}/restaurants?t=${Date.now()}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        }
      });

      if (!listResponse.ok) return null;

      const listData = await listResponse.json();
      const restaurants = Array.isArray(listData)
        ? listData
        : Array.isArray(listData.restaurants)
          ? listData.restaurants
          : [];

      return restaurants.find((restaurant) => {
        const email = normalizeText(restaurant.email);
        const name = normalizeText(restaurant.name);
        const id = normalizeText(restaurant.id);

        return (
          (restaurantParam && email === restaurantParam) ||
          (restaurantParam && id === restaurantParam) ||
          (restaurantParam && name === restaurantParam) ||
          (restaurantNameParam && name === restaurantNameParam) ||
          (restaurantIdParam && id === restaurantIdParam) ||
          (restaurantIdParam && email === restaurantIdParam)
        );
      }) || null;
    } catch (error) {
      console.warn("No se pudo obtener el restaurante desde backend:", error);
      return null;
    }
  }

  function findRestaurantLocalFallback() {
    // Desactivado por regla nueva del proyecto:
    // ningún restaurante debe cargarse desde almacenamiento del navegador ni datos locales.
    // Si el backend no devuelve el restaurante, se muestra error real.
    return null;
  }

  async function findRestaurant() {
    const restaurantFromBackend = await fetchRestaurantFromBackend();

    if (restaurantFromBackend) {
      return restaurantFromBackend;
    }

    return findRestaurantLocalFallback();
  }

  function getRestaurantProfile(restaurant) {
    // Backend puro: el perfil visible sale del restaurante recibido desde server.js/JSON.
    return {
      name: restaurant?.name || "Restaurante",
      address: restaurant?.address || "Punto Fijo",
      email: restaurant?.email || "",
      phone: restaurant?.phone || "",
      description: restaurant?.description || "",
      category: restaurant?.category || restaurant?.type || "Comida",
      bannerText: restaurant?.bannerText || ""
    };
  }

  function getRestaurantOpenStatus(restaurant) {
    // Backend puro: no usar deliRestaurantStatus de almacenamiento del navegador.
    // Si el backend no tiene campo abierto/cerrado, se asume abierto para no romper la venta.
    const status = String(restaurant?.status || "approved").toLowerCase();

    if (restaurant?.isOpen === false || restaurant?.open === false) return false;
    if (["closed", "cerrado", "inactive", "blocked"].includes(status)) return false;

    return true;
  }

  function getRestaurantPromotions(restaurant) {
    // Backend puro: promociones solo desde el objeto restaurante recibido del backend.
    const promos = Array.isArray(restaurant?.promotions) ? restaurant.promotions : [];

    return promos.filter(
      (promo) => String(promo.status || "active").toLowerCase() !== "inactive"
    );
  }

  /* ======================================================
     BLOQUE 6
     PLATOS DEL RESTAURANTE
  ====================================================== */
  function normalizeDish(dish, restaurant) {
    return {
      id: String(dish.id || Date.now()),
      name: String(dish.name || "Producto").trim(),
      description: String(dish.description || dish.desc || "").trim(),
      price: Number(dish.price || 0),
      category: String(dish.category || "Otros").trim(),
      emoji: String(dish.emoji || "🍽️").trim(),
      available: dish.available !== false,
      restaurantEmail: normalizeText(
        dish.restaurantEmail || restaurant?.email || ""
      ),
      restaurantName: dish.restaurantName || restaurant?.name || "Restaurante"
    };
  }

  async function fetchDishesFromBackend(restaurant) {
    // CAMBIO: backend puro conectado a Render.
    // En cualquier dispositivo el menú debe cargar desde el backend real.
    // No se usa almacenamiento del navegador como respaldo de platos.
    try {
      const email = normalizeText(restaurant?.email);

      if (!email) {
        return [];
      }

      const response = await fetch(
        `${API_URL}/restaurants/${encodeURIComponent(email)}/dishes?t=${Date.now()}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json"
          }
        }
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();

      if (Array.isArray(data)) {
        return data;
      }

      if (data && Array.isArray(data.dishes)) {
        return data.dishes;
      }

      return [];
    } catch (error) {
      console.warn("No se pudieron cargar platos desde backend:", error);
      return [];
    }
  }

  function getRestaurantDishes(restaurant) {
    // Backend puro: no leer platos desde deliRestaurantDishes/almacenamiento del navegador.
    // Se permite únicamente un menú que venga dentro del propio objeto restaurante del backend,
    // para no romper compatibilidad si server.js/JSON ya trae restaurant.menu.
    let dishes = [];

    if (Array.isArray(restaurant?.menu)) {
      dishes = restaurant.menu.map((dish) => ({
        id: dish.id,
        name: dish.name,
        description: dish.description || dish.desc || "",
        price: dish.price,
        category: dish.category || restaurant.category || "Otros",
        emoji: dish.emoji || "🍽️",
        available: true,
        restaurantEmail: restaurant.email || "",
        restaurantName: restaurant.name || "Restaurante"
      }));
    }

    return dishes
      .map((dish) => normalizeDish(dish, restaurant))
      .filter((dish) => dish.available !== false);
  }

  /* ======================================================
     BLOQUE 7
     CABECERA DEL RESTAURANTE
  ====================================================== */
  function renderRestaurantHeader() {
    if (!selectedRestaurant) return;

    const isOpen = getRestaurantOpenStatus(selectedRestaurant);

    const displayName =
      restaurantProfile?.name || selectedRestaurant.name || "Restaurante";

    const displayAddress =
      restaurantProfile?.address || selectedRestaurant.address || "Punto Fijo";

    const displayCategory =
      restaurantProfile?.category || selectedRestaurant.category || "Comida";

    if (restaurantNameEl) {
      restaurantNameEl.textContent = displayName;
    }

    if (restaurantMetaEl) {
      restaurantMetaEl.textContent = `${displayCategory} · ${displayAddress} · ${isOpen ? "Abierto" : "Cerrado"}`;
    }
  }

  /* ======================================================
     BLOQUE 8
     PROMOCIONES
  ====================================================== */
  function renderPromotions() {
    if (!promotionsEl) return;

    if (!restaurantPromotions.length) {
      promotionsEl.innerHTML = `
        <div class="promo-card">
          <div class="promo-title">🔥 Sin promociones activas</div>
          <div class="promo-text">Este restaurante aún no tiene promociones publicadas.</div>
        </div>
      `;
      return;
    }

    promotionsEl.innerHTML = restaurantPromotions.map((promo) => `
      <div class="promo-card">
        <div class="promo-title">${escapeHtml(promo.title || "Promoción")}</div>
        <div class="promo-text">${escapeHtml(promo.description || promo.value || "Promoción activa")}</div>
      </div>
    `).join("");
  }

  /* ======================================================
     BLOQUE 9
     CATEGORÍAS
  ====================================================== */
  function getCategories() {
    const set = new Set(["Todos"]);

    restaurantDishes.forEach((dish) => {
      const category = String(dish.category || "").trim();
      if (category) set.add(category);
    });

    return [...set];
  }

  function renderCategories() {
    if (!categoriesEl) return;

    const categories = getCategories();

    categoriesEl.innerHTML = categories.map((category) => `
      <button
        type="button"
        class="cat ${selectedCategory === category ? "active" : ""}"
        data-category="${escapeHtml(category)}"
      >
        ${escapeHtml(category)}
      </button>
    `).join("");

    categoriesEl.querySelectorAll("[data-category]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedCategory = button.dataset.category || "Todos";
        renderCategories();
        renderMenu();
      });
    });
  }

  /* ======================================================
     BLOQUE 10
     CARRITO
  ====================================================== */
  function addToCart(dishId) {
    const dish = restaurantDishes.find(
      (item) => String(item.id) === String(dishId)
    );
    if (!dish) return false;

    const existing = cart.find(
      (item) => String(item.id) === String(dish.id)
    );

    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({
        id: dish.id,
        name: dish.name,
        price: Number(dish.price || 0),
        qty: 1
      });
    }

    renderMenu();
    renderCart();
    renderCartPanel();
    return true;
  }

  function addToCartFromDishData(dishData) {
    // Fallback seguro para platos que vienen desde ranking con un ID antiguo.
    // No toca el menú: solo permite construir el carrito con el nombre/precio
    // del pedido real cuando no se consigue el ID actual del plato.
    if (!dishData || !dishData.name) return false;

    const safeId = String(dishData.id || `auto-${Date.now()}`).trim();
    const safeName = String(dishData.name || "Producto").trim();
    const safePrice = Number(dishData.price || 0);

    const existing = cart.find((item) => {
      return (
        String(item.id) === safeId ||
        normalizeText(item.name) === normalizeText(safeName)
      );
    });

    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({
        id: safeId,
        name: safeName,
        price: safePrice,
        qty: 1
      });
    }

    renderMenu();
    renderCart();
    renderCartPanel();
    return true;
  }

  function removeFromCart(dishId) {
    const existing = cart.find(
      (item) => String(item.id) === String(dishId)
    );
    if (!existing) return;

    existing.qty -= 1;

    if (existing.qty <= 0) {
      cart = cart.filter((item) => String(item.id) !== String(dishId));
    }

    renderMenu();
    renderCart();
    renderCartPanel();
  }

  function renderCart() {
    if (!cartEl) return;

    const total = cart.reduce((sum, item) => sum + item.qty * item.price, 0);

    if (!cart.length) {
      cartEl.style.display = "none";
      cartEl.innerHTML = "";
      return;
    }

    cartEl.style.display = "block";
    cartEl.innerHTML = `🛒 Ver carrito • ${cart.reduce((sum, item) => sum + item.qty, 0)} producto(s) • ${formatPrice(total)}`;
  }

  function renderCartPanel() {
    if (!cartPanelEl) return;

    if (!cart.length) {
      cartPanelEl.style.display = "none";
      cartPanelEl.innerHTML = "";
      return;
    }

    const total = cart.reduce((sum, item) => sum + item.qty * item.price, 0);

    cartPanelEl.innerHTML = `
      <div class="cart-panel-header">
        <div class="cart-panel-title">Tu carrito</div>
        <button type="button" class="cart-close" id="closeCartPanelBtn">✕</button>
      </div>

      ${cart.map((item) => `
        <div class="cart-item">
          <div>
            <strong>${escapeHtml(item.name)}</strong><br>
            <small>${item.qty} x ${formatPrice(item.price)}</small>
          </div>

          <div class="actions">
            <button type="button" class="minus" data-minus-cart="${escapeHtml(item.id)}">-</button>
            <span class="counter">${item.qty}</span>
            <button type="button" class="add" data-add-cart="${escapeHtml(item.id)}">+</button>
          </div>
        </div>
      `).join("")}

      <div class="cart-total"><span>Total</span><strong>${formatPrice(total)}</strong></div>

      <button type="button" class="checkout-btn" id="goCheckoutBtn">Confirmar pedido</button>
      <button type="button" class="continue-btn" id="continueBuyingBtn">Seguir comprando</button>
    `;

    cartPanelEl.querySelector("#closeCartPanelBtn")?.addEventListener("click", () => {
      cartPanelEl.style.display = "none";
    });

    cartPanelEl.querySelector("#continueBuyingBtn")?.addEventListener("click", () => {
      cartPanelEl.style.display = "none";
    });

    cartPanelEl.querySelector("#goCheckoutBtn")?.addEventListener("click", openCheckout);

    cartPanelEl.querySelectorAll("[data-minus-cart]").forEach((button) => {
      button.addEventListener("click", () => {
        removeFromCart(button.dataset.minusCart);
      });
    });

    cartPanelEl.querySelectorAll("[data-add-cart]").forEach((button) => {
      button.addEventListener("click", () => {
        addToCart(button.dataset.addCart);
      });
    });
  }

  function openCartPanel() {
    if (!cart.length || !cartPanelEl) return;
    renderCartPanel();
    cartPanelEl.style.display = "block";
  }

  function cleanAutoCartParamsFromURL() {
    // Limpia los parámetros que vienen desde ranking/presupuesto.
    // Esto evita que, al refrescar o volver atrás después de confirmar,
    // el mismo plato se vuelva a agregar automáticamente al carrito.
    const cleanUrl = new URL(window.location.href);

    cleanUrl.searchParams.delete("addDish");
    cleanUrl.searchParams.delete("addDishName");
    cleanUrl.searchParams.delete("addDishPrice");
    cleanUrl.searchParams.delete("openCart");

    window.history.replaceState({}, document.title, cleanUrl.toString());
  }

  function autoAddDishFromURL() {
    // Si no viene ningún plato desde la URL, no hacemos nada.
    if (!addDishParam && !addDishNameParam) return;

    let added = false;
    let matchedDish = null;

    // 1) Intento por ID exacto.
    // Mantiene funcionando los platos que ya cargaban correctamente.
    if (addDishParam) {
      matchedDish = restaurantDishes.find((dish) => {
        return String(dish.id) === String(addDishParam);
      });

      if (matchedDish) {
        added = addToCart(matchedDish.id);
      }
    }

    // 2) Si el ID no coincide, buscamos por nombre exacto.
    // Esto corrige los platos del ranking cuando el pedido guardó un ID viejo.
    if (!added && addDishNameParam) {
      matchedDish = restaurantDishes.find((dish) => {
        return normalizeText(dish.name) === normalizeText(addDishNameParam);
      });

      if (matchedDish) {
        added = addToCart(matchedDish.id);
      }
    }

    // 3) Si todavía no entra, buscamos por nombre flexible.
    // Cubre diferencias pequeñas en espacios, mayúsculas o textos incompletos.
    if (!added && addDishNameParam) {
      matchedDish = restaurantDishes.find((dish) => {
        const dishName = normalizeText(dish.name);
        const urlName = normalizeText(addDishNameParam);

        return dishName.includes(urlName) || urlName.includes(dishName);
      });

      if (matchedDish) {
        added = addToCart(matchedDish.id);
      }
    }

    // 4) Fallback final y controlado.
    // Si el ranking trae un plato que existe en pedidos pero no coincide con el menú actual,
    // igual agregamos al carrito el nombre y precio reales enviados por restaurants.js.
    // Esto evita que los primeros platos fallen mientras se normalizan los IDs del backend.
    if (!added && addDishNameParam) {
      added = addToCartFromDishData({
        id: addDishParam || `ranking-${Date.now()}`,
        name: addDishNameParam,
        price: addDishPriceParam
      });
    }

    // 5) Limpiar URL para que el carrito no se vuelva a llenar después de confirmar,
    // refrescar o volver atrás.
    cleanAutoCartParamsFromURL();

    // 6) Si se agregó correctamente y la URL pidió abrir carrito, lo abrimos.
    if (added && openCartParam) {
      setTimeout(() => {
        openCartPanel();
      }, 150);
    }

    // 7) Debug seguro si algún caso todavía falla.
    if (!added) {
      console.warn("No se pudo agregar el plato desde ranking/presupuesto:", {
        addDishParam,
        addDishNameParam,
        addDishPriceParam,
        restaurantDishes
      });
    }
  }

  /* ======================================================
     BLOQUE 11
     MENÚ
  ====================================================== */
  function renderMenu() {
    if (!menuEl) return;

    const visibleDishes =
      selectedCategory === "Todos"
        ? restaurantDishes
        : restaurantDishes.filter((dish) => dish.category === selectedCategory);

    if (!visibleDishes.length) {
      menuEl.innerHTML = `
        <div class="empty-box">
          Este restaurante aún no tiene platos disponibles.
        </div>
      `;
      return;
    }

    menuEl.innerHTML = visibleDishes.map((dish) => {
      const qty =
        cart.find((item) => String(item.id) === String(dish.id))?.qty || 0;

      return `
        <div class="item">
          <div class="dish-visual">${escapeHtml(dish.emoji || "🍽️")}</div>

          <div class="info">
            <div class="title">${escapeHtml(dish.name)}</div>
            <div class="desc">${escapeHtml(dish.description || "Sin descripción")}</div>
            <div class="price"><strong>${formatPrice(dish.price)}</strong></div>
          </div>

          <div class="actions">
            <button type="button" class="minus" data-minus="${escapeHtml(dish.id)}">-</button>
            <span class="counter">${qty}</span>
            <button type="button" class="add" data-add="${escapeHtml(dish.id)}">+</button>
          </div>
        </div>
      `;
    }).join("");

    menuEl.querySelectorAll("[data-add]").forEach((button) => {
      button.addEventListener("click", () => {
        addToCart(button.dataset.add);
      });
    });

    menuEl.querySelectorAll("[data-minus]").forEach((button) => {
      button.addEventListener("click", () => {
        removeFromCart(button.dataset.minus);
      });
    });
  }

  /* ======================================================
     BLOQUE 12
     CHECKOUT
  ====================================================== */
  function fillCheckoutUserData() {
    const currentUser = getCurrentUserSafe();
    if (!currentUser) return;

    if (checkoutName) {
      checkoutName.value = currentUser.fullName || currentUser.name || "";
    }

    if (checkoutPhone) {
      checkoutPhone.value = currentUser.phone || "";
    }

    if (checkoutAddress) {
      checkoutAddress.value = currentUser.address || "";
    }

    if (checkoutEmail) {
      checkoutEmail.value = currentUser.email || "";
    }
  }

  function openCheckout() {
    if (!checkoutModal || !cart.length) return;

    fillCheckoutUserData();

    if (checkoutOrderSummary) {
      checkoutOrderSummary.innerHTML = cart.map((item) => `
        <div class="checkout-item">
          <span>${escapeHtml(item.name)} x${item.qty}</span>
          <strong>${formatPrice(item.qty * item.price)}</strong>
        </div>
      `).join("");
    }

    const total = cart.reduce((sum, item) => sum + item.qty * item.price, 0);

    if (checkoutTotal) {
      checkoutTotal.textContent = `Total: ${formatPrice(total)}`;
    }

    checkoutModal.style.display = "flex";

    if (cartPanelEl) {
      cartPanelEl.style.display = "none";
    }
  }

  window.closeCheckout = function () {
    if (checkoutModal) {
      checkoutModal.style.display = "none";
    }
  };

  /* ======================================================
     BLOQUE 13
     GUARDAR PEDIDO SOLO EN BACKEND
  ====================================================== */
  async function saveOrder(order) {
    if (!window.DELI_ORDERS || typeof window.DELI_ORDERS.createOrder !== "function") {
      console.error("DELI_ORDERS no está disponible.");
      return null;
    }

    try {
      const createdOrder = await window.DELI_ORDERS.createOrder(order);

      if (!createdOrder) {
        console.error("El backend no devolvió un pedido válido.");
        return null;
      }

      return createdOrder;
    } catch (error) {
      console.error("Error creando pedido en backend:", error);
      return null;
    }
  }

  /* ======================================================
     BLOQUE 14
     ENVIAR PEDIDO
  ====================================================== */
  async function handleCheckoutSubmit(event) {
    event.preventDefault();

    if (!selectedRestaurant || !cart.length) {
      alert("No hay productos en el carrito.");
      return;
    }

    const currentUser = getCurrentUserSafe();

    const finalCustomerName =
      checkoutName?.value.trim() || currentUser?.fullName || currentUser?.name || "";
    const finalCustomerPhone =
      checkoutPhone?.value.trim() || currentUser?.phone || "";
    const finalCustomerAddress =
      checkoutAddress?.value.trim() || currentUser?.address || "";
    const finalCustomerEmail =
      checkoutEmail?.value.trim() || currentUser?.email || "";

    if (!finalCustomerName || !finalCustomerPhone || !finalCustomerAddress || !finalCustomerEmail) {
      alert("Completa nombre, teléfono, dirección y correo para confirmar el pedido.");
      return;
    }

    const restaurantEmail =
      normalizeText(
        selectedRestaurant.email ||
        restaurantProfile?.email ||
        selectedRestaurant.restaurantEmail ||
        ""
      ) || getRestaurantKey(selectedRestaurant);

    const restaurantDisplayName =
      restaurantProfile?.name || selectedRestaurant.name || "Restaurante";

    const order = {
      id: "DL-" + Date.now(),
      restaurantEmail,
      restaurantName: restaurantDisplayName,
      restaurant: {
        email: restaurantEmail,
        name: restaurantDisplayName,
        id: selectedRestaurant.id || ""
      },
      items: cart.map((item) => ({
        id: item.id,
        name: item.name,
        qty: item.qty,
        price: Number(item.price || 0),
        subtotal: Number(item.qty || 0) * Number(item.price || 0)
      })),
      total: cart.reduce((sum, item) => sum + item.qty * item.price, 0),
      status: "pendiente",
      paymentMethod: "pendiente",
      notes: "",
      createdAt: new Date().toISOString(),
      date: new Date().toLocaleDateString("es-CL"),
      time: new Date().toLocaleTimeString("es-CL", {
        hour: "2-digit",
        minute: "2-digit"
      }),
      customer: {
        fullName: finalCustomerName,
        phone: finalCustomerPhone,
        address: finalCustomerAddress,
        email: finalCustomerEmail
      }
    };

    console.log("Pedido enviado al backend:", order);

    const created = await saveOrder(order);

    if (!created) {
      alert("No se pudo guardar el pedido en el backend. Revisa que el servidor esté encendido.");
      return;
    }

    cart = [];
    cleanAutoCartParamsFromURL();
    renderMenu();
    renderCart();
    renderCartPanel();

    if (cartPanelEl) {
      cartPanelEl.style.display = "none";
      cartPanelEl.innerHTML = "";
    }

    window.closeCheckout();

    alert("Pedido confirmado correctamente");

    /*
      BHUZ LIVE EXPERIENCE
      En vez de enviar al usuario a mis-pedidos,
      regresamos al index con el ID del pedido creado para activar:
      - popup global
      - tarjeta LIVE
      - campanita activa
      - tracking persistente
    */
    const createdOrderId = encodeURIComponent(created.id || order.id || "");
    window.location.href = `index.html?orderSuccess=1&orderId=${createdOrderId}`;
  }

  /* ======================================================
     BLOQUE 15
     INICIO
  ====================================================== */
  async function init() {
    selectedRestaurant = await findRestaurant();

    if (!selectedRestaurant) {
      if (menuEl) {
        menuEl.innerHTML = `
          <div class="empty-box">
            No se encontró el restaurante.
          </div>
        `;
      }
      return;
    }

    restaurantProfile = getRestaurantProfile(selectedRestaurant);
    restaurantPromotions = getRestaurantPromotions(selectedRestaurant);

    // CAMBIO: backend puro.
    // Primero intentamos cargar los platos reales desde backend.
    // Si el backend no devuelve platos, solo se permite restaurant.menu si viene desde backend.
    // No se usa almacenamiento del navegador como respaldo.
    const backendDishes = await fetchDishesFromBackend(selectedRestaurant);

    if (Array.isArray(backendDishes) && backendDishes.length) {
      restaurantDishes = backendDishes
        .map((dish) => normalizeDish(dish, selectedRestaurant))
        .filter((dish) => dish.available !== false);
    } else {
      restaurantDishes = getRestaurantDishes(selectedRestaurant);
    }

    renderRestaurantHeader();
    renderPromotions();
    renderCategories();
    renderMenu();
    renderCart();
    renderCartPanel();
    fillCheckoutUserData();
    autoAddDishFromURL();
  }

  /* ======================================================
     BLOQUE 16
     EVENTOS
  ====================================================== */
  cartEl?.addEventListener("click", openCartPanel);

  checkoutForm?.addEventListener("submit", handleCheckoutSubmit);

  restoreAddressBtn?.addEventListener("click", () => {
    fillCheckoutUserData();
  });

  checkoutModal?.addEventListener("click", (event) => {
    if (event.target === checkoutModal) {
      window.closeCheckout();
    }
  });

  init();
});

































































































































































