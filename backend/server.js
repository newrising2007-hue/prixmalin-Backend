const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

// MOCK DATA POUR LES 10 CATÉGORIES
const MOCK_DATA = {
  epicerie: [
    {
      product_name: "Pain Blanc Wonder",
      price: "2.99",
      store: "Walmart",
      category: "epicerie",
      source: "walmart",
      verified: true
    },
    {
      product_name: "Pain Multigrains",
      price: "3.49",
      store: "Metro",
      category: "epicerie",
      source: "metro",
      verified: true
    }
  ],
  
  electro: [
    // ÉLECTRONIQUE
    {
      product_name: "iPhone 15 Pro 256GB",
      price: "1399.99",
      store: "Best Buy",
      category: "electro",
      source: "bestbuy",
      verified: true
    },
    {
      product_name: "Samsung Galaxy S24",
      price: "1199.99",
      store: "Amazon.ca",
      category: "electro",
      source: "amazon",
      verified: false
    },
    {
      product_name: "AirPods Pro 2",
      price: "329.99",
      store: "Apple Store",
      category: "electro",
      source: "apple",
      verified: true
    },
    // ÉLECTROMÉNAGER
    {
      product_name: "Réfrigérateur Samsung 25pi³",
      price: "1899.99",
      store: "Best Buy",
      category: "electro",
      source: "bestbuy",
      verified: true
    },
    {
      product_name: "Micro-ondes Panasonic 1.2pi³",
      price: "199.99",
      store: "Walmart",
      category: "electro",
      source: "walmart",
      verified: true
    },
    {
      product_name: "Cafetière Keurig K-Elite",
      price: "129.99",
      store: "Canadian Tire",
      category: "electro",
      source: "canadiantire",
      verified: false
    },
    {
      product_name: "Aspirateur Dyson V15",
      price: "899.99",
      store: "Best Buy",
      category: "electro",
      source: "bestbuy",
      verified: true
    }
  ],
  
  vetements: [
    {
      product_name: "T-Shirt Homme Coton",
      price: "19.99",
      store: "H&M",
      category: "vetements",
      source: "hm",
      verified: true
    },
    {
      product_name: "Jeans Levis 501",
      price: "89.99",
      store: "Levis Store",
      category: "vetements",
      source: "levis",
      verified: true
    },
    {
      product_name: "Chandail à Capuchon",
      price: "39.99",
      store: "Old Navy",
      category: "vetements",
      source: "oldnavy",
      verified: false
    }
  ],
  
  intime: [
    {
      product_name: "Caleçons Boxers Hanes Pack 3",
      price: "19.99",
      store: "Walmart",
      category: "intime",
      source: "walmart",
      verified: true
    },
    {
      product_name: "Soutien-Gorge Sport",
      price: "29.99",
      store: "La Vie en Rose",
      category: "intime",
      source: "lavieenrose",
      verified: true
    }
  ],
  
  quincaillerie: [
    {
      product_name: "Marteau Stanley 16oz",
      price: "24.99",
      store: "Canadian Tire",
      category: "quincaillerie",
      source: "canadiantire",
      verified: true
    },
    {
      product_name: "Perceuse Sans Fil DeWalt",
      price: "149.99",
      store: "Home Depot",
      category: "quincaillerie",
      source: "homedepot",
      verified: true
    },
    {
      product_name: "Tournevis Set 20 pcs",
      price: "34.99",
      store: "Rona",
      category: "quincaillerie",
      source: "rona",
      verified: false
    }
  ],
  
  loisirs: [
    {
      product_name: "Livre - The Great Gatsby",
      price: "14.99",
      store: "Indigo",
      category: "loisirs",
      source: "indigo",
      verified: true
    },
    {
      product_name: "PlayStation 5 Standard",
      price: "599.99",
      store: "Best Buy",
      category: "loisirs",
      source: "bestbuy",
      verified: true
    },
    {
      product_name: "Ballon de Soccer Adidas",
      price: "49.99",
      store: "Sport Chek",
      category: "loisirs",
      source: "sportchek",
      verified: false
    }
  ],
  
  animaux: [
    {
      product_name: "Nourriture Chien Royal Canin 15kg",
      price: "79.99",
      store: "PetSmart",
      category: "animaux",
      source: "petsmart",
      verified: true
    },
    {
      product_name: "Litière Chat Purina 18kg",
      price: "24.99",
      store: "Walmart",
      category: "animaux",
      source: "walmart",
      verified: true
    },
    {
      product_name: "Jouet Interactif Chien",
      price: "19.99",
      store: "Amazon.ca",
      category: "animaux",
      source: "amazon",
      verified: false
    }
  ],
  
  sante: [
    {
      product_name: "Lunettes de Vue Ray-Ban",
      price: "199.99",
      store: "Iris",
      category: "sante",
      source: "iris",
      verified: true
    },
    {
      product_name: "Vitamines Multivitamines 100 caps",
      price: "29.99",
      store: "Jean Coutu",
      category: "sante",
      source: "jeancoutu",
      verified: true
    },
    {
      product_name: "Crème Hydratante Nivea",
      price: "12.99",
      store: "Pharmaprix",
      category: "sante",
      source: "pharmaprix",
      verified: false
    }
  ],
  
  sport: [
    {
      product_name: "Tente Camping 4 Personnes",
      price: "149.99",
      store: "MEC",
      category: "sport",
      source: "mec",
      verified: true
    },
    {
      product_name: "Sac à Dos Randonnée 40L",
      price: "89.99",
      store: "Atmosphere",
      category: "sport",
      source: "atmosphere",
      verified: true
    },
    {
      product_name: "Raquettes de Neige",
      price: "129.99",
      store: "Sport Chek",
      category: "sport",
      source: "sportchek",
      verified: false
    }
  ],
  
  vehicules: [
    {
      product_name: "Pneus Hiver Michelin X-Ice 4 pcs",
      price: "799.99",
      store: "Canadian Tire",
      category: "vehicules",
      source: "canadiantire",
      verified: true
    },
    {
      product_name: "Huile Moteur Castrol 5W-30 5L",
      price: "39.99",
      store: "Walmart",
      category: "vehicules",
      source: "walmart",
      verified: true
    },
    {
      product_name: "Batterie Auto 12V",
      price: "149.99",
      store: "NAPA Auto Parts",
      category: "vehicules",
      source: "napa",
      verified: false
    }
  ]
};

// API Endpoint - Recherche de prix
app.post('/api/search-prices', async (req, res) => {
  try {
    const { query, category, location } = req.body;

    console.log(`[SEARCH] Query: "${query}" | Category: ${category}`);

    // Retourne les données mock pour la catégorie sélectionnée
    const results = MOCK_DATA[category] || [];

    // Simule un délai de recherche
    await new Promise(resolve => setTimeout(resolve, 500));

    res.json({
      success: true,
      results: results,
      total: results.length,
      category: category,
      query: query
    });

  } catch (error) {
    console.error('[ERROR]', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la recherche',
      message: error.message
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    categories: Object.keys(MOCK_DATA).length
  });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 PrixMalin Backend V5 - Port ${PORT}`);
  console.log(`📊 ${Object.keys(MOCK_DATA).length} catégories chargées`);
  console.log(`🔗 Backend URL: http://localhost:${PORT}`);
});

module.exports = app;
