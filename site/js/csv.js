/** Converte texto CSV em lista de objetos, usando a primeira linha como cabecalho. */
export function parseCSV(texto) {
  if (!texto) return [];
  const limpo = texto.replace(/^﻿/, '');
  const linhas = [];
  let campo = '';
  let linha = [];
  let dentroDeAspas = false;

  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i];
    if (dentroDeAspas) {
      if (c === '"') {
        if (limpo[i + 1] === '"') { campo += '"'; i++; }
        else dentroDeAspas = false;
      } else campo += c;
      continue;
    }
    if (c === '"') { dentroDeAspas = true; continue; }
    if (c === ',') { linha.push(campo); campo = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { linha.push(campo); linhas.push(linha); campo = ''; linha = []; continue; }
    campo += c;
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }

  if (!linhas.length) return [];
  const cabecalho = linhas[0].map((h) => h.trim());
  return linhas.slice(1)
    .filter((l) => l.some((v) => v.trim() !== ''))
    .map((l) => Object.fromEntries(
      cabecalho.map((h, i) => [h, (l[i] ?? '').trim()])));
}
