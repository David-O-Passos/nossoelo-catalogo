import { linhaVazia, normalizarProduto, numero } from './dados.js';

/** Confere a planilha inteira contra as regras e contra a pasta de imagens. */
export function analisar(linhas, arquivosExistentes = []) {
  const existentes = new Set(arquivosExistentes);
  const usadas = new Set();
  const vistos = new Set();
  const erros = [];
  const avisos = [];
  let total = 0, ativos = 0, inativos = 0, semImagem = 0;

  linhas.forEach((linha, i) => {
    if (linhaVazia(linha)) return;
    total++;
    const numeroLinha = i + 2;
    const p = normalizarProduto(linha);

    if (!p) {
      erros.push({ linha: numeroLinha, motivo: 'faltando id, nome ou preco_por' });
      return;
    }
    if (vistos.has(p.id)) {
      erros.push({ linha: numeroLinha, motivo: `id duplicado: ${p.id}` });
      return;
    }
    vistos.add(p.id);

    if (p.ativo) ativos++; else inativos++;

    if (!p.imagem) {
      semImagem++;
      avisos.push(`Linha ${numeroLinha}: ${p.nome} está sem imagem.`);
    } else {
      usadas.add(p.imagem);
      if (!existentes.has(p.imagem)) {
        erros.push({ linha: numeroLinha, motivo: `imagem não encontrada: ${p.imagem}` });
      }
    }

    const descontoBruto = String(linha.desconto || '').trim();
    if (descontoBruto && p.desconto === null) {
      avisos.push(`Linha ${numeroLinha}: desconto inválido (${descontoBruto}).`);
    }

    // Preco com texto que o site nao consegue ler some da tela sem erro
    // nenhum — foi assim que o preco riscado sumiu quando a coluna virou moeda.
    const precoDeBruto = String(linha.preco_de || '').trim();
    if (precoDeBruto && numero(precoDeBruto) === null) {
      avisos.push(`Linha ${numeroLinha}: preco_de ilegível (${precoDeBruto}).`);
    }
  });

  for (const arquivo of existentes) {
    if (!usadas.has(arquivo)) {
      avisos.push(`Imagem sem produto: ${arquivo}`);
    }
  }

  return {
    erros, avisos,
    resumo: { total, ativos, inativos, semImagem },
  };
}
