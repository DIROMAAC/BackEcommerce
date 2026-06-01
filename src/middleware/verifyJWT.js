const jwt = require('jsonwebtoken');
const { response, request } = require('express');
const User = require('../models/user');

const verifyJWT = async (req = request, res = response, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '') || 
                 req.header('x-auth-token');

    if (!token) {
        return res.status(401).json({
            ok: false,
            msg: 'Token de acceso requerido'
        });
    }

    try {
        // Verificar el token
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        
        // Buscar el usuario en la base de datos
        const user = await User.findById(decoded.uid).select('-password');
        
        if (!user) {
            return res.status(401).json({
                ok: false,
                msg: 'Token inválido - Usuario no encontrado'
            });
        }

        if (!user.isActive) {
            return res.status(401).json({
                ok: false,
                msg: 'Usuario desactivado'
            });
        }

        // Añadir información del usuario a la request
        req.user = user;
        req.uid = decoded.uid;
        
        next();
        
    } catch (error) {
        console.log(error);
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                ok: false,
                msg: 'Token expirado'
            });
        }
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                ok: false,
                msg: 'Token inválido'
            });
        }
        
        return res.status(500).json({
            ok: false,
            msg: 'Error interno del servidor'
        });
    }
};

// Middleware opcional - no requiere token pero si está presente lo valida
const optionalJWT = async (req = request, res = response, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '') || 
                 req.header('x-auth-token');

    if (!token) {
        // No hay token, continuar sin usuario
        req.user = null;
        req.uid = null;
        return next();
    }

    try {
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        const user = await User.findById(decoded.uid).select('-password');
        
        if (user && user.isActive) {
            req.user = user;
            req.uid = decoded.uid;
        }
        
        next();
        
    } catch (error) {
        // Si hay error con el token opcional, continuar sin usuario
        req.user = null;
        req.uid = null;
        next();
    }
};

module.exports = {
    verifyJWT,
    optionalJWT
};