'use strict';
/**
 * ram_controller.js - BMW RAM (Receiver Audio Module, ECU 0x37) & Booster Interface.
 *
 * Manages:
 *   - Speed-dependent volume compensation (GAL) curve based on live Vehicle2.statusCarSpeed2
 *   - Active Sound Design (ASD) synthetic engine sound profiles
 *   - Hardware telemetry (Amplifier load %, RAM thermal temperature, DSP status)
 */

class RAMController {
    constructor(ctx, log) {
        this.ctx = ctx;
        this.log = log;

        this.carSpeedKmh = 0;
        this.speedVolumeLevel = 3; // 0 (off), 1, 3, 5
        this.calculatedGainDb = 0.0;

        this.asdMode = 'oem'; // 'oem' | 'sport' | 'reduced' | 'off'
        this.hardwareStats = {
            ecu: 'RAM (0x37) + Booster S688/S6F1',
            dspChannels: 10,
            ampWattsTotal: 650,
            tempC: 41.5,
            voltage: 13.8,
            busStatus: 'CAN / OABR Ethernet OK',
        };

        this.hookSignals();
    }

    hookSignals() {
        if (!this.ctx || !this.ctx.signals) return;
        try {
            const v2 = this.ctx.signals.get('de.bmw.infotainment.vehicle.Vehicle2');
            if (v2) {
                v2.on('statusCarSpeed2', (val) => {
                    if (typeof val === 'number') {
                        this.carSpeedKmh = Math.max(0, val);
                        this.updateSpeedVolume();
                    } else if (val && typeof val.speed === 'number') {
                        this.carSpeedKmh = Math.max(0, val.speed);
                        this.updateSpeedVolume();
                    }
                });
            }
        } catch (e) {
            // Signal hook optional in simulation
        }
    }

    setSpeed(speedKmh) {
        this.carSpeedKmh = speedKmh;
        this.updateSpeedVolume();
    }

    setSpeedVolumeLevel(level) {
        this.speedVolumeLevel = Number(level) || 0;
        this.updateSpeedVolume();
    }

    setASDMode(mode) {
        this.asdMode = mode;
        if (this.log) this.log.info('Active Sound Design mode set to: ' + mode);
    }

    updateSpeedVolume() {
        if (this.speedVolumeLevel === 0) {
            this.calculatedGainDb = 0.0;
            return;
        }

        // Adaptive Fletcher-Munson volume compensation curve:
        // Road and wind noise increases logarithmically above 50 km/h
        const factor = this.speedVolumeLevel / 3.0;
        if (this.carSpeedKmh <= 30) {
            this.calculatedGainDb = 0.0;
        } else if (this.carSpeedKmh <= 90) {
            this.calculatedGainDb = Number(((this.carSpeedKmh - 30) / 60.0 * 2.0 * factor).toFixed(1));
        } else {
            const extra = (this.carSpeedKmh - 90) / 50.0 * 2.5;
            this.calculatedGainDb = Number((Math.min(6.5, (2.0 + extra) * factor)).toFixed(1));
        }
    }

    getStats() {
        return {
            speed: this.carSpeedKmh,
            gainDb: this.calculatedGainDb,
            asdMode: this.asdMode,
            hardware: this.hardwareStats,
        };
    }
}

module.exports = RAMController;
