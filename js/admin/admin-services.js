(() => {
  let services = [];
  let selectedId = '';
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const statusLabel = (v) => ({PENDING_PAYMENT:'Pendiente de pago',PAID:'Pagado',WAITING_RECEIVER_LOCATION:'Esperando ubicación',SEARCHING_DRIVER:'Buscando repartidor',DRIVER_ASSIGNED:'Repartidor asignado',GOING_TO_PICKUP:'En camino al retiro',PACKAGE_PICKED:'Paquete retirado',GOING_TO_DELIVERY:'En camino a la entrega',DELIVERED:'Entregado',CANCELLED:'Cancelado'})[String(v||'').toUpperCase()] || String(v||'Pendiente').replaceAll('_',' ');
  const fmtDate = (v) => { if(!v) return '—'; const d=new Date(v); return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('es-VE',{dateStyle:'medium',timeStyle:'short'}).format(d); };
  const money = (v) => `$${Number(v||0).toFixed(2)}`;
  const isActive = (s) => !['DELIVERED','CANCELLED'].includes(String(s.status||'').toUpperCase());

  function filtered(){
    const q=(document.getElementById('adminServicesSearch')?.value||'').trim().toLowerCase();
    const st=document.getElementById('adminServicesStatus')?.value||'ALL';
    return services.filter(s => {
      const status=String(s.status||'').toUpperCase();
      const statusOk=st==='ALL'||(st==='ACTIVE'&&isActive(s))||status===st;
      const hay=[s.id,s.customerName,s.customerEmail,s.receiverName,s.receiverPhone,s.pickupAddress,s.deliveryAddress,s.driverName,s.driverVehiclePlate,s.packageDescription].join(' ').toLowerCase();
      return statusOk && (!q || hay.includes(q));
    });
  }

  function renderStats(){
    const total=services.length, active=services.filter(isActive).length, delivered=services.filter(s=>String(s.status).toUpperCase()==='DELIVERED').length;
    const searching=services.filter(s=>String(s.status).toUpperCase()==='SEARCHING_DRIVER').length;
    const income=services.filter(s=>String(s.status).toUpperCase()==='DELIVERED').reduce((a,s)=>a+Number(s.totalAmount||0),0);
    const box=document.getElementById('adminServicesStats');
    if(box) box.innerHTML=`<article><span>Total</span><strong>${total}</strong></article><article><span>Activos</span><strong>${active}</strong></article><article><span>Buscando repartidor</span><strong>${searching}</strong></article><article><span>Entregados</span><strong>${delivered}</strong></article><article><span>Facturación entregada</span><strong>${money(income)}</strong></article>`;
    const badge=document.getElementById('enviosActivosBadge'); if(badge){badge.textContent=active;badge.classList.toggle('hidden',active===0);}
  }

  function renderList(){
    const box=document.getElementById('adminServicesList'); if(!box)return;
    const list=filtered();
    if(!list.length){box.innerHTML='<div class="empty-box">No hay paquetes con esos filtros.</div>';document.getElementById('adminServiceDetail').innerHTML='<div class="empty-box">Sin resultados para mostrar.</div>';return;}
    if(!selectedId || !list.some(s=>s.id===selectedId)) selectedId=list[0].id;
    box.innerHTML=list.map(s=>`<button type="button" class="admin-service-row ${s.id===selectedId?'active':''}" data-service-id="${esc(s.id)}"><span class="service-row-icon">📦</span><span class="service-row-main"><b>${esc(s.customerName||s.customerEmail||'Cliente')}</b><small>${esc(s.receiverName||'Receptor')} · ${esc(fmtDate(s.createdAt))}</small></span><span class="service-row-end"><em class="service-status status-${esc(String(s.status||'').toLowerCase())}">${esc(statusLabel(s.status))}</em><strong>${money(s.totalAmount)}</strong></span></button>`).join('');
    box.querySelectorAll('[data-service-id]').forEach(btn=>btn.onclick=()=>{selectedId=btn.dataset.serviceId;renderList();renderDetail();});
    renderDetail();
  }

  function renderDetail(){
    const box=document.getElementById('adminServiceDetail'); if(!box)return;
    const s=services.find(x=>x.id===selectedId); if(!s){box.innerHTML='<div class="empty-box">Selecciona un envío.</div>';return;}
    const driver=s.driverName ? `${s.driverName}${s.driverVehicleType?' · '+s.driverVehicleType:''}${s.driverVehiclePlate?' · '+s.driverVehiclePlate:''}` : 'Aún sin repartidor';
    box.innerHTML=`<div class="service-detail-head"><div><span class="mini-label">${esc(s.id)}</span><h3>${esc(s.packageDescription||'Paquete')}</h3><p>${esc(statusLabel(s.status))}</p></div><span class="service-status status-${esc(String(s.status||'').toLowerCase())}">${esc(statusLabel(s.status))}</span></div>
      <details open><summary>Ruta y entrega</summary><div class="service-detail-grid"><p><b>Retiro</b>${esc(s.pickupAddress||'—')}<small>${esc(s.pickupReference||'Sin referencia')}</small></p><p><b>Entrega</b>${esc(s.deliveryAddress||'—')}<small>${esc(s.deliveryReference||'Sin referencia')}</small></p><p><b>Distancia</b>${Number(s.distanceKm||0).toFixed(2)} km</p><p><b>Total</b>${money(s.totalAmount)}</p></div></details>
      <details><summary>Personas responsables</summary><div class="service-detail-grid"><p><b>Quién envía</b>${esc(s.customerName||'—')}<small>${esc(s.customerEmail||'—')} · ${esc(s.customerPhone||'—')}</small></p><p><b>Quién recibe</b>${esc(s.receiverName||'—')}<small>${esc(s.receiverPhone||'—')}</small></p><p class="wide"><b>Repartidor</b>${esc(driver)}<small>${esc(s.driverPhone||'Sin teléfono')}</small></p></div></details>
      <details><summary>Fechas y operación</summary><div class="service-detail-grid"><p><b>Creado</b>${esc(fmtDate(s.createdAt))}</p><p><b>Actualizado</b>${esc(fmtDate(s.updatedAt))}</p><p><b>Aceptado</b>${esc(fmtDate(s.acceptedAt))}</p><p><b>Retirado</b>${esc(fmtDate(s.pickedUpAt))}</p><p><b>Entregado</b>${esc(fmtDate(s.deliveredAt))}</p><p><b>Pago</b>${esc(s.paymentStatus||'Pendiente')} · ${esc(s.paymentMethod||'Sin método')}</p></div></details>`;
  }

  function bind(){
    document.getElementById('adminServicesSearch')?.addEventListener('input',renderList);
    document.getElementById('adminServicesStatus')?.addEventListener('change',renderList);
    document.getElementById('refreshAdminServicesBtn')?.addEventListener('click',()=>window.cargarDatosAdministrador?.());
  }

  window.initAdminServices=(source=[])=>{services=Array.isArray(source)?source:[];renderStats();renderList();bind();};
})();
