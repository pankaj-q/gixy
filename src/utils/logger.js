import winston from 'winston';
import path from 'path';
import config from '../config/index.js';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// Determine if we should use file transports (only in local development)
const useFileTransports = config.env === 'development' && process.env.NODE_ENV !== 'production';

// Create logger instance
const transports = [
  // Console transport (always enabled)
  new winston.transports.Console({
    format: config.env === 'development' ? consoleFormat : logFormat
  })
];

// File transports (only in development/local environments)
if (useFileTransports) {
  transports.push(
    // File transport for errors
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // File transport for all logs
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
      maxsize: 5242880,
      maxFiles: 5
    })
  );
}

const exceptionHandlers = useFileTransports ? [
  new winston.transports.File({
    filename: path.join('logs', 'exceptions.log'),
    maxsize: 5242880,
    maxFiles: 5
  })
] : [];

const rejectionHandlers = useFileTransports ? [
  new winston.transports.File({
    filename: path.join('logs', 'rejections.log'),
    maxsize: 5242880,
    maxFiles: 5
  })
] : [];

export const logger = winston.createLogger({
  level: config.logLevel,
  format: logFormat,
  defaultMeta: { service: 'ai-risk-manager' },
  transports,
  exceptionHandlers,
  rejectionHandlers
});

// Create a child logger for specific modules
export function createModuleLogger(moduleName) {
  return logger.child({ module: moduleName });
}

// Request logging middleware
export function requestLogger(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent')
    };

    if (res.statusCode >= 400) {
      logger.warn('HTTP Request', logData);
    } else {
      logger.info('HTTP Request', logData);
    }
  });

  next();
}

// Audit logging for sensitive operations
export function auditLog(action, userId, details) {
  logger.info('AUDIT', {
    action,
    userId,
    timestamp: new Date().toISOString(),
    details
  });
}