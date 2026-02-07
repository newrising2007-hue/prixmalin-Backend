#!/usr/bin/env python3
# -*- coding: utf-8 -*-

print("📖 Lecture de server.js...")
with open('server.js', 'r', encoding='utf-8') as f:
    content = f.read()

mock_data_code = '''
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
    const config = sourceConfig[product.source] || {
      type: 'scraping',
      displayPrice: false,
      hasPhysicalStores: true,
      affiliateProgram: null
    };
    return { ...product, category, config };
  });
}

function getMockData(category, query) {
  const categoryProducts = MOCK_PRODUCTS[category] || [];
  const enrichedProducts = enrichMockDataWithConfig(categoryProducts, category);
  if (query && query.trim() !== '') {
    const queryLower = query.toLowerCase();
    return enrichedProducts.filter(p => 
      p.product_name.toLowerCase().includes(queryLower)
    );
  }
  return enrichedProducts;
}
'''

# Trouver où insérer
insert_pos = content.find('// Routes')
if insert_pos == -1:
    insert_pos = content.find('app.post')

new_content = content[:insert_pos] + mock_data_code + "\n\n" + content[insert_pos:]

# Remplacer la logique de fallback
old_code = '''    // Parser la réponse Claude
    const parsedData = parseClaudeResponse(fullResponse);
    
    if (!parsedData || !parsedData.products || parsedData.products.length === 0) {
      console.log('⚠️ Aucun produit retourné par Claude');
      return res.json({
        success: true,
        cached: false,
        count: 0,
        results: []
      });
    }'''

new_code = '''    // Parser la réponse Claude
    let parsedData = parseClaudeResponse(fullResponse);
    
    if (!parsedData || !parsedData.products || parsedData.products.length === 0) {
      console.log('⚠️ Claude vide - Utilisation MOCK DATA');
      const mockProducts = getMockData(category, query);
      if (mockProducts.length > 0) {
        parsedData = { products: mockProducts };
        console.log(`✅ ${mockProducts.length} produits mock chargés`);
      } else {
        return res.json({ success: true, count: 0, results: [] });
      }
    }'''

new_content = new_content.replace(old_code, new_code)

print("✍️ Écriture du nouveau server.js...")
with open('server.js', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("\n✅ MOCK DATA AJOUTÉ !\n")
