import { carregarProdutos } from './dados.js';
import { Carrinho, reais } from './carrinho.js';
import { buscar, ordenar } from './catalogo.js';

const $ = (s) => document.querySelector(s);
const carrinho = new Carrinho();

let todos = [];
let marcaAtiva = '';

/** Escapa texto vindo da planilha antes de ir para innerHTML. */
function escapar(texto) {
  return String(texto ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Tira sobras da conversao do Word: hifen ou ponto solto no fim do nome. */
function limparNome(nome) {
  return String(nome || '').replace(/[\s\-–—.,;:]+$/, '').trim();
}

function cartao(p) {
  const el = document.createElement('article');
  el.className = 'produto';

  const nome = escapar(limparNome(p.nome));
  const src = p.imagem ? `img/${encodeURIComponent(p.imagem)}` : 'img/placeholder.webp';
  const selo = p.desconto ? `<span class="selo">-${p.desconto}%</span>` : '';
  const de = p.precoDe && p.precoDe > p.precoPor
    ? `<div class="preco-de">R$ ${reais(p.precoDe)}</div>` : '';

  el.innerHTML = `
    <div class="moldura">
      ${selo}
      <img src="${src}" alt="${nome}" loading="lazy" decoding="async">
    </div>
    <div class="corpo">
      <h3>${nome}</h3>
      ${p.tamanho ? `<p class="tamanho">${escapar(p.tamanho)}</p>` : ''}
      <div class="precos">
        <div>
          ${de}
          <div class="preco-por">R$ ${reais(p.precoPor)}</div>
        </div>
        <button class="somar" type="button" aria-label="Adicionar ${nome} ao pedido">+</button>
      </div>
    </div>`;

  el.querySelector('img').addEventListener('error', (e) => {
    e.target.src = 'img/placeholder.webp';
  });

  // Toque na foto ou no nome deixa o link compartilhavel: ?p=<id> na barra de
  // enderecos, sem navegar e sem mudar nada na tela. E o que permite ao
  // GUIA.md dizer "copie o link da barra de enderecos" para mandar um
  // produto especifico pelo WhatsApp.
  const marcarLink = () => {
    history.replaceState(null, '', `?p=${encodeURIComponent(p.id)}`);
  };
  el.querySelector('img').addEventListener('click', marcarLink);
  el.querySelector('h3').addEventListener('click', marcarLink);

  const botao = el.querySelector('.somar');
  botao.addEventListener('click', () => {
    // Guarda o nome ja limpo: ele vai literal para a mensagem do WhatsApp,
    // onde um hifen solto no fim ("Kaiak -") ficaria visivel para o cliente.
    carrinho.adicionar({ ...p, nome: limparNome(p.nome) });
    atualizarBotaoCarrinho();
    // Confirmacao curta no proprio botao: no celular o carrinho fica longe
    // do polegar e o cliente precisa saber que o toque valeu.
    botao.textContent = '✓';
    botao.classList.add('feito');
    setTimeout(() => {
      botao.textContent = '+';
      botao.classList.remove('feito');
    }, 700);
  });

  return el;
}

// O rotulo de marca vem de cabecalhos do Word e chega sujo ("Eudora H Ready
// 100ml", "Natura VEVE"). Reduzimos ao nome da marca que aparece dentro dele.
const MARCAS = ['Natura', 'O Boticário', 'Avon', 'Eudora', 'Lattafa'];

function marcaLimpa(rotulo) {
  const plano = String(rotulo || '').normalize('NFD')
    .replace(/[̀-ͯ]/g, '').toLowerCase();
  for (const marca of MARCAS) {
    const chave = marca.replace(/^o /i, '').normalize('NFD')
      .replace(/[̀-ͯ]/g, '').toLowerCase();
    if (plano.includes(chave)) return marca;
  }
  return '';
}

function montarChips() {
  const marcas = [...new Set(todos.map((p) => marcaLimpa(p.marca)).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const nav = $('#chips');
  nav.replaceChildren();

  for (const [valor, rotulo] of [['', 'Tudo'], ...marcas.map((m) => [m, m])]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = rotulo;
    b.setAttribute('aria-pressed', String(valor === marcaAtiva));
    b.addEventListener('click', () => {
      marcaAtiva = valor;
      for (const outro of nav.children) outro.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-pressed', 'true');
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    nav.appendChild(b);
  }
}

function render() {
  const visiveis = marcaAtiva
    ? todos.filter((p) => marcaLimpa(p.marca) === marcaAtiva)
    : todos;

  const lista = ordenar(buscar(visiveis, $('#busca').value), $('#ordem').value)
    // Produto com foto vem primeiro. Array.sort e estavel, entao a ordem
    // escolhida pelo cliente e preservada dentro de cada grupo. Sem isto a
    // primeira tela do celular enche de quadro cinza e o catalogo parece vazio.
    .sort((a, b) => (a.imagem ? 0 : 1) - (b.imagem ? 0 : 1))
    // Produto em destaque vem antes de tudo. Por ser a ultima ordenacao (e o
    // sort continuar estavel), o agrupamento por foto e a ordem escolhida pelo
    // cliente ficam preservados dentro de cada grupo de destaque.
    .sort((a, b) => (a.destaque ? 0 : 1) - (b.destaque ? 0 : 1));

  $('#grade').replaceChildren(...lista.map(cartao));
  $('#vazio').hidden = lista.length > 0;
  $('#contador').textContent = lista.length === 1
    ? '1 produto' : `${lista.length} produtos`;
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
    const nome = escapar([limparNome(item.nome), item.tamanho].filter(Boolean).join(' '));
    li.innerHTML = `
      <span class="nome">${nome}</span>
      <input type="number" min="0" inputmode="numeric" value="${item.quantidade}"
             aria-label="Quantidade de ${nome}">
      <span class="valor">R$ ${reais(item.precoPor * item.quantidade)}</span>
      <button class="tirar" type="button" aria-label="Remover ${nome}">&times;</button>`;

    li.querySelector('input').addEventListener('change', (e) => {
      carrinho.definirQuantidade(item.id, parseInt(e.target.value, 10) || 0);
      renderCarrinho();
      atualizarBotaoCarrinho();
    });
    li.querySelector('.tirar').addEventListener('click', () => {
      carrinho.remover(item.id);
      renderCarrinho();
      atualizarBotaoCarrinho();
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
  // Se carregarProdutos devolveu exatamente o array de backup que passamos
  // (mesma referencia), e porque cache e rede falharam e ele caiu no
  // congelado embutido no site. Isso pode durar semanas sem que ninguem
  // perceba se a planilha estiver quebrada; avisar na tela e a unica rede
  // de seguranca.
  if (todos === backup) {
    avisos.push('Preços podem estar desatualizados. Confirme pelo WhatsApp antes de fechar o pedido.');
  }
  if (avisos.length) {
    $('#avisos').hidden = false;
    $('#avisos').textContent = avisos.join(' ');
  }

  montarChips();

  $('#busca').addEventListener('input', render);
  $('#ordem').addEventListener('change', render);

  $('#abrir-carrinho').addEventListener('click', () => {
    renderCarrinho();
    $('#painel-carrinho').showModal();
  });
  $('#fechar-painel').addEventListener('click', () => $('#painel-carrinho').close());

  const alvo = new URLSearchParams(location.search).get('p');
  if (alvo) {
    const p = todos.find((x) => x.id === alvo);
    if (p) $('#busca').value = limparNome(p.nome);
  }

  render();
  atualizarBotaoCarrinho();
}

iniciar();
