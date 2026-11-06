# Tag: Einrichtung am iPhone

## 1. App online stellen (einmalig, ca. 3 Minuten)

Die App wird über **GitHub Pages** veröffentlicht. Das ist kostenlos.

1. Branch `claude/hallo-a8sny5` in `main` mergen, zum Beispiel über einen Pull Request.
2. Auf GitHub im Repo: **Settings → Pages → Source: „GitHub Actions“** auswählen.
3. Unter **Actions** startet „App veröffentlichen“. Wenn es grün ist, läuft die App hier:
   `https://julianp-cyberpunk.github.io/Test/`

Hinweis: Mit einem kostenlosen GitHub-Konto funktioniert Pages nur bei **öffentlichen** Repos. Die App selbst enthält keine persönlichen Daten. Deine Haken und Einträge bleiben nur auf deinem iPhone.

## 2. Auf den Home-Bildschirm

1. Den Link in **Safari** öffnen.
2. Unten auf **Teilen** tippen, dann **„Zum Home-Bildschirm“**.
3. Ab jetzt öffnest du „Tag“ wie eine normale App, im Vollbild und auch offline.

Wichtig: Öffne die App immer über das Icon. Safari und das Icon speichern getrennt.

## 3. Erinnerung „Leg dein Handy weg“

Web-Apps dürfen auf dem iPhone keine Erinnerungen zu festen Zeiten schicken. Das übernimmt die **Kurzbefehle-App**:

1. **Kurzbefehle** öffnen, unten **Automation**, dann **+**.
2. **Tageszeit** wählen, zum Beispiel **00:00** (30 Minuten vor deiner Handy-weg-Zeit), **Täglich**.
3. **Sofort ausführen** einschalten.
4. Aktion **„Mitteilung anzeigen“** hinzufügen. Text zum Beispiel:
   *„Noch 30 Minuten. Dann Handy weg und Brick drauf.“*
5. Eine zweite Automation zur Handy-weg-Zeit selbst, zum Beispiel 00:30:
   *„Jetzt. Handy weg. Morgen früh wirst du dir danken.“*

Tipp: Verschiebe beide Zeiten jede Woche um 15 Minuten nach vorne. Ändere die Zeit auch in der App unter Einstellungen (Zahnrad).

## 4. Brick verknüpfen

Brick hat keine offene Schnittstelle. Andere Apps können Brick also nicht direkt steuern, und Brick kann nichts an „Tag“ melden. Mit Kurzbefehlen geht trotzdem viel:

**Lob beim Bricken**
1. Automation **+**, dann **App**, dann **Brick**, dann **„Wird geöffnet“**, **Sofort ausführen**.
2. Aktion **„Mitteilung anzeigen“**: *„Stark. Handy weg, Leben an.“*

**Brick in die Abendroutine einbauen**
- In der Abend-Automation aus Schritt 3 nach der Mitteilung die Aktion **„App öffnen“ → Brick** anhängen. Dann ist Brick sofort offen, wenn die Erinnerung kommt.

**In der App**
- Der große Knopf **„Handy weg“** zählt mit, wie oft du dein Handy weggelegt hast. Tipp darauf, wenn du gebrickt hast.

## 5. Morgens

Automation **„Wecker“, dann „Wird gestoppt“**, Aktion **„Mitteilung anzeigen“**:
*„Handy bleibt noch liegen. Erst Wasser, dann Licht.“*

## Was die App kann

- **Spruch des Tages**: jeden Tag ein anderer, „Anderer Spruch“ für einen neuen
- **Deine eine Sache heute**: ein einziges Ziel pro Tag
- **Morgen- und Abendroutine**: zum Abhaken, mit 🔥-Serie. Bearbeiten über das Zahnrad
- **Handy weg**: zeigt, wie lange es noch bis zu deiner Handy-weg-Zeit ist
- **Was mach ich jetzt?**: Ideen für Sport, Skills, Lesen, Bauen, Rausgehen, kleine Erfolge, Kopf frei und kleinen Kontakt
- **Ich will scrollen**: 10-Minuten-Timer mit Atemkreis und einer Sache, die du stattdessen machen kannst

Alle Ideen und Sprüche stehen in `data.js` und lassen sich leicht erweitern.
