/**
 * Configuración de sellos y líneas de texto — aplicación masiva
 */
const StampConfig = (() => {

    const POSITIONS = {
        'bottom-right': { anchorX: 'right', anchorY: 'bottom' },
        'bottom-left': { anchorX: 'left', anchorY: 'bottom' },
        'top-right': { anchorX: 'right', anchorY: 'top' },
        'top-left': { anchorX: 'left', anchorY: 'top' },
        'bottom-center': { anchorX: 'center', anchorY: 'bottom' }
    };

    function defaultConfig() {
        return {
            lineCount: 6,
            lines: [
                '9 jun 2026 4:22:08 p. m.',
                '8.426262S 74.56984026W ±3.79m',
                'Pucallpa',
                'Coronel Portillo',
                'Ucayali',
                'set Manantay'
            ],
            textPosition: 'bottom-right',
            textMarginX: 2.5,
            textMarginY: 2.5,
            lineSpacing: 1.35,
            fontSizeRatio: 0.022,
            fontColor: '#ffffff',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'normal',
            textShadow: true,
            textAlign: 'right',
            stamp: {
                enabled: false,
                image: null,
                name: '',
                position: 'top-right',
                widthPercent: 20,
                marginX: 2,
                marginY: 2
            }
        };
    }

    function calcTextLayers(canvasW, canvasH, config) {
        const pos = POSITIONS[config.textPosition] || POSITIONS['bottom-right'];
        const marginX = (config.textMarginX / 100) * canvasW;
        const marginY = (config.textMarginY / 100) * canvasH;
        const fontSize = Math.max(10, Math.round(canvasH * config.fontSizeRatio));
        const lineHeight = fontSize * config.lineSpacing;
        const lines = (config.lines || []).slice(0, config.lineCount).filter(l => l && l.trim());

        const layers = [];
        const totalHeight = lines.length * lineHeight;

        let startX, startY, align;

        if (pos.anchorX === 'right') {
            startX = canvasW - marginX;
            align = 'right';
        } else if (pos.anchorX === 'left') {
            startX = marginX;
            align = 'left';
        } else {
            startX = canvasW / 2;
            align = 'center';
        }

        if (pos.anchorY === 'bottom') {
            startY = canvasH - marginY - totalHeight + fontSize;
        } else {
            startY = marginY + fontSize;
        }

        lines.forEach((text, i) => {
            const y = startY + i * lineHeight;
            const estWidth = text.length * fontSize * 0.55;
            let x0, x1;

            if (align === 'right') {
                x1 = startX;
                x0 = startX - estWidth;
            } else if (align === 'left') {
                x0 = startX;
                x1 = startX + estWidth;
            } else {
                x0 = startX - estWidth / 2;
                x1 = startX + estWidth / 2;
            }

            layers.push({
                id: crypto.randomUUID(),
                text: text.trim(),
                originalText: '',
                bbox: { x0, y0: y - fontSize, x1, y1: y + fontSize * 0.3 },
                originalBbox: { x0, y0: y - fontSize, x1, y1: y + fontSize * 0.3 },
                fontSize,
                fontFamily: config.fontFamily || 'Arial, sans-serif',
                fontColor: config.fontColor,
                fontWeight: config.fontWeight || 'normal',
                align,
                rotation: 0,
                manual: true,
                modified: true,
                shadow: config.textShadow !== false,
                type: 'texto'
            });
        });

        return layers;
    }

    function calcStampRect(canvasW, canvasH, stampConfig, stampImg) {
        if (!stampConfig.enabled || !stampImg) return null;

        const pos = POSITIONS[stampConfig.position] || POSITIONS['top-right'];
        const marginX = (stampConfig.marginX / 100) * canvasW;
        const marginY = (stampConfig.marginY / 100) * canvasH;
        const targetW = (stampConfig.widthPercent / 100) * canvasW;
        const aspect = stampImg.height / stampImg.width;
        const targetH = targetW * aspect;

        let x, y;

        if (pos.anchorX === 'right') x = canvasW - marginX - targetW;
        else if (pos.anchorX === 'left') x = marginX;
        else x = (canvasW - targetW) / 2;

        if (pos.anchorY === 'bottom') y = canvasH - marginY - targetH;
        else y = marginY;

        return { x, y, w: targetW, h: targetH };
    }

    function compositePhoto(photo, config, stampImg) {
        const canvas = document.createElement('canvas');
        canvas.width = photo.baseCanvas.width;
        canvas.height = photo.baseCanvas.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(photo.baseCanvas, 0, 0);

        if (config.stamp.enabled && stampImg) {
            const rect = calcStampRect(canvas.width, canvas.height, config.stamp, stampImg);
            if (rect) {
                ctx.drawImage(stampImg, rect.x, rect.y, rect.w, rect.h);
            }
        }

        const layers = calcTextLayers(canvas.width, canvas.height, config);
        for (const layer of layers) {
            TextLayerManager.drawTextLayer(ctx, layer);
        }

        return { canvas, textLayers: layers };
    }

    async function loadStampImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    return {
        defaultConfig,
        calcTextLayers,
        calcStampRect,
        compositePhoto,
        loadStampImage,
        POSITIONS
    };
})();
