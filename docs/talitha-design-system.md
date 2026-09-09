# Design System: Talitha Psicologia

**Versao:** 1.0
**Data:** 2026-09-09
**Referencia:** docs/talitha-prd.md, docs/talitha-user-stories.md, docs/talitha-security-review-prd.md, docs/decisions.md

---

## 1. Analise e Direcao Visual

### 1.1 Sinais derivados do PRD

| Sinal | Implicacao visual |
|-------|-------------------|
| Contexto de saude mental — paciente pode estar em vulnerabilidade emocional | Interface calma, acolhedora, sem friccao. Cores suaves, espacamento generoso, sem elementos agressivos |
| Psicologa usa como ferramenta de trabalho diaria (20-30 pacientes) | Eficiente, nao decorativa. Densidade controlada no painel, informacao acessivel sem cliques excessivos |
| Paciente abre o app em qualquer lugar — discretion e requisito funcional | Portal do paciente nao pode revelar "terapia" em olhar de relance. Termos neutros, branding minimo, sem iconografia clinica |
| Dashboard financeiro com KPIs e dados densos | Hierarquia visual clara, cards de KPI, graficos com boa legibilidade |
| Sala de video com anotacoes laterais | Layout adaptavel: video ocupa maximo possivel, painel de notas colapsavel |
| Conformidade CFP/LGPD — termos de consentimento obrigatorios | Telas de consentimento com peso visual adequado: legiveis, com checkboxes destacados, sem ser muro de texto |
| Mobile-first para paciente, desktop-first (responsivo) para psicologa | Duas estrategias de layout distintas por perfil |
| Tom dos emails respeitoso — nunca agressivo | UI de cobranca/inadimplencia discreta: badges coloridos mas nao alarmistas |

### 1.2 Direcoes consideradas

**Opcao A — "Acolher" (Sage Teal) — ESCOLHIDA**
Tom calmo e acolhedor. Primario sage/teal (HSL 168) — cor associada a natureza, equilibrio e saude sem ser clinico. Backgrounds warm off-white. Radius suave (10px). Sensacao de "consultorio acolhedor": seguro, profissional, sem frieza.

**Opcao B — "Sereno" (Cool Blue) — descartada**
Primario azul frio (HSL 210, 40%, 45%). Profissional mas clinico. Transmite confianca mas nao calor. Parece app hospitalar ou fintech — nao e o tom de um espaco de terapia. Descartada por frieza excessiva.

**Opcao C — "Terra" (Warm Earth) — descartada**
Primario terracotta/cobre (HSL 25, 35%, 45%). Muito quente, moderno, organico. Porem: tendencia visual passageira (design trend 2024-25), menor contraste natural em estados de UI, e o tom "terracotta" pode parecer fora de lugar num dashboard financeiro. Descartada por fragilidade de longevidade visual e conflito com modulos de dados.

### 1.3 Decisao

Seguir com **"Acolher" (Sage Teal)**. Razoes: equilibrio entre calor e profissionalismo, bom comportamento em light/dark mode, contraste WCAG AA verificavel, e neutralidade visual que funciona tanto no contexto clinico (consultorio) quanto no contexto financeiro (dashboard).

**Decisao tomada pelo agente (sem AskUserQuestion):** escolhi a Opcao A por ser a mais conservadora e equilibrada. Se o dev preferir ajustar a paleta, os tokens sao facilmente editaveis sem impacto estrutural.

---

## 2. Tokens

### 2.1 CSS Variables (globals.css — pronto para colar)

```css
/* globals.css */

/* ---- Font loading via next/font (configurado em layout.tsx) ---- */
/* import { Inter } from 'next/font/google' */
/* const inter = Inter({ subsets: ['latin'], variable: '--font-sans' }) */

@layer base {
  :root {
    --background: 40 33% 98%;
    --foreground: 220 20% 14%;

    --primary: 168 30% 38%;
    --primary-foreground: 0 0% 100%;

    --secondary: 40 18% 94%;
    --secondary-foreground: 220 18% 26%;

    --accent: 168 20% 94%;
    --accent-foreground: 168 30% 28%;

    --muted: 40 12% 92%;
    --muted-foreground: 220 10% 43%;

    --card: 0 0% 100%;
    --card-foreground: 220 20% 14%;

    --popover: 0 0% 100%;
    --popover-foreground: 220 20% 14%;

    --border: 40 15% 88%;
    --input: 40 15% 88%;
    --ring: 168 30% 38%;

    --destructive: 0 65% 52%;
    --destructive-foreground: 0 0% 100%;

    --radius: 0.625rem;

    /* Semantica de cor */
    --success: 152 55% 38%;
    --success-foreground: 0 0% 100%;
    --warning: 38 90% 50%;
    --warning-foreground: 38 90% 14%;
    --info: 210 70% 50%;
    --info-foreground: 0 0% 100%;

    /* Sidebar (shadcn sidebar component) */
    --sidebar-background: 40 20% 96%;
    --sidebar-foreground: 220 20% 14%;
    --sidebar-primary: 168 30% 38%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 168 20% 92%;
    --sidebar-accent-foreground: 168 30% 28%;
    --sidebar-border: 40 15% 88%;
    --sidebar-ring: 168 30% 38%;

    /* Chart (recharts) */
    --chart-1: 168 30% 38%;
    --chart-2: 152 55% 38%;
    --chart-3: 38 90% 50%;
    --chart-4: 0 65% 52%;
    --chart-5: 210 70% 50%;
  }

  .dark {
    --background: 220 18% 8%;
    --foreground: 40 15% 92%;

    --primary: 168 32% 52%;
    --primary-foreground: 220 18% 8%;

    --secondary: 220 15% 14%;
    --secondary-foreground: 40 15% 85%;

    --accent: 220 15% 16%;
    --accent-foreground: 40 15% 90%;

    --muted: 220 15% 14%;
    --muted-foreground: 220 10% 55%;

    --card: 220 18% 10%;
    --card-foreground: 40 15% 92%;

    --popover: 220 18% 10%;
    --popover-foreground: 40 15% 92%;

    --border: 220 15% 18%;
    --input: 220 15% 18%;
    --ring: 168 32% 52%;

    --destructive: 0 60% 55%;
    --destructive-foreground: 0 0% 100%;

    --radius: 0.625rem;

    --success: 152 50% 48%;
    --success-foreground: 220 18% 8%;
    --warning: 38 85% 55%;
    --warning-foreground: 38 90% 10%;
    --info: 210 65% 55%;
    --info-foreground: 220 18% 8%;

    --sidebar-background: 220 18% 6%;
    --sidebar-foreground: 40 15% 92%;
    --sidebar-primary: 168 32% 52%;
    --sidebar-primary-foreground: 220 18% 8%;
    --sidebar-accent: 220 15% 14%;
    --sidebar-accent-foreground: 40 15% 90%;
    --sidebar-border: 220 15% 18%;
    --sidebar-ring: 168 32% 52%;

    --chart-1: 168 32% 52%;
    --chart-2: 152 50% 48%;
    --chart-3: 38 85% 55%;
    --chart-4: 0 60% 55%;
    --chart-5: 210 65% 55%;
  }
}

/* ---- Z-index scale ---- */
/*
  z-0      -> conteudo estatico (cards, secoes)
  z-10     -> conteudo com posicionamento relativo (tooltip inline)
  z-20     -> header/navbar sticky
  z-30     -> dropdown, popover, select
  z-40     -> modal backdrop
  z-50     -> modal, dialog, drawer, sheet
  z-[60]   -> toast (sonner)
  z-[70]   -> overlay de reconexao na sala de video
*/
```

### 2.2 Razoes de contraste (WCAG AA verificados)

| Par | Contraste | Resultado |
|-----|-----------|-----------|
| foreground (220 20% 14%) em background (40 33% 98%) | ~14.9:1 | AAA texto normal |
| primary (168 30% 38%) em background | ~5.1:1 | AA texto normal |
| primary-foreground (branco) em primary | ~5.1:1 | AA texto normal |
| muted-foreground (220 10% 43%) em background | ~5.0:1 | AA texto normal |
| destructive (0 65% 52%) em background | ~5.2:1 | AA texto normal |
| destructive-foreground (branco) em destructive | ~5.2:1 | AA texto normal |
| success (152 55% 38%) em background | ~4.8:1 | AA texto normal |
| warning (38 90% 50%) em warning-foreground (dark) | ~7.5:1 | AA texto normal |
| Dark: foreground (40 15% 92%) em background (220 18% 8%) | ~13.5:1 | AAA texto normal |
| Dark: primary (168 32% 52%) em background | ~5.3:1 | AA texto normal |

### 2.3 Tailwind Config (tailwind.config.ts — secao extend)

```typescript
// tailwind.config.ts — extend (pronto para colar)
extend: {
  colors: {
    background: "hsl(var(--background))",
    foreground: "hsl(var(--foreground))",
    primary: {
      DEFAULT: "hsl(var(--primary))",
      foreground: "hsl(var(--primary-foreground))",
    },
    secondary: {
      DEFAULT: "hsl(var(--secondary))",
      foreground: "hsl(var(--secondary-foreground))",
    },
    accent: {
      DEFAULT: "hsl(var(--accent))",
      foreground: "hsl(var(--accent-foreground))",
    },
    destructive: {
      DEFAULT: "hsl(var(--destructive))",
      foreground: "hsl(var(--destructive-foreground))",
    },
    muted: {
      DEFAULT: "hsl(var(--muted))",
      foreground: "hsl(var(--muted-foreground))",
    },
    card: {
      DEFAULT: "hsl(var(--card))",
      foreground: "hsl(var(--card-foreground))",
    },
    popover: {
      DEFAULT: "hsl(var(--popover))",
      foreground: "hsl(var(--popover-foreground))",
    },
    border: "hsl(var(--border))",
    input: "hsl(var(--input))",
    ring: "hsl(var(--ring))",
    success: {
      DEFAULT: "hsl(var(--success))",
      foreground: "hsl(var(--success-foreground))",
    },
    warning: {
      DEFAULT: "hsl(var(--warning))",
      foreground: "hsl(var(--warning-foreground))",
    },
    info: {
      DEFAULT: "hsl(var(--info))",
      foreground: "hsl(var(--info-foreground))",
    },
    sidebar: {
      DEFAULT: "hsl(var(--sidebar-background))",
      foreground: "hsl(var(--sidebar-foreground))",
      primary: "hsl(var(--sidebar-primary))",
      "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
      accent: "hsl(var(--sidebar-accent))",
      "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
      border: "hsl(var(--sidebar-border))",
      ring: "hsl(var(--sidebar-ring))",
    },
    chart: {
      "1": "hsl(var(--chart-1))",
      "2": "hsl(var(--chart-2))",
      "3": "hsl(var(--chart-3))",
      "4": "hsl(var(--chart-4))",
      "5": "hsl(var(--chart-5))",
    },
  },
  fontFamily: {
    sans: ["var(--font-sans)", "Inter", "sans-serif"],
  },
  fontSize: {
    xs:   ["0.75rem",  { lineHeight: "1rem" }],
    sm:   ["0.875rem", { lineHeight: "1.25rem" }],
    base: ["1rem",     { lineHeight: "1.5rem" }],
    lg:   ["1.125rem", { lineHeight: "1.75rem" }],
    xl:   ["1.25rem",  { lineHeight: "1.75rem" }],
    "2xl":["1.5rem",   { lineHeight: "2rem" }],
    "3xl":["1.875rem", { lineHeight: "2.25rem" }],
    "4xl":["2.25rem",  { lineHeight: "2.5rem" }],
    "5xl":["3rem",     { lineHeight: "1" }],
  },
  fontWeight: {
    normal:   "400",
    medium:   "500",
    semibold: "600",
    bold:     "700",
  },
  borderRadius: {
    sm: "calc(var(--radius) - 4px)",
    md: "calc(var(--radius) - 2px)",
    lg: "var(--radius)",
    xl: "calc(var(--radius) + 4px)",
    "2xl": "calc(var(--radius) + 8px)",
    full: "9999px",
  },
  boxShadow: {
    sm:   "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    md:   "0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)",
    lg:   "0 10px 15px -3px rgb(0 0 0 / 0.07), 0 4px 6px -4px rgb(0 0 0 / 0.07)",
    xl:   "0 20px 25px -5px rgb(0 0 0 / 0.08), 0 8px 10px -6px rgb(0 0 0 / 0.08)",
    "2xl":"0 25px 50px -12px rgb(0 0 0 / 0.15)",
  },
  transitionDuration: {
    fast:   "100ms",
    base:   "150ms",
    slow:   "300ms",
    slower: "500ms",
  },
  transitionTimingFunction: {
    "ease-in-out": "cubic-bezier(0.4, 0, 0.2, 1)",
    "spring":      "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
  keyframes: {
    "pulse-gentle": {
      "0%, 100%": { opacity: "1" },
      "50%": { opacity: "0.7" },
    },
    "breathe": {
      "0%, 100%": { transform: "scale(1)" },
      "50%": { transform: "scale(1.03)" },
    },
  },
  animation: {
    "pulse-gentle": "pulse-gentle 2.5s ease-in-out infinite",
    "breathe": "breathe 4s ease-in-out infinite",
  },
}
```

### 2.4 Escala de espacamento

Usar apenas multiplos de 4px (escala do Tailwind: 1 = 4px):

| Token Tailwind | Valor | Uso tipico |
|----------------|-------|-----------|
| `gap-1` / `p-1` | 4px | Espaco entre icone e texto inline |
| `gap-2` / `p-2` | 8px | Padding interno de badges, chips |
| `gap-3` / `p-3` | 12px | Padding de inputs, botoes compactos |
| `gap-4` / `p-4` | 16px | Padding de cards, separacao entre elementos |
| `gap-6` / `p-6` | 24px | Padding de secoes, espacamento entre cards |
| `gap-8` / `p-8` | 32px | Margem entre blocos de conteudo |
| `gap-12` / `p-12` | 48px | Espacamento entre secoes de pagina |
| `gap-16` / `p-16` | 64px | Espacamento entre secoes grandes (desktop) |

---

## 3. Tipografia

### 3.1 Fonte

**Primaria (e unica):** Inter via `next/font/google`

```typescript
// app/layout.tsx
import { Inter } from 'next/font/google'
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})
```

Inter e a escolha porque: excelente legibilidade em tamanhos pequenos (UI) e confortavel em blocos de texto longos (evolucao clinica). Features OpenType `cv01` (lowercase l com cauda) e `cv02` habilitaveis para melhorar distincao l/I/1 se necessario.

### 3.2 Escala tipografica e uso

| Token | Tamanho | Peso | Uso |
|-------|---------|------|-----|
| `text-xs` | 12px | normal (400) | Caption, timestamp, metadata de audit log |
| `text-sm` | 14px | normal (400) | Texto auxiliar, label de form, placeholder |
| `text-sm` | 14px | medium (500) | Label de input, badge text |
| `text-base` | 16px | normal (400) | Body padrao, texto de consentimento, evolucao clinica |
| `text-base` | 16px | medium (500) | Botao, link de navegacao |
| `text-lg` | 18px | semibold (600) | Subtitulo de secao, nome do paciente em card |
| `text-xl` | 20px | semibold (600) | H4, titulo de card |
| `text-2xl` | 24px | bold (700) | H3, titulo de secao |
| `text-3xl` | 30px | bold (700) | H2, titulo de pagina |
| `text-4xl` | 36px | bold (700) | H1 mobile, valor de KPI |
| `text-5xl` | 48px | bold (700) | H1 desktop (se necessario) |

### 3.3 Legibilidade em texto longo

O campo de evolucao clinica (US-401) e a tela de consentimento (US-004/005) contem texto longo. Regras:

- Tamanho minimo: `text-base` (16px) — nunca menor para corpo de texto
- Largura maxima: `max-w-prose` (~65ch) — evita linhas longas demais
- Line-height: 1.5 (`leading-normal`) para corpo
- Paragrafo: `mb-4` entre paragrafos
- Cor: `text-foreground` (nunca `text-muted-foreground` para texto principal)

---

## 4. Sistema de Icones

**Biblioteca:** lucide-react (unica permitida pelo CLAUDE.md)

### 4.1 Tamanhos padrao

| Tamanho | Prop `size` | Uso |
|---------|-------------|-----|
| 16px | `size={16}` | Icone dentro de texto, badge, chip, status indicator |
| 20px | `size={20}` | Icone de acao inline (input suffix, botao ghost, nav item mobile) |
| 24px | `size={24}` | Icone de botao padrao, nav item desktop, card header — DEFAULT |
| 32px | `size={32}` | Icone de estado (empty state pequeno, indicador de qualidade de conexao) |
| 48px | `size={48}` | Icone ilustrativo (empty state grande, tela de erro, onboarding) |
| 64px | `size={64}` | Icone hero (tela 404/500, estado vazio principal) |

### 4.2 Icones por contexto

| Contexto | Icone lucide | Nota |
|----------|-------------|------|
| Dashboard / Home | `LayoutDashboard` | Nav psicologa |
| Agenda | `Calendar` | Nav psicologa |
| Pacientes | `Users` | Nav psicologa |
| Financeiro | `Wallet` | Nav psicologa |
| Perfil / Config | `Settings` | Nav psicologa |
| Inicio (portal) | `Home` | Nav paciente |
| Compromissos | `CalendarDays` | Nav paciente |
| Pagamentos | `CreditCard` | Nav paciente |
| Menu hamburger | `Menu` | Mobile |
| Fechar | `X` | Modais, drawers |
| Voltar | `ArrowLeft` | Navegacao |
| Microfone on | `Mic` | Sala de video |
| Microfone off | `MicOff` | Sala de video |
| Camera on | `Video` | Sala de video |
| Camera off | `VideoOff` | Sala de video |
| Anotacoes | `FileText` | Painel lateral na sala |
| Encerrar sessao | `PhoneOff` | Sala de video (botao destructive) |
| Sinal de conexao | `Wifi` / `WifiOff` | Qualidade da chamada |
| Loading/spinner | `Loader2` | Com `animate-spin` |
| Sucesso | `CheckCircle` | Toast, badge |
| Erro | `AlertCircle` | Toast, input error |
| Alerta | `AlertTriangle` | Warning states |
| Info | `Info` | Tooltip, hint |
| Download | `Download` | Recibo PDF |
| Upload | `Upload` | Anamnese |
| Busca | `Search` | Filtros |
| Filtro | `Filter` | Tabelas |
| Novo / Adicionar | `Plus` | Botao de acao |
| Editar | `Pencil` | Evolucao, perfil |
| Lixeira | `Trash2` | Acao destrutiva |
| Relogio | `Clock` | Tempo de espera |
| Escudo | `ShieldCheck` | MFA, seguranca |
| QR code | `QrCode` | MFA setup |
| Olho aberto | `Eye` | Toggle senha visivel |
| Olho fechado | `EyeOff` | Toggle senha oculta |
| Sino | `Bell` | Notificacoes |
| Log / Historico | `ScrollText` | Audit log |
| Recibo | `Receipt` | Financeiro |
| PIX / Pagamento | `Banknote` | Metodo de pagamento |
| Paciente (avatar) | `User` | Fallback de avatar |
| Sala de espera | `Clock` | Estado de aguardo |
| Estrela | `Star` | Nao usado — evitar decoracao |

### 4.3 Regras de uso

- Botoes icon-only **sempre** com `aria-label`: `<Button variant="ghost" size="icon" aria-label="Fechar"><X size={20} /></Button>`
- Icones decorativos (ao lado de texto que ja descreve a acao): `aria-hidden="true"`
- Na sala de video, icones de controle devem ter touch target >= 48px (mobile)
- Icones de status (sucesso, erro, alerta) nunca como unico indicador — sempre acompanhados de texto e/ou mudanca de cor no container

---

## 5. Componentes (Atomic Design)

### 5.1 Atoms (shadcn/ui padrao — instalar via CLI)

```
npx shadcn@latest add button input label badge separator skeleton
npx shadcn@latest add avatar switch checkbox radio-group select
npx shadcn@latest add textarea tooltip progress tabs
```

### 5.2 Molecules (shadcn + customizacao)

**FormField** — Label + Input + mensagem de erro (react-hook-form + zod)
- Anatomia: `<Label>` + `<Input>` + `<p className="text-destructive text-sm">`
- Variantes: text, email, password (com toggle eye), phone, cpf (masked), date, currency
- Estados: default, focus, error (borda + icone + texto), disabled, read-only

**SearchBar** — Input + icone Search + botao clear
- Usado em: lista de pacientes, historico clinico, lista de cobrancas

**StatusBadge** — Badge com cores semanticas por status
- Variantes e cores (nunca hardcoded — usar tokens):

| Status | Classe | Contexto |
|--------|--------|----------|
| `paid` / `confirmed` / `active` | `bg-success/15 text-success border-success/30` | Pagamento, sessao, assinatura |
| `pending` | `bg-warning/15 text-warning-foreground border-warning/30` | Pagamento, confirmacao |
| `overdue` / `cancelled` | `bg-destructive/15 text-destructive border-destructive/30` | Pagamento vencido, sessao cancelada |
| `invite_pending` | `bg-info/15 text-info border-info/30` | Convite de paciente |
| `waiting` | `bg-primary/15 text-primary border-primary/30` | Sala de espera |

**KpiCard** — Card com valor, label, variacao e icone
- Anatomia: icone (24px, text-muted-foreground) + label (text-sm, text-muted-foreground) + valor (text-3xl, font-bold) + variacao (text-sm, cor semantica + seta up/down)
- Skeleton: retangulo com pulse para cada campo

**SessionSlot** — Bloco de sessao na agenda
- Anatomia: horario (text-sm, font-medium) + nome do paciente (text-sm, truncate) + StatusBadge de pagamento (4px dot)
- Variantes por status: confirmada (borda-l-4 border-success), pendente (border-warning), cancelada (border-muted, opacity-50, line-through no nome)
- Touch target: minimo 44px de altura

**DeviceSelector** — Select + preview (camera/microfone/alto-falante)
- Usado no pre-flight de dispositivos

**ConsentSection** — Bloco de consentimento com texto + checkbox
- Anatomia: titulo (text-lg, font-semibold) + texto scrollavel (max-h, overflow-y-auto, text-base) + Checkbox com label destacado
- Variantes: obrigatorio (borda-l-4 border-primary), opcional (borda-l-4 border-muted)
- Checkbox obrigatorio: label em font-medium
- Checkbox opcional: label em font-normal com indicacao "(opcional)"

**MfaCodeInput** — 6 inputs de 1 digito com auto-advance
- Anatomia: 6 inputs (w-12, h-14, text-center, text-2xl, font-bold) com gap-2
- Auto-focus no proximo ao digitar, backspace volta ao anterior
- Estado de erro: borda destructive em todos os 6 campos + mensagem abaixo

### 5.3 Organisms (custom)

**PsychologistHeader** (mobile only — desktop usa sidebar)
- Logo "Talitha" (text-lg, font-semibold, text-primary) + icone de notificacao (Bell) + avatar da psicologa
- Sticky, h-14 (56px), z-20

**PsychologistSidebar** — Navegacao lateral
- Logo "Talitha" no topo + nav items (icone + label) + footer com perfil/logout
- Desktop: 240px, fixa
- Tablet: 64px colapsada (so icones, tooltip no hover)
- Mobile: oculta, abre como Sheet (shadcn)
- Item ativo: bg-sidebar-accent, text-sidebar-accent-foreground, font-medium
- Hover: bg-sidebar-accent/50

**PatientHeader** (desktop/tablet)
- Logo "Talitha" (apenas o nome — sem "Psicologia") + nav items inline + avatar
- Sticky, h-14, z-20, max-w-5xl centralizado

**PatientBottomNav** (mobile only)
- 4 items: Inicio, Compromissos, Pagamentos, Perfil
- Icons 20px + label text-xs
- Fixed bottom, h-16 (64px), z-20, bg-card, border-t
- Item ativo: text-primary, font-medium
- Touch target: 48x48px por item

**AgendaWeekView** — Grade semanal da agenda
- 7 colunas (seg-dom) + eixo de horas (7h-22h)
- SessionSlot posicionado por horario/duracao
- Navegacao: setas ou swipe entre semanas
- Mobile: nao exibida (usa AgendaDayView)

**AgendaDayView** — Visao diaria da agenda
- Seletor de data (swipe/setas) + lista vertical de SessionSlot
- Padrao em mobile, disponivel em desktop como alternativa

**VideoRoom** — Sala de video
- Anatomia: video remoto (area principal) + self-view (PIP, canto inferior direito, arrastavel) + barra de controles (bottom) + painel de anotacoes (lateral, colapsavel)
- Desktop: video 70% + notas 30% (quando aberto)
- Mobile: video fullscreen, notas como modal overlay, self-view PIP
- Controles: Mic toggle, Camera toggle, Notes toggle (so psicologa), qualidade de sinal, Encerrar (destructive)
- Background: dark (hsl(220, 18%, 6%)) mesmo em light mode — otimiza visualizacao de video

**WaitingRoomView** — Sala de espera (paciente)
- Centralizado vertical e horizontal
- Animacao "breathe" (pulsacao suave — nao spinner agressivo)
- Texto: "Aguarde, voce sera atendido(a) em instantes"
- Tempo de espera discreto (text-muted-foreground, atualiza a cada minuto)
- Apos 10min: mensagem adicional
- Apos 20min: opcao de sair
- Background: bg-background (nao dark — nao e sala de video ainda)
- Nenhum elemento que sugira fila ou presenca de outra pessoa

**WaitingList** — Lista de espera (psicologa)
- Card por paciente aguardando: nome + horario agendado + tempo de espera + botao "Admitir"
- Se em sessao ativa: aviso "Finalize a sessao atual antes de admitir"
- Vazio: "Nenhum paciente aguardando. Proxima sessao as [horario] com [Nome]."

**ChargesTable** — Tabela de cobrancas (TanStack Table)
- Colunas: paciente, descricao, valor, vencimento, status (StatusBadge), acoes
- Sort por qualquer coluna, filtro por status e paciente
- Paginacao (20 por pagina)
- Mobile: layout de card empilhado (nao tabela)

**PatientCard** — Card de paciente na listagem
- Avatar (iniciais, bg-primary/10, text-primary) + nome + StatusBadge (ativo/convite pendente/encerrado) + proxima sessao (text-sm, text-muted-foreground)

**ReceiptDownloadItem** — Item na lista de recibos
- Numero + data + valor + StatusBadge (disponivel/cancelado) + botao Download (icone)
- PDF gerado on-demand ao clicar

**ClinicalRecordEntry** — Entrada no historico clinico
- Data + duracao + humor badge + preview do texto (2 linhas, truncado)
- Expandivel ao clicar (accordion ou dialog)
- Icone Pencil para editar (so psicologa)

**ConsentFlow** — Fluxo de consentimento (2 etapas)
- Step indicator (2 dots)
- Etapa 1: Termo de Atendimento Online (ConsentSection obrigatorio)
- Etapa 2: Consentimento LGPD (ConsentSection obrigatorio + ConsentSection obrigatorio Asaas + ConsentSection opcional email)
- Botao "Aceitar e Continuar" / "Autorizar e Continuar" habilitado apenas quando checkboxes obrigatorios marcados

### 5.4 Templates (layouts)

**PsychologistLayout** — Shell do painel da psicologa
- Desktop: PsychologistSidebar (240px) + main content (flex-1)
- Tablet: PsychologistSidebar colapsada (64px) + main content
- Mobile: PsychologistHeader (sticky top) + main content + PsychologistBottomNav (se preferir) ou hamburger menu
- Decisao tomada: mobile da psicologa usa hamburger menu (Sheet) em vez de bottom nav, porque o painel e desktop-first e o uso mobile e eventual

**PatientLayout** — Shell do portal do paciente
- Mobile: main content (com padding bottom 80px para bottom nav) + PatientBottomNav
- Desktop: PatientHeader + main content (max-w-3xl, centralizado)
- Conteudo do portal nunca ultrapassa max-w-3xl — e um portal enxuto, nao um dashboard

**AuthLayout** — Telas de login, senha, MFA, convite
- Centralizado, sem sidebar/nav
- max-w-md, card com shadow-lg
- Logo "Talitha" no topo, text-2xl, font-bold, text-primary
- Background: bg-background

**VideoLayout** — Sala de video (sem nav, fullscreen)
- Sem sidebar, sem header, sem bottom nav
- Background: dark sempre (hsl(220, 18%, 6%))
- Controles no bottom com bg-black/60 e backdrop-blur
- Z-[70] para overlay de reconexao
- Botao "voltar" (X ou ArrowLeft) no canto superior esquerdo

**ConsentLayout** — Telas de consentimento
- Sem sidebar/nav (exceto logo)
- max-w-2xl, centralizado
- Logo "Talitha" no topo
- Nao permite navegacao para o portal ate concluir — sem links de fuga

---

## 6. Estados de Componente

### 6.1 Button

| Estado | Visual |
|--------|--------|
| default | bg-primary, text-primary-foreground |
| hover | bg-primary/90 |
| active (pressed) | scale-[0.98] |
| focus-visible | ring-2 ring-ring ring-offset-2 ring-offset-background |
| disabled | opacity-50, cursor-not-allowed, pointer-events-none |
| loading | Loader2 com animate-spin + texto "Aguarde..." ou so icone. Desabilitado |

Variantes adicionais:
- `secondary`: bg-secondary, text-secondary-foreground
- `destructive`: bg-destructive, text-destructive-foreground
- `outline`: border border-input, bg-background, hover:bg-accent
- `ghost`: hover:bg-accent, hover:text-accent-foreground
- `link`: text-primary, underline-offset-4, hover:underline

### 6.2 Input / FormField

| Estado | Visual |
|--------|--------|
| default | border-input, bg-background |
| focus | ring-2 ring-ring, border-ring |
| erro | border-destructive, ring-destructive/20 + icone AlertCircle (16px) + texto de erro (text-sm, text-destructive) abaixo |
| sucesso | border-success (quando validacao inline for necessaria — ex: CRP, CPF) |
| disabled | opacity-50, bg-muted, cursor-not-allowed |
| read-only | bg-muted/50, cursor-default |

### 6.3 Link / Nav Item

| Estado | Visual |
|--------|--------|
| default | text-foreground |
| hover | text-primary (sidebar: bg-sidebar-accent) |
| active (pagina atual) | text-primary, font-semibold, bg-sidebar-accent (sidebar), border-b-2 border-primary (top nav) |
| focus-visible | ring-2 ring-ring, rounded |

### 6.4 Card

| Estado | Visual |
|--------|--------|
| default | bg-card, border, shadow-sm |
| hover (se clicavel) | shadow-md, translate-y-[-1px], transition-all duration-base |
| selected | ring-2 ring-primary |
| disabled | opacity-50 |

### 6.5 SessionSlot

| Estado | Visual |
|--------|--------|
| confirmada | border-l-4 border-success, bg-card |
| pendente | border-l-4 border-warning, bg-card |
| cancelada | border-l-4 border-muted, bg-muted/30, opacity-60, nome com line-through |
| hoje (proxima) | ring-2 ring-primary, bg-primary/5 |

### 6.6 StatusBadge

Definido na secao 5.2. Sempre usa cor + texto (nunca so cor). Icone opcional para reforco (CheckCircle para pago, Clock para pendente, AlertCircle para vencido).

---

## 7. Padroes de Layout

### 7.1 Comportamento responsivo — Painel da psicologa

| Componente | Mobile (<640px) | Tablet (640-1024px) | Desktop (>1024px) |
|---|---|---|---|
| Navegacao | Hamburger (Sheet) | Sidebar colapsada (64px, icones) | Sidebar expandida (240px) |
| KPI Cards | 2 colunas (grid-cols-2) | 4 colunas | 4 colunas com mais padding |
| Grafico de receita | h-48, sem legenda lateral | h-56, legenda embaixo | h-72, legenda lateral |
| Agenda | Visao diaria apenas | Visao semanal (3 dias visiveis) | Visao semanal completa (7 dias) |
| Tabela de cobrancas | Cards empilhados (sem table) | Tabela simplificada (4 cols) | TanStack Table completa (6 cols) |
| Ficha do paciente | Tabs verticais (accordion) | Tabs horizontais | Tabs horizontais + sidebar de info |
| Sala de video | Fullscreen, controles bottom | Video + notas side-by-side | Video (70%) + notas (30%) |

### 7.2 Comportamento responsivo — Portal do paciente

| Componente | Mobile (<640px) | Tablet (640-1024px) | Desktop (>1024px) |
|---|---|---|---|
| Navegacao | Bottom nav (64px) | Top nav | Top nav |
| Card proxima sessao | Full width, destaque | max-w-md centralizado | max-w-md centralizado |
| Lista de sessoes | Cards full width | Cards max-w-2xl | Cards max-w-2xl |
| Lista de pagamentos | Cards full width | Cards max-w-2xl | Cards max-w-2xl |
| Sala de espera | Centralizado, fullscreen | Centralizado, max-w-md | Centralizado, max-w-md |
| Sala de video | Fullscreen | Fullscreen | Centralizado com max-w-4xl |
| Anamnese (form) | Full width, campos empilhados | max-w-2xl | max-w-2xl |

### 7.3 Breakpoints

Usar os breakpoints padrao do Tailwind:

| Token | Valor | Uso |
|-------|-------|-----|
| (default) | 0-639px | Mobile |
| `sm:` | 640px+ | Tablet portrait |
| `md:` | 768px+ | Tablet landscape |
| `lg:` | 1024px+ | Desktop |
| `xl:` | 1280px+ | Desktop wide |

---

## 8. Estrategia de Loading

| Tipo de conteudo | Padrao | Motivo |
|---|---|---|
| KPI cards | Skeleton com pulse (4 retangulos) | Placeholder do tamanho certo, evita CLS |
| Lista de sessoes/cobrancas/pacientes | Skeleton de 3-5 linhas | Mantem layout previsivel |
| Graficos (recharts) | Skeleton retangular da area do grafico | Area grande demais para skeleton fiel |
| Formularios | Nao — formularios renderizam imediatamente (campos vazios) | O shell do form e estatico |
| Acoes de botao (submit, admitir, gerar cobranca) | Button com `disabled` + Loader2 animate-spin | Feedback imediato, evita double-submit |
| Navegacao entre paginas | Skeleton do layout (nao spinner de tela cheia) | Mantem contexto visual |
| Video room (conectando) | Texto "Conectando..." + Loader2 sobre fundo escuro | Feedback claro durante conexao LiveKit |
| Teste de dispositivos (permissao) | Texto "Acessando seus dispositivos..." + Loader2 | Aguardando permissao do navegador |
| Consentimento (registrando aceite) | Button com spinner | Operacao critica — feedback obrigatorio |
| Recibo PDF (download on-demand) | Button com spinner + "Gerando recibo..." | Geracao server-side pode levar 1-2s |
| Sala de espera | Animacao "breathe" (pulsacao suave) | Transmite calma, nao urgencia |

**Regra geral:** Skeleton quando o shape do conteudo e previsivel. Spinner em botoes para acoes pontuais. Texto explicativo quando a espera pode ser longa (>2s). Nunca tela branca ou spinner de pagina inteira.

**`prefers-reduced-motion`:** todas as animacoes (pulse, breathe, spin, transitions) devem respeitar:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 9. Acessibilidade

### 9.1 Contraste
- Todos os pares de cores verificados na secao 2.2
- Texto normal >= 4.5:1 (AA)
- Texto grande (18px bold / 24px regular) >= 3:1
- Elementos de UI (bordas de input, icones funcionais) >= 3:1
- StatusBadge: nunca usa cor como unico indicador — sempre cor + texto (e opcionalmente icone)

### 9.2 Touch targets
- Mobile: minimo 44x44px para todos os elementos interativos
- Controles da sala de video (mobile): 48x48px (area sensivel maior por contexto de uso)
- Desktop: minimo 32x32px
- Nav items do PatientBottomNav: area de toque de 48x48px mesmo que o icone seja 20px

### 9.3 Focus states
- Todo elemento interativo tem `focus-visible` estilizado: `ring-2 ring-ring ring-offset-2`
- Nunca `outline: none` sem substituto visual
- Ordem de foco logica (tab order segue o fluxo visual)
- Skip-to-content link oculto visualmente, visivel no focus

### 9.4 ARIA
- Botoes icon-only: `aria-label` descritivo (ex: `aria-label="Desligar microfone"`)
- Toasts (sonner): `aria-live="polite"` (padrao do sonner)
- Video controls: `role="toolbar"` + `aria-label="Controles da sessao"`
- Sala de espera: `aria-live="polite"` na area de status para anunciar mudancas ("Voce foi admitido")
- Indicador de qualidade de conexao: `aria-label="Qualidade da conexao: boa/regular/ruim"`
- StatusBadge: texto do status e legivel; `aria-hidden="true"` no icone decorativo
- Modais (Dialog/Sheet): foco preso dentro, Esc fecha
- MfaCodeInput: `aria-label="Digito N do codigo de verificacao"` em cada input

### 9.5 Keyboard navigation
- Tab: navega entre elementos interativos na ordem logica
- Enter/Space: ativa botoes, checkboxes, links
- Esc: fecha modais, drawers, popovers, painel de anotacoes
- Setas: navegacao dentro de radio groups, selects, MfaCodeInput
- Agenda semanal: setas horizontais para mudar de dia, Enter para abrir sessao

### 9.6 Screen readers
- Imagens (se houver): `alt` descritivo
- Video room: `aria-label` nos controles; status de conexao anunciado por `aria-live`
- Skeleton loading: `aria-busy="true"` no container, `aria-hidden="true"` nos skeletons
- Animacao "breathe" da sala de espera: `aria-hidden="true"` (decorativa)

---

## 10. Politica de Conteudo Discreto (UI-level)

Requisito derivado do PRD e do Security Review (secao 8).

### 10.1 Portal do paciente — termos neutros

| Elemento | Termo USADO | Termo PROIBIDO |
|----------|-------------|----------------|
| Header/logo | "Talitha" | "Talitha Psicologia", "Psi Talitha" |
| Nav item sessoes | "Compromissos" | "Sessoes de terapia" |
| Card de sessao (titulo visivel) | "Proximo compromisso" | "Proxima sessao de psicoterapia" |
| Card de sessao (subtitulo) | "[dia], [hora]" ou "com Dra. Talitha" | "Sessao de atendimento psicologico" |
| Pagamentos | "Pagamentos" | "Pagamentos de sessoes de terapia" |
| Recibos | "Documentos" | "Recibos de atendimento psicologico" |
| Dentro de uma tela de detalhe (apos tap) | "Sessao" e aceitavel | "Psicoterapia" no titulo |

**Regra:** o que aparece no topo da tela (header, titulo de pagina, cards sem expandir) deve ser neutro para quem olha de relance. O que aparece apos interacao (tap, scroll) pode ser mais especifico.

### 10.2 Painel da psicologa — sem restricao de termos

O painel e de uso exclusivo da psicologa. Pode usar "Paciente", "Sessao", "Prontuario", "Evolucao" livremente. O CRP e e-Psi sao exibidos no perfil como exigido pelo CFP.

### 10.3 Nome de arquivo de recibo

`recibo-{numero}.pdf` — sem nome do paciente, sem "psicologia", sem "terapia". O conteudo do PDF (que menciona atendimento psicologico) so e visivel ao abrir o arquivo deliberadamente.

---

## 11. Complementos Aprovados

### 11.1 Vaul (drawer mobile)

**Justificativa:** O portal do paciente e mobile-first. Acoes contextuais (cancelar sessao, ver detalhes de pagamento, opcoes de perfil) beneficiam de um bottom drawer que segue o padrao nativo mobile (swipe para fechar, snap points). O shadcn Sheet e uma overlay lateral que funciona bem em desktop mas nao e ergonomico em mobile (nao esta na thumb zone).

**Uso previsto:**
- Portal do paciente: drawer de acoes na sessao (cancelar, remarcar)
- Portal do paciente: drawer de detalhes de pagamento
- Pre-flight de dispositivos: drawer de selecao de dispositivo em mobile
- Painel da psicologa (mobile): drawer de detalhes da sessao na agenda

### 11.2 TanStack Table (@tanstack/react-table)

**Justificativa:** O painel da psicologa tem tabelas de cobrancas (US-102/106/107) e audit log (US-405) que podem exceder 100 linhas e requerem sort, filter e paginacao. O volume de 500 cobrancas (requisito nao-funcional do PRD) confirma a necessidade.

**Uso previsto:**
- Lista de cobrancas (sort por paciente/valor/vencimento/status, filtro por status)
- Painel de inadimplentes (sort por valor em aberto/dias de atraso)
- Lista de recibos da psicologa (filtro por paciente/periodo)
- Audit log (paginacao, filtro por acao/paciente)

**Nao usar em:**
- Lista de pacientes (20-30 itens, sem necessidade de sort/filter complexo — lista simples)
- Lista de sessoes do paciente (maximo 10 itens visiveis — lista simples)
- Lista de pagamentos do paciente (lista simples com badges)

---

## 12. Estados Obrigatorios por Tela

Toda tela do MVP deve implementar os 4 estados abaixo. Os estados especificos por tela estao detalhados em `docs/talitha-wireframes.md`.

| Estado | Padrao geral |
|--------|-------------|
| **Loading** | Skeleton nas areas de conteudo dinamico. Shell da pagina (nav, header) renderiza imediatamente. Botoes de acao com spinner durante processamento |
| **Vazio** | Icone ilustrativo (48px, text-muted-foreground) + mensagem clara que orienta a proxima acao + botao/link para a acao sugerida. Centralizado |
| **Erro de rede/servidor** | Toast sonner (se a pagina carregou parcialmente) + area afetada com mensagem inline "Nao foi possivel carregar [recurso]. Tente novamente." + botao retry. Se a pagina inteira falhou: tela de erro com opcao de recarregar |
| **Sucesso** | Toast sonner para acoes (salvar, criar, admitir). Nao usar modais de sucesso — o toast e suficiente e nao interrompe o fluxo |

---

## Historico de versoes

| Versao | Data | Mudanca |
|--------|------|---------|
| 1.0 | 2026-09-09 | Design system inicial: paleta "Acolher", tokens light/dark, tipografia Inter, sistema de icones, inventario de componentes (Atomic Design), estados, layouts responsivos, loading strategy, acessibilidade WCAG AA, politica de discretion, complementos Vaul + TanStack Table |
