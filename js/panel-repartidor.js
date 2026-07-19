document.addEventListener('DOMContentLoaded',async()=>{
  const API=String(window.BHUZ_API_URL||window.API_BASE_URL||'https://deligo-backend-i554.onrender.com').replace(/\/+$/,'');
  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const PICKUP_RADIUS_M=120,DELIVERY_RADIUS_M=150;
  let session=JSON.parse(localStorage.getItem('bhuz_driver_session')||'null');
  let data=null,current='inicio',position=null,watchId=null,lastLocationSent=0,loading=false;
  let stationarySince=Date.now(),stationaryAnchor=null,inactivityModalOpen=false;
  let profileEditing=false;
  let knownAvailableJobIds=new Set();
  const draftState={perfil:false,cierres:false};

  async function api(path,opt={}){const r=await fetch(API+path,{method:opt.method||'GET',headers:{'Content-Type':'application/json'},body:opt.body?JSON.stringify(opt.body):undefined});const d=await r.json().catch(()=>({}));if(!r.ok||d.ok===false)throw Error(d.message||'Error de conexión');return d}
  if(!session){const u=typeof getCurrentUser==='function'?getCurrentUser():null;if(u){const id=String(u.id||u.email||'legacy-driver').toLowerCase().replace(/[^a-z0-9@._-]/g,'-');const d=await api(`/api/drivers/${encodeURIComponent(id)}/bootstrap`,{method:'POST',body:{userId:u.id,fullName:u.fullName||u.name,email:u.email,phone:u.phone}});session=d.driver;localStorage.setItem('bhuz_driver_session',JSON.stringify(session));}else{location.href='acceso-repartidor.html';return}}

  const themeKey='bhuz_driver_theme';
  function applyTheme(t){document.documentElement.dataset.theme=t;localStorage.setItem(themeKey,t);q('#themeToggle').textContent=t==='dark'?'☀':'☾'}
  applyTheme(localStorage.getItem(themeKey)||'dark');
  q('#themeToggle').onclick=()=>applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');

  const money=(n,c='USD')=>{try{return new Intl.NumberFormat('es-VE',{style:'currency',currency:c||'USD',maximumFractionDigits:2}).format(Number(n||0))}catch{return `${Number(n||0).toFixed(2)} ${c||'USD'}`}};
  const dt=v=>v?new Date(v).toLocaleString('es-VE'):'—';
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const statusEs=s=>({PENDING_ASSIGNMENT:'Pendiente por asignar',ASSIGNED:'Repartidor asignado',GOING_TO_PICKUP:'En camino al retiro',ARRIVED_AT_PICKUP:'Llegó al retiro',PICKED_UP:'Paquete retirado',GOING_TO_DELIVERY:'En camino a la entrega',ARRIVED_AT_DELIVERY:'Llegó al destino',DELIVERED:'Entregado',CANCELLED:'Cancelado'})[String(s||'').toUpperCase()]||String(s||'Sin estado');
  function toast(t){const e=q('#driverToast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2700)}
  function closeJobRequestModal(){q('#jobRequestModal')?.remove();document.body.classList.remove('modal-open')}
  function showJobRequestModal(job){
    if(!job||q('#jobRequestModal')||data?.activeJob)return;
    const modal=document.createElement('div');modal.id='jobRequestModal';modal.className='job-request-modal';
    modal.innerHTML=`<section class="job-request-dialog" role="dialog" aria-modal="true"><span class="section-kicker">NUEVA SOLICITUD</span><h2>Tienes un nuevo servicio</h2><p class="muted">Revisa la ruta y decide si deseas aceptarlo.</p>${jobCard(job)}<button class="btn btn-dark btn-block" type="button" data-close-job-modal>Ver después</button></section>`;
    document.body.appendChild(modal);document.body.classList.add('modal-open');
    modal.querySelector('[data-close-job-modal]').onclick=closeJobRequestModal;
  }
  function closeProfileModal(result=false){
    const modal=q('#profileConfirmModal');
    if(!modal)return;
    modal.classList.remove('show');
    document.body.classList.remove('modal-open');
    const resolver=modal._resolver;
    setTimeout(()=>modal.remove(),180);
    if(typeof resolver==='function')resolver(result);
  }
  function closeDeliveryCodeModal(result=null){
    const modal=q('#deliveryCodeModal');
    if(!modal)return;
    modal.classList.remove('show');
    document.body.classList.remove('modal-open');
    const resolver=modal._resolver;
    setTimeout(()=>modal.remove(),180);
    if(typeof resolver==='function')resolver(result);
  }
  function requestDeliveryCode(){
    return new Promise(resolve=>{
      q('#deliveryCodeModal')?.remove();
      const modal=document.createElement('div');
      modal.id='deliveryCodeModal';
      modal.className='delivery-code-modal';
      modal.innerHTML=`<div class="delivery-code-backdrop" data-code-close></div><section class="delivery-code-dialog" role="dialog" aria-modal="true" aria-labelledby="deliveryCodeTitle"><div class="delivery-code-icon">✓</div><span class="section-kicker">SEGURIDAD DE ENTREGA</span><h3 id="deliveryCodeTitle">Ingresa el código del receptor</h3><p>Solicita al cliente el código de 6 dígitos para cerrar la entrega.</p><div class="delivery-code-inputs" aria-label="Código de entrega">${Array.from({length:6},(_,i)=>`<input inputmode="numeric" pattern="[0-9]*" maxlength="1" autocomplete="one-time-code" data-code-digit="${i}" aria-label="Dígito ${i+1}">`).join('')}</div><small class="delivery-code-error" hidden></small><div class="delivery-code-actions"><button class="btn btn-dark" type="button" data-code-cancel>Cancelar</button><button class="btn btn-green" type="button" data-code-confirm>Confirmar entrega</button></div></section>`;
      modal._resolver=resolve;document.body.appendChild(modal);document.body.classList.add('modal-open');requestAnimationFrame(()=>modal.classList.add('show'));
      const inputs=[...modal.querySelectorAll('[data-code-digit]')];
      const error=modal.querySelector('.delivery-code-error');
      const value=()=>inputs.map(x=>x.value.replace(/\D/g,'')).join('');
      inputs.forEach((input,index)=>{
        input.addEventListener('input',()=>{input.value=input.value.replace(/\D/g,'').slice(-1);error.hidden=true;if(input.value&&inputs[index+1])inputs[index+1].focus()});
        input.addEventListener('keydown',ev=>{if(ev.key==='Backspace'&&!input.value&&inputs[index-1])inputs[index-1].focus();if(ev.key==='ArrowLeft'&&inputs[index-1])inputs[index-1].focus();if(ev.key==='ArrowRight'&&inputs[index+1])inputs[index+1].focus()});
        input.addEventListener('paste',ev=>{const digits=(ev.clipboardData?.getData('text')||'').replace(/\D/g,'').slice(0,6);if(!digits)return;ev.preventDefault();digits.split('').forEach((d,i)=>{if(inputs[i])inputs[i].value=d});inputs[Math.min(digits.length,6)-1]?.focus()});
      });
      modal.querySelector('[data-code-cancel]').onclick=()=>closeDeliveryCodeModal(null);
      modal.querySelector('[data-code-close]').onclick=()=>closeDeliveryCodeModal(null);
      modal.querySelector('[data-code-confirm]').onclick=()=>{const code=value();if(code.length!==6){error.textContent='Debes completar los 6 dígitos.';error.hidden=false;inputs.find(x=>!x.value)?.focus();return}closeDeliveryCodeModal(code)};
      inputs[0]?.focus();
    });
  }
  function confirmProfileUpdate(){
    return new Promise(resolve=>{
      q('#profileConfirmModal')?.remove();
      const modal=document.createElement('div');
      modal.id='profileConfirmModal';
      modal.className='profile-modal';
      modal.innerHTML=`<div class="profile-modal-backdrop" data-profile-modal-close></div><section class="profile-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="profileModalTitle"><div class="profile-modal-icon">?</div><h3 id="profileModalTitle">Confirmar actualización</h3><p>¿Estás seguro de que deseas actualizar tu información?</p><small>Verifica que todos los datos sean correctos antes de guardar.</small><div class="profile-modal-actions"><button class="btn btn-dark" type="button" data-profile-modal-cancel>Cancelar</button><button class="btn btn-green" type="button" data-profile-modal-confirm>Sí, actualizar</button></div></section>`;
      modal._resolver=resolve;
      document.body.appendChild(modal);
      document.body.classList.add('modal-open');
      requestAnimationFrame(()=>modal.classList.add('show'));
      modal.querySelector('[data-profile-modal-cancel]').onclick=()=>closeProfileModal(false);
      modal.querySelector('[data-profile-modal-close]').onclick=()=>closeProfileModal(false);
      modal.querySelector('[data-profile-modal-confirm]').onclick=()=>closeProfileModal(true);
      document.addEventListener('keydown',function closeOnEsc(ev){
        if(ev.key==='Escape'){
          document.removeEventListener('keydown',closeOnEsc);
          closeProfileModal(false);
        }
      });
    });
  }
  function haversine(a,b,c,d){const R=6371000,toRad=x=>x*Math.PI/180;const dLat=toRad(c-a),dLon=toRad(d-b);const z=Math.sin(dLat/2)**2+Math.cos(toRad(a))*Math.cos(toRad(c))*Math.sin(dLon/2)**2;return 2*R*Math.atan2(Math.sqrt(z),Math.sqrt(1-z))}
  function targetFor(j){if(!j)return null;if(['GOING_TO_PICKUP'].includes(j.status))return{lat:Number(j.pickup_latitude),lng:Number(j.pickup_longitude),radius:PICKUP_RADIUS_M,label:'punto de retiro'};if(['GOING_TO_DELIVERY'].includes(j.status))return{lat:Number(j.delivery_latitude),lng:Number(j.delivery_longitude),radius:DELIVERY_RADIUS_M,label:'destino'};return null}
  function geoState(j){const t=targetFor(j);if(!t)return{required:false,allowed:true,text:''};if(!Number.isFinite(t.lat)||!Number.isFinite(t.lng)||!t.lat||!t.lng)return{required:false,allowed:true,text:'Este servicio no posee coordenadas GPS. Se permite confirmación manual.'};if(!position)return{required:true,allowed:false,text:'Activa el GPS para validar tu llegada.'};const distance=haversine(position.latitude,position.longitude,t.lat,t.lng);return{required:true,allowed:distance<=t.radius,distance,text:distance<=t.radius?`Ubicación confirmada: estás a ${Math.round(distance)} m del ${t.label}.`:`Estás a ${Math.round(distance)} m del ${t.label}. El botón se habilita al acercarte.`}}
  function stationaryMinutes(){return Math.floor((Date.now()-stationarySince)/60000)}
  function updateStationaryState(next){
    if(!stationaryAnchor){stationaryAnchor={latitude:next.latitude,longitude:next.longitude};stationarySince=Date.now();return}
    if(haversine(stationaryAnchor.latitude,stationaryAnchor.longitude,next.latitude,next.longitude)>50){stationaryAnchor={latitude:next.latitude,longitude:next.longitude};stationarySince=Date.now()}
  }
  function closeActivePrompt(){document.getElementById('driverActivePrompt')?.remove();document.body.classList.remove('modal-open');inactivityModalOpen=false}
  function showActivePrompt(deadlineAt){
    if(inactivityModalOpen)return;inactivityModalOpen=true;
    if('Notification'in window&&Notification.permission==='granted'){try{new Notification('BHUZ · ¿Sigues activo?',{body:'Confirma en los próximos 2 minutos para continuar disponible.',tag:'bhuz-driver-active'})}catch{}}
    const modal=document.createElement('div');modal.id='driverActivePrompt';modal.className='profile-modal show';modal.innerHTML=`<div class="profile-modal-backdrop"></div><section class="profile-modal-dialog" role="dialog" aria-modal="true"><div class="profile-modal-icon">⏱</div><h3>¿Sigues activo?</h3><p>Llevas varios minutos sin movimiento. Confirma para seguir recibiendo servicios.</p><small id="activePromptCountdown">Tienes 2:00 minutos para responder.</small><div class="profile-modal-actions"><button class="btn btn-green" id="confirmStillActive" type="button">Sí, sigo activo</button></div></section>`;document.body.appendChild(modal);document.body.classList.add('modal-open');
    const deadline=new Date(deadlineAt||Date.now()+120000).getTime();const timer=setInterval(()=>{const left=Math.max(0,deadline-Date.now()),m=Math.floor(left/60000),sec=Math.floor((left%60000)/1000);const e=document.getElementById('activePromptCountdown');if(e)e.textContent=`Tienes ${m}:${String(sec).padStart(2,'0')} minutos para responder.`;if(left<=0){clearInterval(timer);closeActivePrompt();session={...session,isAvailable:false,sessionActive:false,operationalStatus:'OFFLINE'};localStorage.setItem('bhuz_driver_session',JSON.stringify(session));render();toast('BHUZ te marcó como inactivo por falta de confirmación.')}} ,1000);
    document.getElementById('confirmStillActive').onclick=async()=>{try{const d=await api(`/api/drivers/${session.id}/still-active`,{method:'POST'});session=d.driver||session;localStorage.setItem('bhuz_driver_session',JSON.stringify(session));stationarySince=Date.now();stationaryAnchor=position?{...position}:stationaryAnchor;clearInterval(timer);closeActivePrompt();render();toast('Actividad confirmada. Sigues disponible.')}catch(e){toast(e.message)}};
  }
  async function heartbeat(){
    try{const d=await api(`/api/drivers/${session.id}/heartbeat`,{method:'POST',body:{stationaryMinutes:stationaryMinutes()}});session=d.driver||session;localStorage.setItem('bhuz_driver_session',JSON.stringify(session));if(d.prompt)showActivePrompt(d.deadlineAt);if(d.forcedOffline){closeActivePrompt();render();toast('Tu sesión fue marcada como inactiva.')}}catch{}
  }
  function startGps(){if(!navigator.geolocation)return updateGps('GPS no compatible','Tu navegador no permite validar ubicación.',true);if(watchId!==null)return;watchId=navigator.geolocation.watchPosition(async p=>{position={latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy};updateStationaryState(position);updateGps('GPS activo',`Precisión aproximada: ${Math.round(p.coords.accuracy)} m.`);if(Date.now()-lastLocationSent>25000){lastLocationSent=Date.now();api(`/api/drivers/${session.id}/location`,{method:'POST',body:position}).catch(()=>{})}if(data?.activeJob)renderInicio()},err=>updateGps('GPS pendiente',err.code===1?'Debes permitir el acceso a tu ubicación.':'No pudimos obtener tu ubicación.',true),{enableHighAccuracy:true,maximumAge:5000,timeout:15000})}
  function updateGps(title,text,warn=false){const box=q('#gpsStatus');box.hidden=false;q('#gpsStatusTitle').textContent=title;q('#gpsStatusText').textContent=text;box.querySelector('.gps-dot').style.background=warn?'var(--warning)':'var(--green)'}

  function isEditingInside(viewId){
    const active=document.activeElement;
    return !!(active&&active.matches('input, textarea, select')&&active.closest('#'+viewId));
  }
  async function load(){
    if(loading)return;
    loading=true;
    const scrollBefore=window.scrollY;
    try{
      const previousIds=knownAvailableJobIds;
      data=await api(`/api/drivers/${session.id}/dashboard`);
      const incoming=(data.availableJobs||[]).filter(job=>!previousIds.has(String(job.id)));
      knownAvailableJobIds=new Set((data.availableJobs||[]).map(job=>String(job.id)));
      if(incoming.length && session?.isAvailable && !data.activeJob){
        toast(incoming.length===1?'Nueva solicitud disponible':'Nuevas solicitudes disponibles');
        if('Notification' in window && Notification.permission==='granted'){
          try{new Notification('BHUZ · Nueva solicitud',{body:'Tienes un servicio disponible para aceptar o rechazar.',tag:'bhuz-new-job'})}catch{}
        }
        showJobRequestModal(incoming[0]);
      }
      session=data.driver;
      localStorage.setItem('bhuz_driver_session',JSON.stringify(session));
      render();
      if(data.activeJob||session.isAvailable)startGps();
      requestAnimationFrame(()=>window.scrollTo(0,scrollBefore));
    }catch(e){
      data={driver:session,activeJob:null,availableJobs:[],history:[],ledger:[],settlements:[],settlementRequests:[],stats:{deliveries_today:0,earnings_today:0,km_today:0,deliveries_week:0,earnings_week:0,balance:0}};
      render();
      q('#inicioView').innerHTML=`<div class="card error-card"><h2>No pudimos cargar los datos</h2><p>${esc(e.message)}</p><p class="muted">Puedes navegar por las secciones mientras reintentamos la conexión.</p><button class="btn btn-green" id="retryDashboard">Reintentar</button></div>`;
      toast(e.message);
    }finally{loading=false}
  }
  function render(){
    q('#welcomeName').textContent=`Hola, ${session.fullName||'repartidor'} 👋`;
    q('#availabilityText').textContent=session.isAvailable?'Disponible':'No disponible';
    q('#availabilityToggle').classList.toggle('on',session.isAvailable);
    renderStats();renderInicio();renderEntregas();renderFinanzas();
    if(!draftState.cierres&&!isEditingInside('cierresView'))renderCierres();
    if(!draftState.perfil&&!isEditingInside('perfilView'))renderPerfil();
  }
  function renderStats(){const s=data.stats||{};q('#driverStats').innerHTML=[['Entregas hoy',s.deliveries_today||0],['Ganancia hoy',money(s.earnings_today,session.baseCurrency)],['Kilómetros',`${Number(s.km_today||0).toFixed(1)} km`],['Saldo',money(s.balance,session.baseCurrency)]].map(x=>`<div class="stat-card"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('')}
  function activeButtons(j){const next={ASSIGNED:'GOING_TO_PICKUP',GOING_TO_PICKUP:'ARRIVED_AT_PICKUP',ARRIVED_AT_PICKUP:'PICKED_UP',PICKED_UP:'GOING_TO_DELIVERY',GOING_TO_DELIVERY:'ARRIVED_AT_DELIVERY',ARRIVED_AT_DELIVERY:'DELIVERED'};const labels={GOING_TO_PICKUP:'Iniciar ruta al retiro',ARRIVED_AT_PICKUP:'Llegué al retiro',PICKED_UP:'Confirmar pedido retirado',GOING_TO_DELIVERY:'Iniciar ruta de entrega',ARRIVED_AT_DELIVERY:'Llegué al destino',DELIVERED:'Confirmar entrega'};const n=next[j.status];if(!n)return'';const geo=geoState(j),disabled=((n==='ARRIVED_AT_PICKUP'||n==='ARRIVED_AT_DELIVERY')&&!geo.allowed);return `<button class="btn btn-green" data-job-status="${n}" data-job-id="${j.id}" ${disabled?'disabled':''}>${labels[n]}</button><button class="btn btn-danger" data-incident="${j.id}">Reportar incidencia</button>${geo.text?`<p class="geo-help ${geo.allowed?'ok':'warn'}">${esc(geo.text)}</p>`:''}`}
  function jobCard(j,active=false){return `<article class="job-card"><div class="job-top"><div><span class="badge">${j.source_type==='FOOD_ORDER'?'PEDIDO DE RESTAURANTE':'ENVÍO DE PAQUETE'}</span><h3>${esc(j.pickup_name||'Punto de retiro')}</h3></div><strong>${money(j.driver_earning,j.currency)}</strong></div><div class="job-route"><div class="route-row"><i class="route-dot"></i><div><strong>Retiro</strong><small>${esc(j.pickup_address||'Dirección pendiente')}${j.pickup_reference?` · ${esc(j.pickup_reference)}`:''}</small></div></div><div class="route-row"><i class="route-dot"></i><div><strong>Entrega</strong><small>${esc(j.delivery_address||'Dirección pendiente')}${j.delivery_reference?` · ${esc(j.delivery_reference)}`:''}</small></div></div></div><div class="job-meta"><div class="mini-box"><span>Distancia</span><b>${Number(j.distance_km||0).toFixed(1)} km</b></div><div class="mini-box"><span>Total</span><b>${money(j.service_total,j.currency)}</b></div><div class="mini-box"><span>Estado</span><b>${esc(statusEs(j.status))}</b></div></div><div class="action-row">${active?activeButtons(j):`<button class="btn btn-green" data-accept-job="${j.id}">Aceptar servicio</button><button class="btn btn-danger" data-reject-job="${j.id}">Rechazar</button>`}<button class="btn btn-dark" data-map="${encodeURIComponent(active&&['PICKED_UP','GOING_TO_DELIVERY','ARRIVED_AT_DELIVERY'].includes(j.status)?j.delivery_address||'':j.pickup_address||'')}">Abrir en mapa</button></div></article>`}
  function renderInicio(){
    const s=data.stats||{};
    const summary=`<div class="driver-summary-card"><div class="mini-box"><span>Entregas</span><b>${s.deliveries_today||0}</b></div><div class="mini-box"><span>Ganancias</span><b>${money(s.earnings_today,session.baseCurrency)}</b></div><div class="mini-box"><span>Kilómetros</span><b>${Number(s.km_today||0).toFixed(1)} km</b></div><div class="mini-box"><span>Saldo</span><b>${money(s.balance,session.baseCurrency)}</b></div><div class="mini-box"><span>GPS</span><b>${position?'Activo':'Esperando'}</b></div><div class="mini-box"><span>Jornada</span><b>${session.isAvailable?'Disponible':'No disponible'}</b></div></div>`;
    if(data.activeJob){
      q('#inicioView').innerHTML=`<div class="section-stack"><div class="card"><span class="section-kicker">MI JORNADA</span><h2>${esc(session.fullName||'Repartidor')}</h2>${summary}</div><div><h2>Entrega activa</h2>${jobCard(data.activeJob,true)}</div><div class="driver-home-actions"><button class="btn btn-dark" data-open-view="entregas">Ver historial</button><button class="btn btn-dark" data-open-view="finanzas">Ver finanzas</button><button class="btn btn-dark" data-open-view="perfil">Ver perfil</button></div></div>`;
      return;
    }
    const available=(data.availableJobs||[]);
    q('#inicioView').innerHTML=`<div class="section-stack"><div class="card"><span class="section-kicker">MI JORNADA</span><h2>${esc(session.fullName||'Repartidor')}</h2>${summary}<p class="muted">${session.isAvailable?'Estás listo para recibir nuevas solicitudes.':'Activa tu disponibilidad para comenzar.'}</p></div>${available.length?`<div><h2>Solicitud disponible</h2>${jobCard(available[0])}</div>`:''}<div class="driver-home-actions"><button class="btn btn-dark" data-open-view="entregas">Ver entregas</button><button class="btn btn-dark" data-open-view="finanzas">Ver ganancias</button><button class="btn btn-dark" data-open-view="cierres">Ver cierres</button><button class="btn btn-dark" data-open-view="perfil">Ver perfil</button></div></div>`;
  }
  function renderEntregas(){
    const cards=(data.history||[]).map(j=>`<article class="mobile-list-card"><div class="mobile-list-head"><div><span class="badge">${j.source_type==='FOOD_ORDER'?'RESTAURANTE':'PAQUETE'}</span><strong>${esc(j.pickup_name||'Punto de retiro')}</strong></div><b>${money(j.driver_earning,j.currency)}</b></div><p>${esc(j.delivery_address||'Destino no informado')}</p><div class="mobile-list-meta"><span>${dt(j.delivered_at||j.updated_at)}</span><span>${Number(j.distance_km||0).toFixed(1)} km</span><span>${esc(statusEs(j.status))}</span></div></article>`).join('');
    q('#entregasView').innerHTML=`<div class="section-stack"><h2>Historial de entregas</h2>${cards||'<div class="card empty">Aún no tienes entregas registradas.</div>'}</div>`
  }
  function renderFinanzas(){
    const cards=(data.ledger||[]).map(m=>`<article class="movement-card"><div><strong>${esc(m.description||m.movement_type||'Movimiento')}</strong><small>${dt(m.created_at)}</small></div><b class="${m.direction==='CREDIT_DRIVER'?'positive':'negative'}">${m.direction==='CREDIT_DRIVER'?'+':'-'}${money(m.amount,m.currency)}</b></article>`).join('');
    q('#finanzasView').innerHTML=`<div class="section-stack"><div class="card finance-summary"><span>Saldo actual</span><strong>${money(data.stats?.balance,session.baseCurrency)}</strong><small>Los montos se confirman en cada liquidación administrativa.</small></div><div><h2>Cuenta corriente</h2>${cards||'<div class="card empty">Sin movimientos registrados.</div>'}</div><div class="card"><h2>Cómo se calcula</h2><p>Las ganancias por entrega se suman al saldo. Los cobros en efectivo quedan registrados para conciliarlos con BHUZ.</p></div></div>`
  }
  function renderCierres(){
    const pending=(data.settlementRequests||[]).find(x=>x.status==='PENDING');
    const requests=(data.settlementRequests||[]).map(x=>`<article class="mobile-list-card"><div class="mobile-list-head"><strong>Solicitud semanal</strong><span class="status-pill">${esc(x.status)}</span></div><p>${dt(x.requested_at)}</p></article>`).join('');
    const settlements=(data.settlements||[]).map(x=>`<article class="mobile-list-card"><div class="mobile-list-head"><strong>${esc(x.cutoff_mode||'Cierre')}</strong><b>${money(x.net_balance,x.currency)}</b></div><p>${dt(x.period_from)} — ${dt(x.period_to)}</p><div class="mobile-list-meta"><span>${x.total_jobs||0} servicios</span><span>${esc(x.status)}</span></div></article>`).join('');
    q('#cierresView').innerHTML=`<div class="section-stack"><div class="card request-close-card"><span class="section-kicker">LIQUIDACIONES</span><h2>Solicitar cierre semanal</h2><p>El administrador revisará tus entregas, cobros y saldo. El rango y la tasa de cambio serán definidos por administración.</p><label class="field-label">Nota opcional<textarea id="settlementRequestNote" rows="3" placeholder="Ej.: necesito confirmar el cierre de esta semana"></textarea></label><button class="btn btn-green btn-block" id="requestWeeklySettlement" ${pending?'disabled':''}>${pending?'Solicitud pendiente':'Solicitar cierre'}</button>${pending?'<small class="muted">Ya existe una solicitud pendiente de revisión.</small>':''}</div><div><h2>Mis solicitudes</h2>${requests||'<div class="card empty">No has solicitado cierres.</div>'}</div><div><h2>Liquidaciones procesadas</h2>${settlements||'<div class="card empty">Todavía no hay liquidaciones procesadas.</div>'}</div></div>`
  }
  function renderPerfil(){
    const value=v=>esc(v||'—');
    const infoItem=(icon,label,val,wide=false)=>`<div class="profile-info-item ${wide?'wide':''}"><span class="profile-info-icon">${icon}</span><div><small>${label}</small><strong>${value(val)}</strong></div></div>`;
    const editField=(label,id,val,wide=false)=>`<label class="field ${wide?'wide':''}"><span>${label}</span><input id="${id}" value="${esc(val||'')}"></label>`;

    if(!profileEditing){
      q('#perfilView').innerHTML=`<div class="profile-shell"><div class="profile-top"><div><span class="section-kicker">PERFIL DEL REPARTIDOR</span><h2>Mi información</h2><p>Consulta tus datos personales y la información de tu vehículo.</p></div><button class="btn btn-green profile-edit-btn" id="editProfile" type="button">✎ Editar datos</button></div><section class="profile-section-card"><div class="profile-section-title"><span>○</span><div><strong>Información personal</strong><small>Datos principales de tu cuenta</small></div></div><div class="profile-info-grid">${infoItem('♙','Nombre completo',session.fullName,true)}${infoItem('☎','Teléfono',session.phone)}${infoItem('⌂','Ciudad',session.city)}${infoItem('⌖','Dirección',session.address,true)}${infoItem('◎','Zona',session.zone,true)}</div></section><section class="profile-section-card"><div class="profile-section-title"><span>◈</span><div><strong>Datos del vehículo</strong><small>Información para tus entregas</small></div></div><div class="profile-info-grid">${infoItem('◉','Tipo de vehículo',session.vehicleType)}${infoItem('◇','Marca',session.vehicleBrand)}${infoItem('▤','Modelo',session.vehicleModel)}${infoItem('▣','Placa',session.vehiclePlate)}${infoItem('●','Color',session.vehicleColor,true)}</div></section><div class="profile-security-note"><span>✓</span><div><strong>Tu información está protegida</strong><small>Estos datos se utilizan para administrar tu perfil dentro de BHUZ.</small></div></div></div>`;
      return;
    }

    q('#perfilView').innerHTML=`<div class="profile-shell editing"><div class="profile-top"><div><span class="section-kicker">EDITAR PERFIL</span><h2>Actualizar mis datos</h2><p>Modifica únicamente la información que necesites.</p></div></div><section class="profile-section-card"><div class="profile-section-title"><span>○</span><div><strong>Información personal</strong><small>Datos de contacto y ubicación</small></div></div><div class="profile-edit-grid">${editField('Nombre completo','pName',session.fullName,true)}${editField('Teléfono','pPhone',session.phone)}${editField('Ciudad','pCity',session.city)}${editField('Dirección','pAddress',session.address,true)}${editField('Zona','pZone',session.zone,true)}</div></section><section class="profile-section-card"><div class="profile-section-title"><span>◈</span><div><strong>Datos del vehículo</strong><small>Información del vehículo registrado</small></div></div><div class="profile-edit-grid">${editField('Tipo de vehículo','pVehicle',session.vehicleType)}${editField('Marca','pBrand',session.vehicleBrand)}${editField('Modelo','pModel',session.vehicleModel)}${editField('Placa','pPlate',session.vehiclePlate)}${editField('Color','pColor',session.vehicleColor,true)}</div></section><div class="profile-actions sticky"><button class="btn btn-dark" id="cancelProfileEdit" type="button">Cancelar</button><button class="btn btn-green" id="saveProfile" type="button">Guardar cambios</button></div></div>`;
  }
  qa('.side-link').forEach(b=>b.onclick=()=>{current=b.dataset.view;qa('.side-link').forEach(x=>x.classList.toggle('active',x===b));qa('.driver-view').forEach(v=>v.classList.toggle('active',v.id===current+'View'));q('#viewTitle').textContent={inicio:'Mi jornada',entregas:'Historial',finanzas:'Cuenta corriente',cierres:'Liquidaciones',perfil:'Mi perfil'}[current];scrollTo({top:0,behavior:'smooth'})});
  document.addEventListener('input',e=>{
    if(e.target.closest('#perfilView'))draftState.perfil=true;
    if(e.target.closest('#cierresView'))draftState.cierres=true;
  });
  document.addEventListener('change',e=>{
    if(e.target.closest('#perfilView'))draftState.perfil=true;
    if(e.target.closest('#cierresView'))draftState.cierres=true;
  });
  document.addEventListener('click',async e=>{try{if(e.target.id==='retryDashboard'){return load()} const ov=e.target.closest('[data-open-view]');if(ov){const target=ov.dataset.openView;const btn=q(`.side-link[data-view="${target}"]`);btn?.click();return} const a=e.target.closest('[data-accept-job]');if(a){closeJobRequestModal();await api(`/api/drivers/${session.id}/jobs/${a.dataset.acceptJob}/accept`,{method:'POST'});toast('Servicio aceptado');return load()}const rj=e.target.closest('[data-reject-job]');if(rj){closeJobRequestModal();const confirmed=window.confirm('¿Deseas rechazar este servicio y continuar disponible para otras solicitudes?');if(!confirmed)return;await api(`/api/drivers/${session.id}/jobs/${rj.dataset.rejectJob}/reject`,{method:'POST',body:{reason:'Rechazado por el repartidor'}});toast('Servicio rechazado. Buscando otra solicitud…');return load()}const st=e.target.closest('[data-job-status]');if(st&&!st.disabled){const job=(data?.activeJob&&String(data.activeJob.id)===String(st.dataset.jobId))?data.activeJob:null;if(st.dataset.jobStatus==='DELIVERED'&&['PACKAGE','FOOD_ORDER'].includes(job?.source_type)){const deliveryCode=await requestDeliveryCode();if(!deliveryCode)return;st.disabled=true;try{await api(`/api/drivers/${session.id}/jobs/${st.dataset.jobId}/confirm-delivery`,{method:'POST',body:{deliveryCode}});toast('Entrega confirmada con código');return load()}finally{st.disabled=false}}await api(`/api/drivers/${session.id}/jobs/${st.dataset.jobId}/status`,{method:'PATCH',body:{status:st.dataset.jobStatus}});toast('Estado actualizado');return load()}const mp=e.target.closest('[data-map]');if(mp)return window.open('https://www.google.com/maps/search/?api=1&query='+mp.dataset.map,'_blank');const inc=e.target.closest('[data-incident]');if(inc){const description=prompt('Describe la incidencia:');if(description){await api(`/api/drivers/${session.id}/incidents`,{method:'POST',body:{jobId:inc.dataset.incident,incidentType:'OTHER',description}});toast('Incidencia registrada')}}if(e.target.id==='requestWeeklySettlement'){const note=q('#settlementRequestNote')?.value||'';await api(`/api/drivers/${session.id}/settlement-requests`,{method:'POST',body:{note}});draftState.cierres=false;toast('Solicitud enviada');return load()}if(e.target.id==='editProfile'){profileEditing=true;draftState.perfil=true;renderPerfil();q('#pName')?.focus();return}if(e.target.id==='cancelProfileEdit'){profileEditing=false;draftState.perfil=false;renderPerfil();toast('Edición cancelada');return}if(e.target.id==='saveProfile'){const confirmed=await confirmProfileUpdate();if(!confirmed)return;const payload={fullName:q('#pName').value.trim(),phone:q('#pPhone').value.trim(),address:q('#pAddress').value.trim(),city:q('#pCity').value.trim(),zone:q('#pZone').value.trim(),vehicleType:q('#pVehicle').value.trim(),vehicleBrand:q('#pBrand').value.trim(),vehicleModel:q('#pModel').value.trim(),vehiclePlate:q('#pPlate').value.trim(),vehicleColor:q('#pColor').value.trim()};const d=await api(`/api/drivers/${session.id}/profile`,{method:'PATCH',body:payload});session=d.driver||{...session,...payload};localStorage.setItem('bhuz_driver_session',JSON.stringify(session));profileEditing=false;draftState.perfil=false;renderPerfil();toast('Datos actualizados correctamente');await load()}}catch(x){toast(x.message)}});
  q('#availabilityToggle').onclick=async()=>{try{const d=await api(`/api/drivers/${session.id}/availability`,{method:'PATCH',body:{available:!session.isAvailable}});session=d.driver;localStorage.setItem('bhuz_driver_session',JSON.stringify(session));render();if(session.isAvailable){startGps();window.BHUZ_PWA?.subscribe?.({userEmail:session.email}).catch(()=>{})}}catch(e){toast(e.message)}};
  q('#logoutDriver').onclick=async()=>{try{await api(`/api/drivers/${session.id}/logout`,{method:'POST'})}catch{}localStorage.removeItem('bhuz_driver_session');location.href='acceso-repartidor.html'};
  await load();heartbeat();setInterval(heartbeat,120000);setInterval(load,8000);
});





