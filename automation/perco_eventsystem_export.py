from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import os
import sys
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from openpyxl import Workbook


PASS_EVENTS = {
    "Проход по идентификатору",
    "Проход по команде от ДУ",
}

EXCEL_COLUMNS = [
    "Событие",
    "Дата события",
    "Дата события UTC",
    "Дополнительная информация",
    "IP-адрес",
    "Устройство",
    "Фамилия",
    "Имя",
    "Отчество",
    "Идентификатор",
    "Выход",
    "Вход",
    "Оператор",
    "Категория",
    "Подкатегория",
    "Сегмент",
]


def api_request(
    base_url: str,
    path: str,
    token: str,
    params: dict[str, Any] | None = None,
    method: str = "GET",
    body: dict[str, Any] | None = None,
) -> Any:
    url = base_url.rstrip("/") + path
    if params:
        url += "?" + urlencode(params, doseq=True)

    payload = None
    headers = {
        "Accept": "application/json, text/plain, */*",
        "Authorization": f"Bearer {token}",
    }
    if body is not None:
        payload = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = Request(url, data=payload, headers=headers, method=method)
    try:
        with urlopen(request, timeout=120) as response:
            text = response.read().decode("utf-8", errors="replace")
    except HTTPError as exc:
        text = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code} for {url}: {text[:1000]}") from exc
    except URLError as exc:
        raise RuntimeError(f"Network error for {url}: {exc}") from exc

    return json.loads(text)


def auth(base_url: str, login: str, password: str) -> str:
    data = api_request(
        base_url,
        "/api/system/auth",
        token="",
        method="POST",
        body={"login": login, "password": password},
    )
    token = data.get("token") if isinstance(data, dict) else None
    if not token:
        raise RuntimeError("PERCo authentication response did not contain a token.")
    return token


def fetch_eventsystem_rows(
    base_url: str,
    token: str,
    date_begin: str,
    date_end: str,
    page_size: int,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    page = 1

    while True:
        data = api_request(
            base_url,
            "/api/eventsystem",
            token,
            params={
                "beginDatetime": f"{date_begin} 00:00:00",
                "endDatetime": f"{date_end} 23:59:59",
                "page": page,
                "rows": page_size,
                "sidx": "time_label",
                "sord": "asc",
            },
        )
        batch = data.get("rows", []) if isinstance(data, dict) else []
        if not isinstance(batch, list):
            raise RuntimeError("Unexpected PERCo events response: rows is not a list.")
        if not batch:
            break

        rows.extend(batch)
        records = data.get("records") if isinstance(data, dict) else None
        print(f"PERCo page {page}: {len(batch)} rows, downloaded {len(rows)} of {records or '?'}")

        if isinstance(records, int) and len(rows) >= records:
            break
        if len(batch) < page_size:
            break
        page += 1

    return rows


def split_fio(fio: str) -> tuple[str, str, str]:
    parts = [part for part in fio.strip().split() if part]
    surname = parts[0] if len(parts) >= 1 else ""
    name = parts[1] if len(parts) >= 2 else ""
    patronymic = " ".join(parts[2:]) if len(parts) >= 3 else ""
    return surname, name, patronymic


def convert_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    converted: list[dict[str, Any]] = []
    for row in rows:
        event_name = str(row.get("event_name") or "").strip()
        if event_name not in PASS_EVENTS:
            continue

        fio = str(row.get("fio") or "").strip()
        zone_exit = str(row.get("zone_exit") or "").strip()
        if not fio or not zone_exit:
            continue

        surname, name, patronymic = split_fio(fio)
        converted.append(
            {
                "Событие": event_name,
                "Дата события": str(row.get("time_label") or ""),
                "Дата события UTC": str(row.get("time_label_utc") or ""),
                "Дополнительная информация": str(row.get("res_name") or ""),
                "IP-адрес": str(row.get("ip_address") or ""),
                "Устройство": str(row.get("device_name") or ""),
                "Фамилия": surname,
                "Имя": name,
                "Отчество": patronymic,
                "Идентификатор": row.get("identifier") or "",
                # These names follow the native PERCo Excel export exactly.
                "Выход": zone_exit,
                "Вход": str(row.get("zone_enter") or "").strip(),
                "Оператор": str(row.get("user_name") or ""),
                "Категория": str(row.get("category") or ""),
                "Подкатегория": str(row.get("subcategory") or ""),
                "Сегмент": str(row.get("segment_name") or ""),
            }
        )

    converted.sort(
        key=lambda item: (
            str(item["Дата события"]),
            str(item["Фамилия"]),
            str(item["Имя"]),
            str(item["Отчество"]),
        )
    )
    return converted


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=EXCEL_COLUMNS, delimiter=";")
        writer.writeheader()
        writer.writerows(rows)


def write_xlsx(path: Path, rows: list[dict[str, Any]], date_begin: str, date_end: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    workbook = Workbook(write_only=True)
    sheet = workbook.create_sheet("Page 1")
    sheet.append(["События системы PERCo"])
    sheet.append([f"Период: {date_begin} - {date_end}"])
    sheet.append([])
    sheet.append(EXCEL_COLUMNS)
    for row in rows:
        sheet.append([row[column] for column in EXCEL_COLUMNS])
    workbook.save(path)


def parse_date(value: str, field_name: str) -> dt.date:
    try:
        return dt.date.fromisoformat(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"{field_name} must use YYYY-MM-DD format") from exc


def main() -> int:
    today = dt.date.today()
    yesterday = today - dt.timedelta(days=1)
    default_begin = yesterday.replace(month=1, day=1).isoformat()

    parser = argparse.ArgumentParser(description="Export completed PERCo pass events for report generation.")
    parser.add_argument("--base", default=os.getenv("PERCO_BASE_URL", "http://127.0.0.1"))
    parser.add_argument("--login", default=os.getenv("PERCO_LOGIN"))
    parser.add_argument("--password", default=os.getenv("PERCO_PASSWORD"))
    parser.add_argument("--token", default=os.getenv("PERCO_TOKEN"))
    parser.add_argument("--date-begin", default=os.getenv("PERCO_DATE_BEGIN", default_begin))
    parser.add_argument("--date-end", default=os.getenv("PERCO_DATE_END", yesterday.isoformat()))
    parser.add_argument("--page-size", type=int, default=500)
    parser.add_argument("--out", default=None, help="Output .xlsx path")
    args = parser.parse_args()

    date_begin = parse_date(args.date_begin, "date-begin")
    requested_end = parse_date(args.date_end, "date-end")
    date_end = min(requested_end, yesterday)
    if date_begin > date_end:
        print("The export period contains no completed days.", file=sys.stderr)
        return 2

    token = args.token
    if not token:
        if not args.login or not args.password:
            print("Set PERCO_TOKEN or PERCO_LOGIN/PERCO_PASSWORD.", file=sys.stderr)
            return 2
        token = auth(args.base, args.login, args.password)

    date_begin_text = date_begin.isoformat()
    date_end_text = date_end.isoformat()
    raw_rows = fetch_eventsystem_rows(args.base, token, date_begin_text, date_end_text, args.page_size)
    rows = convert_rows(raw_rows)
    if not rows:
        print("PERCo returned no completed pass events. Existing site data was not changed.", file=sys.stderr)
        return 3

    out_dir = Path("automation") / "downloads"
    stem = f"perco_events_{date_begin_text}_{date_end_text}"
    xlsx_path = Path(args.out) if args.out else out_dir / f"{stem}.xlsx"
    csv_path = xlsx_path.with_suffix(".csv")
    json_path = xlsx_path.with_suffix(".json")

    json_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(json.dumps(raw_rows, ensure_ascii=False, indent=2), encoding="utf-8")
    write_csv(csv_path, rows)
    write_xlsx(xlsx_path, rows, date_begin_text, date_end_text)

    print(f"Fetched raw events: {len(raw_rows)}")
    print(f"Pass events exported: {len(rows)}")
    print(f"Period: {date_begin_text} - {date_end_text} (current day excluded)")
    print(f"XLSX: {xlsx_path.resolve()}")
    print(f"CSV: {csv_path.resolve()}")
    print(f"Raw JSON: {json_path.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
