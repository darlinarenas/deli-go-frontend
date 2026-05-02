/* ======================================================
   DELI - restaurants.js
   Página principal de restaurantes conectada al backend
   - Lee restaurantes reales desde http://localhost:3000/restaurants
   - Oculta restaurantes cerrados usando estado del panel
   - Mantiene búsqueda, categorías y navegación
   - Agrega Top 6 restaurantes más pedidos de la semana
   - Agrega Top 6 platos más pedidos de la semana
   - CORREGIDO 02-05-2026: no usa localStorage para restaurantes/estados
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

/* ==========================================
   COMPATIBILIDAD CON OTROS ARCHIVOS
========================================== */
let restaurants = [];
let cats = [];
let active = "Todos";
let allOrders = [];
let allDishes = [];

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

/* ==========================================
   ESTADO DEL RESTAURANTE DESDE BACKEND
   IMPORTANTE:
   - Este archivo NO usa localStorage como fuente de datos.
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
  const response = await fetch(`${ORDERS_API_URL}?t=${Date.now()}`, {
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

  if (data && Array.isArray(data.orders)) {
    return data.orders;
  }

  return [];
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

  allOrders
    .filter(isWithinLast7Days)
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
  const matches = getMatchingDishesForRestaurant(restaurant).slice(0, 4);

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
  const [backendRestaurants, backendOrders] = await Promise.all([
    fetchRestaurantsFromBackend(),
    fetchOrdersFromBackend()
  ]);

  allOrders = Array.isArray(backendOrders) ? backendOrders : [];

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

    if (category === active) {
      button.classList.add("active");
    }

    button.onclick = () => {
      active = category;
      updateRestaurants();
    };

    categoryContainer.appendChild(button);
  });
}

/* ==========================================
   RENDER TOP 6 RESTAURANTES SEMANAL
========================================== */
function renderTopRestaurants() {
  if (!topRestaurantsContainer) return;

  const countsByRestaurant = {};

  allOrders
    .filter(isWithinLast7Days)
    .forEach((order) => {
      const email = normalizeText(order.restaurantEmail || order.restaurant?.email || "");
      if (!email) return;

      countsByRestaurant[email] = (countsByRestaurant[email] || 0) + 1;
    });

  const topRestaurants = restaurants
    .map((restaurant) => ({
      ...restaurant,
      weeklyOrders: countsByRestaurant[normalizeText(restaurant.email)] || 0
    }))
    .filter((restaurant) => restaurant.weeklyOrders > 0)
    .sort((a, b) => b.weeklyOrders - a.weeklyOrders)
    .slice(0, 6);

  if (!topRestaurants.length) {
    if (topRestaurantsSection) {
      topRestaurantsSection.style.display = "none";
    }
    topRestaurantsContainer.innerHTML = "";
    return;
  }

  if (topRestaurantsSection) {
    topRestaurantsSection.style.display = "block";
  }

  topRestaurantsContainer.innerHTML = topRestaurants.map((restaurant) => `
    <div class="restaurant">
      <div class="tag">🔥 Popular</div>
      <b>${escapeHtml(restaurant.name)}</b><br>
      <span class="restaurant-status status-open">🟢 Abierto</span><br>
      ${escapeHtml(restaurant.type)}<br>
      🛒 ${restaurant.weeklyOrders} pedido(s) esta semana<br>
      ⭐ ${escapeHtml(restaurant.rating)} · 🚚 ${escapeHtml(restaurant.delivery)} · ⏱ ${escapeHtml(restaurant.time)}
    </div>
  `).join("");

  Array.from(topRestaurantsContainer.children).forEach((card, index) => {
    const restaurant = topRestaurants[index];

    card.addEventListener("click", () => {
      if (restaurant.email) {
        const restaurantName = encodeURIComponent(restaurant.name || "Restaurante");
        const restaurantEmail = encodeURIComponent(restaurant.email);

        window.location.href =
          `restaurant.html?restaurant=${restaurantEmail}&name=${restaurantName}`;
        return;
      }

      window.location.href = `restaurant.html?id=${encodeURIComponent(restaurant.id)}`;
    });
  });
}

/* ==========================================
   RENDER TOP 6 PLATOS SEMANAL
========================================== */
function renderTopDishes() {
  if (!topDishesContainer) return;

  const countsByDish = {};

  allOrders
    .filter(isWithinLast7Days)
    .forEach((order) => {
      const restaurantEmail = normalizeText(order.restaurantEmail || order.restaurant?.email || "");
      const restaurant = restaurants.find((item) => normalizeText(item.email) === restaurantEmail);

      if (!restaurant) return;

      const items = Array.isArray(order.items) ? order.items : [];

      items.forEach((item) => {
        const dishId = String(item.id || "").trim();
        const dishName = item.name || "Plato";
        const dishPrice = Number(item.price || item.unitPrice || item.subtotal / item.qty || 0);
        const qty = Number(item.qty || 0);

        if (!dishId || qty <= 0) return;

        const key = `${restaurantEmail}__${dishId}`;

        if (!countsByDish[key]) {
          countsByDish[key] = {
            dishId,
            dishName,
            dishPrice,
            restaurantEmail,
            restaurantName: restaurant.name,
            totalQty: 0
          };
        }

        countsByDish[key].totalQty += qty;
      });
    });

  const topDishes = Object.values(countsByDish)
    .sort((a, b) => b.totalQty - a.totalQty)
    .slice(0, 6);

  if (!topDishes.length) {
    if (topDishesSection) {
      topDishesSection.style.display = "none";
    }
    topDishesContainer.innerHTML = "";
    return;
  }

  if (topDishesSection) {
    topDishesSection.style.display = "block";
  }

  topDishesContainer.innerHTML = topDishes.map((dish) => `
    <div class="restaurant">
      <div class="tag">🍔 Top plato</div>
      <b>${escapeHtml(dish.dishName)}</b><br>
      📍 ${escapeHtml(dish.restaurantName)}<br>
      🛒 ${dish.totalQty} pedido(s) esta semana<br>
      <button
        type="button"
        class="budget-btn"
        style="margin-top:12px;"
        data-dish-id="${escapeHtml(dish.dishId)}"
        data-dish-name="${escapeHtml(dish.dishName)}"
        data-dish-price="${escapeHtml(dish.dishPrice)}"
        data-restaurant-email="${escapeHtml(dish.restaurantEmail)}"
      >
        Pedir ahora
      </button>
    </div>
  `).join("");

  topDishesContainer.querySelectorAll("button[data-dish-id]").forEach((button) => {
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
function updateRestaurants() {
  renderCategories();
  renderTopRestaurants();
  renderTopDishes();
  renderRestaurants(applyFilters());
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
if (searchInput) {
  searchInput.addEventListener("input", updateRestaurants);
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
    window.restaurants = restaurants;
    window.cats = cats;
    window.allDishes = allDishes;
    renderCategories();
    renderErrorState();
  }
}

initRestaurantsPage();




























































































