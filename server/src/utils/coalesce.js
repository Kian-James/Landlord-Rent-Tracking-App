// If the same work is already running (a dashboard, a notification poll and a
// rent list all asking at once), share that one run instead of starting more.
const running = new Map();

export function coalesce(key, work) {
  if (running.has(key)) return running.get(key);
  const promise = Promise.resolve()
    .then(work)
    .finally(() => running.delete(key));
  running.set(key, promise);
  return promise;
}

// Run `work` at most once per `ms` for this key (per server instance). Returns
// true if it ran. For housekeeping that doesn't need to repeat on every request.
const lastRun = new Map();

export async function everyAtMost(key, ms, work) {
  const now = Date.now();
  if (lastRun.has(key) && now - lastRun.get(key) < ms) return false;
  lastRun.set(key, now);
  if (lastRun.size > 2000) {
    for (const [k, t] of lastRun) if (now - t > ms) lastRun.delete(k);
  }
  try {
    await work();
  } catch (err) {
    lastRun.delete(key); // let the next request try again
    throw err;
  }
  return true;
}
