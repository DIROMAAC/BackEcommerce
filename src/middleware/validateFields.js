const { validationResult } = require('express-validator');

/**
 * Middleware para capturar y retornar los errores de express-validator.
 */
const validateFields = (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        console.log('❌ Petición rechazada por errores de validación:', errors.mapped());
        return res.status(400).json({
            ok: false,
            msg: 'Error de validación en los campos',
            errors: errors.mapped()
        });
    }

    next();
};

module.exports = {
    validateFields
};
