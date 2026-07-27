const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

let browser;

// Initialize browser on startup
const initBrowser = async () => {
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });
    console.log('✓ Puppeteer browser initialized');
  } catch (error) {
    console.error('✗ Failed to initialize browser:', error);
    process.exit(1);
  }
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'pc-os-browser-service' });
});

// Render URL to screenshot
app.post('/render', async (req, res) => {
  const { url, width = 1024, height = 768, timeout = 10000 } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  let page;
  try {
    page = await browser.newPage();
    await page.setViewport({ width, height });

    // Navigate to URL with timeout
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout
    });

    // Take screenshot
    const screenshot = await page.screenshot({ encoding: 'base64' });

    res.json({
      success: true,
      url,
      screenshot: `data:image/png;base64,${screenshot}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`Failed to render ${url}:`, error.message);
    res.status(500).json({
      error: 'Failed to render page',
      message: error.message,
      url,
    });
  } finally {
    if (page) {
      await page.close();
    }
  }
});

// Get page HTML content
app.post('/content', async (req, res) => {
  const { url, timeout = 10000 } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  let page;
  try {
    page = await browser.newPage();

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout
    });

    // Extract page content
    const content = await page.evaluate(() => {
      return {
        title: document.title,
        html: document.documentElement.outerHTML,
        text: document.body.innerText,
      };
    });

    res.json({
      success: true,
      url,
      content,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`Failed to get content from ${url}:`, error.message);
    res.status(500).json({
      error: 'Failed to fetch page content',
      message: error.message,
      url,
    });
  } finally {
    if (page) {
      await page.close();
    }
  }
});

// Search and render (basic)
app.post('/search', async (req, res) => {
  const { query, timeout = 10000 } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  try {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    const page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 768 });

    await page.goto(searchUrl, {
      waitUntil: 'networkidle2',
      timeout
    });

    const screenshot = await page.screenshot({ encoding: 'base64' });
    await page.close();

    res.json({
      success: true,
      query,
      screenshot: `data:image/png;base64,${screenshot}`,
      searchUrl,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`Failed to search for "${query}":`, error.message);
    res.status(500).json({
      error: 'Failed to search',
      message: error.message,
      query,
    });
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing browser...');
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});

// Start server
const PORT = process.env.PORT || 8080;
initBrowser().then(() => {
  app.listen(PORT, () => {
    console.log(`🌐 PC OS Browser Service running on port ${PORT}`);
  });
});
