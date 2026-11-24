// Vercel 서버리스 함수: 기상청 단기예보 조회서비스(공공데이터포털) 프록시
// - 브라우저에서 직접 호출하면 CORS로 막히고 서비스 키가 노출되므로 서버에서 대신 호출한다.
// - 서비스 키는 Vercel 환경변수 KMA_SERVICE_KEY 에 "Decoding" 키로 저장한다.
// 요청: /api/kma?lat=37.56&lon=126.97
// 응답: { source: "kma", current: {...}, daily: [{ date, tmin, tmax, id, description, icon }, ...] } (기온은 섭씨)

const KMA_BASE = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0";

// 위경도 → 기상청 격자 좌표(nx, ny) 변환 (기상청 제공 LCC DFS 공식)
function latLonToGrid(lat, lon) {
    const RE = 6371.00877, GRID = 5.0, SLAT1 = 30.0, SLAT2 = 60.0, OLON = 126.0, OLAT = 38.0, XO = 43, YO = 136;
    const DEGRAD = Math.PI / 180.0;
    const re = RE / GRID;
    const slat1 = SLAT1 * DEGRAD, slat2 = SLAT2 * DEGRAD, olon = OLON * DEGRAD, olat = OLAT * DEGRAD;

    let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
    sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
    let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
    sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
    let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
    ro = (re * sf) / Math.pow(ro, sn);

    let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
    ra = (re * sf) / Math.pow(ra, sn);
    let theta = lon * DEGRAD - olon;
    if (theta > Math.PI) theta -= 2.0 * Math.PI;
    if (theta < -Math.PI) theta += 2.0 * Math.PI;
    theta *= sn;

    return {
        nx: Math.floor(ra * Math.sin(theta) + XO + 0.5),
        ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5),
    };
}

// 한국 시간(KST) 기준 날짜/시각 계산용: UTC getter로 읽으면 KST 값이 된다
function kstDate(ms) {
    return new Date(ms + 9 * 60 * 60 * 1000);
}

function ymd(d) {
    return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}

function hh(h) {
    return `${String(h).padStart(2, "0")}00`;
}

// 초단기실황: 매시 정각 자료가 약 40분 이후에 제공된다
function ncstBase(nowMs) {
    const d = kstDate(nowMs - 40 * 60 * 1000);
    return { base_date: ymd(d), base_time: hh(d.getUTCHours()) };
}

// 단기예보: 02, 05, 08, 11, 14, 17, 20, 23시 발표, 약 10분 이후 제공
function vilageBase(nowMs) {
    const d = kstDate(nowMs - 10 * 60 * 1000);
    const hour = d.getUTCHours();
    const slots = [2, 5, 8, 11, 14, 17, 20, 23].filter((h) => h <= hour);
    if (slots.length) {
        return { base_date: ymd(d), base_time: hh(slots[slots.length - 1]) };
    }
    const prev = new Date(d.getTime() - 24 * 60 * 60 * 1000);
    return { base_date: ymd(prev), base_time: "2300" };
}

// 기상청 코드 → OpenWeather 형식(id, 아이콘)으로 변환해서 기존 화면 코드(배경, 옷차림, 아이콘)를 그대로 쓴다
function toWeather(sky, pty, isDay) {
    const s = isDay ? "d" : "n";
    const PTY = {
        1: { id: 500, description: "비", icon: "10" },
        2: { id: 616, description: "비/눈", icon: "13" },
        3: { id: 600, description: "눈", icon: "13" },
        4: { id: 521, description: "소나기", icon: "09" },
        5: { id: 300, description: "빗방울", icon: "09" },
        6: { id: 615, description: "빗방울/눈날림", icon: "13" },
        7: { id: 600, description: "눈날림", icon: "13" },
    };
    const SKY = {
        1: { id: 800, description: "맑음", icon: "01" },
        3: { id: 803, description: "구름많음", icon: "03" },
        4: { id: 804, description: "흐림", icon: "04" },
    };
    const w = PTY[pty] || SKY[sky] || SKY[1];
    return { id: w.id, description: w.description, icon: w.icon + s };
}

async function callKma(operation, params, serviceKey) {
    const qs = new URLSearchParams({
        serviceKey,
        pageNo: "1",
        numOfRows: "1000",
        dataType: "JSON",
        ...params,
    });
    const res = await fetch(`${KMA_BASE}/${operation}?${qs}`);
    const text = await res.text();

    // 키 오류 등은 dataType=JSON 이어도 XML로 응답하는 경우가 있다
    let json;
    try {
        json = JSON.parse(text);
    } catch {
        throw new Error(`${operation} 응답 오류: ${text.slice(0, 200)}`);
    }
    const header = json.response && json.response.header;
    if (!header || header.resultCode !== "00") {
        throw new Error(`${operation} 결과 오류: ${header ? header.resultMsg : "응답 형식 이상"}`);
    }
    return json.response.body.items.item;
}

// 단기예보 항목 목록 → { "YYYYMMDD": { "HHMM": { TMP, SKY, PTY, TMN, TMX, ... } } }
function groupForecast(items) {
    const byDate = {};
    for (const it of items) {
        byDate[it.fcstDate] = byDate[it.fcstDate] || {};
        byDate[it.fcstDate][it.fcstTime] = byDate[it.fcstDate][it.fcstTime] || {};
        byDate[it.fcstDate][it.fcstTime][it.category] = it.fcstValue;
    }
    return byDate;
}

// 오늘·내일·모레 3일 요약 (최저/최고 기온 + 대표 날씨)
function summarizeDaily(byDate, nowMs, currentTemp) {
    const days = [];
    for (let i = 0; i < 3; i++) {
        const date = ymd(kstDate(nowMs + i * 24 * 60 * 60 * 1000));
        const hours = byDate[date];
        if (!hours) continue;

        const entries = Object.entries(hours).sort(([a], [b]) => a.localeCompare(b));
        const temps = entries.map(([, v]) => Number(v.TMP)).filter((t) => !Number.isNaN(t));
        if (i === 0 && typeof currentTemp === "number") temps.push(currentTemp);

        let tmin = Math.min(...temps);
        let tmax = Math.max(...temps);
        for (const [, v] of entries) {
            if (v.TMN !== undefined) tmin = Number(v.TMN);
            if (v.TMX !== undefined) tmax = Number(v.TMX);
        }

        // 대표 날씨: 낮 시간(06~21시)에 강수가 있으면 강수 형태, 없으면 정오(없으면 가장 가까운 시각)의 하늘 상태
        const daytime = entries.filter(([t]) => t >= "0600" && t <= "2100");
        const rainy = daytime.find(([, v]) => Number(v.PTY) > 0);
        const noon = hours["1200"] || (daytime[0] || entries[0])[1];
        const weather = rainy
            ? toWeather(Number(rainy[1].SKY), Number(rainy[1].PTY), true)
            : toWeather(Number(noon.SKY), 0, true);

        days.push({ date, tmin: Math.round(tmin), tmax: Math.round(tmax), ...weather });
    }
    return days;
}

async function getKmaWeather(lat, lon, serviceKey, nowMs = Date.now()) {
    const { nx, ny } = latLonToGrid(lat, lon);

    const [ncstItems, fcstItems] = await Promise.all([
        callKma("getUltraSrtNcst", { ...ncstBase(nowMs), nx, ny }, serviceKey),
        callKma("getVilageFcst", { ...vilageBase(nowMs), nx, ny }, serviceKey),
    ]);

    const ncst = {};
    for (const it of ncstItems) ncst[it.category] = Number(it.obsrValue);

    const byDate = groupForecast(fcstItems);

    // 실황에는 하늘 상태(SKY)가 없으므로 단기예보에서 현재 시각 이후 가장 가까운 SKY를 가져온다
    const now = kstDate(nowMs);
    const nowKey = ymd(now) + hh(now.getUTCHours());
    const nextSlot = fcstItems
        .filter((it) => it.category === "SKY" && it.fcstDate + it.fcstTime >= nowKey)
        .sort((a, b) => (a.fcstDate + a.fcstTime).localeCompare(b.fcstDate + b.fcstTime))[0];
    const hour = now.getUTCHours();
    const isDay = hour >= 6 && hour < 19;

    const current = {
        temp: ncst.T1H,
        humidity: ncst.REH,
        wind: ncst.WSD,
        ...toWeather(nextSlot ? Number(nextSlot.fcstValue) : 1, ncst.PTY || 0, isDay),
    };

    return { source: "kma", grid: { nx, ny }, current, daily: summarizeDaily(byDate, nowMs, current.temp) };
}

module.exports = async function handler(req, res) {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    // Encoding 키(%2B 등 포함)를 넣어도 동작하도록 디코딩해서 사용 (URLSearchParams가 다시 인코딩함)
    const rawKey = (process.env.KMA_SERVICE_KEY || "").trim();
    let serviceKey = rawKey;
    try {
        if (rawKey.includes("%")) serviceKey = decodeURIComponent(rawKey);
    } catch {
        serviceKey = rawKey;
    }

    if (!serviceKey) {
        return res.status(500).json({ error: "KMA_SERVICE_KEY 환경변수가 설정되지 않았습니다." });
    }
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
        return res.status(400).json({ error: "lat, lon 파라미터가 필요합니다." });
    }

    try {
        const data = await getKmaWeather(lat, lon, serviceKey);
        // 기상청 자료는 1시간 단위로 갱신되므로 10분 캐시
        res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=300");
        return res.status(200).json(data);
    } catch (err) {
        console.error(err);
        return res.status(502).json({ error: err.message });
    }
};

// 테스트용으로 내부 함수도 내보낸다
module.exports.getKmaWeather = getKmaWeather;
module.exports.latLonToGrid = latLonToGrid;
module.exports.ncstBase = ncstBase;
module.exports.vilageBase = vilageBase;
