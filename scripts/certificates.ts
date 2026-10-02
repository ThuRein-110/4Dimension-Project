import { generate } from 'selfsigned';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { lanAddresses } from '../apps/server/src/network.js';

export async function generateCertificates() {
  const directory = resolve('.local/certs');
  await mkdir(directory, { recursive: true });
  let ca: { private: string; cert: string };
  try {
    ca = { private: await readFile(resolve(directory, 'ca-key.pem'), 'utf8'), cert: await readFile(resolve(directory, 'livespace-ca.crt'), 'utf8') };
  } catch {
    ca = await generate([{ name: 'commonName', value: '4D LiveSpace Local Development CA' }], {
      algorithm: 'sha256', keySize: 2048,
      notBeforeDate: new Date(Date.now() - 86400000), notAfterDate: new Date(Date.now() + 365 * 86400000),
      extensions: [{ name: 'basicConstraints', cA: true, critical: true }, { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true }],
    });
    await writeFile(resolve(directory, 'ca-key.pem'), ca.private, { mode: 0o600 });
    await writeFile(resolve(directory, 'livespace-ca.crt'), ca.cert);
  }
  const addresses = ['127.0.0.1', ...lanAddresses()];
  const server = await generate([{ name: 'commonName', value: '4D LiveSpace LAN' }], {
    algorithm: 'sha256', keySize: 2048, ca: { key: ca.private, cert: ca.cert },
    notBeforeDate: new Date(Date.now() - 86400000), notAfterDate: new Date(Date.now() + 90 * 86400000),
    extensions: [
      { name: 'basicConstraints', cA: false, critical: true },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, critical: true },
      { name: 'extKeyUsage', serverAuth: true },
      { name: 'subjectAltName', altNames: [{ type: 2, value: 'localhost' }, ...addresses.map(ip => ({ type: 7 as const, ip }))] },
    ],
  });
  await writeFile(resolve(directory, 'server-key.pem'), server.private, { mode: 0o600 });
  await writeFile(resolve(directory, 'server.pem'), server.cert);
  console.log(`Local HTTPS certificates generated for: ${addresses.join(', ')}`);
}
if (process.argv[1]?.endsWith('certificates.ts')) await generateCertificates();
