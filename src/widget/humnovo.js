/**
 * Humnovo — widget de verificação humana (navegador, zero dependências).
 *
 * Este arquivo é ESM (para bundlers). O build em dist/humnovo.js é a versão
 * para <script>, que se auto-inicializa em todos os elementos `.humnovo`.
 */

const I18N = {
  'pt-BR': {
    label: 'Sou humano',
    verifying: 'Verificando…',
    verified: 'Verificado',
    error: 'Falha na verificação. Tente novamente.',
    expired: 'Verificação expirada. Clique novamente.',
    brand: 'Protegido por Humnovo',
  },
  en: {
    label: "I'm human",
    verifying: 'Verifying…',
    verified: 'Verified',
    error: 'Verification failed. Please try again.',
    expired: 'Verification expired. Click again.',
    brand: 'Protected by Humnovo',
  },
  es: {
    label: 'Soy humano',
    verifying: 'Verificando…',
    verified: 'Verificado',
    error: 'La verificación falló. Inténtalo de nuevo.',
    expired: 'La verificación expiró. Haz clic de nuevo.',
    brand: 'Protegido por Humnovo',
  },
};

function pickLanguage(lang) {
  if (I18N[lang]) return I18N[lang];
  const base = String(lang || '').toLowerCase().split('-')[0];
  if (base === 'pt') return I18N['pt-BR'];
  return I18N[base] || I18N.en;
}

/**
 * Solver de prova de trabalho. Totalmente autocontido (sem referências externas)
 * para poder ser serializado com toString() e rodar dentro de um Web Worker.
 * Inclui um SHA-256 síncrono em JS puro: funciona até fora de HTTPS e é mais
 * rápido que crypto.subtle para milhares de hashes curtos.
 */
export function powSolver() {
  const K = [];
  const H0 = [];
  const frac = (x) => ((x - Math.floor(x)) * 4294967296) | 0;
  for (let n = 2, found = 0; found < 64; n++) {
    let prime = true;
    for (let d = 2; d * d <= n; d++) {
      if (n % d === 0) {
        prime = false;
        break;
      }
    }
    if (!prime) continue;
    if (found < 8) H0.push(frac(Math.sqrt(n)));
    K.push(frac(Math.cbrt(n)));
    found++;
  }
  const W = new Int32Array(64);
  const rotr = (v, n) => (v >>> n) | (v << (32 - n));
  const hex = (v) => (v >>> 0).toString(16).padStart(8, '0');

  const OUT = new Int32Array(8);
  let buf = new Uint8Array(128);

  /** Garante espaço no buffer para uma mensagem de `len` bytes. */
  function ensure(len) {
    const size = ((len + 72) >> 6) << 6;
    if (buf.length < size) {
      const next = new Uint8Array(size);
      next.set(buf);
      buf = next;
    }
  }

  /** Aplica o padding SHA-256 a buf[0..len) e calcula o hash em OUT. */
  function compress(len) {
    const size = ((len + 72) >> 6) << 6;
    buf[len] = 0x80;
    for (let i = len + 1; i < size; i++) buf[i] = 0;
    const bits = len * 8;
    buf[size - 4] = bits >>> 24;
    buf[size - 3] = (bits >>> 16) & 255;
    buf[size - 2] = (bits >>> 8) & 255;
    buf[size - 1] = bits & 255;
    let h0 = H0[0], h1 = H0[1], h2 = H0[2], h3 = H0[3], h4 = H0[4], h5 = H0[5], h6 = H0[6], h7 = H0[7];
    for (let off = 0; off < size; off += 64) {
      for (let i = 0; i < 16; i++) {
        const j = off + i * 4;
        W[i] = (buf[j] << 24) | (buf[j + 1] << 16) | (buf[j + 2] << 8) | buf[j + 3];
      }
      for (let i = 16; i < 64; i++) {
        const a = W[i - 15];
        const b = W[i - 2];
        const s0 = rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3);
        const s1 = rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10);
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
      }
      let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[i] + W[i]) | 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) | 0;
        h = g;
        g = f;
        f = e;
        e = (d + t1) | 0;
        d = c;
        c = b;
        b = a;
        a = (t1 + t2) | 0;
      }
      h0 = (h0 + a) | 0;
      h1 = (h1 + b) | 0;
      h2 = (h2 + c) | 0;
      h3 = (h3 + d) | 0;
      h4 = (h4 + e) | 0;
      h5 = (h5 + f) | 0;
      h6 = (h6 + g) | 0;
      h7 = (h7 + h) | 0;
    }
    OUT[0] = h0; OUT[1] = h1; OUT[2] = h2; OUT[3] = h3; OUT[4] = h4; OUT[5] = h5; OUT[6] = h6; OUT[7] = h7;
    return OUT;
  }

  /** SHA-256 de uma string ASCII, em hexadecimal. */
  function sha256(str) {
    ensure(str.length);
    for (let i = 0; i < str.length; i++) buf[i] = str.charCodeAt(i);
    const o = compress(str.length);
    let r = '';
    for (let i = 0; i < 8; i++) r += hex(o[i]);
    return r;
  }

  /** Procura n em [0, maxNumber] tal que sha256(salt + n) === challenge. */
  function solve(task) {
    const start = Date.now();
    const salt = task.salt;
    const base = salt.length;
    const target = new Int32Array(8);
    for (let i = 0; i < 8; i++) target[i] = parseInt(task.challenge.substr(i * 8, 8), 16) | 0;
    ensure(base + 16);
    for (let i = 0; i < base; i++) buf[i] = salt.charCodeAt(i);
    for (let n = 0; n <= task.maxNumber; n++) {
      // escreve os dígitos decimais de n logo após o salt
      let digits = 1;
      for (let x = n; x >= 10; x = (x / 10) | 0) digits++;
      for (let x = n, p = base + digits - 1; p >= base; p--, x = (x / 10) | 0) buf[p] = 48 + (x % 10);
      const o = compress(base + digits);
      if (o[0] === target[0] && o[1] === target[1] && o[2] === target[2] && o[3] === target[3] &&
          o[4] === target[4] && o[5] === target[5] && o[6] === target[6] && o[7] === target[7]) {
        return { number: n, took: Date.now() - start };
      }
    }
    return null;
  }

  return { sha256, solve };
}

/** Resolve o desafio em um Web Worker; cai para a thread principal se o CSP bloquear workers. */
export function solveChallenge(task) {
  const inline = () => powSolver().solve(task);
  if (typeof Worker === 'undefined' || typeof Blob === 'undefined') return Promise.resolve(inline());
  return new Promise((resolve) => {
    let url;
    let worker;
    try {
      const code = `var s=(${powSolver.toString()})();onmessage=function(e){postMessage(s.solve(e.data))}`;
      url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
      worker = new Worker(url);
    } catch {
      if (url) URL.revokeObjectURL(url);
      resolve(inline());
      return;
    }
    const done = () => {
      worker.terminate();
      URL.revokeObjectURL(url);
    };
    worker.onmessage = (e) => {
      done();
      resolve(e.data);
    };
    worker.onerror = (e) => {
      if (e && e.preventDefault) e.preventDefault();
      done();
      resolve(inline());
    };
    worker.postMessage({ salt: task.salt, challenge: task.challenge, maxNumber: task.maxNumber });
  });
}

const CSS = `
:host{all:initial;display:inline-block;max-width:100%;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.box{--bg:#fff;--fg:#1f2937;--muted:#6b7280;--border:#d1d5db;--accent:#2563eb;--ok:#16a34a;--err:#dc2626;
display:flex;align-items:center;gap:12px;box-sizing:border-box;width:300px;max-width:100%;padding:12px 14px;
border:1px solid var(--border);border-radius:10px;background:var(--bg);color:var(--fg);font-size:14px;line-height:1.3}
.box[data-theme=dark]{--bg:#111827;--fg:#f3f4f6;--muted:#9ca3af;--border:#374151;--accent:#60a5fa;--ok:#22c55e;--err:#f87171}
@media (prefers-color-scheme:dark){.box[data-theme=auto]{--bg:#111827;--fg:#f3f4f6;--muted:#9ca3af;--border:#374151;--accent:#60a5fa;--ok:#22c55e;--err:#f87171}}
.check{flex:none;display:grid;place-items:center;width:26px;height:26px;margin:0;padding:0;border:2px solid var(--muted);
border-radius:6px;background:transparent;cursor:pointer;transition:border-color .15s,background .15s}
.check:hover{border-color:var(--accent)}
.check:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.text{display:flex;flex-direction:column;flex:1;min-width:0}
.label{font-weight:500;cursor:pointer}
.status{font-size:12px;color:var(--muted)}
.status:empty{display:none}
.brand{flex:none;align-self:flex-end;font-size:10px;color:var(--muted);text-decoration:none}
.brand:hover{text-decoration:underline}
.box[data-state=verifying] .check{cursor:progress}
.box[data-state=verifying] .mark{width:14px;height:14px;box-sizing:border-box;border:2px solid var(--accent);border-right-color:transparent;
border-radius:50%;animation:hn-spin .7s linear infinite}
.box[data-state=verified] .check{border-color:var(--ok);background:var(--ok);cursor:default}
.box[data-state=verified] .mark{width:6px;height:12px;box-sizing:border-box;border:solid #fff;border-width:0 3px 3px 0;transform:translateY(-1px) rotate(45deg)}
.box[data-state=error] .check{border-color:var(--err)}
.box[data-state=error] .status{color:var(--err)}
@keyframes hn-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.box[data-state=verifying] .mark{animation-duration:2s}}
`;

const THEMES = ['auto', 'light', 'dark'];

export class HumnovoError extends Error {
  constructor(code) {
    super(`Humnovo: ${code}`);
    this.name = 'HumnovoError';
    this.code = code;
  }
}

export class Humnovo {
  /**
   * @param {object} options
   * @param {string} options.siteKey      chave pública do site
   * @param {string|Element} options.container
   * @param {string} [options.apiUrl]     URL do servidor Humnovo (padrão: origem do script ou da página)
   * @param {'auto'|'light'|'dark'} [options.theme]
   * @param {string} [options.language]   'auto', 'pt-BR', 'en', 'es'
   * @param {string} [options.inputName]  nome do campo hidden (padrão 'humnovo-token')
   * @param {(token: string) => void} [options.onSuccess]
   * @param {(error: Error) => void} [options.onError]
   * @param {() => void} [options.onExpire]
   */
  constructor(options = {}) {
    const defaults = {
      apiUrl: Humnovo.defaultApiUrl,
      theme: 'auto',
      language: 'auto',
      inputName: 'humnovo-token',
    };
    this.options = { ...defaults };
    for (const [k, v] of Object.entries(options)) if (v !== undefined && v !== null && v !== '') this.options[k] = v;
    if (!this.options.siteKey) throw new HumnovoError('siteKey é obrigatório');
    this.state = 'idle';
    this.token = null;
    this._job = null;
    this._onMove = (e) => {
      if (e.pointerType === 'touch') this._tc = true;
      else if (this._pm < 1000) this._pm++;
    };
  }

  get apiUrl() {
    const base = this.options.apiUrl || (typeof location !== 'undefined' ? location.origin : '');
    return String(base).replace(/\/+$/, '');
  }

  render() {
    const c = this.options.container;
    const container = typeof c === 'string' ? document.querySelector(c) : c;
    if (!container) throw new HumnovoError('container não encontrado');
    if (container.__humnovo && container.__humnovo !== this) container.__humnovo.destroy();
    container.__humnovo = this;
    this.container = container;

    const lang = this.options.language === 'auto' ? navigator.language : this.options.language;
    this.t = pickLanguage(lang);
    const theme = THEMES.includes(this.options.theme) ? this.options.theme : 'auto';

    this.host = document.createElement('div');
    this.host.className = 'humnovo-widget';
    const root = this.host.attachShadow({ mode: 'open' });
    root.innerHTML =
      `<style>${CSS}</style>` +
      `<div class="box" part="box" data-theme="${theme}" data-state="idle">` +
      `<button type="button" class="check" part="checkbox" role="checkbox" aria-checked="false" aria-labelledby="l" aria-describedby="s">` +
      `<span class="mark" aria-hidden="true"></span></button>` +
      `<span class="text"><span class="label" id="l"></span><span class="status" id="s" role="status" aria-live="polite"></span></span>` +
      `<a class="brand" href="https://github.com/psflow/humnovo" target="_blank" rel="noopener noreferrer">Humnovo</a>` +
      `</div>`;
    this.box = root.querySelector('.box');
    this.button = root.querySelector('.check');
    this.status = root.querySelector('.status');
    root.querySelector('.label').textContent = this.t.label;
    root.querySelector('.brand').title = this.t.brand;

    this.input = document.createElement('input');
    this.input.type = 'hidden';
    this.input.name = this.options.inputName;

    container.setAttribute('data-humnovo-rendered', '');
    container.append(this.host, this.input);

    this._t0 = performance.now();
    this._pm = 0;
    this._kb = false;
    this._tc = false;

    const prepare = () => {
      this._prepare().catch(() => {});
    };
    this.box.addEventListener('pointerenter', prepare);
    this.box.addEventListener('focusin', prepare);
    this.box.addEventListener('touchstart', () => {
      this._tc = true;
      prepare();
    }, { passive: true });
    this.button.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') this._kb = true;
    });
    this.button.addEventListener('click', (e) => this._verify(e));
    root.querySelector('.label').addEventListener('click', (e) => this._verify(e));
    document.addEventListener('pointermove', this._onMove, { passive: true });
    return this;
  }

  /** Busca e resolve o desafio antecipadamente (ao passar o mouse/focar), para a verificação parecer instantânea. */
  _prepare() {
    if (this._job && this._job.expires - Date.now() > 10_000) return this._job.promise;
    const job = { expires: Infinity };
    job.promise = fetch(`${this.apiUrl}/v1/challenge?sitekey=${encodeURIComponent(this.options.siteKey)}`, {
      credentials: 'omit',
    })
      .then((r) => r.json())
      .then((ch) => {
        if (!ch || !ch.challenge) throw new HumnovoError((ch && ch.error) || 'challenge-failed');
        job.expires = ch.expires;
        return solveChallenge(ch).then((sol) => {
          if (!sol) throw new HumnovoError('unsolvable');
          return { ch, sol };
        });
      });
    job.promise.catch(() => {
      if (this._job === job) this._job = null;
    });
    this._job = job;
    return job.promise;
  }

  async _verify(event) {
    if (this.state === 'verifying' || this.state === 'verified') return;
    const signals = {
      it: !!(event && event.isTrusted),
      el: Math.round(performance.now() - this._t0),
      pm: this._pm,
      kb: this._kb,
      tc: this._tc,
      wd: !!navigator.webdriver,
    };
    this._setState('verifying', this.t.verifying);
    try {
      const { ch, sol } = await this._prepare();
      this._job = null; // cada desafio vale uma única vez
      const res = await fetch(`${this.apiUrl}/v1/solve`, {
        method: 'POST',
        credentials: 'omit',
        headers: { 'Content-Type': 'text/plain' }, // evita preflight CORS
        body: JSON.stringify({
          siteKey: this.options.siteKey,
          salt: ch.salt,
          challenge: ch.challenge,
          maxNumber: ch.maxNumber,
          signature: ch.signature,
          number: sol.number,
          signals: { ...signals, st: sol.took },
        }),
      }).then((r) => r.json());
      if (!res || !res.success) throw new HumnovoError((res && res.error) || 'verification-failed');
      this._succeed(res);
    } catch (err) {
      this._job = null;
      const error = err instanceof HumnovoError ? err : new HumnovoError('network-error');
      this._setState('error', this.t.error);
      this._emit('error', error);
      if (this.options.onError) this.options.onError(error);
    }
  }

  _succeed(res) {
    this.token = res.token;
    this.input.value = res.token;
    this._setState('verified', this.t.verified);
    document.removeEventListener('pointermove', this._onMove);
    clearTimeout(this._expireTimer);
    const ttl = Number(res.expiresIn) > 0 ? Number(res.expiresIn) * 1000 : 300_000;
    this._expireTimer = setTimeout(() => this._expire(), Math.max(1000, ttl - 5000));
    this._emit('success', res.token);
    if (this.options.onSuccess) this.options.onSuccess(res.token);
  }

  _expire() {
    this.reset();
    this.status.textContent = this.t.expired;
    this._emit('expired');
    if (this.options.onExpire) this.options.onExpire();
  }

  _setState(state, text = '') {
    this.state = state;
    this.box.dataset.state = state;
    this.button.setAttribute('aria-checked', state === 'verified' ? 'true' : 'false');
    this.button.setAttribute('aria-busy', state === 'verifying' ? 'true' : 'false');
    this.status.textContent = state === 'verified' ? '' : text;
    if (state === 'verified') this.button.setAttribute('aria-label', `${this.t.label} — ${text}`);
    else this.button.removeAttribute('aria-label');
  }

  _emit(name, detail) {
    if (this.container) {
      this.container.dispatchEvent(new CustomEvent(`humnovo:${name}`, { bubbles: true, detail }));
    }
  }

  /** Token atual (ou null se ainda não verificado/expirado). */
  getToken() {
    return this.token;
  }

  /** Volta ao estado inicial (ex.: depois de enviar o formulário). */
  reset() {
    clearTimeout(this._expireTimer);
    this.token = null;
    this._job = null;
    if (this.input) this.input.value = '';
    if (this.box) this._setState('idle');
    this._t0 = performance.now();
    document.removeEventListener('pointermove', this._onMove);
    document.addEventListener('pointermove', this._onMove, { passive: true });
  }

  destroy() {
    clearTimeout(this._expireTimer);
    document.removeEventListener('pointermove', this._onMove);
    if (this.host) this.host.remove();
    if (this.input) this.input.remove();
    if (this.container) {
      this.container.removeAttribute('data-humnovo-rendered');
      if (this.container.__humnovo === this) delete this.container.__humnovo;
    }
  }

  /** Renderiza todos os elementos `.humnovo[data-sitekey]` ainda não renderizados. */
  static renderAll(root = document) {
    const resolveFn = (name) => (name && typeof window[name] === 'function' ? window[name] : undefined);
    return Array.from(root.querySelectorAll('.humnovo[data-sitekey]:not([data-humnovo-rendered])')).map((el) =>
      new Humnovo({
        container: el,
        siteKey: el.dataset.sitekey,
        apiUrl: el.dataset.api,
        theme: el.dataset.theme,
        language: el.dataset.lang,
        inputName: el.dataset.inputName,
        onSuccess: resolveFn(el.dataset.callback),
        onError: resolveFn(el.dataset.errorCallback),
        onExpire: resolveFn(el.dataset.expiredCallback),
      }).render(),
    );
  }
}

Humnovo.defaultApiUrl = '';

/** Inicialização automática (usada pelo build para <script>). */
export function autoInit(script) {
  if (script && script.src) {
    try {
      Humnovo.defaultApiUrl = new URL('.', script.src).href.replace(/\/+$/, '');
    } catch {
      /* ignora */
    }
  }
  const run = () => Humnovo.renderAll();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
}

export default Humnovo;
