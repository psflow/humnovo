# Contribuindo com o Humnovo

> 🇺🇸 **English summary:** Issues and PRs in English or Portuguese are welcome. Requirements: Node.js 18+, no runtime dependencies. Run `npm test` before opening a PR, use [Conventional Commits](https://www.conventionalcommits.org/) and keep the widget tiny, private (no fingerprinting) and accessible. Looking for a place to start? Check issues labeled [`good first issue`](https://github.com/psflow/humnovo/labels/good%20first%20issue).

Obrigado pelo interesse! Toda contribuição é bem-vinda: código, documentação, testes, traduções e relatos de bugs.

## Ambiente

Requisitos: **Node.js 18+**. O projeto não tem dependências de runtime.

```bash
git clone https://github.com/psflow/humnovo.git
cd humnovo
npm test        # roda a suíte de testes (node:test)
npm start       # sobe o servidor local em modo demo em http://localhost:8787
npm run build   # gera dist/humnovo.js
```

## Fluxo

1. Abra uma issue descrevendo o problema ou a proposta (para mudanças grandes).
2. Faça um fork e crie uma branch: `git checkout -b feature/minha-feature`.
3. Escreva testes para o que mudou e garanta que `npm test` passa.
4. Use mensagens de commit no padrão [Conventional Commits](https://www.conventionalcommits.org/pt-br/) (`feat:`, `fix:`, `docs:`...).
5. Abra um Pull Request explicando o *porquê* da mudança.

## Princípios do projeto

- **Leve**: o widget não deve ganhar dependências. Cada byte conta.
- **Privacidade**: não coletamos fingerprint, cookies nem dados pessoais. Sinais de interação são apenas contadores e booleanos.
- **Acessível**: tudo precisa funcionar com teclado e leitor de tela.
- **Sem dependências no servidor**: apenas módulos nativos do Node.js.

## Código de Conduta

Ao participar, você concorda com o [Código de Conduta](CODE_OF_CONDUCT.md).
