import pino from 'pino';

const isProd = process.env.NODE_ENV === 'production';

// pino-pretty is a devDependency — only use transport in non-production
let transport: pino.TransportSingleOptions | undefined;
if (!isProd) {
  try {
    require.resolve('pino-pretty');
    transport = { target: 'pino-pretty', options: { colorize: true } };
  } catch {
    // pino-pretty not available, use default JSON output
  }
}

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
  transport,
});
