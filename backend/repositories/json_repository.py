import json
from pathlib import Path

from pydantic import ValidationError

from backend.domain.models import Layout, Settings


DEFAULT_LAYOUT_PATH = Path("data/layout.json")
DEFAULT_SETTINGS_PATH = Path("data/settings.json")


def load_layout(path: Path = DEFAULT_LAYOUT_PATH) -> Layout:
    """저장 파일이 없으면 좌석이 없는 최초 상태를 반환한다."""

    if not path.exists():
        return Layout()

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return Layout.model_validate(data)
    except json.JSONDecodeError as error:
        raise ValueError(f"잘못된 JSON 파일입니다: {path}") from error
    except ValidationError as error:
        raise ValueError(f"ROI 데이터 형식이 올바르지 않습니다: {path}") from error


def save_layout(layout: Layout, path: Path = DEFAULT_LAYOUT_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = layout.model_dump(mode="json")
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def load_settings(path: Path = DEFAULT_SETTINGS_PATH) -> Settings:
    """저장 파일이 없으면 기본 노쇼 기준 시간을 반환한다."""

    if not path.exists():
        return Settings()

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return Settings.model_validate(data)
    except json.JSONDecodeError as error:
        raise ValueError(f"잘못된 JSON 파일입니다: {path}") from error
    except ValidationError as error:
        raise ValueError(f"설정 데이터 형식이 올바르지 않습니다: {path}") from error


def save_settings(settings: Settings, path: Path = DEFAULT_SETTINGS_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = settings.model_dump(mode="json")
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
