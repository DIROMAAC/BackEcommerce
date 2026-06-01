const mongoose = require('mongoose');
const User = require('../models/user');
const { ClothingProduct, AccessoryProduct } = require('../models/product');
const Order = require('../models/order');

const dbUri = "mongodb://localhost:27017/proyecto_db";

async function testCheckout() {
    try {
        console.log("=== DIAGNÓSTICO DE CHECKOUT Y PERSISTENCIA ===");
        await mongoose.connect(dbUri);
        console.log("✅ Conectado a MongoDB");

        // 1. Obtener un usuario de prueba
        const user = await User.findOne();
        if (!user) {
            console.error("❌ No hay usuarios en la base de datos para probar");
            process.exit(1);
        }
        console.log(`👤 Usuario de prueba: ${user.firstName} ${user.lastName} (${user.email}) - ID: ${user._id}`);

        // 2. Obtener un producto de prueba
        let product = await ClothingProduct.findOne();
        let productModel = 'ClothingProduct';
        if (!product) {
            product = await AccessoryProduct.findOne();
            productModel = 'AccessoryProduct';
        }

        if (!product) {
            console.error("❌ No hay productos en la base de datos para probar");
            process.exit(1);
        }
        console.log(`📦 Producto de prueba: ${product.name} - Stock: ${product.stock} - ID: ${product._id} - Modelo: ${productModel}`);

        // 3. Simular cuerpo de la petición de Checkout
        const reqBody = {
            items: [
                {
                    productId: product._id.toString(),
                    quantity: 1,
                    selectedSize: productModel === 'ClothingProduct' ? (product.sizes[0] || 'M') : undefined,
                    unitPrice: product.salePrice || product.price
                }
            ],
            shippingAddress: {
                name: 'Diego Maldonado',
                address: 'Calle Falsa 123',
                city: 'San Luis Potosí',
                state: 'SLP',
                zipCode: '78200',
                country: 'México',
                phone: '4441234567'
            },
            paymentInfo: {
                method: 'credit_card',
                last4: '1234',
                cardType: 'Visa',
                transactionId: 'TXN_TEST_123'
            },
            shippingMethod: 'standard'
        };

        console.log("\n🧪 Simulando creación de orden...");
        
        // Ejecutar los mismos pasos del controlador createOrder
        const { items, shippingAddress, paymentInfo, shippingMethod = 'standard' } = reqBody;
        
        // Procesar items
        const processedItems = [];
        let subtotal = 0;

        for (const item of items) {
            let prod = await ClothingProduct.findById(item.productId);
            let prodModel = 'ClothingProduct';
            if (!prod) {
                prod = await AccessoryProduct.findById(item.productId);
                prodModel = 'AccessoryProduct';
            }

            const processedItem = {
                productId: prod._id,
                productModel: prodModel,
                name: prod.name,
                price: prod.salePrice || prod.price,
                quantity: item.quantity || 1,
                selectedSize: item.selectedSize || null,
                image: prod.images[0] || 'https://via.placeholder.com/150',
                productSnapshot: {
                    description: prod.description
                }
            };
            processedItems.push(processedItem);
            subtotal += processedItem.price * processedItem.quantity;
        }

        console.log("  - Items procesados correctamente");

        // Crear instancia de la orden
        const newOrder = new Order({
            userId: user._id,
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
        console.log("  - Totales calculados:", newOrder.total);

        // Intentar guardar
        console.log("💾 Intentando guardar la orden en la base de datos...");
        const savedOrder = await newOrder.save();
        console.log(`🎉 ¡ÉXITO! Orden guardada correctamente con número: ${savedOrder.orderNumber}`);

    } catch (error) {
        console.error("\n❌ ERROR DETECTADO AL GUARDAR LA ORDEN:");
        console.error(error);
        if (error.errors) {
            console.error("\n🔍 DETALLE DE ERRORES DE VALIDACIÓN DE MONGOOSE:");
            Object.keys(error.errors).forEach(key => {
                console.error(`  - Campo '${key}': ${error.errors[key].message}`);
            });
        }
    } finally {
        await mongoose.disconnect();
        console.log("\n🔌 Desconectado de MongoDB.");
        process.exit(0);
    }
}

testCheckout();
