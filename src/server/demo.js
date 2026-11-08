/**
 * Página demo do Humnovo (inglês e português, conforme o navegador ou ?lang=pt|en).
 */
import { readBody } from './http.js';

const REPO = 'https://github.com/psflow/humnovo';

const TEXT = {
  en: {
    lang: 'en',
    title: 'Humnovo — live demo',
    tagline: 'Lightweight, privacy-first, open source human verification that protects websites and apps from spam and bots.',
    step: 'Click <strong>I’m human</strong>, then <strong>Submit</strong> to see the token being validated by the backend.',
    submit: 'Submit',
    how: 'What happens behind the scenes',
    howItems: [
      'When you hover or focus the widget, your browser starts solving a small, signed proof-of-work challenge in a Web Worker.',
      'On click, it sends the solution plus a few interaction signals (just counters and booleans: no cookies, no fingerprinting).',
      'The server returns a short-lived, single-use token, which the form sends to the backend.',
      'The backend validates the token once — try going back and resubmitting to see it rejected.',
    ],
    install: 'Add it to your site',
    ok: '✅ Human verified',
    fail: '❌ Verification failed',
    response: 'Response from <code>verify()</code>:',
    back: 'Try again',
    footer: 'Open source (MIT)',
    star: 'Star on GitHub',
    sponsor: 'Sponsor',
    switchLabel: 'Português',
    switchLang: 'pt',
  },
  pt: {
    lang: 'pt-BR',
    title: 'Humnovo — demo',
    tagline: 'Verificação humana open source, leve e focada em privacidade, que protege sites e aplicativos contra spam e bots.',
    step: 'Clique em <strong>Sou humano</strong> e depois em <strong>Enviar</strong> para ver o token sendo validado no backend.',
    submit: 'Enviar',
    how: 'O que acontece por trás',
    howItems: [
      'Ao passar o mouse ou focar no widget, o navegador começa a resolver um pequeno desafio de prova de trabalho assinado, em um Web Worker.',
      'No clique, envia a solução e alguns sinais de interação (apenas contadores e booleanos: sem cookies, sem fingerprint).',
      'O servidor devolve um token curto e de uso único, que o formulário envia ao backend.',
      'O backend valida o token uma única vez: volte e reenvie para vê-lo ser rejeitado.',
    ],
    install: 'Coloque no seu site',
    ok: '✅ Humano verificado',
    fail: '❌ Verificação falhou',
    response: 'Resposta de <code>verify()</code>:',
    back: 'Tentar de novo',
    footer: 'Open source (MIT)',
    star: 'Estrela no GitHub',
    sponsor: 'Apoiar',
    switchLabel: 'English',
    switchLang: 'en',
  },
};

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.codePointAt(0)};`);

function pickText(req, url) {
  const forced = url.searchParams.get('lang');
  if (forced === 'pt' || forced === 'en') return TEXT[forced];
  const accept = String(req.headers['accept-language'] || '').toLowerCase();
  return accept.startsWith('pt') ? TEXT.pt : TEXT.en;
}

const CSS = `
:root{color-scheme:light dark;--bg:#f8fafc;--card:#fff;--fg:#0f172a;--muted:#475569;--border:#e2e8f0;--accent:#2563eb;--code:#f1f5f9;--on-accent:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#0b1120;--card:#111827;--fg:#f1f5f9;--muted:#94a3b8;--border:#1f2937;--accent:#60a5fa;--code:#0f172a;--on-accent:#0b1120}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.55}
main{max-width:640px;margin:0 auto;padding:40px 16px 56px}
header{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px}
h1{font-size:2rem;margin:0}a{color:var(--accent)}
.lang{font-size:.9rem}
.tagline{color:var(--muted);margin:0 0 28px}
.card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:24px;margin-bottom:24px}
.card>:first-child{margin-top:0}.card>:last-child{margin-bottom:0}
form{display:grid;gap:16px;justify-items:start}
button{font:inherit;padding:10px 22px;border-radius:8px;border:0;background:var(--accent);color:var(--on-accent);cursor:pointer}
h2{font-size:1.1rem;margin:0 0 12px}ol{margin:0;padding-left:20px;color:var(--muted)}li+li{margin-top:6px}
pre{background:var(--code);border:1px solid var(--border);padding:14px;border-radius:10px;overflow:auto;font-size:.85rem;margin:0}
footer{display:flex;flex-wrap:wrap;gap:16px;color:var(--muted);font-size:.9rem}
`;

function page(t, body, langSwitchHref) {
  return `<!doctype html><html lang="${t.lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${t.title}</title><meta name="description" content="${escapeHtml(t.tagline)}">
<style>${CSS}</style></head><body><main>
<header><h1>Humnovo</h1>${langSwitchHref ? `<a class="lang" href="${langSwitchHref}">${t.switchLabel}</a>` : ''}</header>
<p class="tagline">${t.tagline}</p>
${body}
<footer><span>${t.footer}</span><a href="${REPO}">⭐ ${t.star}</a><a href="https://github.com/sponsors/psflow">💙 ${t.sponsor}</a></footer>
</main></body></html>`;
}

function snippet(siteKey, origin) {
  return escapeHtml(`<div class="humnovo" data-sitekey="${siteKey}"></div>
<script src="${origin}/widget.js" async defer></script>`);
}

export function createDemo({ humnovo, siteKey }) {
  return async function demo(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;
    const t = pickText(req, url);
    const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0];
    const origin = `${proto}://${req.headers.host || 'localhost'}`;

    if (req.method === 'GET' && (path === '/' || path === '/demo')) {
      const html = page(
        t,
        `<section class="card">
  <p>${t.step}</p>
  <form action="/demo/submit?lang=${t.switchLang === 'en' ? 'pt' : 'en'}" method="POST">
    <div class="humnovo" data-sitekey="${escapeHtml(siteKey)}" data-lang="${t.lang}"></div>
    <button type="submit">${t.submit}</button>
  </form>
</section>
<section class="card"><h2>${t.how}</h2><ol>${t.howItems.map((i) => `<li>${i}</li>`).join('')}</ol></section>
<section class="card"><h2>${t.install}</h2><pre><code>${snippet('YOUR_SITE_KEY', origin)}</code></pre>
<p><a href="${REPO}#readme">README →</a></p></section>
<script src="/widget.js" async defer></script>`,
        `/?lang=${t.switchLang}`,
      );
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(html);
      return true;
    }

    if (req.method === 'POST' && path === '/demo/submit') {
      const body = await readBody(req).catch(() => ({}));
      const result = await humnovo.verify(body['humnovo-token']);
      const lang = t.switchLang === 'en' ? 'pt' : 'en';
      const html = page(
        t,
        `<section class="card"><h2>${result.success ? t.ok : t.fail}</h2>
<p>${t.response}</p><pre>${escapeHtml(JSON.stringify(result, null, 2))}</pre>
<p><a href="/?lang=${lang}">← ${t.back}</a></p></section>`,
      );
      res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(html);
      return true;
    }
    return false;
  };
}
