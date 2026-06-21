/**
 * TOM PRIME X BOT - Safe Pairing Server
 * Zero Crash Architecture
 */

// গ্লোবাল এরর হ্যান্ডলার - যেন কোনো ভুল থাকলেও সার্ভার বন্ধ না হয়
process.on('uncaughtException', (err) => {
    console.error('🛑 CRITICAL UNCAUGHT EXCEPTION:', err.message);
    console.error(err.stack);
});

process.on('unhandledRejection', (err) => {
    console.error('🛑 CRITICAL UNHANDLED REJECTION:', err);
});

const express = require('express');
const pino = require('pino');
const NodeCache = require('node-cache');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');

// নিরাপদভাবে Baileys রিকোয়ার করা
const baileys = require("@whiskeysockets/baileys");
const makeWASocket = baileys.default || baileys;
const { useMultiFileAuthState, makeCacheableSignalKeyStore, delay } = baileys;

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('👑 TOM PRIME X SERVER IS LIVE ✅');
});

// === 📲 WHATSAPP PAIRING CODE API ROUTE ===
app.get('/pair', async (req, res) => {
    let phone = req.query.phone;
    if (!phone) {
        return res.json({ status: false, error: "Please provide a phone number!" });
    }

    phone = phone.replace(/[^0-9]/g, '');
    const sessionPath = path.join(process.cwd(), `./session_${phone}`);

    try {
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        const msgRetryCounterCache = new NodeCache();

        const XeonBotInc = makeWASocket({
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
            },
            markOnlineOnConnect: true,
            syncFullHistory: false,
            msgRetryCounterCache,
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
        });

        if (!XeonBotInc.authState.creds.registered) {
            await delay(3000); 
            let code = await XeonBotInc.requestPairingCode(phone);
            code = code?.match(/.{1,4}/g)?.join("-") || code;

            if (!res.headersSent) {
                return res.json({ status: true, code: code });
            }
        } else {
            if (!res.headersSent) {
                return res.json({ status: false, message: "This number is already connected!" });
            }
        }

        XeonBotInc.ev.on('creds.update', saveCreds);

    } catch (err) {
        console.error('API Error:', err.message);
        if (!res.headersSent) {
            res.json({ status: false, error: err.message });
        }
    }
});

// === 🤖 TELEGRAM BOT INTEGRATION ===
try {
    const TG_TOKEN = '8803390153:AAGEV-YVCVB7BIOohcUWUAqGULqUjmUbAfs'; 
    const bot = new TelegramBot(TG_TOKEN, { polling: true });

    console.log('🤖 Telegram Bot Connected...');

    bot.onText(/\/pair (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const messageId = msg.message_id;
        if (msg.chat.type === 'private') return;

        let inputPhone = match[1].trim();
        let cleanedPhone = inputPhone.replace(/[^0-9]/g, '');

        if (!cleanedPhone || cleanedPhone.length < 10) {
            return bot.sendMessage(chatId, '❌ বৈধ নাম্বার দিন!', { reply_to_message_id: messageId });
        }

        const waitingMsg = await bot.sendMessage(chatId, '⏳ *Please wait...* কোড জেনারেট হচ্ছে...', {
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
                await bot.editMessageText(`✅ *Success!*\n📱 *Number:* \`${cleanedPhone}\`\n🔑 *Code:* \`${data.code}\`\n\n🔔 ফোনের নোটিফিকেশনে ক্লিক করে কোডটি বসিয়ে দিন।`, {
                    chat_id: chatId,
                    message_id: waitingMsg.message_id,
                    parse_mode: 'Markdown'
                });
            } else {
                await bot.editMessageText(`❌ *Error:* ${data.error || 'কোড পাওয়া যায়নি!'}`, {
                    chat_id: chatId,
                    message_id: waitingMsg.message_id
                });
            }
        } catch (error) {
            await bot.editMessageText(`❌ *API Error:* সার্ভার রেসপন্স করছে না।`, {
                chat_id: chatId,
                message_id: waitingMsg.message_id
            });
        }
    });
} catch (tgErr) {
    console.error('Telegram Initialization Error:', tgErr.message);
}

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
