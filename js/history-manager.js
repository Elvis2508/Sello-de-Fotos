/**
 * Gestor de historial de modificaciones de texto
 */
const HistoryManager = (() => {
    const STORAGE_KEY = 'photo_text_editor_history';
    let entries = [];

    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            entries = raw ? JSON.parse(raw) : [];
        } catch {
            entries = [];
        }
    }

    function save() {
        try {
            const trimmed = entries.slice(-500);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
            entries = trimmed;
        } catch (e) {
            console.warn('No se pudo guardar historial:', e);
        }
    }

    function addEntry({ photoName, originalText, newText, type, user }) {
        const entry = {
            id: crypto.randomUUID(),
            photoName: photoName || 'Sin nombre',
            originalText,
            newText,
            type: type || 'texto',
            user: user || getCurrentUser(),
            timestamp: new Date().toISOString()
        };

        entries.unshift(entry);
        save();
        return entry;
    }

    function getCurrentUser() {
        return localStorage.getItem('photo_editor_user') || 'Usuario';
    }

    function setCurrentUser(name) {
        localStorage.setItem('photo_editor_user', name);
    }

    function getAll() {
        return [...entries];
    }

    function getByPhoto(photoName) {
        return entries.filter(e => e.photoName === photoName);
    }

    function clear() {
        entries = [];
        save();
    }

    function formatDate(iso) {
        const d = new Date(iso);
        return d.toLocaleDateString('es-PE', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }

    load();

    return {
        addEntry,
        getAll,
        getByPhoto,
        clear,
        getCurrentUser,
        setCurrentUser,
        formatDate
    };
})();
