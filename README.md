# YOLO Seat Monitor

카메라 영상으로 도서관·독서실의 좌석 이용 상태를 확인하는 웹 서비스입니다. YOLO로 사람과 소지품을 탐지하고, 자리를 비운 시간이 설정한 기준을 넘으면 노쇼로 표시합니다.

영상 분석과 데이터 저장은 로컬 노트북에서 처리합니다. 이용자는 좌석 배치도를 확인하고, 관리자는 카메라 화면을 보며 좌석 영역(ROI)과 노쇼 기준을 설정하는 구성입니다. 프론트엔드는 하나의 React 앱에서 두 화면을 나누는 방식으로 개발하고 있습니다.

## 화면 구성

| 구분 | 제공 기능 |
|---|---|
| 사용자 화면 | 현재 좌석 배치도와 이용 가능 상태 조회 |
| 관리자 화면 | 카메라 화면, ROI 설정, AI ROI 후보 생성, 실시간 탐지 결과, 노쇼 기준 설정, 타이머 초기화, 시연 영상 분석 |

## 주요 기능

- 노트북 웹캠, USB 카메라, Camo와 같은 가상 카메라 입력
- Ultralytics YOLO를 이용한 사람·소지품 탐지
- 좌석마다 다각형 ROI를 지정하고, 영역 안에 있는 탐지 결과를 해당 좌석에 배정
- 비어 있음, 사용 중, 자리 비움, 노쇼의 네 가지 상태 판정
- SSE를 통한 좌석 상태 실시간 전송
- ROI와 노쇼 기준 시간의 로컬 JSON 저장
- Gemini에 이미지를 보내 초기 ROI 후보 생성. 후보를 확인·수정한 뒤 저장
- 업로드한 영상을 원래 재생 속도에 맞춰 보여주면서 YOLO로 분석
- 특정 좌석 또는 전체 좌석의 판정 타이머 초기화

## 아키텍처

```mermaid
flowchart LR
    subgraph client ["React Frontend"]
        userPage["사용자 화면: 좌석 배치도"]
        adminPage["관리자 화면: ROI와 실시간 분석"]
    end

    subgraph server ["Local FastAPI"]
        api["REST API와 SSE"]
        seatService["SeatService 상태 판정"]
        cameraWorker["CameraWorker"]
        demoWorker["DemoVideoWorker"]
        detector["YOLO Detector"]
        roiSuggester["AI ROI Suggester"]
    end

    subgraph datastore ["Local Files"]
        modelFile["YOLO PT 모델"]
        layoutFiles["ROI Layout JSON"]
        settingsFile["Settings JSON"]
    end

    subgraph external ["Optional External Services"]
        gemini["Gemini API"]
        tunnel["ngrok 또는 Cloudflare Tunnel"]
        remoteUser["임시 외부 사용자"]
    end

    userPage -->|"좌석 배치와 상태"| api
    adminPage -->|"관리 API와 카메라 프레임"| api
    api --> seatService
    cameraWorker --> detector
    demoWorker --> detector
    detector --> seatService
    seatService --> layoutFiles
    seatService --> settingsFile
    modelFile --> detector
    api --> roiSuggester
    roiSuggester -.->|"ROI 후보 요청"| gemini
    remoteUser -.-> tunnel
    tunnel -.-> userPage
```

### 실시간 분석 흐름

```text
카메라 또는 시연 영상
  → 최신 프레임 수집
  → YOLO 객체 탐지
  → 객체 중심점과 좌석 ROI 매칭
  → 시간 기반 좌석 상태 판정
  → REST 및 SSE로 프론트에 전달
```

카메라 분석과 업로드 영상 분석은 동시에 실행하지 않습니다. 시연 모드에 진입하면 카메라 분석을 멈추고, 시연 모드를 종료하면 카메라 모드로 복귀합니다.

## 좌석 상태 판정

| 상태 | 의미 |
|---|---|
| `empty` | 사람과 관리 대상 소지품이 감지되지 않음 |
| `occupied` | 사람이 일정 시간 연속으로 감지됨 |
| `away` | 사람은 없고 책·노트북·가방 등의 소지품만 감지됨 |
| `noshow` | `away` 상태가 설정한 노쇼 기준 시간을 초과함 |

기본 설정은 다음과 같습니다.

- YOLO 추론 주기: 1초
- 점유 확정: 사람을 2초간 연속 탐지
- 미탐지 보정: 객체가 잠깐 사라져도 3초간 이전 상태 유지
- 노쇼 기준: 기본 600초이며 `/api/settings`로 변경 가능
- 소지품 클래스: `backpack`, `handbag`, `suitcase`, `book`, `laptop`

좌석 상태와 타이머는 실행 중 메모리에 저장되며 서버를 재시작하면 초기화됩니다. ROI와 설정값은 JSON 파일에 저장되어 재시작 후에도 유지됩니다.

## 기술 스택

### 백엔드·영상 분석

- Python 3.12
- FastAPI, Pydantic v2, Uvicorn
- Ultralytics YOLO, PyTorch
- OpenCV
- SSE(좌석 상태 전송), MJPEG(시연 영상 송출)
- JSON 파일 저장
- Google Gemini API(ROI 후보 생성 기능을 사용할 때 필요)

### 프론트엔드

- React, TypeScript, Vite

## 저장소 구조

```text
yoloSeatMonitor/
├─ backend/
│  ├─ api/                 # API 요청 처리, 서버 시작·종료 처리
│  ├─ domain/              # 데이터 모델과 좌석 상태 판정
│  ├─ repositories/        # ROI와 설정 파일 읽기·저장
│  └─ vision/              # 카메라, 영상 재생, YOLO, AI ROI 추천
├─ data/                   # 로컬 ROI와 설정 데이터
├─ docs/                   # API 및 백엔드 작업 문서
├─ models/                 # YOLO PT 모델
├─ prototype/              # 초기 UI 목업
├─ tests/                  # 백엔드 단위·API 테스트
├─ frontend/               # React 통합 프론트엔드 위치 예정
├─ requirements.txt
├─ TECH_STACK.md
└─ README.md
```

## 로컬 실행

### 1. 가상환경 생성

프로젝트 루트에서 실행합니다.

```powershell
py -3.12 -m venv .venv
```

### 2. 의존성 설치

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

### 3. 환경변수 설정

`.env.example`을 `.env`로 복사한 뒤 필요한 값을 수정합니다.

```dotenv
YOLO_MODEL_PATH=models/yolo26s.pt
CAMERA_SOURCE=0

# AI ROI 후보 생성을 사용할 때만 필요
GEMINI_API_KEY=
GEMINI_ROI_MODEL=gemini-3.7-flash

# 시연 영상 설정
DEMO_VIDEO_DIRECTORY=data/demo
MAX_DEMO_VIDEO_BYTES=524288000
```

`CAMERA_SOURCE`에는 OpenCV 카메라 번호 또는 영상 스트림 주소를 사용할 수 있습니다. Camo와 같은 가상 카메라는 Windows에서 확인된 장치 번호를 입력합니다.

### 4. 백엔드 실행

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.api.main:app --host 127.0.0.1 --port 8000
```

- API 주소: `http://127.0.0.1:8000`
- Swagger 문서: `http://127.0.0.1:8000/docs`
- 상태 확인: `http://127.0.0.1:8000/api/health`

카메라 프로그램이 장치를 먼저 점유하고 있으면 OpenCV가 프레임을 읽지 못할 수 있습니다. Camo를 사용할 때는 Camo 연결을 완료한 다음 백엔드를 실행하세요.

### 5. 프론트엔드 실행

프론트엔드는 별도 폴더에서 개발 중입니다. 해당 폴더에서 `npm install`, `npm run dev`를 실행합니다. 이 저장소의 `frontend/`로 옮긴 경우에는 아래 명령을 사용하면 됩니다.

```powershell
cd frontend
npm install
npm run dev
```

개발 중에는 프론트엔드의 `/api` 요청이 `http://127.0.0.1:8000`으로 전달되도록 Vite proxy를 사용합니다.

## 주요 API

| Method | Endpoint | 설명 |
|---|---|---|
| `GET` | `/api/health` | 서버, 카메라와 현재 분석 모드 확인 |
| `GET` | `/api/layout` | 카메라용 ROI 조회 |
| `PUT` | `/api/layout` | 카메라용 ROI 저장 |
| `POST` | `/api/layout/suggestions` | 첨부 이미지의 AI ROI 후보 생성 |
| `GET` | `/api/seats` | 현재 좌석 상태 조회 |
| `GET` | `/api/seats/stream` | 좌석 상태 변경 SSE 수신 |
| `POST` | `/api/seats/{seat_id}/reset` | 특정 좌석 판정 타이머 초기화 |
| `POST` | `/api/seats/reset` | 전체 좌석 판정 타이머 초기화 |
| `GET` | `/api/settings` | 노쇼 기준 설정 조회 |
| `PUT` | `/api/settings` | 노쇼 기준 설정 저장 |
| `GET` | `/api/camera/frame.jpg` | 현재 카메라 프레임 조회 |
| `POST` | `/api/demo/enter` | 시연 영상 모드 진입 |
| `POST` | `/api/demo/video` | 시연 영상 업로드 |
| `GET` | `/api/demo/preview.jpg` | 업로드 영상 첫 프레임 조회 |
| `GET`, `PUT` | `/api/demo/layout` | 시연 영상용 ROI 조회·저장 |
| `POST` | `/api/demo/start` | 영상 재생 및 YOLO 분석 시작 |
| `GET` | `/api/demo/stream` | 시연 영상 MJPEG 스트림 |
| `GET` | `/api/demo/status` | 시연 분석 진행 상태 조회 |
| `POST` | `/api/demo/stop` | 시연 분석 중지 |
| `POST` | `/api/demo/exit` | 시연 모드 종료 및 카메라 복귀 |

더 자세한 설명은 [백엔드 README](backend/README.md), [백엔드 작업 정리](docs/BACKEND_WORK_SUMMARY.md), [ROI 자동 설정 API](docs/ROI_AUTO_SETUP_API.md)를 참고하세요.

## 로컬 데이터

| 파일 | 내용 |
|---|---|
| `data/layout.json` | 실시간 카메라용 좌석 ROI |
| `data/demo_layout.json` | 업로드 영상 시연용 좌석 ROI |
| `data/settings.json` | 노쇼 기준 시간 |
| `data/demo/` | 실행 중 업로드된 임시 영상 |
| `models/*.pt` | YOLO 가중치 |

다른 컴퓨터에서도 같은 ROI를 쓰려면 해당 JSON 파일을 복사하면 됩니다. 카메라 위치나 구도가 달라졌다면 영역이 맞는지 다시 확인해야 합니다.

## 테스트

프로젝트 의존성을 설치한 뒤, 루트에서 다음 명령으로 테스트를 실행합니다.

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

## 임시 외부 공개

평소에는 로컬에서 실행하고, 외부 시연이 필요할 때만 ngrok이나 Cloudflare Tunnel로 접속 주소를 열 계획입니다.

```text
외부 사용자
  → 임시 Tunnel 주소
  → React 사용자 화면
  → Vite proxy 또는 같은 Origin의 FastAPI API
  → 현재 좌석 배치와 상태
```

터널을 종료하면 해당 주소를 통한 외부 접속도 끊깁니다. 사용자·관리자 화면을 프론트에서 나누는 것만으로 관리 API 접근이 차단되지는 않으므로, 외부에 공개하기 전에는 접근 범위를 별도로 확인해야 합니다.
