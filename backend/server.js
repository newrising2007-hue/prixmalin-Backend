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
      query,
      category,
      userLocation.latitude,
      userLocation.longitude,
      radiusKm
    );

    const enrichedStores = await Promise.all(
      localStores.slice(0, 4).map(async (store) => {
        // Dealers confirmés : pas besoin d'appeler Google Places
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

    // 3. RÈGLE DES 8
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
