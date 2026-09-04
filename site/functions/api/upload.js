export async function onRequestPost({ request, env }) {
  const responder = (status, corpo) => new Response(JSON.stringify(corpo), {
    status, headers: { 'content-type': 'application/json' },
  });

  let dados;
  try {
    dados = await request.json();
  } catch {
    return responder(400, { ok: false, erro: 'Envio inválido.' });
  }

  const { senha, nome, conteudoBase64 } = dados;

  if (!env.SENHA_UPLOAD || senha !== env.SENHA_UPLOAD) {
    return responder(401, { ok: false, erro: 'Senha incorreta.' });
  }
  if (!nome || !/^[a-z0-9][a-z0-9\-]{0,60}\.webp$/.test(nome)) {
    return responder(400, {
      ok: false,
      erro: 'Nome inválido. Use apenas letras minúsculas, números e hífen, terminando em .webp',
    });
  }
  if (!conteudoBase64 || conteudoBase64.length > 4_000_000) {
    return responder(400, { ok: false, erro: 'Arquivo ausente ou grande demais.' });
  }

  const caminho = `site/img/${nome}`;
  const base = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${caminho}`;
  const cabecalhos = {
    authorization: `Bearer ${env.GITHUB_TOKEN}`,
    accept: 'application/vnd.github+json',
    'user-agent': 'nossoelo-upload',
    'content-type': 'application/json',
  };
  const branch = env.GITHUB_BRANCH || 'main';

  // Se o arquivo ja existe, o GitHub exige o sha da versao atual para substituir.
  let sha;
  const atual = await fetch(`${base}?ref=${branch}`, { headers: cabecalhos });
  if (atual.ok) sha = (await atual.json()).sha;

  const gravou = await fetch(base, {
    method: 'PUT',
    headers: cabecalhos,
    body: JSON.stringify({
      message: `feat: imagem ${nome}`,
      content: conteudoBase64,
      branch,
      ...(sha ? { sha } : {}),
    }),
  });

  if (!gravou.ok) {
    return responder(502, {
      ok: false,
      erro: 'Não consegui salvar a imagem. Tente de novo em um minuto.',
    });
  }

  return responder(200, { ok: true, arquivo: nome });
}
