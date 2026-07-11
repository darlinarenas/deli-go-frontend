/* ======================================================
   BHUZ
   invite.js

   Página pública para "Invitar comida"
   - Receptor NO necesita cuenta.
   - Lee el token del link.
   - Muestra información básica del pedido.
   - Captura GPS obligatorio + referencia.
   - Envía la ubicación al backend.

   CAMBIO BHUZ - GPS INVITADO FINAL
   - Mantiene el endpoint existente POST /invite/:token/location.
   - No cambia backend ni flujo de pedidos.
   - Mejora la captura GPS para pruebas reales en móvil/HTTPS.
   - Muestra coordenadas cargadas para confirmar visualmente que sí tomó GPS.
   - Da mensajes claros si el navegador bloqueó permisos o si no está en HTTPS.

   CAMBIO BHUZ - INVITADO SEGUIMIENTO + SONIDOS
   - Si el invitado ya confirmó ubicación, NO vuelve a pedir GPS al refrescar.
   - Si el pedido ya fue creado, muestra el estado real del pedido.
   - Revisa cambios de estado automáticamente.
   - Reproduce sonidos BHUZ cuando cambia el estado del pedido.
   - El botón de sonido se crea una sola vez y no se duplica durante el seguimiento.
   - Mantiene compatibilidad con invitaciones pendientes y delivery_invites.
====================================================== */

document.addEventListener("DOMContentLoaded", () => {
  const API_URL = window.DELI_API_URL || "https://deligo-backend-i554.onrender.com";

  const params = new URLSearchParams(window.location.search);
  const token = String(params.get("token") || "").trim();

  const inviteTitle = document.getElementById("inviteTitle");
  const inviteDescription = document.getElementById("inviteDescription");
  const inviteOrderSummary = document.getElementById("inviteOrderSummary");
  const inviteLocationForm = document.getElementById("inviteLocationForm");
  const inviteReceiverReference = document.getElementById("inviteReceiverReference");
  const inviteReceiverAddress = document.getElementById("inviteReceiverAddress");
  const inviteGpsStatus = document.getElementById("inviteGpsStatus");
  const captureInviteGpsBtn = document.getElementById("captureInviteGpsBtn");
  const confirmInviteLocationBtn = document.getElementById("confirmInviteLocationBtn");
  const saveInviteGuestCheck = document.getElementById("saveInviteGuestCheck");
  const saveInviteGuestAlias = document.getElementById("saveInviteGuestAlias");
  const inviteSuccessBox = document.getElementById("inviteSuccessBox");
  const postConfirmSaveGuestBox = document.getElementById("postConfirmSaveGuestBox");
  const postConfirmGuestAlias = document.getElementById("postConfirmGuestAlias");
  const saveConfirmedGuestBtn = document.getElementById("saveConfirmedGuestBtn");
  const saveConfirmedGuestMessage = document.getElementById("saveConfirmedGuestMessage");

  let currentInvite = null;
  let currentOrder = null;
  let capturedLocation = null;
  let isSubmittingLocation = false;
  let lastKnownStatus = "";
  let firstLoadDone = false;
  let inviteSoundUnlocked = false;
  let pollingTimer = null;
  let soundActivationChecked = false;
  let statusAudioCache = {};
  let inviteSoundButton = null;

  const STATUS_SOUND_PATHS = {
    aceptado: "assets/sounds/bhuz-pedido-aceptado.mp3",
    confirmado: "assets/sounds/bhuz-pedido-aceptado.mp3",
    preparando: "assets/sounds/bhuz-pedido-preparando.mp3",
    listo: "assets/sounds/bhuz-pedido-preparando.mp3",
    en_camino: "assets/sounds/bhuz-pedido-en-camino.mp3",
    entregado: "assets/sounds/bhuz-pedido-en-camino.mp3"
  };

  const STATUS_LABELS = {
    pending_location: "Esperando ubicación",
    pendiente: "Pendiente",
    ubicacion_confirmada: "Ubicación confirmada",
    location_confirmed: "Ubicación confirmada",
    pedido_creado: "Pedido creado",
    confirmado: "Confirmado",
    aceptado: "Aceptado",
    preparando: "Preparando",
    listo: "Listo para enviar",
    en_camino: "En camino",
    entregado: "Entregado",
    cancelado: "Cancelado"
  };

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

  function normalizeStatus(status) {
    return String(status || "")
      .trim()
      .toLowerCase()
      .replaceAll("-", "_")
      .replaceAll(" ", "_");
  }

  function getStatusLabel(status) {
    const normalized = normalizeStatus(status);
    return STATUS_LABELS[normalized] || status || "pendiente";
  }

  function isLocationAlreadyConfirmed(invite, order) {
    const inviteStatus = normalizeStatus(invite?.status || invite?.statusEs || "");
    const orderStatus = normalizeStatus(order?.status || "");

    return Boolean(
      invite?.confirmedAt ||
      invite?.recipientLatitude ||
      invite?.recipientLongitude ||
      inviteStatus === "location_confirmed" ||
      inviteStatus === "ubicacion_confirmada" ||
      inviteStatus === "pedido_creado" ||
      orderStatus === "ubicacion_confirmada" ||
      orderStatus === "pedido_creado"
    );
  }

  function getEffectiveStatus(invite, order) {
    const orderStatus = normalizeStatus(order?.status || "");
    const inviteStatus = normalizeStatus(invite?.statusEs || invite?.status || "");

    if (orderStatus && orderStatus !== "ubicacion_confirmada") {
      return orderStatus;
    }

    return orderStatus || inviteStatus || "pendiente";
  }

  function setGpsStatus(message, ok = false) {
    if (!inviteGpsStatus) return;

    inviteGpsStatus.textContent = message;
    inviteGpsStatus.classList.toggle("ok", Boolean(ok));
  }

  function setButtonLoading(button, loading, loadingText) {
    if (!button) return;

    if (loading) {
      if (!button.dataset.originalText) {
        button.dataset.originalText = button.textContent;
      }
      button.textContent = loadingText || "Procesando...";
      button.disabled = true;
      return;
    }

    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }

  function getSoundStorageKey() {
    return `bhuz_invite_sound_enabled_${token || "sin_token"}`;
  }

  function wasInviteSoundEnabledBefore() {
    try {
      return window.localStorage.getItem(getSoundStorageKey()) === "true";
    } catch (error) {
      return false;
    }
  }

  function rememberInviteSoundEnabled() {
    try {
      window.localStorage.setItem(getSoundStorageKey(), "true");
    } catch (error) {
      // Si localStorage no está disponible, igual mantenemos activo en memoria.
    }
  }

  function getOrCreateStatusAudio(soundPath) {
    if (!soundPath) return null;

    if (!statusAudioCache[soundPath]) {
      const audio = new Audio(soundPath);
      audio.preload = "auto";
      audio.volume = 0.95;
      statusAudioCache[soundPath] = audio;
    }

    return statusAudioCache[soundPath];
  }

  function hideInviteSoundButton() {
    const existingButton = document.getElementById("bhuzInviteSoundButton");

    if (existingButton) {
      existingButton.style.display = "none";
    }

    if (inviteSoundButton) {
      inviteSoundButton.style.display = "none";
    }
  }

  function ensureInviteSoundButton() {
    if (!inviteOrderSummary) return;

    if (!soundActivationChecked) {
      soundActivationChecked = true;

      if (wasInviteSoundEnabledBefore()) {
        inviteSoundUnlocked = true;
        hideInviteSoundButton();
        return;
      }
    }

    if (inviteSoundUnlocked) {
      hideInviteSoundButton();
      return;
    }

    const existingButton = document.getElementById("bhuzInviteSoundButton");

    if (existingButton) {
      inviteSoundButton = existingButton;
      inviteSoundButton.style.display = "block";
      return;
    }

    inviteSoundButton = document.createElement("button");
    inviteSoundButton.id = "bhuzInviteSoundButton";
    inviteSoundButton.type = "button";
    inviteSoundButton.textContent = "🔊 Activar sonidos del pedido";
    inviteSoundButton.style.marginTop = "12px";
    inviteSoundButton.style.width = "100%";
    inviteSoundButton.style.border = "0";
    inviteSoundButton.style.borderRadius = "14px";
    inviteSoundButton.style.padding = "12px 14px";
    inviteSoundButton.style.fontWeight = "800";
    inviteSoundButton.style.cursor = "pointer";
    inviteSoundButton.style.background = "#00e676";
    inviteSoundButton.style.color = "#06110b";

    inviteSoundButton.addEventListener("click", () => {
      unlockInviteSounds(true);
    });

    inviteOrderSummary.insertAdjacentElement("afterend", inviteSoundButton);
  }

  async function warmUpStatusSounds() {
    const uniqueSoundPaths = [...new Set(Object.values(STATUS_SOUND_PATHS).filter(Boolean))];

    for (const soundPath of uniqueSoundPaths) {
      const audio = getOrCreateStatusAudio(soundPath);
      if (!audio) continue;

      try {
        audio.volume = 0.01;
        await audio.play();
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 0.95;
      } catch (error) {
        audio.volume = 0.95;
      }
    }
  }

  function unlockInviteSounds(showFeedback = false) {
    if (inviteSoundUnlocked) {
      hideInviteSoundButton();
      return;
    }

    inviteSoundUnlocked = true;
    rememberInviteSoundEnabled();
    hideInviteSoundButton();

    warmUpStatusSounds().finally(() => {
      if (showFeedback) {
        setGpsStatus("🔊 Sonidos activados. Te avisaremos cuando cambie el estado del pedido.", true);
      }
    });
  }

  function playStatusSound(status) {
    const normalizedStatus = normalizeStatus(status);
    const soundPath = STATUS_SOUND_PATHS[normalizedStatus];

    if (!soundPath) return;

    if (!inviteSoundUnlocked && !wasInviteSoundEnabledBefore()) {
      ensureInviteSoundButton();
      return;
    }

    inviteSoundUnlocked = true;
    hideInviteSoundButton();

    try {
      const sound = getOrCreateStatusAudio(soundPath);
      if (!sound) return;

      sound.currentTime = 0;
      sound.volume = 0.95;
      sound.play().catch(() => {
        // No volvemos a crear botones infinitos. Algunos navegadores pueden bloquear
        // audio si la página fue recargada manualmente, pero el botón no debe duplicarse.
        console.warn("El navegador bloqueó el sonido BHUZ hasta una nueva interacción del usuario.");
      });

      if (navigator.vibrate) {
        navigator.vibrate([120, 60, 120]);
      }
    } catch (error) {
      console.warn("No se pudo reproducir sonido de estado BHUZ:", error);
    }
  }

  function maybePlayStatusSound(nextStatus) {
    const normalizedStatus = normalizeStatus(nextStatus);

    if (!normalizedStatus) return;

    if (!firstLoadDone) {
      lastKnownStatus = normalizedStatus;
      firstLoadDone = true;
      return;
    }

    if (normalizedStatus === lastKnownStatus) return;

    lastKnownStatus = normalizedStatus;
    playStatusSound(normalizedStatus);
  }

  function renderConfirmedLocationState(invite, order) {
    if (inviteLocationForm) inviteLocationForm.style.display = "none";
    if (inviteSuccessBox) inviteSuccessBox.style.display = "block";

    const effectiveStatus = getEffectiveStatus(invite, order);
    const orderId = order?.id || invite?.orderId || "";

    if (inviteTitle) {
      inviteTitle.textContent = "Ubicación recibida correctamente";
    }

    if (inviteDescription) {
      if (orderId) {
        inviteDescription.textContent = "Tu pedido BHUZ ya fue creado. Aquí podrás ver cómo va avanzando.";
      } else {
        inviteDescription.textContent = "La persona que te invitó ya puede confirmar el pedido. Mantén este link abierto para ver el avance.";
      }
    }

    if (inviteOrderSummary) {
      inviteOrderSummary.innerHTML = `
        <div><strong>Restaurante:</strong> ${escapeHtml(order?.restaurantName || invite?.restaurantName || "Restaurante BHUZ")}</div>
        <div><strong>Total:</strong> ${formatPrice(order?.total || invite?.total || 0)}</div>
        <div><strong>Estado:</strong> ${escapeHtml(getStatusLabel(effectiveStatus))}</div>
        ${orderId ? `<div><strong>Pedido:</strong> #${escapeHtml(String(orderId))}</div>` : ""}
        <div><strong>GPS:</strong> ✅ Ubicación confirmada</div>
      `;
    }

    if (postConfirmGuestAlias && invite?.recipientName && !postConfirmGuestAlias.value.trim()) {
      postConfirmGuestAlias.value = invite.recipientName;
    }

    if (postConfirmSaveGuestBox && invite?.senderEmail) {
      postConfirmSaveGuestBox.style.display = "block";
    }

    setGpsStatus("✅ Ubicación ya confirmada. Te avisaremos aquí cuando cambie el estado del pedido.", true);
    ensureInviteSoundButton();
  }

  function renderInvite(invite, order) {
    const recipientName = invite?.recipientName || "";
    const senderName = invite?.senderName || "Alguien";
    const restaurantName = order?.restaurantName || invite?.restaurantName || "un restaurante BHUZ";
    const effectiveStatus = getEffectiveStatus(invite, order);

    if (isLocationAlreadyConfirmed(invite, order)) {
      renderConfirmedLocationState(invite, order);
      maybePlayStatusSound(effectiveStatus);
      return;
    }

    if (inviteTitle) {
      inviteTitle.textContent = recipientName
        ? `${recipientName}, te enviaron un BHUZ`
        : "Te enviaron un BHUZ";
    }

    if (inviteDescription) {
      inviteDescription.textContent = `${senderName} te envió un pedido con BHUZ. Comparte tu ubicación GPS para recibirlo.`;
    }

    if (inviteOrderSummary) {
      inviteOrderSummary.innerHTML = `
        <div><strong>Restaurante:</strong> ${escapeHtml(restaurantName)}</div>
        <div><strong>Total:</strong> ${formatPrice(order?.total || invite?.total || 0)}</div>
        <div><strong>Estado:</strong> ${escapeHtml(getStatusLabel(effectiveStatus))}</div>
      `;
    }

    if (inviteLocationForm) {
      inviteLocationForm.style.display = "block";
    }

    if (inviteSuccessBox) {
      inviteSuccessBox.style.display = "none";
    }

    maybePlayStatusSound(effectiveStatus);
  }

  async function loadInvite(options = {}) {
    const silent = Boolean(options.silent);

    if (!token) {
      if (inviteDescription) {
        inviteDescription.textContent = "El link de invitación no es válido.";
      }
      return;
    }

    try {
      const response = await fetch(`${API_URL}/invite/${encodeURIComponent(token)}?t=${Date.now()}`);
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.message || "No se pudo cargar la invitación");
      }

      currentInvite = data.invite;
      currentOrder = data.order || null;
      renderInvite(data.invite, data.order);
    } catch (error) {
      console.error("Error cargando invitación:", error);

      if (!silent && inviteDescription) {
        inviteDescription.textContent = "No se pudo cargar la invitación. Verifica que el link sea correcto.";
      }
    }
  }

  function startInviteStatusPolling() {
    if (pollingTimer) return;

    pollingTimer = window.setInterval(() => {
      loadInvite({ silent: true });
    }, 6000);
  }

  function isSecureGeolocationContext() {
    const protocol = window.location.protocol;
    const host = window.location.hostname;

    return (
      window.isSecureContext === true ||
      protocol === "https:" ||
      host === "localhost" ||
      host === "127.0.0.1"
    );
  }

  function getGpsErrorMessage(error) {
    if (!error) {
      return "No se pudo obtener la ubicación. Activa el GPS y vuelve a intentar.";
    }

    switch (error.code) {
      case 1:
        return "Permiso de ubicación bloqueado. Activa la ubicación desde el candado del navegador y vuelve a intentar.";
      case 2:
        return "No se pudo detectar tu ubicación. Activa el GPS del teléfono y vuelve a intentar.";
      case 3:
        return "La ubicación tardó demasiado. Muévete a un lugar con mejor señal y vuelve a intentar.";
      default:
        return "No se pudo obtener la ubicación. Activa el GPS y vuelve a intentar.";
    }
  }

  async function captureGps() {
    unlockInviteSounds();
    capturedLocation = null;

    if (!isSecureGeolocationContext()) {
      setGpsStatus("El GPS solo funciona en HTTPS. Prueba desde la página publicada en Vercel.", false);
      alert("El GPS solo funciona en HTTPS. Abre este link desde la página real publicada, no desde file://.");
      return;
    }

    if (!navigator.geolocation) {
      setGpsStatus("Tu navegador no permite compartir ubicación GPS.", false);
      alert("Tu navegador no permite compartir ubicación GPS.");
      return;
    }

    setButtonLoading(captureInviteGpsBtn, true, "📍 Solicitando GPS...");
    setGpsStatus("Solicitando ubicación GPS... acepta el permiso del navegador.", false);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude);
        const lng = Number(position.coords.longitude);
        const accuracy = Number(position.coords.accuracy || 0);

        capturedLocation = {
          lat: String(lat),
          lng: String(lng),
          accuracy: Number.isFinite(accuracy) ? Math.round(accuracy) : ""
        };

        setGpsStatus(
          `✅ GPS cargado: ${lat.toFixed(6)}, ${lng.toFixed(6)}${accuracy ? ` · precisión aprox. ${Math.round(accuracy)} m` : ""}`,
          true
        );

        setButtonLoading(captureInviteGpsBtn, false);
      },
      (error) => {
        console.warn("Error GPS invitación:", error);
        capturedLocation = null;
        setGpsStatus(getGpsErrorMessage(error), false);
        setButtonLoading(captureInviteGpsBtn, false);
      },
      {
        enableHighAccuracy: true,
        timeout: 25000,
        maximumAge: 0
      }
    );
  }

  async function submitLocation(event) {
    event.preventDefault();
    unlockInviteSounds();

    if (isSubmittingLocation) return;

    const reference = String(inviteReceiverReference?.value || "").trim();
    const address = String(inviteReceiverAddress?.value || "").trim();

    if (!reference) {
      alert("Escribe una referencia para que el repartidor pueda ubicarte.");
      return;
    }

    if (!capturedLocation?.lat || !capturedLocation?.lng) {
      alert("Primero debes tocar el botón ‘Compartir mi ubicación GPS’ y permitir la ubicación.");
      return;
    }

    isSubmittingLocation = true;
    setButtonLoading(confirmInviteLocationBtn, true, "Confirmando ubicación...");

    try {
      const response = await fetch(`${API_URL}/invite/${encodeURIComponent(token)}/location`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          address,
          reference,
          latitude: capturedLocation.lat,
          longitude: capturedLocation.lng,
          location: capturedLocation,
          saveGuest: Boolean(saveInviteGuestCheck?.checked),
          guestAlias: String(saveInviteGuestAlias?.value || "").trim()
        })
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.message || "No se pudo confirmar la ubicación");
      }

      currentInvite = data.invite || currentInvite;
      currentOrder = data.order || currentOrder;

      renderInvite(currentInvite, currentOrder);
      startInviteStatusPolling();

      if (data.savedGuest && saveConfirmedGuestMessage) {
        saveConfirmedGuestMessage.textContent = "✅ Invitado guardado correctamente para futuras invitaciones.";
        if (saveConfirmedGuestBtn) saveConfirmedGuestBtn.disabled = true;
      }

      setGpsStatus("✅ Ubicación confirmada y enviada a BHUZ.", true);
    } catch (error) {
      console.error("Error confirmando ubicación:", error);
      alert(error.message || "No se pudo confirmar la ubicación.");
      setButtonLoading(confirmInviteLocationBtn, false);
    } finally {
      isSubmittingLocation = false;
    }
  }

  async function saveConfirmedGuest() {
    const alias = String(postConfirmGuestAlias?.value || "").trim();

    if (!alias) {
      alert("Escribe un apodo para guardar este invitado.");
      return;
    }

    setButtonLoading(saveConfirmedGuestBtn, true, "Guardando invitado...");

    try {
      const response = await fetch(`${API_URL}/invite/${encodeURIComponent(token)}/save-guest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          guestAlias: alias
        })
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.message || "No se pudo guardar el invitado");
      }

      if (saveConfirmedGuestMessage) {
        saveConfirmedGuestMessage.textContent = "✅ Invitado guardado correctamente para futuras invitaciones.";
      }

      if (saveConfirmedGuestBtn) {
        saveConfirmedGuestBtn.disabled = true;
        saveConfirmedGuestBtn.textContent = "Invitado guardado";
      }
    } catch (error) {
      console.error("Error guardando invitado confirmado:", error);
      alert(error.message || "No se pudo guardar el invitado.");
      setButtonLoading(saveConfirmedGuestBtn, false);
    }
  }

  saveInviteGuestCheck?.addEventListener("change", () => {
    if (!saveInviteGuestAlias) return;

    saveInviteGuestAlias.style.display = saveInviteGuestCheck.checked ? "block" : "none";

    if (saveInviteGuestCheck.checked && currentInvite?.recipientName && !saveInviteGuestAlias.value.trim()) {
      saveInviteGuestAlias.value = currentInvite.recipientName;
    }
  });

  captureInviteGpsBtn?.addEventListener("click", captureGps);
  inviteLocationForm?.addEventListener("submit", submitLocation);
  saveConfirmedGuestBtn?.addEventListener("click", saveConfirmedGuest);

  if (wasInviteSoundEnabledBefore()) {
    inviteSoundUnlocked = true;
    hideInviteSoundButton();
  }

  loadInvite().then(startInviteStatusPolling);
});




