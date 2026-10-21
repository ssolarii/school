from playwright.sync_api import expect, sync_playwright


def main():
    errors = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        page.on("pageerror", lambda error: errors.append(f"page error: {error}"))
        page.on("console", lambda message: errors.append(f"console error: {message.text}") if message.type == "error" else None)
        page.goto("http://127.0.0.1:8080/", wait_until="networkidle")

        expect(page.get_by_role("heading", name="Choose a pathway", exact=True)).to_be_visible()
        expect(page.get_by_role("button", name="Open window 2", exact=True)).to_be_visible()

        with page.expect_popup() as popup_info:
            page.get_by_role("button", name="Open window 2", exact=True).click()
        display = popup_info.value
        display.wait_for_load_state("networkidle")
        expect(display.get_by_role("heading", name="Choose a pathway on the touchscreen.")).to_be_visible()
        expect(page.get_by_role("button", name="Open window 2", exact=True)).to_have_count(0)

        for title in ["Science + Tech", "Computer Science", "Engineering & Manufacturing"]:
            page.get_by_role("button", name=title, exact=True).click()
            expect(page.get_by_role("heading", name=title, exact=True)).to_be_visible()
            expect(page.locator("video")).to_have_count(0)
            expect(page.get_by_text("Look at the big screen!", exact=True)).to_be_visible()
            expect(display.get_by_role("heading", name=title, exact=True)).to_be_visible()
            display.wait_for_function("document.querySelector('video')?.currentTime > 1")
            time_before = display.locator("video").evaluate("video => video.currentTime")
            display.wait_for_function("document.querySelector('video')?.currentTime > 2")
            assert display.locator("video").evaluate("video => video.currentTime") > time_before
            assert display.locator("video").evaluate("video => video.videoWidth") == 1280
            assert page.evaluate("document.documentElement.scrollHeight <= innerHeight")
            page.keyboard.press("r")
            display.wait_for_function("document.querySelector('video')?.currentTime < 1")
            page.get_by_role("button", name="Back to pathways", exact=True).click()

        page.get_by_role("button", name="Computer Science", exact=True).click()
        display.reload(wait_until="networkidle")
        expect(display.get_by_role("heading", name="Computer Science", exact=True)).to_be_visible()

        expect(display.get_by_role("button", name="Return to pathways")).to_have_count(0)
        page.get_by_role("button", name="Back to pathways", exact=True).click()
        expect(page.get_by_role("heading", name="Choose a pathway", exact=True)).to_be_visible()
        expect(display.get_by_role("heading", name="Choose a pathway on the touchscreen.")).to_be_visible()

        display.close()
        expect(page.get_by_role("button", name="Open window 2", exact=True)).to_be_visible(timeout=12_000)

        browser.close()
    assert not errors, "\n".join(errors)


if __name__ == "__main__":
    main()
