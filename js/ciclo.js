async function loadCicloOperativo() {
  document.getElementById('ciclo-actualizado').textContent = 'Actualizado: ' + new Date().toLocaleTimeString('es-VE');

  const hoy = new Date().toISOString().split('T')[0];
  const vistaLabel = vistaMoneda === 'bcv' ? 'USD BCV' : 'USD Real';

  // Cargar datos en paralelo
  const [comprasRes, lotesRes, movinvRes, ventasRes, movfinRes] = await Promise.all([
    sb.from('compras').select('id,fecha,total_usd,total_usd_paralelo,saldo_pendiente,proveedores(nombre),condicion,status_pago').order('fecha',{ascending:false}).limit(100),
    sb.from('lotes').select('id,partida_id,fecha,num_animales,estado').order('fecha',{ascending:false}),
    sb.from('movimientos_inventario').select('lote_id,tipo,cantidad_kg,producto_id,fecha,productos(nombre,unidad)'),
    sb.from('ventas').select('id,fecha,total_usd,total_usd_paralelo,saldo_pendiente,status,notas').order('fecha',{ascending:false}).limit(200),
    sb.from('movimientos_financieros').select('venta_id,monto_usd,monto,moneda,tipo').eq('tipo','ingreso')
  ]);

  const compras  = comprasRes.data  || [];
  const lotes    = lotesRes.data    || [];
  const movinv   = movinvRes.data   || [];
  const ventas   = ventasRes.data   || [];
  const cobros   = movfinRes.data   || [];

  // Factor de conversión BCV→Paralelo para datos legacy sin total_usd_paralelo
  const spreadFactor = (tasaHoy.bcv && tasaHoy.paralelo) ? tasaHoy.bcv / tasaHoy.paralelo : 1;

  // Helper: obtener monto según vista
  function cicloUSD(total_usd, total_usd_paralelo) {
    const bcv = Number(total_usd || 0);
    if(vistaMoneda === 'bcv') return bcv;
    return Number(total_usd_paralelo) || (bcv * spreadFactor);
  }

  // CxC y CxP consolidado
  const cxcVentas = ventas.filter(v => Number(v.saldo_pendiente) > 0 && v.status !== 'anulada');
  const cxcTotal  = cxcVentas.reduce((s,v) => s + cicloUSD(v.saldo_pendiente, null), 0);
  const cxpCompras = compras.filter(c => c.condicion === 'credito' && c.status_pago !== 'pagada' && c.status_pago !== 'anulada' && Number(c.saldo_pendiente||0) > 0);
  const cxpTotal  = cxpCompras.reduce((s,c) => s + cicloUSD(c.saldo_pendiente, null), 0);
  const posicion  = cxcTotal - cxpTotal;

  document.getElementById('ciclo-cxc').textContent = '$' + cxcTotal.toFixed(0);
  document.getElementById('ciclo-cxc-n').textContent = cxcVentas.length + ' ventas pendientes';
  document.getElementById('ciclo-cxp').textContent = '$' + cxpTotal.toFixed(0);
  document.getElementById('ciclo-cxp-n').textContent = cxpCompras.length + ' compras pendientes';
  document.getElementById('ciclo-posicion').textContent = '$' + posicion.toFixed(0);
  document.getElementById('ciclo-posicion').style.color = posicion >= 0 ? 'var(--success)' : 'var(--danger)';
  document.getElementById('ciclo-posicion-card').style.borderColor = posicion >= 0 ? 'rgba(39,166,106,0.3)' : 'rgba(192,57,43,0.3)';

  // CCE promedio — días desde fecha compra hasta hoy para compras activas
  const cceValues = compras.filter(c => c.saldo_pendiente > 0 || c.status_pago !== 'pagada').map(c => {
    const dias = Math.floor((new Date(hoy) - new Date(c.fecha)) / 86400000);
    return dias;
  });
  const ccePromedio = cceValues.length > 0 ? Math.round(cceValues.reduce((s,v)=>s+v,0) / cceValues.length) : 0;
  const cceColor = ccePromedio <= 21 ? 'var(--success)' : ccePromedio <= 35 ? '#e8b84b' : 'var(--danger)';
  document.getElementById('ciclo-cce').textContent = ccePromedio + ' días';
  document.getElementById('ciclo-cce').style.color = cceColor;

  // Mapa de cobros por venta
  const cobrosMap = {};
  cobros.forEach(c => {
    if(!c.venta_id) return;
    if(!cobrosMap[c.venta_id]) cobrosMap[c.venta_id] = 0;
    cobrosMap[c.venta_id] += Number(c.monto_usd || c.monto || 0);
  });

  // Mapa de lotes por partida
  const lotesByPartida = {};
  lotes.forEach(l => {
    if(!lotesByPartida[l.partida_id]) lotesByPartida[l.partida_id] = [];
    lotesByPartida[l.partida_id].push(l);
  });

  // Inventario producido por lote
  const producidoByLote = {};
  movinv.filter(m => m.tipo === 'entrada' && m.lote_id).forEach(m => {
    if(!producidoByLote[m.lote_id]) producidoByLote[m.lote_id] = 0;
    producidoByLote[m.lote_id] += Number(m.cantidad_kg || 0);
  });

  // Inventario vendido (salidas)
  const vendidoTotal = movinv.filter(m => m.tipo === 'salida').reduce((s,m) => s + Number(m.cantidad_kg||0), 0);

  // Tabla por partida — excluir anuladas y partidas con todos los lotes completados
  const alertas = [];
  let tablaHTML = '<table><tr><th>Partida</th><th>Fecha</th><th>Lotes</th><th>Costo USD</th><th>CxP viva</th><th>CCE días</th><th>Semáforo</th></tr>';

  compras.filter(c => {
    if(c.status_pago === 'anulada') return false;
    const lotesPartida = lotesByPartida[c.id] || [];
    if(lotesPartida.length > 0 && lotesPartida.every(l => l.estado === 'completado')) return false;
    return true;
  }).slice(0, 20).forEach(c => {
    const lotesPartida = lotesByPartida[c.id] || [];
    const diasDesdeCompra = Math.floor((new Date(hoy) - new Date(c.fecha)) / 86400000);
    const semColor = diasDesdeCompra <= 21 ? '#27a66a' : diasDesdeCompra <= 35 ? '#e8b84b' : '#e74c3c';
    const semLabel = diasDesdeCompra <= 21 ? '● Verde' : diasDesdeCompra <= 35 ? '● Amarillo' : '● Rojo';
    const cxpViva = cicloUSD(c.saldo_pendiente, null);

    if(diasDesdeCompra > 21 && cxpViva > 0) {
      alertas.push('⚠ Partida ' + (c.proveedores?.nombre||'?') + ' (' + c.fecha + ') lleva ' + diasDesdeCompra + ' días con CxP viva de $' + cxpViva.toFixed(0));
    }

    tablaHTML += '<tr>' +
      '<td style="color:var(--text);font-weight:600">' + (c.proveedores?.nombre||'—') + '</td>' +
      '<td style="color:var(--text3)">' + c.fecha + '</td>' +
      '<td style="color:var(--azul)">' + lotesPartida.length + ' lote(s)</td>' +
      '<td style="font-weight:600">$' + cicloUSD(c.total_usd, c.total_usd_paralelo).toFixed(0) + '</td>' +
      '<td style="font-weight:600;color:' + (cxpViva>0?'var(--danger)':'var(--success)') + '">' + (cxpViva>0?'$'+cxpViva.toFixed(0):'✓ Pagada') + '</td>' +
      '<td style="font-weight:600">' + diasDesdeCompra + 'd</td>' +
      '<td style="font-weight:600;color:' + semColor + '">' + semLabel + '</td>' +
    '</tr>';
  });
  tablaHTML += '</table>';
  document.getElementById('ciclo-table').innerHTML = tablaHTML;

  // Alertas
  const alertasEl = document.getElementById('ciclo-alertas');
  if(alertas.length) {
    alertasEl.innerHTML = alertas.map(a =>
      '<div style="background:rgba(192,57,43,0.08);border:1px solid rgba(192,57,43,0.2);border-radius:8px;padding:10px 16px;margin-bottom:8px;font-size:13px;color:var(--danger)">' + a + '</div>'
    ).join('');
  } else {
    alertasEl.innerHTML = '<div style="background:rgba(39,166,106,0.08);border:1px solid rgba(39,166,106,0.2);border-radius:8px;padding:10px 16px;font-size:13px;color:var(--success)">✓ Sin alertas activas</div>';
  }

  // Rotación por producto
  const stockByProd = {};
  movinv.forEach(m => {
    if(!m.producto_id) return;
    if(!stockByProd[m.producto_id]) stockByProd[m.producto_id] = {
      nombre: m.productos?.nombre||'—',
      unidad: unidadProd(m.productos),
      entrada: 0, salida: 0, ultimaEntrada: null
    };
    if(m.tipo === 'entrada') {
      stockByProd[m.producto_id].entrada += Number(m.cantidad_kg||0);
      if(!stockByProd[m.producto_id].ultimaEntrada || m.fecha > stockByProd[m.producto_id].ultimaEntrada)
        stockByProd[m.producto_id].ultimaEntrada = m.fecha;
    }
    if(m.tipo === 'salida') stockByProd[m.producto_id].salida += Number(m.cantidad_kg||0);
  });

  const stockParado = Object.values(stockByProd)
    .map(p => ({ ...p, stock: p.entrada - p.salida, dias: p.ultimaEntrada ? Math.floor((new Date(hoy) - new Date(p.ultimaEntrada)) / 86400000) : null }))
    .filter(p => p.stock > 0.1)
    .sort((a,b) => (b.dias||0) - (a.dias||0));

  if(!stockParado.length) {
    document.getElementById('ciclo-rotacion').innerHTML = '<div class="empty" style="padding:16px;text-align:center;color:var(--success)">✓ Sin stock parado</div>';
  } else {
    document.getElementById('ciclo-rotacion').innerHTML = '<table><tr><th>Producto</th><th>Stock</th><th>Días desde última entrada</th><th>Alerta</th></tr>' +
      stockParado.map(p => {
        const alert = !p.dias ? '' : p.dias > 21 ? '🔴 +21 días' : p.dias > 14 ? '🟡 +14 días' : '';
        return '<tr>' +
          '<td style="color:var(--text)">' + p.nombre + '</td>' +
          '<td style="font-weight:600;color:var(--azul)">' + p.stock.toFixed(1) + ' ' + p.unidad + '</td>' +
          '<td style="color:var(--text3)">' + (p.dias !== null ? p.dias + ' días' : '—') + '</td>' +
          '<td>' + alert + '</td>' +
        '</tr>';
      }).join('') + '</table>';
  }
}
