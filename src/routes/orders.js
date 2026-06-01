const { Router } = require('express');
const { 
    createOrder,
    getUserOrders,
    getOrder,
    cancelOrder,
    getAllOrders,
    updateOrderStatus,
    getOrderStats
} = require('../controllers/orders');
const { verifyJWT } = require('../middleware/verifyJWT');
const { verifyAdminRole } = require('../middleware/verifyAdminRole');

const router = Router();

// Todas las rutas de pedidos requieren un token de autenticación válido
router.use(verifyJWT);

// Las rutas admin DEBEN ir antes de /:orderId para que Express
// no las trate como un parámetro de ruta dinámica
router.get('/admin/all', verifyAdminRole, getAllOrders);      // Ver todas las órdenes de la tienda
router.get('/admin/stats', verifyAdminRole, getOrderStats);  // Estadísticas de ventas e ingresos
router.put('/admin/:orderId', verifyAdminRole, updateOrderStatus); // Actualizar estado de orden

// Rutas de usuario
router.get('/', getUserOrders);               // Obtener historial de pedidos paginado del usuario
router.post('/', createOrder);                // Crear un nuevo pedido
router.get('/:orderId', getOrder);            // Obtener detalles de un pedido específico
router.put('/:orderId/cancel', cancelOrder);  // Cancelar un pedido propio

module.exports = router;