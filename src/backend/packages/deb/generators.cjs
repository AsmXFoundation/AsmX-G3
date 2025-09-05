"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDesktopEntry = createDesktopEntry;
function createDesktopEntry(config, executableName, packageName) {
    return [
        '[Desktop Entry]',
        `Name=${config.name}`,
        `Comment=${config.comment || ''}`,
        `Exec=/usr/bin/${executableName}`,
        `Icon=${packageName}`,
        `Terminal=${config.terminal ? 'true' : 'false'}`,
        `Type=Application`,
        `Categories=${config.categories.join(';')};`,
        `StartupNotify=${config.startupNotify ? 'true' : 'false'}`,
        ''
    ].join('\n');
}
