# Humnovo

> Verificação humana open source, moderna, leve e focada em privacidade, sem CAPTCHAs tradicionais.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-em%20desenvolvimento-yellow.svg)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

---

## 📖 Sobre

O **Humnovo** é um projeto open source de verificação humana criado para proteger sites e aplicações contra bots, spam e atividades automatizadas maliciosas.

A proposta é oferecer uma camada **moderna, leve, segura e acessível** de autenticação humana, fácil de integrar a qualquer plataforma por meio de bibliotecas, APIs e componentes reutilizáveis.

Com foco em **privacidade, simplicidade e flexibilidade**, o Humnovo busca reinventar a forma como aplicações distinguem usuários reais de automações, sem depender dos modelos tradicionais de CAPTCHA e priorizando uma experiência fluida para usuários e desenvolvedores.

---

## ✨ Principais características

- 🛡️ **Proteção contra bots**: bloqueia spam e automações maliciosas
- 🔒 **Privacidade em primeiro lugar**: sem rastreamento invasivo de usuários
- ⚡ **Leve**: impacto mínimo no carregamento e na performance
- ♿ **Acessível**: experiência inclusiva, sem desafios visuais frustrantes
- 🧩 **Fácil integração**: bibliotecas, API REST e componentes reutilizáveis
- 🎯 **Sem CAPTCHA tradicional**: verificação fluida e não intrusiva
- 🔧 **Flexível**: configurável para diferentes níveis de segurança
- 🌐 **Open source**: transparente, auditável e mantido pela comunidade

---

## 🧠 Como funciona

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Usuário    │────▶│  Widget Humnovo  │────▶│  API de          │
│  (navegador) │     │  (client-side)   │     │  Verificação     │
└──────────────┘     └──────────────────┘     └────────┬─────────┘
                                                       │ token
                                                       ▼
                                              ┌──────────────────┐
                                              │  Seu backend     │
                                              │  valida o token  │
                                              └──────────────────┘
```

1. O widget do Humnovo é carregado na página.
2. A verificação ocorre de forma leve e não intrusiva.
3. Um token de verificação é gerado.
4. O backend da sua aplicação valida o token junto à API do Humnovo.

---

## 🚀 Instalação

```bash
npm install humnovo
```

ou

```bash
yarn add humnovo
```

---

## 💻 Uso básico

### Front-end (HTML)

```html
<form action="/enviar" method="POST">
  <input type="email" name="email" placeholder="Seu e-mail" />

  <div class="humnovo" data-sitekey="SUA_CHAVE_PUBLICA"></div>

  <button type="submit">Enviar</button>
</form>

<script src="https://cdn.humnovo.dev/widget.js" async defer></script>
```

### Front-end (JavaScript)

```javascript
import { Humnovo } from 'humnovo';

const humnovo = new Humnovo({
  siteKey: 'SUA_CHAVE_PUBLICA',
  container: '#humnovo-container',
  onSuccess: (token) => {
    console.log('Verificação concluída:', token);
  },
  onError: (error) => {
    console.error('Falha na verificação:', error);
  },
});

humnovo.render();
```

### Back-end (validação do token)

```javascript
const response = await fetch('https://api.humnovo.dev/v1/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    secret: process.env.HUMNOVO_SECRET_KEY,
    token: req.body['humnovo-token'],
  }),
});

const result = await response.json();

if (result.success) {
  // Usuário humano verificado
} else {
  // Bloquear requisição
}
```

---

## 📡 API

### `POST /v1/verify`

| Parâmetro | Tipo     | Obrigatório | Descrição                         |
|-----------|----------|-------------|-----------------------------------|
| `secret`  | `string` | Sim         | Chave secreta da aplicação        |
| `token`   | `string` | Sim         | Token gerado pelo widget          |

**Resposta:**

```json
{
  "success": true,
  "timestamp": "2026-11-08T14:50:00Z",
  "hostname": "seusite.com"
}
```

---

## ⚙️ Configuração

| Opção        | Tipo       | Padrão     | Descrição                              |
|--------------|------------|------------|----------------------------------------|
| `siteKey`    | `string`   | —          | Chave pública do site                  |
| `container`  | `string`   | —          | Seletor do elemento onde será exibido  |
| `theme`      | `string`   | `'auto'`   | `'light'`, `'dark'` ou `'auto'`        |
| `language`   | `string`   | `'pt-BR'`  | Idioma da interface                    |
| `onSuccess`  | `function` | —          | Callback ao concluir a verificação     |
| `onError`    | `function` | —          | Callback em caso de erro               |

---

## 🗺️ Roadmap

- [ ] Widget JavaScript base
- [ ] API REST de verificação
- [ ] Componentes para React, Vue e Angular
- [ ] SDKs para Node.js, Python e Java
- [ ] Painel de administração
- [ ] Documentação completa
- [ ] Plugins para WordPress e outras plataformas
- [ ] Opção de self-hosting

---

## 🤝 Contribuindo

Contribuições são muito bem-vindas!

1. Faça um fork do projeto
2. Crie uma branch para sua feature: `git checkout -b feature/minha-feature`
3. Faça commit das alterações: `git commit -m 'feat: adiciona minha feature'`
4. Envie para o repositório: `git push origin feature/minha-feature`
5. Abra um Pull Request

Antes de contribuir, leia o [CONTRIBUTING.md](CONTRIBUTING.md) e o [Código de Conduta](CODE_OF_CONDUCT.md).

---

## 🔐 Segurança

Encontrou uma vulnerabilidade? **Não abra uma issue pública.** Consulte o [SECURITY.md](SECURITY.md) para reportá-la de forma responsável.

---

## 📄 Licença

Distribuído sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

## 👤 Autor

**Pedro Silva**

- GitHub: [@psflow](https://github.com/psflow)
- LinkedIn: [workerpedro](https://linkedin.com/in/workerpedro)

---

<p align="center">Feito com 💙 para uma web mais humana.</p>
