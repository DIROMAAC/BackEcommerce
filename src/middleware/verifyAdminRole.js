const { response, request } = require('express');

const verifyAdminRole = (req = request, res = response, next) => {
    // Verificar que el usuario esté autenticado (debe usar verifyJWT antes)
    if (!req.user) {
        return res.status(401).json({
            ok: false,
            msg: 'Token de acceso requerido'
        });
    }

    // Verificar que el usuario sea administrador
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            ok: false,
            msg: 'Acceso denegado - Se requieren permisos de administrador'
        });
    }

    next();
};

// Middleware para verificar que sea admin o el mismo usuario (para endpoints de perfil)
const verifyAdminOrOwner = (req = request, res = response, next) => {
    if (!req.user) {
        return res.status(401).json({
            ok: false,
            msg: 'Token de acceso requerido'
        });
    }

    const userIdFromParam = req.params.id || req.params.userId;
    const isOwner = req.user._id.toString() === userIdFromParam;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
        return res.status(403).json({
            ok: false,
            msg: 'Acceso denegado - Solo puedes acceder a tu propia información'
        });
    }

    next();
};

module.exports = {
    verifyAdminRole,
    verifyAdminOrOwner
};