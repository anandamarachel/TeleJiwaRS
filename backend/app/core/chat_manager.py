from fastapi import WebSocket, WebSocketDisconnect


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[int, list[WebSocket]] = {}

    async def connect(self, consultation_id: int, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.setdefault(consultation_id, []).append(websocket)

    def disconnect(self, consultation_id: int, websocket: WebSocket):
        connections = self.active_connections.get(consultation_id, [])
        if websocket in connections:
            connections.remove(websocket)
        if not connections:
            self.active_connections.pop(consultation_id, None)

    async def broadcast(self, consultation_id: int, message: dict):
        stale_connections: list[WebSocket] = []
        for connection in list(self.active_connections.get(consultation_id, [])):
            try:
                await connection.send_json(message)
            except (RuntimeError, WebSocketDisconnect):
                stale_connections.append(connection)

        for connection in stale_connections:
            self.disconnect(consultation_id, connection)


manager = ConnectionManager()
