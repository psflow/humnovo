/**
 * Humnovo — núcleo de verificação (sem dependências, apenas node:crypto).
 *
 * Fluxo:
 *  1. createChallenge()  -> desafio de prova de trabalho assinado com HMAC (stateless)
 *  2. verifySolution()   -> confere assinatura, expiração, PoW, sinais e uso único
 *  3. issueToken()       -> token assinado, curto e de uso único entregue ao navegador
 *  4. verifyToken()      -> o backend do site valida o token
 */
import crypto from 'node:crypto';

export const DEFAULT_CHALLENGE_TTL = 120; // segundos
export const DEFAULT_TOKEN_TTL = 300; // segundos

/** Níveis de segurança: dificuldade do PoW e rigor dos sinais de interação. */
export const LEVELS = Object.freeze({
  low: Object.freeze({ maxNumber: 20000, requireInteraction: false, minElapsedMs: 0, minPointerMoves: 0 }),
  medium: Object.freeze({ maxNumber: 80000, requireInteraction: true, minElapsedMs: 300, minPointerMoves: 1 }),
  high: Object.freeze({ maxNumber: 250000, requireInteraction: true, minElapsedMs: 800, minPointerMoves: 3 }),
});

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest('base64url');
const randomHex = (bytes) => crypto.randomBytes(bytes).toString('hex');

export function safeEqual(a, b) {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

const fail = (error) => ({ success: false, error });

/** Gera um par de chaves (pública para o widget, secreta para o backend). */
export function generateKeys() {
  return {
    siteKey: `hn_pk_${randomHex(12)}`,
    secret: `hn_sk_${crypto.randomBytes(32).toString('base64url')}`,
  };
}

/** Valida e normaliza a configuração de um site. */
export function normalizeSite(site) {
  if (!site || typeof site.siteKey !== 'string' || !site.siteKey) {
    throw new TypeError('Humnovo: cada site precisa de "siteKey".');
  }
  if (typeof site.secret !== 'string' || site.secret.length < 16) {
    throw new TypeError(`Humnovo: o site "${site.siteKey}" precisa de "secret" com pelo menos 16 caracteres.`);
  }
  const level = site.level || 'medium';
  if (!LEVELS[level]) throw new TypeError(`Humnovo: nível inválido "${level}" (use low, medium ou high).`);
  const hostnames = (Array.isArray(site.hostnames) ? site.hostnames : String(site.hostnames || '').split(','))
    .map((h) => String(h).trim().toLowerCase())
    .filter(Boolean);
  return Object.freeze({ ...site, level, hostnames });
}

function levelOf(site) {
  return LEVELS[site.level] || LEVELS.medium;
}

/** Hostnames aceitos. Lista vazia = qualquer um. Suporta curinga "*.exemplo.com". */
export function hostnameAllowed(site, hostname) {
  if (!site.hostnames || site.hostnames.length === 0) return true;
  if (!hostname) return false;
  const h = hostname.toLowerCase();
  return site.hostnames.some((p) => p === h || (p.startsWith('*.') && h.endsWith(p.slice(1))));
}

const challengeSignature = (site, salt, challenge, maxNumber) =>
  hmac(site.secret, ['c', site.siteKey, salt, challenge, maxNumber].join('|'));

/** Cria um desafio: o cliente precisa achar `n` em [0, maxNumber] tal que sha256(salt + n) === challenge. */
export function createChallenge(site, { now = Date.now() } = {}) {
  const maxNumber = site.maxNumber ?? levelOf(site).maxNumber;
  const expires = now + (site.challengeTtl ?? DEFAULT_CHALLENGE_TTL) * 1000;
  const salt = `${randomHex(12)}.${expires}`;
  const challenge = sha256(salt + crypto.randomInt(0, maxNumber + 1));
  return {
    algorithm: 'SHA-256',
    siteKey: site.siteKey,
    salt,
    challenge,
    maxNumber,
    expires,
    signature: challengeSignature(site, salt, challenge, maxNumber),
  };
}

/**
 * Avalia sinais de interação enviados pelo widget. São apenas contadores e
 * booleanos (nada de fingerprint). Podem ser forjados por um atacante dedicado;
 * servem para filtrar automações baratas — o custo real vem do PoW.
 */
export function checkSignals(site, signals) {
  const s = signals && typeof signals === 'object' ? signals : {};
  const level = levelOf(site);
  if (s.wd === true) return fail('automation-detected');
  if (!level.requireInteraction) return { success: true };
  if (s.it !== true) return fail('untrusted-event');
  if (!(Number(s.el) >= level.minElapsedMs)) return fail('too-fast');
  const interacted = s.kb === true || s.tc === true || Number(s.pm) >= level.minPointerMoves;
  if (!interacted) return fail('no-interaction');
  return { success: true };
}

/** Confere a solução enviada pelo widget. */
export async function verifySolution(site, solution, { store, now = Date.now() } = {}) {
  const sol = solution && typeof solution === 'object' ? solution : {};
  const { salt, challenge, signature } = sol;
  const number = Number(sol.number);
  const maxNumber = Number(sol.maxNumber);
  if (
    typeof salt !== 'string' ||
    typeof challenge !== 'string' ||
    typeof signature !== 'string' ||
    !Number.isSafeInteger(number) ||
    !Number.isSafeInteger(maxNumber)
  ) {
    return fail('invalid-input');
  }
  if (!safeEqual(signature, challengeSignature(site, salt, challenge, maxNumber))) return fail('invalid-signature');
  const expires = Number(salt.split('.')[1]);
  if (!Number.isFinite(expires) || expires < now) return fail('challenge-expired');
  if (number < 0 || number > maxNumber || sha256(salt + number) !== challenge) return fail('invalid-solution');
  const signals = checkSignals(site, sol.signals);
  if (!signals.success) return signals;
  if (store && !(await store.consume(`c:${challenge}`, expires, now))) return fail('challenge-reused');
  return { success: true };
}

/** Emite o token entregue ao navegador (formato: base64url(payload).assinatura). */
export function issueToken(site, { hostname = '', now = Date.now(), ttl = DEFAULT_TOKEN_TTL } = {}) {
  const payload = { v: 1, k: site.siteKey, h: hostname, t: now, e: now + ttl * 1000, n: randomHex(12) };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return { token: `${body}.${hmac(site.secret, `t|${body}`)}`, expires: payload.e, expiresIn: ttl };
}

/** Lê o payload do token SEM validar a assinatura (útil para descobrir o site). */
export function decodeToken(token) {
  if (typeof token !== 'string' || token.length > 2048) return null;
  const [body, sig, extra] = token.split('.');
  if (!body || !sig || extra !== undefined) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
}

/** Valida um token. Por padrão o token é consumido (uso único). */
export async function verifyToken(site, token, { store, now = Date.now(), consume = true } = {}) {
  const payload = decodeToken(token);
  if (!payload) return fail('invalid-token');
  const [body, sig] = token.split('.');
  if (!safeEqual(sig, hmac(site.secret, `t|${body}`))) return fail('invalid-token');
  if (payload.k !== site.siteKey) return fail('invalid-token');
  if (!(payload.e > now)) return fail('token-expired');
  if (consume && store && !(await store.consume(`t:${payload.n}`, payload.e, now))) return fail('token-reused');
  return {
    success: true,
    timestamp: new Date(payload.t).toISOString(),
    hostname: payload.h,
    siteKey: payload.k,
  };
}
