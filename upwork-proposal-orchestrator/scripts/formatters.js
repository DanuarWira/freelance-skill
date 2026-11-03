/**
 * formatters.js - Discord Embed & Message Formatter
 * Mengubah hasil orkestrasi proposal multi-agent menjadi Rich Embeds Discord dan teks markdown siap kirim.
 */

const { EmbedBuilder } = require('discord.js');

class DiscordFormatter {
  /**
   * Membuat array Embed Discord dari hasil orkestrator
   */
  static createProposalEmbeds(jobData, result) {
    const embeds = [];
    const isApproved = result.status === 'APPROVED';

    // 1. EMBED PROPOSAL UTAMA
    const proposalEmbed = new EmbedBuilder()
      .setColor(isApproved ? 0x14a800 : 0xffa500) // Hijau Upwork atau Kuning Peringatan
      .setTitle(`📝 Proposal Siap Kirim: ${jobData.title.slice(0, 200)}`)
      .setURL(jobData.url || 'https://www.upwork.com')
      .setDescription(`**Domain:** ${result.subagents.analyst.domain || 'Freelance'} | **Budget:** ${jobData.budget || 'N/A'}\n**Status:** ${isApproved ? '✅ Siap Kirim (Lolos Seluruh Reviewer)' : '⚠️ Draf Terbaik (Perlu Review Manual)'}`)
      .addFields(
        {
          name: '🎯 Hook Pembuka (Baris 1)',
          value: result.finalProposal.hook ? `> "${result.finalProposal.hook}"` : 'N/A'
        },
        {
          name: '📄 Cover Letter Lengkap',
          value: result.finalProposal.coverLetter.length > 1024 
            ? result.finalProposal.coverLetter.slice(0, 1020) + '...'
            : result.finalProposal.coverLetter
        }
      );

    // Tambahkan field lanjut jika cover letter panjang
    if (result.finalProposal.coverLetter.length > 1024) {
      proposalEmbed.addFields({
        name: '📄 Cover Letter (Lanjutan)',
        value: result.finalProposal.coverLetter.slice(1020, 2040)
      });
    }

    // Screening Questions jika ada
    if (result.finalProposal.screeningAnswers && result.finalProposal.screeningAnswers.length > 0) {
      const qaText = result.finalProposal.screeningAnswers
        .map((qa, i) => `**Q${i + 1}: ${qa.question}**\n👉 ${qa.answer}`)
        .join('\n\n');

      proposalEmbed.addFields({
        name: '❓ Jawaban Pertanyaan Penyaring (Screening Questions)',
        value: qaText.length > 1024 ? qaText.slice(0, 1020) + '...' : qaText
      });
    }

    proposalEmbed.setFooter({ text: `Hermes Multi-Agent Orchestrator • Putaran: ${result.iterationsRun}` });
    proposalEmbed.setTimestamp();
    embeds.push(proposalEmbed);

    // 2. EMBED EVALUASI & SCORECARD
    const scoreEmbed = new EmbedBuilder()
      .setColor(0x5865F2) // Discord Blurple
      .setTitle('📊 Evaluasi Multi-Agent Scorecard')
      .addFields(
        {
          name: '📈 Subagent 3: Skor Kualitas (QA)',
          value: `**${result.scorecard.qaScore}/100**\n• Anti-Slop: ${result.subagents.qa.parameterScores?.antiSlopHygiene || 'OK'}/25\n• Solusi: ${result.subagents.qa.parameterScores?.solutionQuality || 'OK'}/30`,
          inline: true
        },
        {
          name: `👨‍💻 Subagent 4: ${result.subagents.domainExpert.assumedPersona || 'Domain Expert'}`,
          value: `Status: **${result.subagents.domainExpert.technicalStatus}** (Skor: ${result.scorecard.techScore}/100)\n*${result.subagents.domainExpert.expertAdvice || 'Kredibel secara teknis.'}*`,
          inline: true
        },
        {
          name: '💼 Subagent 5: Klien Upwork',
          value: `Keputusan: **${result.subagents.clientSimulator.clientDecision}** (${result.scorecard.clientLikelihood}% Hire Probability)\n*"${result.subagents.clientSimulator.clientFirstImpression || 'Menarik.'}"*`,
          inline: false
        }
      );

    if (result.subagents.analyst.winningAngle) {
      scoreEmbed.addFields({
        name: '💡 Winning Angle Terdeteksi',
        value: result.subagents.analyst.winningAngle
      });
    }

    embeds.push(scoreEmbed);
    return embeds;
  }

  /**
   * Format teks murni (Markdown) untuk kemudahan copy-paste di Discord mobile atau file text
   */
  static formatPlainMarkdown(jobData, result) {
    let out = `## 📝 PROPOSAL UPWORK: ${jobData.title}\n`;
    out += `**Status:** ${result.status} | **Putaran Iterasi:** ${result.iterationsRun}\n\n`;
    out += `### 📄 Cover Letter Siap Kirim:\n\`\`\`text\n${result.finalProposal.coverLetter}\n\`\`\`\n\n`;

    if (result.finalProposal.screeningAnswers && result.finalProposal.screeningAnswers.length > 0) {
      out += `### ❓ Jawaban Screening Questions:\n`;
      result.finalProposal.screeningAnswers.forEach((qa, i) => {
        out += `**${i + 1}. ${qa.question}**\n> ${qa.answer}\n\n`;
      });
    }

    out += `### 📊 Scorecard Ringkas:\n`;
    out += `- **QA & Anti-Slop Score:** ${result.scorecard.qaScore}/100\n`;
    out += `- **Technical Feasibility:** ${result.subagents.domainExpert.technicalStatus} (${result.scorecard.techScore}/100)\n`;
    out += `- **Client Decision:** ${result.subagents.clientSimulator.clientDecision} (${result.scorecard.clientLikelihood}% hire probability)\n`;

    return out;
  }
}

module.exports = DiscordFormatter;
