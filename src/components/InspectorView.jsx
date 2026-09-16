import React, { useState, useRef, useEffect } from 'react';
import { INJECTED_INSPECTOR_CODE } from '../lib/injectedInspector.js';

const VIEWPORTS = {
  mobile: { label: '📱 Mobile', width: '390px', height: '844px' },
  tablet: { label: '📱 Tablet', width: '768px', height: '100%' },
  desktop: { label: '💻 Desktop', width: '100%', height: '100%' }
};

const STAMP_PRESETS = {
  button: { label: '🔘 + Button', width: 140, height: 44, defaultText: 'New Button', color: '#6d6dfa' },
  text: { label: '📝 + Text', width: 180, height: 28, defaultText: 'New Heading', color: '#f0f0f5' },
  card: { label: '🗂️ + Card', width: 320, height: 110, defaultText: 'Card Content', color: '#1c1c24' },
  input: { label: '📥 + Input', width: 280, height: 46, defaultText: 'Placeholder...', color: '#2a2a35' }
};

export default function InspectorView() {
  const [inputUrl, setInputUrl] = useState('http://localhost:8085');
  const [activeUrl, setActiveUrl] = useState('http://localhost:8085');
  const [viewport, setViewport] = useState('mobile');

  // Modes: 'interact' (Testing), 'edit' (Visual UI tool)
  const [mode, setMode] = useState('interact');
  const [activeTool, setActiveTool] = useState('box');
  const [framework, setFramework] = useState('flutter');

  // Element inspector
  const inspectorActive = mode === 'edit' && picking;
  const [picking, setPicking] = useState(false);
  const [inspectedEl, setInspectedEl] = useState(null);

  // Annotations & Stamped Widgets
  const [annotations, setAnnotations] = useState([]);
  const [selectedBoxId, setSelectedBoxId] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [currentRect, setCurrentRect] = useState(null);
  const [copied, setCopied] = useState(false);

  // Rules preamble toggle
  const [includeRules, setIncludeRules] = useState(true);

  const webviewRef = useRef(null);
  const overlayRef = useRef(null);

  // ----------------------------------------------------
  // INJECT INSPECTOR CODE + LISTEN FOR IPC FROM GUEST
  // ----------------------------------------------------
  const injectInspector = () => {
    const wv = webviewRef.current;
    if (!wv) return;
    try {
      wv.executeJavaScript(INJECTED_INSPECTOR_CODE);
      wv.executeJavaScript(`window.__TWEAKLENS_SET_ENABLED__(${inspectorActive})`);
    } catch (_) { /* webview not ready */ }
  };

  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv) return;

    const onReady = () => injectInspector();
    wv.addEventListener('dom-ready', onReady);
    wv.addEventListener('did-finish-load', onReady);

    return () => {
      wv.removeEventListener('dom-ready', onReady);
      wv.removeEventListener('did-finish-load', onReady);
    };
  }, [activeUrl, viewport, inspectorActive]);

  // Toggle inspector flag on the guest
  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv) return;
    try {
      wv.executeJavaScript(`window.__TWEAKLENS_SET_ENABLED__(${inspectorActive})`);
    } catch (_) {}
  }, [inspectorActive]);

  // Listen for element selections via IPC bridge (NOT window.postMessage)
  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv) return;

    const handler = (e) => {
      if (e.channel === 'tweaklens-select' && e.args?.[0]) {
        const payload = e.args[0];
        setInspectedEl(payload);

        // If we're in picking mode, auto-create an annotation box at the element's rect
        if (picking && payload.rect && payload.rect.width > 5 && payload.rect.height > 5) {
          const newBox = {
            id: Date.now(),
            x: payload.rect.x,
            y: payload.rect.y,
            width: Math.max(payload.rect.width, 40),
            height: Math.max(payload.rect.height, 20),
            label: payload.text?.slice(0, 30) || payload.tagName || 'Element',
            type: 'styling',
            subType: 'widget',
            text: payload.text?.slice(0, 80) || '',
            color: payload.styles?.color || '#10b981',
            reorderTarget: '',
            reorderDirection: 'below',
            notes: '',
            selector: payload.selector || '',
            dataTl: payload.dataTl || null,
            dataSrc: payload.dataSrc || null,
            source: payload.source || null,
            capturedStyles: payload.styles || {}
          };
          setAnnotations((prev) => [...prev, newBox]);
          setSelectedBoxId(newBox.id);
          setPicking(false);
        }
      }
    };

    wv.addEventListener('ipc-message', handler);
    return () => wv.removeEventListener('ipc-message', handler);
  }, [picking]); // re-bind when picking changes so the auto-create fires

  // ----------------------------------------------------
  // DRAWING & STAMPING LOGIC
  // ----------------------------------------------------
  const handleOverlayMouseDown = (e) => {
    if (mode !== 'edit' || picking) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeTool !== 'box') {
      const preset = STAMP_PRESETS[activeTool];
      const newWidget = {
        id: Date.now(),
        x: Math.max(10, x - preset.width / 2),
        y: Math.max(10, y - preset.height / 2),
        width: preset.width,
        height: preset.height,
        label: `New ${activeTool.toUpperCase()}`,
        type: 'insert',
        subType: activeTool,
        text: preset.defaultText,
        color: preset.color,
        reorderTarget: '',
        reorderDirection: 'below',
        notes: '',
        selector: '',
        dataTl: null,
        dataSrc: null,
        source: null,
        capturedStyles: {}
      };
      setAnnotations((prev) => [...prev, newWidget]);
      setSelectedBoxId(newWidget.id);
      setActiveTool('box');
      return;
    }

    setIsDrawing(true);
    setDrawStart({ x, y });
    setCurrentRect({ x, y, width: 0, height: 0 });
  };

  const handleOverlayMouseMove = (e) => {
    if (!isDrawing || !drawStart) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    setCurrentRect({
      x: Math.min(drawStart.x, currentX),
      y: Math.min(drawStart.y, currentY),
      width: Math.abs(currentX - drawStart.x),
      height: Math.abs(currentY - drawStart.y)
    });
  };

  const handleOverlayMouseUp = () => {
    if (!isDrawing || !currentRect) return;
    setIsDrawing(false);

    if (currentRect.width > 15 && currentRect.height > 15) {
      const newBox = {
        id: Date.now(),
        ...currentRect,
        label: `Widget #${annotations.length + 1}`,
        type: 'styling',
        subType: 'widget',
        text: '',
        color: '#10b981',
        reorderTarget: '',
        reorderDirection: 'below',
        notes: '',
        selector: inspectedEl?.selector || '',
        dataTl: inspectedEl?.dataTl || null,
        dataSrc: inspectedEl?.dataSrc || null,
        source: inspectedEl?.source || null,
        capturedStyles: inspectedEl?.styles || {}
      };
      setAnnotations((prev) => [...prev, newBox]);
      setSelectedBoxId(newBox.id);
    }
    setCurrentRect(null);
    setDrawStart(null);
  };

  const updateSelectedBox = (patch) => {
    setAnnotations((prev) =>
      prev.map((b) => (b.id === selectedBoxId ? { ...b, ...patch } : b))
    );
  };

  const deleteBox = (id) => {
    setAnnotations((prev) => prev.filter((b) => b.id !== id));
    if (selectedBoxId === id) setSelectedBoxId(null);
  };

  const selectedBox = annotations.find((b) => b.id === selectedBoxId);

  // ----------------------------------------------------
  // BATCH REFACTOR PROMPT BUILDER
  // ----------------------------------------------------
  const generateBatchPrompt = () => {
    if (annotations.length === 0) return 'No visual changes boxed yet.';

    let prompt = '';

    // Rules preamble (toggleable)
    if (includeRules) {
      prompt += `## PROJECT RULES (MUST FOLLOW)\n`;
      prompt += `- Follow the repo's AGENTS.md conventions exactly.\n`;
      prompt += `- Use the existing branding design system (buttonClass, cardRadius, theme tokens) — never hardcode raw colors that bypass per-creator branding.\n`;
      prompt += `- Follow existing Tailwind + responsive conventions (sm: / md: / lg:); make it work on mobile, tablet, and desktop.\n`;
      prompt += `- After changes, run \`npm run typecheck\`, \`npm run lint\`, \`python scripts/check-docs.py\` — all must be 0 errors.\n`;
      prompt += `- Touch only the targeted files; keep JSDoc purpose docstrings on every .ts/.tsx file.\n\n`;
    }

    prompt += `### Batch UI Refactor Plan (${annotations.length} Tasks)\n`;
    prompt += `Target URL: \`${activeUrl}\`\n`;
    prompt += `Target Framework: **${framework.toUpperCase()}**\n\n`;
    prompt += `Please review the whole task list and update the code step-by-step:\n\n`;

    annotations.forEach((box, i) => {
      prompt += `#### TASK ${i + 1}: [${box.label.toUpperCase()}]\n`;

      // Source information (highest priority)
      if (box.source?.file) {
        prompt += `- **Source**: \`${box.source.file}:${box.source.line}\`\n`;
      }
      if (box.selector) {
        prompt += `- **Element Selector**: \`${box.selector}\`\n`;
      }
      if (box.dataTl) {
        prompt += `- **Component**: \`${box.dataTl}\`\n`;
      }
      if (box.dataSrc) {
        prompt += `- **Source Tag**: \`${box.dataSrc}\`\n`;
      }

      // Current computed styles (before state)
      if (box.capturedStyles && Object.keys(box.capturedStyles).length > 0) {
        const cs = box.capturedStyles;
        prompt += `- **Current Styles** (before): color=\`${cs.color}\`, bg=\`${cs.backgroundColor}\`, font=\`${cs.fontSize} ${cs.fontFamily?.split(',')[0]}\`, weight=\`${cs.fontWeight}\`, padding=\`${cs.padding}\`, radius=\`${cs.borderRadius}\`\n`;
      }

      if (box.type === 'insert') {
        prompt += `- **Action**: INSERT NEW WIDGET\n`;
        prompt += `- **Component Type**: ${box.subType.toUpperCase()}\n`;
        if (box.text) prompt += `- **Initial Text**: "${box.text}"\n`;
        if (box.color) prompt += `- **Styling / Color**: \`${box.color}\`\n`;
        if (box.notes) prompt += `- **Placement & Notes**: ${box.notes}\n`;
      } else if (box.type === 'reorder') {
        prompt += `- **Action**: REORDER / MOVE\n`;
        prompt += `- **Movement**: Move **${box.reorderDirection.toUpperCase()}** "${box.reorderTarget || 'the specified section'}"\n`;
        if (box.notes) prompt += `- **Details**: ${box.notes}\n`;
      } else if (box.type === 'remove') {
        prompt += `- **Action**: REMOVE / HIDE\n`;
        prompt += `- **Instruction**: Delete or conditionally hide this widget\n`;
        if (box.notes) prompt += `- **Reason / Details**: ${box.notes}\n`;
      } else {
        prompt += `- **Action**: RESTYLE & MODIFY\n`;
        if (box.text) prompt += `- **Change Text To**: "${box.text}"\n`;
        if (box.color) prompt += `- **Color / Background**: \`${box.color}\`\n`;
        if (box.notes) prompt += `- **Detailed Changes**: ${box.notes}\n`;
      }
      prompt += '\n';
    });

    if (framework === 'flutter') {
      prompt += `Instructions for Flutter: Look for matching Widgets in \`lib/\` (e.g. ChoiceChip, Card, ElevatedButton, Container) and implement the changes cleanly in Dart.`;
    } else if (framework === 'react') {
      prompt += `Instructions for React: Update JSX components and Tailwind/CSS classes to reflect these exact changes.`;
    }

    return prompt;
  };

  const copyPrompt = () => {
    navigator.clipboard.writeText(generateBatchPrompt());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ----------------------------------------------------
  // Overlay class calculation
  // ----------------------------------------------------
  const overlayClass = picking
    ? 'annotation-overlay picking-overlay'
    : mode === 'edit'
      ? 'annotation-overlay active-overlay'
      : 'annotation-overlay passive-overlay';

  return (
    <div className="lens-container">
      {/* Topbar */}
      <header className="lens-topbar">
        <div className="logo-group">
          <span className="logo-dot"></span>
          <span className="logo-text">TweakLens</span>
        </div>

        {/* Mode Switcher */}
        <div className="mode-toggle">
          <button
            className={`mode-btn ${mode === 'interact' ? 'active-test' : ''}`}
            onClick={() => { setMode('interact'); setPicking(false); }}
          >
            ▶️ Test & Click
          </button>
          <button
            className={`mode-btn ${mode === 'edit' ? 'active-edit' : ''}`}
            onClick={() => setMode('edit')}
          >
            ✏️ Edit UI Tools
          </button>
        </div>

        {/* Inspector Controls */}
        {mode === 'edit' && (
          <div className="mode-toggle" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              className={`tool-chip ${picking ? 'selected' : ''}`}
              onClick={() => setPicking((prev) => !prev)}
              style={{ fontSize: '11px' }}
            >
              {picking ? '🔴 Picking...' : '🔍 Pick Element'}
            </button>
            {inspectedEl && (
              <span style={{ fontSize: '10px', color: 'var(--accent-primary)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {inspectedEl.source?.file ? `${inspectedEl.source.file.split('/').pop()}:${inspectedEl.source.line}` : inspectedEl.selector}
              </span>
            )}
          </div>
        )}

        {/* URL Input */}
        <div className="url-bar-wrap">
          <input
            type="text"
            className="url-input"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setActiveUrl(inputUrl)}
          />
          <button className="btn primary" onClick={() => setActiveUrl(inputUrl)}>Go</button>
          <button className="btn icon-btn" onClick={() => { try { webviewRef.current?.reload(); } catch (_) {} }}>🔄</button>
        </div>

        {/* Viewport Switcher */}
        <div className="viewport-toggle">
          {Object.entries(VIEWPORTS).map(([k, v]) => (
            <button
              key={k}
              className={`chip ${viewport === k ? 'active' : ''}`}
              onClick={() => setViewport(k)}
            >
              {v.label}
            </button>
          ))}
        </div>
      </header>

      {/* Sub-toolbar (Edit Mode only) */}
      {mode === 'edit' && (
        <div className="edit-subbar">
          <span className="subbar-label">TOOL:</span>
          <button
            className={`tool-chip ${activeTool === 'box' && !picking ? 'selected' : ''}`}
            onClick={() => { setActiveTool('box'); setPicking(false); }}
          >
            ✏️ Drag Box
          </button>

          <div className="divider-v"></div>
          <span className="subbar-label">STAMP NEW:</span>
          {Object.entries(STAMP_PRESETS).map(([k, v]) => (
            <button
              key={k}
              className={`tool-chip stamp ${activeTool === k ? 'selected' : ''}`}
              onClick={() => { setActiveTool(k); setPicking(false); }}
            >
              {v.label}
            </button>
          ))}
          <span className="hint-stamp">
            {picking
              ? 'Click any element in the app to capture it...'
              : activeTool !== 'box'
                ? `Click anywhere on the phone to place a new ${activeTool}!`
                : inspectedEl
                  ? `Last captured: ${inspectedEl.selector || inspectedEl.tagName || 'element'} — drag a box over it.`
                  : '🔍 Use Pick Element to auto-capture, or drag a box manually.'}
          </span>
        </div>
      )}

      {/* Main Workspace */}
      <div className="lens-body">
        <div className="lens-canvas">
          <div
            className="device-frame"
            style={{
              width: VIEWPORTS[viewport].width,
              height: VIEWPORTS[viewport].height,
              position: 'relative'
            }}
          >
            {/* Embedded Live App */}
            <webview
              key={viewport}
              ref={webviewRef}
              src={activeUrl}
              className="guest-webview"
              preload={window.tweaklens?.webviewPreload}
            />

            {/* Visual Canvas Overlay */}
            <div
              ref={overlayRef}
              className={overlayClass}
              onMouseDown={handleOverlayMouseDown}
              onMouseMove={handleOverlayMouseMove}
              onMouseUp={handleOverlayMouseUp}
            >
              {currentRect && (
                <div
                  className="drawing-rect"
                  style={{
                    left: currentRect.x,
                    top: currentRect.y,
                    width: currentRect.width,
                    height: currentRect.height
                  }}
                />
              )}

              {annotations.map((box, i) => {
                let badgeClass = 'box-modify';
                if (box.type === 'insert') badgeClass = 'box-insert';
                if (box.type === 'reorder') badgeClass = 'box-reorder';
                if (box.type === 'remove') badgeClass = 'box-remove';

                return (
                  <div
                    key={box.id}
                    className={`annotated-box ${badgeClass} ${selectedBoxId === box.id ? 'selected' : ''}`}
                    style={{
                      left: box.x,
                      top: box.y,
                      width: box.width,
                      height: box.height,
                      pointerEvents: mode === 'edit' && !picking ? 'auto' : 'none'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedBoxId(box.id);
                    }}
                  >
                    <span className="box-badge">{i + 1}</span>
                    <span className="box-label-tag">
                      {box.type === 'insert' ? '➕ ' : ''}
                      {box.label}
                    </span>
                    {(box.source?.file || box.selector) && (
                      <span className="box-badge" style={{ left: 'auto', right: '4px', background: '#6d6dfa', fontSize: '9px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {box.source?.file ? box.source.file.split('/').pop() + ':' + box.source.line : box.selector}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="lens-sidebar">
          {mode === 'interact' ? (
            <div className="sidebar-section">
              <div className="status-pill green">▶️ Test Mode Active</div>
              <h3>Testing & Navigating</h3>
              <p className="hint">
                Clicks and typing pass straight into your app. Test your navigation freely.
              </p>
              <button
                className="btn primary full-width"
                style={{ marginTop: '16px' }}
                onClick={() => setMode('edit')}
              >
                ✏️ Switch to Edit UI Mode
              </button>
            </div>
          ) : (
            <>
              {selectedBox ? (
                <div className="sidebar-section form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', color: '#ff4757' }}>
                      Task #{annotations.findIndex((b) => b.id === selectedBox.id) + 1}
                    </span>
                    <button className="btn-link danger" onClick={() => deleteBox(selectedBox.id)}>
                      Delete Box
                    </button>
                  </div>

                  {/* Source info (read-only, when available) */}
                  {selectedBox.source?.file && (
                    <div style={{ fontSize: '11px', color: 'var(--accent-primary)', fontFamily: 'monospace', marginBottom: '8px', wordBreak: 'break-all' }}>
                      📄 {selectedBox.source.file}:{selectedBox.source.line}
                    </div>
                  )}
                  {selectedBox.dataTl && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      🏷️ Component: {selectedBox.dataTl}
                    </div>
                  )}

                  <label>
                    <span>Widget Name / Label</span>
                    <input
                      type="text"
                      value={selectedBox.label}
                      onChange={(e) => updateSelectedBox({ label: e.target.value })}
                    />
                  </label>

                  <label>
                    <span>Element Selector</span>
                    <input
                      type="text"
                      value={selectedBox.selector || ''}
                      onChange={(e) => updateSelectedBox({ selector: e.target.value })}
                      placeholder="e.g. button.primary, #cta-btn"
                      style={{ fontFamily: 'monospace', fontSize: '12px' }}
                    />
                  </label>

                  {/* Current styles preview */}
                  {selectedBox.capturedStyles && Object.keys(selectedBox.capturedStyles).length > 0 && (
                    <details style={{ marginBottom: '8px' }}>
                      <summary style={{ fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer' }}>Current Styles (before)</summary>
                      <div style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.6' }}>
                        {Object.entries(selectedBox.capturedStyles).map(([k, v]) => (
                          <div key={k}>{k}: {v}</div>
                        ))}
                      </div>
                    </details>
                  )}

                  <label>
                    <span>Action Type</span>
                    <select
                      value={selectedBox.type}
                      onChange={(e) => updateSelectedBox({ type: e.target.value })}
                    >
                      <option value="styling">🎨 Restyle & Color</option>
                      <option value="reorder">🔀 Move / Reorder</option>
                      <option value="insert">➕ Insert New Widget</option>
                      <option value="remove">❌ Remove Widget</option>
                    </select>
                  </label>

                  {selectedBox.type === 'reorder' && (
                    <div className="reorder-group">
                      <label>
                        <span>Direction</span>
                        <select
                          value={selectedBox.reorderDirection}
                          onChange={(e) => updateSelectedBox({ reorderDirection: e.target.value })}
                        >
                          <option value="above">⬆️ Move ABOVE</option>
                          <option value="below">⬇️ Move BELOW</option>
                          <option value="inside">📥 Move INSIDE</option>
                          <option value="top">🔝 Move to TOP of screen</option>
                          <option value="bottom">🔻 Move to BOTTOM of screen</option>
                        </select>
                      </label>
                      <label>
                        <span>Relative To</span>
                        <input
                          type="text"
                          placeholder="e.g. Subscribe Button"
                          value={selectedBox.reorderTarget}
                          onChange={(e) => updateSelectedBox({ reorderTarget: e.target.value })}
                        />
                      </label>
                    </div>
                  )}

                  {(selectedBox.type === 'styling' || selectedBox.type === 'insert') && (
                    <label>
                      <span>Text / Title</span>
                      <input
                        type="text"
                        value={selectedBox.text}
                        placeholder="e.g. Quick Practice"
                        onChange={(e) => updateSelectedBox({ text: e.target.value })}
                      />
                    </label>
                  )}

                  {selectedBox.type !== 'remove' && (
                    <label>
                      <span>Color / Theme</span>
                      <input
                        type="text"
                        value={selectedBox.color}
                        placeholder="e.g. #10b981 or branding.accentColor"
                        onChange={(e) => updateSelectedBox({ color: e.target.value })}
                      />
                    </label>
                  )}

                  <label>
                    <span>Instruction for AI</span>
                    <textarea
                      rows={3}
                      value={selectedBox.notes}
                      placeholder="e.g. Make button full width with 16px padding and bold text"
                      onChange={(e) => updateSelectedBox({ notes: e.target.value })}
                    />
                  </label>
                </div>
              ) : (
                <div className="sidebar-section">
                  <p className="hint">
                    {picking
                      ? '🔍 Click any element in the app to capture it and auto-create an annotation.'
                      : 'Pick an element above, or drag a box over something to annotate it.'}
                  </p>
                </div>
              )}
            </>
          )}

          {/* Batch Export */}
          <div className="sidebar-section diffs-section" style={{ marginTop: 'auto' }}>
            <div className="diffs-header">
              <h3>Batch Tasks ({annotations.length})</h3>
              {annotations.length > 0 && (
                <button className="btn-link" onClick={() => setAnnotations([])}>Clear All</button>
              )}
            </div>

            <div style={{ marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Target Stack:</span>
              <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                {['flutter', 'react', 'generic'].map((f) => (
                  <button
                    key={f}
                    className={`chip ${framework === f ? 'active' : ''}`}
                    onClick={() => setFramework(f)}
                  >
                    {f === 'react' ? 'React / Next' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Rules preamble toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeRules}
                onChange={(e) => setIncludeRules(e.target.checked)}
                style={{ width: '14px', height: '14px' }}
              />
              Include project rules in prompt
            </label>

            <button
              className="btn primary full-width"
              disabled={annotations.length === 0}
              onClick={copyPrompt}
            >
              {copied ? '✅ Copied Batch Plan!' : '📋 Copy Batch Plan for AI'}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
