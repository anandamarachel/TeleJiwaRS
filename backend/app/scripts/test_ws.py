# test_ws.py (scratch file, not part of the app)
import asyncio
import websockets

async def main():
    token = "PASTE_A_REAL_TOKEN_HERE"
    consultation_id = 1
    uri = f"ws://localhost:8000/ws/consultations/{consultation_id}?token={token}"
    async with websockets.connect(uri) as ws:
        await ws.send('{"message": "Halo dokter"}')
        response = await ws.recv()
        print("Received:", response)

asyncio.run(main())