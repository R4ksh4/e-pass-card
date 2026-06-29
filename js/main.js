let currentMedia = null;
let isLocked = false;
let uiVisible = true;
let playlist = [];
let currentPlaylistIndex = 0;

let playMode = 'sequential';
let autoSwitch = false;
let autoSwitchTimer = null;
let autoSwitchInterval = 5;

// 光锥变量
let lightConeEnabled = false;
// 新增变量（放在原有变量声明区域附近，不拆开原有代码块）
let lightConeLiteEnabled = false;
let lightConeSuperLiteEnabled = false;
let lightConeFixedLiteEnabled = false;
let lightConeFixedEnabled = false;

let lightConeWatch = null;
let lenticularList = new Array(6).fill(null);
const LENTICULAR_FILE = '_doc/pass_media/lenticular_list.json';

const MEDIA_DIR = '_doc/pass_media/';
const PLAYLIST_FILE = '_doc/pass_media/play_list.json';
const CURRENT_FILE = '_doc/pass_media/current.txt';

function showStatus(msg) {
document.getElementById('status').innerText = msg;
}

function loadMediaByFileName(fileName, type) {
if (!fileName || !type) return false;
const filePath = MEDIA_DIR + fileName;

plus.io.resolveLocalFileSystemURL(filePath, (entry) => {
showMedia(entry.fullPath, type, false);
}, (e) => {
showStatus('文件丢失: ' + fileName);
});
return true;
}

function showMedia(path, type, saveToFile = true) {
    const container = document.getElementById('container');
    const lightCone = document.getElementById('lightCone');
    const webPath = plus.io.convertLocalFileSystemURL(path);

    if ((lightConeEnabled || lightConeLiteEnabled || lightConeSuperLiteEnabled || lightConeFixedLiteEnabled || lightConeFixedEnabled) && type === 'image') {
        const tempImg = new Image();
        tempImg.onload = () => {
            container.style.display = 'none';
            lightCone.classList.add('active');
            lightCone.querySelector('.card').style.backgroundImage = 'url(' + webPath + ')';
            
            const shine = lightCone.querySelector('.shine');
            if (lightConeSuperLiteEnabled || lightConeFixedLiteEnabled) {
                shine.classList.add('super-lite');
                shine.style.background = '';
            } else {
                shine.classList.remove('super-lite');
                shine.style.transform = '';
                shine.style.background = 'linear-gradient(135deg, transparent 60%, rgba(255,255,255,0.5) 75%, transparent 90%)';
            }
        };
        tempImg.src = webPath;
        currentMedia = { type: 'lightcone', src: webPath };
    } else {
        if (type === 'image') {
            const img = new Image();
            img.onload = () => {
                lightCone.classList.remove('active');
                container.style.display = 'flex';
                container.innerHTML = '';
                container.appendChild(img);
            };
            img.src = webPath;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            currentMedia = img;
        } else {
            lightCone.classList.remove('active');
            container.style.display = 'flex';
            container.innerHTML = '';

            const video = document.createElement('video');
            video.src = webPath;
            video.style.width = '100%';
            video.style.height = '100%';
            video.style.objectFit = 'cover';
            video.autoplay = true;
            video.muted = true;
            video.playsinline = true;
            video.onended = () => {
                let nextIndex = currentPlaylistIndex + 1;
                if (nextIndex >= playlist.length) nextIndex = 0;
                currentPlaylistIndex = nextIndex;

                const item = playlist[nextIndex];
                if (item) {
                    loadMediaByFileName(item.file, item.type);
                    writeCurrentFile(item.file, item.type);
                }
            };
            container.appendChild(video);
            currentMedia = video;
        }
    }

    if (saveToFile) {
        const fileName = path.split('/').pop();
        writeCurrentFile(fileName, type);
    }
}

function getThumbnail(filePath, type) {
return new Promise((resolve) => {
const url = plus.io.convertLocalFileSystemURL(filePath);
resolve(url);
});
}

function playPrev() {
if (playlist.length === 0) {
showStatus('列表为空');
return;
}

if (playMode === 'random') {
let newIndex;
do {
newIndex = Math.floor(Math.random() * playlist.length);
} while (newIndex === currentPlaylistIndex && playlist.length > 1);
currentPlaylistIndex = newIndex;
} else {
currentPlaylistIndex--;
if (currentPlaylistIndex < 0) {
currentPlaylistIndex = playlist.length - 1;
}
}

const item = playlist[currentPlaylistIndex];
loadMediaByFileName(item.file, item.type);
writeCurrentFile(item.file, item.type);
showStatus((playMode === 'random' ? '🔀 ' : '⏮️ ') + (currentPlaylistIndex + 1) + '/' + playlist.length);
}

function playNext() {
if (playlist.length === 0) {
showStatus('列表为空');
return;
}

if (playMode === 'random') {
let newIndex;
do {
newIndex = Math.floor(Math.random() * playlist.length);
} while (newIndex === currentPlaylistIndex && playlist.length > 1);
currentPlaylistIndex = newIndex;
} else {
currentPlaylistIndex++;
if (currentPlaylistIndex >= playlist.length) {
currentPlaylistIndex = 0;
}
}

const item = playlist[currentPlaylistIndex];
loadMediaByFileName(item.file, item.type);
writeCurrentFile(item.file, item.type);
showStatus((playMode === 'random' ? '🔀 ' : '⏭️ ') + (currentPlaylistIndex + 1) + '/' + playlist.length);
}

function togglePlayMode() {
playMode = playMode === 'sequential' ? 'random' : 'sequential';
showStatus(playMode === 'random' ? '🔀 随机播放' : '⏭️ 顺序播放');
}

function startAutoSwitch() {
stopAutoSwitch();
autoSwitchTimer = setInterval(() => {
if (!isLocked && playlist.length > 0) {
playNext();
}
}, autoSwitchInterval * 1000);
}

function stopAutoSwitch() {
if (autoSwitchTimer) {
clearInterval(autoSwitchTimer);
autoSwitchTimer = null;
}
}

function showSettings() {
    document.getElementById('settingsView').style.display = 'flex';
    document.getElementById('playModeSelect').value = playMode;
    document.getElementById('autoSwitchCheck').checked = autoSwitch;
    document.getElementById('autoSwitchInterval').value = autoSwitchInterval;
    document.getElementById('lightConeCheck').checked = lightConeEnabled;
    document.getElementById('lightConeLiteCheck').checked = lightConeLiteEnabled;
    document.getElementById('lightConeSuperLiteCheck').checked = lightConeSuperLiteEnabled;
    document.getElementById('lightConeFixedLiteCheck').checked = lightConeFixedLiteEnabled;
    document.getElementById('lightConeFixedCheck').checked = lightConeFixedEnabled;
}

function hideSettings() {
document.getElementById('settingsView').style.display = 'none';
}

function saveSettings() {
    playMode = document.getElementById('playModeSelect').value;
    autoSwitch = document.getElementById('autoSwitchCheck').checked;
    autoSwitchInterval = parseInt(document.getElementById('autoSwitchInterval').value) || 5;

    lightConeEnabled = document.getElementById('lightConeCheck').checked;
    lightConeLiteEnabled = document.getElementById('lightConeLiteCheck').checked;
    lightConeSuperLiteEnabled = document.getElementById('lightConeSuperLiteCheck').checked;
    lightConeFixedLiteEnabled = document.getElementById('lightConeFixedLiteCheck').checked;
    lightConeFixedEnabled = document.getElementById('lightConeFixedCheck').checked;

    if (lightConeFixedLiteEnabled) {
        lightConeEnabled = false;
        lightConeLiteEnabled = false;
        lightConeSuperLiteEnabled = false;
        lightConeFixedEnabled = false;
        document.getElementById('lightConeCheck').checked = false;
        document.getElementById('lightConeLiteCheck').checked = false;
        document.getElementById('lightConeSuperLiteCheck').checked = false;
        document.getElementById('lightConeFixedCheck').checked = false;
    } else if (lightConeSuperLiteEnabled) {
        lightConeEnabled = false;
        lightConeLiteEnabled = false;
        lightConeFixedLiteEnabled = false;
        lightConeFixedEnabled = false;
        document.getElementById('lightConeCheck').checked = false;
        document.getElementById('lightConeLiteCheck').checked = false;
        document.getElementById('lightConeFixedLiteCheck').checked = false;
        document.getElementById('lightConeFixedCheck').checked = false;
    } else if (lightConeFixedEnabled) {
        lightConeEnabled = false;
        lightConeLiteEnabled = false;
        lightConeSuperLiteEnabled = false;
        lightConeFixedLiteEnabled = false;
        document.getElementById('lightConeCheck').checked = false;
        document.getElementById('lightConeLiteCheck').checked = false;
        document.getElementById('lightConeSuperLiteCheck').checked = false;
        document.getElementById('lightConeFixedLiteCheck').checked = false;
    } else if (lightConeLiteEnabled) {
        lightConeEnabled = false;
        lightConeSuperLiteEnabled = false;
        lightConeFixedLiteEnabled = false;
        lightConeFixedEnabled = false;
        document.getElementById('lightConeCheck').checked = false;
        document.getElementById('lightConeSuperLiteCheck').checked = false;
        document.getElementById('lightConeFixedLiteCheck').checked = false;
        document.getElementById('lightConeFixedCheck').checked = false;
    } else if (lightConeEnabled) {
        lightConeLiteEnabled = false;
        lightConeSuperLiteEnabled = false;
        lightConeFixedLiteEnabled = false;
        lightConeFixedEnabled = false;
        document.getElementById('lightConeLiteCheck').checked = false;
        document.getElementById('lightConeSuperLiteCheck').checked = false;
        document.getElementById('lightConeFixedLiteCheck').checked = false;
        document.getElementById('lightConeFixedCheck').checked = false;
    }

    localStorage.setItem('lightCone', lightConeEnabled);
    localStorage.setItem('lightConeLite', lightConeLiteEnabled);
    localStorage.setItem('lightConeSuperLite', lightConeSuperLiteEnabled);
    localStorage.setItem('lightConeFixedLite', lightConeFixedLiteEnabled);
    localStorage.setItem('lightConeFixed', lightConeFixedEnabled);

    document.getElementById('lightCone').classList.remove('light-cone-fixed');

    const shineEl = document.querySelector('.light-cone .shine');
    if (shineEl) {
        shineEl.classList.remove('super-lite');
        shineEl.style.transform = '';
        shineEl.style.background = '';
    }

    if (lightConeFixedLiteEnabled) {
        stopLightCone();
        LightConeLite.stop();
        if (typeof LightConeSuperLite !== 'undefined') LightConeSuperLite.stop();
        LightConeFixed.stop();
        if (typeof LightConeFixedLite !== 'undefined') LightConeFixedLite.start();
    } else if (lightConeFixedEnabled) {
        stopLightCone();
        LightConeLite.stop();
        if (typeof LightConeSuperLite !== 'undefined') LightConeSuperLite.stop();
        if (typeof LightConeFixedLite !== 'undefined') LightConeFixedLite.stop();
        LightConeFixed.start();
    } else if (lightConeLiteEnabled) {
        stopLightCone();
        if (typeof LightConeSuperLite !== 'undefined') LightConeSuperLite.stop();
        if (typeof LightConeFixedLite !== 'undefined') LightConeFixedLite.stop();
        LightConeFixed.stop();
        LightConeLite.start();
    } else if (lightConeSuperLiteEnabled) {
        stopLightCone();
        LightConeLite.stop();
        if (typeof LightConeFixedLite !== 'undefined') LightConeFixedLite.stop();
        LightConeFixed.stop();
        if (typeof LightConeSuperLite !== 'undefined') LightConeSuperLite.start();
    } else if (lightConeEnabled) {
        LightConeLite.stop();
        if (typeof LightConeSuperLite !== 'undefined') LightConeSuperLite.stop();
        if (typeof LightConeFixedLite !== 'undefined') LightConeFixedLite.stop();
        LightConeFixed.stop();
        initLightCone();
    } else {
        stopLightCone();
        LightConeLite.stop();
        if (typeof LightConeSuperLite !== 'undefined') LightConeSuperLite.stop();
        if (typeof LightConeFixedLite !== 'undefined') LightConeFixedLite.stop();
        LightConeFixed.stop();
        document.getElementById('lightCone').classList.remove('active');
    }

    const settings = {
            playMode: playMode,
            autoSwitch: autoSwitch,
            autoSwitchInterval: autoSwitchInterval,
            lightConeFixed: lightConeFixedEnabled,
            lightConeSuperLite: lightConeSuperLiteEnabled,
            lightConeFixedLite: lightConeFixedLiteEnabled
        };
        const content = JSON.stringify(settings);
        safeWriteFile('settings.json', content);
	
	
	
	
	

    if (autoSwitch) {
        startAutoSwitch();
    } else {
        stopAutoSwitch();
    }

    hideSettings();
    showStatus('设置已保存');
}
function loadSettings() {
return new Promise((resolve) => {
plus.io.resolveLocalFileSystemURL(MEDIA_DIR + 'settings.json', (fileEntry) => {
fileEntry.file((file) => {
const reader = new plus.io.FileReader();
reader.onloadend = (e) => {
try {
const settings = JSON.parse(e.target.result);
        playMode = settings.playMode || 'sequential';
        autoSwitch = settings.autoSwitch || false;
        autoSwitchInterval = settings.autoSwitchInterval || 5;
        lightConeFixedEnabled = settings.lightConeFixed || false;
        lightConeSuperLiteEnabled = settings.lightConeSuperLite || false;
        lightConeFixedLiteEnabled = settings.lightConeFixedLite || false;
} catch(err) {
console.log('⚠️ 设置解析失败');
}
resolve();
};
reader.readAsText(file);
});
}, () => {
resolve();
});
});
}

function loadPlaylist() {
return new Promise((resolve) => {
plus.io.resolveLocalFileSystemURL(PLAYLIST_FILE, (fileEntry) => {
fileEntry.file((file) => {
const reader = new plus.io.FileReader();
reader.onloadend = (e) => {
try {
playlist = JSON.parse(e.target.result);
console.log('✅ play_list.json 加载:', playlist.length);
} catch(err) {
playlist = [];
}
resolve();
};
reader.readAsText(file);
});
}, () => {
playlist = [];
resolve();
});
});
}

function savePlaylist() {
    const content = JSON.stringify(playlist);
    safeWriteFile('play_list.json', content, () => {
        if (playlist.length > 0) {
            const idx = currentPlaylistIndex < playlist.length ? currentPlaylistIndex : 0;
            writeCurrentFile(playlist[idx].file, playlist[idx].type);
        }
    });
}

function writeCurrentFile(fileName, type) {
    console.log('Writing current.txt:', fileName, type);
    const content = fileName + '\n' + type;
    safeWriteFile('current.txt', content, () => {
        console.log('current.txt updated');
    });
}

function restoreMemory() {
plus.io.resolveLocalFileSystemURL(CURRENT_FILE, (fileEntry) => {
fileEntry.file((file) => {
const reader = new plus.io.FileReader();
reader.onloadend = (e) => {
const content = e.target.result;
const lines = content.split('\n');
const fileName = lines[0].trim();
const type = lines[1].trim();

if (fileName && type) {
let foundIndex = -1;
for (let i = 0; i < playlist.length; i++) {
if (playlist[i].file === fileName) {
foundIndex = i;
break;
}
}

if (foundIndex >= 0) {
currentPlaylistIndex = foundIndex;
console.log('✅ 恢复索引:', currentPlaylistIndex);
} else {
currentPlaylistIndex = 0;
console.log('⚠️ 找不到, 默认0');
}

loadMediaByFileName(fileName, type);
}
};
reader.readAsText(file);
});
});
}

function renderPlaylist() {
const container = document.getElementById('playlistItems');
if (playlist.length === 0) {
container.innerHTML = '<div class="playlist-empty">暂无内容，点击右上角添加</div>';
return;
}

container.innerHTML = '';

playlist.forEach((item, index) => {
const div = document.createElement('div');
div.className = 'playlist-item';
div.dataset.index = index;

div.innerHTML = `
<div class="drag-handle" data-index="${index}">≡</div>
<div class="playlist-item-thumb" id="thumb-${index}">
${item.type === 'image' ? '🖼️' : '🎬'}
</div>
<div class="playlist-item-info">
<div class="playlist-item-name">${item.file}</div>
<div class="playlist-item-type">${item.type}</div>
</div>
`;

div.addEventListener('click', (e) => {
if (e.target.classList.contains('drag-handle')) return;
currentPlaylistIndex = index;
playMode = 'sequential';
loadMediaByFileName(item.file, item.type);
writeCurrentFile(item.file, item.type);
hidePlaylist();
});

const handle = div.querySelector('.drag-handle');
let dragSrcIndex = -1;

handle.addEventListener('touchstart', (e) => {
e.preventDefault();
dragSrcIndex = index;
div.classList.add('dragging');
}, { passive: false });

handle.addEventListener('touchmove', (e) => {
e.preventDefault();
if (dragSrcIndex < 0) return;

const touch = e.touches[0];
const target = document.elementFromPoint(touch.clientX, touch.clientY);
const item = target ? target.closest('.playlist-item') : null;

if (item) {
const targetIndex = parseInt(item.dataset.index);
if (targetIndex !== dragSrcIndex && targetIndex >= 0 && targetIndex < playlist.length) {
const temp = playlist[dragSrcIndex];
playlist[dragSrcIndex] = playlist[targetIndex];
playlist[targetIndex] = temp;

renderPlaylist();

if (currentPlaylistIndex === dragSrcIndex) {
currentPlaylistIndex = targetIndex;
} else if (currentPlaylistIndex === targetIndex) {
currentPlaylistIndex = dragSrcIndex;
}

dragSrcIndex = targetIndex;
}
}
}, { passive: false });

handle.addEventListener('touchend', () => {
div.classList.remove('dragging');
dragSrcIndex = -1;
savePlaylist();
});

container.appendChild(div);

getThumbnail(MEDIA_DIR + item.file, item.type).then(url => {
if (url) {
const thumbDiv = document.getElementById(`thumb-${index}`);
if (thumbDiv) {
if (item.type === 'video') {
thumbDiv.innerHTML = `<video id="vid-${index}" src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" muted playsinline preload="auto"></video>`;
setTimeout(() => {
const v = document.getElementById(`vid-${index}`);
if (v) {
v.play().then(() => {
v.pause();
v.currentTime = 0;
}).catch(() => {});
}
}, 100);
} else {
thumbDiv.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">`;
}
}
}
});
});
}

function deletePlaylistItem(index) {
    const item = playlist[index];
    if (item) {
        const filePath = MEDIA_DIR + item.file;
        plus.io.resolveLocalFileSystemURL(filePath, (entry) => {
            entry.remove();
        });
    }
    playlist.splice(index, 1);
    if (currentPlaylistIndex >= playlist.length) {
        currentPlaylistIndex = 0;
    }
    savePlaylist();
    renderPlaylist();
}

function addToPlaylist(fileName, type) {
playlist.push({ file: fileName, type: type });
currentPlaylistIndex = 0;
savePlaylist();
renderPlaylist();
showStatus('已添加，从第一项开始');
}

function showPlaylist() {
console.log('📋 showPlaylist 调用');
document.getElementById('mainView').style.display = 'none';
document.getElementById('playlistView').style.display = 'flex';
renderPlaylist();
}

function hidePlaylist() {
document.getElementById('playlistView').style.display = 'none';
document.getElementById('mainView').style.display = 'block';
}
function showLenticularEditor() {
document.getElementById('lenticularEditor').classList.add('active');
LenticularEditor.render();
}
function hideLenticularEditor() {
document.getElementById('lenticularEditor').classList.remove('active');
}


function showAddMenu() {
document.getElementById('addMenuOverlay').style.display = 'block';
document.getElementById('addMenu').style.display = 'block';
}

function hideAddMenu() {
document.getElementById('addMenuOverlay').style.display = 'none';
document.getElementById('addMenu').style.display = 'none';
}

function createDir() {
return new Promise((resolve, reject) => {
plus.io.requestFileSystem(plus.io.PRIVATE_DOC, (fs) => {
fs.root.getDirectory('pass_media', { create: true }, resolve, reject);
}, reject);
});
}



function safeWriteFile(fileName, content, onWriteCallback) {
    plus.io.resolveLocalFileSystemURL(MEDIA_DIR, (dir) => {
        dir.getFile(fileName, { create: true }, (file) => {
            file.remove(() => {
                dir.getFile(fileName, { create: true }, (newFile) => {
                    newFile.createWriter((writer) => {
                        writer.write(content);
                        if (onWriteCallback) {
                            writer.onwrite = onWriteCallback;
                        }
                    });
                });
            });
        });
    });
}







function writeCurrentFile(fileName, type) {
console.log('📝 写入 current.txt:', fileName, type);
const content = fileName + '\n' + type;
plus.io.resolveLocalFileSystemURL(MEDIA_DIR, (dir) => {
dir.getFile('current.txt', { create: true }, (file) => {
file.createWriter((writer) => {
writer.write(content);
writer.onwrite = () => {
console.log('✅ current.txt 写入成功');
};
});
});
});
}

function copyFile(srcPath, destName) {
return new Promise((resolve, reject) => {
plus.io.resolveLocalFileSystemURL(srcPath, (entry) => {
plus.io.resolveLocalFileSystemURL(MEDIA_DIR, (dirEntry) => {
entry.copyTo(dirEntry, destName, (newEntry) => {
resolve(newEntry.fullPath);
}, reject);
}, reject);
}, reject);
});
}

async function handleFile(type, filter, addToList = false) {
if (isLocked && !addToList) {
showStatus('🔒 已锁定');
return;
}

plus.gallery.pick(async (path) => {
try {
await createDir();
const timestamp = Date.now();
const ext = path.split('.').pop().split('?')[0];
const destName = timestamp + '.' + ext;
const savedPath = await copyFile(path, destName);

if (addToList) {
addToPlaylist(destName, type);
hideAddMenu();
} else {
showMedia(savedPath, type);
}
} catch(e) {
showStatus('复制失败');
}
}, (e) => {
showStatus('取消选择');
}, { filter: filter });
}

const lockBtn = document.getElementById('lockBtn');

lockBtn.addEventListener('click', (e) => {
e.stopPropagation();

if (!isLocked) {
// 进入锁定
document.body.classList.add('fullscreen-mode');
lockBtn.innerHTML = '🔒';
isLocked = true;
stopAutoSwitch();
showStatus('🔒 已锁定');
document.getElementById('lenticularEntryBtn').classList.add('visible');
} else {
// 退出锁定
document.body.classList.remove('fullscreen-mode');
lockBtn.innerHTML = '🔓';
isLocked = false;
uiVisible = true;
if (autoSwitch) startAutoSwitch();
showStatus('🔓 已解锁');
document.getElementById('lenticularEntryBtn').classList.add('visible');			
}
});

document.body.addEventListener('click', (e) => {
if (e.target.closest('.lock-btn')) return;

if (!isLocked) {
// 解锁模式：切换全部UI（包括锁图标）
uiVisible = !uiVisible;
if (uiVisible) {
document.body.classList.remove('fullscreen-mode');
} else {
document.body.classList.add('fullscreen-mode');
}
const lenticularBtn = document.getElementById('lenticularEntryBtn');
if (uiVisible) {
lenticularBtn.classList.add('visible');
} else {
lenticularBtn.classList.remove('visible');
}
}
// 锁定模式：什么都不做
});

let unlockTimer = null;
document.body.addEventListener('touchstart', (e) => {
if (e.touches.length >= 3) {
e.preventDefault();
return;
}

if (!isLocked) return;
if (e.touches.length === 2) {
if (unlockTimer) clearTimeout(unlockTimer);
unlockTimer = setTimeout(() => {
document.body.classList.remove('fullscreen-mode');
lockBtn.innerHTML = '🔓';
lockBtn.style.opacity = '1';  // 恢复可见
isLocked = false;
uiVisible = true;
if (autoSwitch) startAutoSwitch();
showStatus('🔓 已解锁');
unlockTimer = null;
}, 3000);
}
}, { passive: false });
document.body.addEventListener('touchend', () => {
if (unlockTimer) {
clearTimeout(unlockTimer);
unlockTimer = null;
}
});

document.getElementById('prevBtn').onclick = (e) => {
e.stopPropagation();
playPrev();
};

document.getElementById('nextBtn').onclick = (e) => {
e.stopPropagation();
playNext();
};
document.getElementById('imageBtn').onclick = () => handleFile('image', 'image');
document.getElementById('videoBtn').onclick = () => handleFile('video', 'video');
document.getElementById('playlistBtn').onclick = showPlaylist;

document.getElementById('lenticularEntryBtn').onclick = () => { location.href = 'lenticular.html'; };

		
document.getElementById('fullscreenBtn').onclick = () => {
if (currentMedia) {
if (currentMedia.requestFullscreen) currentMedia.requestFullscreen();
}
};
document.getElementById('debugBtn').onclick = restoreMemory;

document.getElementById('settingsBtn').onclick = showSettings;
document.getElementById('settingsCloseBtn').onclick = hideSettings;
document.getElementById('saveSettingsBtn').onclick = saveSettings;

document.getElementById('playlistBackBtn').onclick = hidePlaylist;
document.getElementById('playlistPlayBtn').onclick = () => {
if (playlist.length > 0) {
currentPlaylistIndex = 0;
const item = playlist[0];
loadMediaByFileName(item.file, item.type);
hidePlaylist();
}
};
document.getElementById('playlistAddBtn').onclick = showAddMenu;
document.getElementById('playlistDeleteAllBtn').onclick = () => {
    if (playlist.length === 0) {
        showStatus('列表为空');
        return;
    }
    if (confirm('清空播放列表？')) {
        playlist.forEach((item) => {
            const filePath = MEDIA_DIR + item.file;
            plus.io.resolveLocalFileSystemURL(filePath, (entry) => {
                entry.remove();
            });
        });
        playlist = [];
        currentPlaylistIndex = 0;
        savePlaylist();
        renderPlaylist();
        showStatus('列表已清空');
    }
};

document.getElementById('addMenuOverlay').onclick = hideAddMenu;
document.getElementById('addImageBtn').onclick = () => handleFile('image', 'image', true);
document.getElementById('addVideoBtn').onclick = () => handleFile('video', 'video', true);

// 光锥函数
function initLightCone() {
if (!lightConeEnabled || !plus.accelerometer) return;

// 默认反光
const shine = document.querySelector('.light-cone .shine');
if (shine) {
shine.style.background = `
linear-gradient(
135deg,
transparent 60%,
rgba(255,255,255,0.5) 75%,
transparent 90%
)
`;
}

lightConeWatch = plus.accelerometer.watchAcceleration((a) => {


updateLightCone(a.xAxis, a.yAxis);
}, (e) => {
}, {
frequency: 60
});
}

// 平滑变量
let smoothTiltX = 0;
let smoothTiltY = 0;

function updateLightCone(tiltX, tiltY) {
const card = document.querySelector('.light-cone .card');
const shine = document.querySelector('.light-cone .shine');

// 分层阈值：小位移保留但慢跟，大位移快跟
const filteredTiltX = Math.abs(tiltX) < 1 ? tiltX * 0.3 : tiltX;
const filteredTiltY = Math.abs(tiltY) < 1 ? tiltY * 0.3 : tiltY;

smoothTiltX += (filteredTiltX - smoothTiltX) * 0.1;
smoothTiltY += (filteredTiltY - smoothTiltY) * 0.1;

const offsetX = smoothTiltX * -3;
const offsetY = smoothTiltY * -2;
card.style.transform = `translate(${offsetX}px, ${offsetY}px)`;

const lineOffset = smoothTiltX * 60 - 40;

const p1 = 0 + lineOffset;
const p2 = 70 + lineOffset;
const p3 = 140 + lineOffset;
const p4 = 210 + lineOffset;
const p5 = 280 + lineOffset;
const p6 = 350 + lineOffset;

shine.style.background = `
linear-gradient(45deg, transparent ${p1 - 60}%, rgba(255,255,255,0.15) ${p1 - 30}%, rgba(255,255,255,0.3) ${p1}%, transparent ${p1 + 60}%),
linear-gradient(45deg, transparent ${p2 - 6}%, rgba(255,255,255,0.2) ${p2}%, transparent ${p2 + 6}%),
linear-gradient(45deg, transparent ${p3 - 6}%, rgba(255,255,255,0.12) ${p3}%, transparent ${p3 + 6}%),
linear-gradient(45deg, transparent ${p4 - 2}%, rgba(255,255,255,0.12) ${p4}%, transparent ${p4 + 2}%),
linear-gradient(45deg, transparent ${p5 - 6}%, rgba(255,255,255,0.3) ${p5}%, transparent ${p5 + 6}%),
linear-gradient(45deg, transparent ${p6 - 10}%, rgba(255,255,255,0.12) ${p6}%, transparent ${p6 + 10}%)
`;
}

function stopLightCone() {
if (lightConeWatch) {
plus.accelerometer.clearWatch(lightConeWatch);
lightConeWatch = null;
}
}

// ===== 光栅素材编辑器（完全隔离） =====
const LenticularEditor = (function() {
function loadLenticularList() {
return new Promise((resolve) => {
plus.io.resolveLocalFileSystemURL(LENTICULAR_FILE, (fileEntry) => {
fileEntry.file((file) => {
const reader = new plus.io.FileReader();
reader.onloadend = (e) => {
try {
const data = JSON.parse(e.target.result);
if (Array.isArray(data) && data.length === 6) {
lenticularList = data;
}
} catch(err) {}
resolve();
};
reader.readAsText(file);
});
}, () => {
resolve();
});
});
}

function saveLenticularList() {
const content = JSON.stringify(lenticularList);
plus.io.resolveLocalFileSystemURL(MEDIA_DIR, (dir) => {
dir.getFile('lenticular_list.json', { create: true }, (file) => {
file.createWriter((writer) => {
writer.write(content);
});
});
});
}

function render() {
const grid = document.getElementById('lenticularGrid');
const title = document.getElementById('lenticularTitle');
let count = 0;
grid.innerHTML = '';

for (let i = 0; i < 6; i++) {
const slot = document.createElement('div');
slot.className = 'lenticular-slot';
const item = lenticularList[i];

if (item && item.file) {
count++;
slot.classList.add('filled');
const thumb = document.createElement('img');
const imgUrl = plus.io.convertLocalFileSystemURL(MEDIA_DIR + item.file);
console.log('光栅缩略图路径:', imgUrl);
thumb.src = imgUrl;
thumb.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:1;';
thumb.onerror = () => {
console.log('光栅缩略图加载失败:', imgUrl);
};
slot.appendChild(thumb);

const delBtn = document.createElement('div');
delBtn.className = 'delete-btn';
delBtn.innerText = '✕';
delBtn.onclick = (e) => {
e.stopPropagation();
if (confirm('删除这张素材？')) {
lenticularList[i] = null;
saveLenticularList();
render();
}
};
slot.appendChild(delBtn);
} else {
const plusSpan = document.createElement('span');
plusSpan.innerText = '+';
plusSpan.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);';
slot.appendChild(plusSpan);
slot.onclick = () => selectSlot(i);
}

grid.appendChild(slot);
}

title.innerText = `光栅素材 (${count}/6)`;
}

function selectSlot(index) {
plus.gallery.pick(async (path) => {
try {
await createDir();
const ext = path.split('.').pop().split('?')[0];
const destName = 'lenticular_' + Date.now() + '_' + index + '.' + ext;
await copyFile(path, destName);
lenticularList[index] = { file: destName, type: 'image' };
saveLenticularList();
render();
} catch(e) {
showStatus('添加失败');
}
}, (e) => {}, { filter: 'image' });
}

return { loadLenticularList, render };
})();

document.addEventListener('plusready', () => {
console.log('🚀 plusready');

// 双击返回退出
let backCount = 0;
let backTimer = null;
plus.key.addEventListener('backbutton', (e) => {
e.preventDefault();
backCount++;
if (backCount === 1) {
showStatus('再按一次退出');
backTimer = setTimeout(() => { backCount = 0; }, 2000);
} else if (backCount >= 2) {
clearTimeout(backTimer);
plus.runtime.quit();
}
});

// 屏蔽右键和长按菜单
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('selectstart', (e) => e.preventDefault());

let checkCount = 0;
const checkPlus = setInterval(() => {
checkCount++;
if (typeof plus !== 'undefined') {
clearInterval(checkPlus);

plus.navigator.setFullscreen(true);

plus.screen.lockOrientation('portrait-primary');

// 屏蔽4指及以上手势
document.body.addEventListener('touchstart', (e) => {
if (e.touches.length > 3) {
e.preventDefault();
return;
}
}, { passive: false });

Promise.all([createDir(), loadPlaylist(), loadSettings(), LenticularEditor.loadLenticularList()]).then(() => {
                scanMediaDirAndUpdatePlaylist().then(() => {
                    lightConeEnabled = localStorage.getItem('lightCone') === 'true';
                    lightConeLiteEnabled = localStorage.getItem('lightConeLite') === 'true';
                    lightConeSuperLiteEnabled = localStorage.getItem('lightConeSuperLite') === 'true';
                    lightConeFixedLiteEnabled = localStorage.getItem('lightConeFixedLite') === 'true';
                    lightConeFixedEnabled = localStorage.getItem('lightConeFixed') === 'true';
                    
                    if (lightConeFixedLiteEnabled) {
                        if (typeof LightConeFixedLite !== 'undefined') LightConeFixedLite.start();
                    } else if (lightConeFixedEnabled) {
                        LightConeFixed.start();
                    } else if (lightConeSuperLiteEnabled) {
                        if (typeof LightConeSuperLite !== 'undefined') LightConeSuperLite.start();
                    } else if (lightConeLiteEnabled) {
                        LightConeLite.start();
                    } else if (lightConeEnabled) {
                        initLightCone();
                    }
		
		
        if (autoSwitch) startAutoSwitch();
        restoreMemory();
        
        // 初始化光栅入口按钮显示状态
        const lenticularBtn = document.getElementById('lenticularEntryBtn');
        if (lenticularBtn && uiVisible && !isLocked) {
            lenticularBtn.classList.add('visible');
        }
    });
}).catch(() => {
    restoreMemory();
});
} else if (checkCount > 10) {
clearInterval(checkPlus);
}
}, 200);
});













// ===== 新增：光锥续航版（完全隔离，不动原有代码） =====
const LightConeLite = (function() {
let watchId = null;
let isActive = false;
let lastTiltX = 0;
let lastTiltY = 0;
let smoothX = 0;
let smoothY = 0;
let rafId = null;
let idleTimer = null;
let isIdle = false;
let lastRenderTime = 0;

const config = {
frequency: 24,
idleThreshold: 0.2,
idleDelay: 5000,
moveThreshold: 0.35,
cardMoveScale: 1.2,
renderInterval: 1000 / 24
};

const card = document.querySelector('.light-cone .card');
const shine = document.querySelector('.light-cone .shine');

function isInViewport() {
const rect = card.getBoundingClientRect();
return rect.top < window.innerHeight + 50 &&
rect.bottom > -50 &&
rect.left < window.innerWidth + 50 &&
rect.right > -50;
}

function render(now) {
if (!isActive) return;

if (now - lastRenderTime < config.renderInterval) {
rafId = requestAnimationFrame(render);
return;
}
lastRenderTime = now;

if (isIdle || !isInViewport()) {
// freeze：保持最后一帧状态，不更新
rafId = requestAnimationFrame(render);
return;
}

const offsetX = smoothX * -config.cardMoveScale;
const offsetY = smoothY * -config.cardMoveScale;
card.style.transform = `translate(${offsetX}px, ${offsetY}px)`;

const lineOffset = smoothX * 35 - 15;
const p1 = 25 + lineOffset;
const p3 = 95 + lineOffset;
const p5 = 165 + lineOffset;

shine.style.background = `
linear-gradient(45deg, transparent ${p1-20}%, rgba(255,255,255,0.15) ${p1}%, transparent ${p1+20}%),
linear-gradient(45deg, transparent ${p3-4}%, rgba(255,255,255,0.08) ${p3}%, transparent ${p3+4}%),
linear-gradient(45deg, transparent ${p5-4}%, rgba(255,255,255,0.22) ${p5}%, transparent ${p5+4}%)
`;

rafId = requestAnimationFrame(render);
}

function onAccel(a) {
const tiltX = a.xAxis;
const tiltY = a.yAxis;
const delta = Math.abs(tiltX - lastTiltX) + Math.abs(tiltY - lastTiltY);

if (delta < config.idleThreshold) {
if (!idleTimer && !isIdle) {
idleTimer = setTimeout(() => {
isIdle = true;
}, config.idleDelay);
}
} else {
if (idleTimer) {
clearTimeout(idleTimer);
idleTimer = null;
}
if (isIdle && (Math.abs(tiltX) + Math.abs(tiltY) > config.moveThreshold)) {
isIdle = false;
} else if (isIdle) {
return;
}
}

lastTiltX = tiltX;
lastTiltY = tiltY;

const lerpFactor = isIdle ? 0.03 : 0.08;
smoothX += (tiltX - smoothX) * lerpFactor;
smoothY += (tiltY - smoothY) * lerpFactor;
}

return {
start() {
if (isActive) return;
isActive = true;
isIdle = false;
lastRenderTime = 0;

// 不设置默认反光，等第一帧渲染或保持之前状态

if (plus.accelerometer) {
watchId = plus.accelerometer.watchAcceleration(onAccel, (e) => {}, {
frequency: config.frequency
});
}

rafId = requestAnimationFrame(render);
},

stop() {
isActive = false;
if (watchId) {
plus.accelerometer.clearWatch(watchId);
watchId = null;
}
if (rafId) {
cancelAnimationFrame(rafId);
rafId = null;
}
clearTimeout(idleTimer);
idleTimer = null;
isIdle = false;

if (card) card.style.transform = 'translate(0px, 0px)';
}
};
})();

// ===== 光锥固定动画版（最省电，无陀螺仪） =====
const LightConeFixed = {
start() {
let offset = 0;
let direction = 1;
const card = document.querySelector('.light-cone .card');
const shine = document.querySelector('.light-cone .shine');

this.interval = setInterval(() => {
offset += 0.01 * direction;  // 增量保持0.01

if (offset > 2.5) direction = -1;
if (offset < -2.5) direction = 1;

card.style.transform = `translate(${offset * -3}px, 0px)`;

const lineOffset = offset * 60 - 40;
const p1 = 0 + lineOffset;
const p2 = 70 + lineOffset;
const p3 = 140 + lineOffset;
const p4 = 210 + lineOffset;
const p5 = 280 + lineOffset;
const p6 = 350 + lineOffset;

shine.style.background = `
linear-gradient(45deg, transparent ${p1 - 60}%, rgba(255,255,255,0.15) ${p1 - 30}%, rgba(255,255,255,0.3) ${p1}%, transparent ${p1 + 60}%),
linear-gradient(45deg, transparent ${p2 - 6}%, rgba(255,255,255,0.2) ${p2}%, transparent ${p2 + 6}%),
linear-gradient(45deg, transparent ${p3 - 6}%, rgba(255,255,255,0.12) ${p3}%, transparent ${p3 + 6}%),
linear-gradient(45deg, transparent ${p4 - 2}%, rgba(255,255,255,0.12) ${p4}%, transparent ${p4 + 2}%),
linear-gradient(45deg, transparent ${p5 - 6}%, rgba(255,255,255,0.3) ${p5}%, transparent ${p5 + 6}%),
linear-gradient(45deg, transparent ${p6 - 10}%, rgba(255,255,255,0.12) ${p6}%, transparent ${p6 + 10}%)
`;
}, 20);  // 间隔从80ms改20ms，50fps更流畅
},

stop() {
if (this.interval) {
clearInterval(this.interval);
this.interval = null;
}
const card = document.querySelector('.light-cone .card');
if (card) card.style.transform = 'translate(0px, 0px)';
}
};

function scanMediaDirAndUpdatePlaylist() {
    return new Promise((resolve) => {
        plus.io.resolveLocalFileSystemURL(MEDIA_DIR, (dirEntry) => {
            const reader = dirEntry.createReader();
            
            reader.readEntries((entries) => {
                if (!entries || entries.length === 0) {
                    resolve();
                    return;
                }
                
                const existingFiles = new Set();
                playlist.forEach(item => existingFiles.add(item.file));
                
                let hasNewFiles = false;
                
                entries.forEach((entry) => {
                    if (entry.isDirectory) return;
                    const name = entry.name;
                    if (name.endsWith('.json') || name.endsWith('.txt')) return;
                    if (name.startsWith('lenticular_')) return; // 跳过光栅素材
                    
                    if (!existingFiles.has(name)) {
                        const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(name);
                        const isVideo = /\.(mp4|mov|avi|mkv|flv|wmv)$/i.test(name);
                        
                        if (isImage || isVideo) {
                            playlist.push({
                                file: name,
                                type: isImage ? 'image' : 'video'
                            });
                            hasNewFiles = true;
                            console.log('✅ 自动添加新文件:', name);
                        }
                    }
                });
                
                if (hasNewFiles) {
                    savePlaylist();
                    showStatus('🔄 发现 ' + (playlist.length - existingFiles.size) + ' 个新文件');
                }
                
                resolve();
            }, (e) => {
                console.log('⚠️ 扫描目录失败:', e.message);
                resolve();
            });
        }, () => {
            resolve();
        });
    });
}

const LightConeSuperLite = (function() {
    let watchId = null;
    let isActive = false;
    let lastTiltX = 0;
    let lastTiltY = 0;
    let smoothX = 0;
    let smoothY = 0;
    let rafId = null;
    let idleTimer = null;
    let isIdle = false;
    let lastRenderTime = 0;
	
	const config = {
        frequency: 24,
        idleThreshold: 0.2,
        idleDelay: 5000,
        moveThreshold: 0.35,
        cardMoveScale: 1.2,
        shineMoveScale: 2500,
        centerBias: -1.2,
        renderInterval: 1000 / 24
    };

    const card = document.querySelector('.light-cone .card');
    const shine = document.querySelector('.light-cone .shine');

    function isInViewport() {
        const rect = card.getBoundingClientRect();
        return rect.top < window.innerHeight + 50 &&
               rect.bottom > -50 &&
               rect.left < window.innerWidth + 50 &&
               rect.right > -50;
    }

    function render(now) {
        if (!isActive) return;

        if (now - lastRenderTime < config.renderInterval) {
            rafId = requestAnimationFrame(render);
            return;
        }
        lastRenderTime = now;

        if (isIdle || !isInViewport()) {
            rafId = requestAnimationFrame(render);
            return;
        }

        const cardX = smoothX * -config.cardMoveScale;
        const cardY = smoothY * -config.cardMoveScale;
        card.style.transform = 'translate3d(' + cardX + 'px, ' + cardY + 'px, 0)';

        const shineX_vw = ((smoothX + config.centerBias) * config.shineMoveScale) / 10.8;
        shine.style.transform = 'translate3d(' + shineX_vw + 'vw, 0, 0)';

        rafId = requestAnimationFrame(render);
    }

    function onAccel(a) {
        const tiltX = a.xAxis;
        const tiltY = a.yAxis;
        const delta = Math.abs(tiltX - lastTiltX) + Math.abs(tiltY - lastTiltY);

        if (delta < config.idleThreshold) {
            if (!idleTimer && !isIdle) {
                idleTimer = setTimeout(() => {
                    isIdle = true;
                }, config.idleDelay);
            }
        } else {
            if (idleTimer) {
                clearTimeout(idleTimer);
                idleTimer = null;
            }
            if (isIdle && (Math.abs(tiltX) + Math.abs(tiltY) > config.moveThreshold)) {
                isIdle = false;
            } else if (isIdle) {
                return;
            }
        }

        lastTiltX = tiltX;
        lastTiltY = tiltY;

        const lerpFactor = isIdle ? 0.03 : 0.08;
        smoothX += (tiltX - smoothX) * lerpFactor;
        smoothY += (tiltY - smoothY) * lerpFactor;
    }

    return {
        start() {
            if (isActive) return;
            isActive = true;
            isIdle = false;
            lastRenderTime = 0;

            if (shine) {
                shine.classList.add('super-lite');
                shine.style.background = '';
            }

            if (plus.accelerometer) {
                watchId = plus.accelerometer.watchAcceleration(onAccel, (e) => {}, {
                    frequency: config.frequency
                });
            }

            rafId = requestAnimationFrame(render);
        },

        stop() {
            isActive = false;
            if (watchId) {
                plus.accelerometer.clearWatch(watchId);
                watchId = null;
            }
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            clearTimeout(idleTimer);
            idleTimer = null;
            isIdle = false;

            if (card) card.style.transform = 'translate3d(0, 0, 0)';
            if (shine) {
                shine.style.transform = 'translate3d(0, 0, 0)';
                shine.classList.remove('super-lite');
            }
        }
    };
})();

const LightConeFixedLite = {
    interval: null,
    start() {
        let offset = 0;
        let direction = 1;
        const card = document.querySelector('.light-cone .card');
        const shine = document.querySelector('.light-cone .shine');

        if (shine) {
            shine.classList.add('super-lite');
            shine.style.background = '';
        }

        this.interval = setInterval(() => {
            offset += 0.01 * direction;

            if (offset > 2.5) direction = -1;
            if (offset < -2.5) direction = 1;

            const cardX = offset * -3;
            if (card) card.style.transform = 'translate3d(' + cardX + 'px, 0, 0)';

            const simulatedSmoothX = offset - 1.0;
            const shineX_vw = (simulatedSmoothX * 4500) / 10.8;
            if (shine) shine.style.transform = 'translate3d(' + shineX_vw + 'vw, 0, 0)';

        }, 20);
    },

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        const card = document.querySelector('.light-cone .card');
        const shine = document.querySelector('.light-cone .shine');
        if (card) card.style.transform = 'translate3d(0, 0, 0)';
        if (shine) {
            shine.style.transform = 'translate3d(0, 0, 0)';
            shine.classList.remove('super-lite');
        }
    }
};

const lightConeSelectors = [
    'lightConeCheck',
    'lightConeLiteCheck',
    'lightConeSuperLiteCheck',
    'lightConeFixedLiteCheck',
    'lightConeFixedCheck'
];

lightConeSelectors.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('change', function() {
            if (this.checked) {
                lightConeSelectors.forEach((otherId) => {
                    if (otherId !== id) {
                        const otherEl = document.getElementById(otherId);
                        if (otherEl) {
                            otherEl.checked = false;
                        }
                    }
                });
            }
        });
    }
});

let countdownInterval = null;

function startKeepAndroidOpenCountdown() {
    stopKeepAndroidOpenCountdown();
    const targetDate = new Date('2026-09-01T00:00:00').getTime();
    
    const updateTimer = () => {
        const now = new Date().getTime();
        const diff = targetDate - now;
        
        if (diff <= 0) {
            document.getElementById('keepAndroidOpenCountdown').innerText = '安卓系统封闭限制已开始执行';
            clearInterval(countdownInterval);
            return;
        }
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        document.getElementById('keepAndroidOpenCountdown').innerText = 
            '安卓系统闭源倒计时: ' + days + '天 ' + hours + '时 ' + minutes + '分 ' + seconds + '秒';
    };
    
    updateTimer();
    countdownInterval = setInterval(updateTimer, 1000);
}

function stopKeepAndroidOpenCountdown() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
}

document.getElementById('aboutBtn').onclick = () => {
    document.getElementById('aboutView').style.display = 'flex';
    startKeepAndroidOpenCountdown();
};

document.getElementById('aboutCloseBtn').onclick = () => {
    document.getElementById('aboutView').style.display = 'none';
    stopKeepAndroidOpenCountdown();
};