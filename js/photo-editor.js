/**
 * Editor de Fotografías — P.A. Perú v2
 */
const PhotoEditor = (() => {
    const RECENT_KEY = 'photo_editor_recent_imports';
    const QUALITY_KEY = 'photo_editor_export_quality';

    const state = {
        photos: [],
        currentIndex: -1,
        config: null,
        stampImage: null,
        previewMode: true,
        currentView: 'importar',
        dragLineIndex: null,
        fullscreenIndex: -1,
        selectAllActive: false
    };

    let fsRefreshTimer = null;
    let cardClickTimer = null;

    const $ = id => document.getElementById(id);

    function init() {
        state.config = StampConfig.defaultConfig();
        bindEvents();
        renderLineInputs();
        renderHistory();
        renderHistoryMain();
        renderTemplates();
        renderRecentImports();
        updatePositionGrid();
        updateFontSizeLabel();
        updateStampUI();
        $('stamp-width-val').textContent = $('cfg-stamp-width').value + '%';
        $('input-user').value = HistoryManager.getCurrentUser();
        $('settings-user').value = HistoryManager.getCurrentUser();
        const q = localStorage.getItem(QUALITY_KEY) || '95';
        $('settings-quality').value = q;
        $('settings-quality-val').textContent = q + '%';
        updateNotifBadge();
        updateSelectionUI();
        setStatus('Listo — Importe fotografías');
    }

    function bindEvents() {
        const openFile = () => $('file-input').click();

        $('btn-import-header')?.addEventListener('click', openFile);
        $('btn-select-files')?.addEventListener('click', e => { e.stopPropagation(); openFile(); });
        $('btn-import-from-editor')?.addEventListener('click', openFile);
        $('btn-export-zip-header')?.addEventListener('click', exportAllZip);
        $('file-input').addEventListener('change', handleFileImport);

        const dropZone = $('drop-zone');
        dropZone?.addEventListener('click', e => {
            if (e.target.closest('#btn-select-files')) return;
            openFile();
        });
        dropZone?.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
        dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone?.addEventListener('drop', handleDrop);

        $('content-area')?.addEventListener('dragover', e => e.preventDefault());
        $('content-area')?.addEventListener('drop', handleDrop);

        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => navigateTo(item.dataset.view, item.dataset.panelSection));
        });

        document.querySelectorAll('.quick-card').forEach(card => {
            card.addEventListener('click', () => navigateTo(card.dataset.goto));
        });

        $('btn-view-all-editor')?.addEventListener('click', () => navigateTo('editor'));
        $('btn-collapse-sidebar')?.addEventListener('click', toggleSidebar);
        $('btn-quick-guide')?.addEventListener('click', showQuickGuide);
        $('btn-help')?.addEventListener('click', showQuickGuide);

        $('btn-clear-history-main')?.addEventListener('click', clearHistory);
        $('btn-save-template')?.addEventListener('click', saveCurrentTemplate);
        $('btn-clear-recent')?.addEventListener('click', clearRecentImports);

        $('btn-lines-minus').addEventListener('click', () => changeLineCount(-1));
        $('btn-lines-plus').addEventListener('click', () => changeLineCount(1));

        $('cfg-text-position').addEventListener('change', () => {
            state.config.textPosition = $('cfg-text-position').value;
            updatePositionGrid();
            onConfigChanged();
        });

        $('btn-load-stamp').addEventListener('click', () => $('stamp-file-input').click());
        $('link-upload-stamp')?.addEventListener('click', e => { e.preventDefault(); $('stamp-file-input').click(); });
        $('stamp-file-input').addEventListener('change', handleStampLoad);
        $('btn-remove-stamp').addEventListener('click', removeStamp);

        const stampZone = $('stamp-dropzone');
        stampZone?.addEventListener('click', e => {
            if (e.target.closest('#btn-remove-stamp')) return;
            $('stamp-file-input').click();
        });
        stampZone?.addEventListener('dragover', e => { e.preventDefault(); stampZone.classList.add('dragover'); });
        stampZone?.addEventListener('dragleave', () => stampZone.classList.remove('dragover'));
        stampZone?.addEventListener('drop', handleStampDrop);

        $('btn-apply-config').addEventListener('click', applyConfigToAll);
        $('btn-apply-config-bottom').addEventListener('click', applyConfigToAll);
        $('btn-preview-config').addEventListener('click', togglePreview);
        $('btn-select-all')?.addEventListener('click', toggleSelectAll);

        $('fs-btn-close')?.addEventListener('click', closeFullscreenEditor);
        $('fs-btn-prev')?.addEventListener('click', () => navigateFullscreen(-1));
        $('fs-btn-next')?.addEventListener('click', () => navigateFullscreen(1));
        $('fs-btn-apply-one')?.addEventListener('click', applyConfigToCurrentFullscreen);

        $('cfg-stamp-width').addEventListener('input', () => {
            $('stamp-width-val').textContent = $('cfg-stamp-width').value + '%';
            onConfigChanged();
        });

        $('cfg-font-size').addEventListener('input', () => {
            updateFontSizeLabel();
            onConfigChanged();
        });

        $('cfg-line-spacing')?.addEventListener('input', () => {
            $('line-spacing-val').textContent = $('cfg-line-spacing').value + '×';
            onConfigChanged();
        });

        ['cfg-margin-x', 'cfg-margin-y', 'cfg-font-color', 'cfg-font-family', 'cfg-font-weight',
            'cfg-text-shadow', 'cfg-stamp-margin-x', 'cfg-stamp-margin-y', 'cfg-stamp-enabled', 'cfg-stamp-position'].forEach(id => {
            $(id)?.addEventListener('change', onConfigChanged);
            $(id)?.addEventListener('input', onConfigChanged);
        });

        document.querySelectorAll('#text-position-grid .grid-cell:not(:disabled)').forEach(cell => {
            cell.addEventListener('click', () => {
                $('cfg-text-position').value = cell.dataset.pos;
                state.config.textPosition = cell.dataset.pos;
                updatePositionGrid();
                onConfigChanged();
            });
        });

        $('input-user').addEventListener('blur', syncUser);
        $('settings-user')?.addEventListener('blur', () => {
            $('input-user').value = $('settings-user').value;
            syncUser();
        });

        $('settings-quality')?.addEventListener('input', () => {
            const v = $('settings-quality').value;
            $('settings-quality-val').textContent = v + '%';
            localStorage.setItem(QUALITY_KEY, v);
        });

        $('search-input')?.addEventListener('focus', openSearchModal);
        $('search-input')?.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); runSearch($('search-input').value); openSearchModal(); }
        });

        $('search-modal-backdrop')?.addEventListener('click', closeSearchModal);
        $('search-modal-input')?.addEventListener('input', e => runSearch(e.target.value));
        $('search-modal-input')?.addEventListener('keydown', e => {
            if (e.key === 'Escape') closeSearchModal();
            if (e.key === 'Enter') {
                const active = document.querySelector('.search-result-item.active');
                if (active) active.click();
            }
        });

        document.addEventListener('keydown', e => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                openSearchModal();
            }
            if (e.key === 'Escape') {
                if (state.fullscreenIndex >= 0) closeFullscreenEditor();
                else closeSearchModal();
            }
            if (state.fullscreenIndex >= 0 && e.key === 'ArrowLeft') navigateFullscreen(-1);
            if (state.fullscreenIndex >= 0 && e.key === 'ArrowRight') navigateFullscreen(1);
        });
    }

    function onConfigChanged() {
        if (state.fullscreenIndex >= 0 && state.previewMode) scheduleFullscreenRefresh();
    }

    function scheduleFullscreenRefresh() {
        clearTimeout(fsRefreshTimer);
        fsRefreshTimer = setTimeout(refreshFullscreenPreview, 50);
    }

    function getSelectedIndices() {
        const selected = state.photos.map((p, i) => (p.selected ? i : -1)).filter(i => i >= 0);
        return selected;
    }

    function getTargetIndices() {
        const selected = getSelectedIndices();
        return selected.length ? selected : state.photos.map((_, i) => i);
    }

    function updateSelectionUI() {
        const selected = getSelectedIndices();
        const badge = $('selection-count');
        const btnAll = $('btn-select-all');
        if (!badge || !btnAll) return;

        if (selected.length) {
            badge.style.display = 'inline-flex';
            badge.textContent = `${selected.length} seleccionada${selected.length > 1 ? 's' : ''}`;
        } else {
            badge.style.display = 'none';
        }

        const allSelected = state.photos.length > 0 && selected.length === state.photos.length;
        state.selectAllActive = allSelected;
        btnAll.innerHTML = allSelected
            ? '<i class="fas fa-square"></i> Deseleccionar todo'
            : '<i class="fas fa-check-square"></i> Seleccionar todo';
    }

    function toggleSelectAll() {
        if (!state.photos.length) return;
        const shouldSelect = !state.selectAllActive && getSelectedIndices().length < state.photos.length;
        state.photos.forEach(p => { p.selected = shouldSelect; });
        state.selectAllActive = shouldSelect;
        renderMainGallery();
        updateSelectionUI();
    }

    function togglePhotoSelection(index, checked) {
        if (!state.photos[index]) return;
        state.photos[index].selected = checked;
        updateSelectionUI();
    }

    function openFullscreenEditor(index) {
        if (index < 0 || index >= state.photos.length) return;
        clearTimeout(cardClickTimer);
        state.fullscreenIndex = index;
        state.currentIndex = index;
        state.previewMode = true;
        $('fullscreen-editor').hidden = false;
        $('app-shell')?.classList.add('fs-editing-active');
        $('btn-preview-config')?.classList.add('fs-preview-on');
        $('btn-preview-config').innerHTML = '<i class="fas fa-eye"></i> Vista previa activa';
        navigateTo('editor');
        refreshFullscreenPreview();
        updateActiveCard(index);
        setStatus(`Editando: ${state.photos[index].name}`);
    }

    function closeFullscreenEditor() {
        state.fullscreenIndex = -1;
        $('fullscreen-editor').hidden = true;
        $('app-shell')?.classList.remove('fs-editing-active');
        setStatus('Edición cerrada');
    }

    function navigateFullscreen(delta) {
        if (state.fullscreenIndex < 0) return;
        const next = state.fullscreenIndex + delta;
        if (next < 0 || next >= state.photos.length) return;
        openFullscreenEditor(next);
    }

    function drawToFullscreenCanvas(sourceCanvas) {
        const fsCanvas = $('fs-preview-canvas');
        const wrap = fsCanvas.parentElement;
        const maxW = wrap.clientWidth - 20;
        const maxH = window.innerHeight - 160;
        const scale = Math.min(maxW / sourceCanvas.width, maxH / sourceCanvas.height, 1);

        fsCanvas.width = Math.round(sourceCanvas.width * scale);
        fsCanvas.height = Math.round(sourceCanvas.height * scale);
        fsCanvas.getContext('2d').drawImage(sourceCanvas, 0, 0, fsCanvas.width, fsCanvas.height);
    }

    function refreshFullscreenPreview() {
        const index = state.fullscreenIndex;
        if (index < 0 || !state.photos[index]) return;

        const photo = state.photos[index];

        if (state.previewMode) {
            readConfigFromUI();
            const config = state.config;
            const stampImg = config.stamp.enabled ? state.stampImage : null;
            const { canvas } = StampConfig.compositePhoto(photo, config, stampImg);
            drawToFullscreenCanvas(canvas);
        } else {
            drawToFullscreenCanvas(photo.baseCanvas);
        }

        $('fs-photo-name').textContent = photo.name;
        $('fs-photo-index').textContent = `${index + 1} / ${state.photos.length}`;
        $('fs-btn-prev').disabled = index === 0;
        $('fs-btn-next').disabled = index === state.photos.length - 1;
    }

    window.addEventListener('resize', () => {
        if (state.fullscreenIndex >= 0) scheduleFullscreenRefresh();
    });

    async function applyConfigToIndices(indices) {
        if (!indices.length) {
            alert('No hay fotografías para procesar');
            return;
        }
        readConfigFromUI();
        const config = state.config;
        const stampImg = config.stamp.enabled ? state.stampImage : null;

        showLoading(true, 'Aplicando configuración...');
        $('progress-bar').classList.add('visible');

        let done = 0;
        for (const i of indices) {
            const photo = state.photos[i];
            if (!photo) continue;
            const { canvas, textLayers } = StampConfig.compositePhoto(photo, config, stampImg);
            if (stampImg && config.stamp.enabled) {
                const rect = StampConfig.calcStampRect(canvas.width, canvas.height, config.stamp, stampImg);
                photo.stampLayer = rect ? { image: stampImg, ...rect } : null;
            } else {
                photo.stampLayer = null;
            }
            photo.canvas = canvas;
            photo.textLayers = textLayers;
            photo.modified = true;
            photo.thumbnail = createThumbnail(canvas);
            done++;
            $('progress-fill').style.width = Math.round((done / indices.length) * 100) + '%';
        }

        HistoryManager.addEntry({
            photoName: `${indices.length} fotografía(s)`,
            originalText: '—',
            newText: `${config.lineCount} líneas + ${config.stamp.enabled ? 'sello' : 'sin sello'}`,
            type: 'configuracion'
        });

        renderMainGallery();
        renderRecentImports();
        renderHistoryMain();
        updateNotifBadge();
        if (state.fullscreenIndex >= 0) refreshFullscreenPreview();
        showLoading(false);
        $('progress-bar').classList.remove('visible');
        setStatus(`Configuración aplicada a ${indices.length} foto(s)`);
    }

    function applyConfigToCurrentFullscreen() {
        if (state.fullscreenIndex < 0) return;
        applyConfigToIndices([state.fullscreenIndex]);
    }

    function syncUser() {
        const name = $('input-user').value.trim();
        if (name) HistoryManager.setCurrentUser(name);
    }

    function navigateTo(view, panelSection) {
        state.currentView = view;
        document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view));
        document.querySelectorAll('.view-section').forEach(s => s.classList.toggle('active', s.dataset.view === view));

        document.querySelectorAll('.config-card').forEach(c => c.classList.remove('highlight'));
        if (panelSection) {
            const section = $(panelSection);
            section?.classList.add('highlight');
            section?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            setTimeout(() => section?.classList.remove('highlight'), 2000);
        }

        if (view === 'editor') renderMainGallery();
        if (view === 'plantillas') renderTemplates();
        if (view === 'historial') renderHistoryMain();
    }

    function toggleSidebar() {
        $('app-shell').classList.toggle('sidebar-collapsed');
    }

    function showQuickGuide() {
        alert(
            'Guía rápida — Editor de Fotografías\n\n' +
            '1. Importa fotografías (arrastra o selecciona archivos)\n' +
            '2. Configura las líneas de texto en el panel derecho\n' +
            '3. Sube tu sello/logo si lo necesitas\n' +
            '4. Usa Vista previa para ver el resultado\n' +
            '5. Aplica la configuración a todas las fotos\n' +
            '6. Exporta individualmente o en ZIP\n\n' +
            'Tip: Arrastra las líneas para reordenarlas.'
        );
    }

    function openSearchModal() {
        const modal = $('search-modal');
        modal.hidden = false;
        $('search-modal-input').value = $('search-input').value;
        runSearch($('search-modal-input').value);
        $('search-modal-input').focus();
    }

    function closeSearchModal() {
        $('search-modal').hidden = true;
    }

    function runSearch(query) {
        const q = (query || '').trim().toLowerCase();
        const results = [];

        const actions = [
            { icon: 'fa-cloud-upload-alt', label: 'Importar fotografías', action: () => { closeSearchModal(); $('file-input').click(); } },
            { icon: 'fa-check-double', label: 'Aplicar configuración a todas', action: () => { closeSearchModal(); applyConfigToAll(); } },
            { icon: 'fa-file-archive', label: 'Exportar ZIP', action: () => { closeSearchModal(); exportAllZip(); } },
            { icon: 'fa-eye', label: 'Vista previa', action: () => { closeSearchModal(); navigateTo('editor'); togglePreview(); } },
            { icon: 'fa-layer-group', label: 'Plantillas', action: () => { closeSearchModal(); navigateTo('plantillas'); } },
            { icon: 'fa-list-ol', label: 'Líneas de texto', action: () => { closeSearchModal(); navigateTo('lineas', 'section-lines'); } },
            { icon: 'fa-stamp', label: 'Sellos / Logo', action: () => { closeSearchModal(); navigateTo('sellos', 'section-stamp'); } }
        ];

        actions.forEach(a => {
            if (!q || a.label.toLowerCase().includes(q)) results.push({ type: 'action', ...a });
        });

        state.photos.forEach((photo, i) => {
            if (!q || photo.name.toLowerCase().includes(q)) {
                results.push({
                    type: 'photo',
                    icon: 'fa-image',
                    label: photo.name,
                    action: () => {
                        closeSearchModal();
                        navigateTo('editor');
                        state.currentIndex = i;
                        renderMainGallery();
                    }
                });
            }
        });

        const list = $('search-results');
        if (!results.length) {
            list.innerHTML = '<li class="search-result-item" style="color:var(--text-dim);cursor:default;">Sin resultados</li>';
            return;
        }

        list.innerHTML = results.map((r, i) =>
            `<li class="search-result-item${i === 0 ? ' active' : ''}" data-idx="${i}">
                <i class="fas ${r.icon}"></i><span>${escapeHtml(r.label)}</span>
            </li>`
        ).join('');

        list.querySelectorAll('.search-result-item').forEach((el, i) => {
            el.addEventListener('click', () => results[i]?.action?.());
        });
    }

    function updateFontSizeLabel() {
        $('font-size-val').textContent = $('cfg-font-size').value + '%';
        if ($('line-spacing-val') && $('cfg-line-spacing')) {
            $('line-spacing-val').textContent = $('cfg-line-spacing').value + '×';
        }
    }

    function updateActiveCard(index) {
        document.querySelectorAll('.photo-card').forEach((card, i) => {
            card.classList.toggle('active', i === index);
        });
    }

    function updateNotifBadge() {
        const badge = $('notif-badge');
        if (!badge) return;
        const count = state.photos.filter(p => p.modified).length;
        badge.textContent = count;
        badge.dataset.count = count;
    }

    function setLineCount(n) {
        state.config.lineCount = n;
        $('cfg-line-count').value = n;
        while (state.config.lines.length < n) state.config.lines.push('');
        renderLineInputs();
    }

    function changeLineCount(delta) {
        setLineCount(Math.max(0, Math.min(15, state.config.lineCount + delta)));
    }

    function deleteLine(index) {
        state.config.lines.splice(index, 1);
        setLineCount(Math.max(0, state.config.lineCount - 1));
        onConfigChanged();
    }

    function reorderLines(from, to) {
        if (from === to || from < 0 || to < 0) return;
        const lines = [...state.config.lines];
        const [moved] = lines.splice(from, 1);
        lines.splice(to, 0, moved);
        state.config.lines = lines;
        renderLineInputs();
        onConfigChanged();
    }

    function renderLineInputs() {
        const container = $('cfg-lines-container');
        container.innerHTML = '';

        for (let i = 0; i < state.config.lineCount; i++) {
            const div = document.createElement('div');
            div.className = 'cfg-line-item';
            div.draggable = true;
            div.dataset.idx = i;
            div.innerHTML = `
                <span class="line-grip" title="Arrastrar para reordenar"><i class="fas fa-grip-vertical"></i></span>
                <input type="text" class="field-input cfg-line-input" data-idx="${i}"
                    placeholder="Línea ${i + 1}" value="${escapeAttr(state.config.lines[i] || '')}">
                <button type="button" class="line-delete" title="Eliminar línea"><i class="fas fa-trash-alt"></i></button>
            `;

            div.querySelector('input').addEventListener('input', e => {
                state.config.lines[parseInt(e.target.dataset.idx)] = e.target.value;
                onConfigChanged();
            });
            div.querySelector('.line-delete').addEventListener('click', () => deleteLine(i));

            div.addEventListener('dragstart', e => {
                state.dragLineIndex = i;
                div.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });
            div.addEventListener('dragend', () => {
                div.classList.remove('dragging');
                container.querySelectorAll('.cfg-line-item').forEach(el => el.classList.remove('drag-over'));
                state.dragLineIndex = null;
            });
            div.addEventListener('dragover', e => {
                e.preventDefault();
                div.classList.add('drag-over');
            });
            div.addEventListener('dragleave', () => div.classList.remove('drag-over'));
            div.addEventListener('drop', e => {
                e.preventDefault();
                div.classList.remove('drag-over');
                const to = parseInt(div.dataset.idx);
                if (state.dragLineIndex !== null) reorderLines(state.dragLineIndex, to);
            });

            container.appendChild(div);
        }
    }

    function escapeAttr(str) {
        return String(str).replace(/"/g, '&quot;').replace(/</g, '&lt;');
    }

    function readConfigFromUI() {
        const lines = [];
        document.querySelectorAll('.cfg-line-input').forEach(inp => {
            lines[parseInt(inp.dataset.idx)] = inp.value;
        });
        state.config.lineCount = parseInt($('cfg-line-count').value) || 0;
        state.config.lines = lines;
        state.config.textPosition = $('cfg-text-position').value;
        state.config.textMarginX = parseFloat($('cfg-margin-x').value) || 2.5;
        state.config.textMarginY = parseFloat($('cfg-margin-y').value) || 2.5;
        state.config.fontSizeRatio = (parseFloat($('cfg-font-size').value) || 2.2) / 100;
        state.config.fontColor = $('cfg-font-color').value;
        state.config.fontFamily = $('cfg-font-family')?.value || 'Arial, sans-serif';
        state.config.fontWeight = $('cfg-font-weight')?.value || 'normal';
        state.config.lineSpacing = parseFloat($('cfg-line-spacing')?.value) || 1.35;
        state.config.textShadow = $('cfg-text-shadow')?.checked !== false;
        state.config.stamp.enabled = $('cfg-stamp-enabled').checked;
        state.config.stamp.position = $('cfg-stamp-position').value;
        state.config.stamp.widthPercent = parseInt($('cfg-stamp-width').value) || 20;
        state.config.stamp.marginX = parseFloat($('cfg-stamp-margin-x').value) || 2;
        state.config.stamp.marginY = parseFloat($('cfg-stamp-margin-y').value) || 2;
        return state.config;
    }

    function applyConfigToUI(config) {
        $('cfg-line-count').value = config.lineCount;
        $('cfg-text-position').value = config.textPosition;
        $('cfg-margin-x').value = config.textMarginX;
        $('cfg-margin-y').value = config.textMarginY;
        $('cfg-font-size').value = (config.fontSizeRatio * 100).toFixed(1);
        $('cfg-font-color').value = config.fontColor;
        if ($('cfg-font-family')) $('cfg-font-family').value = config.fontFamily || 'Arial, sans-serif';
        if ($('cfg-font-weight')) $('cfg-font-weight').value = config.fontWeight || 'normal';
        if ($('cfg-line-spacing')) $('cfg-line-spacing').value = config.lineSpacing || 1.35;
        if ($('cfg-text-shadow')) $('cfg-text-shadow').checked = config.textShadow !== false;
        $('cfg-stamp-enabled').checked = config.stamp.enabled;
        $('cfg-stamp-position').value = config.stamp.position;
        $('cfg-stamp-width').value = config.stamp.widthPercent;
        $('cfg-stamp-margin-x').value = config.stamp.marginX;
        $('cfg-stamp-margin-y').value = config.stamp.marginY;
        state.config = JSON.parse(JSON.stringify(config));
        renderLineInputs();
        updatePositionGrid();
        updateFontSizeLabel();
        $('stamp-width-val').textContent = config.stamp.widthPercent + '%';
        onConfigChanged();
    }

    function updatePositionGrid() {
        const pos = $('cfg-text-position').value;
        document.querySelectorAll('#text-position-grid .grid-cell').forEach(cell => {
            if (!cell.disabled) cell.classList.toggle('active', cell.dataset.pos === pos);
        });
    }

    function updateStampUI() {
        const hasStamp = state.stampImage && state.config.stamp.enabled;
        $('stamp-preview-img').style.display = hasStamp ? 'block' : 'none';
        $('stamp-preview-placeholder').style.display = hasStamp ? 'none' : 'block';
        $('btn-remove-stamp').style.display = hasStamp ? 'flex' : 'none';

        if (state.stampImage) {
            $('stamp-preview-img').src = state.stampImage.src;
            $('stamp-preview-large-img').src = state.stampImage.src;
            $('stamp-preview-large-img').style.display = 'block';
            $('stamp-preview-large-placeholder').style.display = 'none';
        } else {
            $('stamp-preview-large-img').style.display = 'none';
            $('stamp-preview-large-placeholder').style.display = 'block';
        }
    }

    async function loadStampFromFile(file) {
        if (!file || !file.type.startsWith('image/')) return;
        state.stampImage = await StampConfig.loadStampImage(file);
        state.config.stamp.enabled = true;
        $('cfg-stamp-enabled').checked = true;
        updateStampUI();
        setStatus(`Sello cargado: ${file.name}`);
        onConfigChanged();
    }

    async function handleStampLoad(e) {
        const file = e.target.files[0];
        if (!file) return;
        try { await loadStampFromFile(file); }
        catch { setStatus('Error cargando sello'); }
        e.target.value = '';
    }

    async function handleStampDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        $('stamp-dropzone')?.classList.remove('dragover');
        try { await loadStampFromFile(e.dataTransfer.files[0]); }
        catch { setStatus('Error cargando sello'); }
    }

    function removeStamp() {
        state.stampImage = null;
        state.config.stamp.enabled = false;
        $('cfg-stamp-enabled').checked = false;
        updateStampUI();
        renderMainGallery();
        onConfigChanged();
    }

    function togglePreview() {
        if (state.fullscreenIndex < 0) return;
        state.previewMode = !state.previewMode;
        const btn = $('btn-preview-config');
        btn.classList.toggle('fs-preview-on', state.previewMode);
        btn.innerHTML = state.previewMode
            ? '<i class="fas fa-eye"></i> Vista previa activa'
            : '<i class="fas fa-eye-slash"></i> Vista previa off';
        refreshFullscreenPreview();
    }

    function getExportQuality() {
        return (parseInt(localStorage.getItem(QUALITY_KEY)) || 95) / 100;
    }

    async function applyConfigToAll() {
        if (!state.photos.length) {
            alert('Importe fotografías primero');
            return;
        }
        await applyConfigToIndices(getTargetIndices());
    }

    function isImageFile(file) {
        if (file.size > 100 * 1024 * 1024) return false;
        return file.type.startsWith('image/') || /\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?|raw)$/i.test(file.name);
    }

    async function handleFileImport(e) {
        const files = Array.from(e.target.files).filter(isImageFile);
        if (!files.length) return;
        await loadPhotos(files);
        e.target.value = '';
    }

    async function handleDrop(e) {
        e.preventDefault();
        $('drop-zone')?.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files).filter(isImageFile);
        if (!files.length) return;
        await loadPhotos(files);
    }

    function getPhotoMeta(photo) {
        const lines = state.config?.lines || [];
        const city = lines[2] || 'Sin ubicación';
        const date = new Date().toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
        const coords = lines[1] || '';
        return { city, date, coords };
    }

    function saveRecentImports() {
        const recent = state.photos.slice(-12).map(p => ({
            id: p.id,
            name: p.name,
            thumbnail: p.thumbnail,
            modified: p.modified,
            meta: getPhotoMeta(p)
        })).reverse();
        localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
    }

    function loadRecentFromStorage() {
        try {
            return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
        } catch { return []; }
    }

    function clearRecentImports() {
        if (confirm('¿Limpiar importaciones recientes?')) {
            localStorage.removeItem(RECENT_KEY);
            renderRecentImports();
        }
    }

    function renderRecentImports() {
        const grid = $('recent-imports-grid');
        const items = state.photos.length
            ? state.photos.slice().reverse().slice(0, 8)
            : loadRecentFromStorage();

        if (!items.length) {
            grid.innerHTML = '<p class="empty-hint">Aún no hay importaciones. Sube tus primeras fotografías.</p>';
            return;
        }

        grid.innerHTML = items.map((item, idx) => {
            const meta = item.meta || getPhotoMeta(item);
            const thumb = item.thumbnail;
            const badge = item.modified
                ? '<span class="recent-badge processed"><i class="fas fa-check"></i> Procesado</span>'
                : '<span class="recent-badge"><i class="fas fa-check"></i> Importado</span>';
            return `
                <div class="recent-card" data-recent-idx="${idx}">
                    <div class="recent-card-img"><img src="${thumb}" alt=""></div>
                    <div class="recent-card-body">
                        <strong>${escapeHtml(meta.city)}</strong>
                        <span>${escapeHtml(meta.date)}</span>
                        <span>${escapeHtml(meta.coords)}</span>
                        ${badge}
                    </div>
                </div>
            `;
        }).join('');

        grid.querySelectorAll('.recent-card').forEach(card => {
            card.addEventListener('click', () => {
                const idx = parseInt(card.dataset.recentIdx);
                const photoIdx = state.photos.length - 1 - idx;
                if (photoIdx >= 0) {
                    state.currentIndex = photoIdx;
                    navigateTo('editor');
                } else {
                    navigateTo('editor');
                }
            });
        });

        if (state.photos.length) saveRecentImports();
    }

    async function loadPhotos(files) {
        setStatus(`Cargando ${files.length} fotografía(s)...`);
        for (const file of files) {
            try {
                const photo = await ExportManager.loadImageToCanvas(file);
                photo.id = crypto.randomUUID();
                photo.baseCanvas = cloneCanvas(photo.canvas);
                photo.textLayers = [];
                photo.stampLayer = null;
                photo.modified = false;
                photo.selected = false;
                photo.thumbnail = createThumbnail(photo.canvas);
                state.photos.push(photo);
            } catch (err) {
                console.error('Error:', file.name, err);
            }
        }
        renderMainGallery();
        renderRecentImports();
        updateNotifBadge();
        updateSelectionUI();
        setStatus(`${state.photos.length} fotografía(s) cargada(s)`);
    }

    function renderMainGallery() {
        const grid = $('photos-main-grid');
        const empty = $('empty-editor');

        $('gallery-count').textContent = `${state.photos.length} fotografía(s)`;
        $('status-photo-count').textContent = `${state.photos.length} fotos`;

        if (!state.photos.length) {
            empty.style.display = 'block';
            grid.querySelectorAll('.photo-card').forEach(c => c.remove());
            return;
        }

        empty.style.display = 'none';
        grid.querySelectorAll('.photo-card').forEach(c => c.remove());

        state.photos.forEach((photo, i) => {
            const thumbSrc = photo.thumbnail;

            const card = document.createElement('div');
            card.className = 'photo-card'
                + (i === state.currentIndex ? ' active' : '')
                + (photo.modified ? ' processed' : '')
                + (photo.selected ? ' selected' : '');
            card.dataset.index = i;
            card.innerHTML = `
                <div class="photo-card-img" title="Doble clic para editar en pantalla completa">
                    <input type="checkbox" class="photo-card-check" ${photo.selected ? 'checked' : ''} title="Seleccionar foto">
                    <img src="${thumbSrc}" alt="${escapeAttr(photo.name)}" draggable="false">
                    <div class="photo-card-badge"><i class="fas fa-check"></i></div>
                </div>
                <div class="photo-card-info" title="${escapeAttr(photo.name)}">${escapeHtml(photo.name)}</div>
                <div class="photo-card-actions">
                    <button type="button" class="btn btn-edit-one"><i class="fas fa-pen"></i> Editar</button>
                    <button type="button" class="btn btn-ghost btn-export-one"><i class="fas fa-download"></i> Exportar</button>
                </div>
            `;

            const checkbox = card.querySelector('.photo-card-check');
            checkbox.addEventListener('click', ev => ev.stopPropagation());
            checkbox.addEventListener('change', ev => {
                togglePhotoSelection(i, ev.target.checked);
                card.classList.toggle('selected', ev.target.checked);
            });

            card.querySelector('.btn-edit-one').addEventListener('click', ev => {
                ev.stopPropagation();
                openFullscreenEditor(i);
            });
            card.querySelector('.btn-export-one').addEventListener('click', ev => { ev.stopPropagation(); exportPhoto(i); });

            const imgEl = card.querySelector('.photo-card-img img');
            const imgWrap = card.querySelector('.photo-card-img');

            imgEl.addEventListener('dblclick', ev => {
                ev.preventDefault();
                ev.stopPropagation();
                clearTimeout(cardClickTimer);
                openFullscreenEditor(i);
            });

            imgWrap.addEventListener('dblclick', ev => {
                if (ev.target === imgEl) return;
                ev.preventDefault();
                ev.stopPropagation();
                clearTimeout(cardClickTimer);
                openFullscreenEditor(i);
            });

            card.addEventListener('click', ev => {
                if (ev.target.closest('.photo-card-check, button, .btn')) return;
                clearTimeout(cardClickTimer);
                cardClickTimer = setTimeout(() => {
                    state.currentIndex = i;
                    updateActiveCard(i);
                }, 220);
            });

            grid.appendChild(card);
        });

        updateSelectionUI();
    }

    function cloneCanvas(src) {
        const c = document.createElement('canvas');
        c.width = src.width;
        c.height = src.height;
        c.getContext('2d').drawImage(src, 0, 0);
        return c;
    }

    function createThumbnail(canvas, size = 200) {
        const thumb = document.createElement('canvas');
        const scale = size / Math.max(canvas.width, canvas.height);
        thumb.width = Math.round(canvas.width * scale);
        thumb.height = Math.round(canvas.height * scale);
        thumb.getContext('2d').drawImage(canvas, 0, 0, thumb.width, thumb.height);
        return thumb.toDataURL('image/jpeg', 0.8);
    }

    async function exportPhoto(index) {
        const photo = state.photos[index];
        if (!photo) return;
        photo.canvas = TextLayerManager.composite(photo);
        await ExportManager.exportSingle(photo, { quality: getExportQuality() });
        setStatus(`Exportado: ${photo.name}`);
    }

    async function exportAllZip() {
        if (!state.photos.length) {
            alert('Importe fotografías primero');
            return;
        }
        const indices = getTargetIndices();
        const toExport = indices.map(i => state.photos[i]).filter(Boolean);
        for (const p of toExport) p.canvas = TextLayerManager.composite(p);
        showLoading(true, 'Generando ZIP...');
        try {
            await ExportManager.exportBulk(toExport, { quality: getExportQuality() });
            setStatus(`ZIP exportado — ${toExport.length} foto(s)`);
        } finally {
            showLoading(false);
        }
    }

    function renderTemplates() {
        const grid = $('templates-grid');
        const templates = TemplateManager.getAllWithDefaults();

        grid.innerHTML = templates.map(t => `
            <div class="template-card" data-id="${t.id}">
                <h4>${escapeHtml(t.name)}</h4>
                <p>${t.config.lineCount} líneas · ${t.config.textPosition.replace('-', ' ')}</p>
                <div class="template-card-actions">
                    <button type="button" class="btn btn-primary btn-apply-template"><i class="fas fa-check"></i> Aplicar</button>
                    ${t.isBuiltin ? '' : '<button type="button" class="btn btn-ghost btn-delete-template"><i class="fas fa-trash"></i></button>'}
                </div>
            </div>
        `).join('');

        grid.querySelectorAll('.template-card').forEach(card => {
            const id = card.dataset.id;
            const template = templates.find(t => t.id === id);
            card.querySelector('.btn-apply-template')?.addEventListener('click', () => applyTemplate(template));
            card.querySelector('.btn-delete-template')?.addEventListener('click', () => {
                if (confirm(`¿Eliminar plantilla "${template.name}"?`)) {
                    TemplateManager.deleteTemplate(template.id);
                    renderTemplates();
                }
            });
        });
    }

    function applyTemplate(template) {
        applyConfigToUI(template.config);
        setStatus(`Plantilla "${template.name}" aplicada`);
        navigateTo('importar');
    }

    function saveCurrentTemplate() {
        readConfigFromUI();
        const name = prompt('Nombre de la plantilla:');
        if (!name) return;
        TemplateManager.saveTemplate(name, state.config);
        renderTemplates();
        setStatus(`Plantilla "${name}" guardada`);
    }

    function renderHistory() { /* panel removed — use renderHistoryMain */ }

    function renderHistoryMain() {
        const list = $('history-list-main');
        if (!list) return;
        const entries = HistoryManager.getAll().slice(0, 50);
        list.innerHTML = entries.length
            ? entries.map(e => `<li class="history-item"><div><span class="hist-from">${escapeHtml(e.originalText)}</span> → <span class="hist-to">${escapeHtml(e.newText)}</span></div><div class="hist-meta">${escapeHtml(e.photoName)} · ${HistoryManager.formatDate(e.timestamp)}</div></li>`).join('')
            : '<li class="history-item" style="color:var(--text-dim);">Sin modificaciones aún</li>';
    }

    function clearHistory() {
        if (confirm('¿Eliminar historial?')) {
            HistoryManager.clear();
            renderHistoryMain();
            updateNotifBadge();
        }
    }

    function showLoading(visible, msg) {
        $('loading-overlay').classList.toggle('visible', visible);
        if (msg) $('loading-status').textContent = msg;
    }

    function setStatus(msg) { $('status-text').textContent = msg; }

    function escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    document.addEventListener('DOMContentLoaded', init);
    return { init, state };
})();
