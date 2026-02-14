// wa_service.js
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore 
} = require("@whiskeysockets/baileys");
const pino = require('pino');
const fs = require('fs');
const { load_db, save_db } = require('./database');

let sessions = {};

const checkSessionStatus = (userId) => {
    if (sessions[userId] && sessions[userId].user) return "✅ Aktif";
    return "❌ Tidak Aktif";
};

const startUserSession = async (userId, nomor, callback) => {
    const { state, saveCreds } = await useMultiFileAuthState(`./sessions/${userId}`);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
        browser: ["Stealth Bot", "Chrome", "1.0.0"],
        markOnlineOnConnect: true,
    });

    sessions[userId] = sock;

    if (!sock.authState.creds.registered) {
        if (!nomor) return;
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(nomor.replace(/[^0-9]/g, ''));
                callback(code);
            } catch (e) {
                callback(null, e.message);
            }
        }, 3000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startUserSession(userId, nomor, callback);
        } else if (connection === 'open') {
            // 🔥 LOGIKA SIMPAN NOMOR: Biar sesi permanen
            if (nomor) {
                const db = load_db();
                if (db[userId]) {
                    db[userId].wa_number = nomor.replace(/[^0-9]/g, '');
                    save_db(db);
                    console.log(`✅ Nomor ${nomor} disimpan ke database untuk ${userId}`);
                }
            }
            callback("CONNECTED");
        }
    });

    return sock;
};

const process_bulk_wa = async (userId, listNomor) => {
    const sock = sessions[userId];
    if (!sock) return "❌ Sesi WA belum aktif cuk! Pairing dulu.";

    let hasil = "🔍 *HASIL CEK BIO MASSAL*\n\n";
    const nomorArray = listNomor.split('\n').filter(n => n.trim() !== "");

    for (let nomor of nomorArray) {
        let cleanNomor = nomor.replace(/[^0-9]/g, '');
        if (!cleanNomor.startsWith('62') && !cleanNomor.startsWith('0')) cleanNomor = '62' + cleanNomor;
        if (cleanNomor.startsWith('0')) cleanNomor = '62' + cleanNomor.slice(1);
        
        const jid = `${cleanNomor}@s.whatsapp.net`;
        try {
            const [result] = await sock.onWhatsApp(jid);
            if (result && result.exists) {
                // JEDA FIX BIO PRIVASI
                await new Promise(r => setTimeout(r, 2500));
                let bio = "Privasi / Hidden";
                try {
                    const status = await sock.fetchStatus(jid);
                    if (status && status.status) bio = status.status;
                } catch (e) { bio = "Privasi (Setting WA)"; }
                hasil += `✅ *${cleanNomor}*\n└ Bio: _${bio}_\n\n`;
            } else {
                hasil += `❌ *${cleanNomor}*\n└ Status: Gak Terdaftar\n\n`;
            }
        } catch (e) { hasil += `⚠️ *${cleanNomor}*\n└ Status: Error\n\n`; }
        await new Promise(r => setTimeout(r, 1500));
    }
    return hasil;
};

// 🔥 LOGIKA RESUME SESSION: Taruh nomor pas booting
const initAutoResume = async () => {
    if (!fs.existsSync('./sessions')) return;
    const folders = fs.readdirSync('./sessions');
    const db = load_db();
    for (const userId of folders) {
        if (fs.lstatSync(`./sessions/${userId}`).isDirectory()) {
            const savedNumber = db[userId]?.wa_number || "";
            console.log(`♻️ Resuming session: ${userId} (Number: ${savedNumber || "Unknown"})`);
            startUserSession(userId, savedNumber, () => {});
        }
    }
};

module.exports = { startUserSession, process_bulk_wa, initAutoResume, checkSessionStatus };
