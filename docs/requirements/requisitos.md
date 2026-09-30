# Requisitos do Sistema nassauTickets

## 1. Requisitos Funcionais

| ID | Requisito | Agente |
|----|-----------|--------|
| RF01 | O cliente deve emitir uma senha (SP, SG ou SE) pelo totem, sem se identificar. | AC |
| RF02 | O sistema deve gerar a senha no padrão `YYMMDD-PPSQ`, com sequência por tipo e reinício diário. | AS |
| RF03 | O sistema deve manter a fila de senhas e definir a próxima conforme as regras de prioridade. | AS |
| RF04 | O atendente deve fazer login para acessar o guichê. | AA |
| RF05 | O atendente deve chamar a próxima senha. | AA |
| RF06 | O atendente deve iniciar e finalizar o atendimento. | AA |
| RF07 | O atendente deve poder chamar novamente uma senha. | AA |
| RF08 | O painel deve exibir as 5 últimas senhas chamadas, sem mostrar a próxima. | AS |
| RF09 | A chamada deve emitir áudio informando prioridade, senha e guichê. | AS |
| RF10 | A função "Chamar Novamente" deve repetir o áudio e exibir a indicação "Última chamada". | AS |
| RF11 | O sistema deve controlar o estado da senha: EMITIDA, AGUARDANDO, CHAMADA, CHAMADA_NOVAMENTE, EM_ATENDIMENTO, ATENDIDA e NÃO_COMPARECEU. | AS |
| RF12 | O gestor deve consultar relatórios diário e mensal. | AA (gestor) |
| RF13 | O relatório deve trazer senhas emitidas e atendidas (geral e por prioridade) e o tempo médio de atendimento. | AS |
| RF14 | O relatório detalhado deve mostrar número, tipo, data/hora de emissão, data/hora de atendimento e guichê. Para senhas não atendidas, os campos de atendimento ficam em branco. | AS |
| RF15 | O relatório de auditoria deve registrar atendente, guichê, senha, horário da 1ª e da 2ª chamada, início e fim do atendimento. | AS |
| RF16 | O gestor deve fazer os cadastros do sistema. | AA (gestor) |

## 2. Regras de Negócio

| ID | Regra |
|----|-------|
| RN01 | Ordem de atendimento: `[SP] → [SE\|SG] → [SP] → [SE\|SG]`. |
| RN02 | SP tem a maior prioridade e SG a menor. A SE é chamada após uma SP, quando houver. |
| RN03 | Qualquer guichê pode atender qualquer tipo de senha. |
| RN04 | Se uma fila estiver vazia, o sistema segue as regras de prioridade para escolher a próxima. |
| RN05 | A senha não atendida após duas chamadas é considerada abandonada (NÃO_COMPARECEU). |
| RN06 | Cerca de 5% das senhas emitidas devem ser consideradas não atendidas, conforme a especificação do projeto. |
| RN07 | O expediente é das 7h às 17h. |
| RN08 | Atendimentos iniciados devem ser concluídos e encerrados pelo atendente. |
| RN09 | Ao fim do expediente, senhas que permanecerem na fila são descartadas. |
| RN10 | O cliente é anônimo. O atendente tem perfil adicional de gestor. |
| RN11 | A numeração das senhas reinicia todo dia. |

## 3. Requisitos Não Funcionais

| ID | Categoria | Requisito |
|----|-----------|-----------|
| RNF01 | Segurança | O acesso do atendente/gestor exige autenticação, e as senhas são armazenadas de forma protegida (hash). |
| RNF02 | Segurança | O acesso a relatórios e cadastros é restrito ao perfil de gestor. |
| RNF03 | Disponibilidade | O sistema deve funcionar durante todo o expediente (7h às 17h). |
| RNF04 | Disponibilidade | Diante de falha no backend ou no banco, o frontend e o painel devem exibir uma mensagem clara e não travar. |
| RNF05 | Auditoria | Toda chamada e todo atendimento devem ser registrados com data e hora. |
| RNF06 | Desempenho | A emissão de senha e a atualização do painel devem ocorrer em poucos segundos. O sistema deve permitir acompanhar o desempenho dos atendimentos por meio do tempo médio de atendimento. |
| RNF07 | Concorrência | Se dois atendentes pedirem a próxima senha ao mesmo tempo, a mesma senha não pode ser entregue às duas pessoas. |
| RNF08 | LGPD | O cliente não é identificado, e o sistema coleta apenas os dados necessários ao atendimento. |
| RNF09 | Acessibilidade | O painel e o totem devem ter letras grandes, bom contraste e áudio na chamada. |
| RNF10 | Usabilidade | As telas devem ser simples, para que qualquer cliente use o totem sem ajuda. |
| RNF11 | Tecnologia | Frontend em React, backend em Node.js com Express e banco de dados MySQL 8.0. |
