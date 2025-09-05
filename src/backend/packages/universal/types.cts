export interface DesktopEntry {
  name: string;
  comment?: string;
  categories: string[];
  keywords?: string[];
  startupNotify?: boolean;
  terminal?: boolean;
}

export interface BasePackageConfig {
  name: string;
  version: string;
  description: string;
  author: string;
  executable: string;
  icon?: string;
  desktopEntry?: DesktopEntry;
}

export interface DebConfig extends BasePackageConfig {
  type: 'deb';
  deb: {
    maintainer?: string;
    section?: string;
    priority?: string;
    depends?: string[];
    suggests?: string[];
    conflicts?: string[];
    replaces?: string[];
    postinst?: string;
    postrm?: string;
  };
}

export type PackageConfig = DebConfig;