# Requisitos do nassauTickets

## Agentes

| Sigla | Agente | Papel |
|---|---|---|
| AS | Sistema | Emite senhas, organiza filas, aplica a prioridade, exibe o painel, registra auditoria |
| AA | Atendente | Faz login no guichê, chama, inicia, finaliza, chama novamente, registra não comparecimento |
| AC | Cliente | Retira senha no totem, de forma anônima |

## Requisitos funcionais

| Código | Requisito |
|---|---|
| RF01 | O totem deve emitir senhas dos tipos SP (prioritária), SE (retirada de exames) e SG (geral), sem identificar o cliente. |
| RF02 | A senha deve seguir o formato YYMMDD-PPSQ, com sequência de três dígitos reiniciada diariamente por tipo. |
| RF03 | O totem só emite senhas dentro do expediente (padrão 07:00 às 17:00). |
| RF04 | O atendente deve fazer login informando usuário, senha e guichê. |
| RF05 | O atendente deve chamar a próxima senha; o sistema escolhe a senha pela regra de prioridade. |
| RF06 | O atendente deve iniciar e finalizar o atendimento. |
| RF07 | O atendente pode chamar novamente uma senha uma única vez ("Última chamada"). |
| RF08 | Após a segunda chamada sem comparecimento, o atendente registra NÃO_COMPARECEU. |
| RF09 | O painel exibe as 5 últimas senhas chamadas com o guichê, sem exibir a próxima. |
| RF10 | Cada chamada é anunciada por áudio com prioridade, senha e guichê. |
| RF11 | No fim do expediente, as senhas que aguardam na fila são descartadas; atendimentos iniciados são concluídos pelo atendente. |
| RF12 | Relatórios diário e mensal com quantitativo geral e por prioridade de senhas emitidas e atendidas. |
| RF13 | Relatório detalhado com número, tipo, data e hora de emissão, data e hora de atendimento e guichê; campos de atendimento em branco para senhas não atendidas. |
| RF14 | Relatório de tempo médio de atendimento, geral e por tipo. |
| RF15 | Relatório de auditoria com atendente, guichê, senha, 1ª chamada, 2ª chamada, início e fim do atendimento. |
| RF16 | Um usuário pode ter perfil de atendente e, adicionalmente, de gestor. |
| RF17 | O gestor cadastra atendentes e guichês. |
| RF18 | O gestor configura o horário do expediente e pode encerrar o expediente manualmente. |
| RF19 | O sistema oferece simulação do Agente Cliente, com cerca de 5% das senhas não atendidas. |
| RF20 | O gestor exporta os relatórios em CSV e imprime. |
| RF21 | Indicadores de desempenho: tempo médio de espera, tempo médio de atendimento, taxas e movimento por hora, guichê e atendente. |

## Regras de negócio

| Código | Regra |
|---|---|
| RN01 | Ordem de chamada: [SP] → [SE\|SG] → [SP] → [SE\|SG]. Após SP, chama SE; sem SE, SG; sem ambas, SP. Após SE ou SG (ou no início do dia), chama SP; sem SP, SE; depois SG. |
| RN02 | Dentro do mesmo tipo, vale a ordem de emissão. |
| RN03 | A regra de prioridade é global: considera a última senha chamada por qualquer guichê. |
| RN04 | Um atendente só chama nova senha depois de concluir a atual. |
| RN05 | Uma senha nunca é entregue a dois guichês. |
| RN06 | Uma senha pode ser chamada no máximo duas vezes. |
| RN07 | NÃO_COMPARECEU só é permitido após a segunda chamada. |
| RN08 | Senhas em estado final (ATENDIDA, NÃO_COMPARECEU, DESCARTADA) não mudam mais. |
| RN09 | No fechamento, senhas EMITIDA e AGUARDANDO passam para DESCARTADA. |
| RN10 | O limite diário é de 999 senhas por tipo. |
| RN11 | Um guichê com atendimento em andamento não pode ser assumido por outro atendente. |
| RN12 | Deve existir sempre ao menos um gestor ativo. |

## Requisitos não funcionais

### Segurança
- RNF01: senhas de login armazenadas com hash bcrypt.
- RNF02: autenticação por token JWT com validade de 10 horas; perfis verificados no backend em todas as rotas.
- RNF03: bloqueio temporário após 5 tentativas de login sem sucesso em 15 minutos.
- RNF04: limite de 30 emissões por minuto por endereço (proteção do totem).
- RNF05: segredos apenas no arquivo .env, fora do repositório.
- RNF06: mensagens de erro sem detalhes internos; cabeçalhos de segurança HTTP.

### Disponibilidade e comportamento em falhas
- RNF07: com o banco indisponível, a API responde 503 com mensagem clara e se recupera sozinha quando o banco volta.
- RNF08: painel, totem e guichês detectam perda de conexão, exibem aviso e reconectam automaticamente.
- RNF09: o painel mantém na tela as últimas chamadas conhecidas durante a falha.
- RNF10: o totem reenvia a emissão com chave de idempotência; nunca gera senha duplicada nem entrega senha sem gravação.

### Auditoria
- RNF11: toda mudança de estado de senha é registrada em senha_eventos com atendente, guichê e horário com milissegundos, na mesma transação da mudança.
- RNF12: logins, falhas, bloqueios e saídas são registrados em logs_acesso.

### Desempenho
- RNF13: pool de conexões com o banco.
- RNF14: índices para a busca da fila e dos relatórios.
- RNF15: atualização do painel por eventos do servidor (SSE), sem consultas repetidas.
- RNF16: relatórios paginados.

### Concorrência
- RNF17: chamada da próxima senha dentro de transação com bloqueio da linha de controle da fila (SELECT ... FOR UPDATE).
- RNF18: sequência diária incrementada de forma atômica no banco.
- RNF19: nova tentativa automática em caso de deadlock.
- RNF20: botões bloqueados no frontend enquanto a ação está em andamento.

### LGPD
- RNF21: o cliente é anônimo; nenhum dado pessoal é coletado no totem (minimização).
- RNF22: dados pessoais armazenados limitam-se a nome e login dos atendentes, necessários para a auditoria.
- RNF23: acesso a relatórios restrito ao perfil de gestor.

### Acessibilidade
- RNF24: fonte Atkinson Hyperlegible, desenhada para baixa visão; alto contraste.
- RNF25: cor do tipo sempre acompanhada da sigla escrita (não depende só da cor).
- RNF26: áudio das chamadas; navegação por teclado com foco visível; rótulos ligados aos campos; mensagens anunciadas por leitores de tela.
- RNF27: respeito à preferência de reduzir movimento; telas adaptadas ao celular.

## Pontos a confirmar com o documento base
- Tempos médios de atendimento por tipo usados na simulação (SP 15±5 min, SG 5±3 min, SE até 1 min em 95% e 5 min em 5%).
- Distribuição de tipos na simulação (SP 20%, SE 30%, SG 50%).
