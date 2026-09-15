export const INJECTED_INSPECTOR_CODE = `
(function() {
  if (window.__TWEAKLENS_INJECTED__) return;
  window.__TWEAKLENS_INJECTED__ = true;

  let currentSelected = null;

  // 1. Floating highlight box
  const box = document.createElement('div');
  box.id = '__tweaklens_highlight__';
  box.style.position = 'fixed';
  box.style.pointerEvents = 'none';
  box.style.border = '2px solid #6d6dfa';
  box.style.backgroundColor = 'rgba(109, 109, 250, 0.18)';
  box.style.zIndex = '9999999';
  box.style.display = 'none';
  box.style.borderRadius = '4px';
  box.style.transition = 'all 0.05s ease';
  document.body.appendChild(box);

  function syncBox(el) {
    if (!el) {
      box.style.display = 'none';
      return;
    }
    const r = el.getBoundingClientRect();
    box.style.display = 'block';
    box.style.top = r.top + 'px';
    box.style.left = r.left + 'px';
    box.style.width = r.width + 'px';
    box.style.height = r.height + 'px';
  }

  // Hover tracker
  document.addEventListener('mouseover', (e) => {
    if (e.target === box || e.target === document.body) return;
    syncBox(e.target);
  }, true);

  // Click tracker
  document.addEventListener('click', (e) => {
    if (e.target === box) return;
    e.preventDefault();
    e.stopPropagation();

    currentSelected = e.target;
    syncBox(currentSelected);

    const comp = window.getComputedStyle(currentSelected);
    
    // Determine friendly selector
    let selector = currentSelected.tagName.toLowerCase();
    if (currentSelected.id) {
      selector = '#' + currentSelected.id;
    } else if (currentSelected.className && typeof currentSelected.className === 'string') {
      const cls = currentSelected.className.trim().split(/\\s+/).slice(0, 2).join('.');
      if (cls) selector += '.' + cls;
    }

    const payload = {
      selector,
      tagName: currentSelected.tagName.toLowerCase(),
      text: currentSelected.innerText?.slice(0, 80) || '',
      styles: {
        color: comp.color,
        backgroundColor: comp.backgroundColor,
        fontSize: comp.fontSize,
        padding: comp.padding,
        margin: comp.margin,
        borderRadius: comp.borderRadius
      }
    };

    console.log('[TWEAKLENS_SELECT]:' + JSON.stringify(payload));
  }, true);

  // Function called from host to apply styles live
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
