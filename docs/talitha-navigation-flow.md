# Fluxo de Navegacao: Talitha Psicologia

**Versao:** 1.0
**Data:** 2026-09-09
**Referencia:** docs/talitha-design-system.md, docs/talitha-wireframes.md

---

## 1. Mapa de Rotas

```
/ (redirect -> /login ou /dashboard ou /portal conforme auth)

Autenticacao (AuthLayout, publicas)
├── /login
├── /mfa/verify
├── /mfa/setup
├── /convite/[token]          <- paciente: criar senha
└── /recuperar-senha          <- Supabase Auth nativo

Onboarding (PsychologistLayout parcial)
└── /onboarding               <- setup profissional da psicologa

Consentimento (ConsentLayout, requer auth de paciente)
├── /termos/atendimento       <- Termo CFP (etapa 1)
└── /termos/lgpd              <- Consentimento LGPD segmentado (etapa 2)

Painel da Psicologa (PsychologistLayout, role=psychologist)
├── /dashboard                <- KPIs + grafico + cobrancas recentes
├── /agenda                   <- visao semanal/diaria
├── /agenda/nova-sessao       <- formulario de agendamento
├── /pacientes                <- lista
├── /pacientes/novo           <- formulario de cadastro
├── /pacientes/[id]           <- ficha com tabs (info/anamnese/historico/financeiro/log)
├── /pacientes/[id]/evolucao  <- nova evolucao clinica
├── /financeiro               <- redirect para /financeiro/cobrancas
├── /financeiro/cobrancas     <- tabela de cobrancas (TanStack Table)
├── /financeiro/cobrancas/nova <- formulario de cobranca
├── /financeiro/assinaturas   <- lista de assinaturas
├── /financeiro/inadimplentes <- painel de inadimplentes
├── /financeiro/recibos       <- lista de recibos emitidos
└── /perfil                   <- perfil da psicologa (editavel)

Portal do Paciente (PatientLayout, role=patient)
├── /portal                   <- home (proximos compromissos + status)
├── /portal/compromissos      <- lista de sessoes
├── /portal/anamnese          <- ficha inicial
├── /portal/pagamentos        <- historico de pagamentos
├── /portal/documentos        <- recibos para download
├── /portal/perfil            <- perfil + consentimentos + LGPD request
└── /portal/dados/solicitar   <- confirmar solicitacao de dados

Sala de Video (VideoLayout, ambos os perfis)
├── /sala/[sessionId]/preflight <- teste de dispositivos
├── /sala/[sessionId]/espera    <- sala de espera (paciente apenas)
└── /sala/[sessionId]           <- sala de video

Erros (AuthLayout, sem auth necessario)
├── /404                        <- catch-all
└── /500                        <- via Error Boundary
```

---

## 2. Guards de Autenticacao e Roteamento

### 2.1 Middleware Next.js — logica de redirect

```
Requisicao chega
  |
  ├─ Rota publica? (/login, /convite/*, /404, /500)
  │   └── Permitir
  │
  ├─ Sem sessao autenticada?
  │   └── Redirect /login
  │
  ├─ role = psychologist?
  │   ├─ Onboarding nao concluido?
  │   │   └── Redirect /onboarding (exceto se ja esta la)
  │   ├─ MFA nao configurado?
  │   │   └── Redirect /mfa/setup (exceto se ja esta la)
  │   ├─ Tentando acessar /portal/*?
  │   │   └── Redirect /dashboard
  │   └── Permitir acesso a rotas da psicologa
  │
  ├─ role = patient?
  │   ├─ Termos nao aceitos (versao atual)?
  │   │   └── Redirect /termos/atendimento (ou /termos/lgpd se so falta o segundo)
  │   ├─ Tentando acessar /dashboard, /pacientes, /financeiro, /agenda?
  │   │   └── Redirect /portal
  │   └── Permitir acesso a rotas do paciente
  │
  └─ Role desconhecido? -> Redirect /login + invalidar sessao
```

### 2.2 Guard de sala de video (server-side, Edge Function)

Verificacoes **obrigatorias** antes de emitir token LiveKit (secao 5 do Security Review):

```
1. Auth: getUser(jwt) retorna uid? -> senao: 404
2. Body tem session_id valido (uuid, zod)? -> senao: 400
3. Sessao existe e status nao e cancelled/completed/no_show? -> senao: 404
4. uid == psychologist_id OU uid == patients.user_id? -> senao: 404 (mesmo resposta)
5. Dentro da janela temporal (-15min a +duracao+30min)? -> senao: 404
6. Se paciente: consentimentos vigentes (CFP + LGPD)? -> senao: 404
7. Se paciente: admitted_at IS NOT NULL? -> senao: 404
8. Tudo ok -> emitir token com grants minimos
```

Toda negacao retorna 404 generico identico. Motivo real registrado em audit log (`DENY_ROOM_TOKEN`).

---

## 3. Maquinas de Estado

### 3.1 Onboarding da Psicologa (com MFA)

```
[Primeiro Login]
     |
     v
[MFA Setup] ──── QR code + verificacao ────> [Recovery Codes]
     |                                            |
     | (ja configurado)                           | (salvou codigos)
     v                                            v
[MFA Verify] ─── codigo correto ──────────> [Onboarding Check]
     |                                            |
     | (codigo errado)                            ├── onboarding pendente
     | -> retry (max 5x -> lock temporario)       │        |
     |                                            │        v
     └──── recovery code ─────────────────>       │   [Onboarding Form]
                                                  │        |
                                                  │        | (salvar)
                                                  │        v
                                                  └── onboarding ok
                                                         |
                                                         v
                                                    [Dashboard]
```

Regras:
- MFA Setup acontece UMA vez (primeiro login apos criar conta)
- MFA Verify acontece em TODO login subsequente
- Onboarding Check verifica se `profiles.onboarding_completed = true`
- Se onboarding incompleto, qualquer rota da psicologa redireciona para /onboarding
- Apos onboarding, nunca mais redireciona

### 3.2 Convite e Primeiro Acesso do Paciente (com Consentimento)

```
[Email de Convite]
     |
     | (clica no link)
     v
[Validar Token] ─── invalido/expirado ──> [Erro: "Convite expirado"]
     |
     | (valido)
     v
[Criar Senha] ──── senha fraca ──> [Erro inline, retry]
     |
     | (senha criada)
     v
[Auto-login]
     |
     v
[Consentimento Check]
     |
     ├── Termo Atendimento nao aceito
     │        |
     │        v
     │   [Tela Termo Atendimento (B.02)]
     │        |
     │        | (aceitar)
     │        v
     ├── Consentimento LGPD nao aceito
     │        |
     │        v
     │   [Tela LGPD Segmentado (B.03)]
     │        |
     │        | (aceitar obrigatorios)
     │        v
     └── Todos aceitos
              |
              v
         [Portal Home (B.04)]
              |
              | (se anamnese nao preenchida)
              v
         [Banner: "Preencha sua ficha inicial"]
```

Regras:
- Token de convite: 256 bits, hash no banco, uso unico, TTL 72h
- Apos criacao de senha, o token e invalidado
- Consentimento e verificado a cada login (versao do termo pode mudar)
- Se termo atualizado, paciente e redirecionado para aceitar nova versao
- Paciente NAO pode acessar /portal nem /sala sem consentimento vigente
- Anamnese e recomendada (banner) mas nao bloqueante

### 3.3 Entrada na Sessao (Pre-flight -> Espera -> Admissao -> Sala -> Encerramento)

**Fluxo do Paciente:**

```
[Portal: botao "Entrar na sala"]
     |
     v
[Guard Check] ─── sem consentimento ──> [Redirect /termos]
     |            fora da janela ─────> [Erro: "Disponivel as X"]
     |            sessao cancelada ───> [Erro: "Cancelado"]
     |
     | (ok)
     v
[Pre-flight (A.11)]
     |
     ├── sem permissao navegador ──> [Instrucoes de permissao]
     ├── sem microfone ────────────> [Bloqueado: "Microfone obrigatorio"]
     ├── sem camera ───────────────> [Aviso, pode continuar so audio]
     |
     | ("Tudo certo, entrar")
     v
[Sala de Espera (B.05)] ──── atualiza sessions.waiting_since
     |
     | (polling do proprio registro a cada 3-5s)
     |
     ├── admitted_at != null ───────> [Conectando...]
     ├── > 10 min ─────────────────> [Mensagem de espera estendida]
     ├── > 20 min ─────────────────> [Opcao de sair]
     ├── paciente saiu ────────────> [Portal Home]
     |
     | (admitido)
     v
[Request Token LiveKit] ──── negado ──> [Erro 404 generico]
     |
     | (token recebido)
     v
[Sala de Video (B.06)]
     |
     ├── conexao caiu ──────> [Reconectando...] ──── < 30s ──> [Retoma]
     │                                           └── > 30s ──> [Falhou: retry/sair]
     ├── psicologa desconectou ──> ["Aguardando retorno..."]
     ├── paciente clica Sair ──> [Confirm dialog] ──> [Portal]
     |
     | (psicologa encerra)
     v
[Sessao Encerrada: "Ate a proxima!"]
     |
     v
[Portal Home]
```

**Fluxo da Psicologa:**

```
[Agenda ou Notificacao: paciente aguardando]
     |
     v
[Pre-flight (A.11)] ── (opcional: psicologa pode pular se dispositivos ok)
     |
     v
[Admitir Paciente]
     |
     ├── sessao ativa ────> [Aviso: "Finalize a sessao atual"]
     ├── paciente saiu ───> ["Paciente nao esta mais aguardando"]
     |
     | (admitir)
     v
[sessions.admitted_at = now()]
     |
     v
[Request Token LiveKit + Room Create]
     |
     v
[Sala de Video (A.10)]
     |
     ├── abre painel de anotacoes ──> [Painel lateral]
     ├── reconexao (mesmo fluxo)
     |
     | ("Encerrar Sessao")
     v
[AlertDialog: "Encerrar? Paciente sera desconectado."]
     |
     | (confirmar)
     v
[deleteRoom server-side + sessions.status = completed]
     |
     v
[Registro de Evolucao (A.09)] ── pre-carregado com anotacoes da sessao
     |
     v
[Ficha do Paciente / Dashboard]
```

### 3.4 Agendamento

```
[Agenda: "+ Nova sessao"]
     |
     v
[Formulario de Agendamento]
     |
     ├── Selecionar paciente
     ├── Dia da semana + horario + duracao (padrao 50min)
     ├── [CB] Recorrencia semanal
     |
     | (salvar)
     v
[Verificar Conflitos (server-side)]
     |
     ├── conflito ────> [Erro: "Conflito com [Nome] das [hora] as [hora]"]
     ├── conflito parcial (recorrencia) ──> [Aviso: "N sessoes criadas, M com conflito"]
     |
     | (sem conflito)
     v
[Sessoes criadas (1 ou 12 semanas)]
     |
     v
[Convite de email ao paciente] (se paciente ativo e lembretes habilitados)
     |
     v
[Agenda atualizada]
```

### 3.5 Pagamento (Cobranca -> PIX -> Confirmacao -> Recibo)

```
[Psicologa: "Nova cobranca"]
     |
     v
[Formulario: paciente, metodo, valor, vencimento]
     |
     | (validacao server-side: valor > 0, vencimento >= hoje)
     v
[Edge Function -> Asaas API]
     |
     ├── paciente nao existe no Asaas ──> [Auto-create customer] ──> [Criar cobranca]
     ├── erro Asaas ──> [Toast generico, nao literal]
     |
     | (sucesso)
     v
[Cobranca criada: status "Pendente"]
     |
     ├── Asaas envia email ao paciente com link de pagamento
     |
     v [Paciente acessa link Asaas e paga]
     |
     v
[Asaas envia webhook PAYMENT_RECEIVED]
     |
     v
[Edge Function de webhook]
     |
     ├── token invalido ──> 401 (rejeitar)
     ├── evento ja processado (idempotencia) ──> 200 (sem side-effect)
     ├── fora da janela de 7 dias ──> 200 + log
     |
     | (novo evento valido)
     v
[Re-consultar GET /v3/payments/{id}] ── valor/status autoritativo
     |
     v
[Transacao: atualizar charges + sessions.payment_status + criar receipt]
     |
     ├── receipt: numero sequencial via receipt_counters (select for update)
     ├── unique (charge_id) — no maximo 1 recibo por cobranca
     |
     v
[Status "Pago" refletido no Dashboard + Portal do Paciente]
     |
     v
[Paciente acessa /portal/documentos -> baixa recibo on-demand]
```

Fluxo da regua de cobranca (cron):

```
[Cron diario (9h)]
     |
     v
[Para cada cobranca com vencimento proximo ou vencida]
     |
     ├── D-3: enviar lembrete de vencimento
     ├── D+3: enviar primeiro lembrete pos-vencimento
     ├── D+7: enviar segundo lembrete + notificar psicologa
     ├── D+15: marcar como "Inadimplente" + notificar psicologa
     |
     ├── Ja pago (webhook confirmou)? ──> Nao enviar
     ├── Opt-out de lembretes? ──> Nao enviar
     ├── Ja enviou este step? (idempotencia) ──> Nao reenviar
     |
     v
[Email com assunto neutro: "Aviso de vencimento" / "Pagamento pendente"]
```

---

## 4. Fluxo de Consentimento — Atualizacao de Versao

```
[Paciente faz login]
     |
     v
[Middleware verifica versao do consentimento]
     |
     ├── Termo CFP: versao aceita < versao atual?
     │        └── Redirect /termos/atendimento
     │
     ├── LGPD: versao aceita < versao atual?
     │        └── Redirect /termos/lgpd
     │
     └── Ambos atualizados
              └── Permitir acesso ao portal
```

Regras:
- O redirect e obrigatorio: paciente nao pode navegar no portal ate aceitar a versao atual
- A versao anterior do aceite e mantida no historico (append-only)
- Novo aceite gera novo registro em `consents` (nunca update)

---

## 5. Fluxo de Revogacao de Consentimento

```
[Paciente: /portal/perfil -> "Revogar consentimento"]
     |
     v
[AlertDialog com consequencias]
     |
     ├── Cancelar ──> [Permanece no perfil]
     |
     | (confirmar)
     v
[Server: registrar revogacao com timestamp, IP, UA]
     |
     ├── Bloquear emissao de token de sala
     ├── Parar regua de cobranca para este paciente
     ├── Parar lembretes de sessao
     ├── Revogar sessoes ativas (forcar logout)
     ├── Congelar prontuario como read-only
     ├── Notificar psicologa por email
     |
     v
[Paciente redirecionado para /login com mensagem:
 "Seu consentimento foi revogado. Seus dados serao mantidos
  pelo prazo legal. Entre em contato com sua profissional
  se desejar retomar."]
```

---

## 6. Fluxo de Cancelamento de Sessao

```
[Paciente ou Psicologa: "Cancelar sessao"]
     |
     v
[Verificar politica de prazo (server-side)]
     |
     ├── Psicologa cancelando:
     │   └── Sempre permitido
     │       └── Paciente recebe email: "Alteracao no seu compromisso"
     │       └── Cobranca associada cancelada (se pendente)
     │
     ├── Paciente, dentro do prazo (>24h):
     │   └── Cancelar sem restricao
     │       └── Psicologa notificada
     │
     ├── Paciente, fora do prazo (<24h):
     │   └── Aviso: "O prazo ja passou. Valor podera ser cobrado."
     │       ├── "Cancelar mesmo assim" ──> Marca "Cancelada fora do prazo"
     │       │                               Psicologa decide sobre cobranca
     │       └── "Manter" ──> Volta
     │
     ├── Sessao em andamento:
     │   └── Bloqueado: "Esta sessao esta em andamento"
     │
     └── Sessao passada:
         └── Bloqueado: "Sessoes passadas nao podem ser canceladas"
```

---

## 7. Fluxo de Solicitacao de Dados (LGPD)

```
[Paciente: /portal/perfil -> "Solicitar copia dos dados"]
     |
     v
[Verificar solicitacao pendente]
     |
     ├── Ja tem solicitacao pendente:
     │   └── "Voce ja tem uma solicitacao em andamento. Prazo: [data]."
     |
     | (nova solicitacao)
     v
[Registrar solicitacao + audit log + notificar psicologa]
     |
     v
[Psicologa recebe notificacao]
     |
     ├── Acessar notificacao -> [Gerar Export]
     │   └── Dados incluidos: cadastrais + sessoes (datas/duracoes) + pagamentos + recibos + termos
     │   └── NAO inclui: conteudo clinico (evolucoes, anamnese)
     │
     ├── Download autenticado, signed URL de vida curta
     |
     └── Prazo: 15 dias uteis (D+15: lembrete automatico a psicologa)
```

---

## 8. Transicoes e Animacoes

| Transicao | Duracao | Easing | Nota |
|---|---|---|---|
| Troca de pagina (rota) | 300ms | ease-in-out | Skeleton do layout enquanto carrega |
| Abertura de modal/dialog | 300ms | ease-in-out | Fade + scale de 0.95 a 1 |
| Abertura de Sheet/Drawer | 300ms | spring | Slide-in com bounce sutil |
| Vaul drawer (mobile) | 300ms | spring | Slide-up nativo do Vaul |
| Hover em botao/card | 150ms | ease-in-out | Mudanca de cor/sombra |
| Focus ring | 100ms | ease-in-out | Aparece instantaneamente |
| Toast (sonner) | 300ms | ease-in-out | Slide-in de cima |
| Sala de espera "breathe" | 4000ms | ease-in-out | Pulsacao suave continua |
| Skeleton pulse | 2500ms | ease-in-out | Opacidade 0.7 a 1 |
| Reconexao overlay | 300ms | ease-in-out | Fade-in sobre video |

Todas as animacoes respeitam `prefers-reduced-motion: reduce` (duracoes reduzidas a 0.01ms).

---

## Historico de versoes

| Versao | Data | Mudanca |
|--------|------|---------|
| 1.0 | 2026-09-09 | Fluxo de navegacao inicial: mapa de rotas, guards de auth, 7 maquinas de estado (onboarding, convite, sessao, agendamento, pagamento, revogacao, LGPD), transicoes |
