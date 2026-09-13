# Como atualizar seu catálogo

Guarde esta página. É tudo que você precisa saber.

**O link do seu catálogo nunca muda.** Coloque ele uma vez na bio do Instagram e não mexa mais. Toda alteração que você fizer na planilha aparece no site sozinha, em até 10 minutos.

---

## 1. Mudar preços e descontos

Esta é a tarefa do mês. Leva uns 20 minutos.

1. Abra a planilha.
2. Mexa nas colunas **preço de** (preço cheio, de tabela) e **preço por** (o preço que o cliente vai pagar). Se o Kaiak vai custar R$ 89,90 em vez de R$ 78,20, escreva 89,90 na coluna **preço por**.
3. Pronto. A coluna **desconto** se ajusta sozinha, ela tem uma fórmula que calcula a porcentagem e arredonda para um número inteiro (sem casas decimais).

> **Dica que economiza tempo:** dá para colar uma coluna inteira de uma vez. Se você já tem os preços novos em outro lugar, copie a coluna toda e cole em cima da coluna preço por. Não precisa fazer linha por linha.

> **Por que mudou:** antes você digitava o desconto em % e o preço final saía com centavos quebrados (tipo R$ 45,52). Agora você digita os dois preços redondos que quiser e o % fica por conta da planilha.

---

## 2. Produto esgotou (mas volta em breve)

Escreva **sim** na coluna **esgotado**.

O produto **continua aparecendo** no site, mas com a foto meio apagada e um aviso "ESGOTADO" em cima. O cliente ainda encontra e pode ver a descrição, só não consegue adicionar ao pedido.

Quando o produto voltar ao estoque, escreva **nao** na coluna **esgotado** de novo (ou apague o texto da célula).

---

## 3. Produto saiu de linha (não vai voltar)

Escreva **nao** na coluna **ativo**.

Esse é diferente do esgotado: o produto **some do site inteiro**, como se não existisse. Use isso só quando o produto realmente saiu de linha, não para uma falta de estoque passageira (para isso é o passo 2). Não apague a linha — se um dia ele voltar a ser vendido, é só escrever **sim** de novo e ele volta com tudo preenchido.

Para reativar, escreva **sim** na coluna **ativo**.

---

## 4. Produto novo

São duas partes: mandar a foto, e criar a linha.

### Primeiro, a foto

1. Abra a página de enviar foto: **nossoelo-catalogo.pages.dev/enviar-foto.html**
2. Digite a senha (o celular pode salvar ela, assim você não digita de novo da próxima vez).
3. Toque na área tracejada e escolha a foto do produto. Uma prévia da foto aparece na tela.
4. O nome do arquivo já vem sugerido a partir do nome da foto. Ajuste para algo curto e sem espaço,
   tipo `kaiak-oceano`.
5. Toque em **"Enviar foto"**.
6. Toque em **"Copiar nome"** e cole esse nome na coluna **imagem** da planilha.

> Fotos enviadas de iPhone às vezes ficam com final `.jpg` em vez de `.webp` — isso é normal, só
> cole o nome exatamente como aparece na tela, sem mudar nada.

> Se você já tinha enviado uma foto com esse mesmo nome antes, ela é substituída pela nova.

A foto entra no ar em cerca de 1 minuto. Quer mandar mais de uma foto seguida? É só tocar em
**"Enviar outra foto"** — a senha continua preenchida, não precisa digitar de novo.

### Depois, a linha na planilha

Crie uma linha nova e preencha:

| Coluna | O que escrever | Exemplo |
|---|---|---|
| **id** | um código só seu, sem espaço e sem acento | `kaiak-oceano-100ml` |
| **ativo** | `sim` | `sim` |
| **esgotado** | `nao` (só vira `sim` quando faltar estoque) | `nao` |
| **marca** | escolha no menu suspenso | `Natura` |
| **categoria** | clique na célula e escolha no menu suspenso | `Perfumaria Masculina` |
| **nome** | o nome do produto | `Kaiak Oceano` |
| **tamanho** | o tamanho | `100 ml` |
| **descricao** | notas, benefícios (aparece quando o cliente clica no produto) | `Amadeirado aquoso` |
| **preco_de** | preço de tabela (o preço cheio) | `189,90` |
| **preco_por** | o preço de venda | `110,00` |
| **desconto** | deixe a fórmula fazer | — |
| **imagem** | o nome que você anotou | `kaiak-oceano.webp` |
| **destaque** | `sim` se quiser dar destaque | `nao` |

> **O `id` não pode repetir.** Se dois produtos tiverem o mesmo id, um deles some do site. A página de conferência avisa se isso acontecer.

**Marcas.** A coluna `marca` também tem um menu suspenso — clique na célula e escolha uma opção, não
precisa digitar. A lista vem da aba **Marcas** da planilha, e funciona igual à de categorias:

- **Marca nova:** vá na aba Marcas e escreva o nome numa linha em branco. Ela aparece na hora no menu
  suspenso da coluna marca, em qualquer produto — e passa a valer no site sozinha.
- **Renomear uma marca já usada:** troque o nome na aba Marcas. Os produtos que já usavam o nome
  antigo **não mudam sozinhos** — ficam marcados com um aviso vermelho de "valor inválido". Para
  corrigir todos de uma vez: na aba de produtos, selecione a coluna marca, `Ctrl+H` (Localizar e
  substituir), coloque o nome antigo em "Localizar" e o novo em "Substituir por", restrinja ao
  intervalo da coluna e clique em "Substituir tudo".

**Categorias.** A coluna `categoria` tem um menu suspenso — clique na célula e escolha uma opção, não precisa digitar. A lista de opções vem da aba **Categorias** da planilha:

- **Categoria nova:** vá na aba Categorias e escreva o nome numa linha em branco. Ela aparece na hora no menu suspenso da coluna categoria, em qualquer produto.
- **Renomear uma categoria já usada:** troque o nome na aba Categorias. Os produtos que já usavam o nome antigo **não mudam sozinhos** — ficam marcados com um aviso vermelho de "valor inválido". Para corrigir todos de uma vez: na aba de produtos, selecione a coluna categoria, `Ctrl+H` (Localizar e substituir), coloque o nome antigo em "Localizar" e o novo em "Substituir por", restrinja ao intervalo da coluna e clique em "Substituir tudo".

---

## 5. Cores da planilha

A planilha pinta as linhas e células sozinha, para chamar sua atenção sem você precisar ler tudo:

- **Cinza** — o produto está inativo (coluna ativo = não). Ele some do site.
- **Rosa** — o produto está esgotado. Ele aparece no site, mas sem poder ser adicionado ao pedido.
- **Dourado** — o produto está em destaque.
- **Vermelho numa célula** — falta o preço de venda (preco_por). **O produto não aparece no site**
  enquanto essa célula estiver vazia.
- **Amarelo numa célula** — falta foto, descrição ou tamanho. O produto aparece do mesmo jeito, só
  fica incompleto na página dele.

Nenhuma dessas cores precisa ser mexida por você — elas são só um aviso visual.

---

## 6. Aba Painel

Ao abrir a planilha, a primeira aba é o **Painel**. Ele mostra um resumo rápido, que se atualiza
sozinho conforme você mexe nos produtos:

- **Produtos no ar** — quantos produtos estão realmente aparecendo no site agora.
- **Esgotados**, **Em destaque** — quantos produtos estão em cada situação.
- **Sem foto**, **Sem preço**, **Sem descrição** — quantos produtos ativos ainda estão incompletos
  (o "sem preço" é o mais importante: esse produto some do site até você preencher).
- Duas tabelas mostram quantos produtos ativos existem em cada categoria e em cada marca.

É um jeito rápido de ver, sem precisar rolar a planilha toda, se está faltando preencher alguma
coisa.

---

## 7. Conferir se ficou tudo certo

Antes de divulgar, abra a **página de conferência** e clique em "Conferir agora".

Ela mostra duas listas:

- **Erros** — precisam ser corrigidos. Um produto com erro não aparece no site.
- **Avisos** — pode publicar assim mesmo. Geralmente é produto sem foto.

Se aparecer "Não consegui ler a planilha", a planilha saiu do ar ou parou de estar publicada. Veja o item 9.

---

## 8. Errei alguma coisa, e agora?

Na planilha: **Arquivo → Histórico de versões → Ver histórico de versões**. Escolha uma versão de antes do erro e restaure. Nada se perde.

---

## 9. Perguntas que podem aparecer

**Mudei a planilha e o site não mudou.**
Espere 10 minutos e atualize a página. O site guarda os dados por esse tempo para abrir rápido no 4G do cliente.

**O cliente disse que o preço está errado.**
Ele provavelmente está com a página antiga aberta. Peça para fechar e abrir de novo.

**O preço riscado não aparece.**
Preencha a coluna `preco_de` com um valor maior que o `preco_por`. O preço riscado só aparece quando
há essa diferença.

**Posso apagar uma linha da planilha?**
Pode, mas prefira escrever `nao` na coluna ativo. Assim você não perde o cadastro.

**Posso mudar o nome das colunas?**
Não. O site procura as colunas pelo nome exato. Se você renomear, ele para de encontrar.

**Posso mudar a ordem das colunas?**
Pode. O site vai pelo nome, não pela posição.

---

## O que o cliente vê

Ele abre o link, busca o que quer, vai adicionando no pedido e clica no botão verde. O WhatsApp abre com o pedido já escrito, assim:

```
Olá! Quero fazer um pedido:

2x Kaiak Aventura (Natura) 100 ml — R$ 220,00
1x Humor Próprio (Natura) 75 ml — R$ 75,00

Total: R$ 295,00
```

A marca vem entre parênteses justamente para você não ter dúvida quando dois produtos de marcas diferentes têm nome parecido (ex.: "Pós Química" existe na Natura e na Eudora).

Você recebe tudo organizado, numa mensagem só, com o total já somado.
