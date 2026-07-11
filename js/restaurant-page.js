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
  const manageAddressesBtn = document.getElementById("manageAddressesBtn");

  /* ======================================================
     CAMBIO BHUZ - INVITAR COMIDA
     - Referencias DOM del nuevo flujo.
     - No reemplaza el checkout normal.
  ====================================================== */
  const orderForMeBtn = document.getElementById("orderForMeBtn");
  const inviteFoodBtn = document.getElementById("inviteFoodBtn");
  const inviteRecipientBox = document.getElementById("inviteRecipientBox");
  const inviteRecipientName = document.getElementById("inviteRecipientName");
  const inviteRecipientPhone = document.getElementById("inviteRecipientPhone");
  const inviteMessage = document.getElementById("inviteMessage");
  const inviteLinkBox = document.getElementById("inviteLinkBox");
  const inviteGeneratedLink = document.getElementById("inviteGeneratedLink");
  const copyInviteLinkBtn = document.getElementById("copyInviteLinkBtn");
  const shareInviteWhatsappBtn = document.getElementById("shareInviteWhatsappBtn");

  /* ======================================================
     CAMBIO BHUZ - INVITADOS FRECUENTES
     - Búsqueda simple y limpia.
     - No usa localStorage como fuente real.
  ====================================================== */
  const toggleSavedGuestsBtn = document.getElementById("toggleSavedGuestsBtn");
  const savedGuestsPanel = document.getElementById("savedGuestsPanel");
  const savedGuestSearchInput = document.getElementById("savedGuestSearchInput");
  const refreshSavedGuestsBtn = document.getElementById("refreshSavedGuestsBtn");
  const savedGuestsList = document.getElementById("savedGuestsList");
  const autoSaveInviteGuestCheck = document.getElementById("autoSaveInviteGuestCheck");
  const checkoutSubmitBtn = checkoutForm?.querySelector('button[type="submit"]');

  /* ======================================================
     BLOQUE 2
     CLAVES
  ====================================================== */
  // Restaurantes, platos, promociones, estados, sesión y pedidos deben venir del backend.
  const API_URL = window.DELI_API_URL || "https://deligo-backend-i554.onrender.com";

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
  const CHECKOUT_RESUME_KEY = "bhuzCheckoutResume";

  /* ======================================================
     CAMBIO BHUZ DIRECCIONES CHECKOUT
     - Direcciones guardadas desde backend.
     - GPS obligatorio para entrega.
     - No usa localStorage como fuente real.
  ====================================================== */
  let checkoutAddresses = [];
  let selectedCheckoutAddress = null;
  let checkoutGpsLocation = null;
  let checkoutDeliveryMode = "saved";

  /* ======================================================
     CAMBIO BHUZ - INVITAR COMIDA
     - self: pedido normal.
     - invite: pedido pagado/enviado por el cliente, pero la ubicación final
       la confirma el receptor desde un link público.
  ====================================================== */
  let checkoutOrderMode = "self";
  let lastGeneratedInviteUrl = "";
  let savedInviteGuests = [];
  let selectedSavedGuest = null;
  let savedGuestsPanelLoaded = false;
  let invitacionPendienteActual = null;
  let ubicacionInvitadoConfirmada = false;
  let temporizadorEstadoInvitacion = null;


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


  /* ======================================================
     CAMBIO BHUZ - INVITAR COMIDA
     Helpers del flujo de invitación.
  ====================================================== */
  function getPublicFrontendBaseUrl() {
    const origin = window.location.origin || "";
    const pathName = window.location.pathname || "";
    const basePath = pathName.includes("/")
      ? pathName.slice(0, pathName.lastIndexOf("/") + 1)
      : "/";

    return `${origin}${basePath}`;
  }

  function buildInviteShareMessage(inviteUrl, recipientName = "") {
    const currentUser = getCurrentUserSafe();
    const senderName =
      currentUser?.fullName ||
      currentUser?.name ||
      checkoutName?.value ||
      "Alguien";

    const safeRecipientName = String(recipientName || "").trim();
    const greeting = safeRecipientName ? `Hola ${safeRecipientName}. ` : "";

    return `${greeting}${senderName} te envió un pedido con BHUZ. Abre este link y comparte tu ubicación GPS para recibirlo: ${inviteUrl}`;
  }

  function setCheckoutOrderMode(mode) {
    checkoutOrderMode = mode === "invite" ? "invite" : "self";
    lastGeneratedInviteUrl = "";

    if (orderForMeBtn) {
      orderForMeBtn.classList.toggle("active", checkoutOrderMode === "self");
    }

    if (inviteFoodBtn) {
      inviteFoodBtn.classList.toggle("active", checkoutOrderMode === "invite");
    }

    if (inviteRecipientBox) {
      inviteRecipientBox.style.display = checkoutOrderMode === "invite" ? "block" : "none";
    }

    if (inviteLinkBox) {
      inviteLinkBox.style.display = "none";
    }

    if (checkoutOrderMode === "invite") {
      setCheckoutLocationStatus(
        "Modo invitar comida: la ubicación final la compartirá el receptor desde un link.",
        true
      );
    } else if (selectedCheckoutAddress) {
      selectedSavedGuest = null;
      applyCheckoutAddress(selectedCheckoutAddress);
    }
  }

  async function createDeliveryInvite(orderId, orderPayload) {
    const recipientName = String(inviteRecipientName?.value || "").trim();
    const recipientPhone = String(inviteRecipientPhone?.value || "").trim();
    const message = String(inviteMessage?.value || "").trim();

    const response = await fetch(`${API_URL}/orders/${encodeURIComponent(orderId)}/invite`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        recipientName,
        recipientPhone,
        message,
        senderName: orderPayload?.customer?.fullName || checkoutName?.value || "",
        senderEmail: orderPayload?.customer?.email || checkoutEmail?.value || "",
        frontendBaseUrl: getPublicFrontendBaseUrl(),
        saveGuestOnConfirm: Boolean(autoSaveInviteGuestCheck?.checked),
        guestAlias: recipientName || selectedSavedGuest?.alias || ""
      })
    });

    const data = await response.json();

    if (!response.ok || !data.ok || !data.invite) {
      throw new Error(data.message || "No se pudo generar el link de invitación");
    }

    return data.invite;
  }


  function limpiarInvitacionPendienteActual() {
    invitacionPendienteActual = null;
    ubicacionInvitadoConfirmada = false;

    if (temporizadorEstadoInvitacion) {
      clearInterval(temporizadorEstadoInvitacion);
      temporizadorEstadoInvitacion = null;
    }

    actualizarEstadoInvitacionPendiente("", false);

    if (checkoutSubmitBtn) {
      checkoutSubmitBtn.disabled = false;
      checkoutSubmitBtn.textContent = "Confirmar pedido";
    }
  }

  function getInviteStatusBox() {
    if (!inviteLinkBox) return null;

    let statusBox = document.getElementById("pendingInviteStatusBox");

    if (!statusBox) {
      statusBox = document.createElement("div");
      statusBox.id = "pendingInviteStatusBox";
      statusBox.className = "invite-gps-box pending-invite-status-box";
      inviteLinkBox.appendChild(statusBox);
    }

    return statusBox;
  }

  function actualizarEstadoInvitacionPendiente(message, ok = false) {
    const statusBox = getInviteStatusBox();
    if (!statusBox) return;

    if (!message) {
      statusBox.style.display = "none";
      statusBox.textContent = "";
      statusBox.classList.remove("ok");
      return;
    }

    statusBox.style.display = "block";
    statusBox.textContent = message;
    statusBox.classList.toggle("ok", Boolean(ok));
  }

  function actualizarBotonConfirmacionInvitada({ esperando = false, confirmada = false } = {}) {
    if (!checkoutSubmitBtn) return;

    if (esperando) {
      checkoutSubmitBtn.disabled = true;
      checkoutSubmitBtn.textContent = "Esperando ubicación del invitado...";
      return;
    }

    if (confirmada) {
      checkoutSubmitBtn.disabled = false;
      checkoutSubmitBtn.textContent = "✅ Confirmar pedido";
      return;
    }

    checkoutSubmitBtn.disabled = false;
    checkoutSubmitBtn.textContent = "Confirmar pedido";
  }

  async function crearInvitacionPendiente(orderPayload) {
    const recipientName = String(inviteRecipientName?.value || "").trim();
    const recipientPhone = String(inviteRecipientPhone?.value || "").trim();
    const message = String(inviteMessage?.value || "").trim();

    const response = await fetch(`${API_URL}/invitaciones-pendientes`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        recipientName,
        recipientPhone,
        message,
        senderName: orderPayload?.customer?.fullName || checkoutName?.value || "",
        senderEmail: orderPayload?.customer?.email || checkoutEmail?.value || "",
        restaurantEmail: orderPayload?.restaurantEmail || orderPayload?.restaurant?.email || "",
        restaurantName: orderPayload?.restaurantName || orderPayload?.restaurant?.name || "Restaurante",
        cart: orderPayload?.items || [],
        subtotal: orderPayload?.total || 0,
        total: orderPayload?.total || 0,
        orderPayload,
        frontendBaseUrl: getPublicFrontendBaseUrl(),
        saveGuestOnConfirm: Boolean(autoSaveInviteGuestCheck?.checked),
        guestAlias: recipientName || selectedSavedGuest?.alias || ""
      })
    });

    const data = await response.json();

    if (!response.ok || !data.ok || !data.invitacion) {
      throw new Error(data.message || "No se pudo generar la invitación pendiente");
    }

    return data.invitacion;
  }

  async function consultarEstadoInvitacionPendiente() {
    if (!invitacionPendienteActual?.id) return null;

    const response = await fetch(`${API_URL}/invitaciones-pendientes/${encodeURIComponent(invitacionPendienteActual.id)}/status?t=${Date.now()}`, {
      credentials: "include"
    });

    const data = await response.json();

    if (!response.ok || !data.ok || !data.invitacion) {
      throw new Error(data.message || "No se pudo consultar la invitación pendiente");
    }

    invitacionPendienteActual = data.invitacion;

    if (data.invitacion.status === "ubicacion_confirmada") {
      ubicacionInvitadoConfirmada = true;
      actualizarEstadoInvitacionPendiente("✅ Ubicación recibida correctamente. Ahora puedes confirmar el pedido real.", true);
      actualizarBotonConfirmacionInvitada({ confirmada: true });

      if (temporizadorEstadoInvitacion) {
        clearInterval(temporizadorEstadoInvitacion);
        temporizadorEstadoInvitacion = null;
      }
    }

    if (data.invitacion.status === "pedido_creado") {
      ubicacionInvitadoConfirmada = true;
      actualizarEstadoInvitacionPendiente("✅ Este pedido invitado ya fue creado.", true);
      actualizarBotonConfirmacionInvitada({ confirmada: true });

      if (temporizadorEstadoInvitacion) {
        clearInterval(temporizadorEstadoInvitacion);
        temporizadorEstadoInvitacion = null;
      }
    }

    return data.invitacion;
  }

  function iniciarEsperaUbicacionInvitado() {
    if (temporizadorEstadoInvitacion) {
      clearInterval(temporizadorEstadoInvitacion);
    }

    actualizarEstadoInvitacionPendiente("⏳ Link creado. Esperando que el invitado confirme su ubicación GPS...", false);
    actualizarBotonConfirmacionInvitada({ esperando: true });

    temporizadorEstadoInvitacion = setInterval(() => {
      consultarEstadoInvitacionPendiente().catch((error) => {
        console.warn("No se pudo actualizar el estado de la invitación pendiente:", error);
      });
    }, 5000);
  }

  async function crearPedidoDesdeInvitacionPendiente() {
    if (!invitacionPendienteActual?.id) {
      throw new Error("No hay una invitación pendiente activa.");
    }

    const response = await fetch(`${API_URL}/invitaciones-pendientes/${encodeURIComponent(invitacionPendienteActual.id)}/crear-pedido`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      }
    });

    const data = await response.json();

    if (!response.ok || !data.ok || !data.order) {
      throw new Error(data.message || "No se pudo crear el pedido después de confirmar ubicación");
    }

    invitacionPendienteActual = data.invitacion || invitacionPendienteActual;
    return data.order;
  }

  function showGeneratedInviteLink(invite) {
    const inviteUrl = invite?.shareUrl || invite?.url || "";

    if (!inviteUrl) return;

    lastGeneratedInviteUrl = inviteUrl;

    if (inviteGeneratedLink) {
      inviteGeneratedLink.value = inviteUrl;
    }

    if (shareInviteWhatsappBtn) {
      const message = buildInviteShareMessage(inviteUrl, invite?.recipientName || inviteRecipientName?.value || "");
      shareInviteWhatsappBtn.href = `https://wa.me/?text=${encodeURIComponent(message)}`;
    }

    if (inviteLinkBox) {
      inviteLinkBox.style.display = "block";
      inviteLinkBox.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  async function copyGeneratedInviteLink() {
    const link = lastGeneratedInviteUrl || inviteGeneratedLink?.value || "";

    if (!link) {
      alert("Todavía no hay link generado.");
      return;
    }

    try {
      await navigator.clipboard.writeText(link);
      alert("Link copiado. Ahora puedes enviarlo por WhatsApp o mensaje.");
    } catch (error) {
      if (inviteGeneratedLink) {
        inviteGeneratedLink.focus();
        inviteGeneratedLink.select();
      }
      alert("No se pudo copiar automáticamente. Copia el link manualmente.");
    }
  }


  /* ======================================================
     CAMBIO BHUZ - INVITADOS FRECUENTES
     - Carga, busca, selecciona y elimina invitados guardados.
     - Mantiene el flujo de invitar comida como link público.
  ====================================================== */
  function getCurrentCustomerEmailForGuests() {
    const currentUser = getCurrentUserSafe();
    return String(checkoutEmail?.value || currentUser?.email || "").trim().toLowerCase();
  }

  function renderSavedGuestsList(guests = []) {
    if (!savedGuestsList) return;

    if (!guests.length) {
      savedGuestsList.innerHTML = `
        <small class="checkout-helper-text">
          No hay invitados guardados con esa búsqueda. Puedes escribir uno nuevo.
        </small>
      `;
      return;
    }

    savedGuestsList.innerHTML = guests.map((guest) => `
      <div class="saved-guest-card" data-guest-id="${escapeHtml(guest.id || "")}">
        <div class="saved-guest-info">
          <strong>${escapeHtml(guest.alias || guest.recipientName || "Invitado")}</strong>
          <span>${escapeHtml(guest.recipientName || "")}${guest.recipientPhone ? " · " + escapeHtml(guest.recipientPhone) : ""}</span>
          <small>${escapeHtml(guest.reference || "Sin referencia guardada")}</small>
        </div>
        <div class="saved-guest-actions">
          <button type="button" class="helper-btn saved-guest-use-btn" data-action="use" data-guest-id="${escapeHtml(guest.id || "")}">
            Invitar de nuevo
          </button>
          <button type="button" class="helper-btn saved-guest-delete-btn" data-action="delete" data-guest-id="${escapeHtml(guest.id || "")}">
            Eliminar
          </button>
        </div>
      </div>
    `).join("");
  }

  function toggleSavedGuestsPanel(forceOpen = null) {
    if (!savedGuestsPanel) return;

    const shouldOpen = forceOpen === null
      ? savedGuestsPanel.style.display === "none"
      : Boolean(forceOpen);

    savedGuestsPanel.style.display = shouldOpen ? "block" : "none";

    if (toggleSavedGuestsBtn) {
      toggleSavedGuestsBtn.textContent = shouldOpen
        ? "Ocultar invitados guardados"
        : "Ver invitados guardados";
    }

    if (shouldOpen && !savedGuestsPanelLoaded) {
      savedGuestsPanelLoaded = true;
      loadSavedInviteGuests();
    }
  }

  async function loadSavedInviteGuests() {
    const email = getCurrentCustomerEmailForGuests();

    if (!email) {
      if (savedGuestsList) {
        savedGuestsList.innerHTML = `
          <small class="checkout-helper-text">
            Inicia sesión para ver tus invitados guardados.
          </small>
        `;
      }
      return [];
    }

    const search = String(savedGuestSearchInput?.value || "").trim();

    try {
      if (savedGuestsList) {
        savedGuestsList.innerHTML = `<small class="checkout-helper-text">Buscando invitados guardados...</small>`;
      }

      const response = await fetch(
        `${API_URL}/users/${encodeURIComponent(email)}/saved-guests?search=${encodeURIComponent(search)}&t=${Date.now()}`,
        {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json"
          }
        }
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.message || "No se pudieron cargar invitados guardados");
      }

      savedInviteGuests = Array.isArray(data.guests) ? data.guests : [];
      renderSavedGuestsList(savedInviteGuests);
      return savedInviteGuests;
    } catch (error) {
      console.warn("No se pudieron cargar invitados guardados:", error);

      if (savedGuestsList) {
        savedGuestsList.innerHTML = `
          <small class="checkout-helper-text">
            No se pudieron cargar invitados guardados. Puedes escribir uno nuevo.
          </small>
        `;
      }

      return [];
    }
  }

  function selectSavedInviteGuest(guestId) {
    const guest = savedInviteGuests.find((item) => String(item.id) === String(guestId));
    if (!guest) return;

    selectedSavedGuest = guest;

    if (inviteRecipientName) {
      inviteRecipientName.value = guest.recipientName || guest.alias || "";
    }

    if (inviteRecipientPhone) {
      inviteRecipientPhone.value = guest.recipientPhone || "";
    }

    if (inviteMessage && !inviteMessage.value.trim()) {
      inviteMessage.value = "Te envié comida con BHUZ. Abre el link y confirma tu ubicación para recibirla.";
    }

    if (savedGuestsList) {
      savedGuestsList.querySelectorAll(".saved-guest-card").forEach((card) => {
        card.classList.toggle("selected", card.dataset.guestId === String(guestId));
      });
    }

    toggleSavedGuestsPanel(false);
    alert("Invitado cargado. Al confirmar el pedido se generará un nuevo link para compartir.");
  }

  async function deleteSavedInviteGuest(guestId) {
    const email = getCurrentCustomerEmailForGuests();

    if (!email || !guestId) return;

    const guest = savedInviteGuests.find((item) => String(item.id) === String(guestId));
    const label = guest?.alias || guest?.recipientName || "este invitado";

    if (!confirm(`¿Eliminar ${label} de tus invitados guardados?`)) {
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/users/${encodeURIComponent(email)}/saved-guests/${encodeURIComponent(guestId)}`,
        {
          method: "DELETE",
          credentials: "include"
        }
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.message || "No se pudo eliminar el invitado");
      }

      savedInviteGuests = savedInviteGuests.filter((item) => String(item.id) !== String(guestId));
      renderSavedGuestsList(savedInviteGuests);

      if (selectedSavedGuest?.id === guestId) {
        selectedSavedGuest = null;
      }
    } catch (error) {
      console.error("Error eliminando invitado guardado:", error);
      alert(error.message || "No se pudo eliminar el invitado guardado.");
    }
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
     BLOQUE 11.5
     DIRECCIONES GUARDADAS + GPS PARA CHECKOUT
  ====================================================== */
  function ensureCheckoutAddressTools() {
    if (!checkoutAddress || !checkoutAddress.parentElement) return;

    const group = checkoutAddress.parentElement;

    if (!document.getElementById("checkoutAddressSelect")) {
      const select = document.createElement("select");
      select.id = "checkoutAddressSelect";
      select.style.marginTop = "10px";
      select.innerHTML = `<option value="">Selecciona una dirección guardada</option>`;
      group.insertBefore(select, restoreAddressBtn || checkoutAddress.nextSibling);

      select.addEventListener("change", () => {
        const selectedId = select.value;
        const address = checkoutAddresses.find((item) => String(item.id) === String(selectedId));
        applyCheckoutAddress(address || null);
      });
    }

    if (!document.getElementById("checkoutReference")) {
      const reference = document.createElement("textarea");
      reference.id = "checkoutReference";
      reference.placeholder = "Referencia obligatoria: casa azul, portón negro, al lado de...";
      reference.readOnly = true;
      reference.classList.add("checkout-readonly-field");
      reference.style.marginTop = "10px";
      group.insertBefore(reference, restoreAddressBtn || checkoutAddress.nextSibling);
    }

    if (!document.getElementById("checkoutGpsBtn")) {
      const gpsBtn = document.createElement("button");
      gpsBtn.id = "checkoutGpsBtn";
      gpsBtn.type = "button";
      gpsBtn.className = "helper-btn checkout-current-location-btn";
      gpsBtn.textContent = "📍 Usar mi ubicación actual";
      gpsBtn.style.marginTop = "10px";
      group.insertBefore(gpsBtn, restoreAddressBtn || checkoutAddress.nextSibling);

      gpsBtn.addEventListener("click", captureCheckoutLocation);
    }

    if (!document.getElementById("checkoutCurrentLocationInfo")) {
      const infoBox = document.createElement("div");
      infoBox.id = "checkoutCurrentLocationInfo";
      infoBox.className = "checkout-current-location-info";
      infoBox.style.display = "none";
      infoBox.innerHTML = `
        <strong>📍 Ubicación actual activa</strong>
        <span>El delivery irá al punto GPS exacto donde te encuentres ahora.</span>
      `;
      group.insertBefore(infoBox, restoreAddressBtn || checkoutAddress.nextSibling);
    }

    if (!document.getElementById("checkoutCurrentReferenceBox")) {
      const referenceBox = document.createElement("div");
      referenceBox.id = "checkoutCurrentReferenceBox";
      referenceBox.className = "checkout-current-reference-box";
      referenceBox.style.display = "none";
      referenceBox.innerHTML = `
        <label for="checkoutCurrentReference">Dirección detallada extra (opcional)</label>
        <textarea
          id="checkoutCurrentReference"
          maxlength="160"
          placeholder="Ejemplo: casa blanca con portón negro, segundo piso, apto 2A, al lado de la ferretería..."
        ></textarea>
        <small>Esta referencia no reemplaza el GPS. Solo ayuda al delivery a encontrarte más fácil.</small>
      `;
      group.insertBefore(referenceBox, restoreAddressBtn || checkoutAddress.nextSibling);
    }

    if (!document.getElementById("checkoutLocationStatus")) {
      const status = document.createElement("small");
      status.id = "checkoutLocationStatus";
      status.style.display = "block";
      status.style.marginTop = "8px";
      status.style.color = "#6b7280";
      status.textContent = "Ubicación GPS pendiente.";
      group.insertBefore(status, restoreAddressBtn || checkoutAddress.nextSibling);
    }
  }

  function getCheckoutReferenceEl() {
    return document.getElementById("checkoutReference");
  }

  function getCheckoutAddressSelectEl() {
    return document.getElementById("checkoutAddressSelect");
  }

  function getCheckoutLocationStatusEl() {
    return document.getElementById("checkoutLocationStatus");
  }

  function getCheckoutCurrentLocationInfoEl() {
    return document.getElementById("checkoutCurrentLocationInfo");
  }

  function getCheckoutCurrentReferenceBoxEl() {
    return document.getElementById("checkoutCurrentReferenceBox");
  }

  function getCheckoutCurrentReferenceEl() {
    return document.getElementById("checkoutCurrentReference");
  }

  function getCheckoutGpsBtnEl() {
    return document.getElementById("checkoutGpsBtn");
  }

  function setCheckoutCurrentLocationMode(isActive) {
    const select = getCheckoutAddressSelectEl();
    const referenceEl = getCheckoutReferenceEl();
    const currentInfo = getCheckoutCurrentLocationInfoEl();
    const currentReferenceBox = getCheckoutCurrentReferenceBoxEl();
    const gpsBtn = getCheckoutGpsBtnEl();

    if (select) {
      select.style.display = isActive ? "none" : "";
    }

    if (checkoutAddress) {
      checkoutAddress.style.display = isActive ? "none" : "";
    }

    if (referenceEl) {
      referenceEl.style.display = isActive ? "none" : "";
    }

    if (currentInfo) {
      currentInfo.style.display = isActive ? "grid" : "none";
    }

    if (currentReferenceBox) {
      currentReferenceBox.style.display = isActive ? "grid" : "none";
    }

    if (gpsBtn) {
      gpsBtn.classList.toggle("is-active", Boolean(isActive));
      gpsBtn.textContent = isActive
        ? "✅ Usando mi ubicación actual"
        : "📍 Usar mi ubicación actual";
    }
  }

  function getCurrentLocationReferenceText() {
    const extraReference = String(getCheckoutCurrentReferenceEl()?.value || "").trim();

    if (!extraReference) {
      return "Cliente usó ubicación actual en el checkout. Entregar según el GPS capturado.";
    }

    return `Cliente usó ubicación actual en el checkout. Referencia extra: ${extraReference}`;
  }

  function getUserLocationFromSession(user) {
    const lat = String(user?.location?.lat || user?.latitude || "").trim();
    const lng = String(user?.location?.lng || user?.longitude || "").trim();

    if (!lat || !lng) return null;

    return { lat, lng };
  }

  function setCheckoutLocationStatus(message, isOk = false) {
    const status = getCheckoutLocationStatusEl();
    if (!status) return;

    status.textContent = message;
    status.style.color = isOk ? "#16a34a" : "#6b7280";
  }

  function getCurrentRestaurantUrlForCheckoutReturn() {
    const url = new URL(window.location.href);
    url.searchParams.set("resumeCheckout", "1");
    return `${url.pathname.split("/").pop()}${url.search}`;
  }

  function saveCheckoutResumeState() {
    try {
      sessionStorage.setItem(CHECKOUT_RESUME_KEY, JSON.stringify({
        cart,
        savedAt: Date.now(),
        restaurantEmail: selectedRestaurant?.email || restaurantParam || ""
      }));
    } catch (error) {
      console.warn("No se pudo guardar temporalmente el carrito antes de administrar direcciones:", error);
    }
  }

  function goToProfileAddresses() {
    saveCheckoutResumeState();
    const returnTo = encodeURIComponent(getCurrentRestaurantUrlForCheckoutReturn());
    window.location.href = `perfil.html?from=checkout&returnTo=${returnTo}`;
  }

  function isDefaultCheckoutAddress(address) {
    return Boolean(address?.isDefault || address?.is_default);
  }

  function lockCheckoutIdentityFields() {
    [checkoutName, checkoutPhone, checkoutAddress, checkoutEmail, getCheckoutReferenceEl()].forEach((field) => {
      if (!field) return;
      field.setAttribute("readonly", "readonly");
      field.classList.add("checkout-readonly-field");
    });
  }

  function getDefaultCheckoutAddress() {
    return (
      checkoutAddresses.find((address) => isDefaultCheckoutAddress(address)) ||
      checkoutAddresses[0] ||
      null
    );
  }

  function applyCheckoutAddress(address) {
    selectedCheckoutAddress = address || null;
    checkoutDeliveryMode = "saved";
    setCheckoutCurrentLocationMode(false);

    if (!address) return;

    if (checkoutAddress) {
      checkoutAddress.value = address.address || "";
    }

    const referenceEl = getCheckoutReferenceEl();
    if (referenceEl) {
      referenceEl.value = address.reference || "";
    }

    checkoutGpsLocation = {
      lat: String(address.latitude || address.location?.lat || "").trim(),
      lng: String(address.longitude || address.location?.lng || "").trim()
    };

    if (checkoutGpsLocation.lat && checkoutGpsLocation.lng) {
      setCheckoutLocationStatus("✅ Ubicación GPS cargada desde tu dirección guardada.", true);
    } else {
      setCheckoutLocationStatus("Ubicación GPS pendiente para esta dirección.", false);
    }
  }

  function renderCheckoutAddresses() {
    const select = getCheckoutAddressSelectEl();
    if (!select) return;

    select.innerHTML = `<option value="">Selecciona una dirección guardada</option>`;

    checkoutAddresses.forEach((address) => {
      const option = document.createElement("option");
      option.value = address.id;
      option.textContent = `${address.label || "Dirección"}${isDefaultCheckoutAddress(address) ? " · Principal" : ""} - ${address.address || "Sin dirección"}`;
      select.appendChild(option);
    });

    const defaultAddress = getDefaultCheckoutAddress();

    if (defaultAddress) {
      select.value = defaultAddress.id;
      applyCheckoutAddress(defaultAddress);
      return;
    }

    setCheckoutLocationStatus("No tienes direcciones guardadas. Administra tus direcciones desde tu perfil.", false);
  }

  async function loadCheckoutAddresses() {
    const currentUser = getCurrentUserSafe();
    const email = normalizeText(currentUser?.email || checkoutEmail?.value || "");

    checkoutAddresses = [];
    selectedCheckoutAddress = null;

    if (!email) {
      renderCheckoutAddresses();
      return [];
    }

    try {
      const response = await fetch(`${API_URL}/users/${encodeURIComponent(email)}/addresses`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        }
      });

      const data = await response.json();

      if (response.ok && data.ok && Array.isArray(data.addresses)) {
        checkoutAddresses = data.addresses;
      }
    } catch (error) {
      console.warn("No se pudieron cargar las direcciones guardadas:", error);
    }

    renderCheckoutAddresses();
    return checkoutAddresses;
  }

  async function captureCheckoutLocation() {
    if (!navigator.geolocation) {
      alert("Tu navegador no permite obtener ubicación GPS.");
      return null;
    }

    setCheckoutLocationStatus("Solicitando ubicación GPS...", false);

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          checkoutGpsLocation = {
            lat: String(position.coords.latitude),
            lng: String(position.coords.longitude)
          };

          /* ======================================================
             CAMBIO BHUZ - UBICACIÓN ACTUAL SIN CONFUSIÓN
             - Si el cliente decide usar su GPS actual, el pedido ya NO debe
               mostrar como entrega la dirección guardada del perfil.
             - Dejamos claro al restaurante/repartidor que la entrega se guía
               por el GPS capturado en este momento.
          ====================================================== */
          checkoutDeliveryMode = "current_gps";
          selectedCheckoutAddress = null;

          const select = getCheckoutAddressSelectEl();
          if (select) select.value = "";

          if (checkoutAddress) {
            checkoutAddress.value = "Ubicación actual compartida por GPS. No usar dirección guardada del perfil.";
          }

          const referenceEl = getCheckoutReferenceEl();
          if (referenceEl) {
            referenceEl.value = "Cliente usó ubicación actual en el checkout. Entregar según el GPS capturado.";
          }

          setCheckoutCurrentLocationMode(true);
          setCheckoutLocationStatus("✅ Ubicación actual activa. Puedes agregar una referencia extra opcional.", true);
          resolve(checkoutGpsLocation);
        },
        (error) => {
          console.warn("No se pudo obtener ubicación GPS:", error);
          setCheckoutLocationStatus("No se pudo obtener ubicación. Debes permitir el GPS para entregar el pedido.", false);
          alert("No se pudo obtener tu ubicación. Permite el GPS para confirmar el pedido.");
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 0
        }
      );
    });
  }

  /* ======================================================
     BLOQUE 12
     CHECKOUT
  ====================================================== */
  async function fillCheckoutUserData() {
    ensureCheckoutAddressTools();
    lockCheckoutIdentityFields();

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

    const referenceEl = getCheckoutReferenceEl();
    if (referenceEl) {
      referenceEl.value = currentUser.reference || "";
    }

    const sessionLocation = getUserLocationFromSession(currentUser);
    if (sessionLocation) {
      checkoutGpsLocation = sessionLocation;
      setCheckoutLocationStatus("✅ Ubicación GPS cargada desde tu cuenta.", true);
    }

    await loadCheckoutAddresses();
  }

  async function openCheckout() {
    if (!checkoutModal || !cart.length) return;

    await fillCheckoutUserData();

    const currentUser = getCurrentUserSafe();
    if (currentUser && !checkoutAddresses.length && !String(currentUser.address || "").trim()) {
      alert("Agrega una dirección en tu perfil antes de confirmar un pedido.");
      goToProfileAddresses();
      return;
    }

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
    const isInviteOrder = checkoutOrderMode === "invite";
    const finalCustomerAddress =
      isInviteOrder
        ? "Pendiente: el receptor debe compartir su ubicación desde el link BHUZ."
        : checkoutDeliveryMode === "current_gps"
          ? "Ubicación actual compartida por GPS. No usar dirección guardada del perfil."
          : (checkoutAddress?.value.trim() || currentUser?.address || "");
    const finalCustomerEmail =
      checkoutEmail?.value.trim() || currentUser?.email || "";
    const finalCustomerReference =
      isInviteOrder
        ? "Pendiente: el receptor debe escribir referencia al compartir su GPS."
        : checkoutDeliveryMode === "current_gps"
          ? getCurrentLocationReferenceText()
          : (getCheckoutReferenceEl()?.value.trim() || selectedCheckoutAddress?.reference || currentUser?.reference || "");

    const finalLocation = isInviteOrder
      ? null
      : (checkoutGpsLocation || getUserLocationFromSession(currentUser));
    const finalLatitude = String(finalLocation?.lat || "").trim();
    const finalLongitude = String(finalLocation?.lng || "").trim();

    if (!finalCustomerName || !finalCustomerPhone || !finalCustomerAddress || !finalCustomerEmail) {
      alert("Completa nombre, teléfono, dirección y correo para confirmar el pedido.");
      return;
    }

    if (isInviteOrder) {
      if (!String(inviteRecipientName?.value || "").trim()) {
        alert("Escribe el nombre de la persona que recibirá la comida.");
        return;
      }
    } else {
      if (!finalCustomerReference) {
        alert("Agrega una referencia de entrega. Ejemplo: casa azul, portón negro, al lado de...");
        return;
      }

      if (!finalLatitude || !finalLongitude) {
        alert("Debes usar o cargar una ubicación GPS para que el repartidor llegue exacto.");
        return;
      }
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
      deliveryMode: isInviteOrder ? "invite_pending_location" : checkoutDeliveryMode,
      orderMode: isInviteOrder ? "invite" : "self",
      invited: isInviteOrder,
      invitedRecipientName: isInviteOrder ? String(inviteRecipientName?.value || "").trim() : "",
      invitedRecipientPhone: isInviteOrder ? String(inviteRecipientPhone?.value || "").trim() : "",
      invitedMessage: isInviteOrder ? String(inviteMessage?.value || "").trim() : "",
      deliveryAddress: finalCustomerAddress,
      deliveryReference: finalCustomerReference,
      latitude: finalLatitude,
      longitude: finalLongitude,
      location: {
        lat: finalLatitude,
        lng: finalLongitude
      },
      customer: {
        fullName: finalCustomerName,
        phone: finalCustomerPhone,
        address: finalCustomerAddress,
        email: finalCustomerEmail,
        reference: finalCustomerReference,
        deliveryMode: isInviteOrder ? "invite_pending_location" : checkoutDeliveryMode,
        orderMode: isInviteOrder ? "invite" : "self",
        invited: isInviteOrder,
        location: {
          lat: finalLatitude,
          lng: finalLongitude
        }
      }
    };

    console.log("Pedido enviado al backend:", order);

    let created = null;

    if (isInviteOrder) {
      if (invitacionPendienteActual && !ubicacionInvitadoConfirmada) {
        alert("Todavía estamos esperando que la persona invitada confirme su ubicación GPS.");
        return;
      }

      if (invitacionPendienteActual && ubicacionInvitadoConfirmada) {
        try {
          actualizarBotonConfirmacionInvitada({ esperando: true });
          created = await crearPedidoDesdeInvitacionPendiente();
        } catch (error) {
          console.error("No se pudo crear el pedido desde la invitación pendiente:", error);
          alert(error.message || "No se pudo crear el pedido después de recibir la ubicación.");
          actualizarBotonConfirmacionInvitada({ confirmada: true });
          return;
        }
      } else {
        try {
          invitacionPendienteActual = await crearInvitacionPendiente(order);
          ubicacionInvitadoConfirmada = false;
          showGeneratedInviteLink(invitacionPendienteActual);
          iniciarEsperaUbicacionInvitado();
          alert("Link creado. Compártelo con la persona invitada. El pedido real se creará cuando confirme su ubicación y tú toques Confirmar pedido.");
        } catch (error) {
          console.error("No se pudo generar la invitación pendiente BHUZ:", error);
          alert(error.message || "No se pudo generar el link de invitación.");
        }
        return;
      }
    } else {
      created = await saveOrder(order);
    }

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

    if (!isInviteOrder) {
      window.closeCheckout();
    }

    /* ======================================================
       CAMBIO BHUZ LIVE GLOBAL
       - Después de crear el pedido en backend, guardamos un resumen temporal
         para que index.html muestre la tarjeta premium del último pedido.
       - NO se guarda como fuente real de pedidos.
       - NO toca carrito, checkout, PostgreSQL ni endpoints.
    ====================================================== */
    try {
      const createdOrderSummary = {
        id: created.id || order.id,
        restaurantName: created.restaurantName || created.restaurant?.name || restaurantDisplayName || "BHUZ",
        status: created.status || "pendiente",
        total: Number(created.total || order.total || 0),
        items: Array.isArray(created.items) && created.items.length ? created.items : order.items,
        createdAt: created.createdAt || new Date().toISOString()
      };

      sessionStorage.setItem("bhuzLastCreatedOrder", JSON.stringify(createdOrderSummary));
      sessionStorage.setItem("bhuzLastOrderSummary", JSON.stringify(createdOrderSummary));

      window.dispatchEvent(new CustomEvent("bhuz:order-created", {
        detail: { order: createdOrderSummary }
      }));
    } catch (error) {
      console.warn("No se pudo preparar el resumen del último pedido:", error);
    }

    const createdOrderId = encodeURIComponent(created.id || order.id || "");

    if (isInviteOrder) {
      limpiarInvitacionPendienteActual();
      window.closeCheckout();
    }

    window.location.href = `index.html?orderSuccess=1&orderId=${createdOrderId}`;
  }


  async function restoreCheckoutAfterProfileReturn() {
    const shouldResume = params.get("resumeCheckout") === "1";
    if (!shouldResume) return;

    let saved = null;

    try {
      saved = JSON.parse(sessionStorage.getItem(CHECKOUT_RESUME_KEY) || "null");
    } catch (error) {
      saved = null;
    }

    if (!saved || !Array.isArray(saved.cart) || !saved.cart.length) {
      return;
    }

    cart = saved.cart
      .map((item) => ({
        id: item.id,
        name: item.name,
        price: Number(item.price || 0),
        qty: Number(item.qty || 1)
      }))
      .filter((item) => item.name && item.qty > 0);

    renderMenu();
    renderCart();
    renderCartPanel();

    await openCheckout();

    try {
      sessionStorage.removeItem(CHECKOUT_RESUME_KEY);
    } catch (error) {
      console.warn("No se pudo limpiar el carrito temporal:", error);
    }

    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("resumeCheckout");
    window.history.replaceState({}, document.title, cleanUrl.toString());
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
    autoAddDishFromURL();
    await restoreCheckoutAfterProfileReturn();
    if (params.get("resumeCheckout") !== "1") {
      fillCheckoutUserData();
    }
  }

  /* ======================================================
     BLOQUE 16
     EVENTOS
  ====================================================== */
  cartEl?.addEventListener("click", openCartPanel);

  checkoutForm?.addEventListener("submit", handleCheckoutSubmit);

  manageAddressesBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    goToProfileAddresses();
  });

  restoreAddressBtn?.addEventListener("click", async () => {
    await loadCheckoutAddresses();

    const defaultAddress = getDefaultCheckoutAddress();

    if (!defaultAddress) {
      alert("No tienes una dirección guardada. Agrega una dirección en tu perfil para poder pedir.");
      goToProfileAddresses();
      return;
    }

    const select = getCheckoutAddressSelectEl();
    if (select) select.value = defaultAddress.id;
    applyCheckoutAddress(defaultAddress);
  });

  orderForMeBtn?.addEventListener("click", () => {
    setCheckoutOrderMode("self");
  });

  inviteFoodBtn?.addEventListener("click", () => {
    setCheckoutOrderMode("invite");
  });

  copyInviteLinkBtn?.addEventListener("click", copyGeneratedInviteLink);

  toggleSavedGuestsBtn?.addEventListener("click", () => {
    toggleSavedGuestsPanel();
  });

  refreshSavedGuestsBtn?.addEventListener("click", () => {
    savedGuestsPanelLoaded = true;
    loadSavedInviteGuests();
  });

  savedGuestSearchInput?.addEventListener("input", () => {
    window.clearTimeout(savedGuestSearchInput._bhuzSearchTimer);
    savedGuestSearchInput._bhuzSearchTimer = window.setTimeout(loadSavedInviteGuests, 350);
  });

  savedGuestsList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action][data-guest-id]");
    if (!button) return;

    const action = button.dataset.action;
    const guestId = button.dataset.guestId;

    if (action === "use") {
      selectSavedInviteGuest(guestId);
    }

    if (action === "delete") {
      deleteSavedInviteGuest(guestId);
    }
  });

  checkoutModal?.addEventListener("click", (event) => {
    if (event.target === checkoutModal) {
      window.closeCheckout();
    }
  });

  init();
});


