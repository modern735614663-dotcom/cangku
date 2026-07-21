import { Router, Request, Response } from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// 获取所有库存（带产品信息）
router.get('/', async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query(`
      SELECT i.*, p.sku, p.category, p.color, p.size, p.price, p.image
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      ORDER BY p.sku, p.color, p.size
    `);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// 更新库存（增减）
router.post('/update', async (req: Request, res: Response) => {
  const { product_id, warehouse_id, quantity } = req.body;
  try {
    await pool.query(
      `INSERT INTO inventory (warehouse_id, product_id, quantity) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
      [warehouse_id, product_id, quantity]
    );
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
