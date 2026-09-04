import { carregarProdutos } from './dados.js';
import { Carrinho, reais } from './carrinho.js';
import { buscar, filtrar, ordenar } from './catalogo.js';

const $ = (s) => document.querySelector(s);
const carrinho = new Carrinho();
let todos = [];

function preencherSelect(sel, valores) {
  for (const v of [...new Set(valores)].filter(Boolean).sort()) {
    const o = document.createElement('option');
    o.value = v; o.textContent = v;
    sel.appendChild(o);
  }
}

function cartao(p) {
  const el = document.createElement('article');
  el.className = 'produto';
  const selo = p.desconto ? `<span class="selo">${p.desconto}% OFF</span>` : '';
  const de = p.precoDe ? `<div class="preco-de">De R$ ${reais(p.precoDe)}</div>` : '';
  const src = p.imagem ? `img/${p.imagem}` : 'img/placeholder.webp';
  el.innerHTML = `
    <img src="${src}" alt="${p.nome}" loading="lazy"
         onerror="this.src='img/placeholder.webp'">
    <h3>${p.nome}</h3>
    ${p.tamanho ? `<p class="tamanho">${p.tamanho}</p>` : ''}
    ${p.descricao ? `<p class="descricao">${p.descricao}</p>` : ''}
    ${de}
    <div class="preco-por">R$ ${reais(p.precoPor)}${selo}</div>
    <button type="button">Adicionar</button>`;
  el.querySelector('button').addEventListener('click', () => {
    carrinho.adicionar(p);
    atualizarBotaoCarrinho();
  });
  return el;
}

function render() {
  const lista = ordenar(
    filtrar(buscar(todos, $('#busca').value), {
      marca: $('#filtro-marca').value,
      categoria: $('#filtro-categoria').value,
    }),
    $('#ordem').value);

  const grade = $('#grade');
  grade.replaceChildren(...lista.map(cartao));
  $('#vazio').hidden = lista.length > 0;
  $('#contador').textContent = `${lista.length} produto(s)`;
}

function atualizarBotaoCarrinho() {
  const n = carrinho.quantidadeTotal();
  $('#abrir-carrinho').hidden = n === 0;
  $('#carrinho-qtd').textContent = n;
  $('#carrinho-total').textContent = reais(carrinho.total());
}

function renderCarrinho() {
  const ul = $('#lista-carrinho');
  ul.replaceChildren();
  for (const item of carrinho.itens()) {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="nome">${item.nome} ${item.tamanho}</span>
      <input type="number" min="0" value="${item.quantidade}">
      <span>R$ ${reais(item.precoPor * item.quantidade)}</span>
      <button type="button" aria-label="Remover">&times;</button>`;
    li.querySelector('input').addEventListener('change', (e) => {
      carrinho.definirQuantidade(item.id, parseInt(e.target.value, 10) || 0);
      renderCarrinho(); atualizarBotaoCarrinho();
    });
    li.querySelector('button').addEventListener('click', () => {
      carrinho.remover(item.id);
      renderCarrinho(); atualizarBotaoCarrinho();
    });
    ul.appendChild(li);
  }
  $('#total-final').textContent = reais(carrinho.total());
  $('#aviso-longo').hidden = !carrinho.mensagemLonga();
  $('#enviar-whatsapp').href = carrinho.linkWhatsApp();
}

async function iniciar() {
  let backup = [];
  try {
    backup = await (await fetch('produtos-backup.json')).json();
  } catch { backup = []; }

  todos = await carregarProdutos({ backup });

  const avisos = carrinho.reconciliar(todos);
  if (avisos.length) {
    $('#avisos').hidden = false;
    $('#avisos').textContent = avisos.join(' ');
  }

  preencherSelect($('#filtro-marca'), todos.map((p) => p.marca));
  preencherSelect($('#filtro-categoria'), todos.map((p) => p.categoria));

  for (const s of ['#busca', '#filtro-marca', '#filtro-categoria', '#ordem']) {
    $(s).addEventListener('input', render);
  }
  $('#abrir-carrinho').addEventListener('click', () => {
    renderCarrinho(); $('#painel-carrinho').showModal();
  });
  $('#fechar-painel').addEventListener('click', () => $('#painel-carrinho').close());

  const alvo = new URLSearchParams(location.search).get('p');
  if (alvo) {
    const p = todos.find((x) => x.id === alvo);
    if (p) $('#busca').value = p.nome;
  }

  render();
  atualizarBotaoCarrinho();
}

iniciar();
