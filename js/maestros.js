// MAESTROS
async function loadMaestros() {
  const [sedes, provs, clientes] = await Promise.all([
    sb.from('sedes').select('*'),
    sb.from('proveedores').select('*').order('nombre'),
    sb.from('clientes').select('*').order('nombre')
  ]);

  document.getElementById('sedes-table').innerHTML = `<table>
    <tr><th>Nombre</th><th>Código</th></tr>
    ${(sedes.data||[]).map(s=>`<tr><td style="color:var(--text)">${s.nombre}</td><td style="color:var(--text3)">${s.codigo}</td></tr>`).join('')}
  </table>`;

  const btnEditar = 'background:none;border:1px solid var(--border);color:var(--text2);border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer';

  document.getElementById('prov-table').innerHTML = `<table>
    <tr><th>Nombre</th><th>Tipo</th><th></th></tr>
    ${(provs.data||[]).map(p=>`<tr>
      <td style="color:var(--text)">${p.nombre}</td>
      <td><span class="badge badge-${p.tipo||'canal'}">${p.tipo||'—'}</span></td>
      <td><button style="${btnEditar}" onclick="abrirEditarProveedor('${p.id}','${(p.nombre||'').replace(/'/g,"\'")}','${p.tipo||''}')">✏ Editar</button></td>
    </tr>`).join('')}
  </table>`;

  document.getElementById('clientes-table').innerHTML = `<table>
    <tr><th>Nombre</th><th>Tipo</th><th>Canal</th><th>Teléfono</th><th></th></tr>
    ${(clientes.data||[]).map(c=>`<tr>
      <td style="color:var(--text)">${c.nombre}</td>
      <td>${c.tipo||'—'}</td>
      <td>${c.canal||'—'}</td>
      <td style="color:var(--text3)">${c.telefono||'—'}</td>
      <td><button style="${btnEditar}" onclick="abrirEditarCliente('${c.id}','${(c.nombre||'').replace(/'/g,"\'")}','${c.tipo||''}','${c.canal||''}','${c.telefono||''}','${(c.direccion||'').replace(/'/g,"\'")}')">✏ Editar</button></td>
    </tr>`).join('')}
  </table>`;
}

// EDITAR PROVEEDOR
function abrirEditarProveedor(id, nombre, tipo) {
  document.getElementById('ep-id').value = id;
  document.getElementById('ep-nombre').value = nombre;
  document.getElementById('ep-tipo').value = tipo;
  document.getElementById('modal-editar-prov').style.display = 'flex';
}

function cerrarEditarProveedor() {
  document.getElementById('modal-editar-prov').style.display = 'none';
}

async function guardarEditarProveedor() {
  const id     = document.getElementById('ep-id').value;
  const nombre = document.getElementById('ep-nombre').value.trim();
  const tipo   = document.getElementById('ep-tipo').value;
  if(!nombre) { alert('El nombre no puede estar vacío.'); return; }
  const { error } = await sb.from('proveedores').update({ nombre, tipo }).eq('id', id);
  if(error) { alert('Error: ' + error.message); return; }
  showToast('Proveedor actualizado ✓');
  cerrarEditarProveedor();
  loadMaestros();
}

// EDITAR CLIENTE
function abrirEditarCliente(id, nombre, tipo, canal, telefono, direccion) {
  document.getElementById('ec-id').value = id;
  document.getElementById('ec-nombre').value = nombre;
  document.getElementById('ec-tipo').value = tipo;
  document.getElementById('ec-canal').value = canal;
  document.getElementById('ec-telefono').value = telefono;
  document.getElementById('ec-direccion').value = direccion;
  document.getElementById('modal-editar-cli').style.display = 'flex';
}

function cerrarEditarCliente() {
  document.getElementById('modal-editar-cli').style.display = 'none';
}

async function guardarEditarCliente() {
  const id        = document.getElementById('ec-id').value;
  const nombre    = document.getElementById('ec-nombre').value.trim();
  const tipo      = document.getElementById('ec-tipo').value;
  const canal     = document.getElementById('ec-canal').value;
  const telefono  = document.getElementById('ec-telefono').value.trim();
  const direccion = document.getElementById('ec-direccion').value.trim();
  if(!nombre) { alert('El nombre no puede estar vacío.'); return; }
  const { error } = await sb.from('clientes').update({ nombre, tipo, canal, telefono, direccion }).eq('id', id);
  if(error) { alert('Error: ' + error.message); return; }
  showToast('Cliente actualizado ✓');
  cerrarEditarCliente();
  loadMaestros();
}

// PROVEEDOR SEARCH
let proveedoresCache = [];

function filtrarProveedores() {
  const q = document.getElementById('c-proveedor-search')?.value.toLowerCase() || '';
  const filtered = proveedoresCache.filter(p => p.nombre.toLowerCase().includes(q));
  renderProvDropdown(filtered);
}

function mostrarProveedores() {
  renderProvDropdown(proveedoresCache);
}

function ocultarProveedores() {
  const dd = document.getElementById('c-prov-dropdown');
  if(dd) dd.style.display = 'none';
}

function renderProvDropdown(lista) {
  const dd = document.getElementById('c-prov-dropdown');
  if(!dd) return;
  if(!lista.length) {
    dd.innerHTML = '<div style="padding:10px 14px;font-size:13px;color:var(--text3)">Sin resultados — usá "+ Nuevo"</div>';
  } else {
    dd.innerHTML = lista.map(p => `
      <div onclick="seleccionarProveedor('${p.id}','${p.nombre}')"
        style="padding:10px 14px;font-size:13px;cursor:pointer;border-bottom:1px solid var(--border);color:var(--text)"
        onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='white'">
        ${p.nombre} <span style="font-size:11px;color:var(--text3);margin-left:6px">${p.tipo||''}</span>
      </div>`).join('');
  }
  dd.style.display = 'block';
}

function seleccionarProveedor(id, nombre) {
  document.getElementById('c-proveedor').value = id;
  document.getElementById('c-proveedor-search').value = nombre;
  document.getElementById('c-proveedor-search').style.borderColor = 'var(--azul)';
  ocultarProveedores();
}

function abrirNuevoProveedor() {
  document.getElementById('npr-nombre').value = '';
  document.getElementById('modal-nuevo-prov').style.display = 'flex';
  setTimeout(() => document.getElementById('npr-nombre').focus(), 100);
}

function cerrarNuevoProveedor() {
  document.getElementById('modal-nuevo-prov').style.display = 'none';
}

async function guardarNuevoProveedor() {
  const nombre = document.getElementById('npr-nombre').value.trim();
  const tipo   = document.getElementById('npr-tipo').value;
  if(!nombre) { alert('Ingresá el nombre del proveedor.'); return; }

  const { data, error } = await sb.from('proveedores').insert({ nombre, tipo, activo: true }).select().single();
  if(error) { alert('Error: ' + error.message); return; }

  proveedoresCache.push(data);
  proveedoresCache.sort((a,b) => a.nombre.localeCompare(b.nombre));
  seleccionarProveedor(data.id, data.nombre);
  cerrarNuevoProveedor();
  showToast(`Proveedor "${nombre}" agregado ✓`);
}

// CLIENTE SEARCH
let clientesCache = [];

function filtrarClientes() {
  const q = document.getElementById('v-cliente-search')?.value.toLowerCase() || '';
  const filtered = clientesCache.filter(c => c.nombre.toLowerCase().includes(q));
  renderCliDropdown(filtered);
}

function mostrarClientes() {
  renderCliDropdown(clientesCache);
}

function ocultarClientes() {
  const dd = document.getElementById('v-cli-dropdown');
  if(dd) dd.style.display = 'none';
}

function renderCliDropdown(lista) {
  const dd = document.getElementById('v-cli-dropdown');
  if(!dd) return;
  if(!lista.length) {
    dd.innerHTML = '<div style="padding:10px 14px;font-size:13px;color:var(--text3)">Sin resultados — usá "+ Nuevo"</div>';
  } else {
    dd.innerHTML = lista.map(c => `
      <div onclick="seleccionarCliente('${c.id}','${c.nombre}')"
        style="padding:10px 14px;font-size:13px;cursor:pointer;border-bottom:1px solid var(--border);color:var(--text)"
        onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='white'">
        ${c.nombre} <span style="font-size:11px;color:var(--text3);margin-left:6px">${c.canal||''}</span>
      </div>`).join('');
  }
  dd.style.display = 'block';
}

function seleccionarCliente(id, nombre) {
  document.getElementById('v-cliente').value = id;
  document.getElementById('v-cliente-search').value = nombre;
  document.getElementById('v-cliente-search').style.borderColor = 'var(--azul)';
  ocultarClientes();
}

function abrirNuevoCliente() {
  document.getElementById('nc-nombre').value = '';
  document.getElementById('nc-telefono').value = '';
  document.getElementById('nc-direccion').value = '';
  // Pre-seleccionar tipo y canal según el canal activo
  const canal = document.getElementById('v-canal')?.value || '';
  const esDetal = canal === 'detal_ccs' || canal === 'detal_acarigua';
  if(document.getElementById('nc-tipo'))  document.getElementById('nc-tipo').value  = esDetal ? 'b2c' : 'b2b';
  if(document.getElementById('nc-canal')) document.getElementById('nc-canal').value = esDetal ? 'detal' : 'mayor';
  document.getElementById('modal-nuevo-cli').style.display = 'flex';
  setTimeout(() => document.getElementById('nc-nombre').focus(), 100);
}

function cerrarNuevoCliente() {
  document.getElementById('modal-nuevo-cli').style.display = 'none';
}

async function guardarNuevoCliente() {
  const nombre = document.getElementById('nc-nombre').value.trim();
  const tipo   = document.getElementById('nc-tipo').value;
  const canal  = document.getElementById('nc-canal').value;
  if(!nombre) { alert('Ingresá el nombre del cliente.'); return; }

  const telefono = document.getElementById('nc-telefono')?.value.trim() || null;
  const direccion = document.getElementById('nc-direccion')?.value.trim() || null;
  const { data, error } = await sb.from('clientes').insert({ nombre, tipo, canal, activo: true }).select().single();
  if(error) { alert('Error: ' + error.message); return; }

  clientesData.push(data);
  // Refrescar cache según canal activo
  const canalActivo = document.getElementById('v-canal')?.value || '';
  const esDetalActivo = canalActivo === 'detal_ccs' || canalActivo === 'detal_acarigua';
  clientesCache = esDetalActivo
    ? clientesData.filter(c => c.tipo === 'b2c' || c.canal === 'detal')
    : clientesData.filter(c => c.tipo === 'b2b');
  clientesCache.sort((a,b) => a.nombre.localeCompare(b.nombre));
  seleccionarCliente(data.id, data.nombre);
  cerrarNuevoCliente();
  showToast('Cliente "' + nombre + '" agregado ✓');
}
