/*
 * Ficheiro: backend/middleware/errorMiddleware.js
 *
 * (MELHORIA)
 *
 * Contém os middlewares centralizados de tratamento de erros.
 * Isto permite-nos parar de usar 'try...catch' em todo o lado e
 * ter um local único para formatar as respostas de erro.
 */

/**
 * Middleware 'notFound' (404)
 *
 * Captura qualquer pedido que não corresponda a uma rota definida.
 */
const notFound = (req, res, next) => {
    const error = new Error(`Não encontrado - ${req.originalUrl}`);
    res.status(404);
    next(error); // Passa o erro para o próximo middleware (o errorHandler)
};

/**
 * Middleware 'errorHandler' (Error Handler Central)
 *
 * Captura TODOS os erros da aplicação.
 * É por isso que ele tem 4 argumentos (err, req, res, next).
 * O Express sabe que este é um middleware especial de erro.
 */
const errorHandler = (err, req, res, next) => {
    // Às vezes, um erro pode vir com um status 200 (OK), o que é estranho.
    // Se isso acontecer, definimos o status como 500 (Erro Interno).
    let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    
    // A mensagem de erro
    let message = err.message;

    // (Opcional, mas recomendado) Fornece mensagens mais limpas para
    // erros comuns do Mongoose, como IDs inválidos.
    if (err.name === 'CastError' && err.kind === 'ObjectId') {
        statusCode = 404; // Trata como "Não Encontrado"
        message = 'Recurso não encontrado (ID inválido)';
    }

    console.error(`[errorHandler]: ${message}`); // Loga o erro no console do servidor
    console.error(err.stack); // Loga o stack trace para depuração

    // Envia a resposta de erro formatada em JSON
    res.status(statusCode).json({
        message: message,
        // (MELHORIA) Só mostra o stack trace se não estivermos em produção
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
};

module.exports = {
    notFound,
    errorHandler,
};