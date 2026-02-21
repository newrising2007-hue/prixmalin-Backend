const { Client } = require("@googlemaps/google-maps-services-js");
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const client = new Client({});

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

async function searchLocalStores(query, category, latitude, longitude, radiusKm = 100) {
  try {
    const localDealers = getMatchingDealers(query, category, latitude, longitude);

    if (localDealers.length >= 4) {
      return localDealers;
    }

    const searchQueries = getSearchQueries(query, category);
    let allPlaces = [];

    for (const searchQuery of searchQueries) {
      if (allPlaces.length >= (4 - localDealers.length)) break;

      const response1 = await client.placesNearby({
        params: {
          location: { lat: latitude, lng: longitude },
          radius: 50000,
          keyword: searchQuery,
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

    const localNames = localDealers.map(d => d.name.toLowerCase());
    const filteredPlaces = allPlaces.filter(p =>
      !localNames.some(name => p.name.toLowerCase().includes(name.split(' ')[0]))
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

    return [...localDealers, ...googleStores];

  } catch (error) {
    console.error('Erreur Google Places:', error);
    return getMatchingDealers(query, category, latitude, longitude);
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
  const lowerQuery = query.toLowerCase();
  return brands.find(b => lowerQuery.includes(b.replace('-', ' ')) || lowerQuery.includes(b)) || null;
}

function getCategoryKeywords(category) {
  const keywords = {
    epicerie: 'grocery supermarket',
    electro: 'electronics store',
    vetements: 'clothing store',
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
