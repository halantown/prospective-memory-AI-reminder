1. 部分（未处理的）消息反复发送

2. Reconnect PM pipeline state endpoint 参数不一致

- 观察：前端 `getSessionState(sessionId)` 调用 `/api/session/{sessionId}/state`，但后端 `GET /api/session/{token}/state` 按 participant token 查询。
- 风险：断线重连时如果存在未完成 PM pipeline，前端可能无法恢复真实 `task_id` / pipeline step，导致恢复失败或状态不完整。
- 相关文件：
  - `frontend/src/services/api.ts`
  - `frontend/src/hooks/useWebSocket.ts`
  - `backend/routers/session.py`
