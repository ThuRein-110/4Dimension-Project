import { createRequire } from 'node:module';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { CUBE_MARKER } from '../packages/cube-lab/src/marker.js';

const require = createRequire(import.meta.url);
const { AR } = require('js-aruco2') as { AR: { Dictionary: new (name: string) => { generateSVG(id: number): string } } };
const svg = new AR.Dictionary(CUBE_MARKER.dictionary).generateSVG(CUBE_MARKER.id);
await mkdir('public/markers', { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
  await page.setContent(`<style>body{margin:0;background:white}svg{width:1000px;height:1000px;display:block;shape-rendering:crispEdges}p{display:none}@media print{@page{size:A4;margin:20mm}svg{width:50mm;height:50mm}p{display:block;font:12pt Arial;margin-top:10mm}}</style>${svg}<p>4D Cube Lab / Cube 01 / ${CUBE_MARKER.dictionary} / ID ${CUBE_MARKER.id}<br>Black outer square: 40 mm. White quiet margin: 5 mm per side.<br>Print at 100% / Actual size; measure the black square, not the white margin.</p>`);
  const standalone = await page.locator('svg').evaluate(node => { node.setAttribute('width', '50mm'); node.setAttribute('height', '50mm'); node.setAttribute('shape-rendering', 'crispEdges'); return node.outerHTML; });
  await writeFile('public/markers/cube-marker-101.svg', standalone, 'utf8');
  await page.screenshot({ path: 'public/markers/cube-marker-101.png' });
  await copyFile('public/markers/cube-marker-101.png', 'public/markers/cube-marker.png');
  await page.pdf({ path: 'public/markers/cube-marker-print.pdf', printBackground: true, preferCSSPageSize: true });
} finally { await browser.close(); }
console.log('Generated Cube 01: ID 101; PDF black square 40 mm at Actual size.');
