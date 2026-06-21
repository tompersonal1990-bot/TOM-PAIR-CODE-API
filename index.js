import express from 'express';
import pino from 'pino';
import { makeWASocket, useMultiFileAuthState, delay } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('👑 TOM PRIME X - PAIRING SERVER IS LIVE & CLEAN ✅');
});

app.get('/pair', async (req, res) => {
    let phone = req.query.phone;
    if (!phone) {
        return res.json({ status: false, error: "Please provide a phone number! Example: /pair?phone=88016xxxxxx" });
    }

    // নাম্বার ফরম্যাট ক্লিন করা
    phone = phone.replace(/[^0-9]/g, '');
    const sessionPath = path.join(process.cwd(), `./sessions/${phone}`);

    try {
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: ["Ubuntu", "Chrome", "20.0.04"]
        });

        if (!sock.authState.creds.registered) {
            await delay(2500); // সার্ভার সেটআপের জন্য সামান্য ডিলে
            let code = await sock.requestPairingCode(phone);
            code = code?.match(/.{1,4}/g)?.join("-") || code;

            if (!res.headersSent) {
                res.json({ status: true, code: code });
            }
        } else {
            if (!res.headersSent) {
                res.json({ status: false, message: "This number is already connected!" });
            }
        }

        // কানেকশন ট্র‍্যাক করার জন্য (ঐচ্ছিক)
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'open') {
                console.log(`✅ Session successfully connected for: ${phone}`);
                // কানেক্ট হয়ে গেলে ওয়ান-টাইম সাকসেস মেসেজ দিতে পারো
                await sock.sendMessage(sock.user.id, { text: '✨ TOM BOT successfully connected to your account!' });
            }
            if (connection === 'close') {
                console.log(`❌ Connection closed for ${phone}`);
            }
        });

        sock.ev.on('creds.update', saveCreds);

    } catch (err) {
        console.error(err);
        if (!res.headersSent) {
            res.json({ status: false, error: err.message });
        }
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Clean Pairing API running on port ${PORT}`);
});
