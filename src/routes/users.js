const { Router } = require('express');
const {
    getUserProfile,
    updateUserProfile,
    addAddress,
    updateAddress,
    deleteAddress,
    addPaymentMethod,
    deletePaymentMethod,
    getAllUsers,
    updateUser,
    getUserStats
} = require('../controllers/users');
const { verifyJWT } = require('../middleware/verifyJWT');
const { verifyAdminRole } = require('../middleware/verifyAdminRole');

const router = Router();

console.log(' Cargando rutas de usuarios...');

// Todas las rutas requieren autenticación
router.use(verifyJWT);

// Rutas de perfil de usuario
router.get('/profile', getUserProfile);
router.put('/profile', updateUserProfile);

// Rutas de direcciones
router.post('/addresses', addAddress);
router.put('/addresses/:addressId', updateAddress);
router.delete('/addresses/:addressId', deleteAddress);

// Rutas de métodos de pago
router.post('/payment-methods', addPaymentMethod);
router.delete('/payment-methods/:paymentId', deletePaymentMethod);

// Rutas de administración (solo admin)
router.get('/admin/all', verifyAdminRole, getAllUsers);
router.get('/admin/stats', verifyAdminRole, getUserStats);
router.put('/admin/:userId', verifyAdminRole, updateUser);

console.log(' Rutas de usuarios configuradas:', {
    'GET /profile': 'getUserProfile',
    'POST /addresses': 'addAddress',
    'PUT /addresses/:id': 'updateAddress',
    'DELETE /addresses/:id': 'deleteAddress'
});

module.exports = router;