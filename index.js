import express from 'express';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';

// Global anti-crash protections
process.on('uncaughtException', (err) => console.error('🛑 Exception:', err.message));
process.on('unhandledRejection', (err) => console.error('🛑 Rejection:', err));

const app = express();
const PORT = process.env.PORT || 3000;

// === 🤖 TELEGRAM BOT CONFIGURATION ===
// তোর দেওয়া বটের টোকেন এখানে সেট করা আছে
const TELEGRAM_TOKEN = '8803390153:AAGEV-YVCVB7BIOohcUWUAqGULqUjmUbAfs'; 
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// গ্লোবাল মেমোরি অ্যালোকেশন
global.waConnections = global.waConnections || {};

app.get('/', (req, res) => {
    res.send('👑 TOM PRIME X - PAIRING SERVER IS LIVE & CLEAN ✅');
});

// === 📲 WHATSAPP PAIRING CODE API ROUTE ===
app.get('/pair', async (req, res) => {
    let phone = req.query.phone;
    if (!phone) return res.json({ status: false, error: "Please provide a phone number!" });

    phone = phone.replace(/[^0-9]/g, '');
    
    // Auto-create safe session directory structure
    const sessionsDir = path.join(process.cwd(), 'sessions');
    if (!fs.existsSync(sessionsDir)) {
        fs.mkdirSync(sessionsDir, { recursive: true });
    }
    const sessionPath = path.join(sessionsDir, phone);

    try {
        const baileys = await import('@whiskeysockets/baileys');
        const makeWASocket = baileys.default || baileys;
        const { useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, delay } = baileys;

        // Clean up any existing stale socket instances for this specific number
        if (global.waConnections[phone]) {
            try {
                global.waConnections[phone].logout();
                global.waConnections[phone].end();
            } catch (e) {}
            delete global.waConnections[phone];
        }

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

        // Store inside global context to prevent garbage collection and freeze bugs
        global.waConnections[phone] = sock;

        // Critical event listener to save creds continuously
        sock.ev.on('creds.update', async () => {
            await saveCreds();
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'open') {
                console.log(`✅ Session built successfully for: ${phone}`);
                // Clean reference once securely logged in
                delete global.waConnections[phone];
            }
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
                if (!shouldReconnect) {
                    delete global.waConnections[phone];
                }
            }
        });

        if (!sock.authState.creds.registered) {
    await delay(6000); // ৩০০০ থেকে বাড়িয়ে ৬০০০ (৬ সেকেন্ড) কর
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


// === ✉️ TELEGRAM BOT COMMAND HANDLERS ===

// /start কমান্ড হ্যান্ডলার
bot.onText(/\/start/, (msg) => {
    const startMessage = `
👋 **TOM PRIME X - PAIRING BOT**

হোয়াটসঅ্যাপ পেয়ার কোড তৈরি করতে নিচের নিয়মে মেসেজ দিন:
👉 \`/pair +8801xxxxxxxxx\`
    `;
    bot.sendMessage(msg.chat.id, startMessage, { parse_mode: 'Markdown' });
});

// /pair কমান্ড হ্যান্ডলার (তোর Express API-কে হিট করবে)
bot.onText(/\/pair (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    let phoneNumber = match[1].replace(/[^0-9]/g, '');

    // কান্ট্রি কোড ফরম্যাটিং ফিক্স
    if (!phoneNumber.startsWith('880') && phoneNumber.startsWith('0')) {
        phoneNumber = '880' + phoneNumber.substring(1);
    }

    await bot.sendMessage(chatId, `⏳ **+${phoneNumber}** নম্বরের জন্য পেয়ার কোড তৈরি হচ্ছে... একটু অপেক্ষা করুন।`);

    try {
        // লোকাল বা হোস্টিং সার্ভারের নিজস্ব এপিআই রুটে রিকোয়েস্ট পাঠানো
        const response = await axios.get(`http://localhost:${PORT}/pair?phone=${phoneNumber}`);
        const data = response.data;

        if (data.status && data.code) {
            const responseMessage = `
🔐 **PAIR CODE READY**
📱 Number: +${phoneNumber}

🔑 Code: \`${data.code}\`

📌 **How to use:**
1. WhatsApp ➔ Settings ➔ Linked Devices
2. Click Link a Device ➔ Link with phone number instead
3. ওপরে দেওয়া কোডটি হোয়াটসঅ্যাপে বসিয়ে দিন।
            `;
            
            await bot.sendMessage(chatId, responseMessage, { parse_mode: 'Markdown' });
        } else {
            await bot.sendMessage(chatId, `❌ **ব্যর্থ হয়েছে:** ${data.message || data.error || 'কোড জেনারেট করা যায়নি।'}`);
        }

    } catch (error) {
        console.error('Telegram Bot Error:', error.message);
        await bot.sendMessage(chatId, `❌ সার্ভার রেসপন্স করছে না। দয়া করে একটু পর আবার চেষ্টা করুন।`);
    }
});


// === 🚀 START SERVER ===
app.listen(PORT, () => {
    console.log(`🚀 Server & Telegram Bot connected successfully on port: ${PORT}`);
});
