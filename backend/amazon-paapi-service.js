/**
 * Service Amazon PA-API 5.0
 * Récupère vrais prix + images + notes Amazon
 */
const { SearchItems } = require('amazon-paapi');

const AMAZON_CONFIG = {
  AccessKey: process.env.AMAZON_ACCESS_KEY,
  SecretKey: process.env.AMAZON_SECRET_KEY,
  PartnerTag: process.env.AMAZON_PARTNER_TAG || 'prixmalin20-20',
  PartnerType: 'Associates',
  Marketplace: 'www.amazon.ca',
};

/**
 * Mapper catégories PrixMalin → Amazon
 */
function getAmazonCategory(category) {
  const mapping = {
    epicerie: 'Grocery',
    electro: 'Electronics',
    vetements: 'Fashion',
    quincaillerie: 'Tools',
    loisirs: 'ToysAndGames',
    animaux: 'PetSupplies',
    sante: 'HealthPersonalCare',
    sport: 'SportingGoods',
    vehicules: 'Automotive',
    intime: 'Beauty',
    pieces: 'Automotive',
  };
  return mapping[category] || 'All';
}

/**
 * Taux commission par catégorie
 */
function getCommission(category) {
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
    pieces: '3%',
  };
  return rates[category] || '2-4%';
}

/**
 * Récupère produits Amazon avec vrais prix via PA-API
 */
async function getAmazonProductsReal(query, category, count = 4) {
  try {
    const params = {
      Keywords: query,
      SearchIndex: getAmazonCategory(category),
      ItemCount: count,
      Resources: [
        'ItemInfo.Title',
        'Offers.Listings.Price',
        'Offers.Listings.SavingBasis',
        'Images.Primary.Medium',
        'CustomerReviews.StarRating',
        'CustomerReviews.Count',
      ],
    };

    const data = await SearchItems(AMAZON_CONFIG, params);

    if (!data?.SearchResult?.Items) {
      console.log('PA-API: aucun résultat, fallback liens');
      return getFallbackProducts(query, category, count);
    }

    return data.SearchResult.Items.slice(0, count).map(item => {
      const listing = item.Offers?.Listings?.[0];
      const price = listing?.Price?.DisplayAmount || null;
      const oldPrice = listing?.SavingBasis?.DisplayAmount || null;
      const title = item.ItemInfo?.Title?.DisplayValue || query;
      const image = item.Images?.Primary?.Medium?.URL || null;
      const rating = item.CustomerReviews?.StarRating?.DisplayValue || null;
      const reviewCount = item.CustomerReviews?.Count?.DisplayValue || null;

      return {
        product_name: title,
        price: price,
        old_price: oldPrice,
        store: 'Amazon.ca',
        category: category,
        source: 'amazon_paapi',
        url: `https://www.amazon.ca/dp/${item.ASIN}?tag=${AMAZON_CONFIG.PartnerTag}`,
        affiliateLink: `https://www.amazon.ca/dp/${item.ASIN}?tag=${AMAZON_CONFIG.PartnerTag}`,
        affiliationType: 'online',
        verified: true,
        commission: getCommission(category),
        image: image,
        rating: rating,
        review_count: reviewCount,
        asin: item.ASIN,
        badge: price ? '✅ Prix confirmé' : '⚠️ Voir prix sur Amazon',
      };
    });

  } catch (error) {
    console.error('PA-API erreur:', error.message);
    return getFallbackProducts(query, category, count);
  }
}

/**
 * Fallback si PA-API indisponible (ancien système)
 */
function getFallbackProducts(query, category, count = 4) {
  const searchUrl = `https://www.amazon.ca/s?k=${encodeURIComponent(query)}&tag=${AMAZON_CONFIG.PartnerTag}`;

  return Array(count).fill(null).map(() => ({
    product_name: `${query} - Amazon.ca`,
    price: null,
    store: 'Amazon.ca',
    category: category,
    source: 'amazon_fallback',
    url: searchUrl,
    affiliateLink: searchUrl,
    affiliationType: 'online',
    verified: false,
    commission: getCommission(category),
    badge: '⚠️ Voir prix sur Amazon',
  }));
}

module.exports = {
  getAmazonProductsReal,
  getFallbackProducts,
};
