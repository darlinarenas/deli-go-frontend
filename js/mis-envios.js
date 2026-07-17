document.addEventListener('DOMContentLoaded', async () => {
  const API=String(window.BHUZ_API_URL||window.API_BASE_URL||'https://deligo-backend-i554.onrender.com').replace(/\/+$/,'');
  const list=document.getElementById('shipmentsList');
  const total=document.getElementById('totalShipments');
  const active=document.getElementById('activeShipments');
  const last=document.getElementById('lastShipmentStatus');
  const greeting=document.getElementById('shipmentsUserText');
  let filter='all',shipments=[];
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const currentUser=()=>typeof getCurrentUser==='function'?getCurrentUser():window.DELI_CURRENT_USER;
  const statusLabel=s=>({PENDING_PAYMENT:'Pendiente de pago',PAID:'Pagado',WAITING_RECEIVER_LOCATION:'Esperando ubicación',SEARCHING_DRIVER:'Buscando repartidor',DRIVER_ASSIGNED:'Repartidor asignado',ASSIGNED:'Repartidor asignado',GOING_TO_PICKUP:'En camino al retiro',PACKAGE_PICKED:'Paquete retirado',PICKED_UP:'Paquete retirado',GOING_TO_DELIVERY:'En camino a la entrega',ARRIVED_AT_DELIVERY:'Llegó al destino',DELIVERED:'Entregado',CANCELLED:'Cancelado'})[String(s||'').toUpperCase()]||String(s||'Pendiente').replaceAll('_',' ');
  const fmtDate=v=>{if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('es-VE',{dateStyle:'medium',timeStyle:'short'})};
  const isActive=s=>!['DELIVERED','CANCELLED'].includes(String(s||'').toUpperCase());
  const canCancel=s=>!['PACKAGE_PICKED','PICKED_UP','GOING_TO_DELIVERY','ARRIVED_AT_DELIVERY','DELIVERED','CANCELLED'].includes(String(s||'').toUpperCase());
  const visible=()=>shipments.filter(x=>filter==='all'||(filter==='active'&&isActive(x.status))||(filter==='delivered'&&String(x.status).toUpperCase()==='DELIVERED')||(filter==='cancelled'&&String(x.status).toUpperCase()==='CANCELLED'));

  function render(){
    total.textContent=shipments.length;active.textContent=shipments.filter(x=>isActive(x.status)).length;last.textContent=shipments[0]?statusLabel(shipments[0].status):'-';
    const rows=visible();
    if(!rows.length){list.innerHTML='<article class="order-card shipment-empty">No hay envíos en esta categoría.<br><a href="index.html#envios">Crear un nuevo envío</a></article>';return;}
    list.innerHTML=rows.map(s=>{const id=esc(s.id);const driver=s.driverName?`${s.driverName}${s.driverVehiclePlate?` · ${s.driverVehiclePlate}`:''}`:'Sin repartidor asignado';return `<article class="order-card shipment-card" data-shipment-id="${id}">
      <div class="shipment-top"><div><div class="shipment-title">${esc(s.packageDescription||'Paquete BHUZ')}</div><div class="shipment-id">Envío ${id}</div></div><span class="shipment-status">${esc(statusLabel(s.status))}</span></div>
      <div class="shipment-route"><span>📍 ${esc(s.pickupAddress||'Punto de retiro')}</span><i>→</i><span>🏁 ${esc(s.deliveryAddress||'Punto de entrega')}</span></div>
      <div class="shipment-meta"><span><b>Receptor:</b> ${esc(s.receiverName||'—')}</span><span><b>Repartidor:</b> ${esc(driver)}</span><span><b>Total:</b> $${Number(s.totalAmount||0).toFixed(2)}</span><span><b>Fecha:</b> ${esc(fmtDate(s.createdAt))}</span></div>
      <div class="shipment-actions">${isActive(s.status)?`<button class="primary" data-track="${id}">Ver seguimiento</button>`:''}<button class="secondary" data-detail="${id}">Ver actividad y detalles</button>${canCancel(s.status)?`<button class="danger" data-cancel="${id}">Cancelar envío</button>`:''}</div>
      <div class="shipment-detail hidden" id="shipment-detail-${id}"><span><b>Estado:</b> ${esc(statusLabel(s.status))}</span><span><b>Contacto receptor:</b> ${esc(s.receiverPhone||'—')}</span><span><b>Referencia de retiro:</b> ${esc(s.pickupReference||'—')}</span><span><b>Referencia de entrega:</b> ${esc(s.deliveryReference||'—')}</span><span><b>Distancia:</b> ${Number(s.distanceKm||0).toFixed(2)} km</span><span><b>Código de entrega:</b> ${esc(s.deliveryCode||'Disponible en la ficha pública del receptor')}</span><span><b>Actualizado:</b> ${esc(fmtDate(s.updatedAt||s.createdAt))}</span></div>
    </article>`}).join('');
  }

  async function load(silent=false){
    const user=currentUser();
    if(!user?.email){list.innerHTML='<article class="order-card shipment-empty">Debes iniciar sesión para ver tus envíos.</article>';return;}
    if(!silent) greeting.textContent=`${user.fullName||user.name||'Usuario'}, aquí podrás recuperar y seguir todos tus paquetes.`;
    try{const r=await fetch(`${API}/api/services/customer/history?email=${encodeURIComponent(user.email)}`,{credentials:'include'});const d=await r.json().catch(()=>({}));if(!r.ok||d.ok===false)throw Error(d.message||'No se pudieron cargar tus envíos.');shipments=Array.isArray(d.services)?d.services:[];shipments.sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));render()}catch(e){if(!silent)list.innerHTML=`<article class="order-card shipment-empty">${esc(e.message)}</article>`}
  }

  document.querySelectorAll('[data-filter]').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===btn));filter=btn.dataset.filter;render()}));
  document.addEventListener('click',async e=>{
    const detail=e.target.closest('[data-detail]');if(detail){const box=document.getElementById(`shipment-detail-${detail.dataset.detail}`);box?.classList.toggle('hidden');detail.textContent=box?.classList.contains('hidden')?'Ver actividad y detalles':'Ocultar detalles';return;}
    const track=e.target.closest('[data-track]');if(track){if(window.BHUZ_TRACKING)window.BHUZ_TRACKING.open('PACKAGE',track.dataset.track,{title:'Seguimiento de tu paquete'});else alert('El seguimiento todavía no está disponible.');return;}
    const cancel=e.target.closest('[data-cancel]');if(cancel){if(!confirm('¿Seguro que deseas cancelar este envío?'))return;cancel.disabled=true;try{const r=await fetch(`${API}/api/services/${encodeURIComponent(cancel.dataset.cancel)}/status`,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({status:'CANCELLED',changedBy:`customer:${currentUser()?.email||''}`,notes:'Cliente canceló el envío desde Mis envíos.'})});const d=await r.json().catch(()=>({}));if(!r.ok||d.ok===false)throw Error(d.message||'No se pudo cancelar el envío.');await load(true)}catch(err){alert(err.message)}finally{cancel.disabled=false}}
  });
  await load();setInterval(()=>{if(document.visibilityState==='visible')load(true)},12000);
});
