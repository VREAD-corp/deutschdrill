import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.goto('file://' + new URL('./og.html', import.meta.url).pathname);
await p.screenshot({ path: new URL('../assets/og.png', import.meta.url).pathname });
await b.close();
