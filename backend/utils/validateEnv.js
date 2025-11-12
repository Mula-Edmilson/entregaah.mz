const validateRequiredEnv = (keys = []) => {
  const missing = keys.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Variáveis de ambiente em falta: ${missing.join(', ')}`);
  }
};

module.exports = { validateRequiredEnv };