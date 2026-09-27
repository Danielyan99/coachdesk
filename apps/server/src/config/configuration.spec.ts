import { loadConfig } from './configuration';

const base = { MONGO_URI: 'mongodb://localhost/test', JWT_SECRET: 'x'.repeat(40) };

describe('loadConfig', () => {
  it('uses safe local defaults', () => {
    const config = loadConfig(base);
    expect(config.webOrigin).toBe('http://localhost:5173');
    expect(config.secureCookies).toBe(false);
    expect(config.authRateLimitPerMinute).toBe(10);
  });

  it('turns on secure cookies for an https web origin and drops the trailing slash', () => {
    const config = loadConfig({ ...base, WEB_ORIGIN: 'https://coachdesk.vercel.app/' });
    expect(config.webOrigin).toBe('https://coachdesk.vercel.app');
    expect(config.secureCookies).toBe(true);
  });

  it('fails fast when a required value is missing', () => {
    expect(() => loadConfig({ MONGO_URI: 'mongodb://x' })).toThrow('JWT_SECRET');
  });

  it('rejects a short JWT secret in production', () => {
    expect(() => loadConfig({ ...base, JWT_SECRET: 'short', WEB_ORIGIN: 'https://a.app' })).toThrow('32');
  });
});
