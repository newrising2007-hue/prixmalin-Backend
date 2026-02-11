// ================================================================
// PRIXMALIN v5.0 - Backend Server
// Concept Hybride: API (prix affichés) + Scraping (liens seulement)
// ================================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const Redis = require('ioredis');

// Modules locaux
const {
  SOURCE_CONFIG,
  CATEGORY_SOURCES,
  getCategorySources,
  getAPISources,
  getScrapingSources,
  shouldDisplayPrice,
  hasPhysicalStores,
  getAffiliateProgram,
  getSourceConfig
} = require('./source-config');

const {
  calculateDistance,
  getTimeEstimate,
  getCityCoordinates,
  findNearbyStores,
  getClosestStore,
  enrichWithStoreData,
  getRetailerKey,
  getGoogleMapsURL,
  formatPrice,
  extractDomain
} = require('./utils');

// ================================================================
// CONFIGURATION
// ================================================================

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Anthropic Claude API
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Redis Cloud (Upstash) - Cache persistant
let redisClient = null;
try {
  redisClient = new Redis(process.env.REDIS_URL, {
    tls: {},
    maxRetriesPerRequest: 3
  });
  
  redisClient.on('connect', () => {
    console.log('✅ Redis Cloud connecté');
  });
  
  redisClient.on('error', (err) => {
    console.error('❌ Erreur Redis:', err.message);
  });
} catch (error) {
  console.error('❌ Impossible d\'initialiser Redis:', error.message);
}

// Cache Map local (fallback)
const localCache = new Map();
const MAX_CACHE_SIZE = 100;

// ================================================================
// FONCTIONS CACHE (Dual Layer: Redis + Map)
// ================================================================

async function cacheGet(key) {
  // Essayer Redis d'abord
  if (redisClient) {
    try {
      const data = await redisClient.get(key);
      if (data) {
        console.log(`✅ Cache hit (Redis): ${key}`);
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Erreur Redis get:', error.message);
    }
  }
  
  // Fallback sur Map local
  const cached = localCache.get(key);
  if (cached) {
    const now = Date.now();
    if (now < cached.expiry) {
      console.log(`✅ Cache hit (Map): ${key}`);
      return cached.data;
    } else {
      localCache.delete(key);
    }
  }
  
  return null;
}

async function cacheSet(key, data) {
  const TTL_SECONDS = 3600; // 1 heure
  
  // Sauvegarder dans Redis
  if (redisClient) {
    try {
      await redisClient.set(key, JSON.stringify(data), 'EX', TTL_SECONDS);
      console.log(`💾 Cache saved (Redis): ${key}`);
    } catch (error) {
      console.error('Erreur Redis set:', error.message);
    }
  }
  
  // Sauvegarder aussi dans Map (backup)
  if (localCache.size >= MAX_CACHE_SIZE) {
    const firstKey = localCache.keys().next().value;
    localCache.delete(firstKey);
  }
  
  localCache.set(key, {
    data: data,
    expiry: Date.now() + (TTL_SECONDS * 1000)
  });
  
  console.log(`💾 Cache saved (Map): ${key}`);
}

// ================================================================
// FONCTION APPEL CLAUDE API (avec retry 429)
// ================================================================

async function callClaudeAPI(prompt, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }]
      });
      
      const textContent = response.content.find(c => c.type === 'text');
      return textContent ? textContent.text : '';
      
    } catch (error) {
      if (error.status === 429 && attempt < maxRetries) {
        const delay = attempt === 1 ? 5000 : attempt === 2 ? 15000 : 30000;
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}

// ================================================================
// ROUTING INTELLIGENT: API vs SCRAPING
// ================================================================

/**
 * Rechercher produits via sources API (prix fiables)
 */
async function searchViaAPI(query, category) {
  // TEMPORAIRE: Forcer mock data pour tester UI
  return getMockData(category, query);
  const apiSources = getAPISources(category);
  
  if (apiSources.length === 0) {
    return [];
  }
  
  // Pour la v5.0, on utilise encore Claude pour simuler les APIs
  // En Phase 2.5, on remplacera par de vraies APIs
  const prompt = `
Recherche de produits "${query}" dans la catégorie ${category}.
Sources avec API (prix fiables à afficher): ${apiSources.join(', ')}

Pour chaque produit trouvé, retourne en JSON:
{
  "products": [
    {
      "product_name": "Nom exact du produit",
      "price": "2.99",
      "store": "Walmart",
      "url": "URL directe vers la page produit",
      "image_url": "URL de l'image produit",
      "availability": "en stock"
    }
  ]
}

IMPORTANT:
- Retourne les VRAIS prix (sources API fiables)
- Maximum 3 produits par source
- Format JSON strict, pas de texte avant/après
`;

  const response = await callClaudeAPI(prompt);
  const parsed = parseClaudeResponse(response);
  
  if (parsed && parsed.products && parsed.products.length > 0) {
    return parsed.products.map(p => ({
      ...p,
      sourceType: 'api',
      displayPrice: true
    }));
  }
  
  // Fallback: Mock data si Claude ne retourne rien
  console.log('⚠️ searchViaAPI: Pas de résultats Claude - Utilisation MOCK DATA');
  const mockProducts = getMockData(category, query);
  if (mockProducts.length > 0) {
    return mockProducts.map(p => ({
      ...p,
      sourceType: 'api',
      displayPrice: true
    }));
  }
  
  
  return [];
}

/**
 * Rechercher produits via scraping (liens seulement, PAS de prix)
 */
async function searchViaScraping(query, category) {
  // TEMPORAIRE: Forcer mock data pour tester UI
  return getMockData(category, query);
  const scrapingSources = getScrapingSources(category);
  
  if (scrapingSources.length === 0) {
    return [];
  }
  
  const prompt = `
Recherche de produits "${query}" dans la catégorie ${category}.
Sources scraping (liens seulement): ${scrapingSources.join(', ')}

Pour chaque produit trouvé, retourne en JSON:
{
  "products": [
    {
      "product_name": "Nom exact du produit",
      "store": "IGA",
      "url": "URL directe vers la page produit",
      "image_url": "URL de l'image produit",
      "availability": "en stock"
    }
  ]
}

CRITIQUE:
- NE RETOURNE PAS LES PRIX (sources scraping non fiables)
- Seulement les liens vers les produits
- Maximum 2 produits par source
- Format JSON strict, pas de texte avant/après
`;

  const response = await callClaudeAPI(prompt);
  const parsed = parseClaudeResponse(response);
  
  if (parsed && parsed.products) {
    return parsed.products.map(p => ({
      ...p,
      price: null, // Pas de prix pour scraping
      sourceType: 'scraping',
      displayPrice: false
    }));
  }
  
  

  // Fallback: Mock data si Claude ne retourne rien

  console.log('⚠️ searchViaScraping: Pas de résultats Claude - Utilisation MOCK DATA');

  const mockProducts = getMockData(category, query);

  if (mockProducts.length > 0) {

    return mockProducts.map(p => ({

      ...p,

      price: null,

      sourceType: 'scraping',

      displayPrice: false

    }));

  }


  return [];
}

/**
 * Parser la réponse Claude (JSON)
 */
function parseClaudeResponse(text, category, query) {
  try {
    // Si Claude refuse ou répond en texte
    if (text.toLowerCase().includes('je ne peux') || 
    text.toLowerCase().includes('i cannot') ||
    text.toLowerCase().includes('désolé')) {
  console.log('⚠️ Claude a refusé - Utilisation MOCK DATA');
  const mockProducts = getMockData(category, query);
  if (mockProducts.length > 0) {
    return { products: mockProducts };
  }
  return { products: [] };
}    
    // Nettoyer le texte (enlever markdown, etc.)
    let clean = text.trim();
    clean = clean.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    
    const parsed = JSON.parse(clean);
    return parsed;
  } catch (error) {
    console.error('Erreur parsing JSON:', error.message);
    console.error('Texte reçu:', text.substring(0, 200));
    
    // Fallback: Mock data en cas d'erreur parsing
    console.log('⚠️ Erreur parsing - Utilisation MOCK DATA');
    const mockProducts = getMockData(category, query);
    if (mockProducts.length > 0) {
      return { products: mockProducts };
    }
    return { products: [] };
  }
}
// ================================================================
// ENDPOINT PRINCIPAL: /api/search-prices
// ================================================================


// ============================================================================
// 📦 MOCK DATA - Données temporaires pour tester UI mobile v5.0
// ============================================================================

const MOCK_PRODUCTS = {
  epicerie: [
    {
      product_name: "Pain Wonder Blanc 675g",
      price: "2.99",
      store: "Walmart",
      url: "https://www.walmart.ca/fr/ip/pain-blanc-wonder/6000016934567",
      image_url: "https://i5.walmartimages.ca/images/Large/165/346/6000016934567.jpg",
      source: "walmart"
    },
    {
      product_name: "Lait 2% Natrel 2L",
      price: "4.49",
      store: "Metro",
      url: "https://www.metro.ca/epicerie",
      image_url: "https://product-images.metro.ca/images/h0b/h3c/10324821925918.jpg",
      source: "metro"
    },
    {
      product_name: "Oeufs Gros Calibre 12un",
      price: "3.99",
      store: "IGA",
      url: "https://www.iga.net/fr/produit/oeufs",
      image_url: "https://assets.iga.net/images/products/oeufs.jpg",
      source: "iga"
    }
  ],
  electro: [
    {
      product_name: "iPhone 15 Pro 128GB",
      price: "1399.00",
      store: "Best Buy",
      url: "https://www.bestbuy.ca/fr-ca/produit/iphone-15-pro",
      image_url: "https://multimedia.bbycastatic.ca/multimedia/products/500x500/179/17912/17912345.jpg",
      source: "bestbuy"
    },
    {
      product_name: "MacBook Air M3 13pouces",
      price: "1449.00",
      store: "Best Buy",
      url: "https://www.bestbuy.ca/fr-ca/produit/macbook-air-m3",
      image_url: "https://multimedia.bbycastatic.ca/multimedia/products/500x500/180/18045/18045123.jpg",
      source: "bestbuy"
    }
  ],
  vetements: [
    {
      product_name: "T-Shirt Coton Homme",
      price: "19.99",
      store: "Old Navy",
      url: "https://oldnavy.gapcanada.ca/browse/product.do?pid=123456",
      image_url: "https://oldnavy.gap.com/webcontent/tshirt.jpg",
      source: "oldnavy"
    }
  ],
  intime: [
    {
      product_name: "Caleçons Boxer Calvin Klein 3-Pack",
      price: "44.99",
      store: "The Bay",
      url: "https://www.thebay.com/product/calvin-klein-boxer-briefs",
      image_url: "https://s7d2.scene7.com/is/image/TheBay/boxer-pack",
      source: "thebay"
    }
  ],
  quincaillerie: [
    {
      product_name: "Perceuse Sans-Fil DeWalt 20V",
      price: "179.99",
      store: "Home Depot",
      url: "https://www.homedepot.ca/produit/dewalt-perceuse-20v",
      image_url: "https://homedepot.scene7.com/is/image/homedepotcanada/dewalt-drill",
      source: "homedepot"
    },
    {
      product_name: "Marteau 16oz Stanley",
      price: "24.99",
      store: "Canadian Tire",
      url: "https://www.canadiantire.ca/fr/pdp/marteau-stanley.html",
      image_url: "https://canadiantire.scene7.com/is/image/CanadianTire/hammer",
      source: "canadiantire"
    }
  ]
};

function enrichMockDataWithConfig(products, category) {
  return products.map(product => {
    const config = getSourceConfig(product.source) || {
      type: 'scraping',
      displayPrice: false,
      hasPhysicalStores: true,
      affiliateProgram: null
    };
    return { ...product, category, config };
  });
}

function getMockData(category, query) {
  console.log('🔍 getMockData appelé - category:', category, 'query:', query);
  console.log('🔍 MOCK_PRODUCTS keys:', Object.keys(MOCK_PRODUCTS));
  const categoryProducts = MOCK_PRODUCTS[category] || [];
  console.log('🔍 categoryProducts.length:', categoryProducts.length);
  const enrichedProducts = enrichMockDataWithConfig(categoryProducts, category);
  console.log('🔍 enrichedProducts.length:', enrichedProducts.length);
  if (query && query.trim() !== '') {
    const queryLower = query.toLowerCase();
    return enrichedProducts.filter(p => 
      p.product_name.toLowerCase().includes(queryLower)
    );
  }
  return enrichedProducts;
}


app.post('/api/search-prices', async (req, res) => {
  try {
    const { query, category, location } = req.body;
const radiusKm = req.body.radiusKm || 50;    
    // Validation
    if (!query || !category || !location) {
      return res.status(400).json({
        success: false,
        error: 'Paramètres manquants: query, category, location'
      });
    }
    
    // Extraire latitude/longitude de l'objet location
    const latitude = location.latitude;
const longitude = location.longitude;
    
    // Vérifier cache
    const cacheKey = `v3:search:${query}:${category}:${latitude},${longitude}:${radiusKm}`;
    const cached = await cacheGet(cacheKey);
    
    if (cached) {
      return res.json({
        success: true,
        cached: true,
        results: cached
      });
    }
    
    console.log(`🔍 Recherche: "${query}" | ${category} | ${location} | ${radiusKm}km`);
    
    // Recherche parallèle: API + Scraping
    const [apiResults, scrapingResults] = await Promise.all([
      searchViaAPI(query, category),
      searchViaScraping(query, category)
    ]);
    
    // Combiner résultats
    let allResults = [...(apiResults || []), ...(scrapingResults || [])];
    
    // Enrichir avec données magasins
    allResults = enrichWithStoreData(allResults, latitude, longitude, radiusKm);
    
    // Ajouter config source à chaque résultat
    allResults = allResults.map(result => {
      const domain = extractDomain(result.url) || result.store.toLowerCase() + '.ca';
      const config = getSourceConfig(domain) || {};
      
      return {
        ...result,
        config: {
          type: config.type || result.sourceType,
          hasPhysicalStores: config.hasPhysicalStores !== undefined ? config.hasPhysicalStores : true,
          displayPrice: config.displayPrice !== undefined ? config.displayPrice : result.displayPrice,
          affiliateProgram: config.affiliateProgram || null
        }
      };
    });
    
    // Filtrer résultats vides
    allResults = allResults.filter(r => r.product_name && r.url);
    
    // Trier: API d'abord (avec prix), puis scraping
    allResults.sort((a, b) => {
      if (a.config.displayPrice && !b.config.displayPrice) return -1;
      if (!a.config.displayPrice && b.config.displayPrice) return 1;
      
      // Si même type, trier par distance
      const distA = a.storeData ? parseFloat(a.storeData.distance) : 999;
      const distB = b.storeData ? parseFloat(b.storeData.distance) : 999;
      return distA - distB;
    });
    
    // Sauvegarder en cache
    await cacheSet(cacheKey, allResults);
    
    res.json({
      success: true,
      cached: false,
      count: allResults.length,
      results: allResults
    });
    
  } catch (error) {
    console.error('❌ Erreur search-prices:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ================================================================
// ENDPOINT HEALTH CHECK
// ================================================================

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    version: '5.0.0',
    timestamp: new Date().toISOString(),
    cache: {
      redis: redisClient ? redisClient.status === 'ready' : false,
      mapSize: localCache.size
    },
    categories: Object.keys(CATEGORY_SOURCES).length,
    sources: {
      total: Object.keys(SOURCE_CONFIG).length,
      api: Object.values(SOURCE_CONFIG).filter(s => s.type === 'api').length,
      scraping: Object.values(SOURCE_CONFIG).filter(s => s.type === 'scraping').length
    }
  });
});

// ================================================================
// ENDPOINT STATS
// ================================================================

app.get('/api/stats', (req, res) => {
  res.json({
    version: '5.0.0',
    sources: {
      total: Object.keys(SOURCE_CONFIG).length,
      byType: {
        api: Object.values(SOURCE_CONFIG).filter(s => s.type === 'api').length,
        scraping: Object.values(SOURCE_CONFIG).filter(s => s.type === 'scraping').length
      }
    },
    categories: Object.keys(CATEGORY_SOURCES),
    features: {
      apiSources: true,
      scrapingSources: true,
      googleMaps: true,
      storeLocations: true,
      priceVerification: true,
      affiliateLinks: true
    }
  });
});

// ================================================================
// DÉMARRAGE SERVEUR
// ================================================================

app.get("/api/clear-cache", async (req, res) => { try { await redisClient.flushAll(); res.json({ success: true, message: "Cache vidé!" }); } catch (err) { res.json({ success: false, error: err.message }); } });
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════╗
║           PRIXMALIN v5.0 - BACKEND                ║
║        Concept Hybride: API + Scraping            ║
╠════════════════════════════════════════════════════╣
║  Port:           ${PORT.toString().padEnd(32)}║
║  Cache Redis:    ${(redisClient ? '✅ Connecté' : '❌ Indisponible').padEnd(32)}║
║  Sources API:    ${Object.values(SOURCE_CONFIG).filter(s => s.type === 'api').length.toString().padEnd(32)}║
║  Sources Scraping: ${Object.values(SOURCE_CONFIG).filter(s => s.type === 'scraping').length.toString().padEnd(30)}║
║  Total Sources:  ${Object.keys(SOURCE_CONFIG).length.toString().padEnd(32)}║
╚════════════════════════════════════════════════════╝
  `);
});

// ================================================================
// GESTION ERREURS GLOBALES
// ================================================================

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Rejection:', error);
});
