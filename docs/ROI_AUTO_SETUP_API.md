# AI 좌석 ROI 후보 생성 API

## 목적

카메라 캡처 이미지를 Gemini가 분석하여 초기 좌석 ROI 후보를 만듭니다.
후보는 자동 저장되지 않으며 프론트에서 수정한 다음 기존 레이아웃 저장
API로 확정합니다.

자동 생성되는 좌석 ID는 `테이블-행-번호` 형식입니다. Gemini가 같은
테이블과 같은 행을 묶고, 백엔드가 화면 기준 위에서 아래로 `A`, `B`, `C`,
각 행에서 왼쪽부터 `01`, `02`, `03` 순서로 번호를 다시 부여합니다.

## 후보 생성

```http
POST /api/layout/suggestions
Content-Type: multipart/form-data
```

폼 필드:

| 필드 | 필수 | 설명 |
|---|---:|---|
| `image` | 예 | 편집 화면에 표시할 JPEG, PNG 또는 WebP 캡처 이미지(최대 10MB) |
| `additional_instructions` | 아니요 | 재시도 시 Gemini에 추가할 보정 지시(최대 500자) |

프론트에서는 `GET /api/health` 응답의 `roi_suggestion_available` 값으로
API 키 설정 여부를 확인할 수 있습니다. 값이 `false`이면 자동 설정 버튼을
비활성화하고 수동 ROI 설정은 그대로 사용할 수 있습니다.

응답 예시:

```json
{
  "suggestion_id": "e6288ff3-9e2f-4e86-8d85-bc23e113ca03",
  "provider": "gemini",
  "model": "gemini-3.7-flash",
  "generated_at": "2026-08-17T12:00:00Z",
  "image_width": 1280,
  "image_height": 720,
  "is_saved": false,
  "layout": {
    "version": 1,
    "seats": [
      {
        "seat_id": "T01-A-01",
        "label": "T01-A-01",
        "polygon": [
          { "x": 0.18, "y": 0.12 },
          { "x": 0.31, "y": 0.12 },
          { "x": 0.32, "y": 0.35 },
          { "x": 0.17, "y": 0.35 }
        ]
      }
    ]
  },
  "warnings": []
}
```

## 프론트 연동 순서

1. `/api/camera/frame.jpg`로 받은 Blob을 화면에 표시하고 보관합니다.
2. 자동 설정 버튼을 누르면 그 Blob을 `FormData`의 `image`에 넣어 후보
   생성 API로 전송합니다.
3. 응답의 `layout`을 기존 ROI 편집기 데이터로 변환합니다.
4. 재시도하면 같은 Blob으로 후보 API를 다시 호출하고 기존 후보를
   새 응답으로 교체합니다.
5. 사용자가 수정과 확인을 마치면 `PUT /api/layout`로 `layout`을 저장합니다.

```javascript
const formData = new FormData()
formData.append('image', capturedBlob, 'camera-frame.jpg')

const response = await fetch('/api/layout/suggestions', {
  method: 'POST',
  body: formData,
})

const suggestion = await response.json()
const editableLayout = suggestion.layout
```

## 오류 응답

| 상태 코드 | 의미 |
|---:|---|
| `400` | 이미지 파일이 손상되었거나 비어 있음 |
| `413` | 이미지가 10MB를 초과함 |
| `415` | 지원하지 않는 이미지 형식 |
| `429` | Gemini 요청 한도 초과. `Retry-After` 이후 재시도 |
| `502` | Gemini 호출 실패 또는 유효한 좌석 후보 없음 |
| `503` | `GEMINI_API_KEY` 또는 라이브러리 설정 누락 |

## 저장 API

후보 확정은 기존 API를 사용합니다.

```http
PUT /api/layout
Content-Type: application/json
```

후보 응답의 `layout` 또는 사용자가 수정한 동일 구조의 값을 요청 본문으로
보내면 `data/layout.json`에 저장됩니다.
