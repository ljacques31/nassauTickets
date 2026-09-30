# nassauTickets

Sistema de controle de atendimento por senhas para a recepção de um laboratório de análises clínicas.

## Objetivo
Organizar a fila da recepção com três tipos de senha (SP prioritária, SE retirada de exames, SG geral), chamada alternada por prioridade, painel com áudio, controle do atendimento no guichê e relatórios diário e mensal com auditoria.

## Membros

| Nome | Matrícula | Papel |
|---|---|---|
| Lucas Jacques | 01892141 | Scrum Master |
| Rodrigo Santana | 01893829 | Documentador |
| Anderson Matias | 01905508 | Testador |
| João Pedro Ramos | 01886050 | Testador |
| Vitor Alves | 01891758 | Desenvolvedor |

## Tecnologias
- Backend: Node.js 22, Express 4, mysql2, bcryptjs, jsonwebtoken
- Banco: MySQL 8.0
- Frontend: React 19, Vite, React Router
- Tempo real: Server Sent Events; áudio: Web Speech API
- Testes: executor nativo do Node (node --test)

## Por que Node.js com Express no backend
A atividade pede .gitignore de Node.js e React no frontend. Usar JavaScript nas duas pontas deixa o grupo com uma linguagem só e permite reaproveitar conhecimento. O Express é simples de ler, tem o maior ecossistema de Node e atende bem uma API REST deste porte. O driver mysql2 dá suporte completo a transações e bloqueio de linha, usados para resolver a concorrência entre guichês.

## Arquitetura
Frontend React chama a API REST em JSON e recebe eventos em tempo real por SSE. O backend concentra todas as regras (prioridade, máquina de estados, expediente, auditoria) e grava no MySQL. Detalhes e diagramas em docs/models/uml.

## Estrutura
- backend: API (src/config, domain, services, routes, middlewares), banco (database) e testes (tests)
- frontend: React (src/pages, components, services, hooks, contexts, utils, styles)
- docs: requisitos, MER, UML, mockups e identidade visual

## Instalação
Pré requisitos: Node.js 22, MySQL 8.0 rodando.

```
cd backend
npm install
npm install express@4 mysql2 bcryptjs jsonwebtoken cors dotenv
cp .env.example .env        (no Windows: Copy-Item .env.example .env)
npm run db:setup
npm run db:demo
npm run dev
```
Edite backend/.env com o usuário e a senha do MySQL. Depois:
```
npm run db:setup            cria o banco, tabelas e o usuário admin
npm run db:demo             opcional: cria atendente2 e atendente3
cd ../frontend
npm install
```

Instalação Frontend:
```
npm install
npm install react@19 react-dom@19 react-router-dom@7
npm install -D vite @vitejs/plugin-react
```


## Execução
Terminal 1:
```
cd backend
npm run dev
```
Terminal 2:
```
cd frontend
npm run dev
```
Acesse http://localhost:5173

Acessos iniciais: admin / admin123 (atendente e gestor). Com db:demo: atendente2 e atendente3, senha atende123. Troque as senhas em uso real.

## Configuração
| Variável | Descrição |
|---|---|
| PORT | Porta da API (3333) |
| TZ | Fuso horário (America/Recife) |
| DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME | Conexão MySQL |
| JWT_SECRET | Segredo dos tokens de login |
| JWT_EXPIRA_EM | Validade do login (10h) |
| CORS_ORIGIN | Endereço do frontend |
| ADMIN_SENHA_INICIAL | Senha do admin criada no setup |

O horário do expediente e o modo demonstração (emissão fora do horário, para testes) ficam na tela Gestão, aba Expediente e simulação.

## Testes
```
cd backend
npm test
```
17 testes: regras de prioridade, numeração, estados, expediente, emissão concorrente, idempotência, concorrência entre 8 atendentes, fim do expediente, relatórios e simulação. Os testes usam o banco separado nassau_tickets_test.

## Branches
- main: versão estável entregue
- dev: desenvolvimento; todo trabalho é feito aqui e integrado à main por merge
Commits seguem o padrão feat:, fix:, docs:, test:, chore:.

## Desafios atendidos
- Concorrência: transação com SELECT ... FOR UPDATE na linha de controle da fila; sequência diária atômica; testes com 8 atendentes simultâneos.
- Desempenho: pool de conexões, índices, SSE e paginação; indicadores de TME, TMA e produtividade.
- Áudio: aviso sonoro e fala com prioridade, senha e guichê; "Última chamada" na chamada novamente.
- Falhas: API responde 503 sem cair, telas avisam e reconectam, totem reenvia sem duplicar senha.
- Regra dos 5%: simulação do Agente Cliente com cerca de 5% de não comparecimento.

## Roteiro de demonstração
(cole aqui o roteiro da Parte 10 do guia)

## Licença
MIT. Veja o arquivo LICENSE.
