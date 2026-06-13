from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1400, "height": 900})

    # Login
    page.goto("http://localhost:8069/web/login")
    page.wait_for_load_state("domcontentloaded")
    time.sleep(2)
    page.fill('input[name="login"]', 'admin')
    page.fill('input[name="password"]', 'admin')
    page.click('button[type="submit"]')
    page.wait_for_load_state("domcontentloaded")
    time.sleep(3)

    # Screenshot home dulu untuk lihat struktur
    page.screenshot(path="screenshot_home.png")
    print("Home URL:", page.url)

    # Ambil semua teks dari navbar
    nav_texts = page.eval_on_selector_all(
        'nav a, .o_menu_sections a, .o_main_navbar a',
        'els => els.map(e => e.innerText.trim() + " | " + e.className)'
    )
    print("Nav items:", nav_texts[:10])

    browser.close()
