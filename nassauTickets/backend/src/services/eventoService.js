/** Grava uma linha na trilha de auditoria (senha_eventos). Sempre dentro da transação da mudança. */
export async function registrarEvento(conn, { senhaId, de = null, para, usuarioId = null, guicheId = null, em, detalhe = null }) {
  await conn.query(
    `INSERT INTO senha_eventos (senha_id, estado_anterior, estado_novo, usuario_id, guiche_id, ocorrido_em, detalhe)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [senhaId, de, para, usuarioId, guicheId, em, detalhe],
  );
}
