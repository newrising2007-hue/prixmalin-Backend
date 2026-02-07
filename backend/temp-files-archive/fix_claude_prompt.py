with open('server.js', 'r') as f:
    content = f.read()

# Trouver et remplacer le prompt API
old_prompt = '''  const prompt = `
Recherche de produits "${query}" dans la catégorie ${category}.
Sources avec API (prix fiables à afficher): ${apiSources.join(', ')}
Pour chaque produit trouvé, retourne en JSON:
{
  "products": [
    {
      "product_name": "Nom exact du produit",
      "price": "2.99",
      "store": "Walmart",
      "url": "URL directe vers la page produit",
      "image_url": "URL de l'image produit",
      "availability": "en stock"'''

new_prompt = '''  const prompt = `Tu es un assistant qui retourne UNIQUEMENT du JSON valide, JAMAIS de texte.

Recherche de produits "${query}" dans la catégorie ${category}.
Sources avec API (prix fiables): ${apiSources.join(', ')}

IMPORTANT: 
- Retourne SEULEMENT du JSON valide
- PAS de texte avant ou après le JSON
- Si tu ne trouves rien, retourne {"products": []}

Format JSON exact:
{
  "products": [
    {
      "product_name": "Nom exact du produit",
      "price": "2.99",
      "store": "Walmart",
      "url": "URL directe vers la page produit",
      "image_url": "URL de l'image produit",
      "availability": "en stock"'''

content = content.replace(old_prompt, new_prompt)

with open('server.js', 'w') as f:
    f.write(content)

print("✅ Prompt Claude renforcé!")
