export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  try {
    // Step 1: GET login page to grab XSRF token and cookies
    const loginPageRes = await fetch('https://hh.kz/account/login?backurl=%2F', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
    });

    const rawCookies = loginPageRes.headers.getSetCookie?.() || [];
    const cookieHeader = rawCookies.map(c => c.split(';')[0]).join('; ');
    const html = await loginPageRes.text();

    // Extract XSRF token from meta or hidden input
    let xsrf = '';
    const xsrfMeta = html.match(/<meta[^>]+name=["']_xsrf["'][^>]+content=["']([^"']+)["']/i);
    const xsrfInput = html.match(/name=["']_xsrf["'][^>]+value=["']([^"']+)["']/i)
      || html.match(/value=["']([^"']+)["'][^>]+name=["']_xsrf["']/i);
    if (xsrfMeta) xsrf = xsrfMeta[1];
    else if (xsrfInput) xsrf = xsrfInput[1];

    // Step 2: POST login form
    const formData = new URLSearchParams({
      _xsrf: xsrf,
      'account-type-selection': 'applicant',
      login: email,
      password: password,
      remember: 'yes',
      action: 'login',
    });

    const loginRes = await fetch('https://hh.kz/account/login?backurl=%2F', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://hh.kz/account/login',
        'Origin': 'https://hh.kz',
        'Cookie': cookieHeader,
      },
      body: formData.toString(),
      redirect: 'manual',
    });

    // Collect all cookies from login response
    const loginCookies = loginRes.headers.getSetCookie?.() || [];
    const allCookies = [
      ...rawCookies.map(c => c.split(';')[0]),
      ...loginCookies.map(c => c.split(';')[0]),
    ];
    const sessionCookie = allCookies.join('; ');

    // Check if login succeeded (should redirect away from /account/login)
    const location = loginRes.headers.get('location') || '';
    if (location.includes('/account/login') || loginRes.status === 200) {
      // Verify by trying a protected page
      const checkRes = await fetch('https://hh.kz/employer/resumes', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
          'Cookie': sessionCookie,
        },
        redirect: 'manual',
      });
      const checkLocation = checkRes.headers.get('location') || '';
      if (checkLocation.includes('login')) {
        return res.status(401).json({ error: 'Неверный email или пароль hh.kz' });
      }
    }

    res.status(200).json({ cookie: sessionCookie, ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
