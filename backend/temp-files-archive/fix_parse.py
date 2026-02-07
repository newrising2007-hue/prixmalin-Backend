with open('server.js', 'r') as f:
    content = f.read()

# Remplacer parseClaudeResponse
old_parse = '''function parseClaudeResponse(text) {
  try {
    // Nettoyer le texte (enlever markdown, etc.)
    let clean = text.trim();
    clean = clean.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    return JSON.parse(clean);
  } catch (error) {
    console.error('Erreur parsing JSON:', error.message);
    return null;
  }
}'''

new_parse = '''function parseClaudeResponse(text) {
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
}'''

content = content.replace(old_parse, new_parse)

with open('server.js', 'w') as f:
    f.write(content)

print("✅ parseClaudeResponse amélioré!")
