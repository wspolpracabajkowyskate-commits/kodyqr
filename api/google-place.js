// Resolve a public Google Maps profile URL or place name to a Place ID.
// Fixed upstream hosts and paths only; never acts as an open proxy.
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, error: { message: 'Method not allowed' } });
  }
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!query || query.length > 2048) {
    return res.status(400).json({ success: false, error: { message: 'Wklej link do wizytówki Google lub nazwę firmy.' } });
  }

  const attempts = [
    async () => {
      const url = new URL('https://znajdzplaceid.pl/api/search');
      url.searchParams.set('query', query);
      return fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'KodyQR/1.1' }, signal: AbortSignal.timeout(9000) });
    },
    async () => {
      const url = new URL('https://www.znajdzplaceid.pl/api/search');
      url.searchParams.set('query', query);
      return fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'KodyQR/1.1' }, signal: AbortSignal.timeout(9000) });
    },
    async () => {
      const url = new URL('https://znajdzplaceid.pl/api/all');
      url.searchParams.set('url', query);
      return fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'KodyQR/1.1' }, signal: AbortSignal.timeout(9000) });
    },
    async () => {
      const url = new URL('https://znajdzplaceid.pl/api/');
      url.searchParams.set('endpoint', 'search');
      url.searchParams.set('query', query);
      return fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'KodyQR/1.1' }, signal: AbortSignal.timeout(9000) });
    }
  ];

  let lastStatus = 0;
  for (const attempt of attempts) {
    try {
      const response = await attempt();
      lastStatus = response.status;
      if (!response.ok) continue;
      const payload = await response.json();
      const d = payload && payload.data;
      const placeId = d && (d.place_id || (d.details && d.details.place_id));
      if (payload && payload.success && d && placeId) {
        const details = d.details || {};
        return res.status(200).json({
          success: true,
          data: {
            place_id: placeId,
            name: d.name || details.name || '',
            address: d.address || details.address || '',
            alternatives: Array.isArray(d.alternatives) ? d.alternatives : []
          }
        });
      }
      // A valid API response without a match is definitive; don't repeat the same lookup.
      if (payload && payload.success === false && response.status >= 400 && response.status < 500) {
        return res.status(404).json({ success: false, error: { message: 'Nie znaleziono wizytówki. Spróbuj wkleić pełny link z Google Maps albo nazwę firmy z miastem.' } });
      }
    } catch (_) {
      // Try the documented www and /all variants before returning a service error.
    }
  }
  return res.status(503).json({
    success: false,
    error: {
      code: 'PLACE_LOOKUP_UNAVAILABLE',
      message: lastStatus ? 'Baza miejsc Google jest chwilowo niedostępna. Spróbuj ponownie za chwilę albo użyj oficjalnego linku Google.' : 'Nie udało się połączyć z bazą miejsc. Spróbuj ponownie albo użyj oficjalnego linku Google.'
    }
  });
};
