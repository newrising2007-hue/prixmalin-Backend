require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { searchLocalStores, getStoreDetails } = require('./places-service');
const { getAmazonProducts } = require('./amazon-service');
const { getWalmartProducts } = require('./walmart-service');
const app = express();
const PORT = process.env.PORT || 10000;
app.use(cors());
app.use(express.json());

const BRAND_LOGOS = {
  'yamaha':      'https://via.placeholder.com/320x160/CC0000/FFFFFF?text=Yamaha',
  'suzuki':      'https://via.placeholder.com/320x160/003087/FFFFFF?text=Suzuki',
  'arctic cat':  'https://via.placeholder.com/320x160/003087/FFFFFF?text=Arctic+Cat',
  'ski-doo':     'https://via.placeholder.com/320x160/FFD700/000000?text=Ski-Doo',
  'can-am':      'https://via.placeholder.com/320x160/FF0000/FFFFFF?text=Can-Am',
  'sea-doo':     'https://via.placeholder.com/320x160/0066CC/FFFFFF?text=Sea-Doo',
  'honda':       'https://via.placeholder.com/320x160/CC0000/FFFFFF?text=Honda',
  'kawasaki':    'https://via.placeholder.com/320x160/00A651/FFFFFF?text=Kawasaki',
  'ktm':         'https://via.placeholder.com/320x160/FF6600/FFFFFF?text=KTM',
  'polaris':     'https://via.placeholder.com/320x160/003087/FFFFFF?text=Polaris',
  'cfmoto':      'https://via.placeholder.com/320x160/CC0000/FFFFFF?text=CFMOTO',
  'lynx':        'https://via.placeholder.com/320x160/FFD700/000000?text=Lynx',
  'husqvarna':   'https://via.placeholder.com/320x160/0000CD/FFFFFF?text=Husqvarna',
  'ford':        'https://via.placeholder.com/320x160/003087/FFFFFF?text=Ford',
  'toyota':      'https://via.placeholder.com/320x160/CC0000/FFFFFF?text=Toyota',
  'default':     'https://via.placeholder.com/320x160/1A1A2E/FFFFFF?text=Vehicule',
};

const FACEBOOK_IMG = 'https://via.placeholder.com/320x160/1877F2/FFFFFF?text=Facebook+Marketplace';
const KIJIJI_IMG   = 'https://via.placeholder.com/320x160/FF6600/FFFFFF?text=Kijiji';

function getBrandLogo(query, brands = []) {
  const lowerQuery = query.toLowerCase();
  for (const brand of brands) {
    if (BRAND_LOGOS[brand]) return BRAND_LOGOS[brand];
  }
  for (const [brand, logo] of Object.entries(BRAND_LOGOS)) {
    if (lowerQuery.includes(brand)) return logo;
  }
  return BRAND_LOGOS['default'];
}

function getMarketplaceLinks(query) {
  const encodedQuery = encodeURIComponent(query);
  return {
    facebookUrl: `https://www.facebook.com/marketplace/search/?query=${encodedQuery}`,
    kijijiUrl: `https://www.kijiji.ca/b-search.html?keywords=${encodedQuery}`,
  };
}

function isVehicleCategory(category) {
  return category === 'vehicules';
}

function isPiecesCategory(category) {
  return category === 'pieces';
}

app.post('/api/search-prices', async (req, res) => {
  try {
    const { query, category, location, radiusKm = 100 } = req.body;
    const userLocation = {
      latitude: location?.latitude || 47.3283,
      longitude: location?.longitude || -79.4338
    };

    // 1. RECHERCHE LOCALE
    const localStores = await searchLocalStores(
      query, category,
      userLocation.latitude, userLocation.longitude,
      radiusKm
    );

    const enrichedStores = await Promise.all(
      localStores.slice(0, category === 'boucherie' ? 8 : 12).map(async (store) => {
        const details = await getStoreDetails(
          store.placeId,
          store.fromLocalDB || false,
          store.fromLocalDB ? store : null
        );
        return {
          ...store,
          website: details.website,
          phone: details.phone,
          type: details.website ? 'local_with_website' : 'local_no_website',
        };
      })
    );

    const maxResults = category === 'boucherie' ? 4 : 8;
    const withWebsite = enrichedStores.filter(s => s.type === 'local_with_website').slice(0, maxResults);
    const withoutWebsite = enrichedStores.filter(s => s.type === 'local_no_website').slice(0, maxResults);

    // 2. PRODUITS ONLINE
    let onlineResults = [];

    if (isVehicleCategory(category)) {
      const { facebookUrl, kijijiUrl } = getMarketplaceLinks(query);
      onlineResults = [
        {
          product_name: `${query} - Usagé sur Facebook Marketplace`,
          price: null,
          store: 'Facebook Marketplace',
          website: facebookUrl,
          affiliate_url: facebookUrl,
          image_url: FACEBOOK_IMG,
          type: 'marketplace',
          badge: 'USAGÉ',
          badge_color: '#1877F2',
        },
        {
          product_name: `${query} - Usagé sur Kijiji`,
          price: null,
          store: 'Kijiji',
          website: kijijiUrl,
          affiliate_url: kijijiUrl,
          image_url: KIJIJI_IMG,
          type: 'marketplace',
          badge: 'USAGÉ',
          badge_color: '#FF6600',
        },
      ];
    } else if (isPiecesCategory(category)) {
      // Pièces & Accessoires : Amazon automotive + Walmart + Kijiji usagé
      const amazonProducts = getAmazonProducts(query, 'vehicules', 2);
      const walmartProducts = getWalmartProducts(query, 'vehicules');
      const { kijijiUrl } = getMarketplaceLinks(query + ' pièces');
      onlineResults = [
        ...amazonProducts,
        ...walmartProducts,
        {
          product_name: `${query} - Pièces usagées sur Kijiji`,
          price: null,
          store: 'Kijiji',
          website: kijijiUrl,
          affiliate_url: kijijiUrl,
          image_url: KIJIJI_IMG,
          type: 'marketplace',
          badge: 'USAGÉ',
          badge_color: '#FF6600',
        },
      ];
    } else if (category === 'boucherie') {
      onlineResults = [];
    } else {
      const amazonProducts = getAmazonProducts(query, category, 1);
      const walmartProducts = getWalmartProducts(query, category);
      onlineResults = [...amazonProducts, ...walmartProducts];
    }

    // 3. RÈGLE DES 8
    const results = [
      ...withWebsite.map(store => ({
        product_name: `${query} - ${store.name}`,
        price: null,
        store: store.name,
        address: store.address,
        distance: `${store.distance} km`,
        phone: store.phone,
        website: store.website,
        latitude: store.latitude,
        longitude: store.longitude,
        type: 'local_with_website',
        rating: store.rating,
        verified: store.fromLocalDB || false,
        partner: store.partner || null,
        image_url: getBrandLogo(query, store.brands || []),
      })),
      ...withoutWebsite.map(store => ({
        product_name: `${query} - ${store.name}`,
        price: null,
        store: store.name,
        address: store.address,
        distance: `${store.distance} km`,
        phone: store.phone,
        website: null,
        latitude: store.latitude,
        longitude: store.longitude,
        type: 'local_no_website',
        rating: store.rating,
        verified: store.fromLocalDB || false,
        partner: store.partner || null,
        image_url: getBrandLogo(query, store.brands || []),
      })),
      ...onlineResults,
    ];

    return res.json({
      success: true,
      count: results.length,
      results: results,
      breakdown: {
        local_with_website: withWebsite.length,
        local_no_website: withoutWebsite.length,
        online: onlineResults.length,
      }
    });

  } catch (error) {
    console.error('Erreur recherche:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ══════ RESTAURANTS ══════
const fs = require('fs');
const RESTAURANTS_PATH = require('path').join(__dirname, 'restaurants.json');

function loadRestaurants() {
  try { return JSON.parse(fs.readFileSync(RESTAURANTS_PATH, 'utf8')); }
  catch(e) { return { restaurants: [] }; }
}

app.get('/api/restaurants', (req, res) => {
  res.json(loadRestaurants());
});

app.get('/api/restaurants/google', async (req, res) => {
  const lat = parseFloat(req.query.lat) || 47.3340;
  const lng = parseFloat(req.query.lng) || -79.4335;
  const rayon = Math.min(parseInt(req.query.rayon) || 45, 45);
  const lang = ['en','es','ar','zh'].includes(req.query.lang) ? req.query.lang : 'fr';
  const { Client } = require('@googlemaps/google-maps-services-js');
  const gClient = new Client({});

  // 1. Nos restos locaux — filtrés par distance
  function calcDistKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2-lat1)*Math.PI/180;
    const dLng = (lng2-lng1)*Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }
  const local = (loadRestaurants().restaurants || [])
    .filter(r => {
      if (!r.latitude || !r.longitude) return false;
      return calcDistKm(lat, lng, r.latitude, r.longitude) <= rayon;
    })
    .map(r => {
      const note = (lang !== 'fr' && r['note_' + lang]) ? r['note_' + lang] : (r.note || '');
      return { ...r, note, source: 'prixmalin' };
    });

  // 2. Google Places
  let googleResults = [];
  try {
    const response = await gClient.placesNearby({
      params: {
        location: { lat, lng },
        radius: Math.min(rayon * 1000, 150000),
        type: 'restaurant',
        key: process.env.GOOGLE_PLACES_API_KEY,
      },
    });
    googleResults = (response.data.results || []).slice(0, 20);
  } catch(e) {
    console.error('Google Places error:', e.message);
  }

  // 3. Dédoublonnage
  function calcDist(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2-lat1)*Math.PI/180;
    const dLng = (lng2-lng1)*Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  const googleFiltered = googleResults.filter(g => {
    const gName = (g.name || '').toLowerCase();
    const gLat = g.geometry?.location?.lat;
    const gLng = g.geometry?.location?.lng;
    return !local.some(l => {
      const lName = (l.name || '').toLowerCase();
      const nameSimilar = gName.includes(lName.substring(0,6)) || lName.includes(gName.substring(0,6));
      const dist = (l.latitude && l.longitude && gLat && gLng)
        ? calcDist(l.latitude, l.longitude, gLat, gLng) : 9999;
      return nameSimilar || dist < 200;
    });
  }).map(g => ({
    id: g.place_id,
    name: g.name,
    address: g.vicinity,
    latitude: g.geometry?.location?.lat,
    longitude: g.geometry?.location?.lng,
    rating: g.rating,
    source: 'google',
  }));

  // 4. Fusionner, max 50
  const combined = [...local, ...googleFiltered].slice(0, 50);
  res.json({ restaurants: combined });
});


app.get('/api/partenaires', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, 'data', 'partenaires.json');
    const partenaires = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    res.json({ success: true, partenaires });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'PrixMalin Backend v5 - Affiliation' });
});


// ══════ COMPTEUR DE CLICS PARTENAIRES ══════
const CLICKS_PATH = require('path').join(__dirname, 'data', 'clicks.json');

function loadClicks() {
  try { return JSON.parse(fs.readFileSync(CLICKS_PATH, 'utf8')); }
  catch(e) { return {}; }
}

function saveClicks(data) {
  fs.writeFileSync(CLICKS_PATH, JSON.stringify(data, null, 2), 'utf8');
}

app.post('/api/clicks/:slug', (req, res) => {
  try {
    const { slug } = req.params;
    const clicks = loadClicks();
    clicks[slug] = (clicks[slug] || 0) + 1;
    saveClicks(clicks);
    res.json({ success: true, slug, clicks: clicks[slug] });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/clicks/:slug', (req, res) => {
  try {
    const { slug } = req.params;
    const clicks = loadClicks();
    res.json({ success: true, slug, clicks: clicks[slug] || 0 });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log('========================================');
  console.log('🚀 PRIXMALIN BACKEND V5 - AFFILIATION');
  console.log('========================================');
  console.log(`✅ Serveur sur port ${PORT}`);
  console.log('========================================');
});

// GEOCODING — Convertir nom de ville en lat/lng (Google Geocoding API)
app.get('/api/geocode', async (req, res) => {
  try {
    const { ville } = req.query;
    if (!ville) return res.status(400).json({ error: 'Paramètre ville requis' });
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Clé Google manquante' });
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(ville + ', Canada')}&key=${apiKey}&language=fr`;
    const response = await fetch(url);
    const data = await response.json();
    if (!data.results || data.results.length === 0) {
      return res.status(404).json({ error: 'Ville non trouvée' });
    }
    const { lat, lng } = data.results[0].geometry.location;
    const nom = data.results[0].formatted_address;
    return res.json({ lat, lng, nom });
  } catch (error) {
    console.error('Erreur geocoding:', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});
