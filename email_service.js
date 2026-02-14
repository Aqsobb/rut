// email_service.js
const nodemailer = require('nodemailer');
const Imap = require('imap');
const { SUPPORT_EMAIL } = require('./config');

const generateTicket = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// --- 1. KIRIM EMAIL (FIX ETIMEDOUT: PAKE PORT 587) ---
const kirim_email_sakti = async (user_email, user_pass, nama_pengirim, nomor_target) => {
    const ticket = generateTicket();
    const subject = `QUESTION ${ticket} - ${nomor_target}`;
    
    const body = `Halo Tim WhatsApp, 
Perkenalkan, saya ${nama_pengirim}. 
Saya ingin mengajukan banding atau permohonan peninjauan ulang terkait kendala yang saya alami saat mencoba mendaftarkan nomor telepon saya ke aplikasi WhatsApp. 
Saat proses registrasi berlangsung, muncul pesan dengan keterangan "login tidak tersedia".
Mohon kiranya pihak WhatsApp dapat meninjau dan memperbaiki permasalahan tersebut.
Berikut informasi nomor yang mengalami kendala: 
Nomor telepon: ${nomor_target}
Atas perhatian dan bantuan dari pihak WhatsApp, saya ucapkan terima kasih. 
Hormat saya, 
${nama_pengirim}`;

    // --- BAGIAN INI YANG GW UBAH BIAR GAK TIMEOUT ---
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com', // Pake host manual
        port: 587,              // GANTI KE 587 (TLS) - Anti Blokir
        secure: false,          // False karena pake TLS
        auth: { 
            user: user_email, 
            pass: user_pass 
        },
        tls: {
            rejectUnauthorized: false // Biar gak error sertifikat
        }
    });

    try {
        await transporter.sendMail({
            from: user_email,
            to: SUPPORT_EMAIL,
            subject: subject,
            text: body
        });
        return { success: true, subject: subject };
    } catch (error) {
        // Balikin error asli biar ketauan kenapa
        return { success: false, error: error.message };
    }
};

// --- HELPER IMAP (ENGINE HAPUS) ---
const executeImapAction = (user, password, boxName, searchCriteria) => {
    return new Promise((resolve, reject) => {
        const imap = new Imap({
            user: user,
            password: password,
            host: 'imap.gmail.com',
            port: 993,
            tls: true,
            tlsOptions: { rejectUnauthorized: false },
            authTimeout: 10000
        });

        imap.once('ready', () => {
            imap.openBox(boxName, false, (err, box) => {
                if (err) { imap.end(); return resolve(false); }

                imap.search(searchCriteria, (err, results) => {
                    if (err || !results || results.length === 0) {
                        imap.end();
                        return resolve(false);
                    }

                    // KETEMU! AMBIL TERAKHIR
                    const lastMsg = results[results.length - 1]; 

                    // TANDAIN HAPUS
                    imap.addFlags(lastMsg, '\\Deleted', (err) => {
                        if (err) { imap.end(); return resolve(false); }
                        
                        imap.expunge((err) => {
                            imap.end();
                            resolve(true); // SUKSES KEHAPUS
                        });
                    });
                });
            });
        });

        imap.once('error', (err) => { resolve(false); });
        imap.connect();
    });
};

// --- 2. HAPUS SENT (SPAM CHECK BIAR INSTAN) ---
const hapus_pesan_terkirim = async (user_email, user_pass) => {
    // Cek semua kemungkinan nama folder
    const possibleSentFolders = ['[Gmail]/Terkirim', '[Gmail]/Sent Mail', 'Sent', 'Terkirim'];
    
    // Cari email yg dikirim KE support WA
    const criteria = [['TO', 'support@support.whatsapp.com']];

    // Coba hapus agresif (20x dalam 5 detik)
    for (let i = 0; i < 20; i++) {
        for (const folder of possibleSentFolders) {
            const result = await executeImapAction(user_email, user_pass, folder, criteria);
            if (result) return true; 
        }
        await new Promise(r => setTimeout(r, 250)); 
    }
    return false;
};

// --- 3. CEK & HAPUS BALASAN ---
const cek_dan_hapus_balasan = async (user_email, user_pass) => {
    const possibleInboxFolders = ['INBOX', '[Gmail]/Spam'];
    // Cari apapun dari 'whatsapp'
    const criteria = [['HEADER', 'FROM', 'whatsapp']];

    for (const folder of possibleInboxFolders) {
        const result = await executeImapAction(user_email, user_pass, folder, criteria);
        if (result) return true; 
    }
    return false;
};

module.exports = { kirim_email_sakti, hapus_pesan_terkirim, cek_dan_hapus_balasan };