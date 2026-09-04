import unittest, tempfile, os, io, sys, shutil
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from PIL import Image
from imagens import converter_webp


def _png(largura, altura):
    buf = io.BytesIO()
    Image.new('RGB', (largura, altura), (200, 100, 50)).save(buf, 'PNG')
    return buf.getvalue()


def _ler(caminho):
    """Abre, mede e fecha — evita ResourceWarning de handle aberto."""
    with Image.open(caminho) as im:
        return {'formato': im.format, 'modo': im.mode, 'tamanho': im.size}


class TestConverterWebp(unittest.TestCase):

    def setUp(self):
        self.dir = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.dir, ignore_errors=True)

    def test_gera_arquivo_webp(self):
        destino = os.path.join(self.dir, 'a.webp')
        self.assertTrue(converter_webp(_png(100, 100), destino))
        self.assertTrue(os.path.exists(destino))
        self.assertEqual(_ler(destino)['formato'], 'WEBP')

    def test_redimensiona_lado_maior_para_800(self):
        destino = os.path.join(self.dir, 'b.webp')
        converter_webp(_png(2000, 1000), destino)
        self.assertEqual(_ler(destino)['tamanho'], (800, 400))

    def test_imagem_pequena_nao_e_ampliada(self):
        destino = os.path.join(self.dir, 'c.webp')
        converter_webp(_png(300, 200), destino)
        self.assertEqual(_ler(destino)['tamanho'], (300, 200))

    def test_preserva_transparencia(self):
        buf = io.BytesIO()
        Image.new('RGBA', (50, 50), (0, 0, 0, 0)).save(buf, 'PNG')
        destino = os.path.join(self.dir, 'd.webp')
        converter_webp(buf.getvalue(), destino)
        self.assertEqual(_ler(destino)['modo'], 'RGBA')

    def test_preserva_transparencia_de_paleta(self):
        # PNG de paleta com transparencia: o recorte do produto nao pode
        # virar fundo preto. getbands() aqui devolve ('P',), sem alfa.
        origem = Image.new('P', (40, 40))
        origem.putpalette([255, 255, 255] + [0, 0, 0] * 255)
        buf = io.BytesIO()
        origem.save(buf, 'PNG', transparency=0)
        destino = os.path.join(self.dir, 'p.webp')
        converter_webp(buf.getvalue(), destino)
        self.assertEqual(_ler(destino)['modo'], 'RGBA')

    def test_tons_de_cinza_vira_rgb(self):
        buf = io.BytesIO()
        Image.new('L', (30, 30), 128).save(buf, 'PNG')
        destino = os.path.join(self.dir, 'l.webp')
        converter_webp(buf.getvalue(), destino)
        self.assertEqual(_ler(destino)['modo'], 'RGB')

    def test_dados_invalidos_retornam_false(self):
        destino = os.path.join(self.dir, 'e.webp')
        self.assertFalse(converter_webp(b'nao sou imagem', destino))
        self.assertFalse(os.path.exists(destino))

    def test_destino_sem_pasta_nao_quebra(self):
        anterior = os.getcwd()
        os.chdir(self.dir)
        try:
            self.assertTrue(converter_webp(_png(50, 50), 'solto.webp'))
            self.assertTrue(os.path.exists('solto.webp'))
        finally:
            os.chdir(anterior)


if __name__ == '__main__':
    unittest.main()
