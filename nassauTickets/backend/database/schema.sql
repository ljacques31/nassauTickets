-- nassauTickets | Esquema do banco de dados (MySQL 8.0)
-- Charset utf8mb4 para suportar acentuação completa.

CREATE TABLE IF NOT EXISTS usuarios (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome             VARCHAR(100) NOT NULL,
  login            VARCHAR(50)  NOT NULL,
  senha_hash       VARCHAR(100) NOT NULL,
  perfil_atendente TINYINT(1)   NOT NULL DEFAULT 1,
  perfil_gestor    TINYINT(1)   NOT NULL DEFAULT 0,
  ativo            TINYINT(1)   NOT NULL DEFAULT 1,
  criado_em        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT uq_usuarios_login UNIQUE (login)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS guiches (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  numero       SMALLINT UNSIGNED NOT NULL,
  descricao    VARCHAR(60) NULL,
  ativo        TINYINT(1)  NOT NULL DEFAULT 1,
  ocupante_id  INT UNSIGNED NULL COMMENT 'Atendente logado no guichê neste momento',
  ocupado_desde DATETIME(3) NULL,
  CONSTRAINT uq_guiches_numero UNIQUE (numero),
  CONSTRAINT fk_guiches_ocupante FOREIGN KEY (ocupante_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS senhas (
  id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo                CHAR(12)    NOT NULL COMMENT 'Formato YYMMDD-PPSQ',
  tipo                  ENUM('SP','SG','SE') NOT NULL,
  sequencia             SMALLINT UNSIGNED NOT NULL,
  data_emissao          DATE        NOT NULL,
  emitida_em            DATETIME(3) NOT NULL,
  estado                ENUM('EMITIDA','AGUARDANDO','CHAMADA','CHAMADA_NOVAMENTE',
                             'EM_ATENDIMENTO','ATENDIDA','NAO_COMPARECEU','DESCARTADA') NOT NULL,
  guiche_id             INT UNSIGNED NULL,
  usuario_id            INT UNSIGNED NULL,
  primeira_chamada_em   DATETIME(3) NULL,
  segunda_chamada_em    DATETIME(3) NULL,
  inicio_atendimento_em DATETIME(3) NULL,
  fim_atendimento_em    DATETIME(3) NULL,
  encerrada_em          DATETIME(3) NULL,
  simulada              TINYINT(1)  NOT NULL DEFAULT 0,
  idempotency_key       VARCHAR(64) NULL,
  CONSTRAINT uq_senhas_codigo UNIQUE (codigo),
  CONSTRAINT uq_senhas_idem UNIQUE (idempotency_key),
  CONSTRAINT fk_senhas_guiche FOREIGN KEY (guiche_id) REFERENCES guiches(id),
  CONSTRAINT fk_senhas_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  INDEX ix_senhas_fila (estado, tipo, data_emissao, id),
  INDEX ix_senhas_data (data_emissao),
  INDEX ix_senhas_usuario_estado (usuario_id, estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Trilha de auditoria: toda mudança de estado de toda senha.
CREATE TABLE IF NOT EXISTS senha_eventos (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  senha_id        BIGINT UNSIGNED NOT NULL,
  estado_anterior VARCHAR(20) NULL,
  estado_novo     VARCHAR(20) NOT NULL,
  usuario_id      INT UNSIGNED NULL,
  guiche_id       INT UNSIGNED NULL,
  ocorrido_em     DATETIME(3) NOT NULL,
  detalhe         VARCHAR(255) NULL,
  CONSTRAINT fk_eventos_senha FOREIGN KEY (senha_id) REFERENCES senhas(id) ON DELETE CASCADE,
  CONSTRAINT fk_eventos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  CONSTRAINT fk_eventos_guiche FOREIGN KEY (guiche_id) REFERENCES guiches(id),
  INDEX ix_eventos_senha (senha_id),
  INDEX ix_eventos_chamadas (estado_novo, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Contador diário por tipo (garante SQ de três dígitos com reinício diário, sem duplicidade).
CREATE TABLE IF NOT EXISTS sequencias_diarias (
  data   DATE NOT NULL,
  tipo   ENUM('SP','SG','SE') NOT NULL,
  ultimo SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (data, tipo)
) ENGINE=InnoDB;

-- Linha única que guarda o tipo da última senha chamada (alternância SP / SE|SG).
-- É bloqueada com SELECT ... FOR UPDATE a cada chamada, serializando atendentes concorrentes.
CREATE TABLE IF NOT EXISTS controle_fila (
  id                 TINYINT UNSIGNED PRIMARY KEY,
  ultimo_tipo        ENUM('SP','SG','SE') NULL,
  data_referencia    DATE NULL,
  atualizado_em      DATETIME(3) NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS configuracoes (
  chave VARCHAR(40)  PRIMARY KEY,
  valor VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Registro de acessos (segurança): logins bem sucedidos, falhas, bloqueios e saídas.
CREATE TABLE IF NOT EXISTS logs_acesso (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  login       VARCHAR(50) NOT NULL,
  usuario_id  INT UNSIGNED NULL,
  acao        ENUM('LOGIN_OK','LOGIN_FALHA','LOGIN_BLOQUEADO','LOGOUT') NOT NULL,
  guiche_id   INT UNSIGNED NULL,
  ip          VARCHAR(45) NULL,
  ocorrido_em DATETIME(3) NOT NULL,
  INDEX ix_logs_login (login, ocorrido_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
