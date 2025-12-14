import express from 'express';

const app = express();
const PORT = 3001;

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 测试路由
app.get('/', (req, res) => {
  res.json({ message: '服务器运行正常', timestamp: new Date().toISOString() });
});

app.get('/workspaces', (req, res) => {
  res.json([{ id: 'default', name: '默认工作区' }]);
});

// 错误处理中间件
app.use((err: any, req: any, res: any, next: any) => {
  console.error('服务器错误:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
}).on('error', (err) => {
  console.error('服务器启动失败:', err);
  process.exit(1);
});