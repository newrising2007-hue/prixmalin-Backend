/**
 * Service Amazon Associates
 * Génère des liens affiliés Amazon réels - avec traduction FR→EN
 */
const AMAZON_TAG = 'prixmalin-20';

/**
 * Dictionnaire traduction FR → EN pour Amazon
 */
const FR_TO_EN = {
  // Vêtements
  'chemise': 'shirt', 'chemises': 'shirts',
  'pantalon': 'pants', 'pantalons': 'pants',
  'robe': 'dress', 'robes': 'dresses',
  'manteau': 'coat', 'manteaux': 'coats',
  'veste': 'jacket', 'vestes': 'jackets',
  'chandail': 'sweater', 'chandails': 'sweaters',
  'chaussures': 'shoes', 'chaussure': 'shoe',
  'bottes': 'boots', 'botte': 'boot',
  'chaussettes': 'socks',
  'sous-vêtements': 'underwear',
  'jeans': 'jeans',
  'short': 'shorts', 'shorts': 'shorts',
  'bikini': 'bikini',
  'maillot': 'swimsuit',

  // Épicerie
  'pain': 'bread', 'lait': 'milk', 'beurre': 'butter',
  'fromage': 'cheese', 'café': 'coffee', 'thé': 'tea',
  'sucre': 'sugar', 'farine': 'flour', 'riz': 'rice',
  'pâtes': 'pasta', 'jus': 'juice', 'eau': 'water',
  'bière': 'beer', 'vin': 'wine', 'chocolat': 'chocolate',

  // Électronique
  'téléphone': 'phone', 'cellulaire': 'cell phone',
  'ordinateur': 'computer', 'tablette': 'tablet',
  'écran': 'monitor', 'clavier': 'keyboard', 'souris': 'mouse',
  'casque': 'headphones', 'écouteurs': 'earbuds',
  'télévision': 'television', 'télé': 'tv',
  'imprimante': 'printer', 'caméra': 'camera',
  'appareil photo': 'camera',

  // Quincaillerie
  'marteau': 'hammer', 'tournevis': 'screwdriver',
  'perceuse': 'drill', 'scie': 'saw', 'peinture': 'paint',
  'ampoule': 'light bulb', 'ampoules': 'light bulbs',
  'batterie': 'battery', 'batteries': 'batteries',
  'cadenas': 'padlock', 'robinet': 'faucet', 'tuyau': 'hose',

  // Sport
  'vélo': 'bike', 'tente': 'tent',
  'sac de couchage': 'sleeping bag', 'raquette': 'racket',
  'ballon': 'ball', 'ski': 'ski', 'patin': 'skate', 'patins': 'skates',
  'yoga': 'yoga', 'haltères': 'dumbbells',

  // Animaux
  'nourriture chien': 'dog food', 'nourriture chat': 'cat food',
  'laisse': 'leash', 'collier': 'collar', 'litière': 'cat litter',
  'jouet chien': 'dog toy', 'aquarium': 'aquarium',

  // Santé / Beauté
  'vitamines': 'vitamins', 'vitamine': 'vitamin',
  'shampooing': 'shampoo', 'crème': 'cream', 'parfum': 'perfume',
  'rasoir': 'razor', 'dentifrice': 'toothpaste',
  'brosse à dents': 'toothbrush', 'lunettes': 'glasses',

  // Véhicules
  'pneus': 'tires', 'pneu': 'tire', 'huile moteur': 'motor oil',
  'essuie-glace': 'windshield wiper', 'siège auto': 'car seat',
};

/**
 * Traduit une requête FR → EN pour Amazon
 */
function translateQuery(query) {
  const lower = query.toLowerCase().trim();

  // Correspondance exacte d'abord
  if (FR_TO_EN[lower]) return FR_TO_EN[lower];

  // Correspondance partielle mot par mot
  let translated = lower;
  Object.keys(FR_TO_EN).sort((a, b) => b.length - a.length).forEach(fr => {
    const regex = new RegExp(`\\b${fr}\\b`, 'gi');
    translated = translated.replace(regex, FR_TO_EN[fr]);
  });

  return translated;
}

/**
 * Génère un produit Amazon pour une recherche
 */
function getAmazonProducts(query, category, count = 4) {
  const translatedQuery = translateQuery(query);
  const searchUrl = buildAmazonSearchUrl(translatedQuery, category);

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
  if (amazonCategory) params.append('i', amazonCategory);

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Mapper catégories PrixMalin → Amazon
 */
function getAmazonCategory(category) {
  const mapping = {
    epicerie: 'grocery', electro: 'electronics',
    vetements: 'fashion', quincaillerie: 'tools',
    loisirs: 'toys-and-games', animaux: 'pet-supplies',
    sante: 'hpc', sport: 'sporting-goods',
    vehicules: 'automotive', intime: 'beauty', divers: null,
  };
  return mapping[category] || null;
}

/**
 * Taux commission Amazon par catégorie
 */
function getAmazonCommission(category) {
  const rates = {
    epicerie: '1-3%', electro: '2-3%', vetements: '4%',
    quincaillerie: '3%', loisirs: '4%', animaux: '4%',
    sante: '3-4%', sport: '4%', vehicules: '3%',
    intime: '4-10%', divers: '2-4%',
  };
  return rates[category] || '2-4%';
}

/**
 * Nom de catégorie lisible
 */
function getCategoryName(category) {
  const names = {
    epicerie: 'Épicerie', electro: 'Électronique',
    vetements: 'Vêtements', quincaillerie: 'Quincaillerie',
    loisirs: 'Loisirs', animaux: 'Animaux', sante: 'Santé',
    sport: 'Sport', vehicules: 'Auto', intime: 'Beauté', divers: 'Divers',
  };
  return names[category] || 'Produits';
}

module.exports = { getAmazonProducts };
