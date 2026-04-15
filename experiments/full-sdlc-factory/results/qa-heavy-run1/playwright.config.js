const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: '.',
  testMatch: 'e2e.spec.js',
  use: {
    browserName: 'chromium',
    headless: true,
    screenshot: 'only-on-failure',
  },
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results.json' }]],
});
