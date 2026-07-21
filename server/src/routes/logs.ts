import { Router, Request, Response } from 'express';
import pool from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// 获取操作日志
router.get('/', async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query('SELECT * FROM operation_logs ORDER BY created_at DESC LIMIT 200');
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// 撤销操作（管理员）
router.post('/:id/revoke', requireAdmin, async (req: Request, res: Response) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [logs] = await conn.query<any[]>('SELECT * FROM operation_logs WHERE id = ? AND revoked = 0 FOR UPDATE',
      [req.params.id]);
    if (logs.length === 0) { await conn.rollback(); res.status(404).json({ error: '记录不存在或已撤销' }); return; }
    const log = logs[0];
    const detail = typeof log.detail === 'string' ? JSON.parse(log.detail) : log.detail;
    const username = req.user!.username;

    if (log.type === 'inbound') {
      const [docs] = await conn.query<any[]>('SELECT * FROM inbound_docs WHERE id = ?', [log.doc_id]);
      if (docs.length > 0) {
        const [items] = await conn.query<any[]>('SELECT * FROM inbound_items WHERE doc_id = ?', [log.doc_id]);
        for (const item of items) {
          await conn.query(
            'UPDATE inventory SET quantity = GREATEST(quantity - ?, 0) WHERE warehouse_id = ? AND product_id = ?',
            [item.quantity, docs[0].warehouse_id, item.product_id]
          );
        }
      }
    } else if (log.type === 'outbound') {
      const [docs] = await conn.query<any[]>('SELECT * FROM outbound_docs WHERE id = ?', [log.doc_id]);
      if (docs.length > 0) {
        const [items] = await conn.query<any[]>('SELECT * FROM outbound_items WHERE doc_id = ?', [log.doc_id]);
        for (const item of items) {
          await conn.query(
            'INSERT INTO inventory (warehouse_id, product_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)',
            [docs[0].warehouse_id, item.product_id, item.quantity]
          );
        }
      }
    } else if (log.type === 'transfer') {
      const [docs] = await conn.query<any[]>('SELECT * FROM transfer_docs WHERE id = ?', [log.doc_id]);
      if (docs.length > 0) {
        const d = docs[0];
        const [inv] = await conn.query<any[]>('SELECT quantity FROM inventory WHERE warehouse_id = ? AND product_id = ? FOR UPDATE',
          [d.to_warehouse, d.product_id]);
        if ((inv[0]?.quantity ?? 0) < d.quantity) {
          await conn.rollback();
          res.status(400).json({ error: '目标仓库存不足，无法撤销' });
          return;
        }
        await conn.query('UPDATE inventory SET quantity = quantity - ? WHERE warehouse_id = ? AND product_id = ?',
          [d.quantity, d.to_warehouse, d.product_id]);
        await conn.query('INSERT INTO inventory (warehouse_id, product_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)',
          [d.from_warehouse, d.product_id, d.quantity]);
      }
    }

    await conn.query('UPDATE operation_logs SET revoked = 1, revoke_info = ? WHERE id = ?',
      [JSON.stringify({ operator: username, timestamp: new Date().toISOString() }), req.params.id]);
    await conn.query(
      'INSERT INTO operation_logs (operator, type, doc_id, summary, detail, items) VALUES (?,?,?,?,?,?)',
      [username, log.type, log.doc_id, `撤销了 ${log.operator} 的${log.summary}`, log.detail, log.items]
    );
    await conn.commit();
    res.json({ success: true });
  } catch (e: any) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

export default router;
