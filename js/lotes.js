// ===== LOTES =====
async function loadLotes() {
  // Cargar partidas (compras) en el select
  const selPartida = document.getElementById('lote-partida');
  if(selPartida) {
    const { data: compras } = await sb.from('compras')
      .select('id, fecha, proveedores(nombre), notas')
      .order('fecha', {ascending: false}).limit(50);
    selPartida.innerHTML = '<option value="">— Seleccionar compra —</option>' +
      (compras||[]).map(c => {
        const label = (c.proveedores?.nombre||'?') + ' — ' + c.fecha + (c.notas ? ' | ' + c.notas.substring(0,40) : '');
        return '<option value="' + c.id + '">' + label + '</option>';
      }).join('');
  }

  // Cargar lotes en el select de movimientos
  const selLote = document.getElementById('mi-lote');
  if(selLote) {
    const { data: lotes } = await sb.from('lotes')
      .select('id, fecha, num_animales, estado, compras(proveedores(nombre))')
      .order('fecha', {ascending: false}).limit(50);
    selLote.innerHTML = '<option value="">— Sin lote —</option>' +
      (lotes||[]).filter(l => l.estado !== 'completado').map(l => {
        const prov = l.compras?.proveedores?.nombre || '?';
        return '<option value="' + l.id + '">' + prov + ' — ' + l.fecha + ' (' + l.num_animales + ' animales)</option>';
      }).join('');
  }

  // Fecha por defecto
  const fechaEl = document.getElementById('lote-fecha');
  if(fechaEl && !fechaEl.value) fechaEl.value = new Date().toISOString().split('T')[0];

  // Cargar tabla de lotes
  const { data: lotes } = await sb.from('lotes')
    .select('*, compras(fecha, proveedores(nombre))')
    .order('fecha', {ascending: false}).limit(50);

  const tb = document.getElementById('lotes-table');
  if(!lotes || !lotes.length) {
    tb.innerHTML = '<div class="empty"><div class="empty-icon">⬡</div><p>Sin lotes registrados aún.</p></div>';
    return;
  }

  const estadoColor = { pendiente: '#e8b84b', en_proceso: '#5dade2', completado: '#27a66a' };

  tb.innerHTML = '<table>' +
    '<tr><th>Fecha desposte</th><th>Nomenclatura</th><th>Partida</th><th>Animales</th><th>Estado</th><th>Notas</th></tr>' +
    lotes.map(l => '<tr>' +
      '<td style="color:var(--text3)">' + l.fecha + '</td>' +
      '<td style="font-family:monospace;font-weight:600;color:var(--azul);letter-spacing:1px">' + (l.nomenclatura||'—') + '</td>' +
      '<td style="color:var(--text)">' + (l.compras?.proveedores?.nombre||'—') + ' — ' + (l.compras?.fecha||'—') + '</td>' +
      '<td style="font-weight:600;color:var(--azul)">' + l.num_animales + '</td>' +
      '<td><select data-lid="' + l.id + '" onchange="cambiarEstadoLote(this.dataset.lid, this.value)" style="background:' + (estadoColor[l.estado]||'#888') + '18;border:1px solid ' + (estadoColor[l.estado]||'#888') + '44;border-radius:6px;padding:4px 8px;font-size:11px;font-family:\'Sora\',sans-serif;color:' + (estadoColor[l.estado]||'#888') + ';font-weight:600;cursor:pointer">' +
        '<option value="pendiente"' + (l.estado==='pendiente'?' selected':'') + '>Pendiente</option>' +
        '<option value="en_proceso"' + (l.estado==='en_proceso'?' selected':'') + '>En proceso</option>' +
        '<option value="completado"' + (l.estado==='completado'?' selected':'') + '>Completado</option>' +
      '</select></td>' +
      '<td style="color:var(--text3);font-size:12px">' + (l.notas||'—') + '</td>' +
    '</tr>').join('') +
    '</table>';
  makeSortable(document.getElementById('lotes-table')?.querySelector('table'));
}

async function guardarLote() {
  const partida_id = document.getElementById('lote-partida').value;
  const fecha      = document.getElementById('lote-fecha').value;
  const num_animales = parseInt(document.getElementById('lote-animales').value) || 1;
  const estado     = document.getElementById('lote-estado').value;
  const notas      = document.getElementById('lote-notas').value;

  const nomenclatura = document.getElementById('lote-nomenclatura').value.trim().toUpperCase();

  if(!partida_id) { alert('Seleccioná la partida (compra).'); return; }
  if(!fecha)      { alert('Seleccioná la fecha de desposte.'); return; }

  const { error } = await sb.from('lotes').insert({
    partida_id, fecha, num_animales, estado, notas: notas || null,
    nomenclatura: nomenclatura || null
  });

  if(error) { alert('Error: ' + error.message); return; }
  showToast('Lote registrado ✓');
  document.getElementById('lote-animales').value = '';
  document.getElementById('lote-notas').value = '';
  document.getElementById('lote-nomenclatura').value = '';
  loadLotes();
}

async function cambiarEstadoLote(lote_id, nuevo_estado) {
  if(!nuevo_estado) return;
  const { error } = await sb.from('lotes').update({ estado: nuevo_estado }).eq('id', lote_id);
  if(error) { alert('Error: ' + error.message); return; }
  showToast('Estado actualizado ✓');
  loadLotes();
}
