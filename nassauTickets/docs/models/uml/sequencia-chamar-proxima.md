# Sequência: dois atendentes chamando ao mesmo tempo

```mermaid
sequenceDiagram
    participant A1 as Atendente guichê 1
    participant A2 as Atendente guichê 2
    participant API as Backend
    participant DB as MySQL
    participant P as Painel

    A1->>API: POST /chamar-proxima
    A2->>API: POST /chamar-proxima
    API->>DB: BEGIN; SELECT controle_fila FOR UPDATE (pedido 1)
    API->>DB: BEGIN; SELECT controle_fila FOR UPDATE (pedido 2)
    Note over DB: pedido 2 espera o bloqueio
    DB-->>API: último tipo = SG
    API->>DB: busca SP mais antiga, UPDATE CHAMADA, INSERT evento, UPDATE controle_fila = SP
    API->>DB: COMMIT (pedido 1)
    DB-->>API: bloqueio liberado, último tipo = SP (pedido 2)
    API->>DB: busca SE mais antiga, UPDATE CHAMADA, INSERT evento, UPDATE controle_fila = SE
    API->>DB: COMMIT (pedido 2)
    API-->>A1: 260929-SP004, guichê 1
    API-->>A2: 260929-SE007, guichê 2
    API-)P: evento chamada (SSE) e áudio
```
