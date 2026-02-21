require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { searchLocalStores, getStoreDetails } = require('./places-service');
const { getAmazonProducts } = require('./amazon-service');
const { getWalmartProducts } = require('./walmart-service');
const app = express();
const PORT = process.env.PORT || 10000;
app.use(cors());
app.use(express.json());

// Images officielles par marque - URLs PNG directes fiables pour React Native
const BRAND_LOGOS = {
  'yamaha':      'https://via.placeholder.com/320x160/CC0000/FFFFFF?text=Yamaha',
  'suzuki':      'https://via.placeholder.com/320x160/003087/FFFFFF?text=Suzuki',
  'arctic cat':  'https://via.placeholder.com/320x160/003087/FFFFFF?text=Arctic+Cat',
  'ski-doo':     'https://via.placeholder.com/320x160/FFD700/000000?text=Ski-Doo',
  'can-am':      'https://via.placeholder.com/320x160/FF0000/FFFFFF?text=Can-Am',
  'sea-doo':     'https://via.placeholder.com/320x160/0066CC/FFFFFF?text=Sea-Doo',
  'honda':       'https://via.placeholder.com/320x160/CC0000/FFFFFF?text=Honda',
  'kawasaki':    'https://via.placeholder.com/320x160/00A651/FFFFFF?text=Kawasaki',
  'ktm':         'https://via.placeholder.com/320x160/FF6600/FFFFFF?text=KTM',
  'polaris':     'https://via.placeholder.com/320x160/003087/FFFFFF?text=Polaris',
  'cfmoto':      'https://via.placeholder.com/320x160/CC0000/FFFFFF?text=CFMOTO',
  'lynx':        'https://via.placeholder.com/320x160/FFD700/000000?text=Lynx',
  'husqvarna':   'https://via.placeholder.com/320x160/0000CD/FFFFFF?text=Husqvarna',
  'ford':        'https://via.placeholder.com/320x160/003087/FFFFFF?text=Ford',
  'toyota':      'https://via.placeholder.com/320x160/CC0000/FFFFFF?text=Toyota',
  'default':     'https://via.placeholder.com/320x160/1A1A2E/FFFFFF?text=Vehicule',
};

// Images marketplace fiables
const FACEBOOK_IMG = 'https://via.placeholder.com/320x160/1877F2/FFFFFF?text=Facebook+Marketplace';
const KIJIJI_IMG   = 'https://via.placeholder.com/320x160/FF6600/FFFFFF?text=Kijiji';

function getBrandLogo(query, brands = []) {
  const lowerQuery = query.toLowerCase();
  // Cherche dans les marques du dealer d'abord
  for (const brand of brands) {
    if (BRAND_LOGOS[brand]) return BRAND_LOGOS[brand];
  }
  // Sinon cherche dans la requête
  for (const [brand, logo] of Object.entries(BRAND_LOGOS)) {
    if (lowerQuery.includes(brand)) return logo;
  }
  return BRAND_LOGOS['default'];
}

function getMarketplaceLinks(query) {
  const encodedQuery = encodeURIComponent(query);
  return {
    facebookUrl: `https://www.facebook.com/marketplace/search/?query=${encodedQuery}`,
    kijijiUrl: `https://www.kijiji.ca/b-search.html?keywords=${encodedQuery}`,
  };
}

function isVehicleCategory(category) {
  return category === 'vehicules';
}

app.post('/api/search-prices', async (req, res) => {
  try {
    const { query, category, location, radiusKm = 100 } = req.body;
    const userLocation = {
      latitude: location?.latitude || 45.5017,
      longitude: location?.longitude || -73.5673
    };

    // 1. RECHERCHE LOCALE
    const localStores = await searchLocalStores(
      query, category,
      userLocation.latitude, userLocation.longitude,
      radiusKm
    );

    const enrichedStores = await Promise.all(
      localStores.slice(0, 4).map(async (store) => {
        const details = await getStoreDetails(
          store.placeId,
          store.fromLocalDB || false,
          store.fromLocalDB ? store : null
        );
        return {
          ...store,
          website: details.website,
          phone: details.phone,
          type: details.website ? 'local_with_website' : 'local_no_website',
        };
      })
    );

    const withWebsite = enrichedStores.filter(s => s.type === 'local_with_website').slice(0, 2);
    const withoutWebsite = enrichedStores.filter(s => s.type === 'local_no_website').slice(0, 2);

    // 2. PRODUITS ONLINE
    let onlineResults = [];

    if (isVehicleCategory(category)) {
      const { facebookUrl, kijijiUrl } = getMarketplaceLinks(query);

      onlineResults = [
        {
          product_name: `${query} - Usagé sur Facebook Marketplace`,
          price: null,
          store: 'Facebook Marketplace',
          website: facebookUrl,
          affiliate_url: facebookUrl,
          image_url: FACEBOOK_IMG,
          type: 'marketplace',
          badge: 'USAGÉ',
          badge_color: '#1877F2',
        },
        {
          product_name: `${query} - Usagé sur Kijiji`,
          price: null,
          store: 'Kijiji',
          website: kijijiUrl,
          affiliate_url: kijijiUrl,
          image_url: KIJIJI_IMG,
          type: 'marketplace',
          badge: 'USAGÉ',
          badge_color: '#FF6600',
        },
      ];
    } else {
      const amazonProducts = getAmazonProducts(query, category, 4);
      const walmartProducts = getWalmartProducts(query, category);
      onlineResults = [...amazonProducts, ...walmartProducts];
    }

    // 3. RÈGLE DES 8 — avec image_url
    const results = [
      ...withWebsite.map(store => ({
        product_name: `${query} - ${store.name}`,
        price: null,
        store: store.name,
        address: store.address,
        distance: `${store.distance} km`,
        phone: store.phone,
        website: store.website,
        latitude: store.latitude,
        longitude: store.longitude,
        type: 'local_with_website',
        rating: store.rating,
        verified: store.fromLocalDB || false,
        image_url: getBrandLogo(query, store.brands || []),
      })),
      ...withoutWebsite.map(store => ({
        product_name: `${query} - ${store.name}`,
        price: null,
        store: store.name,
        address: store.address,
        distance: `${store.distance} km`,
        phone: store.phone,
        website: null,
        latitude: store.latitude,
        longitude: store.longitude,
        type: 'local_no_website',
        rating: store.rating,
        verified: store.fromLocalDB || false,
        image_url: getBrandLogo(query, store.brands || []),
      })),
      ...onlineResults,
    ];

    return res.json({
      success: true,
      count: results.length,
      results: results,
      breakdown: {
        local_with_website: withWebsite.length,
        local_no_website: withoutWebsite.length,
        online: onlineResults.length,
      }
    });

  } catch (error) {
    console.error('Erreur recherche:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'PrixMalin Backend v5 - Affiliation' });
});

app.listen(PORT, () => {
  console.log('========================================');
  console.log('🚀 PRIXMALIN BACKEND V5 - AFFILIATION');
  console.log('========================================');
  console.log(`✅ Serveur sur port ${PORT}`);
  console.log('========================================');
});
