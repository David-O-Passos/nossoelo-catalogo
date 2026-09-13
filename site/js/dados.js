import { parseCSV } from './csv.js';
import { CACHE_MS, CHAVE_CACHE, URL_PLANILHA } from './config.js';

/** Aceita "189,90", "1.299,90", "75.0", "110" e "R$ 169,90". Devolve null se nao for numero.
 *
 * O separador decimal depende do idioma da planilha publicada, e ninguem vai
 * lembrar de conferir isso. Ler os dois formatos evita um preco 10x errado
 * numa loja no ar — que na tela pareceria perfeitamente normal.
 */
export function numero(texto) {
  // Coluna formatada como moeda publica "R$ 169,90": sem tirar o simbolo,
  // parseFloat devolve NaN e o preco riscado some de todos os produtos.
  const bruto = String(texto ?? '').replace(/[^\d,.-]/g, '');
  if (!bruto) return null;

  let limpo;
  if (bruto.includes(',')) {
    // Virgula presente: ela e o decimal e o ponto e separador de milhar.
    limpo = bruto.replace(/\./g, '').replace(',', '.');
  } else if (/\.\d{3}(\D|$)/.test(bruto) || (bruto.match(/\./g) || []).length > 1) {
    // Ponto seguido de exatamente tres digitos, ou varios pontos: milhar.
    limpo = bruto.replace(/\./g, '');
  } else {
    // Ponto unico com um ou dois digitos depois: decimal.
    limpo = bruto;
  }

  const n = parseFloat(limpo);
  return Number.isFinite(n) ? n : null;
}

function verdadeiro(texto) {
  return ['sim', 's', 'true', '1'].includes(String(texto || '').trim().toLowerCase());
}

/** Linha sem id, nome e preco_por: sobra de valor padrao arrastado na planilha, nao e produto. */
export function linhaVazia(linha) {
  return !['id', 'nome', 'preco_por'].some((coluna) => String(linha[coluna] ?? '').trim());
}

/** Converte uma linha crua da planilha. Retorna null se for invalida. */
export function normalizarProduto(linha) {
  const id = (linha.id || '').trim();
  const nome = (linha.nome || '').trim();
  const precoPor = numero(linha.preco_por);
  if (!id || !nome || precoPor === null) return null;

  let desconto = numero(linha.desconto);
  if (desconto === null || desconto < 0 || desconto > 100) desconto = null;

  return {
    id, nome, precoPor, desconto,
    ativo: verdadeiro(linha.ativo),
    marca: (linha.marca || '').trim(),
    categoria: (linha.categoria || '').trim(),
    tamanho: (linha.tamanho || '').trim(),
    descricao: (linha.descricao || '').trim(),
    precoDe: numero(linha.preco_de),
    imagem: (linha.imagem || '').trim(),
    destaque: verdadeiro(linha.destaque),
    // Coluna nova e independente de "ativo": o produto continua na vitrine,
    // so perde o botao de comprar. Planilha sem essa coluna ainda cai aqui e
    // vira false, entao publicar isto nao exige mudar a planilha primeiro.
    esgotado: verdadeiro(linha.esgotado),
  };
}

/** Valida a planilha inteira. Devolve produtos ativos e a lista de erros. */
export function validarLista(linhas) {
  const produtos = [];
  const erros = [];
  const vistos = new Set();

  linhas.forEach((linha, i) => {
    if (linhaVazia(linha)) return;
    const numeroLinha = i + 2; // +1 do cabecalho, +1 porque planilha comeca em 1
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
    if (p.ativo) produtos.push(p);
  });

  return { produtos, erros };
}

/** Corre a busca contra um prazo; no 4G ruim, sem isto a tela fica em branco indefinidamente. */
function comPrazo(tarefa, ms) {
  const controle = new AbortController();
  let relogio;
  const prazo = new Promise((_, rejeitar) => {
    relogio = setTimeout(() => {
      controle.abort();
      rejeitar(new Error('tempo esgotado'));
    }, ms);
  });
  return Promise.race([tarefa(controle.signal), prazo]).finally(() => clearTimeout(relogio));
}

/**
 * Busca os produtos com cache, rede, cache vencido e backup como quedas sucessivas.
 * Devolve { produtos, origem } com origem 'cache' | 'rede' | 'cache-vencido' | 'backup' | 'nenhum'.
 * O backup so e baixado quando todo o resto falha: ele pesa e quase nunca e usado.
 */
export async function carregarProdutos(deps = {}) {
  const {
    fetch: buscar = globalThis.fetch,
    storage = globalThis.localStorage,
    agora = () => Date.now(),
    urlPlanilha = URL_PLANILHA,
    carregarBackup = async () => [],
    prazoMs = 8000,
  } = deps;

  let cache = null;
  try {
    const bruto = storage.getItem(CHAVE_CACHE);
    if (bruto) cache = JSON.parse(bruto);
  } catch { cache = null; }
  const temCache = Boolean(cache && Array.isArray(cache.produtos));

  if (temCache && agora() - cache.quando < CACHE_MS) {
    return { produtos: cache.produtos, origem: 'cache' };
  }

  try {
    const texto = await comPrazo(async (signal) => {
      const resposta = await buscar(urlPlanilha, { signal });
      if (!resposta.ok) throw new Error('resposta ' + resposta.status);
      return resposta.text();
    }, prazoMs);
    const { produtos } = validarLista(parseCSV(texto));
    if (!produtos.length) throw new Error('planilha vazia');
    try {
      storage.setItem(CHAVE_CACHE, JSON.stringify({ quando: agora(), produtos }));
    } catch { /* cota cheia: seguir sem cache */ }
    return { produtos, origem: 'rede' };
  } catch {
    if (temCache && cache.produtos.length) {
      return { produtos: cache.produtos, origem: 'cache-vencido' };
    }
    let backup = [];
    try { backup = await carregarBackup(); } catch { backup = []; }
    if (Array.isArray(backup) && backup.length) return { produtos: backup, origem: 'backup' };
    return { produtos: [], origem: 'nenhum' };
  }
}
