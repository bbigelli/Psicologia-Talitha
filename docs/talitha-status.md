# Status: talitha-psicologia
## Fase atual: Execucao -- Sprint 3 QA APROVADA COM RESSALVA
## Ultimo agente: QA Agent (Sprint 3)
## Branch: feature/sprint-3-patients

### Planejamento
- Decisoes de stack e escopo: OK (docs/decisions.md)
- PO / PRD + stories: OK (docs/talitha-prd.md + docs/talitha-user-stories.md)
- Security Review (PRD): OK (docs/talitha-security-review-prd.md)
- Design & UI: OK (docs/talitha-design-system.md + docs/talitha-wireframes.md + docs/talitha-navigation-flow.md)
- System Architect: OK v1.1 (docs/talitha-architecture.md + docs/adr/ + CLAUDE.md)
- Security Review (arquitetura): APROVADA -- 8/8 correcoes fechadas
- Data Architect: OK v1.6 (docs/talitha-data-architecture.md + supabase/migrations/)
- Security Review (schema): APROVADO
- Backlog: CONCLUIDO (docs/talitha-backlog.md)

### Sprint 1: Fundacao -- ENCERRADA
- Task 1.1-1.7: CONCLUIDAS
- Code Review: APROVADO
- QA: APROVADO (91 testes, 90 passando)
- 4 patches aplicados

### Sprint 2: Autenticacao & MFA -- APROVADA COM RESSALVA
- Task 2.1: Login e callback de autenticacao -- CONCLUIDA
- Task 2.2: MFA TOTP (setup e verificacao) -- CONCLUIDA
- Task 2.3: Recuperacao de senha -- CONCLUIDA (B1 corrigido: Server Action com aal2)
- Task 2.4: Middleware completo -- CONCLUIDA
- Task 2.5: Layouts de area (5 route groups) -- CONCLUIDA
- Task 2.6: Onboarding e perfil da psicologa -- CONCLUIDA
- Code Review 1: REPROVADO (1B + 1W) -- corrigidos
- Code Review 2: APROVADO
- QA 1: REPROVADO (F5 profiles recursion + F6 password policy)
- F5 corrigido: migration 121500 (fn_is_psychologist SD)
- F5b corrigido: GRANT UPDATE cipher columns
- QA 2: APROVADO COM RESSALVA -- docs/talitha-qa-sprint-2.md
- Build: PASSA
- TypeScript: PASSA
- Testes: 217 total (216 passando, 1 pulado) -- SEM REGRESSAO
- 5 patches aplicados (121200-121500)

### ALERTA: docs/credentials.md foi sobrescrito pelo seed
- O seed rodou ANTES da correcao S3 e sobrescreveu docs/credentials.md
- O arquivo agora contem apenas credenciais do seed, nao as chaves originais
- O desenvolvedor precisa restaurar o conteudo original de docs/credentials.md
  a partir do .env.local ou de outra fonte

### Pendencias (nao bloqueiam Sprint 3)
- **F6 (WARNING):** Politica de senha no Supabase Auth dashboard NAO configurada. Servidor aceita senhas fracas. Acao do desenvolvedor: configurar no dashboard
- S1: middleware.ts deprecation -- avaliar migracao para proxy.ts na Sprint 8
- S2: Seed nao cria registro em patients (NOT NULL cpf) -- Sprint 3
- S4: ProfileForm exige CPF em toda edicao -- schema com CPF opcional para futuro
- S6: Sidebar mobile sem Vaul (usa overlay customizado) -- consistencia futura
- S7: x-forwarded-for trust rule ausente -- Sprint 4+
- S10: Considerar wrapper withAuthenticatedUser para Server Actions role-agnostic
- S11: eslint error em MfaSetup.tsx (setState em useEffect)
- (Sprint 1) S1: ASAAS_BASE_URL ausente no .env.example

### Sprint 3: Pacientes & Consentimento -- IMPLEMENTADA
- Task 3.1: Cadastro de paciente com CPF cifrado -- CONCLUIDA
  - Schema: src/schemas/patient.ts (zod, CPF mod-11, idade >= 18)
  - Actions: src/lib/actions/patients.ts (createPatient, resendInvite via withPsychologist)
  - Pages: src/app/(psychologist)/pacientes/page.tsx, pacientes/novo/page.tsx
  - Components: PatientForm.tsx, PatientList.tsx
  - CPF cifrado com envelope (AAD=patient_id|'cpf'), blind index HMAC-SHA256
  - UUID gerado ANTES de cifrar (AAD depende do ID)
  - Admin client usado (patients sem GRANT INSERT para authenticated)
- Task 3.2: Email de convite via Resend -- CONCLUIDA
  - Email client: src/lib/email/client.ts (RESEND_API_KEY_APP)
  - Templates: src/lib/email/templates.ts (assunto neutro "Seu acesso ao portal")
  - Send: src/lib/email/send.ts (nunca loga conteudo)
  - Token hash (SHA-256) no banco, raw no email, TTL 72h, purpose=invite
  - Rate limit: 3/paciente/hora
- Task 3.3: Primeiro acesso do paciente -- CONCLUIDA
  - Page: src/app/(auth)/convite/[token]/page.tsx (force-dynamic, no-store)
  - Component: src/components/auth/InviteAcceptForm.tsx
  - Token validado via consume_email_token RPC (admin client, atomico)
  - Senha minima 10 chars com letra e numero
  - Apos criar senha: redirect para /termos/atendimento
- Task 3.4: Termos de consentimento (CFP + LGPD) -- CONCLUIDA
  - Pages: termos/atendimento (etapa 1/2), termos/lgpd (etapa 2/2)
  - Components: ConsentSection, OnlineTherapyConsentForm, LgpdConsentForm
  - Actions: src/lib/actions/consents.ts (acceptConsent, acceptMultipleConsents, revokeConsent)
  - Textos: src/lib/consent-texts.ts (constantes + hashes precomputados)
  - Consentimento segmentado: online_therapy, lgpd_clinical, lgpd_asaas (obrigatorios) + communication (opcional)
  - E7: clausulas de formato online, faltas, queda de conexao
  - Aceite com hash SHA-256 do texto, IP, user_agent, timestamp UTC
  - Append-only (enforced por triggers no banco)
- Task 3.5: Portal do paciente (home) -- CONCLUIDA
  - Page: src/app/(patient)/portal/page.tsx (reescrita completa)
  - Linguagem discreta: "compromissos" em vez de "sessoes de terapia"
  - Estado vazio com mensagem orientativa
  - Skeleton loading via Suspense
- Task 3.6: Perfil do paciente -- CONCLUIDA
  - Page: src/app/(patient)/portal/perfil/page.tsx
  - Component: src/components/patients/PatientProfile.tsx
  - Dados da psicologa (CRP, especialidade), sem e-Psi (E5)
  - Revogacao de consentimento LGPD com AlertDialog
  - Sem campo e-Psi (E5)
- Middleware: atualizado com consent check para pacientes
- Patient layout: atualizado com consent check (defense-in-depth)
- Build: PASSA (19 rotas)
- TypeScript: PASSA (zero erros)
- Testes: 317 total (316 passando, 1 pulado) -- SEM REGRESSAO (QA 85 + roundtrip 6)
- Resend SDK instalado (v4)

### Decisoes tomadas pelo agente (sem perguntar ao dev)
- Usado admin client (service_role) para INSERT em patients e email_action_tokens (alternativa: RPC nova). Motivo: patients nao tem GRANT INSERT para authenticated; admin.ts ja esta no allowlist do projeto; a autorizacao e feita dentro do wrapper withPsychologist
- Hashes dos textos de consentimento precomputados como constantes (alternativa: computar dinamicamente). Motivo: evita node:crypto no bundle do client; valores deterministicos que so mudam quando o texto muda
- acceptInvite nao usa wrapper (withPublicAction). Motivo: paciente nao esta autenticado; precisa de admin client para consumir token e setar senha; autorizacao e pelo token criptografico
- Colunas BYTEA de CPF inseridas com prefixo \\x (formato PostgREST para hex)

### Schema: nenhuma RPC nova necessaria
- createPatient usa admin client direto (inserindo em patients e email_action_tokens)
- consume_email_token ja existe e foi reutilizada
- Consents inseridos pelo paciente via RLS policy existente (consents_insert_patient)

### Pendencias (nao bloqueiam Sprint 3)
- **F6 (WARNING):** Politica de senha no Supabase Auth dashboard NAO configurada
- S1: middleware.ts deprecation -- avaliar migracao para proxy.ts na Sprint 8
- S4: ProfileForm exige CPF em toda edicao
- S6: Sidebar mobile sem Vaul
- S7: x-forwarded-for trust rule ausente -- Sprint 4+
- S10: Considerar wrapper withAuthenticatedUser para Server Actions role-agnostic
- S11: eslint error em MfaSetup.tsx
- EMAIL_FROM nao adicionado ao .env.example (permissao negada para ler/editar .env.example)
- RESEND_API_KEY_APP nao adicionado ao .env.example (mesmo motivo)

### QA Sprint 3: APROVADA COM RESSALVA -- docs/talitha-qa-sprint-3.md
- 85 testes novos escritos e executados
- 311 total (310 passando, 1 pulado informacional)
- Zero regressao
- **BLOCKER-1:** profile.ts grava hex sem prefixo \x em BYTEA (bug de CODIGO, nao de dado -- ninguem completou onboarding). Correcao: adicionar hexToBytea() em profile.ts linhas 42-48 e 89-95
- Round-trip criptografia: Sprint 3 (patients.ts) OK. Sprint 2 (profile.ts) CORRUPTO
- Hashes de consentimento correspondem aos textos (4/4)
- Consentimento append-only confirmado (triggers bloqueiam UPDATE/DELETE)
- Token: hash armazenado, atomicidade OK, expiracao OK, single-use OK
- Email discreto (sem mencao clinica)
- RLS: isolamento paciente-paciente validado com dados reais
- Column-level grants: cpf_ciphertext/cpf_hmac bloqueados para authenticated

### BLOCKER-1: CORRIGIDO
- hexToBytea() movido de patients.ts local para src/lib/crypto/envelope.ts (funcao exportada)
- envelopeToBytea() helper tambem adicionado (converte envelope inteiro)
- profile.ts: ambos completeOnboarding e updateProfile agora usam hexToBytea (linhas 42-48 e 89-95)
- patients.ts: atualizado para importar de @/lib/crypto/envelope (funcao local removida)
- Auditoria completa: ZERO outros locais no projeto gravavam BYTEA sem prefixo
- Teste de round-trip: src/__tests__/lib/crypto/bytea-roundtrip.test.ts (6 testes, todos passando)
  - Profile CPF round-trip (encrypt -> hexToBytea -> strip prefix -> decrypt) OK
  - Patient CPF round-trip OK
  - Hex SEM prefixo -> decrypt FALHA (prova do bug)

### Pendencias acumuladas
- **F6 (WARNING):** Politica de senha no Supabase Auth dashboard NAO configurada
- S1: middleware.ts deprecation
- S4: ProfileForm exige CPF em toda edicao
- S6: Sidebar mobile sem Vaul
- S7: x-forwarded-for trust rule ausente
- S10: Considerar wrapper withAuthenticatedUser
- S11: eslint error em MfaSetup.tsx
- EMAIL_FROM e RESEND_API_KEY_APP nao adicionados ao .env.example (permissao negada)
- W1: unused imports na Sprint 3 (4 arquivos)

### Proximo passo
BLOCKER-1 corrigido. Sprint 3 pronta. Avancar para Sprint 4 -- Agenda & Lembretes.
