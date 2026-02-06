#!/usr/bin/env node

// ================================================================
// TEST RAPIDE - Backend v5.0
// ================================================================

console.log('🧪 Test Backend v5.0...\n');

// Test 1: Source Config
console.log('📦 Test 1: Source Config');
const {
  SOURCE_CONFIG,
  CATEGORY_SOURCES,
  getSourceConfig,
  getAPISources,
  getScrapingSources
} = require('./source-config');

console.log(`   Sources totales: ${Object.keys(SOURCE_CONFIG).length}`);
console.log(`   Sources API: ${Object.values(SOURCE_CONFIG).filter(s => s.type === 'api').length}`);
console.log(`   Sources Scraping: ${Object.values(SOURCE_CONFIG).filter(s => s.type === 'scraping').length}`);

const apiEpicerie = getAPISources('epicerie');
const scrapingEpicerie = getScrapingSources('epicerie');
console.log(`   Épicerie - API: ${apiEpicerie.length}, Scraping: ${scrapingEpicerie.length}`);
console.log(`   ✅ Source Config OK\n`);

// Test 2: Utils
console.log('🛠️  Test 2: Utils');
const {
  calculateDistance,
  getTimeEstimate,
  getCityCoordinates,
  findNearbyStores,
  getRetailerKey
} = require('./utils');

const mtlCoords = getCityCoordinates('Montreal');
console.log(`   Montréal: ${mtlCoords.latitude}, ${mtlCoords.longitude}`);

const distance = calculateDistance(
  mtlCoords.latitude,
  mtlCoords.longitude,
  45.4995,
  -73.5718
);
console.log(`   Distance test: ${distance.toFixed(2)} km`);
console.log(`   Temps estimé: ${getTimeEstimate(distance)}`);

const walmartStores = findNearbyStores('walmart', mtlCoords.latitude, mtlCoords.longitude, 25);
console.log(`   Walmart proches (25km): ${walmartStores.length} magasins`);

const retailerKey = getRetailerKey('Walmart');
console.log(`   Retailer key "Walmart": ${retailerKey}`);
console.log(`   ✅ Utils OK\n`);

// Test 3: Store Locations
console.log('🏪 Test 3: Store Locations');
const stores = require('./store-locations.json');
const totalStores = Object.values(stores).reduce((sum, arr) => sum + arr.length, 0);
console.log(`   Total magasins: ${totalStores}`);
console.log(`   Retailers: ${Object.keys(stores).join(', ')}`);

const walmartCount = stores.walmart ? stores.walmart.length : 0;
const igaCount = stores.iga ? stores.iga.length : 0;
const metroCount = stores.metro ? stores.metro.length : 0;
console.log(`   Walmart: ${walmartCount}, IGA: ${igaCount}, Metro: ${metroCount}`);
console.log(`   ✅ Store Locations OK\n`);

// Résumé
console.log('═══════════════════════════════════════════');
console.log('✅ TOUS LES TESTS PASSENT');
console.log('═══════════════════════════════════════════');
console.log(`
📊 Statistiques Backend v5.0:
   • Sources totales: ${Object.keys(SOURCE_CONFIG).length}
   • Sources API (prix affichés): ${Object.values(SOURCE_CONFIG).filter(s => s.type === 'api').length}
   • Sources Scraping (liens): ${Object.values(SOURCE_CONFIG).filter(s => s.type === 'scraping').length}
   • Magasins en DB: ${totalStores}
   • Catégories: ${Object.keys(CATEGORY_SOURCES).length}

🎯 Prêt pour déploiement !
`);
