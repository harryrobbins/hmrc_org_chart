import { spawn } from 'child_process';
import { chromium } from 'playwright';

async function run() {
  console.log('Launching Windows Chrome with remote debugging port 9222...');
  
  // Launch Chrome on Windows with Windows-compatible user data directory
  const chromeProcess = spawn('/mnt/c/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--user-data-dir=C:\\chrome-temp-profile'
  ], {
    detached: true,
    stdio: 'ignore'
  });
  chromeProcess.unref();

  // Wait for Chrome to start up
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('Connecting to Chrome over CDP...');
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  
  const context = browser.contexts()[0] || await browser.newContext();
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 850 });
  
  console.log('Navigating to http://localhost:5173/...');
  await page.goto('http://localhost:5173/');
  
  console.log('Waiting for content to load...');
  await page.waitForTimeout(4000);

  console.log('Clicking on a treemap cell to open the Sidebar Drawer...');
  // Wait for treemap rects and click the second one (usually has a visible child post)
  await page.waitForSelector('.treemap-node-rect');
  const cells = page.locator('.treemap-node-rect');
  const count = await cells.count();
  console.log(`Found ${count} treemap cells.`);
  if (count > 1) {
    await cells.nth(1).click();
  } else if (count > 0) {
    await cells.first().click();
  }
  
  console.log('Waiting for the Sidebar Drawer and Backdrop to fade in...');
  await page.waitForTimeout(2000);
  
  console.log('Taking screenshot of the open Sidebar Drawer modal...');
  await page.screenshot({ path: 'screenshot.png' });
  
  console.log('Closing browser connection...');
  await browser.close();
  
  console.log('Screenshot saved successfully to screenshot.png');
  process.exit(0);
}

run().catch(err => {
  console.error('Error running screenshot:', err);
  process.exit(1);
});
