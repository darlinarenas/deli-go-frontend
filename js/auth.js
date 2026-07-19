/* =========================================================
   BHUZ
   AUTH.JS

   AUTENTICACIÓN CON BACKEND
   - Registro cliente
   - Registro restaurante
   - Login
   - Sesión actual validada por backend con cookie HTTP-only
   - Logout centralizado
========================================================= */

/* =========================================================
   CONFIGURACIÓN BACKEND
========================================================= */
const AUTH_API_URL = window.DELI_API_URL || "https://deligo-backend-i554.onrender.com";
const AUTH_SESSION_KEY = "deliCurrentUserSession";

/* =========================================================
   ELEMENTOS DOM
========================================================= */
const registerScreen = document.getElementById("registerScreen");
const loginScreen = document.getElementById("loginScreen");
const restaurantRegisterScreen = document.getElementById("restaurantRegisterScreen");

/* REGISTRO CLIENTE */
const fullNameInput = document.getElementById("fullName");
const addressInput = document.getElementById("address");
const phoneInput = document.getElementById("phone");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirmPassword");
const messageEl = document.getElementById("message");

/* =========================================================
   REGISTRO CLIENTE - DIRECCIÓN + GPS OBLIGATORIO
   - Estado temporal de la ubicación capturada desde el navegador.
   - No usa localStorage como fuente de datos.
========================================================= */
let customerGpsLocation = null;

/* LOGIN */
const loginRoleInput = document.getElementById("loginRole");
const loginEmailInput = document.getElementById("loginEmail");
const loginPasswordInput = document.getElementById("loginPassword");
const loginMessageEl = document.getElementById("loginMessage");

/* REGISTRO RESTAURANTE */
const restaurantNameInput = document.getElementById("restaurantName");
const restaurantAddressInput = document.getElementById("restaurantAddress");
const restaurantPhoneInput = document.getElementById("restaurantPhone");
const restaurantEmailInput = document.getElementById("restaurantEmail");
const restaurantPasswordInput = document.getElementById("restaurantPassword");
const restaurantConfirmPasswordInput = document.getElementById("restaurantConfirmPassword");
const restaurantMessageEl = document.getElementById("restaurantMessage");

/* =========================================================
   SESIÓN EN MEMORIA DE LA PÁGINA
========================================================= */
window.DELI_CURRENT_USER = null;
window.DELI_SESSION_READY = false;

function emitSessionReady() {
  window.dispatchEvent(
    new CustomEvent("deli:session-ready", {
      detail: {
        user: window.DELI_CURRENT_USER
      }
    })
  );
}

function getCurrentUser() {
  return window.DELI_CURRENT_USER || null;
}

function setCurrentUser(user) {
  window.DELI_CURRENT_USER = user || null;

  /*
    CACHÉ TEMPORAL DE SESIÓN:
    - No guarda pedidos, restaurantes ni información operativa.
    - Solo conserva el usuario autenticado para restaurar la sesión.
    - Usa localStorage porque Safari y la PWA instalada en iPhone
      pueden abrirse en ventanas distintas y no compartir sessionStorage.
  */
  try {
    if (user) {
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(user));
      sessionStorage.removeItem(AUTH_SESSION_KEY);
    } else {
      localStorage.removeItem(AUTH_SESSION_KEY);
      sessionStorage.removeItem(AUTH_SESSION_KEY);
    }
  } catch (error) {
    console.warn("No se pudo guardar la sesión temporal:", error);
  }

  window.DELI_SESSION_READY = true;
  emitSessionReady();
}

function clearCurrentUser() {
  window.DELI_CURRENT_USER = null;

  try {
    localStorage.removeItem(AUTH_SESSION_KEY);
    sessionStorage.removeItem(AUTH_SESSION_KEY);
  } catch (error) {
    console.warn("No se pudo limpiar la sesión temporal:", error);
  }

  window.DELI_SESSION_READY = true;
  emitSessionReady();
}

async function loadCurrentSession() {
  /*
    PRODUCCIÓN ACTUAL:
    El backend real todavía no tiene ruta /session.
    Mientras se implementa una sesión 100% backend, se restaura únicamente
    la identidad temporal del usuario.

    Compatibilidad:
    - Primero busca en localStorage, que funciona mejor entre Safari y la PWA.
    - Si encuentra una sesión antigua en sessionStorage, la migra automáticamente.
  */
  try {
    let saved = localStorage.getItem(AUTH_SESSION_KEY);

    if (!saved) {
      const legacySaved = sessionStorage.getItem(AUTH_SESSION_KEY);

      if (legacySaved) {
        saved = legacySaved;
        localStorage.setItem(AUTH_SESSION_KEY, legacySaved);
        sessionStorage.removeItem(AUTH_SESSION_KEY);
      }
    }

    if (saved) {
      const user = JSON.parse(saved);
      window.DELI_CURRENT_USER = user || null;
    } else {
      window.DELI_CURRENT_USER = null;
    }
  } catch (error) {
    console.warn("No se pudo restaurar la sesión temporal:", error);
    window.DELI_CURRENT_USER = null;

    try {
      localStorage.removeItem(AUTH_SESSION_KEY);
      sessionStorage.removeItem(AUTH_SESSION_KEY);
    } catch (_) {}
  }

  window.DELI_SESSION_READY = true;
  emitSessionReady();
  return getCurrentUser();
}

/* =========================================================
   HELPERS
========================================================= */
function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

function normalizeRole(role) {
  const value = String(role || "").trim().toLowerCase();

  if (value === "restaurant" || value === "restaurante") {
    return "restaurant";
  }

  if (value === "customer" || value === "cliente") {
    return "customer";
  }

  return "customer";
}


/* =========================================================
   HELPERS REGISTRO CLIENTE - DIRECCIÓN + GPS
   - Inserta campos sin tocar el HTML base.
   - Funciona en index.html y restaurant.html porque ambos usan los mismos IDs.
========================================================= */
function getCustomerReferenceInput() {
  return document.getElementById("reference");
}

function getCustomerLocationStatus() {
  return document.getElementById("customerLocationStatus");
}

function getCustomerLocationButton() {
  return document.getElementById("customerLocationBtn");
}

function updateCustomerLocationStatus(message, isOk = false) {
  const status = getCustomerLocationStatus();

  if (!status) return;

  status.textContent = message || "";
  status.style.color = isOk ? "#00a846" : "#ef4444";
}

function setCustomerLocationButtonLoading(isLoading) {
  const button = getCustomerLocationButton();

  if (!button) return;

  button.disabled = Boolean(isLoading);
  button.textContent = isLoading
    ? "📍 Obteniendo ubicación..."
    : customerGpsLocation
      ? "✅ Ubicación capturada"
      : "📍 Usar mi ubicación";
}

function requestCustomerLocation() {
  if (!navigator.geolocation) {
    customerGpsLocation = null;
    updateCustomerLocationStatus(
      "Tu navegador no permite obtener ubicación GPS.",
      false
    );
    return;
  }

  setCustomerLocationButtonLoading(true);
  updateCustomerLocationStatus(
    "Acepta el permiso de ubicación para guardar tu dirección correctamente.",
    false
  );

  navigator.geolocation.getCurrentPosition(
    (position) => {
      customerGpsLocation = {
        lat: String(position.coords.latitude),
        lng: String(position.coords.longitude)
      };

      setCustomerLocationButtonLoading(false);
      updateCustomerLocationStatus(
        "Ubicación GPS capturada correctamente.",
        true
      );
    },
    (error) => {
      customerGpsLocation = null;
      setCustomerLocationButtonLoading(false);

      let message = "No se pudo obtener la ubicación. Debes permitir el GPS para registrarte.";

      if (error && error.code === 1) {
        message = "Permiso de ubicación rechazado. Activa el GPS para poder registrarte.";
      }

      if (error && error.code === 2) {
        message = "No se pudo detectar tu ubicación. Revisa el GPS o la señal del teléfono.";
      }

      if (error && error.code === 3) {
        message = "La ubicación tardó demasiado. Intenta nuevamente.";
      }

      updateCustomerLocationStatus(message, false);
    },
    {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 0
    }
  );
}

function ensureCustomerAddressFields() {
  if (!addressInput) return;

  const formContainer = addressInput.parentElement;
  if (!formContainer) return;

  if (!getCustomerReferenceInput()) {
    const referenceInput = document.createElement("textarea");
    referenceInput.id = "reference";
    referenceInput.placeholder = "Referencia de entrega: color de casa, punto cercano, piso, local, etc.";
    referenceInput.rows = 3;
    referenceInput.style.width = "100%";
    referenceInput.style.resize = "vertical";
    referenceInput.style.minHeight = "74px";
    referenceInput.style.marginTop = "8px";

    addressInput.insertAdjacentElement("afterend", referenceInput);
  }

  if (!getCustomerLocationButton()) {
    const locationButton = document.createElement("button");
    locationButton.id = "customerLocationBtn";
    locationButton.type = "button";
    locationButton.textContent = "📍 Usar mi ubicación";
    locationButton.style.marginTop = "8px";
    locationButton.style.width = "100%";
    locationButton.style.border = "0";
    locationButton.style.borderRadius = "12px";
    locationButton.style.padding = "12px 14px";
    locationButton.style.fontWeight = "800";
    locationButton.style.cursor = "pointer";
    locationButton.style.background = "#00c853";
    locationButton.style.color = "#ffffff";
    locationButton.addEventListener("click", requestCustomerLocation);

    const referenceInput = getCustomerReferenceInput();
    if (referenceInput) {
      referenceInput.insertAdjacentElement("afterend", locationButton);
    } else {
      addressInput.insertAdjacentElement("afterend", locationButton);
    }
  }

  if (!getCustomerLocationStatus()) {
    const status = document.createElement("p");
    status.id = "customerLocationStatus";
    status.textContent = "La ubicación GPS es obligatoria para registrar una dirección exacta.";
    status.style.margin = "8px 0 0";
    status.style.fontSize = "0.86rem";
    status.style.lineHeight = "1.35";
    status.style.color = "#6b7280";

    const locationButton = getCustomerLocationButton();
    if (locationButton) {
      locationButton.insertAdjacentElement("afterend", status);
    }
  }
}

function getCustomerRegistrationLocation() {
  if (!customerGpsLocation || !customerGpsLocation.lat || !customerGpsLocation.lng) {
    return null;
  }

  return {
    lat: customerGpsLocation.lat,
    lng: customerGpsLocation.lng
  };
}

function getRestaurantPanelUrl() {
  return "panel-restaurant.html";
}

function getPageName() {
  const path = window.location.pathname.split("/").pop();
  return path || "index.html";
}

function isRestaurantPanelPage() {
  const page = getPageName();
  return page === "panel-restaurant.html" || page === "panel-restaurante.html";
}

async function postToBackend(endpoint, payload) {
  const res = await fetch(`${AUTH_API_URL}${endpoint}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const raw = await res.text();
  let data = {};

  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {
      message: raw || "Respuesta no válida del backend"
    };
  }

  return { res, data };
}

async function getRestaurantsFromBackendSafe() {
  try {
    const res = await fetch(`${AUTH_API_URL}/restaurants`, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      }
    });

    if (!res.ok) return [];

    const data = await res.json();

    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.restaurants)) return data.restaurants;

    return [];
  } catch (error) {
    console.warn("No se pudo validar el restaurante contra backend:", error);
    return [];
  }
}

function normalizeStatus(status) {
  return String(status || "pending").trim().toLowerCase();
}

async function getRestaurantApprovalStatusByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return "pending";

  const backendRestaurants = await getRestaurantsFromBackendSafe();

  const restaurant = backendRestaurants.find((item) => {
    return normalizeEmail(item?.email) === normalizedEmail;
  });

  if (!restaurant) return "pending";

  return normalizeStatus(restaurant.status);
}

/* =========================================================
   MODALES
========================================================= */
function showRegister() {
  ensureCustomerAddressFields();

  if (registerScreen) {
    registerScreen.style.display = "flex";
  }
}

function closeRegister() {
  if (registerScreen) {
    registerScreen.style.display = "none";
  }
}

function showLogin(role = "customer") {
  if (loginScreen) {
    loginScreen.style.display = "flex";
  }

  if (loginRoleInput) {
    loginRoleInput.value = normalizeRole(role);
  }

  if (loginMessageEl) {
    loginMessageEl.textContent = "";
  }
}

function closeLogin() {
  if (loginScreen) {
    loginScreen.style.display = "none";
  }
}

function showRestaurantRegister() {
  if (restaurantRegisterScreen) {
    restaurantRegisterScreen.style.display = "flex";
  }
}

function closeRestaurantRegister() {
  if (restaurantRegisterScreen) {
    restaurantRegisterScreen.style.display = "none";
  }
}

/* =========================================================
   REGISTRO CLIENTE
========================================================= */
async function registerUser() {
  ensureCustomerAddressFields();

  const fullName = fullNameInput ? fullNameInput.value.trim() : "";
  const address = addressInput ? addressInput.value.trim() : "";
  const referenceInput = getCustomerReferenceInput();
  const reference = referenceInput ? referenceInput.value.trim() : "";
  const phone = phoneInput ? phoneInput.value.trim() : "";
  const email = emailInput ? normalizeEmail(emailInput.value) : "";
  const password = passwordInput ? passwordInput.value : "";
  const confirm = confirmPasswordInput ? confirmPasswordInput.value : "";
  const location = getCustomerRegistrationLocation();

  if (!fullName || !address || !reference || !phone || !email || !password || !confirm) {
    if (messageEl) {
      messageEl.textContent = "Completa todos los campos, incluyendo referencia de entrega";
    }
    return;
  }

  if (!location) {
    if (messageEl) {
      messageEl.textContent = "Debes tocar 'Usar mi ubicación' y permitir el GPS para registrarte";
    }

    updateCustomerLocationStatus(
      "La ubicación GPS es obligatoria para que el repartidor llegue exactamente.",
      false
    );
    return;
  }

  if (password !== confirm) {
    if (messageEl) {
      messageEl.textContent = "Las contraseñas no coinciden";
    }
    return;
  }

  try {
    const { res, data } = await postToBackend("/register", {
      fullName,
      address,
      reference,
      phone,
      email,
      password,
      location
    });

    if (!res.ok) {
      if (messageEl) {
        messageEl.textContent = data.message || "Error al registrar";
      }
      return;
    }

    const loginResult = await postToBackend("/login", {
      role: "customer",
      email,
      password
    });

    if (loginResult.res.ok) {
      const user = {
        ...loginResult.data.user,
        role: "customer"
      };
      setCurrentUser(user);
    }

    closeRegister();
    window.location.reload();
  } catch (err) {
    console.error(err);

    if (messageEl) {
      messageEl.textContent = "No se pudo conectar con el backend";
    }
  }
}

/* =========================================================
   REGISTRO RESTAURANTE
========================================================= */
async function registerRestaurant() {
  const name = restaurantNameInput ? restaurantNameInput.value.trim() : "";
  const address = restaurantAddressInput ? restaurantAddressInput.value.trim() : "";
  const phone = restaurantPhoneInput ? restaurantPhoneInput.value.trim() : "";
  const email = restaurantEmailInput ? normalizeEmail(restaurantEmailInput.value) : "";
  const password = restaurantPasswordInput ? restaurantPasswordInput.value : "";
  const confirm = restaurantConfirmPasswordInput ? restaurantConfirmPasswordInput.value : "";

  if (!name || !address || !phone || !email || !password || !confirm) {
    if (restaurantMessageEl) {
      restaurantMessageEl.textContent = "Completa todos los campos";
    }
    return;
  }

  if (password !== confirm) {
    if (restaurantMessageEl) {
      restaurantMessageEl.textContent = "Las contraseñas no coinciden";
    }
    return;
  }

  try {
    const { res, data } = await postToBackend("/register-restaurant", {
      name,
      address,
      phone,
      email,
      password
    });

    if (!res.ok) {
      if (restaurantMessageEl) {
        restaurantMessageEl.textContent = data.message || "Error al registrar restaurante";
      }
      return;
    }

    if (restaurantMessageEl) {
      restaurantMessageEl.textContent = "Restaurante registrado correctamente. Queda pendiente de aprobación administrativa.";
    }

    setTimeout(() => {
      closeRestaurantRegister();
    }, 1200);
  } catch (err) {
    console.error(err);

    if (restaurantMessageEl) {
      restaurantMessageEl.textContent = "Error de conexión";
    }
  }
}

/* =========================================================
   LOGIN
========================================================= */
async function loginUser() {
  const role = normalizeRole(loginRoleInput ? loginRoleInput.value : "customer");
  const email = loginEmailInput ? normalizeEmail(loginEmailInput.value) : "";
  const password = loginPasswordInput ? loginPasswordInput.value : "";

  if (!email || !password) {
    if (loginMessageEl) {
      loginMessageEl.textContent = "Completa correo y contraseña";
    }
    return;
  }

  try {
    const { res, data } = await postToBackend("/login", {
      role,
      email,
      password
    });

    if (!res.ok) {
      if (loginMessageEl) {
        loginMessageEl.textContent = data.message || "Error al iniciar sesión";
      }
      return;
    }

    const user = {
      ...data.user,
      role
    };

    if (role === "restaurant") {
      const approvalStatus = await getRestaurantApprovalStatusByEmail(email);

      if (approvalStatus !== "approved") {
        clearCurrentUser();

        if (loginMessageEl) {
          loginMessageEl.textContent =
            approvalStatus === "blocked"
              ? "Tu restaurante está bloqueado. Contacta con DELI GO."
              : "Tu restaurante está pendiente de aprobación administrativa.";
        }

        return;
      }

      user.status = approvalStatus;
    }

    setCurrentUser(user);
    closeLogin();

    if (role === "restaurant") {
      window.location.href = getRestaurantPanelUrl();
    } else {
      window.location.reload();
    }
  } catch (err) {
    console.error(err);

    if (loginMessageEl) {
      loginMessageEl.textContent = "No se pudo conectar con el backend";
    }
  }
}

/* =========================================================
   LOGOUT
========================================================= */
async function logout() {
  /*
    El backend real no tiene /logout todavía.
    Logout local seguro sin llamar rutas inexistentes.
  */
  clearCurrentUser();

  if (isRestaurantPanelPage()) {
    window.location.href = "index.html";
    return;
  }

  window.location.reload();
}

function logoutRestaurant() {
  logout();
}

/* =========================================================
   HELPERS DE COMPATIBILIDAD
========================================================= */
function getSavedUser() {
  const currentUser = getCurrentUser();

  if (currentUser && currentUser.role === "customer") {
    return currentUser;
  }

  return null;
}

function getSavedRestaurant() {
  const currentUser = getCurrentUser();

  if (currentUser && currentUser.role === "restaurant") {
    return currentUser;
  }

  return null;
}

function isCustomerLoggedIn() {
  const currentUser = getCurrentUser();
  return !!(currentUser && currentUser.role === "customer");
}

function isRestaurantLoggedIn() {
  const currentUser = getCurrentUser();
  return !!(currentUser && currentUser.role === "restaurant");
}

function loadUser() {
  return getCurrentUser();
}

/* =========================================================
   PROTEGER PANEL RESTAURANTE
========================================================= */
function protectRestaurantPanel() {
  if (!isRestaurantPanelPage()) return;

  const currentUser = getCurrentUser();

  if (!currentUser || currentUser.role !== "restaurant") {
    window.location.href = "index.html";
  }
}

async function initAuth() {
  ensureCustomerAddressFields();
  await loadCurrentSession();
  protectRestaurantPanel();
}

/* =========================================================
   FUNCIONES GLOBALES
========================================================= */
window.showRegister = showRegister;
window.closeRegister = closeRegister;
window.registerUser = registerUser;
window.requestCustomerLocation = requestCustomerLocation;

window.showLogin = showLogin;
window.closeLogin = closeLogin;
window.loginUser = loginUser;

window.showRestaurantRegister = showRestaurantRegister;
window.closeRestaurantRegister = closeRestaurantRegister;
window.registerRestaurant = registerRestaurant;

window.logout = logout;
window.logoutRestaurant = logoutRestaurant;

window.getCurrentUser = getCurrentUser;
window.getSavedUser = getSavedUser;
window.getSavedRestaurant = getSavedRestaurant;
window.isCustomerLoggedIn = isCustomerLoggedIn;
window.isRestaurantLoggedIn = isRestaurantLoggedIn;
window.loadUser = loadUser;
window.loadCurrentSession = loadCurrentSession;

initAuth();

