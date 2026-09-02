import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('public/manifest.json', 'utf8'));

if (!manifest.permissions?.includes('scripting')) {
  throw new Error('missing scripting permission');
}
if (
  !manifest.host_permissions?.includes('http://*/*') ||
  !manifest.host_permissions?.includes('https://*/*')
) {
  throw new Error('missing http/https host_permissions');
}

console.log('manifest ok');
