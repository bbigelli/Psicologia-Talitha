/**
 * Consent text constants.
 *
 * Each consent term is versioned. When the text changes, the hash changes,
 * and patients must re-accept. The hash is SHA-256 of the exact text shown.
 *
 * This module is importable from both server and client components.
 * Hash computation is done at build time (precomputed constants below).
 *
 * E7: Terms include clauses for online format, cancellation policy,
 * and connection drop policy (Resolucao CFP 09/2024).
 *
 * @see architecture.md §8.3 (A4: consent by purpose)
 * @see emenda E7
 */

/**
 * Termo de Consentimento para Atendimento Online (CFP).
 *
 * Includes E7 clauses: online format, cancellation policy, connection drop.
 * Based on Resolucao CFP 09/2024.
 */
export const CONSENT_TEXT_ONLINE_THERAPY = `TERMO DE CONSENTIMENTO PARA ATENDIMENTO PSICOLOGICO ONLINE

1. NATUREZA DO ATENDIMENTO
O atendimento psicologico sera realizado exclusivamente na modalidade online, por meio de videoconferencia, em conformidade com a Resolucao CFP no 09/2024 e o Codigo de Etica Profissional do Psicologo.

2. FORMATO ONLINE
O atendimento sera conduzido por plataforma de videoconferencia segura, com criptografia de ponta a ponta. E necessario que o paciente disponha de conexao estavel de internet, dispositivo com camera e microfone funcionais, e ambiente privado que garanta o sigilo da sessao.

3. SIGILO PROFISSIONAL
O conteudo das sessoes e protegido pelo sigilo profissional, nos termos do art. 9o do Codigo de Etica do Psicologo. A quebra de sigilo so ocorrera nas hipoteses previstas em lei.

4. POLITICA DE FALTAS E CANCELAMENTOS
As sessoes devem ser canceladas ou remarcadas com antecedencia minima conforme a politica da profissional. Faltas sem aviso previo ou cancelamentos fora do prazo poderao ser cobradas integralmente. A profissional informara o prazo exato durante o processo de acolhimento.

5. QUEDA DE CONEXAO
Em caso de queda de conexao durante a sessao:
  a) A profissional tentara restabelecer contato em ate 5 minutos;
  b) Caso nao seja possivel retomar, a sessao sera remarcada sem custo adicional;
  c) Se a instabilidade for recorrente, a profissional podera sugerir adequacoes tecnicas ou, em ultimo caso, avaliar a viabilidade do atendimento remoto.

6. LIMITACOES DO ATENDIMENTO ONLINE
O atendimento online pode nao ser adequado para todas as situacoes clinicas. A avaliacao de viabilidade do atendimento remoto e de responsabilidade da profissional, conforme exigido pela Resolucao CFP 09/2024.

7. DIREITO DE RECUSA
O paciente tem o direito de recusar ou interromper o atendimento a qualquer momento, sem necessidade de justificativa.

8. REGISTRO PROFISSIONAL
As evolucoes clinicas sao registradas em prontuario eletronico criptografado, com acesso exclusivo da profissional, e mantidas pelo prazo legal de 5 anos apos o encerramento do atendimento.

Ao aceitar este termo, voce declara estar ciente e de acordo com as condicoes acima descritas.`

/**
 * LGPD Clinical consent text — treatment of personal data for clinical purposes.
 */
export const CONSENT_TEXT_LGPD_CLINICAL = `AUTORIZACAO PARA TRATAMENTO DE DADOS PESSOAIS — ACOMPANHAMENTO CLINICO

Em cumprimento a Lei Geral de Protecao de Dados (Lei no 13.709/2018), informamos:

DADOS COLETADOS
- Dados de identificacao: nome completo, CPF, data de nascimento, e-mail, telefone
- Dados de saude: informacoes fornecidas durante as sessoes de atendimento, anamnese e evolucoes clinicas

FINALIDADE
Os dados serao utilizados exclusivamente para:
- Realizacao do acompanhamento psicologico
- Registro de evolucoes clinicas em prontuario eletronico
- Emissao de documentos profissionais (recibos, declaracoes)
- Comunicacao sobre agendamentos e compromissos

PROTECAO DOS DADOS
- Dados de saude e evolucoes clinicas sao criptografados em repouso (AES-256-GCM)
- O acesso ao prontuario e exclusivo da profissional responsavel
- A infraestrutura utiliza servidores em territorio brasileiro (sa-east-1)
- Dados de autenticacao podem ser processados em infraestrutura internacional do provedor de identidade

RETENCAO
Os dados clinicos serao mantidos pelo prazo minimo de 5 anos apos o encerramento do atendimento, conforme exigido pelo Conselho Federal de Psicologia. Apos esse prazo, serao eliminados de forma segura.

SEUS DIREITOS
Voce pode, a qualquer momento:
- Solicitar acesso aos seus dados pessoais
- Solicitar a correcao de dados incorretos
- Revogar este consentimento (sujeito a retencao legal dos dados clinicos)
- Solicitar informacoes sobre o tratamento dos seus dados

A revogacao deste consentimento implicara o encerramento do acompanhamento.`

/**
 * LGPD Asaas consent text — data sharing with payment processor.
 */
export const CONSENT_TEXT_LGPD_ASAAS = `AUTORIZACAO PARA COMPARTILHAMENTO DE DADOS — PROCESSAMENTO DE PAGAMENTOS

Seus dados pessoais (nome completo, CPF e e-mail) serao compartilhados com a plataforma Asaas (Asaas Gestao Financeira S.A.) para a finalidade exclusiva de processamento de pagamentos e emissao de cobranças.

O Asaas atua como operador de dados, processando suas informacoes conforme sua propria politica de privacidade e em conformidade com a LGPD.

Os dados compartilhados sao limitados ao estritamente necessario para a operacao financeira. Nenhuma informacao clinica ou de saude e compartilhada com o Asaas.

A descricao das cobranças sera neutra ("Prestacao de servicos profissionais"), sem mencao a natureza clinica do atendimento.`

/**
 * Communication consent text — optional email reminders.
 */
export const CONSENT_TEXT_COMMUNICATION = `AUTORIZACAO PARA ENVIO DE LEMBRETES POR E-MAIL

Desejo receber lembretes por e-mail sobre meus compromissos agendados e avisos de pagamento.

As notificacoes serao enviadas com assuntos neutros (sem mencao a natureza do atendimento). No entanto, estou ciente de que notificacoes por e-mail podem ser visiveis na tela de bloqueio do meu dispositivo.

Posso revogar esta autorizacao a qualquer momento pelo meu perfil no portal.`

/**
 * Precomputed SHA-256 hashes of the current version of each consent text.
 *
 * These are computed at build time using the hashConsentText() function
 * from consent-hash.ts (server-only). If the text above changes, these
 * hashes MUST be regenerated. To regenerate:
 *
 *   node -e "const c=require('crypto'); console.log(c.createHash('sha256').update(TEXT).digest('hex'))"
 *
 * Or run the test that verifies them.
 */
export const CONSENT_HASHES = {
  online_therapy:
    "c1f40403d690f8d436b56667f4af082b0c5b87ac6f55174be827a4e75998feed",
  lgpd_clinical:
    "927ce445431890b80b807f12686a035428bc779e9859e38b12865928cf244453",
  lgpd_asaas:
    "84ce774dd16b658a63286872d39b88c3479e023c953f713249665c31691f2289",
  communication:
    "36bf167fd89d0bd8fda18fe38e264021587921d7f65e120783e2f128e9937970",
} as const
