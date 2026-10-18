'use strict';

/** Create an Error that carries an HTTP status (and optional field details). */
function httpError(status, message, details) {
  const err = new Error(message);
  err.status = status;
  if (details) err.details = details;
  return err;
}

/** Wrap async route handlers so rejected promises reach the error handler. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Small security headers (no extra dependency needed for an API). */
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  next();
}

/**
 * CORS so the HireTrail frontend (e.g. on GitHub Pages) can call this API
 * from a different origin. Set ALLOWED_ORIGINS="https://you.github.io" in
 * production; the default "*" is fine for local development.
 */
function cors(allowedOrigins = '*') {
  const list = allowedOrigins === '*' ? ['*'] : allowedOrigins.split(',').map((s) => s.trim());
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (list.includes('*')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    } else if (origin && list.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Expose-Headers', 'Location,Retry-After');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  };
}

/**
 * Fixed-window, in-memory rate limiter: 429 Too Many Requests when a client
 * exceeds `max` requests per `windowMs`. (Per-process; fine for a single instance.)
 */
function rateLimit({ windowMs = 60_000, max = 100 } = {}) {
  const hits = new Map(); // ip -> { count, resetAt }

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [ip, rec] of hits) if (rec.resetAt <= now) hits.delete(ip);
  }, windowMs);
  sweep.unref(); // never keep the process alive just for cleanup

  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    let rec = hits.get(ip);
    if (!rec || rec.resetAt <= now) {
      rec = { count: 0, resetAt: now + windowMs };
      hits.set(ip, rec);
    }
    rec.count += 1;

    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - rec.count)));

    if (rec.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((rec.resetAt - now) / 1000)));
      return next(httpError(429, 'Too many requests. Please slow down and retry shortly.'));
    }
    next();
  };
}

/** Writes with a body must declare JSON, otherwise 415 Unsupported Media Type. */
function requireJson(req, res, next) {
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && !req.is('application/json')) {
    return next(httpError(415, 'Content-Type must be application/json.'));
  }
  next();
}

/** Any URL we do not serve. */
function notFound(req, res, next) {
  next(httpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

/**
 * One place that turns every failure into a consistent JSON error:
 *   { "error": { "status": 400, "message": "...", "details": [...] } }
 * Internal details (stack traces, file paths) are logged, never sent to clients.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.status || err.statusCode || 500;
  let message = err.message;
  let details = err.details;

  // body-parser errors
  if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Request body is not valid JSON.';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Request body is too large.';
  }

  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
    message = 'Internal server error.';
    details = undefined;
  }

  if (res.headersSent) return next(err);
  res.status(status).json({ error: { status, message, ...(details ? { details } : {}) } });
}

module.exports = {
  httpError,
  asyncHandler,
  securityHeaders,
  cors,
  rateLimit,
  requireJson,
  notFound,
  errorHandler,
};
