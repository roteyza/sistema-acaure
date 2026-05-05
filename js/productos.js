// PRODUCTOS
const FASE_LABELS = {
  f1:'F1 — Canal', f2:'F2 — Cortes', f3:'F3 — Casita1', f4:'F4 — Galpon1',
  c1:'C1 — Consumibles', c2:'C2 — Condimentos', c3:'C3 — Oficina'
};
const FASE_CANALES = {
  f1: 'Solo compras',
  f2: 'Compras · Detal Aca · Mayor Aca · Mayor CCS',
  f3: 'Detal Aca · Detal CCS',
  f4: 'Detal Aca · Mayor Aca · Detal CCS · Mayor CCS',
  c1: 'Uso interno',
  c2: 'Uso interno',
  c3: 'Uso interno'
};

async function loadProductos() {
  // Mostrar botón nuevo solo a admin/operaciones
  const btnNuevo = document.getElementById('btn-nuevo-producto');
  if(btnNuevo) {
    const rol = currentUser?.rol;
    btnNuevo.style.display = (rol === 'admin' || rol === 'operaciones') ? 'inline-block' : 'none';
  }

  const catFiltro = document.getElementById('prod-filtro-cat')?.value || '';
  let query = sb.from('productos').select('*').order('categoria').order('tipo').order('nombre');
  if(catFiltro) query = query.eq('categoria', catFiltro);
  const { data, error } = await query;

  const tb = document.getElementById('prod-table');
  if(error || !data || !data.length) {
    tb.innerHTML = '<div class="empty"><div class="empty-icon">📦</div><p>Sin productos registrados.</p></div>';
    return;
  }

  const rol = currentUser?.rol;
  const puedeEditar = rol === 'admin' || rol === 'operaciones';

  tb.innerHTML = `<table>
    <tr>
      <th>Nombre</th>
      <th>Fase</th>
      <th>Tipo</th>
      <th>Unidad</th>
      <th>Precio base</th>
      <th>Canales de venta</th>
      ${puedeEditar ? '<th></th>' : ''}
    </tr>
    ${data.map(p => `<tr id="prod-row-${p.id}">
      <td style="color:var(--text);font-weight:500">${p.nombre}</td>
      <td><span class="badge badge-${p.categoria}" style="font-size:11px">${FASE_LABELS[p.categoria]||p.categoria}</span></td>
      <td style="color:var(--text3);font-size:12px">${p.tipo||'—'}</td>
      <td style="color:var(--text3)">${p.unidad||'kg'}</td>
      <td style="font-family:'Syne',sans-serif;font-weight:600;color:var(--azul)">${p.precio_base ? '$'+Number(p.precio_base).toFixed(2) : '—'}</td>
      <td style="color:var(--text3);font-size:11px">${FASE_CANALES[p.categoria]||'—'}</td>
      ${puedeEditar ? `<td><button onclick="editarProducto('${p.id}')" style="background:none;border:1px solid var(--border);border-radius:6px;padding:4px 10px;font-size:11px;color:var(--text2);cursor:pointer;font-family:'Sora',sans-serif">Editar</button></td>` : ''}
    </tr>`).join('')}
  </table>`;
  makeSortable(document.getElementById('prod-table')?.querySelector('table'));
}

async function guardarNuevoProducto() {
  const nombre    = document.getElementById('np-nombre')?.value?.trim();
  const categoria = document.getElementById('np-categoria')?.value;
  const tipo      = document.getElementById('np-tipo')?.value;
  const unidad    = document.getElementById('np-unidad')?.value || 'kg';
  const precio    = parseFloat(document.getElementById('np-precio')?.value) || null;

  if(!nombre || !categoria) { alert('Nombre y fase son obligatorios.'); return; }

  const { error } = await sb.from('productos').insert([{
    nombre, categoria, tipo: tipo||null, unidad, precio_base: precio, activo: true
  }]);

  if(error) { alert('Error al guardar: ' + error.message); return; }

  // Limpiar form
  ['np-nombre','np-precio'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  ['np-categoria','np-tipo'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('form-nuevo-producto').style.display = 'none';
  await registrarAuditoria('producto_creado', 'productos', null, `Nuevo: ${nombre} (${categoria})`);
  loadProductos();
}

async function editarProducto(id) {
  const row = document.getElementById(`prod-row-${id}`);
  if(!row) return;

  // Obtener datos actuales del producto
  const { data: p } = await sb.from('productos').select('*').eq('id', id).single();
  if(!p) return;

  row.innerHTML = `
    <td><input type="text" id="ep-nombre-${id}" value="${p.nombre}" style="width:100%;padding:6px 8px;border:1.5px solid var(--azul);border-radius:6px;font-family:'Sora',sans-serif;font-size:13px"></td>
    <td>
      <select id="ep-cat-${id}" style="padding:6px 8px;border:1.5px solid var(--border);border-radius:6px;font-family:'Sora',sans-serif;font-size:12px">
        <option value="f1" ${p.categoria==='f1'?'selected':''}>F1 — Canal</option>
        <option value="f2" ${p.categoria==='f2'?'selected':''}>F2 — Cortes</option>
        <option value="f3" ${p.categoria==='f3'?'selected':''}>F3 — Casita1</option>
        <option value="f4" ${p.categoria==='f4'?'selected':''}>F4 — Galpon1</option>
        <option value="c1" ${p.categoria==='c1'?'selected':''}>C1 — Consumibles</option>
        <option value="c2" ${p.categoria==='c2'?'selected':''}>C2 — Condimentos</option>
        <option value="c3" ${p.categoria==='c3'?'selected':''}>C3 — Oficina</option>
      </select>
    </td>
    <td>
      <select id="ep-tipo-${id}" style="padding:6px 8px;border:1.5px solid var(--border);border-radius:6px;font-family:'Sora',sans-serif;font-size:12px">
        <option value="">—</option>
        <option value="canal" ${p.tipo==='canal'?'selected':''}>Canal</option>
        <option value="premium" ${p.tipo==='premium'?'selected':''}>Premium</option>
        <option value="primera" ${p.tipo==='primera'?'selected':''}>Primera</option>
        <option value="segunda" ${p.tipo==='segunda'?'selected':''}>Segunda</option>
        <option value="tercera" ${p.tipo==='tercera'?'selected':''}>Tercera</option>
        <option value="descarte" ${p.tipo==='descarte'?'selected':''}>Descarte</option>
        <option value="res" ${p.tipo==='res'?'selected':''}>Res</option>
        <option value="pollo" ${p.tipo==='pollo'?'selected':''}>Pollo</option>
        <option value="cerdo" ${p.tipo==='cerdo'?'selected':''}>Cerdo</option>
        <option value="otros" ${p.tipo==='otros'?'selected':''}>Otros</option>
      </select>
    </td>
    <td>
      <select id="ep-unidad-${id}" style="padding:6px 8px;border:1.5px solid var(--border);border-radius:6px;font-family:'Sora',sans-serif;font-size:12px">
        <option value="kg" ${p.unidad==='kg'?'selected':''}>kg</option>
        <option value="ud" ${p.unidad==='ud'?'selected':''}>ud</option>
      </select>
    </td>
    <td><input type="number" id="ep-precio-${id}" value="${p.precio_base||''}" step="0.01" min="0" style="width:90px;padding:6px 8px;border:1.5px solid var(--border);border-radius:6px;font-family:'Sora',sans-serif;font-size:13px"></td>
    <td style="color:var(--text3);font-size:11px">${FASE_CANALES[p.categoria]||'—'}</td>
    <td style="display:flex;gap:6px">
      <button onclick="confirmarEditarProducto('${id}')" style="background:var(--azul);color:white;border:none;border-radius:6px;padding:5px 12px;font-size:11px;cursor:pointer;font-family:'Sora',sans-serif;font-weight:600">✓</button>
      <button onclick="loadProductos()" style="background:none;border:1px solid var(--border);border-radius:6px;padding:5px 10px;font-size:11px;color:var(--text3);cursor:pointer;font-family:'Sora',sans-serif">✕</button>
    </td>
  `;
}

async function confirmarEditarProducto(id) {
  const nombre    = document.getElementById(`ep-nombre-${id}`)?.value?.trim();
  const categoria = document.getElementById(`ep-cat-${id}`)?.value;
  const tipo      = document.getElementById(`ep-tipo-${id}`)?.value;
  const unidad    = document.getElementById(`ep-unidad-${id}`)?.value;
  const precio    = parseFloat(document.getElementById(`ep-precio-${id}`)?.value) || null;

  if(!nombre || !categoria) { alert('Nombre y fase son obligatorios.'); return; }

  const { error } = await sb.from('productos').update({
    nombre, categoria, tipo: tipo||null, unidad, precio_base: precio
  }).eq('id', id);

  if(error) { alert('Error al actualizar: ' + error.message); return; }
  await registrarAuditoria('producto_editado', 'productos', id, `Editado: ${nombre}`);
  loadProductos();
}
