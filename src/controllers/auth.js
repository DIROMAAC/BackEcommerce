const { response, request } = require('express');
const User = require("../models/user");
const bcrypt = require("bcrypt");
const jwt = require('jsonwebtoken');

// Función helper para generar JWT
const generateJWT = (uid, username, role) => {
    return new Promise((resolve, reject) => {
        const payload = { uid, username, role };
        
        jwt.sign(payload, process.env.SECRET_KEY, {
            expiresIn: '7d' // ✅ Sesión extendida a 7 días reales (era '160000' ms = 2 min y 40 seg)
        }, (err, token) => {
            if (err) {
                console.log(err);
                reject('No se pudo generar el token');
            } else {
                resolve(token);
            }
        });
    });
};

const login = async (req = request, res = response) => {
    try {
        const { email, password } = req.body;
        
        // Validar datos de entrada
        if (!email || !password) {
            return res.status(400).json({
                ok: false,
                msg: "Email y contraseña son requeridos"
            });
        }

        // Buscar usuario por email
        const user = await User.findOne({ email: email.toLowerCase() });
        
        if (!user) {
            return res.status(401).json({
                ok: false,
                msg: "Credenciales inválidas"
            });
        }

        // Verificar si el usuario está activo
        if (!user.isActive) {
            return res.status(401).json({
                ok: false,
                msg: "Cuenta desactivada. Contacta al administrador"
            });
        }

        // Verificar contraseña
        const validPassword = await user.comparePassword(password);

        if (!validPassword) {
            return res.status(401).json({
                ok: false,
                msg: "Credenciales inválidas"
            });
        }

        // Actualizar último login
        user.lastLogin = new Date();
        await user.save();

        // Generar JWT
        const token = await generateJWT(user._id, user.username, user.role);

        res.status(200).json({
            ok: true,
            msg: "Login exitoso",
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                fullName: user.fullName,
                initials: user.initials
            },
            token
        });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({
            ok: false,
            msg: "Error interno del servidor"
        });
    }
};

const register = async (req = request, res = response) => {
    try {
        const { 
            username, 
            email, 
            password, 
            firstName, 
            lastName, 
            phone,
            birthDate 
        } = req.body;

        // Validar campos requeridos
        if (!username || !email || !password || !firstName || !lastName) {
            return res.status(400).json({
                ok: false,
                msg: "Todos los campos son requeridos"
            });
        }

        // Validar formato de email
        const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                ok: false,
                msg: "Formato de email inválido"
            });
        }

        // Validar longitud de contraseña
        if (password.length < 6) {
            return res.status(400).json({
                ok: false,
                msg: "La contraseña debe tener al menos 6 caracteres"
            });
        }

        // Verificar si el usuario ya existe (por email o username)
        const existingUser = await User.findOne({
            $or: [
                { email: email.toLowerCase() },
                { username: username.toLowerCase() }
            ]
        });

        if (existingUser) {
            const field = existingUser.email === email.toLowerCase() ? 'email' : 'username';
            return res.status(400).json({
                ok: false,
                msg: `Ya existe un usuario con ese ${field}`
            });
        }

        // Crear nuevo usuario
        const newUser = new User({
            username: username.toLowerCase(),
            email: email.toLowerCase(),
            password, // El middleware pre-save se encarga del hashing
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phone: phone?.trim() || '',
            birthDate: birthDate ? new Date(birthDate) : null,
            role: 'user'
        });

        await newUser.save();

        // Generar token para login automático
        const token = await generateJWT(newUser._id, newUser.username, newUser.role);

        res.status(201).json({
            ok: true,
            msg: "Usuario registrado exitosamente",
            user: {
                id: newUser._id,
                username: newUser.username,
                email: newUser.email,
                firstName: newUser.firstName,
                lastName: newUser.lastName,
                role: newUser.role,
                fullName: newUser.fullName,
                initials: newUser.initials
            },
            token
        });

    } catch (error) {
        console.error('Error en registro:', error);

        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                ok: false,
                msg: "Error de validación",
                errors
            });
        }

        res.status(500).json({
            ok: false,
            msg: "Error interno del servidor"
        });
    }
};

// Renovar token
const renewToken = async (req = request, res = response) => {
    try {
        const { uid, user } = req;

        // Generar nuevo token
        const token = await generateJWT(uid, user.username, user.role);

        res.status(200).json({
            ok: true,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                fullName: user.fullName,
                initials: user.initials
            },
            token
        });

    } catch (error) {
        console.error('Error al renovar token:', error);
        res.status(500).json({
            ok: false,
            msg: "Error interno del servidor"
        });
    }
};

// Verificar token (middleware endpoint)
const verifyToken = async (req = request, res = response) => {
    const { user } = req;

    res.status(200).json({
        ok: true,
        user: {
            id: user._id,
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            fullName: user.fullName,
            initials: user.initials
        }
    });
};

// Cambiar contraseña
const changePassword = async (req = request, res = response) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const { user } = req;

        // Validar datos
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                ok: false,
                msg: "Contraseña actual y nueva son requeridas"
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                ok: false,
                msg: "La nueva contraseña debe tener al menos 6 caracteres"
            });
        }

        // Verificar contraseña actual
        const validPassword = await user.comparePassword(currentPassword);
        if (!validPassword) {
            return res.status(400).json({
                ok: false,
                msg: "Contraseña actual incorrecta"
            });
        }

        // Actualizar contraseña
        user.password = newPassword;
        await user.save();

        res.status(200).json({
            ok: true,
            msg: "Contraseña actualizada exitosamente"
        });

    } catch (error) {
        console.error('Error al cambiar contraseña:', error);
        res.status(500).json({
            ok: false,
            msg: "Error interno del servidor"
        });
    }
};

// Solicitar reset de contraseña (placeholder para futuras implementaciones)
const requestPasswordReset = async (req = request, res = response) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                ok: false,
                msg: "Email es requerido"
            });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        
        if (!user) {
            // Por seguridad, siempre respondemos igual
            return res.status(200).json({
                ok: true,
                msg: "Si el email existe, recibirás instrucciones para restablecer tu contraseña"
            });
        }

        // Aquí implementaría el envío de email con token de reset
        // Por ahora solo enviamos respuesta genérica
        
        res.status(200).json({
            ok: true,
            msg: "Si el email existe, recibirás instrucciones para restablecer tu contraseña"
        });

    } catch (error) {
        console.error('Error en solicitud de reset:', error);
        res.status(500).json({
            ok: false,
            msg: "Error interno del servidor"
        });
    }
};

module.exports = {
    login,
    register,
    renewToken,
    verifyToken,
    changePassword,
    requestPasswordReset
};