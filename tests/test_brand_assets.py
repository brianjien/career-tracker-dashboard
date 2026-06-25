import struct
import unittest
from pathlib import Path


class BrandAssetTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(__file__).resolve().parents[1]

    def png_size(self, relative_path):
        data = (self.root / relative_path).read_bytes()
        self.assertEqual(data[:8], b"\x89PNG\r\n\x1a\n")
        return struct.unpack(">II", data[16:24])

    def test_forward_loop_is_vector_and_has_no_circle_nodes(self):
        svg = (self.root / "public/assets/career-track-mark.svg").read_text()
        self.assertIn('viewBox="120 35 790 470"', svg)
        self.assertIn('fill="#08783F"', svg)
        self.assertNotIn("<circle", svg)
        self.assertNotIn("linearGradient", svg)

    def test_platform_brand_assets_have_expected_dimensions(self):
        self.assertEqual(self.png_size("public/assets/career-track-touch.png"), (180, 180))
        self.assertEqual(self.png_size("public/assets/career-track-social.png"), (1200, 630))

    def test_document_metadata_references_platform_assets(self):
        html = (self.root / "index.html").read_text()
        self.assertIn("/assets/career-track-mark.svg", html)
        self.assertIn("/assets/career-track-touch.png", html)
        self.assertIn("/assets/career-track-social.png", html)


if __name__ == "__main__":
    unittest.main()
