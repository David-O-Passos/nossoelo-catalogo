/** Minusculas e sem acento, para busca tolerante. */
export function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// O rotulo de marca vem de cabecalhos do Word e chega sujo ("Eudora H Ready
// 100ml", "Natura VEVE"). Reduzimos ao nome da marca que aparece dentro dele.
// "\u00c1rabes" e um guarda-chuva: engloba Lattafa e qualquer outra marca arabe.
export const MARCAS = {
  'Natura': ['natura'],
  'O Botic\u00e1rio': ['boticario'],
  'Avon': ['avon'],
  'Eudora': ['eudora'],
  '\u00c1rabes': ['arabe', 'arabes', 'lattafa'],
  'Ciclo': ['ciclo'],
};

export function marcaLimpa(rotulo) {
  const plano = normalizar(rotulo);
  for (const [marca, chaves] of Object.entries(MARCAS)) {
    if (chaves.some((chave) => plano.includes(chave))) return marca;
  }
  // Marca nova que ainda nao esta no mapa de palavras-chave: em vez de sumir
  // (retornar vazio), mostra o texto original — assim o dono cadastra uma
  // marca nova na planilha e ela ja aparece nos chips sem mexer no codigo.
  return String(rotulo || '').trim();
}

// A coluna "categoria" da planilha tem menu suspenso (validacao de dados
// presa a aba "Categorias" do Sheets, que rejeita valor fora da lista), entao
// o texto ja chega limpo — sem acento/maiuscula bagunçados como a marca.
// Por isso, ao contrario de marcaLimpa, aqui so aparamos espaco: quem decide
// a lista de categorias e a aba "Categorias" da planilha, nao o codigo.
export function categoriaLimpa(rotulo) {
  return String(rotulo || '').trim();
}

function textoBuscavel(p) {
  return normalizar(
    [p.nome, p.marca, marcaLimpa(p.marca), p.categoria, p.tamanho, p.descricao].join(' '),
  );
}

/** Todas as palavras do termo precisam aparecer no produto. */
export function buscar(produtos, termo) {
  const palavras = normalizar(termo).split(/\s+/).filter(Boolean);
  if (!palavras.length) return produtos;
  return produtos.filter((p) => {
    const alvo = textoBuscavel(p);
    return palavras.every((w) => alvo.includes(w));
  });
}

export function filtrar(produtos, { marca = '', categoria = '' } = {}) {
  return produtos.filter((p) => (
    (!marca || p.marca === marca) && (!categoria || p.categoria === categoria)
  ));
}

export function ordenar(produtos, criterio) {
  const copia = [...produtos];
  if (criterio === 'desconto') {
    return copia.sort((a, b) => (b.desconto ?? -1) - (a.desconto ?? -1));
  }
  if (criterio === 'preco-asc') return copia.sort((a, b) => a.precoPor - b.precoPor);
  if (criterio === 'preco-desc') return copia.sort((a, b) => b.precoPor - a.precoPor);
  if (criterio === 'nome') {
    return copia.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }
  return copia;
}

/** Map<valor, quantidade> contando produtos[chave] (ou chave(produto), se
 * for funcao), ignorando valor falso. */
export function contarPor(produtos, chave) {
  const extrair = typeof chave === 'function' ? chave : (p) => p[chave];
  const contagem = new Map();
  for (const p of produtos) {
    const valor = extrair(p);
    if (!valor) continue;
    contagem.set(valor, (contagem.get(valor) || 0) + 1);
  }
  return contagem;
}

/** Map<marca, Map<categoria, produtos[]>>, preservando ordem de aparicao. */
export function agrupar(produtos) {
  const grupos = new Map();
  for (const p of produtos) {
    const marca = p.marca || 'Outros';
    const categoria = p.categoria || 'Diversos';
    if (!grupos.has(marca)) grupos.set(marca, new Map());
    const porCategoria = grupos.get(marca);
    if (!porCategoria.has(categoria)) porCategoria.set(categoria, []);
    porCategoria.get(categoria).push(p);
  }
  return grupos;
}
