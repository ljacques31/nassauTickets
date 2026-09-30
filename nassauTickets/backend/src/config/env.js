import dotenv from 'dotenv';

dotenv.config({ quiet: true });

// O fuso precisa ser definido antes de qualquer cálculo de data.
process.env.TZ = process.env.TZ || 'America/Recife';

export const env = {
  porta: Number(process.env.PORT || 3333),
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'nassau_tickets',
  },
  jwtSecret: process.env.JWT_SECRET || 'troque-este-segredo',
  jwtExpiraEm: process.env.JWT_EXPIRA_EM || '10h',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  adminSenhaInicial: process.env.ADMIN_SENHA_INICIAL || 'admin123',
};

if (env.jwtSecret === 'troque-este-segredo' && process.env.NODE_ENV === 'production') {
  console.warn('[seguranca] JWT_SECRET padrão em produção. Defina um segredo forte no .env.');
}
