import { join } from 'path';
import { pathToFileURL } from 'url';

interface RendererOptions {
  packaged: boolean;
  appPath: string;
  devUrl?: string;
}

export function createRendererPolicy(options: RendererOptions) {
  const usesDevServer = !options.packaged && Boolean(options.devUrl);
  const renderer = usesDevServer
    ? new URL(options.devUrl!)
    : pathToFileURL(join(options.appPath, 'dist', 'index.html'));
  if (usesDevServer && (renderer.protocol !== 'http:' ||
      !['localhost', '127.0.0.1', '[::1]'].includes(renderer.hostname) ||
      renderer.username || renderer.password)) {
    throw new Error('The development renderer must use a local HTTP server');
  }
  renderer.hash = '';
  renderer.search = '';

  return {
    usesDevServer,
    rendererUrl: renderer.href,
    isTrustedRendererUrl(value: string): boolean {
      try {
        const candidate = new URL(value);
        if (candidate.username || candidate.password) return false;
        if (usesDevServer) return candidate.origin === renderer.origin;
        candidate.hash = '';
        candidate.search = '';
        return candidate.href === renderer.href;
      } catch {
        return false;
      }
    },
  };
}

export function isAllowedExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}
