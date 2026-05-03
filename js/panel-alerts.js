/* =========================================
   ALERTAS DE PEDIDOS NUEVOS - DELI
   ========================================= */

let knownOrders = new Set();
let audioEnabled = false;
let audio = null;

/* -----------------------------------------
   CREAR BOTÓN PARA ACTIVAR SONIDO
----------------------------------------- */

function createSoundActivator() {


  const box = document.createElement("div");
  box.style.position = "fixed";
  box.style.bottom = "20px";
  box.style.right = "20px";
  box.style.background = "#ff6b35";
  box.style.color = "white";
  box.style.padding = "14px 18px";
  box.style.borderRadius = "12px";
  box.style.fontWeight = "bold";
  box.style.cursor = "pointer";
  box.style.boxShadow = "0 10px 25px rgba(0,0,0,0.2)";
  box.style.zIndex = "9999";

  box.innerText = "🔊 Activar sonido de pedidos";

  box.onclick = () => {

    audio = new Audio(
      "https://actions.google.com/sounds/v1/alarms/beep_short.ogg"
    );

    audio.play().catch(()=>{});

    audioEnabled = true;


    box.remove();
  };

  document.body.appendChild(box);
}

/* -----------------------------------------
   SONIDO DE PEDIDO
----------------------------------------- */

function playOrderSound() {

  if (!audioEnabled) return;

  const sound = new Audio(
    "https://actions.google.com/sounds/v1/alarms/beep_short.ogg"
  );

  sound.play().catch(()=>{});
}

/* -----------------------------------------
   TOAST VISUAL
----------------------------------------- */

function showToast(message) {

  const toast = document.createElement("div");

  toast.innerText = message;

  toast.style.position = "fixed";
  toast.style.top = "20px";
  toast.style.right = "20px";
  toast.style.background = "#22c55e";
  toast.style.color = "white";
  toast.style.padding = "14px 18px";
  toast.style.borderRadius = "10px";
  toast.style.fontWeight = "bold";
  toast.style.zIndex = "9999";
  toast.style.boxShadow = "0 10px 25px rgba(0,0,0,0.2)";

  document.body.appendChild(toast);

  setTimeout(()=>{
    toast.remove();
  },4000);

}

/* -----------------------------------------
   PARPADEO DEL TÍTULO
----------------------------------------- */

function blinkTitle() {

  let count = 0;

  const original = document.title;

  const interval = setInterval(()=>{

    document.title =
      document.title === "🚨 Nuevo pedido"
        ? original
        : "🚨 Nuevo pedido";

    count++;

    if(count > 8){
      clearInterval(interval);
      document.title = original;
    }

  },1000);

}

/* -----------------------------------------
   OBTENER PEDIDOS DEL BACKEND
----------------------------------------- */

async function fetchOrders() {

  try {

    const res = await fetch("http://127.0.0.1:3000/orders");

    const data = await res.json();

    return data || [];

  } catch (err) {

    console.warn("No se pudieron obtener pedidos");

    return [];
  }

}

/* -----------------------------------------
   DETECTAR PEDIDOS NUEVOS
----------------------------------------- */

async function detectNewOrders() {

  const orders = await fetchOrders();

  if (!orders.length) return;

  const currentIds = orders.map(o => o.id);

  if (knownOrders.size === 0) {

    currentIds.forEach(id => knownOrders.add(id));
    return;

  }

  orders.forEach(order => {

    if (!knownOrders.has(order.id)) {

      knownOrders.add(order.id);

      playOrderSound();

      showToast("📦 Nuevo pedido recibido");

      blinkTitle();

    }

  });

}

/* -----------------------------------------
   INICIAR SISTEMA
----------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {

  createSoundActivator();

  setInterval(detectNewOrders, 5000);

});