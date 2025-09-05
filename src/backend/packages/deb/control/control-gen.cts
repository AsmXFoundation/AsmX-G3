import { DebConfig } from "../../universal/types.cjs";

interface ControlData {
  Package: string;
  Version: string;
  Architecture: string;
  Maintainer: string;
  Description: string;
  Section?: string;
  Priority?: string;
  'Installed-Size'?: string;
  Depends?: string;
  Suggests?: string;
  Conflicts?: string;
  Replaces?: string;
}

export function generateControlFile(config: DebConfig, installedSize: number, arch: string): string {
  const controlData: ControlData = {
    Package: config.name,
    Version: config.version,
    Architecture: arch,
    Maintainer: config.deb.maintainer || config.author,
    Description: config.description,
    Section: config.deb.section || 'devel',
    Priority: config.deb.priority || 'optional',
    'Installed-Size': Math.ceil(installedSize / 1024).toString(),
  };

  if (config.deb.depends && config.deb.depends.length > 0) {
    controlData.Depends = config.deb.depends.join(', ');
  }

  if (config.deb.suggests && config.deb.suggests.length > 0) {
    controlData.Suggests = config.deb.suggests.join(', ');
  }

  if (config.deb.conflicts && config.deb.conflicts.length > 0) {
    controlData.Conflicts = config.deb.conflicts.join(', ');
  }

  if (config.deb.replaces && config.deb.replaces.length > 0) {
    controlData.Replaces = config.deb.replaces.join(', ');
  }

  return Object.entries(controlData)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n') + '\n';
}