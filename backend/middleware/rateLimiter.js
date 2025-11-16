// Rate limiter desativado
const apiLimiter = (req, res, next) => next();

module.exports = apiLimiter;
