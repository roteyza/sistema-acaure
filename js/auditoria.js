// ===== AUDITORÍA =====
let auditoriaData = [];

async function registrarAuditoria(accion, tabla, registro_id, detalle) {
  try {
    await sb.from('auditoria').insert({
      usuario_id:    currentUser?.id || null,
      usuario_email: currentUser?.email || null,
      accion,
      tabla:         tabla || null,
      registro_id:   registro_id ? String(registro_id) : null,
      detalle:       detalle || null
    });
  } catch(e) {
    // Silencioso — no interrumpir el flujo por error de auditoría
  }
}

async function loadAuditoria() {
  const tb = document.getElementById('audit-table');
  if(tb) tb.innerHTML = '<div class="loading">Cargando...</div>';

  const usuarioFiltro = document.getElementById('audit-usuario')?.value || '';
  const accionFiltro  = document.getElementById('audit-accion')?.value  || '';
  const desde = document.getElementById('audit-desde')?.value || '';
  const hasta  = document.getElementById('audit-hasta')?.value  || '';

  // Fecha por defecto: últimos 30 días
  if(!desde) {
    const d = new Date(); d.setDate(d.getDate()-30);
    const desdeEl = document.getElementById('audit-desde');
    if(desdeEl) desdeEl.value = d.toISOString().split('T')[0];
  }
  if(!hasta) {
    const hastaEl = document.getElementById('audit-hasta');
    if(hastaEl) hastaEl.value = new Date().toISOString().split('T')[0];
  }

  // Cargar usuarios en el filtro
  const selUsuario = document.getElementById('audit-usuario');
  if(selUsuario && selUsuario.options.length <= 1) {
    const { data: uds } = await sb.from('auditoria').select('usuario_email').not('usuario_email','is',null);
    const emails = [...new Set((uds||[]).map(u => u.usuario_email))].sort();
    emails.forEach(e => {
      const opt = document.createElement('option');
      opt.value = e; opt.textContent = e;
      selUsuario.appendChild(opt);
    });
  }

  let query = sb.from('auditoria').select('*').order('created_at',{ascending:false}).limit(200);
  if(usuarioFiltro) query = query.eq('usuario_email', usuarioFiltro);
  if(accionFiltro)  query = query.ilike('accion', '%' + accionFiltro + '%');
  if(desde) query = query.gte('created_at', desde + 'T00:00:00');
  if(hasta)  query = query.lte('created_at', hasta + 'T23:59:59');

  const { data } = await query;
  auditoriaData = data || [];

  const countEl = document.getElementById('audit-count');
  if(countEl) countEl.textContent = auditoriaData.length + ' registros';

  if(!tb) return;
  if(!auditoriaData.length) {
    tb.innerHTML = '<div class="empty"><div class="empty-icon">◷</div><p>Sin registros en el período.</p></div>';
    return;
  }

  const accionColor = {
    'venta_registrada': '#27a66a', 'venta_anulada': '#e74c3c',
    'cobro_registrado': '#27a66a', 'compra_registrada': '#5dade2',
    'pago_compra': '#e8b84b', 'mov_inventario': '#af7ac5',
    'finanzas': '#5dade2', 'tasa_guardada': '#95a5a6', 'login': '#003A70'
  };

  tb.innerHTML = '<table>' +
    '<tr><th>Fecha/Hora</th><th>Usuario</th><th>Acción</th><th>Detalle</th></tr>' +
    auditoriaData.map(a => {
      const fecha = new Date(a.created_at).toLocaleString('es-VE');
      const color = accionColor[a.accion] || '#888';
      return '<tr>' +
        '<td style="color:var(--text3);font-size:12px;white-space:nowrap">' + fecha + '</td>' +
        '<td style="color:var(--text2);font-size:12px">' + (a.usuario_email||'—').split('@')[0] + '</td>' +
        '<td><span class="badge" style="background:' + color + '22;color:' + color + '">' + (a.accion||'—') + '</span></td>' +
        '<td style="color:var(--text);font-size:12px">' + (a.detalle||'—') + '</td>' +
      '</tr>';
    }).join('') +
    '</table>';
  makeSortable(tb.querySelector('table'));
}

function exportarAuditoria(fmt) {
  if(!auditoriaData.length) { alert('No hay datos para exportar.'); return; }
  const rows = auditoriaData.map(a => ({
    fecha_hora: new Date(a.created_at).toLocaleString('es-VE'),
    usuario: a.usuario_email || '—',
    accion: a.accion || '—',
    tabla: a.tabla || '—',
    registro_id: a.registro_id || '—',
    detalle: a.detalle || '—'
  }));
  if(fmt === 'xlsx') exportarXLSX(rows, 'auditoria');
  else exportarCSV(rows, 'auditoria');
}
