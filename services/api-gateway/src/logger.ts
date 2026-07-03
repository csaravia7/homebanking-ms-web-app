import log4js from 'log4js';

log4js.configure({
  appenders: {
    console: { type: 'stdout', layout: { type: 'pattern', pattern: '%d{yyyy-MM-dd hh:mm:ss.SSS} [%p] %c - %m' } },
    file: { type: 'file', filename: 'logs/api-gateway.log', maxLogSize: 10485760, backups: 10, compress: true },
  },
  categories: {
    default: { appenders: ['console', 'file'], level: process.env.LOG_LEVEL || 'info' },
  },
});

export const logger = log4js.getLogger('api-gateway');
