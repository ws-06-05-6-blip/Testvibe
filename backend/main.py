"""
SecOps CMDB — Vulnerability Scanner Backend
Open-source Nessus alternative using nmap + NVD CVE database.

Usage:
  python3 -m uvicorn main:app --reload --port 8000
"""

import asyncio
import json
import sqlite3
import subprocess
import uuid
import xml.etree.ElementTree as ET
from contextlib import asynccontextmanager, contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import aiohttp
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Config ──────────────────────────────────────────────────────────────────

DB_PATH = Path(__file__).parent / "scanner.db"

SCAN_PROFILES: dict[str, dict[str, Any]] = {
    "quick": {
        "name": "Quick Scan",
        "description": "Top 100 ports with version detection. (~1 min)",
        "flags": ["-sT", "-sV", "--top-ports", "100", "-T4"],
    },
    "standard": {
        "name": "Standard Scan",
        "description": "Top 1000 ports with version detection. Recommended. (~3 min)",
        "flags": ["-sT", "-sV", "--top-ports", "1000", "-T4"],
    },
    "full": {
        "name": "Full Port Scan",
        "description": "All 65535 ports with version detection. Thorough. (~15 min)",
        "flags": ["-sT", "-sV", "-p-", "-T4"],
    },
    "discovery": {
        "name": "Service Discovery",
        "description": "Standard + safe NSE scripts (banner, HTTP, SSL). (~5 min)",
        "flags": ["-sT", "-sV", "--script=safe", "--top-ports", "1000", "-T4"],
    },
    "vuln": {
        "name": "Vulnerability Scan",
        "description": "Standard + NSE vulnerability scripts. Most thorough. (~20 min)",
        "flags": ["-sT", "-sV", "--script=vuln", "--top-ports", "1000", "-T4"],
    },
}

NVD_API = "https://services.nvd.nist.gov/rest/json/cves/2.0"

# Common port → service name mapping (used by Python fallback scanner)
WELL_KNOWN: dict[int, str] = {
    21: "ftp", 22: "ssh", 23: "telnet", 25: "smtp", 53: "domain",
    80: "http", 88: "kerberos", 110: "pop3", 111: "rpcbind", 119: "nntp",
    135: "msrpc", 139: "netbios-ssn", 143: "imap", 161: "snmp",
    179: "bgp", 389: "ldap", 443: "https", 445: "microsoft-ds",
    465: "smtps", 514: "shell", 515: "printer", 548: "afp",
    554: "rtsp", 587: "submission", 631: "ipp", 636: "ldaps",
    873: "rsync", 993: "imaps", 995: "pop3s", 1433: "ms-sql-s",
    1521: "oracle", 1723: "pptp", 2049: "nfs", 2121: "ccproxy-ftp",
    3000: "ppp", 3306: "mysql", 3389: "ms-wbt-server", 3986: "mapper-ws-ethd",
    4899: "radmin", 5000: "upnp", 5060: "sip", 5173: "vite-dev",
    5432: "postgresql", 5900: "vnc", 6000: "x11", 6379: "redis",
    7070: "realserver", 8000: "http-alt", 8008: "http", 8080: "http-proxy",
    8081: "blackice-icecap", 8443: "https-alt", 8888: "sun-answerbook",
    9200: "wap-wsp", 10000: "snet-sensor-mgmt", 27017: "mongod",
}

# Top ports per profile (number of ports to scan in fallback mode)
PROFILE_PORT_COUNT = {
    "quick": 100, "standard": 500, "full": 5000,
    "discovery": 500, "vuln": 500,
}

# ── Database ─────────────────────────────────────────────────────────────────

@contextmanager
def db():
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    with db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS scans (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                target TEXT NOT NULL,
                profile TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                progress INTEGER NOT NULL DEFAULT 0,
                started_at TEXT,
                completed_at TEXT,
                hosts_total INTEGER NOT NULL DEFAULT 0,
                hosts_scanned INTEGER NOT NULL DEFAULT 0,
                vuln_critical INTEGER NOT NULL DEFAULT 0,
                vuln_high INTEGER NOT NULL DEFAULT 0,
                vuln_medium INTEGER NOT NULL DEFAULT 0,
                vuln_low INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                error TEXT
            );

            CREATE TABLE IF NOT EXISTS hosts (
                id TEXT PRIMARY KEY,
                scan_id TEXT NOT NULL,
                ip TEXT NOT NULL,
                hostname TEXT,
                os TEXT,
                status TEXT NOT NULL DEFAULT 'up',
                risk_score REAL NOT NULL DEFAULT 0,
                FOREIGN KEY (scan_id) REFERENCES scans(id)
            );

            CREATE TABLE IF NOT EXISTS ports (
                id TEXT PRIMARY KEY,
                host_id TEXT NOT NULL,
                port INTEGER NOT NULL,
                protocol TEXT NOT NULL,
                state TEXT NOT NULL,
                service TEXT,
                product TEXT,
                version TEXT,
                extra_info TEXT,
                FOREIGN KEY (host_id) REFERENCES hosts(id)
            );

            CREATE TABLE IF NOT EXISTS vulnerabilities (
                id TEXT PRIMARY KEY,
                host_id TEXT NOT NULL,
                cve_id TEXT NOT NULL,
                description TEXT,
                cvss_score REAL NOT NULL DEFAULT 0,
                severity TEXT NOT NULL,
                published TEXT,
                url TEXT,
                FOREIGN KEY (host_id) REFERENCES hosts(id)
            );

            CREATE TABLE IF NOT EXISTS cve_cache (
                cache_key TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                cached_at TEXT NOT NULL
            );
        """)

# ── nmap scanning ─────────────────────────────────────────────────────────────

def run_nmap(target: str, flags: list[str]) -> dict[str, Any]:
    cmd = ["nmap", "-oX", "-"] + flags + [target]
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=1800
        )
    except FileNotFoundError:
        raise RuntimeError("nmap is not installed. Install it with: sudo dnf install -y nmap")
    except subprocess.TimeoutExpired:
        raise RuntimeError("Scan timed out after 30 minutes")

    if result.returncode not in (0, 1):
        raise RuntimeError(f"nmap error: {result.stderr.strip() or 'unknown error'}")

    return parse_nmap_xml(result.stdout)


def parse_nmap_xml(xml_str: str) -> dict[str, Any]:
    try:
        root = ET.fromstring(xml_str)
    except ET.ParseError as e:
        raise RuntimeError(f"Failed to parse nmap output: {e}")

    hosts = []
    for host_elem in root.findall("host"):
        status_elem = host_elem.find("status")
        if status_elem is None or status_elem.get("state") != "up":
            continue

        ip = None
        for addr in host_elem.findall("address"):
            if addr.get("addrtype") == "ipv4":
                ip = addr.get("addr")
        if not ip:
            continue

        hostname = None
        hostnames_elem = host_elem.find("hostnames")
        if hostnames_elem is not None:
            for h in hostnames_elem.findall("hostname"):
                if h.get("type") == "PTR":
                    hostname = h.get("name")
                    break

        os_name = None
        osmatch = host_elem.find(".//osmatch")
        if osmatch is not None:
            os_name = osmatch.get("name")

        ports = []
        for port_elem in host_elem.findall(".//port"):
            state_elem = port_elem.find("state")
            if state_elem is None or state_elem.get("state") != "open":
                continue
            svc = port_elem.find("service")
            ports.append({
                "port": int(port_elem.get("portid", 0)),
                "protocol": port_elem.get("protocol", "tcp"),
                "state": "open",
                "service": svc.get("name") if svc is not None else None,
                "product": svc.get("product") if svc is not None else None,
                "version": svc.get("version") if svc is not None else None,
                "extra_info": svc.get("extrainfo") if svc is not None else None,
            })

        # Collect any NSE script findings (vuln profile)
        script_findings: list[str] = []
        for script in host_elem.findall(".//script"):
            output = script.get("output", "") or ""
            if "VULNERABLE" in output or "CVE-" in output:
                script_findings.append(f"{script.get('id')}: {output[:300]}")

        hosts.append({
            "ip": ip,
            "hostname": hostname,
            "os": os_name,
            "ports": ports,
            "script_findings": script_findings,
        })

    return {"hosts": hosts}

# ── Python fallback scanner ───────────────────────────────────────────────────

async def _tcp_probe(ip: str, port: int, timeout: float = 1.5) -> bool:
    try:
        _, writer = await asyncio.wait_for(
            asyncio.open_connection(ip, port), timeout=timeout
        )
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass
        return True
    except Exception:
        return False


async def run_python_scanner(target: str, profile: str) -> dict[str, Any]:
    """Pure-asyncio TCP scanner used when nmap is not installed."""
    import socket as _socket

    try:
        ip = await asyncio.get_event_loop().run_in_executor(
            None, _socket.gethostbyname, target
        )
    except _socket.gaierror:
        raise RuntimeError(f"Cannot resolve host: {target}")

    port_count = PROFILE_PORT_COUNT.get(profile, 500)
    # Build port list: well-known ports first, then fill up to port_count from 1–port_count*2
    priority = list(WELL_KNOWN.keys())
    extra = [p for p in range(1, port_count * 3) if p not in WELL_KNOWN]
    ports = (priority + extra)[:port_count]

    semaphore = asyncio.Semaphore(256)

    async def probe(port: int) -> tuple[int, bool]:
        async with semaphore:
            return port, await _tcp_probe(ip, port)

    results = await asyncio.gather(*[probe(p) for p in ports])

    open_ports = sorted(
        [
            {
                "port": port,
                "protocol": "tcp",
                "state": "open",
                "service": WELL_KNOWN.get(port),
                "product": None,
                "version": None,
                "extra_info": "(detected via TCP connect; install nmap for version info)",
            }
            for port, is_open in results
            if is_open
        ],
        key=lambda x: x["port"],
    )

    return {
        "hosts": [
            {
                "ip": ip,
                "hostname": target if target != ip else None,
                "os": None,
                "ports": open_ports,
                "script_findings": [],
            }
        ]
    }

# ── NVD CVE lookup ────────────────────────────────────────────────────────────

async def _fetch_nvd(keyword: str, api_key: str | None) -> list[dict[str, Any]]:
    params = {"keywordSearch": keyword, "resultsPerPage": 15}
    headers: dict[str, str] = {}
    if api_key:
        headers["apiKey"] = api_key

    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=15)) as session:
            async with session.get(NVD_API, params=params, headers=headers) as resp:
                if resp.status != 200:
                    return []
                data = await resp.json(content_type=None)
    except Exception:
        return []

    results = []
    for item in data.get("vulnerabilities", []):
        cve = item.get("cve", {})
        cve_id = cve.get("id", "")

        descriptions = cve.get("descriptions", [])
        desc = next((d["value"] for d in descriptions if d.get("lang") == "en"), "")

        metrics = cve.get("metrics", {})
        cvss_score = 0.0
        severity = "LOW"

        for key in ("cvssMetricV31", "cvssMetricV30"):
            entries = metrics.get(key, [])
            if entries:
                cvss_data = entries[0].get("cvssData", {})
                cvss_score = float(cvss_data.get("baseScore", 0))
                severity = cvss_data.get("baseSeverity", "LOW").upper()
                break
        else:
            entries = metrics.get("cvssMetricV2", [])
            if entries:
                cvss_data = entries[0].get("cvssData", {})
                cvss_score = float(cvss_data.get("baseScore", 0))
                severity = "HIGH" if cvss_score >= 7.0 else "MEDIUM" if cvss_score >= 4.0 else "LOW"

        if cvss_score < 4.0:
            continue

        results.append({
            "cve_id": cve_id,
            "description": desc[:500],
            "cvss_score": cvss_score,
            "severity": severity,
            "published": cve.get("published", "")[:10],
            "url": f"https://nvd.nist.gov/vuln/detail/{cve_id}",
        })

    return sorted(results, key=lambda x: x["cvss_score"], reverse=True)[:10]


async def lookup_cves(
    product: str, version: str | None, api_key: str | None
) -> list[dict[str, Any]]:
    if not product or product in ("tcpwrapped", "unknown"):
        return []

    keyword = f"{product} {version}".strip() if version else product
    cache_key = keyword.lower().replace(" ", "_")[:100]

    with db() as conn:
        row = conn.execute(
            "SELECT data, cached_at FROM cve_cache WHERE cache_key=?", (cache_key,)
        ).fetchone()
        if row:
            age = (
                datetime.now(timezone.utc)
                - datetime.fromisoformat(row["cached_at"])
            ).total_seconds()
            if age < 86400:
                return json.loads(row["data"])

    cves = await _fetch_nvd(keyword, api_key)

    with db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO cve_cache (cache_key, data, cached_at) VALUES (?, ?, ?)",
            (cache_key, json.dumps(cves), datetime.now(timezone.utc).isoformat()),
        )

    return cves

# ── Scan worker ───────────────────────────────────────────────────────────────

async def run_scan(
    scan_id: str, target: str, profile: str, nvd_api_key: str | None
) -> None:
    def update_scan(**kwargs: Any) -> None:
        cols = ", ".join(f"{k}=?" for k in kwargs)
        vals = list(kwargs.values()) + [scan_id]
        with db() as conn:
            conn.execute(f"UPDATE scans SET {cols} WHERE id=?", vals)

    try:
        update_scan(status="running", started_at=datetime.now(timezone.utc).isoformat())

        flags = SCAN_PROFILES.get(profile, SCAN_PROFILES["standard"])["flags"]
        try:
            nmap_result = await asyncio.to_thread(run_nmap, target, flags)
        except RuntimeError as exc:
            if "not installed" in str(exc):
                nmap_result = await run_python_scanner(target, profile)
            else:
                raise
        hosts_data = nmap_result["hosts"]

        update_scan(hosts_total=len(hosts_data), progress=10)

        vuln_counts: dict[str, int] = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}

        for i, host in enumerate(hosts_data):
            host_id = str(uuid.uuid4())

            with db() as conn:
                conn.execute(
                    "INSERT INTO hosts (id, scan_id, ip, hostname, os) VALUES (?, ?, ?, ?, ?)",
                    (host_id, scan_id, host["ip"], host.get("hostname"), host.get("os")),
                )

            for port in host["ports"]:
                with db() as conn:
                    conn.execute(
                        "INSERT INTO ports (id, host_id, port, protocol, state, service, product, version, extra_info)"
                        " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        (str(uuid.uuid4()), host_id, port["port"], port["protocol"],
                         port["state"], port.get("service"), port.get("product"),
                         port.get("version"), port.get("extra_info")),
                    )

            # CVE lookup: deduplicate by (product, version) across all ports of this host
            seen_service_keys: set[str] = set()
            seen_cve_ids: set[str] = set()
            risk_score = 0.0

            for port in host["ports"]:
                product = port.get("product") or ""
                version = port.get("version") or ""
                svc_key = f"{product.lower()}_{version.lower()}"
                if not product or svc_key in seen_service_keys:
                    continue
                seen_service_keys.add(svc_key)

                # Respect NVD rate limit (5 req/30s without key)
                await asyncio.sleep(0.6 if not nvd_api_key else 0.1)

                cves = await lookup_cves(product, version, nvd_api_key)

                for cve in cves:
                    if cve["cve_id"] in seen_cve_ids:
                        continue
                    seen_cve_ids.add(cve["cve_id"])
                    vuln_counts[cve["severity"]] = vuln_counts.get(cve["severity"], 0) + 1
                    risk_score = max(risk_score, cve["cvss_score"])

                    with db() as conn:
                        conn.execute(
                            "INSERT INTO vulnerabilities"
                            " (id, host_id, cve_id, description, cvss_score, severity, published, url)"
                            " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                            (str(uuid.uuid4()), host_id, cve["cve_id"], cve["description"],
                             cve["cvss_score"], cve["severity"], cve["published"], cve["url"]),
                        )

            with db() as conn:
                conn.execute("UPDATE hosts SET risk_score=? WHERE id=?", (risk_score, host_id))

            progress = 10 + int(90 * (i + 1) / max(len(hosts_data), 1))
            update_scan(
                hosts_scanned=i + 1,
                progress=progress,
                vuln_critical=vuln_counts.get("CRITICAL", 0),
                vuln_high=vuln_counts.get("HIGH", 0),
                vuln_medium=vuln_counts.get("MEDIUM", 0),
                vuln_low=vuln_counts.get("LOW", 0),
            )

        update_scan(
            status="completed",
            progress=100,
            completed_at=datetime.now(timezone.utc).isoformat(),
        )

    except Exception as exc:
        with db() as conn:
            conn.execute(
                "UPDATE scans SET status='failed', error=? WHERE id=?",
                (str(exc), scan_id),
            )

# ── FastAPI app ───────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield

app = FastAPI(title="SecOps CMDB — Vulnerability Scanner API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Models ────────────────────────────────────────────────────────────────────

class CreateScanRequest(BaseModel):
    name: str
    target: str
    profile: str
    nvd_api_key: str | None = None

# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    checks: dict[str, Any] = {}
    try:
        result = subprocess.run(
            ["nmap", "--version"], capture_output=True, timeout=5
        )
        checks["nmap"] = result.returncode == 0
        checks["nmap_version"] = (
            result.stdout.decode().split("\n")[0] if result.returncode == 0 else None
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        checks["nmap"] = False
        checks["nmap_version"] = None

    try:
        with db() as conn:
            conn.execute("SELECT 1")
        checks["database"] = True
    except Exception:
        checks["database"] = False

    checks["fallback_scanner"] = not checks.get("nmap", False)
    return {
        "status": "ok",  # always ok — Python fallback scanner is always available
        "checks": checks,
    }


@app.get("/api/profiles")
async def get_profiles():
    return SCAN_PROFILES


@app.get("/api/scans")
async def list_scans():
    with db() as conn:
        rows = conn.execute(
            "SELECT * FROM scans ORDER BY created_at DESC"
        ).fetchall()
    return [dict(r) for r in rows]


@app.post("/api/scans", status_code=201)
async def create_scan(req: CreateScanRequest, background_tasks: BackgroundTasks):
    if req.profile not in SCAN_PROFILES:
        raise HTTPException(status_code=400, detail=f"Unknown profile: {req.profile}")
    if not req.target.strip():
        raise HTTPException(status_code=400, detail="Target is required")
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")

    scan_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    with db() as conn:
        conn.execute(
            "INSERT INTO scans (id, name, target, profile, status, progress, created_at)"
            " VALUES (?, ?, ?, ?, 'pending', 0, ?)",
            (scan_id, req.name.strip(), req.target.strip(), req.profile, now),
        )

    background_tasks.add_task(
        run_scan, scan_id, req.target.strip(), req.profile, req.nvd_api_key
    )
    return {"id": scan_id, "status": "pending"}


@app.get("/api/scans/{scan_id}")
async def get_scan(scan_id: str):
    with db() as conn:
        scan = conn.execute(
            "SELECT * FROM scans WHERE id=?", (scan_id,)
        ).fetchone()
        if not scan:
            raise HTTPException(status_code=404, detail="Scan not found")

        scan_dict = dict(scan)

        hosts_rows = conn.execute(
            "SELECT * FROM hosts WHERE scan_id=? ORDER BY risk_score DESC", (scan_id,)
        ).fetchall()

        host_list = []
        for h in hosts_rows:
            h_dict = dict(h)
            h_dict["ports"] = [
                dict(p) for p in conn.execute(
                    "SELECT * FROM ports WHERE host_id=? ORDER BY port", (h["id"],)
                ).fetchall()
            ]
            h_dict["vulnerabilities"] = [
                dict(v) for v in conn.execute(
                    "SELECT * FROM vulnerabilities WHERE host_id=? ORDER BY cvss_score DESC",
                    (h["id"],),
                ).fetchall()
            ]
            host_list.append(h_dict)

        scan_dict["hosts"] = host_list
    return scan_dict


@app.delete("/api/scans/{scan_id}", status_code=204)
async def delete_scan(scan_id: str):
    with db() as conn:
        conn.execute(
            "DELETE FROM vulnerabilities WHERE host_id IN"
            " (SELECT id FROM hosts WHERE scan_id=?)",
            (scan_id,),
        )
        conn.execute(
            "DELETE FROM ports WHERE host_id IN (SELECT id FROM hosts WHERE scan_id=?)",
            (scan_id,),
        )
        conn.execute("DELETE FROM hosts WHERE scan_id=?", (scan_id,))
        conn.execute("DELETE FROM scans WHERE id=?", (scan_id,))
