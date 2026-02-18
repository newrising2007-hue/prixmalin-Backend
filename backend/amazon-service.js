/**
 * Service Amazon Associates
 * Génère des liens affiliés Amazon réels
 */
const AMAZON_TAG = 'prixmalin-20'; // Ton tracking ID

/**
 * Génère un produit Amazon pour une recherche
 */
function getAmazonProducts(query, category, count = 4) {
  const searchUrl = buildAmazonSearchUrl(query, category);

  // Un seul résultat Amazon (lien de recherche affilié)
  // La vraie API (Creators API) viendra après 10 ventes/mois
  return [{
    product_name: `Rechercher "${query}" sur Amazon.ca`,
    price: null,
    store: 'Amazon.ca',
    category: category,
    source: 'amazon',
    url: searchUrl,
    affiliateLink: searchUrl,
    affiliationType: 'online',
    verified: false,
    commission: getAmazonCommission(category),
    badge: 'Voir les prix sur Amazon',
  }];
}

/**
 * Construit URL de recherche Amazon avec tag affilié
 */
function buildAmazonSearchUrl(query, category) {
  const baseUrl = 'https://www.amazon.ca/s';
  const params = new URLSearchParams({
    k: query,
    tag: AMAZON_TAG,
  });

  const amazonCategory = getAmazonCategory(category);
  if (amazonCategory) {
    params.append('i', amazonCategory);
  }

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Mapper catégories PrixMalin → Amazon
 */
function getAmazonCategory(category) {
  const mapping = {
    epicerie: 'grocery',
    electro: 'electronics',
    vetements: 'fashion',
    quincaillerie: 'tools',
    loisirs: 'toys-and-games',
    animaux: 'pet-supplies',
    sante: 'hpc',
    sport: 'sporting-goods',
    vehicules: 'automotive',
    intime: 'beauty',
    divers: null,
  };

  return mapping[category] || null;
}

/**
 * Taux commission Amazon par catégorie
 */
function getAmazonCommission(category) {
  const rates = {
    epicerie: '1-3%',
    electro: '2-3%',
    vetements: '4%',
    quincaillerie: '3%',
    loisirs: '4%',
    animaux: '4%',
    sante: '3-4%',
    sport: '4%',
    vehicules: '3%',
    intime: '4-10%',
    divers: '2-4%',
  };

  return rates[category] || '2-4%';
}

/**
 * Nom de catégorie lisible
 */
function getCategoryName(category) {
  const names = {
    epicerie: 'Épicerie',
    electro: 'Électronique',
    vetements: 'Vêtements',
    quincaillerie: 'Quincaillerie',
    loisirs: 'Loisirs',
    animaux: 'Animaux',
    sante: 'Santé',
    sport: 'Sport',
    vehicules: 'Auto',
    intime: 'Beauté',
    divers: 'Divers',
  };

  return names[category] || 'Produits';
}

module.exports = {
  getAmazonProducts,
};
