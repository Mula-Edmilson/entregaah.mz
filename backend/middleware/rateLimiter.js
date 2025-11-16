const rateLimit = require('express-rate-limit');

// Se estiver em desenvolvimento, desativa o rate limiter
const isDevelopment = process.env.NODE_ENV !== 'production';

const apiLimiter = isDevelopment 
  ? (req, res, next) => next() // Desativado em dev
  : rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || `${15 * 60 * 1000}`, 10), // 15 min
      max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // 100 requests
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        message: 'Demasiados pedidos a partir deste IP. Tente novamente dentro de alguns minutos.'
      }
    });

module.exports = apiLimiter;
