const express = require("express");
const cors = require("cors");
const path = require("path");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const connectDB = require("./database");

class Server {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 8080;

        this.authPath = "/api/auth";
        this.usersPath = "/api/users";
        this.productsPath = "/api/products";
        this.ordersPath = "/api/orders"; 

        this.connectDatabase();
        this.middlewares();
        this.routes();
    }

    async connectDatabase() {
        await connectDB();
    }

    middlewares() {
        // Cabeceras de seguridad HTTP estándar
        this.app.use(helmet());

        // Sanitización global contra inyecciones NoSQL
        this.app.use(mongoSanitize());

        const allowedOrigins = [
            'http://localhost:4200',
            'http://127.0.0.1:4200'
        ];
        if (process.env.FRONTEND_URL) {
            allowedOrigins.push(process.env.FRONTEND_URL);
        }

        this.app.use(cors({
            origin: (origin, callback) => {
                // Permitir peticiones sin origen (como Postman o Server-to-Server)
                if (!origin) return callback(null, true);
                
                const isAllowed = allowedOrigins.includes(origin) || 
                                  origin.startsWith('http://localhost:') || 
                                  origin.endsWith('.vercel.app');
                                  
                if (isAllowed) {
                    callback(null, true);
                } else {
                    callback(new Error('No permitido por CORS'));
                }
            },
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: [
                'Content-Type', 
                'Authorization', 
                'x-auth-token',
                'Access-Control-Allow-Origin'
            ]
        }));

        this.app.options('*', (req, res) => {
            const origin = req.headers.origin;
            const isAllowed = origin && (
                allowedOrigins.includes(origin) || 
                origin.startsWith('http://localhost:') || 
                origin.endsWith('.vercel.app')
            );
            
            if (isAllowed) {
                res.header('Access-Control-Allow-Origin', origin);
            } else {
                res.header('Access-Control-Allow-Origin', 'http://localhost:4200');
            }
            res.header('Access-Control-Allow-Credentials', 'true');
            res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-auth-token');
            res.sendStatus(200);
        });

        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        this.app.use((req, res, next) => {
            console.log(`${req.method} ${req.path} - ${new Date().toLocaleTimeString()}`);
            next();
        });
    }

    routes() {
        // Ruta de prueba principal
        this.app.get('/', (req, res) => {
            res.json({
                ok: true,
                msg: 'GymStyle API funcionando',
                timestamp: new Date().toISOString(),
                endpoints: {
                    auth: '/api/auth',
                    products: '/api/products',
                    users: '/api/users',
                    orders: '/api/orders'
                }
            });
        });

        const routesPath = path.join(__dirname, '../routes');
        
        //  CARGAR RUTAS CON VERIFICACIÓN DE EXISTENCIA
        this.loadRoute('auth', this.authPath, routesPath);
        this.loadRoute('users', this.usersPath, routesPath); 
        this.loadRoute('products', this.productsPath, routesPath);
        this.loadRoute('orders', this.ordersPath, routesPath); 

        // Rutas de prueba
        this.app.get('/api/test', (req, res) => {
            res.json({
                ok: true,
                msg: 'Ruta de prueba funcionando',
                timestamp: new Date().toISOString()
            });
        });

        this.app.get('/api/status', (req, res) => {
            res.json({
                ok: true,
                status: 'running',
                uptime: process.uptime(),
                timestamp: new Date().toISOString()
            });
        });

        // Middleware de manejo de errores
        this.app.use((err, req, res, next) => {
            console.error(' Error:', err);
            res.status(500).json({
                ok: false,
                msg: 'Error interno del servidor'
            });
        });

        // 404 para rutas no encontradas
        this.app.use('*', (req, res) => {
            res.status(404).json({
                ok: false,
                msg: `Endpoint ${req.originalUrl} no encontrado`
            });
        });
    }

    //  MÉTODO HELPER PARA CARGAR RUTAS CON VERIFICACIÓN
    loadRoute(routeName, routePath, basePath) {
        try {
            const fs = require('fs');
            const fullPath = path.join(basePath, `${routeName}.js`);
            
            // Verificar si el archivo existe
            if (fs.existsSync(fullPath)) {
                this.app.use(routePath, require(fullPath));
                console.log(` Rutas de ${routeName} cargadas`);
            } else {
                console.warn(` Archivo de rutas no encontrado: ${fullPath}`);
                console.log(` Creando ruta básica para ${routePath}`);
                
                // Crear ruta básica si no existe el archivo
                this.app.use(routePath, (req, res) => {
                    res.status(501).json({
                        ok: false,
                        msg: `Funcionalidad de ${routeName} no implementada aún`,
                        path: req.originalUrl
                    });
                });
            }
        } catch (error) {
            console.error(` Error cargando rutas de ${routeName}:`, error.message);
            
            // Crear ruta de fallback
            this.app.use(routePath, (req, res) => {
                res.status(500).json({
                    ok: false,
                    msg: `Error en el módulo de ${routeName}`,
                    error: error.message
                });
            });
        }
    }

    listen() {
        this.app.listen(this.port, () => {
            console.log(' ===== SERVIDOR INICIADO =====');
            console.log(` Puerto: ${this.port}`);
            console.log(` URL: http://localhost:${this.port}`);
            console.log(` Base de datos: proyecto_db`);
            console.log(' Endpoints disponibles:');
            console.log(`   GET  / - API Status`);
            console.log(`   POST ${this.authPath}/login - Login`);
            console.log(`   POST ${this.authPath}/register - Register`);
            console.log(`   GET  ${this.productsPath} - Obtener productos`);
            console.log(`   POST ${this.ordersPath} - Crear orden`);
            console.log(`   GET  ${this.ordersPath} - Obtener órdenes`);
            console.log('================================');
        });
    }
}

module.exports = Server;