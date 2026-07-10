from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from pathlib import Path


@dataclass
class ApiResponse:
    method: str
    url: str
    status: int | None
    content_type: str
    body: str


def request(
    base_url: str,
    method: str,
    path: str,
    token: str | None = None,
    params: dict[str, Any] | None = None,
    body: dict[str, Any] | None = None,
) -> ApiResponse:
    url = base_url.rstrip("/") + path
    if params:
        url += "?" + urlencode(params, doseq=True)

    payload = None
    headers = {"Accept": "application/json, text/plain, */*"}
    if body is not None:
        payload = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = Request(url, data=payload, headers=headers, method=method)
    try:
        with urlopen(req, timeout=20) as resp:
            raw = resp.read()
            text = raw[:4000].decode("utf-8", errors="replace")
            return ApiResponse(method, url, resp.status, resp.headers.get("Content-Type", ""), text)
    except HTTPError as exc:
        raw = exc.read()
        text = raw[:4000].decode("utf-8", errors="replace")
        return ApiResponse(method, url, exc.code, exc.headers.get("Content-Type", ""), text)
    except URLError as exc:
        return ApiResponse(method, url, None, "", f"NETWORK_ERROR: {exc}")


def print_response(title: str, response: ApiResponse) -> None:
    print(f"\n=== {title} ===")
    print(f"{response.method} {response.url}")
    print(f"status: {response.status}")
    if response.content_type:
        print(f"content-type: {response.content_type}")
    if response.body:
        print(response.body[:1200])


def parse_token(body: str) -> str | None:
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        return None
    if isinstance(data, dict):
        token = data.get("token")
        if isinstance(token, str) and token:
            return token
    return None


def parse_export_path(body: str) -> str | None:
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        return None
    if isinstance(data, str) and data.startswith("/files/"):
        return data
    return None


def download_export(base_url: str, token: str, export_path: str, out_dir: Path) -> Path | None:
    out_dir.mkdir(parents=True, exist_ok=True)
    file_name = export_path.rstrip("/").split("/")[-1] or "perco_export.xlsx"
    out_path = out_dir / file_name
    url = base_url.rstrip("/") + "/api" + export_path + "?" + token
    req = Request(url, headers={"Accept": "*/*"}, method="GET")
    try:
        with urlopen(req, timeout=60) as resp:
            out_path.write_bytes(resp.read())
            print(f"\nDownloaded export: {out_path.resolve()}")
            print(f"status: {resp.status}")
            print(f"content-type: {resp.headers.get('Content-Type', '')}")
            print(f"size: {out_path.stat().st_size} bytes")
            return out_path
    except HTTPError as exc:
        print(f"\nExport download failed: HTTP {exc.code}")
        print(exc.read()[:1200].decode("utf-8", errors="replace"))
    except URLError as exc:
        print(f"\nExport download failed: {exc}")
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description="Probe PERCo-Web API endpoints.")
    parser.add_argument("--base", default=os.getenv("PERCO_BASE_URL", "http://127.0.0.1"))
    parser.add_argument("--login", default=os.getenv("PERCO_LOGIN"))
    parser.add_argument("--password", default=os.getenv("PERCO_PASSWORD"))
    parser.add_argument("--token", default=os.getenv("PERCO_TOKEN"))
    parser.add_argument("--date-begin", default=os.getenv("PERCO_DATE_BEGIN", "2026-07-01"))
    parser.add_argument("--date-end", default=os.getenv("PERCO_DATE_END", "2026-07-09"))
    args = parser.parse_args()

    base = args.base.rstrip("/")
    print(f"PERCo base URL: {base}")

    public_checks = [
        ("System components", "GET", "/api/system/components", None),
        ("Tasks types without auth", "GET", "/api/tasks/types", None),
        (
            "TA report without auth",
            "GET",
            "/api/taReports/report",
            {"dateBegin": args.date_begin, "dateEnd": args.date_end, "period": 0},
        ),
    ]
    for title, method, path, params in public_checks:
        print_response(title, request(base, method, path, params=params))

    token = args.token
    if not token and (not args.login or not args.password):
        print("\nNo PERCO_LOGIN/PERCO_PASSWORD provided. Auth checks skipped.")
        print("Run example:")
        print(
            '  $env:PERCO_LOGIN="admin"; '
            '$env:PERCO_PASSWORD="password"; '
            "python automation/perco_api_probe.py"
        )
        print("Or reuse an already issued token:")
        print('  $env:PERCO_TOKEN="token"; python automation/perco_api_probe.py')
        return 0

    if not token:
        auth = request(base, "POST", "/api/system/auth", body={"login": args.login, "password": args.password})
        print_response("Auth", auth)
        token = parse_token(auth.body)
    if not token:
        print("\nAuth did not return a token.")
        return 2

    checks = [
        ("Tasks types with auth", "GET", "/api/tasks/types", None, None),
        (
            "Event system default",
            "GET",
            "/api/eventsystem",
            None,
            None,
        ),
        (
            "Event system by dateBegin/dateEnd",
            "GET",
            "/api/eventsystem",
            {"dateBegin": args.date_begin, "dateEnd": args.date_end, "page": 1, "limit": 20},
            None,
        ),
        (
            "Event system by begin/end datetime",
            "GET",
            "/api/eventsystem",
            {
                "begin_date": args.date_begin + " 00:00:00",
                "end_date": args.date_end + " 23:59:59",
                "page": 1,
                "limit": 20,
            },
            None,
        ),
        (
            "Event system monitoring",
            "GET",
            "/api/eventsystem/monitoringNew",
            {"page": 1, "limit": 20},
            None,
        ),
        (
            "Event system events list",
            "GET",
            "/api/eventsystem/events/list",
            {},
            None,
        ),
        (
            "Verify events",
            "GET",
            "/api/verify/events",
            {"page": 1, "limit": 20},
            None,
        ),
        (
            "Verify events by date",
            "GET",
            "/api/verify/events",
            {
                "begin_date": args.date_begin + " 00:00:00",
                "end_date": args.date_end + " 23:59:59",
                "page": 1,
                "limit": 20,
            },
            None,
        ),
        (
            "TA events list",
            "GET",
            "/api/taReports/eventsList",
            {"dateBegin": args.date_begin, "dateEnd": args.date_end},
            None,
        ),
        (
            "TA report table",
            "GET",
            "/api/taReports/report",
            {"dateBegin": args.date_begin, "dateEnd": args.date_end, "period": 0, "zeroHide": "false"},
            None,
        ),
        (
            "TA report xlsx export",
            "POST",
            "/api/taReports/report/xlsx",
            None,
            {
                "dateBegin": args.date_begin,
                "dateEnd": args.date_end,
                "period": 0,
                "zeroHide": False,
                "multicolumns": False,
                "lang": "ru",
            },
        ),
    ]
    for title, method, path, params, body in checks:
        response = request(base, method, path, token=token, params=params, body=body)
        print_response(title, response)
        if title.endswith("xlsx export"):
            export_path = parse_export_path(response.body)
            if export_path:
                download_export(base, token, export_path, Path("automation") / "downloads")

    return 0


if __name__ == "__main__":
    sys.exit(main())
