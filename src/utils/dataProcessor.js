import { 
  classifyProduct, 
  extractPresentation, 
  extractCompetitorBrand, 
  extractTunalBrand,
  canonicalCategory,
  canonicalSubcategory,
  normalizeCategoryName 
} from '../data/categoryStructure';

/**
 * Filtra los registros según los filtros seleccionados
 */
export function filterRecords(records, filters) {
  if (!records || !records.length) return [];

  return records.filter(item => {
    // Filtro Categoría (con normalización robusta)
    if (filters.category && filters.category !== 'all') {
      const itemCat = canonicalCategory(item.categoria);
      const filterCat = canonicalCategory(filters.category);
      if (itemCat !== filterCat) return false;
    }

    // Filtro Subcategoría (con normalización robusta)
    if (filters.subcategory && filters.subcategory !== 'all') {
      const itemSub = canonicalSubcategory(item.subcategoria);
      const filterSub = canonicalSubcategory(filters.subcategory);
      if (itemSub !== filterSub) return false;
    }

    // Filtro Sucursal (SucCliente)
    if (filters.sucCliente && filters.sucCliente !== 'all') {
      if (item.sucCliente !== filters.sucCliente) return false;
    }

    // Filtro Marca Competencia
    if (filters.competitorBrand && filters.competitorBrand !== 'all') {
      if (item.origen === 'Competencia' && item.marca !== filters.competitorBrand) return false;
    }

    return true;
  });
}

/**
 * Calcula el resumen de muestras (conteo de registros)
 */
export function calculateSampleMetrics(filteredTunal, filteredComp) {
  const tunalCount = filteredTunal.length;
  const compCount = filteredComp.length;
  const totalCount = tunalCount + compCount;

  // Sucursales únicas
  const sucursalesTunal = new Set(filteredTunal.map(r => r.sucCliente).filter(Boolean));
  const sucursalesComp = new Set(filteredComp.map(r => r.sucCliente).filter(Boolean));
  const totalSucursales = new Set([...sucursalesTunal, ...sucursalesComp]).size;

  // Productos únicos
  const prodsTunal = new Set(filteredTunal.map(r => r.producto)).size;
  const prodsComp = new Set(filteredComp.map(r => r.producto)).size;

  const ratio = compCount > 0 ? (tunalCount / compCount).toFixed(2) : 'N/A';
  const shareTunal = totalCount > 0 ? ((tunalCount / totalCount) * 100).toFixed(1) : 0;
  const shareComp = totalCount > 0 ? ((compCount / totalCount) * 100).toFixed(1) : 0;

  return {
    tunalCount,
    compCount,
    totalCount,
    totalSucursales,
    prodsTunal,
    prodsComp,
    ratio,
    shareTunal,
    shareComp
  };
}

/**
 * Agrupa registros por subcategoría para gráficos de distribución de muestras
 */
export function getSampleDistributionBySubcategory(filteredTunal, filteredComp, activeCategory, categoryStructure) {
  let subcategories = [];

  const normActiveCat = activeCategory && activeCategory !== 'all' ? canonicalCategory(activeCategory) : 'all';

  if (normActiveCat !== 'all' && categoryStructure[normActiveCat]) {
    subcategories = categoryStructure[normActiveCat].subcategories;
  } else {
    // Si están todas las categorías seleccionadas, obtenemos todas las subcategorías presentes
    const setSubs = new Set([
      ...filteredTunal.map(r => canonicalSubcategory(r.subcategoria)),
      ...filteredComp.map(r => canonicalSubcategory(r.subcategoria))
    ]);
    subcategories = Array.from(setSubs).sort();
  }

  return subcategories.map(sub => {
    const normSub = canonicalSubcategory(sub);
    const tRecords = filteredTunal.filter(r => canonicalSubcategory(r.subcategoria) === normSub);
    const cRecords = filteredComp.filter(r => canonicalSubcategory(r.subcategoria) === normSub);

    return {
      subcategoria: sub,
      tunalMuestras: tRecords.length,
      compMuestras: cRecords.length,
      totalMuestras: tRecords.length + cRecords.length
    };
  }).filter(item => item.totalMuestras > 0);
}

/**
 * Genera comparativa directa de productos homólogos por Subcategoría y Presentación
 */
export function getProductPriceComparison(filteredTunal, filteredComp) {
  const tunalGroups = {};
  filteredTunal.forEach(r => {
    const cat = canonicalCategory(r.categoria);
    const sub = canonicalSubcategory(r.subcategoria);
    const pres = r.presentacion || 'Estándar';
    const key = `${cat}__${sub}__${pres}`;

    if (!tunalGroups[key]) {
      tunalGroups[key] = {
        categoria: cat,
        subcategoria: sub,
        presentacion: pres,
        productos: new Set(),
        precios: [],
        muestras: 0,
        sucursales: new Set()
      };
    }
    tunalGroups[key].productos.add(r.producto);
    tunalGroups[key].precios.push(r.precio);
    tunalGroups[key].muestras += 1;
    if (r.sucCliente) tunalGroups[key].sucursales.add(r.sucCliente);
  });

  const compGroups = {};
  filteredComp.forEach(r => {
    const cat = canonicalCategory(r.categoria);
    const sub = canonicalSubcategory(r.subcategoria);
    const pres = r.presentacion || 'Estándar';
    const key = `${cat}__${sub}__${pres}`;

    if (!compGroups[key]) {
      compGroups[key] = {
        categoria: cat,
        subcategoria: sub,
        presentacion: pres,
        productos: new Set(),
        marcas: new Set(),
        precios: [],
        muestras: 0,
        sucursales: new Set()
      };
    }
    compGroups[key].productos.add(r.producto);
    if (r.marca) compGroups[key].marcas.add(r.marca);
    compGroups[key].precios.push(r.precio);
    compGroups[key].muestras += 1;
    if (r.sucCliente) compGroups[key].sucursales.add(r.sucCliente);
  });

  const allKeys = new Set([...Object.keys(tunalGroups), ...Object.keys(compGroups)]);
  const comparisons = [];

  allKeys.forEach(key => {
    const t = tunalGroups[key];
    const c = compGroups[key];

    const cat = t ? t.categoria : c.categoria;
    const sub = t ? t.subcategoria : c.subcategoria;
    const pres = t ? t.presentacion : c.presentacion;

    const tPrecios = t ? t.precios.sort((a, b) => a - b) : [];
    const cPrecios = c ? c.precios.sort((a, b) => a - b) : [];

    const tMin = tPrecios.length ? tPrecios[0] : null;
    const tMax = tPrecios.length ? tPrecios[tPrecios.length - 1] : null;
    const tMediana = tPrecios.length ? tPrecios[Math.floor(tPrecios.length / 2)] : null;

    const cMin = cPrecios.length ? cPrecios[0] : null;
    const cMax = cPrecios.length ? cPrecios[cPrecios.length - 1] : null;
    const cMediana = cPrecios.length ? cPrecios[Math.floor(cPrecios.length / 2)] : null;

    const tMuestras = t ? t.muestras : 0;
    const cMuestras = c ? c.muestras : 0;

    let diffPorcentaje = null;
    let diffMonto = null;
    let status = 'Sin Par Competitivo';

    if (tMediana && cMediana) {
      diffMonto = Number((tMediana - cMediana).toFixed(2));
      diffPorcentaje = Number((((tMediana - cMediana) / cMediana) * 100).toFixed(1));

      if (diffPorcentaje < -2) {
        status = 'Más Competitivo (Menor Precio)';
      } else if (diffPorcentaje > 2) {
        status = 'Precio Premium (Mayor Precio)';
      } else {
        status = 'A la Par (Competitivo)';
      }
    }

    comparisons.push({
      key,
      categoria: cat,
      subcategoria: sub,
      presentacion: pres,
      tunalProductos: t ? Array.from(t.productos).join(', ') : 'Sin registro Tunal',
      tunalMuestras: tMuestras,
      tunalMin: tMin,
      tunalMax: tMax,
      tunalMediana: tMediana,
      compProductos: c ? Array.from(c.productos).join(', ') : 'Sin registro Competencia',
      compMarcas: c ? Array.from(c.marcas).join(', ') : 'N/A',
      compMuestras: cMuestras,
      compMin: cMin,
      compMax: cMax,
      compMediana: cMediana,
      diffMonto,
      diffPorcentaje,
      status,
      totalMuestras: tMuestras + cMuestras
    });
  });

  return comparisons.sort((a, b) => b.totalMuestras - a.totalMuestras);
}

/**
 * Obtiene el conteo de muestras por Marca de Competencia
 */
export function getCompetitorBrandSampleDistribution(filteredComp) {
  const brandCounts = {};
  filteredComp.forEach(r => {
    const brand = r.marca || 'Otra Competencia';
    brandCounts[brand] = (brandCounts[brand] || 0) + 1;
  });

  return Object.entries(brandCounts)
    .map(([marca, muestras]) => ({
      marca,
      muestras,
      porcentaje: ((muestras / (filteredComp.length || 1)) * 100).toFixed(1)
    }))
    .sort((a, b) => b.muestras - a.muestras);
}

/**
 * Obtiene el top de sucursales con conteo de muestras (El Tunal vs Competencia)
 */
export function getTopSucursalesBySamples(filteredTunal, filteredComp, limit = 10) {
  const sucursalesMap = {};

  filteredTunal.forEach(r => {
    const suc = r.sucCliente || 'Sin Sucursal';
    if (!sucursalesMap[suc]) {
      sucursalesMap[suc] = { sucursal: suc, tunalMuestras: 0, compMuestras: 0 };
    }
    sucursalesMap[suc].tunalMuestras += 1;
  });

  filteredComp.forEach(r => {
    const suc = r.sucCliente || 'Sin Sucursal';
    if (!sucursalesMap[suc]) {
      sucursalesMap[suc] = { sucursal: suc, tunalMuestras: 0, compMuestras: 0 };
    }
    sucursalesMap[suc].compMuestras += 1;
  });

  return Object.values(sucursalesMap)
    .map(item => ({
      ...item,
      totalMuestras: item.tunalMuestras + item.compMuestras
    }))
    .sort((a, b) => b.totalMuestras - a.totalMuestras)
    .slice(0, limit);
}

/**
 * Exporta datos a CSV
 */
export function exportToCSV(data, filename = 'benchmark_precios_el_tunal.csv') {
  if (!data || !data.length) return;

  const headers = Object.keys(data[0]);
  const csvRows = [];

  csvRows.push(headers.join(';'));

  data.forEach(row => {
    const values = headers.map(header => {
      const val = row[header];
      if (val === null || val === undefined) return '';
      const escaped = ('' + val).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(';'));
  });

  const csvString = '\uFEFF' + csvRows.join('\r\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
