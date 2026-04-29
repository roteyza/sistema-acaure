// CUENTAS POR PAGAR (CxP)
// Modulo de obligaciones financieras: pasivo laboral, servicios,
// honorarios, impuestos, credito bancario, bonos, prestamo, otros.
// Distinto de Compras: no tiene items de inventario.

let cxpFiltroActual = 'pendientes';

const CXP_CATEGORIAS = [
  { value: 'pasivo_laboral',   label: 'Pasivo laboral' },
  { value: 'servicios',        label: 'Servicios' },
  { value: 'honorarios',       label: 'Honorarios' },
  { value: 'impuestos',        label: 'Impuestos' },
  { value: 'credito_bancario', label: 'Crédito bancario' },
  { value: 'bonos',            label: 'Bonos' },
  { value: 'prestamo',         label: 'Préstamo' },
  { value: 'otros',            label: 'Otros' }
];

function categoriaLabelCxP(value) {
  return (CXP_CATEGORIAS.find(c => c.value === value) || {}).label || value || '—';
}

async function loadCxPSelects() {
  // Cargar cache de proveedores si esta vacio
  if (typeof proveedoresCache === 'undefined' || !proveedoresCache.length) {
    const { data } = await sb.from('proveedores').select('*').order('nombre');
    proveedoresCache = (data || []).sort((a,b) => a.nombre.localeCompare(b.nombre));
  }

  // Llenar select de categoria si esta vacio
  const selCat = document.getElementById('cxp-categoria');
  if (selCat && !selCat.options.length) {
    selCat.innerHTML = CXP_CATEGORIAS.map(c => `<option value="${c.value}">${c.label}</option>`).join('');
  }

  // Fecha de hoy por defecto
  const today = new Date().toISOString().split('T')[0];
  const fechaEl = document.getElementById('cxp-fecha');
  if (fechaEl && !fechaEl.value) fechaEl.value = today;
}

// PROVEEDOR SEARCH (parallel a compras, target ids cxp-*)
function filtrarProveedoresCxP() {
  const q = document.getElementById('cxp-proveedor-search')?.value.toLowerCase() || '';
  const filtered = (proveedoresCache || []).filter(p => p.nombre.toLowerCase().includes(q));
  renderProvDropdownCxP(filtered);
}

function mostrarProveedoresCxP() {
  renderProvDropdownCxP(proveedoresCache || []);
}

function ocultarProveedoresCxP() {
  const dd = document.getElementById('cxp-prov-dropdown');
  if (dd) dd.style.display = 'none';
}

function renderProvDropdownCxP(lista) {
  const dd = document.getElementById('cxp-prov-dropdown');
  if (!dd) return;
  if (!lista.length) {
    dd.innerHTML = '<div style="padding:10px 14px;font-size:13px;color:var(--text3)">Sin resultados — usá "+ Nuevo"</div>';
  } else {
    dd.innerHTML = lista.map(p => `
      <div onclick="seleccionarProveedor('${p.id}','${(p.nombre||'').replace(/'/g,"\\'")}')"
        style="padding:10px 14px;font-size:13px;cursor:pointer;border-bottom:1px solid var(--border);color:var(--text)"
        onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='white'">
        ${p.nombre} <span style="font-size:11px;color:var(--text3);margin-left:6px">${p.tipo||''}</span>
      </div>`).join('');
  }
  dd.style.display = 'block';
}

async function guardarCxP() {
  const proveedor_id      = document.getElementById('cxp-proveedor').value;
  const categoria         = document.getElementById('cxp-categoria').value;
  const concepto          = document.getElementById('cxp-concepto').value.trim();
  const monto_usd         = parseFloat(document.getElementById('cxp-monto').value);
  const fecha_creacion    = document.getElementById('cxp-fecha').value;
  const fecha_venc_raw    = document.getElementById('cxp-vencimiento').value;
  const fecha_vencimiento = fecha_venc_raw || null;
  const notas             = document.getElementById('cxp-notas').value.trim() || null;

  if (!proveedor_id)          { alert('Seleccioná un acreedor.'); return; }
  if (!concepto)              { alert('Ingresá un concepto.'); return; }
  if (!monto_usd || monto_usd <= 0) { alert('Ingresá un monto válido.'); return; }
  if (!fecha_creacion)        { alert('Seleccioná una fecha de creación.'); return; }

  const { data, error } = await sb.from('cxp').insert({
    proveedor_id,
    categoria,
    concepto,
    monto_usd,
    saldo_pendiente: monto_usd,
    fecha_creacion,
    fecha_vencimiento,
    status: 'pendiente',
    tasa_bcv_dia: tasaHoy?.bcv || null,
    tasa_paralelo_dia: tasaHoy?.paralelo || null,
    notas,
    usuario_id: currentUser?.id || null
  }).select().single();

  if (error) { alert('Error: ' + error.message); return; }

  showToast('CxP registrada ✓');
  registrarAuditoria('cxp_creada', 'cxp', data.id,
    `${categoriaLabelCxP(categoria)} | $${monto_usd} | ${concepto}`);

  // Reset form (mantiene fecha en hoy)
  document.getElementById('cxp-proveedor').value = '';
  const searchEl = document.getElementById('cxp-proveedor-search');
  if (searchEl) { searchEl.value = ''; searchEl.style.borderColor = ''; }
  document.getElementById('cxp-concepto').value = '';
  document.getElementById('cxp-monto').value = '';
  document.getElementById('cxp-vencimiento').value = '';
  document.getElementById('cxp-notas').value = '';
  const fechaEl = document.getElementById('cxp-fecha');
  if (fechaEl) fechaEl.value = new Date().toISOString().split('T')[0];

  loadCxP(cxpFiltroActual);
}

function filtrarCxP(filtro) {
  loadCxP(filtro);
}

async function loadCxP(filtro) {
  if (filtro) cxpFiltroActual = filtro;

  // Tabs visuales
  ['pendientes','todas','pagadas','anuladas'].forEach(t => {
    const btn = document.getElementById('cxp-tab-' + t);
    if (!btn) return;
    if (t === cxpFiltroActual) {
      btn.style.background = 'var(--azul)';
      btn.style.color      = 'white';
      btn.style.borderColor= 'var(--azul)';
    } else {
      btn.style.background = 'none';
      btn.style.color      = 'var(--text3)';
      btn.style.borderColor= 'var(--border)';
    }
  });

  let query = sb.from('cxp')
    .select('*, proveedores(nombre)')
    .order('fecha_creacion', { ascending: false });

  if (cxpFiltroActual === 'pendientes') {
    query = query.in('status', ['pendiente','parcial']);
  } else if (cxpFiltroActual === 'pagadas') {
    query = query.eq('status', 'pagada');
  } else if (cxpFiltroActual === 'anuladas') {
    query = query.eq('status', 'anulada');
  }

  const { data, error } = await query;
  const tb = document.getElementById('cxp-table');
  if (!tb) return;
  if (error) {
    tb.innerHTML = `<div class="empty" style="color:var(--danger)">Error: ${error.message}</div>`;
    return;
  }
  if (!data || !data.length) {
    tb.innerHTML = '<div class="empty"><div class="empty-icon">⊟</div><p>Sin CxP en este filtro.</p></div>';
    return;
  }

  const today       = new Date().toISOString().split('T')[0];
  const statusColor = { pagada:'#27a66a', parcial:'#e8b84b', pendiente:'#e74c3c', anulada:'#888' };

  tb.innerHTML = `<table>
    <tr><th>Creación</th><th>Vencimiento</th><th>Acreedor</th><th>Categoría</th><th>Concepto</th><th>Monto</th><th>Saldo</th><th>Status</th><th></th></tr>
    ${data.map(c => {
      const vencido = c.fecha_vencimiento && c.fecha_vencimiento < today
        && (c.status === 'pendiente' || c.status === 'parcial');
      const vencColor  = vencido ? 'var(--danger)' : 'var(--text3)';
      const vencWeight = vencido ? '600' : '400';
      return `<tr>
        <td style="color:var(--text3)">${c.fecha_creacion}</td>
        <td style="color:${vencColor};font-weight:${vencWeight}">${c.fecha_vencimiento || '—'}</td>
        <td style="color:var(--text)">${c.proveedores?.nombre || '—'}</td>
        <td style="color:var(--text2);font-size:12px">${categoriaLabelCxP(c.categoria)}</td>
        <td style="color:var(--text2);font-size:12px">${(c.concepto||'').substring(0,50)}</td>
        <td style="font-weight:600;color:var(--azul);font-size:13px">$${Number(c.monto_usd).toFixed(2)}</td>
        <td style="font-weight:600;font-size:13px;color:${Number(c.saldo_pendiente)>0?'var(--danger)':'var(--success)'}">
          ${Number(c.saldo_pendiente)>0 ? '$'+Number(c.saldo_pendiente).toFixed(2) : '✓ 0'}
        </td>
        <td><span class="badge" style="background:${statusColor[c.status]||'#888'}22;color:${statusColor[c.status]||'#888'}">${c.status}</span></td>
        <td style="display:flex;gap:4px;align-items:center">
          <!-- Acciones (Ver / Pagar / Anular) se agregan en el commit 5.13.2 -->
        </td>
      </tr>`;
    }).join('')}
  </table>`;
}
