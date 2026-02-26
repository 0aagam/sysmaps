// ══════════════════════════════════════════════
// SYSMAP — MAIN APPLICATION
// Modules: Auth, DB, App, Graph, Blocks,
//          Glossary, Mobile, Landing
// ══════════════════════════════════════════════

firebase.initializeApp(FIREBASE_CONFIG);
const _auth = firebase.auth();
const _db   = firebase.firestore();
// No Firebase Storage — images stored as base64 in Firestore. Completely free.

// ── GLOBAL STATE ──
let STATE = {
  uid:       null,
  nodes:     [],
  activeId:  null,
  loaded:    false,
  connOpen:  false,
};

// ── DEBOUNCE SAVE ──
const _saveTimers = {};
function debounceSave(node, delay = 1800) {
  clearTimeout(_saveTimers[node.id]);
  DB.setSyncing('syncing');
  _saveTimers[node.id] = setTimeout(() => DB.persist(node), delay);
}
function saveImmediate(node) {
  clearTimeout(_saveTimers[node.id]);
  return DB.persist(node);
}

// ══════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════
const Auth = (() => {
  function signIn() {
    _auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(console.error);
  }
  function signOut() {
    if (confirm('Sign out?')) _auth.signOut();
  }
  _auth.onAuthStateChanged(user => {
    if (user) {
      STATE.uid = user.uid;
      document.getElementById('landing').classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');
      if (!STATE.loaded) {
        DB.loadAll();
        Glossary.load();
      }
    } else {
      STATE.uid = null;
      STATE.loaded = false;
      document.getElementById('landing').classList.remove('hidden');
      document.getElementById('app').classList.add('hidden');
    }
  });
  return { signIn, signOut };
})();

// ══════════════════════════════════════════════
// DATABASE
// ══════════════════════════════════════════════
const DB = (() => {
  function nodesRef() { return _db.collection('users').doc(STATE.uid).collection('nodes'); }
  function imagesRef() { return _db.collection('users').doc(STATE.uid).collection('images'); }
  function glossRef()  { return _db.collection('users').doc(STATE.uid).collection('glossary'); }

  function setSyncing(state) {
    const el = document.getElementById('syncIndicator');
    if (el) el.className = 'sync-indicator ' + state;
  }

  async function loadAll() {
    setSyncing('syncing');
    try {
      const snap = await nodesRef().orderBy('createdAt','asc').get();
      STATE.nodes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      STATE.loaded = true;
      App.render();
      setSyncing('synced');
    } catch(e) { console.error(e); setSyncing('error'); }
  }

  async function persist(node) {
    setSyncing('syncing');
    try {
      const { id, ...data } = node;
      await nodesRef().doc(id).set(data, { merge: true });
      setSyncing('synced');
    } catch(e) { console.error(e); setSyncing('error'); }
  }

  async function remove(nodeId) {
    setSyncing('syncing');
    try {
      await nodesRef().doc(nodeId).delete();
      // Remove associated images
      const imgs = await imagesRef().where('nodeId','==',nodeId).get();
      await Promise.all(imgs.docs.map(d => d.ref.delete()));
      setSyncing('synced');
    } catch(e) { console.error(e); setSyncing('error'); }
  }

  // Images stored as base64 in Firestore (free, no Storage needed)
  async function saveImage(nodeId, blockId, base64) {
    setSyncing('syncing');
    const id = `${nodeId}_${blockId}`;
    try {
      await imagesRef().doc(id).set({ nodeId, blockId, data: base64, createdAt: new Date().toISOString() });
      setSyncing('synced');
      return base64; // return as-is (base64 is the URL for img src)
    } catch(e) { console.error(e); setSyncing('error'); return null; }
  }

  async function loadImage(nodeId, blockId) {
    const id = `${nodeId}_${blockId}`;
    try {
      const doc = await imagesRef().doc(id).get();
      return doc.exists ? doc.data().data : null;
    } catch(e) { return null; }
  }

  async function deleteImage(nodeId, blockId) {
    try { await imagesRef().doc(`${nodeId}_${blockId}`).delete(); } catch(e) {}
  }

  return { loadAll, persist, remove, saveImage, loadImage, deleteImage, setSyncing, nodesRef, imagesRef, glossRef };
})();

// ══════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════
const App = (() => {
  function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,5); }

  // ── NEW NODE MODAL ──
  function openNewNodeModal() {
    document.getElementById('newNodeName').value = '';
    document.getElementById('modalOverlay').classList.remove('hidden');
    setTimeout(() => document.getElementById('newNodeName').focus(), 80);
  }
  function closeModal() { document.getElementById('modalOverlay').classList.add('hidden'); }

  async function createNode() {
    const name = document.getElementById('newNodeName').value.trim();
    if (!name) return;
    const cat = document.getElementById('newNodeCat').value;
    const cvs = document.getElementById('graphCanvas');
    const angle = STATE.nodes.length * 2.4;
    const r = 110 + STATE.nodes.length * 32;

    const node = {
      id: genId(),
      name, cat,
      nodeColor: null, // per-node override color
      connections: [],
      blocks: [],
      position: {
        x: cvs.width / 2 / Graph.scale - Graph.offset.x + Math.cos(angle) * r,
        y: cvs.height / 2 / Graph.scale - Graph.offset.y + Math.sin(angle) * r,
      },
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: new Date().toISOString(),
    };

    STATE.nodes.push(node);
    closeModal();
    await saveImmediate(node);
    render();
    openEditor(node.id);
  }

  // ── EDITOR ──
  function openEditor(id) {
    const n = STATE.nodes.find(x => x.id === id);
    if (!n) return;
    STATE.activeId = id;
    STATE.connOpen = false;

    const editor = document.getElementById('editor');
    editor.classList.remove('hidden');

    // Name
    document.getElementById('editorName').value = n.name;

    // Category badge
    const color = n.nodeColor || Themes.getNodeColor(n.cat);
    const badge = document.getElementById('editorCatBadge');
    badge.textContent = n.cat;
    badge.style.cssText = `border-color:${color};color:${color}`;

    // Theme row (node color picker)
    _buildNodeColorRow(n);

    // Conn panel
    document.getElementById('connPanel').classList.add('hidden');
    document.getElementById('editorConnBtn').classList.remove('active');

    // Blocks
    Blocks.render(n);

    // Status
    document.getElementById('saveStatus').textContent = '';

    // Mobile
    if (Mobile.isMobile()) {
      Mobile.show('editor');
    }

    renderSidebar();
    Graph.draw();
  }

  function _buildNodeColorRow(n) {
    const PALETTE = ['#f59e0b','#ff6b35','#ec4899','#4ecdc4','#a78bfa','#60a5fa','#c8ff00','#34d399','#fb7185','#e879f9'];
    const current = n.nodeColor || Themes.getNodeColor(n.cat);
    let html = `<span class="theme-label">Color</span>`;
    PALETTE.forEach(c => {
      html += `<div class="theme-swatch ${c===current?'active':''}" style="background:${c}" onclick="App.setNodeColor('${c}')"></div>`;
    });
    html += `<div class="theme-swatch" style="background:conic-gradient(#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)" title="Custom" onclick="document.getElementById('customColorPicker').click()"></div>`;
    html += `<input type="color" id="customColorPicker" style="position:absolute;opacity:0;width:0;height:0" value="${current}" onchange="App.setNodeColor(this.value)">`;
    document.getElementById('editorThemeRow').innerHTML = html;
  }

  function setNodeColor(color) {
    const n = STATE.nodes.find(x => x.id === STATE.activeId);
    if (!n) return;
    n.nodeColor = color;
    _buildNodeColorRow(n);
    const badge = document.getElementById('editorCatBadge');
    badge.style.cssText = `border-color:${color};color:${color}`;
    debounceSave(n);
    renderSidebar();
    Graph.draw();
  }

  function closeEditor() {
    STATE.activeId = null;
    document.getElementById('editor').classList.add('hidden');
    document.getElementById('connPanel').classList.add('hidden');
    if (Mobile.isMobile()) Mobile.show('graph');
    renderSidebar();
    Graph.draw();
  }

  function showGraph() {
    if (Mobile.isMobile()) Mobile.show('graph');
  }

  // ── CONNECTIONS PANEL ──
  function toggleConnPanel() {
    STATE.connOpen = !STATE.connOpen;
    const panel = document.getElementById('connPanel');
    const btn = document.getElementById('editorConnBtn');
    panel.classList.toggle('hidden', !STATE.connOpen);
    btn.classList.toggle('active', STATE.connOpen);
    if (STATE.connOpen) _buildConnPanel();
  }

  function _buildConnPanel() {
    const n = STATE.nodes.find(x => x.id === STATE.activeId);
    if (!n) return;
    const others = STATE.nodes.filter(x => x.id !== STATE.activeId);
    const inner = document.getElementById('connPanelInner');
    if (!others.length) {
      inner.innerHTML = `<span style="font-size:11px;color:var(--t3)">No other nodes yet.</span>`;
      return;
    }
    inner.innerHTML = others.map(o => {
      const linked = (n.connections||[]).includes(o.id);
      const color = o.nodeColor || Themes.getNodeColor(o.cat);
      return `<div class="conn-chip ${linked?'linked':''}" onclick="App.toggleConn('${o.id}')"
        ${linked?`style="border-color:${color};color:${color};background:${color}18"`:''}>${o.name}</div>`;
    }).join('');
  }

  async function toggleConn(otherId) {
    const n = STATE.nodes.find(x => x.id === STATE.activeId);
    const other = STATE.nodes.find(x => x.id === otherId);
    if (!n || !other) return;
    n.connections = n.connections || [];
    if (n.connections.includes(otherId)) {
      n.connections = n.connections.filter(c => c !== otherId);
      other.connections = (other.connections||[]).filter(c => c !== STATE.activeId);
    } else {
      n.connections.push(otherId);
      if (!(other.connections||[]).includes(STATE.activeId)) other.connections = [...(other.connections||[]), STATE.activeId];
    }
    await saveImmediate(n);
    await saveImmediate(other);
    _buildConnPanel();
    Graph.draw();
  }

  // ── SAVE ──
  async function saveNode() {
    const n = STATE.nodes.find(x => x.id === STATE.activeId);
    if (!n) return;
    n.name = document.getElementById('editorName').value.trim() || n.name;
    Blocks.collectContent();
    // Save draw/annotation canvases
    await Blocks.persistCanvases();
    n.updatedAt = new Date().toISOString();
    await saveImmediate(n);
    renderSidebar();
    Graph.draw();
    const btn = document.getElementById('saveBtn');
    const ts = document.getElementById('saveStatus');
    btn.textContent = 'Saved ✓';
    btn.style.background = 'var(--ok)';
    btn.style.borderColor = 'var(--ok)';
    btn.style.color = '#000';
    ts.textContent = 'Saved ' + new Date().toLocaleTimeString();
    setTimeout(() => {
      btn.textContent = 'Save';
      btn.style.cssText = '';
      btn.className = 'btn btn-primary btn-sm';
    }, 1600);
  }

  // ── DELETE NODE ──
  async function deleteNode() {
    if (!STATE.activeId || !confirm('Delete this node?')) return;
    const id = STATE.activeId;
    STATE.nodes = STATE.nodes.filter(n => n.id !== id);
    STATE.nodes.forEach(n => {
      n.connections = (n.connections||[]).filter(c => c !== id);
      saveImmediate(n);
    });
    await DB.remove(id);
    closeEditor();
    render();
  }

  // ── RENDER ──
  function render() {
    renderSidebar();
    Graph.draw();
    document.getElementById('graphEmpty').style.display = STATE.nodes.length ? 'none' : 'flex';
  }

  function renderSidebar() {
    const q = (document.getElementById('searchInput').value||'').toLowerCase();
    const list = document.getElementById('nodeList');
    const filtered = STATE.nodes.filter(n => {
      if (!q) return true;
      if (n.name.toLowerCase().includes(q)) return true;
      return (n.blocks||[]).some(b => b.type==='text' && (b.content||'').toLowerCase().includes(q));
    });

    if (!filtered.length) {
      list.innerHTML = `<div class="sidebar-empty">${STATE.nodes.length?'No results':'No nodes yet.<br><br>Click <strong>+ New</strong> to start.'}</div>`;
      return;
    }

    list.innerHTML = filtered.map(n => {
      const color = n.nodeColor || Themes.getNodeColor(n.cat);
      return `<div class="node-item ${n.id===STATE.activeId?'active':''}" onclick="App.openEditor('${n.id}')">
        <div class="node-item-stripe" style="background:${color}"></div>
        <div class="node-item-body">
          <div class="node-item-name">${n.name}</div>
          <div class="node-item-meta">${n.cat} · ${(n.blocks||[]).length}b · ${(n.connections||[]).length}c</div>
        </div>
        <div class="node-item-count">${(n.connections||[]).length > 0 ? '⬡'+n.connections.length : ''}</div>
      </div>`;
    }).join('');
  }

  function search(q) {
    renderSidebar();
    if (Mobile.isMobile()) Mobile.renderNodesList(q);
  }

  // ── EXPORT / IMPORT ──
  function exportData() {
    const blob = new Blob([JSON.stringify({
      version: 2,
      nodes: STATE.nodes,
      exportedAt: new Date().toISOString()
    }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sysmap-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  }

  function importData() { document.getElementById('importFileInput').click(); }

  async function handleImport(e) {
    const file = e.target.files[0]; if (!file) return;
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      const importNodes = data.nodes || [];
      if (!confirm(`Import ${importNodes.length} nodes? They will be added to your existing map.`)) return;
      for (const n of importNodes) {
        if (!STATE.nodes.find(x => x.id === n.id)) {
          STATE.nodes.push(n);
          await saveImmediate(n);
        }
      }
      render();
    } catch(err) { alert('Import failed — invalid file.'); }
    e.target.value = '';
  }

  // ── GRAPH LAYOUT ──
  function autoLayout() { Graph.autoLayout(); }

  return {
    openNewNodeModal, closeModal, createNode,
    openEditor, closeEditor, showGraph,
    toggleConnPanel, toggleConn,
    setNodeColor, saveNode, deleteNode,
    render, renderSidebar, search,
    exportData, importData, handleImport,
    autoLayout
  };
})();

// ══════════════════════════════════════════════
// GRAPH
// ══════════════════════════════════════════════
const Graph = (() => {
  let cvs, ctx, W, H;
  let scale = 1;
  let offset = { x: 0, y: 0 };
  let dragId = null, dragOff = { x: 0, y: 0 };
  let isPan = false, panStart = { x: 0, y: 0 }, moved = false;

  function init() {
    cvs = document.getElementById('graphCanvas');
    ctx = cvs.getContext('2d');
    resize();
    setupEvents();
  }

  function resize() {
    const wrap = document.getElementById('graphWrap');
    cvs.width = wrap.offsetWidth;
    cvs.height = wrap.offsetHeight;
    W = cvs.width; H = cvs.height;
    draw();
  }

  function w2s(p) { return { x: (p.x + offset.x) * scale, y: (p.y + offset.y) * scale }; }
  function s2w(p) { return { x: p.x / scale - offset.x, y: p.y / scale - offset.y }; }

  function zoom(f) {
    scale = Math.max(.15, Math.min(6, scale * f));
    draw();
  }

  function zoomFit() {
    if (!STATE.nodes.length) return;
    let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
    STATE.nodes.forEach(n => {
      if (!n.position) return;
      minX = Math.min(minX, n.position.x); maxX = Math.max(maxX, n.position.x);
      minY = Math.min(minY, n.position.y); maxY = Math.max(maxY, n.position.y);
    });
    const pad = 80;
    scale = Math.min((W-pad*2)/(maxX-minX||1), (H-pad*2)/(maxY-minY||1), 2);
    offset.x = W/2/scale - (minX+maxX)/2;
    offset.y = H/2/scale - (minY+maxY)/2;
    draw();
  }

  function autoLayout() {
    if (!STATE.nodes.length) return;
    const cx = W/2/scale - offset.x, cy = H/2/scale - offset.y;
    const cats = [...new Set(STATE.nodes.map(n => n.cat))];
    STATE.nodes.forEach(n => {
      const ci = cats.indexOf(n.cat);
      const inCat = STATE.nodes.filter(x => x.cat === n.cat);
      const ni = inCat.indexOf(n);
      const baseA = (ci / cats.length) * Math.PI * 2;
      const spread = (Math.PI * 2 / cats.length) * .7;
      const a = baseA + (ni / inCat.length) * spread - spread/2;
      const r = 140 + ni * 38;
      n.position = { x: cx + Math.cos(a)*r, y: cy + Math.sin(a)*r };
      saveImmediate(n);
    });
    draw();
  }

  function hitTest(wp) {
    return STATE.nodes.find(n => n.position && Math.hypot(n.position.x-wp.x, n.position.y-wp.y) < 15/Math.min(scale,1.6));
  }

  function draw() {
    if (!cvs) return;
    ctx.clearRect(0, 0, W, H);

    // Grid
    const style = getComputedStyle(document.documentElement);
    const b1 = style.getPropertyValue('--b1').trim();
    ctx.strokeStyle = b1;
    ctx.lineWidth = 1;
    const gs = 36 * scale;
    const ox = (offset.x * scale) % gs, oy = (offset.y * scale) % gs;
    for (let x = ox; x < W; x += gs) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = oy; y < H; y += gs) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

    if (!STATE.nodes.length) return;

    const t2 = style.getPropertyValue('--t2').trim();
    const b2 = style.getPropertyValue('--b2').trim();
    const s1 = style.getPropertyValue('--s1').trim();
    const t1 = style.getPropertyValue('--t1').trim();

    // Ensure positions
    STATE.nodes.forEach((n, i) => {
      if (!n.position) {
        const a = i * 2.4, r = 110 + i * 32;
        n.position = { x: W/2/scale-offset.x + Math.cos(a)*r, y: H/2/scale-offset.y + Math.sin(a)*r };
      }
    });

    // Edges
    const drawn = new Set();
    STATE.nodes.forEach(n => {
      (n.connections||[]).forEach(cid => {
        const key = [n.id, cid].sort().join('-');
        if (drawn.has(key)) return;
        drawn.add(key);
        const other = STATE.nodes.find(x => x.id === cid);
        if (!other?.position) return;
        const A = w2s(n.position), B = w2s(other.position);
        const isActive = n.id === STATE.activeId || cid === STATE.activeId;
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y);
        ctx.strokeStyle = isActive ? (n.nodeColor || Themes.getNodeColor(n.cat)) + '66' : b2;
        ctx.lineWidth = isActive ? 1.5 : 1;
        ctx.stroke();
      });
    });

    // Nodes
    STATE.nodes.forEach(n => {
      const sp = w2s(n.position);
      const color = n.nodeColor || Themes.getNodeColor(n.cat);
      const isActive = n.id === STATE.activeId;
      const r = (isActive ? 11 : 7) * Math.min(scale, 1.5);

      if (isActive) {
        ctx.beginPath(); ctx.arc(sp.x, sp.y, r+10, 0, Math.PI*2);
        ctx.fillStyle = color + '18'; ctx.fill();
        ctx.beginPath(); ctx.arc(sp.x, sp.y, r+5, 0, Math.PI*2);
        ctx.fillStyle = color + '28'; ctx.fill();
      }

      ctx.beginPath(); ctx.arc(sp.x, sp.y, r, 0, Math.PI*2);
      ctx.fillStyle = isActive ? color : color + '99'; ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = isActive ? 2 : 1; ctx.stroke();

      if (scale > 0.4) {
        const fs = Math.max(9, 11 * Math.min(scale, 1.4));
        ctx.fillStyle = isActive ? t1 : t2;
        ctx.font = `${isActive?'600 ':'400 '}${fs}px ${getComputedStyle(document.documentElement).getPropertyValue('--font-body') || 'Inter, sans-serif'}`;
        ctx.textAlign = 'center';
        ctx.fillText(n.name, sp.x, sp.y + r + 12 * Math.min(scale, 1.3));
      }
    });
  }

  function setupEvents() {
    cvs.addEventListener('mousedown', e => {
      const r = cvs.getBoundingClientRect();
      const wp = s2w({ x: e.clientX-r.left, y: e.clientY-r.top });
      moved = false;
      const hit = hitTest(wp);
      if (hit) { dragId = hit.id; dragOff = { x: hit.position.x-wp.x, y: hit.position.y-wp.y }; }
      else { isPan = true; panStart = { x: e.clientX, y: e.clientY }; }
    });

    cvs.addEventListener('mousemove', e => {
      const r = cvs.getBoundingClientRect();
      const sp = { x: e.clientX-r.left, y: e.clientY-r.top };
      const wp = s2w(sp);
      if (dragId) {
        moved = true;
        const n = STATE.nodes.find(x => x.id === dragId);
        if (n) { n.position = { x: wp.x+dragOff.x, y: wp.y+dragOff.y }; draw(); }
        return;
      }
      if (isPan) {
        moved = true;
        offset.x += (e.clientX-panStart.x)/scale;
        offset.y += (e.clientY-panStart.y)/scale;
        panStart = { x: e.clientX, y: e.clientY };
        draw(); return;
      }
      const hit = hitTest(wp);
      cvs.style.cursor = hit ? 'pointer' : 'grab';
      const tt = document.getElementById('graphTooltip');
      if (hit) {
        const color = hit.nodeColor || Themes.getNodeColor(hit.cat);
        tt.style.display = 'block';
        tt.style.left = (sp.x+14)+'px';
        tt.style.top = (sp.y-8)+'px';
        tt.innerHTML = `<strong style="color:${color}">${hit.name}</strong><br><span style="color:var(--t3);font-size:10px">${hit.cat} · ${(hit.connections||[]).length} connections · ${(hit.blocks||[]).length} blocks</span>`;
      } else {
        tt.style.display = 'none';
      }
    });

    cvs.addEventListener('mouseup', e => {
      if (dragId && moved) { const n = STATE.nodes.find(x=>x.id===dragId); if(n) saveImmediate(n); }
      if (!moved) {
        const r = cvs.getBoundingClientRect();
        const hit = hitTest(s2w({ x: e.clientX-r.left, y: e.clientY-r.top }));
        if (hit) App.openEditor(hit.id);
      }
      dragId = null; isPan = false;
    });

    cvs.addEventListener('wheel', e => {
      e.preventDefault();
      scale = Math.max(.15, Math.min(6, scale * (e.deltaY > 0 ? .9 : 1.1)));
      draw();
    }, { passive: false });

    // Touch
    let lastTD = 0, tArr = [];
    cvs.addEventListener('touchstart', e => {
      tArr = Array.from(e.touches); moved = false;
      if (tArr.length === 1) {
        const t = tArr[0], r = cvs.getBoundingClientRect();
        const wp = s2w({ x: t.clientX-r.left, y: t.clientY-r.top });
        const hit = hitTest(wp);
        if (hit) { dragId = hit.id; dragOff = { x: hit.position.x-wp.x, y: hit.position.y-wp.y }; }
        else { isPan = true; panStart = { x: t.clientX, y: t.clientY }; }
      } else if (tArr.length === 2) {
        lastTD = Math.hypot(tArr[0].clientX-tArr[1].clientX, tArr[0].clientY-tArr[1].clientY);
        dragId = null; isPan = false;
      }
    }, { passive: true });

    cvs.addEventListener('touchmove', e => {
      e.preventDefault();
      const ts = Array.from(e.touches);
      if (ts.length === 1 && (dragId || isPan)) {
        const t = ts[0], r = cvs.getBoundingClientRect();
        const wp = s2w({ x: t.clientX-r.left, y: t.clientY-r.top });
        moved = true;
        if (dragId) { const n = STATE.nodes.find(x=>x.id===dragId); if(n) n.position = { x: wp.x+dragOff.x, y: wp.y+dragOff.y }; }
        else if (isPan) { offset.x += (t.clientX-panStart.x)/scale; offset.y += (t.clientY-panStart.y)/scale; panStart = { x: t.clientX, y: t.clientY }; }
        draw();
      } else if (ts.length === 2) {
        const d = Math.hypot(ts[0].clientX-ts[1].clientX, ts[0].clientY-ts[1].clientY);
        scale = Math.max(.15, Math.min(6, scale*(d/lastTD)));
        lastTD = d; draw();
      }
    }, { passive: false });

    cvs.addEventListener('touchend', e => {
      if (dragId && moved) { const n = STATE.nodes.find(x=>x.id===dragId); if(n) saveImmediate(n); }
      if (!moved && e.changedTouches.length) {
        const t = e.changedTouches[0], r = cvs.getBoundingClientRect();
        const hit = hitTest(s2w({ x: t.clientX-r.left, y: t.clientY-r.top }));
        if (hit) App.openEditor(hit.id);
      }
      dragId = null; isPan = false;
    });
  }

  return { init, resize, draw, zoom, zoomFit, autoLayout, get scale() { return scale; }, get offset() { return offset; } };
})();

// ══════════════════════════════════════════════
// BLOCKS
// ══════════════════════════════════════════════
const Blocks = (() => {
  const _drawState = {}; // blockId → draw state
  const _annoState = {}; // blockId → annotation state
  let _savedRange = null;
  let _activeCommentEl = null;
  let _pendingImgBlockId = null;

  function genId() { return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2,4); }

  function render(n) {
    const area = document.getElementById('blocksArea');
    if (!n.blocks || !n.blocks.length) {
      area.innerHTML = `<div class="blocks-empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity=".4"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v8M8 12h8"/></svg>
        <div>Add your first block above</div>
        <div style="color:var(--t3);font-size:12px">Text · Draw · Image — in any order</div>
      </div>`;
      return;
    }
    area.innerHTML = '';
    n.blocks.forEach(block => {
      const el = _createBlockEl(block);
      area.appendChild(el);
    });
    n.blocks.forEach(block => {
      if (block.type === 'draw') _initDraw(block);
      if (block.type === 'image') _initImage(block);
    });
  }

  function add(type) {
    const n = STATE.nodes.find(x => x.id === STATE.activeId);
    if (!n) return;
    n.blocks = n.blocks || [];
    n.blocks.push({ id: genId(), type, content: '', annotations: '' });
    render(n);
    setTimeout(() => {
      const area = document.getElementById('blocksArea');
      area.scrollTop = area.scrollHeight;
    }, 80);
  }

  function remove(blockId) {
    const n = STATE.nodes.find(x => x.id === STATE.activeId);
    if (!n) return;
    n.blocks = n.blocks.filter(b => b.id !== blockId);
    // clean up images from DB
    DB.deleteImage(STATE.activeId, blockId);
    render(n);
  }

  function move(blockId, dir) {
    const n = STATE.nodes.find(x => x.id === STATE.activeId);
    if (!n) return;
    const i = n.blocks.findIndex(b => b.id === blockId);
    const ni = i + dir;
    if (ni < 0 || ni >= n.blocks.length) return;
    [n.blocks[i], n.blocks[ni]] = [n.blocks[ni], n.blocks[i]];
    render(n);
  }

  function collectContent() {
    const n = STATE.nodes.find(x => x.id === STATE.activeId);
    if (!n) return;
    n.blocks.forEach(block => {
      if (block.type === 'text') {
        const el = document.getElementById('bc-' + block.id);
        if (el) block.content = el.innerHTML;
      }
    });
  }

  async function persistCanvases() {
    const n = STATE.nodes.find(x => x.id === STATE.activeId);
    if (!n) return;
    for (const block of n.blocks) {
      if (block.type === 'draw') {
        const cvs = document.getElementById('dc-' + block.id);
        if (cvs) {
          const dataUrl = cvs.toDataURL('image/png');
          block.content = dataUrl;
        }
      }
      if (block.type === 'image' && block.content) {
        const anno = document.getElementById('ac-' + block.id);
        if (anno) {
          block.annotations = anno.toDataURL('image/png');
        }
      }
    }
  }

  function _createBlockEl(block) {
    const wrap = document.createElement('div');
    wrap.className = `block block-${block.type}`;
    wrap.id = `block-${block.id}`;

    const controls = `<div class="block-controls">
      <button class="block-ctrl" onclick="Blocks.move('${block.id}',-1)" title="Up">↑</button>
      <button class="block-ctrl" onclick="Blocks.move('${block.id}',1)" title="Down">↓</button>
      <button class="block-ctrl danger" onclick="Blocks.remove('${block.id}')" title="Delete">✕</button>
    </div>`;

    if (block.type === 'text') {
      wrap.innerHTML = `${controls}<div class="block-content" id="bc-${block.id}" contenteditable="true" spellcheck="false" data-ph="Start writing…">${block.content||''}</div>`;
      const ce = wrap.querySelector('.block-content');
      ce.addEventListener('focus', () => wrap.classList.add('focused'));
      ce.addEventListener('blur', () => { wrap.classList.remove('focused'); collectContent(); });
      ce.addEventListener('mouseup', _showFmtBar);
      ce.addEventListener('touchend', e => { setTimeout(() => _showFmtBar(e), 200); });
      ce.addEventListener('keyup', e => {
        if (e.key === 'Escape') { _hideFmtBar(); return; }
        collectContent();
        const n = STATE.nodes.find(x => x.id === STATE.activeId);
        if (n) debounceSave(n);
      });
    }

    else if (block.type === 'draw') {
      const COLORS = ['#c8ff00','#4ecdc4','#ff6b35','#a78bfa','#ec4899','#ffffff','#ff4444','#888888'];
      wrap.innerHTML = `${controls}
        <div class="draw-toolbar" id="dtb-${block.id}">
          <button class="draw-tool-btn active" onclick="Blocks.setDrawTool('${block.id}','pen',this)">Pen</button>
          <button class="draw-tool-btn" onclick="Blocks.setDrawTool('${block.id}','line',this)">Line</button>
          <button class="draw-tool-btn" onclick="Blocks.setDrawTool('${block.id}','rect',this)">Rect</button>
          <button class="draw-tool-btn" onclick="Blocks.setDrawTool('${block.id}','text',this)">Text</button>
          <button class="draw-tool-btn" onclick="Blocks.setDrawTool('${block.id}','eraser',this)">Erase</button>
          <div class="draw-sep"></div>
          <div style="display:flex;gap:3px;align-items:center">${COLORS.map((c,i)=>`<div class="draw-color-dot ${i===0?'active':''}" style="background:${c}" onclick="Blocks.setDrawColor('${block.id}','${c}',this)"></div>`).join('')}</div>
          <div class="draw-sep"></div>
          <input class="draw-size-input" type="number" value="2" min="1" max="40" id="dsz-${block.id}" title="Size">
          <button class="draw-tool-btn" onclick="Blocks.undoDraw('${block.id}')">↩</button>
          <button class="draw-tool-btn" onclick="Blocks.redoDraw('${block.id}')">↪</button>
          <button class="draw-tool-btn" onclick="Blocks.clearDraw('${block.id}')">Clear</button>
        </div>
        <canvas class="draw-canvas" id="dc-${block.id}" width="460" height="300"></canvas>`;
    }

    else if (block.type === 'image') {
      if (block.content) {
        wrap.innerHTML = `${controls}
          <div class="image-toolbar">
            <span style="font-size:10px;color:var(--t3);font-family:var(--font-ui);letter-spacing:1px">ANNOTATE</span>
            <button class="anno-toggle" id="at-${block.id}" onclick="Blocks.toggleAnno('${block.id}')">Off</button>
            <div class="anno-color-dot" id="ac-dot-${block.id}" style="background:#ff4444" onclick="Blocks.cycleAnnoColor('${block.id}')"></div>
            <button class="draw-tool-btn" onclick="Blocks.clearAnno('${block.id}')">Clear</button>
            <div style="flex:1"></div>
            <button class="draw-tool-btn" onclick="document.getElementById('fsViewer').classList.remove('hidden');document.getElementById('fsViewerImg').src='${block.content.slice(0,100)}...'">Expand</button>
          </div>
          <div class="img-wrap">
            <img src="${block.content}" id="img-${block.id}" onclick="document.getElementById('fsViewer').classList.remove('hidden');document.getElementById('fsViewerImg').src=this.src" alt="">
            <canvas class="anno-canvas" id="ac-${block.id}"></canvas>
          </div>`;
      } else {
        wrap.innerHTML = `${controls}
          <div class="img-upload-zone" onclick="Blocks.triggerImgUpload('${block.id}')">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" display="block" margin="0 auto 8px"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <div>Tap to upload image</div>
            <div style="font-size:11px;color:var(--t3)">Or Ctrl+V to paste from clipboard</div>
          </div>`;
      }
    }

    return wrap;
  }

  // ── DRAW ──
  function _initDraw(block) {
    const cvs = document.getElementById('dc-' + block.id);
    if (!cvs) return;
    _drawState[block.id] = _drawState[block.id] || { tool:'pen', color:'#c8ff00', size:2, history:[], redo:[], isDrawing:false, savedImg:null };
    const s = _drawState[block.id];
    const ctx = cvs.getContext('2d');
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--s2').trim() || '#181818';
    ctx.fillRect(0,0,cvs.width,cvs.height);
    if (block.content && block.content.startsWith('data:')) {
      const img = new Image();
      img.onload = () => { ctx.drawImage(img,0,0,cvs.width,cvs.height); _pushHistory(block.id,cvs); };
      img.src = block.content;
    } else { _pushHistory(block.id,cvs); }

    const getPos = e => {
      const r = cvs.getBoundingClientRect();
      const sx=cvs.width/r.width, sy=cvs.height/r.height;
      const cx=e.touches?e.touches[0].clientX:e.clientX;
      const cy=e.touches?e.touches[0].clientY:e.clientY;
      return { x:(cx-r.left)*sx, y:(cy-r.top)*sy };
    };

    cvs.onmousedown = cvs.ontouchstart = e => {
      if(e.touches) e.preventDefault();
      const p = getPos(e);
      s.isDrawing=true; s.savedImg=ctx.getImageData(0,0,cvs.width,cvs.height);
      if(s.tool==='text'){const t=prompt('Text:');if(t){ctx.fillStyle=s.color;ctx.font=`${s.size*5+10}px ${getComputedStyle(document.documentElement).getPropertyValue('--font-head')||'sans-serif'}`;ctx.fillText(t,p.x,p.y);_pushHistory(block.id,cvs);}s.isDrawing=false;return;}
      if(s.tool==='pen'||s.tool==='eraser'){ctx.beginPath();ctx.moveTo(p.x,p.y);}
      s.sx=p.x; s.sy=p.y;
    };
    cvs.onmousemove = cvs.ontouchmove = e => {
      if(e.touches) e.preventDefault();
      if(!s.isDrawing) return;
      const p = getPos(e);
      if(s.tool==='pen'){ctx.lineTo(p.x,p.y);ctx.strokeStyle=s.color;ctx.lineWidth=s.size;ctx.lineCap='round';ctx.lineJoin='round';ctx.globalCompositeOperation='source-over';ctx.stroke();}
      else if(s.tool==='eraser'){ctx.lineTo(p.x,p.y);ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--s2').trim()||'#181818';ctx.lineWidth=s.size*5;ctx.lineCap='round';ctx.globalCompositeOperation='source-over';ctx.stroke();}
      else{ctx.putImageData(s.savedImg,0,0);ctx.strokeStyle=s.color;ctx.lineWidth=s.size;ctx.globalCompositeOperation='source-over';if(s.tool==='line'){ctx.beginPath();ctx.moveTo(s.sx,s.sy);ctx.lineTo(p.x,p.y);ctx.stroke();}else if(s.tool==='rect'){ctx.beginPath();ctx.strokeRect(s.sx,s.sy,p.x-s.sx,p.y-s.sy);}}
    };
    const end = () => { if(!s.isDrawing)return; s.isDrawing=false; _pushHistory(block.id,cvs); };
    cvs.onmouseup=cvs.onmouseleave=end; cvs.ontouchend=end;
  }

  function _pushHistory(id, cvs) {
    const s = _drawState[id]; if(!s) return;
    s.history.push(cvs.getContext('2d').getImageData(0,0,cvs.width,cvs.height));
    if(s.history.length>40) s.history.shift();
    s.redo=[];
  }

  function setDrawTool(id, tool, btn) {
    if(_drawState[id]) _drawState[id].tool=tool;
    document.querySelectorAll(`#dtb-${id} .draw-tool-btn`).forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
  }

  function setDrawColor(id, color, el) {
    if(_drawState[id]) _drawState[id].color=color;
    document.querySelectorAll(`#dtb-${id} .draw-color-dot`).forEach(d=>d.classList.remove('active'));
    el.classList.add('active');
  }

  function undoDraw(id) {
    const s=_drawState[id]; if(!s||s.history.length<=1) return;
    const cvs=document.getElementById('dc-'+id); if(!cvs) return;
    s.redo.push(s.history.pop());
    cvs.getContext('2d').putImageData(s.history[s.history.length-1],0,0);
  }

  function redoDraw(id) {
    const s=_drawState[id]; if(!s||!s.redo.length) return;
    const cvs=document.getElementById('dc-'+id); if(!cvs) return;
    const st=s.redo.pop(); s.history.push(st);
    cvs.getContext('2d').putImageData(st,0,0);
  }

  function clearDraw(id) {
    const cvs=document.getElementById('dc-'+id); if(!cvs) return;
    const ctx=cvs.getContext('2d');
    ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--s2').trim()||'#181818';
    ctx.fillRect(0,0,cvs.width,cvs.height);
    _pushHistory(id,cvs);
  }

  // ── IMAGE / ANNOTATION ──
  function _initImage(block) {
    const img = document.getElementById('img-'+block.id);
    const anno = document.getElementById('ac-'+block.id);
    if (!img||!anno) return;
    _annoState[block.id] = {on:false, color:'#ff4444', isDrawing:false};
    img.onload = () => {
      anno.width=img.naturalWidth||img.clientWidth||400;
      anno.height=img.naturalHeight||img.clientHeight||300;
      if(block.annotations && block.annotations.startsWith('data:')) {
        const aimg=new Image(); aimg.crossOrigin='anonymous';
        aimg.onload=()=>anno.getContext('2d').drawImage(aimg,0,0);
        aimg.src=block.annotations;
      }
    };
    if(img.complete) img.onload();

    const getPos=e=>{const r=anno.getBoundingClientRect();const sx=anno.width/r.width,sy=anno.height/r.height;const cx=e.touches?e.touches[0].clientX:e.clientX,cy=e.touches?e.touches[0].clientY:e.clientY;return{x:(cx-r.left)*sx,y:(cy-r.top)*sy};};
    const ctx=anno.getContext('2d');
    anno.onmousedown=anno.ontouchstart=e=>{const s=_annoState[block.id];if(!s.on)return;e.preventDefault();const p=getPos(e);s.isDrawing=true;ctx.beginPath();ctx.moveTo(p.x,p.y);};
    anno.onmousemove=anno.ontouchmove=e=>{const s=_annoState[block.id];if(!s.on||!s.isDrawing)return;e.preventDefault();const p=getPos(e);ctx.lineTo(p.x,p.y);ctx.strokeStyle=s.color;ctx.lineWidth=3;ctx.lineCap='round';ctx.stroke();};
    const end=()=>{if(_annoState[block.id])_annoState[block.id].isDrawing=false;};
    anno.onmouseup=anno.onmouseleave=end;anno.ontouchend=end;
  }

  function toggleAnno(id) {
    const s=_annoState[id];if(!s)return;
    s.on=!s.on;
    const anno=document.getElementById('ac-'+id);
    const btn=document.getElementById('at-'+id);
    if(anno) anno.style.pointerEvents=s.on?'all':'none';
    if(btn){btn.textContent=s.on?'On':'Off';btn.classList.toggle('active',s.on);}
  }

  function cycleAnnoColor(id) {
    const s=_annoState[id];if(!s)return;
    const c=['#ff4444','#c8ff00','#4ecdc4','#ffffff','#a78bfa','#ff6b35'];
    s.color=c[(c.indexOf(s.color)+1)%c.length];
    const dot=document.getElementById('ac-dot-'+id);
    if(dot) dot.style.background=s.color;
  }

  function clearAnno(id) {
    const anno=document.getElementById('ac-'+id);if(!anno)return;
    anno.getContext('2d').clearRect(0,0,anno.width,anno.height);
  }

  function triggerImgUpload(blockId) {
    _pendingImgBlockId = blockId;
    document.getElementById('imgFileInput').click();
  }

  async function handleImageUpload(e) {
    const file=e.target.files[0];if(!file||!STATE.activeId||!_pendingImgBlockId)return;
    DB.setSyncing('syncing');
    const dataUrl=await _fileToDataUrl(file);
    const compressed=await _compress(dataUrl,680,0.68);
    const url=await DB.saveImage(STATE.activeId, _pendingImgBlockId, compressed);
    if(url){
      const n=STATE.nodes.find(x=>x.id===STATE.activeId);
      const block=n?.blocks.find(b=>b.id===_pendingImgBlockId);
      if(block){block.content=url;render(n);setTimeout(()=>_initImage(block),100);}
    }
    e.target.value='';
  }

  // Clipboard paste
  document.addEventListener('paste', async e => {
    if(!STATE.activeId) return;
    const items=e.clipboardData?.items;if(!items)return;
    for(const item of items){
      if(item.type.startsWith('image/')){
        const file=item.getAsFile();if(!file)continue;
        const n=STATE.nodes.find(x=>x.id===STATE.activeId);if(!n)return;
        let targetBlock=n.blocks?.find(b=>b.type==='image'&&!b.content);
        if(!targetBlock){targetBlock={id:genId(),type:'image',content:'',annotations:''};n.blocks=n.blocks||[];n.blocks.push(targetBlock);}
        _pendingImgBlockId=targetBlock.id;
        DB.setSyncing('syncing');
        const dataUrl=await _fileToDataUrl(file);
        const compressed=await _compress(dataUrl,680,0.68);
        const url=await DB.saveImage(STATE.activeId,targetBlock.id,compressed);
        if(url){targetBlock.content=url;render(n);setTimeout(()=>_initImage(targetBlock),100);}
        break;
      }
    }
  });

  // ── FORMAT BAR ──
  function _showFmtBar(e) {
    const sel=window.getSelection();
    if(!sel||sel.isCollapsed){_hideFmtBar();return;}
    _savedRange=sel.getRangeAt(0).cloneRange();
    const bar=document.getElementById('fmtBar');
    const x=e.clientX??e.changedTouches?.[0]?.clientX??0;
    const y=e.clientY??e.changedTouches?.[0]?.clientY??0;
    bar.style.left=Math.min(x-40,window.innerWidth-300)+'px';
    bar.style.top=(y-52)+'px';
    bar.classList.add('show');
  }

  function _hideFmtBar(){document.getElementById('fmtBar').classList.remove('show');_savedRange=null;}

  function fmt(cmd){document.execCommand(cmd,false,null);_hideFmtBar();collectContent();}

  function highlight(bg, border) {
    if(!_savedRange)return;
    const sel=window.getSelection();sel.removeAllRanges();sel.addRange(_savedRange);
    const mark=document.createElement('mark');
    mark.style.cssText=`background:${bg};border-radius:2px;padding:0 1px;border-bottom:2px solid ${border};cursor:pointer;`;
    mark.setAttribute('data-hl','1');
    try{_savedRange.surroundContents(mark);mark.onclick=ev=>_showCommentPopup(ev,mark);}catch(e){document.execCommand('hiliteColor',false,bg);}
    _hideFmtBar();collectContent();
  }

  function removeHighlight(){
    if(!_savedRange)return;
    const sel=window.getSelection();sel.removeAllRanges();sel.addRange(_savedRange);
    document.execCommand('removeFormat',false,null);
    _hideFmtBar();collectContent();
  }

  function addComment(){
    if(!_savedRange)return;
    const mark=document.createElement('mark');
    mark.style.cssText=`background:rgba(248,196,0,.2);border-radius:2px;padding:0 1px;border-bottom:2px dashed #f8c400;cursor:pointer;`;
    mark.setAttribute('data-hl','1');mark.setAttribute('data-comment','');
    try{_savedRange.surroundContents(mark);mark.onclick=ev=>_showCommentPopup(ev,mark);}catch(e){}
    _hideFmtBar();collectContent();
    const r=mark.getBoundingClientRect();
    _showCommentPopup({clientX:r.left,clientY:r.bottom+4},mark);
  }

  function _showCommentPopup(e,markEl){
    _activeCommentEl=markEl;
    const popup=document.getElementById('commentPopup');
    document.getElementById('commentQuote').textContent=markEl.textContent.slice(0,60)+(markEl.textContent.length>60?'…':'');
    document.getElementById('commentInput').value=markEl.getAttribute('data-comment')||'';
    const x=Math.min(e.clientX,window.innerWidth-280);
    const y=Math.min(e.clientY+8,window.innerHeight-200);
    popup.style.left=x+'px';popup.style.top=y+'px';
    popup.classList.remove('hidden');
    setTimeout(()=>document.getElementById('commentInput').focus(),80);
  }

  function saveComment(){
    if(!_activeCommentEl)return;
    _activeCommentEl.setAttribute('data-comment',document.getElementById('commentInput').value);
    _activeCommentEl.title=document.getElementById('commentInput').value;
    closeComment();collectContent();
  }

  function deleteComment(){
    if(!_activeCommentEl)return;
    const p=_activeCommentEl.parentNode;
    while(_activeCommentEl.firstChild)p.insertBefore(_activeCommentEl.firstChild,_activeCommentEl);
    p.removeChild(_activeCommentEl);
    closeComment();collectContent();
  }

  function closeComment(){document.getElementById('commentPopup').classList.add('hidden');_activeCommentEl=null;}

  // ── UTILS ──
  function _fileToDataUrl(f){return new Promise(res=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.readAsDataURL(f);});}
  function _compress(dataUrl,maxW,q){return new Promise(res=>{const i=new Image();i.onload=()=>{const c=document.createElement('canvas');let w=i.width,h=i.height;if(w>maxW){h=h*maxW/w;w=maxW;}c.width=w;c.height=h;c.getContext('2d').drawImage(i,0,0,w,h);res(c.toDataURL('image/jpeg',q));};i.src=dataUrl;});}

  return { render, add, remove, move, collectContent, persistCanvases, setDrawTool, setDrawColor, undoDraw, redoDraw, clearDraw, toggleAnno, cycleAnnoColor, clearAnno, triggerImgUpload, handleImageUpload, fmt, highlight, removeHighlight, addComment, saveComment, deleteComment, closeComment };
})();

// ══════════════════════════════════════════════
// GLOSSARY
// ══════════════════════════════════════════════
const Glossary = (() => {
  const DEFAULT_TERMS = [
    {term:'Node',def:"The basic unit of your map. Each node is a blank page — add text, drawings, or images in any order. Connect nodes to show relationships."},
    {term:'Block',def:"A unit of content inside a node. Can be text (with formatting and comments), a drawing canvas, or an image with annotation support."},
    {term:'Connection',def:"A link between two nodes shown as a line in the graph. Use the Connect button inside any node to link it to others."},
  ];
  let terms = [...DEFAULT_TERMS];

  function load() {
    DB.glossRef().get().then(snap => {
      const userTerms = snap.docs.map(d => d.data());
      if (userTerms.length) terms = [...DEFAULT_TERMS, ...userTerms];
      _render(terms);
    }).catch(() => {});
  }

  function open() {
    _render(terms);
    document.getElementById('glossaryOverlay').classList.remove('hidden');
  }
  function close() { document.getElementById('glossaryOverlay').classList.add('hidden'); }

  function search(q) {
    const filtered = q ? terms.filter(t => t.term.toLowerCase().includes(q.toLowerCase()) || t.def.toLowerCase().includes(q.toLowerCase())) : terms;
    _render(filtered);
  }

  function _render(list) {
    document.getElementById('glosList').innerHTML = list.map(t => `
      <div class="glos-item">
        <div class="glos-term">${t.term}</div>
        <div class="glos-def">${t.def}</div>
      </div>`).join('') || `<div style="color:var(--t3);font-size:12px;padding:16px 0">No results</div>`;
  }

  async function addTerm() {
    const term = document.getElementById('glosTerm').value.trim();
    const def = document.getElementById('glosDef').value.trim();
    if (!term || !def) return;
    const entry = { term, def };
    terms.push(entry);
    try { await DB.glossRef().add(entry); } catch(e) {}
    document.getElementById('glosTerm').value = '';
    document.getElementById('glosDef').value = '';
    _render(terms);
  }

  return { load, open, close, search, addTerm };
})();

// ══════════════════════════════════════════════
// MOBILE
// ══════════════════════════════════════════════
const Mobile = (() => {
  function isMobile() { return window.innerWidth <= 768; }

  function show(view) {
    if (!isMobile()) return;
    const graph = document.getElementById('graphWrap');
    const editor = document.getElementById('editor');
    const nodesOverlay = document.getElementById('mobNodesOverlay');
    const back = document.getElementById('headerBack');

    // Reset all
    graph?.classList.remove('mob-bg');
    editor?.classList.add('hidden');
    nodesOverlay?.classList.add('hidden');
    back?.classList.add('hidden');

    document.querySelectorAll('.mob-tab').forEach(t => t.classList.remove('active'));

    if (view === 'graph') {
      document.getElementById('mobTabGraph')?.classList.add('active');
    } else if (view === 'nodes') {
      nodesOverlay?.classList.remove('hidden');
      document.getElementById('mobTabNodes')?.classList.add('active');
      renderNodesList('');
    } else if (view === 'editor') {
      editor?.classList.remove('hidden');
      graph?.classList.add('mob-bg');
      back?.classList.remove('hidden');
    }
  }

  function showMore() { document.getElementById('mobSheetBg').classList.remove('hidden'); }
  function closeSheet() { document.getElementById('mobSheetBg').classList.add('hidden'); }

  function renderNodesList(q) {
    const filtered = q
      ? STATE.nodes.filter(n => n.name.toLowerCase().includes(q.toLowerCase()) || (n.blocks||[]).some(b=>b.type==='text'&&(b.content||'').toLowerCase().includes(q.toLowerCase())))
      : STATE.nodes;
    const list = document.getElementById('mobNodesList');
    if (!list) return;
    list.innerHTML = filtered.map(n => {
      const color = n.nodeColor || Themes.getNodeColor(n.cat);
      return `<div class="node-item" onclick="App.openEditor('${n.id}');Mobile.show('editor')">
        <div class="node-item-stripe" style="background:${color}"></div>
        <div class="node-item-body">
          <div class="node-item-name">${n.name}</div>
          <div class="node-item-meta">${n.cat} · ${(n.blocks||[]).length} blocks</div>
        </div>
      </div>`;
    }).join('') || `<div class="sidebar-empty">No nodes yet</div>`;
  }

  function search(q) { renderNodesList(q); }

  return { isMobile, show, showMore, closeSheet, renderNodesList, search };
})();

// ══════════════════════════════════════════════
// LANDING DEMO ANIMATION
// ══════════════════════════════════════════════
function initLandingDemo() {
  const cvs = document.getElementById('landCanvas');
  if (!cvs) return;
  const ctx = cvs.getContext('2d');
  const W = cvs.width, H = cvs.height;

  const nodes = [
    { label:'Central\nBank',  x:170, y:95,  color:'#ff6b35', r:30 },
    { label:'Money',          x:80,  y:195, color:'#c8ff00', r:24 },
    { label:'Interest\nRate', x:258, y:190, color:'#4ecdc4', r:22 },
    { label:'Bonds',          x:72,  y:288, color:'#a78bfa', r:18 },
    { label:'Inflation',      x:265, y:288, color:'#f59e0b', r:18 },
    { label:'Banks',          x:170, y:248, color:'#ec4899', r:20 },
  ];
  const edges = [[0,1],[0,2],[1,3],[2,4],[1,5],[2,5],[3,4]];

  let t = 0, active = 0;
  setInterval(() => { active = (active+1) % nodes.length; }, 2000);

  (function frame() {
    ctx.clearRect(0,0,W,H);
    t += .018;

    // bg grid
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1;
    for(let x=0;x<W;x+=28){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(let y=0;y<H;y+=28){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}

    edges.forEach(([a,b])=>{
      const na=nodes[a],nb=nodes[b];
      const isAct=a===active||b===active;
      ctx.beginPath();ctx.moveTo(na.x,na.y);ctx.lineTo(nb.x,nb.y);
      ctx.strokeStyle=isAct?na.color+'55':'#2a2a2a';ctx.lineWidth=isAct?1.5:1;ctx.stroke();
    });

    nodes.forEach((n,i)=>{
      const isAct=i===active;
      const pulse=isAct?Math.sin(t*3)*4:0;
      const r=n.r+pulse;
      if(isAct){ctx.beginPath();ctx.arc(n.x,n.y,r+11,0,Math.PI*2);ctx.fillStyle=n.color+'12';ctx.fill();ctx.beginPath();ctx.arc(n.x,n.y,r+5,0,Math.PI*2);ctx.fillStyle=n.color+'22';ctx.fill();}
      ctx.beginPath();ctx.arc(n.x,n.y,r,0,Math.PI*2);ctx.fillStyle=isAct?n.color:n.color+'88';ctx.fill();
      ctx.strokeStyle=n.color;ctx.lineWidth=isAct?2:1;ctx.stroke();
      ctx.fillStyle=isAct?'#e8e8e8':'#555';
      ctx.font=`${isAct?'600 ':'400 '}9px Inter,sans-serif`;ctx.textAlign='center';
      n.label.split('\n').forEach((line,li)=>ctx.fillText(line,n.x,n.y+r+12+li*11));
    });
    requestAnimationFrame(frame);
  })();
}

// ══════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ══════════════════════════════════════════════
document.addEventListener('keydown', e => {
  const inInput = ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName);
  const inCE = document.activeElement.contentEditable === 'true';
  if (e.key === 'Escape') {
    if (!document.getElementById('modalOverlay').classList.contains('hidden')) App.closeModal();
    else if (!document.getElementById('glossaryOverlay').classList.contains('hidden')) Glossary.close();
    else if (!document.getElementById('themeOverlay').classList.contains('hidden')) Themes.close();
    else { Blocks.closeComment(); document.getElementById('fmtBar').classList.remove('show'); }
  }
  if ((e.metaKey||e.ctrlKey) && e.key === 's') { e.preventDefault(); App.saveNode(); }
  if ((e.metaKey||e.ctrlKey) && e.key === 'n' && !inInput && !inCE) { e.preventDefault(); App.openNewNodeModal(); }
});

document.getElementById('newNodeName')?.addEventListener('keydown', e => { if(e.key==='Enter') App.createNode(); });

document.addEventListener('click', e => {
  if (!e.target.closest('#fmtBar') && !e.target.closest('.block-content')) {
    document.getElementById('fmtBar').classList.remove('show');
  }
  if (!e.target.closest('#commentPopup') && !e.target.closest('mark')) {
    Blocks.closeComment();
  }
});

// ══════════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════════
window.addEventListener('resize', () => {
  Graph.resize();
});

window.addEventListener('load', () => {
  Themes.init();
  Graph.init();
  initLandingDemo();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});
