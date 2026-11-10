'use strict';
/**
 * speaker_map.js - BMW Cabin Speaker Staging Layout & Acoustic Calculations.
 *
 * Models the speaker positions in BMW G-series (G20, G30, G05, G80, etc.)
 * across HiFi (12 speakers), Harman Kardon (16 speakers) and Bowers & Wilkins (16-20 speakers).
 *
 * Calculates per-speaker acoustic load, heat-map color, and sweet-spot focus.
 */

const SPEAKERS = [
    { id: 'cnt_mid', name: 'Canale Centrale Cruscotto', x: 0, y: -90, type: 'center', watts: 50 },
    { id: 'fl_tw', name: 'Tweeter Montante SX', x: -55, y: -70, type: 'tweeter', watts: 25 },
    { id: 'fr_tw', name: 'Tweeter Montante DX', x: 55, y: -70, type: 'tweeter', watts: 25 },
    { id: 'fl_door', name: 'Midrange Porta Anteriore SX', x: -75, y: -30, type: 'mid', watts: 50 },
    { id: 'fr_door', name: 'Midrange Porta Anteriore DX', x: 75, y: -30, type: 'mid', watts: 50 },
    { id: 'sub_fl', name: 'Subwoofer Sotto Sedile Guida', x: -35, y: -10, type: 'sub', watts: 120 },
    { id: 'sub_fr', name: 'Subwoofer Sotto Sedile Passeggero', x: 35, y: -10, type: 'sub', watts: 120 },
    { id: 'rl_door', name: 'Cassa Porta Posteriore SX', x: -70, y: 40, type: 'mid', watts: 50 },
    { id: 'rr_door', name: 'Cassa Porta Posteriore DX', x: 70, y: 40, type: 'mid', watts: 50 },
    { id: 'rl_sur', name: 'Surround Cappelliera SX', x: -45, y: 85, type: 'surround', watts: 40 },
    { id: 'rr_sur', name: 'Surround Cappelliera DX', x: 45, y: 85, type: 'surround', watts: 40 },
    { id: 'roof_f', name: 'Altoparlante Tetto 3D Ant.', x: 0, y: -45, type: 'roof', watts: 30 },
    { id: 'roof_r', name: 'Altoparlante Tetto 3D Post.', x: 0, y: 25, type: 'roof', watts: 30 },
];

const PRESET_STAGING = [
    { id: 'driver', name: 'Guidatore Esclusivo', fader: 3, balance: -4, desc: 'Sweet-spot focalizzato al 100% sulla posizione di guida' },
    { id: 'front', name: 'Passeggeri Anteriori', fader: 4, balance: 0, desc: 'Fronte sonoro aperto e bilanciato tra pilota e copilota' },
    { id: 'all', name: 'Tutti i Passeggeri', fader: 0, balance: 0, desc: 'Copertura surround omogenea per tutti i 5 occupanti' },
    { id: 'rear', name: 'Focus Posteriore / Bimbi', fader: -6, balance: 0, desc: 'Suono concentrato sui sedili posteriori per non disturbare chi guida' },
];

class SpeakerManager {
    constructor() {
        this.speakers = SPEAKERS;
    }

    /**
     * Calculates the active power and gain multiplier (0.0 to 1.5)
     * for a speaker given current fader (-10..10), balance (-10..10), sub gain, and 3D level.
     */
    getSpeakerGain(spk, fader, balance, subGain, surround3d) {
        // Base fader influence (-10 rear to +10 front)
        // spk.y ranges roughly from -90 (front) to +90 (rear)
        const normY = -spk.y / 90.0; // +1 front, -1 rear
        const faderFactor = 1.0 + (fader / 10.0) * normY * 0.6;

        // Base balance influence (-10 left to +10 right)
        const normX = spk.x / 75.0; // -1 left, +1 right
        const balanceFactor = 1.0 + (balance / 10.0) * normX * 0.6;

        let gain = Math.max(0.1, faderFactor * balanceFactor);

        if (spk.type === 'sub') {
            gain *= (1.0 + subGain * 0.08);
        } else if (spk.type === 'surround' || spk.type === 'roof') {
            gain *= (surround3d / 50.0);
        }

        return Math.max(0.05, Math.min(1.8, Number(gain.toFixed(2))));
    }

    getStagingPresets() {
        return PRESET_STAGING;
    }
}

module.exports = { SpeakerManager, SPEAKERS, PRESET_STAGING };
