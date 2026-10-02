import { createRequire } from 'node:module';
import { mkdir, copyFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const require = createRequire(import.meta.url);
const { AR } = require('js-aruco2') as { AR: { Dictionary: new (name: string) => { generateSVG(id: number): string } } };
const svg = new AR.Dictionary('ARUCO_MIP_36h12').generateSVG(100);
await mkdir('public/markers', { recursive: true });
await mkdir('assets/markers', { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 840, height: 840 } });
  await page.setContent(`<style>body{margin:0;background:white}main{padding:20px;width:840px;height:840px;box-sizing:border-box}svg{width:800px;height:800px;display:block}@media print{@page{size:A4;margin:5mm}main{width:200mm;height:200mm;padding:0}svg{width:200mm;height:200mm}}</style><main>${svg}</main>`);
  await page.locator('svg').evaluate(node => node.setAttribute('viewBox', '1 1 8 8'));
  await page.screenshot({ path: 'public/markers/marker.png' });
  await page.pdf({ path: 'public/markers/marker-print.pdf', printBackground: true, preferCSSPageSize: true });
  await copyFile('public/markers/marker.png', 'assets/markers/marker.png');
  await copyFile('public/markers/marker-print.pdf', 'assets/markers/marker-print.pdf');
} finally { await browser.close(); }
console.log('Generated marker ID 100 (ARUCO_MIP_36h12), black square 200 mm in PDF.');
