const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const addressSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    address: {
        type: String,
        required: true,
        trim: true
    },
    city: {
        type: String,
        required: true,
        trim: true
    },
    state: {
        type: String,
        trim: true
    },
    zipCode: {
        type: String,
        required: true,
        trim: true
    },
    country: {
        type: String,
        required: true,
        trim: true,
        default: 'España'
    },
    isDefault: {
        type: Boolean,
        default: false
    }
});

const paymentMethodSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['Visa', 'Mastercard', 'American Express'],
        required: true
    },
    last4: {
        type: String,
        required: true,
        length: 4
    },
    expiryMonth: {
        type: Number,
        required: true,
        min: 1,
        max: 12
    },
    expiryYear: {
        type: Number,
        required: true,
        min: new Date().getFullYear()
    },
    cardholderName: {
        type: String,
        required: true,
        trim: true
    },
    isDefault: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const userSchema = new mongoose.Schema({
    // Información básica de autenticación
    username: {
        type: String,
        required: [true, 'El nombre de usuario es requerido'],
        unique: true, 
        trim: true,
        minlength: [3, 'El nombre de usuario debe tener al menos 3 caracteres']
    },
    email: {
        type: String,
        required: [true, 'El email es requerido'],
        unique: true, 
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Email inválido']
    },
    password: {
        type: String,
        required: [true, 'La contraseña es requerida'],
        minlength: [6, 'La contraseña debe tener al menos 6 caracteres']
    },
    
    // Información personal
    firstName: {
        type: String,
        required: [true, 'El nombre es requerido'],
        trim: true
    },
    lastName: {
        type: String,
        required: [true, 'El apellido es requerido'],
        trim: true
    },
    phone: {
        type: String,
        trim: true,
        default: ''
    },
    birthDate: {
        type: Date,
        default: null
    },
    
    // Rol del usuario
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    
    // Direcciones guardadas
    addresses: [addressSchema],
    
    // Métodos de pago guardados
    paymentMethods: [paymentMethodSchema],
    
    // Preferencias del usuario
    preferences: {
        emailMarketing: {
            type: Boolean,
            default: true
        },
        orderUpdates: {
            type: Boolean,
            default: true
        },
        newArrivals: {
            type: Boolean,
            default: false
        },
        newsletter: {
            type: Boolean,
            default: false
        }
    },
    
    // Información de la cuenta
    isActive: {
        type: Boolean,
        default: true
    },
    emailVerified: {
        type: Boolean,
        default: false
    },
    lastLogin: {
        type: Date,
        default: null
    },
    
    // Estadísticas del usuario
    totalOrders: {
        type: Number,
        default: 0
    },
    totalSpent: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});


userSchema.index({ role: 1 });

// Middleware pre-save para hashear contraseña
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Método para comparar contraseñas
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Método para obtener la dirección predeterminada
userSchema.methods.getDefaultAddress = function() {
    return this.addresses.find(addr => addr.isDefault) || this.addresses[0] || null;
};

// Método para obtener el método de pago predeterminado
userSchema.methods.getDefaultPaymentMethod = function() {
    return this.paymentMethods.find(payment => payment.isDefault) || this.paymentMethods[0] || null;
};

userSchema.virtual('fullName').get(function() {
    return `${this.firstName} ${this.lastName}`;
});

// Virtual para initials (para avatar)
userSchema.virtual('initials').get(function() {
    return `${this.firstName.charAt(0)}${this.lastName.charAt(0)}`.toUpperCase();
});

// Asegurar que los virtuals se incluyan en JSON
userSchema.set('toJSON', { 
    virtuals: true,
    transform: function(doc, ret) {
        delete ret.password;
        return ret;
    }
});

module.exports = mongoose.model("User", userSchema);