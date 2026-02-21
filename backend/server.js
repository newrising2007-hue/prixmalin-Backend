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
app.post('/api/search-prices', async (req, res) => {
  try {
    const { query, category, location, radiusKm = 100 } = req.body;
    const userLocation = {
      latitude: location?.latitude || 45.5017,
      longitude: location?.longitude || -73.5673
    };
    // 1. RECHERCHE LOCALE (Google Places)
    const localStores = await searchLocalStores(
      query,
      category,
      userLocation.latitude,
      userLocation.longitude,
      radiusKm
    );
    const enrichedStores = await Promise.all(
      localStores.slice(0, 4).map(async (store) => {
        const details = await getStoreDetails(store.placeId);
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
    // 2. PRODUITS ONLINE (Amazon + Walmart)
    const amazonProducts = getAmazonProducts(query, category, 4);
    const walmartProducts = getWalmartProducts(query, category);
    const onlineResults = [...amazonProducts, ...walmartProducts];
    // 3. COMBINER (Règle des 8)
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
    return res.status(500).json({
      success: false,
      error: error.message
    });
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
