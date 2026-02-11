import json

# Lire le fichier
with open('server.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Nouveau produit Intime
new_product = '''
  // Intime
  {
    product_name: "Caleçons Boxers Hanes Pack 3",
    price: "19.99",
    store: "Walmart",
    url: "https://www.walmart.ca/fr/ip/caleccons-boxers-hanes/123456",
    image_url: "https://i5.walmartimages.ca/images/Large/123/456/123456.jpg",
    category: "intime",
    source: "walmart"
  },'''

# Trouver la position après le dernier produit épicerie
insert_position = content.find('source: "walmart"')
# Avancer jusqu'au },
insert_position = content.find('},', insert_position) + 2

# Insérer le nouveau produit
new_content = content[:insert_position] + '\n' + new_product + content[insert_position:]

# Écrire le résultat
with open('server.js', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("✅ Produit Intime ajouté avec succès !")
