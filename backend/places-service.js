const { Client } = require("@googlemaps/google-maps-services-js");
require('dotenv').config();

// Client Google Maps
const client = new Client({});

/**
 * Cherche des magasins locaux avec Google Places API
 */
async function searchLocalStores(query, category, latitude, longitude, radiusKm = 25) {
  try {
    const radiusMeters = radiusKm * 1000; // Convertir km en mètres
    
    // Construire la requête de recherche
    const searchQuery = `${query} ${getCategoryKeywords(category)}`;
    
    const response = await client.placesNearby({
      params: {
        location: { lat: latitude, lng: longitude },
        radius: radiusMeters,
        keyword: searchQuery,
        key: process.env.GOOGLE_PLACES_API_KEY,
      },
    });

    const places = response.data.results;
    
    // Transformer en format PrixMalin
    const stores = places.map(place => ({
      name: place.name,
      address: place.vicinity,
      latitude: place.geometry.location.lat,
      longitude: place.geometry.location.lng,
      rating: place.rating,
      distance: calculateDistance(
        latitude, 
        longitude, 
        place.geometry.location.lat, 
        place.geometry.location.lng
      ),
      hasWebsite: place.website ? true : false,
      phone: place.formatted_phone_number || null,
      placeId: place.place_id,
    }));

    // Trier par distance
    stores.sort((a, b) => a.distance - b.distance);

    return stores;
  } catch (error) {
    console.error('Erreur Google Places:', error);
    return [];
  }
}

/**
 * Obtenir détails d'un magasin (pour récupérer site web + téléphone)
 */
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

/**
 * Mots-clés par catégorie pour améliorer recherche
 */
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

/**
 * Calcul distance (formule Haversine)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Rayon terre en km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 10) / 10; // Arrondi 1 décimale
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

module.exports = {
  searchLocalStores,
  getStoreDetails,
};


