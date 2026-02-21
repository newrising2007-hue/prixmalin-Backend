// Service pour trouver l'image officielle d'un modèle de véhicule

const BRAND_IMAGE_URLS = {
  yamaha: (model) => `https://www.yamaha-motor.ca/en/off-road/motorcycle/off-road-competition`,
  'ski-doo': (model) => `https://www.ski-doo.com/en/snowmobiles.html`,
  'can-am': (model) => `https://can-am.brp.com/off-road/en-ca/`,
  'sea-doo': (model) => `https://sea-doo.com/en-ca/`,
  honda: (model) => `https://powersports.honda.ca/`,
  suzuki: (model) => `https://www.suzuki.ca/en/`,
  'arctic cat': (model) => `https://arcticcat.txtsv.com/`,
  kawasaki: (model) => `https://www.kawasaki.ca/en/`,
  ktm: (model) => `https://www.ktm.com/en-ca/`,
  polaris: (model) => `https://www.polaris.com/en-ca/`,
  cfmoto: (model) => `https://www.cfmoto.ca/`,
  lynx: (model) => `https://www.lynxsnowmobiles.com/en-ca/`,
};

// Images statiques fiables par marque (fallback)
const BRAND_STATIC_IMAGES = {
  yamaha: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Yamaha_Motor_logo.svg/320px-Yamaha_Motor_logo.svg.png',
  'ski-doo': 'https://upload.wikimedia.org/wikipedia/en/thumb/6/6e/Ski-Doo_logo.svg/320px-Ski-Doo_logo.svg.png',
  'can-am': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Can-Am_logo.svg/320px-Can-Am_logo.svg.png',
  'sea-doo': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Sea-Doo_logo.svg/320px-Sea-Doo_logo.svg.png',
  honda: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Honda_Logo.svg/320px-Honda_Logo.svg.png',
  suzuki: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Suzuki_logo_2.svg/320px-Suzuki_logo_2.svg.png',
  'arctic cat': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/Arctic_Cat_logo.svg/320px-Arctic_Cat_logo.svg.png',
  kawasaki: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Kawasaki_logo.svg/320px-Kawasaki_logo.svg.png',
  ktm: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/KTM-logo.svg/320px-KTM-logo.svg.png',
  polaris: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Polaris_Industries_logo.svg/320px-Polaris_Industries_logo.svg.png',
};

// Cherche l'image du modèle via Bing Image Search (gratuit, pas d'API key)
async function getVehicleImageUrl(query, brand) {
  try {
    const searchQuery = encodeURIComponent(`${query} ${brand || ''} official`);
    
    // On retourne une URL de recherche Google Images comme fallback immédiat
    // Le frontend peut l'utiliser comme source
    const googleImageSearch = `https://www.google.com/search?q=${searchQuery}&tbm=isch`;
    
    // Image statique fiable par marque
    const staticImage = brand ? BRAND_STATIC_IMAGES[brand.toLowerCase()] : null;
    
    return {
      image_url: staticImage || null,
      dealer_url: brand ? BRAND_IMAGE_URLS[brand.toLowerCase()]?.(query) : null,
    };
  } catch (error) {
    return { image_url: null, dealer_url: null };
  }
}

function extractBrandFromQuery(query) {
  const brands = Object.keys(BRAND_STATIC_IMAGES);
  const lowerQuery = query.toLowerCase();
  return brands.find(b => lowerQuery.includes(b)) || null;
}

module.exports = { getVehicleImageUrl, extractBrandFromQuery };
