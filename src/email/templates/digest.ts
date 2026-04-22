interface DigestEmailParams {
  articles: any[]
  updates: any[]
  weekStart: string
  appUrl: string
}

export function renderDigestEmail({ articles, updates, weekStart, appUrl }: DigestEmailParams): string {
  const weekLabel = new Date(weekStart).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  const articleRows = articles
    .slice(0, 10)
    .map((a) => {
      const repo = a.repos ?? {}
      const severity = a.severity >= 4 ? '🔴' : a.severity === 3 ? '🟠' : '🟡'
      return `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;">
            <p style="margin:0 0 4px;font-size:12px;color:#666;">${severity} ${repo.owner ?? ''}/${repo.name ?? ''}</p>
            <p style="margin:0 0 6px;font-size:14px;font-weight:600;color:#111;">${a.one_liner}</p>
            <a href="${appUrl}/${repo.owner}/${repo.name}#${a.id}" style="font-size:12px;color:#2563eb;text-decoration:none;">Read article →</a>
          </td>
        </tr>`
    })
    .join('')

  const updateRows = updates
    .slice(0, 15)
    .map((u) => {
      const repo = u.repos ?? {}
      return `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f8f8f8;">
            <span style="font-size:11px;color:#999;">${repo.owner ?? ''}/${repo.name ?? ''}</span>
            <span style="font-size:13px;color:#444;margin-left:8px;">${u.one_liner}</span>
          </td>
        </tr>`
    })
    .join('')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Changeblog digest — ${weekLabel}</title>
</head>
<body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;padding:32px 0;">
    <tr>
      <td>
        <table width="600" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e8e8e8;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:#111;padding:24px 32px;">
              <h1 style="margin:0;font-size:20px;font-weight:700;color:#fff;">Changeblog</h1>
              <p style="margin:4px 0 0;font-size:13px;color:#888;">Your weekly digest — ${weekLabel}</p>
            </td>
          </tr>

          <!-- Articles -->
          ${articles.length > 0 ? `
          <tr>
            <td style="padding:24px 32px 0;">
              <h2 style="margin:0 0 16px;font-size:16px;font-weight:600;color:#111;">Notable changes</h2>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${articleRows}
              </table>
            </td>
          </tr>` : ''}

          <!-- Updates -->
          ${updates.length > 0 ? `
          <tr>
            <td style="padding:24px 32px 0;">
              <h2 style="margin:0 0 16px;font-size:16px;font-weight:600;color:#111;">Minor updates</h2>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${updateRows}
              </table>
            </td>
          </tr>` : ''}

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;background:#fafafa;border-top:1px solid #f0f0f0;margin-top:24px;">
              <p style="margin:0;font-size:12px;color:#999;">
                <a href="${appUrl}/settings" style="color:#999;">Manage settings</a> ·
                <a href="${appUrl}/unsubscribe" style="color:#999;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
