"""
TED (Tenders Electronic Daily) API – RFP search for industrial OEM/EPC opportunities.

Endpoint: POST https://api.ted.europa.eu/v3/notices/search
No authentication required.

Query field reference (used in the 'query' string):
  PC  – CPV product/service code(s)
  NC  – Nature of contract: works | services | supplies
  PD  – Publication date (YYYYMMDD)
  TY  – Notice type (1=Contract notice, 2=Contract award, 3=PIN, 7=Qualification, etc.)
  CY  – Country code (DEU, FRA, POL, ...)
  ND  – Notice number

CPV codes used:
  31214000 – Switchgear
  31200000 – Electricity distribution and control apparatus
  31170000 – Transformers
  31110000 – Electric motors
  31153000 – Frequency converters / rectifiers (VFDs)
  31154000 – Uninterruptible power supplies
  31158000 – Chargers (EV charging equipment)
  42960000 – Command, control, monitoring and safety systems (SCADA/DCS)
  42961000 – Command and control systems
  42997000 – Industrial robots
  45315000 – Electrical installation works (substations, switchgear installation)
  45311200 – Switch-gear installation work
  45232430 – Water treatment works
  42996000 – Sewage treatment machines
"""

from datetime import datetime, timedelta

import sys

import requests

# Force UTF-8 output so multilingual notice titles don't crash on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

TED_SEARCH_URL = "https://api.ted.europa.eu/v3/notices/search"

# CPV codes covering all target domains
TARGET_CPV_CODES = [
    "31214000",  # Switchgear (medium/high voltage)
    "31200000",  # Electricity distribution and control apparatus
    "31170000",  # Transformers
    "31110000",  # Electric motors
    "31440000",  # Batteries
    "31161900",  # Voltage control systems
    "31153000",  # Frequency converters / VFDs
    "31154000",  # Uninterruptible power supplies
    "31158000",  # Chargers (EV charging)
    "42960000",  # Command, control, monitoring systems (SCADA/DCS parent)
    "42961000",  # Command and control systems (SCADA)
    "42997000",  # Industrial robots
]

# NC (nature of contract) values:
#   works    – construction / turnkey / EPC (most relevant)
#   supplies – equipment/system procurement (also relevant for OEM)
#   services – excluded (pure consulting/admin)
TARGET_NC = ["works", "supplies"]

# Fields to retrieve per notice
FIELDS = ["ND", "TI", "PD", "CY", "PC", "NC"]


def build_query(days_back: int = 90) -> str:
    since = (datetime.now() - timedelta(days=days_back)).strftime("%Y%m%d")
    cpv_list = ", ".join(TARGET_CPV_CODES)
    nc_list = ", ".join(TARGET_NC)
    return (
        f"PC IN ({cpv_list})"
        f" AND PD >= {since}"
        f" AND NC IN ({nc_list})"
    )


def search_rfps(page: int = 1, limit: int = 10, days_back: int = 90) -> dict:
    payload = {
        "query": build_query(days_back),
        "fields": FIELDS,
        "page": page,
        "limit": limit,
    }
    response = requests.post(TED_SEARCH_URL, json=payload, timeout=30)
    if not response.ok:
        raise RuntimeError(f"TED API {response.status_code}: {response.text}")
    return response.json()


def format_notice(notice: dict) -> str:
    nd = notice.get("ND", "N/A")
    pd = notice.get("PD", "N/A")
    countries = ", ".join(notice.get("CY", []))
    nc = ", ".join(notice.get("NC", []))
    cpvs = ", ".join(notice.get("PC", []))

    # Title: prefer English, fall back to any available language
    ti = notice.get("TI", {})
    title = ti.get("eng") or ti.get("deu") or next(iter(ti.values()), "N/A")

    links = notice.get("links", {})
    html_link = links.get("htmlDirect", {}).get("ENG") or links.get("html", {}).get("ENG", "")
    xml_link = links.get("xml", {}).get("MUL", "")

    lines = [
        f"  Notice:   {nd}",
        f"  Date:     {pd}",
        f"  Country:  {countries}",
        f"  Type:     {nc}",
        f"  CPV:      {cpvs[:120]}{'...' if len(cpvs) > 120 else ''}",
        f"  Title:    {title[:200]}",
    ]
    if html_link:
        lines.append(f"  Link:     {html_link}")
    if xml_link:
        lines.append(f"  XML:      {xml_link}")
    return "\n".join(lines)


def main():
    days_back = 90
    limit = 20
    print(f"Searching TED for open RFPs (last {days_back} days, up to {limit} results)...")
    print(f"Query: {build_query(days_back)}\n")

    data = search_rfps(limit=limit, days_back=days_back)

    total = data.get("totalNoticeCount", 0)
    notices = data.get("notices", [])
    print(f"Total matching notices: {total}")
    print(f"Showing: {len(notices)}\n")
    print("=" * 80)

    for i, notice in enumerate(notices, 1):
        print(f"[{i}]")
        print(format_notice(notice))
        print()

    if total > limit:
        print(f"({total - limit} more results — increase `limit` or paginate with `page`)")


if __name__ == "__main__":
    main()
