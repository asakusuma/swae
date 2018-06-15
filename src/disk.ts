import { platform } from 'os';
import { ChildProcess, exec } from 'child_process';
import mkdirp from 'mkdirp';

const HFS_MINIMUM = 1100;

interface DiskHandle {
  mountPath: string;
  filePath: string;
  eject: () => Promise<void>;
}

function generateDriveName() {
  return `swae_test_drive_${String(parseInt(String(Math.random() * 1000000)))}`;
}

function eject(path: string): Promise<void> {
  const command = platform() === 'darwin' ? `diskutil eject ${path} -force` : `sudo umount ${path}`;
  const process = exec(command);
  return new Promise((resolve: () => void, reject) => {
    let outStr = '';
    let errStr = '';
    process.on('exit', function (code, signal) {
      if (code === 0) {
        resolve();
      } else {
        console.log(outStr);
        console.error(errStr);
        reject(new Error(`Failed to eject disk: [${code}]${signal}`));
      }
    });
    process.on('error', (e) => {
      reject(e);
    });
    process.stdout.on('data', (d) => {
      outStr += d;
    });
    process.stderr.on('data', (d) => {
      errStr += d;
    });
  });
}

export async function mountRamDisk(size: number, name: string = generateDriveName()): Promise<DiskHandle> {
  let process: ChildProcess;
  let mountPath: string;
  const p = platform();
  if (p === 'darwin') {
    const darwinSize = size > HFS_MINIMUM ? size * 2 : HFS_MINIMUM;
    process = exec(`diskutil erasedisk HFS+ "${name}" $(hdid -nomount ram://${darwinSize})`);
    mountPath = `/Volumes/${name}/`;
  } else if (p === 'linux') {
    mountPath = `/tmp/${name}`;
    await new Promise((resolve, reject) => {
      mkdirp(mountPath, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
    process = exec(`sudo mount -t tmpfs -o size=${size}m tmpfs ${mountPath}`);
  } else {
    throw new Error('mountRamDisk can only be run on Mac or Linux');
  }

  return new Promise((resolve: (volumePath: DiskHandle) => void, reject) => {
    let outStr = '';
    let errStr = '';
    let filePath: string;
    if (p === 'linux') {
      filePath = mountPath;
    }
    process.on('exit', function (code, signal) {
      if (code === 0) {
        if (filePath) {
          resolve({
            mountPath,
            filePath,
            eject() {
              return eject(filePath);
            }
          });
        } else {
          reject(new Error('Unable to resolve disk path'));
        }
      } else {
        console.log(outStr);
        console.error(errStr);
        reject(new Error(`Error mounting disk: ${signal} | ${errStr}`));
      }
    });
    process.on('error', (e) => {
      reject(e);
    });
    process.stdout.on('data', (data: string) => {
      outStr += data;
      if (p === 'darwin') {
        // TODO: Better way of resolving the file path of the disk
        const searchPath = data.match(/\/[a-z\/0-9A-Z\.]+/);
        if (searchPath) {
          filePath = searchPath[0];
        }
      }
    });
    process.stderr.on('data', (data) => {
      errStr += data;
    });
  });
}