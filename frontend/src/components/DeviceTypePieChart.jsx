import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const PALETTE = [
  '#26305D', '#4FC3F7', '#4DB6AC', '#7986CB', '#FF8A65',
  '#A5D6A7', '#FFD54F', '#F48FB1', '#CE93D8', '#80DEEA',
  '#FFAB91', '#B0BEC5', '#80CBC4', '#9FA8DA', '#EF9A9A', '#FFF176',
]

export default function DeviceTypePieChart({ rows, decoderLogic = {} }) {
  if (!rows || rows.length === 0) return null

  // Count by device_type
  const counts = rows.reduce((acc, row) => {
    const type = row.device_type || 'Unknown'
    acc[type] = (acc[type] || 0) + 1
    return acc
  }, {})

  const total = rows.length
  const data = Object.entries(counts)
    .map(([name, value]) => ({ name, value, pct: ((value / total) * 100).toFixed(1) }))
    .sort((a, b) => b.value - a.value)

  // Build a map: device_type → list of manufacturers that produce it (with decoder logic)
  const typeToManufacturers = {}
  rows.forEach(row => {
    const dtype = row.device_type || 'Unknown'
    const mfr = row.manufacturer
    if (!mfr) return
    if (!typeToManufacturers[dtype]) typeToManufacturers[dtype] = {}
    typeToManufacturers[dtype][mfr] = (typeToManufacturers[dtype][mfr] || 0) + 1
  })

  return (
    <div className="flex flex-col gap-5">
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={75}
            outerRadius={115}
            paddingAngle={2}
            dataKey="value"
            startAngle={90}
            endAngle={-270}
          >
            {data.map((entry, i) => (
              <Cell
                key={entry.name}
                fill={PALETTE[i % PALETTE.length]}
                stroke="white"
                strokeWidth={1.5}
              />
            ))}
          </Pie>
          <Tooltip
            content={
              <CustomTooltip
                total={total}
                typeToManufacturers={typeToManufacturers}
                decoderLogic={decoderLogic}
              />
            }
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-2 min-w-0">
            <span
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ background: PALETTE[i % PALETTE.length] }}
            />
            <span className="text-xs text-navy/70 font-body truncate flex-1">{d.name}</span>
            <span className="text-xs font-mono text-navy font-medium flex-shrink-0">{d.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function CustomTooltip({ active, payload, total, typeToManufacturers, decoderLogic }) {
  if (!active || !payload?.length) return null
  const { name, value, pct } = payload[0].payload

  const mfrCounts = typeToManufacturers[name] || {}
  // Sort manufacturers by count desc, take top 5
  const topMfrs = Object.entries(mfrCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  return (
    <div className="bg-navy text-cream text-xs font-body px-3 py-3 rounded-xl shadow-xl pointer-events-none max-w-xs">
      {/* Header */}
      <p className="font-semibold text-sm mb-1">{name}</p>
      <p className="text-cream/60 mb-3">{value} devices · {pct}%</p>

      {/* Manufacturers breakdown */}
      {topMfrs.length > 0 && (
        <div className="border-t border-cream/10 pt-2 mb-2">
          <p className="text-cream/40 text-[10px] uppercase tracking-wider mb-1.5">Manufacturers</p>
          {topMfrs.map(([mfr, cnt]) => {
            const logic = decoderLogic[mfr]
            return (
              <div key={mfr} className="mb-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-cream/80 truncate">{mfr}</span>
                  <span className="text-cream/50 flex-shrink-0">{cnt}</span>
                </div>
                {logic && (
                  <p className="text-[10px] text-accent/80 leading-snug mt-0.5 pl-1 border-l border-accent/30">
                    {logic}
                  </p>
                )}
              </div>
            )
          })}
          {Object.keys(mfrCounts).length > 5 && (
            <p className="text-cream/30 text-[10px] mt-1">
              +{Object.keys(mfrCounts).length - 5} more manufacturers
            </p>
          )}
        </div>
      )}
    </div>
  )
}
