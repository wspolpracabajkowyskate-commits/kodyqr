// Resolve a Google Maps URL, place name, CID or Place ID.
// Endpoint and response fields follow the published ZnajdzPlaceID API v2 docs.
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, error: { message: 'Method not allowed' } });
  }

  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!query || query.length > 2048) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_QUERY', message: 'Wklej link do wizytówki Google albo nazwę firmy i miasto.' } });
  }

  // /search explicitly accepts names, Google Maps URLs, CIDs and Place IDs.
  // /all is the documented universal resolver and is used as a fallback.
  const endpoints = [
    { path: '/api/search', key: 'query' },
    { path: '/api/all', key: 'url' }
  ];
  let lastMessage = '';
  let serviceUnavailable = false;

  for (const item of endpoints) {
    try {
      const url = new URL(item.path, 'https://znajdzplaceid.pl');
      url.searchParams.set(item.key, query);
      const response = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'KodyQR/1.3' },
        redirect: 'follow',
        signal: AbortSignal.timeout(12000)
      });

      let payload = null;
      try { payload = await response.json(); } catch (_) {}
      if (!response.ok) {
        const message = payload && payload.error && payload.error.message;
        lastMessage = message || ('Lookup returned HTTP ' + response.status);
        if (response.status === 429 || response.status >= 500) serviceUnavailable = true;
        // 400 is documented as "no match" for /search. Try /all before deciding.
        continue;
      }

      const data = payload && payload.data;
      if (!payload || !payload.success || !data) {
        lastMessage = (payload && payload.error && payload.error.message) || 'The lookup service returned no place data.';
        continue;
      }

      const placeId = data.place_id || data.placeId || (data.details && data.details.place_id);
      if (!placeId) {
        lastMessage = 'The lookup service found a result but did not return a Place ID.';
        continue;
      }
      const details = data.details || {};
      return res.status(200).json({
        success: true,
        data: {
          place_id: placeId,
          name: data.name || details.name || details.nazwa_wizytowki || '',
          address: data.address || details.address || details.adres || '',
          alternatives: Array.isArray(data.alternatives) ? data.alternatives : [],
          source: data.type || data.source || ''
        }
      });
    } catch (error) {
      serviceUnavailable = true;
      lastMessage = error && error.name === 'TimeoutError'
        ? 'Przekroczono czas oczekiwania na bazę miejsc.'
        : 'Nie udało się połączyć z bazą miejsc.';
    }
  }

  const notFound = !serviceUnavailable;
  return res.status(notFound ? 404 : 503).json({
    success: false,
    error: {
      code: notFound ? 'PLACE_NOT_FOUND' : 'PLACE_LOOKUP_UNAVAILABLE',
      message: notFound
        ? 'Nie znaleziono jednoznacznej wizytówki dla podanego adresu. Spróbuj wpisać nazwę firmy wraz z miastem.'
        : 'Zewnętrzna baza miejsc jest chwilowo niedostępna. Spróbuj ponownie za chwilę.',
      detail: lastMessage
    }
  });
};
