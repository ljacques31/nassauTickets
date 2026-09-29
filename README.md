# nassauTickets

Sistema de controle de atendimento para um Laboratório de Análises Clínicas.

## Descrição

O nassauTickets gerencia a emissão, a fila, a chamada e o atendimento de senhas. O cliente retira a senha no totem, acompanha a chamada no painel e é atendido em um guichê por um atendente. O sistema também gera relatórios diários e mensais.

## Objetivo

Desenvolver em grupo um sistema web completo, aplicando organização de projetos, versionamento com Git/GitHub, documentação e desenvolvimento com React.

## Membros

| Nome | Matrícula | Papel |
|------|-----------|-------|
| Lucas Jacques | 01892141 | Scrum Master |
| Rodrigo Santana | 01893829 | Documentador |
| Anderson Matias | 01905508 | Testador |
| João Pedro Ramos | 01886050 | Testador |
| Vitor Alves | 01891758 | Desenvolvedor |

## Tecnologias utilizadas

- Frontend: React 19
- Backend: Node.js 22 com Express
- Banco de dados: MySQL 8.0
- Versionamento: Git e GitHub

**Justificativa do backend:** Node.js foi escolhido por usar JavaScript, a mesma linguagem do frontend, o que facilita o trabalho do grupo.

## Visão geral do sistema

- **Agentes:** Sistema (AS), Atendente (AA) e Cliente (AC).
- **Tipos de senha:** SP (prioritária), SG (geral) e SE (retirada de exames).
- **Ordem de atendimento:** SP → SE/SG → SP → SE/SG.
- **Numeração das senhas:** `YYMMDD-PPSQ` (exemplo: `260929-SP001`).
- **Painel:** mostra as 5 últimas senhas chamadas.
- **Relatórios:** diário e mensal, com relatório de auditoria.
- **Login:** o atendente faz login; o cliente usa o totem de forma anônima.

## Estrutura do repositório

```
nassauTickets/
├── backend/
├── docs/
│   ├── branding/
│   ├── mer/
│   ├── mockups/
│   ├── models/uml/
│   └── requirements/
├── frontend/
├── .gitignore
├── LICENSE
└── README.md
```

## Instalação

Pré-requisitos: Node.js 22, MySQL 8.0 e Git.

```bash
git clone https://github.com/ljacques31/nassauTickets.git
cd nassauTickets
git checkout dev

cd backend
npm install

cd ../frontend
npm install
```

## Configuração

Crie o banco de dados no MySQL:

```sql
CREATE DATABASE nassau_tickets;
```

Crie o arquivo `backend/.env`:

```env
PORT=3000
DB_HOST=localhost
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
DB_NAME=nassau_tickets
```

## Execução

```bash
# backend
cd backend
npm run dev

# frontend (em outro terminal)
cd frontend
npm run dev
```

## Branches

- `main`: versão estável, recebe código apenas por merge da `dev`.
- `dev`: branch de desenvolvimento, onde o código é enviado primeiro.

## Licença

Projeto sob a licença MIT.
