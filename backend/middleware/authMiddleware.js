const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');

exports.protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    res.status(401);
    throw new Error('Não autorizado, token em falta.');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user) {
      res.status(401);
      throw new Error('Utilizador não encontrado.');
    }

    next();
  } catch (error) {
    res.status(401);
    throw new Error('Não autorizado, token inválido.');
  }
});

exports.admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403);
    throw new Error('Acesso negado. Apenas administradores.');
  }
};

exports.driver = (req, res, next) => {
  if (req.user && req.user.role === 'driver') {
    next();
  } else {
    res.status(403);
    throw new Error('Acesso negado. Apenas motoristas.');
  }
};

exports.manager = (req, res, next) => {
  if (req.user && req.user.role === 'manager') {
    next();
  } else {
    res.status(403);
    throw new Error('Acesso negado. Apenas gestores.');
  }
};

exports.adminOrManager = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'manager')) {
    next();
  } else {
    res.status(403);
    throw new Error('Acesso negado. Apenas administradores ou gestores.');
  }
};
