import unittest, tempfile, os, io, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from PIL import Image
from imagens import converter_webp


def _png(largura, altura):
    buf = io.BytesIO()
    Image.new('RGB', (largura, altura), (200, 100, 50)).save(buf, 'PNG')
    return buf.getvalue()


class TestConverterWebp(unittest.TestCase):

    def setUp(self):
        self.dir = tempfile.mkdtemp()

    def test_gera_arquivo_webp(self):
        destino = os.path.join(self.dir, 'a.webp')
        self.assertTrue(converter_webp(_png(100, 100), destino))
        self.assertTrue(os.path.exists(destino))
        self.assertEqual(Image.open(destino).format, 'WEBP')

    def test_redimensiona_lado_maior_para_800(self):
        destino = os.path.join(self.dir, 'b.webp')
        converter_webp(_png(2000, 1000), destino)
        self.assertEqual(Image.open(destino).size, (800, 400))

    def test_imagem_pequena_nao_e_ampliada(self):
        destino = os.path.join(self.dir, 'c.webp')
        converter_webp(_png(300, 200), destino)
        self.assertEqual(Image.open(destino).size, (300, 200))

    def test_preserva_transparencia(self):
        buf = io.BytesIO()
        Image.new('RGBA', (50, 50), (0, 0, 0, 0)).save(buf, 'PNG')
        destino = os.path.join(self.dir, 'd.webp')
        converter_webp(buf.getvalue(), destino)
        self.assertEqual(Image.open(destino).mode, 'RGBA')

    def test_preserva_transparencia_de_paleta(self):
        # PNG de paleta com transparencia: o recorte do produto nao pode
        # virar fundo preto. getbands() aqui devolve ('P',), sem alfa.
        origem = Image.new('P', (40, 40))
        origem.putpalette([255, 255, 255] + [0, 0, 0] * 255)
        buf = io.BytesIO()
        origem.save(buf, 'PNG', transparency=0)
        destino = os.path.join(self.dir, 'p.webp')
        converter_webp(buf.getvalue(), destino)
        self.assertEqual(Image.open(destino).mode, 'RGBA')

    def test_tons_de_cinza_vira_rgb(self):
        buf = io.BytesIO()
        Image.new('L', (30, 30), 128).save(buf, 'PNG')
        destino = os.path.join(self.dir, 'l.webp')
        converter_webp(buf.getvalue(), destino)
        self.assertEqual(Image.open(destino).mode, 'RGB')

    def test_dados_invalidos_retornam_false(self):
        destino = os.path.join(self.dir, 'e.webp')
        self.assertFalse(converter_webp(b'nao sou imagem', destino))
        self.assertFalse(os.path.exists(destino))


if __name__ == '__main__':
    unittest.main()
