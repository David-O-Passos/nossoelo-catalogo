import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarProduto, validarLista, carregarProdutos, linhaVazia,
} from '../site/js/dados.js';

const linhaOk = {
  id: 'kaiak-aventura-100-ml', ativo: 'sim', marca: 'Natura',
  categoria: 'Perfumaria', nome: 'Kaiak Aventura', tamanho: '100 ml',
  descricao: 'Floral', preco_de: '189,90', desconto: '42',
  preco_por: '110,00', imagem: 'kaiak.webp', destaque: 'nao',
};

const CSV_UM_PRODUTO = 'id,ativo,nome,preco_por\nx,sim,Kaiak,"110,00"';

function memoria(inicial = {}) {
  const dados = { ...inicial };
  return {
    getItem: (k) => (k in dados ? dados[k] : null),
    setItem: (k, v) => { dados[k] = String(v); },
    removeItem: (k) => { delete dados[k]; },
  };
}

test('normaliza precos no formato brasileiro', () => {
  const p = normalizarProduto(linhaOk);
  assert.equal(p.precoDe, 189.9);
  assert.equal(p.precoPor, 110);
  assert.equal(p.desconto, 42);
});

test('aceita preco com ponto decimal vindo da migracao', () => {
  assert.equal(normalizarProduto({ ...linhaOk, preco_por: '75.0' }).precoPor, 75);
  assert.equal(normalizarProduto({ ...linhaOk, preco_por: '110.0' }).precoPor, 110);
});

test('aceita preco com duas casas apos o ponto', () => {
  assert.equal(normalizarProduto({ ...linhaOk, preco_por: '75.50' }).precoPor, 75.5);
});

test('ponto com tres digitos continua sendo milhar', () => {
  assert.equal(normalizarProduto({ ...linhaOk, preco_por: '1.299' }).precoPor, 1299);
});

test('formato brasileiro completo continua funcionando', () => {
  assert.equal(normalizarProduto({ ...linhaOk, preco_por: '1.299,90' }).precoPor, 1299.9);
  assert.equal(normalizarProduto({ ...linhaOk, preco_de: '189,90' }).precoDe, 189.9);
});

test('aceita preco formatado como moeda na planilha', () => {
  assert.equal(normalizarProduto({ ...linhaOk, preco_de: 'R$ 169,90' }).precoDe, 169.9);
  assert.equal(normalizarProduto({ ...linhaOk, preco_por: 'R$ 1.299,90' }).precoPor, 1299.9);
});

test('numero inteiro sem separador', () => {
  assert.equal(normalizarProduto({ ...linhaOk, preco_por: '110' }).precoPor, 110);
});

test('linha sem preco_por e invalida', () => {
  assert.equal(normalizarProduto({ ...linhaOk, preco_por: '' }), null);
});

test('linha sem nome e invalida', () => {
  assert.equal(normalizarProduto({ ...linhaOk, nome: '' }), null);
});

test('desconto fora de 0 a 100 vira null sem invalidar o produto', () => {
  const p = normalizarProduto({ ...linhaOk, desconto: '150' });
  assert.equal(p.desconto, null);
  assert.equal(p.nome, 'Kaiak Aventura');
});

test('preco_de ausente vira null sem invalidar o produto', () => {
  const p = normalizarProduto({ ...linhaOk, preco_de: '' });
  assert.equal(p.precoDe, null);
  assert.equal(p.precoPor, 110);
});

test('esgotado e independente de ativo e aceita variacoes de escrita', () => {
  assert.equal(normalizarProduto({ ...linhaOk, esgotado: 'sim' }).esgotado, true);
  assert.equal(normalizarProduto({ ...linhaOk, esgotado: 'nao' }).esgotado, false);
});

test('linha sem coluna esgotado vira false, sem invalidar o produto', () => {
  const p = normalizarProduto(linhaOk);
  assert.equal(p.esgotado, false);
});

test('ativo aceita variacoes de escrita', () => {
  assert.equal(normalizarProduto({ ...linhaOk, ativo: 'SIM' }).ativo, true);
  assert.equal(normalizarProduto({ ...linhaOk, ativo: 'nao' }).ativo, false);
  assert.equal(normalizarProduto({ ...linhaOk, ativo: 'não' }).ativo, false);
});

test('validarLista descarta inativos e reporta duplicados', () => {
  const r = validarLista([
    linhaOk,
    { ...linhaOk, nome: 'Outro' },
    { ...linhaOk, id: 'humor', ativo: 'nao' },
  ]);
  assert.equal(r.produtos.length, 1);
  assert.equal(r.erros.length, 1);
  assert.match(r.erros[0].motivo, /duplicad/i);
});

test('linha so com valores padrao arrastados nao e produto nem erro', () => {
  const vazia = { id: '', ativo: 'sim', nome: '', preco_por: '', destaque: 'não', esgotado: '' };
  assert.equal(linhaVazia(vazia), true);
  const r = validarLista([linhaOk, vazia, vazia]);
  assert.equal(r.produtos.length, 1);
  assert.equal(r.erros.length, 0);
});

test('linha com nome mas sem preco continua sendo erro', () => {
  const r = validarLista([{ ...linhaOk, preco_por: '' }]);
  assert.equal(r.erros.length, 1);
});

test('carregarProdutos busca da rede e grava no cache', async () => {
  const storage = memoria();
  const r = await carregarProdutos({
    fetch: async () => ({ ok: true, text: async () => CSV_UM_PRODUTO }),
    storage, agora: () => 1000, urlPlanilha: 'http://p',
  });
  assert.equal(r.origem, 'rede');
  assert.equal(r.produtos.length, 1);
  assert.ok(storage.getItem('nossoelo_cache_v1'));
});

test('usa o cache quando ainda esta dentro da validade', async () => {
  const storage = memoria({
    nossoelo_cache_v1: JSON.stringify({
      quando: 1000,
      produtos: [{ id: 'c', nome: 'DoCache', ativo: true, precoPor: 5 }],
    }),
  });
  let chamou = false;
  const r = await carregarProdutos({
    fetch: async () => { chamou = true; throw new Error('nao deveria'); },
    storage, agora: () => 2000, urlPlanilha: 'http://p',
  });
  assert.equal(chamou, false);
  assert.equal(r.origem, 'cache');
  assert.equal(r.produtos[0].nome, 'DoCache');
});

test('cai para o cache vencido quando a rede falha', async () => {
  const storage = memoria({
    nossoelo_cache_v1: JSON.stringify({
      quando: 0,
      produtos: [{ id: 'c', nome: 'Antigo', ativo: true, precoPor: 5 }],
    }),
  });
  const r = await carregarProdutos({
    fetch: async () => { throw new Error('offline'); },
    storage, agora: () => 999999999, urlPlanilha: 'http://p',
  });
  assert.equal(r.origem, 'cache-vencido');
  assert.equal(r.produtos[0].nome, 'Antigo');
});

test('cai para o backup quando nao ha rede nem cache', async () => {
  const r = await carregarProdutos({
    fetch: async () => { throw new Error('offline'); },
    storage: memoria(), agora: () => 1, urlPlanilha: 'http://p',
    carregarBackup: async () => [{ id: 'b', nome: 'Backup', ativo: true, precoPor: 9 }],
  });
  assert.equal(r.origem, 'backup');
  assert.equal(r.produtos[0].nome, 'Backup');
});

test('backup so e baixado quando a rede falha', async () => {
  let baixou = false;
  await carregarProdutos({
    fetch: async () => ({ ok: true, text: async () => CSV_UM_PRODUTO }),
    storage: memoria(), agora: () => 1, urlPlanilha: 'http://p',
    carregarBackup: async () => { baixou = true; return []; },
  });
  assert.equal(baixou, false);
});

test('sem rede, cache e backup devolve lista vazia com origem nenhum', async () => {
  const r = await carregarProdutos({
    fetch: async () => { throw new Error('offline'); },
    storage: memoria(), agora: () => 1, urlPlanilha: 'http://p',
    carregarBackup: async () => { throw new Error('sem backup'); },
  });
  assert.equal(r.origem, 'nenhum');
  assert.deepEqual(r.produtos, []);
});

test('rede que nao responde desiste no prazo e cai no backup', async () => {
  const r = await carregarProdutos({
    fetch: () => new Promise(() => {}),
    storage: memoria(), agora: () => 1, urlPlanilha: 'http://p', prazoMs: 20,
    carregarBackup: async () => [{ id: 'b', nome: 'Backup', ativo: true, precoPor: 9 }],
  });
  assert.equal(r.origem, 'backup');
});

test('cache malformado nao derruba o carregamento', async () => {
  const storage = memoria({ nossoelo_cache_v1: JSON.stringify({ quando: 0 }) });
  const r = await carregarProdutos({
    fetch: async () => { throw new Error('offline'); },
    storage, agora: () => 1, urlPlanilha: 'http://p',
    carregarBackup: async () => [{ id: 'b', nome: 'Backup', ativo: true, precoPor: 9 }],
  });
  assert.equal(r.produtos[0].nome, 'Backup');
});

test('cache fresco com produtos invalido cai para a rede', async () => {
  const storage = memoria({ nossoelo_cache_v1: JSON.stringify({ quando: 1000, produtos: 'nao e array' }) });
  const r = await carregarProdutos({
    fetch: async () => ({ ok: true, text: async () => CSV_UM_PRODUTO }),
    storage, agora: () => 1000, urlPlanilha: 'http://p',
  });
  assert.equal(r.produtos.length, 1);
  assert.equal(r.produtos[0].nome, 'Kaiak');
});
