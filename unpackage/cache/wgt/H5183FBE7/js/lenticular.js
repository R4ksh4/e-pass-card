// ===== 光栅专用页逻辑 =====
const MEDIA_DIR = '_doc/pass_media/';
const LENTICULAR_FILE = '_doc/pass_media/lenticular_list.json';

let lenticularList = new Array(6).fill(null);
let isPreviewMode = false;
// UI visibility state for preview mode
let uiVisible = true;

function showStatus(msg) {
    const el = document.getElementById('status');
    if (el) {
        el.innerText = msg;
        el.style.display = 'block';
        setTimeout(() => { el.style.display = 'none'; }, 2000);
    }
}

function createDir() {
    return new Promise((resolve, reject) => {
        plus.io.requestFileSystem(plus.io.PRIVATE_DOC, (fs) => {
            fs.root.getDirectory('pass_media', { create: true }, resolve, reject);
        }, reject);
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

function renderEditor() {
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
            thumb.src = plus.io.convertLocalFileSystemURL(MEDIA_DIR + item.file);
            thumb.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:1;';
            slot.appendChild(thumb);

            const delBtn = document.createElement('div');
            delBtn.className = 'delete-btn';
            delBtn.innerText = '✕';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                if (confirm('删除这张素材？')) {
                    lenticularList[i] = null;
                    saveLenticularList();
                    renderEditor();
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
            renderEditor();
        } catch(e) {
            showStatus('添加失败');
        }
    }, (e) => {}, { filter: 'image' });
}

// ===== 光栅效果引擎 =====
const LenticularEngine = (function() {
    let watchId = null;
    let rafId = null;
    let isActive = false;
    let smoothAngle = 0;
    // Using sensitivity-based mapping instead of fixed maxAngle
    const layers = [];

    function getActiveCount() {
        let count = 0;
        for (let i = 0; i < 6; i++) {
            if (lenticularList[i] && lenticularList[i].file) count++;
        }
        return count;
    }

    function initLayers() {
        const container = document.getElementById('lenticularPreview');
        if (!container) return;
        container.innerHTML = '';
        layers.length = 0;

        const count = getActiveCount();
        if (count === 0) return;

        for (let i = 0; i < 6; i++) {
            const item = lenticularList[i];
            const div = document.createElement('div');
            div.className = 'lenticular-layer';
            if (item && item.file) {
                div.style.backgroundImage = 'url(' + plus.io.convertLocalFileSystemURL(MEDIA_DIR + item.file) + ')';
            }
            container.appendChild(div);
            layers.push(div);
        }
    }

    function getOpacities(angle) {
        const count = getActiveCount();
        if (count === 0) return new Array(6).fill(0);
        if (count === 1) {
            const op = new Array(6).fill(0);
            for (let i = 0; i < 6; i++) {
                if (lenticularList[i] && lenticularList[i].file) {
                    op[i] = 1;
                    break;
                }
            }
            return op;
        }

        const sensitivity = 1.5;
        const normalized = (angle + sensitivity) / (sensitivity * 2.4);
        const clamped = Math.max(0, Math.min(1, normalized));

        const opacities = new Array(6).fill(0);
        const activeIndices = [];
        for (let i = 0; i < 6; i++) {
            if (lenticularList[i] && lenticularList[i].file) activeIndices.push(i);
        }

        if (activeIndices.length === 0) return opacities;

        const maxPos = activeIndices.length - 1;
        const virtualPos = Math.max(0, Math.min(maxPos, clamped * maxPos));
        const mainIdx = Math.floor(virtualPos);
        const mix = virtualPos - mainIdx;

        if (mainIdx >= 0 && mainIdx < activeIndices.length) {
            opacities[activeIndices[mainIdx]] = 1 - mix;
        }
        if (mix > 0 && mainIdx + 1 < activeIndices.length) {
            opacities[activeIndices[mainIdx + 1]] = mix;
        }
        return opacities;
    }

    function onAccel(a) {
        const angle = a.xAxis || 0;
        smoothAngle += (angle - smoothAngle) * 0.15;
    }

    function render() {
        if (!isActive) return;
        const opacities = getOpacities(smoothAngle);
        for (let i = 0; i < layers.length; i++) {
            if (layers[i]) {
                layers[i].style.opacity = opacities[i].toFixed(3);
            }
        }
        rafId = requestAnimationFrame(render);
    }

    return {
        start() {
            if (isActive) return;
            const count = getActiveCount();
            if (count === 0) {
                showStatus('请先添加光栅素材');
                return;
            }
            isActive = true;
            smoothAngle = 0;
            initLayers();
            document.body.classList.add('preview-mode');
            document.getElementById('lenticularPreview').style.display = 'block';
            if (plus.accelerometer) {
                watchId = plus.accelerometer.watchAcceleration(onAccel, () => {}, { frequency: 30 });
            }
            rafId = requestAnimationFrame(render);
            isPreviewMode = true;
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
            document.body.classList.remove('preview-mode');
            document.getElementById('lenticularPreview').style.display = 'none';

            // 重置锁按钮状态
            const lockBtn = document.getElementById('lockBtn');
            if (lockBtn) lockBtn.style.display = 'none';
            isLocked = false;

            isPreviewMode = false;
        }
    };
})();

// ===== 锁屏功能 =====
function toggleUI() {
    uiVisible = !uiVisible;
    const bottomControls = document.getElementById('bottomControls');

    if (uiVisible) {
        bottomControls.classList.remove('hidden');
    } else {
        bottomControls.classList.add('hidden');
    }
}

// ===== 页面初始化 =====
document.addEventListener('plusready', () => {
    plus.navigator.setFullscreen(true);
    plus.screen.lockOrientation('portrait-primary');

    // 屏蔽手势
    document.body.addEventListener('touchstart', (e) => {
        if (e.touches.length > 3) {
            e.preventDefault();
            return;
        }
    }, { passive: false });

    // 返回键处理
    plus.key.addEventListener('backbutton', (e) => {
        e.preventDefault();
        if (isPreviewMode) {
            LenticularEngine.stop();
        } else {
            location.href = 'index.html';
        }
    });

    // 加载素材列表
    createDir().then(() => loadLenticularList()).then(() => {
        renderEditor();
    });

    // 事件绑定
    document.getElementById('closeBtn').onclick = () => {
        if (isPreviewMode) LenticularEngine.stop();
        location.href = 'index.html';
    };

    document.getElementById('backBtn').onclick = () => {
        if (isPreviewMode) {
            LenticularEngine.stop();
        } else {
            location.href = 'index.html';
        }
    };

    document.getElementById('previewBtn').onclick = () => {
        LenticularEngine.start();
    };

    document.getElementById('backToEditorBtn').onclick = () => {
        LenticularEngine.stop();
    };

    document.getElementById('lockBtn').onclick = (e) => {
        e.stopPropagation();
        isLocked = !isLocked;
        const bottomControls = document.getElementById('bottomControls');
        const lockBtn = document.getElementById('lockBtn');

        if (isLocked) {
            bottomControls.classList.add('hidden');
            lockBtn.style.display = 'none';
            showStatus('🔒 已锁定');
        } else {
            bottomControls.classList.remove('hidden');
            lockBtn.style.display = 'flex';
            showStatus('🔓 已解锁');
        }
    };

    // 预览模式：点击切换UI，双指切换锁
    let isLocked = false;

    // 点击屏幕切换UI显示/隐藏（锁定状态下无效）
    document.body.addEventListener('click', (e) => {
        if (!isPreviewMode) return;
        if (e.target.closest('.bottom-controls')) return;
        if (isLocked) return; // 锁定状态下点击无效

        const bottomControls = document.getElementById('bottomControls');
        const lockBtn = document.getElementById('lockBtn');

        if (bottomControls.classList.contains('hidden')) {
            bottomControls.classList.remove('hidden');
            lockBtn.style.display = 'flex';
        } else {
            bottomControls.classList.add('hidden');
            lockBtn.style.display = 'none';
        }
    });

    // 双指长按3秒切换锁定状态
    let lockTimer = null;
    document.body.addEventListener('touchstart', (e) => {
        if (!isPreviewMode) return;
        if (e.touches.length === 2) {
            if (lockTimer) clearTimeout(lockTimer);
            lockTimer = setTimeout(() => {
                isLocked = !isLocked;
                const bottomControls = document.getElementById('bottomControls');
                const lockBtn = document.getElementById('lockBtn');

                if (isLocked) {
                    bottomControls.classList.add('hidden');
                    lockBtn.style.display = 'none';
                    showStatus('🔒 已锁定');
                } else {
                    bottomControls.classList.remove('hidden');
                    lockBtn.style.display = 'flex';
                    showStatus('🔓 已解锁');
                }
                lockTimer = null;
            }, 3000);
        }
    }, { passive: false });

    document.body.addEventListener('touchend', () => {
        if (unlockTimer) {
            clearTimeout(unlockTimer);
            unlockTimer = null;
        }
    });
});
