from app.database import SessionLocal
from app.models.screening import ScreeningQuestion

QUESTIONS = [
    "Merasa sedih, murung, atau putus asa",
    "Kehilangan minat atau kesenangan dalam melakukan aktivitas",
    "Sulit tidur, atau tidur berlebihan",
    "Merasa lelah atau kekurangan energi",
    "Nafsu makan berkurang atau berlebihan",
    "Merasa gelisah atau cemas berlebihan",
    "Sulit berkonsentrasi",
]


def seed_questions():
    db = SessionLocal()
    try:
        for index, text in enumerate(QUESTIONS):
            existing = db.query(ScreeningQuestion).filter(ScreeningQuestion.text == text).first()
            if existing:
                continue
            db.add(ScreeningQuestion(text=text, order_index=index, is_active=True))
        db.commit()
        print(f"Seeded {len(QUESTIONS)} screening questions.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_questions()