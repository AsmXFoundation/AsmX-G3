// const fs = require('fs');
// const path = require('path');
// const os = require('os');

// // Get the npm directory path 
// let npmDir;

// if (os.platform() === 'win32') {
//   npmDir = path.join(process.env.APPDATA, 'npm');
// } else {
//   const homeDir = os.homedir();
//   npmDir = path.join(homeDir, '.npm-global/bin');
// }

// // Define the source file paths
// const source1Path = path.join(__dirname, 'asmx');
// const source2Path = path.join(__dirname, 'asmx.cmd');

// // Define the destination file paths
// const dest1Path = path.join(npmDir, 'asmx');
// const dest2Path = path.join(npmDir, 'asmx.cmd');

// // Read the source files
// const source1Content = fs.readFileSync(source1Path);
// const source2Content = fs.readFileSync(source2Path);

// // Write the source files to the npm directory
// fs.writeFileSync(dest1Path, source1Content);
// fs.writeFileSync(dest2Path, source2Content);

// console.log('Successfully installed the AsmX G2!');

// const fs = require('fs');
// const path = require('path');
// const os = require('os');
// const childProcess = require('child_process');

// // Install the binaries using npm
// childProcess.execSync(`npm install -g ${path.join(__dirname, '..', 'bin', 'asmx')}`, { stdio: 'inherit' });
// // childProcess.execSync(`npm install -g ${__dirname}/asmx`, { stdio: 'inherit' });

// console.log(__dirname);
// console.log(path.join(__dirname, '..', 'bin', 'asmx'));

// console.log('Successfully installed the AsmX G3!');

const fs = require('fs');
const path = require('path');
const os = require('os');

// Determine the global location for the asmx binary based on the OS
let globalLocation;
switch (os.platform()) {
  case 'win32':
    globalLocation = path.join(process.env.APPDATA, 'npm', 'node_modules');
    break;
  case 'darwin': // macOS
    globalLocation = '/usr/local/bin';
    break;
  case 'linux':
    globalLocation = '/usr/bin';
    break;
  default:
    throw new Error(`Unsupported OS: ${os.platform()}`);
}

// Copy the asmx binary to the global location
const src = path.join(__dirname, '..', 'bin', 'asmx');
const dest = path.join(globalLocation, 'asmx');

// fs.copyFileSync(src, dest);
console.log(path.join(__dirname, '..', 'bin', 'asmx'), '\n', path.join(globalLocation, 'asmx'));

if (fs.existsSync(path.join(__dirname, '..', 'bin', 'asmx'))) {
  fs.copyFileSync(path.join(__dirname, '..', 'bin', 'asmx'), path.join(globalLocation, 'asmx'));
} else {
  console.error('Error: asmx file does not exist');
}

if (os.platform() == 'win32') {
  console.log("win32: ", path.join(path.join(process.env.APPDATA, 'npm'), 'asmx'));
  console.log(path.join(__dirname, 'asmx'), '\n', path.join(__dirname, 'asmx.cmd'));
  
  
  // fs.copyFileSync(path.join(__dirname, 'asmx'), path.join(path.join(process.env.APPDATA, 'npm'), 'asmx'));
  // fs.copyFileSync(path.join(__dirname, 'asmx.cmd'), path.join(path.join(process.env.APPDATA, 'npm'), 'asmx'));

  // path.join(__dirname, 'asmx.cmd'), path.join(rocess.env.APPDATA, 'npm', 'asmx')
  const dest1 = path.join(process.env.APPDATA, 'npm', 'asmx.cmd');
  const source1 = fs.readFileSync(path.join(__dirname, 'asmx.cmd'));

  const dest2 = path.join(process.env.APPDATA, 'npm', 'asmx');
  const source2 = fs.readFileSync(path.join(__dirname, 'asmx'));

  console.log("dest1: ", dest1);
  console.log("src1: ", source1);
  
  fs.writeFileSync(dest1, source1);
  fs.writeFileSync(dest2, source2);
}

// Make the asmx binary executable
fs.chmodSync(dest, 0o755);
console.log('Successfully installed the AsmX G3!');