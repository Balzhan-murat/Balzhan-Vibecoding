"""
Orchestrates: vacancy analysis → hh.kz search → AI scoring → save to DB.
"""
import logging
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models import SearchSession, Candidate
from app.services.ai_service import analyze_vacancy, score_candidate
from app.services.hh_scraper import HHScraper
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def run_search(session_id: int) -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(SearchSession).where(SearchSession.id == session_id))
        session = result.scalar_one_or_none()
        if not session:
            return

        session.status = "analyzing"
        await db.commit()

        try:
            analysis = await analyze_vacancy(session.vacancy_text)
            session.vacancy_analysis = analysis
            session.status = "searching"
            await db.commit()

            queries = [analysis["position"]] + analysis.get("search_synonyms", [])[:3]

            raw_resumes: list[dict] = []
            async with HHScraper(settings.hh_email, settings.hh_password) as scraper:
                logged_in = await scraper.login()
                if not logged_in:
                    session.status = "error"
                    await db.commit()
                    return

                seen_ids: set[str] = set()
                for query in queries:
                    resumes = await scraper.search_resumes(
                        query=query,
                        salary_from=analysis.get("salary_from"),
                        limit=50,
                    )
                    for r in resumes:
                        hh_id = r.get("hh_id")
                        if hh_id and hh_id not in seen_ids:
                            seen_ids.add(hh_id)
                            raw_resumes.append(r)

                    if len(raw_resumes) >= 200:
                        break

            session.status = "scoring"
            session.total_found = len(raw_resumes)
            await db.commit()

            for raw in raw_resumes[:200]:
                try:
                    scoring = await score_candidate(analysis, raw)
                    candidate = Candidate(
                        session_id=session_id,
                        hh_id=raw.get("hh_id"),
                        hh_url=raw.get("hh_url"),
                        full_name=raw.get("full_name", ""),
                        position=raw.get("position"),
                        city=raw.get("city"),
                        experience_years=raw.get("experience_years"),
                        salary_expected=raw.get("salary_expected"),
                        skills=raw.get("skills", []),
                        raw_resume=raw,
                        match_score=scoring.get("match_score"),
                        experience_score=scoring.get("experience_score"),
                        skills_score=scoring.get("skills_score"),
                        industry_score=scoring.get("industry_score"),
                        education_score=scoring.get("education_score"),
                        pros=scoring.get("pros", []),
                        cons=scoring.get("cons", []),
                        recommendation=scoring.get("recommendation"),
                        ai_summary=scoring.get("ai_summary"),
                    )
                    db.add(candidate)
                except Exception as e:
                    logger.warning(f"Scoring failed for candidate {raw.get('full_name')}: {e}")

            await db.commit()
            session.status = "completed"
            await db.commit()

        except Exception as e:
            logger.error(f"Search session {session_id} failed: {e}")
            session.status = "error"
            await db.commit()
