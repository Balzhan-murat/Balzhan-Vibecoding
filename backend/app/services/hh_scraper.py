"""
hh.kz scraper using Playwright.
Logs in with the corporate account and scrapes resume listings.
"""
import asyncio
import random
import logging
from typing import Optional
from playwright.async_api import async_playwright, Page, Browser

logger = logging.getLogger(__name__)

HH_BASE = "https://hh.kz"
HH_LOGIN_URL = f"{HH_BASE}/account/login"
HH_RESUME_SEARCH = f"{HH_BASE}/search/resume"


class HHScraper:
    def __init__(self, email: str, password: str):
        self.email = email
        self.password = password
        self._browser: Optional[Browser] = None
        self._page: Optional[Page] = None

    async def __aenter__(self):
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        context = await self._browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            locale="ru-KZ",
            timezone_id="Asia/Almaty",
        )
        self._page = await context.new_page()
        return self

    async def __aexit__(self, *_):
        if self._browser:
            await self._browser.close()
        await self._playwright.stop()

    async def login(self) -> bool:
        try:
            await self._page.goto(HH_LOGIN_URL, wait_until="networkidle")
            await self._page.fill('input[name="login"]', self.email)
            await self._page.fill('input[name="password"]', self.password)
            await self._page.click('button[type="submit"]')
            await self._page.wait_for_url(lambda url: "login" not in url, timeout=15000)
            logger.info("hh.kz login successful")
            return True
        except Exception as e:
            logger.error(f"hh.kz login failed: {e}")
            return False

    async def search_resumes(
        self,
        query: str,
        area: str = "159",  # Kazakhstan
        experience: Optional[str] = None,
        salary_from: Optional[int] = None,
        limit: int = 50,
    ) -> list[dict]:
        params = {
            "text": query,
            "area": area,
            "search_field": "position",
        }
        if experience:
            params["experience"] = experience
        if salary_from:
            params["salary"] = str(salary_from)

        query_string = "&".join(f"{k}={v}" for k, v in params.items())
        url = f"{HH_RESUME_SEARCH}?{query_string}"

        await self._page.goto(url, wait_until="networkidle")
        await self._random_delay(2, 4)

        resumes = []
        page_num = 0

        while len(resumes) < limit:
            cards = await self._extract_resume_cards()
            resumes.extend(cards)

            if len(resumes) >= limit:
                break

            next_btn = await self._page.query_selector('a[data-qa="pager-next"]')
            if not next_btn:
                break

            await next_btn.click()
            await self._page.wait_for_load_state("networkidle")
            await self._random_delay(3, 8)
            page_num += 1

            if page_num > 10:
                break

        return resumes[:limit]

    async def _extract_resume_cards(self) -> list[dict]:
        cards = []
        items = await self._page.query_selector_all('[data-qa="resume-serp__results-item"]')

        for item in items:
            try:
                card = await self._parse_resume_card(item)
                if card:
                    cards.append(card)
            except Exception as e:
                logger.warning(f"Failed to parse resume card: {e}")

        return cards

    async def _parse_resume_card(self, item) -> Optional[dict]:
        name_el = await item.query_selector('[data-qa="resume-name-link"]')
        if not name_el:
            return None

        name = await name_el.inner_text()
        url = await name_el.get_attribute("href")
        if url and not url.startswith("http"):
            url = HH_BASE + url

        position_el = await item.query_selector('[data-qa="resume-block-title-position"]')
        position = await position_el.inner_text() if position_el else ""

        city_el = await item.query_selector('[data-qa="resume-serp__resume-location"]')
        city = await city_el.inner_text() if city_el else ""

        experience_el = await item.query_selector('[data-qa="resume-block-experience-duration"]')
        experience_text = await experience_el.inner_text() if experience_el else ""
        experience_years = _parse_experience_years(experience_text)

        salary_el = await item.query_selector('[data-qa="resume-block-salary"]')
        salary_text = await salary_el.inner_text() if salary_el else ""
        salary = _parse_salary(salary_text)

        skills_els = await item.query_selector_all('[data-qa="bloko-tag__text"]')
        skills = [await el.inner_text() for el in skills_els]

        hh_id = url.split("/")[-1].split("?")[0] if url else None

        return {
            "hh_id": hh_id,
            "hh_url": url,
            "full_name": name.strip(),
            "position": position.strip(),
            "city": city.strip(),
            "experience_years": experience_years,
            "salary_expected": salary,
            "skills": skills,
        }

    async def get_resume_details(self, url: str) -> dict:
        await self._page.goto(url, wait_until="networkidle")
        await self._random_delay(3, 6)

        education_el = await self._page.query_selector('[data-qa="resume-block-education"]')
        education = await education_el.inner_text() if education_el else ""

        work_history = []
        work_items = await self._page.query_selector_all('[data-qa="resume-block-experience-item"]')
        for w in work_items[:5]:
            title_el = await w.query_selector('[data-qa="resume-block-experience-position"]')
            company_el = await w.query_selector('[data-qa="resume-block-experience-company"]')
            period_el = await w.query_selector('[data-qa="resume-block-experience-timeInterval"]')
            work_history.append(
                {
                    "position": await title_el.inner_text() if title_el else "",
                    "company": await company_el.inner_text() if company_el else "",
                    "period": await period_el.inner_text() if period_el else "",
                }
            )

        return {"education": education.strip(), "work_history": work_history}

    @staticmethod
    async def _random_delay(min_s: float, max_s: float):
        await asyncio.sleep(random.uniform(min_s, max_s))


def _parse_experience_years(text: str) -> Optional[float]:
    import re
    text = text.lower()
    years = re.search(r"(\d+)\s*(лет|год|года)", text)
    months = re.search(r"(\d+)\s*(месяц|месяца|месяцев)", text)
    total = 0.0
    if years:
        total += float(years.group(1))
    if months:
        total += float(months.group(1)) / 12
    return round(total, 1) if total > 0 else None


def _parse_salary(text: str) -> Optional[int]:
    import re
    digits = re.sub(r"[^\d]", "", text)
    return int(digits) if digits else None
