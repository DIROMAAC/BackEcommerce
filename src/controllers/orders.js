const { response, request } = require('express');
const Order = require('../models/order');
const { ClothingProduct, AccessoryProduct } = require('../models/product');
const User = require('../models/user');

//  POST - Crear nueva orden
const createOrder = async (req = request, res = response) => {
    try {
        const { items, shippingAddress, paymentInfo, shippingMethod = 'standard' } = req.body;
        const userId = req.uid;

        console.log('Creando nueva orden para usuario:', userId);

        // Validar datos requeridos
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                ok: false,
                msg: 'Debe incluir al menos un producto en la orden'
            });
        }

        if (!shippingAddress || !paymentInfo) {
            return res.status(400).json({
                ok: false,
                msg: 'Dirección de envío e información de pago son requeridas'
            });
        }

        // Obtener información del usuario
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                ok: false,
                msg: 'Usuario no encontrado'
            });
        }

        // 1. Validar disponibilidad de stock para TODOS los productos primero
        for (const item of items) {
            let product = await ClothingProduct.findById(item.productId);
            if (!product) {
                product = await AccessoryProduct.findById(item.productId);
            }
            if (!product) {
                return res.status(404).json({
                    ok: false,
                    msg: `Producto ${item.productId} no encontrado`
                });
            }
            if (!product.inStock) {
                return res.status(400).json({
                    ok: false,
                    msg: `El producto ${product.name} no está disponible (Agotado)`
                });
            }
            
            const reqQty = item.quantity || 1;
            if (product.stock !== undefined && product.stock < reqQty) {
                return res.status(400).json({
                    ok: false,
                    msg: `No hay suficiente stock disponible para ${product.name} (Disponible: ${product.stock}, Solicitado: ${reqQty})`
                });
            }
        }

        // 2. Procesar items y reducir stock
        const processedItems = [];
        let subtotal = 0;

        for (const item of items) {
            // Buscar producto
            let product = await ClothingProduct.findById(item.productId);
            let productModel = 'ClothingProduct';
            
            if (!product) {
                product = await AccessoryProduct.findById(item.productId);
                productModel = 'AccessoryProduct';
            }

            // Validar talla para productos de ropa
            if (productModel === 'ClothingProduct' && product.sizes && product.sizes.length > 0) {
                if (!item.selectedSize || !product.sizes.includes(item.selectedSize)) {
                    return res.status(400).json({
                        ok: false,
                        msg: `Debe seleccionar una talla válida para ${product.name}`
                    });
                }
            }

            // Reducir stock
            const reqQty = item.quantity || 1;
            if (product.stock !== undefined) {
                product.stock -= reqQty;
                await product.save();
            }

            // Crear snapshot del producto
            const productSnapshot = {
                description: product.description
            };

            if (productModel === 'ClothingProduct') {
                productSnapshot.gender = product.gender;
                productSnapshot.fit = product.fit;
            } else {
                productSnapshot.dimensions = product.dimensions;
                productSnapshot.adjustable = product.adjustable;
            }

            const processedItem = {
                productId: product._id,
                productModel,
                name: product.name,
                price: product.salePrice || product.price,
                quantity: reqQty,
                selectedSize: item.selectedSize || null,
                image: product.images[0],
                productSnapshot
            };

            processedItems.push(processedItem);
            subtotal += processedItem.price * processedItem.quantity;
        }

        // Crear nueva orden
        const newOrder = new Order({
            userId,
            userInfo: {
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName
            },
            items: processedItems,
            subtotal,
            shippingAddress,
            shippingMethod,
            paymentInfo: {
                method: paymentInfo.method || 'credit_card',
                last4: paymentInfo.last4 || '0000',
                cardType: paymentInfo.cardType || 'Visa',
                transactionId: paymentInfo.transactionId || null
            }
        });

        // Calcular totales
        newOrder.calculateTotals();

        // Guardar orden
        const savedOrder = await newOrder.save();

        console.log(' Orden creada exitosamente:', savedOrder.orderNumber);

        res.status(201).json({
            ok: true,
            msg: 'Orden creada exitosamente',
            order: savedOrder
        });

    } catch (error) {
        console.error(' Error creando orden:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno del servidor',
            error: error.message
        });
    }
};

//  GET - Obtener órdenes del usuario
const getUserOrders = async (req = request, res = response) => {
    try {
        const userId = req.uid;
        const { page = 1, limit = 10, status } = req.query;

        console.log(' Obteniendo órdenes del usuario:', userId);

        const filters = { userId };
        if (status) {
            filters.status = status;
        }

        const skip = (page - 1) * limit;

        const orders = await Order.find(filters)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('items.productId', 'name images')
            .lean();

        const totalOrders = await Order.countDocuments(filters);

        res.status(200).json({
            ok: true,
            orders,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalOrders / limit),
                totalOrders,
                hasNextPage: skip + parseInt(limit) < totalOrders,
                hasPrevPage: parseInt(page) > 1
            }
        });

    } catch (error) {
        console.error(' Error obteniendo órdenes:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno del servidor'
        });
    }
};

//  GET - Obtener orden específica
const getOrder = async (req = request, res = response) => {
    try {
        const { orderId } = req.params;
        const userId = req.uid;
        const userRole = req.user.role;

        const order = await Order.findById(orderId)
            .populate('items.productId', 'name images')
            .lean();

        if (!order) {
            return res.status(404).json({
                ok: false,
                msg: 'Orden no encontrada'
            });
        }

        // Solo el propietario o admin pueden ver la orden
        if (order.userId.toString() !== userId && userRole !== 'admin') {
            return res.status(403).json({
                ok: false,
                msg: 'No tienes permisos para ver esta orden'
            });
        }

        res.status(200).json({
            ok: true,
            order
        });

    } catch (error) {
        console.error(' Error obteniendo orden:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno del servidor'
        });
    }
};

//  PUT - Cancelar orden (solo usuario)
const cancelOrder = async (req = request, res = response) => {
    try {
        const { orderId } = req.params;
        const userId = req.uid;

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({
                ok: false,
                msg: 'Orden no encontrada'
            });
        }

        if (order.userId.toString() !== userId) {
            return res.status(403).json({
                ok: false,
                msg: 'No tienes permisos para cancelar esta orden'
            });
        }

        if (!order.isCancellable) {
            return res.status(400).json({
                ok: false,
                msg: 'Esta orden ya no puede ser cancelada'
            });
        }

        order.status = 'cancelled';
        await order.save();

        console.log(' Orden cancelada:', order.orderNumber);

        res.status(200).json({
            ok: true,
            msg: 'Orden cancelada exitosamente',
            order
        });

    } catch (error) {
        console.error(' Error cancelando orden:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno del servidor'
        });
    }
};

//  GET - Obtener todas las órdenes (solo admin)
const getAllOrders = async (req = request, res = response) => {
    try {
        const { 
            page = 1, 
            limit = 20, 
            status, 
            orderNumber, 
            startDate, 
            endDate,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        console.log(' Admin obteniendo todas las órdenes');

        const filters = {};
        
        if (status) filters.status = status;
        if (orderNumber) filters.orderNumber = { $regex: orderNumber, $options: 'i' };
        
        if (startDate || endDate) {
            filters.createdAt = {};
            if (startDate) filters.createdAt.$gte = new Date(startDate);
            if (endDate) filters.createdAt.$lte = new Date(endDate);
        }

        const skip = (page - 1) * limit;
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        const orders = await Order.find(filters)
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit))
            .populate('userId', 'firstName lastName email')
            .lean();

        const totalOrders = await Order.countDocuments(filters);

        res.status(200).json({
            ok: true,
            orders,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalOrders / limit),
                totalOrders,
                hasNextPage: skip + parseInt(limit) < totalOrders,
                hasPrevPage: parseInt(page) > 1
            }
        });

    } catch (error) {
        console.error(' Error obteniendo todas las órdenes:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno del servidor'
        });
    }
};

//  PUT - Actualizar estado de orden (solo admin)
const updateOrderStatus = async (req = request, res = response) => {
    try {
        const { orderId } = req.params;
        const { status, trackingNumber, adminNotes } = req.body;

        console.log('Admin actualizando orden:', orderId);

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({
                ok: false,
                msg: 'Orden no encontrada'
            });
        }

        if (status && ['pending', 'processing', 'shipped', 'delivered', 'cancelled'].includes(status)) {
            order.status = status;
        }

        if (trackingNumber) {
            order.trackingNumber = trackingNumber;
        }

        if (adminNotes !== undefined) {
            order.adminNotes = adminNotes;
        }

        await order.save();

        console.log(' Orden actualizada:', order.orderNumber, '- Estado:', order.status);

        res.status(200).json({
            ok: true,
            msg: 'Orden actualizada exitosamente',
            order
        });

    } catch (error) {
        console.error(' Error actualizando orden:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno del servidor'
        });
    }
};

//  GET - Estadísticas de órdenes (solo admin)
const getOrderStats = async (req = request, res = response) => {
    try {
        console.log('Generando estadísticas de órdenes');

        const stats = await Order.aggregate([
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalRevenue: { $sum: '$total' },
                    averageOrderValue: { $avg: '$total' },
                    pendingOrders: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
                    processingOrders: { $sum: { $cond: [{ $eq: ['$status', 'processing'] }, 1, 0] } },
                    shippedOrders: { $sum: { $cond: [{ $eq: ['$status', 'shipped'] }, 1, 0] } },
                    deliveredOrders: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
                    cancelledOrders: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } }
                }
            }
        ]);

        // Órdenes por mes (últimos 6 meses)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const monthlyStats = await Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: sixMonthsAgo }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    orderCount: { $sum: 1 },
                    revenue: { $sum: '$total' }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1 }
            }
        ]);

        res.status(200).json({
            ok: true,
            stats: stats[0] || {
                totalOrders: 0,
                totalRevenue: 0,
                averageOrderValue: 0,
                pendingOrders: 0,
                processingOrders: 0,
                shippedOrders: 0,
                deliveredOrders: 0,
                cancelledOrders: 0
            },
            monthlyStats
        });

    } catch (error) {
        console.error(' Error generando estadísticas:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno del servidor'
        });
    }
};

module.exports = {
    createOrder,
    getUserOrders,
    getOrder,
    cancelOrder,
    getAllOrders,
    updateOrderStatus,
    getOrderStats
};