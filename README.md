# Lletrimon

Lletrimon és una aplicació web de suport a la lectura, pensada especialment per a infants i persones que s'estan aprenent a llegir o que presenten dificultats de lectura (com la dislèxia). Utilitza **reconeixement de veu** per avaluar en temps real com el jugador llegeix síl·labes, paraules, pseudoparaules i frases.

---

## Com jugar

1. **Tria un perfil** (o crea'n un de nou a la pantalla de perfils).
2. Des de la pantalla d'inici pots veure el teu **nivell**, la **barra d'experiència (XP)**, l'**objectiu diari** i la **ratxa de dies**.
3. Prem **"Practicar ara!"** per anar a la pantalla d'exercicis.
4. **Selecciona el tipus d'exercici** que vols practicar:
   - 🔤 **Síl·labes** – llegeix síl·labes soltes (ex. "ma", "pe").
   - 📝 **Paraules** – llegeix paraules senceres.
   - 🔮 **Pseudoparaules** – llegeix paraules inventades (útil per detectar dislèxia).
   - 📖 **Frases** – llegeix frases completes.
5. **Selecciona la dificultat**: Fàcil 🟢, Mitjà 🟡 o Difícil 🔴.
6. Escull un **conjunt d'exercicis** de la llista i prem **"▶ Comença!"**.
7. Quan l'exercici s'iniciï, **llegeix en veu alta** el text que apareix a la pantalla. El micròfon enregistra la teva veu i l'aplicació calcula quant s'assembla al text esperat.
   - ✅ **Correcte** – similitud ≥ 85 %.
   - 🟡 **Gairebé** – similitud entre 60 % i 85 %.
   - ❌ **Incorrecte** – similitud < 60 %.
8. En el **mode síl·labes difícil**, si comets un error l'element es torna a posar a la cua fins que l'encertis.
9. El **mode sense fi** (🔄) agafa tots els elements del filtre actual i va passant d'un a l'altre fins que acabes.
10. En finalitzar l'exercici veus la puntuació final (% de respostes correctes) i s'actualitza la teva progressió.

---

## Sistema d'assoliments

### Experiència i nivells

Cada exercici completat aporta **punts d'experiència (XP)**:

| Dificultat | XP base |
|------------|---------|
| Fàcil      | fins a 10 XP |
| Mitjà      | fins a 20 XP |
| Difícil    | fins a 35 XP |

A més, si respons ràpidament (<3 s) guanyes **5 XP** extra (2 XP si <5 s). L'XP acumulada augmenta el teu **nivell** (fins al nivell 10 i més).

### Objectiu diari

Cada dia tens un repte de completar **5 exercicis**. Una vegada assolit, el progrés es reinicia l'endemà.

### Ratxa de dies (🔥 Streak)

Cada dia que completes almenys un exercici suma un dia a la teva **ratxa**. Si un dia no practiques, la ratxa es reinicia a 0.

### Insígnies (Badges)

| Insígnia | Condició |
|----------|----------|
| ⭐ Primer Pas | Completa el teu primer exercici |
| 🔥 Constant | 3 dies de ratxa consecutius |
| 🔥🔥 Setmana de Foc | 7 dies de ratxa consecutius |
| 🏆 Lector Imparable | 30 dies de ratxa consecutius |
| 💯 Perfecte! | Puntua 100 % en un exercici |
| ⚡ Lector Ràpid | Llegeix 5 paraules en menys de 2 s cadascuna |
| 🎯 Mestre de Síl·labes | Completa 20 exercicis de síl·labes |
| 📚 Mestre de Paraules | Completa 20 exercicis de paraules |
| 📖 Mestre de Frases | Completa 10 exercicis de frases |
| 🌟 Nivell 5 | Arriba al nivell 5 |
| 👑 Nivell 10 | Arriba al nivell 10 |

### Col·lecció Pokémon (🐾)

Pots desbloquejar **200 Pokémon** de la primera generació:

- **Pokémon 1–100**: es desbloquegen per **progrés** – el Pokémon N es desbloqueja quan arribes al nivell N d'experiència.
- **Pokémon 101–200**: es desbloquegen per **fites** – el Pokémon 100+M es desbloqueja quan aconsegueixes M insígnies.

---

## Tecnologia

- **Frontend**: React + TypeScript + Vite
- **Emmagatzematge local**: IndexedDB via Dexie (sense necessitat de servidor)
- **Autenticació opcional**: Supabase (email + contrasenya) per sincronitzar perfils
- **Reconeixement de veu**: Web Speech API al web i MediaRecorder + Whisper a Android
- **Linter**: oxlint
- **Documentació tècnica (arquitectura i stack)**: [DOCUMENTACIO_TECNICA.md](./DOCUMENTACIO_TECNICA.md)

### Comandes de desenvolupament

```bash
npm run dev      # servidor de desenvolupament
npm run build    # compilar per a producció
npm run lint     # linter (oxlint)
```

### Android (Capacitor)

Requisits: Node.js 22 o superior, JDK 17, Android Studio i Android SDK 36. Configura
`ANDROID_HOME` i les variables `VITE_SUPABASE_URL` i `VITE_SUPABASE_ANON_KEY`
abans de compilar. L'aplicació, les dades d'exercicis i IndexedDB són locals i
es poden carregar sense xarxa. La transcripció Whisper, l'autenticació/sincronització
Supabase, les batalles i les imatges remotes sí que necessiten Internet.

```bash
npm install
npm run android:sync   # compila el web natiu i sincronitza Android
npm run android:open   # obre el projecte a Android Studio
npm run android:debug  # crea android/app/build/outputs/apk/debug/app-debug.apk
```

Per crear un AAB de distribució:

1. Executa `npm run android:sync` i `npm run android:open`.
2. A Android Studio, selecciona **Build > Generate Signed App Bundle or APK**,
   **Android App Bundle**, el mòdul `app`, la clau de signatura i la variant
   `release`.
3. Recull l'AAB signat que indica l'assistent (habitualment
   `android/app/release/app-release.aab`).

Amb una configuració de signatura `release` ja definida a Gradle també es pot
executar `cd android && ./gradlew bundleRelease`; el resultat és
`android/app/build/outputs/bundle/release/app-release.aab`. No versionis claus
ni contrasenyes de signatura.