import { describe, expect, it } from 'vitest';
import { assetUrl } from '../web-showcase/src/manifest';
describe('rendered media path boundary', () => {
  it('rejects Windows encoded-separator traversal and other directory escapes', () => {
    const base = new URL('http://127.0.0.1:5180/ene/');
    for (const url of ['folder%5c..%5c..%5csrc%5cplayer.css', 'folder%255c..%255csrc', 'folder\\..\\src', '../src/player.css', '/src/player.css', 'https://example.com/a.webm', '//example.com/a.webp', 'a%2f..%2fsrc', 'a%ZZ.webp']) {
      expect(() => assetUrl(base, { url }), url).toThrow();
    }
    expect(assetUrl(base, { url: 'desk-normal/small.webp' })).toBe('http://127.0.0.1:5180/ene/desk-normal/small.webp');
    expect(assetUrl(new URL('https://media.example.com/personal/ene/'), { url: 'home-greeting/large-poster.png' })).toBe('https://media.example.com/personal/ene/home-greeting/large-poster.png');
  });
});
