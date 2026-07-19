/* ======================================================
   DELI - restaurants.js
   Página principal de restaurantes conectada al backend
   - Lee restaurantes reales desde https://deligo-backend-i554.onrender.com
   - Oculta restaurantes cerrados usando estado del panel
   - Mantiene búsqueda, categorías y navegación
   - Renderiza Top 6 restaurantes más pedidos calculado por backend
   - Renderiza Top 6 platos más pedidos calculado por backend
   - CORREGIDO 02-05-2026: no usa almacenamiento del navegador para restaurantes/estados
====================================================== */

/* ==========================================
   CONFIGURACIÓN
========================================== */
/*
  CAMBIO REALIZADO:
conectar frontend con backend
  https://deligo-backend-i554.onrender.com

  Por eso se agregó API_URL como base y luego se construyen los endpoints correctos.
*/
const API_URL = window.DELI_API_URL || "https://deligo-backend-i554.onrender.com";
const RESTAURANTS_API_URL = `${API_URL}/restaurants`;
const ORDERS_API_URL = `${API_URL}/orders`;
const TOP_RESTAURANTS_API_URL = `${API_URL}/stats/top-restaurants`;
const TOP_DISHES_API_URL = `${API_URL}/stats/top-dishes`;

/* ==========================================
   REFERENCIAS DEL HTML
========================================== */
const list = document.getElementById("restaurantList");
const categoryContainer = document.getElementById("categories");
const searchInput = document.querySelector(".search");
const topRestaurantsContainer = document.getElementById("topRestaurants");
const topRestaurantsSection = document.getElementById("topRestaurantsSection");
const topDishesContainer = document.getElementById("topDishes");
const topDishesSection = document.getElementById("topDishesSection");
const smartResultCard = document.getElementById("smartResultCard");
const smartResultTitle = document.getElementById("smartResultTitle");
const smartResultText = document.getElementById("smartResultText");
const smartResultEmoji = document.getElementById("smartResultEmoji");
const quickOfferCard = document.getElementById("quickOfferCard");
const quickOfferTitle = document.getElementById("quickOfferTitle");
const quickOfferText = document.getElementById("quickOfferText");
const quickOfferBtn = document.getElementById("quickOfferBtn");
const allRestaurantsSection = document.getElementById("allRestaurantsSection");
const allRestaurantsTitle = document.getElementById("allRestaurantsTitle");
const allRestaurantsHint = document.getElementById("allRestaurantsHint");

/* ==========================================
   COMPATIBILIDAD CON OTROS ARCHIVOS
========================================== */
let restaurants = [];
let cats = [];
let active = "Todos";
let allOrders = [];
let allDishes = [];
let topRestaurantsFromBackend = [];
let topDishesFromBackend = [];
let topRestaurantsLabel = "registrado";
let topDishesLabel = "registrado";

window.restaurants = restaurants;
window.cats = cats;
window.allDishes = allDishes;

/* ==========================================
   HELPERS
========================================== */
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


function getCategoryEmoji(category) {
  const value = normalizeText(category);

  if (value.includes("pollo")) return "🍗";
  if (value.includes("empanada")) return "🥟";
  if (value.includes("hamburg")) return "🍔";
  if (value.includes("pizza")) return "🍕";
  if (value.includes("bebida") || value.includes("pepsi") || value.includes("refresco")) return "🥤";
  if (value.includes("huevo")) return "🥚";
  if (value.includes("pan")) return "🥖";
  if (value.includes("queso")) return "🧀";
  if (value.includes("perro")) return "🌭";
  if (value.includes("sushi")) return "🍣";
  if (value.includes("postre")) return "🍰";
  if (value === "todos") return "▦";

  return "🍽️";
}

function getActiveSearchText() {
  return searchInput ? normalizeText(searchInput.value) : "";
}

function getActiveContextLabel() {
  const text = getActiveSearchText();

  if (text) return text;
  if (active && active !== "Todos") return active;

  return "";
}

function hasActiveDiscoveryContext() {
  return Boolean(getActiveContextLabel());
}

function restaurantMatchesContext(restaurant) {
  const context = normalizeText(getActiveContextLabel());

  if (!context) return true;

  const matchRestaurant =
    normalizeText(restaurant.name).includes(context) ||
    normalizeText(restaurant.type).includes(context) ||
    normalizeText(restaurant.category).includes(context) ||
    normalizeText(restaurant.address).includes(context);

  const matchDishes = (restaurant.dishes || []).some((dish) => {
    return (
      normalizeText(dish.name).includes(context) ||
      normalizeText(dish.description).includes(context) ||
      normalizeText(dish.category).includes(context)
    );
  });

  return matchRestaurant || matchDishes;
}

function getPopularDishesForContext(limit = 8) {
  const context = normalizeText(getActiveContextLabel());

  let source = [];

  if (context) {
    source = allDishes.filter((dish) => {
      return (
        normalizeText(dish.name).includes(context) ||
        normalizeText(dish.description).includes(context) ||
        normalizeText(dish.category).includes(context) ||
        normalizeText(dish.restaurantName).includes(context)
      );
    });
  } else {
    source = allDishes.slice();
  }

  return source
    .map((dish) => ({
      ...dish,
      weeklySales: getDishWeeklySales(dish.restaurantEmail, dish)
    }))
    .sort((a, b) => {
      const salesDiff = Number(b.weeklySales || 0) - Number(a.weeklySales || 0);
      if (salesDiff !== 0) return salesDiff;
      return Number(b.price || 0) - Number(a.price || 0);
    })
    .slice(0, limit);
}

function updateSmartContextUI(filteredRestaurants = []) {
  const label = getActiveContextLabel();
  const hasContext = Boolean(label);

  if (smartResultCard) {
    smartResultCard.style.display = hasContext ? "flex" : "none";
  }

  if (quickOfferCard) {
    quickOfferCard.style.display = hasContext ? "grid" : "none";
  }

  if (!hasContext) {
    if (allRestaurantsSection) allRestaurantsSection.classList.remove("is-secondary");
    if (allRestaurantsTitle) allRestaurantsTitle.textContent = "Restaurantes disponibles";
    if (allRestaurantsHint) allRestaurantsHint.textContent = "Explorar";
    return;
  }

  const prettyLabel = label.charAt(0).toUpperCase() + label.slice(1);

  if (smartResultTitle) {
    smartResultTitle.textContent = `Mostrando restaurantes y platos de: ${prettyLabel}`;
  }

  if (smartResultText) {
    smartResultText.textContent = `${filteredRestaurants.length} restaurante(s) relacionado(s). Todo lo importante aparece primero para evitar scroll innecesario.`;
  }

  if (smartResultEmoji) {
    smartResultEmoji.textContent = getCategoryEmoji(prettyLabel);
  }

  if (quickOfferTitle) {
    quickOfferTitle.textContent = `Ofertas en ${prettyLabel}`;
  }

  if (quickOfferText) {
    quickOfferText.textContent = "Espacio listo para promociones, campañas pagadas o platos destacados por anunciante.";
  }

  if (quickOfferBtn) {
    quickOfferBtn.onclick = () => {
      alert("Aquí conectaremos promociones reales y campañas patrocinadas por categoría más adelante.");
    };
  }

  if (allRestaurantsSection) allRestaurantsSection.classList.add("is-secondary");
  if (allRestaurantsTitle) allRestaurantsTitle.textContent = `Más restaurantes relacionados con ${prettyLabel}`;
  if (allRestaurantsHint) allRestaurantsHint.textContent = "Menú completo";
}

function bindDishOrderButtons(container) {
  if (!container) return;

  container.querySelectorAll("button[data-dish-id], button[data-dish-name]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();

      const restaurantEmail = encodeURIComponent(button.dataset.restaurantEmail || "");
      const dishId = encodeURIComponent(button.dataset.dishId || "");
      const dishName = encodeURIComponent(button.dataset.dishName || "");
      const dishPrice = encodeURIComponent(button.dataset.dishPrice || "0");

      if (!restaurantEmail || (!dishId && !dishName)) return;

      window.location.href =
        `restaurant.html?restaurant=${restaurantEmail}&addDish=${dishId}&addDishName=${dishName}&addDishPrice=${dishPrice}&openCart=1`;
    });
  });
}

/* ==========================================
   ESTADO DEL RESTAURANTE DESDE BACKEND
   IMPORTANTE:
   - Este archivo NO usa almacenamiento del navegador como fuente de datos.
   - El estado abierto/cerrado debe venir del backend/JSON.
   - Si el backend no envía estado de apertura, asumimos abierto para
     no romper restaurantes antiguos ya aprobados.
========================================== */
function getRestaurantOpenStatus(restaurant) {
  const openValue = restaurant?.open;
  const isOpenValue = restaurant?.isOpen;
  const storeStatus = normalizeText(restaurant?.storeStatus || restaurant?.availability || "");

  if (openValue === false || isOpenValue === false) return false;

  if (["closed", "cerrado", "inactive", "inactivo", "disabled", "bloqueado"].includes(storeStatus)) {
    return false;
  }

  return true;
}

function getDefaultCategory(restaurant) {
  return (
    restaurant.category ||
    restaurant.type ||
    "Comida"
  );
}

function isWithinLast7Days(order) {
  const baseDate = order?.createdAt ? new Date(order.createdAt) : null;
  if (!baseDate || Number.isNaN(baseDate.getTime())) return false;

  const now = new Date();
  const diff = now.getTime() - baseDate.getTime();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  return diff >= 0 && diff <= sevenDays;
}

function getOrdersForRanking() {
  const weeklyOrders = allOrders.filter(isWithinLast7Days);

  if (weeklyOrders.length) {
    return {
      orders: weeklyOrders,
      label: "esta semana"
    };
  }

  return {
    orders: allOrders,
    label: "registrado"
  };
}

/* ==========================================
   MAPEO DE RESTAURANTE BACKEND
========================================== */
function mapBackendRestaurant(restaurant, index) {
  const category = getDefaultCategory(restaurant);

  return {
    id: restaurant.id || `backend-${index + 1}`,
    name: restaurant.name || "Restaurante",
    type: restaurant.type || category,
    category: category,
    rating: restaurant.rating || "Nuevo",
    delivery: restaurant.delivery || "A convenir",
    time: restaurant.time || "20-40 min",
    popular: Boolean(restaurant.popular),
    email: normalizeText(restaurant.email || ""),
    address: restaurant.address || "Punto Fijo",
    phone: restaurant.phone || "",
    open: getRestaurantOpenStatus(restaurant),
    status: String(restaurant.status || "pending").trim().toLowerCase()
  };
}

/* ==========================================
   CARGAR DATOS DESDE BACKEND
========================================== */
async function fetchRestaurantsFromBackend() {
  const response = await fetch(`${RESTAURANTS_API_URL}?t=${Date.now()}`, {
    method: "GET",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Error HTTP ${response.status}`);
  }

  const data = await response.json();

  if (Array.isArray(data)) {
    return data;
  }

  if (data && Array.isArray(data.restaurants)) {
    return data.restaurants;
  }

  return [];
}

async function fetchOrdersFromBackend() {
  try {
    const response = await fetch(`${ORDERS_API_URL}?t=${Date.now()}`, {
      method: "GET",
      cache: "no-store",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      }
    });

    /*
      La lista pública de restaurantes no puede depender de /orders.
      Esa ruta ahora está protegida para administradores; un 401/403 no debe
      vaciar restaurantes ni platos del inicio. Los pedidos solo se usan como
      apoyo opcional para rankings antiguos.
    */
    if (!response.ok) {
      console.warn(`Ranking local de pedidos omitido (HTTP ${response.status}).`);
      return [];
    }

    const data = await response.json();

    if (Array.isArray(data)) {
      return data;
    }

    if (data && Array.isArray(data.orders)) {
      return data.orders;
    }

    return [];
  } catch (error) {
    console.warn("Ranking local de pedidos omitido:", error);
    return [];
  }
}

async function fetchTopRestaurantsFromBackend() {
  try {
    const response = await fetch(`${TOP_RESTAURANTS_API_URL}?t=${Date.now()}`, {
      method: "GET",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      return { restaurants: [], label: "registrado" };
    }

    const data = await response.json();

    return {
      restaurants: Array.isArray(data?.restaurants) ? data.restaurants : [],
      label: data?.label || "registrado"
    };
  } catch (error) {
    console.warn("No se pudo cargar ranking de restaurantes desde backend:", error);
    return { restaurants: [], label: "registrado" };
  }
}

async function fetchTopDishesFromBackend() {
  try {
    const response = await fetch(`${TOP_DISHES_API_URL}?t=${Date.now()}`, {
      method: "GET",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      return { dishes: [], label: "registrado" };
    }

    const data = await response.json();

    return {
      dishes: Array.isArray(data?.dishes) ? data.dishes : [],
      label: data?.label || "registrado"
    };
  } catch (error) {
    console.warn("No se pudo cargar ranking de platos desde backend:", error);
    return { dishes: [], label: "registrado" };
  }
}

/* ==========================================
   CARGAR PLATOS DESDE BACKEND
   IMPORTANTE:
   - No reemplaza la lógica existente.
   - Solo agrega los platos al restaurante para poder buscarlos en el index.
   - Si el backend falla, devuelve [] y el index sigue funcionando.
========================================== */
async function fetchDishesByRestaurant(email) {
  const normalizedEmail = normalizeText(email);

  if (!normalizedEmail) {
    return [];
  }

  try {
    /*
      CAMBIO REALIZADO:
     para conectar bachend a fronted 
      https://deligo-backend-i554.onrender.com/restaurants/email@restaurante.com/dishes
    */
    const response = await fetch(
      `${API_URL}/restaurants/${encodeURIComponent(normalizedEmail)}/dishes?t=${Date.now()}`,
      {
        method: "GET",
        cache: "no-store",
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
    console.warn("No se pudieron cargar platos del restaurante:", normalizedEmail, error);
    return [];
  }
}

function normalizeDishForIndex(dish, restaurant) {
  return {
    id: String(dish?.id || "").trim(),
    name: String(dish?.name || "Plato").trim(),
    description: String(dish?.description || dish?.desc || "").trim(),
    category: String(dish?.category || restaurant?.category || "Comida").trim(),
    price: Number(dish?.price || 0),
    emoji: String(dish?.emoji || "🍽️").trim(),
    available: dish?.available !== false,
    restaurantEmail: restaurant?.email || dish?.restaurantEmail || "",
    restaurantName: restaurant?.name || dish?.restaurantName || "Restaurante"
  };
}

function getDishWeeklySales(restaurantEmail, dish) {
  const normalizedRestaurantEmail = normalizeText(restaurantEmail);
  const normalizedDishId = String(dish?.id || "").trim();
  const normalizedDishName = normalizeText(dish?.name);

  let total = 0;

  const rankingData = getOrdersForRanking();

  rankingData.orders
    .forEach((order) => {
      const orderRestaurantEmail = normalizeText(order.restaurantEmail || order.restaurant?.email || "");

      if (orderRestaurantEmail !== normalizedRestaurantEmail) return;

      const items = Array.isArray(order.items) ? order.items : [];

      items.forEach((item) => {
        const itemId = String(item.id || "").trim();
        const itemName = normalizeText(item.name);
        const qty = Number(item.qty || 0);

        const sameDish =
          (normalizedDishId && itemId && itemId === normalizedDishId) ||
          (normalizedDishName && itemName && itemName === normalizedDishName);

        if (sameDish && qty > 0) {
          total += qty;
        }
      });
    });

  return total;
}

function getMatchingDishesForRestaurant(restaurant) {
  const text = searchInput ? normalizeText(searchInput.value) : "";
  const dishes = Array.isArray(restaurant?.dishes) ? restaurant.dishes : [];

  if (!text && active === "Todos") {
    return [];
  }

  return dishes
    .filter((dish) => {
      const matchesText = !text || (
        normalizeText(dish.name).includes(text) ||
        normalizeText(dish.description).includes(text) ||
        normalizeText(dish.category).includes(text)
      );

      const matchesCategory =
        active === "Todos" ||
        normalizeText(dish.category) === normalizeText(active);

      return matchesText && matchesCategory;
    })
    .map((dish) => ({
      ...dish,
      weeklySales: getDishWeeklySales(restaurant.email, dish)
    }))
    .sort((a, b) => b.weeklySales - a.weeklySales);
}

function renderMatchingDishesSummary(restaurant) {
  const matches = getMatchingDishesForRestaurant(restaurant).slice(0, 2);

  if (!matches.length) {
    return "";
  }

  return `
    <div style="margin-top:10px;padding:10px;background:#fff5f5;border-radius:12px;font-size:13px;line-height:1.45;">
      <strong>Platos encontrados:</strong><br>
      ${matches.map((dish) => `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:7px;">
          <span>
            ${escapeHtml(dish.emoji || "🍽️")} ${escapeHtml(dish.name)}
            ${dish.weeklySales > 0 ? ` · ${dish.weeklySales} vendido(s)` : ""}
          </span>
          <button
            type="button"
            class="budget-btn index-dish-order-btn"
            style="padding:6px 10px;font-size:12px;margin:0;white-space:nowrap;"
            data-dish-id="${escapeHtml(dish.id)}"
            data-dish-name="${escapeHtml(dish.name)}"
            data-dish-price="${escapeHtml(dish.price)}"
            data-restaurant-email="${escapeHtml(restaurant.email)}"
          >
            Pedir
          </button>
        </div>
      `).join("")}
      <div style="margin-top:9px;font-size:12px;color:#9ca3af;line-height:1.35;">
        Mostrando máximo 2 opciones. Entra al restaurante para ver el menú completo.
      </div>
    </div>
  `;
}

function getRestaurantSearchScore(restaurant) {
  const text = searchInput ? normalizeText(searchInput.value) : "";
  const matchingDishes = getMatchingDishesForRestaurant(restaurant);

  if (!text) {
    return matchingDishes.length;
  }

  let score = 0;

  if (normalizeText(restaurant.name).includes(text)) score += 80;
  if (normalizeText(restaurant.type).includes(text)) score += 40;
  if (normalizeText(restaurant.category).includes(text)) score += 30;
  if (normalizeText(restaurant.address).includes(text)) score += 10;

  matchingDishes.forEach((dish) => {
    const dishName = normalizeText(dish.name);
    const dishCategory = normalizeText(dish.category);
    const dishDescription = normalizeText(dish.description);

    if (dishName === text) score += 120;
    else if (dishName.startsWith(text)) score += 90;
    else if (dishName.includes(text)) score += 70;

    if (dishCategory === text) score += 60;
    else if (dishCategory.includes(text)) score += 35;

    if (dishDescription.includes(text)) score += 15;

    score += Number(dish.weeklySales || 0) * 5;
  });

  return score;
}

async function refreshRestaurantData() {
  const [
    backendRestaurants,
    backendOrders,
    backendTopRestaurants,
    backendTopDishes
  ] = await Promise.all([
    fetchRestaurantsFromBackend(),
    fetchOrdersFromBackend(),
    fetchTopRestaurantsFromBackend(),
    fetchTopDishesFromBackend()
  ]);

  allOrders = Array.isArray(backendOrders) ? backendOrders : [];

  topRestaurantsFromBackend = Array.isArray(backendTopRestaurants?.restaurants)
    ? backendTopRestaurants.restaurants
    : [];

  topRestaurantsLabel = backendTopRestaurants?.label || "registrado";

  topDishesFromBackend = Array.isArray(backendTopDishes?.dishes)
    ? backendTopDishes.dishes
    : [];

  topDishesLabel = backendTopDishes?.label || "registrado";

  /*
    CONTROL ADMINISTRATIVO SEGURO Y COMPATIBLE:
    - Si el backend trae status, solo mostramos los aprobados.
    - Si el backend NO trae status, lo tratamos como restaurante antiguo/activo
      para no vaciar el index ni romper restaurantes ya existentes.
    - Pending, blocked, rejected, inactive y disabled NO se muestran.
  */
  const approvedRestaurants = backendRestaurants.filter((restaurant) => {
    const rawStatus = restaurant && restaurant.status != null
      ? String(restaurant.status).trim().toLowerCase()
      : "";

    if (!rawStatus) return true;

    return rawStatus === "approved" || rawStatus === "active";
  });

  const mappedRestaurants = approvedRestaurants.map(mapBackendRestaurant);

  const restaurantsWithDishes = await Promise.all(
    mappedRestaurants.map(async (restaurant) => {
      const backendDishes = await fetchDishesByRestaurant(restaurant.email);

      const dishes = backendDishes
        .map((dish) => normalizeDishForIndex(dish, restaurant))
        .filter((dish) => dish.available !== false);

      return {
        ...restaurant,
        dishes
      };
    })
  );

  restaurants = restaurantsWithDishes.filter((restaurant) => restaurant.open);

  allDishes = restaurants.flatMap((restaurant) => {
    return (restaurant.dishes || []).map((dish) => ({
      ...dish,
      restaurantEmail: restaurant.email,
      restaurantName: restaurant.name
    }));
  });

  const categorySet = new Set(["Todos"]);

  restaurants.forEach((restaurant) => {
    if (restaurant.category) {
      categorySet.add(restaurant.category);
    }

    (restaurant.dishes || []).forEach((dish) => {
      if (dish.category) {
        categorySet.add(dish.category);
      }
    });
  });

  cats = [...categorySet].filter((category) => category !== "Todos");

  window.restaurants = restaurants;
  window.cats = cats;
  window.allDishes = allDishes;
}

/* ==========================================
   RENDER DE CATEGORÍAS
========================================== */
function renderCategories() {
  if (!categoryContainer) return;

  categoryContainer.innerHTML = "";

  ["Todos", ...cats].forEach((category) => {
    const button = document.createElement("button");
    button.textContent = category;
    button.className = "category-btn";
    button.setAttribute("data-category-emoji", getCategoryEmoji(category));

    if (category === active) {
      button.classList.add("active");
    }

    button.onclick = () => {
      active = category;

      if (searchInput && category !== "Todos") {
        searchInput.value = "";
      }

      updateRestaurants(true);
    };

    categoryContainer.appendChild(button);
  });
}

/* ==========================================
   RENDER TOP 6 RESTAURANTES SEMANAL
========================================== */
function renderTopRestaurants(filteredRestaurants = []) {
  if (!topRestaurantsContainer) return;

  const hasContext = hasActiveDiscoveryContext();
  const contextLabel = getActiveContextLabel();

  if (topRestaurantsSection) {
    topRestaurantsSection.style.display = "block";
  }

  if (topRestaurantsContainer) {
    topRestaurantsContainer.classList.add("horizontal-grid");
  }

  const source = hasContext
    ? filteredRestaurants.slice(0, 8)
    : (Array.isArray(topRestaurantsFromBackend) ? topRestaurantsFromBackend.slice(0, 8) : []);

  const title = topRestaurantsSection?.querySelector(".block-title-row h2");
  const more = topRestaurantsSection?.querySelector(".block-title-row span");

  if (title) {
    title.textContent = hasContext
      ? `Restaurantes que venden ${contextLabel.charAt(0).toUpperCase() + contextLabel.slice(1)}`
      : "Top restaurantes ⭐";
  }

  if (more) {
    more.textContent = "Ver todos";
  }

  if (!source.length) {
    topRestaurantsContainer.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        No encontramos restaurantes para esta búsqueda.
      </div>
    `;
    return;
  }

  topRestaurantsContainer.innerHTML = source.map((restaurant, index) => {
    const name = restaurant.name || "Restaurante";
    const email = restaurant.email || "";
    const type = restaurant.type || restaurant.category || "Comida";
    const orders = Number(restaurant.totalOrders || 0);
    const isAd = hasContext && index < 2;

    return `
      <div class="restaurant compact-result">
        ${isAd ? '<span class="ad-label">Anuncio</span>' : '<span class="popular-label">🔥 Popular</span>'}
        <b>${escapeHtml(name)}</b>
        <span class="restaurant-status status-open">🟢 Abierto</span>
        <span class="result-subtitle">
          ${escapeHtml(type)}<br>
          ${orders > 0 ? `🛒 ${orders} pedido(s) ${escapeHtml(topRestaurantsLabel)}<br>` : ""}
          ⭐ ${escapeHtml(restaurant.rating || "Nuevo")} · 🚚 ${escapeHtml(restaurant.delivery || "A convenir")} · ⏱ ${escapeHtml(restaurant.time || "20-40 min")}
        </span>
      </div>
    `;
  }).join("");

  Array.from(topRestaurantsContainer.children).forEach((card, index) => {
    const restaurant = source[index];
    if (!restaurant) return;

    card.addEventListener("click", () => {
      if (restaurant.email) {
        const restaurantName = encodeURIComponent(restaurant.name || "Restaurante");
        const restaurantEmail = encodeURIComponent(restaurant.email);

        window.location.href =
          `restaurant.html?restaurant=${restaurantEmail}&name=${restaurantName}`;
        return;
      }

      window.location.href = `restaurant.html?id=${encodeURIComponent(restaurant.id || "")}`;
    });
  });
}

/* ==========================================
   RENDER TOP / PLATOS POR CONTEXTO
========================================== */
function renderTopDishes() {
  if (!topDishesContainer) return;

  const hasContext = hasActiveDiscoveryContext();
  const contextLabel = getActiveContextLabel();

  if (topDishesSection) {
    topDishesSection.style.display = "block";
  }

  topDishesContainer.classList.add("horizontal-grid");

  const title = topDishesSection?.querySelector(".block-title-row h2");
  const more = topDishesSection?.querySelector(".block-title-row span");

  if (title) {
    title.textContent = hasContext
      ? `Platos populares en ${contextLabel.charAt(0).toUpperCase() + contextLabel.slice(1)}`
      : "Los más elegidos ⭐";
  }

  if (more) {
    more.textContent = "Ver todos";
  }

  let dishes = [];

  if (hasContext) {
    dishes = getPopularDishesForContext(8);
  } else {
    dishes = Array.isArray(topDishesFromBackend)
      ? topDishesFromBackend.slice(0, 8).map((dish) => ({
          id: dish.dishId || "",
          name: dish.dishName || "Plato",
          emoji: dish.dishEmoji || "🍽️",
          price: Number(dish.dishPrice || 0),
          restaurantEmail: dish.restaurantEmail || "",
          restaurantName: dish.restaurantName || "Restaurante",
          weeklySales: Number(dish.totalQty || 0)
        }))
      : [];
  }

  if (!dishes.length) {
    topDishesContainer.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        No encontramos platos populares para esta búsqueda.
      </div>
    `;
    return;
  }

  topDishesContainer.innerHTML = dishes.map((dish, index) => {
    const isPopular = index < 4;

    return `
      <div class="restaurant compact-result">
        <span class="popular-label">${isPopular ? "Popular" : "Recomendado"}</span>
        <b>${escapeHtml(dish.emoji || "🍽️")} ${escapeHtml(dish.name || "Plato")}</b>
        <span class="result-subtitle">
          📍 ${escapeHtml(dish.restaurantName || "Restaurante")}<br>
          ${Number(dish.weeklySales || 0) > 0 ? `🛒 ${Number(dish.weeklySales || 0)} pedido(s)<br>` : ""}
          ${Number(dish.price || 0) > 0 ? `💵 $${Number(dish.price || 0).toLocaleString("es-CL")}` : ""}
        </span>
        <button
          type="button"
          class="budget-btn"
          data-dish-id="${escapeHtml(dish.id || "")}" 
          data-dish-name="${escapeHtml(dish.name || "")}" 
          data-dish-price="${escapeHtml(dish.price || 0)}" 
          data-restaurant-email="${escapeHtml(dish.restaurantEmail || "")}" 
        >
          Pedir ahora
        </button>
      </div>
    `;
  }).join("");

  bindDishOrderButtons(topDishesContainer);
}

/* ==========================================
   RENDER DE RESTAURANTES
========================================== */
function renderRestaurants(data) {
  if (!list) return;

  list.innerHTML = "";

  if (!Array.isArray(data) || !data.length) {
    list.innerHTML = `
      <div style="grid-column: 1 / -1; background: white; padding: 20px; border-radius: 16px; text-align: center;">
        No se encontraron restaurantes abiertos.
      </div>
    `;
    return;
  }

  data.forEach((restaurant) => {
    const card = document.createElement("div");

    card.className = "restaurant";
    card.style.cursor = "pointer";

    card.innerHTML = `
      ${restaurant.popular ? '<div class="tag">🔥 Popular</div>' : ""}
      <b>${escapeHtml(restaurant.name)}</b><br>
      <span class="restaurant-status status-open">🟢 Abierto</span><br>
      ${escapeHtml(restaurant.type)}<br>
      ⭐ ${escapeHtml(restaurant.rating)} · 🚚 ${escapeHtml(restaurant.delivery)} · ⏱ ${escapeHtml(restaurant.time)}
      ${renderMatchingDishesSummary(restaurant)}
    `;

    card.onclick = () => {
      if (restaurant.email) {
        const restaurantName = encodeURIComponent(restaurant.name || "Restaurante");
        const restaurantEmail = encodeURIComponent(restaurant.email);

        window.location.href =
          `restaurant.html?restaurant=${restaurantEmail}&name=${restaurantName}`;
        return;
      }

      window.location.href = `restaurant.html?id=${encodeURIComponent(restaurant.id)}`;
    };

    list.appendChild(card);
  });

  list.querySelectorAll(".index-dish-order-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();

      const restaurantEmail = encodeURIComponent(button.dataset.restaurantEmail || "");
      const dishId = encodeURIComponent(button.dataset.dishId || "");
      const dishName = encodeURIComponent(button.dataset.dishName || "");
      const dishPrice = encodeURIComponent(button.dataset.dishPrice || "0");

      if (!restaurantEmail || (!dishId && !dishName)) return;

      window.location.href =
        `restaurant.html?restaurant=${restaurantEmail}&addDish=${dishId}&addDishName=${dishName}&addDishPrice=${dishPrice}&openCart=1`;
    });
  });
}

/* ==========================================
   FILTRO
========================================== */
function applyFilters() {
  let filtered = [...restaurants];

  if (active !== "Todos") {
    filtered = filtered.filter((restaurant) => {
      const matchRestaurantCategory =
        normalizeText(restaurant.category) === normalizeText(active);

      const matchDishCategory = (restaurant.dishes || []).some((dish) => {
        return normalizeText(dish.category) === normalizeText(active);
      });

      return matchRestaurantCategory || matchDishCategory;
    });
  }

  const text = searchInput
    ? normalizeText(searchInput.value)
    : "";

  if (text) {
    filtered = filtered.filter((restaurant) => {
      const matchRestaurant =
        normalizeText(restaurant.name).includes(text) ||
        normalizeText(restaurant.type).includes(text) ||
        normalizeText(restaurant.category).includes(text) ||
        normalizeText(restaurant.address).includes(text);

      const matchDishes = (restaurant.dishes || []).some((dish) => {
        return (
          normalizeText(dish.name).includes(text) ||
          normalizeText(dish.description).includes(text) ||
          normalizeText(dish.category).includes(text)
        );
      });

      return matchRestaurant || matchDishes;
    });

    filtered.sort((a, b) => {
      return getRestaurantSearchScore(b) - getRestaurantSearchScore(a);
    });
  }

  return filtered;
}

/* ==========================================
   ACTUALIZAR LISTADO
========================================== */
function updateRestaurants(shouldScroll = false) {
  const filteredRestaurants = applyFilters();

  renderCategories();
  updateSmartContextUI(filteredRestaurants);
  renderTopRestaurants(filteredRestaurants);
  renderTopDishes();
  renderRestaurants(filteredRestaurants);

  if (shouldScroll && hasActiveDiscoveryContext()) {
    setTimeout(() => {
      const target = smartResultCard || topRestaurantsSection || list;
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 80);
  }
}

/* ==========================================
   MENSAJES DE ESTADO
========================================== */
function renderLoadingState() {
  if (!list) return;

  list.innerHTML = `
    <div style="grid-column: 1 / -1; background: white; padding: 20px; border-radius: 16px; text-align: center;">
      Cargando restaurantes...
    </div>
  `;
}

function renderErrorState() {
  if (!list) return;

  list.innerHTML = `
    <div style="grid-column: 1 / -1; background: white; padding: 20px; border-radius: 16px; text-align: center;">
      No se pudieron cargar los restaurantes desde el backend.
    </div>
  `;

  if (topRestaurantsContainer) {
    topRestaurantsContainer.innerHTML = "";
  }

  if (topRestaurantsSection) {
    topRestaurantsSection.style.display = "none";
  }

  if (topDishesContainer) {
    topDishesContainer.innerHTML = "";
  }

  if (topDishesSection) {
    topDishesSection.style.display = "none";
  }
}

/* ==========================================
   EVENTOS
========================================== */
let bhuzSearchScrollTimer = null;

function scrollToRestaurantResultsAfterSearch() {
  const text = searchInput ? normalizeText(searchInput.value) : "";

  if (bhuzSearchScrollTimer) {
    clearTimeout(bhuzSearchScrollTimer);
  }

  if (!text || text.length < 2) return;

  bhuzSearchScrollTimer = setTimeout(() => {
    const target = smartResultCard || topRestaurantsSection || document.getElementById("restaurantList") || list;

    if (target) {
      target.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  }, 320);
}

if (searchInput) {
  searchInput.addEventListener("input", () => {
    updateRestaurants(true);
  });
}

/* ==========================================
   INICIALIZACIÓN
========================================== */
async function initRestaurantsPage() {
  renderLoadingState();

  try {
    await refreshRestaurantData();
    renderCategories();
    updateRestaurants();
  } catch (error) {
    console.error("Error cargando restaurantes desde backend:", error);
    restaurants = [];
    cats = [];
    allOrders = [];
    allDishes = [];
    topRestaurantsFromBackend = [];
    topDishesFromBackend = [];
    topRestaurantsLabel = "registrado";
    topDishesLabel = "registrado";
    window.restaurants = restaurants;
    window.cats = cats;
    window.allDishes = allDishes;
    renderCategories();
    renderErrorState();
  }
}

initRestaurantsPage();















































































































































































































































































































































































































































































































































































































































































































































































