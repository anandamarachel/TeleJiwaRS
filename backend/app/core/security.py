from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

ph = PasswordHasher()


def hash_password(plain_password: str) -> str:
    return ph.hash(plain_password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        ph.verify(password_hash, plain_password)
        return True
    except VerifyMismatchError:
        return False