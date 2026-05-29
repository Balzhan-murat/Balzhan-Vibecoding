export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query, cookie, salary_from, area = '160', limit = 20 } = req.body || {};
  if (!query || !cookie) return res.status(400).json({ error: 'query and cookie required' });

  try {
    const results = [];
    const queries = Array.isArray(query) ? query : [query];

    for (const q of queries.slice(0, 3)) {
      const params = new URLSearchParams({
        text: q,
        area,
        search_field: 'position',
        order_by: 'relevance',
        per_page: '20',
        page: '0',
      });
      if (salary_from) params.set('salary', String(salary_from));

      const url = `https://hh.kz/search/resume?${params}`;
      const pageRes = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ru-RU,ru;q=0.9',
          'Cookie': cookie,
          'Referer': 'https://hh.kz/',
        },
        redirect: 'follow',
      });

      if (!pageRes.ok) continue;
      const html = await pageRes.text();

      // Check redirect to login
      if (html.includes('account/login') && html.includes('action="login"')) {
        return res.status(401).json({ error: 'Сессия истекла, войдите заново' });
      }

      const parsed = parseResumes(html);
      for (const r of parsed) {
        if (!results.find(x => x.hh_id === r.hh_id)) results.push(r);
      }

      if (results.length >= limit) break;
      // Polite delay
      await delay(2000);
    }

    res.status(200).json({ resumes: results.slice(0, limit), total: results.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function parseResumes(html) {
  const results = [];

  // Match resume cards — hh.kz uses data-qa="resume-serp__results-item"
  const cardPattern = /data-qa="resume-serp__results-item"[\s\S]*?(?=data-qa="resume-serp__results-item"|<\/ul>|id="pager")/g;
  const cards = html.match(cardPattern) || [];

  // If new markup not found, try alternative block matching
  const blocks = cards.length > 0 ? cards : extractResumeBlocks(html);

  for (const block of blocks.slice(0, 25)) {
    try {
      // Name + URL
      const nameMatch = block.match(/data-qa="resume-name-link"[^>]*href="([^"]+)"[^>]*>([^<]+)/i)
        || block.match(/href="(\/resume\/[^"?]+)[^"]*"[^>]*>([^<]{3,60})<\/a>/i);

      if (!nameMatch) continue;
      const rawUrl = nameMatch[1];
      const hh_url = rawUrl.startsWith('http') ? rawUrl : 'https://hh.kz' + rawUrl;
      const hh_id = rawUrl.split('/').filter(Boolean).pop()?.split('?')[0] || '';
      const full_name = cleanText(nameMatch[2]);

      if (!full_name || full_name.length < 2) continue;

      // Position
      const posMatch = block.match(/data-qa="resume-block-title-position"[^>]*>([^<]+)/i)
        || block.match(/resume-block-title[^>]*>([^<]{3,80})<\/[a-z]/i);
      const position = posMatch ? cleanText(posMatch[1]) : '';

      // City
      const cityMatch = block.match(/data-qa="resume-serp__resume-location"[^>]*>([^<]+)/i)
        || block.match(/resume-location[^>]*>([^<]{2,30})<\/[a-z]/i);
      const city = cityMatch ? cleanText(cityMatch[1]) : '';

      // Experience
      const expMatch = block.match(/(\d+)\s*(?:лет|год|года)\s*(?:опыта|работы)?/i);
      const experience_years = expMatch ? parseFloat(expMatch[1]) : null;

      // Salary
      const salMatch = block.match(/([\d\s]+)\s*(?:₸|тенге|KZT|руб|₽)/i);
      const salary_expected = salMatch ? parseInt(salMatch[1].replace(/\s/g, '')) : null;

      // Skills
      const skillMatches = [...block.matchAll(/data-qa="bloko-tag__text"[^>]*>([^<]+)/gi)];
      const skills = skillMatches.map(m => cleanText(m[1])).filter(Boolean);

      results.push({ hh_id, hh_url, full_name, position, city, experience_years, salary_expected, skills });
    } catch (_) { /* skip bad card */ }
  }

  return results;
}

function extractResumeBlocks(html) {
  // Fallback: split by resume links pattern
  const blocks = [];
  const splitPattern = /<div[^>]+class="[^"]*resume-search-item[^"]*"/gi;
  const parts = html.split(splitPattern);
  for (let i = 1; i < parts.length; i++) blocks.push(parts[i].substring(0, 3000));
  return blocks;
}

function cleanText(str) {
  return str.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}
