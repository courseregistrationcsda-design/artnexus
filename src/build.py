#!/usr/bin/env python3
"""ART NEXUS build step.

Reads app.src.html and its referenced assets, then emits a single self-contained
index.html. Amber wordmarks are transparent PNGs; source artwork/portraits are JPEGs.
Every referenced image is optimized and base64-encoded into the IMG map. Missing
assets are reported (the app renders monogram placeholders for them).
"""
import base64
import io
import re
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent  # src/
ROOT = HERE.parent                      # art-nexus/
SRC = HERE / "app.src.html"
OUT = ROOT / "index.html"
ASSETS = ROOT / "assets"
MAX_DIM = 900
JPEG_QUALITY = 80
def optimize_and_encode(path: Path) -> str:
    buf = io.BytesIO()
    if path.suffix.lower() == ".png":
        im = Image.open(path).convert("RGBA")
        im.thumbnail((MAX_DIM, MAX_DIM))
        im.save(buf, "PNG", optimize=True)
        mime = "image/png"
    else:
        im = Image.open(path).convert("RGB")
        im.thumbnail((MAX_DIM, MAX_DIM))
        im.save(buf, "JPEG", quality=JPEG_QUALITY, optimize=True)
        mime = "image/jpeg"
    return f"data:{mime};base64," + base64.b64encode(buf.getvalue()).decode("ascii")

def inline_module(html: str, marker: str, module_path: Path) -> str:
    if html.count(marker) != 1:
        raise RuntimeError(f"expected exactly one {marker} placeholder in source")
    module_source = module_path.read_text(encoding="utf-8")
    if re.search(r"^[ \t]*import[ \t]+", module_source, re.M):
        raise RuntimeError(f"standalone app module may not import external modules: {module_path}")
    inline_source = re.sub(r"^[ \t]*export[ \t]+", "", module_source, flags=re.M)
    return html.replace(marker, inline_source, 1)

def main() -> None:
    html = SRC.read_text(encoding="utf-8")
    if "/*__IMAGE_MAP__*/" not in html:
        raise RuntimeError("image map placeholder missing from source")

    html = inline_module(html, "/*__MEDIA_PIPELINE__*/", HERE / "media" / "pipeline.js")
    html = inline_module(html, "/*__STORAGE_NODES__*/", HERE / "app" / "storage_nodes.js")

    referenced = sorted(set(re.findall(r"([a-z0-9._-]+\.(?:jpg|png))", html)))
    present = {p.name for p in ASSETS.glob("*.jpg")} | {p.name for p in ASSETS.glob("*.png")}
    missing = [n for n in referenced if n not in present]

    entries = []
    total = 0
    for name in referenced:
        if name in missing:
            continue
        uri = optimize_and_encode(ASSETS / name)
        total += len(uri)
        entries.append(f"            '{name}': '{uri}'")

    html = html.replace("/*__IMAGE_MAP__*/", ",\n".join(entries), 1)

    if re.search(r"(src|url\()\s*[\"']?assets/", html):
        raise RuntimeError("leftover relative asset refs in output")
    if "IMG[el.dataset.img]" not in html:
        raise RuntimeError("boot loader missing")

    OUT.write_text(html, encoding="utf-8")
    print(f"Built {OUT.name}: {len(entries)} images embedded "
          f"({total/1024:.0f} KB payload), file {OUT.stat().st_size/1024:.0f} KB")
    if missing:
        print("PENDING (monogram placeholders until generated):")
        for n in missing:
            print(f"  - {n}")

if __name__ == "__main__":
    main()
