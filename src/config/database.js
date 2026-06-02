const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        console.log(" Intentando conectar a MongoDB...");
        
        // CONEXIÓN DINÁMICA A MONGODB (LOCAL O REMOTO EN ATLAS)
        const dbUri = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/proyecto_db";
        const isAtlas = (process.env.MONGO_URI || process.env.MONGODB_URI) ? "MongoDB Atlas (Remoto)" : "MongoDB Local";
        
        console.log(` Intentando conectar a ${isAtlas}...`);
        await mongoose.connect(dbUri);
        
        console.log(" Conexión exitosa con MongoDB");
        
        // Inicializar datos si es necesario
        await initializeData();
        
    } catch (error) {
        console.error(" Error conectando a MongoDB:", error.message);
        console.log(" Asegúrate de que MongoDB esté corriendo:");
        console.log("   Windows: net start MongoDB");
        console.log("   Mac/Linux: sudo systemctl start mongod");
        process.exit(1);
    }
};

//  DATOS DE PRUEBA SIMPLIFICADOS
const initializeData = async () => {
    try {
        const { ClothingProduct, AccessoryProduct } = require('../models/product');
        const User = require('../models/user');
        
        // Asegurar que las colecciones e índices existen (creación explícita)
        try {
            await ClothingProduct.createCollection().catch(() => {});
            await AccessoryProduct.createCollection().catch(() => {});
            await User.createCollection().catch(() => {});

            // Crear índices declarados en los esquemas
            await User.createIndexes().catch(() => {});
            await ClothingProduct.createIndexes().catch(() => {});
            await AccessoryProduct.createIndexes().catch(() => {});

            console.log(" Colecciones e índices verificados/creados");
        } catch (err) {
            console.warn(" No se pudieron crear colecciones/índices:", err.message);
        }
        
        // Usuario admin
        const adminExists = await User.findOne({ role: 'admin' });
        if (!adminExists) {
            await User.create({
                username: 'admin',
                email: 'admin@gymstyle.com',
                password: 'admin123',
                firstName: 'Admin',
                lastName: 'GymStyle',
                role: 'admin'
            });
            console.log(" Usuario admin creado (admin@gymstyle.com / admin123)");
        }
        
    } catch (error) {
        console.error(" Error inicializando datos:", error.message);
    }
};

module.exports = connectDB;