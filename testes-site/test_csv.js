import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV } from '../site/js/csv.js';

test('converte linhas em objetos usando o cabecalho', () => {
  const r = parseCSV('nome,preco\nKaiak,110\nHumor,75');
  assert.deepEqual(r, [
    { nome: 'Kaiak', preco: '110' },
    { nome: 'Humor', preco: '75' },
  ]);
});

test('respeita virgula dentro de aspas', () => {
  const r = parseCSV('nome,descricao\nKaiak,"Citrico, floral"');
  assert.equal(r[0].descricao, 'Citrico, floral');
});

test('respeita quebra de linha dentro de aspas', () => {
  const r = parseCSV('nome,descricao\nKaiak,"linha1\nlinha2"');
  assert.equal(r[0].descricao, 'linha1\nlinha2');
});

test('aspas duplas escapadas viram uma aspa', () => {
  const r = parseCSV('nome\n"Diz ""oi"""');
  assert.equal(r[0].nome, 'Diz "oi"');
});

test('ignora o BOM do Excel', () => {
  const r = parseCSV('﻿nome\nKaiak');
  assert.equal(r[0].nome, 'Kaiak');
});

test('aceita quebra de linha estilo Windows', () => {
  const r = parseCSV('nome\r\nKaiak\r\n');
  assert.equal(r.length, 1);
  assert.equal(r[0].nome, 'Kaiak');
});

test('linha com menos colunas preenche com string vazia', () => {
  const r = parseCSV('a,b,c\n1,2');
  assert.equal(r[0].c, '');
});

test('texto vazio retorna lista vazia', () => {
  assert.deepEqual(parseCSV(''), []);
});
