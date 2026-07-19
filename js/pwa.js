(()=>{
const API=String(window.BHUZ_API_URL||window.DELI_API_URL||window.API_BASE_URL||'https://deligo-backend-i554.onrender.com').replace(/\/+$/,'');
let deferred=null;
const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
function b64(value){const s=String(value||'').trim().replace(/^[\'\"]|[\'\"]$/g,'');const pad='='.repeat((4-s.length%4)%4),base=(s+pad).replace(/-/g,'+').replace(/_/g,'/');let raw='';try{raw=atob(base)}catch(_){throw Error('La clave pública de notificaciones no tiene un formato válido.')}const key=Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));if(key.length!==65||key[0]!==4)throw Error('La clave pública VAPID no es válida.');return key}
async function sw(){if(!('serviceWorker'in navigator))throw Error('Este navegador no admite la instalación de BHUZ.');const reg=await navigator.serviceWorker.register('/service-worker.js?v=20260719-10',{updateViaCache:'none'});await reg.update().catch(()=>{});return navigator.serviceWorker.ready}
function permissionError(){const e=new Error('Las notificaciones están bloqueadas para BHUZ. Debes habilitarlas manualmente en la configuración del sitio.');e.code='NOTIFICATION_BLOCKED';return e}
async function subscribe(meta={}){
  if(isIOS&&!isStandalone())throw Error('En iPhone, primero agrega BHUZ a la pantalla de inicio y abre la aplicación instalada. Safari no permite activar notificaciones push desde esta pestaña.');
  if(!('Notification'in window)||!('PushManager'in window))throw Error('Las notificaciones push no están disponibles en este navegador o modo.');
  if(Notification.permission==='denied')throw permissionError();
  let permission=Notification.permission;
  if(permission!=='granted')permission=await Notification.requestPermission();
  if(permission!=='granted')throw permissionError();
  const reg=await sw();
  const cfg=await fetch(API+'/api/tracking/config',{credentials:'include',cache:'no-store'}).then(async r=>{const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.message||'No se pudo cargar la configuración de notificaciones.');return data});
  const publicKey=String(cfg.vapidPublicKey||'').replace(/\s+/g,'').replace(/^[\'\"]|[\'\"]$/g,'');
  if(!publicKey)throw Error('Falta configurar VAPID_PUBLIC_KEY en Render.');
  let sub=await reg.pushManager.getSubscription();
  if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64(publicKey)});
  const r=await fetch(API+'/api/tracking/subscriptions',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({...meta,subscription:sub.toJSON(),deviceName:navigator.userAgent.slice(0,180)})});
  if(!r.ok)throw Error((await r.json().catch(()=>({}))).message||'No se pudo vincular este dispositivo.');
  localStorage.setItem('bhuz_push_enabled','1');localStorage.setItem('bhuz_push_endpoint',sub.endpoint);return true;
}
function installBox(){if(document.getElementById('bhuzInstallBox'))return;const el=document.createElement('aside');el.id='bhuzInstallBox';el.className='bhuz-install-box';el.innerHTML='<button class="bhuz-install-close" aria-label="Cerrar">×</button><div><strong>Instala BHUZ</strong><small>'+(isIOS?'Pulsa Compartir y luego “Agregar a pantalla de inicio”.':'Recibe seguimiento y avisos desde tu pantalla de inicio.')+'</small></div><button class="bhuz-install-action">'+(isIOS?'Ver instrucciones':'Instalar')+'</button>';document.body.appendChild(el);el.querySelector('.bhuz-install-close').onclick=()=>{el.remove();sessionStorage.setItem('bhuz_install_dismissed','1')};el.querySelector('.bhuz-install-action').onclick=async()=>{if(deferred){deferred.prompt();await deferred.userChoice;deferred=null;el.remove()}else alert(isIOS?'En Safari pulsa el botón Compartir y selecciona “Agregar a pantalla de inicio”.':'Abre el menú del navegador y selecciona “Instalar aplicación”.')}}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;if(!sessionStorage.getItem('bhuz_install_dismissed'))installBox()});
document.addEventListener('DOMContentLoaded',()=>{sw().catch(console.warn);if(!isStandalone()&&!sessionStorage.getItem('bhuz_install_dismissed')&&isIOS)setTimeout(installBox,1200)});
window.BHUZ_PWA={subscribe,register:sw,install:installBox,permission:()=>('Notification'in window?Notification.permission:'unsupported'),isStandalone};
})();
