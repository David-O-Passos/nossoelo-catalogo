# Publicação — o que só você pode fazer

Todo o código está pronto e testado. O que falta exige as **suas contas**, e por isso não foi feito automaticamente: criar conta, aceitar termos e cadastrar credencial são coisas que você precisa fazer com as próprias mãos.

Tempo estimado: **40 a 60 minutos.**

---

## Antes de começar, confirme

| Item | Onde conferir |
|---|---|
| WhatsApp `5573981139437` | `site/js/config.js` — se o número mudar, é aqui |
| 279 produtos migrados, 191 já no ar | `ferramentas/saida/produtos.csv` |
| 219 linhas para revisar | `ferramentas/saida/conferir.csv` |
| 1.094 fotos convertidas | `ferramentas/saida/img/` |

As 88 linhas com `ativo = nao` são as que o parser não conseguiu ler com segurança. Elas estão na planilha, completas, mas **fora do ar** — nada aparece errado para o cliente enquanto você não revisar. É de propósito: preferimos que você ligue um produto bom a que um cliente veja um ruim.

---

## Passo 1 — Revisar os dados antes de publicar

Abra `ferramentas/saida/conferir.csv`. É a fila de revisão, ordenada pelo que mais importa.

Priorize nesta ordem:

1. **`sem preco`** (23 linhas, todas já `ativo = sim`) — **comece por aqui.** Produto sem preço não aparece no site mesmo estando ativo. Preencha o preço ou marque `ativo = nao`.
2. **`nome incerto`** (55 linhas) — o parser não separou nome e descrição com segurança. Já estão com `ativo = nao`. Conserte o nome e ligue as boas.
3. **`imagem incerta`** (33 linhas) — o casamento foto↔produto ficou abaixo do limite de confiança. Confira se a foto é do produto certo.
4. **`sem imagem`** (173 linhas) — funciona sem foto. Deixe por último e vá preenchendo aos poucos pela página de enviar foto.

> Não tente deixar perfeito agora. O catálogo muda todo mês; parte desses dados já vai ser substituída. O suficiente é ele conseguir assumir daqui pra frente.

---

## Passo 2 — Criar a planilha

1. Crie uma planilha nova no Google Sheets.
2. **Arquivo → Configurações → Local: Brasil.** Isso faz o separador decimal ser vírgula.
3. Importe `ferramentas/saida/produtos.csv`.
4. Copie a coluna inteira `preco_por` (coluna **J**) e cole em uma coluna nova, a **M**, usando **colar somente valores** (Ctrl+Shift+V). Dê a ela o título `preco_original`.

   Essa coluna M guarda o preço que veio migrado do catálogo antigo, usado nas linhas que não têm o par `preco_de`/`desconto` para calcular a partir dele. Sem ela, a fórmula do passo seguinte ficaria se referenciando — e o Google Sheets recusa isso com "Erro de referência circular".
5. Agora, na coluna `preco_por` (**J**), a partir da linha 2, coloque a fórmula e arraste para baixo:

   ```
   =SE(E(H2<>"";I2<>"");ARRED(H2*(1-I2/100);2);M2)
   ```

   `H` é `preco_de`, `I` é `desconto`, `M` é o valor migrado colado no passo anterior. Assim ele mexe só no desconto e o preço final se ajusta, mas cai no valor original para quem não tem desconto cadastrado.
6. **Arquivo → Compartilhar → Publicar na web** → aba `produtos`, formato **CSV** → copie o link.
7. Compartilhe a planilha com ele como **editor**.

> Proteja a linha do cabeçalho (**Dados → Proteger intervalos**). É o jeito mais barato de evitar que um arrastão acidental renomeie uma coluna e derrube o site.

---

## Passo 3 — Apontar o site para a planilha

Em `site/js/config.js`, troque:

```javascript
export const URL_PLANILHA = 'SUBSTITUIR_NA_TASK_14';
```

pelo link CSV que você copiou.

---

## Passo 4 — Levar as fotos e gerar o backup

```bash
python -c "
import csv, os, shutil
usadas = {l['imagem'] for l in csv.DictReader(open('ferramentas/saida/produtos.csv', encoding='utf-8-sig')) if l['imagem']}
os.makedirs('site/img', exist_ok=True)
copiadas = 0
for nome in usadas:
    origem = os.path.join('ferramentas/saida/img', nome)
    if os.path.exists(origem):
        shutil.copy2(origem, os.path.join('site/img', nome)); copiadas += 1
    else:
        print('AUSENTE:', nome)
print(f'{copiadas} fotos copiadas de {len(usadas)} referenciadas')
"
```

Depois gere o índice que a página de conferência usa para achar fotos órfãs:

```bash
node -e "const fs=require('node:fs');fs.writeFileSync('site/img/lista.json',JSON.stringify(fs.readdirSync('site/img').filter(n=>n.endsWith('.webp')&&n!=='placeholder.webp')));console.log('lista.json pronto')"
```

E o backup que mantém o site no ar se o Google cair:

```bash
curl -s "COLE_AQUI_O_LINK_CSV" -o /tmp/p.csv
node -e "Promise.all([import('./site/js/csv.js'),import('./site/js/dados.js'),import('node:fs')]).then(([c,d,fs])=>{const {produtos}=d.validarLista(c.parseCSV(fs.readFileSync('/tmp/p.csv','utf8')));fs.writeFileSync('site/produtos-backup.json',JSON.stringify(produtos));console.log('backup com',produtos.length,'produtos')})"
```

---

## Passo 5 — Publicar no Cloudflare Pages

```bash
gh repo create nossoelo-catalogo --public --source=. --push
```

No painel da Cloudflare: **Workers & Pages → Create → Pages → Connect to Git** → escolha o repositório.

- Build command: **deixe vazio**
- Output directory: **`site`**

Em **Settings → Environment variables**, cadastre:

| Variável | Valor |
|---|---|
| `SENHA_UPLOAD` | uma frase de quatro palavras sem relação entre si (ex.: `cavalo-lampada-verao-porta`), fácil de digitar no celular e difícil de adivinhar |
| `GITHUB_TOKEN` | token fine-grained, permissão **Contents: read and write**, só neste repositório |
| `GITHUB_REPO` | `seu-usuario/nossoelo-catalogo` |
| `GITHUB_BRANCH` | `main` |

> O token do GitHub fica **só** na Cloudflare. Ele nunca chega ao navegador — é exatamente por isso que existe a função `/api/upload` em vez da página falar direto com o GitHub. Não coloque esse token em nenhum arquivo do repositório.
>
> `/api/upload` não tem limite de tentativas (rate limiting). Essa frase-senha é a única coisa que protege o envio de fotos — escolha algo que ninguém adivinhe testando palavras óbvias.

---

## Passo 6 — Conferir no ar

Abra o site publicado **no celular**, no 4G, não no Wi-Fi:

- [ ] Os produtos aparecem com foto e preço
- [ ] Buscar `kaiak` filtra
- [ ] Os chips de marca filtram
- [ ] Adicionar um item faz o botão verde aparecer com o total certo
- [ ] O botão abre o WhatsApp com o pedido escrito e o número certo
- [ ] `/validar.html` acusa zero erros
- [ ] `/enviar-foto.html` sobe uma foto de teste e ela aparece no site em ~1 min
- [ ] Sem service worker registrado (DevTools → Application)

---

## Passo 7 — Entregar

1. Mande o link e peça para ele trocar na bio do Instagram. **É a última vez que ele troca esse link.**
2. Compartilhe a planilha como editor.
3. Passe a senha do envio de foto.
4. Entregue o `GUIA.md` — imprima, ele vai consultar.
5. Grave 5 minutos de tela mostrando, nesta ordem: mudar uma coluna de descontos, marcar esgotado, reativar, cadastrar produto novo com foto, e rodar a conferência.

> O vídeo e o guia não são cortesia, são parte do produto. Sem eles ele te liga a cada dúvida e a venda única vira suporte vitalício — exatamente o que você não quer.

---

## Custo mensal

**R$ 0,00.** Cloudflare Pages, Google Sheets e GitHub, todos no plano gratuito, nenhum deles com pausa por inatividade ou exigência de cartão.
