# 部署到服务器（GitHub Actions）

本项目已配置一个 GitHub Actions 工作流：`.github/workflows/deploy.yml`，用于在 Pull Request 合并到 `stream` 分支时自动在你的服务器上部署并（可选）重启服务。

## 需要设置的 Secrets（仓库 Settings → Secrets）
- `SERVER_HOST`：服务器地址或 IP（例如 `cloud` 或 `1.2.3.4`）
- `SERVER_USER`：登录用户名（示例：`root`）
- `SERVER_PASSWORD`：密码（注意：出于安全考虑建议使用 SSH 密钥替代）
- `TARGET_DIR`：服务器上的项目目录（示例：`/root/syntax-audio` 或 `~/syntax-audio`）
- `RESTART_CMD`：可选，合并后在服务器上执行的重启或部署命令。推荐使用 `pm2`：
  - 在服务器上安装并启动一次：
    - `npm i -g pm2`
    - 在项目目录（首次）运行： `npm --prefix server run build`，然后 `pm2 start server/dist/index.js --name syntax-audio`
  - 将 `RESTART_CMD` 设置为：`pm2 restart syntax-audio`
  - 也可以使用 `systemctl restart my-service` 或 `docker compose -f /root/syntax-audio/docker-compose.yml up -d` 等

## 已实现的流程（工作流内容摘要）
- 触发：当 PR 被合并（merged）且目标分支为 `stream` 时触发。
- 动作：Actions 通过 SSH（使用密码认证）登录到 `SERVER_HOST`，进入 `TARGET_DIR`，执行：
  - `git reset --hard origin/stream`（保证代码与远程 `stream` 同步）
  - `npm ci`、`npm run build`（可根据项目调整）
  - 若设置了 `RESTART_CMD`，则会执行该命令以重启服务

## 测试方法
1. 在仓库中创建一个测试分支并提交修改。
2. 发起一个将该分支合并到 `stream` 的 PR，并合并。
3. 在 GitHub Actions 页查看 `.github/workflows/deploy.yml` 的执行日志，确认部署步骤成功并检查服务器服务状态。

---

如果你愿意，我可以帮你改成使用 SSH 密钥认证（更安全），并协助把 `RESTART_CMD` 设置为合适的重启命令。