import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarProduto, validarLista, carregarProdutos } from '../site/js/dados.js';

const linhaOk = {
  id: 'kaiak-aventura-100-ml', ativo: 'sim', marca: 'Natura',
  categoria: 'Perfumaria', nome: 'Kaiak Aventura', tamanho: '100 ml',
  descricao: 'Floral', preco_de: '189,90', desconto: '42',
  preco_por: '110,00', imagem: 'kaiak.webp', destaque: 'nao',
};

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

test('carregarProdutos busca da rede e grava no cache', async () => {
  const storage = memoria();
  const produtos = await carregarProdutos({
    fetch: async () => ({ ok: true, text: async () => 'id,ativo,nome,preco_por\nx,sim,Kaiak,"110,00"' }),
    storage, agora: () => 1000, urlPlanilha: 'http://p', backup: [],
  });
  assert.equal(produtos.length, 1);
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
  const produtos = await carregarProdutos({
    fetch: async () => { chamou = true; throw new Error('nao deveria'); },
    storage, agora: () => 2000, urlPlanilha: 'http://p', backup: [],
  });
  assert.equal(chamou, false);
  assert.equal(produtos[0].nome, 'DoCache');
});

test('cai para o cache vencido quando a rede falha', async () => {
  const storage = memoria({
    nossoelo_cache_v1: JSON.stringify({
      quando: 0,
      produtos: [{ id: 'c', nome: 'Antigo', ativo: true, precoPor: 5 }],
    }),
  });
  const produtos = await carregarProdutos({
    fetch: async () => { throw new Error('offline'); },
    storage, agora: () => 999999999, urlPlanilha: 'http://p', backup: [],
  });
  assert.equal(produtos[0].nome, 'Antigo');
});

test('cai para o backup quando nao ha rede nem cache', async () => {
  const produtos = await carregarProdutos({
    fetch: async () => { throw new Error('offline'); },
    storage: memoria(), agora: () => 1, urlPlanilha: 'http://p',
    backup: [{ id: 'b', nome: 'Backup', ativo: true, precoPor: 9 }],
  });
  assert.equal(produtos[0].nome, 'Backup');
});
