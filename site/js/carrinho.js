import { CHAVE_CARRINHO, LIMITE_MENSAGEM, WHATSAPP } from './config.js';

/** Formata 1234.5 como '1.234,50'. */
export function reais(valor) {
  return valor.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export class Carrinho {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this._itens = this._ler();
  }

  _ler() {
    try {
      const bruto = this.storage.getItem(CHAVE_CARRINHO);
      const dados = bruto ? JSON.parse(bruto) : [];
      return Array.isArray(dados) ? dados : [];
    } catch {
      return [];
    }
  }

  _gravar() {
    try {
      this.storage.setItem(CHAVE_CARRINHO, JSON.stringify(this._itens));
    } catch { /* cota cheia: manter apenas em memoria */ }
  }

  itens() { return this._itens; }

  adicionar(produto, quantidade = 1) {
    const existente = this._itens.find((i) => i.id === produto.id);
    if (existente) existente.quantidade += quantidade;
    else this._itens.push({
      id: produto.id, nome: produto.nome,
      tamanho: produto.tamanho || '', marca: produto.marca || '',
      precoPor: produto.precoPor,
      quantidade,
    });
    this._gravar();
  }

  remover(id) {
    this._itens = this._itens.filter((i) => i.id !== id);
    this._gravar();
  }

  definirQuantidade(id, n) {
    if (n <= 0) return this.remover(id);
    const item = this._itens.find((i) => i.id === id);
    if (item) { item.quantidade = n; this._gravar(); }
  }

  limpar() { this._itens = []; this._gravar(); }

  total() {
    return this._itens.reduce((s, i) => s + i.precoPor * i.quantidade, 0);
  }

  quantidadeTotal() {
    return this._itens.reduce((s, i) => s + i.quantidade, 0);
  }

  /** Compara com o catalogo atual. Remove sumidos, corrige precos, devolve avisos. */
  reconciliar(produtos) {
    const porId = new Map(produtos.map((p) => [p.id, p]));
    const avisos = [];
    const mantidos = [];

    for (const item of this._itens) {
      const atual = porId.get(item.id);
      if (!atual) {
        avisos.push(`${item.nome} saiu do catálogo e foi retirado do seu pedido.`);
        continue;
      }
      if (atual.esgotado) {
        avisos.push(`${item.nome} esgotou e foi retirado do seu pedido.`);
        continue;
      }
      if (atual.precoPor !== item.precoPor) {
        avisos.push(`O preço de ${item.nome} mudou para R$ ${reais(atual.precoPor)}.`);
        item.precoPor = atual.precoPor;
      }
      mantidos.push(item);
    }

    this._itens = mantidos;
    this._gravar();
    return avisos;
  }

  /** Uma linha de item da mensagem, com preco unitario quando ha mais de 1. */
  _linhaItem(i) {
    // A marca entra no nome, nao depois do tamanho: sem ela, "Pós Química"
    // chega ambigua para quem vende a mesma linha em mais de uma marca.
    const nome = [i.nome, i.marca && `(${i.marca})`, i.tamanho].filter(Boolean).join(' ');
    const cada = i.quantidade > 1 ? ` (R$ ${reais(i.precoPor)} cada)` : '';
    return `${i.quantidade}x ${nome} — R$ ${reais(i.precoPor * i.quantidade)}${cada}`;
  }

  montarMensagem() {
    if (!this._itens.length) return 'Olá! Gostaria de fazer um pedido.';
    const linhas = this._itens.map((i) => this._linhaItem(i));
    return `Olá! Quero fazer um pedido:\n\n${linhas.join('\n')}\n\nTotal: R$ ${reais(this.total())}`;
  }

  /** Divide o pedido em varias mensagens quando ele nao cabe numa so, para o
   * cliente poder mandar uma de cada vez pelo WhatsApp sem cortar texto.
   * Empacota gulosamente reservando, em toda parte, espaco para o cabecalho
   * "parte X de N" no seu tamanho maximo possivel e para a linha de Total —
   * assim, quando so a ultima parte realmente leva o Total, ela ja cabe. */
  mensagens() {
    if (!this._itens.length) return ['Olá! Gostaria de fazer um pedido.'];

    const completa = this.montarMensagem();
    if (encodeURIComponent(completa).length <= LIMITE_MENSAGEM) return [completa];

    const linhas = this._itens.map((i) => this._linhaItem(i));
    const totalLinha = `Total: R$ ${reais(this.total())}`;
    // Numero de partes nunca passa do numero de itens (1 por parte, no pior
    // caso); usar isso como X e N do cabecalho durante o empacotamento cobre
    // o tamanho maximo que o cabecalho real vai ter.
    const nMax = linhas.length;
    const cabe = (linhasDaParte) => {
      const cabecalho = `Olá! Quero fazer um pedido (parte ${nMax} de ${nMax}):`;
      const texto = `${cabecalho}\n\n${linhasDaParte.join('\n')}\n\n${totalLinha}`;
      return encodeURIComponent(texto).length <= LIMITE_MENSAGEM;
    };

    const partes = [];
    let atual = [];
    for (const linha of linhas) {
      const tentativa = [...atual, linha];
      if (atual.length && !cabe(tentativa)) {
        partes.push(atual);
        atual = [linha];
      } else {
        atual = tentativa;
      }
    }
    if (atual.length) partes.push(atual);

    return partes.map((linhasDaParte, indice) => {
      const cabecalho = `Olá! Quero fazer um pedido (parte ${indice + 1} de ${partes.length}):`;
      const corpo = linhasDaParte.join('\n');
      const ehUltima = indice === partes.length - 1;
      return ehUltima
        ? `${cabecalho}\n\n${corpo}\n\n${totalLinha}`
        : `${cabecalho}\n\n${corpo}`;
    });
  }

  mensagemLonga() {
    return this.mensagens().length > 1;
  }

  linkWhatsApp() {
    return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(this.montarMensagem())}`;
  }

  /** Um link wa.me por parte de mensagens(), na mesma ordem. */
  linksWhatsApp() {
    return this.mensagens().map((m) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(m)}`);
  }
}
