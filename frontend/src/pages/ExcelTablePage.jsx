const COLUMNS = [
  { key: 'authorNickname', label: '达人昵称' },
  { key: 'authorId', label: '达人ID' },
  { key: 'videoInfo', label: '视频信息' },
  { key: 'videoId', label: '视频ID' },
  { key: 'publishTime', label: '发布时间' },
  { key: 'vv', label: 'VV' },
]

function ExcelTablePage({ fileName, rows, onBack }) {
  return (
    <section style={{ width: '100%', padding: '32px 20px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>Excel 导入结果</h1>
        <button type="button" onClick={onBack} style={{ padding: '8px 16px' }}>
          返回首页
        </button>
      </div>

      <p style={{ textAlign: 'left', marginTop: 16 }}>
        文件：{fileName}　共 {rows.length} 条记录
      </p>

      <div style={{ overflowX: 'auto', marginTop: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  style={{
                    borderBottom: '2px solid var(--border)',
                    padding: '8px 12px',
                    whiteSpace: 'nowrap',
                    color: 'var(--text-h)',
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.videoId || index}-${index}`}>
                {COLUMNS.map((col) => (
                  <td
                    key={col.key}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      padding: '8px 12px',
                      whiteSpace: col.key === 'videoInfo' ? 'normal' : 'nowrap',
                    }}
                  >
                    {row[col.key] || ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default ExcelTablePage
