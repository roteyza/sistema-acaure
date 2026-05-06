function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

/**
 * Devuelve la unidad real de un producto: 'kg' o 'ud'.
 * Tolera variantes ('und', 'unidad') y cae a 'kg' por compat con
 * datos viejos / productos sin unidad seteada.
 *
 * @param {{unidad?: string}} p - Objeto producto (puede ser null/undefined).
 * @returns {string} 'kg' o 'ud'.
 */
function unidadProd(p) {
  const u = (p && p.unidad || 'kg').toLowerCase();
  return (u === 'und' || u === 'unidad' || u === 'ud') ? 'ud' : 'kg';
}

/**
 * Función central de conversión monetaria.
 * Convierte cualquier monto a USD según la vista seleccionada.
 * 
 * @param {number} monto - Monto original
 * @param {string} moneda_original - 'USD' o 'BS'
 * @param {string} tasa_pactada - 'BCV' o 'PARALELO'
 * @param {number} tasa_bcv - Tasa BCV del día de la transacción
 * @param {number} tasa_paralelo - Tasa paralelo del día de la transacción
 * @param {string} [vista] - 'bcv' o 'paralelo' (default: vistaMoneda global)
 * @returns {number} Monto en USD según la vista
 */
function convertir(monto, moneda_original, tasa_pactada, tasa_bcv, tasa_paralelo, vista) {
  if(!monto || !tasa_bcv) return 0;
  const v = vista || vistaMoneda;
  const tp = tasa_paralelo || tasa_bcv; // fallback si no hay paralelo

  if(moneda_original === 'USD') {
    // Se pactó en dólares
    if(tasa_pactada === 'BCV') {
      // Dólares BCV (ej: venta detal cobrada en zelle)
      if(v === 'bcv') return monto;
      // En vista paralelo: $1 BCV = (bcv/paralelo) dólares reales
      return monto * (tasa_bcv / tp);
    } else {
      // Dólares paralelo (ej: alquiler en cash)
      if(v === 'paralelo') return monto;
      // En vista BCV: $1 paralelo = (paralelo/bcv) dólares BCV
      return monto * (tp / tasa_bcv);
    }
  } else {
    // Se pactó en Bs
    if(v === 'bcv') return monto / tasa_bcv;
    return monto / tp;
  }
}


// EXPORTAR CSV
function exportarCSV(datos, nombre) {
  if(!datos || !datos.length) { alert('No hay datos para exportar.'); return; }
  const cols = Object.keys(datos[0]);
  const header = cols.join(',');
  const rows = datos.map(row =>
    cols.map(c => {
      const val = row[c] ?? '';
      const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
      return '"' + str.replace(/"/g, '""') + '"';
    }).join(',')
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre + '_' + new Date().toISOString().split('T')[0] + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Reporte CSV exportado ✓');
}

function exportarXLSX(datos, nombre) {
  if(!datos || !datos.length) { alert('No hay datos para exportar.'); return; }
  if(typeof XLSX === 'undefined') { alert('Error: librería Excel no cargada.'); return; }
  const ws = XLSX.utils.json_to_sheet(datos);
  // Ancho automático de columnas
  const cols = Object.keys(datos[0]);
  ws['!cols'] = cols.map(c => ({
    wch: Math.max(c.length, ...datos.map(r => String(r[c]??'').length).slice(0,50)) + 2
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, nombre.substring(0,31));
  XLSX.writeFile(wb, nombre + '_' + new Date().toISOString().split('T')[0] + '.xlsx');
  showToast('Reporte Excel exportado ✓');
}
