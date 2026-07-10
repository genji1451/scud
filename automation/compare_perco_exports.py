from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd


PASS_EVENTS = {"Проход по идентификатору", "Проход по команде от ДУ"}


def normalize(value: object) -> str:
    if pd.isna(value):
        return ""
    return str(value).strip()


def event_key(row: pd.Series, columns: dict[str, str]) -> tuple[str, str, str, str]:
    fio = " ".join(
        part
        for part in [
            normalize(row.get(columns["surname"])),
            normalize(row.get(columns["name"])),
            normalize(row.get(columns["patronymic"])),
        ]
        if part
    )
    dt = pd.to_datetime(row.get(columns["date"]), errors="coerce")
    dt_text = "" if pd.isna(dt) else dt.strftime("%Y-%m-%d %H:%M:%S")
    return (
        fio,
        dt_text,
        normalize(row.get(columns["event"])),
        normalize(row.get(columns["exit"])),
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Compare manual PERCo Excel export with API CSV export.")
    parser.add_argument("--manual", required=True)
    parser.add_argument("--api", required=True)
    args = parser.parse_args()

    manual_path = Path(args.manual)
    api_path = Path(args.api)

    manual = pd.read_excel(manual_path, header=3)
    api = pd.read_csv(api_path, sep=";", encoding="utf-8-sig") if api_path.exists() else pd.DataFrame()

    manual_dt = pd.to_datetime(manual["Дата события"], errors="coerce")
    manual_pass = manual[manual["Событие"].isin(PASS_EVENTS)].copy()
    manual_pass_clean = manual_pass[manual_pass["Фамилия"].notna() & manual_pass["Выход"].notna()].copy()

    api_dt = pd.to_datetime(api["Дата события"], errors="coerce") if not api.empty else pd.Series(dtype="datetime64[ns]")

    manual_keys = {
        event_key(
            row,
            {
                "surname": "Фамилия",
                "name": "Имя",
                "patronymic": "Отчество",
                "date": "Дата события",
                "event": "Событие",
                "exit": "Выход",
            },
        )
        for _, row in manual_pass_clean.iterrows()
    }
    api_keys = {
        event_key(
            row,
            {
                "surname": "Фамилия",
                "name": "Имя",
                "patronymic": "Отчество",
                "date": "Дата события",
                "event": "Событие",
                "exit": "Выход",
            },
        )
        for _, row in api.iterrows()
    }

    missing_in_api = manual_keys - api_keys
    extra_in_api = api_keys - manual_keys

    print(f"Manual file: {manual_path}")
    print(f"Manual total rows: {len(manual)}")
    print(f"Manual date min: {manual_dt.min()}")
    print(f"Manual date max: {manual_dt.max()}")
    print(f"Manual pass rows: {len(manual_pass)}")
    print(f"Manual clean pass rows: {len(manual_pass_clean)}")
    print()
    print(f"API file: {api_path}")
    print(f"API rows: {len(api)}")
    if not api.empty:
        print(f"API date min: {api_dt.min()}")
        print(f"API date max: {api_dt.max()}")
    print()
    print(f"Matched event keys: {len(manual_keys & api_keys)}")
    print(f"Missing in API: {len(missing_in_api)}")
    print(f"Extra in API: {len(extra_in_api)}")

    if missing_in_api:
        print("\nFirst missing in API:")
        for item in sorted(missing_in_api)[:10]:
            print(item)

    if extra_in_api:
        print("\nFirst extra in API:")
        for item in sorted(extra_in_api)[:10]:
            print(item)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
