import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Carrinho } from '../site/js/carrinho.js';
import { LIMITE_MENSAGEM } from '../site/js/config.js';

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

test('reconciliar retira item que esgotou e avisa', () => {
  const c = new Carrinho(memoria());
  c.adicionar(kaiak);
  c.adicionar(humor);
  const avisos = c.reconciliar([{ ...kaiak, esgotado: true }, humor]);
  assert.deepEqual(c.itens().map((i) => i.id), ['humor']);
  assert.match(avisos[0], /esgotou/);
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

test('a mensagem inclui a marca entre parenteses para desambiguar produtos', () => {
  const c = new Carrinho(memoria());
  c.adicionar({ id: 'pos-quimica-natura', nome: 'Pós Química', tamanho: '250 ml', marca: 'Natura', precoPor: 40 });
  c.adicionar({ id: 'pos-quimica-eudora', nome: 'Pós Química', tamanho: '250 ml', marca: 'Eudora', precoPor: 38 });
  const m = c.montarMensagem();
  assert.match(m, /Pós Química \(Natura\) 250 ml/);
  assert.match(m, /Pós Química \(Eudora\) 250 ml/);
});

test('produto sem marca nao mostra parenteses vazio na mensagem', () => {
  const c = new Carrinho(memoria());
  c.adicionar(kaiak);
  assert.doesNotMatch(c.montarMensagem(), /\(\)/);
});

test('o link aponta para o numero configurado e vem codificado', () => {
  const c = new Carrinho(memoria());
  c.adicionar(kaiak);
  const link = c.linkWhatsApp();
  const prefixo = 'https://wa.me/5573981139437?text=';
  assert.ok(link.startsWith(prefixo));
  const textoCodificado = link.slice(prefixo.length);
  // '!link.includes("\n")' seria verdade mesmo sem nenhuma codificacao real
  // (bastaria a mensagem nunca ter quebra de linha). Aqui confirmamos que a
  // quebra de linha da mensagem foi de fato transformada em %0A e que o
  // texto decodificado volta a ser exatamente a mensagem original.
  assert.ok(textoCodificado.includes('%0A'));
  assert.equal(decodeURIComponent(textoCodificado), c.montarMensagem());
});

test('mensagemLonga acusa quando passa do limite', () => {
  const c = new Carrinho(memoria());
  for (let i = 0; i < 200; i++) {
    c.adicionar({ id: 'p' + i, nome: 'Produto de nome bem comprido ' + i, tamanho: '100 ml', precoPor: 50 });
  }
  assert.equal(c.mensagemLonga(), true);
});

test('a mensagem mostra o preco unitario entre parenteses quando ha mais de 1 unidade', () => {
  const c = new Carrinho(memoria());
  c.adicionar(kaiak, 2);
  const m = c.montarMensagem();
  assert.match(m, /2x Kaiak Aventura 100 ml — R\$ 220,00 \(R\$ 110,00 cada\)/);
});

test('a mensagem nao mostra "cada" quando so tem 1 unidade', () => {
  const c = new Carrinho(memoria());
  c.adicionar(kaiak, 1);
  assert.doesNotMatch(c.montarMensagem(), /cada/);
});

test('mensagens() devolve so a mensagem inteira quando ela cabe no limite', () => {
  const c = new Carrinho(memoria());
  c.adicionar(kaiak);
  assert.deepEqual(c.mensagens(), [c.montarMensagem()]);
});

test('mensagens() quebra pedido grande em varias partes, todas dentro do limite', () => {
  const c = new Carrinho(memoria());
  for (let i = 0; i < 200; i++) {
    c.adicionar({ id: 'p' + i, nome: 'Produto de nome bem comprido numero ' + i, tamanho: '100 ml', precoPor: 50 });
  }
  const partes = c.mensagens();
  assert.ok(partes.length > 1);
  for (const parte of partes) {
    assert.ok(encodeURIComponent(parte).length <= LIMITE_MENSAGEM);
  }
});

test('mensagens() inclui cada item uma unica vez, e o Total so na ultima parte', () => {
  const c = new Carrinho(memoria());
  for (let i = 0; i < 200; i++) {
    c.adicionar({ id: 'p' + i, nome: 'Produto de nome bem comprido numero ' + i, tamanho: '100 ml', precoPor: 50 });
  }
  const partes = c.mensagens();
  for (let i = 0; i < 200; i++) {
    const ocorrencias = partes.filter((p) => p.includes(`Produto de nome bem comprido numero ${i} 100 ml`)).length;
    assert.equal(ocorrencias, 1, `item ${i} deveria aparecer exatamente uma vez`);
  }
  const comTotal = partes.filter((p) => p.includes('Total: R$'));
  assert.deepEqual(comTotal, [partes[partes.length - 1]]);
});

test('linksWhatsApp() devolve um link por parte de mensagens()', () => {
  const c = new Carrinho(memoria());
  for (let i = 0; i < 200; i++) {
    c.adicionar({ id: 'p' + i, nome: 'Produto de nome bem comprido numero ' + i, tamanho: '100 ml', precoPor: 50 });
  }
  const partes = c.mensagens();
  const links = c.linksWhatsApp();
  assert.equal(links.length, partes.length);
  links.forEach((link, i) => {
    assert.ok(link.startsWith('https://wa.me/5573981139437?text='));
    assert.equal(decodeURIComponent(link.split('?text=')[1]), partes[i]);
  });
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
