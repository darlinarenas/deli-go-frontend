/* ======================================================
DELI GO - api.js
ARCHIVO COMPLETO - CONEXIÓN BACKEND (PRODUCCIÓN)
NO DEPENDE DE LOCALSTORAGE
====================================================== */

/* ==========================================
CONFIGURACIÓN BASE BACKEND
========================================== */

// ⚠️ CAMBIA ESTA URL POR TU BACKEND REAL
// EJEMPLO: https://deli-go-backend.onrender.com
const API_URL = "https://TU-BACKEND-AQUI.com";

/* ==========================================
ESTRUCTURA GLOBAL DEL SISTEMA
========================================== */

window.DELI_DB = {
restaurants: [],
user: null,
orders: []
};

/* ==========================================
HELPER: REQUEST GENÉRICO
========================================== */
async function apiRequest(endpoint, method = "GET", body = null) {
try {
const config = {
method,
headers: {
"Content-Type": "application/json"
}
};

```
    if (body) {
        config.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_URL}${endpoint}`, config);

    if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
    }

    return await response.json();

} catch (error) {
    console.error("Error en API:", error);
    throw error;
}
```

}

/* ==========================================
RESTAURANTES
========================================== */

// Obtener todos los restaurantes
async function fetchRestaurants() {
try {
const data = await apiRequest("/restaurants");

```
    window.DELI_DB.restaurants = data;

    console.log("✅ Restaurantes cargados:", data);

} catch (error) {
    console.error("❌ Error cargando restaurantes:", error);

    showBackendError();
}
```

}

// Obtener restaurante por ID
async function fetchRestaurantById(id) {
try {
return await apiRequest(`/restaurants/${id}`);
} catch (error) {
console.error("Error obteniendo restaurante:", error);
return null;
}
}

/* ==========================================
USUARIO
========================================== */

// Login
async function loginUser(email, password) {
try {
const data = await apiRequest("/auth/login", "POST", {
email,
password
});

```
    window.DELI_DB.user = data;

    return data;

} catch (error) {
    console.error("Error login:", error);
    return null;
}
```

}

// Registro
async function registerUser(userData) {
try {
return await apiRequest("/auth/register", "POST", userData);
} catch (error) {
console.error("Error registro:", error);
return null;
}
}

/* ==========================================
PEDIDOS
========================================== */

// Crear pedido
async function createOrder(orderData) {
try {
return await apiRequest("/orders", "POST", orderData);
} catch (error) {
console.error("Error creando pedido:", error);
return null;
}
}

// Obtener pedidos del usuario
async function fetchUserOrders(userId) {
try {
return await apiRequest(`/orders/user/${userId}`);
} catch (error) {
console.error("Error obteniendo pedidos:", error);
return [];
}
}

/* ==========================================
MANEJO DE ERRORES VISUALES
========================================== */

function showBackendError() {
const container = document.getElementById("restaurantsContainer");

```
if (container) {
    container.innerHTML = `
        <div style="text-align:center; padding:20px; color:#777;">
            <p>⚠️ No se pudieron cargar los restaurantes desde el backend.</p>
            <p style="font-size:12px;">Verifica la conexión o el servidor.</p>
        </div>
    `;
}
```

}

/* ==========================================
INICIALIZACIÓN GLOBAL
========================================== */

async function initData() {
console.log("🚀 Iniciando carga desde backend...");

```
await fetchRestaurants();

console.log("✅ Datos inicializados");
```

}

/* ==========================================
AUTO INIT (IMPORTANTE)
========================================== */

document.addEventListener("DOMContentLoaded", () => {
initData();
});


