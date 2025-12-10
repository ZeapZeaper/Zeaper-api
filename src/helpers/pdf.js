const puppeteer = require("puppeteer");
const path = require("path");
const root = require("../../root");
const fs = require("fs");

const isRender = process.env.RENDER === "true";
function getChromePath() {
  try {
    const chromeRoot = "/opt/render/.cache/puppeteer/chrome";

    // Get version folder (e.g. linux-134.0.6998.165)
    const versions = fs.readdirSync(chromeRoot);
    if (!versions.length) return null;

    const versionDir = versions[0]; // first one
    const chromePath = path.join(
      chromeRoot,
      versionDir,
      "chrome-linux64",
      "chrome"
    );

    return chromePath;
  } catch (err) {
    return null;
  }
}
const executablePath = isRender ? getChromePath() : undefined; // local machine uses its own Chromium
const generatePdf = async (param) => {
  const { type, website_url, usePath, filename } = param;
  console.log("Detected Chrome path:", executablePath);
  console.log("Exists:", fs.existsSync(executablePath));

  // Create a browser instance
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--single-process",
      "--no-zygote",
    ],
  });

  // Create a new page
  const page = await browser.newPage();

  if (type === "url") {
    // Web site URL to export as pdf
    //   const website_url = 'https://www.bannerbear.com/blog/how-to-download-images-from-a-website-using-puppeteer/';

    // Open URL in current page

    await page.goto(website_url, { waitUntil: "networkidle0" });
  } else if (type === "file") {
    //Get HTML content from HTML file

    const html = fs.readFileSync(
      path.join(root + "/templates/index.html"),
      "utf-8"
    );
    await page.setContent(html, { waitUntil: "domcontentloaded" });
  } else {
    console.log(new Error(`HTML source "${type}" is unkown.`));
    await browser.close();
    return;
  }

  // To reflect CSS used for screens instead of print
  await page.emulateMediaType("screen");

  // Downlaod the PDF
  const pdf = await page.pdf({
    // if you want to save the pdf in a file then use path
    ...(usePath && {
      path: `${path.join(root)}/templates/converted/result_${type}.pdf`,
    }),
    margin: { top: "100px", right: "50px", bottom: "100px", left: "50px" },
    printBackground: true,
    format: "A4",
  });

  // Close the browser instance
  await browser.close();
  // return {
  //   pdf,
  //   path : `${path.join(root)}/templates/converted/result_${type}.pdf`
  // }
  return pdf;
};

module.exports = generatePdf;
