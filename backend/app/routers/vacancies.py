import asyncio
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.database import get_db
from app.models import User, SearchSession
from app.schemas import SearchSessionCreate, SearchSessionOut, VacancyAnalysis
from app.auth import get_current_user
from app.services.ai_service import analyze_vacancy
from app.services.search_service import run_search

router = APIRouter(prefix="/api/vacancies", tags=["vacancies"])


async def _extract_text_from_upload(file: UploadFile) -> str:
    content = await file.read()
    name = file.filename or ""

    if name.endswith(".pdf"):
        from pypdf import PdfReader
        import io
        reader = PdfReader(io.BytesIO(content))
        return "\n".join(page.extract_text() or "" for page in reader.pages)

    if name.endswith(".docx"):
        from docx import Document
        import io
        doc = Document(io.BytesIO(content))
        return "\n".join(p.text for p in doc.paragraphs)

    return content.decode("utf-8", errors="ignore")


@router.post("/analyze", response_model=VacancyAnalysis)
async def analyze(
    vacancy_text: str = None,
    file: UploadFile = File(None),
    current_user: User = Depends(get_current_user),
):
    if file:
        vacancy_text = await _extract_text_from_upload(file)
    if not vacancy_text:
        raise HTTPException(status_code=400, detail="Provide vacancy_text or file")
    result = await analyze_vacancy(vacancy_text)
    return result


@router.post("/search", response_model=SearchSessionOut, status_code=202)
async def start_search(
    data: SearchSessionCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = SearchSession(
        user_id=current_user.id,
        title=data.title,
        vacancy_text=data.vacancy_text,
        status="pending",
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    background_tasks.add_task(run_search, session.id)
    return session


@router.get("/sessions", response_model=list[SearchSessionOut])
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(SearchSession)
        .where(SearchSession.user_id == current_user.id)
        .order_by(desc(SearchSession.created_at))
        .limit(50)
    )
    return result.scalars().all()


@router.get("/sessions/{session_id}", response_model=SearchSessionOut)
async def get_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(SearchSession).where(
            SearchSession.id == session_id,
            SearchSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session
