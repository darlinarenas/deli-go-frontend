/* ======================================================
   DELI - restaurants.js
   Controla la página principal de restaurantes
====================================================== */

/* ==========================================
   Referencias del HTML
========================================== */
const list = document.getElementById("restaurantList");
const categoryContainer = document.getElementById("categories");
const searchInput = document.querySelector(".search");

/* ==========================================
   Datos base desde database.js
========================================== */
const baseRestaurants = window.DELI_DB ? window.DELI_DB.restaurants : [];
const baseCats = window.DELI_DB ? window.DELI_DB.cats : [];

/* ==========================================
   LocalStorage keys
========================================== */
const RESTAURANT_ACCOUNTS_KEY = "deliRestaurantAccounts";
const RESTAURANT_DISHES_KEY = "deliRestaurantDishes";
const RESTAURANT_STATUS_KEY = "deliRestaurantStatus";

/* ==========================================
   Compatibilidad con budget.js
========================================== */
let restaurants = [];
let cats = [];

/* ==========================================
   Categoría activa
========================================== */
let active = "Todos";

/* ==========================================
   Helpers
========================================== */
function safeParse(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeEmail(email) {
  return (email || "").toString().trim().toLowerCase();
}

function getRestaurantAccounts() {
  return safeParse(localStorage.getItem(RESTAURANT_ACCOUNTS_KEY), []) || [];
}

function getRestaurantDishesMap() {
  return safeParse(localStorage.getItem(RESTAURANT_DISHES_KEY), {}) || {};
}

/* ===============================
   NUEVO: estado abierto/cerrado
=============================== */

function getRestaurantStatusMap() {
  return safeParse(localStorage.getItem(RESTAURANT_STATUS_KEY), {}) || {};
}

function getRestaurantStatus(email) {
  const map = getRestaurantStatusMap();
  return map[normalizeEmail(email)] ?? true; // default abierto
}

/* ==========================================
   Platos
========================================== */

function getRestaurantDishCountByEmail(email) {
  const dishesMap = getRestaurantDishesMap();
  const key = normalizeEmail(email);
  const dishes = dishesMap[key] || [];
  return dishes.length;
}

function getRestaurantCategoriesFromDishes(email) {
  const dishesMap = getRestaurantDishesMap();
  const key = normalizeEmail(email);
  const dishes = dishesMap[key] || [];

  const categories = [...new Set(
    dishes
      .map((dish) => (dish.category || "").trim())
      .filter(Boolean)
  )];

  return categories;
}

/* ==========================================
   Crear restaurante dinámico
========================================== */

function mapDynamicRestaurant(account, index) {

  const dishCount = getRestaurantDishCountByEmail(account.email);
  const dishCategories = getRestaurantCategoriesFromDishes(account.email);

  return {
    id: `dynamic-${index + 1}`,
    name: account.name || "Restaurante",
    type: dishCategories.length ? dishCategories.join(", ") : "Comida",
    rating: "Nuevo",
    delivery: "A convenir",
    time: "20-40 min",
    category: dishCategories[0] || "Otros",
    popular: dishCount >= 5,
    email: account.email || "",
    address: account.address || "Punto Fijo",
    isDynamic: true,
    open: getRestaurantStatus(account.email) // NUEVO
  };
}

function buildAllRestaurants() {
  const dynamicRestaurants = getRestaurantAccounts().map(mapDynamicRestaurant);
  return [...baseRestaurants, ...dynamicRestaurants];
}

function buildAllCategories() {

  const dynamicRestaurants = getRestaurantAccounts();
  const categorySet = new Set(["Todos", ...baseCats]);

  dynamicRestaurants.forEach((account) => {
    const dishCategories = getRestaurantCategoriesFromDishes(account.email);

    dishCategories.forEach((cat) => {
      if (cat) categorySet.add(cat);
    });
  });

  return [...categorySet];
}

function refreshRestaurantData() {

  restaurants = buildAllRestaurants();
  cats = buildAllCategories().filter((c) => c !== "Todos");

  window.restaurants = restaurants;
  window.cats = cats;
}

/* ==========================================
   Renderizar categorías
========================================== */

function renderCategories() {

  if (!categoryContainer) return;

  categoryContainer.innerHTML = "";

  ["Todos", ...cats].forEach((c) => {

    const b = document.createElement("button");

    b.textContent = c;
    b.className = "category-btn";

    if (c === active) {
      b.classList.add("active");
    }

    b.onclick = () => {
      active = c;
      updateRestaurants();
    };

    categoryContainer.appendChild(b);
  });
}

/* ==========================================
   Pintar restaurantes
========================================== */

function renderRestaurants(data) {

  if (!list) return;

  list.innerHTML = "";

  if (!data.length) {
    list.innerHTML = `
      <div style="grid-column: 1 / -1; background: white; padding: 20px; border-radius: 16px; text-align: center;">
        No se encontraron restaurantes.
      </div>
    `;
    return;
  }

  data.forEach((r) => {

    const d = document.createElement("div");

    d.className = "restaurant";
    d.style.cursor = "pointer";

    const statusHTML = r.open
      ? `<span style="color:green;font-weight:bold;">🟢 Abierto</span>`
      : `<span style="color:red;font-weight:bold;">🔴 Cerrado</span>`;

    d.innerHTML = `
      ${r.popular ? '<div class="tag">🔥 Popular</div>' : ""}
      <b>${r.name}</b><br>
      ${statusHTML}<br>
      ${r.type}<br>
      ⭐ ${r.rating} · 🚚 ${r.delivery} · ⏱ ${r.time}
    `;

    d.onclick = () => {

      if (!r.open) {
        alert("Este restaurante está cerrado en este momento.");
        return;
      }

      if (r.email) {

        const restaurantName = encodeURIComponent(r.name || "Restaurante");
        const restaurantEmail = encodeURIComponent(r.email);

        window.location.href =
          `restaurant.html?restaurant=${restaurantEmail}&name=${restaurantName}`;

      } else {

        window.location.href = `restaurant.html?id=${r.id}`;

      }

    };

    list.appendChild(d);
  });
}

/* ==========================================
   Filtrar restaurantes
========================================== */

function updateRestaurants() {

  refreshRestaurantData();

  let filtered = [...restaurants];

  if (active !== "Todos") {
    filtered = filtered.filter((r) => r.category === active);
  }

  const text = searchInput
    ? searchInput.value.toLowerCase().trim()
    : "";

  if (text) {

    filtered = filtered.filter((r) =>
      (r.name || "").toLowerCase().includes(text) ||
      (r.type || "").toLowerCase().includes(text)
    );

  }

  renderCategories();
  renderRestaurants(filtered);
}

/* ==========================================
   Eventos
========================================== */

if (searchInput) {
  searchInput.addEventListener("input", updateRestaurants);
}

/* ==========================================
   Inicialización
========================================== */

refreshRestaurantData();
renderCategories();
updateRestaurants();