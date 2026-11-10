'use strict';
/**
 * video_player.js - Dash Cam Video Player & Telemetry Synchronizer.
 *
 * Coordinates playback of 70mai recorded MP4 clips on BMW iDrive 7:
 *   - Play, pause, forward, rewind, 2x / 4x fast forward
 *   - Scrubbing along the timeline with the iDrive CCU knob
 *   - Synchronized G-Sensor impact and GPS speed telemetry
 */

class VideoPlayer {
    constructor(log) {
        this.log = log;

        this.currentClip = null;
        this.isPlaying = false;
        this.currentTimeSec = 0.0;
        this.playbackSpeed = 1.0; // 1.0, 2.0, 4.0, -2.0

        this.timer = null;
        this.gForceHistory = [];
    }

    loadClip(clip) {
        this.currentClip = clip;
        this.currentTimeSec = 0.0;
        this.isPlaying = true;
        this.playbackSpeed = 1.0;
        this.generateGTrace(clip);
        if (this.log) this.log.info('Video player loaded clip: ' + clip.filename);
    }

    generateGTrace(clip) {
        this.gForceHistory = [];
        const isEvent = clip.type === 'event';
        // Generate 40 telemetry points representing G-force along the 60s clip
        for (let i = 0; i < 40; i++) {
            let val = 0.2 + (Math.random() - 0.5) * 0.15;
            if (isEvent && i >= 18 && i <= 24) {
                // Impact shock peak
                val = clip.peakG * (1.0 - Math.abs(i - 21) * 0.25);
            }
            this.gForceHistory.push(Number(val.toFixed(2)));
        }
    }

    togglePlay() {
        this.isPlaying = !this.isPlaying;
    }

    seek(deltaSec) {
        if (!this.currentClip) return;
        this.currentTimeSec = Math.max(0, Math.min(this.currentClip.durationSec, this.currentTimeSec + deltaSec));
    }

    setSpeed(speed) {
        this.playbackSpeed = speed;
    }

    cycleSpeed() {
        const speeds = [1.0, 2.0, 4.0];
        const nextIdx = (speeds.indexOf(this.playbackSpeed) + 1) % speeds.length;
        this.setSpeed(speeds[nextIdx]);
    }

    tick(dtSec) {
        if (!this.isPlaying || !this.currentClip) return;

        this.currentTimeSec += dtSec * this.playbackSpeed;
        if (this.currentTimeSec >= this.currentClip.durationSec) {
            this.currentTimeSec = this.currentClip.durationSec;
            this.isPlaying = false;
        } else if (this.currentTimeSec < 0) {
            this.currentTimeSec = 0;
            this.isPlaying = false;
        }
    }

    getProgress() {
        if (!this.currentClip || this.currentClip.durationSec === 0) return 0;
        return this.currentTimeSec / this.currentClip.durationSec;
    }

    getGTrace() {
        return this.gForceHistory;
    }
}

module.exports = VideoPlayer;
