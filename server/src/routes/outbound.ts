import { Router, Request, Response } from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.post('/', async (req: Request, res: Response) => {
  const { reason, warehouse_id, items } = req.body; // items: [{ productId, quantity }]
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const username = req.user!.username;
    const isAdmin = req.user!.role === 'admin';

    // 校验库存
    for (const item of items) {
      const [rows] = await conn.query<any[]>(
        'SELECT quantity FROM inventory WHERE warehouse_id = ? AND product_id = ? FOR UPDATE',
        [warehouse_id, item.productId]
      );
      const stock = rows[0]?.quantity ?? 0;
      if (stock < item.quantity) {
        await conn.rollback();
        const [p] = await pool.query<any[]>('SELECT sku FROM products WHERE id=?', [item.productId]);
        res.status(400).json({ error: `${p[0]?.sku || '未知'} 库存不足（库存: ${stock}）` });
        return;
      }
    }

    if (isAdmin) {
      const [doc] = await conn.query<any>(
        'INSERT INTO outbound_docs (reason, warehouse_id, operator) VALUES (?, ?, ?)',
        [reason, warehouse_id, username]
      );
      const docId = doc.insertId;
      let totalQty = 0;
      for (const item of items) {
        totalQty += item.quantity;
        await conn.query('INSERT INTO outbound_items (doc_id, product_id, quantity, price) VALUES (?,?,?,0)',
          [docId, item.productId, item.quantity]);
        await conn.query(
          'UPDATE inventory SET quantity = quantity - ? WHERE warehouse_id = ? AND product_id = ?',
          [item.quantity, warehouse_id, item.productId]
        );
      }
      const logItems = items.map((i: any) => ({ productId: i.productId, quantity: i.quantity }));
      await conn.query(
        'INSERT INTO operation_logs (operator, type, doc_id, summary, detail, items) VALUES (?,?,?,?,?,?)',
        [username, 'outbound', docId, `出库 ${totalQty} 件（${reason}）`,
         JSON.stringify({ warehouse: warehouse_id, quantity: totalQty, sourceOrReason: reason }),
         JSON.stringify(logItems)]
      );
      await conn.commit();
      res.json({ success: true, docId, message: '出库成功' });
    } else {
      const [pend] = await conn.query<any>(
        'INSERT INTO pending_docs (type, username, reason, warehouse_id, items) VALUES (?,?,?,?,?)',
        ['outbound', username, reason, warehouse_id, JSON.stringify(items)]
      );
      await conn.commit();
      res.json({ success: true, pendingId: pend.insertId, message: '已提交审核' });
    }
  } catch (e: any) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

export default router;
