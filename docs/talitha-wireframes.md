# Wireframes: Talitha Psicologia
> ## ⚠️ AVISO DE PRECEDÊNCIA — leia antes de implementar qualquer item deste documento
>
> Este documento foi escrito antes das **Emendas E5 a E8** do PRD (`docs/talitha-prd.md`, seção no topo). Elas têm precedência sobre qualquer trecho aqui.
>
> - **Toda menção a "e-Psi" neste arquivo é obsoleta.** A Resolução CFP nº 09/2024 revogou o cadastro e-Psi e a plataforma foi desativada em 31/08/2024. Não implemente campo, validação, tela ou requisito de e-Psi. O CRP ativo continua obrigatório.
> - **Em vez disso, existe um requisito novo (E6):** registro datado de **viabilidade técnica do atendimento remoto** no prontuário — veredicto de adequação, justificativa e data, tratado como conteúdo clínico (cifrado, append-only). É o item que protege a psicóloga perante o CRP.
> - **O termo de consentimento (E7)** deve cobrir formato online, política de faltas e queda de conexão.
> - **Nenhuma validação automática de "caso inelegível" (E8)** — as vedações de atendimento em crise, emergência, violência e desastre foram revogadas; a decisão é clínica e fica registrada via E6.


**Versao:** 1.0
**Data:** 2026-09-09
**Referencia:** docs/talitha-design-system.md

---

## Convencoes

- `[AV]` = Avatar
- `[BTN]` = Botao
- `[IN]` = Input
- `[SK]` = Skeleton (estado loading)
- `[CB]` = Checkbox
- `(*)` = Obrigatorio
- Larguras: Mobile < 640px, Desktop > 1024px
- Wireframes mobile-first. Desktop mostrado apenas quando o layout muda significativamente.
- Nomes de componentes entre parenteses indicam o componente do design system.

---

## Perfil A: Painel da Psicologa

---

### A.01 — Login

Compartilhada entre psicologa e paciente. AuthLayout.

```
Mobile (< 640px)
┌─────────────────────────────────┐
│                                 │
│         Talitha                 │  <- text-2xl font-bold text-primary
│                                 │
│  ┌─────────────────────────┐    │
│  │ card shadow-lg p-6      │    │
│  │                         │    │
│  │  E-mail (*)             │    │
│  │  ┌───────────────────┐  │    │
│  │  │ seu@email.com     │  │    │
│  │  └───────────────────┘  │    │
│  │                         │    │
│  │  Senha (*)              │    │
│  │  ┌──────────────── 👁┐  │    │
│  │  │ ••••••••        │  │    │
│  │  └───────────────────┘  │    │
│  │                         │    │
│  │  [  Entrar          ]   │    │  <- Button primary, full-width
│  │                         │    │
│  │  Esqueci minha senha    │    │  <- Link text-sm text-primary
│  └─────────────────────────┘    │
│                                 │
└─────────────────────────────────┘
```

**Estados:**
- Loading: botao "Entrar" com Loader2 + "Aguarde..."
- Erro de credenciais: toast "E-mail ou senha incorretos." (mensagem generica — nunca revelar se o email existe)
- Erro de rede: toast "Nao foi possivel conectar. Verifique sua conexao."
- Apos senha valida (psicologa): redireciona para A.02 (MFA verify)
- Apos senha valida (paciente, sem MFA): redireciona para portal

---

### A.02 — MFA Verify (Login)

Aparece apos email+senha validos para a psicologa. AuthLayout.

```
Mobile
┌─────────────────────────────────┐
│                                 │
│         Talitha                 │
│                                 │
│  ┌─────────────────────────┐    │
│  │                         │    │
│  │  🛡  Verificacao        │    │  <- ShieldCheck 32px
│  │                         │    │
│  │  Digite o codigo do     │    │
│  │  seu app autenticador   │    │
│  │                         │    │
│  │  ┌──┐┌──┐┌──┐ ┌──┐┌──┐┌──┐ │  <- MfaCodeInput (6 digitos)
│  │  │  ││  ││  │ │  ││  ││  │ │
│  │  └──┘└──┘└──┘ └──┘└──┘└──┘ │
│  │                         │    │
│  │  [  Verificar         ] │    │
│  │                         │    │
│  │  Usar codigo de         │    │  <- Link text-sm
│  │  recuperacao            │    │
│  └─────────────────────────┘    │
│                                 │
└─────────────────────────────────┘
```

**Estados:**
- Codigo incorreto: borda destructive nos 6 inputs + "Codigo incorreto. Tente novamente." abaixo
- Loading: botao com spinner
- Apos 5 tentativas falhas: bloqueio temporario com countdown (rate limit do Supabase Auth)
- Link "codigo de recuperacao": abre campo de texto unico para o recovery code

---

### A.03 — MFA Setup (Primeiro Login)

Aparece uma unica vez no primeiro login da psicologa. AuthLayout.

```
Mobile
┌─────────────────────────────────┐
│                                 │
│  Talitha                        │
│                                 │
│  ┌─────────────────────────┐    │
│  │  🛡  Configurar          │    │
│  │  autenticacao segura     │    │
│  │                         │    │
│  │  Para proteger os dados │    │  <- text-base text-muted-foreground
│  │  dos seus pacientes,    │    │
│  │  configure um app       │    │
│  │  autenticador.          │    │
│  │                         │    │
│  │  1. Escaneie o QR Code  │    │
│  │  ┌─────────────────┐   │    │
│  │  │                 │   │    │  <- QR code 200x200
│  │  │   [QR CODE]     │   │    │
│  │  │                 │   │    │
│  │  └─────────────────┘   │    │
│  │                         │    │
│  │  Nao consegue escanear? │    │  <- Collapsible, mostra codigo manual
│  │                         │    │
│  │  2. Digite o codigo     │    │
│  │  ┌──┐┌──┐┌──┐ ┌──┐┌──┐┌──┐ │
│  │  │  ││  ││  │ │  ││  ││  │ │
│  │  └──┘└──┘└──┘ └──┘└──┘└──┘ │
│  │                         │    │
│  │  [  Verificar e         │    │
│  │     continuar         ] │    │
│  └─────────────────────────┘    │
│                                 │
└─────────────────────────────────┘
```

Apos verificacao valida, mostra codigos de recuperacao:

```
│  ┌─────────────────────────┐    │
│  │  Codigos de recuperacao │    │
│  │                         │    │
│  │  Guarde estes codigos   │    │
│  │  em lugar seguro. Cada  │    │
│  │  codigo so pode ser     │    │
│  │  usado uma vez.         │    │
│  │                         │    │
│  │  ┌───────────────────┐  │    │
│  │  │ XXXX-XXXX-XXXX   │  │    │  <- bg-muted, font-mono
│  │  │ XXXX-XXXX-XXXX   │  │    │
│  │  │ XXXX-XXXX-XXXX   │  │    │
│  │  │ XXXX-XXXX-XXXX   │  │    │
│  │  │ XXXX-XXXX-XXXX   │  │    │
│  │  │ XXXX-XXXX-XXXX   │  │    │
│  │  │ XXXX-XXXX-XXXX   │  │    │
│  │  │ XXXX-XXXX-XXXX   │  │    │
│  │  └───────────────────┘  │    │
│  │                         │    │
│  │  [Copiar] [Baixar .txt] │    │  <- Botoes ghost/outline
│  │                         │    │
│  │  [CB] Salvei meus       │    │
│  │  codigos em lugar seguro│    │
│  │                         │    │
│  │  [  Concluir          ] │    │  <- Habilitado quando CB marcado
│  └─────────────────────────┘    │
```

---

### A.04 — Onboarding da Psicologa

Primeira vez apos login+MFA. PsychologistLayout (sem sidebar ativa — so o form).

```
Mobile
┌─────────────────────────────────┐
│  Talitha                        │
├─────────────────────────────────┤
│                                 │
│  Bem-vinda! Configure           │  <- text-2xl font-bold
│  seu perfil profissional.       │
│                                 │
│  Nome completo (*)              │
│  ┌───────────────────────────┐  │
│  │                           │  │
│  └───────────────────────────┘  │
│                                 │
│  CRP (*) — Numero e regiao      │
│  ┌───────────────────────────┐  │
│  │ CRP 06/12345             │  │  <- placeholder
│  └───────────────────────────┘  │
│                                 │
│  Cadastro e-Psi (*)            │
│  ○ Ativo   ○ Pendente          │  <- RadioGroup
│                                 │
│  CPF (*)                        │
│  ┌───────────────────────────┐  │
│  │ 000.000.000-00           │  │  <- mascara
│  └───────────────────────────┘  │
│                                 │
│  Telefone (*)                   │
│  ┌───────────────────────────┐  │
│  │ (00) 00000-0000          │  │
│  └───────────────────────────┘  │
│                                 │
│  E-mail profissional (*)        │
│  ┌───────────────────────────┐  │
│  │                           │  │
│  └───────────────────────────┘  │
│                                 │
│  Especialidade                  │
│  ┌───────────────────────────┐  │
│  │ Ex: Psicologia Clinica   │  │
│  └───────────────────────────┘  │
│                                 │
│  Valor padrao da sessao (*)     │
│  ┌───────────────────────────┐  │
│  │ R$ 0,00                  │  │  <- input currency
│  └───────────────────────────┘  │
│                                 │
│  [  Salvar e comecar       ]    │  <- Button primary full-width
│                                 │
└─────────────────────────────────┘
```

**Estados:**
- Validacao inline: CRP formato invalido, CPF invalido (digitos verificadores), campos obrigatorios
- Loading: botao com spinner
- Erro de salvamento: toast "Nao foi possivel salvar. Tente novamente."
- Sucesso: redireciona para A.05 (Dashboard)

---

### A.05 — Dashboard Financeiro

Tela principal da psicologa. PsychologistLayout.

```
Desktop (> 1024px)
┌──────────┬──────────────────────────────────────────────────┐
│          │                                                   │
│ Talitha  │  Dashboard                         [Mes/Ano ▾]   │  <- filtro de periodo
│          │                                                   │
│ > Dashb. │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│   Agenda │  │ Recebido │ │ A receber│ │ Inadimpl.│ │ Projecao │  <- KpiCard x4
│   Pacien.│  │ R$8.400  │ │ R$3.200  │ │ R$1.600  │ │ R$11.600 │
│   Financ.│  │ +12% ↑   │ │          │ │ 2 pac.   │ │          │
│   Config │  └──────────┘ └──────────┘ └──────────┘ └──────────┘
│          │                                                   │
│          │  ┌─────────────────────────────────────────────┐  │
│ [AV]     │  │  Receita mensal (recharts BarChart)         │  │  <- h-72
│ Talitha  │  │  ████ ████ ████ ████ ████ ████              │  │
│ Sair     │  └─────────────────────────────────────────────┘  │
│          │                                                   │
│          │  Cobrancas recentes                  Ver todas >   │
│          │  ┌─────────────────────────────────────────────┐  │
│          │  │ Maria S.  | Sessao Out | R$200 | ● Pago    │  │
│          │  │ Joao P.   | Sessao Out | R$200 | ● Pendente│  │
│          │  │ Ana R.    | Sessao Set | R$200 | ● Vencida │  │
│          │  └─────────────────────────────────────────────┘  │
└──────────┴──────────────────────────────────────────────────┘

Mobile (< 640px)
┌─────────────────────────────────┐
│ ☰  Talitha               🔔 [AV]│  <- Header sticky 56px
├─────────────────────────────────┤
│  Dashboard          [Set 2026 ▾]│
│                                 │
│  ┌──────────┐ ┌────────────────┐│
│  │ Recebido │ │ A receber      ││  <- grid-cols-2
│  │ R$ 8.400 │ │ R$ 3.200       ││
│  │ +12% ↑   │ │                ││
│  └──────────┘ └────────────────┘│
│  ┌──────────┐ ┌────────────────┐│
│  │ Inadimpl.│ │ Projecao       ││
│  │ R$ 1.600 │ │ R$ 11.600      ││
│  │ 2 pac.   │ │                ││
│  └──────────┘ └────────────────┘│
│                                 │
│  ┌─────────────────────────┐    │
│  │  Receita mensal         │    │  <- h-48
│  │  ████ ████ ████ ████    │    │
│  └─────────────────────────┘    │
│                                 │
│  Cobrancas recentes    Ver todas│
│  ┌─────────────────────────┐    │
│  │ Maria S.    R$200  Pago │    │
│  │ Joao P.     R$200  Pend.│    │
│  │ Ana R.      R$200  Venc.│    │
│  └─────────────────────────┘    │
│                                 │
└─────────────────────────────────┘
```

**Estados:**
- Loading: Skeleton nos 4 KpiCards (retangulos com pulse) + skeleton no grafico + skeleton na lista
- Vazio (primeiro mes): KPIs em R$0,00, variacao "Sem dados anteriores", grafico vazio. Mensagem: "Nenhuma cobranca registrada. Cadastre seus pacientes e crie a primeira cobranca." com link para /pacientes
- Erro: toast + botao retry inline nas areas afetadas

---

### A.06 — Agenda (Visao Semanal)

PsychologistLayout. Desktop mostra semana completa, mobile mostra dia.

```
Desktop
┌──────────┬──────────────────────────────────────────────────┐
│          │  Agenda              [Semana|Dia] [< Sem >]      │
│ Sidebar  │           Seg 9   Ter 10  Qua 11  Qui 12  Sex 13│
│          │  08:00   │       │       │       │       │       │
│          │  09:00   │ Maria │       │ Ana   │       │ Pedro │
│          │          │ S.    │       │ R.    │       │ M.    │
│          │  10:00   │ ● $$  │       │ ● $$  │       │ ● ?   │
│          │  11:00   │       │ Joao  │       │ Carla │       │
│          │          │       │ P.    │       │ L.    │       │
│          │  12:00   │       │ ● ?   │       │ ● $$  │       │
│          │  ...     │       │       │       │       │       │
│          │  14:00   │       │       │ Maria │       │       │
│          │          │       │       │ S.    │       │       │
│          │  15:00   │       │       │ ● $$  │       │       │
│          │                                                   │
│          │  [+ Nova sessao]                                  │
└──────────┴──────────────────────────────────────────────────┘

Legenda: ● $$ = pago (success), ● ? = pendente (warning), ● X = vencido (destructive)
Cada bloco e um SessionSlot com border-left colorido.
```

```
Mobile (< 640px) — Visao Diaria
┌─────────────────────────────────┐
│ ☰  Talitha               🔔 [AV]│
├─────────────────────────────────┤
│  Agenda                         │
│  [<]  Quarta, 11 Set 2026  [>] │  <- swipe ou setas
│                                 │
│  09:00 - 09:50                  │
│  ┌─────────────────────────┐    │
│  │ █ Ana R.                │    │  <- SessionSlot
│  │   Sessao recorrente     │    │
│  │   ● Pago                │    │
│  └─────────────────────────┘    │
│                                 │
│  14:00 - 14:50                  │
│  ┌─────────────────────────┐    │
│  │ █ Maria S.              │    │
│  │   Sessao recorrente     │    │
│  │   ● Pendente            │    │
│  └─────────────────────────┘    │
│                                 │
│  Nenhuma outra sessao hoje.     │  <- text-muted-foreground
│                                 │
│                                 │
│  [+ Nova sessao]                │  <- FAB ou inline button
└─────────────────────────────────┘
```

**Estados:**
- Loading: skeleton dos blocos de horario
- Vazio (semana sem sessoes): "Sua agenda esta vazia nesta semana. Cadastre pacientes e agende sessoes." + [Novo Paciente]
- Tap no SessionSlot (mobile): abre Vaul drawer com detalhes + acoes (cancelar, remarcar, prontuario, admitir)

---

### A.07 — Lista de Pacientes

PsychologistLayout.

```
Mobile
┌─────────────────────────────────┐
│ ☰  Talitha               🔔 [AV]│
├─────────────────────────────────┤
│  Pacientes              [+ Novo]│
│                                 │
│  ┌─────────────────────────┐    │  <- SearchBar
│  │ 🔍 Buscar paciente...   │    │
│  └─────────────────────────┘    │
│                                 │
│  ┌─────────────────────────┐    │
│  │ [AV] Maria Santos       │    │  <- PatientCard
│  │      ● Ativo            │    │
│  │      Prox: Qua 11, 14h  │    │
│  └─────────────────────────┘    │
│  ┌─────────────────────────┐    │
│  │ [AV] Joao Pereira       │    │
│  │      ● Convite pendente │    │  <- StatusBadge info
│  └─────────────────────────┘    │
│  ┌─────────────────────────┐    │
│  │ [AV] Ana Rodrigues      │    │
│  │      ● Ativo            │    │
│  │      Prox: Qui 12, 09h  │    │
│  └─────────────────────────┘    │
│                                 │
└─────────────────────────────────┘
```

**Estados:**
- Loading: skeleton de 5 PatientCards
- Vazio: icone Users 48px + "Voce ainda nao tem pacientes cadastrados." + [Cadastrar primeiro paciente]
- Busca sem resultado: "Nenhum paciente encontrado para '[termo]'."

---

### A.08 — Ficha do Paciente

PsychologistLayout. Tabs: Info, Anamnese, Historico, Financeiro, Audit Log.

```
Desktop
┌──────────┬──────────────────────────────────────────────────┐
│          │  ← Pacientes                                     │
│ Sidebar  │                                                   │
│          │  ┌────────┐  Maria Santos                         │
│          │  │  [AV]  │  ● Ativo                              │
│          │  └────────┘  Desde Mar/2026                       │
│          │                                                   │
│          │  [Info] [Anamnese] [Historico] [Financeiro] [Log] │
│          │  ─────────────────────────────────────────────── │
│          │                                                   │
│          │  Tab ativa: Historico                              │
│          │                                                   │
│          │  [+ Nova evolucao]      🔍 Buscar no historico    │
│          │                                                   │
│          │  ┌─────────────────────────────────────────────┐  │
│          │  │ 11 Set 2026 | 50min | 😐 Neutro            │  │  <- ClinicalRecordEntry
│          │  │ Paciente relatou melhora na qualidade do    │  │
│          │  │ sono. Mantemos abordagem cognitivo-comp...  │  │
│          │  │                                   [Editar]  │  │
│          │  └─────────────────────────────────────────────┘  │
│          │  ┌─────────────────────────────────────────────┐  │
│          │  │ 04 Set 2026 | 50min | 😟 Ansioso           │  │
│          │  │ Sessao focada em tecnicas de respiracao...  │  │
│          │  └─────────────────────────────────────────────┘  │
│          │                                                   │
│          │  [Carregar mais]                                  │
└──────────┴──────────────────────────────────────────────────┘
```

**Tab Info:** dados cadastrais (nome, email, telefone, CPF mascarado •••.•••.123-45, nascimento), status, botao [Reenviar convite] se pendente, [Encerrar atendimento] (destructive outline)

**Tab Anamnese:** exibe respostas se preenchida; "Nao preenchida" + [Reenviar lembrete] se nao

**Tab Historico:** lista de ClinicalRecordEntry com busca e paginacao (20 por pagina)

**Tab Financeiro:** lista de cobrancas do paciente (StatusBadge por status), assinatura ativa se houver, [Nova cobranca]

**Tab Audit Log:** lista cronologica de acessos (acao, data/hora, IP). Apenas leitura. Paginacao

**Estados de cada tab:**
- Loading: skeleton especifico do conteudo da tab
- Vazio: mensagem contextual (ex: "Nenhuma evolucao registrada. Registre a primeira apos uma sessao.")

---

### A.09 — Registro de Evolucao

PsychologistLayout ou modal de pagina inteira em mobile.

```
Mobile
┌─────────────────────────────────┐
│  ← Evolucao | Maria Santos     │
├─────────────────────────────────┤
│                                 │
│  Data da sessao                 │
│  ┌───────────────────────────┐  │
│  │ 11/09/2026 (pre-preench.) │  │  <- input date, editavel
│  └───────────────────────────┘  │
│                                 │
│  Duracao                        │
│  ┌───────────────────────────┐  │
│  │ 50 min (calculado)        │  │  <- read-only se veio do video
│  └───────────────────────────┘  │
│                                 │
│  Estado geral do paciente       │
│  ┌───────────────────────────┐  │
│  │ ▾ Selecione...            │  │  <- Select: bom, neutro,
│  └───────────────────────────┘  │     ansioso, triste, agitado, outro
│                                 │
│  Evolucao / Observacoes (*)     │
│  ┌───────────────────────────┐  │
│  │                           │  │  <- Textarea, min-h-[200px]
│  │ [Anotacoes da sessao     │  │     Pre-carregado com anotacoes
│  │  pre-carregadas aqui     │  │     da sessao (US-205) se houver
│  │  como rascunho...]       │  │
│  │                           │  │
│  │                           │  │
│  └───────────────────────────┘  │
│  Salvo automaticamente          │  <- text-xs text-muted-foreground
│                                 │
│  [  Salvar evolucao        ]    │  <- Button primary full-width
│                                 │
└─────────────────────────────────┘
```

**Estados:**
- Loading (salvando): botao com spinner + "Salvando evolucao..."
- Erro: toast "Nao foi possivel salvar. Seu texto esta preservado." (texto nao se perde)
- Sucesso: toast "Evolucao salva com sucesso." + redireciona para historico do paciente
- Validacao: campo evolucao vazio -> "O campo de evolucao nao pode estar vazio."
- Auto-save: indicador "Rascunho salvo" (text-xs) abaixo do textarea, atualiza a cada 30s
- Rascunho recuperado: banner "Rascunho nao salvo encontrado. [Retomar] [Descartar]"

---

### A.10 — Sala de Video (Psicologa)

VideoLayout (sem sidebar, fundo dark).

```
Desktop — Sem painel de anotacoes
┌────────────────────────────────────────────────────────────────┐
│ [←]                                            [● 00:45:32]   │  <- duracao, indicator qualidade
│                                                                │
│                                                                │
│              [Video do Paciente — area principal]               │
│                                                                │
│                                                                │
│                                                                │
│                                                   ┌─────────┐ │
│                                                   │ Self    │ │  <- self-view PIP
│                                                   │ View    │ │     arrastavel
│                                                   └─────────┘ │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│           [🎤]    [📷]    [📝]    [📶]    [🔴 Encerrar]        │  <- controls bar
└────────────────────────────────────────────────────────────────┘

Desktop — Com painel de anotacoes aberto
┌───────────────────────────────────────┬────────────────────────┐
│ [←]                       [● 00:45]   │  Anotacoes             │
│                                       │                        │
│     [Video do Paciente]               │  ┌──────────────────┐  │
│                                       │  │                  │  │
│                                       │  │  [textarea       │  │
│                          ┌─────────┐  │  │   auto-save]     │  │
│                          │ Self    │  │  │                  │  │
│                          │ View    │  │  │                  │  │
│                          └─────────┘  │  └──────────────────┘  │
│                                       │  Salvo automaticamente │
├───────────────────────────────────────┴────────────────────────┤
│           [🎤]    [📷]    [📝]    [📶]    [🔴 Encerrar]        │
└────────────────────────────────────────────────────────────────┘

Mobile — Com notas abertas
┌─────────────────────────────────┐
│ ┌──────────┐       ← Anotacoes │  <- video minimizado PIP
│ │ Video PIP│                    │
│ └──────────┘                    │
│                                 │
│  ┌───────────────────────────┐  │
│  │                           │  │  <- textarea fullscreen modal
│  │  [anotacoes]              │  │
│  │                           │  │
│  │                           │  │
│  │                           │  │
│  └───────────────────────────┘  │
│  Salvo automaticamente          │
│                                 │
│  [Fechar anotacoes]             │
└─────────────────────────────────┘
```

**Estados:**
- Conectando: fundo dark + "Conectando a sessao..." + Loader2
- Camera desligada (participante): avatar com inicial do nome em circulo (bg-muted, text-foreground)
- Conexao ruim: icone Wifi amarelo (latencia > 300ms) ou vermelho (> 500ms)
- Reconectando: overlay z-[70] sobre video "Conexao perdida. Reconectando..." + Loader2
- Reconexao falhou (30s): overlay com "Nao foi possivel reconectar." + [Tentar Novamente] + [Sair]
- Outro participante desconectou: "[Nome] perdeu a conexao. Aguardando retorno..."
- Sessao > 2h: banner discreto "A sessao esta ativa ha mais de 2 horas."
- Encerrar sessao: AlertDialog "Encerrar sessao? O paciente sera desconectado." [Cancelar] [Encerrar]
- Paciente saiu: "[Nome] saiu da sessao." (nao encerra automaticamente — psicologa decide)

---

### A.11 — Pre-flight de Dispositivos

Compartilhado entre psicologa e paciente. Layout centrado (nao VideoLayout — ainda nao esta na sala).

```
Mobile
┌─────────────────────────────────┐
│  ← Verificar dispositivos       │
├─────────────────────────────────┤
│                                 │
│  ┌───────────────────────────┐  │
│  │                           │  │
│  │   [Preview da camera]     │  │  <- video element, rounded-lg
│  │                           │  │     aspect-video
│  │                           │  │
│  └───────────────────────────┘  │
│                                 │
│  Camera                         │
│  ┌───────────────────────────┐  │
│  │ ▾ Camera FaceTime HD     │  │  <- DeviceSelector
│  └───────────────────────────┘  │
│                                 │
│  Microfone                      │
│  ┌───────────────────────────┐  │
│  │ ▾ Microfone interno      │  │
│  └───────────────────────────┘  │
│  ┌─████████░░░░░░░░░░░░░░░──┐  │  <- barra de nivel do mic
│  └───────────────────────────┘  │     animada em tempo real
│                                 │
│  Alto-falante                   │
│  ┌───────────────────────────┐  │
│  │ ▾ Alto-falante interno   │  │
│  └───────────────────────────┘  │
│                                 │
│  [  Tudo certo, entrar     ]    │  <- Button primary
│                                 │
└─────────────────────────────────┘
```

**Estados:**
- Solicitando permissao: "Acessando seus dispositivos..." + Loader2
- Sem permissao: "Permita o acesso a camera e ao microfone nas configuracoes do navegador." + instrucoes visuais simplificadas (icone de cadeado na barra de endereco)
- Sem camera: "Nenhuma camera detectada" (warning) — botao "Continuar apenas com audio" habilitado
- Sem microfone: "Nenhum microfone detectado. Voce nao podera ser ouvido." — botao DESABILITADO
- Erro de acesso: "Nao foi possivel acessar seus dispositivos. Verifique as permissoes."

---

### A.12 — Admissao / Lista de Espera (Psicologa)

Integrado na area de atendimento ou como notificacao persistente no header.

```
Desktop — Notificacao no header/sidebar
┌──────────┬──────────────────────────────────────────────────┐
│          │  ┌──────────────────────────────────────────────┐ │
│ Sidebar  │  │ 🔔 Maria S. esta aguardando na sala de      │ │  <- Banner bg-primary/10
│          │  │    espera (09:00 — ha 2 min)    [Admitir]    │ │     colado no topo do main
│          │  └──────────────────────────────────────────────┘ │
│          │                                                   │
│          │  [Conteudo da pagina atual]                       │
│          │                                                   │
└──────────┴──────────────────────────────────────────────────┘

Se ja esta em sessao ativa:
│  │ 🔔 Joao P. esta aguardando (14:00 — ha 1 min)          │ │
│  │    Finalize a sessao atual antes de admitir.             │ │
│  │    [Admitir] <- desabilitado                             │ │
```

```
Desktop — Se acessa a area de atendimento sem paciente esperando
│          │                                                   │
│          │  Sala de Atendimento                              │
│          │                                                   │
│          │  Nenhum paciente aguardando.                      │
│          │  Proxima sessao: 14:00 com Maria Santos           │
│          │                                                   │
```

**Estados:**
- Paciente saiu antes de ser admitido: notificacao some; se clicar Admitir -> "O paciente nao esta mais na sala de espera."
- Loading (admitindo): botao com spinner
- Erro ao criar room: toast "Nao foi possivel iniciar a sala. Tente novamente."

---

### A.13 — Nova Cobranca

PsychologistLayout. Form.

```
Mobile
┌─────────────────────────────────┐
│  ← Nova cobranca                │
├─────────────────────────────────┤
│                                 │
│  Paciente (*)                   │
│  ┌───────────────────────────┐  │
│  │ ▾ Selecione o paciente   │  │  <- Select com busca
│  └───────────────────────────┘  │
│                                 │
│  Forma de pagamento (*)         │
│  ┌───────────────────────────┐  │
│  │ ○ PIX  ○ Boleto  ○ Cartao│  │  <- RadioGroup
│  └───────────────────────────┘  │
│                                 │
│  Valor (*)                      │
│  ┌───────────────────────────┐  │
│  │ R$ 200,00                │  │  <- pre-preenchido com valor padrao
│  └───────────────────────────┘  │
│                                 │
│  Data de vencimento (*)         │
│  ┌───────────────────────────┐  │
│  │ dd/mm/aaaa               │  │
│  └───────────────────────────┘  │
│                                 │
│  Descricao                      │
│  ┌───────────────────────────┐  │
│  │ Sessao de Out/2026       │  │  <- texto livre
│  └───────────────────────────┘  │
│  * A descricao no pagamento     │  <- text-xs text-muted-foreground
│  sera neutra: "Prestacao de     │
│  servicos profissionais"        │
│                                 │
│  [  Gerar cobranca         ]    │
│                                 │
└─────────────────────────────────┘
```

**Estados:**
- Validacao: valor <= 0 -> erro; data no passado -> erro
- Loading: botao "Criando cobranca no Asaas..." com spinner
- Erro Asaas: toast generico "Nao foi possivel criar a cobranca. Tente novamente."
- Erro Edge Function: "Servico de pagamento temporariamente indisponivel."
- Sucesso: toast "Cobranca criada com sucesso." + redireciona para financeiro

---

### A.14 — Painel de Inadimplentes

PsychologistLayout. Acessivel pelo KPI "Inadimplente" no dashboard ou menu Financeiro.

```
Mobile
┌─────────────────────────────────┐
│ ☰  Talitha               🔔 [AV]│
├─────────────────────────────────┤
│  Inadimplentes                  │
│                                 │
│  ┌─────────────────────────┐    │
│  │ [AV] Maria Santos       │    │
│  │      R$ 400 em aberto   │    │
│  │      2 cobrancas vencidas│    │
│  │      Mais antiga: 15 dias│    │
│  │      [Ver detalhes]      │    │
│  └─────────────────────────┘    │
│  ┌─────────────────────────┐    │
│  │ [AV] Joao Pereira       │    │
│  │      R$ 200 em aberto   │    │
│  │      1 cobranca vencida  │    │
│  │      Mais antiga: 3 dias │    │
│  │      [Ver detalhes]      │    │
│  └─────────────────────────┘    │
│                                 │
└─────────────────────────────────┘
```

**Estados:**
- Loading: skeleton de cards
- Vazio: icone CheckCircle 48px + "Nenhum paciente inadimplente. Todos os pagamentos estao em dia!"
- Erro: toast + retry

---

## Perfil B: Portal do Paciente

---

### B.01 — Primeiro Acesso (Criar Senha)

AuthLayout. Paciente chega pelo link do email de convite.

```
Mobile
┌─────────────────────────────────┐
│                                 │
│         Talitha                 │
│                                 │
│  ┌─────────────────────────┐    │
│  │                         │    │
│  │  Crie sua senha de      │    │
│  │  acesso                 │    │
│  │                         │    │
│  │  Senha (*)              │    │
│  │  ┌──────────────── 👁┐  │    │
│  │  │                  │  │    │
│  │  └───────────────────┘  │    │
│  │  Minimo 10 caracteres,  │    │  <- hint text-xs text-muted-fg
│  │  com letra e numero     │    │
│  │                         │    │
│  │  Confirmar senha (*)    │    │
│  │  ┌──────────────── 👁┐  │    │
│  │  │                  │  │    │
│  │  └───────────────────┘  │    │
│  │                         │    │
│  │  [  Criar senha       ] │    │
│  └─────────────────────────┘    │
│                                 │
└─────────────────────────────────┘
```

**Estados:**
- Link expirado (>72h): "Este convite expirou. Entre em contato com sua profissional para receber um novo." (neutro — sem mencionar "psicologa")
- Link ja usado: "Voce ja ativou sua conta. Faca login normalmente." + [Ir para login]
- Senhas nao coincidem: erro inline
- Senha fraca: erro inline com indicacao do que falta
- Loading: botao com spinner
- Erro: toast
- Sucesso: redireciona para B.02 (Consentimento)

---

### B.02 — Consentimento: Termo de Atendimento Online

ConsentLayout. Etapa 1 de 2.

```
Mobile
┌─────────────────────────────────┐
│                                 │
│  Talitha         Etapa 1 de 2   │  <- step indicator (2 dots)
│                                 │
│  Termo de Consentimento para    │  <- text-2xl font-bold
│  Atendimento Online             │
│                                 │
│  ┌─────────────────────────┐    │
│  │ (ConsentSection)         │    │
│  │ border-l-4 border-primary│    │
│  │                         │    │
│  │ [Texto completo do      │    │  <- max-h-[300px] overflow-y-auto
│  │  termo — scrollavel.    │    │     text-base, max-w-prose
│  │  Natureza do            │    │
│  │  atendimento online,    │    │
│  │  limitacoes,            │    │
│  │  responsabilidades,     │    │
│  │  sigilo, direito de     │    │
│  │  recusa...]             │    │
│  │                         │    │
│  │ [CB] Li e aceito o      │    │  <- Checkbox obrigatorio
│  │ Termo de Consentimento  │    │     font-medium
│  │ para Atendimento Online │    │
│  └─────────────────────────┘    │
│                                 │
│  [  Aceitar e continuar  ]      │  <- DESABILITADO ate CB marcado
│                                 │
└─────────────────────────────────┘
```

**Estados:**
- CB nao marcado: botao desabilitado (opacity-50)
- Loading (registrando aceite): botao com spinner
- Erro: toast "Nao foi possivel registrar seu aceite. Tente novamente."
- Paciente fecha sem aceitar: na proxima vez que acessar, o termo e apresentado novamente

---

### B.03 — Consentimento: LGPD (Segmentado por Finalidade)

ConsentLayout. Etapa 2 de 2.

```
Mobile
┌─────────────────────────────────┐
│                                 │
│  Talitha         Etapa 2 de 2   │
│                                 │
│  Autorizacao para Tratamento    │  <- text-2xl font-bold
│  de Dados Pessoais              │
│                                 │
│  ┌─────────────────────────┐    │
│  │ TRATAMENTO CLINICO (*)  │    │  <- ConsentSection obrigatorio
│  │ border-l-4 border-primary│   │
│  │                         │    │
│  │ [Texto: quais dados,   │    │  <- scrollavel
│  │  finalidade clinica,    │    │
│  │  retencao 5 anos,       │    │
│  │  transferencia          │    │
│  │  internacional para     │    │
│  │  infraestrutura...]     │    │
│  │                         │    │
│  │ [CB] Autorizo o         │    │  <- Obrigatorio
│  │ tratamento dos meus     │    │
│  │ dados para fins de      │    │
│  │ acompanhamento          │    │
│  └─────────────────────────┘    │
│                                 │
│  ┌─────────────────────────┐    │
│  │ PAGAMENTOS (*)          │    │  <- ConsentSection obrigatorio
│  │ border-l-4 border-primary│   │     destacado como obrigatorio
│  │                         │    │
│  │ Seus dados (nome, CPF,  │    │
│  │ e-mail) serao           │    │
│  │ compartilhados com a    │    │
│  │ plataforma Asaas para   │    │
│  │ processamento de        │    │
│  │ pagamentos.             │    │
│  │                         │    │
│  │ [CB] Autorizo o         │    │  <- Obrigatorio
│  │ compartilhamento com    │    │
│  │ a plataforma Asaas      │    │
│  └─────────────────────────┘    │
│                                 │
│  ┌─────────────────────────┐    │
│  │ LEMBRETES (opcional)    │    │  <- ConsentSection opcional
│  │ border-l-4 border-muted │    │
│  │                         │    │
│  │ Desejo receber          │    │
│  │ lembretes por e-mail.   │    │
│  │                         │    │
│  │ ⚠ As notificacoes      │    │  <- AlertTriangle 16px + text-sm
│  │ podem ser visiveis na   │    │     text-warning-foreground
│  │ tela de bloqueio do     │    │     bg-warning/10 rounded p-3
│  │ seu celular.            │    │
│  │                         │    │
│  │ [CB] Desejo receber     │    │  <- Opcional (pre-marcado)
│  │ lembretes por e-mail    │    │
│  └─────────────────────────┘    │
│                                 │
│  Em caso de revogacao, seus     │  <- text-sm text-muted-foreground
│  dados clinicos serao mantidos  │     informacional, nao checkbox
│  pelo prazo legal de 5 anos.    │
│                                 │
│  [  Autorizar e continuar ]     │  <- DESABILITADO ate os 2
│                                 │     obrigatorios marcados
└─────────────────────────────────┘
```

**Estados:**
- Checkboxes obrigatorios nao marcados: botao desabilitado
- Loading: botao com spinner
- Erro: toast
- Sucesso: redireciona para B.04 (Portal Home)

---

### B.04 — Portal do Paciente (Home)

PatientLayout.

```
Mobile (< 640px)
┌─────────────────────────────────┐
│  Talitha                   [AV] │  <- Sem "Psicologia" no header
├─────────────────────────────────┤
│                                 │
│  Ola, Maria                     │  <- text-xl font-semibold
│                                 │
│  ┌─────────────────────────┐    │
│  │ PROXIMO COMPROMISSO     │    │  <- Card destaque
│  │                         │    │     bg-primary/5
│  │ Quarta, 11 Set          │    │     border border-primary/20
│  │ 14:00 — 14:50           │    │
│  │ com Dra. Talitha        │    │
│  │                         │    │
│  │ [  Entrar na sala    ]  │    │  <- Button primary, habilitado
│  │                         │    │     15min antes do horario
│  └─────────────────────────┘    │
│                                 │
│  ┌─────────────────────────┐    │
│  │ ⚠ Pagamento pendente    │    │  <- Card warning discreto
│  │ Vencimento: 15/09       │    │     bg-warning/5 border-warning/20
│  │ R$ 200,00               │    │
│  │ [Regularizar]           │    │  <- Link para pagamento Asaas
│  └─────────────────────────┘    │
│                                 │
│  Proximos compromissos          │
│  ┌─────────────────────────┐    │
│  │ Qua 18 Set | 14:00      │    │
│  │ Qua 25 Set | 14:00      │    │
│  └─────────────────────────┘    │
│                                 │
├─────────────────────────────────┤
│  [🏠]    [📅]    [💳]    [👤]   │  <- PatientBottomNav
│  Inicio Compromis. Pagam. Perfil│
└─────────────────────────────────┘
```

**Estados:**
- Loading: skeleton do card de compromisso + skeleton de lista
- Sem sessoes: "Voce nao tem compromissos agendados. Entre em contato com sua profissional."
- Pagamento atrasado: card warning (nao alarmante — tom discreto e respeitoso)
- Pagamento em dia: card warning nao aparece
- Sessao e hoje, < 15min: botao "Entrar na sala" habilitado e destacado
- Sessao e hoje, > 15min: botao desabilitado "Disponivel as [hora]"
- Sessao nao e hoje: sem botao de sala, apenas info
- Erro: "Nao foi possivel carregar suas informacoes. Tente recarregar."
- Anamnese nao preenchida (primeiro acesso apos termos): banner "Preencha sua ficha inicial antes da primeira sessao." [Preencher]

---

### B.05 — Sala de Espera (Paciente)

Layout centrado, calmo. Sem nav. Foco total no estado de espera.

```
Mobile
┌─────────────────────────────────┐
│                                 │
│                                 │
│                                 │
│         ┌─────────┐            │
│         │         │            │  <- Animacao "breathe"
│         │  ( ○ )  │            │     Circulo pulsando suavemente
│         │         │            │     bg-primary/10
│         └─────────┘            │
│                                 │
│    Aguarde, voce sera           │  <- text-lg text-center
│    atendido(a) em instantes     │
│                                 │
│    Tempo de espera: 3 min       │  <- text-sm text-muted-foreground
│                                 │
│                                 │
│                                 │
│                                 │
│                                 │
│    [Sair da sala]               │  <- Button ghost, text-muted-fg
│                                 │
└─────────────────────────────────┘
```

**Estados:**
- Esperando (< 10min): tela padrao
- Esperando (10-20min): adiciona "Sua profissional pode estar finalizando outro compromisso. Aguarde mais um momento."
- Esperando (> 20min): adiciona "Sua profissional ainda nao esta disponivel. Deseja sair e tentar novamente mais tarde?" + [Sair]
- Admitido: transicao suave para a sala de video. Texto muda para "Conectando..." + Loader2
- Conexao perdida: "Conexao perdida. Reconectando..." + retry automatico
- Nenhum elemento que sugira fila, posicao, outros pacientes ou qualquer informacao alem do proprio estado

---

### B.06 — Sala de Video (Paciente)

VideoLayout. Controles simplificados (sem anotacoes).

```
Mobile
┌─────────────────────────────────┐
│ [←]                     [📶]    │  <- qualidade de sinal
│                                 │
│                                 │
│   [Video da Psicologa]          │
│   area principal, fullscreen    │
│                                 │
│                                 │
│                                 │
│                    ┌──────────┐ │
│                    │ Self     │ │  <- PIP, canto inferior
│                    │ View     │ │
│                    └──────────┘ │
│                                 │
├─────────────────────────────────┤
│      [🎤]      [📷]      [🚪]   │  <- Mic, Camera, Sair
│                                 │     "Sair" em vez de "Encerrar"
└─────────────────────────────────┘
```

**Estados:**
- Conectando: "Conectando..." + Loader2 sobre fundo dark
- Em sessao: video bidirecional ativo
- Sair: Dialog "Deseja sair? Se precisar voltar, acesse novamente pelo portal." [Ficar] [Sair]
  - Sair nao encerra a sessao (psicologa decide)
- Camera desligada: avatar com inicial em circulo
- Reconectando: overlay "Conexao perdida. Reconectando..."
- Reconexao falhou: overlay com [Tentar Novamente] + [Sair]
- Psicologa desconectou: "Sua profissional perdeu a conexao. Aguardando retorno..."
- Sessao encerrada pela psicologa: "Sessao encerrada. Ate a proxima!" + [Voltar ao portal]

---

### B.07 — Anamnese (Ficha Inicial)

PatientLayout. Formulario longo.

```
Mobile
┌─────────────────────────────────┐
│  Talitha                   [AV] │
├─────────────────────────────────┤
│  Ficha inicial                  │  <- text-2xl font-bold
│                                 │
│  Preencha antes da sua          │  <- text-muted-foreground
│  primeira sessao.               │
│                                 │
│  Motivo da busca por            │
│  acompanhamento (*)             │
│  ┌───────────────────────────┐  │
│  │                           │  │  <- Textarea, min-h-[100px]
│  └───────────────────────────┘  │
│                                 │
│  Tratamento anterior?           │
│  ○ Sim  ○ Nao                   │
│  [Se sim: campo de detalhes]    │
│                                 │
│  Uso de medicacao?              │
│  ○ Sim  ○ Nao                   │
│  [Se sim: campo de detalhes]    │
│                                 │
│  Condicoes de saude relevantes  │
│  ┌───────────────────────────┐  │
│  │                           │  │
│  └───────────────────────────┘  │
│                                 │
│  Contato de emergencia (*)      │
│  Nome (*)                       │
│  ┌───────────────────────────┐  │
│  │                           │  │
│  └───────────────────────────┘  │
│  Telefone (*)                   │
│  ┌───────────────────────────┐  │
│  │                           │  │
│  └───────────────────────────┘  │
│  Parentesco (*)                 │
│  ┌───────────────────────────┐  │
│  │ ▾ Selecione              │  │
│  └───────────────────────────┘  │
│                                 │
│  Observacoes                    │
│  ┌───────────────────────────┐  │
│  │                           │  │
│  └───────────────────────────┘  │
│                                 │
│  [  Enviar ficha           ]    │
│                                 │
├─────────────────────────────────┤
│  [🏠]    [📅]    [💳]    [👤]   │
└─────────────────────────────────┘
```

**Estados:**
- Validacao: campos obrigatorios destacados com borda destructive
- Loading: botao com spinner "Enviando sua ficha..."
- Erro: toast "Nao foi possivel enviar. Seus dados estao preservados."
- Sucesso: toast "Ficha enviada com sucesso." + redireciona para portal
- Ja preenchida: formulario pre-preenchido com dados anteriores + botao "Atualizar ficha"

---

### B.08 — Pagamentos do Paciente

PatientLayout.

```
Mobile
┌─────────────────────────────────┐
│  Talitha                   [AV] │
├─────────────────────────────────┤
│  Pagamentos                     │
│                                 │
│  ┌─────────────────────────┐    │
│  │ Out/2026                │    │
│  │ R$ 200,00               │    │
│  │ Venc: 05/10/2026        │    │
│  │ ● Pendente              │    │  <- StatusBadge warning
│  │ [Pagar]                 │    │  <- abre link Asaas
│  └─────────────────────────┘    │
│  ┌─────────────────────────┐    │
│  │ Set/2026                │    │
│  │ R$ 200,00               │    │
│  │ Pago em: 03/09/2026     │    │
│  │ ● Pago                  │    │  <- StatusBadge success
│  │ [Ver documento]         │    │  <- abre recibo
│  └─────────────────────────┘    │
│  ┌─────────────────────────┐    │
│  │ Ago/2026 — Pacote Mensal│    │  <- indicador de assinatura
│  │ R$ 800,00               │    │
│  │ Pago em: 01/08/2026     │    │
│  │ ● Pago                  │    │
│  │ [Ver documento]         │    │
│  └─────────────────────────┘    │
│                                 │
├─────────────────────────────────┤
│  [🏠]    [📅]    [💳]    [👤]   │
└─────────────────────────────────┘
```

**Estados:**
- Loading: skeleton de 3 cards
- Vazio: "Nenhum pagamento registrado."
- Erro: toast + retry

---

### B.09 — Documentos (Recibos) do Paciente

PatientLayout. Acessivel pelo perfil ou pelo pagamento (link "Ver documento").

```
Mobile
┌─────────────────────────────────┐
│  Talitha                   [AV] │
├─────────────────────────────────┤
│  Documentos                     │
│                                 │
│  ┌─────────────────────────┐    │
│  │ Recibo 003/2026         │    │  <- ReceiptDownloadItem
│  │ 03/09/2026  |  R$ 200   │    │
│  │ ● Disponivel  [⬇ Baixar]│    │
│  └─────────────────────────┘    │
│  ┌─────────────────────────┐    │
│  │ Recibo 002/2026         │    │
│  │ 01/08/2026  |  R$ 800   │    │
│  │ ● Disponivel  [⬇ Baixar]│    │
│  └─────────────────────────┘    │
│                                 │
├─────────────────────────────────┤
│  [🏠]    [📅]    [💳]    [👤]   │
└─────────────────────────────────┘
```

**Estados:**
- Loading: skeleton
- Vazio: "Nenhum documento disponivel. Documentos sao gerados automaticamente apos confirmacao de pagamento."
- Download loading: botao com spinner "Gerando..."
- Erro no download: toast "Nao foi possivel gerar o documento. Tente novamente."
- Recibo cancelado (estorno): aparece com badge "Cancelado" (destructive), sem botao de download

---

### B.10 — Perfil e Consentimentos do Paciente

PatientLayout. Inclui gerenciamento de consentimento e solicitacao LGPD.

```
Mobile
┌─────────────────────────────────┐
│  Talitha                   [AV] │
├─────────────────────────────────┤
│  Perfil                         │
│                                 │
│  Sobre sua profissional         │  <- secao com dados CFP
│  ┌─────────────────────────┐    │
│  │ Dra. Talitha [Sobrenome]│    │
│  │ CRP 06/12345            │    │
│  │ e-Psi: Ativo            │    │
│  │ Psicologia Clinica      │    │
│  └─────────────────────────┘    │
│                                 │
│  ──────────────────────────     │  <- Separator
│                                 │
│  Seus consentimentos            │
│  ┌─────────────────────────┐    │
│  │ Termo de atendimento    │    │
│  │ Aceito em 09/09/2026    │    │
│  │ Versao 1.0              │    │
│  └─────────────────────────┘    │
│  ┌─────────────────────────┐    │
│  │ Dados pessoais (LGPD)   │    │
│  │ Aceito em 09/09/2026    │    │
│  │ Versao 1.0              │    │
│  │                         │    │
│  │ [Revogar consentimento] │    │  <- Button destructive outline
│  └─────────────────────────┘    │
│                                 │
│  ──────────────────────────     │
│                                 │
│  Meus dados                     │
│  [Solicitar copia dos dados]    │  <- Button outline
│                                 │
│  ──────────────────────────     │
│                                 │
│  [Sair da conta]                │  <- Button ghost destructive
│                                 │
├─────────────────────────────────┤
│  [🏠]    [📅]    [💳]    [👤]   │
└─────────────────────────────────┘
```

**Revogar consentimento:** AlertDialog:
```
"Ao revogar o consentimento, seu acompanhamento sera
encerrado. Seus dados serao mantidos pelo prazo legal
(minimo 5 anos). Deseja prosseguir?"

[Cancelar]  [Confirmar revogacao]  <- destructive
```

**Solicitar copia dos dados:** toast "Solicitacao registrada. Voce recebera uma resposta em ate 15 dias uteis."

---

## Telas Compartilhadas

---

### C.01 — Tela 404

AuthLayout (sem sidebar/nav).

```
┌─────────────────────────────────┐
│                                 │
│                                 │
│         📄?                     │  <- FileQuestion 64px text-muted-fg
│                                 │
│    Pagina nao encontrada        │  <- text-2xl font-bold
│                                 │
│    A pagina que voce esta       │  <- text-muted-foreground
│    buscando nao existe ou       │
│    foi movida.                  │
│                                 │
│    [Voltar ao inicio]           │  <- Button primary
│                                 │
└─────────────────────────────────┘
```

---

### C.02 — Tela 500

AuthLayout.

```
┌─────────────────────────────────┐
│                                 │
│         ⚠                       │  <- ServerCrash 64px text-destructive/70
│                                 │
│    Algo deu errado              │  <- text-2xl font-bold
│                                 │
│    Ocorreu um erro inesperado.  │  <- text-muted-foreground
│    Nossa equipe foi notificada. │
│                                 │
│    [Tentar novamente]           │  <- Button primary (reload)
│    Voltar ao inicio             │  <- Link ghost
│                                 │
└─────────────────────────────────┘
```

---

### C.03 — Estados de Negacao de Acesso a Sala

Estes estados aparecem quando o paciente tenta acessar a sala mas nao atende alguma pre-condicao. Layout centrado, sem video.

**Sem consentimento vigente:**
```
│    Voce precisa aceitar os      │
│    termos de consentimento      │
│    antes de acessar a sala.     │
│                                 │
│    [Aceitar termos]             │  <- redireciona para B.02/B.03
```

**Fora da janela de horario (muito cedo):**
```
│    Sua sala estara disponivel   │
│    a partir de [horario].       │
│                                 │
│    Faltam [X] minutos.          │
│                                 │
│    [Voltar ao inicio]           │
```

**Sessao ja encerrada:**
```
│    Esta sessao ja foi           │
│    encerrada.                   │
│                                 │
│    [Voltar ao inicio]           │
```

**Sessao cancelada:**
```
│    Este compromisso foi         │
│    cancelado.                   │
│                                 │
│    [Voltar ao inicio]           │
```

**Acesso nao autorizado (tentativa de acessar sala de outro paciente):**
```
│    Voce nao tem acesso a        │
│    esta sala.                   │
│                                 │
│    [Voltar ao inicio]           │
```

Todos usam a mesma mensagem generica visual (sem revelar o motivo exato para o caso de acesso nao autorizado, conforme security review — 404 generico).

---

## Resumo de Contagem de Telas

| Perfil | Tela | ID |
|--------|------|----|
| **Psicologa** | Login | A.01 |
| | MFA Verify | A.02 |
| | MFA Setup | A.03 |
| | Onboarding | A.04 |
| | Dashboard | A.05 |
| | Agenda (semanal/diaria) | A.06 |
| | Lista de Pacientes | A.07 |
| | Ficha do Paciente (5 tabs) | A.08 |
| | Registro de Evolucao | A.09 |
| | Sala de Video | A.10 |
| | Pre-flight Dispositivos | A.11 |
| | Admissao / Lista de Espera | A.12 |
| | Nova Cobranca | A.13 |
| | Painel de Inadimplentes | A.14 |
| | Nova Assinatura | (mesma estrutura de A.13) |
| | Lista de Cobrancas (TanStack Table) | (tab Financeiro de A.08) |
| | Lista de Recibos | (similar a B.09, visao da psicologa) |
| | Perfil/Config | (similar a A.04, editavel) |
| **Paciente** | Primeiro Acesso (Senha) | B.01 |
| | Consentimento Atendimento | B.02 |
| | Consentimento LGPD | B.03 |
| | Portal Home | B.04 |
| | Sala de Espera | B.05 |
| | Sala de Video | B.06 |
| | Anamnese | B.07 |
| | Pagamentos | B.08 |
| | Documentos (Recibos) | B.09 |
| | Perfil e Consentimentos | B.10 |
| | Sessoes (lista) | (similar a secao de B.04) |
| **Compartilhadas** | 404 | C.01 |
| | 500 | C.02 |
| | Negacao de acesso a sala | C.03 |
| | Pre-flight Dispositivos | A.11 (compartilhado) |

**Total:** 19 telas psicologa + 12 telas paciente + 3 telas compartilhadas = **34 telas especificadas**

---

## Historico de versoes

| Versao | Data | Mudanca |
|--------|------|---------|
| 1.0 | 2026-09-09 | Wireframes iniciais: 34 telas (19 psicologa + 12 paciente + 3 compartilhadas), ambos perfis, com estados (loading/vazio/erro/sucesso), mobile-first com desktop onde o layout muda |
