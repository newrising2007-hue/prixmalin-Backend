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

// Images officielles par marque
const BRAND_LOGOS = {
  'yamaha':      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Yamaha_Motor_logo.svg/320px-Yamaha_Motor_logo.svg.png',
  'suzuki':      'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Suzuki_logo_2.svg/320px-Suzuki_logo_2.svg.png',
  'arctic cat':  'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/Arctic_Cat_logo.svg/320px-Arctic_Cat_logo.svg.png',
  'ski-doo':     'https://upload.wikimedia.org/wikipedia/en/thumb/6/6e/Ski-Doo_logo.svg/320px-Ski-Doo_logo.svg.png',
  'can-am':      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Can-Am_logo.svg/320px-Can-Am_logo.svg.png',
  'sea-doo':     'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Sea-Doo_logo.svg/320px-Sea-Doo_logo.svg.png',
  'honda':       'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Honda_Logo.svg/320px-Honda_Logo.svg.png',
  'kawasaki':    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Kawasaki_logo.svg/320px-Kawasaki_logo.svg.png',
  'ktm':         'https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/KTM-logo.svg/320px-KTM-logo.svg.png',
  'polaris':     'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Polaris_Industries_logo.svg/320px-Polaris_Industries_logo.svg.png',
  'cfmoto':      'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/CFMOTO_logo.svg/320px-CFMOTO_logo.svg.png',
  'lynx':        'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Ski-Doo_logo.svg/320px-Ski-Doo_logo.svg.png',
  'husqvarna':   'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Husqvarna_logo.svg/320px-Husqvarna_logo.svg.png',
  'ford':        'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Ford_logo_flat.svg/320px-Ford_logo_flat.svg.png',
  'toyota':      'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Toyota_carlogo.svg/320px-Toyota_carlogo.svg.png',
  'default':     'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/No_image_available.svg/320px-No_image_available.svg.png',
};

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
      const amazonProducts = getAmazonProducts(query, category, 2);
      const { facebookUrl, kijijiUrl } = getMarketplaceLinks(query);

      onlineResults = [
        ...amazonProducts,
        {
          product_name: `${query} - Usagé sur Facebook Marketplace`,
          price: null,
          store: 'Facebook Marketplace',
          website: facebookUrl,
          affiliate_url: facebookUrl,
          image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Facebook_Logo_%282019%29.png/600px-Facebook_Logo_%282019%29.png',
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
          image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Kijiji_logo.svg/320px-Kijiji_logo.svg.png',
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
