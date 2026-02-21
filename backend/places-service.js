const { Client } = require("@googlemaps/google-maps-services-js");
require('dotenv').config();

const client = new Client({});

async function searchLocalStores(query, category, latitude, longitude, radiusKm = 100) {
  try {
    const searchQuery = `${query} ${getCategoryKeywords(category)}`;

    // Phase 1 : 0-50km
    const response1 = await client.placesNearby({
      params: {
        location: { lat: latitude, lng: longitude },
        radius: 50000,
        keyword: searchQuery,
        key: process.env.GOOGLE_PLACES_API_KEY,
      },
    });

    let allPlaces = response1.data.results || [];

    // Phase 2 : 50-100km si moins de 4 résultats
    if (allPlaces.length < 4 && radiusKm > 50) {
      const response2 = await client.placesNearby({
        params: {
          location: { lat: latitude, lng: longitude },
          radius: 100000,
          keyword: searchQuery,
          key: process.env.GOOGLE_PLACES_API_KEY,
        },
      });
      const phase2 = response2.data.results || [];
      const existingIds = new Set(allPlaces.map(p => p.place_id));
      const newPlaces = phase2.filter(p => !existingIds.has(p.place_id));
      allPlaces = [...allPlaces, ...newPlaces];
    }

    const stores = allPlaces.map(place => ({
      name: place.name,
      address: place.vicinity,
      latitude: place.geometry.location.lat,
      longitude: place.geometry.location.lng,
      rating: place.rating,
      distance: calculateDistance(latitude, longitude, place.geometry.location.lat, place.geometry.location.lng),
      hasWebsite: place.website ? true : false,
      phone: place.formatted_phone_number || null,
      placeId: place.place_id,
    }));

    stores.sort((a, b) => a.distance - b.distance);
    return stores;

  } catch (error) {
    console.error('Erreur Google Places:', error);
    return [];
  }
}

async function getStoreDetails(placeId) {
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
    vehicules: 'auto parts',
    intime: 'beauty store',
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
