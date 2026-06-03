"""
main.py — Equiply FastAPI server
"""

import io
import re
import builtins
import requests
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

# ── Import functions from data_parser.py ─────────────────────────────────────
# data_parser.py has top-level Colab script lines (pd.read_csv, display, print)
# that crash on import. We exec only the `def` blocks by temporarily mocking
# display and replacing read_csv with a dummy — the script lines run harmlessly.

_real_read_csv = pd.read_csv
pd.read_csv = lambda *a, **kw: pd.DataFrame([{"manufacturer":"x","model":"x","serial number":"x"}])
builtins.display = lambda *a, **kw: None  # type: ignore

exec(open(Path(__file__).parent / "data_parser.py").read(), globals())

pd.read_csv = _real_read_csv
del builtins.display
# ─────────────────────────────────────────────────────────────────────────────
# After exec, globals now contains: decode_manufacturing_year, add_manufacturing_year, etc.


def enrich(df: pd.DataFrame) -> pd.DataFrame:
    """Calls your add_manufacturing_year, renames column, adds device_type, sorts."""

    # 1. Your function — adds 'manufacturing_year'
    df = add_manufacturing_year(df)  # noqa: F821 — defined via exec above

    # 2. Rename to match challenge spec
    df = df.rename(columns={"manufacturing_year": "manufactured_date"})

    # 3. device_type — FDA 510k endpoint first, keyword fallback if nothing found
    def get_device_type_fda(manufacturer, model):
        """
        Queries the openFDA 510k clearance database by device_name.
        Returns the standardized openfda.device_name (e.g. 'Automated External Defibrillators')
        or None if not found.
        Reference: https://open.fda.gov/apis/device/510k/
        """
        try:
            url = "https://api.fda.gov/device/510k.json"
            params = {"search": f'device_name:"{model}"', "limit": 1}
            response = requests.get(url, params=params, timeout=5)
            data = response.json()
            if "results" in data and len(data["results"]) > 0:
                result = data["results"][0]
                # openfda.device_name is the standardized FDA classification name
                # Note: in the 510k endpoint this is a string, not a list
                openfda = result.get("openfda", {})
                device_name = openfda.get("device_name")
                if device_name:
                    # Handle both string (510k) and list (other endpoints)
                    return device_name if isinstance(device_name, str) else device_name[0]
            return None
        except Exception:
            return None

    def get_device_type_fallback(manufacturer, model):
        m, mfr = model.lower(), manufacturer.lower()
        if any(k in m for k in ["aedplus", "m series", "rseries", "r series", "x series", "propaq"]):
            return "Defibrillator"
        if any(k in m for k in ["intellivue", "benevision", "apex pro", "patient data module",
                                  "epm12", "mx500", "mx40", "mp20", "mp30", "mp50", "m3002a",
                                  "im50", "im70", "im3", "elitev5", "it20", "rad8"]):
            return "Patient Monitor"
        if any(k in m for k in ["p1440", "p3200", "century", "eleganza"]):
            return "Hospital Bed"
        if any(k in m for k in ["spectrum iq", "pluma", "iob-507"]):
            return "Infusion Pump"
        if any(k in m for k in ["se1200"]):
            return "ECG Machine"
        if any(k in m for k in ["f9express"]):
            return "Fetal Monitor"
        if any(k in m for k in ["flowtron"]):
            return "DVT Pump"
        if any(k in m for k in ["cv190", "cst-4000", "cst-5000"]):
            return "Endoscopy System"
        if any(k in m for k in ["filac", "tat5000", "suretempp", "ce 1434"]):
            return "Thermometer"
        if any(k in m for k in ["spot vital"]):
            return "Vital Signs Monitor"
        if any(k in m for k in ["smartvue"]):
            return "Temperature Monitor"
        if any(k in m for k in ["uc95"]):
            return "Ultrasound Cleaner"
        if any(k in m for k in ["rapidvac"]):
            return "Suction Device"
        if any(k in m for k in ["g380"]):
            return "Centrifuge"
        if any(k in m for k in ["642e"]):
            return "Lab Analyzer"
        if "stryker" in mfr:
            return "Surgical Equipment"
        return "Medical Device"

    # Deduplicate FDA calls — one call per unique model, cache results
    unique_models = df["model"].unique()
    fda_cache = {}
    for model_name in unique_models:
        fda_cache[model_name] = get_device_type_fda(None, model_name)

    def get_device_type(manufacturer, model):
        fda_result = fda_cache.get(model)
        if fda_result:
            return fda_result
        return get_device_type_fallback(manufacturer, model)

    df["device_type"] = df.apply(
        lambda r: get_device_type(str(r["manufacturer"]), str(r["model"])), axis=1
    )

    # 4. Sort ascending by manufactured_date (unknowns at end)
    _MONTHS = {"january":1,"february":2,"march":3,"april":4,"may":5,"june":6,
               "july":7,"august":8,"september":9,"october":10,"november":11,"december":12}

    def sort_key(v):
        s = str(v).strip() if v and str(v).lower() not in ("none","nan","") else ""
        if not s:
            return (9999, 99)
        parts = s.split()
        if len(parts) == 2:
            try:
                return (int(parts[1]), _MONTHS.get(parts[0].lower(), 0))
            except ValueError:
                pass
        try:
            return (int(s), 0)
        except ValueError:
            return (9999, 99)

    df["_sort"] = df["manufactured_date"].apply(sort_key)
    df = df.sort_values("_sort", kind="stable").drop(columns=["_sort"]).reset_index(drop=True)

    # 5. Flag outliers — rows where the decoded date looks suspicious given the decoder logic
    from datetime import date
    CURRENT_YEAR = date.today().year

    def get_outlier_reason(row):
        mfr   = str(row["manufacturer"]).strip()
        model = str(row["model"]).strip()
        serial= str(row["serial number"]).strip()
        val   = row["manufactured_date"]

        if not val or str(val).lower() in ("none", "nan", ""):
            return None  # unknown — not an outlier, just missing

        # Parse year out of the value (handles "2021" and "June 2021")
        parts = str(val).strip().split()
        try:
            year = int(parts[-1])
        except ValueError:
            return None

        # ── Rule 1: year in the future beyond current year ─────────────────────
        if year > CURRENT_YEAR:
            return (
                f"Decoded year {year} is in the future (current year: {CURRENT_YEAR}). "
                f"Decoder used the first 2-digit group in '{serial}' as YY → 20{str(year)[-2:]}. "
                f"The serial format for {mfr} {model} may not follow this pattern."
            )

        # ── Rule 2: Hillrom P3200 prefix decode producing implausible years ───
        if mfr in ("Hillrom", "HILL ROM") and model == "P3200":
            # Decoder: ^[A-Z](\d{2}) → letter + 2 digits. J309... → J30 → 2030
            m = re.match(r'^[A-Z](\d{2})', serial)
            if m:
                decoded_yy = int(m.group(1))
                if decoded_yy > CURRENT_YEAR - 2000 + 1:
                    return (
                        f"Hillrom P3200 decoder reads leading letter + 2 digits as YY. "
                        f"'{serial}' → '{serial[0]}{m.group(1)}' → year {2000 + decoded_yy}. "
                        f"This may be a false match — the 3rd digit is part of a day/sequence, "
                        f"not the year."
                    )

        # ── Rule 3: 2-digit prefix ambiguity (year ≥ 2030) ────────────────────
        if year >= 2030:
            return (
                f"Decoded year {year} is implausibly far in the future. "
                f"The decoder extracted the first 2-digit group from '{serial}' as YY → {year}. "
                f"The digit pair '{str(year)[-2:]}' likely represents something other than a year."
            )

        # ── Rule 4: very old dates (pre-1995) for non-legacy equipment ─────────
        if year < 1995 and mfr not in ("Hillrom", "HILL ROM"):
            return (
                f"Decoded year {year} is unusually old for {mfr} {model}. "
                f"Verify that the serial number pattern '{serial}' is correctly decoded."
            )

        return None

    df["_outlier_reason"] = df.apply(get_outlier_reason, axis=1)
    return df


# ── FastAPI ───────────────────────────────────────────────────────────────────

app = FastAPI(title="Equiply")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# Decoder logic descriptions — shown as tooltips on the pie chart per manufacturer
DECODER_LOGIC = {
    "American Diagnostic":  "Strip leading 'C' from serial, read first 2 digits as YY → 20YY",
    "BIOSONIC":             "Read first 2 digits of serial as YY → 20YY",
    "Cogentix Medical":     "Serial starts 'CS' + 2 digits → 20YY",
    "Covidien":             "Serial starts 'VL0' + 2 digits → 20YY",
    "Edan Instruments":     "Search for M or K followed by exactly 2 digits in serial → 20YY",
    "Exergen":              "Serial starts 'A' + 2 digits (YY) → 20YY",
    "Hillrom":              "CENTURY/PCENTURY: extract last 4 digits (19xx/20xx). P3200: leading letter + next 2 digits → 20YY",
    "HILL ROM":             "P1440/P3200: leading letter + 2 digits → 20YY. CENTURYP1400: last 4 digits as year",
    "Hospira":              "First 2 digits of serial = YY → 20YY",
    "Jiangmen Dacheng Medical Equipment Co.": "Find any '20XX' 4-digit sequence in serial",
    "LAB CORP.":            "First 2 digits of serial = YY → 20YY",
    "LINET":                "Serial starts with full 4-digit year '20XX'",
    "Masimo":               "Serial starts 'M' + 2 digits (YY) → 20YY",
    "Stryker":              "Starts with 4-digit '20XX' year; fallback: first 2 digits → 20YY",
    "THERMO SCIENTIFIC":    "First 2 digits of serial = YY → 20YY",
    "Unico":                "Find '20XX' followed by exactly 4 more digits in serial",
    "Welch Allyn":          "FILAC3000/SPOT: 'A' + 2-digit YY prefix or leading '20XX' 4-digit year",
    "ZOLL Medical":         "Product code (1-2 letters) + 2-digit year + month letter (A=Jan … L=Dec)",
    "GE HEALTHCARE":        "Prefix map: SA3YY→20YY, SPXYY→20YY, RTSYY→20YY, RT9YY→20YY",
    "ARJO INC.":            "First 2 digits of serial = YY → 20YY",
}

@app.post("/api/enrich")
async def enrich_csv(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Only .csv files accepted.")
    raw = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(raw))
        df = enrich(df)
    except Exception as exc:
        raise HTTPException(422, str(exc))
    df = df.where(df.notna(), other=None)
    rows = [{k: (None if (v != v) else v) for k, v in r.items()} for r in df.to_dict(orient="records")]

    # Build per-manufacturer decoder logic map from rows actually present in this upload
    manufacturers_in_file = list({r.get("manufacturer") for r in rows if r.get("manufacturer")})
    decoder_logic = {m: DECODER_LOGIC.get(m) for m in manufacturers_in_file if DECODER_LOGIC.get(m)}

    return {
        "filename": file.filename,
        "total": len(rows),
        "rows": rows,
        "decoder_logic": decoder_logic,
    }


@app.post("/api/enrich/download")
async def enrich_download(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Only .csv files accepted.")
    raw = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(raw))
        df = enrich(df)
    except Exception as exc:
        raise HTTPException(422, str(exc))
    out = file.filename.replace(".csv", "_enriched.csv")
    return StreamingResponse(
        io.BytesIO(df.to_csv(index=False).encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{out}"'},
    )


# ── Serve React SPA ───────────────────────────────────────────────────────────

STATIC_DIR = Path(__file__).parent / "static"

if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        return FileResponse(STATIC_DIR / "index.html")
