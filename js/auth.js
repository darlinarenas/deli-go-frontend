/* =========================================================
   DELI FOODS
   AUTH.JS

   AUTENTICACIÓN CON BACKEND
   - Registro cliente
   - Registro restaurante
   - Login
   - Sesión usuario actual
   - Logout compatible con archivos viejos del proyecto
========================================================= */

/* =========================================================
   CONFIGURACIÓN BACKEND
========================================================= */
const AUTH_API_URL = "https://deligo-backend-i554.onrender.com"; // CAMBIO: conectar frontend con backend Render

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
   SESIÓN USUARIO
========================================================= */
const CURRENT_USER_KEY = "deliCurrentUser";

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(CURRENT_USER_KEY));
  } catch {
    return null;
  }
}

function saveCurrentUser(user) {
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));

  /* Compatibilidad con archivos viejos del proyecto */
  localStorage.setItem("user", JSON.stringify(user));
  localStorage.setItem("deliUser", JSON.stringify(user));
}

function clearCurrentUser() {
  localStorage.removeItem(CURRENT_USER_KEY);
  localStorage.removeItem("user");
  localStorage.removeItem("deliUser");
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

  /*
    REGLA SEGURA:
    Si no encontramos el restaurante o el backend no devuelve status,
    se considera PENDIENTE. Así ningún restaurante nuevo entra al panel
    ni aparece públicamente sin aprobación administrativa.
  */
  if (!restaurant) return "pending";

  return normalizeStatus(restaurant.status);
}

/* =========================================================
   MODALES
========================================================= */
function showRegister() {
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
  const fullName = fullNameInput ? fullNameInput.value.trim() : "";
  const address = addressInput ? addressInput.value.trim() : "";
  const phone = phoneInput ? phoneInput.value.trim() : "";
  const email = emailInput ? normalizeEmail(emailInput.value) : "";
  const password = passwordInput ? passwordInput.value : "";
  const confirm = confirmPasswordInput ? confirmPasswordInput.value : "";

  if (!fullName || !address || !phone || !email || !password || !confirm) {
    if (messageEl) {
      messageEl.textContent = "Completa todos los campos";
    }
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
      phone,
      email,
      password
    });

    if (!res.ok) {
      if (messageEl) {
        messageEl.textContent = data.message || "Error al registrar";
      }
      return;
    }

    const user = {
      ...data.user,
      role: "customer"
    };

    saveCurrentUser(user);
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

    const restaurant = {
      ...data.restaurant,
      role: "restaurant",
      status: data.restaurant?.status || "pending",
      commission: data.restaurant?.commission ?? 15
    };

    /*
      IMPORTANTE:
      El restaurante queda registrado, pero NO entra automáticamente al panel.
      Primero debe ser aprobado desde el panel administrativo.
    */
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

    /*
      SEGURIDAD FRONTEND:
      Antes de permitir el panel, validamos el status REAL del restaurante
      contra /restaurants. No confiamos únicamente en /login porque algunos
      backends devuelven el usuario sin status.
    */
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

    saveCurrentUser(user);
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
function logout() {
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

protectRestaurantPanel();

/* =========================================================
   FUNCIONES GLOBALES
========================================================= */
window.showRegister = showRegister;
window.closeRegister = closeRegister;
window.registerUser = registerUser;

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









