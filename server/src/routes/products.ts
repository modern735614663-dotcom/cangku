import { Router, Request, Response } from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// 获取所有货品
router.get('/', async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// 新增货品
router.post('/', async (req: Request, res: Response) => {
  const { sku, category, color, size, price, image } = req.body;
  if (!sku) { res.status(400).json({ error: '款号不能为空' }); return; }
  try {
    const [r] = await pool.query<any>(
      'INSERT INTO products (sku, category, color, size, price, image) VALUES (?,?,?,?,?,?)',
      [sku, category || '其他', color || '', size || '', price || 0, image || null]
    );
    const [rows] = await pool.query<any[]>('SELECT * FROM products WHERE id = ?', [r.insertId]);
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// 编辑货品
router.put('/:id', async (req: Request, res: Response) => {
  const { sku, category, color, size, price, image } = req.body;
  try {
    await pool.query(
      'UPDATE products SET sku=?, category=?, color=?, size=?, price=?, image=? WHERE id=?',
      [sku, category, color, size, price, image, req.params.id]
    );
    const [rows] = await pool.query<any[]>('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (rows.length === 0) { res.status(404).json({ error: '货品不存在' }); return; }
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// 删除货品（需管理员）
router.delete('/:id', async (req: Request, res: Response) => {
  if (req.user?.role !== 'admin') { res.status(403).json({ error: '需要管理员权限' }); return; }
  try {
    await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
