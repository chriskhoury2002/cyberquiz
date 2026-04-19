/**
 * Theme management.
 * Themes are defined in `data/index.json` under `themes`, and referenced
 * from each quiz via the `theme` field in the registry.
 * A quiz's JSON file may also ship a `color` object which overrides the named theme.
 */

const KNOWN_THEME_CLASSES = [
    'theme-default', 'theme-signature', 'theme-cyberpunk', 'theme-matrix',
    'theme-ocean', 'theme-sunset', 'theme-forest', 'theme-midnight',
];

/**
 * Apply a named theme to <body> by swapping the theme-* class.
 * Also applies optional inline palette overrides from the quiz file.
 */
export function applyTheme(themeName, paletteOverride = null) {
    const body = document.body;
    KNOWN_THEME_CLASSES.forEach((cls) => body.classList.remove(cls));

    const themeClass = themeName ? `theme-${themeName}` : 'theme-default';
    body.classList.add(themeClass);

    // Per-quiz palette overrides take precedence over theme defaults.
    const root = document.documentElement;
    if (paletteOverride && typeof paletteOverride === 'object') {
        const map = {
            primary: '--color-primary',
            secondary: '--color-secondary',
            accent: '--color-accent',
            bg: '--color-bg',
        };
        Object.entries(paletteOverride).forEach(([key, value]) => {
            if (map[key] && typeof value === 'string') {
                root.style.setProperty(map[key], value);
            }
        });
    } else {
        // Clear any prior inline overrides when switching themes cleanly
        ['--color-primary', '--color-secondary', '--color-accent', '--color-bg'].forEach((v) => {
            root.style.removeProperty(v);
        });
    }
}

/** Stamp a quiz card with its theme colors via inline CSS variables (scoped to the element). */
export function applyCardTheme(element, themeName, indexData) {
    const theme = indexData?.themes?.[themeName];
    if (!theme) return;
    const style = element.style;
    if (theme.primary) style.setProperty('--color-primary', theme.primary);
    if (theme.secondary) style.setProperty('--color-secondary', theme.secondary);
    if (theme.accent) style.setProperty('--color-accent', theme.accent);
}
