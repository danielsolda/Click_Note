/**
 * Envolve um handler async para capturar erros sem try/catch em cada rota.
 * @param {Function} fn  Handler (req, res, next) => Promise
 */
export function asyncRoute(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/**
 * Middleware de erro global. Deve ser montado APÓS todas as rotas no server.js.
 */
export function errorHandler(err, _req, res, _next) {
  const status = err.status ?? err.statusCode ?? 500;
  const message = err.message ?? 'Erro interno';
  console.error(`[api] ${status} ${message}`);
  res.status(status).json({ error: message });
}
