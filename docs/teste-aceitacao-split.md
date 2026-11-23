# Teste de aceitação do split (AbacatePay Modo Teste)

Este teste valida ponta a ponta que, ao simular o pagamento Pix de um pedido da loja `casa-atelier` no **Modo Teste** da AbacatePay, o saldo disponível da subconta da loja (`GET /v2/sub-accounts/get`) aumenta **exatamente** pelo valor do split gravado no pedido (parte do lojista = `total_centavos - taxa_servico_centavos`).

Se houver qualquer diferença entre o split esperado e o aumento real do saldo da subconta, o teste falha explicitamente exibindo os dois valores em centavos e em reais (`R$`).

## Pré-requisitos

1. Arquivo `.env` configurado na raiz do projeto com:
   - `DATABASE_URL`: string de conexão do banco Neon Postgres;
   - `ABACATEPAY_API_KEY`: chave de **Modo Teste** (deve começar com `abc_dev_`) com permissões `TRANSPARENT:CREATE` e `SUB_ACCOUNT:READ`.
2. A loja `casa-atelier` cadastrada no banco com:
   - `status = 'ativa'` e `aberta = true`;
   - `abacate_subconta_id` preenchido (`sacc_...`);
   - Pelo menos um produto ativo com estoque disponível suficiente (no modo padrão em que o teste cria um novo pedido).

> **Proteção de ambiente:** o teste e a função `simularPagamentoPixTransparente` bloqueiam automaticamente qualquer execução com chave de produção (`abc_prod_`). A chave de API nunca é exibida nos logs.

## Como rodar

### 1. Fluxo completo (cria um pedido novo em `casa-atelier` e simula o pagamento)

```bash
npm run test:acceptance:split
```

O script executa `tsx --test tests/acceptance/split-abacatepay.acceptance.test.ts` e:
1. Lê `saldo_antes` via `GET /v2/sub-accounts/get?id=<abacate_subconta_id>`;
2. Cria um pedido real em `casa-atelier` via `executarCriacaoPedido` (gerando a cobrança Pix com split na AbacatePay);
3. Recarrega o pedido salvo no banco (`pedidos`) e calcula `split_esperado = total_centavos - taxa_servico_centavos`;
4. Simula o pagamento no sandbox via `POST /v2/transparents/simulate-payment?id=<abacate_cobranca_id>`;
5. Consulta `saldo_depois` via `GET /v2/sub-accounts/get?id=<abacate_subconta_id>` e compara `saldo_depois - saldo_antes === split_esperado`.

### 2. Testando um pedido específico já existente (`aguardando_pagamento`)

Para simular o pagamento de um pedido pendente específico da loja `casa-atelier` (com QR Code ainda não expirado), defina `ACCEPTANCE_PEDIDO_CODIGO`:

**PowerShell (Windows):**

```powershell
$env:ACCEPTANCE_PEDIDO_CODIGO="PED-SEUCODIGO123"
npm run test:acceptance:split
Remove-Item Env:ACCEPTANCE_PEDIDO_CODIGO
```

**Bash (Linux/macOS):**

```bash
ACCEPTANCE_PEDIDO_CODIGO="PED-SEUCODIGO123" npm run test:acceptance:split
```

## O que é verificado

- Status da cobrança após simulação igual a `PAID` em `devMode = true`;
- Consistência do pedido gravado (`subtotal_centavos + frete_centavos + (taxa_paga_por === "cliente" ? taxa_servico_centavos : 0) === total_centavos`);
- Igualdade exata `saldo_depois - saldo_antes === total_centavos - taxa_servico_centavos`. Em caso de divergência, o teste falha mostrando:
  - Split esperado (parte do lojista gravada no pedido);
  - Aumento real no saldo disponível da subconta (`antes` e `depois`).
