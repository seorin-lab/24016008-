// Vercel 서버리스 함수: OpenWeather API 프록시
// - API 키를 브라우저 코드에 두지 않기 위해 서버에서 키를 붙여 대신 호출한다.
// - 키는 Vercel 환경변수 OPENWEATHER_API_KEY 에 저장한다.
// 요청 예: /api/ow?endpoint=weather&q=Seoul&units=metric&lang=kr

const ENDPOINTS = {
    weather: "https://api.openweathermap.org/data/2.5/weather",
    forecast: "https://api.openweathermap.org/data/2.5/forecast",
    air_pollution: "https://api.openweathermap.org/data/2.5/air_pollution",
    geo_direct: "https://api.openweathermap.org/geo/1.0/direct",
    geo_reverse: "https://api.openweathermap.org/geo/1.0/reverse",
};

// 그대로 전달할 수 있는 파라미터만 허용
const ALLOWED_PARAMS = ["q", "lat", "lon", "units", "lang", "limit"];

function buildUrl(query, apiKey) {
    const base = ENDPOINTS[query.endpoint];
    if (!base) return null;

    const params = new URLSearchParams();
    for (const key of ALLOWED_PARAMS) {
        if (query[key] !== undefined && query[key] !== "") params.set(key, String(query[key]));
    }
    params.set("appid", apiKey);
    return `${base}?${params}`;
}

module.exports = async function handler(req, res) {
    const apiKey = (process.env.OPENWEATHER_API_KEY || "").trim();
    if (!apiKey) {
        return res.status(500).json({ error: "OPENWEATHER_API_KEY 환경변수가 설정되지 않았습니다." });
    }

    const url = buildUrl(req.query, apiKey);
    if (!url) {
        return res.status(400).json({ error: `지원하지 않는 endpoint 입니다: ${req.query.endpoint}` });
    }

    try {
        const upstream = await fetch(url);
        const body = await upstream.text();
        // 날씨는 자주 바뀌지 않으므로 5분 캐시 (지명 검색 결과도 함께 캐시됨)
        if (upstream.ok) res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=300");
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        return res.status(upstream.status).send(body);
    } catch (err) {
        console.error(err);
        return res.status(502).json({ error: "OpenWeather 호출에 실패했습니다." });
    }
};

module.exports.buildUrl = buildUrl;
