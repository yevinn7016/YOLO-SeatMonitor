# 백엔드 실행 방법

처음 저장소를 받은 뒤, 프로젝트 최상위 폴더에서 아래 순서대로 실행합니다.

## 1. 가상환경 만들기

```powershell
py -3.12 -m venv .venv
```

## 2. 필요한 패키지 설치하기

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## 3. 백엔드 서버 실행하기

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.api.main:app --reload
```

## 4. API 문서 확인하기

서버를 실행한 뒤 브라우저에서 아래 주소를 엽니다.

```text
http://127.0.0.1:8000/docs
```
