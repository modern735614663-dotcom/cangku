import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db.js';
import { JWT_SECRET, requireAuth } from '../middleware/auth.js';

const router = Router();

// 登录
router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: '请填写用户名和密码' });
    return;
  }
  try {
    const [rows] = await pool.query<any[]>('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length === 0) {
      res.status(401).json({ error: '用户名或密码错误' });
      return;
    }
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      res.status(401).json({ error: '用户名或密码错误' });
      return;
    }
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 注册
router.post('/register', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password || password.length < 4) {
    res.status(400).json({ error: '用户名不能为空，密码至少4位' });
    return;
  }
  try {
    const [existing] = await pool.query<any[]>('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      res.status(400).json({ error: '用户名已存在' });
      return;
    }
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query<any>('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', [username, hash, 'user']);
    const token = jwt.sign({ id: result.insertId, username, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: result.insertId, username, role: 'user' } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 获取当前用户信息
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  res.json({ user: req.user });
});

export default router;
