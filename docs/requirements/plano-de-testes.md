# Plano de testes

Execução: `cd backend` e `npm test` (17 testes automatizados).

| Código | Tipo | Cenário | Resultado esperado |
|---|---|---|---|
| T01 | Unitário | Ordem após SP | SE, SG, SP |
| T02 | Unitário | Ordem após SE, SG ou início | SP, SE, SG |
| T03 | Unitário | Fila vazia é pulada | Próximo tipo com senha |
| T04 | Unitário | Sequência completa SP=3, SE=1, SG=3 | SP SE SP SG SP SG SG |
| T05 | Unitário | Formato YYMMDD-PPSQ | 260929-SP001 |
| T06 | Unitário | Sequência 1000 | Recusada |
| T07 | Unitário | Transições válidas | Aceitas |
| T08 | Unitário | Não comparecimento antes da 2ª chamada | Recusado |
| T09 | Unitário | Estados finais | Não mudam |
| T10 | Unitário | Expediente 7h às 17h e modo demonstração | Aberto e fechado nos limites |
| T11 | Integração | 60 emissões simultâneas | 001 a 060 sem repetição |
| T12 | Integração | Reenvio com a mesma chave | Mesma senha |
| T13 | Concorrência | 8 atendentes, 80 senhas | Nenhuma repetida e ordem igual à regra |
| T14 | Concorrência | 10 cliques simultâneos | 10 senhas diferentes |
| T15 | Integração | Fechamento com atendimento em curso | Fila descartada, atendimento concluído |
| T16 | Integração | Não comparecimento no relatório detalhado | Campos de atendimento em branco |
| T17 | Integração | Simulação de 600 senhas | Não comparecimento perto de 5% |

## Testes manuais
| Código | Cenário | Resultado esperado |
|---|---|---|
| M01 | Emitir senha fora do horário sem modo demonstração | Totem bloqueado com aviso |
| M02 | Chamar novamente | Painel mostra "Última chamada" e repete o áudio |
| M03 | Parar o MySQL | Aviso nas telas, API responde 503, recuperação automática |
| M04 | Dois atendentes no mesmo guichê com atendimento em curso | Segundo login recusado |
| M05 | 6 senhas erradas seguidas | Login bloqueado |
| M06 | Exportar CSV | Arquivo abre no Excel com acentos |
