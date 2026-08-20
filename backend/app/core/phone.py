import re

def normalize_indonesian_phone(raw: str) -> str:
    digits = re.sub(r"\D", "", raw)

    if digits.startswith("0"):
        digits = "62" + digits[1:]
    elif digits.startswith("62"):
        pass
    else:
        digits = "62" + digits

    return digits