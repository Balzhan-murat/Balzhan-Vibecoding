from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
import io
from app.database import get_db
from app.models import User, Candidate, SearchSession
from app.schemas import CandidateOut
from app.auth import get_current_user
from app.services.ai_service import generate_interview_questions
from app.services.export_service import export_to_excel, export_to_word, export_to_pdf

router = APIRouter(prefix="/api/candidates", tags=["candidates"])


@router.get("/session/{session_id}", response_model=list[CandidateOut])
async def list_candidates(
    session_id: int,
    sort_by: str = "match_score",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sess_result = await db.execute(
        select(SearchSession).where(
            SearchSession.id == session_id,
            SearchSession.user_id == current_user.id,
        )
    )
    if not sess_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Session not found")

    result = await db.execute(
        select(Candidate)
        .where(Candidate.session_id == session_id)
        .order_by(desc(Candidate.match_score))
    )
    return result.scalars().all()


@router.get("/{candidate_id}", response_model=CandidateOut)
async def get_candidate(
    candidate_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate


@router.post("/{candidate_id}/interview-questions", response_model=CandidateOut)
async def generate_questions(
    candidate_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    sess_result = await db.execute(select(SearchSession).where(SearchSession.id == candidate.session_id))
    session = sess_result.scalar_one_or_none()

    analysis = session.vacancy_analysis or {}
    requirements = analysis.get("required", []) + analysis.get("hard_skills", [])
    candidate_summary = f"{candidate.full_name}, {candidate.position}, опыт {candidate.experience_years} лет. {candidate.ai_summary or ''}"

    questions = await generate_interview_questions(
        position=analysis.get("position", ""),
        requirements=requirements,
        candidate_summary=candidate_summary,
    )
    candidate.interview_questions = questions
    await db.commit()
    await db.refresh(candidate)
    return candidate


@router.get("/session/{session_id}/export")
async def export_results(
    session_id: int,
    format: str = "excel",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sess_result = await db.execute(
        select(SearchSession).where(
            SearchSession.id == session_id,
            SearchSession.user_id == current_user.id,
        )
    )
    session = sess_result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    cand_result = await db.execute(
        select(Candidate).where(Candidate.session_id == session_id).order_by(desc(Candidate.match_score))
    )
    candidates = cand_result.scalars().all()

    if format == "excel":
        data = export_to_excel(session, candidates)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"candidates_{session_id}.xlsx"
    elif format == "word":
        data = export_to_word(session, candidates)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        filename = f"candidates_{session_id}.docx"
    elif format == "pdf":
        data = export_to_pdf(session, candidates)
        media_type = "application/pdf"
        filename = f"candidates_{session_id}.pdf"
    else:
        raise HTTPException(status_code=400, detail="Invalid format. Use: excel, word, pdf")

    return StreamingResponse(
        io.BytesIO(data),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
