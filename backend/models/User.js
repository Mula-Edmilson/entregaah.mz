// Ficheiro: backend/models/User.js (Atualizado)
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    telefone: { type: String, required: true },
    password: { type: String, required: true },
    role: {
        type: String,
        enum: ['admin', 'driver'],
        required: true
    }
}, {
    // Estas opções são importantes para o campo virtual funcionar
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// --- (NOVA ADIÇÃO) ---
// Cria um campo "virtual" chamado 'profile'
// Ele liga o 'localField' (o _id deste User) ao 'foreignField' (o campo 'user' no DriverProfile)
userSchema.virtual('profile', {
    ref: 'DriverProfile',
    localField: '_id',
    foreignField: 'user',
    justOne: true // Só queremos um perfil por utilizador
});
// ----------------------

const User = mongoose.model('User', userSchema);
module.exports = User;