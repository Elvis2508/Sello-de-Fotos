/**
 * Gestor de capas de texto — composición desde imagen base + múltiples textos editables
 */
const TextLayerManager = (() => {

    function createLayer(props) {
        return {
            id: props.id || crypto.randomUUID(),
            text: props.text || '',
            originalText: props.originalText || props.text || '',
            bbox: { ...props.bbox },
            originalBbox: props.originalBbox ? { ...props.originalBbox } : { ...props.bbox },
            fontSize: props.fontSize || 16,
            fontFamily: props.fontFamily || 'Arial, sans-serif',
            fontColor: props.fontColor || '#ffffff',
            rotation: props.rotation || 0,
            align: props.align || 'right',
            fontWeight: props.fontWeight || 'normal',
            type: props.type || 'texto',
            confidence: props.confidence || 100,
            modified: props.modified || false,
            manual: props.manual || false,
            shadow: props.shadow !== false
        };
    }

    function layerFromDetection(det) {
        return createLayer({
            id: det.id,
            text: det.text,
            originalText: det.text,
            bbox: { ...det.bbox },
            originalBbox: { ...det.bbox },
            fontSize: det.fontSize,
            fontFamily: det.fontFamily || 'Arial, sans-serif',
            fontColor: det.fontColor || '#ffffff',
            rotation: det.rotation || 0,
            align: det.align || guessAlign(det.bbox),
            type: det.type,
            confidence: det.confidence,
            modified: false,
            manual: false
        });
    }

    function guessAlign(bbox, canvasWidth) {
        if (!canvasWidth) return 'right';
        const centerX = (bbox.x0 + bbox.x1) / 2;
        if (centerX > canvasWidth * 0.65) return 'right';
        if (centerX < canvasWidth * 0.35) return 'left';
        return 'center';
    }

    function measureText(ctx, text, style) {
        ctx.save();
        ctx.font = `${style.fontWeight || 'normal'} ${style.fontSize}px ${style.fontFamily}`;
        const metrics = ctx.measureText(text);
        ctx.restore();
        return { width: metrics.width, height: style.fontSize * 1.2 };
    }

    function drawTextLayer(ctx, layer) {
        const { bbox } = layer;
        const fontSize = layer.fontSize;
        const fontFamily = layer.fontFamily;
        const color = layer.fontColor;
        const rotation = layer.rotation || 0;
        const align = layer.align || 'left';
        const fontWeight = layer.fontWeight || 'normal';

        ctx.save();

        let drawX, drawY;
        const h = bbox.y1 - bbox.y0;

        if (align === 'right') {
            drawX = bbox.x1;
            drawY = bbox.y0 + h * 0.75;
            ctx.textAlign = 'right';
        } else if (align === 'center') {
            drawX = (bbox.x0 + bbox.x1) / 2;
            drawY = bbox.y0 + h * 0.75;
            ctx.textAlign = 'center';
        } else {
            drawX = bbox.x0;
            drawY = bbox.y0 + h * 0.75;
            ctx.textAlign = 'left';
        }

        ctx.translate(drawX, drawY);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        ctx.textBaseline = 'alphabetic';

        if (layer.shadow) {
            const isLight = isLightColor(color);
            ctx.shadowColor = isLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.3)';
            ctx.shadowBlur = 2;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
        }

        ctx.fillStyle = color;
        ctx.fillText(layer.text, 0, 0);
        ctx.restore();
    }

    function isLightColor(hex) {
        const c = hex.replace('#', '');
        const r = parseInt(c.substring(0, 2), 16);
        const g = parseInt(c.substring(2, 4), 16);
        const b = parseInt(c.substring(4, 6), 16);
        return (r + g + b) / 3 > 160;
    }

    function updateBboxForText(ctx, layer) {
        const size = measureText(ctx, layer.text, layer);
        const padding = 4;
        const h = layer.fontSize * 1.3;
        const w = size.width + padding * 2;

        const align = layer.align || 'left';
        const orig = layer.originalBbox;

        if (align === 'right') {
            layer.bbox = {
                x0: orig.x1 - w,
                y0: orig.y0,
                x1: orig.x1,
                y1: orig.y0 + h
            };
        } else if (align === 'center') {
            const cx = (orig.x0 + orig.x1) / 2;
            layer.bbox = {
                x0: cx - w / 2,
                y0: orig.y0,
                x1: cx + w / 2,
                y1: orig.y0 + h
            };
        } else {
            layer.bbox = {
                x0: orig.x0,
                y0: orig.y0,
                x1: orig.x0 + w,
                y1: orig.y0 + h
            };
        }
    }

    function composite(photo) {
        const canvas = document.createElement('canvas');
        canvas.width = photo.baseCanvas.width;
        canvas.height = photo.baseCanvas.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(photo.baseCanvas, 0, 0);

        if (photo.stampLayer?.image) {
            const s = photo.stampLayer;
            ctx.drawImage(s.image, s.x, s.y, s.w, s.h);
        }

        const layers = photo.textLayers || [];
        for (const layer of layers) {
            if (!layer.modified) continue;
            drawTextLayer(ctx, layer);
        }

        return canvas;
    }

    function applyLayerEdit(photo, layer) {
        layer.modified = true;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = photo.baseCanvas.width;
        tempCanvas.height = photo.baseCanvas.height;
        const ctx = tempCanvas.getContext('2d');
        updateBboxForText(ctx, layer);

        const result = composite(photo);
        photo.canvas = result;
        photo.ctx = result.getContext('2d');
        return photo;
    }

    function addManualLayer(photo, x, y, text) {
        const fontSize = Math.round(photo.baseCanvas.height * 0.022);
        const layer = createLayer({
            text: text || 'Nuevo texto',
            originalText: '',
            bbox: { x0: x, y0: y, x1: x + 200, y1: y + fontSize * 1.3 },
            originalBbox: { x0: x, y0: y, x1: x + 200, y1: y + fontSize * 1.3 },
            fontSize,
            fontColor: '#ffffff',
            align: 'left',
            manual: true,
            modified: true,
            type: 'texto'
        });

        if (!photo.textLayers) photo.textLayers = [];
        photo.textLayers.push(layer);
        applyLayerEdit(photo, layer);
        return layer;
    }

    return {
        createLayer,
        layerFromDetection,
        drawTextLayer,
        measureText,
        updateBboxForText,
        composite,
        applyLayerEdit,
        addManualLayer,
        guessAlign,
        isLightColor
    };
})();
