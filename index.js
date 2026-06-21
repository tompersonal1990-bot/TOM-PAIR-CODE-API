import express from 'express';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';

// Node.js ক্র্যাশ প্রতিরোধ করার গ্লোবাল লিসেনার
process.on('uncaughtException', (err) => console.error('🛑 Exception:', err.message));
process.on('unhandledRejection', (err) => console.error('🛑 Rejection:', err));

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('👑 TOM PRIME X - REAL PAIRING SERVER IS LIVE ✅');
});

// === 📲 REAL WHATSAPP PAIRING CODE API ROUTE ===
app.get('/pair', async (req, res) => {
    let phone = req.query.phone;
    if (!phone) return res.json({ status: false, error: "Please provide a phone number!" });

    phone = phone.replace(/[^0-9]/g, '');
    const sessionPath = path.join(process.cwd(), `./sessions/${phone}`);

    try {
        // 🔥 রিয়াল নোটিফিকেশনের জন্য Baileys মডিউল ডাইনামিক লোড করা
        const baileys = await import('@whiskeysockets/baileys');
        const makeWASocket = baileys.default || baileys;
        const { useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, delay } = baileys;

        // ১. রিয়াল সিগন্যালের জন্য লেটেস্ট হোয়াটসঅ্যাপ ওয়েব ভার্সন চেক
        let { version } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

        // ২. রিয়াল পেয়ারিং কানেকশন আর্কিটেকচার
        const sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser: ["Ubuntu", "Chrome", "20.0.04"], // তোমার বটের ব্রাউজার সিগনেচার
            auth: {
                creds: state.creds,
                // ৩. রিয়াল নোটিফিকেশন পুশ করার মেইন ইঞ্জিন (KeyStore Lock)
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
            },
            markOnlineOnConnect: true,
            syncFullHistory: false,
        });

        if (!sock.authState.creds.registered) {
            await delay(3000); // সার্ভার হ্যান্ডশেক স্টেবল ডিলে
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

        sock.ev.on('creds.update', saveCreds);
        sock.ev.on('connection.update', (u) => {
            if (u.connection === 'open') console.log(`✅ Connected: ${phone}`);
        });

    } catch (err) {
        console.error(err.message);
        if (!res.headersSent) res.json({ status: false, error: err.message });
    }
});

// === 🤖 TELEGRAM BOT INTEGRATION ===
const TG_TOKEN = '8803390153:AAGEV-YVCVB7BIOohcUWUAqGULqUjmUbAfs'; 
const bot = new TelegramBot(TG_TOKEN, { polling: true });

console.log('🤖 Telegram Bot Layer Initialized...');

bot.onText(/\/pair (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const messageId = msg.message_id;
    if (msg.chat.type === 'private') return;

    let inputPhone = match[1].trim();
    let cleanedPhone = inputPhone.replace(/[^0-9]/g, '');

    if (!cleanedPhone || cleanedPhone.length < 10) {
        return bot.sendMessage(chatId, '❌ বৈধ হোয়াটসঅ্যাপ নাম্বার দিন!', { reply_to_message_id: messageId });
    }

    const waitingMsg = await bot.sendMessage(chatId, '⏳ *Please wait...* আপনার ফোনে রিয়াল নোটিফিকেশন সিগন্যাল পাঠানো হচ্ছে...', {
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
            await bot.editMessageText(`❌ *Error:* ${data.error || 'কোড জেনারেট করা যায়নি!'}`, {
                chat_id: chatId,
                message_id: waitingMsg.message_id
            });
        }

    } catch (error) {
        await bot.editMessageText(`❌ *API Error:* রিকোয়েস্ট টাইমআউট হয়েছে। আবার চেষ্টা করুন।`, {
            chat_id: chatId,
            message_id: waitingMsg.message_id
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server safely running on port ${PORT}`);
});
