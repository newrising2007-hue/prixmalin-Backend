// ================================================================
// UTILS - Fonctions utilitaires PrixMalin v5.0
// ================================================================

const storeLocations = require('./store-locations.json');

// ================================================================
// CALCUL DE DISTANCE
// ================================================================

/**
 * Calculer la distance entre deux points GPS (formule Haversine)
 * @param {number} lat1 - Latitude point 1
 * @param {number} lon1 - Longitude point 1
 * @param {number} lat2 - Latitude point 2
 * @param {number} lon2 - Longitude point 2
 * @returns {number} Distance en kilomètres
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Rayon de la Terre en km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

/**
 * Convertir degrés en radians
 */
function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Convertir distance en temps de trajet estimé
 * @param {number} distanceKm - Distance en kilomètres
 * @returns {string} Temps estimé formatté
 */
function getTimeEstimate(distanceKm) {
  if (!distanceKm || distanceKm === 0) return '';
  
  // Vitesse moyenne selon distance
  const speed = distanceKm < 10 ? 40 : 60; // km/h
  const minutes = Math.round((distanceKm / speed) * 60);
  
  if (minutes < 5) return '~5 min';
  if (minutes > 60) return `~${Math.round(minutes / 60)}h`;
  return `~${minutes} min`;
}

// ================================================================
// GÉOLOCALISATION
// ================================================================

/**
 * Obtenir les coordonnées d'une ville (données statiques)
 * @param {string} cityName - Nom de la ville
 * @returns {object|null} {latitude, longitude} ou null
 */
function getCityCoordinates(cityName) {
  const cities = {
    'montreal': { latitude: 45.5017, longitude: -73.5673 },
    'montréal': { latitude: 45.5017, longitude: -73.5673 },
    'quebec': { latitude: 46.8139, longitude: -71.2080 },
    'québec': { latitude: 46.8139, longitude: -71.2080 },
    'laval': { latitude: 45.6066, longitude: -73.7124 },
    'gatineau': { latitude: 45.4765, longitude: -75.7013 },
    'longueuil': { latitude: 45.5312, longitude: -73.5181 },
    'sherbrooke': { latitude: 45.4042, longitude: -71.8929 },
    'trois-rivieres': { latitude: 46.3432, longitude: -72.5475 },
    'saguenay': { latitude: 48.4169, longitude: -71.0651 },
    'levis': { latitude: 46.8000, longitude: -71.1779 },
    'terrebonne': { latitude: 45.7000, longitude: -73.6333 },
    'repentigny': { latitude: 45.7333, longitude: -73.4500 },
    'brossard': { latitude: 45.4667, longitude: -73.4500 },
    'drummondville': { latitude: 45.8833, longitude: -72.4833 }
  };
  
  const normalized = cityName.toLowerCase().trim();
  return cities[normalized] || null;
}

// ================================================================
// ENRICHISSEMENT DONNÉES MAGASINS
// ================================================================

/**
 * Trouver les magasins proches d'une localisation
 * @param {string} retailer - Nom du retailer (ex: 'walmart', 'iga')
 * @param {number} userLat - Latitude utilisateur
 * @param {number} userLon - Longitude utilisateur
 * @param {number} radiusKm - Rayon de recherche en km
 * @returns {Array} Liste des magasins triés par distance
 */
function findNearbyStores(retailer, userLat, userLon, radiusKm) {
  const stores = storeLocations[retailer] || [];
  
  const storesWithDistance = stores.map(store => {
    const distance = calculateDistance(
      userLat,
      userLon,
      store.latitude,
      store.longitude
    );
    
    return {
      ...store,
      distance: distance,
      timeEstimate: getTimeEstimate(distance)
    };
  });
  
  // Filtrer par rayon et trier par distance
  return storesWithDistance
    .filter(store => store.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance);
}

/**
 * Obtenir le magasin le plus proche
 * @param {string} retailer - Nom du retailer
 * @param {number} userLat - Latitude utilisateur
 * @param {number} userLon - Longitude utilisateur
 * @returns {object|null} Magasin le plus proche ou null
 */
function getClosestStore(retailer, userLat, userLon) {
  const nearbyStores = findNearbyStores(retailer, userLat, userLon, 999999);
  return nearbyStores.length > 0 ? nearbyStores[0] : null;
}

/**
 * Enrichir les résultats de recherche avec données magasins
 * @param {Array} results - Résultats de recherche bruts
 * @param {string} location - Nom de la ville
 * @param {number} radiusKm - Rayon de recherche
 * @returns {Array} Résultats enrichis avec données magasins
 */

function enrichWithStoreData(results, userLat, userLon, radiusKm = 50) {
  // Obtenir coordonnées ville
  // Utiliser les coordonnées fournies directement
  if (!userLat || !userLon) {
    console.log('Coordonnées manquantes');
    return results;
  }  
  return results.map(result => {
    // Déterminer le retailer key depuis le store name
    const retailerKey = getRetailerKey(result.store);
    
    if (!retailerKey) {
      return result; // Pas de retailer key, retourner tel quel
    }
    
    // Trouver magasin le plus proche
    const closestStore = getClosestStore(retailerKey, userLat, userLon);
    
    if (closestStore) {
      return {
        ...result,
        storeData: {
          id: closestStore.id,
          name: closestStore.name,
          address: closestStore.address,
          latitude: closestStore.latitude,
          longitude: closestStore.longitude,
          phone: closestStore.phone,
          hours: closestStore.hours,
          distance: closestStore.distance.toFixed(1),
          timeEstimate: closestStore.timeEstimate
        }
      };
    }
    
    return result;
  });
}

/**
 * Mapper le nom de store vers retailer key
 * @param {string} storeName - Nom du store (ex: "Walmart", "IGA")
 * @returns {string|null} Retailer key (ex: "walmart", "iga")
 */
function getRetailerKey(storeName) {
  const mapping = {
    'walmart': 'walmart',
    'iga': 'iga',
    'metro': 'metro',
    'métro': 'metro',
    'best buy': 'bestbuy',
    'bestbuy': 'bestbuy',
    'home depot': 'homedepot',
    'homedepot': 'homedepot',
    'lowe\'s': 'lowes',
    'lowes': 'lowes',
    'canadian tire': 'canadiantire',
    'canadiantire': 'canadiantire',
    'provigo': 'provigo',
    'maxi': 'maxi',
    'amazon': null, // E-commerce, pas de magasin physique
    'rona': 'rona',
    'h&m': 'hm',
    'zara': 'zara',
    'roots': 'roots'
  };
  
  const normalized = storeName.toLowerCase().trim();
  
  // Chercher correspondance exacte
  if (mapping[normalized] !== undefined) {
    return mapping[normalized];
  }
  
  // Chercher correspondance partielle
  for (const [key, value] of Object.entries(mapping)) {
    if (normalized.includes(key)) {
      return value;
    }
  }
  
  return null;
}

// ================================================================
// URL GOOGLE MAPS
// ================================================================

/**
 * Générer URL Google Maps pour navigation
 * @param {number} latitude - Latitude destination
 * @param {number} longitude - Longitude destination
 * @returns {string} URL Google Maps
 */
function getGoogleMapsURL(latitude, longitude) {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

// ================================================================
// FORMATAGE
// ================================================================

/**
 * Formater un prix en dollars canadiens
 * @param {number|string} price - Prix à formater
 * @returns {string} Prix formaté (ex: "2.99$")
 */
function formatPrice(price) {
  if (!price) return null;
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(numPrice)) return null;
  return `${numPrice.toFixed(2)}$`;
}

/**
 * Extraire le domaine source depuis une URL
 * @param {string} url - URL complète
 * @returns {string} Domaine (ex: "walmart.ca")
 */
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch (error) {
    return null;
  }
}

// ================================================================
// EXPORTS
// ================================================================

module.exports = {
  // Distance
  calculateDistance,
  getTimeEstimate,
  
  // Géolocalisation
  getCityCoordinates,
  
  // Magasins
  findNearbyStores,
  getClosestStore,
  enrichWithStoreData,
  getRetailerKey,
  
  // Google Maps
  getGoogleMapsURL,
  
  // Formatage
  formatPrice,
  extractDomain
};
