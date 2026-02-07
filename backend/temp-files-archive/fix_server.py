with open('server.js', 'r') as f:
    content = f.read()

# Trouver et remplacer la section de parsing
old_code = '''app.post('/api/search-prices', async (req, res) => {
  try {
    const { query, category, location, radiusKm } = req.body;
    
    // Validation
    if (!query || !category || !location) {
      return res.status(400).json({
        success: false,
        error: 'Paramètres manquants: query, category, location'
      });
    }'''

new_code = '''app.post('/api/search-prices', async (req, res) => {
  try {
    const { query, category, location, radiusKm } = req.body;
    
    // Validation
    if (!query || !category || !location) {
      return res.status(400).json({
        success: false,
        error: 'Paramètres manquants: query, category, location'
      });
    }
    
    // Extraire latitude/longitude de l'objet location
    const { latitude, longitude, cityName } = location;'''

content = content.replace(old_code, new_code)

# Remplacer l'appel à enrichWithStoreData
content = content.replace(
    'allResults = enrichWithStoreData(allResults, location, radiusKm);',
    'allResults = enrichWithStoreData(allResults, latitude, longitude, radiusKm);'
)

# Remplacer le cacheKey
content = content.replace(
    'const cacheKey = `search:${query}:${category}:${location}:${radiusKm}`;',
    'const cacheKey = `search:${query}:${category}:${latitude},${longitude}:${radiusKm}`;'
)

# Remplacer le console.log
old_log = '''console.log`🔍 Recherche: "${query}" | ${category} | ${location} | ${radiusKm}km`);'''
new_log = '''console.log(`🔍 Recherche: "${query}" | ${category} | ${latitude},${longitude} | ${radiusKm}km`);'''
content = content.replace(old_log, new_log)

with open('server.js', 'w') as f:
    f.write(content)

print("✅ server.js corrigé!")
