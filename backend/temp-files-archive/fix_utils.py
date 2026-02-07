with open('utils.js', 'r') as f:
    content = f.read()

# Remplacer la signature de enrichWithStoreData
old_sig = '''function enrichWithStoreData(results, location, radiusKm = 50) {'''
new_sig = '''function enrichWithStoreData(results, userLat, userLon, radiusKm = 50) {'''

content = content.replace(old_sig, new_sig)

# Supprimer l'appel à getCityCoordinates
old_city_check = '''  const cityCoords = getCityCoordinates(location);
  if (!cityCoords) {
    console.log`Ville "${location}" non trouvée dans la base de données`);
    return results;
  }
  
  const { latitude: userLat, longitude: userLon } = cityCoords;'''

new_city_check = '''  // Utiliser les coordonnées fournies directement
  if (!userLat || !userLon) {
    console.log('Coordonnées manquantes');
    return results;
  }'''

content = content.replace(old_city_check, new_city_check)

with open('utils.js', 'w') as f:
    f.write(content)

print("✅ utils.js corrigé!")
