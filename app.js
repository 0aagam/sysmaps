// ═══════════════════════════════════════════════════════════
// SYSMAP v5 — COMPLETE APPLICATION (Single file, no modules)
// ═══════════════════════════════════════════════════════════

// ── STATE ────────────────────────────────────────────────
const S = {
  uid:          null,
  folders:      [],
  activeFid:    null,
  nodes:        [],
  activeNid:    null,
  loaded:       false,
  pendingImgBlock: null,
};

// ── DEBOUNCE ──────────────────────────────────────────────
const _timers = {};
function debSave(node, delay=1800) {
  clearTimeout(_timers[node.id]);
  DB.sync('syncing');
  _timers[node.id] = setTimeout(() => DB.writeNode(node), delay);
}
function immSave(node) { clearTimeout(_timers[node.id]); return DB.writeNode(node); }

// ── TEMPLATES ─────────────────────────────────────────────
const TEMPLATES = [
  {
    id:'blank', name:'Blank', emoji:'○', color:'#8b8b8b',
    desc:'Empty canvas — your rules',
    blocks:[]
  },
  {
    id:'character', name:'Character', emoji:'🎭', color:'#a78bfa',
    desc:'Deep character breakdown for fiction & storytelling',
    blocks:[
      {type:'text',label:'Identity',ph:'Full name, age, appearance. What do people notice first?'},
      {type:'text',label:'Backstory',ph:'Where did they come from? The wound that defines them.'},
      {type:'text',label:'Core Motivation',ph:'What do they want above all else? What do they fear most?'},
      {type:'text',label:'Fatal Flaw',ph:'What pattern do they keep repeating? What blindspot do they have?'},
      {type:'text',label:'Voice & Mannerisms',ph:'How do they speak? What habits make them unmistakable?'},
      {type:'text',label:'Key Relationships',ph:'Who do they love? Who do they resent? How do they treat strangers?'},
      {type:'text',label:'Arc / Change',ph:'How do they change? What do they have to gain or lose?'},
      {type:'draw',label:'Visual Reference',ph:''},
    ]
  },
  {
    id:'concept', name:'Concept', emoji:'◇', color:'#60a5fa',
    desc:'Break down any idea, theory, or mental model',
    blocks:[
      {type:'text',label:'What it is',ph:'Define it simply. Explain it like you would to a curious 12-year-old.'},
      {type:'text',label:'How it works',ph:'The mechanism. Inputs, process, outputs — step by step.'},
      {type:'text',label:'Why it matters',ph:'What changes when this idea exists? Who cares and why?'},
      {type:'text',label:'Real examples',ph:'Concrete cases where this plays out in the world.'},
      {type:'text',label:'Common misconceptions',ph:'What do most people get wrong about this?'},
      {type:'text',label:'Failure modes',ph:'When does this break down? What are the edge cases?'},
      {type:'text',label:'Connects to',ph:'What other concepts link here? What does this depend on?'},
    ]
  },
  {
    id:'journal', name:'Journal', emoji:'📓', color:'#34d399',
    desc:'Daily reflection and honest thought capture',
    blocks:[
      {type:'text',label:'Today in one sentence',ph:'If you had to summarize today to a stranger — what would you say?'},
      {type:'text',label:'What happened',ph:'The events. Keep it factual: who, what, where.'},
      {type:'text',label:'How I felt',ph:'The honest emotional layer. What was underneath the surface?'},
      {type:'text',label:'What I noticed',ph:'About yourself, others, or the world. Patterns. Surprises.'},
      {type:'text',label:'What I\'m grateful for',ph:'Even on hard days. Especially on hard days.'},
      {type:'text',label:'Tomorrow\'s intention',ph:'One thing to carry forward, do differently, or let go of.'},
    ]
  },
  {
    id:'book', name:'Book Notes', emoji:'📚', color:'#fb923c',
    desc:'Capture, synthesize, and connect what you read',
    blocks:[
      {type:'text',label:'The book',ph:'Title, author, year. Why did you pick it up?'},
      {type:'text',label:'Core argument',ph:'What is the author really saying? The thesis in one paragraph.'},
      {type:'text',label:'Best ideas',ph:'The 3–5 ideas that will stay with you. Quote if needed.'},
      {type:'text',label:'What challenged me',ph:'Where did you disagree? What made you uncomfortable?'},
      {type:'text',label:'How I\'ll apply this',ph:'Specific things you\'ll carry into your life or work.'},
      {type:'text',label:'Verdict',ph:'Would you recommend it? To whom? What reader would love this?'},
    ]
  },
  {
    id:'research', name:'Research', emoji:'🔬', color:'#f43f5e',
    desc:'Structure investigations, sources, and findings',
    blocks:[
      {type:'text',label:'Research question',ph:'State it precisely. Vague questions have vague answers.'},
      {type:'text',label:'Hypothesis',ph:'What do you think the answer is, before you look?'},
      {type:'text',label:'Sources & evidence',ph:'Where are you looking? What did each source contribute?'},
      {type:'text',label:'Key findings',ph:'What did you actually discover? Facts, data, quotes.'},
      {type:'text',label:'Contradictions',ph:'Where do sources disagree? What is contested or uncertain?'},
      {type:'text',label:'Conclusion',ph:'Your best current answer to the question.'},
      {type:'text',label:'Next questions',ph:'What new questions opened up? What would you look at next?'},
    ]
  },
  {
    id:'project', name:'Project', emoji:'⚙️', color:'#0ea5e9',
    desc:'Plan, track and ship any project clearly',
    blocks:[
      {type:'text',label:'What we\'re building',ph:'The thing. What does success look like in concrete terms?'},
      {type:'text',label:'Why this matters',ph:'The reason this exists. Who benefits and how?'},
      {type:'text',label:'Milestones',ph:'Key checkpoints. What needs to happen and when?'},
      {type:'text',label:'Blockers & risks',ph:'What could go wrong? What are you most unsure about?'},
      {type:'text',label:'People & roles',ph:'Who is doing what? Who needs to stay in the loop?'},
      {type:'text',label:'Status',ph:'Where are things right now? What is the very next action?'},
    ]
  },
  {
    id:'worldbuilding', name:'World Building', emoji:'🌍', color:'#c084fc',
    desc:'Build fictional worlds, lore, and systems',
    blocks:[
      {type:'text',label:'Setting & era',ph:'Where and when? Describe the physical and temporal world.'},
      {type:'text',label:'Rules & systems',ph:'How does magic, technology, or power work here?'},
      {type:'text',label:'Factions & powers',ph:'Who are the major players? What do they want?'},
      {type:'text',label:'Key locations',ph:'Places that matter. Describe them so someone could draw them.'},
      {type:'text',label:'History & mythology',ph:'What happened before the story starts? What do people believe?'},
      {type:'text',label:'Tone & themes',ph:'What does this world feel like? What questions does it explore?'},
      {type:'draw',label:'Map / Sketch',ph:''},
    ]
  },
  {
    id:'goal', name:'Goal', emoji:'🎯', color:'#4ade80',
    desc:'Set, plan, and track meaningful goals',
    blocks:[
      {type:'text',label:'The goal',ph:'State it clearly. Specific enough that you\'ll know when you\'ve done it.'},
      {type:'text',label:'Why it matters',ph:'The real reason. Not the surface one — the one underneath.'},
      {type:'text',label:'Deadline',ph:'When? If it has no date, it\'s a wish.'},
      {type:'text',label:'Steps to get there',ph:'Break it down. What are the first 3 actions you can take this week?'},
      {type:'text',label:'Obstacles',ph:'What\'s in the way? What will you tell yourself when you want to quit?'},
      {type:'text',label:'Progress log',ph:'Update this as you go. Small wins count.'},
    ]
  },
  {
    id:'mentalmodel', name:'Mental Model', emoji:'🧠', color:'#fbbf24',
    desc:'Capture frameworks and lenses for better thinking',
    blocks:[
      {type:'text',label:'The model',ph:'Name it. Describe it in one sentence.'},
      {type:'text',label:'Core insight',ph:'The key idea. Why is this a useful lens?'},
      {type:'text',label:'How to apply it',ph:'Step by step. How do you actually use this when facing a problem?'},
      {type:'text',label:'Example in the wild',ph:'A real situation where this model helped or would have helped.'},
      {type:'text',label:'When it fails',ph:'Every model is wrong sometimes. When does this one mislead you?'},
      {type:'text',label:'Connects to',ph:'Related models. What complements or contradicts this?'},
    ]
  },
];

const CAT_COLORS = {
  concept:'#60a5fa', system:'#34d399', person:'#fb923c',
  place:'#f43f5e',   event:'#a78bfa',  thing:'#fbbf24', custom:'#8b8b8b'
};
const NODE_PALETTE = ['#60a5fa','#34d399','#fb923c','#f43f5e','#a78bfa','#fbbf24','#f472b6','#2dd4bf','#c084fc','#4ade80'];

function getCatColor(n) { return n.nodeColor || CAT_COLORS[n.cat] || '#8b8b8b'; }
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,5); }

// ── THEME ─────────────────────────────────────────────────
const Theme = {
  current: 'light',
  nodeAccent: null,
  init() { this.current = localStorage.getItem('theme') || 'light'; this._apply(); },
  set(t) { this.current = t; localStorage.setItem('theme', t); this._apply(); },
  _apply() { document.documentElement.setAttribute('data-theme', this.current); },
  setNodeAccent(c) { this.nodeAccent = c; localStorage.setItem('nodeAccent', c); },
  getPalette() { return NODE_PALETTE; },
};

// ── FIRESTORE ─────────────────────────────────────────────
const DB = {
  foldersRef() { return _db.collection('users').doc(S.uid).collection('folders'); },
  nodesRef()   { return _db.collection('users').doc(S.uid).collection('folders').doc(S.activeFid).collection('nodes'); },
  imagesRef()  { return _db.collection('users').doc(S.uid).collection('images'); },

  sync(state) { document.getElementById('syncPip').className = 'sync-pip ' + state; },

  async loadFolders() {
    try {
      const snap = await this.foldersRef().get();
      S.folders = snap.docs.map(d => ({id:d.id, ...d.data()}));
      Folders.render();
    } catch(e) { console.error('loadFolders:', e); DB.sync('error'); }
  },

  async writeFolder(f) {
    try { await this.foldersRef().doc(f.id).set(f); DB.sync('synced'); } 
    catch(e) { console.error('writeFolder:', e); DB.sync('error'); }
  },

  async deleteFolder(fid) {
    try { await this.foldersRef().doc(fid).delete(); await DB.loadFolders(); }
    catch(e) { console.error('deleteFolder:', e); }
  },

  async loadNodes(fid) {
    try {
      const snap = await _db.collection('users').doc(S.uid).collection('folders').doc(fid).collection('nodes').get();
      S.nodes = snap.docs.map(d => ({id:d.id, ...d.data()}));
      App.render();
    } catch(e) { console.error('loadNodes:', e); }
  },

  async writeNode(node) {
    try { await this.nodesRef().doc(node.id).set(node); DB.sync('synced'); }
    catch(e) { console.error('writeNode:', e); DB.sync('error'); }
  },

  async deleteNode(nid) {
    try { await this.nodesRef().doc(nid).delete(); S.nodes = S.nodes.filter(n=>n.id!==nid); App.render(); }
    catch(e) { console.error('deleteNode:', e); }
  },

  async saveImage(nodeId, blockId, b64) {
    try { await this.imagesRef().doc(nodeId+'_'+blockId).set({data:b64}); DB.sync('synced'); }
    catch(e) { console.error('saveImage:', e); }
  },

  async loadImage(nodeId, blockId) {
    try { const d = await this.imagesRef().doc(nodeId+'_'+blockId).get(); return d.data()?.data; }
    catch(e) { console.error('loadImage:', e); return null; }
  },

  async delImage(nodeId, blockId) {
    try { await this.imagesRef().doc(nodeId+'_'+blockId).delete(); }
    catch(e) { console.error('delImage:', e); }
  },
};

// ── AUTH –──────────────────────────────────────────────
const Auth = {
  init() {
    _auth.onAuthStateChanged(user => {
      if (user) {
        S.uid = user.uid;
        _renderTopbar(user);
        _showScreen('desktopScreen');
        DB.loadFolders();
      } else {
        _showScreen('authScreen');
        _initAuthCanvas();
      }
    });
    document.getElementById('signInBtn')?.addEventListener('click', () => {
      const provider = new firebase.auth.GoogleAuthProvider();
      _auth.signInWithPopup(provider);
    });
  }
};

function _renderTopbar(user) {
  const chip = document.getElementById('userChip');
  if (chip) chip.textContent = user.displayName?.split(' ')[0] || user.email;
  const greet = document.getElementById('greeting');
  if (greet) greet.textContent = 'Welcome, ' + (user.displayName?.split(' ')[0] || 'there') + '!';
}

// ── FOLDERS ───────────────────────────────────────────────
let _newFolderEmoji = '📁';
let _newFolderName  = '';
const FOLDER_EMOJIS = ['📁','🗂','⚡','🌊','🧠','🎯','📚','🌍','🎭','🔬','⚙️','🌱','💡','🏛','🎨','🔮','🗺','📓','💼','🎵'];

const Folders = {
  async loadAll() { await DB.loadFolders(); },

  render() {
    const grid = document.getElementById('foldersGrid');
    if (!grid) return;
    grid.innerHTML = S.folders.map(f => `
      <div class="folder-card" oncontextmenu="Folders.ctxMenu(event,'${f.id}')">
        <div class="fc-emoji">${f.emoji || '📁'}</div>
        <div class="fc-name">${f.name}</div>
        <div class="fc-meta">${f.nodes?.length || 0} nodes</div>
        <div class="fc-template">${f.template || 'blank'}</div>
      </div>
    `).join('');
    grid.addEventListener('click', (e) => {
      const card = e.target.closest('.folder-card');
      if (card) Folders.open(S.folders.find(f => f.name === card.querySelector('.fc-name').textContent).id);
    });
  },

  async open(fid) {
    S.activeFid = fid;
    const f = S.folders.find(x=>x.id===fid);
    document.getElementById('activeFolderName').textContent = f.name + ' ' + f.emoji;
    await DB.loadNodes(fid);
    _showScreen('workspaceScreen');
    _switchDock('workspace');
    Graph.init();
    Graph.draw();
  },

  create() {
    const name = document.getElementById('newFolderName').value || 'Untitled';
    if (!name) return;
    const folder = {
      id: genId(),
      name,
      emoji: _newFolderEmoji,
      template: 'blank',
      nodes: 0,
    };
    DB.writeFolder(folder);
    closeOverlay('newFolderOverlay');
    showOverlay('templateOverlay');
  },

  async createWithTemplate(tmplId) {
    const name = document.getElementById('newFolderName').value || 'Untitled';
    const folder = { id: genId(), name, emoji: _newFolderEmoji, template: tmplId, nodes: 0 };
    const tmpl = TEMPLATES.find(t => t.id === tmplId);
    if (tmpl?.blocks?.length) {
      const node = { id: genId(), name: 'Notes', cat: 'concept', blocks: tmpl.blocks.map(b => ({ ...b, id: genId(), content: '' })) };
      await DB.writeFolder(folder);
      S.activeFid = folder.id;
      S.nodes = [node];
      await DB.writeNode(node);
    } else {
      await DB.writeFolder(folder);
    }
    closeOverlay('templateOverlay');
    await Folders.open(folder.id);
  },

  ctxMenu(e, fid) { e.preventDefault(); if(confirm('Delete this space?')) DB.deleteFolder(fid); },
};

// ── MAIN APP – ──────────────────────────────────────────────
const App = {
  render() {
    const list = document.getElementById('nodeList');
    if (!list) return;
    const q = document.getElementById('searchInput')?.value || '';
    const filtered = S.nodes.filter(n => !q || n.name.toLowerCase().includes(q.toLowerCase()));
    list.innerHTML = filtered.map(n => `
      <div class="node-item ${n.id === S.activeNid ? 'active' : ''}" onclick="App.openEditor('${n.id}')">
        <div class="ni-dot" style="background:${getCatColor(n)}"></div>
        <div class="ni-info">
          <div class="ni-name">${n.name}</div>
          <div class="ni-meta">${n.cat}</div>
        </div>
      </div>
    `).join('');
  },

  renderSidebar() {
    const emojis = document.getElementById('folderEmojiRow');
    if (emojis) {
      emojis.innerHTML = FOLDER_EMOJIS.map(e => `
        <button class="emoji-opt ${e === _newFolderEmoji ? 'selected' : ''}" onclick="_newFolderEmoji='${e}'; document.querySelectorAll('.emoji-opt').forEach(x=>x.classList.remove('selected')); this.classList.add('selected')">${e}</button>
      `).join('');
    }
    const tmpl = document.getElementById('templateGrid');
    if (tmpl) {
      tmpl.innerHTML = TEMPLATES.map(t => `
        <div class="tmpl-card" onclick="Folders.createWithTemplate('${t.id}')">
          <div class="tmpl-emoji">${t.emoji}</div>
          <div class="tmpl-name">${t.name}</div>
          <div class="tmpl-desc">${t.desc}</div>
        </div>
      `).join('');
    }
    const themeChoices = document.getElementById('themeChoices');
    if (themeChoices) {
      themeChoices.innerHTML = ['light','dark'].map(t => `
        <div class="theme-choice ${t === Theme.current ? 'active' : ''}" onclick="Theme.set('${t}')">
          <div class="tc-preview" style="background:${t==='light'?'#ebe8e2':'#0f0e0c'}"></div>
          <div class="tc-name">${t}</div>
        </div>
      `).join('');
    }
    const palette = document.getElementById('nodePalette');
    if (palette) {
      palette.innerHTML = NODE_PALETTE.map(c => `
        <div class="pal-dot ${c === Theme.nodeAccent ? 'active' : ''}" style="background:${c}" onclick="Theme.setNodeAccent('${c}')"></div>
      `).join('');
    }
  },

  search(q) { this.render(); },

  openEditor(id) {
    S.activeNid = id;
    const node = S.nodes.find(n=>n.id===id);
    if (!node) return;
    
    const panel = document.getElementById('editorPanel');
    panel.classList.remove('closed');
    document.getElementById('editorName').value = node.name;
    document.getElementById('editorBadge').textContent = node.cat;
    _buildColorRow(node);
    _buildConnRow(node);
    Blocks.render(node);
    this.render();
  },

  closeEditor() {
    document.getElementById('editorPanel').classList.add('closed');
    S.activeNid = null;
    this.render();
  },

  async createNode() {
    const name = document.getElementById('newNodeName').value || 'Untitled';
    const cat = document.getElementById('newNodeCat').value || 'concept';
    const node = { id: genId(), name, cat, blocks: [], conns: [] };
    S.nodes.push(node);
    await DB.writeNode(node);
    closeOverlay('newNodeOverlay');
    document.getElementById('newNodeName').value = '';
    this.render();
  },

  async saveNode() {
    if (!S.activeNid) return;
    const node = S.nodes.find(n=>n.id===S.activeNid);
    if (node) {
      node.name = document.getElementById('editorName').value;
      await immSave(node);
    }
  },

  async deleteNode() {
    if (!S.activeNid || !confirm('Delete this node?')) return;
    await DB.deleteNode(S.activeNid);
    this.closeEditor();
  },

  async toggleConn(otherId) {
    if (!S.activeNid) return;
    const node = S.nodes.find(n=>n.id===S.activeNid);
    if (!node) return;
    if (!node.conns) node.conns = [];
    const idx = node.conns.indexOf(otherId);
    if (idx >= 0) node.conns.splice(idx, 1);
    else node.conns.push(otherId);
    _buildConnRow(node);
    debSave(node);
  },

  setNodeColor(c) {
    if (!S.activeNid) return;
    const node = S.nodes.find(n=>n.id===S.activeNid);
    if (node) { node.nodeColor = c; immSave(node); }
  },

  exportData() {
    const data = JSON.stringify(S.folders);
    const a = document.createElement('a');
    a.href = 'data:application/json;base64,' + btoa(data);
    a.download = 'sysmaps-backup.json';
    a.click();
  },

  importData() { document.getElementById('importInput').click(); },

  async handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const folders = JSON.parse(text);
    for (const f of folders) {
      f.id = genId();
      await DB.writeFolder(f);
      if (f.nodes) {
        for (const n of f.nodes) {
          n.id = genId();
          S.nodes.push(n);
        }
        S.activeFid = f.id;
        for (const n of S.nodes) await DB.writeNode(n);
      }
    }
    await DB.loadFolders();
  },

  signOut() {
    if (confirm('Sign out?')) _auth.signOut();
  },
};

// ── EDITOR HELPERS────────────────────────────────────────
function _buildColorRow(n) {
  const row = document.getElementById('editorColors');
  if(!row) return;
  const current = getCatColor(n);
  let html = `<span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:var(--t3);margin-right:2px">COLOR</span>`;
  NODE_PALETTE.forEach(c => {
    html += `<div class="color-swatch ${c === current ? 'active' : ''}" style="background:${c}" onclick="App.setNodeColor('${c}')"></div>`;
  });
  html += `<input type="color" value="${current}" style="width:18px;height:18px;border-radius:50%;border:none;cursor:pointer;padding:0;background:none;flex-shrink:0;outline:none" oninput="App.setNodeColor(this.value)">`;
  row.innerHTML = html;
}

function _buildConnRow(n) {
  const row = document.getElementById('editorConns');
  if(!row) return;
  const others = S.nodes.filter(x=>x.id!==S.activeNid);
  if (!others.length) { row.innerHTML = ''; return; }
  let html = `<span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:var(--t3);margin-right:2px">LINK</span>`;
  others.slice(0,12).forEach(o => {
    const linked = n.conns && n.conns.includes(o.id);
    html += `<div class="conn-chip ${linked?'linked':''}" style="border-color:${getCatColor(o)}" onclick="App.toggleConn('${o.id}')">${o.name}</div>`;
  });
  if(others.length>12) html += `<span style="font-size:10px;color:var(--t3)">+${others.length-12}</span>`;
  row.innerHTML = html;
}

// ── GRAPH ──────────────────────────────────────────── 
const Graph = {
  cvs: null, ctx: null, W: 0, H: 0,
  scale: 1, offset: {x:0,y:0},
  dragId: null, dragOff: {x:0,y:0},
  isPan: false, panStart: {x:0,y:0}, moved: false,

  init() {
    this.cvs = document.getElementById('graphCanvas');
    this.ctx = this.cvs.getContext('2d');
    this.W = this.cvs.offsetWidth;
    this.H = this.cvs.offsetHeight;
    this.cvs.width = this.W * window.devicePixelRatio;
    this.cvs.height = this.H * window.devicePixelRatio;
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    this._setupEvents();
    this.autoLayout();
  },

  resize() {
    if (!this.cvs) return;
    this.W = this.cvs.offsetWidth;
    this.H = this.cvs.offsetHeight;
  },

  w2s(p) { return {x: p.x * this.scale + this.offset.x, y: p.y * this.scale + this.offset.y}; },
  s2w(p) { return {x: (p.x - this.offset.x) / this.scale, y: (p.y - this.offset.y) / this.scale}; },

  zoom(f) { const old = this.scale; this.scale *= f; this.draw(); },

  zoomFit() {
    if (!S.nodes.length) { this.scale = 1; this.offset = {x:0,y:0}; return; }
    const pad = 60;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    S.nodes.forEach(n => {
      minX = Math.min(minX, n.x - 40);
      maxX = Math.max(maxX, n.x + 40);
      minY = Math.min(minY, n.y - 40);
      maxY = Math.max(maxY, n.y + 40);
    });
    const w = maxX - minX + pad*2, h = maxY - minY + pad*2;
    this.scale = Math.min(this.W / w, this.H / h);
    this.offset = {x: this.W/2 - (minX+maxX)/2*this.scale, y: this.H/2 - (minY+maxY)/2*this.scale};
    this.draw();
  },

  autoLayout() {
    if (!S.nodes.length) return;
    const n = S.nodes.length;
    const r = Math.sqrt((this.W*this.H) / (n * Math.PI)) * 0.4;
    S.nodes.forEach((node, i) => {
      const a = (i / n) * Math.PI * 2;
      node.x = r * Math.cos(a);
      node.y = r * Math.sin(a);
    });
    this.zoomFit();
  },

  hitTest(wp) { return S.nodes.find(n => Math.hypot(n.x-wp.x, n.y-wp.y) < 45); },

  draw() {
    const ctx = this.ctx;
    ctx.fillStyle = 'var(--bg)';
    ctx.fillRect(0, 0, this.W, this.H);

    S.nodes.forEach(n => n._zidx = 0);
    if (S.activeNid) {
      const active = S.nodes.find(n=>n.id===S.activeNid);
      if (active && active.conns?.length) {
        S.nodes.forEach(n => {
          if (active.conns.includes(n.id)) n._zidx = 2;
          else n._zidx = 0;
        });
      }
    }

    S.nodes.filter(n=>n._zidx!==2).forEach(n => {
      if (n.conns?.length) {
        n.conns.forEach(cid => {
          const other = S.nodes.find(x=>x.id===cid);
          if (other) {
            ctx.strokeStyle = getCatColor(n) + '60';
            ctx.lineWidth = n._zidx===2 ? 3 : 1;
            ctx.beginPath();
            ctx.moveTo(...Object.values(this.w2s({x:n.x,y:n.y})));
            ctx.lineTo(...Object.values(this.w2s({x:other.x,y:other.y})));
            ctx.stroke();
          }
        });
      }
    });

    S.nodes.forEach(n => {
      const ss = this.w2s({x:n.x,y:n.y});
      const r = 40;
      ctx.fillStyle = getCatColor(n);
      ctx.globalAlpha = n._zidx===0 && S.activeNid && !S.nodes.find(x=>x.id===S.activeNid)?.conns?.includes(n.id) ? 0.15 : 1;
      ctx.beginPath();
      ctx.arc(ss.x, ss.y, r, 0, Math.PI*2);
      ctx.fill();
      ctx.globalAlpha = 1;
      if (n.id === S.activeNid) {
        ctx.strokeStyle = getCatColor(n);
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.fillStyle = '#fff';
      ctx.font = '11px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(n.name.substring(0,12), ss.x, ss.y);
    });
  },

  _setupEvents() {
    this.cvs.addEventListener('mousedown', e => {
      const rect = this.cvs.getBoundingClientRect();
      const sp = {x: e.clientX - rect.left, y: e.clientY - rect.top};
      const wp = this.s2w(sp);
      const hit = this.hitTest(wp);
      if (hit && e.button === 0) {
        this.dragId = hit.id;
        this.dragOff = {x: wp.x - hit.x, y: wp.y - hit.y};
      } else if (e.button === 2) {
        this.isPan = true;
        this.panStart = sp;
      }
      this.moved = false;
    });
    document.addEventListener('mousemove', e => {
      if (!Graph.cvs) return;
      const rect = Graph.cvs.getBoundingClientRect();
      const sp = {x: e.clientX - rect.left, y: e.clientY - rect.top};
      const wp = Graph.s2w(sp);
      if (Graph.dragId) {
        const node = S.nodes.find(n=>n.id===Graph.dragId);
        if (node) {
          node.x = wp.x - Graph.dragOff.x;
          node.y = wp.y - Graph.dragOff.y;
          Graph.moved = true;
          Graph.draw();
        }
      } else if (Graph.isPan) {
        Graph.offset.x += sp.x - Graph.panStart.x;
        Graph.offset.y += sp.y - Graph.panStart.y;
        Graph.panStart = sp;
        Graph.draw();
      }
    });
    document.addEventListener('mouseup', e => {
      if (Graph.dragId && Graph.moved) {
        const node = S.nodes.find(n=>n.id===Graph.dragId);
        if (node) DB.writeNode(node);
      }
      Graph.dragId = null;
      Graph.isPan = false;
    });
    this.cvs.addEventListener('contextmenu', e => e.preventDefault());
    this.cvs.addEventListener('wheel', e => {
      e.preventDefault();
      Graph.zoom(e.deltaY > 0 ? 0.85 : 1.15);
    });
  },
};

// ── BLOCKS ────────────────────────────────────────────────
const _drawState = {}, _annoState = {};

const Blocks = {
  render(n) {
    const body = document.getElementById('editorBody');
    if (!body) return;
    if (!n.blocks) n.blocks = [];
    body.innerHTML = n.blocks.map((b,i) => {
      if (b.type === 'draw') {
        return `<div class="block" id="block_${b.id}">
          <div class="block-label">▪ ${b.label}</div>
          <canvas class="block-draw" id="canvas_${b.id}" width="400" height="200"></canvas>
          <div class="draw-toolbar" id="toolbar_${b.id}"></div>
          <div class="block-ctrls">
            <button class="block-ctrl" onclick="Blocks.remove('${b.id}')">✕</button>
          </div>
        </div>`;
      } else if (b.type === 'image') {
        return `<div class="block" id="block_${b.id}">
          <div class="block-label">▪ Image</div>
          <input type="file" accept="image/*" onchange="Blocks.handleImage(event,'${b.id}','${n.id}')">
          <div class="block-ctrls">
            <button class="block-ctrl" onclick="Blocks.remove('${b.id}')">✕</button>
          </div>
        </div>`;
      } else if (b.type === 'text' || b.type === 'heading') {
        return `<div class="block focused" id="block_${b.id}">
          <div class="block-label">${b.type==='heading'?'◆':'▪'} ${b.label}</div>
          <div class="block-content" id="content_${b.id}" contenteditable data-ph="${b.ph}" onblur="debSave(S.nodes.find(n=>n.id=='${n.id}'))">${b.content || ''}</div>
          <div class="block-ctrls">
            <button class="block-ctrl" onclick="Blocks.remove('${b.id}')">✕</button>
          </div>
        </div>`;
      } else if (b.type === 'divider') {
        return `<div class="block"><hr style="border:none;border-top:1px solid var(--b2);margin:8px 0"></div>`;
      }
      return '';
    }).join('');
  },

  add(type) {
    if (!S.activeNid) return;
    const node = S.nodes.find(n=>n.id===S.activeNid);
    if (!node) return;
    if (!node.blocks) node.blocks = [];
    node.blocks.push({id: genId(), type, label: type, content: '', ph: ''});
    this.render(node);
  },

  remove(bid) {
    if (!S.activeNid) return;
    const node = S.nodes.find(n=>n.id===S.activeNid);
    if (node) {
      node.blocks = node.blocks.filter(b=>b.id!==bid);
      this.render(node);
      debSave(node);
    }
  },

  async handleImage(e, bid, nid) {
    const file = e.target.files[0];
    if (!file) return;
    const b64 = await new Promise(r => {
      const reader = new FileReader();
      reader.onload = () => r(reader.result);
      reader.readAsDataURL(file);
    });
    await DB.saveImage(nid, bid, b64);
    const node = S.nodes.find(n=>n.id===nid);
    const block = node?.blocks?.find(b=>b.id===bid);
    if (block) block.content = b64;
    this.render(node);
  },

  fmt(cmd) {
    document.execCommand(cmd);
  },

  highlight(bg, color) {
    document.execCommand('backColor', false, bg);
  },
};

// ── INIT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  Theme.init();
  Auth.init();
  App.renderSidebar();
  document.addEventListener('click', e => {
    if (e.target.closest('.bab-btn')) {
      const type = e.target.closest('.bab-btn').dataset.type;
      Blocks.add(type);
    }
  });
});

function _showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id)?.classList.remove('hidden');
}

function _switchDock(mode) {
  document.getElementById('dockDesktop').classList.toggle('hidden', mode==='workspace');
  document.getElementById('dockWorkspace').classList.toggle('hidden', mode!=='workspace');
}

function goHome() {
  _showScreen('desktopScreen');
  _switchDock('desktop');
  App.closeEditor();
}

function openNewFolderModal() {
  showOverlay('newFolderOverlay');
}

function openNewNodeModal() {
  showOverlay('newNodeOverlay');
}

function openThemePanel() {
  showOverlay('themeOverlay');
}

function openMoreSheet() {
  showOverlay('moreOverlay');
}

function showOverlay(id) {
  document.getElementById(id)?.classList.add('show');
}

function closeOverlay(id) {
  document.getElementById(id)?.classList.remove('show');
}

document.addEventListener('click', e => {
  if (e.target.classList.contains('overlay')) {
    e.target.classList.remove('show');
  }
});

function _initAuthCanvas() {
  const cvs = document.getElementById('authCanvas');
  if (!cvs) return;
  const ctx = cvs.getContext('2d');
  const w = cvs.width, h = cvs.height;
  ctx.fillStyle = 'rgba(37,99,235,0.1)';
  for (let i = 0; i < 5; i++) {
    const x = Math.random() * w, y = Math.random() * h, r = Math.random() * 40 + 20;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI*2);
    ctx.fill();
  }
}

document.addEventListener('keydown', e => {
  if ((e.ctrlKey||e.metaKey) && e.key=== 's') { e.preventDefault(); if (S.activeNid) App.saveNode(); }
  if ((e.ctrlKey||e.metaKey) && e.key=== 'n') { e.preventDefault(); openNewNodeModal(); }
});
