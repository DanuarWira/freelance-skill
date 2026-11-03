#!/usr/bin/env node

/**
 * Hermes Skill CLI Tool: extract_job.js
 * Ekstraksi konten lowongan Upwork dari teks atau URL.
 * Pure Standard Node.js (Zero external dependencies).
 *
 * Penggunaan:
 *   node extract_job.js "<url_atau_teks_lowongan>"
 */

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRawText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const title = lines[0] || 'Upwork Job Posting';

  const budgetMatch = text.match(/(Hourly|Fixed-price|Budget|Est\. Budget):?\s*(\$[\d,]+(\s*-\s*\$[\d,]+)?(\/hr)?)/i);
  const budget = budgetMatch ? budgetMatch[0] : 'Not specified';

  const screeningQuestions = [];
  const questionMatches = text.match(/(?:Question|Pertanyaan)\s*\d*:\s*(.+)/gi);
  if (questionMatches) {
    questionMatches.forEach(q => {
      screeningQuestions.push(q.replace(/^(Question|Pertanyaan)\s*\d*:\s*/i, '').trim());
    });
  }

  return {
    success: true,
    data: {
      title: title.slice(0, 150),
      description: text.trim(),
      budget,
      screeningQuestions,
      source: 'manual_text'
    }
  };
}

async function scrapeUrl(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    if (html.includes('Cloudflare') || html.includes('Just a moment...') || html.includes('challenge-platform')) {
      return { success: false, cloudflareBlocked: true, url };
    }

    // Ekstraksi Title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace('- Upwork', '').trim() : 'Upwork Job';

    // Ekstraksi Meta Description atau Body Text
    const metaDescMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    let description = metaDescMatch ? metaDescMatch[1].trim() : '';

    if (!description || description.length < 50) {
      description = stripHtml(html).slice(0, 3000);
    }

    // Ekstraksi Budget
    const budgetMatch = html.match(/\$[\d,]+(\.\d{2})?(\s*-\s*\$[\d,]+)?(\/hr)?/);
    const budget = budgetMatch ? budgetMatch[0] : 'Not specified';

    // Ekstraksi Questions jika ada
    const screeningQuestions = [];
    const qMatches = html.match(/(?:Question|Pertanyaan)\s*\d*:[^<>\n]+/gi);
    if (qMatches) {
      qMatches.forEach(q => {
        screeningQuestions.push(stripHtml(q).replace(/^(Question|Pertanyaan)\s*\d*:\s*/i, '').trim());
      });
    }

    return {
      success: true,
      data: {
        title,
        description,
        budget,
        screeningQuestions,
        source: 'url_scrape',
        url
      }
    };
  } catch (err) {
    return { success: false, error: err.message, url };
  }
}

async function main() {
  const input = process.argv.slice(2).join(' ').trim();
  if (!input) {
    console.error(JSON.stringify({ success: false, error: 'Input tidak boleh kosong' }));
    process.exit(1);
  }

  const urlMatch = input.match(/https?:\/\/(www\.)?upwork\.com\/[^\s]+/i);
  if (urlMatch) {
    const result = await scrapeUrl(urlMatch[0]);
    if (result.success) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    const textWithoutUrl = input.replace(urlMatch[0], '').trim();
    if (textWithoutUrl.length > 50) {
      const parsed = parseRawText(textWithoutUrl);
      parsed.data.url = urlMatch[0];
      console.log(JSON.stringify(parsed, null, 2));
      return;
    }

    console.log(JSON.stringify({
      success: false,
      requiresManualText: true,
      url: urlMatch[0],
      message: 'Halaman Upwork terproteksi bot/Cloudflare. Mohon sertakan copy-paste teks deskripsi lowongan bersama link.'
    }, null, 2));
    return;
  }

  const parsed = parseRawText(input);
  console.log(JSON.stringify(parsed, null, 2));
}

main().catch(err => {
  console.error(JSON.stringify({ success: false, error: err.message }));
  process.exit(1);
});
