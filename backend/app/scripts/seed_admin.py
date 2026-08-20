# app/scripts/seed_admin.py
"""
One-off script to create the first Admin account.
Run manually: uv run python -m app.scripts.seed_admin
"""
import sys

from app.database import SessionLocal
from app.models.user import User, UserRole
from app.models.admin import Admin
from app.core.security import hash_password


def seed_admin(email: str, password: str, full_name: str):
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            print(f"A user with email '{email}' already exists. Aborting.")
            sys.exit(1)

        user = User(
            email=email,
            password_hash=hash_password(password),
            role=UserRole.ADMIN,
        )
        db.add(user)
        db.flush()

        admin = Admin(user_id=user.id, full_name=full_name)
        db.add(admin)
        db.commit()

        print(f"Admin created: {email} (user_id={user.id})")
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: uv run python -m app.scripts.seed_admin <email> <password> <full_name>")
        sys.exit(1)

    seed_admin(email=sys.argv[1], password=sys.argv[2], full_name=sys.argv[3])