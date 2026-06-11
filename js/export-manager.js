/**
 * Gestor de exportación — mantiene resolución y calidad original, exportación masiva ZIP
 */
const ExportManager = (() => {

    function canvasToBlob(canvas, mimeType = 'image/jpeg', quality = 0.95) {
        return new Promise(resolve => {
            canvas.toBlob(blob => resolve(blob), mimeType, quality);
        });
    }

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async function exportSingle(photo, options = {}) {
        const mimeType = options.format === 'png' ? 'image/png' : 'image/jpeg';
        const quality = options.quality || 0.95;
        const ext = options.format === 'png' ? 'png' : 'jpg';

        const blob = await canvasToBlob(photo.canvas, mimeType, quality);
        const name = photo.exportName || photo.name.replace(/\.[^.]+$/, '') + '_editado.' + ext;
        downloadBlob(blob, name);
        return blob;
    }

    async function exportBulk(photos, options = {}, onProgress) {
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip no está cargado');
        }

        const zip = new JSZip();
        const folder = zip.folder(options.folderName || 'fotografias_editadas');
        const mimeType = options.format === 'png' ? 'image/png' : 'image/jpeg';
        const quality = options.quality || 0.95;
        const ext = options.format === 'png' ? 'png' : 'jpg';

        let processed = 0;
        const total = photos.length;

        for (const photo of photos) {
            if (!photo.canvas) continue;

            const blob = await canvasToBlob(photo.canvas, mimeType, quality);
            const arrayBuffer = await blob.arrayBuffer();
            const name = photo.exportName || photo.name.replace(/\.[^.]+$/, '') + '_editado.' + ext;

            folder.file(name, arrayBuffer);
            processed++;

            if (onProgress) {
                onProgress(Math.round((processed / total) * 100), processed, total);
            }
        }

        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        }, metadata => {
            if (onProgress) {
                onProgress(Math.round(metadata.percent), processed, total);
            }
        });

        const zipName = options.zipName || `fotografias_editadas_${formatDateForFilename()}.zip`;
        downloadBlob(zipBlob, zipName);

        return zipBlob;
    }

    function formatDateForFilename() {
        const d = new Date();
        return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    }

    function getOriginalDimensions(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    }

    function createCanvasFromImage(img, maxDimension) {
        const canvas = document.createElement('canvas');
        let w = img.naturalWidth;
        let h = img.naturalHeight;

        if (maxDimension && (w > maxDimension || h > maxDimension)) {
            const scale = maxDimension / Math.max(w, h);
            w = Math.round(w * scale);
            h = Math.round(h * scale);
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        return canvas;
    }

    function loadImageToCanvas(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    resolve({
                        canvas,
                        ctx,
                        width: img.naturalWidth,
                        height: img.naturalHeight,
                        name: file.name,
                        originalFile: file
                    });
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    return {
        exportSingle,
        exportBulk,
        canvasToBlob,
        downloadBlob,
        getOriginalDimensions,
        createCanvasFromImage,
        loadImageToCanvas
    };
})();
