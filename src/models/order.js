const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'items.productModel'
    },
    productModel: {
        type: String,
        required: true,
        enum: ['ClothingProduct', 'AccessoryProduct']
    },
    name: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    selectedSize: {
        type: String,
        default: null // Solo para productos de ropa
    },
    image: {
        type: String,
        required: true
    },
    // Snapshot de datos del producto al momento de la compra
    productSnapshot: {
        description: String,
        gender: String, // Para ropa
        fit: String, // Para ropa
        dimensions: String, // Para accesorios
        adjustable: Boolean // Para accesorios
    }
});

const shippingAddressSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    },
    city: {
        type: String,
        required: true
    },
    state: {
        type: String,
        default: ''
    },
    zipCode: {
        type: String,
        required: true
    },
    country: {
        type: String,
        required: true,
        default: 'España'
    },
    phone: {
        type: String,
        default: ''
    }
});

const paymentInfoSchema = new mongoose.Schema({
    method: {
        type: String,
        enum: ['credit_card', 'debit_card', 'paypal', 'bank_transfer'],
        default: 'credit_card'
    },
    last4: {
        type: String,
        length: 4
    },
    cardType: {
        type: String,
        enum: ['Visa', 'Mastercard', 'American Express'],
        default: 'Visa'
    },
    transactionId: {
        type: String,
        default: null
    }
});

const orderSchema = new mongoose.Schema({
    // Información del usuario
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    userInfo: {
        email: {
            type: String,
            required: true
        },
        firstName: {
            type: String,
            required: true
        },
        lastName: {
            type: String,
            required: true
        }
    },
    
    // Número de orden único
    orderNumber: {
        type: String,
        unique: true,
        required: true
    },
    
    // Estado de la orden
    status: {
        type: String,
        enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
        default: 'pending'
    },
    
    // Items de la orden
    items: [orderItemSchema],
    
    // Cálculos de precio
    subtotal: {
        type: Number,
        required: true,
        min: 0
    },
    shipping: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    tax: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    total: {
        type: Number,
        required: true,
        min: 0
    },
    
    // Información de envío
    shippingAddress: {
        type: shippingAddressSchema,
        required: true
    },
    shippingMethod: {
        type: String,
        enum: ['standard', 'express', 'overnight'],
        default: 'standard'
    },
    
    // Información de pago
    paymentInfo: {
        type: paymentInfoSchema,
        required: true
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded'],
        default: 'pending'
    },
    
    // Seguimiento
    trackingNumber: {
        type: String,
        default: null
    },
    estimatedDelivery: {
        type: Date,
        default: null
    },
    
    // Fechas importantes
    orderDate: {
        type: Date,
        default: Date.now
    },
    shippedDate: {
        type: Date,
        default: null
    },
    deliveredDate: {
        type: Date,
        default: null
    },
    
    // Notas administrativas
    adminNotes: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

// Índices para mejorar rendimiento
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });

// Middleware para generar número de orden único antes de la validación
orderSchema.pre('validate', async function(next) {
    if (this.isNew && !this.orderNumber) {
        const timestamp = Date.now().toString();
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        this.orderNumber = `GS${timestamp.slice(-8)}${random}`;
    }
    
    // Calcular fechas estimadas
    if (this.isModified('status') && this.status === 'shipped' && !this.shippedDate) {
        this.shippedDate = new Date();
        
        // Calcular fecha estimada de entrega según método de envío
        const deliveryDays = {
            'standard': 5,
            'express': 2,
            'overnight': 1
        };
        
        const estimatedDays = deliveryDays[this.shippingMethod] || 5;
        this.estimatedDelivery = new Date(Date.now() + (estimatedDays * 24 * 60 * 60 * 1000));
    }
    
    // Marcar fecha de entrega
    if (this.isModified('status') && this.status === 'delivered' && !this.deliveredDate) {
        this.deliveredDate = new Date();
    }
    
    next();
});

// Métodos virtuales
orderSchema.virtual('totalItems').get(function() {
    return this.items.reduce((total, item) => total + item.quantity, 0);
});

orderSchema.virtual('isDelivered').get(function() {
    return this.status === 'delivered';
});

orderSchema.virtual('isCancellable').get(function() {
    return ['pending', 'processing'].includes(this.status);
});

// Método para calcular totales
orderSchema.methods.calculateTotals = function() {
    this.subtotal = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Envío gratuito para pedidos > 100€
    this.shipping = this.subtotal >= 100 ? 0 : 5.99;
    
    // IVA del 21% en España
    this.tax = this.subtotal * 0.21;
    
    this.total = this.subtotal + this.shipping + this.tax;
};

// Asegurar que los virtuals se incluyan en JSON
orderSchema.set('toJSON', { 
    virtuals: true,
    transform: function(doc, ret) {
        delete ret.__v;
        return ret;
    }
});

module.exports = mongoose.model("Order", orderSchema);