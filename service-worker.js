const CACHE='bhuz-shell-v7-20260719';
const SHELL=['/','/index.html','/mis-pedidos.html','/panel-repartidor.html','/css/styles.css','/js/config.js','/js/pwa.js?v=20260719-5','/js/tracking.js','/manifest.webmanifest','/manifest-driver.webmanifest','/assets/icons/icon-192.png','/assets/icons/icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));self.clients.claim()});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response}).catch(async()=>await caches.match(event.request)||await caches.match('/index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy))}return response})));
});
self.addEventListener('push',event=>{let data={};try{data=event.data?event.data.json():{}}catch{data={body:event.data?.text()}};event.waitUntil(self.registration.showNotification(data.title||'BHUZ',{body:data.body||'Tienes una actualización.',icon:'/assets/icons/icon-192.png',badge:'/assets/icons/icon-192.png',tag:data.tag||'bhuz-update',renotify:true,data:{url:data.url||'/mis-pedidos.html'},vibrate:[220,90,220,90,320]}))});
self.addEventListener('notificationclick',event=>{event.notification.close();const url=new URL(event.notification.data?.url||'/mis-pedidos.html',self.location.origin).href;event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const client of list){if('focus'in client){client.navigate?.(url);return client.focus()}}return clients.openWindow(url)}))});
