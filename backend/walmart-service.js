/**
 * Service Walmart Canada - Affiliation via Skimlinks
 * ⚠️ Remplacer SKIMLINKS_ID par ton vrai ID une fois approuvé
 */

const SKIMLINKS_ID = 'VOTRE_SKIMLINKS_ID';
const WALMART_BASE = 'https://www.walmart.ca/search';

const FR_TO_EN = {
  'chemise': 'shirt', 'chemises': 'shirts',
  'pantalon': 'pants', 'pantalons': 'pants',
  'robe': 'dress', 'robes': 'dresses',
  'manteau': 'coat', 'manteaux': 'coats',
  'veste': 'jacket', 'vestes': 'jackets',
  'chandail': 'sweater', 'chandails': 'sweaters',
  'chaussures': 'shoes', 'chaussure': 'shoe',
  'bottes': 'boots', 'botte': 'boot',
  'chaussettes': 'socks', 'sous-vêtements': 'underwear',
  'jeans': 'jeans', 'short': 'shorts',
  'pain': 'bread', 'lait': 'milk', 'beurre': 'butter',
  'fromage': 'cheese', 'café': 'coffee', 'thé': 'tea',
  'sucre': 'sugar', 'farine': 'flour', 'riz': 'rice',
  'pâtes': 'pasta', 'jus': 'juice', 'eau': 'water',
  'chocolat': 'chocolate',
  'téléphone': 'phone', 'cellulaire': 'cell phone',
  'ordinateur': 'computer', 'tablette': 'tablet',
  'écran': 'monitor', 'clavier': 'keyboard', 'souris': 'mouse',
  'casque': 'headphones', 'écouteurs': 'earbuds',
  'télévision': 'television', 'télé': 'tv',
  'imprimante': 'printer', 'caméra': 'camera',
  'marteau': 'hammer', 'tournevis': 'screwdriver',
  'perceuse': 'drill', 'scie': 'saw', 'peinture': 'paint',
  'ampoule': 'light bulb', 'ampoules': 'light bulbs',
  'batterie': 'battery', 'batteries': 'batteries',
  'vélo': 'bike', 'tente': 'tent',
  'ballon': 'ball', 'yoga': 'yoga', 'haltères': 'dumbbells',
  'nourriture chien': 'dog food', 'nourriture chat': 'cat food',
  'laisse': 'leash', 'collier': 'collar', 'litière': 'cat litter',
  'vitamines': 'vitamins', 'vitamine': 'vitamin',
  'shampooing': 'shampoo', 'crème': 'cream',
  'rasoir': 'razor', 'dentifrice': 'toothpaste',
  'brosse à dents': 'toothbrush',
  'pneus': 'tires', 'pneu': 'tire', 'huile moteur': 'motor oil',
  'essuie-glace': 'windshield wiper', 'siège auto': 'car seat',
};

function translateQuery(query) {
  const lower = query.toLowerCase().trim();
  if (FR_TO_EN[lower]) return FR_TO_EN[lower];
  let translated = lower;
  Object.keys(FR_TO_EN).sort((a, b) => b.length - a.length).forEach(fr => {
    const regex = new RegExp(`\\b${fr}\\b`, 'gi');
    translated = translated.replace(regex, FR_TO_EN[fr]);
  });
  return translated;
}

function buildWalmartUrl(query) {
  const searchUrl = `${WALMART_BASE}?q=${encodeURIComponent(query)}`;
  return `${searchUrl}`;
}

function getWalmartCommission(category) {
  const rates = {
    epicerie: '2-4%', electro: '3-5%', vetements: '4-6%',
    quincaillerie: '3-5%', loisirs: '4-6%', animaux: '4-6%',
    sante: '4-6%', sport: '4-6%', vehicules: '3-5%',
    intime: '4-6%', divers: '3-5%',
  };
  return rates[category] || '3-5%';
}

function getWalmartProducts(query, category) {
  const translatedQuery = translateQuery(query);
  const url = buildWalmartUrl(translatedQuery);
  return [{
    product_name: `Rechercher "${query}" sur Walmart.ca`,
    price: null,
    store: 'Walmart.ca',
    category: category,
    source: 'walmart',
    url: url,
    affiliateLink: url,
    type: "online",
    verified: false,
    commission: getWalmartCommission(category),
    badge: 'Voir les prix sur Walmart',
  }];
}

module.exports = { getWalmartProducts };
