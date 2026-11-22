// Resolve Google Business Profiles into review links.
// Accepts Place IDs, official review links, g.page links, Google Maps URLs,
// and business name + city. Direct identifiers never depend on a third party.
const PLACE_ID = /(?:ChIJ|GhIJ|Ei[A-Za-z0-9_-]{8,})[A-Za-z0-9_-]{8,}/;
const isPlaceId = value => /^(?:ChIJ|GhIJ|Ei[A-Za-z0-9_-]{8,})[A-Za-z0-9_-]{8,}$/.test(String(value || '').trim());
const reviewUrl = id => 'https://search.google.com/local/writereview?placeid=' + encodeURIComponent(id);
const clean = value => String(value || '').trim();

function decodeUrl(value) {
  try { return decodeURIComponent(value); } catch (_) { return value; }
}
function extractPlaceId(value) {
  const raw = clean(value);
  if (isPlaceId(raw)) return raw;
  let url;
  try { url = new URL(raw); } catch (_) { return null; }
  for (const key of ['placeid','place_id','query_place_id']) {
    const candidate = url.searchParams.get(key);
    if (candidate && isPlaceId(candidate)) return candidate;
  }
  const decoded = decodeUrl(url.href);
  const match = decoded.match(/(?:!1s|!19s|place_id[:=]|placeid=|query_place_id=)(ChIJ|GhIJ|Ei[A-Za-z0-9_-]{8,})[A-Za-z0-9_-]{8,}/i)
    || decoded.match(/(ChIJ|GhIJ|Ei[A-Za-z0-9_-]{8,})[A-Za-z0-9_-]{8,}/);
  return match ? match[0].replace(/^(?:!1s|!19s|place_id[:=]|placeid=|query_place_id=)/i,'') : null;
}
function searchTextFromUrl(value) {
  try {
    const url = new URL(value);
    const q = url.searchParams.get('query') || url.searchParams.get('q') || url.searchParams.get('destination') || '';
    return q.replace(/^place_id:/i,'').trim();
  } catch (_) { return ''; }
}
function normalizePlace(data) {
  if (!data || typeof data !== 'object') return null;
  const details = data.details || {};
  const id = data.place_id || data.placeId || data.id || details.place_id || details.placeId;
  if (!id || !isPlaceId(id)) return null;
  return {
    place_id: id,
    name: clean(data.name || data.displayName || details.name || details.nazwa_wizytowki),
    address: clean(data.address || data.formattedAddress || details.address || details.adres),
    source: clean(data.type || data.source || 'place_search')
  };
}
function normalizeText(value) {
  return clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
}
function requestedCity(query) {
  const parts = clean(query).split(',').map(x=>x.trim()).filter(Boolean);
  if (parts.length < 2) return '';
  const last = normalizeText(parts[parts.length-1]);
  if (/^(polska|poland|usa|united states|uk|niemcy|germany|czechy|czech republic)$/.test(last)) return parts[parts.length-2];
  return parts[parts.length-1];
}
async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'KodyQR/2.0 (+https://kodyqr-zeta.vercel.app)' },
    redirect: 'follow',
    signal: AbortSignal.timeout(9000)
  });
  let payload = null;
  try { payload = await response.json(); } catch (_) {}
  return { response, payload };
}
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success:false, error:{ code:'METHOD_NOT_ALLOWED', message:'Method not allowed' } });
  }
  let query = clean(req.query.q);
  if (!query || query.length > 2048) return res.status(400).json({ success:false, error:{code:'INVALID_QUERY',message:'Wklej link do wizytówki Google, Place ID albo nazwę firmy i miasto.'} });

  // Resolve direct identifiers locally. No network call and no 404 possible.
  let id = extractPlaceId(query);
  if (id) return res.status(200).json({success:true,data:{place_id:id,name:'',address:'',alternatives:[],source:'direct_place_id',review_url:reviewUrl(id)}});

  let parsed;
  let originalShortLink = '';
  let expandedShortLink = '';
  try { parsed = new URL(query); } catch (_) {}
  if (parsed) {
    const host = parsed.hostname.toLowerCase();
    if (host === 'g.page' || host.endsWith('.g.page')) {
      const match = parsed.pathname.match(/^\/r\/([^/]+)/);
      if (match) {
        const url = 'https://g.page/r/' + match[1] + '/review';
        return res.status(200).json({success:true,data:{place_id:'',name:'',address:'',alternatives:[],source:'official_g_page',review_url:url}});
      }
    }
    if (host === 'search.google.com' && /local\/writereview/.test(parsed.pathname) && parsed.searchParams.get('placeid')) {
      return res.status(200).json({success:true,data:{place_id:parsed.searchParams.get('placeid'),name:'',address:'',alternatives:[],source:'official_review_link',review_url:query}});
    }
    // Google now shares Business Profiles through share.google short links too.
    // Resolve only known Google short-link hosts and retain both URLs for fallbacks.
    if (/^(maps\.app\.goo\.gl|goo\.gl|g\.co|share\.google)$/.test(host)) {
      originalShortLink = query;
      try {
        const expanded = await fetch(query, {
          redirect:'follow',
          signal:AbortSignal.timeout(9000),
          headers:{'User-Agent':'Mozilla/5.0 (compatible; KodyQR/2.0)','Accept':'text/html,application/xhtml+xml'}
        });
        if (expanded.url && expanded.url !== query) {
          const finalUrl = new URL(expanded.url);
          const finalHost = finalUrl.hostname.toLowerCase();
          // Never treat a redirect to an unrelated domain as a Google profile.
          if (finalHost === 'google.com' || finalHost.endsWith('.google.com') || finalHost === 'googleusercontent.com' || finalHost.endsWith('.googleusercontent.com')) {
            expandedShortLink = expanded.url;
            const expandedId = extractPlaceId(expanded.url);
            if (expandedId) return res.status(200).json({success:true,data:{place_id:expandedId,name:'',address:'',alternatives:[],source:'expanded_google_share_link',review_url:reviewUrl(expandedId)}});
            const q = finalUrl.searchParams.get('q') || finalUrl.searchParams.get('query') || finalUrl.searchParams.get('query_place_id') || '';
            if (q && !/^https?:\/\//i.test(q)) query = q;
            else query = expanded.url;
            parsed = finalUrl;
            // Some Google share links lead to a search result page containing a Maps URL.
            try {
              const page = await expanded.text();
              const decodedPage = decodeUrl(page.replace(/\\u003d/g,'=').replace(/\\u0026/g,'&').replace(/&amp;/g,'&'));
              const pageId = extractPlaceId(decodedPage);
              if (pageId) return res.status(200).json({success:true,data:{place_id:pageId,name:'',address:'',alternatives:[],source:'expanded_google_share_page',review_url:reviewUrl(pageId)}});
              const mapsLink = decodedPage.match(/https?:\\?\/\\?\/(?:www\\?\.)?google\\?\.com\\?\/maps\\?\/[^"'<>\\s]+/i);
              if (mapsLink) {
                const cleanMapsLink = mapsLink[0].replace(/\\\\/g,'').replace(/\\u0026/g,'&');
                const mapsId = extractPlaceId(cleanMapsLink);
                if (mapsId) return res.status(200).json({success:true,data:{place_id:mapsId,name:'',address:'',alternatives:[],source:'expanded_google_share_page',review_url:reviewUrl(mapsId)}});
                query = cleanMapsLink;
              }
            } catch (_) {}
          }
        }
      } catch (_) {
        // Google may block server-side expansion; try the universal resolver with the original URL.
      }
    }
    const mapQuery = searchTextFromUrl(query);
    if (mapQuery) query = mapQuery;
  }

  // Official Google Places API (New), when an API key is configured by the site owner.
  // places.id is the Essentials ID-only field; displayName/address are requested only
  // when we need to present candidates for user confirmation.
  const googleKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
  if (googleKey) {
    try {
      const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method:'POST',
        headers:{'Content-Type':'application/json','X-Goog-Api-Key':googleKey,'X-Goog-FieldMask':'places.id,places.displayName,places.formattedAddress,places.googleMapsLinks.writeAReviewUri'},
        body:JSON.stringify({textQuery:query,languageCode:'pl',regionCode:'PL'}),
        signal:AbortSignal.timeout(9000)
      });
      const payload = await response.json();
      const places = Array.isArray(payload.places) ? payload.places : [];
      const candidates = places.map(p=>({place_id:p.id,name:p.displayName && p.displayName.text || '',address:p.formattedAddress || '',review_url:p.googleMapsLinks && p.googleMapsLinks.writeAReviewUri || '',source:'google_places'})).filter(p=>isPlaceId(p.place_id));
      if (candidates.length) {
        const city = requestedCity(query);
        const sorted = city ? candidates.sort((a,b)=>Number(normalizeText(b.address).includes(normalizeText(city)))-Number(normalizeText(a.address).includes(normalizeText(city)))) : candidates;
        return res.status(200).json({success:true,data:{...sorted[0],alternatives:sorted.slice(1,5),review_url:sorted[0].review_url || reviewUrl(sorted[0].place_id)}});
      }
    } catch (_) { /* use secondary resolver below */ }
  }

  // Secondary resolver: name search first, universal URL resolver second.
  const attempts = [
    ...(originalShortLink ? [
      {path:'/api/all',key:'url',value:originalShortLink},
      ...(expandedShortLink ? [{path:'/api/all',key:'url',value:expandedShortLink}] : [])
    ] : []),
    {path:'/api/search',key:'query',value:query},
    {path:'/api/all',key:'url',value:query}
  ];
  let lastStatus = 0, lastDetail = '', unavailable = false;
  for (const attempt of attempts) {
    try {
      const endpoint = new URL(attempt.path,'https://znajdzplaceid.pl');
      endpoint.searchParams.set(attempt.key,attempt.value);
      const {response,payload} = await fetchJson(endpoint.toString());
      lastStatus = response.status;
      if (!response.ok) {
        lastDetail = payload && payload.error && payload.error.message || 'HTTP ' + response.status;
        if (response.status === 429 || response.status >= 500) unavailable = true;
        continue;
      }
      const root = payload && (payload.data || payload.result || payload);
      const candidatesRaw = root && (root.alternatives || root.results || root.places);
      const allCandidates = [normalizePlace(root), ...(Array.isArray(candidatesRaw) ? candidatesRaw.map(normalizePlace) : [])]
        .filter((p,i,arr)=>p && arr.findIndex(x=>x && x.place_id===p.place_id)===i);
      if (!allCandidates.length) {
        lastDetail = payload && payload.error && payload.error.message || 'Resolver did not return a Place ID.';
        continue;
      }
      const requestedName = clean(query).split(',')[0].replace(/^https?:\/\//i,'').trim();
      const ignored = new Set(['firma','company','salon','sklep','restauracja','restaurant','hotel','gabinet','uslugi','usługi','the','google','maps']);
      const nameTokens = normalizeText(requestedName).split(/[^a-z0-9]+/).filter(t=>t.length>1 && !ignored.has(t));
      const city = requestedCity(query);
      const ranked = allCandidates.map(p=>{
        const candidate = normalizeText(p.name);
        const matchedTokens = nameTokens.filter(t=>candidate.includes(t));
        const nameScore = nameTokens.length ? matchedTokens.length/nameTokens.length : 1;
        const locationMatched = !city || normalizeText(p.address).includes(normalizeText(city));
        return {...p,name_score:nameScore,location_matched:locationMatched};
      }).filter(p=>!nameTokens.length || p.name_score>0)
        .sort((a,b)=>(b.name_score-a.name_score) || (Number(b.location_matched)-Number(a.location_matched)));
      if (!ranked.length) {
        lastDetail = 'Wynik wyszukiwania nie pasuje nazwą do zapytania.';
        continue;
      }
      const first = ranked[0];
      const alternatives = ranked.slice(1,6);
      return res.status(200).json({success:true,data:{...first,alternatives,location_matched:first.location_matched,review_url:reviewUrl(first.place_id)}});
    } catch (error) {
      unavailable = true;
      lastDetail = error && error.name === 'TimeoutError' ? 'Przekroczono czas oczekiwania na bazę miejsc.' : 'Nie udało się połączyć z bazą miejsc.';
    }
  }
  const status = unavailable ? 503 : 404;
  return res.status(status).json({
    success:false,
    error:{
      code:unavailable?'PLACE_LOOKUP_UNAVAILABLE':'PLACE_NOT_FOUND',
      message:unavailable
        ? 'Automatyczne wyszukiwanie jest chwilowo niedostępne. Wklej Place ID albo oficjalny link „Poproś o opinie”.'
        : 'Nie znaleziono pasującej wizytówki. Dopisz miasto i kraj albo wklej link udostępniania profilu Google.',
      detail:lastDetail,
      upstream_status:lastStatus
    }
  });
};
