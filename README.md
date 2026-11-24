<h1>☀️ Today Weather ☀️ <br> </h1>
24016008 김서린<br>
프론트엔드 기말 과제 - 나만의 날씨 예보 웹사이트 만들기 <br>

<h3> 📣 프로젝트 소개 </h3>
사용자가 검색한 도시의 현재 날씨와 3일 예보를 보여주는 웹사이트이다. <br>
국내 도시는 기상청 단기예보, 해외 도시는 OpenWeather API를 사용하여 날씨 정보를 제공한다. <br>
현재 위치 기반(GPS) 날씨 조회도 가능하며, 날씨에 따라 직관적인 UI가 보이도록 구성하였다. <br>

<h3> 📣 주요 기능 </h3>
1. 도시 검색 기능: 도시 이름으로 실시간 날씨 검색(한국어/영어 검색 가능하다), 이름으로 찾지 못하면 지명 검색(Geocoding)으로 다시 조회 <br>
2. API 연동 기능: 국내는 기상청 단기예보, 해외는 OpenWeather를 사용하며, 기상청 호출 실패 시 OpenWeather로 자동 대체 <br>
3. 날씨 표시 기능: 현재 온도, 상태, 아이콘, 습도, 풍속 표시, 도시 이름은 한글로 표시 <br>
4. 예보 카드 기능: 3일 예보 생성, 날짜(요일)/최저·최고 온도/상태 아이콘 표시 <br>
5. 단위 전환 기능: 섭씨 ↔ 화씨 변환 버튼 <br>
6. 시각적 변화 기능: 날씨/시간에 따른 배경/아이콘 변화 <br>
7. 오류 처리 기능: 잘못된 도시 입력, API 호출 실패 메시지 전송 <br> 
8. 현재 위치(GPS) 기반 날씨조회 기능 <br>
9. 대기질 정보 기능: 직관적인 대기질 정도와 초미세먼지/미세먼지/오존 지수를 표시 <br>
10. 오늘의 추천 옷차림 기능: 기온에 따른 옷 추천 <br>
11. 검색 지역 지도 기능: 검색한 지역의 정확한 위치를 보여주기 위해 지도로 표시 <br>
12. 시작 페이지: 도시 검색, 주요 도시 바로가기 버튼, 현재 위치 버튼 제공 <br>

<h3> 📣 사용 기술 </h3>
1. HTML <br> 
2. CSS <br>
3. JavaScript <br>
4. OpenWeatherMap API (현재 날씨, 예보, 대기질, 지명 검색) <br>
5. 기상청 단기예보 조회서비스 API (공공데이터포털) <br>
6. Leaflet + OpenStreetMap (지도) <br>
7. Vercel(배포 및 서버리스 함수) <br>

<h3> 📣 API 키 설정 </h3>
API 키가 브라우저 코드에 노출되지 않도록 모든 날씨 API는 Vercel 서버리스 함수를 통해 호출한다. <br>
(<code>api/ow.js</code>: OpenWeather, <code>api/kma.js</code>: 기상청) <br>
1. OpenWeather에서 API 키 발급, 공공데이터포털에서 「기상청_단기예보 조회서비스」 활용 신청 후 인증키 발급 <br>
2. Vercel 프로젝트 Settings → Environment Variables에 아래 두 값을 등록 <br>
&nbsp;&nbsp;- <code>OPENWEATHER_API_KEY</code>: OpenWeather API 키 <br>
&nbsp;&nbsp;- <code>KMA_SERVICE_KEY</code>: 기상청 인증키 <br>
3. 재배포 후 <code>/api/kma?lat=37.5665&lon=126.978</code> 에서 <code>"source":"kma"</code> 응답 확인 <br>
※ 서버 함수를 사용하므로 로컬에서는 파일을 직접 열지 않고 <code>vercel dev</code>로 실행한다. <br>

<h3> 📣 배포 주소 </h3>
https://github.com/seorin-lab/24016008- <br>
https://24016008.vercel.app/main.html
