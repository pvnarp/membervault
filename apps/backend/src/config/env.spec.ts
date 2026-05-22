describe('loadEnv()', () => {
  const BASE = {
    DATABASE_URL: 'postgresql://localhost/test',
    JWT_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
    ENCRYPTION_KEY: 'c'.repeat(64),
  };

  function run(overrides: Record<string, string>) {
    // Reset the singleton cache between tests by re-importing with a fresh module
    vi.resetModules();
    const env = { ...BASE, ...overrides };
    Object.assign(process.env, env);
    return import('./env.js');
  }

  afterEach(() => {
    // Clean up injected env vars
    for (const key of Object.keys(BASE)) delete process.env[key];
    [
      'NODE_ENV',
      'ALTCHA_HMAC_KEY',
      'RESEND_API_KEY',
      'CRON_SECRET',
      'PORT',
      'CORS_ORIGIN',
      'UPLOAD_PATH',
      'LOG_LEVEL',
      'DOMAIN',
      'REDIS_URL',
      'EMAIL_FROM',
    ].forEach((k) => delete process.env[k]);
    vi.resetModules();
  });

  it('starts successfully in development without optional prod keys', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const { loadEnv } = await run({ NODE_ENV: 'development' });
    loadEnv();
    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  it('blocks production startup when ALTCHA_HMAC_KEY is missing', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { loadEnv } = await run({
      NODE_ENV: 'production',
      RESEND_API_KEY: 're_real_key',
      CRON_SECRET: 'd'.repeat(32),
      // ALTCHA_HMAC_KEY intentionally absent
    });
    loadEnv();
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('ALTCHA_HMAC_KEY'));
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('blocks production startup when RESEND_API_KEY is placeholder', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { loadEnv } = await run({
      NODE_ENV: 'production',
      RESEND_API_KEY: 're_your_resend_api_key',
      ALTCHA_HMAC_KEY: 'hmac-key-value',
      CRON_SECRET: 'd'.repeat(32),
    });
    loadEnv();
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('RESEND_API_KEY'));
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('blocks production startup when CRON_SECRET is missing', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { loadEnv } = await run({
      NODE_ENV: 'production',
      RESEND_API_KEY: 're_real_key',
      ALTCHA_HMAC_KEY: 'hmac-key-value',
      // CRON_SECRET intentionally absent
    });
    loadEnv();
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('CRON_SECRET'));
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('starts successfully in production when all required keys are set', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const { loadEnv } = await run({
      NODE_ENV: 'production',
      RESEND_API_KEY: 're_real_key',
      ALTCHA_HMAC_KEY: 'real-hmac-key',
      CRON_SECRET: 'd'.repeat(32),
    });
    loadEnv();
    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });
});
