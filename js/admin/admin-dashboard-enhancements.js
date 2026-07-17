(() => {
  "use strict";
  const REFRESH_MS=20000; let refreshing=false,timer=null;
  const badgeMap={usuariosSection:['menuUsuariosCount','totalUsuarios'],restaurantesSection:['menuRestaurantesCount','totalRestaurantes'],repartidoresSection:['menuRepartidoresCount','driversStats'],pedidosSection:['menuPedidosCount','totalPedidos'],enviosSection:['menuPaquetesCount','adminServicesStats']};
  function applyTheme(theme){document.documentElement.dataset.adminTheme=theme;localStorage.setItem('bhuzAdminTheme',theme);const b=document.getElementById('adminThemeToggle');if(b)b.textContent=theme==='dark'?'☀️ Modo claro':'🌙 Modo oscuro';}
  function initTheme(){applyTheme(localStorage.getItem('bhuzAdminTheme')||(matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light'));document.getElementById('adminThemeToggle')?.addEventListener('click',()=>applyTheme(document.documentElement.dataset.adminTheme==='dark'?'light':'dark'));}
  function indicatorsVisible(){return localStorage.getItem('bhuzAdminIndicators')!=='hidden';}
  function setIndicators(show){localStorage.setItem('bhuzAdminIndicators',show?'shown':'hidden');document.body.classList.toggle('hide-admin-counts',!show);const b=document.getElementById('adminIndicatorsToggle');if(b)b.textContent=show?'Ocultar cantidades':'Mostrar cantidades';}
  function numberFromStats(id){const e=document.getElementById(id);if(!e)return 0;if(e.tagName==='STRONG')return Number(e.textContent)||0;const first=e.querySelector('article strong');return Number(first?.textContent)||0;}
  function syncBadges(){Object.values(badgeMap).forEach(([badgeId,sourceId])=>{const b=document.getElementById(badgeId);if(b)b.textContent=String(numberFromStats(sourceId));});}
  function userIsEditing(){const a=document.activeElement;return !!a&&['INPUT','TEXTAREA','SELECT'].includes(a.tagName);}
  async function refresh(){if(refreshing||userIsEditing()||document.hidden)return;refreshing=true;const st=document.getElementById('adminAutoRefreshStatus');if(st)st.textContent='Actualizando…';try{const jobs=[];if(typeof window.cargarDatosAdministrador==='function')jobs.push(window.cargarDatosAdministrador({silent:true,preserveView:true}));if(typeof window.refreshAdminServicesSilently==='function')jobs.push(window.refreshAdminServicesSilently());if(typeof window.refreshAdminDriversSilently==='function')jobs.push(window.refreshAdminDriversSilently());await Promise.allSettled(jobs);syncBadges();if(st)st.textContent='Actualizado automáticamente';}finally{refreshing=false;setTimeout(()=>{if(st)st.textContent='Actualización automática activa';},1200);}}
  document.addEventListener('DOMContentLoaded',()=>{initTheme();setIndicators(indicatorsVisible());document.getElementById('adminIndicatorsToggle')?.addEventListener('click',()=>setIndicators(!indicatorsVisible()));timer=setInterval(refresh,REFRESH_MS);setInterval(syncBadges,1500);syncBadges();});
  window.addEventListener('beforeunload',()=>timer&&clearInterval(timer));
})();
