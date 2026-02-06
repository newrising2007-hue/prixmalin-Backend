// ================================================================
// SOURCE_CONFIG - Configuration sources PrixMalin v5.0
// Classification: Groupe A (API) vs Groupe B (Scraping)
// ================================================================

const SOURCE_CONFIG = {
  // ============================================================
  // 🟢 GROUPE A - API FIABLES (Prix affichés)
  // ============================================================
  
  'walmart.ca': {
    type: 'api',
    hasPhysicalStores: true,
    displayPrice: true,
    affiliateProgram: 'walmart',
    categories: ['epicerie', 'electronique', 'vetements', 'quincaillerie'],
    reliability: 95,
    apiEndpoint: 'https://api.walmart.ca/v1/products', // Placeholder
    needsAPIKey: true
  },
  
  'amazon.ca': {
    type: 'api',
    hasPhysicalStores: false,
    displayPrice: true,
    affiliateProgram: 'amazon',
    categories: ['epicerie', 'electronique', 'vetements', 'intime'],
    reliability: 90,
    apiEndpoint: 'https://webservices.amazon.ca/paapi5/searchitems', // Product Advertising API
    needsAPIKey: true
  },
  
  'bestbuy.ca': {
    type: 'api',
    hasPhysicalStores: true,
    displayPrice: true,
    affiliateProgram: 'bestbuy',
    categories: ['electronique'],
    reliability: 95,
    apiEndpoint: 'https://api.bestbuy.ca/v2/products', // Placeholder
    needsAPIKey: true
  },
  
  // ============================================================
  // 🟡 GROUPE B - SCRAPING STABLE (Liens seulement)
  // ============================================================
  
  // --- Épicerie ---
  'iga.net': {
    type: 'scraping',
    hasPhysicalStores: true,
    displayPrice: false,
    affiliateProgram: null,
    categories: ['epicerie'],
    reliability: 70,
    baseURL: 'https://www.iga.net'
  },
  
  'metro.ca': {
    type: 'scraping',
    hasPhysicalStores: true,
    displayPrice: false,
    affiliateProgram: null,
    categories: ['epicerie'],
    reliability: 70,
    baseURL: 'https://www.metro.ca'
  },
  
  'provigo.ca': {
    type: 'scraping',
    hasPhysicalStores: true,
    displayPrice: false,
    affiliateProgram: null,
    categories: ['epicerie'],
    reliability: 65,
    baseURL: 'https://www.provigo.ca'
  },
  
  'maxi.ca': {
    type: 'scraping',
    hasPhysicalStores: true,
    displayPrice: false,
    affiliateProgram: null,
    categories: ['epicerie'],
    reliability: 65,
    baseURL: 'https://www.maxi.ca'
  },
  
  'loblaws.ca': {
    type: 'scraping',
    hasPhysicalStores: true,
    displayPrice: false,
    affiliateProgram: null,
    categories: ['epicerie'],
    reliability: 70,
    baseURL: 'https://www.loblaws.ca'
  },
  
  // --- Électronique ---
  'canadiantire.ca': {
    type: 'scraping',
    hasPhysicalStores: true,
    displayPrice: false,
    affiliateProgram: null,
    categories: ['electronique', 'quincaillerie'],
    reliability: 75,
    baseURL: 'https://www.canadiantire.ca'
  },
  
  'memoryexpress.com': {
    type: 'scraping',
    hasPhysicalStores: true,
    displayPrice: false,
    affiliateProgram: null,
    categories: ['electronique'],
    reliability: 70,
    baseURL: 'https://www.memoryexpress.com'
  },
  
  'canadacomputers.com': {
    type: 'scraping',
    hasPhysicalStores: true,
    displayPrice: false,
    affiliateProgram: null,
    categories: ['electronique'],
    reliability: 70,
    baseURL: 'https://www.canadacomputers.com'
  },
  
  // --- Quincaillerie ---
  'homedepot.ca': {
    type: 'scraping',
    hasPhysicalStores: true,
    displayPrice: false,
    affiliateProgram: null,
    categories: ['quincaillerie'],
    reliability: 80,
    baseURL: 'https://www.homedepot.ca'
  },
  
  'lowes.ca': {
    type: 'scraping',
    hasPhysicalStores: true,
    displayPrice: false,
    affiliateProgram: null,
    categories: ['quincaillerie'],
    reliability: 75,
    baseURL: 'https://www.lowes.ca'
  },
  
  'rona.ca': {
    type: 'scraping',
    hasPhysicalStores: true,
    displayPrice: false,
    affiliateProgram: null,
    categories: ['quincaillerie'],
    reliability: 70,
    baseURL: 'https://www.rona.ca'
  },
  
  // --- Vêtements ---
  'hm.com': {
    type: 'scraping',
    hasPhysicalStores: true,
    displayPrice: false,
    affiliateProgram: null,
    categories: ['vetements'],
    reliability: 65,
    baseURL: 'https://www2.hm.com/en_ca'
  },
  
  'zara.com': {
    type: 'scraping',
    hasPhysicalStores: true,
    displayPrice: false,
    affiliateProgram: null,
    categories: ['vetements'],
    reliability: 65,
    baseURL: 'https://www.zara.com/ca'
  },
  
  'roots.com': {
    type: 'scraping',
    hasPhysicalStores: true,
    displayPrice: false,
    affiliateProgram: null,
    categories: ['vetements'],
    reliability: 70,
    baseURL: 'https://www.roots.com/ca/en'
  }
};

// ================================================================
// CATEGORY_SOURCES - Sources par catégorie (15-20 sources total)
// ================================================================

const CATEGORY_SOURCES = {
  epicerie: {
    prioritySources: [
      'walmart.ca',      // API - Prix affiché
      'amazon.ca',       // API - Prix affiché
      'iga.net',         // Scraping - Lien seulement
      'metro.ca',        // Scraping - Lien seulement
      'provigo.ca',      // Scraping - Lien seulement
      'maxi.ca',         // Scraping - Lien seulement
      'loblaws.ca'       // Scraping - Lien seulement
    ],
    defaultRadius: 25
  },
  
  electronique: {
    prioritySources: [
      'bestbuy.ca',           // API - Prix affiché
      'amazon.ca',            // API - Prix affiché
      'walmart.ca',           // API - Prix affiché
      'canadiantire.ca',      // Scraping - Lien seulement
      'memoryexpress.com',    // Scraping - Lien seulement
      'canadacomputers.com'   // Scraping - Lien seulement
    ],
    defaultRadius: 150
  },
  
  quincaillerie: {
    prioritySources: [
      'walmart.ca',        // API - Prix affiché
      'homedepot.ca',      // Scraping - Lien seulement
      'lowes.ca',          // Scraping - Lien seulement
      'rona.ca',           // Scraping - Lien seulement
      'canadiantire.ca'    // Scraping - Lien seulement
    ],
    defaultRadius: 150
  },
  
  vetements: {
    prioritySources: [
      'walmart.ca',    // API - Prix affiché
      'amazon.ca',     // API - Prix affiché
      'hm.com',        // Scraping - Lien seulement
      'zara.com',      // Scraping - Lien seulement
      'roots.com'      // Scraping - Lien seulement
    ],
    defaultRadius: 150
  },
  
  vehicules: {
    prioritySources: [
      // Phase future - APIs AutoTrader, Kijiji Motors
    ],
    defaultRadius: 150
  },
  
  intime: {
    prioritySources: [
      'amazon.ca'  // API - Prix affiché
    ],
    defaultRadius: 150
  }
};

// ================================================================
// HELPER FUNCTIONS
// ================================================================

/**
 * Obtenir la configuration d'une source
 */
function getSourceConfig(sourceName) {
  return SOURCE_CONFIG[sourceName] || null;
}

/**
 * Obtenir toutes les sources d'une catégorie
 */
function getCategorySources(category) {
  return CATEGORY_SOURCES[category] || { prioritySources: [], defaultRadius: 25 };
}

/**
 * Filtrer les sources par type (api ou scraping)
 */
function getSourcesByType(category, type) {
  const sources = getCategorySources(category).prioritySources;
  return sources.filter(source => {
    const config = getSourceConfig(source);
    return config && config.type === type;
  });
}

/**
 * Obtenir les sources API d'une catégorie
 */
function getAPISources(category) {
  return getSourcesByType(category, 'api');
}

/**
 * Obtenir les sources scraping d'une catégorie
 */
function getScrapingSources(category) {
  return getSourcesByType(category, 'scraping');
}

/**
 * Vérifier si une source affiche les prix
 */
function shouldDisplayPrice(sourceName) {
  const config = getSourceConfig(sourceName);
  return config ? config.displayPrice : false;
}

/**
 * Vérifier si une source a des magasins physiques
 */
function hasPhysicalStores(sourceName) {
  const config = getSourceConfig(sourceName);
  return config ? config.hasPhysicalStores : false;
}

/**
 * Obtenir le programme d'affiliation
 */
function getAffiliateProgram(sourceName) {
  const config = getSourceConfig(sourceName);
  return config ? config.affiliateProgram : null;
}

// ================================================================
// EXPORTS
// ================================================================

module.exports = {
  SOURCE_CONFIG,
  CATEGORY_SOURCES,
  getSourceConfig,
  getCategorySources,
  getSourcesByType,
  getAPISources,
  getScrapingSources,
  shouldDisplayPrice,
  hasPhysicalStores,
  getAffiliateProgram
};
