/**
 * Gestor de plantillas de configuración de texto y sello
 */
const TemplateManager = (() => {
    const STORAGE_KEY = 'photo_editor_templates';

    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    function save(templates) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(templates.slice(0, 50)));
    }

    function getAll() {
        return load();
    }

    function saveTemplate(name, config) {
        const templates = load();
        const entry = {
            id: crypto.randomUUID(),
            name: name.trim() || 'Plantilla sin nombre',
            config: JSON.parse(JSON.stringify(config)),
            createdAt: new Date().toISOString()
        };
        templates.unshift(entry);
        save(templates);
        return entry;
    }

    function deleteTemplate(id) {
        const templates = load().filter(t => t.id !== id);
        save(templates);
    }

    function getById(id) {
        return load().find(t => t.id === id) || null;
    }

    function getDefaults() {
        return [
            {
                id: 'default-obra',
                name: 'Obra — Pucallpa',
                config: StampConfig.defaultConfig(),
                isBuiltin: true
            },
            {
                id: 'default-minimal',
                name: 'Mínimo (fecha + coords)',
                config: {
                    ...StampConfig.defaultConfig(),
                    lineCount: 2,
                    lines: [
                        new Date().toLocaleString('es-PE'),
                        'Coordenadas GPS'
                    ]
                },
                isBuiltin: true
            }
        ];
    }

    function getAllWithDefaults() {
        const custom = getAll();
        const builtins = getDefaults();
        const customNames = new Set(custom.map(t => t.name));
        return [
            ...custom,
            ...builtins.filter(b => !customNames.has(b.name))
        ];
    }

    return {
        getAll,
        getAllWithDefaults,
        saveTemplate,
        deleteTemplate,
        getById
    };
})();
