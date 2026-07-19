document.addEventListener("DOMContentLoaded", async () => {
  if (!window.DELI_SESSION_READY && typeof loadCurrentSession === "function") {
    await loadCurrentSession();
  }

  const restaurant =
    (typeof getSavedRestaurant === "function" && getSavedRestaurant()) ||
    (typeof getCurrentUser === "function" && getCurrentUser()) ||
    null;

  if (!restaurant || restaurant.role !== "restaurant") {
    window.location.href = "index.html";
    return;
  }

  const DISHES_KEY = "deliRestaurantDishes";
  const STORE_STATUS_KEY = "deliRestaurantStatus";
  const HOURS_KEY = "deliRestaurantHours";
  const PROMOTIONS_KEY = "deliRestaurantPromotions";
  const CATEGORIES_KEY = "deliRestaurantCategories";
  const PROFILE_KEY = "deliRestaurantProfiles";
  const ORDERS_PER_PAGE = 6;
  const ACTIVE_SECTION_KEY = "deliRestaurantActiveSection";

  /* Backend real de DELI.
     IMPORTANTE: el server.js actual corre en el puerto 3001. */
  const API_URL = window.DELI_API_URL || "https://deligo-backend-i554.onrender.com";

  const restaurantEmail = (restaurant.email || "").toLowerCase().trim();
  const restaurantName = (restaurant.name || "Mi restaurante").trim();
  const restaurantAddress = restaurant.address || "Punto Fijo";
  const restaurantId = String(restaurant.id || "").trim();

  let currentOrdersPage = 1;
  let activeOrderTab = "todos";
  let isOpen = true;

  /*
    BACKEND COMO FUENTE PRINCIPAL:
    Los platos y pedidos se trabajan desde backend.
    - Platos: se cargan/crean/editan/eliminan desde backend.
    - Pedidos: se cargan/actualizan desde backend mediante orders.js.
    Este cache solo vive en memoria mientras la página está abierta.
  */
  let myDishesCache = [];

      /* ========================================
      NOTIFICACIONES DE PEDIDOS NUEVOS
    ======================================== */
    let knownOrderIds = new Set();
    let hasLoadedOrdersOnce = false;
    let audioUnlocked = false;

  const els = {
    storeName: document.getElementById("storeName"),
    storeMeta: document.getElementById("storeMeta"),
    welcomeTitle: document.getElementById("welcomeTitle"),
    storeStatusPill: document.getElementById("storeStatusPill"),
    toggleStoreStatusBtn: document.getElementById("toggleStoreStatusBtn"),
    goPublicStore: document.getElementById("goPublicStore"),
    settingsToggleStoreBtn: document.getElementById("settingsToggleStoreBtn"),
    settingsGoPublicStoreBtn: document.getElementById("settingsGoPublicStoreBtn"),
    openPublicStorePreviewBtn: document.getElementById("openPublicStorePreviewBtn"),

    pendingOrdersCount: document.getElementById("pendingOrdersCount"),
    preparingOrdersCount: document.getElementById("preparingOrdersCount"),
    readyOrdersCount: document.getElementById("readyOrdersCount"),
    enRouteOrdersCount: document.getElementById("enRouteOrdersCount"),
    deliveredOrdersCount: document.getElementById("deliveredOrdersCount"),
    activeDishesCount: document.getElementById("activeDishesCount"),

    restaurantOrdersList: document.getElementById("restaurantOrdersList"),
    ordersLoadMoreWrap: document.getElementById("ordersLoadMoreWrap"),
    overviewOrdersList: document.getElementById("overviewOrdersList"),
    overviewDishList: document.getElementById("overviewDishList"),

    orderSearchInput: document.getElementById("orderSearchInput"),
    orderStatusFilter: document.getElementById("orderStatusFilter"),
    clearOrderFiltersBtn: document.getElementById("clearOrderFiltersBtn"),
    heroGoOrdersBtn: document.getElementById("heroGoOrdersBtn"),

    dishList: document.getElementById("dishList"),
    dishForm: document.getElementById("dishForm"),
    dishId: document.getElementById("dishId"),
    dishName: document.getElementById("dishName"),
    dishPrice: document.getElementById("dishPrice"),
    dishDescription: document.getElementById("dishDescription"),
    dishCategory: document.getElementById("dishCategory"),
    dishPrepTime: document.getElementById("dishPrepTime"),
    dishEmoji: document.getElementById("dishEmoji"),
    dishAvailable: document.getElementById("dishAvailable"),
    formTitle: document.getElementById("formTitle"),
    cancelEditBtn: document.getElementById("cancelEditBtn"),
    newDishBtn: document.getElementById("newDishBtn"),
    scrollToFormBtn: document.getElementById("scrollToFormBtn"),
    dishFormPanel: document.getElementById("dishFormPanel"),

    categoryForm: document.getElementById("categoryForm"),
    categoryEditId: document.getElementById("categoryEditId"),
    categoryNameInput: document.getElementById("categoryNameInput"),
    categoryStatusInput: document.getElementById("categoryStatusInput"),
    categoryDescriptionInput: document.getElementById("categoryDescriptionInput"),
    cancelCategoryEditBtn: document.getElementById("cancelCategoryEditBtn"),
    categoryList: document.getElementById("categoryList"),
    categoryDishAssignmentList: document.getElementById("categoryDishAssignmentList"),

    saveHoursBtn: document.getElementById("saveHoursBtn"),
    resetHoursBtn: document.getElementById("resetHoursBtn"),
    hoursList: document.getElementById("hoursList"),

    promotionForm: document.getElementById("promotionForm"),
    promotionId: document.getElementById("promotionId"),
    promotionTitle: document.getElementById("promotionTitle"),
    promotionType: document.getElementById("promotionType"),
    promotionValue: document.getElementById("promotionValue"),
    promotionStatus: document.getElementById("promotionStatus"),
    promotionStartDate: document.getElementById("promotionStartDate"),
    promotionEndDate: document.getElementById("promotionEndDate"),
    promotionDescription: document.getElementById("promotionDescription"),
    cancelPromotionEditBtn: document.getElementById("cancelPromotionEditBtn"),
    promotionList: document.getElementById("promotionList"),

    editProfileBtn: document.getElementById("editProfileBtn"),
    cancelProfileEditBtn: document.getElementById("cancelProfileEditBtn"),
    profileViewBox: document.getElementById("profileViewBox"),
    profileForm: document.getElementById("profileForm"),
    profileNameInput: document.getElementById("profileNameInput"),
    profilePhoneInput: document.getElementById("profilePhoneInput"),
    profileAddressInput: document.getElementById("profileAddressInput"),
    profileCategoryInput: document.getElementById("profileCategoryInput"),
    profileBannerInput: document.getElementById("profileBannerInput"),
    profileDescriptionInput: document.getElementById("profileDescriptionInput"),
    profilePreviewBtn: document.getElementById("profilePreviewBtn"),

    profileStoreName: document.getElementById("profileStoreName"),
    profileStoreAddress: document.getElementById("profileStoreAddress"),
    profileStoreEmail: document.getElementById("profileStoreEmail"),
    profileStorePhone: document.getElementById("profileStorePhone"),
    profileStoreDescription: document.getElementById("profileStoreDescription"),
    profileStoreStatus: document.getElementById("profileStoreStatus"),

    previewStoreBannerText: document.getElementById("previewStoreBannerText"),
    previewStoreName: document.getElementById("previewStoreName"),
    previewStoreDescription: document.getElementById("previewStoreDescription"),
    previewStoreCategory: document.getElementById("previewStoreCategory"),
    previewStoreOpenStatus: document.getElementById("previewStoreOpenStatus"),
    previewStoreAddress: document.getElementById("previewStoreAddress"),
    previewStorePhone: document.getElementById("previewStorePhone")
  };

  function safeParse(value, fallback = null) {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  const memoryStore = {};
  let activeSectionMemory = "ordersSection";

  function saveJSON(key, value) {
    memoryStore[key] = value;
  }

  function readJSON(key, fallback) {
    return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : fallback;
  }

  function escapeHtml(text) {
    return String(text || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeStatus(status) {
    const raw = String(status || "").toLowerCase().trim();

    switch (raw) {
      case "pending":
        return "pendiente";
      case "accepted":
        return "aceptado";
      case "preparing":
        return "preparando";
      case "ready":
        return "listo";
      case "on_the_way":
      case "on-the-way":
      case "en camino":
        return "en_camino";
      case "delivered":
      case "completed":
      case "finished":
      case "finalizado":
        return "entregado";
      default:
        return raw;
    }
  }

  function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
  }

  function formatPrice(value) {
    const number = Number(value || 0);
    return `$${number.toFixed(2)}`;
  }

  function restaurantKey() {
    return (restaurant.email || restaurant.id || restaurant.name || "restaurant")
      .toString()
      .toLowerCase()
      .trim();
  }

  function openSection(targetId) {
    const navLinks = document.querySelectorAll(".panel-nav-link");
    const sections = document.querySelectorAll(".panel-section");

    navLinks.forEach((link) => {
      link.classList.toggle("active", link.dataset.target === targetId);
    });

    sections.forEach((section) => {
      section.classList.toggle("active", section.id === targetId);
    });

    if (targetId) {
      activeSectionMemory = targetId;
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function getSavedActiveSection() {
    return activeSectionMemory || "ordersSection";
  }

  function bindPanelNavigation() {
    document.querySelectorAll(".panel-nav-link").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const targetId = link.dataset.target;
        if (targetId) openSection(targetId);
      });
    });
  }

  /* =========================
     STORE STATUS
  ========================= */
  function getStoreStatus() {
    const map = readJSON(STORE_STATUS_KEY, {}) || {};
    return map[restaurantEmail] !== false;
  }

  function setStoreStatus(status) {
    const map = readJSON(STORE_STATUS_KEY, {}) || {};
    map[restaurantEmail] = status;
    saveJSON(STORE_STATUS_KEY, map);
  }

  function renderStoreStatus() {
    if (els.storeStatusPill) {
      els.storeStatusPill.textContent = isOpen ? "● Local abierto" : "● Local cerrado";
      els.storeStatusPill.classList.toggle("closed", !isOpen);
    }

    if (els.toggleStoreStatusBtn) {
      els.toggleStoreStatusBtn.textContent = isOpen ? "Cerrar local" : "Abrir local";
    }

    if (els.settingsToggleStoreBtn) {
      els.settingsToggleStoreBtn.textContent = isOpen ? "Cerrar local" : "Abrir local";
    }

    if (els.profileStoreStatus) {
      els.profileStoreStatus.textContent = isOpen ? "Abierto" : "Cerrado";
    }

    if (els.previewStoreOpenStatus) {
      els.previewStoreOpenStatus.textContent = isOpen ? "Local abierto" : "Local cerrado";
    }
  }

  function toggleStoreStatus() {
    isOpen = !isOpen;
    setStoreStatus(isOpen);
    renderStoreStatus();
  }

  function goToPublicStore() {
    const encodedName = encodeURIComponent(restaurantName);
    const encodedEmail = encodeURIComponent(restaurantEmail);
    window.location.href = `restaurant.html?restaurant=${encodedEmail}&name=${encodedName}`;
  }

  /* =========================
     PROFILE
  ========================= */
  function defaultProfile() {
    return {
      name: restaurantName,
      address: restaurantAddress,
      email: restaurantEmail || "",
      phone: "",
      description: "",
      category: "Comida rápida",
      bannerText: "Las mejores opciones del local"
    };
  }

  function getProfileMap() {
    return readJSON(PROFILE_KEY, {}) || {};
  }

  function saveProfileMap(map) {
    saveJSON(PROFILE_KEY, map);
  }

  function getMyProfile() {
    const map = getProfileMap();
    if (!map[restaurantKey()]) {
      map[restaurantKey()] = defaultProfile();
      saveProfileMap(map);
    }
    return map[restaurantKey()];
  }

  function saveMyProfile(profile) {
    const map = getProfileMap();
    map[restaurantKey()] = profile;
    saveProfileMap(map);
  }

  function renderProfile() {
    const profile = getMyProfile();

    if (els.storeName) els.storeName.textContent = profile.name || restaurantName;
    if (els.storeMeta) {
      els.storeMeta.textContent = `${profile.category || "Comida rápida"} · ${profile.address || restaurantAddress}`;
    }
    if (els.welcomeTitle) {
      els.welcomeTitle.textContent = `Bienvenido, ${profile.name || restaurantName} 👋`;
    }

    if (els.profileStoreName) els.profileStoreName.textContent = profile.name || "-";
    if (els.profileStoreAddress) els.profileStoreAddress.textContent = profile.address || "-";
    if (els.profileStoreEmail) els.profileStoreEmail.textContent = profile.email || "-";
    if (els.profileStorePhone) els.profileStorePhone.textContent = profile.phone || "No definido";
    if (els.profileStoreDescription) {
      els.profileStoreDescription.textContent = profile.description || "Sin descripción del local.";
    }

    if (els.profileNameInput) els.profileNameInput.value = profile.name || "";
    if (els.profilePhoneInput) els.profilePhoneInput.value = profile.phone || "";
    if (els.profileAddressInput) els.profileAddressInput.value = profile.address || "";
    if (els.profileCategoryInput) els.profileCategoryInput.value = profile.category || "";
    if (els.profileBannerInput) els.profileBannerInput.value = profile.bannerText || "";
    if (els.profileDescriptionInput) els.profileDescriptionInput.value = profile.description || "";

    renderStorePreview();
  }

  function renderStorePreview() {
    const profile = getMyProfile();

    if (els.previewStoreBannerText) {
      els.previewStoreBannerText.textContent = profile.bannerText || "Las mejores opciones del local";
    }
    if (els.previewStoreName) {
      els.previewStoreName.textContent = profile.name || restaurantName;
    }
    if (els.previewStoreDescription) {
      els.previewStoreDescription.textContent =
        profile.description || "Tu descripción del restaurante aparecerá aquí.";
    }
    if (els.previewStoreCategory) {
      els.previewStoreCategory.textContent = profile.category || "Comida rápida";
    }
    if (els.previewStoreAddress) {
      els.previewStoreAddress.textContent = profile.address || restaurantAddress;
    }
    if (els.previewStorePhone) {
      els.previewStorePhone.textContent = profile.phone || "No definido";
    }
  }

  function startProfileEdit() {
    els.profileViewBox?.classList.add("hidden");
    els.profileForm?.classList.remove("hidden");
    els.cancelProfileEditBtn?.classList.remove("hidden");
    els.editProfileBtn?.classList.add("hidden");
  }

  function cancelProfileEdit() {
    els.profileViewBox?.classList.remove("hidden");
    els.profileForm?.classList.add("hidden");
    els.cancelProfileEditBtn?.classList.add("hidden");
    els.editProfileBtn?.classList.remove("hidden");
    renderProfile();
  }

  function saveProfile(event) {
    event.preventDefault();

    const current = getMyProfile();
    const updated = {
      ...current,
      name: els.profileNameInput?.value.trim() || restaurantName,
      phone: els.profilePhoneInput?.value.trim() || "",
      address: els.profileAddressInput?.value.trim() || restaurantAddress,
      category: els.profileCategoryInput?.value.trim() || "Comida rápida",
      bannerText: els.profileBannerInput?.value.trim() || "Las mejores opciones del local",
      description: els.profileDescriptionInput?.value.trim() || "",
      email: current.email || restaurantEmail
    };

    saveMyProfile(updated);
    renderProfile();
    cancelProfileEdit();
  }

  /* =========================
     DISHES
  ========================= */
  function getAllDishesMap() {
    /*
      Compatibilidad:
      Antes los platos se guardaban en backend o memoria temporal con DISHES_KEY.
      Ahora NO se leen desde backend o memoria temporal para evitar datos viejos o distintos por navegador.
    */
    return {};
  }

  function saveAllDishesMap(map) {
    /*
      Backend puro:
      No se guardan platos en backend o memoria temporal.
      Se conserva esta función para no romper llamadas antiguas dentro del archivo.
    */
    return map;
  }

  function getMyDishes() {
    /*
      Fuente real: backend.
      Fuente temporal de pantalla: myDishesCache.
      No se lee backend o memoria temporal.
    */
    return Array.isArray(myDishesCache) ? myDishesCache : [];
  }

  function saveMyDishes(dishes) {
    /*
      Cache visual temporal:
      Permite que el panel responda rápido sin guardar datos operativos en backend o memoria temporal.
      La persistencia real ocurre en createDishInBackend / updateDishInBackend / deleteDishInBackend.
    */
    myDishesCache = Array.isArray(dishes) ? dishes : [];
    return myDishesCache;
  }

  async function fetchMyDishesFromBackend() {
    if (!restaurantEmail) return [];

    try {
      const response = await fetch(`${API_URL}/restaurants/${encodeURIComponent(restaurantEmail)}/dishes`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        console.warn("No se pudieron cargar los platos desde backend", response.status);
        return [];
      }

      const data = await response.json();

      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.dishes)) return data.dishes;

      return [];
    } catch (error) {
      console.warn("Error conectando platos con backend:", error);
      return [];
    }
  }

  async function syncMyDishesFromBackend() {
    const backendDishes = await fetchMyDishesFromBackend();

    /*
      Importante:
      aunque el backend devuelva 0 platos, actualizamos el cache en memoria.
      Así evitamos que queden platos viejos en pantalla.
    */
    saveMyDishes(Array.isArray(backendDishes) ? backendDishes : []);

    return getMyDishes();
  }

  async function createDishInBackend(dish) {
    const response = await fetch(`${API_URL}/restaurants/${encodeURIComponent(restaurantEmail)}/dishes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(dish)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "No se pudo crear el plato en backend");
    }

    return data.dish || dish;
  }

  async function updateDishInBackend(dish) {
    const response = await fetch(`${API_URL}/restaurants/${encodeURIComponent(restaurantEmail)}/dishes/${encodeURIComponent(dish.id)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(dish)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "No se pudo actualizar el plato en backend");
    }

    return data.dish || dish;
  }

  async function deleteDishInBackend(dishId) {
    const response = await fetch(`${API_URL}/restaurants/${encodeURIComponent(restaurantEmail)}/dishes/${encodeURIComponent(dishId)}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || "No se pudo eliminar el plato en backend");
    }

    return true;
  }

  function getDishEmoji(dish) {
    return (dish.emoji || "").trim() || "🍽️";
  }

  function clearDishForm() {
    if (els.dishId) els.dishId.value = "";
    if (els.dishName) els.dishName.value = "";
    if (els.dishPrice) els.dishPrice.value = "";
    if (els.dishDescription) els.dishDescription.value = "";
    if (els.dishCategory) els.dishCategory.value = "";
    if (els.dishPrepTime) els.dishPrepTime.value = "";
    if (els.dishEmoji) els.dishEmoji.value = "";
    if (els.dishAvailable) els.dishAvailable.value = "true";
    if (els.formTitle) els.formTitle.textContent = "Agregar / editar plato";
  }

  function showDishFormSection() {
    openSection("misPlatosSection");
    setTimeout(() => {
      els.dishFormPanel?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function renderDishStats() {
    const activeCount = getMyDishes().filter((dish) => dish.available).length;
    if (els.activeDishesCount) els.activeDishesCount.textContent = activeCount;
  }

  function renderDishList() {
    const dishes = getMyDishes();

    if (!els.dishList) return;

    if (!dishes.length) {
      els.dishList.innerHTML =
        `<div class="empty-box">Todavía no has agregado platos. Empieza creando el primero.</div>`;
      renderOverviewDishList();
      renderDishStats();
      renderCategoryDishAssignmentList();
      return;
    }

    els.dishList.innerHTML = dishes.map((dish) => `
      <article class="dish">
        <div class="dish-image">${escapeHtml(getDishEmoji(dish))}</div>
        <div>
          <h3>${escapeHtml(dish.name)}</h3>
          <p>${escapeHtml(dish.description || "Sin descripción")}</p>

          <div class="dish-bottom">
            <span class="price">${formatPrice(dish.price)}</span>
            <span class="switch ${dish.available ? "" : "no"}">
              ${dish.available ? "Disponible" : "No disponible"}
            </span>
          </div>

          <div class="dish-actions">
            <button class="btn btn-light edit-dish-btn" data-id="${escapeHtml(dish.id)}" type="button">Editar</button>
            <button class="btn btn-danger delete-dish-btn" data-id="${escapeHtml(dish.id)}" type="button">Eliminar</button>
          </div>
        </div>
      </article>
    `).join("");

    document.querySelectorAll(".edit-dish-btn").forEach((button) => {
      button.addEventListener("click", () => editDish(button.dataset.id));
    });

    document.querySelectorAll(".delete-dish-btn").forEach((button) => {
      button.addEventListener("click", () => deleteDish(button.dataset.id));
    });

    renderOverviewDishList();
    renderDishStats();
    renderCategoryDishAssignmentList();
  }

  function renderOverviewDishList() {
    if (!els.overviewDishList) return;

    const dishes = getMyDishes().slice(0, 2);

    if (!dishes.length) {
      els.overviewDishList.innerHTML = `<div class="empty-box">Aquí verás tus platos principales.</div>`;
      return;
    }

    els.overviewDishList.innerHTML = dishes.map((dish) => `
      <article class="dish">
        <div class="dish-image">${escapeHtml(getDishEmoji(dish))}</div>
        <div>
          <h3>${escapeHtml(dish.name)}</h3>
          <p>${escapeHtml(dish.description || "Sin descripción")}</p>
          <div class="dish-bottom">
            <span class="price">${formatPrice(dish.price)}</span>
            <span class="switch ${dish.available ? "" : "no"}">
              ${dish.available ? "Disponible" : "No disponible"}
            </span>
          </div>
        </div>
      </article>
    `).join("");
  }

  function editDish(dishId) {
    const dish = getMyDishes().find((item) => String(item.id) === String(dishId));
    if (!dish) return;

    refreshDishCategorySelect(dish.category || "");

    if (els.dishId) els.dishId.value = dish.id;
    if (els.dishName) els.dishName.value = dish.name || "";
    if (els.dishPrice) els.dishPrice.value = dish.price || "";
    if (els.dishDescription) els.dishDescription.value = dish.description || "";
    if (els.dishCategory) els.dishCategory.value = dish.category || "";
    if (els.dishPrepTime) els.dishPrepTime.value = dish.prepTime || "";
    if (els.dishEmoji) els.dishEmoji.value = dish.emoji || "";
    if (els.dishAvailable) els.dishAvailable.value = String(dish.available);

    if (els.formTitle) els.formTitle.textContent = "Editar plato";
    showDishFormSection();
  }

  async function deleteDish(dishId) {
    const previousDishes = getMyDishes();
    const dishes = previousDishes.filter((item) => String(item.id) !== String(dishId));

    saveMyDishes(dishes);
    renderDishList();
    renderCategories();
    clearDishForm();

    try {
      await deleteDishInBackend(dishId);
      await syncMyDishesFromBackend();
      renderDishList();
      renderCategories();
    } catch (error) {
      console.warn("No se pudo eliminar el plato en backend:", error);
      saveMyDishes(previousDishes);
      renderDishList();
      renderCategories();
      alert("No se pudo eliminar el plato en el backend. Revisa que el servidor esté encendido.");
    }
  }

  function createDishObject() {
    return {
      id: els.dishId?.value ? els.dishId.value : Date.now().toString(),
      name: els.dishName?.value.trim() || "",
      price: Number(els.dishPrice?.value || 0),
      description: els.dishDescription?.value.trim() || "",
      category: els.dishCategory?.value.trim() || "",
      prepTime: els.dishPrepTime?.value.trim() || "",
      emoji: els.dishEmoji?.value.trim() || "",
      available: els.dishAvailable?.value === "true",
      restaurantName: getMyProfile().name || restaurantName,
      restaurantEmail: restaurantEmail,
      restaurantAddress: getMyProfile().address || restaurantAddress
    };
  }

  function validateDish(dish) {
    if (!dish.name || !dish.price || !dish.description || !dish.category) {
      alert("Completa nombre, precio, descripción y categoría.");
      return false;
    }

    if (dish.price <= 0) {
      alert("El precio debe ser mayor que cero.");
      return false;
    }

    return true;
  }

  async function saveDish(event) {
    event.preventDefault();

    const dish = createDishObject();
    if (!validateDish(dish)) return;

    const dishes = getMyDishes();
    const existingIndex = dishes.findIndex((item) => String(item.id) === String(dish.id));
    const previousDishes = [...dishes];

    if (existingIndex >= 0) {
      dishes[existingIndex] = dish;
    } else {
      dishes.push(dish);
    }

    /* Cache temporal en memoria para que el panel responda rápido.
       NO se guarda en backend o memoria temporal. La fuente real queda en backend. */
    saveMyDishes(dishes);
    clearDishForm();
    renderDishList();
    renderCategories();

    try {
      if (existingIndex >= 0) {
        await updateDishInBackend(dish);
      } else {
        await createDishInBackend(dish);
      }

      await syncMyDishesFromBackend();
      renderDishList();
      renderCategories();
    } catch (error) {
      console.warn("No se pudo guardar el plato en backend:", error);
      saveMyDishes(previousDishes);
      renderDishList();
      renderCategories();
      alert("No se pudo guardar el plato en el backend. Revisa que el servidor esté encendido en el puerto 3001.");
    }
  }

  /* =========================
     CATEGORIES
  ========================= */
  const DEFAULT_CATEGORY_NAMES = [
    "Hamburguesas",
    "Pizzas",
    "Pollo",
    "Bebidas",
    "Combos",
    "Empanadas",
    "Postres",
    "Otro"
  ];

  function getCategoriesMap() {
    return readJSON(CATEGORIES_KEY, {}) || {};
  }

  function saveCategoriesMap(map) {
    saveJSON(CATEGORIES_KEY, map);
  }

  function getMyCategories() {
    const map = getCategoriesMap();
    return map[restaurantKey()] || [];
  }

  function saveMyCategories(categories) {
    const map = getCategoriesMap();
    map[restaurantKey()] = categories;
    saveCategoriesMap(map);
  }

  function ensureDefaultCategories() {
    const categories = getMyCategories();
    if (categories.length) return;

    const defaults = DEFAULT_CATEGORY_NAMES.map((name, index) => ({
      id: `default-${index}-${Date.now()}`,
      name,
      description: "",
      status: "active"
    }));

    saveMyCategories(defaults);
  }

  function syncCategoriesFromDishes() {
    ensureDefaultCategories();

    const dishes = getMyDishes();
    const existing = getMyCategories();
    const names = new Set(existing.map((c) => c.name.toLowerCase().trim()));

    dishes.forEach((dish) => {
      const categoryName = (dish.category || "").trim();
      if (!categoryName) return;

      const normalized = categoryName.toLowerCase();
      if (!names.has(normalized)) {
        existing.push({
          id: Date.now().toString() + Math.random().toString(16).slice(2),
          name: categoryName,
          description: "",
          status: "active"
        });
        names.add(normalized);
      }
    });

    saveMyCategories(existing);
  }

  function clearCategoryForm() {
    if (els.categoryEditId) els.categoryEditId.value = "";
    if (els.categoryNameInput) els.categoryNameInput.value = "";
    if (els.categoryStatusInput) els.categoryStatusInput.value = "active";
    if (els.categoryDescriptionInput) els.categoryDescriptionInput.value = "";
  }

  function renderCategories() {
    syncCategoriesFromDishes();

    const categories = getMyCategories();
    const dishes = getMyDishes();

    if (!els.categoryList) return;

    if (!categories.length) {
      els.categoryList.innerHTML = `<div class="empty-box">Aquí verás tus categorías guardadas.</div>`;
    } else {
      els.categoryList.innerHTML = categories.map((category) => {
        const total = dishes.filter(
          (dish) => (dish.category || "").toLowerCase().trim() === category.name.toLowerCase().trim()
        ).length;

        return `
          <article class="category-card">
            <h3>${escapeHtml(category.name)}</h3>
            <p>${escapeHtml(category.description || "Sin descripción")}</p>

            <div class="category-bottom">
              <span class="switch ${category.status === "active" ? "" : "no"}">
                ${category.status === "active" ? "Activa" : "Inactiva"}
              </span>
              <span class="price">${total} plato(s)</span>
            </div>

            <div class="category-actions">
              <button class="btn btn-light edit-category-btn" data-id="${escapeHtml(category.id)}" type="button">Editar</button>
              <button class="btn btn-danger delete-category-btn" data-id="${escapeHtml(category.id)}" type="button">Eliminar</button>
            </div>
          </article>
        `;
      }).join("");

      document.querySelectorAll(".edit-category-btn").forEach((button) => {
        button.addEventListener("click", () => editCategory(button.dataset.id));
      });

      document.querySelectorAll(".delete-category-btn").forEach((button) => {
        button.addEventListener("click", () => deleteCategory(button.dataset.id));
      });
    }

    renderCategoryDishAssignmentList();
    refreshDishCategorySelect();
  }

  function refreshDishCategorySelect(preferredValue = "") {
    if (!els.dishCategory) return;

    syncCategoriesFromDishes();

    const currentValue = preferredValue || els.dishCategory.value || "";
    const categories = getMyCategories().filter(
      (category) => String(category.status || "active").toLowerCase() === "active"
    );

    let options = `<option value="">Selecciona una categoría</option>`;

    if (!categories.length) {
      options += DEFAULT_CATEGORY_NAMES.map((name) => `
        <option value="${escapeHtml(name)}">${escapeHtml(name)}</option>
      `).join("");
    } else {
      options += categories.map((category) => `
        <option value="${escapeHtml(category.name)}">${escapeHtml(category.name)}</option>
      `).join("");
    }

    els.dishCategory.innerHTML = options;

    if (currentValue) {
      const exists = Array.from(els.dishCategory.options).some(
        (option) => option.value === currentValue
      );

      if (!exists) {
        els.dishCategory.insertAdjacentHTML(
          "beforeend",
          `<option value="${escapeHtml(currentValue)}">${escapeHtml(currentValue)}</option>`
        );
      }

      els.dishCategory.value = currentValue;
    }
  }

  function editCategory(categoryId) {
    const category = getMyCategories().find((item) => String(item.id) === String(categoryId));
    if (!category) return;

    if (els.categoryEditId) els.categoryEditId.value = category.id;
    if (els.categoryNameInput) els.categoryNameInput.value = category.name || "";
    if (els.categoryStatusInput) els.categoryStatusInput.value = category.status || "active";
    if (els.categoryDescriptionInput) els.categoryDescriptionInput.value = category.description || "";
    openSection("categoriesSection");
  }

  function deleteCategory(categoryId) {
    const categories = getMyCategories();
    const category = categories.find((item) => String(item.id) === String(categoryId));
    if (!category) return;

    const newCategories = categories.filter((item) => String(item.id) !== String(categoryId));
    saveMyCategories(newCategories);

    const dishes = getMyDishes().map((dish) => {
      if ((dish.category || "").toLowerCase().trim() === category.name.toLowerCase().trim()) {
        return { ...dish, category: "Otro" };
      }
      return dish;
    });

    saveMyDishes(dishes);
    renderDishList();
    renderCategories();
    clearCategoryForm();
  }

  function saveCategory(event) {
    event.preventDefault();

    const name = els.categoryNameInput?.value.trim() || "";
    const status = els.categoryStatusInput?.value || "active";
    const description = els.categoryDescriptionInput?.value.trim() || "";

    if (!name) {
      alert("Debes escribir el nombre de la categoría.");
      return;
    }

    const categories = getMyCategories();
    const editId = els.categoryEditId?.value || "";

    const duplicate = categories.find(
      (item) =>
        item.name.toLowerCase().trim() === name.toLowerCase().trim() &&
        String(item.id) !== String(editId)
    );

    if (duplicate) {
      alert("Ya existe una categoría con ese nombre.");
      return;
    }

    if (editId) {
      const oldCategory = categories.find((item) => String(item.id) === String(editId));

      const updated = categories.map((item) =>
        String(item.id) === String(editId)
          ? { ...item, name, status, description }
          : item
      );

      saveMyCategories(updated);

      if (oldCategory && oldCategory.name !== name) {
        const dishes = getMyDishes().map((dish) => {
          if ((dish.category || "").toLowerCase().trim() === oldCategory.name.toLowerCase().trim()) {
            return { ...dish, category: name };
          }
          return dish;
        });
        saveMyDishes(dishes);
      }
    } else {
      categories.push({
        id: Date.now().toString(),
        name,
        status,
        description
      });
      saveMyCategories(categories);
    }

    clearCategoryForm();
    renderDishList();
    renderCategories();
  }

  function renderCategoryDishAssignmentList() {
    if (!els.categoryDishAssignmentList) return;

    const dishes = getMyDishes();
    const categories = getMyCategories();

    if (!dishes.length) {
      els.categoryDishAssignmentList.innerHTML =
        `<div class="empty-box">Aquí aparecerán tus platos para reasignar categoría.</div>`;
      return;
    }

    els.categoryDishAssignmentList.innerHTML = dishes.map((dish) => `
      <article class="dish">
        <div class="dish-image">${escapeHtml(getDishEmoji(dish))}</div>
        <div>
          <h3>${escapeHtml(dish.name)}</h3>
          <p>Categoría actual: <strong>${escapeHtml(dish.category || "Sin categoría")}</strong></p>

          <div class="dish-actions">
            <select class="dish-category-select" data-id="${escapeHtml(dish.id)}">
              ${categories.map((category) => `
                <option value="${escapeHtml(category.name)}" ${category.name === dish.category ? "selected" : ""}>
                  ${escapeHtml(category.name)}
                </option>
              `).join("")}
            </select>

            <button class="btn btn-light save-dish-category-btn" data-id="${escapeHtml(dish.id)}" type="button">
              Actualizar categoría
            </button>
          </div>
        </div>
      </article>
    `).join("");

    document.querySelectorAll(".save-dish-category-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const dishId = button.dataset.id;
        const select = document.querySelector(`.dish-category-select[data-id="${CSS.escape(dishId)}"]`);
        if (!select) return;
        updateDishCategory(dishId, select.value);
      });
    });
  }

  function updateDishCategory(dishId, categoryName) {
    const dishes = getMyDishes().map((dish) =>
      String(dish.id) === String(dishId)
        ? { ...dish, category: categoryName }
        : dish
    );

    saveMyDishes(dishes);
    renderDishList();
    renderCategories();
  }

  /* =========================
     HOURS
  ========================= */
  function defaultHours() {
    return {
      lunes: { open: "8:00 am", close: "10:00 pm", active: true },
      martes: { open: "8:00 am", close: "10:00 pm", active: true },
      miercoles: { open: "8:00 am", close: "10:00 pm", active: true },
      jueves: { open: "8:00 am", close: "10:00 pm", active: true },
      viernes: { open: "8:00 am", close: "12:00 am", active: true },
      sabado: { open: "10:00 am", close: "12:00 am", active: true },
      domingo: { open: "Cerrado", close: "-", active: false }
    };
  }

  function getHoursMap() {
    return readJSON(HOURS_KEY, {}) || {};
  }

  function saveHoursMap(map) {
    saveJSON(HOURS_KEY, map);
  }

  function getMyHours() {
    const map = getHoursMap();
    if (!map[restaurantKey()]) {
      map[restaurantKey()] = defaultHours();
      saveHoursMap(map);
    }
    return map[restaurantKey()];
  }

  function saveMyHours(hours) {
    const map = getHoursMap();
    map[restaurantKey()] = hours;
    saveHoursMap(map);
  }

  function renderHours() {
    const hours = getMyHours();

    document.querySelectorAll(".hour-row").forEach((row) => {
      const day = row.dataset.day;
      const config = hours[day];
      if (!config) return;

      const openInput = row.querySelector(".hour-open");
      const closeInput = row.querySelector(".hour-close");
      const button = row.querySelector(".toggle-day-status-btn");
      const badge = row.querySelector(".switch");

      if (openInput) openInput.value = config.open;
      if (closeInput) closeInput.value = config.close;

      if (button) button.textContent = config.active ? "Activo" : "Inactivo";

      if (badge) {
        badge.textContent = config.active ? "Activo" : "Inactivo";
        badge.className = `switch ${config.active ? "" : "no"}`.trim();
      }
    });
  }

  function bindHoursButtons() {
    document.querySelectorAll(".toggle-day-status-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const row = button.closest(".hour-row");
        if (!row) return;
        const day = row.dataset.day;
        const hours = getMyHours();

        hours[day].active = !hours[day].active;
        saveMyHours(hours);
        renderHours();
      });
    });
  }

  function saveHoursFromUI() {
    const hours = getMyHours();

    document.querySelectorAll(".hour-row").forEach((row) => {
      const day = row.dataset.day;
      const openInput = row.querySelector(".hour-open");
      const closeInput = row.querySelector(".hour-close");

      hours[day] = {
        ...hours[day],
        open: openInput?.value.trim() || "",
        close: closeInput?.value.trim() || ""
      };
    });

    saveMyHours(hours);
    renderHours();
    alert("Horarios guardados correctamente.");
  }

  function resetHours() {
    saveMyHours(defaultHours());
    renderHours();
  }

  /* =========================
     PROMOTIONS
  ========================= */
  function getPromotionsMap() {
    return readJSON(PROMOTIONS_KEY, {}) || {};
  }

  function savePromotionsMap(map) {
    saveJSON(PROMOTIONS_KEY, map);
  }

  function getMyPromotions() {
    const map = getPromotionsMap();
    return map[restaurantKey()] || [];
  }

  function saveMyPromotions(promotions) {
    const map = getPromotionsMap();
    map[restaurantKey()] = promotions;
    savePromotionsMap(map);
  }

  function clearPromotionForm() {
    if (els.promotionId) els.promotionId.value = "";
    if (els.promotionTitle) els.promotionTitle.value = "";
    if (els.promotionType) els.promotionType.value = "discount";
    if (els.promotionValue) els.promotionValue.value = "";
    if (els.promotionStatus) els.promotionStatus.value = "active";
    if (els.promotionStartDate) els.promotionStartDate.value = "";
    if (els.promotionEndDate) els.promotionEndDate.value = "";
    if (els.promotionDescription) els.promotionDescription.value = "";
  }

  function renderPromotions() {
    const promotions = getMyPromotions();

    if (!els.promotionList) return;

    if (!promotions.length) {
      els.promotionList.innerHTML = `<div class="empty-box">Aquí aparecerán tus promociones guardadas.</div>`;
      return;
    }

    els.promotionList.innerHTML = promotions.map((promo) => `
      <article class="promo-card">
        <h3>${escapeHtml(promo.title)}</h3>
        <p>${escapeHtml(promo.description || "Sin descripción")}</p>

        <div class="promo-bottom">
          <span class="switch ${promo.status === "active" ? "" : "no"}">
            ${promo.status === "active" ? "Activa" : "Inactiva"}
          </span>
          <span class="price">${escapeHtml(promo.value || "-")}</span>
        </div>

        <p style="margin-top:10px;">
          Tipo: <strong>${escapeHtml(promo.type || "-")}</strong><br>
          Inicio: <strong>${escapeHtml(promo.startDate || "-")}</strong><br>
          Fin: <strong>${escapeHtml(promo.endDate || "-")}</strong>
        </p>

        <div class="promo-actions">
          <button class="btn btn-light edit-promo-btn" data-id="${escapeHtml(promo.id)}" type="button">Editar</button>
          <button class="btn btn-danger delete-promo-btn" data-id="${escapeHtml(promo.id)}" type="button">Eliminar</button>
        </div>
      </article>
    `).join("");

    document.querySelectorAll(".edit-promo-btn").forEach((button) => {
      button.addEventListener("click", () => editPromotion(button.dataset.id));
    });

    document.querySelectorAll(".delete-promo-btn").forEach((button) => {
      button.addEventListener("click", () => deletePromotion(button.dataset.id));
    });
  }

  function savePromotion(event) {
    event.preventDefault();

    const title = els.promotionTitle?.value.trim() || "";
    if (!title) {
      alert("Debes escribir el título de la promoción.");
      return;
    }

    const promotion = {
      id: els.promotionId?.value ? els.promotionId.value : Date.now().toString(),
      title,
      type: els.promotionType?.value || "discount",
      value: els.promotionValue?.value.trim() || "",
      status: els.promotionStatus?.value || "active",
      startDate: els.promotionStartDate?.value || "",
      endDate: els.promotionEndDate?.value || "",
      description: els.promotionDescription?.value.trim() || ""
    };

    const promotions = getMyPromotions();
    const index = promotions.findIndex((item) => String(item.id) === String(promotion.id));

    if (index >= 0) {
      promotions[index] = promotion;
    } else {
      promotions.push(promotion);
    }

    saveMyPromotions(promotions);
    clearPromotionForm();
    renderPromotions();
  }

  function editPromotion(promotionId) {
    const promo = getMyPromotions().find((item) => String(item.id) === String(promotionId));
    if (!promo) return;

    if (els.promotionId) els.promotionId.value = promo.id;
    if (els.promotionTitle) els.promotionTitle.value = promo.title || "";
    if (els.promotionType) els.promotionType.value = promo.type || "discount";
    if (els.promotionValue) els.promotionValue.value = promo.value || "";
    if (els.promotionStatus) els.promotionStatus.value = promo.status || "active";
    if (els.promotionStartDate) els.promotionStartDate.value = promo.startDate || "";
    if (els.promotionEndDate) els.promotionEndDate.value = promo.endDate || "";
    if (els.promotionDescription) els.promotionDescription.value = promo.description || "";

    openSection("promotionsSection");
  }

  function deletePromotion(promotionId) {
    const promotions = getMyPromotions().filter((item) => String(item.id) !== String(promotionId));
    saveMyPromotions(promotions);
    renderPromotions();
    clearPromotionForm();
  }

  /* =========================
     ORDERS
  ========================= */

  /* ========================================
   SONIDO DE ALERTA
   Genera un "ding" usando WebAudio
======================================== */
function playOrderSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.2;

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) {
    console.warn("No se pudo reproducir sonido:", e);
  }
}

/* ========================================
   DETECTAR PEDIDOS NUEVOS
======================================== */
function detectNewOrders(orders) {
  const currentIds = new Set(orders.map(order => String(order.id)));

  if (!hasLoadedOrdersOnce) {
    knownOrderIds = currentIds;
    hasLoadedOrdersOnce = true;
    return;
  }

  const newOrders = orders.filter(order => !knownOrderIds.has(String(order.id)));

  if (newOrders.length > 0) {
    console.log("🔔 Nuevo pedido recibido");
  }

  knownOrderIds = currentIds;
}

  function getAllLocalOrders() {
    /*
      Backend puro:
      El panel restaurante ya no lee pedidos desde backend o memoria temporal.
      Esta función se conserva solo para no romper dependencias antiguas.
    */
    return [];
  }

  function orderBelongsToRestaurant(order) {
    if (!order || typeof order !== "object") return false;

    const orderRestaurant = order.restaurant || {};
    const candidates = [
      order.restaurantEmail,
      order.restaurantName,
      order.restaurantId,
      order.restaurant,
      order.storeEmail,
      order.storeName,
      order.storeId,
      order.vendorEmail,
      order.vendorName,
      order.vendorId,
      orderRestaurant.email,
      orderRestaurant.name,
      orderRestaurant.id
    ];

    const normalizedCandidates = candidates
      .map((value) => String(value || "").trim())
      .filter(Boolean);

    return normalizedCandidates.some((value) => {
      const normalizedValue = normalizeText(value);
      return (
        normalizedValue === normalizeText(restaurantEmail) ||
        normalizedValue === normalizeText(restaurantName) ||
        normalizedValue === normalizeText(restaurantId)
      );
    });
  }

  function normalizeOrderShape(order) {
    const orderRestaurant = order.restaurant || {};

    return {
      ...order,
      id: order.id || Date.now().toString(),
      status: order.status || "pendiente",
      total: Number(order.total || 0),
      items: Array.isArray(order.items) ? order.items : [],
      customer: {
        fullName:
          order.customer?.fullName ||
          order.customer?.name ||
          order.fullName ||
          order.customerName ||
          "Cliente",
        phone:
          order.customer?.phone ||
          order.phone ||
          order.customerPhone ||
          "-",
        address:
          order.customer?.address ||
          order.address ||
          order.customerAddress ||
          "-"
      },
      restaurant: {
        email: order.restaurantEmail || orderRestaurant.email || restaurantEmail,
        name: order.restaurantName || orderRestaurant.name || restaurantName,
        id: order.restaurantId || orderRestaurant.id || restaurantId
      }
    };
  }

  async function getRestaurantOrders() {
    let orders = [];

    if (window.DELI_ORDERS && typeof window.DELI_ORDERS.getOrdersByRestaurant === "function") {
      try {
        const byEmail = await window.DELI_ORDERS.getOrdersByRestaurant(restaurantEmail);
        if (Array.isArray(byEmail) && byEmail.length) {
          orders = byEmail.map(normalizeOrderShape);
        }
      } catch (error) {
        console.warn("No se pudieron leer pedidos por email:", error);
      }
    }

    if (!orders.length) {
      /*
        No usamos fallback local para pedidos.
        Si el backend devuelve 0 pedidos, el panel debe mostrar 0 pedidos reales.
      */
      orders = [];
    }

    orders.sort((a, b) => {
      const aTime = new Date(`${a.date || ""} ${a.time || ""}`).getTime() || 0;
      const bTime = new Date(`${b.date || ""} ${b.time || ""}`).getTime() || 0;
      return bTime - aTime;
    });

    return orders;
  }

  function saveUpdatedOrderLocally(orderId, newStatus) {
    /*
      Backend puro:
      El estado de un pedido no se actualiza en backend o memoria temporal.
      La única actualización válida ocurre mediante window.DELI_ORDERS.updateOrderStatus().
      Se conserva la función para compatibilidad si algún flujo antiguo la llama.
    */
    return { orderId, newStatus };
  }

  function getOrderStatusClass(status) {
    switch (normalizeStatus(status)) {
      case "pendiente":
        return "tag tag-new";
      case "aceptado":
      case "preparando":
        return "tag tag-prep";
      case "listo":
        return "tag tag-ready";
      case "retirado":
        return "tag tag-ready";
      case "en_camino":
        return "tag tag-ready";
      case "entregado":
        return "tag";
      default:
        return "tag tag-new";
    }
  }

  function getOrderStatusLabel(status) {
    switch (normalizeStatus(status)) {
      case "pendiente":
        return "Nuevo pedido";
      case "aceptado":
        return "Aceptado";
      case "preparando":
        return "Preparando";
      case "listo":
        return "Listo para entregar";
      case "retirado":
        return "Retirado del local";
      case "en_camino":
        return "En camino";
      case "entregado":
        return "Entregado";
      default:
        return "Nuevo pedido";
    }
  }

  function renderOrdersStats(orders) {
    const pendingCount = orders.filter((order) => normalizeStatus(order.status) === "pendiente").length;
    const preparingCount = orders.filter((order) => {
      const status = normalizeStatus(order.status);
      return status === "aceptado" || status === "preparando";
    }).length;
    const readyCount = orders.filter((order) => normalizeStatus(order.status) === "listo").length;
    const enRouteCount = orders.filter((order) => ["retirado","en_camino"].includes(normalizeStatus(order.status))).length;
    const deliveredCount = orders.filter((order) => normalizeStatus(order.status) === "entregado").length;

    if (els.pendingOrdersCount) els.pendingOrdersCount.textContent = pendingCount;
    if (els.preparingOrdersCount) els.preparingOrdersCount.textContent = preparingCount;
    if (els.readyOrdersCount) els.readyOrdersCount.textContent = readyCount;
    if (els.enRouteOrdersCount) els.enRouteOrdersCount.textContent = enRouteCount;
    if (els.deliveredOrdersCount) els.deliveredOrdersCount.textContent = deliveredCount;
  }

  function getTabCounts(orders) {
    return {
      todos: orders.length,
      pendiente: orders.filter((o) => normalizeStatus(o.status) === "pendiente").length,
      aceptado: orders.filter((o) => normalizeStatus(o.status) === "aceptado").length,
      preparando: orders.filter((o) => normalizeStatus(o.status) === "preparando").length,
      listo: orders.filter((o) => normalizeStatus(o.status) === "listo").length,
      retirado: orders.filter((o) => normalizeStatus(o.status) === "retirado").length,
      en_camino: orders.filter((o) => normalizeStatus(o.status) === "en_camino").length,
      entregado: orders.filter((o) => normalizeStatus(o.status) === "entregado").length
    };
  }

  function injectTabsStyles() {
    if (document.getElementById("deli-order-tabs-style")) return;

    const style = document.createElement("style");
    style.id = "deli-order-tabs-style";
    style.textContent = `
      .deli-order-tabs{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        margin:0 0 16px 0;
      }
      .deli-order-tab{
        border:none;
        background:#f3f4f6;
        color:#111827;
        border-radius:999px;
        padding:10px 14px;
        cursor:pointer;
        font-weight:700;
        font-size:14px;
      }
      .deli-order-tab.active{
        background:var(--primary);
        color:white;
      }
      .deli-order-tab-count{
        margin-left:6px;
        opacity:.9;
      }
    `;
    document.head.appendChild(style);
  }

  function createTabsContainer() {
    injectTabsStyles();

    if (document.getElementById("deliOrderTabs")) {
      return document.getElementById("deliOrderTabs");
    }

    const tabs = document.createElement("div");
    tabs.id = "deliOrderTabs";
    tabs.className = "deli-order-tabs";

    const panelHeader = document.querySelector("#ordersSection .panel-header");
    if (panelHeader && panelHeader.parentNode) {
      panelHeader.parentNode.insertBefore(tabs, panelHeader.nextSibling);
    }

    return tabs;
  }

  function renderOrderTabs(orders) {
    const tabsContainer = createTabsContainer();
    const counts = getTabCounts(orders);

    const tabs = [
      { key: "todos", label: "Todos" },
      { key: "pendiente", label: "Pendientes" },
      { key: "aceptado", label: "Aceptados" },
      { key: "preparando", label: "En preparación" },
      { key: "listo", label: "Listos" },
      { key: "retirado", label: "Retirados del local" },
      { key: "entregado", label: "Entregados" }
    ];

    tabsContainer.innerHTML = tabs.map((tab) => `
      <button
        type="button"
        class="deli-order-tab ${activeOrderTab === tab.key ? "active" : ""}"
        data-status="${tab.key}"
      >
        ${tab.label}
        <span class="deli-order-tab-count">${counts[tab.key] || 0}</span>
      </button>
    `).join("");

    tabsContainer.querySelectorAll(".deli-order-tab").forEach((btn) => {
      btn.addEventListener("click", async () => {
        activeOrderTab = btn.dataset.status || "todos";

        if (els.orderStatusFilter) {
          els.orderStatusFilter.value = activeOrderTab;
        }

        currentOrdersPage = 1;
        await renderRestaurantOrders();
      });
    });
  }

  async function getFilteredOrders() {
    const orders = await getRestaurantOrders();
    const rawSearch = els.orderSearchInput ? els.orderSearchInput.value.toLowerCase().trim() : "";

    let statusValue = activeOrderTab;

    if (els.orderStatusFilter && els.orderStatusFilter.value) {
      statusValue = els.orderStatusFilter.value.toLowerCase();
      activeOrderTab = statusValue;
    }

    return orders.filter((order) => {
      const orderId = String(order.id || "").toLowerCase();
      const customerName = String(order.customer?.fullName || "").toLowerCase();
      const customerPhone = String(order.customer?.phone || "").toLowerCase();
      const status = normalizeStatus(order.status);
      const statusLabel = getOrderStatusLabel(status).toLowerCase();

      const matchSearch =
        !rawSearch ||
        orderId.includes(rawSearch) ||
        customerName.includes(rawSearch) ||
        customerPhone.includes(rawSearch) ||
        status.includes(rawSearch) ||
        statusLabel.includes(rawSearch);

      const matchStatus = statusValue === "todos" || status === statusValue;
      return matchSearch && matchStatus;
    });
  }

  function createLoadMoreButton(totalFiltered) {
    if (!els.ordersLoadMoreWrap) return;

    const maxVisible = currentOrdersPage * ORDERS_PER_PAGE;

    if (totalFiltered <= maxVisible) {
      els.ordersLoadMoreWrap.innerHTML = "";
      return;
    }

    els.ordersLoadMoreWrap.innerHTML = `
      <button class="btn btn-light" id="loadMoreOrdersBtn" type="button">Cargar más pedidos</button>
    `;

    document.getElementById("loadMoreOrdersBtn")?.addEventListener("click", async () => {
      currentOrdersPage += 1;
      await renderRestaurantOrders();
    });
  }

  async function renderRestaurantOrders() {
    if (!els.restaurantOrdersList) return;

     const allOrders = await getRestaurantOrders();
     detectNewOrders(allOrders);
     const filteredOrders = await getFilteredOrders();

    renderOrdersStats(allOrders);
    renderOrderTabs(allOrders);
    renderOverviewOrdersList(allOrders);

    if (!filteredOrders.length) {
      els.restaurantOrdersList.innerHTML = `<div class="empty-box">No se encontraron pedidos con ese filtro.</div>`;
      if (els.ordersLoadMoreWrap) els.ordersLoadMoreWrap.innerHTML = "";
      return;
    }

    const visibleOrders = filteredOrders.slice(0, currentOrdersPage * ORDERS_PER_PAGE);

    els.restaurantOrdersList.innerHTML = visibleOrders.map((order) => {
      const itemsHtml = (order.items || []).map((item) => {
        const itemTotal = item.subtotal || (Number(item.price || 0) * Number(item.qty || 0));
        return `<div>• ${escapeHtml(item.name)} x${escapeHtml(item.qty)} — ${formatPrice(itemTotal)}</div>`;
      }).join("");

      return `
        <article class="order-card">
          <div class="order-top">
            <div class="order-meta">
              <h3>Pedido #${escapeHtml(order.id)}</h3>
              <p>Cliente: ${escapeHtml(order.customer?.fullName || "-")}</p>
            </div>
            <span class="${getOrderStatusClass(order.status)}">${getOrderStatusLabel(order.status)}</span>
          </div>

          <div class="order-items">${itemsHtml}</div>

          <div class="order-footer" style="margin-top:8px;">
            Total: ${formatPrice(order.total)} · ${escapeHtml(order.date || "")} ${escapeHtml(order.time || "")}
          </div>

          <div class="order-footer" style="margin-top:8px;">
            Dirección: ${escapeHtml(order.customer?.address || "-")} · Teléfono: ${escapeHtml(order.customer?.phone || "-")}
          </div>

          <div class="order-actions">
            ${normalizeStatus(order.status) === "pendiente" ? `
              <button class="mini-btn accept" type="button" onclick="window.updateRestaurantOrderStatus('${escapeHtml(order.id)}', 'aceptado')">Aceptar</button>
            ` : ""}

            ${(normalizeStatus(order.status) === "aceptado" || normalizeStatus(order.status) === "pendiente") ? `
              <button class="mini-btn secondary" type="button" onclick="window.updateRestaurantOrderStatus('${escapeHtml(order.id)}', 'preparando')">Preparando</button>
            ` : ""}

            ${normalizeStatus(order.status) === "preparando" ? `
              <button class="mini-btn secondary" type="button" onclick="window.updateRestaurantOrderStatus('${escapeHtml(order.id)}', 'listo')">Marcar listo</button>
            ` : ""}

            ${normalizeStatus(order.status) === "listo" ? `
              <button class="mini-btn secondary" type="button" onclick="window.updateRestaurantOrderStatus('${escapeHtml(order.id)}', 'retirado')">Entregado al repartidor</button>
            ` : ""}

            ${normalizeStatus(order.status) === "retirado" ? `
              <button class="mini-btn secondary" type="button" disabled>Retirado del local · continúa el repartidor</button>
            ` : ""}

            ${normalizeStatus(order.status) === "entregado" ? `
              <button class="mini-btn secondary" type="button" disabled>Pedido entregado</button>
            ` : ""}
          </div>
        </article>
      `;
    }).join("");

    createLoadMoreButton(filteredOrders.length);
  }

  function renderOverviewOrdersList(orders) {
    if (!els.overviewOrdersList) return;

    const recentOrders = orders.slice(0, 2);

    if (!recentOrders.length) {
      els.overviewOrdersList.innerHTML = `<div class="empty-box">Aquí verás un resumen corto de pedidos recientes.</div>`;
      return;
    }

    els.overviewOrdersList.innerHTML = recentOrders.map((order) => `
      <article class="order-card">
        <div class="order-top">
          <div class="order-meta">
            <h3>Pedido #${escapeHtml(order.id)}</h3>
            <p>Cliente: ${escapeHtml(order.customer?.fullName || "-")}</p>
          </div>
          <span class="${getOrderStatusClass(order.status)}">${getOrderStatusLabel(order.status)}</span>
        </div>

        <div class="order-footer">
          Total: ${formatPrice(order.total)} · ${escapeHtml(order.date || "")} ${escapeHtml(order.time || "")}
        </div>
      </article>
    `).join("");
  }

  async function clearOrderFilters() {
    activeOrderTab = "todos";
    currentOrdersPage = 1;
    if (els.orderSearchInput) els.orderSearchInput.value = "";
    if (els.orderStatusFilter) els.orderStatusFilter.value = "todos";
    await renderRestaurantOrders();
  }

  
window.updateRestaurantOrderStatus = async function (orderId, newStatus) {
  /*
    CAMBIO SEGURO:
    El panel ya no actualiza el estado del pedido con un fetch directo.
    Ahora usa window.DELI_ORDERS.updateOrderStatus(), que está definido en orders.js.

    ¿Por qué?
    - orders.js ya normaliza los estados: pendiente, preparando, listo, en_camino, entregado.
    - orders.js sincroniza directamente con backend.
    - Así evitamos que el panel muestre un estado local falso o distinto al que guarda el backend.
  */

  if (!orderId) {
    console.warn("No se recibió el ID del pedido.");
    return;
  }

  if (!window.DELI_ORDERS || typeof window.DELI_ORDERS.updateOrderStatus !== "function") {
    console.warn("DELI_ORDERS.updateOrderStatus no está disponible. Revisa que orders.js esté cargado antes de panel-restaurante.js.");
    return;
  }

  try {
    const updatedOrder = await window.DELI_ORDERS.updateOrderStatus(orderId, newStatus);

    if (!updatedOrder) {
      console.warn("No se pudo confirmar la actualización del pedido.", {
        orderId,
        newStatus
      });
      return;
    }

    await renderRestaurantOrders();
    openSection("ordersSection");
  } catch (err) {
    console.error("Error actualizando pedido:", err);
  }
};



  /* =========================
     EVENTS
  ========================= */
  function bindEvents() {
    els.toggleStoreStatusBtn?.addEventListener("click", toggleStoreStatus);
    els.settingsToggleStoreBtn?.addEventListener("click", toggleStoreStatus);

    els.goPublicStore?.addEventListener("click", goToPublicStore);
    els.settingsGoPublicStoreBtn?.addEventListener("click", goToPublicStore);
    els.openPublicStorePreviewBtn?.addEventListener("click", goToPublicStore);

    els.heroGoOrdersBtn?.addEventListener("click", () => openSection("ordersSection"));

    els.orderSearchInput?.addEventListener("input", async () => {
      currentOrdersPage = 1;
      await renderRestaurantOrders();
    });

    els.orderStatusFilter?.addEventListener("change", async () => {
      activeOrderTab = els.orderStatusFilter.value.toLowerCase();
      currentOrdersPage = 1;
      await renderRestaurantOrders();
    });

    els.clearOrderFiltersBtn?.addEventListener("click", clearOrderFilters);

    els.dishForm?.addEventListener("submit", saveDish);

    els.cancelEditBtn?.addEventListener("click", clearDishForm);

    els.newDishBtn?.addEventListener("click", () => {
      clearDishForm();
      refreshDishCategorySelect();
      showDishFormSection();
    });

    els.scrollToFormBtn?.addEventListener("click", () => {
      clearDishForm();
      refreshDishCategorySelect();
      showDishFormSection();
    });

    els.categoryForm?.addEventListener("submit", saveCategory);
    els.cancelCategoryEditBtn?.addEventListener("click", clearCategoryForm);

    els.saveHoursBtn?.addEventListener("click", saveHoursFromUI);
    els.resetHoursBtn?.addEventListener("click", resetHours);

    els.promotionForm?.addEventListener("submit", savePromotion);
    els.cancelPromotionEditBtn?.addEventListener("click", clearPromotionForm);

    els.editProfileBtn?.addEventListener("click", startProfileEdit);
    els.cancelProfileEditBtn?.addEventListener("click", cancelProfileEdit);
    els.profileForm?.addEventListener("submit", saveProfile);
    els.profilePreviewBtn?.addEventListener("click", () => {
      renderStorePreview();
      openSection("settingsSection");
    });
  }

  /* =========================
     INIT
  ========================= */
  async function init() {
    isOpen = getStoreStatus();
    bindPanelNavigation();
    bindEvents();
    bindHoursButtons();
    renderStoreStatus();
    renderProfile();
    await syncMyDishesFromBackend();
    renderDishList();
    renderCategories();
    refreshDishCategorySelect();
    renderHours();
    renderPromotions();
    await renderRestaurantOrders();
    /* ========================================
      AUTO ACTUALIZACIÓN DE PEDIDOS
      Consulta el backend cada 5 segundos
    ======================================== */

    setInterval(async () => {
      try {
        await renderRestaurantOrders();
      } catch (error) {
        console.warn("Error actualizando pedidos:", error);
      }
    }, 5000);

  
    openSection(getSavedActiveSection());
  }

  init();
});








