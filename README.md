# Equiply — Device Data Enrichment

A React + FastAPI application that takes a raw medical device inventory CSV and enriches it with two derived columns — `manufactured_date` and `device_type` — then surfaces the results as a sortable table and an interactive pie chart.

---

## How to Run

```bash
# 1. Install Python dependencies
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# 2. Dev mode (hot-reload frontend + backend separately)
cd frontend && npm install && npm run dev   # Vite on :5173, proxies /api → :8000
.venv/bin/uvicorn main:app --port 8000 --reload

# 3. Production (serve everything from FastAPI at /)
cd frontend && npm run build               # outputs to ../static/
.venv/bin/uvicorn main:app --port 8000
```

---

## Data Transformation Pipeline

When a CSV is uploaded to `POST /api/enrich`, it goes through four sequential steps in `main.py`:

```
Raw CSV upload
      │
      ▼
┌─────────────────────────────────────────────────────┐
│  Step 1 — Parse                                     │
│  pd.read_csv on the uploaded bytes.                 │
│  Expected columns: manufacturer, model,             │
│  serial number                                      │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│  Step 2 — manufactured_date  (data_parser.py)       │
│                                                     │
│  add_manufacturing_year() is called on the          │
│  DataFrame. It dispatches to a per-manufacturer     │
│  decoder based on the manufacturer name. Each       │
│  decoder reverse-engineers the year (and            │
│  sometimes month) that is encoded inside the        │
│  serial number using manufacturer-specific          │
│  patterns.                                          │
│                                                     │
│  Examples:                                          │
│  · ZOLL Medical  — [code][YY][MonthLetter]          │
│    AF23G169205 → July 2023                          │
│  · Edan Instruments — find M or K + 2 digits        │
│    M19805320027 → 2019                              │
│  · GE Healthcare — prefix map                       │
│    SA315219009 → SA3·15 → 2015                      │
│  · LINET — leading 4-digit year                     │
│    20210147025 → 2021                               │
│  · Hillrom CENTURY — last 4 digits                  │
│    02R2981999 → 1999                                │
│                                                     │
│  Column added: manufacturing_year                   │
│  Renamed to:   manufactured_date                    │
│                                                     │
│  Rows with no decodable pattern → null              │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│  Step 3 — device_type  (two-tier lookup)            │
│                                                     │
│  Tier 1 — openFDA 510k API                          │
│  Queries api.fda.gov/device/510k.json with the      │
│  model name. If the FDA has a 510k clearance        │
│  record for that exact model name, it returns       │
│  the standardized openfda.device_name — the         │
│  official FDA classification string.                │
│                                                     │
│  Example hits:                                      │
│  · BENEVISION N15 → Monitor, Physiological,         │
│    Patient (With Arrhythmia Detection Or Alarms)    │
│  · M SERIES → Automated External Defibrillators     │
│    (Non-Wearable)                                   │
│  · SPECTRUM IQ → Pump, Infusion                     │
│  · CENTURY → Bed, Ac-Powered Adjustable Hospital    │
│                                                     │
│  Deduplicated: one API call per unique model,       │
│  results cached for the duration of the request.   │
│                                                     │
│  Tier 2 — Keyword fallback                          │
│  The FDA 510k database indexes clearance            │
│  submissions by device description, not by          │
│  proprietary brand model names. ~57% of the         │
│  models in this dataset have no exact 510k match    │
│  (e.g. AEDPLUS, RSERIES, INTELLIVUE MP50,           │
│  PLUMA+, FILAC3000, P1440). Without a fallback,     │
│  those rows would have no device_type at all.       │
│                                                     │
│  The fallback uses model name keyword matching      │
│  (e.g. "rseries" → Defibrillator, "century" →      │
│  Hospital Bed) as a reliable offline safety net.   │
│                                                     │
│  Column added: device_type                          │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│  Step 4 — Sort + Outlier Detection                  │
│                                                     │
│  Rows are sorted ascending by manufactured_date.    │
│  Month-prefixed values (e.g. "July 2023") sort      │
│  correctly alongside plain years ("2021").          │
│  Rows with null dates sort to the end.              │
│                                                     │
│  An _outlier_reason column is added for rows        │
│  where the decoded date looks suspicious:           │
│  · Decoded year is in the future                    │
│  · Hillrom P3200 prefix decode produces year >2026  │
│  · Any decoded year ≥ 2030                          │
│  These are surfaced as warnings in the UI table.   │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
              JSON response to UI
              { rows, decoder_logic, filename, total }
```

---

## Results Page

### Enriched Data Table

- Displays all rows from the enriched DataFrame
- `manufactured_date` and `device_type` columns are highlighted in teal with a **new** badge
- Sorted ascending by `manufactured_date` (oldest first, unknowns at the end)
- Paginated at 50 rows per page
- **Outlier rows** are highlighted in amber. The `manufactured_date` cell shows a ⚠ icon — hovering it reveals a tooltip explaining exactly which part of the serial number was decoded and why the result is suspicious

### Device Type Distribution Pie Chart

The donut chart shows the **proportion of each device type** across all rows in the uploaded file. Each slice represents one device type category, sized by the number of devices that belong to it.

Hovering a slice shows a rich tooltip with:
- Device count and percentage for that type
- The top manufacturers contributing devices of that type
- For each manufacturer that has a known serial decoder, the **exact decode logic** used to extract the date from the serial number (e.g. *"Product code + 2-digit year + month letter (A=Jan … L=Dec)"* for ZOLL Medical)

This makes the chart a diagnostic tool — you can see not just what types of devices are in the inventory, but how confident the date decoding is for each manufacturer segment.

---

## Why the Keyword Fallback Exists

The `device_type` lookup tries the **openFDA 510k API** first (`api.fda.gov/device/510k.json`). This database contains 510(k) premarket clearance submissions — documents manufacturers file with the FDA before bringing a device to market in the US.

The limitation: the FDA indexes these records by their generic device description (e.g. *"Automated External Defibrillators (Non-Wearable)"*), not by the manufacturer's proprietary model name. Searching for `AEDPLUS`, `RSERIES`, `INTELLIVUE MP50`, or `PLUMA+` returns no match because those brand names do not appear in the 510k `device_name` field.

Testing against all 49 unique models in the challenge dataset showed:
- **21 models** matched and returned a valid FDA classification string
- **28 models** returned no result

Removing the fallback would leave ~200+ rows (roughly 25% of the dataset) with a blank `device_type`. The keyword fallback fills that gap using model name substrings that are unambiguous for the devices in this dataset, ensuring full coverage while the FDA lookup provides authoritative labels wherever possible.

---

## Project Structure

```
equiply/
├── data_parser.py          Per-manufacturer serial → date decoders (original, unmodified)
├── main.py                 FastAPI server — wires data_parser.py into the API,
│                           adds device_type lookup, outlier detection, serves React SPA
├── requirements.txt
├── static/                 Built React app (generated by npm run build)
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Navbar.jsx
    │   │   ├── FileUpload.jsx       Drag-and-drop CSV upload zone
    │   │   ├── DataTable.jsx        Paginated table with outlier highlighting
    │   │   ├── DeviceTypePieChart.jsx  Donut chart with decoder-logic tooltips
    │   │   └── ExportButton.jsx     Client-side CSV download of enriched data
    │   └── pages/
    │       ├── UploadPage.jsx       Step 1 — file selection and upload
    │       └── ResultsPage.jsx      Step 2 — stats, chart, table, export
    ├── package.json
    ├── vite.config.js       Builds to ../static/, proxies /api to :8000 in dev
    └── tailwind.config.js
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/enrich` | Upload CSV → returns enriched JSON rows + decoder_logic map |
| `POST` | `/api/enrich/download` | Upload CSV → streams back enriched CSV file |
| `GET` | `/*` | Serves the React SPA (production only, requires `npm run build`) |
