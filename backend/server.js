require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

const MOCK_PRODUCTS = {
  epicerie: [
    {
      product_name: "Pain Blanc Wonder",
      price: "2.99",
      store: "Walmart",
      category: "epicerie",
      source: "walmart",
      affiliateLink: "https://www.walmart.ca/fr/grocery/breads-bakery",
      affiliationType: "online",
      verified: true,
      commission: "1%"
    }
  ],
  electro: [
    {
      product_name: "AirPods Pro 2ème génération",
      price: "329.99",
      store: "Amazon.ca",
      category: "electro",
      source: "amazon",
      affiliateLink: "https://www.amazon.ca/Apple-AirPods-Pro-2eme-generation/dp/B0CHWRXH8B?tag=prixmalin-20",
      affiliationType: "online",
      verified: true,
      commission: "2%"
    }
  ],
  vetements: [
    {
      product_name: "Jeans Levi's 501",
      price: "89.99",
      store: "La Baie",
      category: "vetements",
      source: "labaie",
      affiliateLink: "https://www.labaie.com/vetements-pour-hommes/jeans",
      affiliationType: "online",
      verified: true,
      commission: "4%"
    }
  ],
  intime: [
    {
      product_name: "Caleçons Hanes Pack 3",
      price: "19.99",
      store: "Walmart",
      category: "intime",
      source: "walmart",
      affiliateLink: "https://www.walmart.ca/fr/sous-vetements",
      affiliationType: "online",
      verified: true,
      commission: "4%"
    }
  ],
  quincaillerie: [
    {
      product_name: "Marteau Stanley 16oz",
      price: "24.99",
      store: "Canadian Tire",
      category: "quincaillerie",
      source: "canadiantire",
      affiliateLink: "https://www.canadiantire.ca/fr/outils/marteaux",
      affiliationType: "local_web",
      distance: "2.3 km",
      verified: true,
      commission: "3%"
    }
  ],
  loisirs_culture: [
    {
      product_name: "Xbox Game Pass Ultimate 1 mois",
      price: "33.99",
      store: "Amazon.ca",
      category: "loisirs_culture",
      source: "amazon",
      affiliateLink: "https://www.amazon.ca/-/fr/Microsoft-snow-chains/dp/B08M8WSRX9?tag=prixmalin-20&linkCode=ll2&linkId=ec68630135bda231d437500c61e37e36",
      affiliationType: "online",
      verified: true,
      commission: "4%"
    }
  ],
  animaux: [
    {
      product_name: "Nourriture Chien Royal Canin",
      price: "79.99",
      store: "Mondou",
      category: "animaux",
      source: "mondou",
      affiliateLink: "https://www.mondou.com/nourriture-chien",
      affiliationType: "local_web",
      distance: "3.8 km",
      verified: true,
      commission: "3%"
    }
  ],
  sante_optique: [
    {
      product_name: "Vitamines D3",
      price: "19.99",
      store: "Jean Coutu",
      category: "sante_optique",
      source: "jeancoutu",
      affiliateLink: "https://www.jeancoutu.com/sante-beaute/vitamines",
      affiliationType: "online",
      verified: true,
      commission: "4%"
    }
  ],
  sport_nature: [
    {
      product_name: "Tente Camping Coleman",
      price: "159.99",
      store: "Sail",
      category: "sport_nature",
      source: "sail",
      affiliateLink: "https://www.sail.ca/fr/camping/tentes",
      affiliationType: "local_web",
      distance: "7.2 km",
      verified: true,
      commission: "3%"
    }
  ],
  vehicules: [
    {
      product_name: "Pneus Hiver Michelin",
      price: "179.99",
      store: "Point S",
      category: "vehicules",
      source: "points",
      affiliateLink: "https://www.points.com/fr/pneus-hiver",
      affiliationType: "local_web",
      distance: "5.3 km",
      verified: true,
      commission: "2%"
    }
  ]
};

app.post('/api/search-prices', async (req, res) => {
  try {
    const { query, category } = req.body;
    
    if (MOCK_PRODUCTS[category]) {
      return res.json({
        success: true,
        products: MOCK_PRODUCTS[category]
      });
    }
    
    return res.json({
      success: false,
      products: []
    });
  } catch (error) {
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
