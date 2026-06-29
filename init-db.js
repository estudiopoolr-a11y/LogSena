const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.resolve(__dirname, 'logsena.db');
const db = new sqlite3.Database(dbPath);

// Función para crear las tablas
function createTables() {
    // Tabla de usuarios
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL,
            full_name TEXT,
            email TEXT,
            document_number TEXT UNIQUE,
            phone TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT 1
        )
    `);

    // Tabla de registros de acceso
    db.run(`
        CREATE TABLE IF NOT EXISTS access_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action TEXT NOT NULL, -- 'entry' or 'exit'
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            location TEXT,
            device_info TEXT,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    `);

    // Tabla de códigos QR (opcional, para almacenar metadata)
    db.run(`
        CREATE TABLE IF NOT EXISTS qr_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE,
            qr_data TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME,
            is_active BOOLEAN DEFAULT 1,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    `);

    // Índices para mejor rendimiento
    db.run(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_users_document ON users(document_number)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_access_logs_user_id ON access_logs(user_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_access_logs_timestamp ON access_logs(timestamp)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_qr_codes_user_id ON qr_codes(user_id)`);
}

// Función para insertar usuarios de ejemplo
function insertSampleUsers() {
    const users = [
        {
            username: 'admin',
            password: 'admin123',
            role: 'admin',
            full_name: 'Administrador del Sistema',
            email: 'admin@logsena.edu.co',
            document_number: '1000000001',
            phone: '3001234567'
        },
        {
            username: 'guardia1',
            password: 'guardia123',
            role: 'guard',
            full_name: 'Juan Guardia',
            email: 'guardia@logsena.edu.co',
            document_number: '1000000002',
            phone: '3001234568'
        },
        {
            username: 'instructor1',
            password: 'instructor123',
            role: 'instructor',
            full_name: 'María Instructora',
            email: 'instructor@logsena.edu.co',
            document_number: '1000000003',
            phone: '3001234569'
        },
        {
            username: 'aprendiz1',
            password: 'aprendiz123',
            role: 'apprentice',
            full_name: 'Carlos Aprendiz',
            email: 'aprendiz@logsena.edu.co',
            document_number: '1000000004',
            phone: '3001234570'
        },
        {
            username: 'visitante1',
            password: 'visitante123',
            role: 'visitor',
            full_name: 'Ana Visitante',
            email: 'visitante@logsena.edu.co',
            document_number: '1000000005',
            phone: '3001234571'
        }
    ];

    const insertUser = `INSERT OR IGNORE INTO users (username, password, role, full_name, email, document_number, phone) VALUES (?, ?, ?, ?, ?, ?, ?)`;

    users.forEach(user => {
        const hashedPassword = bcrypt.hashSync(user.password, 8);
        db.run(insertUser, [
            user.username,
            hashedPassword,
            user.role,
            user.full_name,
            user.email,
            user.document_number,
            user.phone
        ], function(err) {
            if (err) {
                console.error(`Error inserting user ${user.username}:`, err);
            } else {
                console.log(`Usuario ${user.username} insertado o ya existía`);
            }
        });
    });
}

// Inicializar la base de datos
db.serialize(() => {
    console.log('Inicializando base de datos SQLite...');
    createTables();
    insertSampleUsers();
    console.log('Base de datos inicializada correctamente');
});

// Exportar la base de datos para usarla en otros módulos
module.exports = db;