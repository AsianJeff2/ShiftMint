import { describe, expect, it } from 'vitest';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { createRendererPolicy, isAllowedExternalUrl } from '../../electron/main/renderer-policy';

describe('desktop renderer trust boundary', () => {
  const appPath = join(process.cwd(), 'fixture app');

  it('uses the packaged index even when a development URL is inherited', () => {
    const policy = createRendererPolicy({ packaged: true, appPath, devUrl: 'http://localhost:3000' });
    const index = pathToFileURL(join(appPath, 'dist', 'index.html')).href;
    expect(policy.rendererUrl).toBe(index);
    expect(policy.usesDevServer).toBe(false);
    expect(policy.isTrustedRendererUrl(`${index}#/settings`)).toBe(true);
    expect(policy.isTrustedRendererUrl('http://localhost:3000')).toBe(false);
    expect(policy.isTrustedRendererUrl(pathToFileURL(join(appPath, 'other.html')).href)).toBe(false);
    expect(policy.isTrustedRendererUrl('data:text/html,untrusted')).toBe(false);
  });

  it('allows development routing only at the configured local origin', () => {
    const policy = createRendererPolicy({ packaged: false, appPath, devUrl: 'http://127.0.0.1:3000' });
    expect(policy.usesDevServer).toBe(true);
    expect(policy.isTrustedRendererUrl('http://127.0.0.1:3000/#/dashboard')).toBe(true);
    expect(policy.isTrustedRendererUrl('http://127.0.0.1:3001')).toBe(false);
    expect(policy.isTrustedRendererUrl('http://127.0.0.1.evil.example:3000')).toBe(false);
    expect(policy.isTrustedRendererUrl('http://user:password@127.0.0.1:3000')).toBe(false);
  });

  it.each(['https://remote.example', 'file:///tmp/index.html', 'http://localhost.evil.example:3000',
    'http://user:password@localhost:3000'])('rejects an unsafe development renderer: %s', devUrl => {
    expect(() => createRendererPolicy({ packaged: false, appPath, devUrl })).toThrow();
  });

  it.each(['javascript:alert(1)', 'file:///tmp/private.db', 'data:text/html,untrusted',
    'ftp://example.com/file', 'http://user:password@example.com', 'invalid'])
  ('rejects unsafe external protocol or credentials: %s', url => {
    expect(isAllowedExternalUrl(url)).toBe(false);
  });

  it('allows ordinary provider and documentation links', () => {
    expect(isAllowedExternalUrl('https://squareup.com/oauth2/authorize?state=example')).toBe(true);
    expect(isAllowedExternalUrl('https://doc.toasttab.com')).toBe(true);
  });
});
