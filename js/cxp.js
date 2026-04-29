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

// ===== DETALLE CxP =====
async function verDetalleCxP(cxp_id, titulo) {
  const [cxpRes, pagosRes] = await Promise.all([
    sb.from('cxp').select('*, proveedores(nombre)').eq('id', cxp_id).maybeSingle(),
    sb.from('movimientos_financieros')
      .select('fecha, monto, monto_bs, monto_usd, moneda, concepto, cuentas(nombre), status')
      .eq('cxp_id', cxp_id)
      .order('fecha', { ascending: true })
  ]);

  document.getElementById('modal-cxp-detalle')?.remove();

  const c = cxpRes.data;
  const pagos = (pagosRes.data || []).filter(p => p.status !== 'anulado');

  const modal = document.createElement('div');
  modal.id = 'modal-cxp-detalle';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:600;display:flex;align-items:center;justify-content:center';

  if (!c) {
    modal.innerHTML = `
      <div style="background:white;border-radius:16px;padding:32px;max-width:480px;margin:24px">
        <div style="color:var(--danger)">CxP no encontrada.</div>
        <button onclick="document.getElementById('modal-cxp-detalle').remove()" style="margin-top:16px;background:none;border:1px solid var(--border);border-radius:8px;padding:6px 14px;cursor:pointer">Cerrar</button>
      </div>`;
    document.body.appendChild(modal);
    return;
  }

  const anulada = c.status === 'anulada';
  const totalPagado = pagos.reduce((s,p) => s + Number(p.monto_usd||0), 0);

  // Datos generales
  const datosHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px 20px;font-size:13px;margin-bottom:16px">
      <div><div style="font-size:10px;color:var(--text3);text-transform:uppercase">Acreedor</div><strong>${c.proveedores?.nombre || '—'}</strong></div>
      <div><div style="font-size:10px;color:var(--text3);text-transform:uppercase">Categoría</div><strong>${categoriaLabelCxP(c.categoria)}</strong></div>
      <div><div style="font-size:10px;color:var(--text3);text-transform:uppercase">Concepto</div><strong>${c.concepto||'—'}</strong></div>
      <div><div style="font-size:10px;color:var(--text3);text-transform:uppercase">Status</div><strong>${c.status}</strong></div>
      <div><div style="font-size:10px;color:var(--text3);text-transform:uppercase">Fecha creación</div><strong>${c.fecha_creacion}</strong></div>
      <div><div style="font-size:10px;color:var(--text3);text-transform:uppercase">Vencimiento</div><strong>${c.fecha_vencimiento || '—'}</strong></div>
      <div><div style="font-size:10px;color:var(--text3);text-transform:uppercase">Monto USD</div><strong style="color:var(--azul)">$${Number(c.monto_usd).toFixed(2)}</strong></div>
      <div><div style="font-size:10px;color:var(--text3);text-transform:uppercase">Saldo pendiente</div><strong style="color:${Number(c.saldo_pendiente)>0?'var(--danger)':'var(--success)'}">${Number(c.saldo_pendiente)>0 ? '$'+Number(c.saldo_pendiente).toFixed(2) : '✓ 0'}</strong></div>
    </div>
    ${c.notas ? `<div style="font-size:12px;color:var(--text3);background:var(--surface2);border-radius:8px;padding:10px 14px;margin-bottom:16px"><strong style="color:var(--text2)">Notas:</strong> ${c.notas}</div>` : ''}
  `;

  // Historial de pagos
  let pagosHTML = '<div style="font-size:12px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:1px;margin:16px 0 10px">Historial de pagos</div>';
  if (!pagos.length) {
    pagosHTML += '<div style="font-size:13px;color:var(--text3);padding:8px 0">Sin pagos registrados aún.</div>';
  } else {
    pagosHTML += '<table style="width:100%;border-collapse:collapse;font-size:13px"><tr><th>Fecha</th><th>Forma</th><th>Monto</th><th>Cuenta</th></tr>';
    pagos.forEach(p => {
      const esBs = p.moneda === 'bs';
      const montoStr = esBs
        ? 'Bs ' + Number(p.monto_bs||p.monto).toFixed(0) + ' (≈ $' + Number(p.monto_usd||0).toFixed(2) + ')'
        : '$' + Number(p.monto).toFixed(2);
      pagosHTML += '<tr>' +
        '<td style="color:var(--text3);padding:6px 4px">' + p.fecha + '</td>' +
        '<td style="color:var(--text3);padding:6px 4px">' + (esBs ? 'Bs' : 'USD') + '</td>' +
        '<td style="font-weight:600;color:var(--success);padding:6px 4px">' + montoStr + '</td>' +
        '<td style="color:var(--text3);font-size:12px;padding:6px 4px">' + (p.cuentas?.nombre || '—') + '</td>' +
        '</tr>';
    });
    pagosHTML += '<tr style="border-top:2px solid var(--border);background:var(--surface2)">' +
      '<td colspan="2" style="color:var(--text3);font-size:12px;padding:8px 4px">Total pagado</td>' +
      '<td style="font-weight:700;color:var(--success);padding:8px 4px">$' + totalPagado.toFixed(2) + '</td>' +
      '<td></td></tr>';
    pagosHTML += '</table>';
  }

  const aviso = anulada
    ? '<div style="background:#fdecea;border:1px solid #e74c3c44;border-radius:8px;padding:10px 14px;margin-bottom:16px;color:#c0392b;font-weight:600;font-size:13px">⚠ Esta CxP está anulada</div>'
    : '';

  const btnAnular = anulada ? '' : `<button onclick="anularCxP('${cxp_id}', this)" style="background:#fdecea;color:var(--danger);border:1px solid #e74c3c44;border-radius:8px;padding:8px 18px;font-family:'Sora',sans-serif;font-size:13px;font-weight:600;cursor:pointer;margin-top:20px">Anular CxP</button>`;

  modal.innerHTML = `
    <div style="background:white;border-radius:16px;padding:32px;width:100%;max-width:640px;max-height:90vh;overflow-y:auto;margin:24px;box-shadow:0 20px 60px rgba(0,0,0,0.2)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <div style="font-size:17px;font-weight:700;color:var(--azul)">${titulo}</div>
        <button onclick="document.getElementById('modal-cxp-detalle').remove()" style="background:none;border:none;font-size:20px;color:var(--text3);cursor:pointer">✕</button>
      </div>
      ${aviso}
      ${datosHTML}
      ${pagosHTML}
      <div>${btnAnular}</div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

// ===== PAGO DE CxP =====
let pagarCxPId = null;

async function abrirPagarCxP(cxp_id, descripcion, saldo) {
  const { data: cuentasData } = await sb.from('cuentas').select('*').eq('activo', true);
  cuentasSelectData = cuentasData || [];
  pagarCxPId = cxp_id;

  document.getElementById('pagar-cxp-desc').textContent = descripcion + ' — Saldo: $' + Number(saldo).toFixed(2);
  document.getElementById('pcxp-id').value = cxp_id;
  document.getElementById('pcxp-saldo-actual').value = saldo;
  document.getElementById('pcxp-fecha').value = new Date().toISOString().split('T')[0];
  document.getElementById('pcxp-monto').value = Number(saldo).toFixed(2);

  // Pre-llenar tasa BCV
  const bcvT = (tasasData || []).find(t => t.nombre === 'BCV');
  const tasaEl = document.getElementById('pcxp-tasa-valor');
  if (bcvT && tasaEl) tasaEl.value = bcvT.valor;
  const montoBsEl = document.getElementById('pcxp-monto-bs');
  if (montoBsEl) montoBsEl.value = '';
  const usdBsEl = document.getElementById('pcxp-monto-usd-bs');
  if (usdBsEl) usdBsEl.value = '';

  // Cargar cuentas
  const sel = document.getElementById('pcxp-cuenta');
  if (sel && cuentasSelectData.length) {
    cuentasMonedaMap = cuentasMonedaMap || {};
    cuentasSelectData.forEach(c => { cuentasMonedaMap[c.id] = c.moneda; });
    const monedaLabelPcxp = { banco_bs:'Bs', banco_usd:'USD', efectivo_usd:'USD efectivo', efectivo_bs:'Bs efectivo', zelle:'Zelle USD' };
    sel.innerHTML = cuentasSelectData.map(c =>
      `<option value="${c.id}">${c.nombre} (${monedaLabelPcxp[c.tipo] || c.moneda.toUpperCase()})</option>`
    ).join('');
    onCuentaChange('pcxp');
  }

  document.getElementById('modal-pagar-cxp').style.display = 'flex';
}

function cerrarPagarCxP() {
  document.getElementById('modal-pagar-cxp').style.display = 'none';
  pagarCxPId = null;
}

async function guardarPagoCxP() {
  if (!pagarCxPId) { alert('Error: no hay CxP seleccionada.'); return; }

  const cuenta_id  = document.getElementById('pcxp-cuenta').value;
  const monedaCuenta = cuentasMonedaMap[cuenta_id] || 'usd';
  const esBs       = monedaCuenta === 'bs';
  const fecha      = document.getElementById('pcxp-fecha').value;

  const montoUSD = esBs
    ? parseFloat(document.getElementById('pcxp-monto-usd-bs').value) || 0
    : parseFloat(document.getElementById('pcxp-monto').value) || 0;
  const montoBS  = esBs
    ? parseFloat(document.getElementById('pcxp-monto-bs').value) || 0
    : 0;

  if (!cuenta_id)               { alert('Seleccioná una cuenta.'); return; }
  if (!fecha)                   { alert('Seleccioná una fecha.'); return; }
  if (!esBs && montoUSD <= 0)   { alert('Ingresá un monto válido.'); return; }
  if (esBs && montoBS  <= 0)    { alert('Ingresá el monto en Bs.'); return; }
  if (esBs && montoUSD <= 0)    { alert('Ingresá el equivalente en USD.'); return; }

  // Datos para el insert
  const r1 = await sb.from('cxp')
    .select('proveedores(nombre), saldo_pendiente, monto_usd, concepto')
    .eq('id', pagarCxPId).maybeSingle();
  const provNombre = r1.data?.proveedores?.nombre || 'Acreedor';
  const concepto   = r1.data?.concepto || '';

  const tasa_tipo  = esBs ? (document.getElementById('pcxp-tasa-tipo')?.value || 'BCV') : 'USD';
  const tasa_valor = esBs ? (parseFloat(document.getElementById('pcxp-tasa-valor')?.value) || null) : null;
  const monto_nativo = esBs ? montoBS : null;

  const { error: errMF } = await sb.from('movimientos_financieros').insert({
    fecha,
    cuenta_id,
    tipo: 'egreso',
    concepto: 'Pago CxP — ' + provNombre + (concepto ? ' (' + concepto + ')' : ''),
    monto:     esBs ? montoBS : montoUSD,
    monto_bs:  esBs ? montoBS : null,
    monto_usd: montoUSD,
    moneda:    monedaCuenta,
    tasa_tipo, tasa_valor, monto_nativo,
    tasa_pactada: esBs ? tasa_tipo : 'BCV',
    tasa_bcv_dia: tasaHoy?.bcv || null,
    tasa_paralelo_dia: tasaHoy?.paralelo || null,
    contraparte: provNombre,
    status: 'registrado',
    cxp_id: pagarCxPId,
    usuario_id: currentUser?.id || null
  });
  if (errMF) { alert('Error registrando egreso: ' + errMF.message); return; }

  // Recalcular saldo y status en JS (no hay trigger)
  await recalcSaldoCxP(pagarCxPId);

  // Volver a leer la CxP para el toast y la auditoria
  const r2 = await sb.from('cxp').select('saldo_pendiente, status').eq('id', pagarCxPId).maybeSingle();
  const nuevoSaldo = Number(r2.data?.saldo_pendiente || 0);

  cerrarPagarCxP();
  showToast('Pago registrado ✓ — saldo: $' + nuevoSaldo.toFixed(2));
  registrarAuditoria('pago_cxp', 'cxp', pagarCxPId,
    'Pago: $' + montoUSD.toFixed(2) + ' a ' + provNombre + ' | Saldo: $' + nuevoSaldo.toFixed(2));

  // Refrescar vistas
  if (document.getElementById('page-cxp')?.classList.contains('active')) loadCxP();
  if (document.getElementById('page-finanzas')?.classList.contains('active') && typeof loadFinanzas === 'function') loadFinanzas();
  if (document.getElementById('page-dashboard')?.classList.contains('active')) loadDashboard();
}

async function recalcSaldoCxP(cxp_id) {
  const [cxpRes, pagosRes] = await Promise.all([
    sb.from('cxp').select('monto_usd, status').eq('id', cxp_id).single(),
    sb.from('movimientos_financieros')
      .select('monto_usd, status').eq('cxp_id', cxp_id).eq('tipo', 'egreso')
  ]);
  if (!cxpRes.data || cxpRes.data.status === 'anulada') return;

  const totalPagado = (pagosRes.data || [])
    .filter(p => p.status !== 'anulado')
    .reduce((s, p) => s + Number(p.monto_usd || 0), 0);
  const monto = Number(cxpRes.data.monto_usd);
  const nuevoSaldo  = Math.max(0, monto - totalPagado);
  const nuevoStatus = nuevoSaldo === 0
    ? 'pagada'
    : (nuevoSaldo < monto ? 'parcial' : 'pendiente');

  await sb.from('cxp').update({
    saldo_pendiente: nuevoSaldo,
    status: nuevoStatus
  }).eq('id', cxp_id);
}

async function anularCxP(cxp_id, btn) {
  if (!confirm('¿Anular esta CxP? Esta acción no se puede deshacer.')) return;
  if (btn) btn.disabled = true;

  const { error } = await sb.from('cxp').update({
    status: 'anulada',
    saldo_pendiente: 0
  }).eq('id', cxp_id);

  if (error) {
    alert('Error: ' + error.message);
    if (btn) btn.disabled = false;
    return;
  }

  showToast('CxP anulada');
  registrarAuditoria('cxp_anulada', 'cxp', cxp_id, 'CxP anulada');

  document.getElementById('modal-cxp-detalle')?.remove();
  if (document.getElementById('page-cxp')?.classList.contains('active')) loadCxP();
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
          <button data-cid="${c.id}" data-titulo="${(c.proveedores?.nombre||'Acreedor').replace(/"/g,'&quot;')} — ${c.fecha_creacion}"
            onclick="verDetalleCxP(this.dataset.cid, this.dataset.titulo)"
            style="background:none;border:1px solid var(--border);color:var(--text2);border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer">Ver</button>
          ${(c.status === 'pendiente' || c.status === 'parcial') && Number(c.saldo_pendiente) > 0 ? `<button data-cid="${c.id}" data-desc="${(c.proveedores?.nombre||'Acreedor').replace(/"/g,'&quot;')} — ${c.concepto}" data-saldo="${Number(c.saldo_pendiente).toFixed(2)}"
            onclick="abrirPagarCxP(this.dataset.cid, this.dataset.desc, this.dataset.saldo)"
            style="background:rgba(192,57,43,0.1);border:1px solid rgba(192,57,43,0.3);color:var(--danger);border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer">💳 Pagar</button>` : ''}
        </td>
      </tr>`;
    }).join('')}
  </table>`;
}
