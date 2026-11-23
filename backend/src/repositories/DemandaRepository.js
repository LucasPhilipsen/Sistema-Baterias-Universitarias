// Contagens da comparação de demanda (SCRUM-39). Uma única consulta lê estoque e confirmações,
// então, em READ COMMITTED, as duas partes vêm do mesmo snapshot. A rota só lê: nada é gravado ou bloqueado.
//
// A tabela `confirmacoes` e seus valores de situação seguem a proposta do contrato para a SCRUM-37.
// Se a modelagem final do Vitor usar outros nomes, o ajuste fica restrito a esta consulta.
export const SQL_DEMANDA_POR_TIPO = `
  SELECT t.id AS "tipoInstrumentoId",
         t.nome,
         COALESCE(c.confirmados, 0)::integer AS confirmados,
         COUNT(i.id) FILTER (WHERE i.situacao = 'DISPONIVEL')::integer AS disponiveis
  FROM tipos_instrumentos t
  LEFT JOIN instrumentos i ON i.tipo_instrumento_id = t.id
  LEFT JOIN (
    SELECT tipo_instrumento_id, COUNT(*) AS confirmados
    FROM confirmacoes
    WHERE ensaio_id = $1 AND situacao = 'ATIVA'
    GROUP BY tipo_instrumento_id
  ) c ON c.tipo_instrumento_id = t.id
  GROUP BY t.id, t.nome, c.confirmados
  ORDER BY t.nome, t.id`;

export class DemandaRepository {
  constructor(banco) {
    this.banco = banco;
  }

  async contarPorTipo(ensaioId) {
    const { rows } = await this.banco.query(SQL_DEMANDA_POR_TIPO, [ensaioId]);
    return rows;
  }
}
