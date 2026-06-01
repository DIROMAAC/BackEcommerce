const mongoose = require("mongoose");

// Schema base para productos
const productBaseSchema = {
    name: {
        type: String,
        required: [true, 'El nombre del producto es requerido'],
        trim: true
    },
    price: {
        type: Number,
        required: [true, 'El precio es requerido'],
        min: [0, 'El precio debe ser mayor a 0']
    },
    salePrice: {
        type: Number,
        min: [0, 'El precio de oferta debe ser mayor a 0'],
        default: null
    },
    description: {
        type: String,
        required: [true, 'La descripción es requerida'],
        trim: true
    },
    images: [{
        type: String,
        required: true
    }],
    rating: {
        type: Number,
        min: [1, 'Rating mínimo es 1'],
        max: [10, 'Rating máximo es 10'],
        default: 5.0
    },
    reviewCount: {
        type: Number,
        min: [0, 'El número de reseñas no puede ser negativo'],
        default: 0
    },
    stock: {
        type: Number,
        default: 10,
        min: [0, 'El stock no puede ser negativo']
    },
    // Campo para distinguir el tipo de producto
    productType: {
        type: String,
        enum: ['clothing', 'accessory'],
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
};

// Schema específico para ropa
const clothingSchema = new mongoose.Schema({
    ...productBaseSchema,
    productType: {
        type: String,
        default: 'clothing'
    },
    gender: {
        type: String,
        enum: ['men', 'women'],
        required: [true, 'El género es requerido para productos de ropa']
    },
    sizes: [{
        type: String,
        required: true
    }],
    fit: {
        type: String,
        enum: ['Regular', 'Slim', 'Compression', 'Oversized'],
        default: 'Regular'
    }
});

// Schema específico para accesorios
const accessorySchema = new mongoose.Schema({
    ...productBaseSchema,
    productType: {
        type: String,
        default: 'accessory'
    },
    dimensions: {
        type: String,
        default: null
    },
    adjustable: {
        type: Boolean,
        default: false
    }
});

// Middleware para actualizar updatedAt
clothingSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

accessorySchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Métodos virtuales para precio efectivo e inStock
clothingSchema.virtual('effectivePrice').get(function() {
    return this.salePrice || this.price;
});
clothingSchema.virtual('inStock').get(function() {
    return this.stock > 0;
});

accessorySchema.virtual('effectivePrice').get(function() {
    return this.salePrice || this.price;
});
accessorySchema.virtual('inStock').get(function() {
    return this.stock > 0;
});

// Asegurar que los virtuals se incluyan en JSON y Objetos
clothingSchema.set('toJSON', { virtuals: true });
clothingSchema.set('toObject', { virtuals: true });
accessorySchema.set('toJSON', { virtuals: true });
accessorySchema.set('toObject', { virtuals: true });

// Exportar ambos modelos
const ClothingProduct = mongoose.model('ClothingProduct', clothingSchema);
const AccessoryProduct = mongoose.model('AccessoryProduct', accessorySchema);

module.exports = {
    ClothingProduct,
    AccessoryProduct
};