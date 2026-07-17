(()=>{
  const API=String(window.BHUZ_API_URL||window.DELI_API_URL||window.API_BASE_URL||'https://deligo-backend-i554.onrender.com').replace(/\/+$/,'');
  let leafletPromise=null;

  function leaflet(){
    if(window.L)return Promise.resolve();
    if(leafletPromise)return leafletPromise;
    leafletPromise=new Promise((resolve,reject)=>{
      if(!document.querySelector('link[data-bhuz-leaflet]')){
        const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';css.dataset.bhuzLeaflet='1';document.head.appendChild(css);
      }
      const s=document.createElement('script');s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';s.onload=resolve;s.onerror=()=>reject(Error('No se pudo cargar el mapa. Revisa tu conexión.'));document.head.appendChild(s);
    });
    return leafletPromise;
  }

  function statusLabel(s){
    return ({
      PENDING_ASSIGNMENT:'Buscando repartidor',ASSIGNED:'Repartidor asignado',GOING_TO_PICKUP:'En camino al retiro',ARRIVED_AT_PICKUP:'Llegó al retiro',PICKED_UP:'Paquete retirado',GOING_TO_DELIVERY:'En camino a tu ubicación',ARRIVED_AT_DELIVERY:'Llegó al destino',DELIVERED:'Entregado',CANCELLED:'Cancelado'
    })[String(s||'').toUpperCase()]||'Preparando seguimiento';
  }

  function markerIcon(kind){
    const glyph=kind==='driver'?'🛵':kind==='pickup'?'📦':'⌂';
    return L.divIcon({className:`bhuz-map-marker ${kind}`,html:`<span>${glyph}</span>`,iconSize:[42,42],iconAnchor:[21,38]});
  }

  async function open(type,id,meta={}){
    document.getElementById('bhuzTrackingModal')?.remove();
    const modal=document.createElement('div');
    modal.id='bhuzTrackingModal';modal.className='bhuz-tracking-modal';
    modal.innerHTML=`<div class="bhuz-tracking-backdrop" data-track-close></div><section class="bhuz-tracking-dialog" role="dialog" aria-modal="true" aria-labelledby="bhuzTrackingTitle"><header><div><small>SEGUIMIENTO EN TIEMPO REAL</small><h2 id="bhuzTrackingTitle">${meta.title||'Tu entrega BHUZ'}</h2></div><button type="button" data-track-close aria-label="Cerrar">×</button></header><div class="bhuz-tracking-status"><span class="bhuz-live-dot"></span><strong>Conectando con el repartidor…</strong></div><div id="bhuzLiveMap" aria-label="Mapa de seguimiento"></div><div class="bhuz-tracking-route"><div><span>Retiro</span><strong id="bhuzPickupText">Consultando…</strong></div><i>→</i><div><span>Entrega</span><strong id="bhuzDeliveryText">Consultando…</strong></div></div><footer><div id="bhuzDriverInfo"><strong>Esperando información…</strong><small>La ubicación se actualizará automáticamente.</small></div><button id="bhuzEnablePush" type="button">🔔 Activar avisos</button></footer></section>`;
    document.body.appendChild(modal);document.body.classList.add('modal-open');requestAnimationFrame(()=>modal.classList.add('show'));
    let closed=false,map=null,driverMarker=null,pickupMarker=null,deliveryMarker=null,routeLine=null,first=true;
    const close=()=>{closed=true;modal.classList.remove('show');document.body.classList.remove('modal-open');setTimeout(()=>{try{map?.remove()}catch{} modal.remove()},180)};
    modal.querySelectorAll('[data-track-close]').forEach(x=>x.onclick=close);
    modal.querySelector('#bhuzEnablePush').onclick=async()=>{try{const u=window.DELI_CURRENT_USER||window.getCurrentUser?.()||{};if(!window.BHUZ_PWA?.subscribe)throw Error('Las notificaciones todavía no están disponibles.');await window.BHUZ_PWA.subscribe({userEmail:u.email||'',orderId:type==='FOOD_ORDER'?id:'',serviceId:type==='PACKAGE'?id:''});modal.querySelector('#bhuzEnablePush').textContent='✓ Avisos activados'}catch(e){alert(e.message)}};

    try{
      await leaflet();
      if(closed)return;
      map=L.map('bhuzLiveMap',{zoomControl:true,attributionControl:true}).setView([11.7,-70.2],13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
      setTimeout(()=>map.invalidateSize(),160);
    }catch(e){modal.querySelector('.bhuz-tracking-status strong').textContent=e.message;return}

    async function refresh(){
      if(closed||!document.body.contains(modal))return;
      try{
        const r=await fetch(`${API}/api/tracking/live/${encodeURIComponent(type)}/${encodeURIComponent(id)}`,{cache:'no-store'});
        const d=await r.json().catch(()=>({}));
        if(!r.ok||d.ok===false)throw Error(d.message||'Seguimiento no disponible');
        const t=d.tracking||{},p=t.position;
        modal.querySelector('.bhuz-tracking-status strong').textContent=statusLabel(t.status)+(p?.created_at?` · ${new Date(p.created_at).toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`:'');
        modal.querySelector('#bhuzDriverInfo').innerHTML=`<strong>${t.driver?.name||'Repartidor BHUZ'}</strong><small>${[t.driver?.vehicleType,t.driver?.vehicleColor,t.driver?.vehiclePlate].filter(Boolean).join(' · ')||'Vehículo BHUZ'}</small>`;
        modal.querySelector('#bhuzPickupText').textContent=t.pickup?.address||'Punto de retiro';
        modal.querySelector('#bhuzDeliveryText').textContent=t.delivery?.address||'Destino';
        const pts=[];
        if(Number.isFinite(+t.pickup?.latitude)&&Number.isFinite(+t.pickup?.longitude)){
          const ll=[+t.pickup.latitude,+t.pickup.longitude];pts.push(ll);
          if(!pickupMarker)pickupMarker=L.marker(ll,{icon:markerIcon('pickup')}).addTo(map).bindPopup('Punto de retiro');
        }
        if(Number.isFinite(+t.delivery?.latitude)&&Number.isFinite(+t.delivery?.longitude)){
          const ll=[+t.delivery.latitude,+t.delivery.longitude];pts.push(ll);
          if(!deliveryMarker)deliveryMarker=L.marker(ll,{icon:markerIcon('delivery')}).addTo(map).bindPopup('Destino');
        }
        if(Number.isFinite(+p?.latitude)&&Number.isFinite(+p?.longitude)){
          const ll=[+p.latitude,+p.longitude];pts.push(ll);
          if(driverMarker)driverMarker.setLatLng(ll);else driverMarker=L.marker(ll,{icon:markerIcon('driver'),zIndexOffset:1000}).addTo(map).bindPopup('Repartidor BHUZ');
          const target=t.status==='GOING_TO_PICKUP'?t.pickup:t.delivery;
          if(Number.isFinite(+target?.latitude)&&Number.isFinite(+target?.longitude)){
            const route=[ll,[+target.latitude,+target.longitude]];
            if(routeLine)routeLine.setLatLngs(route);else routeLine=L.polyline(route,{weight:5,opacity:.8,dashArray:'8 9'}).addTo(map);
          }
          if(!first)map.panTo(ll,{animate:true});
        }
        if(first&&pts.length){map.fitBounds(L.latLngBounds(pts).pad(.28),{maxZoom:16});first=false;setTimeout(()=>map.invalidateSize(),80)}
      }catch(e){modal.querySelector('.bhuz-tracking-status strong').textContent=e.message}
      if(!closed)setTimeout(refresh,5000);
    }
    refresh();
  }

  window.BHUZ_TRACKING={open};
})();
