require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const connectDB = require('../config/db');
const User = require('../models/User');
const DriverProfile = require('../models/DriverProfile');
const Client = require('../models/Client');
const Order = require('../models/Order');
const CompanyCost = require('../models/CompanyCost');
const { ORDER_STATUS, DRIVER_STATUS } = require('../utils/constants');

async function run() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI em falta no .env');
  if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'seed-only-secret';

  await connectDB();

  await Promise.all([
    Order.deleteMany({}),
    CompanyCost.deleteMany({}),
    Client.deleteMany({}),
    DriverProfile.deleteMany({}),
    User.deleteMany({})
  ]);

  const [adminPassword, driverPassword, managerPassword] = await Promise.all([
    bcrypt.hash('admin123', 12),
    bcrypt.hash('driver123', 12),
    bcrypt.hash('gestor123', 12)
  ]);

  const admin = await User.create({
    nome: 'Admin Entregaah',
    email: 'admin@entregaah.co.mz',
    telefone: '+258840000001',
    password: adminPassword,
    role: 'admin'
  });

  await User.create({
    nome: 'Gestor Demo',
    email: 'gestor@entregaah.co.mz',
    telefone: '+258840000002',
    password: managerPassword,
    role: 'manager'
  });

  const driverUsers = await User.insertMany([
    { nome: 'Carlos Nhantumbo', email: 'carlos@entregaah.co.mz', telefone: '+258840000003', password: driverPassword, role: 'driver' },
    { nome: 'Ana Chissano', email: 'ana@entregaah.co.mz', telefone: '+258840000004', password: driverPassword, role: 'driver' }
  ]);

  const driverProfiles = await DriverProfile.insertMany([
    { user: driverUsers[0]._id, vehicle_plate: 'MZ-01-ED', status: DRIVER_STATUS.ONLINE_FREE, commissionRate: 20, lastLocation: { lat: -25.9653, lng: 32.5892, updatedAt: new Date() } },
    { user: driverUsers[1]._id, vehicle_plate: 'MZ-02-AH', status: DRIVER_STATUS.OFFLINE, commissionRate: 25 }
  ]);

  const clients = await Client.insertMany([
    { nome: 'Maningue Nice', telefone: '+258840000101', email: 'compras@maninguenice.co.mz', empresa: 'Maningue Nice', nuit: '400000001', endereco: 'Av. Josina Machel, Maputo', created_by_admin: admin._id },
    { nome: 'Print Palette', telefone: '+258840000102', email: 'geral@printpalette.co.mz', empresa: 'Print Palette', nuit: '400000002', endereco: 'Baixa, Maputo', created_by_admin: admin._id },
    { nome: 'Cliente Particular', telefone: '+258840000103', email: '', empresa: '', nuit: '', endereco: 'Matola', created_by_admin: admin._id }
  ]);

  const now = new Date();
  await Order.insertMany([
    {
      service_type: 'rapido', price: 350, client_name: clients[0].nome, client_phone1: clients[0].telefone,
      address_text: 'Nifiquile Energia, Maputo', address_coords: { lat: -25.962, lng: 32.583 },
      verification_code: 'A1B2C', created_by_admin: admin._id, client: clients[0]._id,
      status: ORDER_STATUS.PENDING, payment_method: 'mpesa'
    },
    {
      service_type: 'doc', price: 500, client_name: clients[1].nome, client_phone1: clients[1].telefone,
      address_text: 'Centro da Cidade', address_coords: { lat: -25.969, lng: 32.573 },
      verification_code: 'D0C25', created_by_admin: admin._id, client: clients[1]._id,
      assigned_to_driver: driverProfiles[0]._id, status: ORDER_STATUS.ASSIGNED, payment_method: 'cash'
    },
    {
      service_type: 'carga', price: 1200, client_name: clients[2].nome, client_phone1: clients[2].telefone,
      address_text: 'Matola Gare', address_coords: { lat: -25.834, lng: 32.459 },
      verification_code: 'X9Z88', created_by_admin: admin._id, client: clients[2]._id,
      assigned_to_driver: driverProfiles[0]._id, status: ORDER_STATUS.COMPLETED,
      timestamp_started: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      timestamp_completed: now, deliveryCompletedAt: now,
      valor_motorista: 240, valor_empresa: 960, payment_method: 'bank_transfer'
    }
  ]);

  await CompanyCost.insertMany([
    { category: 'combustivel', amount: 800, description: 'Combustível semanal', date: now, createdBy: admin._id, assignedUser: driverUsers[0]._id },
    { category: 'marketing', amount: 1500, description: 'Campanha digital', date: now, createdBy: admin._id },
    { category: 'manutencao', amount: 600, description: 'Manutenção de mota', date: now, createdBy: admin._id, assignedUser: driverUsers[1]._id }
  ]);

  console.log('Seed demo concluído.');
  console.table([
    { perfil: 'Admin', email: 'admin@entregaah.co.mz', senha: 'admin123' },
    { perfil: 'Motorista', email: 'carlos@entregaah.co.mz', senha: 'driver123' },
    { perfil: 'Gestor', email: 'gestor@entregaah.co.mz', senha: 'gestor123' }
  ]);

  await mongoose.connection.close();
}

run().catch(async (error) => {
  console.error(error);
  if (mongoose.connection.readyState) await mongoose.connection.close();
  process.exit(1);
});
