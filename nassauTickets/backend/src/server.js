import { env } from './config/env.js';
import { pool } from './config/db.js';
import { criarApp } from './app.js';
import { iniciarAgendadorExpediente } from './services/expedienteService.js';
import { iniciarBatimento } from './services/painelService.js';

async function garantirLinhaDeControle() {
  try {
    await pool.query('INSERT IGNORE INTO controle_fila (id) VALUES (1)');
  } catch (erro) {
    console.warn(`[inicio] banco indisponível (${erro.code || erro.message}). A API sobe mesmo assim e tenta de novo a cada requisição.`);
  }
}

await garantirLinhaDeControle();
const app = criarApp();
app.listen(env.porta, () => {
  console.log(`nassauTickets API em http://localhost:${env.porta}/api  (fuso ${process.env.TZ})`);
});
iniciarBatimento();
iniciarAgendadorExpediente();
