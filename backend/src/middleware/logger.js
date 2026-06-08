const fs = require('fs');
const path = require('path');
const winston = require('winston');
const { getRequestContext } = require('./requestContext');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Log color setup
winston.addColors(colors);

const logsDir = path.join(process.cwd(), 'logs');
fs.mkdirSync(logsDir, { recursive: true });

const enrichWithRequestContext = winston.format((info) => {
  const requestContext = getRequestContext();

  if (requestContext) {
    info.correlationId = info.correlationId || requestContext.correlationId;
    info.requestId = info.requestId || requestContext.requestId;
    info.traceId = info.traceId || requestContext.traceId;
    info.httpMethod = info.httpMethod || requestContext.method;
    info.requestPath = info.requestPath || requestContext.path;
  }

  if (info.error instanceof Error) {
    info.error = {
      name: info.error.name,
      message: info.error.message,
      stack: info.error.stack,
    };
  }

  return info;
});

const format = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  enrichWithRequestContext(),
  winston.format.json()
);

// Define transports
const transports = [
  new winston.transports.Console(),
  new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
  }),
  new winston.transports.File({ filename: path.join(logsDir, 'all.log') }),
];

// Create logger instance
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'warn',
  levels,
  format,
  transports,
  defaultMeta: {
    service: 'stellar-LABS-backend',
    environment: process.env.NODE_ENV || 'development',
  },
  exceptionHandlers: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: path.join(logsDir, 'exceptions.log') }),
  ],
  rejectionHandlers: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: path.join(logsDir, 'rejections.log') }),
  ],
});

module.exports = logger;
