from pydantic import BaseModel, Field


class ScreeningAnswerInput(BaseModel):
    question_id: int
    score_value: int = Field(ge=0, le=3)


class ScreeningSubmitRequest(BaseModel):
    chief_complaint: str = Field(min_length=1)
    answers: list[ScreeningAnswerInput]


class ScreeningQuestionResponse(BaseModel):
    id: int
    text: str
    order_index: int


class ScreeningResponse(BaseModel):
    id: int
    chief_complaint: str
    total_score: int
    result_category: str