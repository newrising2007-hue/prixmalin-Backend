with open('server.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip_next = False

for i, line in enumerate(lines):
    if skip_next:
        skip_next = False
        continue
    
    # Trouver la ligne cassée et la corriger
    if 'produits mock retournés' in line and 'console.log`' in line:
        # Remplacer par la version corrigée
        new_lines.append('    console.log(`✅ ${mockProducts.length} produits mock retournés`);\n')
        # La ligne suivante "(    return..." sera fusionnée
        if i + 1 < len(lines) and '(    return { products: mockProducts }' in lines[i + 1]:
            new_lines.append('    return { products: mockProducts };\n')
            skip_next = True
    else:
        new_lines.append(line)

with open('server.js', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("✅ Corrigé !")
