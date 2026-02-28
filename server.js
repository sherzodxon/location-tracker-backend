const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { dbQuery, initializeDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Bazani ishga tushirish
initializeDatabase().catch(err => {
  console.error('Database initialization failed:', err);
  process.exit(1);
});

// API Endpoints

// 1. Joylashuvni saqlash (Tracker ilova uchun)
app.post('/api/location', async (req, res) => {
  try {
    const { user_name, latitude, longitude, device_info } = req.body;

    // Validatsiya
    if (!latitude || !longitude) {
      return res.status(400).json({ 
        success: false, 
        message: 'Latitude va longitude majburiy!' 
      });
    }

    // Ma'lumotni saqlash
    const query = `
      INSERT INTO user_locations (user_name, latitude, longitude, device_info) 
      VALUES (?, ?, ?, ?)
      RETURNING id
    `;
    
    const result = await dbQuery.run(query, [
      user_name || 'Anonim',
      latitude,
      longitude,
      device_info || null
    ]);

    res.json({
      success: true,
      message: 'Joylashuv muvaffaqiyatli saqlandi',
      data: {
        id: result.insertId,
        user_name,
        latitude,
        longitude
      }
    });
  } catch (error) {
    console.error('Xatolik:', error);
    res.status(500).json({
      success: false,
      message: 'Server xatosi',
      error: error.message
    });
  }
});

// 2. Barcha joylashuvlarni olish (Admin panel uchun)
app.get('/api/locations', async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    
    const query = `
      SELECT * FROM user_locations 
      ORDER BY timestamp DESC 
      LIMIT ? OFFSET ?
    `;
    
    const rows = await dbQuery.all(query, [
      parseInt(limit),
      parseInt(offset)
    ]);

    // Umumiy soni
    const countRow = await dbQuery.get('SELECT COUNT(*) as total FROM user_locations');

    res.json({
      success: true,
      data: rows,
      total: countRow.total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Xatolik:', error);
    res.status(500).json({
      success: false,
      message: 'Server xatosi',
      error: error.message
    });
  }
});

// 3. Ma'lum bir foydalanuvchi joylashuvlarini olish
app.get('/api/locations/user/:userName', async (req, res) => {
  try {
    const { userName } = req.params;
    
    const query = `
      SELECT * FROM user_locations 
      WHERE user_name = ? 
      ORDER BY timestamp DESC
    `;
    
    const rows = await dbQuery.all(query, [userName]);

    res.json({
      success: true,
      data: rows,
      count: rows.length
    });
  } catch (error) {
    console.error('Xatolik:', error);
    res.status(500).json({
      success: false,
      message: 'Server xatosi',
      error: error.message
    });
  }
});

// 4. Oxirgi joylashuvni olish
app.get('/api/locations/latest', async (req, res) => {
  try {
    const query = `
      SELECT * FROM user_locations 
      ORDER BY timestamp DESC 
      LIMIT 10
    `;
    
    const rows = await dbQuery.all(query);

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Xatolik:', error);
    res.status(500).json({
      success: false,
      message: 'Server xatosi',
      error: error.message
    });
  }
});

// 5. Statistika
app.get('/api/stats', async (req, res) => {
  try {
    // Umumiy soni
    const total = await dbQuery.get('SELECT COUNT(*) as count FROM user_locations');

    // Foydalanuvchilar soni
    const users = await dbQuery.get('SELECT COUNT(DISTINCT user_name) as count FROM user_locations');

    // Bugungi ma'lumotlar
    const today = await dbQuery.get(`
      SELECT COUNT(*) as count 
      FROM user_locations 
      WHERE DATE(timestamp) = CURRENT_DATE
    `);

    res.json({
      success: true,
      stats: {
        total_locations: total.count,
        total_users: users.count,
        today_locations: today.count
      }
    });
  } catch (error) {
    console.error('Xatolik:', error);
    res.status(500).json({
      success: false,
      message: 'Server xatosi',
      error: error.message
    });
  }
});

// 6. Ma'lumotni o'chirish (agar kerak bo'lsa)
app.delete('/api/location/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = 'DELETE FROM user_locations WHERE id = ?';
    const result = await dbQuery.run(query, [id]);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ma\'lumot topilmadi'
      });
    }

    res.json({
      success: true,
      message: 'Ma\'lumot o\'chirildi'
    });
  } catch (error) {
    console.error('Xatolik:', error);
    res.status(500).json({
      success: false,
      message: 'Server xatosi',
      error: error.message
    });
  }
});

// Server ishga tushirish
app.listen(PORT, () => {
  console.log('');
  console.log('✅ Server muvaffaqiyatli ishga tushdi!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🌐 Server: http://localhost:${PORT}`);
  console.log(`📡 API: http://localhost:${PORT}/api`);
  console.log(`📊 Stats: http://localhost:${PORT}/api/stats`);
  console.log(`💾 Database: PostgreSQL`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Server to\'xtatilmoqda...');
  process.exit(0);
});
