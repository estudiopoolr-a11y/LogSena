# LogSena - Sistema de Control de Acceso (Prototipo con MySQL/SQLite)

Este es un prototipo funcional del Sistema de Control de Acceso LogSena conectado a una base de datos (SQLite por defecto, fácilmente adaptable a MySQL).

## Características

- Autenticación de usuarios con JWT
- Gestión de usuarios (crear, editar, activar/desactivar)
- Registro de entradas y salidas mediante escaneo de códigos QR
- Generación y visualización de códigos QR
- Panel de control con estadísticas en tiempo real
- Reportes de acceso
- Responsive design

## Tecnologías Utilizadas

### Backend
- Node.js
- Express.js
- SQLite (usando sqlite3 - fácilmente reemplazable por MySQL)
- JWT para autenticación
- Bcryptjs para hashing de contraseñas
- QRCode para generación de códigos QR
- CORS para habilitar peticiones cruzadas

### Frontend
- HTML5
- CSS3
- JavaScript Vanilla
- QRCode.js (para generación de códigos QR)

## Instalación y Ejecución

### Requisitos Previos
- Node.js (v14 o superior)
- npm (v6 o superior)

### Pasos para Ejecutar

1. **Clonar o descargar este repositorio**

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Inicializar la base de datos**
   ```bash
   npm run init-db
   ```
   Esto creará una base de datos SQLite llamada `logsena.db` con las tablas necesarias y algunos usuarios de ejemplo.

4. **Iniciar el servidor**
   ```bash
   npm start
   ```
   O para desarrollo con recarga automática:
   ```bash
   npm run dev
   ```

5. **Abrir la aplicación**
   Abre tu navegador y navega a: `http://localhost:3000`

## Usuarios de Predeterminado

| Usuario | Contraseña | Rol |
|---------|------------|-----|
| admin | admin123 | Administrador |
| guardia1 | guardia123 | Guardia |
| instructor1 | instructor123 | Instructor |
| aprendiz1 | aprendiz123 | Aprendiz |
| visitante1 | visitante123 | Visitante |

## Funcionalidades Detalladas

### Autenticación
- Los usuarios pueden iniciar sesión con su usuario y contraseña
- Se utiliza JWT (JSON Web Tokens) para mantener la sesión
- Los tokens se almacenan en localStorage y se envían en el header Authorization de cada petición

### Gestión de Usuarios
- Los administradores y guardias pueden ver, crear, editar y desactivar/activar usuarios
- Los usuarios tienen roles que determinan sus permisos:
  - **Administrador**: Acceso completo a todas las funciones
  - **Guarda**: Puede registrar usuarios y escanear códigos QR
  - **Instructor**: Puede ver reportes y gestionar a sus aprendices
  - **Aprendiz**: Puede ver su propio historial
  - **Visitante**: Acceso limitado a su propia información

### Control de Acceso
- Los guardias pueden escanear códigos QR usando la cámara del dispositivo
- Cada escaneo registra una entrada o salida en el sistema
- El sistema evita entradas duplicadas sin salida intermedia
- Se muestra información del usuario al escanear su código QR

### Generación de QR
- Los administradores y guardias pueden generar códigos QR para cualquier usuario
- Los códigos QR contienen información codificada del usuario
- Los códigos pueden enviarse por correo electrónico (simulado en este prototype)

### Panel de Control
- Muestra estadísticas en tiempo real:
  - Ingresos de hoy
  - Salidas de hoy
  - Personas actualmente dentro
  - Visitantes de hoy
- Incluye un gráfico de flujo por hora (placeholder)

### Reportes
- Generación de reportes diarios de accesos
- Opciones para exportar a PDF y Excel (simuladas en este prototype)

## Personalización para MySQL

Para usar MySQL en lugar de SQLite:

1. Instalar el paquete de MySQL:
   ```bash
   npm install mysql2
   ```

2. Modificar el archivo `init-db.js` para usar MySQL en lugar de sqlite3:
   ```javascript
   const mysql = require('mysql2/promise');
   // ... cambiar la configuración de la base de datos
   ```

3. Actualizar las consultas SQL en `server.js` para usar la sintaxis de MySQL si es necesario
   (en este caso, las consultas son estándar SQL y deberían funcionar en ambos)

4. Actualizar las credenciales de conexión en `server.js` según tu configuración de MySQL

## Notas de Seguridad (Importante para Producción)

⚠️ **Este es un prototype para demostración y NO debe usarse en producción sin las siguientes mejoras:**

1. **Hashing de Contraseñas**: Actualmente, las contraseñas se hashean en el backend, pero en una versión de producción debería usar un salt fuerte y un factor de costo adecuado para bcrypt.

2. **HTTPS**: En producción, siempre servir la aplicación sobre HTTPS para proteger los tokens y datos en tránsito.

3. **Variables de Entorno**: Almacenar secrets como JWT_SECRET en variables de entorno, no en el código fuente.

4. **Validación de Entrada**: Implementar validación y saneamiento más rigurosa de todos los inputs.

5. **Límites de Tasa**: Implementar rate limiting para prevenir ataques de fuerza bruta.

6. **Política de Seguridad de Contenido (CSP)**: Implementar cabeceras de seguridad apropiadas.

7. **Actualizaciones Regulares**: Mantener todas las dependencias actualizadas.

8. **Copias de Seguridad**: Implementar una estrategia de copias de seguridad regular para la base de datos.

## Estructura del Proyecto

```
LogSena1/
├── index.html          # Página principal
├── style.css           # Estilos CSS
├── script.js           # Lógica del frontend
├── server.js           # Servidor Node.js/Express
├── init-db.js          # Inicialización de la base de datos
├── package.json        # Dependencias y scripts
├── logsena.db          # Base de datos SQLite (generada automáticamente)
└── README.md           # Este archivo
```

## Desarrollo Futuro

Algunas ideas para mejorar este prototype:

1. Implementar autenticación de dos factores (2FA)
2. Añadir notificaciones por push o email para accesos sospechosos
3. Implementar roles y permisos más granulares
4. Añadir soporte para múltiples sedes o locaciones
5. Mejorar la interfaz de usuario con un framework como React o Vue
6. Implementar modo offline con sincronización cuando se recupere la conexión
7. Añadir capacidades de auditoría detallada
8. Integrar con sistemas de identidad existentes (LDAP, Active Directory, etc.)

¡Disfruta usando LogSena!