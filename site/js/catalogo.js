/** Minusculas e sem acento, para busca tolerante. */
export function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function textoBuscavel(p) {
  return normalizar([p.nome, p.marca, p.categoria, p.tamanho, p.descricao].join(' '));
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
