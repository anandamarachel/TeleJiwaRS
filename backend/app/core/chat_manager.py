from fastapi import WebSocket


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
        for connection in self.active_connections.get(consultation_id, []):
            await connection.send_json(message)


manager = ConnectionManager()