import { readFile } from 'node:fs/promises';
import type { RequestHandler } from 'express';

export function certificateDownload(certificatePath: string): RequestHandler {
  return async (_req, res) => {
    try {
      // Read only the configured public certificate; sendFile ignores hidden directories.
      const certificate = await readFile(certificatePath);
      res.setHeader('Cache-Control', 'no-store');
      res.type('application/x-x509-ca-cert').send(certificate);
    } catch (error) {
      const missing = (error as NodeJS.ErrnoException).code === 'ENOENT';
      res.status(missing ? 404 : 503).type('text/plain').send(
        missing ? 'Certificate not available. Run npm run certs on Windows, then restart the app.'
          : 'Certificate download unavailable. Check the server certificate files on Windows.',
      );
    }
  };
}
