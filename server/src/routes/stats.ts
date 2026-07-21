import { Router, Request, Response } from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// 获取统计数据
router.get('/', async (req: Request, res: Response) => {
  const { warehouse_id } = req.query;
  try {
    let whereWarehouse = warehouse_id ? 'AND warehouse_id = ?' : '';
    const params: any[] = warehouse_id ? [warehouse_id] : [];

    // 总库存
    const [stockRows] = await pool.query<any[]>(
      `SELECT COALESCE(SUM(quantity), 0) as total FROM inventory WHERE 1=1 ${whereWarehouse.replace('AND', 'AND')}`,
      params.length ? params : undefined
    );

    // 总价值
    const [valueRows] = await pool.query<any[]>(
      `SELECT COALESCE(SUM(p.price * i.quantity), 0) as total FROM inventory i JOIN products p ON i.product_id = p.id`,
    );

    // 入库单总量
    const [inboundRows] = await pool.query<any[]>('SELECT COUNT(*) as count FROM inbound_docs');
    // 出库单总量
    const [outboundRows] = await pool.query<any[]>('SELECT COUNT(*) as count FROM outbound_docs');

    res.json({
      totalStock: stockRows[0]?.total || 0,
      totalValue: valueRows[0]?.total || 0,
      inboundCount: inboundRows[0]?.count || 0,
      outboundCount: outboundRows[0]?.count || 0,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
