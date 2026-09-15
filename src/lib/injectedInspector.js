export const INJECTED_INSPECTOR_CODE = `
(function() {
  if (window.__TWEAKLENS_INJECTED__) return;
  window.__TWEAKLENS_INJECTED__ = true;

  // Enable flag — false means inspector is OFF (interactive mode)
  window.__TWEAKLENS_ENABLED__ = false;

  let currentSelected = null;
  let currentSelector = '';

  // Floating highlight box
  const box = document.createElement('div');
  box.id = '__tweaklens_highlight__';
  box.style.cssText = 'position:fixed;pointer-events:none;border:2px solid #6d6dfa;background:rgba(109,109,250,0.18);z-index:9999999;display:none;border-radius:4px;transition:all 0.05s ease';
  document.body.appendChild(box);

  function syncBox(el) {
    if (!el || !window.__TWEAKLENS_ENABLED__) { box.style.display = 'none'; return; }
    const r = el.getBoundingClientRect();
    box.style.display = 'block';
    box.style.top = r.top + 'px';
    box.style.left = r.left + 'px';
    box.style.width = r.width + 'px';
    box.style.height = r.height + 'px';
  }

  function getSelector(el) {
    if (el.id) return '#' + el.id;
    let sel = el.tagName.toLowerCase();
    if (el.className && typeof el.className === 'string') {
      const cls = el.className.trim().split(/\\s+/).slice(0, 2).join('.');
      if (cls) sel += '.' + cls;
    }
    return sel;
  }

  // Hover — only when enabled
  document.addEventListener('mouseover', (e) => {
    if (!window.__TWEAKLENS_ENABLED__) { box.style.display = 'none'; return; }
    if (e.target === box || e.target === document.body) return;
    syncBox(e.target);
  }, true);

  // Click — only when enabled
  document.addEventListener('click', (e) => {
    if (!window.__TWEAKLENS_ENABLED__) return;
    if (e.target === box) return;
    e.preventDefault();
    e.stopPropagation();

    currentSelected = e.target;
    currentSelector = getSelector(currentSelected);
    syncBox(currentSelected);

    // Get bounding rect
    const r = el.getBoundingClientRect();
    const rect = { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) };

    // Computed styles snapshot
    const comp = window.getComputedStyle(el);
    const styles = {
      color: comp.color,
      backgroundColor: comp.backgroundColor,
      fontSize: comp.fontSize,
      fontFamily: comp.fontFamily,
      fontWeight: comp.fontWeight,
      padding: comp.padding,
      margin: comp.margin,
      borderRadius: comp.borderRadius,
      border: comp.border,
      lineHeight: comp.lineHeight,
      letterSpacing: comp.letterSpacing,
      textAlign: comp.textAlign,
      display: comp.display,
      flexDirection: comp.flexDirection,
      gap: comp.gap,
      width: comp.width,
      height: comp.height,
      maxWidth: comp.maxWidth,
      minHeight: comp.minHeight,
      boxShadow: comp.boxShadow,
    };

    // React fiber _debugSource (file:line)
    let source = null;
    const fiberKey = Object.keys(el).find(k => k.startsWith('__reactFiber$'));
    if (fiberKey) {
      let fiber = el[fiberKey];
      for (let i = 0; i < 15 && fiber; i++) {
        if (fiber._debugSource && fiber._debugSource.fileName) {
          source = { file: fiber._debugSource.fileName, line: fiber._debugSource.lineNumber };
          break;
        }
        fiber = fiber.return;
      }
    }

    // Semantic tags
    const dataTl = el.getAttribute('data-tl') || null;
    const dataSrc = el.getAttribute('data-src') || null;

    const payload = {
      selector: currentSelector,
      tagName: currentSelected.tagName.toLowerCase(),
      text: currentSelected.innerText?.slice(0, 80) || '',
      dataTl,
      dataSrc,
      source,
      rect,
      styles
    };

    window.postMessage({ type: 'TWEAKLENS_SELECT', payload }, '*');
  }, true);

  // Called from host to toggle on/off
  window.__TWEAKLENS_SET_ENABLED__ = function(flag) {
    window.__TWEAKLENS_ENABLED__ = !!flag;
    if (!flag) { box.style.display = 'none'; }
  };

  // Called from host to apply styles live
  window.__TWEAKLENS_APPLY__ = function(prop, val) {
    if (!currentSelected) return;
    if (prop === 'innerText') {
      currentSelected.innerText = val;
    } else {
      currentSelected.style[prop] = val;
    }
    syncBox(currentSelected);
  };
})();
`;
