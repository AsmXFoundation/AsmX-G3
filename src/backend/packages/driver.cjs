"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const builder_cjs_1 = require("./deb/builder.cjs");
const metadata_cjs_1 = require("./universal/metadata.cjs");
const Server = require('../../server/server');
class PackageDriver {
    async run(params) {
        process.stdout.write("AsmX Package Driver invoked.\n");
        params.executablePath = params.objname;
        // --- System & Executable Validation ---
        process.stdout.write("-> Checking system compatibility... ");
        if (!metadata_cjs_1.MetadataUtils.isPackagingSupported()) {
            process.stdout.write("Failed\n");
            Server.journal.rawError("Package creation is only supported on the Linux platform.");
        }
        process.stdout.write("OK\n");
        process.stdout.write(`-> Validating executable '${params.executablePath}'... `);
        if (!(await metadata_cjs_1.MetadataUtils.isElfExecutable(params.executablePath))) {
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
    async buildDeb(params) {
        const packageName = params.package_name || path.basename(params.executablePath).split('.')[0];
        process.stdout.write(`\nInitiating DEB package build for '${packageName}'...\n`);
        try {
            // Step 1: Analyze Dependencies
            process.stdout.write("[1/4] Analyzing executable dependencies... ");
            const elfDeps = await metadata_cjs_1.MetadataUtils.getElfDependencies(params.executablePath);
            const defaultDeps = metadata_cjs_1.MetadataUtils.getDefaultDependencies();
            const allDependencies = [...new Set([...elfDeps, ...defaultDeps])];
            process.stdout.write("Done\n");
            if (allDependencies.length > 0) {
                process.stdout.write(`      Detected dependencies: ${allDependencies.join(', ')}\n`);
            }
            else {
                process.stdout.write(`      No dynamic dependencies found.\n`);
            }
            // Step 2: Configure Build
            process.stdout.write("[2/4] Configuring package metadata... ");
            const config = {
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
                };
            }
            process.stdout.write("Done\n");
            // Step 3: Run the Builder
            process.stdout.write("[3/4] Assembling package contents... ");
            const builder = new builder_cjs_1.DebBuilder(config);
            process.stdout.write("Done\n");
            process.stdout.write("[4/4] Creating final .deb archive... ");
            const packagePath = await builder.create();
            process.stdout.write("Done\n\n");
            let template = `'${path.basename(packagePath)}' in '${path.dirname(path.resolve(packagePath))}'`;
            process.stdout.write(`asmx-dpkg: successfully created package ${template}\n`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
            Server.journal.rawError(`asmx-dpkg: error: ${errorMessage.split('\n')[0]}`);
            throw error;
        }
    }
}
module.exports = PackageDriver;
