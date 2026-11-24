// 기본 설정
const API_KEY = "52a950fa1c64eff9a9b1961314e600d2";
const BASE_URL = "https://api.openweathermap.org/data/2.5";

let currentUnits = "metric"; // "metric" = 섭씨, "imperial" = 화씨
let lastCity = null;

// 전역 변수에 영어 도시명도 저장
let lastCityEnglish = null;

// DOM 요소
const cityInput = document.querySelector("#cityInput");
const searchBtn = document.querySelector("#searchBtn");
const unitToggleBtn = document.querySelector("#unitToggle");
const errorBox = document.querySelector("#errorBox");

const cityNameEl = document.querySelector("#cityName");
const descEl = document.querySelector("#description");
const tempEl = document.querySelector("#temp");
const iconEl = document.querySelector("#icon");
const humidityEl = document.querySelector("#humidity");
const windEl = document.querySelector("#wind");
const forecastListEl = document.querySelector("#forecastList");
const recentListEl = document.querySelector("#recentList");
const outfitTextEl = document.querySelector("#outfitText");

// DOM 요소에 지도 추가 (기존 코드 수정)
const mapSectionEl = document.querySelector("#mapSection");

// 지도 변수
let map = null;

// DOM 요소에 미세먼지 관련 추가
const airPollutionSectionEl = document.querySelector("#airPollutionSection");
const aqiLevelEl = document.querySelector("#aqiLevel");
const aqiDescriptionEl = document.querySelector("#aqiDescription");
const pm25El = document.querySelector("#pm25");
const pm10El = document.querySelector("#pm10");
const o3El = document.querySelector("#o3");

// 오류 표시
function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.remove("hidden");
}

function clearError() {
    errorBox.classList.add("hidden");
    errorBox.textContent = "";
}

// 배경 테마
function getThemeByWeather(weather) {
    const id = weather.id;
    const hour = new Date().getHours();

  // 밤
    if (hour < 6 || hour >= 20) return "night";
  // 비/눈
    if (id >= 200 && id < 600) return "rain";
  // 맑음
    if (id >= 800 && id < 803) return "clear";
  // 그 외 구름
    return "clouds";
}

function updateBackground(weather) {
    const theme = getThemeByWeather(weather);
    document.body.dataset.theme = theme;
}

// localStorage - 최근 검색어
const STORAGE_KEY = "recentCities";

function loadRecentCities() {
    try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
    } catch {
    return [];
    }
}

function saveRecentCities(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function addRecentCity(city) {
    let list = loadRecentCities();
    list = [city, ...list.filter((c) => c.toLowerCase() !== city.toLowerCase())];
    if (list.length > 5) list = list.slice(0, 5);
    saveRecentCities(list);
    renderRecentCities();
}

function renderRecentCities() {
    const list = loadRecentCities();
    recentListEl.innerHTML = "";
    list.forEach((city) => {
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.textContent = city;
    btn.addEventListener("click", () => {
        cityInput.value = city;
        handleSearch(city);
    });
    recentListEl.appendChild(btn);
    });
}

// API 호출
async function fetchWeather(city) {
    const url = `${BASE_URL}/weather?q=${encodeURIComponent(
        city
    )}&appid=${API_KEY}&units=${currentUnits}&lang=kr`;

    const res = await fetch(url);
    if (!res.ok) {
        throw new Error("도시를 찾을 수 없거나 API 오류입니다.");
    }
    return res.json();
}

// 예보 데이터 가져오기 함수
async function fetchForecast(cityName) {
    try {
        const response = await fetch(
            `${BASE_URL}/forecast?q=${cityName}&appid=${API_KEY}&units=${currentUnits}&lang=kr`
        );
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data; // 데이터 반환
        
    } catch (error) {
        console.error("예보 데이터 가져오기 실패:", error);
        throw error; // 에러를 다시 던짐
    }
}

// 미세먼지 데이터 가져오기
async function fetchAirPollution(lat, lon) {
    try {
        const response = await fetch(
            `${BASE_URL}/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`
        );
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data;
        
    } catch (error) {
        console.error("미세먼지 데이터 가져오기 실패:", error);
        throw error;
    }
}

// UI 업데이트 - 현재 날씨
function displayCurrentWeather(data) {
    if (!data) return;
    
    const { name } = data;
    const { temp, humidity } = data.main;
    const { speed } = data.wind;
    const weather = data.weather[0];

    cityNameEl.textContent = name || "---";
    descEl.textContent = weather.description || "---";
    tempEl.textContent = `${Math.round(temp)}°`;
    humidityEl.textContent = `${humidity}%`;
    windEl.textContent = `${Math.round(speed * 10) / 10} m/s`;

    iconEl.src = `https://openweathermap.org/img/wn/${weather.icon}@2x.png`;
    iconEl.classList.remove("hidden");

    updateBackground(weather);
    updateOutfitSuggestion(temp, weather);

    // 영어 도시명 저장 (API 응답에서 온 정확한 이름)
    lastCityEnglish = name;

    // 지도 표시
    if (data.coord && data.coord.lat && data.coord.lon) {
        console.log('지도 표시:', data.coord.lat, data.coord.lon, data.name);
        displayMap(data.coord.lat, data.coord.lon, data.name);
    }
}

// UI 업데이트 - 예보
// days: [{ date: "YYYYMMDD", tmin, tmax, description, icon }] (기온은 현재 단위 기준)
function displayForecast(days) {
    const forecastListEl = document.querySelector("#forecastList");
    if (!forecastListEl || !Array.isArray(days)) {
        console.error("예보 데이터가 없습니다:", days);
        return;
    }

    forecastListEl.innerHTML = "";
    const labels = ["오늘", "내일", "모레"];

    days.slice(0, 3).forEach((d, index) => {
        const month = Number(d.date.slice(4, 6));
        const day = Number(d.date.slice(6, 8));

        const forecastItem = document.createElement("div");
        forecastItem.className = "forecast-item";
        forecastItem.innerHTML = `
            <div>${labels[index] || ""} ${month}/${day}</div>
            <img src="https://openweathermap.org/img/wn/${d.icon}@2x.png" alt="${d.description}" style="width: 40px; height: 40px;">
            <div>${Math.round(d.tmin)}° / ${Math.round(d.tmax)}°</div>
            <div>${d.description}</div>
        `;
        forecastListEl.appendChild(forecastItem);
    });
}

// OpenWeather 5일/3시간 예보 → 날짜별(현지 시간 기준) 최저/최고 + 정오에 가장 가까운 시각의 날씨
function openWeatherToDaily(data) {
    const offset = (data.city && data.city.timezone) || 0; // 초 단위 UTC 오프셋
    const byDate = {};
    for (const item of data.list) {
        const local = new Date((item.dt + offset) * 1000);
        const date = `${local.getUTCFullYear()}${String(local.getUTCMonth() + 1).padStart(2, "0")}${String(local.getUTCDate()).padStart(2, "0")}`;
        (byDate[date] = byDate[date] || []).push({ hour: local.getUTCHours(), item });
    }
    return Object.keys(byDate).sort().slice(0, 3).map((date) => {
        const entries = byDate[date];
        const temps = entries.map((e) => e.item.main.temp);
        const rep = entries.reduce((a, b) => (Math.abs(b.hour - 12) < Math.abs(a.hour - 12) ? b : a));
        return {
            date,
            tmin: Math.min(...temps),
            tmax: Math.max(...temps),
            description: rep.item.weather[0].description,
            icon: rep.item.weather[0].icon.replace("n", "d"),
        };
    });
}

// ===== 기상청(국내) 연동 =====
// 국내 좌표면 Vercel 서버 함수(/api/kma)를 통해 기상청 단기예보를 가져온다.
// 실패하거나 파일로 직접 열었을 때(서버 함수 없음)는 null → OpenWeather 데이터를 그대로 사용
async function fetchKmaWeather(lat, lon) {
    if (location.protocol === "file:") return null;
    try {
        const res = await fetch(`/api/kma?lat=${lat}&lon=${lon}`);
        if (!res.ok) {
            console.warn("기상청 API 실패, OpenWeather 사용:", await res.text());
            return null;
        }
        return await res.json();
    } catch (err) {
        console.warn("기상청 API 호출 오류, OpenWeather 사용:", err);
        return null;
    }
}

// 기상청 기온은 섭씨이므로 화씨 모드면 변환
function fromCelsius(c) {
    return currentUnits === "imperial" ? c * 9 / 5 + 32 : c;
}

// 현재 날씨/예보를 화면에 그린다 (국내는 기상청, 해외는 OpenWeather)
async function renderWeather(current, forecast) {
    let days = openWeatherToDaily(forecast);
    let source = "OpenWeather";

    if (current.sys && current.sys.country === "KR" && current.coord) {
        const kma = await fetchKmaWeather(current.coord.lat, current.coord.lon);
        if (kma && kma.current && typeof kma.current.temp === "number") {
            // 기존 화면 코드를 그대로 쓰기 위해 OpenWeather 응답 형식에 기상청 값을 덮어쓴다
            current.main.temp = fromCelsius(kma.current.temp);
            current.main.humidity = kma.current.humidity;
            current.wind.speed = kma.current.wind;
            current.weather[0] = { id: kma.current.id, description: kma.current.description, icon: kma.current.icon };
            if (kma.daily && kma.daily.length) {
                days = kma.daily.map((d) => ({ ...d, tmin: fromCelsius(d.tmin), tmax: fromCelsius(d.tmax) }));
            }
            source = "기상청 단기예보";
        }
    }

    displayCurrentWeather(current);
    displayForecast(days);

    const sourceEl = document.querySelector("#dataSource");
    if (sourceEl) sourceEl.textContent = `출처: ${source}`;

    // 미세먼지 정보 (OpenWeather, 좌표 필요)
    if (current.coord) {
        try {
            const airPollution = await fetchAirPollution(current.coord.lat, current.coord.lon);
            displayAirPollution(airPollution);
        } catch (err) {
            console.error("미세먼지 정보를 가져올 수 없습니다:", err);
        }
    }

    lastCity = current.name;
    lastCityEnglish = current.name;
}

// 추천 옷차림
    function updateOutfitSuggestion(temp, weather) {
    let t = temp;

    // 화씨 모드일 때는 섭씨 기준으로 변환해서 판단
    if (currentUnits === "imperial") {
        t = (temp - 32) * 5 / 9;
    }

    let text;
    if (t >= 27) {
        text = "매우 더운 날씨. 반팔, 반바지, 모자 추천합니다. 🩳";
    } else if (t >= 20) {
        text = "약간 더운 날씨. 얇은 긴팔, 반팔, 얇은 바지 추천합니다. 👕";
    } else if (t >= 13) {
        text = "선선한 날씨. 가디건, 맨투맨, 얇은 자켓 추천합니다. 🧥";
    } else if (t >= 6) {
        text = "제법 쌀쌀한 날씨. 코트, 두꺼운 자켓, 목도리 추천합니다. 🧣";
    } else {
        text = "많이 추운 날씨. 패딩, 목도리, 장갑 추천합니다. 🧤";
    }

    if (weather.id >= 200 && weather.id < 600) {
        text += " 비/눈 가능성이 있으니 우산도 챙기는 게 좋겠어요. ☂️";
    }

    outfitTextEl.textContent = text;
}

// 이벤트 핸들러
async function handleSearch(cityFromClick) {
    const rawCity = cityFromClick || cityInput.value.trim();
    if (!rawCity) {
        showError("도시 이름을 입력해 주세요.");
        return;
    }

    const city = translateCityName(rawCity);
    console.log(`검색: "${rawCity}" → "${city}"`);

    clearError();
    try {
        let current, forecast;
        try {
            [current, forecast] = await Promise.all([
                fetchWeather(city),
                fetchForecast(city),
            ]);
        } catch (nameErr) {
            // 이름으로 못 찾으면 지오코딩 API로 좌표를 찾아서 다시 조회 (한글 지명도 지원)
            console.warn(`"${city}" 이름 검색 실패, 좌표 검색으로 재시도`);
            const geo = await geocodeCity(rawCity);
            [current, forecast] = await Promise.all([
                fetchWeatherByCoords(geo.lat, geo.lon),
                fetchForecastByCoords(geo.lat, geo.lon),
            ]);
        }

        await renderWeather(current, forecast);
        addRecentCity(rawCity);
    } catch (err) {
        console.error(err);
        showError(`"${rawCity}"의 날씨 정보를 찾을 수 없습니다.`);
    }
}

function handleUnitToggle() {
    currentUnits = currentUnits === "metric" ? "imperial" : "metric";
    unitToggleBtn.textContent = currentUnits === "metric" ? "℃ / ℉" : "℉ / ℃";

    // 단위 바꾸면 영어 도시명으로 다시 호출
    if (lastCityEnglish) {
        console.log('단위 변환으로 재검색:', lastCityEnglish);
        handleSearch(lastCityEnglish);
    }
}

// 초기화
function init() {
    renderRecentCities();
}

// 페이지 로드 시 자동 검색 (기존 코드 수정)
document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const city = params.get('city');
    const lat = params.get('lat');
    const lon = params.get('lon');
    
    console.log('페이지 로드 파라미터:', { city, lat, lon });
    
    // 초기화
    renderRecentCities();
    
    if (lat && lon) {
        console.log('좌표로 검색 시작:', lat, lon);
        handleLocationSearch(parseFloat(lat), parseFloat(lon));
    } else if (city) {
        console.log('도시명으로 검색 시작:', city);
        cityInput.value = city;
        handleSearch(city);
    }
});

// 이벤트 리스너 추가
if (searchBtn) {
    searchBtn.addEventListener("click", () => handleSearch());
}

if (unitToggleBtn) {
    unitToggleBtn.addEventListener("click", handleUnitToggle);
}

if (cityInput) {
    cityInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            handleSearch();
        }
    });
}

// 로고 클릭 이벤트
if (logoLink) {
    logoLink.addEventListener("click", () => {
        window.location.href = "main.html";
    });
}

// 한국어-영어 지역명 변환 맵
const cityNameMap = {
    // 한국 주요 도시
    "서울": "Seoul",
    "부산": "Busan",
    "대구": "Daegu", 
    "인천": "Incheon",
    "광주": "Gwangju",
    "대전": "Daejeon",
    "울산": "Ulsan",
    "세종": "Sejong",
    "수원": "Suwon",
    "고양": "Goyang",
    "용인": "Yongin",
    "성남": "Seongnam",
    "청주": "Cheongju",
    "전주": "Jeonju",
    "안산": "Ansan",
    "천안": "Cheonan",
    "남양주": "Namyangju",
    "화성": "Hwaseong",
    "평택": "Pyeongtaek",
    "의정부": "Uijeongbu",
    "제주": "Jeju",
    "제주도": "Jeju",
    "제주시": "Jeju",
    "서귀포": "Seogwipo",
    "강릉": "Gangneung",
    "춘천": "Chuncheon",
    "포항": "Pohang",
    "경주": "Gyeongju",
    "여수": "Yeosu",
    "목포": "Mokpo",
    "창원": "Changwon",
    "김해": "Gimhae",
    
    // 세계 주요 도시
    "도쿄": "Tokyo",
    "오사카": "Osaka",
    "교토": "Kyoto",
    "요코하마": "Yokohama",
    "베이징": "Beijing",
    "상하이": "Shanghai",
    "홍콩": "Hong Kong",
    "타이베이": "Taipei",
    "방콕": "Bangkok",
    "싱가포르": "Singapore",
    "쿠알라룸푸르": "Kuala Lumpur",
    "자카르타": "Jakarta",
    "마닐라": "Manila",
    "하노이": "Hanoi",
    "호치민": "Ho Chi Minh City",
    "뉴욕": "New York",
    "로스앤젤레스": "Los Angeles",
    "시카고": "Chicago",
    "라스베이거스": "Las Vegas",
    "샌프란시스코": "San Francisco",
    "워싱턴": "Washington",
    "런던": "London",
    "파리": "Paris",
    "베를린": "Berlin",
    "로마": "Rome",
    "마드리드": "Madrid",
    "바르셀로나": "Barcelona",
    "암스테르담": "Amsterdam",
    "취리히": "Zurich",
    "모스크바": "Moscow",
    "이스탄불": "Istanbul",
    "두바이": "Dubai",
    "카이로": "Cairo",
    "시드니": "Sydney",
    "멜버른": "Melbourne"
};

// 도시명 변환 함수
function translateCityName(cityName) {
    const trimmedName = cityName.trim();
    
    // 한국어 도시명이면 영어로 변환
    if (cityNameMap[trimmedName]) {
        return cityNameMap[trimmedName];
    }
    
    // 영어 도시명인 경우 그대로 반환
    return trimmedName;
}

// 미세먼지 정보 표시 함수 추가 (fetchAirPollution 함수 다음에 추가)
function displayAirPollution(data) {
    if (!data || !data.list || !data.list[0]) {
        console.error("미세먼지 데이터가 없습니다:", data);
        return;
    }
    
    const airData = data.list[0];
    const aqi = airData.main.aqi; // 1-5 등급
    const components = airData.components;
    
    // 대기질 등급 매핑
    const aqiNames = {
        1: "좋음",
        2: "보통", 
        3: "나쁨",
        4: "매우 나쁨",
        5: "최악"
    };
    
    const aqiColors = {
        1: "aqi-1",
        2: "aqi-2", 
        3: "aqi-3",
        4: "aqi-4",
        5: "aqi-5"
    };
    
    // DOM 요소가 존재하는지 확인
    if (!aqiLevelEl || !aqiDescriptionEl || !pm25El || !pm10El || !o3El) {
        console.error("미세먼지 DOM 요소를 찾을 수 없습니다");
        return;
    }
    
    // DOM 업데이트
    aqiLevelEl.textContent = aqi;
    aqiLevelEl.className = `aqi-level ${aqiColors[aqi]}`;
    aqiDescriptionEl.textContent = aqiNames[aqi];
    
    pm25El.textContent = `${Math.round(components.pm2_5)} μg/m³`;
    pm10El.textContent = `${Math.round(components.pm10)} μg/m³`;
    o3El.textContent = `${Math.round(components.o3)} μg/m³`;
    
    // 미세먼지 섹션 표시
    if (airPollutionSectionEl) {
        airPollutionSectionEl.classList.remove("hidden");
    }
    
    console.log("미세먼지 정보 표시 완료:", aqi, aqiNames[aqi]);
}

// 좌표 기반 날씨 검색 함수
async function handleLocationSearch(lat, lon) {
    try {
        clearError();
        console.log('좌표 기반 검색 시작:', lat, lon);

        const [current, forecast] = await Promise.all([
            fetchWeatherByCoords(lat, lon),
            fetchForecastByCoords(lat, lon)
        ]);

        await renderWeather(current, forecast);
        addRecentCity(current.name);
    } catch (err) {
        console.error('위치 기반 검색 오류:', err);
        showError("현재 위치의 날씨 정보를 가져올 수 없습니다.");
    }
}

// 도시 이름 → 좌표 (OpenWeather 지오코딩 API, 한글 지명 검색 가능)
async function geocodeCity(name) {
    const res = await fetch(
        `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(name)}&limit=1&appid=${API_KEY}`
    );
    if (!res.ok) throw new Error(`지오코딩 실패: ${res.status}`);
    const list = await res.json();
    if (!list.length) throw new Error("도시를 찾을 수 없습니다.");
    return { lat: list[0].lat, lon: list[0].lon };
}

// 좌표로 현재 날씨 가져오기
async function fetchWeatherByCoords(lat, lon) {
    console.log('좌표로 날씨 요청:', lat, lon);
    
    const response = await fetch(
        `${BASE_URL}/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${currentUnits}&lang=kr`
    );
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('날씨 API 응답:', data);
    return data;
}

// 좌표로 예보 데이터 가져오기
async function fetchForecastByCoords(lat, lon) {
    console.log('좌표로 예보 요청:', lat, lon);
    
    const response = await fetch(
        `${BASE_URL}/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${currentUnits}&lang=kr`
    );
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('예보 API 응답:', data);
    return data;
}

// 지도 표시 함수 (미세먼지 함수들 다음에 추가)
function displayMap(lat, lon, cityName) {
    console.log('displayMap 함수 호출됨:', lat, lon, cityName);
    
    const mapSectionEl = document.querySelector("#mapSection");
    const mapEl = document.querySelector("#map");
    
    if (!mapSectionEl || !mapEl) {
        console.error('지도 요소를 찾을 수 없습니다');
        return;
    }
    
    // Leaflet이 로드되었는지 확인
    if (typeof L === 'undefined') {
        console.error('Leaflet 라이브러리가 로드되지 않았습니다');
        return;
    }
    
    // 지도 섹션 표시
    mapSectionEl.classList.remove("hidden");
    
    // 기존 지도가 있으면 제거
    if (map) {
        map.remove();
        map = null;
    }
    
    // 약간의 지연을 주어 DOM이 완전히 렌더링되도록
    setTimeout(() => {
        try {
            // 새 지도 생성
            map = L.map('map', {
                center: [lat, lon],
                zoom: 12
            });
            
            // 타일 레이어 추가
            // OSM 타일 서버는 Referer 없는 요청(file:// 로 파일을 직접 열었을 때)을 403으로 차단한다.
            // 배포 사이트(https)·로컬 서버(http)에서는 OSM을, 파일로 직접 열었을 때만 OSM 독일 서버 타일을 사용
            // (Esri는 한국 상세 지도가 없고, OSM France(HOT)는 응답이 1~10초로 너무 느림)
            if (location.protocol === 'file:') {
                L.tileLayer('https://tile.openstreetmap.de/{z}/{x}/{y}.png', {
                    maxZoom: 18,
                    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles by <a href="https://openstreetmap.de/">OSM Deutschland</a>'
                }).addTo(map);
            } else {
                L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                }).addTo(map);
            }
            
            // 마커 추가
            L.marker([lat, lon]).addTo(map)
                .bindPopup(`📍 ${cityName}`)
                .openPopup();
                
            // 지도 크기 재조정
            map.invalidateSize();
            
            console.log('지도가 성공적으로 생성되었습니다');
            
        } catch (error) {
            console.error('지도 생성 오류:', error);
        }
    }, 100);
}
