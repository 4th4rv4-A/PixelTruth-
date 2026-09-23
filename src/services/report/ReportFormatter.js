/**
 * Converts the JSON Forensic Report into a professional HTML document suitable for PDF printing.
 * @param {Object} report The structured JSON report from ReportGenerator.js
 * @returns {string} Raw HTML string
 */
export function generateHtmlReport(report) {
  const { caseInformation, imageIdentity, binaryStructure, metadata, c2paProvenance, forensicSignals, cleaningRecord, limitations } = report;

  const escapeHtml = (unsafe) => {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
  };

  const renderSection = (title, content) => {
    if (!content) return '';
    return `
      <div class="section">
        <h2>${escapeHtml(title)}</h2>
        ${content}
      </div>
    `;
  };

  const renderTable = (obj) => {
    if (!obj || Object.keys(obj).length === 0) return '<p>No data available.</p>';
    let rows = '';
    for (const [k, v] of Object.entries(obj)) {
      if (v === null || v === undefined) continue;
      
      let displayValue = typeof v === 'object' ? `<pre>${escapeHtml(JSON.stringify(v, null, 2))}</pre>` : escapeHtml(String(v));
      
      rows += `
        <tr>
          <td class="key-col">${escapeHtml(k)}</td>
          <td class="val-col">${displayValue}</td>
        </tr>
      `;
    }
    return `<table><tbody>${rows}</tbody></table>`;
  };

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Forensic Report - ${escapeHtml(caseInformation.caseId)}</title>
  <style>
    :root {
      --bg: #ffffff;
      --text: #1a1a1a;
      --border: #e2e8f0;
      --primary: #4f46e5;
      --header-bg: #f8fafc;
    }
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: var(--text);
      line-height: 1.5;
      margin: 0;
      padding: 40px;
      background: var(--bg);
    }
    .header {
      border-bottom: 2px solid var(--primary);
      padding-bottom: 20px;
      margin-bottom: 30px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      color: var(--primary);
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .header .meta {
      text-align: right;
      font-size: 12px;
      color: #64748b;
    }
    .section {
      margin-bottom: 30px;
      page-break-inside: avoid;
    }
    h2 {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #64748b;
      border-bottom: 1px solid var(--border);
      padding-bottom: 8px;
      margin-bottom: 16px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th, td {
      padding: 8px 12px;
      border-bottom: 1px solid var(--border);
      vertical-align: top;
    }
    .key-col {
      width: 30%;
      font-weight: bold;
      color: #475569;
      background: var(--header-bg);
    }
    .val-col {
      width: 70%;
      word-break: break-all;
    }
    pre {
      margin: 0;
      white-space: pre-wrap;
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
    }
    ul {
      margin: 0;
      padding-left: 20px;
    }
    .limitations {
      background: #fffbeb;
      border: 1px solid #fef3c7;
      padding: 16px;
      border-radius: 4px;
      font-size: 12px;
      color: #92400e;
    }
    
    @media print {
      body {
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
      a {
        text-decoration: none;
        color: var(--text);
      }
      .section {
        page-break-inside: avoid;
      }
    }
    
    /* Interactive Button for HTML view */
    .btn-print {
      display: inline-block;
      padding: 10px 20px;
      background: var(--primary);
      color: white;
      text-decoration: none;
      border-radius: 6px;
      font-weight: bold;
      margin-bottom: 20px;
      cursor: pointer;
      border: none;
    }
  </style>
</head>
<body>
  <button class="btn-print no-print" onclick="window.print()">Print / Save as PDF</button>

  <div class="header">
    <div>
      <h1>Forensic Report</h1>
      <p style="margin: 4px 0 0 0; font-weight: bold;">${escapeHtml(caseInformation.caseId)}</p>
    </div>
    <div class="meta">
      Generated: ${escapeHtml(caseInformation.generatedTimestamp)}<br>
      PixelTruth Version: ${escapeHtml(caseInformation.pixelTruthVersion)}<br>
      Report Version: ${escapeHtml(caseInformation.reportVersion)}
    </div>
  </div>

  ${renderSection('Image Identity', renderTable(imageIdentity))}

  ${renderSection('Forensic Signals', `
    <div style="margin-bottom: 12px;">
      <strong>Overall Assessment:</strong> ${escapeHtml(forensicSignals.overallAssessment)}<br>
      <strong>Reasoning:</strong> ${escapeHtml(forensicSignals.humanReasoning)}
    </div>
    ${renderTable({
      'Compression Diagnostics': forensicSignals.compressionDifferenceEla ? 'Elevated local compression differences detected.' : 'No anomalies.',
      'Frequency Diagnostics': forensicSignals.frequencyDiagnosticsFft ? 'Repeating frequency structures detected.' : 'No anomalies.',
      'AI Model Signal': forensicSignals.localAiModelResult ? `Likelihood: ${(forensicSignals.localAiModelResult.score * 100).toFixed(1)}% (${forensicSignals.localAiModelResult.signalStrength})` : 'Not run.',
      'Metadata Indicators': forensicSignals.metadataIndicators.length > 0 ? forensicSignals.metadataIndicators.map(i => i.description).join(', ') : 'None.'
    })}
  `)}

  ${renderSection('C2PA Provenance', renderTable(c2paProvenance))}

  ${renderSection('Binary Structure', binaryStructure ? renderTable({
    'Format': binaryStructure.format,
    'Segments Found': binaryStructure.segments.length,
    'Structure Overview': binaryStructure.segments.map(s => `${s.name} (${s.length} bytes)`).join(', ')
  }) : '<p>Not analyzed.</p>')}

  ${renderSection('Metadata Overview', metadata ? renderTable({
    'Software/Device': metadata.software,
    'Timestamps': metadata.timestamps,
    'EXIF Available': !!metadata.exif,
    'XMP Available': !!metadata.xmp
  }) : '<p>Not analyzed or no metadata found.</p>')}

  ${cleaningRecord ? renderSection('Cleaning Record', renderTable(cleaningRecord)) : ''}

  ${renderSection('Limitations & Disclaimers', `
    <div class="limitations">
      <strong>CRITICAL NOTICE:</strong>
      <ul>
        ${limitations.map(l => `<li>${escapeHtml(l)}</li>`).join('')}
      </ul>
    </div>
  `)}

</body>
</html>
  `;

  return html;
}
