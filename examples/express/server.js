// Exemplo: Humnovo embutido em uma aplicação Express.
//   npm install express humnovo
//   npx humnovo keys   # gere as chaves e exporte as variáveis
//   node server.js
import express from 'express';
import { createHumnovo } from 'humnovo/server';

const app = express();
const humnovo = createHumnovo({
  sites: [
    {
      siteKey: process.env.HUMNOVO_SITE_KEY,
      secret: process.env.HUMNOVO_SECRET_KEY,
      hostnames: ['localhost'],
      level: 'medium',
    },
  ],
});

// Expõe /humnovo/widget.js e a API de verificação.
app.use('/humnovo', humnovo);

app.get('/', (_req, res) => {
  res.type('html').send(`<!doctype html>
<form action="/contato" method="POST">
  <input name="email" type="email" placeholder="Seu e-mail" required>
  <div class="humnovo" data-sitekey="${process.env.HUMNOVO_SITE_KEY}"></div>
  <button>Enviar</button>
</form>
<script src="/humnovo/widget.js" async defer></script>`);
});

app.post('/contato', express.urlencoded({ extended: false }), async (req, res) => {
  const result = await humnovo.verify(req.body['humnovo-token']);
  if (!result.success) return res.status(400).send(`Verificação falhou: ${result.error}`);
  res.send(`Obrigado, ${req.body.email}!`);
});

app.listen(3000, () => console.log('http://localhost:3000'));
