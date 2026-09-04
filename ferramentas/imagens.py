"""Extrai as imagens do .docx e converte para WebP."""
import io
import os
import zipfile
from PIL import Image

EXTENSOES_IGNORADAS = {'.wdp', '.emf', '.wmf'}


def converter_webp(dados, destino, lado_max=800, qualidade=82):
    """Grava os bytes recebidos como WebP redimensionado. False se falhar."""
    try:
        img = Image.open(io.BytesIO(dados))
        img.load()
    except Exception:
        return False

    # PNG de paleta guarda a transparencia em info['transparency'], nao numa
    # banda alfa: getbands() devolve ('P',) e um teste por 'A' nao a enxerga.
    # Converter esse caso para RGB pinta de preto o fundo recortado do produto.
    tem_alfa = img.mode in ('RGBA', 'LA', 'PA') or 'transparency' in img.info
    if tem_alfa:
        img = img.convert('RGBA')
    elif img.mode != 'RGB':
        img = img.convert('RGB')

    maior = max(img.size)
    if maior > lado_max:
        escala = lado_max / maior
        novo = (round(img.width * escala), round(img.height * escala))
        img = img.resize(novo, Image.LANCZOS)

    pasta = os.path.dirname(destino)
    if pasta:
        os.makedirs(pasta, exist_ok=True)
    img.save(destino, 'WEBP', quality=qualidade, method=6)
    return True


def extrair_imagens(caminho_docx, pasta_destino):
    """Converte toda a midia do .docx. Retorna mapa origem -> arquivo gerado."""
    mapa = {}
    with zipfile.ZipFile(caminho_docx) as z:
        for nome in z.namelist():
            if not nome.startswith('word/media/'):
                continue
            base = os.path.basename(nome)
            raiz, ext = os.path.splitext(base)
            if ext.lower() in EXTENSOES_IGNORADAS:
                continue
            saida = os.path.join(pasta_destino, raiz + '.webp')
            if converter_webp(z.read(nome), saida):
                mapa['media/' + base] = raiz + '.webp'
    return mapa
