import { parseCSV } from './csv.js';
import { CACHE_MS, CHAVE_CACHE, URL_PLANILHA } from './config.js';

/** '189,90' -> 189.9; vazio ou invalido -> null. */
function numero(texto) {
  if (!texto) return null;
  const n = parseFloat(String(texto).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function verdadeiro(texto) {
  return ['sim', 's', 'true', '1'].includes(String(texto || '').trim().toLowerCase());
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
  };
}

/** Valida a planilha inteira. Devolve produtos ativos e a lista de erros. */
export function validarLista(linhas) {
  const produtos = [];
  const erros = [];
  const vistos = new Set();

  linhas.forEach((linha, i) => {
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

/** Busca os produtos com cache, cache vencido e backup como quedas sucessivas. */
export async function carregarProdutos(deps = {}) {
  const {
    fetch: buscar = globalThis.fetch,
    storage = globalThis.localStorage,
    agora = () => Date.now(),
    urlPlanilha = URL_PLANILHA,
    backup = [],
  } = deps;

  let cache = null;
  try {
    const bruto = storage.getItem(CHAVE_CACHE);
    if (bruto) cache = JSON.parse(bruto);
  } catch { cache = null; }

  if (cache && Array.isArray(cache.produtos) && agora() - cache.quando < CACHE_MS) {
    return cache.produtos;
  }

  try {
    const resposta = await buscar(urlPlanilha);
    if (!resposta.ok) throw new Error('resposta ' + resposta.status);
    const { produtos } = validarLista(parseCSV(await resposta.text()));
    if (!produtos.length) throw new Error('planilha vazia');
    try {
      storage.setItem(CHAVE_CACHE, JSON.stringify({ quando: agora(), produtos }));
    } catch { /* cota cheia: seguir sem cache */ }
    return produtos;
  } catch {
    if (cache && Array.isArray(cache.produtos) && cache.produtos.length) {
      return cache.produtos;
    }
    return backup;
  }
}
