(() => {
  const API = window.DELI_API_URL || "https://deligo-backend-i554.onrender.com";
  let drivers = [];
  let initialized = false;

  const esc = (v) => String(v ?? "").replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const fmtDate = (v) => v ? new Intl.DateTimeFormat('es-VE',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v)) : '—';
  const authHeaders = () => {
    const token = sessionStorage.getItem('deliAdminSessionToken') || '';
    return {'Content-Type':'application/json', ...(token ? {'Authorization':`Bearer ${token}`} : {})};
  };

  const statusText = {PENDING:'Pendiente',APPROVED:'Aprobado',SUSPENDED:'Suspendido',BLOCKED:'Bloqueado',REJECTED:'Rechazado'};
  const opText = {OFFLINE:'Desconectado',AVAILABLE:'Disponible',ASSIGNED:'Asignado',ON_DELIVERY:'En entrega',BREAK:'En pausa'};

  async function request(path, options={}) {
    const response = await fetch(`${API}${path}`, {credentials:'include', ...options, headers:{...authHeaders(), ...(options.headers||{})}});
    let data={}; try { data=await response.json(); } catch {}
    if (!response.ok || data.ok===false) throw new Error(data.message || 'No se pudo completar la operación.');
    return data;
  }

  async function loadDrivers(showError=true) {
    const box=document.getElementById('driversList');
    if(box) box.innerHTML='<div class="empty-box">Cargando repartidores…</div>';
    try {
      const data=await request('/admin/drivers');
      drivers=Array.isArray(data.drivers)?data.drivers:[];
      renderStats(); renderList();
    } catch(err) {
      if(box) box.innerHTML=`<div class="empty-box error">${esc(err.message)}</div>`;
      if(showError) alert(err.message);
    }
  }

  function renderStats() {
    const counts={ALL:drivers.length,PENDING:0,APPROVED:0,SUSPENDED:0,BLOCKED:0,REJECTED:0,AVAILABLE:0,ON_DELIVERY:0};
    drivers.forEach(d=>{ counts[d.administrativeStatus]=(counts[d.administrativeStatus]||0)+1; if(d.isAvailable) counts.AVAILABLE++; if(d.operationalStatus==='ON_DELIVERY') counts.ON_DELIVERY++; });
    const stats=document.getElementById('driversStats');
    if(stats) stats.innerHTML=`
      <article><span>Total</span><strong>${counts.ALL}</strong></article>
      <article><span>Pendientes</span><strong>${counts.PENDING}</strong></article>
      <article><span>Aprobados</span><strong>${counts.APPROVED}</strong></article>
      <article><span>Disponibles</span><strong>${counts.AVAILABLE}</strong></article>
      <article><span>En entrega</span><strong>${counts.ON_DELIVERY}</strong></article>
      <article><span>Bloqueados</span><strong>${counts.BLOCKED}</strong></article>`;
    const pending=document.getElementById('repartidoresPendientes'); if(pending) pending.textContent=counts.PENDING;
    const badge=document.getElementById('repartidoresPendientesBadge'); if(badge){badge.textContent=counts.PENDING; badge.classList.toggle('hidden',counts.PENDING===0);}
  }

  function filtered() {
    const q=(document.getElementById('driversSearch')?.value||'').trim().toLowerCase();
    const st=document.getElementById('driversStatusFilter')?.value||'ALL';
    return drivers.filter(d => (st==='ALL'||d.administrativeStatus===st) && (!q || [d.fullName,d.email,d.phone,d.identityDocument,d.vehiclePlate,d.city,d.zone].some(v=>String(v||'').toLowerCase().includes(q))));
  }

  function actions(d) {
    if(d.administrativeStatus==='PENDING') return `<button class="driver-action approve" data-action="APPROVED" data-id="${esc(d.id)}">Aprobar</button><button class="driver-action reject" data-action="REJECTED" data-id="${esc(d.id)}">Rechazar</button>`;
    if(d.administrativeStatus==='APPROVED') return `<button class="driver-action warn" data-action="SUSPENDED" data-id="${esc(d.id)}">Suspender</button><button class="driver-action danger" data-action="BLOCKED" data-id="${esc(d.id)}">Bloquear</button>`;
    return `<button class="driver-action approve" data-action="APPROVED" data-id="${esc(d.id)}">Reactivar</button>`;
  }

  function renderList() {
    const box=document.getElementById('driversList'); if(!box)return;
    const list=filtered();
    if(!list.length){box.innerHTML='<div class="empty-box">No hay repartidores con esos filtros.</div>';return;}
    box.innerHTML=`<table class="admin-table drivers-table"><thead><tr><th>Repartidor</th><th>Contacto</th><th>Vehículo</th><th>Zona</th><th>Estado</th><th>Operación</th><th>Registro</th><th>Acciones</th></tr></thead><tbody>${list.map(d=>`<tr>
      <td><strong>${esc(d.fullName)}</strong><small>${esc(d.identityDocument||'Sin cédula')}</small></td>
      <td>${esc(d.phone||'—')}<small>${esc(d.email)}</small></td>
      <td>${esc(d.vehicleType||'—')}<small>${esc(d.vehiclePlate||'Sin placa')}</small></td>
      <td>${esc(d.city||'—')}<small>${esc(d.zone||'Sin zona')}</small></td>
      <td><span class="status-pill status-${esc(d.administrativeStatus.toLowerCase())}">${esc(statusText[d.administrativeStatus]||d.administrativeStatus)}</span></td>
      <td><span class="operation-dot ${d.isAvailable?'online':'offline'}"></span>${esc(opText[d.operationalStatus]||d.operationalStatus||'—')}</td>
      <td>${esc(fmtDate(d.createdAt))}</td>
      <td><div class="driver-actions"><button class="driver-action view" data-view="${esc(d.id)}">Ver</button>${actions(d)}</div></td>
    </tr>`).join('')}</tbody></table>`;
    bindRows();
  }

  function bindRows() {
    document.querySelectorAll('[data-action][data-id]').forEach(btn=>btn.addEventListener('click',()=>changeStatus(btn.dataset.id,btn.dataset.action)));
    document.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click',()=>showDetail(btn.dataset.view)));
  }

  async function changeStatus(id,status) {
    const d=drivers.find(x=>x.id===id); if(!d)return;
    const labels={APPROVED:'aprobar/reactivar',REJECTED:'rechazar',SUSPENDED:'suspender',BLOCKED:'bloquear'};
    if(!confirm(`¿Confirmas ${labels[status]||'cambiar el estado de'} a ${d.fullName}?`))return;
    try { await request(`/admin/drivers/${encodeURIComponent(id)}/status`,{method:'PATCH',body:JSON.stringify({status})}); await loadDrivers(false); alert('Estado del repartidor actualizado.'); }
    catch(err){alert(err.message);}
  }

  async function showDetail(id) {
    const panel=document.getElementById('driverDetailPanel'); if(!panel)return;
    panel.classList.remove('hidden'); panel.innerHTML='<div class="admin-panel">Cargando ficha…</div>';
    try {
      const {driver,summary}=await request(`/admin/drivers/${encodeURIComponent(id)}`);
      panel.innerHTML=`<div class="admin-panel driver-profile-card"><div class="driver-profile-head"><div><span class="eyebrow">Ficha del repartidor</span><h3>${esc(driver.fullName)}</h3><p>${esc(driver.email)}</p></div><button id="closeDriverDetail" class="driver-action view">Cerrar</button></div>
      <div class="driver-detail-grid">
       <div><span>Teléfono</span><strong>${esc(driver.phone||'—')}</strong></div><div><span>Cédula</span><strong>${esc(driver.identityDocument||'—')}</strong></div><div><span>País / ciudad</span><strong>${esc(driver.countryCode||'—')} · ${esc(driver.city||'—')}</strong></div><div><span>Zona</span><strong>${esc(driver.zone||'—')}</strong></div><div><span>Vehículo</span><strong>${esc([driver.vehicleType,driver.vehicleBrand,driver.vehicleModel].filter(Boolean).join(' · ')||'—')}</strong></div><div><span>Placa</span><strong>${esc(driver.vehiclePlate||'—')}</strong></div><div><span>Estado</span><strong>${esc(statusText[driver.administrativeStatus]||driver.administrativeStatus)}</strong></div><div><span>Última conexión</span><strong>${esc(fmtDate(driver.lastSeenAt))}</strong></div>
      </div><div class="driver-summary-grid"><article><span>Entregas completadas</span><strong>${Number(summary?.completedJobs||0)}</strong></article><article><span>Ganancia acumulada</span><strong>${Number(summary?.totalEarnings||0).toFixed(2)} ${esc(driver.baseCurrency||'USD')}</strong></article><article><span>Incidencias abiertas</span><strong>${Number(summary?.openIncidents||0)}</strong></article><article><span>Liquidaciones pendientes</span><strong>${Number(summary?.pendingSettlements||0)}</strong></article></div></div>`;
      document.getElementById('closeDriverDetail')?.addEventListener('click',()=>panel.classList.add('hidden'));
      panel.scrollIntoView({behavior:'smooth',block:'start'});
    } catch(err){panel.innerHTML=`<div class="empty-box error">${esc(err.message)}</div>`;}
  }

  function init() {
    if(initialized)return; initialized=true;
    document.getElementById('driversSearch')?.addEventListener('input',renderList);
    document.getElementById('driversStatusFilter')?.addEventListener('change',renderList);
    document.getElementById('refreshDriversBtn')?.addEventListener('click',()=>loadDrivers());
    document.querySelector('[data-section="repartidoresSection"]')?.addEventListener('click',()=>loadDrivers(false));
    loadDrivers(false);
  }

  window.initAdminDrivers=init;
})();
