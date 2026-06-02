const { response, request } = require('express');
const { ClothingProduct, AccessoryProduct } = require('../models/product');

// Función helper para mapear producto con ID
const mapProductWithId = (product, productType) => ({
    ...product.toObject(),
    id: product._id.toString(), // ⭐ CRÍTICO: Mapear _id a id
    productType: productType || product.productType || (product.gender ? 'clothing' : 'accessory')
});

// GET - Obtener todos los productos (CORREGIDO COMPLETAMENTE)
const getProducts = async (req = request, res = response) => {
    try {
        const { 
            category, 
            gender, 
            minPrice, 
            maxPrice, 
            inStock, 
            sortBy = 'createdAt', 
            sortOrder = 'desc',
            page = 1,
            limit = 100,
            search
        } = req.query;

        console.log('Parametros recibidos:', { category, gender, search, limit });

        let products = [];
        
        // Construir filtros base
        const baseFilters = {};
        
        if (inStock !== undefined) {
            if (inStock === 'true') {
                baseFilters.stock = { $gt: 0 };
            } else {
                baseFilters.stock = 0;
            }
        }
        
        if (minPrice || maxPrice) {
            baseFilters.price = {};
            if (minPrice) baseFilters.price.$gte = Number(minPrice);
            if (maxPrice) baseFilters.price.$lte = Number(maxPrice);
        }

        // Búsqueda por texto
        if (search) {
            baseFilters.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        // OBTENER PRODUCTOS SEGÚN CATEGORÍA
        if (category === 'men') {
            const clothingFilters = { ...baseFilters, gender: 'men' };
            const clothingProducts = await ClothingProduct.find(clothingFilters);
            products = clothingProducts.map(p => mapProductWithId(p, 'clothing'));
            
        } else if (category === 'women') {
            const clothingFilters = { ...baseFilters, gender: 'women' };
            const clothingProducts = await ClothingProduct.find(clothingFilters);
            products = clothingProducts.map(p => mapProductWithId(p, 'clothing'));
            
        } else if (category === 'accessories') {
            const accessoryProducts = await AccessoryProduct.find(baseFilters);
            products = accessoryProducts.map(p => mapProductWithId(p, 'accessory'));
            
        } else {
            // TODOS los productos
            console.log('Obteniendo TODOS los productos...');
            
            const [clothingProducts, accessoryProducts] = await Promise.all([
                ClothingProduct.find(baseFilters),
                AccessoryProduct.find(baseFilters)
            ]);
            
            console.log(`Productos de ropa encontrados: ${clothingProducts.length}`);
            console.log(`Accesorios encontrados: ${accessoryProducts.length}`);
            
            const clothingWithType = clothingProducts.map(product => 
                mapProductWithId(product, 'clothing')
            );
            
            const accessoriesWithType = accessoryProducts.map(product => 
                mapProductWithId(product, 'accessory')
            );
            
            products = [...clothingWithType, ...accessoriesWithType];
        }

        console.log(`Total productos encontrados: ${products.length}`);

        // Aplicar ordenamiento
        if (sortBy === 'price') {
            products.sort((a, b) => {
                const priceA = a.salePrice || a.price;
                const priceB = b.salePrice || b.price;
                return sortOrder === 'desc' ? priceB - priceA : priceA - priceB;
            });
        } else if (sortBy === 'name') {
            products.sort((a, b) => {
                return sortOrder === 'desc' ? 
                    b.name.localeCompare(a.name) : 
                    a.name.localeCompare(b.name);
            });
        } else if (sortBy === 'rating') {
            products.sort((a, b) => {
                return sortOrder === 'desc' ? b.rating - a.rating : a.rating - b.rating;
            });
        }

        // Paginación
        const skip = (page - 1) * limit;
        const paginatedProducts = products.slice(skip, skip + parseInt(limit));

        console.log(`Enviando ${paginatedProducts.length} productos (pagina ${page})`);
        console.log('Primeros 3 productos:', paginatedProducts.slice(0, 3).map(p => ({
            id: p.id,
            name: p.name,
            type: p.productType
        })));

        res.status(200).json({
            ok: true,
            products: paginatedProducts,
            totalProducts: products.length,
            currentPage: parseInt(page),
            totalPages: Math.ceil(products.length / limit),
            hasNextPage: skip + parseInt(limit) < products.length,
            hasPrevPage: parseInt(page) > 1
        });

    } catch (error) {
        console.error('Error al obtener productos:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno del servidor',
            error: error.message
        });
    }
};

// GET - Obtener producto por ID
const getProductById = async (req = request, res = response) => {
    try {
        const { id } = req.params;
        
        let product = await ClothingProduct.findById(id);
        let productType = 'clothing';
        
        if (!product) {
            product = await AccessoryProduct.findById(id);
            productType = 'accessory';
        }
        
        if (!product) {
            return res.status(404).json({
                ok: false,
                msg: 'Producto no encontrado'
            });
        }

        const productWithId = mapProductWithId(product, productType);

        res.status(200).json({
            ok: true,
            product: productWithId
        });

    } catch (error) {
        console.error('Error al obtener producto:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno del servidor'
        });
    }
};

// POST - Crear producto
const createProduct = async (req = request, res = response) => {
    try {
        const { productType, ...productData } = req.body;
        
        console.log('Creando producto:', { productType, name: productData.name });
        
        if (!productType || !['clothing', 'accessory'].includes(productType)) {
            return res.status(400).json({
                ok: false,
                msg: 'Tipo de producto inválido'
            });
        }

        const ProductModel = productType === 'clothing' ? ClothingProduct : AccessoryProduct;
        
        // Validar campos requeridos según el tipo
        if (productType === 'clothing') {
            if (!productData.gender || !productData.sizes || !productData.fit) {
                return res.status(400).json({
                    ok: false,
                    msg: 'Faltan campos requeridos para productos de ropa (gender, sizes, fit)'
                });
            }
        }

        const newProduct = new ProductModel({
            ...productData,
            productType
        });

        const savedProduct = await newProduct.save();
        const productWithId = mapProductWithId(savedProduct, productType);

        console.log('Producto creado:', productWithId.id);

        res.status(201).json({
            ok: true,
            msg: 'Producto creado exitosamente',
            product: productWithId
        });

    } catch (error) {
        console.error('Error al crear producto:', error);
        
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                ok: false,
                msg: 'Error de validación',
                errors: Object.values(error.errors).map(err => err.message)
            });
        }

        res.status(500).json({
            ok: false,
            msg: 'Error interno del servidor'
        });
    }
};

// PUT - Actualizar producto
const updateProduct = async (req = request, res = response) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        console.log('Actualizando producto:', id);

        let product = await ClothingProduct.findById(id);
        let isClothing = true;
        
        if (!product) {
            product = await AccessoryProduct.findById(id);
            isClothing = false;
        }
        
        if (!product) {
            return res.status(404).json({
                ok: false,
                msg: 'Producto no encontrado'
            });
        }

        // Actualizar campos
        Object.keys(updateData).forEach(key => {
            if (key !== '_id' && key !== '__v' && key !== 'createdAt' && key !== 'id') {
                product[key] = updateData[key];
            }
        });

        product.updatedAt = new Date();
        const savedProduct = await product.save();
        
        const productWithId = mapProductWithId(savedProduct, isClothing ? 'clothing' : 'accessory');

        console.log('Producto actualizado:', productWithId.id);

        res.status(200).json({
            ok: true,
            msg: 'Producto actualizado exitosamente',
            product: productWithId
        });

    } catch (error) {
        console.error('Error al actualizar producto:', error);
        
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                ok: false,
                msg: 'Error de validación',
                errors: Object.values(error.errors).map(err => err.message)
            });
        }

        res.status(500).json({
            ok: false,
            msg: 'Error interno del servidor'
        });
    }
};

// DELETE - Eliminar producto
const deleteProduct = async (req = request, res = response) => {
    try {
        const { id } = req.params;
        
        console.log('Eliminando producto:', id);
        
        let deletedProduct = await ClothingProduct.findByIdAndDelete(id);
        let productType = 'clothing';
        
        if (!deletedProduct) {
            deletedProduct = await AccessoryProduct.findByIdAndDelete(id);
            productType = 'accessory';
        }
        
        if (!deletedProduct) {
            return res.status(404).json({
                ok: false,
                msg: 'Producto no encontrado'
            });
        }

        const deletedProductWithId = mapProductWithId(deletedProduct, productType);

        console.log('Producto eliminado:', deletedProductWithId.id);

        res.status(200).json({
            ok: true,
            msg: 'Producto eliminado exitosamente',
            product: deletedProductWithId
        });

    } catch (error) {
        console.error('Error al eliminar producto:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno del servidor'
        });
    }
};

// GET - Productos destacados
const getFeaturedProducts = async (req = request, res = response) => {
    try {
        const { limit = 8 } = req.query;
        
        const [clothingProducts, accessoryProducts] = await Promise.all([
            ClothingProduct.find({ stock: { $gt: 0 } }).sort({ rating: -1 }),
            AccessoryProduct.find({ stock: { $gt: 0 } }).sort({ rating: -1 })
        ]);
        
        const clothingWithType = clothingProducts.map(product => 
            mapProductWithId(product, 'clothing')
        );
        
        const accessoriesWithType = accessoryProducts.map(product => 
            mapProductWithId(product, 'accessory')
        );
        
        const allProducts = [...clothingWithType, ...accessoriesWithType];
        
        const featuredProducts = allProducts
            .sort((a, b) => b.rating - a.rating)
            .slice(0, parseInt(limit));

        res.status(200).json({
            ok: true,
            products: featuredProducts
        });

    } catch (error) {
        console.error('Error al obtener productos destacados:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno del servidor'
        });
    }
};

// GET - Productos por categoría
const getProductsByCategory = async (req = request, res = response) => {
    try {
        const { category } = req.params;
        const { limit, sortBy = 'createdAt' } = req.query;
        
        let products = [];
        
        switch (category.toLowerCase()) {
            case 'men':
                const menProducts = await ClothingProduct.find({ gender: 'men', stock: { $gt: 0 } });
                products = menProducts.map(p => mapProductWithId(p, 'clothing'));
                break;
            case 'women':
                const womenProducts = await ClothingProduct.find({ gender: 'women', stock: { $gt: 0 } });
                products = womenProducts.map(p => mapProductWithId(p, 'clothing'));
                break;
            case 'accessories':
                const accessoryProducts = await AccessoryProduct.find({ stock: { $gt: 0 } });
                products = accessoryProducts.map(p => mapProductWithId(p, 'accessory'));
                break;
            default:
                return res.status(400).json({
                    ok: false,
                    msg: 'Categoría inválida'
                });
        }

        if (limit) {
            products = products.slice(0, parseInt(limit));
        }

        res.status(200).json({
            ok: true,
            products,
            category,
            count: products.length
        });

    } catch (error) {
        console.error('Error al obtener productos por categoría:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno del servidor'
        });
    }
};

module.exports = {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    getFeaturedProducts,
    getProductsByCategory
};