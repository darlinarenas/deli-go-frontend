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
====================================================== */

document.addEventListener("DOMContentLoaded", () => {
  const API_URL = "https://deligo-backend-i554.onrender.com";

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
  let capturedLocation = null;
  let isSubmittingLocation = false;

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

  function renderInvite(invite, order) {
    const recipientName = invite?.recipientName || "";
    const senderName = invite?.senderName || "Alguien";
    const restaurantName = order?.restaurantName || "un restaurante BHUZ";

    if (inviteTitle) {
      inviteTitle.textContent = recipientName
        ? `${recipientName}, te invitaron comida`
        : "Te invitaron comida";
    }

    if (inviteDescription) {
      inviteDescription.textContent = `${senderName} te envió un pedido con BHUZ. Comparte tu ubicación GPS para recibirlo.`;
    }

    if (inviteOrderSummary) {
      inviteOrderSummary.innerHTML = `
        <div><strong>Restaurante:</strong> ${escapeHtml(restaurantName)}</div>
        <div><strong>Total:</strong> ${formatPrice(order?.total || 0)}</div>
        <div><strong>Estado:</strong> ${escapeHtml(order?.status || "pendiente")}</div>
      `;
    }

    if (invite?.status === "location_confirmed") {
      if (inviteLocationForm) inviteLocationForm.style.display = "none";
      if (inviteSuccessBox) inviteSuccessBox.style.display = "block";

      if (postConfirmGuestAlias && invite?.recipientName && !postConfirmGuestAlias.value.trim()) {
        postConfirmGuestAlias.value = invite.recipientName;
      }

      setGpsStatus("Ubicación ya confirmada.", true);
      return;
    }

    if (inviteLocationForm) {
      inviteLocationForm.style.display = "block";
    }
  }

  async function loadInvite() {
    if (!token) {
      if (inviteDescription) {
        inviteDescription.textContent = "El link de invitación no es válido.";
      }
      return;
    }

    try {
      const response = await fetch(`${API_URL}/invite/${encodeURIComponent(token)}`);
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.message || "No se pudo cargar la invitación");
      }

      currentInvite = data.invite;
      renderInvite(data.invite, data.order);
    } catch (error) {
      console.error("Error cargando invitación:", error);

      if (inviteDescription) {
        inviteDescription.textContent = "No se pudo cargar la invitación. Verifica que el link sea correcto.";
      }
    }
  }

  async function captureGps() {
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

      if (inviteLocationForm) inviteLocationForm.style.display = "none";
      if (inviteSuccessBox) inviteSuccessBox.style.display = "block";

      if (postConfirmGuestAlias && currentInvite?.recipientName && !postConfirmGuestAlias.value.trim()) {
        postConfirmGuestAlias.value = currentInvite.recipientName;
      }

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

  loadInvite();
});







