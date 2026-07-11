document.addEventListener('DOMContentLoaded',()=>{
 const api=String(window.BHUZ_API_URL||window.API_BASE_URL||'https://deligo-backend-i554.onrender.com').replace(/\/+$/,'');
 const msg=document.getElementById('accessMessage');
 document.querySelectorAll('[data-access-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-access-tab]').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.access-form').forEach(f=>f.classList.toggle('active',f.id.toLowerCase().includes(b.dataset.accessTab)));});
 async function post(path,body){const r=await fetch(api+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok||d.ok===false)throw Error(d.message||'No se pudo completar.');return d;}
 document.getElementById('driverLoginForm').onsubmit=async e=>{e.preventDefault();try{const d=await post('/api/drivers/login',Object.fromEntries(new FormData(e.target)));localStorage.setItem('bhuz_driver_session',JSON.stringify(d.driver));location.href='panel-repartidor.html';}catch(x){msg.textContent=x.message;}};
 document.getElementById('driverRegisterForm').onsubmit=async e=>{e.preventDefault();try{const d=await post('/api/drivers/register',Object.fromEntries(new FormData(e.target)));msg.textContent=d.message+' El administrador deberá aprobar tu cuenta.';e.target.reset();}catch(x){msg.textContent=x.message;}};
});
