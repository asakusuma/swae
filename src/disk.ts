import { platform } from 'os';
import execa, { ExecaReturnValue } from 'execa';
import mkdirp from 'mkdirp';

const HFS_MINIMUM = 1100;

export interface DiskHandle {
  mountPath: string;
  filePath: string;
  eject: () => Promise<ExecaReturnValue>;
}

function generateDriveName() {
  return `swae_test_drive_${String(parseInt(String(Math.random() * 1000000)))}`;
}

function eject(path: string) {
  const command = platform() === 'darwin' ? `diskutil eject ${path} -force` : `sudo umount ${path}`;
  return execa.command(command, { shell: true }).catch((e) => {
    throw new Error(`Failed to eject disk: ${e.message}`);
  });
}

export async function mountRamDisk(size: number, name: string = generateDriveName()): Promise<DiskHandle> {
  let mountPath: string;
  let command: string;
  const p = platform();
  if (p === 'darwin') {
    const darwinSize = size > HFS_MINIMUM ? size * 2 : HFS_MINIMUM;
    command = `diskutil erasedisk HFS+ "${name}" $(hdid -nomount ram://${darwinSize})`;
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
    command = `sudo mount -t tmpfs -o size=${size} tmpfs ${mountPath}`;
  } else {
    throw new Error('mountRamDisk can only be run on Mac or Linux');
  }

  return execa.command(command, { shell: true }).then((result) => {
    let filePath = '';
    if (p === 'darwin') {
      // TODO: Better way of resolving the file path of the disk
      const searchPath = result.stdout.match(/\/[a-z\/0-9A-Z\.]+/);
      if (searchPath) {
        filePath = searchPath[0];
      }
    } else {
      // linux
      filePath = mountPath;
    }
    if (filePath) {
      return {
        mountPath,
        filePath,
        eject() {
          return eject(filePath);
        }
      };
    } else {
      throw new Error('Unable to resolve disk path');
    }
  }).catch((err: execa.ExecaError) => {
    throw new Error(`Error mounting disk: ${err.message}`);
  });
}