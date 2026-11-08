# Política de Segurança

## Versões suportadas

| Versão | Suportada |
|--------|-----------|
| 0.x    | ✅        |

## Reportando uma vulnerabilidade

**Não abra uma issue pública.**

Use o recurso de [reporte privado de vulnerabilidades do GitHub](https://github.com/psflow/humnovo/security/advisories/new). Inclua:

- descrição do problema e impacto esperado;
- passos para reproduzir (ou prova de conceito);
- versão afetada e ambiente.

Vamos confirmar o recebimento em até 72 horas e manter você informado sobre a correção. Pedimos que a divulgação pública aconteça somente após a liberação de um patch.

## Modelo de ameaça (resumo)

O Humnovo **aumenta o custo** de automação; não promete bloquear 100% dos bots. Ele combina:

1. **Prova de trabalho (PoW)** assinada por HMAC: cada envio custa CPU ao cliente.
2. **Sinais de interação** leves (evento confiável, tempo, movimento/teclado/toque, `navigator.webdriver`).
3. **Tokens de uso único**, com expiração curta e restrição de hostname.

Os sinais do cliente podem ser forjados por um atacante determinado; a prova de trabalho é o que garante custo real. Para alvos de alto valor, combine o Humnovo com rate limiting e outras camadas de defesa.
