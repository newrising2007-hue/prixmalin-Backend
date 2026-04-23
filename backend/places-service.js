const { Client } = require("@googlemaps/google-maps-services-js");
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const client = new Client({});

// ─── DEALERS (véhicules) ────────────────────────────────────────────
function loadLocalDealers() {
  try {
    const filePath = path.join(__dirname, 'dealers.json');
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data).dealers || [];
  } catch (error) {
    return [];
  }
}

function getMatchingDealers(query, category, latitude, longitude) {
  const dealers = loadLocalDealers();
  const brand = extractVehicleBrand(query);
  const filtered = dealers.filter(d => {
    const categoryMatch = d.categories.includes(category);
    const brandMatch = brand ? d.brands.includes(brand) : true;
    return categoryMatch && brandMatch;
  });
  // Marque reconnue mais aucun dealer local → laisser Google Places trouver
  if (brand && filtered.length === 0) return [];
  return filtered
    .map(d => ({
      ...d,
      distance: calculateDistance(latitude, longitude, d.latitude, d.longitude),
      hasWebsite: !!d.website,
      placeId: null,
      fromLocalDB: true,
    }))
    .sort((a, b) => a.distance - b.distance);
}

// ─── COMMERCES GÉNÉRAUX ─────────────────────────────────────────────
function loadCategoryAliases() {
  try {
    const filePath = path.join(__dirname, 'category-aliases.json');
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch(e) { return {}; }
}

function loadLocalCommerces() {
  try {
    const filePath = path.join(__dirname, 'commerces.json');
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data).commerces || [];
  } catch (error) {
    return [];
  }
}

function getMatchingCommerces(query, category, latitude, longitude, radiusKm = 25) {
  const commerces = loadLocalCommerces();
  const lowerQuery = query.toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const normalizeStr = s => s.toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/[̀-ͯ]/g, '');

  return commerces
    .filter(c => {
      const aliases = loadCategoryAliases();
      const categoryMatch = category === 'divers' ||
        c.categories.some(cat =>
          cat === category ||
          cat.startsWith(category + '_') ||
          category.startsWith(cat + '_') ||
          (aliases[category] && aliases[category].includes(cat))
        );
      const queryWords = lowerQuery.split(/\s+/);
      const keywordMatch = c.keywords.some(kw => {
        const kwNorm = normalizeStr(kw);
        const kwWords = kwNorm.split(/\s+/);
        // Chaque mot de la query doit matcher un mot entier du keyword
        return queryWords.every(qw => {
          if (qw.length <= 2) {
            // Mots très courts (or, as...) → match exact uniquement
            return kwWords.some(kw => kw === qw);
          }
          // Mots normaux → exact ou stemming startsWith 6 chars
          return kwWords.some(kw =>
            kw === qw ||
            (qw.length >= 6 && kw.startsWith(qw.substring(0, 6))) ||
            (kw.length >= 6 && qw.startsWith(kw.substring(0, 6)))
          );
        });
      });
      const withinRadius = calculateDistance(latitude, longitude, c.latitude, c.longitude) <= radiusKm;
      return categoryMatch && keywordMatch && withinRadius;
    })
    .map(c => ({
      ...c,
      distance: calculateDistance(latitude, longitude, c.latitude, c.longitude),
      hasWebsite: !!c.website,
      placeId: null,
      fromLocalDB: true,
    }))
    .sort((a, b) => a.distance - b.distance);
}

// ─── RECHERCHE PRINCIPALE ───────────────────────────────────────────
async function searchLocalStores(query, category, latitude, longitude, radiusKm = 100) {
  try {
    // 1. Dealers véhicules (priorité absolue pour catégorie vehicules)
    const localDealers = getMatchingDealers(query, category, latitude, longitude);

    // 2. Commerces généraux manuels
    const localCommerces = getMatchingCommerces(query, category, latitude, longitude, radiusKm);

    // Fusionner sans doublons
    const localNames = new Set(localDealers.map(d => d.name.toLowerCase()));
    const uniqueCommerces = localCommerces.filter(c => !localNames.has(c.name.toLowerCase()));
    const allLocal = [...localDealers, ...uniqueCommerces];

    if (allLocal.length >= 4) {
      return allLocal;
    }

    // 3. Compléter avec Google Places si pas assez de résultats locaux
    const searchQueries = getSearchQueries(query, category);
    let allPlaces = [];

    for (const searchQuery of searchQueries) {
      if (allPlaces.length >= (4 - allLocal.length)) break;

      const response1 = await client.placesNearby({
        params: {
          location: { lat: latitude, lng: longitude },
          radius: 50000,
          keyword: searchQuery,
          ...(getGooglePlaceType(category) && { type: getGooglePlaceType(category) }),
          key: process.env.GOOGLE_PLACES_API_KEY,
        },
      });

      let phasePlaces = response1.data.results || [];

      if (phasePlaces.length < 4 && radiusKm > 50) {
        const response2 = await client.placesNearby({
          params: {
            location: { lat: latitude, lng: longitude },
            radius: 100000,
            keyword: searchQuery,
          ...(getGooglePlaceType(category) && { type: getGooglePlaceType(category) }),
            key: process.env.GOOGLE_PLACES_API_KEY,
          },
        });
        const phase2 = response2.data.results || [];
        const existingIds = new Set(phasePlaces.map(p => p.place_id));
        phasePlaces = [...phasePlaces, ...phase2.filter(p => !existingIds.has(p.place_id))];
      }

      const existingIds = new Set(allPlaces.map(p => p.place_id));
      allPlaces = [...allPlaces, ...phasePlaces.filter(p => !existingIds.has(p.place_id))];
    }

    // Exclure par mots blacklistés selon catégorie
    const BLACKLIST = {
      epicerie: ["bmr", "rona", "home hardware", "canadian tire", "quincaillerie", "hardware", "dépanneur", "depanneur", "restaurant", "bar", "taverne"],
      boucherie: ["restaurant", "bar", "pizza", "sushi", "dépanneur", "depanneur", "canadian tire", "bmr"],
      quincaillerie: ["restaurant", "bar", "épicerie", "epicerie", "grocery"],
      sante: ["restaurant", "bar", "quincaillerie", "hardware"],
    };
    const blacklist = (BLACKLIST[category] || []).map(b => b.toLowerCase());

    // Types Google Places à exclure selon la catégorie
    const EXCLUDED_TYPES = {
      epicerie:     ["restaurant", "cafe", "bar", "night_club", "bakery", "meal_takeaway", "meal_delivery"],
      boucherie:    ["restaurant", "cafe", "bar", "night_club", "meal_takeaway", "meal_delivery"],
      quincaillerie:["restaurant", "cafe", "bar", "night_club", "grocery_or_supermarket", "supermarket"],
      sante:        ["restaurant", "cafe", "bar", "night_club"],
      electro:      ["restaurant", "cafe", "bar", "night_club"],
      pieces:       ["restaurant", "cafe", "bar", "night_club"],
      vehicules:    ["restaurant", "cafe", "bar", "night_club"],
    };
    const excludedTypes = (EXCLUDED_TYPES[category] || []);

    // Exclure les commerces déjà dans notre BD locale
    const allLocalNames = allLocal.map(d => d.name.toLowerCase());
    const filteredPlaces = allPlaces.filter(p => {
      const placeTypes = p.types || [];
      const hasExcludedType = excludedTypes.some(t => placeTypes.includes(t));
      const hasBlacklistedName = blacklist.some(b => p.name.toLowerCase().includes(b));
      const isDuplicate = allLocalNames.some(name => p.name.toLowerCase().includes(name.split(' ')[0]));
      return !hasExcludedType && !hasBlacklistedName && !isDuplicate;
    });

    const googleStores = filteredPlaces.map(place => ({
      name: place.name,
      address: place.vicinity,
      latitude: place.geometry.location.lat,
      longitude: place.geometry.location.lng,
      rating: place.rating,
      distance: calculateDistance(latitude, longitude, place.geometry.location.lat, place.geometry.location.lng),
      hasWebsite: false,
      phone: null,
      placeId: place.place_id,
      fromLocalDB: false,
    }));

    googleStores.sort((a, b) => a.distance - b.distance);

    return [...allLocal, ...googleStores];

  } catch (error) {
    console.error('Erreur Google Places:', error);
    return [
      ...getMatchingDealers(query, category, latitude, longitude),
      ...getMatchingCommerces(query, category, latitude, longitude, radiusKm),
    ];
  }
}

async function getStoreDetails(placeId, fromLocalDB = false, dealerData = null) {
  if (fromLocalDB && dealerData) {
    return {
      website: dealerData.website || null,
      phone: dealerData.phone || null,
    };
  }

  if (!placeId) return { website: null, phone: null };

  try {
    const response = await client.placeDetails({
      params: {
        place_id: placeId,
        fields: ['website', 'formatted_phone_number'],
        key: process.env.GOOGLE_PLACES_API_KEY,
      },
    });
    return {
      website: response.data.result.website || null,
      phone: response.data.result.formatted_phone_number || null,
    };
  } catch (error) {
    console.error('Erreur détails magasin:', error);
    return { website: null, phone: null };
  }
}

function getSearchQueries(query, category) {
  if (category === 'vehicules') {
    const brand = extractVehicleBrand(query);
    const queries = [];
    if (brand) {
      queries.push(`concessionnaire ${brand}`);
      queries.push(`${brand} dealer moto`);
    }
    queries.push(`${query} concessionnaire`);
    queries.push(`moto dealer`);
    return queries;
  }
  if (category === 'pieces') {
    return [
      `${query} auto parts`,
      `${query} pièces automobile`,
      'canadian tire auto parts',
      'napa auto parts',
    ];
  }
  return [`${query} ${getCategoryKeywords(category)}`];
}

function extractVehicleBrand(query) {
  const brands = [
    'yamaha', 'honda', 'kawasaki', 'suzuki', 'ktm', 'husqvarna',
    'arctic cat', 'ski-doo', 'bombardier', 'polaris', 'can-am',
    'ford', 'toyota', 'chevrolet', 'gmc', 'dodge', 'jeep',
    'bmw', 'mercedes', 'audi', 'volkswagen', 'hyundai', 'kia',
    'nissan', 'mazda', 'subaru', 'mitsubishi', 'honda',
    'harley', 'harley-davidson', 'ducati', 'triumph', 'royal enfield',
    'sea-doo', 'brp', 'lynx', 'sherco', 'gasgas', 'beta'
  ];
  // Modèles → marque
  const modelMap = {
    'f-150': 'ford', 'f150': 'ford', 'f-250': 'ford', 'f250': 'ford',
    'f-350': 'ford', 'f350': 'ford', 'ranger': 'ford', 'escape': 'ford',
    'explorer': 'ford', 'expedition': 'ford', 'maverick': 'ford',
    'mustang': 'ford', 'bronco': 'ford', 'edge': 'ford',
    'silverado': 'chevrolet', 'colorado': 'chevrolet', 'tahoe': 'chevrolet',
    'suburban': 'chevrolet', 'equinox': 'chevrolet', 'traverse': 'chevrolet',
    'sierra': 'gmc', 'yukon': 'gmc', 'canyon': 'gmc', 'acadia': 'gmc',
    'ram': 'dodge', 'durango': 'dodge', 'challenger': 'dodge', 'charger': 'dodge',
    'wrangler': 'jeep', 'grand cherokee': 'jeep', 'compass': 'jeep',
    'tucson': 'hyundai', 'santa fe': 'hyundai', 'elantra': 'hyundai',
    'cx-5': 'mazda', 'cx5': 'mazda', 'cx-50': 'mazda',
    'rogue': 'nissan', 'pathfinder': 'nissan', 'frontier': 'nissan',
    'tacoma': 'toyota', 'tundra': 'toyota', 'rav4': 'toyota', 'highlander': 'toyota',
    'mxz': 'ski-doo', 'summit': 'ski-doo', 'renegade': 'ski-doo', 'skandic': 'ski-doo',
    'backcountry': 'ski-doo', 'expedition': 'ski-doo', 'tundra': 'ski-doo',
    'outlander': 'can-am', 'defender': 'can-am', 'spyder': 'can-am', 'maverick': 'can-am',
    'rzr': 'polaris', 'sportsman': 'polaris', 'ranger polaris': 'polaris', 'general': 'polaris',
    'grizzly': 'yamaha', 'raptor': 'yamaha', 'kodiak': 'yamaha', 'wolverine': 'yamaha',
    'sidewinder': 'yamaha', 'viper': 'yamaha', 'sr viper': 'yamaha',
    'fx': 'yamaha', 'waverunner': 'yamaha',
    'alterra': 'arctic cat', 'wildcat': 'arctic cat', 'zr': 'arctic cat',
    'xf': 'arctic cat', 'bearcat': 'arctic cat',
    'spark': 'sea-doo', 'gti': 'sea-doo', 'gtx': 'sea-doo', 'rxp': 'sea-doo',
    'rxt': 'sea-doo', 'fish pro': 'sea-doo',
    'cfmoto': 'cfmoto', 'cforce': 'cfmoto', 'zforce': 'cfmoto', 'uforce': 'cfmoto',
  };
  const lowerQuery = query.toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Vérifier modèles en premier
  for (const [model, brand] of Object.entries(modelMap)) {
    if (lowerQuery.includes(model)) return brand;
  }
  return brands.find(b => lowerQuery.includes(b.replace('-', ' ')) || lowerQuery.includes(b)) || null;
}

function getGooglePlaceType(category) {
  const types = {
    epicerie: "supermarket",
    boucherie: "bakery",
    quincaillerie: "hardware_store",
    sante: "pharmacy",
    animaux: "pet_store",
    sport: "sporting_goods_store",
    electro: "electronics_store",
    electromenager: "home_goods_store",
    maison: "furniture_store",
    meuble: "furniture_store",
    vetements: "clothing_store",
    mode: "clothing_store",
    renovation: "hardware_store",
    loisirs: "book_store",
    beaute: "beauty_salon",
    bijoux: "jewelry_store",
    vehicules: "car_dealer",
    auto: "car_dealer",
    pieces: "car_repair",
    restaurants: "restaurant",
  };
  return types[category] || null;
}

function getCategoryKeywords(category) {
  const keywords = {
    bijoux: "jewelry store bijouterie or argent",
    boucherie: "butcher boucherie viande meat shop",
    epicerie: "grocery supermarket épicerie alimentation food store",
    electro: 'electronics store',
    vetements: 'clothing store Aubainerie Giant Tiger Winners',
    quincaillerie: 'hardware store',
    loisirs: 'bookstore toy store',
    animaux: 'pet store',
    sante: 'pharmacy drugstore',
    sport: 'sporting goods',
    vehicules: 'auto dealer moto',
    intime: 'beauty store',
    pieces: 'auto parts store',
  };
  return keywords[category] || '';
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

module.exports = {
  searchLocalStores,
  getStoreDetails,
};
