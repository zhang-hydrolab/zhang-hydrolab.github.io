"""Render the still image under each 3D view, using the views themselves.

A still is what shows before the view starts, in print, and where WebGL is missing. Run this
with the preview server up (npm run dev), after changing a view or its data:

    python frontend/tools/render_stills.py [--base http://127.0.0.1:4173] [names...]

Needs Playwright with Microsoft Edge, and a machine with a GPU.
"""
import argparse
import io
import pathlib

from PIL import Image
from playwright.sync_api import sync_playwright

OUT = pathlib.Path(__file__).resolve().parents[1] / "src" / "public" / "earth"
ARGS = ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu-rasterization"]

# name: (page, selector for the view, size in the page, device scale, wait in ms, webp quality)
VIEWS = {
    "earth": ("/", ".earth", 1200, 900, 2, 700, 74),
    "water": ("/", ".wc", 1200, 800, 1.2, 700, 78),
    "qilian": ("/research.html", ".block", 1200, 800, 2, 700, 80),
    "theme-flow": ("/research.html", "#water-cycle .tv", 1200, 800, 1.3, 900, 80),
    "theme-flood": ("/research.html", "#water-security .tv", 1200, 800, 1.3, 900, 80),
    "theme-scan": ("/research.html", "#water-innovation .tv", 1200, 800, 1.3, 900, 80),
    "etglobe": ("/data.html", ".etg", 1200, 800, 2, 700, 82),
}

# Everything but the picture goes, and the page's background with it, so it sits on any colour.
CLEAN = """
* { visibility: hidden !important; background: transparent !important; animation: none !important; }
canvas { visibility: visible !important; }
"""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://127.0.0.1:4173")
    parser.add_argument("names", nargs="*")
    args = parser.parse_args()

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True, args=ARGS)
        for name in args.names or VIEWS:
            path, selector, width, height, scale, wait, quality = VIEWS[name]
            # With reduced motion a view draws once, at rest, where the live view begins.
            context = browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=scale, reduced_motion="reduce")
            page = context.new_page()
            page.goto(args.base + path, wait_until="load")
            element = page.locator(selector).first
            element.scroll_into_view_if_needed()
            page.wait_for_function(f"document.querySelector('{selector}').classList.contains('is-live')", timeout=20000)
            page.wait_for_timeout(wait)
            page.add_style_tag(content=CLEAN)
            page.wait_for_timeout(300)
            # Research views draw their gauge, storm, satellite and network on a second canvas over
            # the terrain, so the still is taken of the stage that holds both.
            if name.startswith("theme-"):
                box = element.locator(".tv__stage").bounding_box()
                shot = page.screenshot(clip=box, omit_background=True)
            else:
                shot = element.locator("canvas").screenshot(omit_background=True)
            picture = Image.open(io.BytesIO(shot))
            target = OUT / f"{name}-still.webp"
            picture.save(target, "WEBP", quality=quality, alpha_quality=80, method=6)
            print(name, picture.size, f"{target.stat().st_size / 1024:.0f} KB")
            context.close()
        browser.close()


if __name__ == "__main__":
    main()
