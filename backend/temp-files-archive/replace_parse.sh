#!/bin/bash

# Créer le nouveau code
cat > new_parse.txt << 'EOF'
function parseClaudeResponse(text) {
  try {
    // Si Claude refuse ou répond en texte
    if (text.toLowerCase().includes('je ne peux') || 
        text.toLowerCase().includes('i cannot') ||
        text.toLowerCase().includes('désolé')) {
      console.log('⚠️ Claude a refusé la requête');
      return { products: [] };
    }
    
    // Nettoyer le texte (enlever markdown, etc.)
    let clean = text.trim();
    clean = clean.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    
    const parsed = JSON.parse(clean);
    return parsed;
  } catch (error) {
    console.error('Erreur parsing JSON:', error.message);
    console.error('Texte reçu:', text.substring(0, 200));
    return { products: [] };
  }
}
EOF

# Backup
cp server.js server.js.backup2

# Remplacer lignes 271-282
head -270 server.js > server.js.new
cat new_parse.txt >> server.js.new
tail -n +283 server.js >> server.js.new

mv server.js.new server.js
rm new_parse.txt

echo "✅ Fonction parseClaudeResponse remplacée!"
