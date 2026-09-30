/**
 * Cria o banco, as tabelas e os dados iniciais.
 *   npm run db:setup   cria o que faltar (não apaga nada)
 *   npm run db:reset   APAGA o banco e recria do zero
 *   npm run db:demo    adiciona dois atendentes de demonstração (teste de concorrência)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { env } from '../src/config/env.js';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const args = new Set(process.argv.slice(2));

async function main() {
  const { database, ...semBanco } = env.db;
  const conn = await mysql.createConnection({ ...semBanco, multipleStatements: true });

  if (args.has('--reset')) {
    await conn.query(`DROP DATABASE IF EXISTS \`${database}\``);
    console.log(`Banco ${database} apagado.`);
  }
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
  await conn.query(`USE \`${database}\``);

  const schema = await fs.readFile(path.join(aqui, 'schema.sql'), 'utf8');
  await conn.query(schema);
  console.log('Tabelas criadas ou já existentes.');

  await conn.query('INSERT IGNORE INTO controle_fila (id) VALUES (1)');
  await conn.query(`INSERT IGNORE INTO configuracoes (chave, valor) VALUES
    ('hora_abertura', '07:00'), ('hora_fechamento', '17:00'), ('modo_demonstracao', '0')`);
  await conn.query(`INSERT IGNORE INTO guiches (numero, descricao) VALUES
    (1, 'Recepção 1'), (2, 'Recepção 2'), (3, 'Entrega de exames')`);

  const [[admin]] = await conn.query("SELECT id FROM usuarios WHERE login = 'admin'");
  if (!admin) {
    const hash = await bcrypt.hash(env.adminSenhaInicial, 10);
    await conn.query(
      "INSERT INTO usuarios (nome, login, senha_hash, perfil_atendente, perfil_gestor) VALUES ('Atendente Gestor', 'admin', ?, 1, 1)",
      [hash]);
    console.log(`Usuário admin criado (atendente e gestor). Senha inicial: ${env.adminSenhaInicial}`);
  }

  if (args.has('--demo')) {
    const hash = await bcrypt.hash('atende123', 10);
    for (const [nome, login] of [['Atendente Demonstração 2', 'atendente2'], ['Atendente Demonstração 3', 'atendente3']]) {
      await conn.query(
        'INSERT IGNORE INTO usuarios (nome, login, senha_hash, perfil_atendente, perfil_gestor) VALUES (?, ?, ?, 1, 0)',
        [nome, login, hash]);
    }
    console.log('Atendentes de demonstração: atendente2 e atendente3 (senha atende123).');
  }

  await conn.end();
  console.log('Banco pronto.');
}

main().catch((erro) => {
  console.error('Falha ao preparar o banco:', erro.code || '', erro.message);
  console.error('Confira as variáveis DB_* no arquivo backend/.env');
  process.exit(1);
});
