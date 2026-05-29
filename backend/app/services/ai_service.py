import json
from anthropic import AsyncAnthropic
from app.config import get_settings

settings = get_settings()
client = AsyncAnthropic(api_key=settings.anthropic_api_key)


VACANCY_ANALYSIS_PROMPT = """Ты — эксперт по подбору персонала. Проанализируй текст вакансии и извлеки структурированную информацию.

Верни ТОЛЬКО валидный JSON в следующем формате (без markdown, без пояснений):
{{
  "position": "название должности",
  "experience_required": "требуемый опыт (например: 3-5 лет)",
  "education": "требуемое образование",
  "hard_skills": ["навык1", "навык2"],
  "soft_skills": ["качество1", "качество2"],
  "required": ["обязательное требование 1", "обязательное требование 2"],
  "preferred": ["желательное требование 1"],
  "location": "город/регион",
  "salary_from": null,
  "salary_to": null,
  "search_synonyms": ["синоним должности 1", "синоним на английском", "альтернативное название"]
}}

Текст вакансии:
{vacancy_text}"""


SCORING_PROMPT = """Ты — эксперт по подбору персонала. Оцени соответствие кандидата вакансии.

Вакансия (требования):
{vacancy_analysis}

Резюме кандидата:
{resume_data}

Верни ТОЛЬКО валидный JSON (без markdown):
{{
  "experience_score": 0-100,
  "skills_score": 0-100,
  "industry_score": 0-100,
  "education_score": 0-100,
  "match_score": 0-100,
  "pros": ["сильная сторона 1", "сильная сторона 2"],
  "cons": ["риск 1", "риск 2"],
  "recommendation": "green|yellow|red",
  "ai_summary": "краткое обоснование рекомендации (2-3 предложения)"
}}

Веса для match_score: опыт 35%, навыки 30%, отрасль 20%, образование 15%."""


INTERVIEW_QUESTIONS_PROMPT = """Ты — опытный HR-специалист. Сгенерируй вопросы для собеседования.

Вакансия: {position}
Требования: {requirements}
Профиль кандидата: {candidate_summary}

Верни ТОЛЬКО валидный JSON (без markdown):
{{
  "competency_questions": ["вопрос 1", "вопрос 2", "вопрос 3"],
  "technical_questions": ["вопрос 1", "вопрос 2", "вопрос 3"],
  "values_questions": ["вопрос 1", "вопрос 2"],
  "red_flag_questions": ["вопрос для проверки риска 1"]
}}"""


async def analyze_vacancy(vacancy_text: str) -> dict:
    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": VACANCY_ANALYSIS_PROMPT.format(vacancy_text=vacancy_text)}],
    )
    text = message.content[0].text.strip()
    return json.loads(text)


async def score_candidate(vacancy_analysis: dict, resume_data: dict) -> dict:
    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": SCORING_PROMPT.format(
                    vacancy_analysis=json.dumps(vacancy_analysis, ensure_ascii=False),
                    resume_data=json.dumps(resume_data, ensure_ascii=False),
                ),
            }
        ],
    )
    text = message.content[0].text.strip()
    return json.loads(text)


async def generate_interview_questions(position: str, requirements: list[str], candidate_summary: str) -> dict:
    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": INTERVIEW_QUESTIONS_PROMPT.format(
                    position=position,
                    requirements=", ".join(requirements),
                    candidate_summary=candidate_summary,
                ),
            }
        ],
    )
    text = message.content[0].text.strip()
    return json.loads(text)
