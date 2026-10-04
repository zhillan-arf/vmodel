import { chromium } from '@playwright/test';

// Use the installed browser for Windows acceptance checks.
const channel = process.env.VMODEL_BROWSER;
if (channel) {
  if (!['chrome', 'msedge'].includes(channel)) throw new Error('Unsupported VMODEL_BROWSER value.');
  const launch = chromium.launch.bind(chromium);
  chromium.launch = async options => {
    const browser = await launch({ ...options, channel });
    const newContext = browser.newContext.bind(browser);
    browser.newContext = async options => {
      const context = await newContext(options);
      context.setDefaultNavigationTimeout(120000);
      return context;
    };
    return browser;
  };
}
