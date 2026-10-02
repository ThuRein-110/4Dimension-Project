import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const require = createRequire(import.meta.url);
const { AR } = require('js-aruco2') as { AR: { Dictionary: new (name: string) => { generateSVG(id: number): string } } };
const svg = new AR.Dictionary('ARUCO_MIP_36h12').generateSVG(101);
await mkdir('public/markers', { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 840, height: 840 } });
  await page.setContent(`<style>body{margin:0;background:white}main{padding:20px;width:840px;height:840px;box-sizing:border-box}svg{width:800px;height:800px;display:block}p{display:none}@media print{@page{size:A4;margin:20mm}main{width:44mm;height:44mm;padding:2mm}svg{width:40mm;height:40mm}p{display:block;font:12pt Arial;margin-top:10mm}}</style><main>${svg}</main><p>4D Cube Lab / Cube 01 / ArUco MIP 36h12 ID 101<br>Black outer square: 40 mm. Print at 100% / Actual size.<br>Measure the black square, not the white margin.</p>`);
  await page.locator('svg').evaluate(node => node.setAttribute('viewBox', '1 1 8 8'));
  await page.screenshot({ path: 'public/markers/cube-marker.png' });
  await page.pdf({ path: 'public/markers/cube-marker-print.pdf', printBackground: true, preferCSSPageSize: true });
} finally { await browser.close(); }
console.log('Generated Cube 01: ID 101; PDF black square 40 mm at Actual size.');
