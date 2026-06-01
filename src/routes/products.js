const { Router } = require('express');
const { 
    getProducts, 
    getProductById, 
    createProduct, 
    updateProduct, 
    deleteProduct,
    getFeaturedProducts,
    getProductsByCategory
} = require('../controllers/products');
const { verifyJWT } = require('../middleware/verifyJWT');
const { verifyAdminRole } = require('../middleware/verifyAdminRole');

const router = Router();

//  Rutas públicas de productos
router.get('/', getProducts);
router.get('/featured', getFeaturedProducts);
router.get('/category/:category', getProductsByCategory);  
router.get('/:id', getProductById);

//  Rutas de admin (requieren autenticación y rol admin)
router.post('/', [verifyJWT, verifyAdminRole], createProduct);
router.put('/:id', [verifyJWT, verifyAdminRole], updateProduct);
router.delete('/:id', [verifyJWT, verifyAdminRole], deleteProduct);

module.exports = router;