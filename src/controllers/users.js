const { response, request } = require('express');
const User = require('../models/user');

// GET - Obtener perfil del usuario
const getUserProfile = async (req = request, res = response) => {
    try {
        const userId = req.uid;
        console.log('Obteniendo perfil del usuario:', userId);
        
        const user = await User.findById(userId).select('-password');
        
        if (!user) {
            return res.status(404).json({
                ok: false,
                msg: 'Usuario no encontrado'
            });
        }

        console.log('Perfil encontrado:', user.email);
        console.log('Direcciones del usuario:', user.addresses.length);

        res.status(200).json({
            ok: true,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone || '',
                birthDate: user.birthDate,
                preferences: user.preferences,
                fullName: user.fullName,
                initials: user.initials,
                addresses: user.addresses || [],
                paymentMethods: user.paymentMethods || []
            }
        });

    } catch (error) {
        console.error('Error al obtener perfil:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno del servidor',
            error: error.message
        });
    }
};

// PUT - Actualizar perfil del usuario
const updateUserProfile = async (req = request, res = response) => {
    try {
        const userId = req.uid;
        const { firstName, lastName, phone, birthDate, preferences } = req.body;

        console.log('Actualizando perfil del usuario:', userId);

        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({
                ok: false,
                msg: 'Usuario no encontrado'
            });
        }

        if (firstName) user.firstName = firstName.trim();
        if (lastName) user.lastName = lastName.trim();
        if (phone !== undefined) user.phone = phone.trim();
        if (birthDate) user.birthDate = new Date(birthDate);
        if (preferences) {
            user.preferences = { ...user.preferences, ...preferences };
        }

        await user.save();
        console.log('Perfil actualizado exitosamente');

        res.status(200).json({
            ok: true,
            msg: 'Perfil actualizado exitosamente',
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                birthDate: user.birthDate,
                preferences: user.preferences,
                fullName: user.fullName,
                initials: user.initials
            }
        });

    } catch (error) {
        console.error('Error al actualizar perfil:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno del servidor',
            error: error.message
        });
    }
};

// POST - Añadir dirección
const addAddress = async (req = request, res = response) => {
    try {
        const userId = req.uid;
        const { name, address, city, state, zipCode, country, isDefault } = req.body;

        console.log('Anadiendo direccion para usuario:', userId);
        console.log('Datos recibidos:', { name, address, city, zipCode });

        if (!name || !address || !city || !zipCode) {
            return res.status(400).json({
                ok: false,
                msg: 'Campos requeridos: name, address, city, zipCode'
            });
        }

        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({
                ok: false,
                msg: 'Usuario no encontrado'
            });
        }

        // Si esta dirección será la predeterminada, desmarcar las demás
        if (isDefault) {
            user.addresses.forEach(addr => addr.isDefault = false);
        }

        // Si es la primera dirección, marcarla como predeterminada
        const isFirstAddress = user.addresses.length === 0;

        const newAddress = {
            name: name.trim(),
            address: address.trim(),
            city: city.trim(),
            state: state?.trim() || '',
            zipCode: zipCode.trim(),
            country: country?.trim() || 'España',
            isDefault: isDefault || isFirstAddress
        };

        user.addresses.push(newAddress);
        await user.save();

        console.log('Direccion anadida exitosamente');
        console.log('Total direcciones:', user.addresses.length);

        res.status(201).json({
            ok: true,
            msg: 'Dirección añadida exitosamente',
            addresses: user.addresses
        });

    } catch (error) {
        console.error('Error al anadir direccion:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno del servidor',
            error: error.message
        });
    }
};

// PUT - Actualizar dirección
const updateAddress = async (req = request, res = response) => {
    try {
        const userId = req.uid;
        const { addressId } = req.params;
        const { name, address, city, state, zipCode, country, isDefault } = req.body;

        console.log('Actualizando direccion:', addressId);

        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({
                ok: false,
                msg: 'Usuario no encontrado'
            });
        }

        const addressToUpdate = user.addresses.id(addressId);
        
        if (!addressToUpdate) {
            return res.status(404).json({
                ok: false,
                msg: 'Dirección no encontrada'
            });
        }

        // Si esta dirección será la predeterminada, desmarcar las demás
        if (isDefault) {
            user.addresses.forEach(addr => addr.isDefault = false);
        }

        // Actualizar campos
        if (name) addressToUpdate.name = name.trim();
        if (address) addressToUpdate.address = address.trim();
        if (city) addressToUpdate.city = city.trim();
        if (state !== undefined) addressToUpdate.state = state.trim();
        if (zipCode) addressToUpdate.zipCode = zipCode.trim();
        if (country) addressToUpdate.country = country.trim();
        if (isDefault !== undefined) addressToUpdate.isDefault = isDefault;

        await user.save();

        console.log('Direccion actualizada exitosamente');

        res.status(200).json({
            ok: true,
            msg: 'Dirección actualizada exitosamente',
            addresses: user.addresses
        });

    } catch (error) {
        console.error('Error al actualizar direccion:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno del servidor',
            error: error.message
        });
    }
};

// DELETE - Eliminar dirección
const deleteAddress = async (req = request, res = response) => {
    try {
        const userId = req.uid;
        const { addressId } = req.params;

        console.log('Eliminando direccion:', addressId);

        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({
                ok: false,
                msg: 'Usuario no encontrado'
            });
        }

        const addressToDelete = user.addresses.id(addressId);
        
        if (!addressToDelete) {
            return res.status(404).json({
                ok: false,
                msg: 'Dirección no encontrada'
            });
        }

        // No permitir eliminar la dirección predeterminada si hay otras
        if (addressToDelete.isDefault && user.addresses.length > 1) {
            return res.status(400).json({
                ok: false,
                msg: 'No puedes eliminar la dirección predeterminada. Primero marca otra como predeterminada.'
            });
        }

        user.addresses.pull(addressId);
        await user.save();

        console.log('Direccion eliminada exitosamente');

        res.status(200).json({
            ok: true,
            msg: 'Dirección eliminada exitosamente',
            addresses: user.addresses
        });

    } catch (error) {
        console.error('Error al eliminar direccion:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Métodos básicos para métodos de pago (simplificados)
const addPaymentMethod = async (req = request, res = response) => {
    res.status(501).json({
        ok: false,
        msg: 'Funcionalidad de métodos de pago no implementada aún'
    });
};

const deletePaymentMethod = async (req = request, res = response) => {
    res.status(501).json({
        ok: false,
        msg: 'Funcionalidad de métodos de pago no implementada aún'
    });
};

// Métodos de admin (simplificados)
const getAllUsers = async (req = request, res = response) => {
    res.status(501).json({
        ok: false,
        msg: 'Funcionalidad de admin no implementada aún'
    });
};

const updateUser = async (req = request, res = response) => {
    res.status(501).json({
        ok: false,
        msg: 'Funcionalidad de admin no implementada aún'
    });
};

const getUserStats = async (req = request, res = response) => {
    res.status(501).json({
        ok: false,
        msg: 'Funcionalidad de admin no implementada aún'
    });
};

module.exports = {
    getUserProfile,
    updateUserProfile,
    addAddress,
    updateAddress,
    deleteAddress,
    addPaymentMethod,
    deletePaymentMethod,
    getAllUsers,
    updateUser,
    getUserStats
};