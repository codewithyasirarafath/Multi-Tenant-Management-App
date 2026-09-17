import morgan from 'morgan';

const morganFormat = process.env.NODE_ENV === 'production'
  ? 'combined'
  : ':method :url :status :response-time ms - :res[content-length]';

export const requestLogger = morgan(morganFormat, {
  skip: (req, _res) => req.path === '/health',
});

export const requestIdMiddleware = (req, res, next) => {
  req.requestId = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  next();
};