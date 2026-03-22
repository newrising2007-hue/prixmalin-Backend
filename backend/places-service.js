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

  return dealers
    .filter(d => {
      const categoryMatch = d.categories.includes(category);
      const brandMatch = brand ? d.brands.includes(brand) : true;
      return categoryMatch && brandMatch;
    })
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
function loadLocalCommerces() {
  try {
    const filePath = path.join(__dirname, 'commerces.json');
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data).commerces || [];
  } catch (error) {
    return [];
  }
}

function getMatchingCommerces(query, category, latitude, longitude, radiusKm = 45) {
  const commerces = loadLocalCommerces();
  const lowerQuery = query.toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const normalizeStr = s => s.toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/[̀-ͯ]/g, '');

  return commerces
    .filter(c => {
      const categoryMatch = category === 'divers' || c.categories.includes(category) || (category === 'electronique' && c.categories.includes('electro')) || (category === 'electro' && c.categories.includes('electronique'));
      const keywordMatch = c.keywords.some(kw => {
        const kwNorm = normalizeStr(kw);
        // Match exact : query contient le keyword ou keyword contient la query
        if (lowerQuery.includes(kwNorm) || kwNorm.includes(lowerQuery)) return true;
        // Stemming : comparer les 4 premiers caractères (ecouteur/ecouteurs/ecoute)
        if (lowerQuery.length >= 4 && kwNorm.length >= 4 && kwNorm.startsWith(lowerQuery.substring(0, 4))) return true;
        if (lowerQuery.length >= 4 && kwNorm.length >= 4 && lowerQuery.startsWith(kwNorm.substring(0, 4))) return true;
        return false;
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

    // Exclure les commerces déjà dans notre BD locale
    const allLocalNames = allLocal.map(d => d.name.toLowerCase());
    const filteredPlaces = allPlaces.filter(p =>
      !blacklist.some(b => p.name.toLowerCase().includes(b)) &&
      !allLocalNames.some(name => p.name.toLowerCase().includes(name.split(' ')[0]))
    );

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
    'harley', 'harley-davidson', 'ducati', 'triumph', 'royal enfield',
    'sea-doo', 'brp', 'lynx', 'sherco', 'gasgas', 'beta'
  ];
  const lowerQuery = query.toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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
    vehicules: "car_dealer",
    auto: "car_dealer",
    pieces: "car_repair",
    restaurants: "restaurant",
  };
  return types[category] || null;
}

function getCategoryKeywords(category) {
  const keywords = {
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
