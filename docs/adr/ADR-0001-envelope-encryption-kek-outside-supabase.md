# ADR-0001: Criptografia de prontuario com envelope encryption e KEK fora do Supabase

## Status: Accepted

## Contexto

O prontuario psicologico contem dado pessoal sensivel de saude mental (LGPD art. 5, II). A LGPD e o CFP exigem criptografia em repouso. O sistema usa Supabase como banco de dados gerenciado, e a psicologia tem uma unica conta com acesso a todos os prontuarios — o que torna o vazamento da chave o cenario de pior caso.

Tres abordagens foram avaliadas:
1. `pgcrypto` (`pgp_sym_encrypt`) — criptografia no Postgres com chave passada pela aplicacao
2. Supabase Vault (`pgsodium`) — criptografia nativa do Supabase com root key gerenciada pelo provedor
3. Application-level encryption — criptografia na camada do Next.js com chave fora do Supabase

## Decisao

**Criptografia application-level AES-256-GCM com envelope encryption, executada no Next.js (runtime Node), com a KEK residindo no EasyPanel — nunca no Supabase.**

Detalhes:
- **Algoritmo:** AES-256-GCM (autenticado — detecta tampering). IV de 12 bytes aleatorio por operacao.
- **Envelope:** cada registro tem sua propria DEK (32 bytes). Conteudo cifrado com DEK; DEK cifrada com KEK e armazenada na linha.
- **AAD (Additional Authenticated Data):** `patient_id|record_id` — impede troca de ciphertext entre pacientes.
- **KEK:** variavel de ambiente `RECORD_ENCRYPTION_KEK_V1` (32 bytes base64) no EasyPanel.
- **Carregamento de chaves:** modulo `src/lib/crypto/keys.ts` valida presenca, base64 e exatamente 32 bytes no boot. Falha ruidosa. Apos carregar, `delete process.env.RECORD_ENCRYPTION_KEK_V1`. Proibido `!` em leitura de env de chave.
- **Runtime:** `export const runtime = 'nodejs'` nas rotas que cifram/decifram (Web Crypto no Edge Runtime nao cobre o caso).
- **Rotacao:** nova KEK re-wrapa apenas as DEKs (poucos bytes), nao todo o conteudo clinico.
- **Crypto-shredding:** destruir a DEK de um registro elimina o dado de forma eficaz, inclusive em backups.

## Alternativas descartadas

- **`pgcrypto`:** a chave transita por SQL e vaza em `pg_stat_statements` e logs de query. Um dump do banco que inclua esses logs expoe a chave junto com o ciphertext. Viola o requisito US-404 ("chave NUNCA no mesmo banco").
- **Supabase Vault:** a root key vive no mesmo provedor do dado. Um vazamento de `SUPABASE_SERVICE_ROLE_KEY` permite acessar `vault.decrypted_secrets` e chamar decrypt — o prontuario fica legivel. Nao separa os dominios de confianca.
- **Chave unica por registro sem envelope:** rotacao exigiria recifrar todo o conteudo clinico (texto longo, volume crescente). Envelope resolve com re-wrap de poucos bytes por linha.
- **KMS externo / servico isolado de wrap/unwrap:** seria a separacao mais forte (KEK nunca em memoria do processo principal). Desproporcional para MVP de pratica solo. Registrado como opcao de hardening futuro, nao como descarte permanente.

## Consequencias

**Positivas:**
- Vazamento de `SUPABASE_SERVICE_ROLE_KEY` nao expoe prontuario — a chave esta em outro dominio.
- Backup/dump do Postgres e ilegivel sem a KEK.
- Crypto-shredding e o unico metodo honesto de eliminacao num Postgres com PITR.
- Rotacao de KEK e operacao leve (re-wrap de DEKs).

**Negativas:**
- Busca no historico de evolucoes vira decrypt-then-filter server-side. Sem indice em plaintext. Volume real (20-30 pacientes, ~1500 registros totais) suporta com folga.
- Rotas de prontuario usam Node runtime em vez de Edge (cold start ~200ms vs ~50ms).
- Custodia da KEK e responsabilidade operacional critica: perda da KEK = perda irreversivel de prontuario sob guarda legal. Exige 2 copias offline em locais distintos + teste de restauracao antes do go-live.

**Risco residual — comprometimento do host/EasyPanel (AA12):**

A separacao de dominios protege contra comprometimento no lado Supabase (SERVICE_ROLE_KEY vazada em repo, acesso de suporte do provedor, dump de banco). **Nao protege** contra comprometimento do host/painel EasyPanel, onde KEK e SERVICE_ROLE_KEY coexistem como env vars do mesmo container. Qualquer um destes eventos entrega as duas chaves: acesso ao painel EasyPanel (senha reutilizada, sem 2FA), `docker exec` no host, backup/config do EasyPanel copiado para fora, build log que ecoe env.

Controles operacionais obrigatorios (checklist de deploy):
- 2FA obrigatorio na conta EasyPanel
- Contas nomeadas, sem login compartilhado
- Inventario escrito de quem tem acesso ao painel e ao host
- Revisao desse acesso antes do go-live
- Nenhum `echo`/`printenv` em script de build ou entrypoint
