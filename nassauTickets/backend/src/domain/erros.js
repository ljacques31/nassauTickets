/** Erro previsto pelas regras de negócio, devolvido ao cliente com status e código próprios. */
export class ErroNegocio extends Error {
  constructor(status, codigo, mensagem, dados) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
    this.dados = dados;
  }
}
