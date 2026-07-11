document.addEventListener('DOMContentLoaded',()=>{
  const API=String(window.BHUZ_API_URL||window.API_BASE_URL||'https://deligo-backend-i554.onrender.com').replace(/\/+$/,'');
  const $=s=>document.querySelector(s);
  const themeKey='bhuz_driver_theme';
  const applyTheme=t=>{document.documentElement.dataset.theme=t;localStorage.setItem(themeKey,t);$('#themeToggle').textContent=t==='dark'?'☀':'☾';};
  applyTheme(localStorage.getItem(themeKey)||'dark');
  $('#themeToggle').onclick=()=>applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');

  document.querySelectorAll('[data-access-tab]').forEach(btn=>btn.addEventListener('click',()=>{
    document.querySelectorAll('[data-access-tab]').forEach(x=>x.classList.toggle('active',x===btn));
    document.querySelectorAll('.access-form').forEach(x=>x.classList.toggle('active',x.id===(btn.dataset.accessTab==='login'?'driverLoginForm':'driverRegisterForm')));
    $('#accessMessage').textContent='';
  }));

  async function request(path,options={}){
    const r=await fetch(API+path,{method:options.method||'GET',headers:{'Content-Type':'application/json'},body:options.body?JSON.stringify(options.body):undefined});
    const d=await r.json().catch(()=>({})); if(!r.ok)throw new Error(d.message||'No se pudo completar la solicitud.'); return d;
  }
  const values=form=>Object.fromEntries(new FormData(form).entries());
  $('#driverLoginForm').addEventListener('submit',async e=>{e.preventDefault();const btn=e.submitter;btn.disabled=true;$('#accessMessage').textContent='Ingresando…';try{const d=await request('/api/drivers/login',{method:'POST',body:values(e.currentTarget)});localStorage.setItem('bhuz_driver_session',JSON.stringify(d.driver));location.href='panel-repartidor.html'}catch(err){$('#accessMessage').textContent=err.message}finally{btn.disabled=false}});
  $('#driverRegisterForm').addEventListener('submit',async e=>{e.preventDefault();const btn=e.submitter;btn.disabled=true;$('#accessMessage').textContent='Creando cuenta…';try{const d=await request('/api/drivers/register',{method:'POST',body:values(e.currentTarget)});$('#accessMessage').textContent=d.message||'Registro creado correctamente.';e.currentTarget.reset()}catch(err){$('#accessMessage').textContent=err.message}finally{btn.disabled=false}});
});
