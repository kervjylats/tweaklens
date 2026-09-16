/**
 * Real device presets for the viewport switcher and device wall.
 * Each preset defines CSS-pixel dimensions (not DPR-scaled), a device scale factor,
 * a mobile flag, a User-Agent string, and optional media-feature overrides
 * (hover, pointer, colorScheme) that are applied via Chrome DevTools Protocol
 * Emulation commands.
 */

const DEVICES = {
  'iphone-se': {
    label: '📱 iPhone SE',
    width: 375,
    height: 667,
    dpr: 2,
    mobile: true,
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    media: { hover: 'none', pointer: 'coarse' }
  },
  'iphone-14': {
    label: '📱 iPhone 14/15',
    width: 390,
    height: 844,
    dpr: 3,
    mobile: true,
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    media: { hover: 'none', pointer: 'coarse' }
  },
  'pixel-7': {
    label: '📱 Pixel 7',
    width: 412,
    height: 915,
    dpr: 2.625,
    mobile: true,
    ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.113 Mobile Safari/537.36',
    media: { hover: 'none', pointer: 'coarse' }
  },
  'ipad-classic': {
    label: '📱 iPad (classic)',
    width: 768,
    height: 1024,
    dpr: 2,
    mobile: true,
    ua: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    media: { hover: 'none', pointer: 'coarse' }
  },
  'ipad-10th': {
    label: '📱 iPad 10th',
    width: 820,
    height: 1180,
    dpr: 2,
    mobile: true,
    ua: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    media: { hover: 'none', pointer: 'coarse' }
  },
  'laptop': {
    label: '💻 Laptop',
    width: 1280,
    height: 800,
    dpr: 1,
    mobile: false,
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    media: {}
  },
  'desktop-hd': {
    label: '🖥️ Desktop HD',
    width: 1920,
    height: 1080,
    dpr: 1,
    mobile: false,
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    media: {}
  }
};

export default DEVICES;
