# BMW Cloud Gaming (Xbox Cloud Gaming & Steam Remote Play)

Applicazione nativa per il sistema di bordo **BMW iDrive 7 (MGU - Media Graphic Unit)** per giocare in Cloud con **Xbox Cloud Gaming (xCloud)** e in streaming locale/remoto con **Steam Remote Play (Moonlight / Sunshine)** direttamente sullo schermo centrale widescreen della BMW a **60 fps** con accelerazione hardware.

---

## 🎮 Funzionalità Principali

- **Xbox Cloud Gaming (xCloud / Xbox Game Pass Ultimate)**:
  - Accesso al catalogo Xbox Cloud tramite edge server a bassissima latenza.
  - Streaming a **60 FPS** in risoluzione nativa ultrawide (fino a 1920x720).
  - Telemetria in tempo reale: RTT Ping verso i data center Microsoft Azure, jitter e bitrate.
- **Steam & PC Remote Play (Moonlight / Sunshine)**:
  - Streaming a bassissima latenza dal tuo PC da gaming con scheda grafica NVIDIA o AMD tramite Sunshine/Moonlight.
  - Avvio diretto in modalità **Steam Big Picture** o giochi specifici (Assetto Corsa, Forza, Cyberpunk, ecc.).
  - Decodifica video hardware GPU (Intel Apollo Lake HD Graphics 505 via driver VA-API Linux).
- **Supporto Controller (Gamepad Hub)**:
  - Compatibilità nativa con controller **Xbox Wireless (Bluetooth o cavo USB)**, **Sony PlayStation DualSense / DualShock 4** e gamepad standard HID.
  - Visualizzatore interattivo sul display a 60 fps: visualizza in tempo reale ogni tasto premuto, grilletto analogico e stick con misurazione della latenza di input (~3.8 ms).
  - Controllo di emergenza con la manopola centrale **BMW iDrive CCU** (rotazione per sterzare/mirare, inclinazione per navigare nei menu, pressione per selezionare/sparare).
- **Sicurezza Automobilistica (Parked-Only Safety Lock)**:
  - Monitoraggio della velocità del veicolo tramite segnali CAN/SOME/IP (`Vehicle2.statusCarSpeed2`).
  - Il gioco è attivo solo ad auto ferma (in marcia P). Se il veicolo inizia a muoversi (velocità > 0 km/h), lo streaming e l'audio si mettono immediatamente in pausa mostrando una schermata di avviso di sicurezza per evitare distrazioni alla guida.
- **Audio di Bordo BMW**:
  - Routing audio attraverso l'impianto Hi-Fi / Harman Kardon / Bowers & Wilkins della vettura tramite il DSP della centralina MGU (o cuffie Bluetooth per audio privato).

---

## 🕹️ Configurazione Controller Gamepad

Per giocare al meglio è consigliato collegare un gamepad:

1. **Bluetooth (Consigliato)**:
   - Metti il controller Xbox in modalità di accoppiamento (tieni premuto il tasto di pairing sul bordo superiore finché il logo Xbox lampeggia rapidamente).
   - Sul display BMW, vai su **Menu Veicolo > Dispositivi mobili > Aggiungi dispositivo** e seleziona il controller Bluetooth.
2. **Cavo USB**:
   - Collega il controller Xbox o PlayStation direttamente a una presa USB situata nel tunnel centrale o sotto il bracciolo della BMW. Il kernel Linux dell'MGU riconosce istantaneamente il dispositivo in `/dev/input/js0`.

---

## ☁️ Configurazione Xbox Cloud Gaming

1. Assicurati che l'auto sia connessa a Internet:
   - Tramite **Hotspot Wi-Fi 5 GHz** del tuo smartphone 5G.
   - Oppure tramite la eSIM integrata ConnectedDrive dell'auto (se abilitata per i dati hotspot).
2. L'app si connette ai server edge Azure con bitrate adattivo tra 10 e 35 Mbps.

---

## 🖥️ Configurazione Steam & PC Remote Play (Moonlight / Sunshine)

1. Sul tuo PC da gaming a casa (o collegato alla stessa rete):
   - Installa **[Sunshine](https://github.com/LizardByte/Sunshine)** (host open source per Moonlight).
   - Nelle impostazioni di Sunshine, abilita l'encoder NVENC (NVIDIA) o AMF (AMD) con audio stereo 48 kHz.
2. Nelle impostazioni dell'app BMW Cloud Gaming:
   - Inserisci l'indirizzo IP del PC host (es. `192.168.1.150` o il tuo IP pubblico / DNS se giochi da remoto fuori casa via ZeroTier/Tailscale/VPN).
   - Seleziona la risoluzione **1920x720** (ultrawide BMW) a **60 FPS**.

---

## 🚀 Installazione sulla BMW (MGU iDrive 7)

Per installare l'applicazione sulla tua BMW:

### Metodo 1: PowerShell (Windows)

```powershell
cd idrive7-apps-main
.\deploy\push-to-car.ps1 -CarIp 192.168.143.1 cloud_gaming
```

### Metodo 2: Bash (macOS / Linux)

```bash
cd idrive7-apps-main
./deploy/push-to-car.sh 192.168.143.1 cloud_gaming
```

*(Sostituisci `192.168.143.1` con l'IP Ethernet OBD/ENET della tua MGU).*

Una volta installata, l'app **Cloud Gaming** apparirà automaticamente nel menu principale delle applicazioni di bordo di iDrive 7!
