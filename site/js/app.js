import { carregarProdutos } from './dados.js';
import { Carrinho, reais } from './carrinho.js';
import {
  buscar, ordenar, marcaLimpa, categoriaLimpa,
} from './catalogo.js';

const $ = (s) => document.querySelector(s);
const carrinho = new Carrinho();

let todos = [];
let marcaAtiva = '';
let categoriaAtiva = '';

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
  el.className = p.esgotado ? 'produto esgotado' : 'produto';

  const nome = escapar(limparNome(p.nome));
  const marca = marcaLimpa(p.marca);
  const src = p.imagem ? `img/${encodeURIComponent(p.imagem)}` : 'img/placeholder.webp';
  const selo = p.desconto ? `<span class="selo">-${p.desconto}%</span>` : '';
  const seloEsgotado = p.esgotado ? '<span class="selo-esgotado">ESGOTADO</span>' : '';
  const de = p.precoDe && p.precoDe > p.precoPor
    ? `<div class="preco-de">R$ ${reais(p.precoDe)}</div>` : '';

  el.innerHTML = `
    <div class="moldura" role="button" tabindex="0" aria-label="Ver detalhes de ${nome}">
      ${selo}
      ${seloEsgotado}
      <img src="${src}" alt="${nome}" loading="lazy" decoding="async">
    </div>
    <div class="corpo">
      <h3>${nome}</h3>
      ${marca ? `<p class="marca-card">${escapar(marca)}</p>` : ''}
      ${p.tamanho ? `<p class="tamanho">${escapar(p.tamanho)}</p>` : ''}
      <div class="precos">
        <div>
          ${de}
          <div class="preco-por">R$ ${reais(p.precoPor)}</div>
        </div>
        <button class="somar" type="button"
                aria-label="${p.esgotado ? 'Produto esgotado' : `Adicionar ${nome} ao pedido`}"
                ${p.esgotado ? 'disabled' : ''}>+</button>
      </div>
    </div>`;

  el.querySelector('img').addEventListener('error', (e) => {
    e.target.src = 'img/placeholder.webp';
  });

  const abrirEsteDetalhe = () => abrirDetalhe(p);
  const moldura = el.querySelector('.moldura');
  moldura.addEventListener('click', abrirEsteDetalhe);
  moldura.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirEsteDetalhe(); }
  });
  const titulo = el.querySelector('h3');
  titulo.addEventListener('click', abrirEsteDetalhe);
  titulo.style.cursor = 'pointer';

  const botao = el.querySelector('.somar');
  botao.addEventListener('click', (e) => {
    e.stopPropagation();
    // Guarda o nome ja limpo: ele vai literal para a mensagem do WhatsApp,
    // onde um hifen solto no fim ("Kaiak -") ficaria visivel para o cliente.
    // A marca tambem vai limpa: e ela que desambigua produtos com o mesmo
    // nome vendidos em mais de uma marca (ex.: "Pós Química" na Natura e na
    // Eudora).
    carrinho.adicionar({ ...p, nome: limparNome(p.nome), marca });
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

/** Clique fora do conteudo (no ::backdrop) e a tecla Esc ja chegam aqui como
 * 'close' nativo do <dialog> — so precisamos travar/destravar a rolagem da
 * pagina de baixo e fechar ao clicar fora, sem depender de um botao "Fechar". */
function prepararDialog(dialog) {
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('sem-rolagem');
  });
}

function abrirDialog(dialog) {
  document.body.classList.add('sem-rolagem');
  dialog.showModal();
}

/** Preenche e abre o dialog de detalhe do produto (clicar para ver a descrição). */
function abrirDetalhe(p) {
  const nome = limparNome(p.nome);
  const marca = marcaLimpa(p.marca);
  const src = p.imagem ? `img/${encodeURIComponent(p.imagem)}` : 'img/placeholder.webp';
  const de = p.precoDe && p.precoDe > p.precoPor
    ? `<div class="preco-de">R$ ${reais(p.precoDe)}</div>` : '';

  $('#detalhe-imagem').src = src;
  $('#detalhe-imagem').alt = escapar(nome);
  $('#detalhe-nome').textContent = nome;
  $('#detalhe-marca').textContent = [marca, p.tamanho].filter(Boolean).join(' · ');
  $('#detalhe-precos').innerHTML = de + '<div class="preco-por">R$ ' + reais(p.precoPor) + '</div>';
  $('#detalhe-descricao').textContent = p.descricao || 'Sem descrição cadastrada.';
  $('#detalhe-esgotado').hidden = !p.esgotado;

  const botao = $('#detalhe-somar');
  botao.disabled = !!p.esgotado;
  botao.onclick = () => {
    carrinho.adicionar({ ...p, nome, marca });
    atualizarBotaoCarrinho();
    $('#detalhe-produto').close();
  };

  abrirDialog($('#detalhe-produto'));
}

/** Monta uma linha de chips (marca ou categoria); aoEscolher recebe o valor clicado. */
function montarChipsGenerico(nav, valores, ativoAtual, aoEscolher) {
  nav.replaceChildren();
  for (const [valor, rotulo] of [['', 'Tudo'], ...valores.map((v) => [v, v])]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = rotulo;
    b.setAttribute('aria-pressed', String(valor === ativoAtual));
    b.addEventListener('click', () => {
      aoEscolher(valor);
      for (const outro of nav.children) outro.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-pressed', 'true');
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    nav.appendChild(b);
  }
}


function montarChips() {
  const marcas = [...new Set(todos.map((p) => marcaLimpa(p.marca)).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  montarChipsGenerico($('#chips'), marcas, marcaAtiva, (v) => { marcaAtiva = v; });

  const categorias = [...new Set(todos.map((p) => categoriaLimpa(p.categoria)).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  montarChipsGenerico($('#chips-categoria'), categorias, categoriaAtiva, (v) => { categoriaAtiva = v; });
}

function render() {
  let visiveis = todos;
  if (marcaAtiva) visiveis = visiveis.filter((p) => marcaLimpa(p.marca) === marcaAtiva);
  if (categoriaAtiva) visiveis = visiveis.filter((p) => categoriaLimpa(p.categoria) === categoriaAtiva);

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
    const nome = escapar(
      [limparNome(item.nome), item.marca && `(${item.marca})`, item.tamanho].filter(Boolean).join(' '),
    );
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

  prepararDialog($('#painel-carrinho'));
  prepararDialog($('#detalhe-produto'));

  $('#abrir-carrinho').addEventListener('click', () => {
    renderCarrinho();
    abrirDialog($('#painel-carrinho'));
  });
  $('#fechar-painel').addEventListener('click', () => $('#painel-carrinho').close());

  render();
  atualizarBotaoCarrinho();
}

iniciar();
