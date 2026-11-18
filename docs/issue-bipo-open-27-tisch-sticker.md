## BiPo Open 27: Tisch-Sticker (NFC + QR) zum Beitreten im Mehrspieler-Knecht

### Idee
Jeder Bierpong-Tisch bekommt einen Sticker mit **NFC-Chip und QR-Code**. Beide enthalten denselben Link, z. B. `https://<domain>/Mitspielen?tisch=3`.

- **Handy an den Tisch halten** (NFC) oder **QR-Code mit der Kamera scannen** → man landet direkt in der Lobby dieses Tischs, mit seinem Standard-Profil.
- iPhones öffnen NFC-Links ohne App, Android über Chrome. Der QR-Code ist der Weg für Handys ohne NFC.
- Ersetzt bei Turnieren das Anstoßen der Handys: Am Tisch ist sofort klar, wer gegen wen spielt.

### Umsetzung (Vorschlag)
- Feste Lobby pro Tisch statt zufälligem 4-stelligem Code (`tisch` als fester Schlüssel der Knecht-Session), wird nach Spielende automatisch wieder frei.
- Optional: Turnier-Spielplan kennt die Tisch-Zuordnung → das Spiel (Gruppe / K.o.) ist beim Beitreten schon ausgewählt.
- Zusätzlich in jeder Lobby einen QR-Code anzeigen (Einladung ohne Code-Eintippen).
- Sticker: NTAG213/215, Link per App (z. B. NFC Tools) beschreiben, QR-Code daneben drucken.

### Zeitpunkt
Für das BiPo Open 2027.

### Bezug
Baut auf dem Mehrspieler-Knecht (Standard-Profil, `/Mitspielen`, Lobby, ein Handy pro Spieler) auf.
