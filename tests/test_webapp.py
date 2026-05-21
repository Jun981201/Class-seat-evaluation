"""
Webapp testing for Classroom Management Tool.
Tests: page load, element presence, form interactions, API endpoints,
       console errors, visual screenshot capture.
"""
import json, sys, os, time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:5050"
OUTPUT_DIR = Path(__file__).parent / "test_results"
OUTPUT_DIR.mkdir(exist_ok=True)

results = {"pass": 0, "fail": 0, "checks": []}

def check(name, condition, detail=""):
    ok = bool(condition)
    results["checks"].append({"name": name, "pass": ok, "detail": detail})
    if ok: results["pass"] += 1
    else: results["fail"] += 1
    print(f"  {'PASS' if ok else 'FAIL'}: {name}")

def run_tests():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})

        # Collect console messages
        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))

        # ═══════════════════════════════
        # TEST 1: Page Load
        # ═══════════════════════════════
        print("\n─── Test 1: Page Load ───")
        try:
            page.goto(BASE_URL, wait_until="networkidle", timeout=15000)
            check("Page loads successfully (HTTP 200)", True)
        except Exception as e:
            check("Page loads successfully (HTTP 200)", False, str(e))
            browser.close()
            return

        check("Page title is correct",
              page.title() == "课堂管理工具",
              f"title='{page.title()}'")

        # ═══════════════════════════════
        # TEST 2: Header & Layout
        # ═══════════════════════════════
        print("\n─── Test 2: Header & Layout ───")
        check("Header icon (.header-icon) present",
              page.locator(".header-icon").count() == 1)
        check("Header h1 text visible",
              page.locator("header h1").is_visible())
        check("Design tokens (CSS variables) loaded",
              page.locator("body").evaluate(
                  "() => getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() !== ''"),
              "CSS custom properties detected")

        # ═══════════════════════════════
        # TEST 3: Card Structure
        # ═══════════════════════════════
        print("\n─── Test 3: Card Structure ───")
        check("Section A card exists",
              page.locator("#section-a.card").count() == 1)
        check("Section B card exists",
              page.locator("#section-b.card").count() == 1)
        check("Card headers with icons present",
              page.locator(".card-header h2").count() == 2)
        check("Card icon - seating present",
              page.locator(".card-icon.seating").count() == 1)
        check("Card icon - comments present",
              page.locator(".card-icon.comments").count() == 1)

        # ═══════════════════════════════
        # TEST 4: Upload Areas
        # ═══════════════════════════════
        print("\n─── Test 4: Upload Areas ───")
        check("Upload area A exists",
              page.locator("#upload-area-a.upload-area").count() == 1)
        check("Upload area B exists",
              page.locator("#upload-area-b.upload-area").count() == 1)
        check("Upload hint text visible in A",
              page.locator("#upload-area-a .upload-hint").is_visible())
        check("Upload area has file input (hidden)",
              page.locator("#list-file").count() == 1)
        check("File input accepts .xls/.xlsx",
              page.locator("#list-file").get_attribute("accept") == ".xls,.xlsx")

        # ═══════════════════════════════
        # TEST 5: Form Controls (initially hidden)
        # ═══════════════════════════════
        print("\n─── Test 5: Form Controls ───")
        check("Panel A initially hidden",
              page.locator("#panel-a").is_hidden())
        check("Class select exists",
              page.locator("#class-select-a").count() == 1)
        check("Project select exists",
              page.locator("#project-select-a").count() == 1)
        check("School name input exists",
              page.locator("#school-name-a").count() == 1)
        check("Template select exists",
              page.locator("#template-select-a").count() == 1)
        check("Arrange mode select has 3 options",
              page.locator("#arrange-mode-a option").count() == 3)
        arrange_opts = [o.text_content() for o in
                        page.locator("#arrange-mode-a option").all()]
        check("Arrange modes include same_gender",
              "同性别排列" in arrange_opts,
              f"options={arrange_opts}")
        check("Duty checkbox exists and checked by default",
              page.locator("#gen-duty-a").is_checked())

        # ═══════════════════════════════
        # TEST 6: Buttons
        # ═══════════════════════════════
        print("\n─── Test 6: Buttons ───")
        check("Preview seating button exists",
              page.locator("button:has-text('预览座位')").count() == 1)
        check("Download seating button exists",
              page.locator("button:has-text('下载座位表')").count() == 1)
        check("Download evaluation button exists",
              page.locator("button:has-text('下载评价表')").count() == 1)
        check("Download comments button exists",
              page.locator("button:has-text('下载评语Excel')").count() == 1)

        # ═══════════════════════════════
        # TEST 7: API Endpoint - Templates
        # ═══════════════════════════════
        print("\n─── Test 7: API Endpoints ───")
        resp = page.evaluate("""
            async () => {
                const r = await fetch('/api/list-templates');
                return await r.json();
            }
        """)
        check("GET /api/list-templates returns array",
              isinstance(resp, list),
              f"type={type(resp).__name__}, count={len(resp)}")
        check("Templates have id and name fields",
              len(resp) > 0 and "id" in resp[0] and "name" in resp[0],
              f"first item keys={list(resp[0].keys()) if resp else 'empty'}")

        # ═══════════════════════════════
        # TEST 8: Toast Notification System
        # ═══════════════════════════════
        print("\n─── Test 8: Toast System ───")
        check("Toast element exists",
              page.locator("#toast.toast").count() == 1)
        # Trigger toast via JS
        page.evaluate("toast('test message', 'success')")
        page.wait_for_timeout(300)
        check("Toast shows on trigger",
              "show" in page.locator("#toast").get_attribute("class") or "")
        page.wait_for_timeout(2600)
        check("Toast auto-hides after 2.5s",
              "show" not in (page.locator("#toast").get_attribute("class") or ""))

        # ═══════════════════════════════
        # TEST 9: Console Errors
        # ═══════════════════════════════
        print("\n─── Test 9: Console Logs ───")
        errors = [l for l in console_logs if "[error]" in l]
        check("No JavaScript console errors",
              len(errors) == 0,
              f"errors={errors[:5]}")
        for l in errors[:3]:
            print(f"    console error: {l}")

        # ═══════════════════════════════
        # TEST 10: CSS & Visual
        # ═══════════════════════════════
        print("\n─── Test 10: CSS & Visual ───")
        # Check that our new CSS classes are applied
        button_style = page.locator(".btn-primary").first.evaluate(
            "el => getComputedStyle(el).background")
        check("Primary button has gradient background",
              "gradient" in button_style.lower() or "#" in button_style,
              f"bg={button_style[:60]}")

        # Check card has border-radius
        card_radius = page.locator(".card").first.evaluate(
            "el => getComputedStyle(el).borderRadius")
        check("Cards have border-radius",
              card_radius != "0px" and card_radius != "",
              f"radius={card_radius}")

        # Check font family includes Microsoft YaHei
        body_font = page.locator("body").evaluate(
            "el => getComputedStyle(el).fontFamily")
        check("Body uses Microsoft YaHei font stack",
              "Microsoft YaHei" in body_font,
              f"font={body_font[:80]}")

        # ═══════════════════════════════
        # TEST 11: Responsive Viewport
        # ═══════════════════════════════
        print("\n─── Test 11: Responsive Layout ───")
        page.set_viewport_size({"width": 375, "height": 812})
        page.wait_for_timeout(500)
        check("Mobile viewport - container visible",
              page.locator(".container").is_visible())
        check("Mobile viewport - no horizontal overflow",
              page.evaluate(
                  "() => document.body.scrollWidth <= window.innerWidth"),
              f"body={page.evaluate('()=>document.body.scrollWidth')} "
              f"window={page.evaluate('()=>window.innerWidth')}")

        # Reset viewport
        page.set_viewport_size({"width": 1280, "height": 900})

        # ═══════════════════════════════
        # Screenshot
        # ═══════════════════════════════
        print("\n─── Screenshot ───")
        screenshot_path = str(OUTPUT_DIR / "full_page.png")
        page.screenshot(path=screenshot_path, full_page=True)
        check(f"Screenshot saved to {screenshot_path}",
              Path(screenshot_path).exists(),
              f"size={Path(screenshot_path).stat().st_size} bytes")

        browser.close()

    # ═══════════════════════════════
    # Summary
    # ═══════════════════════════════
    total = results["pass"] + results["fail"]
    print(f"\n{'='*50}")
    print(f"  Results: {results['pass']}/{total} passed")
    if results["fail"]:
        print(f"  FAILED checks:")
        for c in results["checks"]:
            if not c["pass"]:
                print(f"    - {c['name']}: {c['detail']}")
    print(f"{'='*50}")

    # Write JSON report
    report_path = OUTPUT_DIR / "report.json"
    results["timestamp"] = time.strftime("%Y-%m-%d %H:%M:%S")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    return results["fail"] == 0

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
