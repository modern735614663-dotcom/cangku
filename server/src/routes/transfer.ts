import { Router, Request, Response } from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.post('/', async (req: Request, res: Response) => {
  const { from_warehouse, to_warehouse, product_id, quantity } = req.body;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const username = req.user!.username;

    // 检查来源仓库存
    const [rows] = await conn.query<any[]>(
      'SELECT quantity FROM inventory WHERE warehouse_id = ? AND product_id = ? FOR UPDATE',
      [from_warehouse, product_id]
    );
    const stock = rows[0]?.quantity ?? 0;
    if (stock < quantity) {
      await conn.rollback();
      res.status(400).json({ error: `库存不足（库存: ${stock}）` });
      return;
    }

    // 扣减来源仓
    await conn.query('UPDATE inventory SET quantity = quantity - ? WHERE warehouse_id = ? AND product_id = ?',
      [quantity, from_warehouse, product_id]);
    // 增加目标仓
    await conn.query('INSERT INTO inventory (warehouse_id, product_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)',
      [to_warehouse, product_id, quantity]);

    const [doc] = await conn.query<any>(
      'INSERT INTO transfer_docs (from_warehouse, to_warehouse, product_id, quantity, operator) VALUES (?,?,?,?,?)',
      [from_warehouse, to_warehouse, product_id, quantity, username]
    );

    const [p] = await conn.query<any[]>('SELECT sku FROM products WHERE id = ?', [product_id]);
    await conn.query(
      'INSERT INTO operation_logs (operator, type, doc_id, summary, detail, items) VALUES (?,?,?,?,?,?)',
      [username, 'transfer', doc.insertId,
       `转仓 ${p[0]?.sku || ''} ${quantity}件 ${from_warehouse}→${to_warehouse}`,
       JSON.stringify({ fromWarehouse: from_warehouse, toWarehouse: to_warehouse, quantity }),
       JSON.stringify([{ productId: product_id, quantity }])]
    );

    await conn.commit();
    res.json({ success: true, docId: doc.insertId });
  } catch (e: any) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

export default router;
