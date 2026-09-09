import * as http from 'http';
import { URL } from 'url';

export interface OAuthCallbackResult {
  code?: string;
  error?: string;
}

export function waitForOAuthCallback(port: number = 8888, timeoutMs: number = 120000): Promise<OAuthCallbackResult> {
  return new Promise((resolve) => {
    let settled = false;
    let timeoutHandle: NodeJS.Timeout;

    const finish = (result: OAuthCallbackResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutHandle);
      server.close();
      resolve(result);
    };

    const server = http.createServer((req, res) => {
      if (!req.url) {
        res.writeHead(400);
        res.end('URL de callback ausente');
        return;
      }

      const url = new URL(req.url, `http://127.0.0.1:${port}`);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      const heading = error ? 'Algo deu errado' : 'Pronto!';

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <html><body style="font-family:sans-serif;text-align:center;padding-top:80px;background:#12151C;color:#EDEFF4">
          <h2>${heading}</h2><p>Pode fechar esta aba e voltar pra Karen.</p>
        </body></html>
      `);

      finish(error ? { error } : { code: code || undefined });
    });

    server.on('error', (error: NodeJS.ErrnoException) => {
      finish({ error: error.code === 'EADDRINUSE' ? `A porta ${port} já está em uso` : error.message });
    });

    timeoutHandle = setTimeout(() => {
      finish({ error: 'Tempo esgotado esperando a autorização (2 minutos)' });
    }, timeoutMs);

    server.listen(port, '127.0.0.1');
  });
}
