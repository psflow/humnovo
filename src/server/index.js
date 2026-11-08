export { createHumnovo, readBody } from './http.js';
export {
  createChallenge,
  verifySolution,
  issueToken,
  verifyToken,
  decodeToken,
  checkSignals,
  hostnameAllowed,
  normalizeSite,
  generateKeys,
  LEVELS,
  DEFAULT_CHALLENGE_TTL,
  DEFAULT_TOKEN_TTL,
} from './core.js';
export { MemoryStore } from './store.js';
export { buildWidget } from '../build.js';

/**
 * Valida um token chamando um servidor Humnovo remoto (para backends que não
 * rodam o Humnovo no mesmo processo).
 */
export async function verify({ token, secret = process.env.HUMNOVO_SECRET_KEY, apiUrl = process.env.HUMNOVO_API_URL } = {}) {
  if (!apiUrl) throw new TypeError('Humnovo: informe apiUrl ou a variável HUMNOVO_API_URL.');
  if (!token) return { success: false, error: 'missing-token' };
  const res = await fetch(`${String(apiUrl).replace(/\/+$/, '')}/v1/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, token }),
  });
  return res.json();
}
