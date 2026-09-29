#!/usr/bin/env python3
"""Render Sheets clock-first heat LOOK mock · 1080×1920 PNG via Playwright + google-chrome."""
from pathlib import Path
from playwright.sync_api import sync_playwright

DST = Path("/workspace/plates/2026-09-28/sheets-clock-first-heat")
HTML = DST / "sheets-clock-first-heat-mock.html"
OUT = DST / "wardos-sheets-clock-first-heat.png"

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path="/usr/bin/google-chrome",
            headless=True,
            args=["--disable-dev-shm-usage", "--hide-scrollbars"],
        )
        page = browser.new_page(viewport={"width": 1080, "height": 1920}, device_scale_factor=1)
        page.goto(HTML.resolve().as_uri(), wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(600)
        stage = page.query_selector(".stage")
        if stage:
            stage.screenshot(path=str(OUT), type="png")
        else:
            page.screenshot(path=str(OUT), type="png", clip={"x": 0, "y": 0, "width": 1080, "height": 1920})
        browser.close()
    print(f"OK {OUT.name}  {OUT.stat().st_size} bytes")

if __name__ == "__main__":
    main()
