// 初始化管理员账号（和 .env 里的数据库配置保持一致）
import 'dotenv/config';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'schema',
    password: process.env.DB_PASSWORD || 'schema',
    database: process.env.DB_NAME || 'schema',
  });

  const hash = await bcrypt.hash('admin123', 10);

  await pool.query('DELETE FROM users WHERE username = ?', ['admin']);
  await pool.query(
    'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
    ['admin', hash, 'admin']
  );

  console.log('管理员账号已创建: admin / admin123');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
