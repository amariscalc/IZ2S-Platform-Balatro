#!/usr/bin/env python3
"""Read-only original IZ2S art rasterizer for Balatro Lua's bounded RPC.

Only known repository assets are accepted. Results are compact, line-oriented
JSON containing RGBA4444 app icons and 2-bit source-atlas type images.
Does not write to the repo, console SD, save data, or install applications.
"""
import json
import sys
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[7]
ICONS = {
    "blitbun": "modules/BlitBun/switch/icon.png",
    "book-reader": "modules/BookReader/switch/assets/icon.png",
    "iz-file-deck": "modules/Foldrift/switch/assets/icon.png",
    "iz2s-cheese": "modules/iz2s-cheese/switch/iza/assets/icon.png",
    "izpsx": "modules/IZPSX/switch/icon.png",
    "vacootube": "modules/VacooTube/switch/icon.png",
}
ATLAS = "engines/CivSwitch/launcher/app/assets/focus-type.png"
TYPE_REGIONS = {
    "title": (2, 2, 458, 59),
    "add": (2, 162, 402, 60),
    "browse": (2, 227, 314, 22),
    "packages": (2, 349, 154, 12),
    "empty": (2, 437, 240, 22),
    "ready": (2, 86, 290, 33),
    "library": (2, 332, 123, 12),
    "select": (2, 847, 74, 14),
    "back": (2, 866, 62, 14),
}

def icon_hex(source):
    with Image.open(ROOT / source) as raw:
        if raw.width > 4096 or raw.height > 4096:
            raise ValueError("Icon dimensions out of bounds")
        image = ImageOps.contain(raw.convert("RGBA"), (40, 40),
            method=Image.Resampling.LANCZOS)
    tile = Image.new("RGBA", (40, 40))
    tile.alpha_composite(image, ((40-image.width)//2, (40-image.height)//2))
    data = []
    for r, g, b, a in tile.getdata():
        v = ((r >> 4) << 12) | ((g >> 4) << 8) | ((b >> 4) << 4) | (a >> 4)
        data.append(f"{v:04x}")
    return "".join(data)

def glyph_hex(atlas, rect):
    x, y, w, h = rect
    pixels = list(atlas.crop((x, y, x+w, y+h)).convert("L").getdata())
    # Original atlas stores grayscale coverage, at two bits per pixel.
    stream = []
    for at in range(0, len(pixels), 4):
        four = pixels[at:at+4]
        while len(four) < 4:
            four.append(0)
        n = 0
        for pix in four:
            n = (n << 2) | min(3, (pix * 3 + 127) // 255)
        stream.append(f"{n:02x}")
    return "".join(stream)

def main():
    if len(sys.argv) != 2 or sys.argv[1] not in ("icons", "atlas"):
        raise SystemExit("Usage: python canonical-visual-assets.py icons|atlas")
    output = []
    if sys.argv[1] == "icons":
        for ident, filename in ICONS.items():
            try:
                output.append({"id": ident, "format": "rgba4444",
                    "w":40, "h":40, "data":icon_hex(filename)})
            except (OSError, ValueError) as error:
                print(f"SKIP {ident}: {error}", file=sys.stderr)
    else:
        with Image.open(ROOT / ATLAS) as image:
            if image.size != (768, 1216):
                raise ValueError("Original CivSwitch type atlas dimensions mismatch")
            atlas = image.copy()
        for ident, rect in TYPE_REGIONS.items():
            x,y,w,h = rect
            output.append({"id": "type-"+ident, "format": "alpha2",
                "w":w, "h":h, "data":glyph_hex(atlas,rect)})
    print(json.dumps(output,separators=(",",":")))

if __name__ == "__main__":
    main()
