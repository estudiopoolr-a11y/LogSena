const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const db = require('./init-db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'logsena-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware para autenticación JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token de acceso requerido' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido o expirado' });
        }
        req.user = user;
        next();
    });
}

// Middleware para verificar roles
function authorizeRole(roles) {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Permisos insuficientes' });
        }
        next();
    };
}

// Rutas de autenticación
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }

    db.get('SELECT * FROM users WHERE username = ? AND is_active = 1', [username], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Error al consultar usuario' });
        }

        if (!user) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        if (!bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // Generar token JWT
        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                role: user.role,
                full_name: user.full_name
            },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        // Ocultar la contraseña en la respuesta
        const { password: _, ...userWithoutPassword } = user;

        res.json({
            message: 'Inicio de sesión exitoso',
            token,
            user: userWithoutPassword
        });
    });
});

// Ruta para obtener el perfil del usuario
app.get('/api/profile', authenticateToken, (req, res) => {
    db.get('SELECT id, username, role, full_name, email, document_number, phone FROM users WHERE id = ?',
        [req.user.id], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Error al obtener perfil' });
        }
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json(user);
    });
});

// Rutas de usuarios (solo para administradores y guardias)
app.get('/api/users', authenticateToken, authorizeRole(['admin', 'guard']), (req, res) => {
    db.all('SELECT id, username, role, full_name, email, document_number, phone, is_active, created_at FROM users ORDER BY created_at DESC',
        [], (err, users) => {
        if (err) {
            return res.status(500).json({ error: 'Error al obtener usuarios' });
        }
        res.json(users);
    });
});

// Ruta para crear un nuevo usuario
app.post('/api/users', authenticateToken, authorizeRole(['admin', 'guard']), (req, res) => {
    const { username, password, role, full_name, email, document_number, phone } = req.body;

    if (!username || !password || !role || !full_name) {
        return res.status(400).json({ error: 'Campos requeridos: username, password, role, full_name' });
    }

    const hashedPassword = bcrypt.hashSync(password, 8);

    db.run(
        `INSERT INTO users (username, password, role, full_name, email, document_number, phone)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [username, hashedPassword, role, full_name, email || null, document_number || null, phone || null],
        function(err) {
            if (err) {
                if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                    return res.status(400).json({ error: 'El usuario o documento ya existe' });
                }
                return res.status(500).json({ error: 'Error al crear usuario' });
            }
            res.status(201).json({
                message: 'Usuario creado exitosamente',
                userId: this.lastID
            });
        }
    );
});

// Ruta para obtener un usuario específico
app.get('/api/users/:id', authenticateToken, authorizeRole(['admin', 'guard']), (req, res) => {
    db.get('SELECT id, username, role, full_name, email, document_number, phone, is_active FROM users WHERE id = ?',
        [req.params.id], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Error al obtener usuario' });
        }
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json(user);
    });
});

// Ruta para actualizar un usuario
app.put('/api/users/:id', authenticateToken, authorizeRole(['admin', 'guard']), (req, res) => {
    const { role, full_name, email, document_number, phone, is_active } = req.body;
    const userId = req.params.id;

    // Construir la consulta dinámicamente basado en los campos proporcionados
    const updates = [];
    const values = [];

    if (role !== undefined) {
        updates.push('role = ?');
        values.push(role);
    }
    if (full_name !== undefined) {
        updates.push('full_name = ?');
        values.push(full_name);
    }
    if (email !== undefined) {
        updates.push('email = ?');
        values.push(email);
    }
    if (document_number !== undefined) {
        updates.push('document_number = ?');
        values.push(document_number);
    }
    if (phone !== undefined) {
        updates.push('phone = ?');
        values.push(phone);
    }
    if (is_active !== undefined) {
        updates.push('is_active = ?');
        values.push(is_active ? 1 : 0);
    }

    if (updates.length === 0) {
        return res.status(400).json({ error: 'No se proporcionaron campos para actualizar' });
    }

    values.push(userId); // Para el WHERE

    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;

    db.run(query, values, function(err) {
        if (err) {
            if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                return res.status(400).json({ error: 'El documento ya está en uso por otro usuario' });
            }
            return res.status(500).json({ error: 'Error al actualizar usuario' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json({ message: 'Usuario actualizado exitosamente' });
    });
});

// Ruta para eliminar (desactivar) un usuario
app.delete('/api/users/:id', authenticateToken, authorizeRole(['admin']), (req, res) => {
    db.run('UPDATE users SET is_active = 0 WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Error al eliminar usuario' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json({ message: 'Usuario desactivado exitosamente' });
    });
});

// Rutas de acceso (logs)
app.post('/api/access-logs', authenticateToken, (req, res) => {
    const { userId, action, location, deviceInfo } = req.body;

    if (!userId || !action || !['entry', 'exit'].includes(action)) {
        return res.status(400).json({ error: 'Datos inválidos: userId y action (entry/exit) son requeridos' });
    }

    db.run(
        `INSERT INTO access_logs (user_id, action, location, device_info)
         VALUES (?, ?, ?, ?)`,
        [userId, action, location || null, deviceInfo || null],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Error al registrar acceso' });
            }
            res.status(201).json({
                message: 'Acceso registrado exitosamente',
                logId: this.lastID
            });
        }
    );
});

// Ruta para obtener logs de acceso
app.get('/api/access-logs', authenticateToken, authorizeRole(['admin', 'guard']), (req, res) => {
    const { userId, startDate, endDate, limit = 100 } = req.query;

    let query = `
        SELECT al.id, al.action, al.timestamp, al.location, al.device_info,
               u.username, u.full_name, u.role
        FROM access_logs al
        JOIN users u ON al.user_id = u.id
        WHERE 1=1
    `;
    const params = [];

    if (userId) {
        query += ' AND al.user_id = ?';
        params.push(userId);
    }
    if (startDate) {
        query += ' AND al.timestamp >= ?';
        params.push(startDate);
    }
    if (endDate) {
        query += ' AND al.timestamp <= ?';
        params.push(endDate);
    }

    query += ' ORDER BY al.timestamp DESC LIMIT ?';
    params.push(parseInt(limit));

    db.all(query, params, (err, logs) => {
        if (err) {
            return res.status(500).json({ error: 'Error al obtener logs de acceso' });
        }
        res.json(logs);
    });
});

// Ruta para obtener estadísticas del dashboard
app.get('/api/dashboard/stats', authenticateToken, authorizeRole(['admin']), (req, res) => {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Query para obtener estadísticas de hoy
    db.all(`
        SELECT
            (SELECT COUNT(*) FROM access_logs WHERE action = 'entry' AND DATE(timestamp) = ?) as entries_today,
            (SELECT COUNT(*) FROM access_logs WHERE action = 'exit' AND DATE(timestamp) = ?) as exits_today,
            (SELECT COUNT(*) FROM access_logs WHERE action = 'entry' AND DATE(timestamp) = ?
             AND id NOT IN (SELECT id FROM access_logs WHERE action = 'exit' AND DATE(timestamp) = ?
                           AND user_id = access_logs.user_id AND access_logs.timestamp > access_logs.timestamp)) as current_inside,
            (SELECT COUNT(*) FROM users WHERE role = 'visitor' AND is_active = 1) as total_visitors,
            (SELECT COUNT(*) FROM access_logs WHERE action = 'entry' AND DATE(timestamp) = ?
             AND user_id IN (SELECT id FROM users WHERE role = 'visitor')) as visitors_today
    `, [today, today, today, today, today], (err, stats) => {
        if (err) {
            return res.status(500).json({ error: 'Error al obtener estadísticas' });
        }
        res.json(stats[0] || {
            entries_today: 0,
            exits_today: 0,
            current_inside: 0,
            total_visitors: 0,
            visitors_today: 0
        });
    });
});

// Ruta para generar un código QR para un usuario
app.post('/api/qr/generate/:userId', authenticateToken, authorizeRole(['admin', 'guard']), async (req, res) => {
    const userId = req.params.id || req.params.userId;

    // Verificar que el usuario existe
    db.get('SELECT id, username, full_name, role FROM users WHERE id = ? AND is_active = 1', [userId], async (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Error al obtener usuario' });
        }
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Generar datos del QR
        const qrData = {
            userId: user.id,
            username: user.username,
            fullName: user.full_name,
            role: user.role,
            timestamp: Date.now(),
            version: '1.0'
        };

        try {
            // Generar el código QR como data URL
            const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData));

            // Guardar o actualizar el QR en la base de datos
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas de validez

            db.run(
                `INSERT OR REPLACE INTO qr_codes (user_id, qr_data, expires_at)
                 VALUES (?, ?, ?)`,
                [userId, JSON.stringify(qrData), expiresAt.toISOString()],
                function(err) {
                    if (err) {
                        return res.status(500).json({ error: 'Error al guardar código QR' });
                    }
                    res.json({
                        message: 'Código QR generado exitosamente',
                        qrCode: qrCodeDataURL,
                        qrData: qrData,
                        expiresAt: expiresAt.toISOString()
                    });
                }
            );
        } catch (qrError) {
            res.status(500).json({ error: 'Error al generar código QR', details: qrError.message });
        }
    });
});

// Ruta para validar un código QR
app.post('/api/qr/validate', authenticateToken, async (req, res) => {
    const { qrData } = req.body;

    if (!qrData) {
        return res.status(400).json({ error: 'Datos del QR son requeridos' });
    }

    try {
        const parsedData = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;

        // Validar estructura básica
        if (!parsedData.userId || !parsedData.timestamp) {
            return res.status(400).json({ error: 'Datos del QR inválidos' });
        }

        // Verificar que el usuario existe y está activo
        db.get('SELECT id, username, full_name, role, is_active FROM users WHERE id = ?',
            [parsedData.userId], (err, user) => {
            if (err) {
                return res.status(500).json({ error: 'Error al validar usuario' });
            }
            if (!user) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }
            if (!user.is_active) {
                return res.status(401).json({ error: 'Usuario inactivo' });
            }

            // Verificar expiración (opcional, depende de cómo se genere el QR)
            // En un caso real, verificaríamos contra la tabla qr_codes

            res.json({
                valid: true,
                user: {
                    id: user.id,
                    username: user.username,
                    fullName: user.full_name,
                    role: user.role
                },
                qrData: parsedData
            });
        });
    } catch (parseError) {
        res.status(400).json({ error: 'Formato de datos QR inválido', details: parseError.message });
    }
});

// Ruta de salud
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor LogSena ejecutándose en http://localhost:${PORT}`);
    console.log(`Base de datos SQLite: ${require('./init-db').dbPath || 'logsena.db'}`);
});