import express from 'express';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';

// Anti-crash global architecture
process.on('uncaughtException', (err) => console.error('🛑 Exception:', err.message));
process.on('unhandledRejection', (err) => console.error('🛑 Rejection:', err));

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('👑 TOM PRIME X - PAIRING SERVER IS LIVE & CLEAN ✅');
});

// === 📲 WHATSAPP PAIRING CODE API ROUTE ===
app.get('/pair', async (req, res) => {
    let phone = req.query.phone;
    if (!phone) return res.json({ status: false, error: "Please provide a phone number!" });

    phone = phone.replace(/[^0-9]/g, '');
    
    // Auto-create safe session folder to fix "Logging in..." freeze
    const sessionsDir = path.join(process.cwd(), 'sessions');
    if (!fs.existsSync(sessionsDir)) {
        fs.mkdirSync(sessionsDir, { recursive: true });
    }
    const sessionPath = path.join(sessionsDir, phone);

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

        // Continuous creds saving logic to securely write session files
        sock.ev.on('creds.update', async () => {
            await saveCreds();
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection } = update;
            if (connection === 'open') {
                console.log(`✅ Session built successfully for: ${phone}`);
            }
        });

        if (!sock.authState.creds.registered) {
            await delay(3000); 
            let code = await sock.requestPairingCode(phone);
            code = code?.match(/.{1,4}/g)?.join("-") || code;

            if (!res.headersSent) {
                return res.json({ status: true, code: code });
            }
        } else {
            if (!res.headersSent) {
                return res.json({ status: false, message: "This number is already connected!" });
            }
        }

    } catch (err) {
        console.error(err.message);
        if (!res.headersSent) res.json({ status: false, error: err.message });
    }
});

// === 🤖 TELEGRAM BOT INTEGRATION ===
const TG_TOKEN = '8803390153:AAGEV-YVCVB7BIOohcUWUAqGULqUjmUbAfs'; 
const bot = new TelegramBot(TG_TOKEN, { polling: true });

console.log('🤖 Telegram Pairing Bot Layer Initialized...');

bot.onText(/\/pair/, async (msg) => {
    const chatId = msg.chat.id;
    const messageId = msg.message_id;
    if (msg.chat.type === 'private') return;

    const text = msg.text || '';
    const args = text.split(' ');

    // If no phone number is provided, display clean input guide based on image 1000203382.jpg
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

    // Processing status message
    const waitingMsg = await bot.sendMessage(chatId, '⏳ *Please wait...* Generating your pairing code...', {
        reply_to_message_id: messageId,
        parse_mode: 'Markdown'
    });

    try {
        const response = await axios.get(`http://localhost:${PORT}/pair`, {
            params: { phone: cleanedPhone },
            timeout: 28000 
        });

        const data = response.data;

        if (data.status && data.code) {
            // Clean layout matching your customized format
            const successMessage = `🔒 *PAIR Code Ready*\n` +
                                   `📱 *NUMBER:* ${cleanedPhone}\n` +
                                   `🌐 *Country:* BD (+880)\n\n` +
                                   `\`${data.code}\`\n\n` +
                                   `      〔 🛡️ CODE 〕      \n` +
                                   `  🔑 \`${data.code}\`  \n\n` +
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
            await bot.editMessageText(`❌ *Error:* ${data.error || data.message || 'Could not generate pairing code.'}`, {
                chat_id: chatId,
                message_id: waitingMsg.message_id,
                parse_mode: 'Markdown'
            });
        }

    } catch (error) {
        await bot.editMessageText(`❌ *API Error:* Request timed out or session folder locked. Please try again.`, {
            chat_id: chatId,
            message_id: waitingMsg.message_id,
            parse_mode: 'Markdown'
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
