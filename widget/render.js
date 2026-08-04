const { chromium } = require("playwright");
const path = require("path");

const ITEM_SELECTOR = ".mdlw-item-7QZz6e";
const HEADER_SELECTOR = ".mdlw-header-7QZz6e a";
const WIDGET_HEADER = "視聴中 / Currently Watching";

async function getNativeTitle(browser, url, displayTitle) {
    const detailPage = await browser.newPage();

    try {
        await detailPage.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 30000
        });

        const nativeTitle = await detailPage
            .locator('li:has(> b:text-is("Native Title:")) > a')
            .textContent({ timeout: 15000 });

        return nativeTitle.trim();
    } catch (error) {
        console.warn(
            `Could not load the native title for "${displayTitle}"; using the display title instead.`,
            error.message
        );

        return displayTitle;
    } finally {
        await detailPage.close();
    }
}

(async () => {

    const browser = await chromium.launch({
        headless: true
    });

    const page = await browser.newPage({
        deviceScaleFactor: 2,
        viewport: {
            width: 420,
            height: 1000
        }
    });

    await page.goto(
        "file://" + path.join(__dirname, "template.html")
    );

    await page.locator(ITEM_SELECTOR).first().waitFor();

    const dramas = await page.locator(ITEM_SELECTOR).evaluateAll((items) =>
        items.map((item) => {
            const titleLink = item.querySelector(".mdlw-title-7QZz6e a");

            return {
                url: titleLink.href,
                displayTitle: titleLink.textContent.trim()
            };
        })
    );

    const titles = await Promise.all(
        dramas.map(async (drama) => ({
            ...drama,
            nativeTitle: await getNativeTitle(
                browser,
                drama.url,
                drama.displayTitle
            )
        }))
    );

    await page.locator(ITEM_SELECTOR).evaluateAll((items, dramaTitles) => {
        items.forEach((item, index) => {
            const titleContainer = item.querySelector(".mdlw-title-7QZz6e");
            const titleLink = titleContainer.querySelector("a");
            const drama = dramaTitles[index];
            const subtitle = document.createElement("div");

            titleLink.textContent = drama.nativeTitle;
            titleLink.title = drama.nativeTitle;

            subtitle.className = "mdlw-subtitle-7QZz6e";
            subtitle.textContent = drama.displayTitle;
            titleContainer.appendChild(subtitle);
        });
    }, titles);

    const notoFontsLoaded = await page.evaluate(async () => {
        const loadedFaces = await Promise.all([
            document.fonts.load('400 14px "Noto Sans"', "English"),
            document.fonts.load('600 14px "Noto Sans"', "English"),
            document.fonts.load('400 14px "Noto Sans JP"', "日本語"),
            document.fonts.load('600 14px "Noto Sans JP"', "日本語")
        ]);

        return loadedFaces.every((faces) => faces.length > 0);
    });

    if (!notoFontsLoaded) {
        throw new Error("Noto Sans fonts did not load before rendering.");
    }

    await page.locator(HEADER_SELECTOR).evaluate((headerLink, headerText) => {
        headerLink.textContent = headerText;
    }, WIDGET_HEADER);

    const widget = await page.locator("#capture");

    await widget.screenshot({
        path: path.join(__dirname, "..", "output", "watching.png")
    });

    await browser.close();

})();
