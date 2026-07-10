from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


PASS_EVENTS = {
    "Проход по идентификатору",
    "Проход по команде от ДУ",
}


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

    req = Request(url, data=payload, headers=headers, method=method)
    try:
        with urlopen(req, timeout=60) as resp:
            text = resp.read().decode("utf-8", errors="replace")
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
        raise RuntimeError("Auth response did not contain token.")
    return token


def split_fio(fio: str) -> tuple[str, str, str]:
    parts = [part for part in fio.strip().split() if part]
    surname = parts[0] if len(parts) >= 1 else ""
    name = parts[1] if len(parts) >= 2 else ""
    patronymic = " ".join(parts[2:]) if len(parts) >= 3 else ""
    return surname, name, patronymic


def fetch_eventsystem_rows(base_url: str, token: str, date_begin: str, date_end: str, limit: int) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    page = 1
    while True:
        data = api_request(
            base_url,
            "/api/eventsystem",
            token,
            params={
                "dateBegin": date_begin,
                "dateEnd": date_end,
                "page": page,
                "rows": limit,
            },
        )
        batch = data.get("rows", []) if isinstance(data, dict) else []
        if not batch:
            break
        rows.extend(batch)
        total = data.get("records")
        if isinstance(total, int) and len(rows) >= total:
            break
        if len(batch) < limit:
            break
        page += 1
    return rows


def convert_rows(rows: list[dict[str, Any]]) -> list[dict[str, str]]:
    converted: list[dict[str, str]] = []
    for row in rows:
        event_name = str(row.get("event_name") or "").strip()
        if event_name not in PASS_EVENTS:
            continue

        fio = str(row.get("fio") or "").strip()
        if not fio:
            continue

        surname, name, patronymic = split_fio(fio)
        zone_enter = str(row.get("zone_enter") or "").strip()
        zone_exit = str(row.get("zone_exit") or "").strip()

        # The old report script determines direction from column "Выход":
        # "Офисное здание" means entry, "Неконтролируемая территория" means exit.
        direction_marker = zone_enter or zone_exit
        if not direction_marker:
            continue

        converted.append(
            {
                "Фамилия": surname,
                "Имя": name,
                "Отчество": patronymic,
                "Дата события": str(row.get("time_label") or ""),
                "Устройство": str(row.get("device_name") or row.get("res_name") or ""),
                "Событие": event_name,
                "Выход": direction_marker,
                "Подразделение": str(row.get("division_name") or ""),
                "Табельный номер": str(row.get("tabel_number") or ""),
                "PERCo event id": str(row.get("id") or ""),
            }
        )
    converted.sort(key=lambda item: (item["Фамилия"], item["Имя"], item["Отчество"], item["Дата события"]))
    return converted


def write_csv(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    columns = [
        "Фамилия",
        "Имя",
        "Отчество",
        "Дата события",
        "Устройство",
        "Событие",
        "Выход",
        "Подразделение",
        "Табельный номер",
        "PERCo event id",
    ]
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=columns, delimiter=";")
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    parser = argparse.ArgumentParser(description="Export PERCo event system pass events.")
    parser.add_argument("--base", default=os.getenv("PERCO_BASE_URL", "http://127.0.0.1"))
    parser.add_argument("--login", default=os.getenv("PERCO_LOGIN"))
    parser.add_argument("--password", default=os.getenv("PERCO_PASSWORD"))
    parser.add_argument("--token", default=os.getenv("PERCO_TOKEN"))
    parser.add_argument("--date-begin", default=os.getenv("PERCO_DATE_BEGIN", "2026-07-01"))
    parser.add_argument("--date-end", default=os.getenv("PERCO_DATE_END", "2026-07-09"))
    parser.add_argument("--limit", type=int, default=500)
    parser.add_argument("--out", default=None)
    args = parser.parse_args()

    token = args.token
    if not token:
        if not args.login or not args.password:
            print("Set PERCO_TOKEN or PERCO_LOGIN/PERCO_PASSWORD.", file=sys.stderr)
            return 2
        token = auth(args.base, args.login, args.password)

    raw_rows = fetch_eventsystem_rows(args.base, token, args.date_begin, args.date_end, args.limit)
    rows = convert_rows(raw_rows)

    out_dir = Path("automation") / "downloads"
    stem = f"perco_events_{args.date_begin}_{args.date_end}".replace(":", "-")
    json_path = out_dir / f"{stem}.json"
    csv_path = Path(args.out) if args.out else out_dir / f"{stem}.csv"
    out_dir.mkdir(parents=True, exist_ok=True)

    json_path.write_text(json.dumps(raw_rows, ensure_ascii=False, indent=2), encoding="utf-8")
    write_csv(csv_path, rows)

    print(f"Fetched raw events: {len(raw_rows)}")
    print(f"Pass events exported: {len(rows)}")
    print(f"Raw JSON: {json_path.resolve()}")
    print(f"CSV: {csv_path.resolve()}")
    if rows:
        print("First exported row:")
        print(json.dumps(rows[0], ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
