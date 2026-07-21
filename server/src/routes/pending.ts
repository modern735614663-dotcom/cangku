import { Router, Request, Response } from 'express';
import pool from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// 获取待审核列表
router.get('/', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query('SELECT * FROM pending_docs ORDER BY created_at DESC');
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// 审核通过
router.post('/:id/approve', requireAdmin, async (req: Request, res: Response) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [docs] = await conn.query<any[]>('SELECT * FROM pending_docs WHERE id = ? AND status = ? FOR UPDATE',
      [req.params.id, 'pending']);
    if (docs.length === 0) { await conn.rollback(); res.status(404).json({ error: '单据不存在或已处理' }); return; }
    const doc = docs[0];
    const items = typeof doc.items === 'string' ? JSON.parse(doc.items) : doc.items;
    const reviewer = req.user!.username;

    if (doc.type === 'inbound') {
      // 处理全新款
      const processedItems = [];
      for (const item of items) {
        let pid = item.productId;
        if (item.isNewProduct && item.newProductData) {
          const nd = item.newProductData;
          const [r] = await conn.query<any>(
            'INSERT INTO products (sku, category, color, size, price, image) VALUES (?,?,?,?,?,?)',
            [nd.sku, nd.category || '其他', nd.color || '', nd.size || '', nd.price || 0, nd.image || null]
          );
          pid = r.insertId;
        }
        processedItems.push({ ...item, productId: pid });
        await conn.query(
          'INSERT INTO inventory (warehouse_id, product_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)',
          [doc.warehouse_id, pid, item.quantity]
        );
      }
      const totalQty = processedItems.reduce((s: number, i: any) => s + i.quantity, 0);
      const [inDoc] = await conn.query<any>(
        'INSERT INTO inbound_docs (source, warehouse_id, operator) VALUES (?,?,?)',
        [doc.source, doc.warehouse_id, doc.username]
      );
      for (const item of processedItems) {
        await conn.query('INSERT INTO inbound_items (doc_id, product_id, quantity, price) VALUES (?,?,?,?)',
          [inDoc.insertId, item.productId, item.quantity, item.price || 0]);
      }
      await conn.query(
        'INSERT INTO operation_logs (operator, type, doc_id, summary, detail, items) VALUES (?,?,?,?,?,?)',
        [doc.username, 'inbound', inDoc.insertId, `入库 ${totalQty} 件（${doc.source || ''}）`,
         JSON.stringify({ warehouse: doc.warehouse_id, quantity: totalQty, sourceOrReason: doc.source }),
         JSON.stringify(processedItems.map((i: any) => ({ productId: i.productId, quantity: i.quantity })))]
      );
    } else {
      const totalQty = items.reduce((s: number, i: any) => s + i.quantity, 0);
      const [outDoc] = await conn.query<any>(
        'INSERT INTO outbound_docs (reason, warehouse_id, operator) VALUES (?,?,?)',
        [doc.reason, doc.warehouse_id, doc.username]
      );
      for (const item of items) {
        await conn.query('INSERT INTO outbound_items (doc_id, product_id, quantity, price) VALUES (?,?,?,0)',
          [outDoc.insertId, item.productId, item.quantity]);
        await conn.query('UPDATE inventory SET quantity = quantity - ? WHERE warehouse_id = ? AND product_id = ?',
          [item.quantity, doc.warehouse_id, item.productId]);
      }
      await conn.query(
        'INSERT INTO operation_logs (operator, type, doc_id, summary, detail, items) VALUES (?,?,?,?,?,?)',
        [doc.username, 'outbound', outDoc.insertId, `出库 ${totalQty} 件（${doc.reason || ''}）`,
         JSON.stringify({ warehouse: doc.warehouse_id, quantity: totalQty, sourceOrReason: doc.reason }),
         JSON.stringify(items.map((i: any) => ({ productId: i.productId, quantity: i.quantity })))]
      );
    }

    await conn.query('UPDATE pending_docs SET status=?, reviewed_at=NOW(), reviewed_by=? WHERE id=?',
      ['approved', reviewer, req.params.id]);
    await conn.commit();
    res.json({ success: true });
  } catch (e: any) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

// 驳回
router.post('/:id/reject', requireAdmin, async (req: Request, res: Response) => {
  try {
    await pool.query('UPDATE pending_docs SET status=?, reviewed_at=NOW(), reviewed_by=? WHERE id=? AND status=?',
      ['rejected', req.user!.username, req.params.id, 'pending']);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
