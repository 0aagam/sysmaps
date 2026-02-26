// ══════════════════════════════════════════════
// SYSMAP — MAIN ENTRY POINT (ES6 MODULE)
// Coordinates module loading and initialization
// ══════════════════════════════════════════════

// Load environment variables first
import './env-loader.js';

import { FIREBASE_CONFIG, initializeFirebase } from './config.js';
import { Themes } from './themes.js';
import { 
  STATE, 
  debounceSave, 
  saveImmediate,
  Auth,
  DB,
  App,
  Graph,
  Blocks,
  Glossary,
  Mobile,
  initLandingDemo
} from './app.js';

// Initialize Firebase
const firebase = window.firebase;
const firebaseInstances = initializeFirebase();

// Attach modules to window for onclick handlers in HTML
window.STATE = STATE;
window.debounceSave = debounceSave;
window.saveImmediate = saveImmediate;
window.Auth = Auth;
window.DB = DB;
window.App = App;
window.Graph = Graph;
window.Blocks = Blocks;
window.Glossary = Glossary;
window.Mobile = Mobile;
window.Themes = Themes;

// Initialize app on load
window.addEventListener('load', () => {
  Themes.init();
  Graph.init();
  initLandingDemo();
  
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});

// Window resize handler
window.addEventListener('resize', () => {
  Graph.resize();
});

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
  const inCE = document.activeElement.contentEditable === 'true';
  
  if (e.key === 'Escape') {
    if (!document.getElementById('modalOverlay').classList.contains('hidden')) App.closeModal();
    else if (!document.getElementById('glossaryOverlay').classList.contains('hidden')) Glossary.close();
    else if (!document.getElementById('themeOverlay').classList.contains('hidden')) Themes.close();
    else { Blocks.closeComment(); document.getElementById('fmtBar').classList.remove('show'); }
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 's') { 
    e.preventDefault(); 
    App.saveNode(); 
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'n' && !inInput && !inCE) { 
    e.preventDefault(); 
    App.openNewNodeModal(); 
  }
});

document.getElementById('newNodeName')?.addEventListener('keydown', e => { 
  if (e.key === 'Enter') App.createNode(); 
});

document.addEventListener('click', e => {
  if (!e.target.closest('#fmtBar') && !e.target.closest('.block-content')) {
    document.getElementById('fmtBar').classList.remove('show');
  }
  if (!e.target.closest('#commentPopup') && !e.target.closest('mark')) {
    Blocks.closeComment();
  }
});
