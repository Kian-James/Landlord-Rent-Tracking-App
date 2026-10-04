import morgan from 'morgan';

// One line per API request, printed when the response finishes:
//
//   22:41:07  POST   /api/auth/login                    200  206.5 ms  292 B
//   22:41:08  GET    /api/units?propertyId=abc          304   12.1 ms  -
//   22:41:09  GET    /api/nope                          404    0.5 ms  34 B
//
// time, method, full URL (with query string), status, response time, size.
// The size is "-" when there is none (e.g. on a 304).
//
// Colours: the status code is coloured by class (2xx green, 3xx cyan,
// 4xx yellow, 5xx red) and slow responses stand out in the time column.
// Colours are only used when writing to a terminal, so hosted logs (Vercel
// etc.) stay plain text. Set NO_COLOR=1 to turn them off, FORCE_COLOR=1 to
// turn them on. Silent when NODE_ENV is "test" so scripts get no log noise.

const useColor = () => {
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR) return process.env.FORCE_COLOR !== '0';
  return Boolean(process.stdout.isTTY);
};

const ANSI = { reset: 0, bold: 1, dim: 2, red: 31, green: 32, yellow: 33, cyan: 36 };
const paint = (text, ...styles) => (useColor() ? `\x1b[${styles.map((s) => ANSI[s]).join(';')}m${text}\x1b[0m` : text);

const statusColor = (status) => (status >= 500 ? 'red' : status >= 400 ? 'yellow' : status >= 300 ? 'cyan' : 'green');
const timeColor = (ms) => (ms >= 1000 ? 'red' : ms >= 500 ? 'yellow' : 'dim');

const clock = () => new Date().toLocaleTimeString('en-GB', { hour12: false });

const formatSize = (bytes) => {
  const n = Number(bytes);
  if (!Number.isFinite(n)) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

const requestLogger = morgan(
  (tokens, req, res) => {
    const status = Number(tokens.status(req, res)) || 0;
    const ms = Number(tokens['response-time'](req, res)) || 0;

    return [
      paint(clock(), 'dim'),
      paint(tokens.method(req, res).padEnd(6), 'bold'),
      tokens.url(req, res).padEnd(40),
      paint(String(status || '---').padStart(3), statusColor(status), 'bold'),
      paint(`${ms.toFixed(1).padStart(7)} ms`, timeColor(ms)),
      paint(formatSize(tokens.res(req, res, 'content-length')), 'dim'),
    ].join('  ');
  },
  { skip: () => process.env.NODE_ENV === 'test' }
);

export default requestLogger;
