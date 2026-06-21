/**
 * TOM PRIME X BOT - Integrated Pairing Code Server & Telegram Bot
 * Powered by ToxRon & Professor Tom
 */

const express = require('express');
const pino = require('pino');
const NodeCache = require('node-cache');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');

const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    delay
} = require("@whiskeysockets/baileys");

const app = express();
const PORT = process.env.PORT || 3000;

// === 🌐 EXPRESS SERVER HOME ROUTE ===
app.get('/', (req, res) => {
    res.send('👑 TOM PRIME X - PAIRING SERVER & TELEGRAM BOT ARE LIVE ✅');
});

// === 📲 REAL WHATSAPP PAIRING CODE API ROUTE (YOUR BOT LOGIC) ===
app.get('/pair', async (req, res) => {
    let phone = req.query.phone;
    if (!phone) {
        return res.json({ status: false, error: "Please provide a phone number!" });
    }

    phone = phone.replace(/[^0-9]/g, '');
    const sessionPath = path.join(process.cwd(), `./session_${phone}`);

    try {
        let { version } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        const msgRetryCounterCache = new NodeCache();

        // তোমার বটের একদম হুবহু কনফিগারেশন যা রিয়াল নোটিফিকেশন পুশ করে
        const XeonBotInc = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser: ["Ubuntu", "Chrome", "20.0.04"], // তোমার বটের ব্রাউজার আইডি
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })), // রিয়াল নোটিফিকেশন ট্রিগার
            },
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            msgRetryCounterCache,
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
        });

        if (!XeonBotInc.authState.creds.registered) {
            await delay(3000); // কানেকশন হ্যান্ডশেক ডিলে
            let code = await XeonBotInc.requestPairingCode(phone);
            code = code?.match(/.{1,4}/g)?.join("-") || code;

            if (!res.headersSent) {
                res.json({ status: true, code: code });
            }
        } else {
            if (!res.headersSent) {
                res.json({ status: false, message: "This number is already connected!" });
            }
        }

        XeonBotInc.ev.on('creds.update', saveCreds);

        // সেশন সাকসেসফুলি লিংক হলে মেমোরি বাঁচানোর জন্য সকেট ডিসকানেক্ট করা
        XeonBotInc.ev.on('connection.update', async (s) => {
            const { connection } = s;
            if (connection === 'open') {
                console.log(`✅ Device paired successfully with: ${phone}`);
            }
        });

    } catch (err) {
        console.error(err);
        if (!res.headersSent) {
            res.json({ status: false, error: err.message });
        }
    }
});

// === 🤖 TELEGRAM BOT INTEGRATION ===
const TG_TOKEN = '8803390153:AAGEV-YVCVB7BIOohcUWUAqGULqUjmUbAfs'; 
const bot = new TelegramBot(TG_TOKEN, { polling: true });

console.log('🤖 Telegram Pairing Bot Layer Initialized...');

bot.onText(/\/pair (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const messageId = msg.message_id;
    const chatType = msg.chat.type;

    if (chatType === 'private') {
        return; 
    }

    let inputPhone = match[1].trim();
    let cleanedPhone = inputPhone.replace(/[^0-9]/g, '');

    if (!cleanedPhone || cleanedPhone.length < 10) {
        return bot.sendMessage(chatId, '❌ বৈধ হোয়াটসঅ্যাপ নাম্বার দিন! উদাহরণ: `/pair 88017XXXXXXXX`', {
            reply_to_message_id: messageId,
            parse_mode: 'Markdown'
        });
    }

    const waitingMsg = await bot.sendMessage(chatId, '⏳ *Please wait...* আপনার হোয়াটসঅ্যাপে অফিশিয়াল নোটিফিকেশন পাঠানো হচ্ছে এবং রিয়াল কোড জেনারেট হচ্ছে...', {
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
            const successMessage = `✅ *Success! Real Pairing Code is Ready*\n\n` +
                                   `📱 *Number:* \`${cleanedPhone}\`\n` +
                                   `🔑 *Pairing Code:* \`${data.code}\`\n\n` +
                                   `🔔 আপনার ফোনের হোয়াটসঅ্যাপ নোটিফিকেশনে ক্লিক করে কোডটি বসিয়ে দিন।`;
            
            await bot.editMessageText(successMessage, {
                chat_id: chatId,
                message_id: waitingMsg.message_id,
                parse_mode: 'Markdown'
            });
        } else {
            await bot.editMessageText(`❌ *Error:* ${data.error || data.message || 'কোড পাওয়া যায়নি!'}`, {
                chat_id: chatId,
                message_id: waitingMsg.message_id,
                parse_mode: 'Markdown'
            });
        }

    } catch (error) {
        console.error(error.message);
        await bot.editMessageText(`❌ *API Error:* হোয়াটসঅ্যাপ সার্ভার রিকোয়েস্ট রিজেক্ট করেছে বা টাইমআউট হয়েছে। আবার চেষ্টা করুন।`, {
            chat_id: chatId,
            message_id: waitingMsg.message_id,
            parse_mode: 'Markdown'
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server with Integrated Bot running on port ${PORT}`);
});
