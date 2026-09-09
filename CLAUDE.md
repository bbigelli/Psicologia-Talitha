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
- **Conteudo clinico nunca em log.** CPF, tokens, payloads de webhook e segredos tambem nunca.
- **`getUser()` sempre, `getSession()` nunca** em codigo server-side.
- **Nenhuma funcao server aceita `patient_id`, `psychologist_id` ou `role` como parametro.** Sempre derivar de `getUser()`.
- **Proibido `dangerouslySetInnerHTML`** em qualquer campo de prontuario/anamnese.
- **Descricao de cobranca no Asaas neutra:** `Prestacao de servicos profissionais -- Ref. MM/AAAA`. Natureza clinica so no recibo.
- **Token LiveKit apenas em memoria** (estado React). Nunca localStorage, sessionStorage, URL ou cookie.
- **Assuntos de email por allowlist** (docs/talitha-architecture.md secao 8.3). Nenhum assunto revela terapia.

## Documentacao do Projeto

- `docs/talitha-prd.md` -- produto, personas, MVP, compliance
- `docs/talitha-user-stories.md` -- 36 stories em 5 epicos
- `docs/talitha-security-review-prd.md` -- classificacao de dados, STRIDE, 42 issues, requisitos por modulo
- `docs/talitha-design-system.md` -- tokens, tipografia, paleta, componentes (Atomic Design)
- `docs/talitha-wireframes.md` -- 34 telas especificadas
- `docs/talitha-navigation-flow.md` -- rotas, guards, maquinas de estado
- `docs/talitha-architecture.md` -- estrutura, fronteiras de confianca, integracoes, decisoes tecnicas
- `docs/adr/` -- Architecture Decision Records (ADR-0001 a ADR-0006)
- `docs/decisions.md` -- decisoes de produto e tecnicas em conversa
- `docs/talitha-status.md` -- progresso atual
