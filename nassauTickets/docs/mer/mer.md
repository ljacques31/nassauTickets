# Modelo entidade relacionamento

```mermaid
erDiagram
    USUARIOS ||--o{ SENHAS : atende
    GUICHES ||--o{ SENHAS : "é chamada em"
    USUARIOS |o--o| GUICHES : ocupa
    SENHAS ||--|{ SENHA_EVENTOS : registra
    USUARIOS |o--o{ SENHA_EVENTOS : executa
    GUICHES |o--o{ SENHA_EVENTOS : ocorre_em
    USUARIOS |o--o{ LOGS_ACESSO : gera

    USUARIOS {
        int id PK
        varchar nome
        varchar login UK
        varchar senha_hash
        bool perfil_atendente
        bool perfil_gestor
        bool ativo
        datetime criado_em
    }
    GUICHES {
        int id PK
        smallint numero UK
        varchar descricao
        bool ativo
        int ocupante_id FK
        datetime ocupado_desde
    }
    SENHAS {
        bigint id PK
        char codigo UK "YYMMDD-PPSQ"
        enum tipo "SP SG SE"
        smallint sequencia
        date data_emissao
        datetime emitida_em
        enum estado
        int guiche_id FK
        int usuario_id FK
        datetime primeira_chamada_em
        datetime segunda_chamada_em
        datetime inicio_atendimento_em
        datetime fim_atendimento_em
        datetime encerrada_em
        bool simulada
        varchar idempotency_key UK
    }
    SENHA_EVENTOS {
        bigint id PK
        bigint senha_id FK
        varchar estado_anterior
        varchar estado_novo
        int usuario_id FK
        int guiche_id FK
        datetime ocorrido_em
        varchar detalhe
    }
    SEQUENCIAS_DIARIAS {
        date data PK
        enum tipo PK
        smallint ultimo
    }
    CONTROLE_FILA {
        tinyint id PK
        enum ultimo_tipo
        date data_referencia
        datetime atualizado_em
    }
    CONFIGURACOES {
        varchar chave PK
        varchar valor
    }
    LOGS_ACESSO {
        bigint id PK
        varchar login
        int usuario_id
        enum acao
        int guiche_id
        varchar ip
        datetime ocorrido_em
    }
```

## Dicionário de dados resumido

| Tabela | Finalidade | Observações |
|---|---|---|
| usuarios | Atendentes e gestores | senha_hash em bcrypt; login único |
| guiches | Postos de atendimento | ocupante_id impede dois atendentes no mesmo guichê |
| senhas | Uma linha por senha | horários usados nos relatórios; índice (estado, tipo, data_emissao, id) para a fila |
| senha_eventos | Trilha de auditoria | gravada na mesma transação da mudança de estado |
| sequencias_diarias | Contador por dia e tipo | incremento atômico com LAST_INSERT_ID |
| controle_fila | Último tipo chamado | linha única bloqueada com FOR UPDATE a cada chamada |
| configuracoes | Expediente e modo demonstração | chave e valor |
| logs_acesso | Segurança | base do bloqueio após tentativas falhas |

O script completo está em `backend/database/schema.sql`.
