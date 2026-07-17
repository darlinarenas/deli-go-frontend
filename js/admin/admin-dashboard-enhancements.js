(() => {
  "use strict";
  const REFRESH_MS = 30000;
  let refreshing = false;
  let timer = null;
  let lastInteractionAt = Date.now();
  const IDLE_BEFORE_REFRESH_MS = 75000;
  const badgeMap = {
    usuariosSection: ["menuUsuariosCount", "totalUsuarios"],
    restaurantesSection: ["menuRestaurantesCount", "totalRestaurantes"],
    repartidoresSection: ["menuRepartidoresCount", "driversStats"],
    pedidosSection: ["menuPedidosCount", "totalPedidos"],
    enviosSection: ["menuPaquetesCount", "adminServicesStats"]
  };
  function applyTheme(theme) {
    document.documentElement.dataset.adminTheme = theme;
    localStorage.setItem("bhuzAdminTheme", theme);
    const b = document.getElementById("adminThemeToggle");
    if (b) b.textContent = theme === "dark" ? "☀️ Modo claro" : "🌙 Modo oscuro";
  }
  function initTheme() {
    const saved = localStorage.getItem("bhuzAdminTheme");
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(saved || (prefersDark ? "dark" : "light"));
    document.getElementById("adminThemeToggle")?.addEventListener("click", () => {
      applyTheme(document.documentElement.dataset.adminTheme === "dark" ? "light" : "dark");
    });
  }
  function indicatorsVisible() { return localStorage.getItem("bhuzAdminIndicators") !== "hidden"; }
  function setIndicators(show) {
    localStorage.setItem("bhuzAdminIndicators", show ? "shown" : "hidden");
    document.body.classList.toggle("hide-admin-counts", !show);
    const b = document.getElementById("adminIndicatorsToggle");
    if (b) b.textContent = show ? "Ocultar cantidades" : "Mostrar cantidades";
  }
  function numberFromStats(id) {
    const e = document.getElementById(id);
    if (!e) return 0;
    if (e.tagName === "STRONG") return Number(e.textContent) || 0;
    const first = e.querySelector("article strong");
    return Number(String(first?.textContent || "0").replace(/[^0-9.-]/g, "")) || 0;
  }
  function syncBadges() {
    Object.values(badgeMap).forEach(([badgeId, sourceId]) => {
      const b = document.getElementById(badgeId);
      if (b) b.textContent = String(numberFromStats(sourceId));
    });
  }
  function userIsBusy() {
    const a = document.activeElement;
    if (a && ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(a.tagName)) return true;
    if (document.querySelector("form:focus-within")) return true;
    if (document.querySelector(".modal:not(.hidden), [role='dialog']:not(.hidden)")) return true;
    if (Date.now() - lastInteractionAt < IDLE_BEFORE_REFRESH_MS) return true;
    const section = activeSection();
    if (section === "repartidoresSection" && !document.getElementById("driverDetailPanel")?.classList.contains("hidden")) return true;
    if (section === "enviosSection" && document.querySelector("#adminServicesList .admin-service-row.active")) return true;
    if (section === "pedidosSection" && document.querySelector(".admin-order-row.active")) return true;
    return false;
  }
  function activeSection() {
    return document.querySelector(".admin-section.active")?.id || "resumenSection";
  }
  async function refresh() {
    if (refreshing || document.hidden) return;
    if (userIsBusy()) {
      const st = document.getElementById("adminAutoRefreshStatus");
      if (st) st.textContent = "Actualización pausada mientras trabajas";
      return;
    }
    const section = activeSection();
    // No se llama cargarDatosAdministrador(): esa función repinta todo el panel
    // y podía devolver al administrador al inicio. Solo se refresca el módulo activo.
    let job = null;
    if (section === "enviosSection" && typeof window.refreshAdminServicesSilently === "function") {
      job = window.refreshAdminServicesSilently();
    } else if (section === "repartidoresSection" && typeof window.refreshAdminDriversSilently === "function") {
      job = window.refreshAdminDriversSilently();
    }
    if (!job) { syncBadges(); return; }
    refreshing = true;
    const st = document.getElementById("adminAutoRefreshStatus");
    if (st) st.textContent = "Actualizando esta sección…";
    try {
      await Promise.resolve(job);
      syncBadges();
      if (st) st.textContent = "Actualizado sin interrumpir";
    } catch (_) {
      if (st) st.textContent = "Actualización pendiente";
    } finally {
      refreshing = false;
      setTimeout(() => { if (st) st.textContent = "Actualización automática activa"; }, 1400);
    }
  }
  document.addEventListener("DOMContentLoaded", () => {
    ["pointerdown", "keydown", "input", "change", "scroll"].forEach((eventName) => {
      document.addEventListener(eventName, () => { lastInteractionAt = Date.now(); }, { passive: true, capture: true });
    });
    initTheme();
    setIndicators(indicatorsVisible());
    document.getElementById("adminIndicatorsToggle")?.addEventListener("click", () => setIndicators(!indicatorsVisible()));
    timer = setInterval(refresh, REFRESH_MS);
    setInterval(syncBadges, 1500);
    syncBadges();
  });
  window.addEventListener("beforeunload", () => timer && clearInterval(timer));
})();
