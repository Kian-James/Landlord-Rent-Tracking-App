const store = new Map();

export function getCached(key) {
  return store.get(key)?.data;
}

export function setCached(key, data) {
  store.set(key, { data, savedAt: Date.now() });
}

export function invalidate(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function cacheKey(url, params) {
  return params ? `${url}?${JSON.stringify(params)}` : url;
}