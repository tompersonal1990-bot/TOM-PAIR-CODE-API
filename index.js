import express from 'express';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import TelegramBot from 'node-telegram-bot-api';

// Anti-crash global architecture
process.on('uncaughtException', (err) => console.error('🛑 Exception:', err.message));
process.on('unhandledRejection', (err) => console.error('🛑 Rejection:', err));

const app = express();
const PORT = process.env.PORT || 3000;

// Simple web layer to keep Render service alive
app.get('/', (req, res) => {
    res.send('👑 TOM PRIME X - ACTIVE PAIRING LAYER IS RUNNING ✅');
});

// Store active socket instances globally to prevent memory cleanup
global.activeSessions = global.activeSessions || {};

// === 🤖 TELEGRAM BOT INTEGRATION ===
const TG_TOKEN = '8803390153:AAGEV-YVCVB7BIOohcUWUAqGULqUjmUbAfs'; 
const bot = new TelegramBot(TG_TOKEN, { polling: true });

console.log('🤖 Telegram Direct Pairing Layer Initialized...');

bot.onText(/\/pair/, async (msg) => {
    const chatId = msg.chat.id;
    const messageId = msg.message_id;
    if (msg.chat.type === 'private') return;

    const text = msg.text || '';
    const args = text.split(' ');

    // Verification template inspired by image 1000203382.jpg
    if (args.length < 2) {
        const usageMessage = `PLEASE PROVIDE A PHONE NUMBER.\n` +
                             `EXAMPLE: /pair +88017XXXXXXXX\n` +
                             `"INCLUDE YOUR COUNTRY CODE"`;
        return bot.sendMessage(chatId, usageMessage, { reply_to_message_id: messageId });
    }

    let inputPhone = args.slice(1).join('').trim();
    let cleanedPhone = inputPhone.replace(/[^0-9]/g, '');

    if (!cleanedPhone || cleanedPhone.length < 10) {
        return bot.sendMessage(chatId, '❌ Invalid phone number! Please include country code.', { reply_to_message_id: messageId });
    }

    const waitingMsg = await bot.sendMessage(chatId, '⏳ *Please wait...* Connecting directly to WhatsApp servers...', {
        reply_to_message_id: messageId,
        parse_mode: 'Markdown'
    });

    // Handle existing instances safely
    if (global.activeSessions[cleanedPhone]) {
        try { global.activeSessions[cleanedPhone].end(); } catch (e) {}
        delete global.activeSessions[cleanedPhone];
    }

    // Dynamic clean directory generator for session storage
    const sessionsDir = path.join(process.cwd(), 'sessions');
    if (!fs.existsSync(sessionsDir)) {
        fs.mkdirSync(sessionsDir, { recursive: true });
    }
    const sessionPath = path.join(sessionsDir, cleanedPhone);

    try {
        const baileys = await import('@whiskeysockets/baileys');
        const makeWASocket = baileys.default || baileys;
        const { useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, delay } = baileys;

        let { version } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

        const sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
            },
            markOnlineOnConnect: true,
            syncFullHistory: false,
        });

        // Save session authentication node globally
        global.activeSessions[cleanedPhone] = sock;

        // Persistent auto-save system triggers upon target matching
        sock.ev.on('creds.update', async () => {
            await saveCreds();
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection } = update;
            if (connection === 'open') {
                console.log(`✅ Connection stable, folder verified for: ${cleanedPhone}`);
                
                // Real-time confirmation message pushed to user group once login succeeds
                await bot.sendMessage(chatId, `🎉 *Bot Connected Successfully!*\n📱 *Number:* ${cleanedPhone}\n\n📦 Session folder generated on server.`, {
                    reply_to_message_id: messageId,
                    parse_mode: 'Markdown'
                });
                
                delete global.activeSessions[cleanedPhone];
            }
        });

        if (!sock.authState.creds.registered) {
            await delay(3000); 
            let code = await sock.requestPairingCode(cleanedPhone);
            code = code?.match(/.{1,4}/g)?.join("-") || code;

            // Direct UI matching code outputs
            const successMessage = `🔒 *PAIR Code Ready*\n` +
                                   `📱 *NUMBER:* ${cleanedPhone}\n` +
                                   `🌐 *Country:* BD (+880)\n\n` +
                                   `\`${code}\`\n\n` +
                                   `      〔 🛡️ CODE 〕      \n` +
                                   `  🔑 \`${code}\`  \n\n` +
                                   `📌 *HOW TO USE:*\n` +
                                   `1. WhatsApp ➡️ Settings ➡️ Linked Devices\n` +
                                   `2. Click LINK A DEVICE ➡️ ENTER CODE\n` +
                                   `⏰ CODE EXPIRES IN ~60 SECONDS\n\n` +
                                   `📢 *WA CHANNEL:*\nhttps://whatsapp.com/channel/0029VbBItW060eBXTB93HT1Q\n\n` +
                                   `👑 *Owner:* Tom`;

            await bot.editMessageText(successMessage, {
                chat_id: chatId,
                message_id: waitingMsg.message_id,
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            });
        } else {
            await bot.editMessageText(`❌ This number is already connected!`, {
                chat_id: chatId,
                message_id: waitingMsg.message_id
            });
            delete global.activeSessions[cleanedPhone];
        }

    } catch (err) {
        console.error(err.message);
        await bot.editMessageText(`❌ *Error:* ${err.message}`, {
            chat_id: chatId,
            message_id: waitingMsg.message_id
        });
        delete global.activeSessions[cleanedPhone];
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Web proxy layer online via port ${PORT}`);
});
