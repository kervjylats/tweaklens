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
  const [activeTool, setActiveTool] = useState('box'); // 'box' or 'button' | 'text' | 'card' | 'input'
  const [framework, setFramework] = useState('flutter'); // 'flutter' | 'react' | 'generic'

  // Annotations & Stamped Widgets
  const [annotations, setAnnotations] = useState([]);
  const [selectedBoxId, setSelectedBoxId] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [currentRect, setCurrentRect] = useState(null);
  const [copied, setCopied] = useState(false);

  const webviewRef = useRef(null);
  const overlayRef = useRef(null);

  // ----------------------------------------------------
  // DRAWING & STAMPING LOGIC
  // ----------------------------------------------------
  const handleOverlayMouseDown = (e) => {
    if (mode !== 'edit') return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // IF STAMP TOOL IS ACTIVE -> Drop new widget on click!
    if (activeTool !== 'box') {
      const preset = STAMP_PRESETS[activeTool];
      const newWidget = {
        id: Date.now(),
        x: Math.max(10, x - preset.width / 2),
        y: Math.max(10, y - preset.height / 2),
        width: preset.width,
        height: preset.height,
        label: `New ${activeTool.toUpperCase()}`,
        type: 'insert', // 'insert' | 'styling' | 'reorder' | 'remove'
        subType: activeTool,
        text: preset.defaultText,
        color: preset.color,
        reorderTarget: '',
        reorderDirection: 'below',
        notes: ''
      };
      setAnnotations((prev) => [...prev, newWidget]);
      setSelectedBoxId(newWidget.id);
      setActiveTool('box'); // Return to normal box selection
      return;
    }

    // OTHERWISE -> Start box drag
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
        type: 'styling', // default to restyle
        subType: 'widget',
        text: '',
        color: '#10b981',
        reorderTarget: '',
        reorderDirection: 'below',
        notes: ''
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
    
    let prompt = `### 📋 Batch UI Refactor Plan (${annotations.length} Tasks)\n`;
    prompt += `Target URL: \`${activeUrl}\`\n`;
    prompt += `Target Framework: **${framework.toUpperCase()}**\n\n`;
    prompt += `Please review the whole task list and update the code step-by-step:\n\n`;

    annotations.forEach((box, i) => {
      prompt += `#### TASK ${i + 1}: [${box.label.toUpperCase()}]\n`;
      
      if (box.type === 'insert') {
        prompt += `- **Action**: ➕ INSERT NEW WIDGET\n`;
        prompt += `- **Component Type**: ${box.subType.toUpperCase()}\n`;
        if (box.text) prompt += `- **Initial Text**: "${box.text}"\n`;
        if (box.color) prompt += `- **Styling / Color**: \`${box.color}\`\n`;
        if (box.notes) prompt += `- **Placement & Notes**: ${box.notes}\n`;
      } else if (box.type === 'reorder') {
        prompt += `- **Action**: 🔀 REORDER / MOVE\n`;
        prompt += `- **Movement**: Move **${box.reorderDirection.toUpperCase()}** "${box.reorderTarget || 'the specified section'}"\n`;
        if (box.notes) prompt += `- **Details**: ${box.notes}\n`;
      } else if (box.type === 'remove') {
        prompt += `- **Action**: ❌ REMOVE / HIDE\n`;
        prompt += `- **Instruction**: Delete or conditionally hide this widget\n`;
        if (box.notes) prompt += `- **Reason / Details**: ${box.notes}\n`;
      } else {
        // Styling / text
        prompt += `- **Action**: 🎨 RESTYLE & MODIFY\n`;
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
            onClick={() => setMode('interact')}
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
          <button className="btn icon-btn" onClick={() => webviewRef.current?.reload()}>🔄</button>
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

      {/* Sub-toolbar (Only visible in Edit Mode) */}
      {mode === 'edit' && (
        <div className="edit-subbar">
          <span className="subbar-label">TOOL:</span>
          <button
            className={`tool-chip ${activeTool === 'box' ? 'selected' : ''}`}
            onClick={() => setActiveTool('box')}
          >
            ✏️ Drag Box
          </button>

          <div className="divider-v"></div>
          <span className="subbar-label">STAMP NEW:</span>
          {Object.entries(STAMP_PRESETS).map(([k, v]) => (
            <button
              key={k}
              className={`tool-chip stamp ${activeTool === k ? 'selected' : ''}`}
              onClick={() => setActiveTool(k)}
            >
              {v.label}
            </button>
          ))}
          <span className="hint-stamp">
            {activeTool !== 'box' ? `👉 Click anywhere on the phone to place a new ${activeTool}!` : 'Drag a box over an existing element.'}
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
              ref={webviewRef}
              src={activeUrl}
              className="guest-webview"
            />

            {/* Visual Canvas Overlay */}
            <div
              ref={overlayRef}
              className={`annotation-overlay ${mode === 'edit' ? 'active-overlay' : 'passive-overlay'}`}
              onMouseDown={handleOverlayMouseDown}
              onMouseMove={handleOverlayMouseMove}
              onMouseUp={handleOverlayMouseUp}
            >
              {/* Dragging Box Preview */}
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

              {/* Rendered Badges & Boxes */}
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
                      pointerEvents: mode === 'edit' ? 'auto' : 'none'
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

                  <label>
                    <span>Widget Name / Label</span>
                    <input
                      type="text"
                      value={selectedBox.label}
                      onChange={(e) => updateSelectedBox({ label: e.target.value })}
                    />
                  </label>

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

                  {/* Move & Reorder Controls */}
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
                          placeholder="e.g. Spanish Chip, or Streak Banner"
                          value={selectedBox.reorderTarget}
                          onChange={(e) => updateSelectedBox({ reorderTarget: e.target.value })}
                        />
                      </label>
                    </div>
                  )}

                  {/* Text / Label Controls */}
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

                  {/* Color / Styling Controls */}
                  {selectedBox.type !== 'remove' && (
                    <label>
                      <span>Color / Theme</span>
                      <input
                        type="text"
                        value={selectedBox.color}
                        placeholder="e.g. #10b981 or Colors.teal"
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
                    Select a tool above (or drag a box) to edit or place elements.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Diffs & Batch Export */}
          <div className="sidebar-section diffs-section" style={{ marginTop: 'auto' }}>
            <div className="diffs-header">
              <h3>Batch Tasks ({annotations.length})</h3>
              {annotations.length > 0 && (
                <button className="btn-link" onClick={() => setAnnotations([])}>Clear All</button>
              )}
            </div>

            {/* Target Framework Selector */}
            <div style={{ marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Target Stack:</span>
              <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                <button
                  className={`chip ${framework === 'flutter' ? 'active' : ''}`}
                  onClick={() => setFramework('flutter')}
                >
                  Flutter
                </button>
                <button
                  className={`chip ${framework === 'react' ? 'active' : ''}`}
                  onClick={() => setFramework('react')}
                >
                  React / Next
                </button>
                <button
                  className={`chip ${framework === 'generic' ? 'active' : ''}`}
                  onClick={() => setFramework('generic')}
                >
                  Generic
                </button>
              </div>
            </div>

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
