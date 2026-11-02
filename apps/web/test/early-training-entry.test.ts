import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { renderLandingDocument } from '../landingPublication.js';

it('keeps an early Play click as training intent and avoids eager promotional image downloads', () => {
  const html = renderLandingDocument(readFileSync(resolve(import.meta.dirname, '../index.html'), 'utf8'), 'tr', '/tr/');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  expect(doc.querySelector('.landing-entry a.landing-button')?.getAttribute('href')).toBe('#play');
  expect(doc.querySelector('picture.landing-hero-art img')?.getAttribute('loading')).toBe('lazy');
  expect(doc.querySelector('link[rel="preload"][as="image"]')).toBeNull();
});
