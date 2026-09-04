import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analisar } from '../site/js/validador.js';

const base = {
  id: 'kaiak', ativo: 'sim', marca: 'Natura', categoria: 'Masculino',
  nome: 'Kaiak', tamanho: '100 ml', descricao: '', preco_de: '189,90',
  desconto: '42', preco_por: '110,00', imagem: 'kaiak.webp', destaque: 'nao',
};

test('planilha correta nao gera erro', () => {
  const r = analisar([base], ['kaiak.webp']);
  assert.equal(r.erros.length, 0);
  assert.equal(r.resumo.ativos, 1);
});

test('acusa id duplicado', () => {
  const r = analisar([base, { ...base, nome: 'Outro' }], ['kaiak.webp']);
  assert.match(r.erros[0].motivo, /duplicad/i);
});

test('acusa preco_por ausente', () => {
  const r = analisar([{ ...base, preco_por: '' }], ['kaiak.webp']);
  assert.equal(r.erros.length, 1);
});

test('acusa imagem referenciada que nao existe', () => {
  const r = analisar([base], []);
  assert.ok(r.erros.some((e) => /kaiak\.webp/.test(e.motivo)));
});

test('avisa sobre imagem na pasta que ninguem usa', () => {
  const r = analisar([base], ['kaiak.webp', 'orfa.webp']);
  assert.ok(r.avisos.some((a) => /orfa\.webp/.test(a)));
});

test('avisa sobre desconto invalido sem invalidar a linha', () => {
  const r = analisar([{ ...base, desconto: '150' }], ['kaiak.webp']);
  assert.equal(r.erros.length, 0);
  assert.ok(r.avisos.some((a) => /desconto/i.test(a)));
});

test('conta ativos, inativos e sem imagem', () => {
  const r = analisar([
    base,
    { ...base, id: 'b', ativo: 'nao' },
    { ...base, id: 'c', imagem: '' },
  ], ['kaiak.webp']);
  assert.equal(r.resumo.total, 3);
  assert.equal(r.resumo.ativos, 2);
  assert.equal(r.resumo.inativos, 1);
  assert.equal(r.resumo.semImagem, 1);
});
