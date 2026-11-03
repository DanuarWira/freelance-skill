/**
 * index.js - Discord Bot Entry Point for Hermes Upwork Proposal Orchestrator
 */

require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const UpworkScraper = require('./scraper');
const ProposalOrchestrator = require('./orchestrator');
const DiscordFormatter = require('./formatters');

const token = process.env.DISCORD_BOT_TOKEN;

if (!token || token.includes('your_discord_bot_token')) {
  console.warn('⚠️ PERINGATAN: DISCORD_BOT_TOKEN belum diset di file .env.');
  console.warn('Untuk menguji pipeline tanpa Discord bot, jalankan: npm run test:pipeline\n');
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel, Partials.Message]
});

const scraper = new UpworkScraper();
const orchestrator = new ProposalOrchestrator({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
  model: process.env.HERMES_MODEL,
  maxRevisions: parseInt(process.env.MAX_REVISION_CYCLES || '2', 10)
});

client.once('ready', () => {
  console.log(`🤖 Hermes Upwork Orchestrator Bot aktif sebagai ${client.user.tag}!`);
  console.log('Menunggu link job Upwork di channel yang diizinkan...\n');
});

client.on('messageCreate', async (message) => {
  // Abaikan pesan dari sesama bot
  if (message.author.bot) return;

  const content = message.content.trim();
  const hasUpworkLink = scraper.isUpworkUrl(content) || scraper.extractUrlFromMessage(content);
  const isCommand = content.startsWith('!proposal') || content.startsWith('!upwork');

  if (!hasUpworkLink && !isCommand) return;

  console.log(`📨 Pesan terdeteksi dari ${message.author.username}: ${content.slice(0, 80)}...`);

  // Kirim status awal
  let statusMessage;
  try {
    statusMessage = await message.reply('⏳ **Hermes Master Orchestrator:** Mendeteksi link Upwork... sedang mengekstrak konten lowongan...');
  } catch (err) {
    console.error('Gagal mengirim pesan ke Discord:', err);
    return;
  }

  try {
    await message.channel.sendTyping();

    // 1. Ekstraksi Job
    const extractionInput = isCommand ? content.replace(/^!(proposal|upwork)\s*/i, '') : content;
    const extractionResult = await scraper.extractJob(extractionInput);

    if (!extractionResult.success) {
      if (extractionResult.requiresManualInput) {
        await statusMessage.edit(`⚠️ **Proteksi Cloudflare Terdeteksi:**\nBot tidak dapat membaca link Upwork tersebut secara otomatis karena proteksi anti-bot.\n👉 **Solusi:** Silakan kirimkan kembali dengan menyalin (copy-paste) teks deskripsi pekerjaan di bawah link!`);
      } else {
        await statusMessage.edit(`❌ **Gagal Membaca Lowongan:** ${extractionResult.reason || 'Format tidak dikenali.'}`);
      }
      return;
    }

    const jobData = extractionResult.data;
    await statusMessage.edit(`📋 **Job Ditemukan:** *"${jobData.title}"*\nSedang mendelegasikan ke 5 Subagent Hermes...`);

    // 2. Jalankan Pipeline Multi-Agent
    const result = await orchestrator.runPipeline(jobData, async (progress) => {
      console.log(`[Pipeline] ${progress.message}`);
      // Update pesan Discord secara berkala
      if (progress.stage !== 'iteration_start') {
        try {
          await statusMessage.edit(`🔄 **Status Orkestrasi:** ${progress.message}`);
        } catch {
          // Abaikan throttling update Discord
        }
      }
    });

    // 3. Render Rich Discord Embeds
    const embeds = DiscordFormatter.createProposalEmbeds(jobData, result);

    await statusMessage.edit({
      content: `🎉 **Proposal Selesai Diproses!**\nProposal berikut telah diaudit dan disetujui oleh seluruh dewan reviewer:`,
      embeds
    });

  } catch (error) {
    console.error('Error saat menjalankan orkestrasi proposal:', error);
    try {
      await statusMessage.edit(`❌ **Terjadi Kesalahan Orkestrasi:** ${error.message}`);
    } catch {
      // Ignored
    }
  }
});

// Jalankan bot jika token tersedia
if (token && !token.includes('your_discord_bot_token')) {
  client.login(token).catch(err => {
    console.error('Gagal login ke Discord:', err.message);
  });
}
