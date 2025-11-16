const Trip = require('../models/Trip');
const DriverProfile = require('../models/DriverProfile');

/**
 * Lista todas as viagens (coletas, entregas, retornos, pausas) de um motorista
 * GET /api/admin/drivers/:driverId/trips
 */
exports.getDriverTripsHistory = async (req, res) => {
  try {
    const { driverId } = req.params;
    const { startDate, endDate } = req.query;

    // Buscar o DriverProfile pelo ID
    const driverProfile = await DriverProfile.findById(driverId);
    if (!driverProfile) {
      return res.status(404).json({ message: 'Motorista não encontrado' });
    }

    const query = { driver: driverId };

    // Filtro por data (opcional)
    if (startDate || endDate) {
      query.startedAt = {};
      if (startDate) query.startedAt.$gte = new Date(startDate);
      if (endDate) query.startedAt.$lte = new Date(endDate);
    }

    const trips = await Trip.find(query)
      .sort({ startedAt: -1 })
      .populate({ path: 'order', select: 'client_name service_type price' })
      .lean();

    res.json({ trips });
  } catch (error) {
    console.error('Erro ao buscar histórico de viagens:', error);
    res.status(500).json({ message: 'Erro ao buscar histórico de viagens' });
  }
};

/**
 * Detalhes completos de uma viagem (incluindo todas as posições GPS)
 * GET /api/admin/trips/:tripId
 */
exports.getTripDetails = async (req, res) => {
  try {
    const { tripId } = req.params;

    const trip = await Trip.findById(tripId)
      .populate({
        path: 'driver',
        populate: { path: 'user', select: 'nome telefone email' }
      })
      .populate({ path: 'order', select: 'client_name service_type price pickup_address delivery_address' });

    if (!trip) {
      return res.status(404).json({ message: 'Viagem não encontrada' });
    }

    res.json({ trip });
  } catch (error) {
    console.error('Erro ao buscar detalhes da viagem:', error);
    res.status(500).json({ message: 'Erro ao buscar detalhes da viagem' });
  }
};