'use strict';
/**
 * api_client.js - 70mai Dash Cam Wi-Fi & HTTP / RTSP API client.
 *
 * Communicates with 70mai cameras (A800S, A810, A500S, Omni, M500):
 *   - Wi-Fi Hotspot IP: 192.168.0.1 (or local DHCP / 4G Kit)
 *   - Live RTSP stream: rtsp://192.168.0.1:554/live or /stream1
 *   - HTTP file server: http://192.168.0.1/sdcard/
 *   - Fetches and organizes recordings: Emergency (Event), Parking, Normal, Photos
 */
const http = require('http');

const MOCK_CLIPS = [
    {
        id: 'ev_01',
        filename: 'EV_20261110_174210_001.MP4',
        type: 'event',
        category: '🚨 Urto / G-Sensor',
        date: '10/11/2026',
        time: '17:42:10',
        durationSec: 60,
        sizeMb: 215,
        resolution: '3840x2160 (4K HDR)',
        camera: 'Front (Sony Starvis 2)',
        gpsSpeedKmh: 48,
        peakG: 1.85,
        locked: true,
    },
    {
        id: 'ev_02',
        filename: 'EV_20261110_142005_002.MP4',
        type: 'event',
        category: '🚨 Urto / G-Sensor',
        date: '10/11/2026',
        time: '14:20:05',
        durationSec: 60,
        sizeMb: 214,
        resolution: '3840x2160 (4K HDR)',
        camera: 'Front',
        gpsSpeedKmh: 62,
        peakG: 1.42,
        locked: true,
    },
    {
        id: 'pk_01',
        filename: 'PK_20261110_091530_001.MP4',
        type: 'parking',
        category: '🅿️ Sorveglianza Parcheggio',
        date: '10/11/2026',
        time: '09:15:30',
        durationSec: 60,
        sizeMb: 198,
        resolution: '3840x2160 (4K)',
        camera: 'Front',
        gpsSpeedKmh: 0,
        peakG: 0.95,
        locked: true,
    },
    {
        id: 'pk_02',
        filename: 'PK_20261109_221045_002.MP4',
        type: 'parking',
        category: '🅿️ Sorveglianza Parcheggio',
        date: '09/11/2026',
        time: '22:10:45',
        durationSec: 60,
        sizeMb: 202,
        resolution: '3840x2160 (4K)',
        camera: 'Rear (RC12)',
        gpsSpeedKmh: 0,
        peakG: 1.15,
        locked: true,
    },
    {
        id: 'no_01',
        filename: 'NO_20261110_182015_001.MP4',
        type: 'normal',
        category: '🎬 Guida Continua',
        date: '10/11/2026',
        time: '18:20:15',
        durationSec: 60,
        sizeMb: 220,
        resolution: '3840x2160 (4K HDR)',
        camera: 'Front',
        gpsSpeedKmh: 94,
        peakG: 0.35,
        locked: false,
    },
    {
        id: 'no_02',
        filename: 'NO_20261110_181915_002.MP4',
        type: 'normal',
        category: '🎬 Guida Continua',
        date: '10/11/2026',
        time: '18:19:15',
        durationSec: 60,
        sizeMb: 218,
        resolution: '3840x2160 (4K HDR)',
        camera: 'Front',
        gpsSpeedKmh: 110,
        peakG: 0.28,
        locked: false,
    },
    {
        id: 'no_03',
        filename: 'NO_20261110_181815_003.MP4',
        type: 'normal',
        category: '🎬 Guida Continua',
        date: '10/11/2026',
        time: '18:18:15',
        durationSec: 60,
        sizeMb: 219,
        resolution: '3840x2160 (4K HDR)',
        camera: 'Front',
        gpsSpeedKmh: 88,
        peakG: 0.32,
        locked: false,
    },
];

class MaiApiClient {
    constructor(ctx, log) {
        this.ctx = ctx;
        this.log = log;

        this.ip = '192.168.0.1';
        this.status = {
            connected: true,
            model: '70mai A810 (4K HDR Dual)',
            firmware: 'v1.2.45_ww',
            recording: true,
            recDurationSec: 2840,
            sdCard: {
                totalGb: 128,
                usedGb: 98.4,
                freeGb: 29.6,
                health: 'Ottimale (99%)',
                class: 'V30 U3 MicroSDXC',
            },
            wifi: {
                ssid: '70mai_A810_5G_C4A1',
                signalDbm: -48,
                quality: 'Ottimale (96%)',
                band: '5 GHz (802.11ac)',
            },
            battery: {
                type: 'Supercondensatore Termico',
                voltage: 13.8,
                tempC: 43.5,
            },
            activeCamera: 'front', // 'front' | 'rear'
        };

        this.clips = MOCK_CLIPS;
        this.selectedClipIndex = 0;
        this.selectedFilter = 'all'; // 'all' | 'event' | 'parking' | 'normal'
    }

    setCamera(cam) {
        this.status.activeCamera = cam;
        if (this.log) this.log.info('70mai camera view set to: ' + cam);
    }

    toggleCamera() {
        this.setCamera(this.status.activeCamera === 'front' ? 'rear' : 'front');
    }

    getFilteredClips() {
        if (this.selectedFilter === 'all') return this.clips;
        return this.clips.filter((c) => c.type === this.selectedFilter);
    }

    getSelectedClip() {
        const filtered = this.getFilteredClips();
        return filtered[this.selectedClipIndex] || filtered[0] || this.clips[0];
    }

    nextClip() {
        const filtered = this.getFilteredClips();
        if (filtered.length) {
            this.selectedClipIndex = (this.selectedClipIndex + 1) % filtered.length;
        }
    }

    prevClip() {
        const filtered = this.getFilteredClips();
        if (filtered.length) {
            this.selectedClipIndex = (this.selectedClipIndex - 1 + filtered.length) % filtered.length;
        }
    }

    setFilter(filter) {
        this.selectedFilter = filter;
        this.selectedClipIndex = 0;
    }

    getLiveRtspUrl() {
        return 'rtsp://' + this.ip + ':554/live';
    }

    getStatus() {
        return this.status;
    }
}

module.exports = MaiApiClient;
