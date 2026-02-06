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
  getSourceConfig,
  getCategorySources,
  getAPISources,
  getScrapingSources,
  shouldDisplayPrice,
  hasPhysicalStores,
  getAffiliateProgram
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
        console.log(`⏳ Rate limit 429 - Retry ${attempt}/${maxRetries} dans ${delay/1000}s`);
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
  
  if (parsed && parsed.products) {
    return parsed.products.map(p => ({
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
  
  return [];
}

/**
 * Parser la réponse Claude (JSON)
 */
function parseClaudeResponse(text) {
  try {
    // Nettoyer le texte (enlever markdown, etc.)
    let clean = text.trim();
    clean = clean.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    return JSON.parse(clean);
  } catch (error) {
    console.error('Erreur parsing JSON:', error.message);
    return null;
  }
}

// ================================================================
// ENDPOINT PRINCIPAL: /api/search-prices
// ================================================================

app.post('/api/search-prices', async (req, res) => {
  try {
    const { query, category, location, radiusKm } = req.body;
    
    // Validation
    if (!query || !category || !location) {
      return res.status(400).json({
        success: false,
        error: 'Paramètres manquants: query, category, location'
      });
    }
    
    // Vérifier cache
    const cacheKey = `search:${query}:${category}:${location}:${radiusKm}`;
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
    let allResults = [...apiResults, ...scrapingResults];
    
    // Enrichir avec données magasins
    allResults = enrichWithStoreData(allResults, location, radiusKm);
    
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
