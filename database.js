// database.js
const fs = require('fs');
const path = require('path');
const { OWNER_ID } = require('./config');

const DB_FOLDER = path.join(__dirname, 'database');
const DB_FILE = path.join(DB_FOLDER, 'users.json');

if (!fs.existsSync(DB_FOLDER)) fs.mkdirSync(DB_FOLDER);

const load_db = () => {
    if (!fs.existsSync(DB_FILE)) return {};
    try { return JSON.parse(fs.readFileSync(DB_FILE)); } catch (e) { return {}; }
};

const save_db = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 4));

// LOGIKA ADD PREMIUM (PINTER)
const add_premium = (user_id, days) => {
    const db = load_db();
    const uid = String(user_id);
    
    // Hitung tanggal expired
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + parseInt(days));
    const expiryString = expiryDate.toISOString().split('T')[0]; // Format YYYY-MM-DD

    if (!db[uid]) {
        // Kalau user baru
        db[uid] = { email: "", password: "", nama: "User", role: "premium", limit: 999999, expired: expiryString };
    } else {
        // Kalau user lama update
        db[uid].role = 'premium';
        db[uid].limit = 999999;
        db[uid].expired = expiryString;
    }
    save_db(db);
    return expiryString;
};

// LOGIKA GET DATA (OTOMATIS CEK EXPIRED)
const get_user_data = (user_id) => {
    const db = load_db();
    const uid = String(user_id);
    const data = db[uid];
    
    if (!data) return null;

    // Cek Expired Kalau Dia Premium (Kecuali Owner)
    if (data.role === 'premium' && String(user_id) !== String(OWNER_ID)) {
        const today = new Date().toISOString().split('T')[0];
        if (data.expired && today > data.expired) {
            // TURUNKAN KASTA JADI FREE
            data.role = 'free';
            data.limit = 0; 
            data.expired = null;
            save_db(db);
            // Kasih tanda biar index.js tau dia baru expired
            return { ...data, is_expired_now: true }; 
        }
    }
    return data;
};

const register_user = (user_id, email, password, nama) => {
    const db = load_db();
    const uid = String(user_id);
    let role = 'free';
    let limit = 3;
    if (String(user_id) === String(OWNER_ID)) { role = 'owner'; limit = 999999; }
    
    // Simpan data tanpa ngerusak data lama (expired dll tetep aman)
    db[uid] = { ...db[uid], email, password, nama, role, limit };
    save_db(db);
};

const kurangi_limit = (user_id) => {
    if (String(user_id) === String(OWNER_ID)) return true;
    const db = load_db();
    const uid = String(user_id);
    if (db[uid]) {
        if (db[uid].role === 'premium') return true;
        if (db[uid].limit > 0) {
            db[uid].limit -= 1;
            save_db(db);
            return true;
        }
    }
    return false;
};

module.exports = { register_user, get_user_data, kurangi_limit, load_db, save_db, add_premium };
