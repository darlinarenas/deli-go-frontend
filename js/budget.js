// ARCHIVO REVISADO: NO REQUIERE CAMBIO DE CONEXIÓN BACKEND
(() => {
  const resultado = document.getElementById("resultado");

  const BUDGET_DISHES_KEY = "deliRestaurantDishes";
  const BUDGET_RESTAURANT_ACCOUNTS_KEY = "deliRestaurantAccounts";

  function budgetSafeParse(value, fallback = null) {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function budgetNormalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function getBudgetRestaurantAccounts() {
    return budgetSafeParse(localStorage.getItem(BUDGET_RESTAURANT_ACCOUNTS_KEY), []) || [];
  }

  function getBudgetRestaurantDishesMap() {
    return budgetSafeParse(localStorage.getItem(BUDGET_DISHES_KEY), {}) || {};
  }

  function getBudgetBaseRestaurants() {
    return window.DELI_DB && Array.isArray(window.DELI_DB.restaurants)
      ? window.DELI_DB.restaurants
      : [];
  }

  function getRestaurantNameFromAccounts(emailOrKey) {
    const accounts = getBudgetRestaurantAccounts();
    const normalized = budgetNormalize(emailOrKey);

    const found = accounts.find((account) => {
      return budgetNormalize(account.email) === normalized;
    });

    return found ? (found.name || "Restaurante") : "Restaurante";
  }

  function getDynamicBudgetOptions() {
    const dishesMap = getBudgetRestaurantDishesMap();
    const options = [];

    Object.entries(dishesMap).forEach(([restaurantKey, dishes]) => {
      if (!Array.isArray(dishes)) return;

      dishes.forEach((dish) => {
        const precio = Number(dish.price || 0);

        if (!precio || precio <= 0) return;
        if (dish.available === false) return;

        const restaurantEmail = dish.restaurantEmail || restaurantKey || "";
        const restaurantName =
          (dish.restaurantName && dish.restaurantName.trim()) ||
          getRestaurantNameFromAccounts(restaurantEmail) ||
          "Restaurante";

        options.push({
          dishId: String(dish.id || ""),
          nombre: dish.name || "Plato",
          precio: precio,
          rest: restaurantName,
          restaurantEmail: restaurantEmail,
          time: dish.prepTime || "20-40 min",
          categoria: dish.category || "General",
          emoji: dish.emoji || "🍽️"
        });
      });
    });

    return options;
  }

  function getBaseBudgetOptions() {
    const baseRestaurants = getBudgetBaseRestaurants();
    const options = [];

    baseRestaurants.forEach((restaurant) => {
      if (Array.isArray(restaurant.menu) && restaurant.menu.length) {
        restaurant.menu.forEach((dish) => {
          const precio = Number(dish.price || 0);

          if (!precio || precio <= 0) return;

          options.push({
            dishId: String(dish.id || ""),
            nombre: dish.name || "Plato",
            precio: precio,
            rest: restaurant.name || "Restaurante",
            restaurantEmail: restaurant.email || "",
            time: restaurant.time || "20-40 min",
            categoria: dish.category || restaurant.category || "General",
            emoji: dish.emoji || "🍽️"
          });
        });
      }
    });

    return options;
  }

  function getAllBudgetOptions() {
    const dynamicOptions = getDynamicBudgetOptions();
    const baseOptions = getBaseBudgetOptions();

    const combined = [...dynamicOptions];

    baseOptions.forEach((baseItem) => {
      const exists = combined.some((item) => {
        return (
          budgetNormalize(item.restaurantEmail) === budgetNormalize(baseItem.restaurantEmail) &&
          String(item.dishId || "") === String(baseItem.dishId || "")
        );
      });

      if (!exists) {
        combined.push(baseItem);
      }
    });

    return combined;
  }

  function budgetEscapeText(text) {
    return String(text || "").replace(/'/g, "\\'");
  }

  function pedir(dishId, restaurantEmail) {
    const normalizedRestaurantEmail = String(restaurantEmail || "").trim();
    const normalizedDishId = String(dishId || "").trim();

    if (!normalizedRestaurantEmail) {
      alert("No se pudo identificar el restaurante.");
      return;
    }

    const restaurantParam = encodeURIComponent(normalizedRestaurantEmail);
    const dishParam = encodeURIComponent(normalizedDishId);

    if (normalizedDishId) {
      window.location.href =
        `restaurant.html?restaurant=${restaurantParam}&addDish=${dishParam}&openCart=1`;
      return;
    }

    window.location.href = `restaurant.html?restaurant=${restaurantParam}`;
  }

  function generarRecomendacion() {
    const budgetInput = document.getElementById("budget");
    const presupuesto = Number(budgetInput ? budgetInput.value : 0);

    if (!resultado) {
      alert("No se encontró el contenedor del resultado.");
      return;
    }

    if (!presupuesto || presupuesto <= 0) {
      resultado.innerHTML = "⚠️ Ingrese un presupuesto valido";
      return;
    }

    const allOptions = getAllBudgetOptions();
    const opciones = allOptions.filter((item) => {
      return Number(item.precio) <= presupuesto && item.restaurantEmail;
    });

    if (opciones.length === 0) {
      resultado.innerHTML = "❌ Lo sentimos, aumenta tu presupuesto un poco más.";
      return;
    }

    opciones.sort((a, b) => Number(b.precio) - Number(a.precio));

    const mejor = opciones[0];
    const alternativa = opciones[1] || opciones[0];
    const economica = opciones[opciones.length - 1];

    resultado.innerHTML = `
      <div class="result-card">
        <h3>🥇 Mejor opción</h3>
        ${mejor.emoji} ${mejor.nombre}<br>
        💰 $${mejor.precio}<br>
        📍 ${mejor.rest}<br>
        ⏱ ${mejor.time}
        <button onclick="pedir('${budgetEscapeText(mejor.dishId)}','${budgetEscapeText(mejor.restaurantEmail)}')">
          Pedir
        </button>
      </div>

      <div class="result-card">
        <h3>🔄 Alternativa</h3>
        ${alternativa.emoji} ${alternativa.nombre}<br>
        💰 $${alternativa.precio}<br>
        📍 ${alternativa.rest}<br>
        ⏱ ${alternativa.time}
        <button onclick="pedir('${budgetEscapeText(alternativa.dishId)}','${budgetEscapeText(alternativa.restaurantEmail)}')">
          Pedir
        </button>
      </div>

      <div class="result-card">
        <h3>💸 Económica</h3>
        ${economica.emoji} ${economica.nombre}<br>
        💰 $${economica.precio}<br>
        📍 ${economica.rest}<br>
        ⏱ ${economica.time}
        <button onclick="pedir('${budgetEscapeText(economica.dishId)}','${budgetEscapeText(economica.restaurantEmail)}')">
          Pedir
        </button>
      </div>
    `;
  }

  window.generarRecomendacion = generarRecomendacion;
  window.pedir = pedir;
})();


