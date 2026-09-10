# CLAUDE.md -- Talitha Psicologia

> Apenas o que e especifico deste projeto.
> Padroes globais em ~/.claude/CLAUDE.md -- nao repetir aqui.

## Regras de Negocio Permanentes

- **Adultos apenas:** a pratica atende exclusivamente pacientes >= 18 anos. Cadastro valida idade e bloqueia menores. Nenhum fluxo de responsavel legal.
- **Retencao de prontuario fixa em 5 anos** apos encerramento do atendimento. A regra CFP de 20 anos para menores nao se aplica e nao e modelada.
- **MFA TOTP obrigatorio para a psicologa.** A conta dela da acesso ao prontuario de todos os pacientes. Senha isolada nao e defensavel perante o CRP.
- **Gravacao de sessao fora de escopo** -- permanentemente fora do MVP. Se entrar em versao futura, exige consentimento por sessao + armazenamento criptografado.
- **Prontuario nao e visivel ao paciente.** Evolucao clinica e sigilosa, acesso exclusivo da psicologa.
- **Export LGPD nao inclui conteudo clinico.** Dados cadastrais, financeiros e de agenda; evolucao apenas a criterio profissional.

## Regras Tecnicas do Projeto

- **KEK fora do Supabase:** `RECORD_ENCRYPTION_KEK_V1` vive exclusivamente no EasyPanel. Mover para `supabase secrets` e motivo de reprovacao em code review.
- **`runtime='nodejs'`** obrigatorio em toda rota/action que usa `node:crypto` (prontuario, anamnese, recibo PDF).
- **Payload de webhook nao e autoritativo:** sempre re-consultar `GET /v3/payments/{id}` no Asaas antes de conciliar.
- **Nenhum segredo com `NEXT_PUBLIC_`** fora da allowlist: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_LIVEKIT_URL`, `NEXT_PUBLIC_SITE_URL`.
- **Conteudo clinico nunca em log.** CPF, tokens, payloads de webhook e segredos tambem nunca. Usar `logger.ts` como unico ponto de log.
- **`getUser()` sempre, `getSession()` nunca** em codigo server-side.
- **Nenhuma funcao server aceita `patient_id`, `psychologist_id` ou `role` como parametro.** Sempre derivar de `getUser()`.
- **Proibido `dangerouslySetInnerHTML`** em qualquer campo de prontuario/anamnese.
- **Descricao de cobranca no Asaas neutra:** `Prestacao de servicos profissionais -- Ref. MM/AAAA`. Natureza clinica so no recibo.
- **Token LiveKit apenas em memoria** (estado React). Nunca localStorage, sessionStorage, URL ou cookie.
- **Assuntos de email por allowlist** (docs/talitha-architecture.md secao 8.3). Nenhum assunto revela terapia.
- **RLS nao e column-level.** Transicoes de estado sensiveis em tabelas acessiveis ao paciente sempre por RPC `SECURITY DEFINER` de assinatura estreita, nunca UPDATE direto.
- **Toda Server Action exportada usa wrapper** (`withPsychologist`/`withPatient`/`withPublicAction`). Middleware e guard de layout NAO sao a fronteira de autorizacao.
- **MFA e `aal2`, nao enrollment.** Sessao so-senha nao passa o gate. Recuperacao de senha exige MFA challenge antes de efetivar.
- **Nenhum segredo como `ARG`/`ENV` em nenhum stage do Dockerfile.** Segredos so como env de runtime injetada pelo EasyPanel.
- **Proibido localStorage/sessionStorage/IndexedDB para campo clinico** (inclui rascunho de anotacoes da sessao).
- **Plaintext clinico nunca em cache do Next.js.** `force-dynamic` + `no-store` em toda rota que decifra.

## Documentacao do Projeto

- `docs/talitha-prd.md` -- produto, personas, MVP, compliance
- `docs/talitha-user-stories.md` -- 36 stories em 5 epicos
- `docs/talitha-security-review-prd.md` -- classificacao de dados, STRIDE, 42 issues, requisitos por modulo
- `docs/talitha-security-review-architecture.md` -- review da arquitetura, 36 issues novos, 8 correcoes
- `docs/talitha-design-system.md` -- tokens, tipografia, paleta, componentes (Atomic Design)
- `docs/talitha-wireframes.md` -- 34 telas especificadas
- `docs/talitha-navigation-flow.md` -- rotas, guards, maquinas de estado
- `docs/talitha-architecture.md` -- estrutura, fronteiras de confianca, integracoes, decisoes tecnicas
- `docs/adr/` -- Architecture Decision Records (ADR-0001 a ADR-0006)
- `docs/decisions.md` -- decisoes de produto e tecnicas em conversa
- `docs/talitha-status.md` -- progresso atual
- **Toda funcao Postgres nova recebe REVOKE triplo + GRANT explicito.** No Supabase, funcoes nascem com EXECUTE de DUAS fontes independentes: heranca de `PUBLIC` (padrao PostgreSQL) e grants diretos a `anon`/`authenticated` (criados pelo `ALTER DEFAULT PRIVILEGES` do Supabase). Revogar de uma nao toca a outra. O padrao canonico e:
  ```sql
  REVOKE EXECUTE ON FUNCTION f FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION f TO <roles_permitidos>;
  ```
  As tres revogacoes sao obrigatorias, nao redundantes. Omitir qualquer uma deixa a funcao acessivel a usuarios nao autorizados. Aplicar **imediatamente apos o CREATE FUNCTION**, na mesma migration.
- **Policies RLS nunca fazem subquery na propria tabela.** Causa `42P17` (recursao infinita). Para verificar papel do usuario em policies de `profiles` ou de qualquer tabela que precise do papel, usar `fn_is_psychologist()` — funcao `SECURITY DEFINER` + `STABLE` que le `profiles.role` diretamente, bypassando a RLS da propria tabela. Preserva R13 (profiles.role como fonte canonica, nao JWT claim). Jamais usar `EXISTS (SELECT 1 FROM profiles ...)` dentro de uma policy de profiles.
- **Verificacao com `has_function_privilege`.** Nunca consultar a tabela de grants procurando entrada de `anon` — a ausencia de grant direto nao significa ausencia de privilegio. Usar `has_function_privilege('anon', 'f()', 'EXECUTE')` para testar o privilegio efetivo.
