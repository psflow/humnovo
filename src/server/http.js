/**
 * Handler HTTP do Humnovo. Funciona com `node:http` puro e também como
 * middleware do Express/Connect: `app.use('/humnovo', createHumnovo({...}))`.
 *
 * Rotas:
 *   GET  /v1/challenge?sitekey=...   (público, CORS)
 *   POST /v1/solve                   (público, CORS)
 *   POST /v1/verify  {secret, token} (servidor -> servidor)
 *   GET  /widget.js
 *   GET  /health
 */
import {
  createChallenge,
  verifySolution,
  issueToken,
  verifyToken,
  decodeToken,
  hostnameAllowed,
  normalizeSite,
  safeEqual,
  DEFAULT_TOKEN_TTL,
} from './core.js';
import { MemoryStore } from './store.js';
import { buildWidget } from '../build.js';

const BODY_LIMIT = 16 * 1024;

class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

function parseBody(text, contentType = '') {
  if (!text) return {};
  if (contentType.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(text));
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'invalid-body');
  }
}

/** Lê o corpo da requisição (JSON ou form-urlencoded), respeitando body-parsers já aplicados. */
export function readBody(req, limit = BODY_LIMIT) {
  const ct = String(req.headers['content-type'] || '');
  if (typeof req.body === 'string') return Promise.resolve(parseBody(req.body, ct));
  if (Buffer.isBuffer(req.body)) return Promise.resolve(parseBody(req.body.toString('utf8'), ct));
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length) return Promise.resolve(req.body);
  if (req.readableEnded) return Promise.resolve({});
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) tooLarge = true;
      else chunks.push(c);
    });
    req.on('end', () => {
      if (tooLarge) return reject(new HttpError(413, 'payload-too-large'));
      try {
        resolve(parseBody(Buffer.concat(chunks).toString('utf8'), ct));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function hostnameOf(req) {
  const value = req.headers.origin || req.headers.referer;
  if (!value || value === 'null') return '';
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function send(res, status, data, headers = {}) {
  const isText = typeof data === 'string';
  const body = isText ? data : JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': isText ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(body);
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

/**
 * Cria o handler do Humnovo.
 * @param {object} options
 * @param {Array<{siteKey: string, secret: string, hostnames?: string[]|string, level?: 'low'|'medium'|'high', maxNumber?: number}>} options.sites
 * @param {{consume(key: string, expiresAt: number, now: number): boolean|Promise<boolean>}} [options.store]
 * @param {number} [options.tokenTtl]  validade do token em segundos (padrão 300)
 */
export function createHumnovo(options = {}) {
  const sites = new Map();
  for (const s of options.sites || []) {
    const site = normalizeSite(s);
    sites.set(site.siteKey, site);
  }
  const store = options.store || new MemoryStore();
  const tokenTtl = options.tokenTtl ?? DEFAULT_TOKEN_TTL;
  let widget;

  function siteFor(siteKey, hostname) {
    const site = sites.get(String(siteKey || ''));
    if (!site) throw new HttpError(400, 'invalid-sitekey');
    if (hostname && !hostnameAllowed(site, hostname)) throw new HttpError(403, 'invalid-hostname');
    return site;
  }

  /** Valida um token no próprio processo (sem chamada HTTP). Consome o token. */
  async function verify(token, secret) {
    const payload = decodeToken(token);
    const site = payload && sites.get(payload.k);
    if (!site) return { success: false, error: 'invalid-token' };
    if (secret !== undefined && !safeEqual(secret, site.secret)) return { success: false, error: 'invalid-secret' };
    return verifyToken(site, token, { store });
  }

  async function route(req, res, path) {
    const method = req.method || 'GET';
    const isPublic = path === '/v1/challenge' || path === '/v1/solve';
    if (method === 'OPTIONS' && isPublic) {
      res.writeHead(204, CORS);
      return res.end();
    }

    if (path === '/v1/challenge' && method === 'GET') {
      const url = new URL(req.url, 'http://localhost');
      const site = siteFor(url.searchParams.get('sitekey'), hostnameOf(req));
      return send(res, 200, createChallenge(site), CORS);
    }

    if (path === '/v1/solve' && method === 'POST') {
      const body = await readBody(req);
      const hostname = hostnameOf(req);
      const site = siteFor(body.siteKey, hostname);
      if (site.hostnames.length && !hostname) throw new HttpError(403, 'invalid-hostname');
      const result = await verifySolution(site, body, { store });
      if (!result.success) return send(res, 400, result, CORS);
      return send(res, 200, { success: true, ...issueToken(site, { hostname, ttl: tokenTtl }) }, CORS);
    }

    if (path === '/v1/verify' && method === 'POST') {
      const body = await readBody(req);
      const token = body.token ?? body.response ?? body['humnovo-token'];
      if (typeof body.secret !== 'string' || typeof token !== 'string') {
        return send(res, 400, { success: false, error: 'invalid-input' });
      }
      return send(res, 200, await verify(token, body.secret));
    }

    if (path === '/widget.js' && (method === 'GET' || method === 'HEAD')) {
      widget ??= buildWidget();
      return send(res, 200, widget, {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      });
    }

    if (path === '/health' && method === 'GET') return send(res, 200, { ok: true });
    return false;
  }

  async function handler(req, res, next) {
    const path = new URL(req.url || '/', 'http://localhost').pathname.replace(/\/+$/, '') || '/';
    try {
      const handled = await route(req, res, path);
      if (handled === false) {
        if (typeof next === 'function') return next();
        send(res, 404, { success: false, error: 'not-found' });
      }
    } catch (err) {
      if (err instanceof HttpError) {
        const cors = path === '/v1/challenge' || path === '/v1/solve' ? CORS : {};
        return send(res, err.status, { success: false, error: err.code }, cors);
      }
      if (typeof next === 'function') return next(err);
      send(res, 500, { success: false, error: 'internal-error' });
    }
  }

  handler.verify = verify;
  handler.sites = sites;
  handler.store = store;
  handler.close = () => store.close?.();
  return handler;
}
