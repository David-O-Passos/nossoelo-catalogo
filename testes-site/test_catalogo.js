import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizar, buscar, filtrar, ordenar, agrupar } from '../site/js/catalogo.js';

const produtos = [
  { id: '1', nome: 'Kaiak Aventura', marca: 'Natura', categoria: 'Masculino', tamanho: '100 ml', descricao: 'Floral aquoso', precoPor: 110, desconto: 42 },
  { id: '2', nome: 'Humor Próprio', marca: 'Natura', categoria: 'Feminino', tamanho: '75 ml', descricao: 'Adocicado', precoPor: 75, desconto: 56 },
  { id: '3', nome: 'Egeo Bomb', marca: 'O Boticário', categoria: 'Feminino', tamanho: '90 ml', descricao: 'Doce', precoPor: 130, desconto: null },
];

test('normalizar remove acento e caixa', () => {
  assert.equal(normalizar('Humor PRÓPRIO'), 'humor proprio');
});

test('busca encontra ignorando acento', () => {
  assert.equal(buscar(produtos, 'proprio')[0].id, '2');
});

test('busca encontra pela marca', () => {
  assert.equal(buscar(produtos, 'boticario').length, 1);
});

test('busca encontra pela descricao', () => {
  assert.equal(buscar(produtos, 'aquoso')[0].id, '1');
});

test('busca com varias palavras exige todas', () => {
  assert.equal(buscar(produtos, 'kaiak floral').length, 1);
  assert.equal(buscar(produtos, 'kaiak doce').length, 0);
});

test('termo vazio devolve tudo', () => {
  assert.equal(buscar(produtos, '').length, 3);
});

test('filtra por marca', () => {
  assert.equal(filtrar(produtos, { marca: 'Natura' }).length, 2);
});

test('filtra por marca e categoria juntas', () => {
  assert.equal(filtrar(produtos, { marca: 'Natura', categoria: 'Feminino' }).length, 1);
});

test('ordena por maior desconto, sem desconto por ultimo', () => {
  const r = ordenar(produtos, 'desconto');
  assert.deepEqual(r.map((p) => p.id), ['2', '1', '3']);
});

test('ordena por preco crescente', () => {
  assert.deepEqual(ordenar(produtos, 'preco-asc').map((p) => p.id), ['2', '1', '3']);
});

test('ordenar nao altera a lista original', () => {
  const copia = [...produtos];
  ordenar(produtos, 'preco-desc');
  assert.deepEqual(produtos, copia);
});

test('agrupa por marca e depois categoria', () => {
  const g = agrupar(produtos);
  assert.deepEqual([...g.keys()], ['Natura', 'O Boticário']);
  assert.equal(g.get('Natura').get('Feminino').length, 1);
});
