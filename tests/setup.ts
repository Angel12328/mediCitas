// Setup global de pruebas - carga variables de entorno de .env
import 'dotenv/config';

process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
