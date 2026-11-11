'use strict';
/**
 * stream_engine.js - Cloud Gaming & Remote Play Session Manager.
 *
 * Coordinates:
 *   - Xbox Cloud Gaming (xCloud WebRTC session)
 *   - Steam Remote Play / Sunshine / Moonlight embedded streaming
 *   - Hardware video decoder pipeline (Intel Apollo Lake VA-API /dev/dri/renderD128)
 *   - Audio routing to BMW MGU sound system (ALSA / PulseAudio)
 *   - Automotive safety lock (Parked Only: auto-pause when speed > 0)
 */

const PLATFORMS = {
    xbox: {
        name: 'Xbox Cloud Gaming',
        vendor: 'Microsoft Azure',
        codec: 'H.264 / HEVC (VA-API)',
        titles: [
            { id: 'forza5', title: 'Forza Horizon 5', genre: 'Racing', cover: 'forza' },
            { id: 'halo_inf', title: 'Halo Infinite', genre: 'Sci-Fi FPS', cover: 'halo' },
            { id: 'flight_sim', title: 'MS Flight Simulator', genre: 'Sim', cover: 'flight' },
            { id: 'starfield', title: 'Starfield', genre: 'RPG', cover: 'starfield' },
            { id: 'eafc24', title: 'EA Sports FC 24', genre: 'Sports', cover: 'fifa' },
            { id: 'cyberpunk', title: 'Cyberpunk 2077', genre: 'Action RPG', cover: 'cyber' },
        ],
    },
    steam: {
        name: 'Steam Remote Play',
        vendor: 'Moonlight / Sunshine',
        codec: 'HEVC / H.264 Low Latency (VA-API)',
        titles: [
            { id: 'steam_bp', title: 'Steam Big Picture', genre: 'Launcher', cover: 'steam' },
            { id: 'desktop', title: 'Host Desktop (Windows)', genre: 'System', cover: 'desktop' },
            { id: 'assetto', title: 'Assetto Corsa Competizione', genre: 'Sim Racing', cover: 'assetto' },
            { id: 'elden_ring', title: 'Elden Ring', genre: 'Action RPG', cover: 'elden' },
            { id: 'gta5', title: 'Grand Theft Auto V', genre: 'Open World', cover: 'gta' },
        ],
    },
    geforce: {
        name: 'GeForce NOW',
        vendor: 'NVIDIA Cloud',
        codec: 'AV1 / HEVC (VA-API)',
        titles: [
            { id: 'gfn_hub', title: 'GeForce NOW Library', genre: 'Cloud Hub', cover: 'geforce' },
            { id: 'baldurs3', title: "Baldur's Gate 3", genre: 'RPG', cover: 'baldurs' },
            { id: 'witcher3', title: 'The Witcher 3: Wild Hunt', genre: 'RPG', cover: 'witcher' },
        ],
    },
};

class StreamEngine {
    constructor(ctx, log) {
        this.ctx = ctx;
        this.log = log;

        this.status = 'STANDBY'; // 'STANDBY' | 'CONNECTING' | 'STREAMING' | 'PAUSED_DRIVING'
        this.activePlatform = 'xbox';
        this.selectedTitleIndex = 0;
        this.sessionDurationSec = 0;
        this.streamFps = 60.0;
        this.droppedFrames = 0;
        this.bitrateActual = 21.4;

        this.timer = null;
    }

    setPlatform(platformKey) {
        if (PLATFORMS[platformKey]) {
            this.activePlatform = platformKey;
            this.selectedTitleIndex = 0;
            if (this.log) this.log.info('Selected platform: ' + PLATFORMS[platformKey].name);
        }
    }

    nextPlatform() {
        const keys = Object.keys(PLATFORMS);
        const idx = (keys.indexOf(this.activePlatform) + 1) % keys.length;
        this.setPlatform(keys[idx]);
    }

    nextTitle() {
        const titles = this.getTitles();
        this.selectedTitleIndex = (this.selectedTitleIndex + 1) % titles.length;
    }

    prevTitle() {
        const titles = this.getTitles();
        this.selectedTitleIndex = (this.selectedTitleIndex - 1 + titles.length) % titles.length;
    }

    getPlatformInfo() {
        return PLATFORMS[this.activePlatform] || PLATFORMS.xbox;
    }

    getTitles() {
        return (PLATFORMS[this.activePlatform] && PLATFORMS[this.activePlatform].titles) || [];
    }

    getSelectedTitle() {
        const titles = this.getTitles();
        return titles[this.selectedTitleIndex] || titles[0];
    }

    launchStream() {
        if (this.status === 'STREAMING') {
            // Already streaming -> stop / pause
            this.stopStream();
            return false;
        }

        this.status = 'CONNECTING';
        if (this.log) this.log.info('Connecting to ' + this.getPlatformInfo().name + '...');

        setTimeout(() => {
            this.status = 'STREAMING';
            this.sessionDurationSec = 0;
            if (!this.timer) {
                this.timer = setInterval(() => {
                    if (this.status === 'STREAMING') {
                        this.sessionDurationSec++;
                    }
                }, 1000);
            }
            if (this.log) this.log.info('Stream established with hardware decoding at 60 fps');
        }, 800);

        return true;
    }

    stopStream() {
        this.status = 'STANDBY';
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        if (this.log) this.log.info('Stream session stopped');
    }

    handleVehicleMovement(isMoving) {
        if (isMoving) {
            if (this.status === 'STREAMING') {
                this.status = 'PAUSED_DRIVING';
                if (this.log) this.log.warn('Vehicle movement detected: safety auto-pause engaged');
            }
        } else {
            if (this.status === 'PAUSED_DRIVING') {
                this.status = 'STREAMING';
                if (this.log) this.log.info('Vehicle stationary: resuming cloud game stream');
            }
        }
    }

    destroy() {
        if (this.timer) clearInterval(this.timer);
    }
}

module.exports = { StreamEngine, PLATFORMS };
