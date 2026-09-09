# ADR-0005: Numeracao de recibo com contador transacional em vez de sequence

## Status: Accepted

## Contexto

Recibos IRPF devem ser numerados sequencialmente (US-406: `001/2026`, `002/2026`, ...) sem lacunas e sem duplicatas. O paciente usa o recibo para deducao fiscal — lacunas ou duplicatas geram problemas contabeis.

Postgres oferece `SEQUENCE` como mecanismo padrao de auto-incremento. Porem, sequences nao sao transacionais: se a transacao que consumiu o valor fizer rollback, o numero e perdido (lacuna). Em contrapartida, `SEQUENCE` nunca duplica — o trade-off e lacuna vs duplicata.

## Decisao

**Contador transacional em tabela dedicada `receipt_counters (year int PRIMARY KEY, last_number int)`, lido com `SELECT ... FOR UPDATE` na mesma transacao da criacao do recibo.**

```sql
-- Dentro da transacao de criacao do recibo:
SELECT last_number FROM receipt_counters WHERE year = 2026 FOR UPDATE;
-- Se nao existe, INSERT com last_number = 0
UPDATE receipt_counters SET last_number = last_number + 1 WHERE year = 2026;
-- Usar last_number + 1 como numero do recibo
```

O `FOR UPDATE` serializa o acesso — duas transacoes simultaneas nao criam o mesmo numero. Se a transacao falhar (rollback), o numero nao foi consumido (sem lacuna).

Adicionalmente, `receipts` tem `UNIQUE (charge_id)` — no maximo um recibo por cobranca, independentemente de retries do webhook.

## Alternativas descartadas

- **`SEQUENCE` do Postgres:** gera lacunas em rollback. O US-406 exige sequencia sem lacunas. Unico caso legitimo de lacuna e cancelamento de recibo (estorno), onde o numero e consumido e marcado como `cancelled`.
- **`GENERATED ALWAYS AS IDENTITY`:** mesma logica de sequence, mesmas lacunas.
- **Contador em aplicacao (Next.js):** corrida entre requests; sem garantia de unicidade sem lock de banco.

## Consequencias

**Positivas:**
- Sequencia sem lacunas (exceto cancelamentos, que e o unico caso legitimo).
- Transacional — rollback nao consome numeros.
- Simples de implementar e entender.

**Negativas:**
- Serializacao via `FOR UPDATE`: duas criacoes de recibo simultaneas esperam uma pela outra. Volume deste projeto (20-30 pacientes, um recibo por cobranca) torna isso irrelevante.
- Se o volume crescesse para milhares de recibos/dia, o lock serial seria gargalo. Nao se aplica a uma pratica solo.
