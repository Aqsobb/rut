// tiktok_service.js
const axios = require('axios');
const FormData = require('form-data');

const tiktok_download = async (url) => {
    try {
        const data = new FormData();
        data.append('url', url);
        data.append('count', '12');
        data.append('cursor', '0');
        data.append('web', '1');
        data.append('hd', '1');

        const response = await axios.post('https://www.tikwm.com/api/', data, {
            headers: {
                ...data.getHeaders(),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const res = response.data;
        if (res.code === 0) {
            // AMBIL LINK HD ATAU BIASA
            let videoPath = res.data.hdplay || res.data.play;
            let musicPath = res.data.music;

            // LOGIKA FIX LINK KEPOTONG (PENTING!)
            const baseUrl = 'https://www.tikwm.com';
            const videoUrl = videoPath.startsWith('http') ? videoPath : baseUrl + videoPath;
            const musicUrl = musicPath.startsWith('http') ? musicPath : baseUrl + musicPath;
            
            return {
                status: true,
                title: res.data.title || 'No Caption',
                author: res.data.author.nickname || 'Unknown',
                video: videoUrl, // SEKARANG LINKNYA LENGKAP CUK
                music: musicUrl,
                cover: res.data.cover.startsWith('http') ? res.data.cover : baseUrl + res.data.cover
            };
        } else {
            return { status: false, msg: 'Video Private / Dihapus / Gagal API.' };
        }
    } catch (e) {
        return { status: false, msg: e.message };
    }
};

module.exports = { tiktok_download };
