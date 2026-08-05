/**
 * storage-modal.js
 * bunsekisan.jp 汎用ファイル保存・読み込みモーダル
 * 使い方: StorageModal.open({ toolName: 'chushutsu', data: [...], onLoad: (data) => {} })
 */

const StorageModal = (() => {
    let _config = {};

    // ── CSS注入 ──────────────────────────────────────────
    const css = `
#storage-modal-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.55);
    z-index: 9999;
    align-items: center;
    justify-content: center;
}
#storage-modal-overlay.active { display: flex; }
#storage-modal {
    background: #1e1e2e;
    color: #cdd6f4;
    border-radius: 12px;
    width: 520px;
    max-width: 95vw;
    padding: 24px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    font-family: sans-serif;
    overflow: visible;
}
#storage-modal h2 {
    margin: 0 0 18px;
    font-size: 1.1rem;
    color: #cba6f7;
    display: flex;
    align-items: center;
    gap: 8px;
}
.sm-section {
    border: 1px solid #313244;
    border-radius: 8px;
    padding: 12px 14px;
    margin-bottom: 12px;
}
.sm-section-title {
    font-size: 0.78rem;
    color: #a6adc8;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
.sm-btn-row { display: flex; gap: 8px; flex-wrap: wrap; }
.sm-btn {
    flex: 1;
    min-width: 120px;
    padding: 8px 12px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 600;
    transition: opacity 0.15s;
}
.sm-btn:hover { opacity: 0.85; }
.sm-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.sm-btn-primary   { background: #cba6f7; color: #1e1e2e; }
.sm-btn-secondary { background: #313244; color: #cdd6f4; }
.sm-btn-green     { background: #a6e3a1; color: #1e1e2e; }
.sm-btn-blue      { background: #89b4fa; color: #1e1e2e; }
.sm-status {
    font-size: 0.78rem;
    margin-top: 6px;
    min-height: 18px;
    color: #a6adc8;
}
.sm-connected  { color: #a6e3a1; }
.sm-disconnect { color: #f38ba8; }
.sm-file-list {
    max-height: 160px;
    overflow-y: auto;
    margin-top: 8px;
    font-size: 0.82rem;
}
.sm-file-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 6px;
    border-radius: 4px;
    cursor: pointer;
}
.sm-file-item:hover { background: #313244; }
.sm-file-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sm-file-date { color: #a6adc8; font-size: 0.75rem; margin-left: 8px; }
.sm-close-row { display: flex; justify-content: flex-end; margin-top: 14px; }
.sm-select {
    width: 100%;
    background: #313244;
    color: #cdd6f4;
    border: 1px solid #45475a;
    border-radius: 6px;
    padding: 8px 10px;
    font-size: 0.9rem;
    margin-top: 6px;
    min-height: 36px;
    cursor: pointer;
}
`;

    function injectCSS() {
        if (document.getElementById('storage-modal-style')) return;
        const style = document.createElement('style');
        style.id = 'storage-modal-style';
        style.textContent = css;
        document.head.appendChild(style);
    }

    function buildHTML() {
        if (document.getElementById('storage-modal-overlay')) return;
        document.body.insertAdjacentHTML('beforeend', `
<div id="storage-modal-overlay">
  <div id="storage-modal">
    <h2>📁 Save File</h2>

    <!-- ローカル -->
    <div class="sm-section">
      <div class="sm-section-title">💾 Local</div>
      <div class="sm-btn-row">
        <button class="sm-btn sm-btn-secondary" id="sm-save-json">Save as JSON</button>
        <button class="sm-btn sm-btn-secondary" id="sm-save-csv">Save as CSV</button>
      </div>
    </div>

    <!-- GakuninRDM -->
    <div class="sm-section">
      <div class="sm-section-title">🏛 GakuninRDM <span id="sm-rdm-badge"></span></div>
      <div id="sm-rdm-content">
        <div class="sm-btn-row">
          <button class="sm-btn sm-btn-primary" id="sm-rdm-connect">Connect</button>
        </div>
      </div>
      <div class="sm-status" id="sm-rdm-status"></div>
    </div>

    <!-- Google Drive -->
    <div class="sm-section">
      <div class="sm-section-title">☁️ Google Drive <span id="sm-gdrive-badge"></span></div>
      <div id="sm-gdrive-content">
        <div class="sm-btn-row">
          <button class="sm-btn sm-btn-blue" id="sm-gdrive-connect">Connect</button>
        </div>
      </div>
      <div class="sm-status" id="sm-gdrive-status"></div>
    </div>

    <div class="sm-close-row">
      <button class="sm-btn sm-btn-secondary" id="sm-close" style="flex:none;min-width:80px">Close</button>
    </div>
  </div>
</div>
        `);
    }

    async function checkStatus() {
        // セッション全体
        const ses = await fetch('/session/status', { credentials: 'include' }).then(r => r.json()).catch(() => ({}));
        // Google Drive
        const gd  = await fetch('/session/gdrive/status', { credentials: 'include' }).then(r => r.json()).catch(() => ({}));
        return { session: ses, gdrive: gd };
    }

    async function renderStatus() {
        const { session, gdrive } = await checkStatus();

        // --- RDM ---
        const rdmBadge   = document.getElementById('sm-rdm-badge');
        const rdmContent = document.getElementById('sm-rdm-content');
        const rdmStatus  = document.getElementById('sm-rdm-status');

        if (session.rdm_token) {
            rdmBadge.innerHTML   = '<span class="sm-connected">✅ Connected</span>';
            rdmStatus.textContent = session.full_name ? `👤 ${session.full_name}` : `User ID: ${session.user_id}`;
            rdmContent.innerHTML  = `
                <label style="font-size:0.8rem;color:#a6adc8;display:block;margin-bottom:4px">Target project:</label>
                <select class="sm-select" id="sm-rdm-project" style="margin-bottom:8px;width:100%;min-height:40px;font-size:1rem;padding:8px;box-sizing:border-box">
                    <option value="">Loading...</option>
                </select>
                <div class="sm-btn-row">
                    <button class="sm-btn sm-btn-primary" id="sm-rdm-save">Save to GakuninRDM</button>
                </div>
            `;
            loadRdmProjects();
            document.getElementById('sm-rdm-save').onclick = saveToRdm;
        } else {
            rdmBadge.innerHTML   = '<span class="sm-disconnect">Not connected</span>';
            rdmContent.innerHTML = `<div class="sm-btn-row">
                <button class="sm-btn sm-btn-primary" id="sm-rdm-connect">Connect</button>
            </div>`;
            document.getElementById('sm-rdm-connect').onclick = () => {
                const next = encodeURIComponent(location.pathname + '?storage_modal=1');
                location.href = '/auth/rdm/login?redirect_to=' + next;
            };
        }

        // --- Google Drive ---
        const gdBadge   = document.getElementById('sm-gdrive-badge');
        const gdContent = document.getElementById('sm-gdrive-content');
        const gdStatus  = document.getElementById('sm-gdrive-status');

        if (gdrive.connected) {
            gdBadge.innerHTML   = '<span class="sm-connected">✅ Connected</span>';
            gdStatus.textContent = gdrive.email || '';
            gdContent.innerHTML  = `
                <div class="sm-status sm-connected" style="margin-bottom:6px">📧 ${gdrive.email || ''}</div>
                <select class="sm-select" id="sm-gd-folder">
                    <option value="root">📁 My Drive (root)</option>
                </select>
                <div class="sm-btn-row" style="margin-top:8px">
                    <button class="sm-btn sm-btn-blue" id="sm-gd-save">Save to Drive</button>
                    <button class="sm-btn sm-btn-secondary" id="sm-gd-disconnect">Disconnect</button>
                </div>
            `;
            document.getElementById('sm-gd-save').onclick = saveToGDrive;
            document.getElementById('sm-gd-disconnect').onclick = async () => {
                if (confirm('Disconnect from Google Drive?')) {
                    await fetch('/auth/google/logout', { credentials: 'include', redirect: 'manual' });
                    window.location.reload();
                }
            };
            loadGDriveFolders();
        } else {
            gdBadge.innerHTML   = '<span class="sm-disconnect">Not connected</span>';
            gdContent.innerHTML = `<div class="sm-btn-row">
                <button class="sm-btn sm-btn-blue" id="sm-gdrive-connect">Connect</button>
            </div>`;
            document.getElementById('sm-gdrive-connect').onclick = () => {
                const next = encodeURIComponent(location.pathname + '?storage_modal=1');
                location.href = '/auth/google/login?redirect_to=' + next;
            };
        }
    }

    async function loadRdmProjects() {
        const sel = document.getElementById('sm-rdm-project');
        if (!sel) return;
        const projects = await fetch('/session/rdm/projects', { credentials: 'include' }).then(r => r.json()).catch(() => []);
        sel.innerHTML = projects.map(p => `<option value="${p.id}">${p.title}</option>`).join('');
    }

    async function saveToRdm() {
        const sel = document.getElementById('sm-rdm-project');
        const project_id = sel ? sel.value : '';
        if (!project_id) { alert('Please select a project.'); return; }
        if (_config.data) {
            await fetch(`/session/save/${_config.toolName}`, {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: _config.data })
            });
        }
        const status = document.getElementById('sm-rdm-status');
        status.textContent = 'Uploading...';
        const res = await fetch(`/session/rdm/upload/${_config.toolName}`, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project_id })
        }).then(r => r.json()).catch(e => ({ error: e.message }));
        status.textContent = res.status === 'uploaded'
            ? `✅ Saved: ${res.filename}`
            : `❌ Error: ${res.error}`;
    }

    async function loadFromRdm() {
        try {
            const rdmStatus = document.getElementById('sm-rdm-status');
            if (rdmStatus) rdmStatus.textContent = 'Loading...';
            const res = await fetch(`/session/load/${_config.toolName}`, {
                credentials: 'include'
            }).then(r => r.ok ? r.json() : null).catch(() => null);
            if (!res || res.error) {
                if (rdmStatus) rdmStatus.textContent = '';
                alert('No data available. Please save to GakuninRDM first.');
                return;
            }
            if (rdmStatus) rdmStatus.textContent = '✅ Loaded';
            if (typeof _config.onLoad === 'function') _config.onLoad(res);
            setTimeout(() => _closeModal(), 300);
        } catch(e) {
            console.error('loadFromRdm error:', e);
            alert('Load error: ' + e.message);
        }
    }
    async function loadGDriveFolders() {
        const sel = document.getElementById('sm-gd-folder');
        if (!sel) return;
        const res = await fetch('/session/gdrive/files?folder_id=root', { credentials: 'include' }).then(r => r.json()).catch(() => ({}));
        const folders = (res.files || []).filter(f => f.mimeType === 'application/vnd.google-apps.folder');
        folders.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.id;
            opt.textContent = '📁 ' + f.name;
            sel.appendChild(opt);
        });
    }

    async function loadGDriveFiles(folder_id = 'root') {
        const container = document.getElementById('sm-gd-files');
        if (!container) return;
        container.innerHTML = '<div style="color:#a6adc8;padding:4px">Loading...</div>';
        const res = await fetch(`/session/gdrive/files?folder_id=${folder_id}`, { credentials: 'include' }).then(r => r.json()).catch(() => ({}));
        const files = res.files || [];
        if (!files.length) { container.innerHTML = '<div style="color:#a6adc8;padding:4px">No files</div>'; return; }
        container.innerHTML = files.map(f => {
            const icon = f.mimeType === 'application/vnd.google-apps.folder' ? '📁' : '📄';
            const date = f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString('ja') : '';
            return `<div class="sm-file-item" data-id="${f.id}" data-type="${f.mimeType}" data-name="${f.name}">
                <span class="sm-file-name">${icon} ${f.name}</span>
                <span class="sm-file-date">${date}</span>
            </div>`;
        }).join('');
        container.querySelectorAll('.sm-file-item').forEach(el => {
            el.onclick = () => {
                if (el.dataset.type === 'application/vnd.google-apps.folder') {
                    loadGDriveFiles(el.dataset.id);
                } else {
                    downloadFromGDrive(el.dataset.id, el.dataset.name);
                }
            };
        });
    }

    async function saveToGDrive() {
        if (_config.data) {
            await fetch(`/session/save/${_config.toolName}`, {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: _config.data })
            });
        }
        const folderSel = document.getElementById('sm-gd-folder');
        const folder_id = folderSel ? folderSel.value : 'root';
        const status = document.getElementById('sm-gdrive-status');
        status.textContent = 'Uploading...';
        const res = await fetch(`/session/gdrive/upload/${_config.toolName}`, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folder_id })
        }).then(r => r.json()).catch(e => ({ error: e.message }));
        status.textContent = res.status === 'uploaded'
            ? `✅ Saved: ${res.filename}`
            : `❌ Error: ${res.error}`;
    }

    async function downloadFromGDrive(file_id, name) {
        const status = document.getElementById('sm-gdrive-status');
        status.textContent = `Loading: ${name}`;
        const res = await fetch(`/session/gdrive/download/${file_id}`, { credentials: 'include' }).then(r => r.json()).catch(e => ({ error: e.message }));
        if (res.status === 'downloaded') {
            // local_pathからファイルの中身を取得
            const data = await fetch(`/session/gdrive/serve?path=${encodeURIComponent(res.local_path)}`, { credentials: 'include' }).then(r => r.json()).catch(() => null);
            if (data && _config.onLoad) { _config.onLoad(data); _closeModal(); }
            else status.textContent = '✅ Saved to session';
        } else {
            status.textContent = `❌ Error: ${res.error}`;
        }
    }

    function _closeModal() {
        const overlay = document.getElementById('storage-modal-overlay');
        if (overlay) overlay.classList.remove('active');
    }

    function open(config = {}) {
        _config = config;
        injectCSS();
        buildHTML();

        document.getElementById('sm-close').onclick = _closeModal;
        document.getElementById('storage-modal-overlay').onclick = (e) => {
            if (e.target.id === 'storage-modal-overlay') _closeModal();
        };

        // ローカル保存
        document.getElementById('sm-save-json').onclick = () => {
            if (!_config.onSaveJSON) return;
            _config.onSaveJSON();
            close();
        };
        document.getElementById('sm-save-csv').onclick = () => {
            if (!_config.onSaveCSV) return;
            _config.onSaveCSV();
            close();
        };

        // ストレージ状態を反映
        renderStatus();

        // ログイン後の自動オープン
        const params = new URLSearchParams(location.search);
        if (params.get('storage_modal') === '1') {
            history.replaceState({}, '', location.pathname);
        }

        document.getElementById('storage-modal-overlay').classList.add('active');


    }

    return { open, close: _closeModal };
    return { open, close: _closeModal };
})();

// ── 接続状態バー ─────────────────────────────────────────
async function updateConnectionStatusBar() {
    const rdmBadge    = document.getElementById('rdmStatusBadge');
    const gdriveBadge = document.getElementById('gdriveStatusBadge');
    if (!rdmBadge && !gdriveBadge) return;

    const session = await fetch('/session/status', {credentials:'include'}).then(r=>r.json()).catch(()=>({}));

    if (rdmBadge) {
        if (session.rdm_token) {
            rdmBadge.innerHTML = '<span style="color:#16a34a">🏛 RDM: Connected</span>' +
                ' <span style="color:#6b7280;font-size:0.75rem;text-decoration:underline;cursor:pointer" onclick="event.stopPropagation();rdmLogout()">Disconnect</span>';
        } else {
            rdmBadge.innerHTML = '<span style="color:#dc2626">🏛 RDM: Not connected</span>' +
                ' <span style="color:#2563eb;font-size:0.75rem;text-decoration:underline;cursor:pointer" onclick="event.stopPropagation();handleRdmAuth()">Connect</span>';
        }
    }

    if (gdriveBadge) {
        if (session.gdrive_connected) {
            var email = session.gdrive_email ? ' (' + session.gdrive_email + ')' : '';
            gdriveBadge.innerHTML = '<span style="color:#16a34a">☁️ Drive: Connected' + email + '</span>' +
                ' <span style="color:#6b7280;font-size:0.75rem;text-decoration:underline;cursor:pointer" onclick="event.stopPropagation();gdriveLogout()">Disconnect</span>';
        } else {
            gdriveBadge.innerHTML = '<span style="color:#dc2626">☁️ Drive: Not connected</span>' +
                ' <span style="color:#2563eb;font-size:0.75rem;text-decoration:underline;cursor:pointer" onclick="event.stopPropagation();handleGdriveAuth()">Connect</span>';
        }
    }
}

function handleRdmAuth() {
    fetch('/session/status', {credentials:'include'}).then(r=>r.json()).then(function(session) {
        if (session.rdm_token) {
            // 接続済み→モーダルを開く
            StorageModal.open({
                toolName: 'chushutsu',
                data: window.app ? window.app.savedData : [],
                onSaveJSON: () => window.app && window.app.exportAsJSON(),
                onSaveCSV:  () => window.app && window.app.exportAsCSV(),
                onLoad: function(data) {
                    if (data.data && Array.isArray(data.data) && window.app) {
                        window.app.savedData = data.data;
                        window.app.updateDataDisplay();
                    }
                }
            });
        } else {
            var next = encodeURIComponent(location.pathname + '?storage_modal=1');
            location.href = '/auth/rdm/login?redirect_to=' + next;
        }
    });
}

function handleGdriveAuth() {
    fetch('/session/status', {credentials:'include'}).then(r=>r.json()).then(function(session) {
        if (session.gdrive_connected) {
            StorageModal.open({
                toolName: 'chushutsu',
                data: window.app ? window.app.savedData : [],
                onSaveJSON: () => window.app && window.app.exportAsJSON(),
                onSaveCSV:  () => window.app && window.app.exportAsCSV(),
                onLoad: function(data) {
                    if (data.data && Array.isArray(data.data) && window.app) {
                        window.app.savedData = data.data;
                        window.app.updateDataDisplay();
                    }
                }
            });
        } else {
            var next = encodeURIComponent(location.pathname + '?storage_modal=1');
            location.href = '/auth/google/login?redirect_to=' + next;
        }
    });
}

function rdmLogout() {
    if (confirm('Disconnect from GakuninRDM?')) {
        fetch('/auth/rdm/logout', {credentials:'include', redirect:'manual'}).finally(function() {
            updateConnectionStatusBar();
        });
    }
}

function gdriveLogout() {
    if (confirm('Disconnect from Google Drive?')) {
        fetch('/auth/google/logout', {credentials:'include', redirect:'manual'}).finally(function() {
            updateConnectionStatusBar();
        });
    }
}

// ページ読み込み時に接続状態を更新
document.addEventListener('DOMContentLoaded', function() {
    updateConnectionStatusBar();
});

// グローバル関数：PDFをクラウドから開く
async function openPdfFromCloud(source) {
    const session = await fetch('/session/status', {credentials:'include'}).then(r=>r.json()).catch(()=>({}));

    if (source === 'gdrive') {
        if (!session.gdrive_connected) {
            // Not connected→ログインページへ（戻り先にpdf_source=gdriveを付ける）
            const next = encodeURIComponent(location.pathname + '?pdf_source=gdrive');
            location.href = '/auth/google/login?redirect_to=' + next;
            return;
        }
        _showCloudFilePicker('gdrive');
    } else if (source === 'rdm') {
        if (!session.rdm_token) {
            const next = encodeURIComponent(location.pathname + '?pdf_source=rdm');
            location.href = '/auth/rdm/login?redirect_to=' + next;
            return;
        }
        _showCloudFilePicker('rdm');
    }
}

async function _showCloudFilePicker(source) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center';
    const title = source === 'gdrive' ? '☁️ Google Drive' : '🏛 GakuninRDM';
    overlay.innerHTML = [
        '<div style="background:#1e1e2e;color:#cdd6f4;border-radius:12px;width:500px;max-width:95vw;padding:24px;max-height:80vh;display:flex;flex-direction:column">',
        '<h3 style="margin:0 0 16px;color:#cba6f7">' + title + ' — Select a PDF</h3>',
        '<div id="cloudFileList" style="flex:1;overflow-y:auto;border:1px solid #313244;border-radius:8px;padding:8px;min-height:200px">',
        '<div style="color:#a6adc8;padding:8px">Loading...</div>',
        '</div>',
        '<div style="display:flex;justify-content:flex-end;margin-top:12px">',
        '<button id="cloudPickerClose" style="padding:8px 16px;background:#313244;color:#cdd6f4;border:none;border-radius:6px;cursor:pointer">Close</button>',
        '</div>',
        '</div>'
    ].join('');
    document.body.appendChild(overlay);
    overlay.querySelector('#cloudPickerClose').onclick = () => overlay.remove();

    const list = overlay.querySelector('#cloudFileList');

    if (source === 'gdrive') {
        const res = await fetch('/session/gdrive/files?folder_id=root', {credentials:'include'}).then(r=>r.json()).catch(()=>({}));
        const files = (res.files||[]).filter(function(f) {
            return f.mimeType === 'application/pdf' || f.mimeType === 'application/vnd.google-apps.folder';
        });
        if (!files.length) {
            list.innerHTML = '<div style="color:#a6adc8;padding:8px">No PDF files found</div>';
            return;
        }
        list.innerHTML = files.map(function(f) {
            var icon = f.mimeType.includes('folder') ? '📁' : '📄';
            return '<div style="padding:8px;cursor:pointer;border-radius:4px" class="cloud-file-item" data-id="' + f.id + '" data-type="' + f.mimeType + '" data-name="' + f.name + '">' + icon + ' ' + f.name + '</div>';
        }).join('');
        list.querySelectorAll('.cloud-file-item').forEach(function(el) {
            el.onmouseover = function() { el.style.background = '#313244'; };
            el.onmouseout  = function() { el.style.background = ''; };
            el.onclick = async function() {
                if (el.dataset.type.includes('folder')) return;
                list.innerHTML = '<div style="color:#a6adc8;padding:8px">Downloading...</div>';
                const dl = await fetch('/session/gdrive/download/' + el.dataset.id, {credentials:'include'}).then(r=>r.json()).catch(()=>({}));
                if (dl.status === 'downloaded' && dl.local_path) {
                    overlay.remove();
                    _loadPdfFromServer(dl.local_path, el.dataset.name);
                } else {
                    list.innerHTML = '<div style="color:#f38ba8;padding:8px">Download failed: ' + (dl.error||'Unknown error') + '</div>';
                }
            };
        });
    } else if (source === 'rdm') {
        // プロジェクト一覧を取得
        const projects = await fetch('/session/rdm/projects', {credentials:'include'}).then(r=>r.json()).catch(()=>[]);
        if (!projects.length || projects.error) {
            list.innerHTML = '<div style="color:#f38ba8;padding:8px">No projects found</div>';
            return;
        }

        // プロジェクト選択UI
        list.innerHTML = '<div style="color:#a6adc8;padding:4px 8px;font-size:0.8rem">Select a project:</div>' +
            projects.map(function(p) {
                return '<div style="padding:8px;cursor:pointer;border-radius:4px;border:1px solid #313244;margin:4px" class="rdm-proj-item" data-id="' + p.id + '">' +
                    '📁 ' + p.title + '</div>';
            }).join('');

        list.querySelectorAll('.rdm-proj-item').forEach(function(el) {
            el.onmouseover = function() { el.style.background = '#313244'; };
            el.onmouseout  = function() { el.style.background = ''; };
            el.onclick = async function() {
                list.innerHTML = '<div style="color:#a6adc8;padding:8px">Loading file list...</div>';
                await _loadRdmFolder(el.dataset.id, '', list);
            };
        });
    }
}

async function _loadRdmFolder(projectId, folderId, list, breadcrumbs) {
    if (!breadcrumbs) breadcrumbs = [{id: '', name: 'Root'}];

    list.innerHTML = '<div style="color:#a6adc8;padding:8px">Loading...</div>';

    var url = '/session/rdm/files/' + projectId + (folderId ? '?folder_id=' + folderId : '');
    const res = await fetch(url, {credentials:'include'}).then(r=>r.json()).catch(()=>({}));
    const files = res.files || [];

    // パンくずリストHTML
    var breadcrumbHtml = '<div style="display:flex;align-items:center;gap:4px;padding:6px 8px;background:#252535;border-radius:6px;margin-bottom:8px;flex-wrap:wrap">' +
        breadcrumbs.map(function(bc, i) {
            var isLast = i === breadcrumbs.length - 1;
            if (isLast) {
                return '<span style="color:#cdd6f4;font-size:0.82rem">📁 ' + bc.name + '</span>';
            }
            return '<span class="rdm-bc" style="color:#89b4fa;font-size:0.82rem;cursor:pointer;text-decoration:underline" data-idx="' + i + '">📁 ' + bc.name + '</span>' +
                   '<span style="color:#585b70;font-size:0.8rem"> › </span>';
        }).join('') +
    '</div>';

    // PDFとフォルダのみ表示
    const filtered = files.filter(function(f) {
        return f.kind === 'folder' || (f.name && f.name.toLowerCase().endsWith('.pdf'));
    });

    if (!filtered.length) {
        list.innerHTML = breadcrumbHtml + '<div style="color:#a6adc8;padding:8px">No PDF files found</div>';
    } else {
        list.innerHTML = breadcrumbHtml + filtered.map(function(f) {
            var icon = f.kind === 'folder' ? '📁' : '📄';
            var size = (f.kind === 'file' && f.size) ? ' <span style="color:#585b70;font-size:0.75rem">(' + Math.round(f.size/1024) + 'KB)</span>' : '';
            return '<div style="padding:8px;cursor:pointer;border-radius:4px;display:flex;justify-content:space-between;align-items:center" class="rdm-file-item"' +
                ' data-id="' + f.id + '"' +
                ' data-kind="' + f.kind + '"' +
                ' data-name="' + f.name + '"' +
                ' data-download="' + (f.download || '') + '">' +
                '<span>' + icon + ' ' + f.name + size + '</span>' +
                (f.kind === 'folder' ? '<span style="color:#585b70;font-size:0.8rem">›</span>' : '') +
            '</div>';
        }).join('');
    }

    // パンくずクリック
    list.querySelectorAll('.rdm-bc').forEach(function(el) {
        el.onmouseover = function() { el.style.color = '#cba6f7'; };
        el.onmouseout  = function() { el.style.color = '#89b4fa'; };
        el.onclick = async function() {
            var idx = parseInt(el.dataset.idx);
            var newBreadcrumbs = breadcrumbs.slice(0, idx + 1);
            var targetId = newBreadcrumbs[newBreadcrumbs.length - 1].id;
            await _loadRdmFolder(projectId, targetId, list, newBreadcrumbs);
        };
    });

    // ファイル・フォルダクリック
    list.querySelectorAll('.rdm-file-item').forEach(function(el) {
        el.onmouseover = function() { el.style.background = '#313244'; };
        el.onmouseout  = function() { el.style.background = ''; };
        el.onclick = async function() {
            if (el.dataset.kind === 'folder') {
                var newBreadcrumbs = breadcrumbs.concat([{id: el.dataset.id, name: el.dataset.name}]);
                await _loadRdmFolder(projectId, el.dataset.id, list, newBreadcrumbs);
                return;
            }
            // PDFをダウンロード
            list.innerHTML = '<div style="color:#a6adc8;padding:8px">⬇️ Downloading: ' + el.dataset.name + '</div>';
            const dl = await fetch(
                '/session/rdm/download?url=' + encodeURIComponent(el.dataset.download) + '&filename=' + encodeURIComponent(el.dataset.name),
                {credentials:'include'}
            ).then(r=>r.json()).catch(()=>({}));

            if (dl.status === 'downloaded' && dl.local_path) {
                var overlay = list.closest('div[style*="position:fixed"]');
                if (overlay) overlay.remove();
                _loadPdfFromServer('/session/rdm/serve?path=' + encodeURIComponent(dl.local_path), el.dataset.name);
            } else {
                list.innerHTML = '<div style="color:#f38ba8;padding:8px">Download failed: ' + (dl.error||'Unknown') + '</div>';
            }
        };
    });
}

async function _loadPdfFromServer(pathOrUrl, name) {
    const fname = document.getElementById('pdfFileName');
    if (fname) fname.textContent = name;
    // 完全なURLかパスかを判定
    var fetchUrl = pathOrUrl.startsWith('/session/') ? pathOrUrl :
                   '/session/gdrive/serve?path=' + encodeURIComponent(pathOrUrl);
    const resp = await fetch(fetchUrl, {credentials:'include'});
    if (!resp.ok) { alert('Failed to load the PDF'); return; }
    const blob = await resp.blob();
    const file = new File([blob], name, {type:'application/pdf'});
    const dt = new DataTransfer();
    dt.items.add(file);
    const fi = document.getElementById('fileInput');
    fi.files = dt.files;
    fi.dispatchEvent(new Event('change'));
}

/* =========================================================
 * Generic cloud file picker
 *
 * Usage:
 * StorageFilePicker.open({
 *   source: 'gdrive' | 'rdm',
 *   accept: ['.csv', '.jsonl'],
 *   returnUrl: location.pathname + '?dataset_source=gdrive',
 *   onSelect: function(file) {}
 * });
 * ========================================================= */
(function () {
    if (window.StorageFilePicker) return;

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    async function fetchJson(url, options) {
        const response = await fetch(url, Object.assign({
            credentials: 'include'
        }, options || {}));

        const text = await response.text();
        let data = {};

        if (text) {
            try {
                data = JSON.parse(text);
            } catch (_) {
                data = { error: text };
            }
        }

        if (!response.ok) {
            throw new Error(
                data.detail ||
                data.error ||
                ('HTTP ' + response.status)
            );
        }

        return data;
    }

    function normalizeAccept(accept) {
        if (!accept) return [];
        if (typeof accept === 'string') {
            return accept.split(',')
                .map(function (x) { return x.trim().toLowerCase(); })
                .filter(Boolean);
        }

        return accept.map(function (x) {
            return String(x).trim().toLowerCase();
        }).filter(Boolean);
    }

    function fileMatches(item, accept) {
        if (!accept.length) return true;

        const name = String(item.name || '').toLowerCase();
        const mime = String(item.mimeType || item.mime_type || '').toLowerCase();

        return accept.some(function (rule) {
            if (rule.charAt(0) === '.') return name.endsWith(rule);
            if (rule.endsWith('/*')) {
                return mime.startsWith(rule.slice(0, -1));
            }
            return mime === rule;
        });
    }

    function guessMimeType(name) {
        const lower = String(name || '').toLowerCase();

        if (lower.endsWith('.csv')) {
            return 'text/csv';
        }
        if (lower.endsWith('.jsonl')) {
            return 'application/x-ndjson';
        }
        if (lower.endsWith('.json')) {
            return 'application/json';
        }
        if (lower.endsWith('.txt')) {
            return 'text/plain';
        }
        if (lower.endsWith('.pdf')) {
            return 'application/pdf';
        }

        return 'application/octet-stream';
    }

    function createOverlay(title) {
        const overlay = document.createElement('div');
        overlay.style.cssText = [
            'position:fixed',
            'inset:0',
            'background:rgba(0,0,0,.65)',
            'z-index:10050',
            'display:flex',
            'align-items:center',
            'justify-content:center',
            'padding:16px',
            'box-sizing:border-box'
        ].join(';');

        overlay.innerHTML = [
            '<div style="background:#1e1e2e;color:#cdd6f4;',
            'border-radius:12px;width:560px;max-width:96vw;',
            'max-height:82vh;padding:22px;box-sizing:border-box;',
            'display:flex;flex-direction:column">',
            '<h3 style="margin:0 0 14px;color:#cba6f7">',
            escapeHtml(title),
            '</h3>',
            '<div id="storage-generic-status" ',
            'style="font-size:13px;color:#a6adc8;margin-bottom:8px"></div>',
            '<div id="storage-generic-list" ',
            'style="flex:1;overflow:auto;border:1px solid #313244;',
            'border-radius:8px;padding:8px;min-height:230px">',
            '<div style="padding:8px;color:#a6adc8">Loading...</div>',
            '</div>',
            '<div style="display:flex;justify-content:flex-end;margin-top:12px">',
            '<button id="storage-generic-close" ',
            'style="padding:8px 16px;background:#313244;color:#cdd6f4;',
            'border:0;border-radius:6px;cursor:pointer">Close</button>',
            '</div>',
            '</div>'
        ].join('');

        document.body.appendChild(overlay);

        overlay.querySelector('#storage-generic-close').onclick = function () {
            overlay.remove();
        };

        overlay.addEventListener('click', function (event) {
            if (event.target === overlay) overlay.remove();
        });

        return {
            overlay: overlay,
            list: overlay.querySelector('#storage-generic-list'),
            status: overlay.querySelector('#storage-generic-status')
        };
    }

    function breadcrumbHtml(crumbs) {
        return [
            '<div style="display:flex;gap:4px;align-items:center;',
            'flex-wrap:wrap;padding:6px 8px;background:#252535;',
            'border-radius:6px;margin-bottom:8px">',
            crumbs.map(function (crumb, index) {
                const last = index === crumbs.length - 1;

                if (last) {
                    return '<span style="font-size:13px">' +
                        '📁 ' + escapeHtml(crumb.name) +
                        '</span>';
                }

                return [
                    '<button type="button" class="storage-generic-breadcrumb"',
                    ' data-index="', index, '"',
                    ' style="border:0;background:transparent;color:#89b4fa;',
                    'padding:0;cursor:pointer;text-decoration:underline">',
                    '📁 ', escapeHtml(crumb.name),
                    '</button>',
                    '<span style="color:#585b70">›</span>'
                ].join('');
            }).join(''),
            '</div>'
        ].join('');
    }

    function fileRowHtml(item, isFolder) {
        return [
            '<div class="storage-generic-file"',
            ' data-id="', escapeHtml(item.id || ''), '"',
            ' data-name="', escapeHtml(item.name || ''), '"',
            ' data-kind="', isFolder ? 'folder' : 'file', '"',
            ' data-download="', escapeHtml(item.download || ''), '"',
            ' style="padding:9px;cursor:pointer;border-radius:6px;',
            'display:flex;justify-content:space-between;gap:10px">',
            '<span>', isFolder ? '📁 ' : '📄 ',
            escapeHtml(item.name || 'Untitled'), '</span>',
            isFolder
                ? '<span style="color:#585b70">›</span>'
                : '',
            '</div>'
        ].join('');
    }

    function bindHover(container) {
        container.querySelectorAll('.storage-generic-file').forEach(function (row) {
            row.onmouseenter = function () {
                row.style.background = '#313244';
            };
            row.onmouseleave = function () {
                row.style.background = '';
            };
        });
    }

    async function downloadDriveFile(item, ui) {
        ui.status.textContent = 'Downloading: ' + item.name;

        const downloaded = await fetchJson(
            '/session/gdrive/download/' + encodeURIComponent(item.id)
        );

        if (downloaded.status !== 'downloaded' || !downloaded.local_path) {
            throw new Error(downloaded.error || 'Could not retrieve from Google Drive');
        }

        const response = await fetch(
            '/session/gdrive/serve?path=' +
                encodeURIComponent(downloaded.local_path),
            { credentials: 'include' }
        );

        if (!response.ok) {
            throw new Error('Failed to retrieve the file');
        }

        return response.blob();
    }

    async function downloadRdmFile(item, ui) {
        ui.status.textContent = 'Downloading: ' + item.name;

        const downloaded = await fetchJson(
            '/session/rdm/download?url=' +
                encodeURIComponent(item.download) +
                '&filename=' +
                encodeURIComponent(item.name)
        );

        if (downloaded.status !== 'downloaded' || !downloaded.local_path) {
            throw new Error(downloaded.error || 'Could not retrieve from GakuninRDM');
        }

        const response = await fetch(
            '/session/rdm/serve?path=' +
                encodeURIComponent(downloaded.local_path),
            { credentials: 'include' }
        );

        if (!response.ok) {
            throw new Error('Failed to retrieve the file');
        }

        return response.blob();
    }

    async function finishSelection(source, item, config, ui) {
        try {
            const blob = source === 'gdrive'
                ? await downloadDriveFile(item, ui)
                : await downloadRdmFile(item, ui);

            const file = new File(
                [blob],
                item.name,
                { type: blob.type || guessMimeType(item.name) }
            );

            if (typeof config.onSelect === 'function') {
                await config.onSelect(file);
            }

            ui.overlay.remove();
        } catch (error) {
            console.error('StorageFilePicker:', error);
            ui.status.textContent = '❌ ' + error.message;
            ui.status.style.color = '#f38ba8';
        }
    }

    async function renderDrive(folderId, crumbs, accept, config, ui) {
        ui.list.innerHTML =
            '<div style="padding:8px;color:#a6adc8">Loading...</div>';

        try {
            const result = await fetchJson(
                '/session/gdrive/files?folder_id=' +
                    encodeURIComponent(folderId)
            );

            const files = (result.files || []).filter(function (item) {
                const folder =
                    item.mimeType === 'application/vnd.google-apps.folder';

                return folder || fileMatches(item, accept);
            });

            ui.list.innerHTML =
                breadcrumbHtml(crumbs) +
                (files.length
                    ? files.map(function (item) {
                        const folder =
                            item.mimeType ===
                            'application/vnd.google-apps.folder';

                        return fileRowHtml(item, folder);
                    }).join('')
                    : '<div style="padding:8px;color:#a6adc8">' +
                      'No matching files</div>');

            ui.list.querySelectorAll(
                '.storage-generic-breadcrumb'
            ).forEach(function (button) {
                button.onclick = function () {
                    const index = Number(button.dataset.index);
                    const nextCrumbs = crumbs.slice(0, index + 1);
                    const nextFolder =
                        nextCrumbs[nextCrumbs.length - 1].id;

                    renderDrive(
                        nextFolder,
                        nextCrumbs,
                        accept,
                        config,
                        ui
                    );
                };
            });

            bindHover(ui.list);

            ui.list.querySelectorAll(
                '.storage-generic-file'
            ).forEach(function (row) {
                row.onclick = function () {
                    const item = {
                        id: row.dataset.id,
                        name: row.dataset.name
                    };

                    if (row.dataset.kind === 'folder') {
                        renderDrive(
                            item.id,
                            crumbs.concat([{
                                id: item.id,
                                name: item.name
                            }]),
                            accept,
                            config,
                            ui
                        );
                    } else {
                        finishSelection(
                            'gdrive',
                            item,
                            config,
                            ui
                        );
                    }
                };
            });
        } catch (error) {
            ui.list.innerHTML =
                '<div style="padding:8px;color:#f38ba8">❌ ' +
                escapeHtml(error.message) +
                '</div>';
        }
    }

    async function renderRdmFolder(
        projectId,
        folderId,
        crumbs,
        accept,
        config,
        ui
    ) {
        ui.list.innerHTML =
            '<div style="padding:8px;color:#a6adc8">Loading...</div>';

        try {
            const url =
                '/session/rdm/files/' +
                encodeURIComponent(projectId) +
                (folderId
                    ? '?folder_id=' + encodeURIComponent(folderId)
                    : '');

            const result = await fetchJson(url);

            const files = (result.files || []).filter(function (item) {
                return item.kind === 'folder' ||
                    fileMatches(item, accept);
            });

            ui.list.innerHTML =
                breadcrumbHtml(crumbs) +
                (files.length
                    ? files.map(function (item) {
                        return fileRowHtml(
                            item,
                            item.kind === 'folder'
                        );
                    }).join('')
                    : '<div style="padding:8px;color:#a6adc8">' +
                      'No matching files</div>');

            ui.list.querySelectorAll(
                '.storage-generic-breadcrumb'
            ).forEach(function (button) {
                button.onclick = function () {
                    const index = Number(button.dataset.index);
                    const nextCrumbs = crumbs.slice(0, index + 1);
                    const nextFolder =
                        nextCrumbs[nextCrumbs.length - 1].id;

                    renderRdmFolder(
                        projectId,
                        nextFolder,
                        nextCrumbs,
                        accept,
                        config,
                        ui
                    );
                };
            });

            bindHover(ui.list);

            ui.list.querySelectorAll(
                '.storage-generic-file'
            ).forEach(function (row) {
                row.onclick = function () {
                    const item = {
                        id: row.dataset.id,
                        name: row.dataset.name,
                        download: row.dataset.download
                    };

                    if (row.dataset.kind === 'folder') {
                        renderRdmFolder(
                            projectId,
                            item.id,
                            crumbs.concat([{
                                id: item.id,
                                name: item.name
                            }]),
                            accept,
                            config,
                            ui
                        );
                    } else {
                        finishSelection(
                            'rdm',
                            item,
                            config,
                            ui
                        );
                    }
                };
            });
        } catch (error) {
            ui.list.innerHTML =
                '<div style="padding:8px;color:#f38ba8">❌ ' +
                escapeHtml(error.message) +
                '</div>';
        }
    }

    async function renderRdmProjects(accept, config, ui) {
        try {
            const projects = await fetchJson('/session/rdm/projects');

            if (!Array.isArray(projects) || !projects.length) {
                ui.list.innerHTML =
                    '<div style="padding:8px;color:#a6adc8">' +
                    'No available projects</div>';
                return;
            }

            ui.list.innerHTML =
                '<div style="padding:4px 8px 9px;color:#a6adc8">' +
                'Please select a project.</div>' +
                projects.map(function (project) {
                    return [
                        '<div class="storage-generic-project"',
                        ' data-id="', escapeHtml(project.id), '"',
                        ' data-name="', escapeHtml(project.title), '"',
                        ' style="padding:10px;cursor:pointer;',
                        'border:1px solid #313244;border-radius:6px;',
                        'margin-bottom:6px">',
                        '📁 ', escapeHtml(project.title),
                        '</div>'
                    ].join('');
                }).join('');

            ui.list.querySelectorAll(
                '.storage-generic-project'
            ).forEach(function (row) {
                row.onmouseenter = function () {
                    row.style.background = '#313244';
                };
                row.onmouseleave = function () {
                    row.style.background = '';
                };
                row.onclick = function () {
                    renderRdmFolder(
                        row.dataset.id,
                        '',
                        [{
                            id: '',
                            name: row.dataset.name
                        }],
                        accept,
                        config,
                        ui
                    );
                };
            });
        } catch (error) {
            ui.list.innerHTML =
                '<div style="padding:8px;color:#f38ba8">❌ ' +
                escapeHtml(error.message) +
                '</div>';
        }
    }

    async function openPicker(config) {
        config = config || {};

        const source = config.source;
        if (source !== 'gdrive' && source !== 'rdm') {
            throw new Error(
                'source must be either gdrive or rdm'
            );
        }

        const accept = normalizeAccept(config.accept);
        const session = await fetchJson('/session/status');

        const connected = source === 'gdrive'
            ? session.gdrive_connected
            : session.rdm_token;

        if (!connected) {
            const returnUrl =
                config.returnUrl || location.pathname;

            const endpoint = source === 'gdrive'
                ? '/auth/google/login?redirect_to='
                : '/auth/rdm/login?redirect_to=';

            location.href =
                endpoint + encodeURIComponent(returnUrl);
            return;
        }

        const sourceTitle = source === 'gdrive'
            ? '☁️ Google Drive'
            : '🏛 GakuninRDM';

        const acceptLabel = accept.length
            ? '（' + accept.join(', ') + '）'
            : '';

        const ui = createOverlay(
            config.title ||
            sourceTitle + ' — Select a file' + acceptLabel
        );

        if (source === 'gdrive') {
            await renderDrive(
                'root',
                [{ id: 'root', name: 'My Drive' }],
                accept,
                config,
                ui
            );
        } else {
            await renderRdmProjects(
                accept,
                config,
                ui
            );
        }
    }

    window.StorageFilePicker = { open: openPicker };
})();
