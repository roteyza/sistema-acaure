// LOGIN
async function doLogin() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const btn = document.getElementById('btn-login');
  const err = document.getElementById('error-msg');

  err.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Entrando...';

  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  if (error) {
    err.textContent = 'Correo o contraseña incorrectos.';
    err.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Entrar al sistema';
    return;
  }

  await loadApp(data.user);
}

async function loadApp(user) {
  const { data: userData } = await sb
    .from('usuarios')
    .select('*')
    .eq('email', user.email)
    .single();

  currentUser = userData || { nombre: user.email, rol: 'admin', email: user.email };
  currentRole = currentUser.rol || 'admin';

  document.getElementById('user-name').textContent = currentUser.nombre;
  document.getElementById('user-role').textContent = currentRole;

  buildNav();

  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'block';

  // set today on date fields
  const today = new Date().toISOString().split('T')[0];
  ['mf-fecha','t-fecha'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.value = today;
  });

  // Verificar tasas del día (modal bloqueante si no existen)
  await checkTasaDiaria();

  // Spread preview en modal de tasas
  ['td-bcv','td-paralelo'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('input', () => {
      const b = parseFloat(document.getElementById('td-bcv').value) || 0;
      const p = parseFloat(document.getElementById('td-paralelo').value) || 0;
      const prev = document.getElementById('td-spread-preview');
      if(prev && b > 0 && p > 0) {
        const spread = ((p/b - 1)*100).toFixed(1);
        prev.textContent = `Spread: ${spread}% · $1 BCV = $${(b/p).toFixed(3)} real`;
      }
    });
  });

  loadDashboard();
  loadCuentasSelect();
  loadMovimientosSelects();
  loadComprasSelects();
  loadVentasSelects();
}

function buildNav() {
  const items = NAV[currentRole] || NAV.admin;
  const sidebar = document.getElementById('sidebar');
  sidebar.innerHTML = `
    <div class="sidebar-logo">
      <div class="sidebar-logo-dot"></div>
      RASTRO
    </div>
    <div class="sidebar-divider"></div>
    <div class="nav-label" style="padding:0 22px">Módulos</div>
  `;
  const sec = document.createElement('div');
  sec.className = 'nav-section';
  items.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'nav-item' + (item.id === 'dashboard' ? ' active' : '');
    btn.dataset.page = item.id;
    btn.innerHTML = `<span class="nav-icon">${item.icon}</span>${item.label}`;
    btn.onclick = () => navigate(item.id);
    sec.appendChild(btn);
  });
  sidebar.appendChild(sec);
}

function navigate(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + pageId).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => {
    if(n.dataset.page === pageId) n.classList.add('active');
  });

  if(pageId === 'movimientos') loadMovimientos();
  if(pageId === 'compras') loadCompras();
  if(pageId === 'ventas') { loadVentasSelects(); loadVentas(); }
  if(pageId === 'dashboard') loadDashboard();
  if(pageId === 'inventario') loadInventario();
  if(pageId === 'productos') loadProductos();
  if(pageId === 'finanzas') { initFinanzasFiltros(); loadFinanzas(); }
  if(pageId === 'tasas') { loadTasas(); initTasasForm(); }
  if(pageId === 'maestros') loadMaestros();
  if(pageId === 'precios') loadListaPrecios();
  if(pageId === 'lotes') loadLotes();
  if(pageId === 'auditoria') loadAuditoria();
  if(pageId === 'ciclo') loadCicloOperativo();
}

async function doLogout() {
  await sb.auth.signOut();
  document.getElementById('app-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('email').value = '';
  document.getElementById('password').value = '';
}