import { Router, Request, Response } from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.post('/', async (req: Request, res: Response) => {
  const { source, warehouse_id, items } = req.body;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const username = req.user!.username;

    // 处理全新款
    const processedItems = [];
    for (const item of items) {
      let pid = item.productId;
      let price = item.price || 0;
      if (item.isNewProduct && item.newProductData) {
        const nd = item.newProductData;
        const [r] = await conn.query<any>(
          'INSERT INTO products (sku, category, color, size, price, image) VALUES (?,?,?,?,?,?)',
          [nd.sku, nd.category || '其他', nd.color || '', nd.size || '', nd.price || 0, nd.image || null]
        );
        pid = r.insertId;
        price = nd.price || 0;
      }
      processedItems.push({ productId: pid, quantity: item.quantity, price });
    }

    // 全部直接入库（无需审核）
    const [doc] = await conn.query<any>(
      'INSERT INTO inbound_docs (source, warehouse_id, operator) VALUES (?, ?, ?)',
      [source, warehouse_id, username]
    );
    const docId = doc.insertId;
    let totalQty = 0;
    const logItems: any[] = [];
    for (const item of processedItems) {
      totalQty += item.quantity;
      await conn.query('INSERT INTO inbound_items (doc_id, product_id, quantity, price) VALUES (?,?,?,?)',
        [docId, item.productId, item.quantity, item.price]);
      await conn.query(
        'INSERT INTO inventory (warehouse_id, product_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)',
        [warehouse_id, item.productId, item.quantity]
      );
      // 查产品详情用于日志
      const [prods] = await conn.query<any[]>('SELECT sku, color, size FROM products WHERE id = ?', [item.productId]);
      if (prods.length > 0) {
        logItems.push({ sku: prods[0].sku, color: prods[0].color, size: prods[0].size, quantity: item.quantity, price: item.price });
      }
    }
    await conn.query(
      'INSERT INTO operation_logs (operator, type, doc_id, summary, detail, items) VALUES (?,?,?,?,?,?)',
      [username, 'inbound', docId, `入库 ${totalQty} 件（${source}）`,
       JSON.stringify({ warehouse: warehouse_id, quantity: totalQty, sourceOrReason: source }),
       JSON.stringify(logItems)]
    );
    await conn.commit();
    res.json({ success: true, docId, message: '入库成功' });
  } catch (e: any) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

export default router;
