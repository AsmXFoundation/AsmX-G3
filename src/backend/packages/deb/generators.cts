import { DesktopEntry } from "../universal/types.cjs";

export function createDesktopEntry(config: DesktopEntry, executableName: string, packageName: string): string {
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