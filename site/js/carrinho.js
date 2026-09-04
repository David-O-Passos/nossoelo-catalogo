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
      tamanho: produto.tamanho || '', precoPor: produto.precoPor,
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
        avisos.push(`${item.nome} saiu do catalogo e foi retirado do seu pedido.`);
        continue;
      }
      if (atual.precoPor !== item.precoPor) {
        avisos.push(`O preco de ${item.nome} mudou para R$ ${reais(atual.precoPor)}.`);
        item.precoPor = atual.precoPor;
      }
      mantidos.push(item);
    }

    this._itens = mantidos;
    this._gravar();
    return avisos;
  }

  montarMensagem() {
    if (!this._itens.length) return 'Ola! Gostaria de fazer um pedido.';
    const linhas = this._itens.map((i) => {
      const nome = [i.nome, i.tamanho].filter(Boolean).join(' ');
      return `${i.quantidade}x ${nome} — R$ ${reais(i.precoPor * i.quantidade)}`;
    });
    return `Ola! Quero fazer um pedido:\n\n${linhas.join('\n')}\n\nTotal: R$ ${reais(this.total())}`;
  }

  mensagemLonga() {
    return encodeURIComponent(this.montarMensagem()).length > LIMITE_MENSAGEM;
  }

  linkWhatsApp() {
    return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(this.montarMensagem())}`;
  }
}
