# Decisoes tomadas durante a construcao

Registro cronologico do que foi decidido e por que, incluindo os caminhos que
foram tentados e abandonados. Serve para quem for mexer nisso depois — inclusive
voce mesmo daqui a seis meses — nao repetir uma abordagem que ja foi medida e
reprovada.

O ponto mais importante esta na secao do pareamento foto x produto: duas
abordagens obvias foram implementadas, medidas contra o documento real e
descartadas antes da terceira funcionar.

---


Task 1: fix round 1/5 (1 addressed, 0 open — RE_DE/RE_POR sem word boundary casavam "de" de "verde" e "por" de "vapor"; commits e3ce8f8..11ac676)
Task 1: minor (deferred): parse_preco/_numero sem type hints, apesar da interface documentar str -> dict | None
Task 1: complete (commits 1d7a9b8..11ac676, review clean)
Task 2: pre-review — brief RE_TAMANHO com \b reprovava 2 testes do proprio brief; humano decidiu pelo lookahead (?!(?-i:[a-z])); plano atualizado
Task 2: minor (deferred): RE_TRANSICAO so separa CAPS de minuscula quando adjacentes; "NUMERO 7 doce" cai no fallback e pode sair 'alta' sem separacao real
Task 2: fix round 1/5 (2 addressed, 0 open — teste de regressao para alternancia un|unidades; lookahead estendido para [a-za-u] acentuado; commits 72eb649..6449882)
Task 2: complete (commits 11ac676..6449882, review clean)
Task 3: numeros reais do docx — 867 imagens referenciadas, 921 caixas de texto, 72 paginas (texto caiu de 2032 para 1016 apos remover mc:Fallback, como previsto)
Task 3: descoberta — o .docx tem 1146 arquivos de midia mas so 799 rIds referenciados: ~300 imagens orfas no pacote. Plano da Task 14 ajustado para copiar so as imagens usadas em produtos.csv
Task 3: pre-review — RE_ANCHOR era codigo morto no plano (nunca usado, _geometria usa str.rfind); removido do codigo e do plano
Task 3: minor (deferred): _pagina_ate re-escaneia o XML inteiro por token (O(n*m) sobre 47MB); rodou bem no docx real, otimizar so se for reusado em corpus maior
Task 3: minor (deferred): RE_FALLBACK assume que mc:Fallback nao aninha; mitigado parcialmente ao tolerar atributos
Task 3: fix round 1/5 (2 addressed, 0 open — ancora ja fechada emprestava coordenadas a wp:inline; entidades XML nao decodificadas; commits 927ff98..82857fa)
Task 3: verificacao independente do controlador no docx real — 867 img / 921 txt / 72 pag, 2 img sem coordenada, zero "&amp;" cru. Numeros do relatorio confirmados.
Task 3: complete (commits 6449882..82857fa, review clean)
Task 4: pre-dispatch — plano corrigido: converter_webp perdia transparencia de PNG de paleta (getbands() devolve ('P',), sem 'A'), pintando de preto o fundo recortado. Trocado por checagem de info['transparency']. 2 testes adicionados.
Task 4: numeros reais — 1094 imagens convertidas, 52 .wdp ignoradas, 0 falhas; pasta 12MB contra 72,1MB originais (reducao de 83%)
Task 4: verificacao independente do controlador — modos RGB 968 / RGBA 126, maior lado exatamente 800px. A correcao de transparencia salvou 126 recortes de virar fundo preto.
Task 4: minor (deferred): nome de saida vem do basename sem extensao; imageN.png e imageN.jpg colidiriam em imageN.webp. Nao ocorre neste docx (1094 entradas -> 1094 saidas).
Task 4: fix round 1/5 (2 addressed, 0 open — os.makedirs('') quebrava em destino sem pasta; ResourceWarning nos testes; commits 1f50306..7b20502)
Task 4: complete (commits 82857fa..7b20502, review clean)
Task 5: pre-dispatch — plano da Task 6 corrigido: parear() era chamado com TODAS as caixas de texto, entao um bloco de preco ou cabecealho abaixo de uma foto consumiria a imagem do produto. Agora Task 6 filtra so os nomes de produto antes de parear. pareador.py nao muda.

== DEFEITO DE PLANO LOAD-BEARING (Task 5) — decidido pelo controlador com o usuario dormindo ==
Task 5: o pareamento por coordenada do plano rende 9% (37/411). Causa raiz medida: as coordenadas do .docx sao relativas ao paragrafo ancora (1155 "paragraph" + 1117 "column" contra 11 "page"), com Y de -581025 a +9357278 e 197 valores negativos. Comparar Y entre ancoras diferentes nao tem significado. Erro meu de projeto no spec, nao do implementador.
Task 5: alternativa por ordem documental (bloco de imagens -> bloco de nomes) rende 38-76% mas foi REPROVADA por verificacao visual: no bloco image31-33 acertou (Kaiak Tradicional/Aventura/Aero, confirmado olhando as fotos), mas no bloco image180-185 errou tudo (image180 e AERO e nao Tradicional, image182 e URBE e nao Aventura, image184 e Tradicional e nao Aero). Ordem do documento nao e confiavel.
Task 5: DECISAO — abandonar pareamento geometrico e por ordem. As fotos trazem o nome do produto impresso no frasco, entao a via viavel e legendar as imagens por visao e casar com os nomes por similaridade de texto. Sera testado em piloto antes de aplicar em escala.
Task 5: piloto de visao com 24 imagens — 22/24 alta confianca, 2 marcadas incertas sem chute. Custo medido ~3,2k tokens/imagem. Abordagem aprovada.
Task 5: plano REESCRITO — pareador.py deixa de ser geometrico e passa a casar produto x legenda por Jaccard de palavras. Task 6 reescrita com classificador.py em modulo proprio. Secao de legendagem documentada no plano.
Task 5: 747 imagens em 25 lotes; legendagem em andamento por subagentes com visao.
Task 5: reimplementado (commit c6ca08b) — pareador.py agora casa por legenda; codigo geometrico removido (grep por DISTANCIA_MAXIMA/parear zera). 18 testes no modulo, 62 na suite completa.
Task 5: brief dizia "16 testes" mas o codigo literal do brief tem 18 metodos — deslize numerico meu, sem contradicao entre teste e implementacao.
Task 5: VALIDACAO em dados reais com 450 de 747 legendas — 120 de 381 produtos casados (31%), escores 1.0 nos exatos. Conferido visualmente: image42 e o frasco "beijo de Humor" e image84 e "una Blush", ambos casados corretamente. Abordagem por legenda confirmada.
Task 5: legendas parciais — 424 produto / 23 decorativo / 3 indefinido; 376 alta e 74 baixa confianca.
Rate limit da sessao derrubou os lotes 16-21 as ~11h; retomados apos o reset. Nenhum dado perdido, os lotes sao arquivos independentes.
Task 5: review APROVADA com 1 Important plan-mandated — campo marca ignorado no casamento enquanto VAZIAS descarta nomes de marca, permitindo colisao entre marcas diferentes.
Task 5: fix round 1/5 — adicionado marca_canonica() + marcas_compativeis(). Filtro de igualdade exata seria errado: a marca do lado do produto vem de cabecalho do Word e chega suja ("Natura VEVE" 123x, "Eudora H Ready 100ml"). Canoniza os dois lados e so bloqueia quando ambas sao conhecidas e diferentes. commit 20a5d52, 86 testes.
Task 5: complete (commits d5534b9..20a5d52, review clean apos fix)
Legendagem CONCLUIDA: 25/25 lotes, 747 legendas — 712 produto / 32 decorativo / 3 indefinido; 646 alta e 101 baixa confianca; 662 com marca; 140 multiplos.
Task 6: implementada (commit 3bb3142). Implementador achou e corrigiu sozinho um vazamento: 30 de 381 linhas eram fragmentos de tabela de preco ("- 32%") virando nome de produto, porque parse_preco exige "De:"/"Por:". Regra "ate 2 letras -> outro" + 2 testes.
Task 6: complete (commit 3bb3142) — 351 produtos, 93% com preco.
Task 7: complete (commit 3255b03) — config.js + csv.js, 8 testes JS.
Task 8: complete (commit 0d5e8c7) — dados.js com cache e quedas sucessivas, 11 testes.
Task 8: fix (commit ed1ab34) — cache malformado sem array 'produtos' derrubava o fallback com TypeError fora de try. Achado pelo proprio implementador.
Task 5: fix contencao (commit a3eec1e) — Jaccard penalizava "DEO PARFUM ESSENCIAL OUD FEMININO" x "Essencial Oud". Primeira tentativa com peso 1.0 foi REPROVADA pelo implementador por criar empates e quebrar "melhor par global vence"; peso 0.9 preserva a ordem. 36% -> 41% de fotos. 89 testes Python.
MIGRACAO FECHADA: 351 produtos, 327 com preco (93%), 145 com foto (41%), 310 ativos, conferir.csv com 266 linhas.
Confirmacao independente: kaiak-urbe-100-ml -> image182.webp, e image182 foi verificada visualmente como Kaiak Urbe.
Task 9: complete (commit d89c3a7) — carrinho, 13 testes.
Task 10: complete (commit 93ae2d4) — busca/filtros/ordenacao, 12 testes.
Task 11: complete (commit 25cd61a) — vitrine; 287 produtos e 118 imagens em site/.
Task 11: ACHADO do implementador — produtos.csv escreve preco como float "75.0" mas dados.js espera formato BR "75,00". Ele converteu no script de carga; a raiz (extrair.py escrever em formato BR) segue em aberto.
Task 11: redesign mobile pelo controlador com verificacao visual no navegador. Problemas corrigidos: cabecalho ocupava 530 de 812px antes do primeiro produto (selects empilhados -> chips horizontais); cards com altura desigual (precos alinhados com margin-top auto); paleta creme+terracota trocada por cinza neutro + vinho; botao "Adicionar" de largura total virou botao redondo de 44px; marca suja nos chips canonizada; produtos com foto passam a vir primeiro.
Task 11: defeitos de acabamento corrigidos — nome com hifen sobrando ia literal para a mensagem do WhatsApp ("Kaiak - 25 ml"); saudacao "Ola!" sem acento.
PENDENTE DE DADOS: classificador ainda deixa passar como nome de produto textos tipo "R$ 80,00 cada" e "Beneficios:Hidratacao profunda...". Aparecem na vitrine.
Task 12: complete (commit 8f7a268) — validador, 7 testes, 53 na suite JS.
Task 12: fix — fetch nao rejeita em erro HTTP, entao a pagina de 404 era lida como CSV e o validador INVENTAVA 12 erros. Achado pelo implementador no navegador. Adicionadas duas guardas: resposta.ok e conferencia do cabecalho. Verificado: agora mostra a mensagem amigavel com zero erros inventados.
Task 13: complete (commit 3279863) — enviar-foto.html + functions/api/upload.js. Fluxo GitHub/Cloudflare nao executavel sem conta e token; conversao WebP no navegador verificada (14,5MB -> 25KB).
Fix (commit 31d10e3) — numero() em dados.js aceitava so formato BR, entao "75.0" do produtos.csv virava 750. Preco 10x errado numa loja no ar. Agora le os dois formatos. 5 testes novos.
Fix (commit 2de44bd) — mensagem de erro do upload era excecao crua; trocada por orientacao acionavel.
Docs: GUIA.md (vendedor) e PUBLICAR.md (passos que exigem as contas do David) escritos e commitados.
TASKS 1-13 CONCLUIDAS. Task 14 depende das contas Google/Cloudflare/GitHub do usuario.
