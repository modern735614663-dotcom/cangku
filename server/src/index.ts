import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import inventoryRoutes from './routes/inventory.js';
import inboundRoutes from './routes/inbound.js';
import outboundRoutes from './routes/outbound.js';
import transferRoutes from './routes/transfer.js';
import pendingRoutes from './routes/pending.js';
import logRoutes from './routes/logs.js';
import statsRoutes from './routes/stats.js';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/inbound', inboundRoutes);
app.use('/api/outbound', outboundRoutes);
app.use('/api/transfer', transferRoutes);
app.use('/api/pending', pendingRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/stats', statsRoutes);

// 健康检查
app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`仓库管理系统 API 已启动: http://localhost:${PORT}`);
});
