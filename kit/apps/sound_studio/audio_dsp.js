'use strict';
/**
 * audio_dsp.js - Audio DSP processing, Equalizer bands and Staging presets.
 *
 * Provides:
 *   - 7-band parametric/graphic EQ: 40Hz, 100Hz, 250Hz, 1kHz, 4kHz, 10kHz, 16kHz
 *   - Staging parameters: Fader, Balance, Subwoofer Level, Center Level, 3D Surround
 *   - Audiophile sound presets (B&W Studio, Concert Hall, Club Punch, Vocal Clarity, Rock Live)
 *   - Real-Time Spectrum Analyzer (RTA) animation engine with peak hold
 */

const PRESETS = [
    {
        id: 'studio',
        name: 'B&W Studio Mastering',
        desc: 'Curva flat di riferimento audiophile, massima fedeltà e zero distorsione',
        bands: [0, 0, 0, 0, 0, 0, 0],
        subwoofer: 0,
        center: 0,
        surround3d: 15,
        loudness: false,
    },
    {
        id: 'concert',
        name: 'Concert Hall Immersion',
        desc: 'Ampio riverbero tridimensionale con medi caldi e alti brillanti per musica live',
        bands: [2, 3, 1, 0, 2, 4, 5],
        subwoofer: 3,
        center: 1,
        surround3d: 75,
        loudness: true,
    },
    {
        id: 'club',
        name: 'Club & Bass Boost',
        desc: 'Bassi profondi potenziati sui subwoofer sottosedile per musica dance/elettronica',
        bands: [6, 5, 2, -1, 1, 3, 4],
        subwoofer: 6,
        center: -1,
        surround3d: 40,
        loudness: true,
    },
    {
        id: 'vocal',
        name: 'Vocal & Podcast Clarity',
        desc: 'Frequenze medie enfatizzate per voci cristalline e dialoghi nitidi',
        bands: [-2, -1, 0, 4, 4, 2, 1],
        subwoofer: -2,
        center: 4,
        surround3d: 10,
        loudness: false,
    },
    {
        id: 'rock',
        name: 'Rock & Live Stage',
        desc: 'Curva a V dinamica con kick drum incisivo e chitarre in primo piano',
        bands: [4, 4, 1, -1, 3, 5, 4],
        subwoofer: 4,
        center: 0,
        surround3d: 50,
        loudness: true,
    },
    {
        id: 'lounge',
        name: 'Acoustic Lounge',
        desc: 'Timbro morbido, rilassante e vellutato ideale per viaggi autostradali',
        bands: [2, 2, 1, 1, 1, 2, 2],
        subwoofer: 1,
        center: 0,
        surround3d: 30,
        loudness: true,
    },
];

const BAND_FREQS = [
    { label: '40 Hz', sub: 'Sub-Bassi', range: 'Profondi' },
    { label: '100 Hz', sub: 'Bassi', range: 'Punch' },
    { label: '250 Hz', sub: 'Medio-Bassi', range: 'Calore' },
    { label: '1 kHz', sub: 'Medi', range: 'Voci' },
    { label: '4 kHz', sub: 'Medio-Alti', range: 'Presenza' },
    { label: '10 kHz', sub: 'Alti', range: 'Dettaglio' },
    { label: '16 kHz', sub: 'Aria', range: 'Brillantezza' },
];

class AudioDSP {
    constructor(log) {
        this.log = log;

        // Current user settings
        this.bands = [0, 0, 0, 0, 0, 0, 0]; // -10 dB to +10 dB
        this.selectedBandIndex = 0;

        // Staging coordinates (-10 to +10)
        this.fader = 0;    // <0: Rear, >0: Front
        this.balance = 0;  // <0: Left, >0: Right
        this.subwoofer = 0; // -10 dB to +10 dB
        this.center = 0;
        this.surround3d = 40; // 0% to 100%

        this.currentPresetIndex = 0;

        // Spectrum analyzer state (16 bands)
        this.spectrum = new Array(16).fill(0);
        this.peaks = new Array(16).fill(0);
        this.phase = 0;

        this.applyPreset(0);
    }

    applyPreset(idx) {
        this.currentPresetIndex = (idx + PRESETS.length) % PRESETS.length;
        const p = PRESETS[this.currentPresetIndex];
        this.bands = p.bands.slice();
        this.subwoofer = p.subwoofer;
        this.center = p.center;
        this.surround3d = p.surround3d;
        if (this.log) this.log.info('Audio preset loaded: ' + p.name);
    }

    nextPreset() {
        this.applyPreset(this.currentPresetIndex + 1);
    }

    prevPreset() {
        this.applyPreset(this.currentPresetIndex - 1);
    }

    getPreset() {
        return PRESETS[this.currentPresetIndex];
    }

    adjustBand(bandIdx, delta) {
        if (bandIdx >= 0 && bandIdx < this.bands.length) {
            this.bands[bandIdx] = Math.max(-10, Math.min(10, this.bands[bandIdx] + delta));
        }
    }

    setFaderBalance(fader, balance) {
        this.fader = Math.max(-10, Math.min(10, fader));
        this.balance = Math.max(-10, Math.min(10, balance));
    }

    /**
     * Updates simulated live RTA frequency bars for 60 fps visual display.
     * Takes EQ gain curves and adds natural musical rhythm and fluctuations.
     */
    tickSpectrum() {
        this.phase += 0.08;
        for (let i = 0; i < 16; i++) {
            // Map 16 visual bins across the 7 EQ bands
            const eqIdx = Math.min(6, Math.floor((i / 16) * 7));
            const eqGain = (this.bands[eqIdx] + 10) / 20; // 0..1

            // Dynamic music pulse
            const bassWave = Math.sin(this.phase * 2.2) * 0.35 + 0.5;
            const midWave = Math.cos(this.phase * 1.5 + i * 0.4) * 0.25 + 0.4;
            const trebleWave = Math.sin(this.phase * 3.1 + i * 0.7) * 0.2 + 0.3;

            let target = i < 4 ? bassWave * (1 + this.subwoofer * 0.05) : i < 10 ? midWave : trebleWave;
            target = target * (0.6 + eqGain * 0.6);
            target = Math.max(0.08, Math.min(0.98, target));

            // Smooth spring damping
            this.spectrum[i] += (target - this.spectrum[i]) * 0.35;

            // Peak hold decay
            if (this.spectrum[i] > this.peaks[i]) {
                this.peaks[i] = this.spectrum[i];
            } else {
                this.peaks[i] = Math.max(0, this.peaks[i] - 0.015);
            }
        }
    }

    getSpectrum() {
        return this.spectrum;
    }

    getPeaks() {
        return this.peaks;
    }
}

module.exports = { AudioDSP, PRESETS, BAND_FREQS };
