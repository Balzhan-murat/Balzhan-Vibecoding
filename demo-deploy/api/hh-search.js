export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query, cookie, salary_from, area = '160', limit = 30 } = req.body || {};
  if (!query || !cookie) return res.status(400).json({ error: 'query and cookie required' });

  try {
    // Build list of search queries: full phrase + individual meaningful words
    const queries = buildQueries(query);
    console.log('Search queries:', queries);

    const seen = new Set();
    const results = [];

    for (const q of queries) {
      if (results.length >= limit) break;

      // Try both hh.kz and astana.hh.kz
      for (const base of ['https://hh.kz', 'https://astana.hh.kz']) {
        const params = new URLSearchParams({
          text: q,
          area,
          search_field: 'position',
          order_by: 'relevance',
          per_page: '20',
          page: '0',
        });
        if (salary_from) params.set('salary', String(salary_from));

        const url = `${base}/search/resume?${params}`;
        console.log('Fetching:', url);

        try {
          const pageRes = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
              'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
              'Accept-Encoding': 'gzip, deflate, br',
              'Cookie': cookie,
              'Referer': 'https://hh.kz/',
              'Cache-Control': 'no-cache',
            },
            redirect: 'follow',
          });

          if (!pageRes.ok) {
            console.log('Non-OK response:', pageRes.status, url);
            continue;
          }

          const html = await pageRes.text();

          // Detect login redirect
          if (html.includes('"account/login"') || html.includes("'/account/login'") ||
              (html.includes('action="login"') && html.includes('name="login"'))) {
            return res.status(401).json({ error: 'Сессия истекла, войдите заново' });
          }

          const parsed = parseResumePage(html);
          console.log(`Found ${parsed.length} resumes for query "${q}" on ${base}`);

          for (const r of parsed) {
            const key = r.hh_id || r.full_name;
            if (key && !seen.has(key)) {
              seen.add(key);
              results.push(r);
            }
          }

        } catch (fetchErr) {
          console.error('Fetch error:', fetchErr.message);
        }

        await delay(1500);
        if (results.length >= limit) break;
      }
    }

    console.log(`Total unique resumes found: ${results.length}`);
    res.status(200).json({ resumes: results.slice(0, limit), total: results.length });

  } catch (err) {
    console.error('Handler error:', err);
    res.status(500).json({ error: err.message });
  }
}

// Build search queries: full position + individual keywords
function buildQueries(query) {
  const rawQueries = Array.isArray(query) ? query : [query];
  const allQueries = new Set();

  for (const q of rawQueries) {
    // Add full phrase
    allQueries.add(q.trim());

    // Split into individual meaningful words (3+ chars, skip common stop words)
    const stopWords = new Set(['для','при','или','над','под','что','как','все','это','той','тех','кто','где','без']);
    const words = q.split(/[\s,\/\-–—]+/)
      .map(w => w.trim().toLowerCase())
      .filter(w => w.length >= 3 && !stopWords.has(w));

    // Add individual keywords
    for (const w of words) allQueries.add(w);

    // Add pairs of adjacent words
    for (let i = 0; i < words.length - 1; i++) {
      allQueries.add(`${words[i]} ${words[i+1]}`);
    }
  }

  // Limit to 6 queries to avoid excessive requests
  return [...allQueries].slice(0, 6);
}

function parseResumePage(html) {
  const results = [];

  // Strategy 1: JSON-LD or structured data
  const jsonMatches = html.match(/resumeSerp[^{]*(\{[\s\S]{50,5000}\})/g) || [];

  // Strategy 2: Parse resume link blocks — multiple selector patterns
  // hh.kz uses different markup variants
  const patterns = [
    // Pattern A: data-qa="resume-name-link"
    { link: /data-qa="resume-name-link"[^>]*href="([^"]+)"[^>]*>([\s\S]{1,100}?)<\/a/gi },
    // Pattern B: /resume/ URL with name inside
    { link: /href="(\/resume\/[a-f0-9]+[^"]*)"[^>]*class="[^"]*resume[^"]*"[^>]*>([\s\S]{1,100}?)<\/a/gi },
    // Pattern C: applicant resume links
    { link: /href="(https?:\/\/(?:[\w]+\.)?hh\.kz\/resume\/[a-f0-9]+[^"]*)"[^>]*>([\s\S]{1,100}?)<\/a/gi },
  ];

  // Try each pattern
  for (const pat of patterns) {
    const regex = new RegExp(pat.link.source, 'gi');
    let m;
    while ((m = regex.exec(html)) !== null && results.length < 50) {
      const rawUrl = m[1];
      const rawName = m[2].replace(/<[^>]+>/g, '').trim();

      // Must look like a real name (2+ words or single word 2+ chars)
      if (!rawName || rawName.length < 2 || rawName.length > 80) continue;
      // Filter out navigation/button text
      if (/вакансии|работодател|поиск|войти|резюме|hh\.kz/i.test(rawName)) continue;

      const hh_url = rawUrl.startsWith('http') ? rawUrl : 'https://hh.kz' + rawUrl;
      const hh_id = rawUrl.match(/\/resume\/([a-f0-9]+)/)?.[1] || '';
      if (!hh_id) continue;

      // Extract surrounding context (up to 2000 chars after the link)
      const pos = html.indexOf(m[0]);
      const ctx = html.slice(Math.max(0, pos - 200), pos + 2000);

      results.push({
        hh_id,
        hh_url,
        full_name: cleanText(rawName),
        position:  extractPosition(ctx),
        city:      extractCity(ctx),
        experience_years: extractExperience(ctx),
        salary_expected:  extractSalary(ctx),
        skills:    extractSkills(ctx),
      });
    }
    if (results.length > 0) break; // Found with this pattern, stop trying others
  }

  // Strategy 3: Fallback — find all /resume/ links in page
  if (results.length === 0) {
    const resumeLinks = [...html.matchAll(/href="(\/resume\/([a-f0-9]{32,})[^"]*)"/gi)];
    for (const [, url, id] of resumeLinks.slice(0, 30)) {
      const hh_url = 'https://hh.kz' + url;
      const pos = html.indexOf(url);
      const ctx = html.slice(Math.max(0, pos - 100), pos + 1500);
      const name = extractNameFromContext(ctx);
      if (name) {
        results.push({
          hh_id: id, hh_url,
          full_name: name,
          position: extractPosition(ctx),
          city: extractCity(ctx),
          experience_years: extractExperience(ctx),
          salary_expected: extractSalary(ctx),
          skills: extractSkills(ctx),
        });
      }
    }
  }

  return results;
}

function extractNameFromContext(ctx) {
  // Look for capitalized 2-3 word sequence (Имя Фамилия or Фамилия Имя Отчество)
  const m = ctx.match(/([А-ЯЁ][а-яё]+(?:\s[А-ЯЁ][а-яё]+){1,2})/);
  if (m && m[1].length > 4 && m[1].length < 60) return m[1];
  return null;
}

function extractPosition(ctx) {
  // Try data-qa attributes first
  let m = ctx.match(/data-qa="resume-block-title-position"[^>]*>([^<]{3,80})</i);
  if (m) return cleanText(m[1]);
  m = ctx.match(/resume-block-title[^>]*>([^<]{3,80})</i);
  if (m) return cleanText(m[1]);
  // Fallback: look for job title patterns
  m = ctx.match(/<span[^>]+>([^<]{5,60}(?:менеджер|директор|специалист|начальник|инженер|технолог|оператор|мастер|руководитель|аналитик)[^<]{0,30})<\/span>/i);
  if (m) return cleanText(m[1]);
  return '';
}

function extractCity(ctx) {
  let m = ctx.match(/data-qa="resume-serp__resume-location"[^>]*>([^<]{2,40})</i);
  if (m) return cleanText(m[1]);
  m = ctx.match(/resume-location[^>]*>([^<]{2,40})</i);
  if (m) return cleanText(m[1]);
  // Common Kazakhstan cities
  m = ctx.match(/\b(Алматы|Астана|Шымкент|Актобе|Алмата|Нур-Султан|Атырау|Павлодар|Усть-Каменогорск|Семей|Тараз|Костанай|Петропавловск|Уральск)\b/i);
  if (m) return m[1];
  return '';
}

function extractExperience(ctx) {
  const m = ctx.match(/(\d+)\s*(?:лет|год|года)\s*(?:опыта|работы)?/i);
  if (m) return parseFloat(m[1]);
  const months = ctx.match(/(\d+)\s*месяц/i);
  if (months) return Math.round(parseFloat(months[1]) / 12 * 10) / 10;
  return null;
}

function extractSalary(ctx) {
  const m = ctx.match(/([\d\s]{4,10})\s*(?:₸|тенге|KZT)/i);
  if (m) return parseInt(m[1].replace(/\s/g, ''));
  return null;
}

function extractSkills(ctx) {
  const skills = [];
  const tagPattern = /data-qa="bloko-tag__text"[^>]*>([^<]{2,40})</gi;
  let m;
  while ((m = tagPattern.exec(ctx)) !== null) skills.push(cleanText(m[1]));
  // Fallback: look for skill-like spans
  if (skills.length === 0) {
    const skillSpans = ctx.match(/class="[^"]*tag[^"]*"[^>]*>([^<]{2,30})</gi) || [];
    skillSpans.slice(0, 8).forEach(s => {
      const t = s.replace(/<[^>]+>/g, '').trim();
      if (t.length > 1) skills.push(t);
    });
  }
  return [...new Set(skills)].slice(0, 8);
}

function cleanText(s) {
  return s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
          .replace(/&nbsp;/g,' ').replace(/&#\d+;/g,'').replace(/\s+/g,' ').trim();
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
