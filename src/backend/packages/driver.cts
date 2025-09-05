import * as path from 'path';
import { DebBuilder } from './deb/builder.cjs';
import { DebConfig, DesktopEntry } from './universal/types.cjs';
import { MetadataUtils } from './universal/metadata.cjs';
const Server = require('../../server/server');

export interface PackageParams {
  package: boolean;
  objname: string;
  executablePath: string;
  package_type: 'deb';
  package_name?: string;
  package_version?: string;
  package_description?: string;
  package_author?: string;
  package_icon?: string;
  package_desktop?: boolean;
}

class PackageDriver {
  public async run(params: PackageParams): Promise<void> {
    process.stdout.write("AsmX Package Driver invoked.\n");
    params.executablePath = params.objname;

    // --- System & Executable Validation ---
    process.stdout.write("-> Checking system compatibility... ");
    if (!MetadataUtils.isPackagingSupported()) {
      process.stdout.write("Failed\n");
      Server.journal.rawError("Package creation is only supported on the Linux platform.");
    }
    process.stdout.write("OK\n");

    process.stdout.write(`-> Validating executable '${params.executablePath}'... `);
    if (!(await MetadataUtils.isElfExecutable(params.executablePath))) {
      process.stdout.write("Failed\n");
      throw new Error(`The file '${params.executablePath}' is not a valid ELF executable.`);
    }
    process.stdout.write("OK\n");

    switch (params.package_type) {
      case 'deb':
        await this.buildDeb(params);
        break;
      default:
        Server.journal.rawError(`Unknown package type: '${params.package_type}'.`);
        break;
    }
  }

  private async buildDeb(params: PackageParams): Promise<void> {
    const packageName = params.package_name || path.basename(params.executablePath).split('.')[0];
    process.stdout.write(`\nInitiating DEB package build for '${packageName}'...\n`);
  
    try {
      // Step 1: Analyze Dependencies
      process.stdout.write("[1/4] Analyzing executable dependencies... ");
      const elfDeps = await MetadataUtils.getElfDependencies(params.executablePath);
      const defaultDeps = MetadataUtils.getDefaultDependencies();
      const allDependencies = [...new Set([...elfDeps, ...defaultDeps])];
      process.stdout.write("Done\n");
      if (allDependencies.length > 0) {
        process.stdout.write(`      Detected dependencies: ${allDependencies.join(', ')}\n`);
      } else {
        process.stdout.write(`      No dynamic dependencies found.\n`);
      }

      // Step 2: Configure Build
      process.stdout.write("[2/4] Configuring package metadata... ");
      const config: DebConfig = {
        name: packageName,
        version: params.package_version || '1.0.0',
        description: params.package_description || 'An application created with the AsmX compiler.',
        author: params.package_author || 'AsmX Developer <dev@example.com>',
        executable: params.executablePath,
        icon: params.package_icon,
        type: 'deb',
        deb: {
          depends: allDependencies,
          postinst: `#!/bin/sh\necho "Package '${packageName}' successfully installed."\nset -e`,
          postrm: `#!/bin/sh\necho "Package '${packageName}' removed."\nset -e`,
        }
      };
      
      if (params.package_desktop) {
        config.desktopEntry = {
          name: config.name,
          comment: config.description,
          categories: ['Development', 'Utility'],
          terminal: false
        } as DesktopEntry;
      }
      process.stdout.write("Done\n");

      // Step 3: Run the Builder
      process.stdout.write("[3/4] Assembling package contents... ");
      const builder = new DebBuilder(config);
      process.stdout.write("Done\n");
      
      process.stdout.write("[4/4] Creating final .deb archive... ");
      const packagePath = await builder.create();
      process.stdout.write("Done\n\n");
      
      let template = `'${path.basename(packagePath)}' in '${path.dirname(path.resolve(packagePath))}'`;
      process.stdout.write(`asmx-dpkg: successfully created package ${template}\n`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      Server.journal.rawError(`asmx-dpkg: error: ${errorMessage.split('\n')[0]}`);
      throw error;
    }
  }
}

module.exports = PackageDriver;