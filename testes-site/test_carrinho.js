import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Carrinho } from '../site/js/carrinho.js';

function memoria() {
  const d = {};
  return {
    getItem: (k) => (k in d ? d[k] : null),
    setItem: (k, v) => { d[k] = String(v); },
    removeItem: (k) => { delete d[k]; },
  };
}

const kaiak = { id: 'kaiak', nome: 'Kaiak Aventura', tamanho: '100 ml', precoPor: 110 };
const humor = { id: 'humor', nome: 'Humor Proprio', tamanho: '75 ml', precoPor: 75 };

test('adiciona item e calcula o total', () => {
  const c = new Carrinho(memoria());
  c.adicionar(kaiak);
  assert.equal(c.total(), 110);
});

test('adicionar duas vezes aumenta a quantidade', () => {
  const c = new Carrinho(memoria());
  c.adicionar(kaiak);
  c.adicionar(kaiak);
  assert.equal(c.itens().length, 1);
  assert.equal(c.itens()[0].quantidade, 2);
  assert.equal(c.total(), 220);
});

test('definirQuantidade zero remove o item', () => {
  const c = new Carrinho(memoria());
  c.adicionar(kaiak);
  c.definirQuantidade('kaiak', 0);
  assert.equal(c.itens().length, 0);
});

test('quantidadeTotal soma todas as unidades', () => {
  const c = new Carrinho(memoria());
  c.adicionar(kaiak);
  c.adicionar(kaiak);
  c.adicionar(humor);
  assert.equal(c.quantidadeTotal(), 3);
});

test('o carrinho sobrevive a recriacao usando o mesmo storage', () => {
  const s = memoria();
  new Carrinho(s).adicionar(kaiak);
  assert.equal(new Carrinho(s).total(), 110);
});

test('reconciliar remove produto que saiu do catalogo', () => {
  const c = new Carrinho(memoria());
  c.adicionar(kaiak);
  c.adicionar(humor);
  const avisos = c.reconciliar([humor]);
  assert.equal(c.itens().length, 1);
  assert.equal(avisos.length, 1);
  assert.match(avisos[0], /Kaiak Aventura/);
});

test('reconciliar atualiza preco alterado e avisa', () => {
  const c = new Carrinho(memoria());
  c.adicionar(kaiak);
  const avisos = c.reconciliar([{ ...kaiak, precoPor: 130 }]);
  assert.equal(c.total(), 130);
  assert.match(avisos[0], /pre/i);
});

test('reconciliar sem mudancas nao gera aviso', () => {
  const c = new Carrinho(memoria());
  c.adicionar(kaiak);
  assert.deepEqual(c.reconciliar([kaiak]), []);
});

test('a mensagem lista itens e total', () => {
  const c = new Carrinho(memoria());
  c.adicionar(kaiak);
  c.adicionar(kaiak);
  c.adicionar(humor);
  const m = c.montarMensagem();
  assert.match(m, /2x Kaiak Aventura 100 ml/);
  assert.match(m, /1x Humor Proprio 75 ml/);
  assert.match(m, /Total: R\$ 295,00/);
});

test('o link aponta para o numero configurado e vem codificado', () => {
  const c = new Carrinho(memoria());
  c.adicionar(kaiak);
  const link = c.linkWhatsApp();
  assert.ok(link.startsWith('https://wa.me/5573981139437?text='));
  assert.ok(!link.includes('\n'));
});

test('mensagemLonga acusa quando passa do limite', () => {
  const c = new Carrinho(memoria());
  for (let i = 0; i < 200; i++) {
    c.adicionar({ id: 'p' + i, nome: 'Produto de nome bem comprido ' + i, tamanho: '100 ml', precoPor: 50 });
  }
  assert.equal(c.mensagemLonga(), true);
});

test('carrinho vazio tem total zero e nao quebra a mensagem', () => {
  const c = new Carrinho(memoria());
  assert.equal(c.total(), 0);
  assert.equal(typeof c.montarMensagem(), 'string');
});

test('storage com conteudo corrompido nao derruba o carrinho', () => {
  const s = memoria();
  s.setItem('nossoelo_carrinho_v1', 'isso nao e json');
  assert.equal(new Carrinho(s).itens().length, 0);
});
