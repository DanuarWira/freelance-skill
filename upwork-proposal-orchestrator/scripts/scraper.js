/**
 * scraper.js - Hybrid Upwork Job Extractor
 * Mengambil konten lowongan Upwork melalui fetch/cheerio/puppeteer dengan fallback teks manual.
 */

const cheerio = require('cheerio');

class UpworkScraper {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Mengecek apakah input adalah URL Upwork
   */
  isUpworkUrl(input) {
    if (typeof input !== 'string') return false;
    return /https?:\/\/(www\.)?upwork\.com\/(jobs|freelance-jobs)\/[^\s]+/i.test(input.trim());
  }

  /**
   * Ekstraksi URL Upwork dari pesan yang mungkin tercampur teks
   */
  extractUrlFromMessage(text) {
    const match = text.match(/https?:\/\/(www\.)?upwork\.com\/[^\s]+/i);
    return match ? match[0] : null;
  }

  /**
   * Parse teks mentah postingan lowongan Upwork (jika user copy-paste langsung)
   */
  parseRawJobText(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const title = lines[0] || 'Upwork Job Posting';
    
    // Deteksi budget jika ada
    const budgetMatch = text.match(/(Hourly|Fixed-price|Budget|Est\. Budget):?\s*(\$[\d,]+(\s*-\s*\$[\d,]+)?(\/hr)?)/i);
    const budget = budgetMatch ? budgetMatch[0] : 'Not specified';

    // Deteksi screening questions
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
        description: text,
        budget,
        skills: [],
        screeningQuestions,
        source: 'manual_text'
      }
    };
  }

  /**
   * Scrape URL menggunakan Cheerio (Fast HTTP fetch)
   */
  async scrapeWithCheerio(url) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      
      // Deteksi Cloudflare / bot protection
      if (html.includes('Attention Required! | Cloudflare') || html.includes('Just a moment...') || html.includes('challenge-platform')) {
        return { blocked: true, reason: 'Cloudflare Bot Protection' };
      }

      const $ = cheerio.load(html);

      const title = $('h1, header h4, [data-test="job-title"]').first().text().trim() ||
                    $('title').text().replace('- Upwork', '').trim();
      const description = $('[data-test="JobDescription"], .job-description, .up-card-section p').text().trim() ||
                          $('meta[name="description"]').attr('content') || '';
      const budget = $('[data-test="budget"], [data-test="hourly-rate"]').first().text().trim() || 'Not specified';
      
      const skills = [];
      $('[data-test="Skill"], .up-skill-badge, .air3-token').each((_, el) => {
        const skill = $(el).text().trim();
        if (skill && !skills.includes(skill)) skills.push(skill);
      });

      const screeningQuestions = [];
      $('[data-test="question"], .job-questions li').each((_, el) => {
        const q = $(el).text().trim();
        if (q) screeningQuestions.push(q);
      });

      if (!description || description.length < 30) {
        return { blocked: true, reason: 'Low content extracted (possible client-side rendering)' };
      }

      return {
        blocked: false,
        data: {
          title,
          description,
          budget,
          skills,
          screeningQuestions,
          source: 'cheerio_http',
          url
        }
      };
    } catch (err) {
      return { blocked: true, reason: err.message };
    }
  }

  /**
   * Scrape URL menggunakan Puppeteer (opsional jika terinstall)
   */
  async scrapeWithPuppeteer(url) {
    let puppeteer;
    try {
      puppeteer = require('puppeteer');
    } catch {
      return { available: false, reason: 'Puppeteer not installed' };
    }

    try {
      const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      const content = await page.evaluate(() => {
        const titleEl = document.querySelector('h1') || document.querySelector('[data-test="job-title"]');
        const descEl = document.querySelector('[data-test="JobDescription"]') || document.querySelector('.job-description');
        const budgetEl = document.querySelector('[data-test="budget"]') || document.querySelector('[data-test="hourly-rate"]');
        
        const skills = Array.from(document.querySelectorAll('[data-test="Skill"], .air3-token')).map(el => el.textContent.trim());
        const questions = Array.from(document.querySelectorAll('.job-questions li, [data-test="question"]')).map(el => el.textContent.trim());

        return {
          title: titleEl ? titleEl.textContent.trim() : document.title,
          description: descEl ? descEl.textContent.trim() : '',
          budget: budgetEl ? budgetEl.textContent.trim() : 'Not specified',
          skills,
          screeningQuestions: questions
        };
      });

      await browser.close();

      if (!content.description || content.description.length < 30) {
        return { blocked: true, reason: 'Puppeteer content empty' };
      }

      return {
        blocked: false,
        data: {
          ...content,
          source: 'puppeteer',
          url
        }
      };
    } catch (err) {
      return { blocked: true, reason: err.message };
    }
  }

  /**
   * Ekstraksi cerdas dengan graceful fallback
   */
  async extractJob(input) {
    const extractedUrl = this.extractUrlFromMessage(input);

    if (extractedUrl) {
      // 1. Coba fast fetch (Cheerio)
      const fastResult = await this.scrapeWithCheerio(extractedUrl);
      if (!fastResult.blocked && fastResult.data) {
        return { success: true, data: fastResult.data };
      }

      // 2. Coba Puppeteer jika tersedia
      const pupResult = await this.scrapeWithPuppeteer(extractedUrl);
      if (pupResult && !pupResult.blocked && pupResult.data) {
        return { success: true, data: pupResult.data };
      }

      // 3. Fallback jika ada teks lain yang disertakan di input
      const textWithoutUrl = input.replace(extractedUrl, '').trim();
      if (textWithoutUrl.length > 50) {
        const parsed = this.parseRawJobText(textWithoutUrl);
        parsed.data.url = extractedUrl;
        return parsed;
      }

      // 4. Laporkan butuh manual copy-paste
      return {
        success: false,
        requiresManualInput: true,
        url: extractedUrl,
        reason: 'Halaman Upwork terproteksi bot / Cloudflare. Mohon kirimkan link beserta salinan teks deskripsi pekerjaan (copy-paste).'
      };
    }

    // Input murni teks manual
    if (input.trim().length > 30) {
      return this.parseRawJobText(input);
    }

    return {
      success: false,
      reason: 'Input terlalu pendek atau tidak mengandung link Upwork valid.'
    };
  }
}

module.exports = UpworkScraper;
