# 70mai DashCam (BMW iDrive 7 Integration)

Applicazione nativa per **BMW iDrive 7 (MGU)** per visualizzare in tempo reale lo streaming e riprodurre i filmati registrati dalle dash cam **70mai** (A800S, A810, A500S Pro Plus, Omni X200, M500, ecc.) direttamente sullo schermo centrale widescreen della vettura.

---

## 📹 Funzionalità Principali

### 1. Visuale in Diretta (Live Stream RTSP a 60 fps)
- **Streaming Live Fullscreen**:
  - Visualizzazione in tempo reale di ciò che inquadra la telecamera frontale 4K HDR o la retrocamera posteriore (RC06/RC12).
- **HUD Telemetrico Sovraimpresso**:
  - Badge registrazione attivo (`● REC 00:45:12`).
  - Velocità istantanea (km/h) sincronizzata con la centralina CAN BMW.
  - Coordinate GPS (latitudine e longitudine) e timestamp orario.
  - Tasto rapido per scattare foto istantanee.

---

### 2. Galleria Video (Urti, Parcheggio, Guida Continua)
- **Catalogo Organizzato per Categorie**:
  - 🚨 **Eventi & Urti**: video salvati e protetti automaticamente dal sensore accelerometrico G-Sensor.
  - 🅿️ **Sorveglianza Parcheggio**: registrazioni a veicolo spento (rilevamento urti o time-lapse).
  - 🎬 **Registrazioni di Guida**: loop continui di viaggio.
  - 📷 **Istantanee Fotografiche**.
- **Navigazione con Manopola iDrive**:
  - Scorri i clip con la rotella iDrive e premi per avviare la riproduzione immediata.
  - Scheda informativa per ogni filmato: data, ora, durata, risoluzione, peso in MB, velocità registrata e picco di accelerazione G-Sensor (es. 1.85 g).

---

### 3. Video Player con Timeline Interattiva
- **Player Integrato su Schermo Widescreen**:
  - Play, pausa, avanzamento e riavvolgimento rapido (1x, 2x, 4x).
  - Barra di avanzamento interattiva con scrubber temporale.
  - **Grafico Telemetrico d'Impatto G-Sensor**: visualizza la curva dell'onda d'urto nel secondo esatto dell'incidente o della frenata brusca.
  - Funzione **Salva su BMW MGU** per archiviare per sempre i video importanti nella memoria di bordo dell'auto prima che la MicroSD li sovrascriva.

---

### 4. Diagnostica Wi-Fi & Stato MicroSD
- **Monitor Scheda MicroSD**:
  - Grafico circolare dello spazio utilizzato/libero (es. 98 GB su 128 GB) e stato di salute stimato della memoria.
- **Connessione Wi-Fi**:
  - Monitoraggio intensità segnale Wi-Fi (dBm), banda 5 GHz, indirizzo IP (`192.168.0.1`) e porte RTSP (554) / HTTP (80).
- **Specifiche Hardware 70mai**:
  - Sensore ottico Sony Starvis 2, tensione impianto e temperatura del supercondensatore.

---

## ⚙️ Come Connettere la 70mai alla BMW

1. **Accendi il Wi-Fi sulla Dash Cam 70mai**:
   - Dallo schermo o tasto della dash cam, abilita l'hotspot Wi-Fi.
2. **Connetti la BMW all'Hotspot della 70mai**:
   - Dal display BMW: **Menu Vettura > Impostazioni > Connessioni > Wi-Fi** e connettiti alla rete `70mai_...` (password predefinita `12345678` o quella impostata da app).
   - In alternativa, se hai il kit 4G cablato 70mai o un router 4G di bordo, assicurati che auto e dash cam siano sulla stessa rete locale.

---

## 🚀 Installazione sulla Vettura (iDrive 7)

Dalla cartella principale del progetto `idrive7-apps-main`:

### 1. Test di anteprima (offline)
```powershell
python kit/tools/build.py --preview-only dashcam_70mai
```

### 2. Caricamento sull'unità MGU tramite cavo ENET
```powershell
.\deploy\push-to-car.ps1 -CarIp 192.168.143.1 dashcam_70mai
```
*(Sostituisci `192.168.143.1` con l'IP della tua centralina MGU se diverso).*

Dopo il riavvio rapido dell'iDrive 7, troverai l'icona **70mai DashCam** nel menu applicazioni della tua BMW!
