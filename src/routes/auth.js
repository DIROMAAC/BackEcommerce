const { Router } = require('express');
const { check } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { login, register, renewToken, verifyToken, changePassword, requestPasswordReset } = require('../controllers/auth');
const { verifyJWT } = require('../middleware/verifyJWT');
const { validateFields } = require('../middleware/validateFields');

const router = Router();

// Limitador de peticiones para endpoints de autenticación (fuerza bruta / DDoS ligero)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 15, // Máximo 15 intentos por IP
    message: {
        ok: false,
        msg: 'Demasiadas peticiones desde esta dirección IP. Inténtalo de nuevo en 15 minutos.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

//  Rutas de autenticación con validaciones robustas y rate limiting
router.post('/login', [
    authLimiter,
    check('email', 'El correo electrónico no es válido').isEmail(),
    check('password', 'La contraseña es obligatoria').notEmpty().isString(),
    validateFields
], login);

router.post('/register', [
    authLimiter,
    check('username', 'El nombre de usuario es obligatorio y debe ser un texto de al menos 3 caracteres').isString().trim().isLength({ min: 3 }),
    check('email', 'El correo electrónico no es válido').isEmail(),
    check('password', 'La contraseña debe tener al menos 6 caracteres').isString().isLength({ min: 6 }),
    check('firstName', 'El nombre es obligatorio y debe ser un texto').isString().trim().notEmpty(),
    check('lastName', 'El apellido es obligatorio y debe ser un texto').isString().trim().notEmpty(),
    validateFields
], register);

router.post('/forgot-password', [
    authLimiter,
    check('email', 'El correo electrónico no es válido').isEmail(),
    validateFields
], requestPasswordReset);

router.get('/renew', verifyJWT, renewToken);
router.get('/verify', verifyJWT, verifyToken);

router.put('/change-password', [
    verifyJWT,
    check('currentPassword', 'La contraseña actual es obligatoria').notEmpty().isString(),
    check('newPassword', 'La nueva contraseña debe tener al menos 6 caracteres').isString().isLength({ min: 6 }),
    validateFields
], changePassword);

console.log(' Rutas de auth configuradas con validación y rate-limit:', {
    'POST /login': 'login',
    'POST /register': 'register',
    'GET /verify': 'verifyToken',
    'PUT /change-password': 'changePassword'
});

module.exports = router;