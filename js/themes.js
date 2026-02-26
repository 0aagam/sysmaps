// ══════════════════════════════════════════════
// SYSMAP — THEME SYSTEM (ES6 MODULE)
// Themes control the entire visual feel:
// colors, radius, shadows, and fonts.
// Obsidian is the original SysMap dark theme.
// ══════════════════════════════════════════════

export const BUILT_IN_THEMES = {
  obsidian: {
    id: 'obsidian',
    name: 'Obsidian',
    description: 'Original SysMap dark theme',
    dark: true,
    // These are the data-theme CSS vars applied via <html data-theme="...">
    // Obsidian uses the CSS defined in style.css under [data-theme="obsidian"]
    builtIn: true,
    preview: {
      bg: '#0a0a0a',
      surface: '#181818',
      accent: '#c8ff00',
      dots: ['#c8ff00','#ff6b35','#4ecdc4','#a78bfa','#f59e0b']
    }
  },
  paper: {
    id: 'paper',
    name: 'Paper',
    description: 'Apple-inspired light theme',
    dark: false,
    builtIn: true,
    preview: {
      bg: '#f2f2f7',
      surface: '#ffffff',
      accent: '#007aff',
      dots: ['#007aff','#34c759','#ff9500','#ff3b30','#bf5af2']
    }
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight',
    description: 'Deep dark with blue accents',
    dark: true,
    builtIn: true,
    preview: {
      bg: '#000000',
      surface: '#141414',
      accent: '#0a84ff',
      dots: ['#0a84ff','#32d74b','#ffd60a','#ff453a','#bf5af2']
    }
  }
};

// Exportable version of Obsidian theme
// (what gets written to JSON when user exports)
export const OBSIDIAN_EXPORT = {
  id: 'obsidian',
  name: 'Obsidian',
  description: 'Original SysMap dark theme — sharp edges, neon accent',
  version: '1.0',
  author: 'SysMap',
  dark: true,
  vars: {
    '--bg':        '#0a0a0a',
    '--s1':        '#111111',
    '--s2':        '#181818',
    '--s3':        '#222222',
    '--b1':        '#2a2a2a',
    '--b2':        '#383838',
    '--t1':        '#e8e8e8',
    '--t2':        '#888888',
    '--t3':        '#484848',
    '--accent':    '#c8ff00',
    '--acc-fg':    '#000000',
    '--danger':    '#ff4444',
    '--ok':        '#4ecdc4',
    '--warn':      '#f59e0b',
    '--r':         '0px',
    '--r-sm':      '0px',
    '--r-lg':      '0px',
    '--shadow':    'none',
    '--shadow-lg': 'none',
    '--font-ui':   "'IBM Plex Mono', monospace",
    '--font-body': "'Inter', sans-serif",
    '--font-head': "'Syne', sans-serif"
  }
};

// Node category colors — same across all themes
export const CAT_COLORS = {
  concept:   '#f59e0b',
  system:    '#ff6b35',
  person:    '#ec4899',
  place:     '#4ecdc4',
  event:     '#a78bfa',
  thing:     '#60a5fa',
  question:  '#c8ff00'
};

// ══════════════════════════════════════════════
export const Themes = (() => {
  let current = 'obsidian';
  let customThemes = []; // user-imported themes
  let activeCustomVars = null;

  function init() {
    const saved = localStorage.getItem('sysmap_theme') || 'obsidian';
    const savedCustom = localStorage.getItem('sysmap_custom_themes');
    if (savedCustom) {
      try { customThemes = JSON.parse(savedCustom); } catch(e) {}
    }
    apply(saved);
  }

  function apply(themeId) {
    current = themeId;
    localStorage.setItem('sysmap_theme', themeId);

    // Check if it's a built-in theme
    const html = document.documentElement;
    if (BUILT_IN_THEMES[themeId]) {
      html.setAttribute('data-theme', themeId);
      // Remove any custom vars
      if (activeCustomVars) {
        activeCustomVars.forEach(v => html.style.removeProperty(v));
        activeCustomVars = null;
      }
    } else {
      // Custom theme — apply CSS vars directly
      const custom = customThemes.find(t => t.id === themeId);
      if (custom && custom.vars) {
        // Set a base dark/light scheme
        html.setAttribute('data-theme', custom.dark ? 'obsidian' : 'paper');
        // Override with custom vars
        activeCustomVars = Object.keys(custom.vars);
        activeCustomVars.forEach(v => html.style.setProperty(v, custom.vars[v]));
      }
    }

    // Update meta theme-color
    const style = getComputedStyle(html);
    const bg = style.getPropertyValue('--bg').trim();
    const meta = document.getElementById('metaThemeColor');
    if (meta && bg) meta.setAttribute('content', bg);
  }

  function openPicker() {
    buildGrid();
    document.getElementById('themeOverlay').classList.remove('hidden');
  }

  function close() {
    document.getElementById('themeOverlay').classList.add('hidden');
  }

  function buildGrid() {
    const grid = document.getElementById('themeGrid');
    const allThemes = [
      ...Object.values(BUILT_IN_THEMES),
      ...customThemes.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description || 'Custom theme',
        dark: t.dark,
        builtIn: false,
        preview: t.preview || { bg:'#111', surface:'#222', accent:'#fff', dots:['#fff'] }
      }))
    ];

    grid.innerHTML = allThemes.map(t => `
      <div class="theme-card ${current===t.id?'active':''}" onclick="Themes.select('${t.id}')">
        <div class="theme-card-preview" style="background:${t.preview.bg}">
          ${t.preview.dots.map(c => `<div class="theme-preview-dot" style="background:${c}"></div>`).join('')}
        </div>
        <div class="theme-card-label" style="background:${t.preview.surface};color:${t.preview.bg==='#f2f2f7'?'#1c1c1e':'#e8e8e8'};border-color:${t.preview.bg==='#f2f2f7'?'#e5e5ea':'#2a2a2a'}">
          <div style="font-weight:600;margin-bottom:2px">${t.name}</div>
          <div style="font-size:10px;opacity:.6">${t.description}</div>
          ${!t.builtIn?`<button onclick="event.stopPropagation();Themes.removeCustom('${t.id}')" style="float:right;background:none;border:none;color:inherit;cursor:pointer;font-size:10px;opacity:.5">✕</button>`:''}
        </div>
      </div>
    `).join('');
  }

  function select(id) {
    apply(id);
    buildGrid();
    // Refresh graph since colors may have changed
    if (typeof Graph !== 'undefined') Graph.draw();
  }

  function exportCurrent() {
    let exportData;
    if (current === 'obsidian' || !BUILT_IN_THEMES[current]) {
      exportData = current === 'obsidian'
        ? OBSIDIAN_EXPORT
        : customThemes.find(t => t.id === current) || OBSIDIAN_EXPORT;
    } else {
      // Export a built-in as vars by reading computed styles
      const html = document.documentElement;
      const style = getComputedStyle(html);
      const varNames = ['--bg','--s1','--s2','--s3','--b1','--b2','--t1','--t2','--t3','--accent','--acc-fg','--danger','--ok','--warn','--r','--r-sm','--r-lg','--shadow','--shadow-lg','--font-ui','--font-body','--font-head'];
      const vars = {};
      varNames.forEach(v => { vars[v] = style.getPropertyValue(v).trim(); });
      const theme = BUILT_IN_THEMES[current];
      exportData = {
        id: current,
        name: theme.name,
        description: theme.description,
        version: '1.0',
        dark: theme.dark,
        vars,
        preview: theme.preview
      };
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sysmap-theme-${exportData.name.toLowerCase().replace(/\s+/g,'-')}.json`;
    a.click();
  }

  function importTheme() {
    document.getElementById('themeImportInput').click();
  }

  function handleImport(e) {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const theme = JSON.parse(ev.target.result);
        if (!theme.vars || !theme.name) { alert('Invalid theme file.'); return; }
        // Give it a unique id if needed
        if (!theme.id || BUILT_IN_THEMES[theme.id]) {
          theme.id = 'custom_' + Date.now().toString(36);
        }
        // Build preview if missing
        if (!theme.preview) {
          theme.preview = {
            bg: theme.vars['--bg'] || '#111',
            surface: theme.vars['--s2'] || '#222',
            accent: theme.vars['--accent'] || '#fff',
            dots: [
              theme.vars['--accent'] || '#fff',
              theme.vars['--ok'] || '#4ecdc4',
              theme.vars['--danger'] || '#f44',
              theme.vars['--warn'] || '#f90',
            ]
          };
        }
        // Remove existing with same id
        customThemes = customThemes.filter(t => t.id !== theme.id);
        customThemes.push(theme);
        localStorage.setItem('sysmap_custom_themes', JSON.stringify(customThemes));
        apply(theme.id);
        buildGrid();
        alert(`Theme "${theme.name}" imported!`);
      } catch(err) { alert('Invalid theme file.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function removeCustom(id) {
    customThemes = customThemes.filter(t => t.id !== id);
    localStorage.setItem('sysmap_custom_themes', JSON.stringify(customThemes));
    if (current === id) apply('obsidian');
    buildGrid();
  }

  function getCurrent() { return current; }
  function getNodeColor(cat) { return CAT_COLORS[cat] || '#888'; }

  return { init, apply, openPicker, close, select, exportCurrent, importTheme, handleImport, removeCustom, getCurrent, getNodeColor };
})();
