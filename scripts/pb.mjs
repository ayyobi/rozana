// Lance le binaire PocketBase placé à la racine du projet (Windows, macOS, Linux).
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const bin = join(process.cwd(), process.platform === 'win32' ? 'pocketbase.exe' : 'pocketbase');
if (!existsSync(bin)) {
  console.error(
    `\n✗ PocketBase introuvable : ${bin}\n` +
      '  Télécharge la version 0.40 sur https://github.com/pocketbase/pocketbase/releases\n' +
      '  et place le fichier à la racine du projet Rozana.\n',
  );
  process.exit(1);
}
// Transmet le fichier .env à PocketBase (mode d'inscription, code d'invitation…).
const envFile = join(process.cwd(), '.env');
if (existsSync(envFile)) {
  try {
    process.loadEnvFile(envFile);
  } catch {
    /* Node trop ancien : variables du shell uniquement */
  }
}
const args = process.argv.slice(2);
const child = spawn(bin, args.length ? args : ['serve'], { stdio: 'inherit', env: process.env });
child.on('exit', (code) => process.exit(code ?? 0));
