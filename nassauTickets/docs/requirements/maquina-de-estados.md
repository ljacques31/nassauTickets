# Máquina de estados da senha

```mermaid
stateDiagram-v2
    [*] --> EMITIDA: cliente escolhe o tipo no totem
    EMITIDA --> AGUARDANDO: gravada no banco
    AGUARDANDO --> CHAMADA: atendente clica Chamar próxima
    AGUARDANDO --> DESCARTADA: fim do expediente
    CHAMADA --> EM_ATENDIMENTO: cliente compareceu
    CHAMADA --> CHAMADA_NOVAMENTE: Chamar novamente (última chamada)
    CHAMADA_NOVAMENTE --> EM_ATENDIMENTO: cliente compareceu
    CHAMADA_NOVAMENTE --> NAO_COMPARECEU: não compareceu após duas chamadas
    EM_ATENDIMENTO --> ATENDIDA: Finalizar atendimento
    ATENDIDA --> [*]
    NAO_COMPARECEU --> [*]
    DESCARTADA --> [*]
```

| De | Para | Quem | Campo gravado |
|---|---|---|---|
| (nenhum) | EMITIDA | Cliente | emitida_em |
| EMITIDA | AGUARDANDO | Sistema | |
| AGUARDANDO | CHAMADA | Atendente | primeira_chamada_em, guiche_id, usuario_id |
| CHAMADA | CHAMADA_NOVAMENTE | Atendente | segunda_chamada_em |
| CHAMADA ou CHAMADA_NOVAMENTE | EM_ATENDIMENTO | Atendente | inicio_atendimento_em |
| EM_ATENDIMENTO | ATENDIDA | Atendente | fim_atendimento_em |
| CHAMADA_NOVAMENTE | NAO_COMPARECEU | Atendente | encerrada_em |
| EMITIDA ou AGUARDANDO | DESCARTADA | Sistema | encerrada_em |
