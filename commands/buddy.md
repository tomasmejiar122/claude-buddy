---
description: Elige qué muestra la barra de estado en este proyecto (personaje, reloj, frase, tamaño y datos)
allowed-tools: Read, Write, Edit, AskUserQuestion
---

Configura claude-buddy (la barra de estado) para la carpeta actual: `$ARGUMENTS`

Todo vive en `~/.claude/claude-buddy.json`. Cada carpeta se guarda en
`projects` con su ruta absoluta en minúsculas y barras normales (`/`), y cubre
lo que haya dentro:

```json
{
  "projects": {
    "c:/users/tomas/onedrive/irrelevant/web": {
      "show": ["character", "clock"],
      "character": "gato",
      "size": "normal",
      "text": "think ai",
      "color": "degradado",
      "segments": ["model", "dir", "git", "context", "mood"]
    }
  }
}
```

- **`show`**: qué va a la derecha, en orden. Puede traer `character`, `clock`
  (reloj en pixel art) y `text` (la frase de `text`), o quedar vacío.
- **`character`**: `mr`, `marciano`, `gato`, `perro`, `robot`, `fantasma`,
  `rana`, `pinguino`, `panda`, `buho`, `slime` o `auto` (uno fijo elegido a
  partir del nombre de la carpeta).
- **`size`**: `mini` (4 líneas), `normal` (7 líneas), `grande` (13 líneas).
  Afecta al personaje y a las letras del reloj y las frases.
- **`color`** (del reloj y las frases): `degradado` (los morados de la marca),
  `arcoiris`, `contexto` (verde, amarillo o rojo según lo lleno que esté) o un
  color fijo en RGB, por ejemplo `[255, 180, 60]`.
- **`segments`**: los datos de la izquierda, en orden: `model`, `dir`, `git`,
  `context`, `mood`, `clock`, `session` (duración de la sesión), `lines`
  (líneas añadidas y quitadas). Los predeterminados son `model`, `dir`, `git`,
  `context`, `mood`.

## Qué hacer

1. Lee `~/.claude/claude-buddy.json` (si no existe, créalo con `{}`) y mira qué
   tiene ya esta carpeta.

2. **Si `$ARGUMENTS` viene vacío, usa `AskUserQuestion`** en vez de pedir que
   escriba nombres. Primera llamada, tres preguntas juntas:

   - **¿Qué pongo a la derecha?** (header "A la derecha"):
     `Un personaje`, `Un reloj en pixel art`, `Personaje y reloj`,
     `Una frase en pixel art`.
   - **Tamaño** (header "Tamaño"): `Dejar como está`, `mini · 4 líneas`,
     `normal · 7 líneas`, `grande · 13 líneas`.
   - **Datos a la izquierda** (header "Datos", multiSelect):
     `Reloj pequeño`, `Duración de la sesión`, `Líneas +/-`,
     `Sin estado de ánimo`. Lo que no marque se queda como está.

   Después, según lo que responda:
   - si eligió personaje, una segunda llamada con la **familia**
     (`Mr Irrelevant`, `Mascotas`, `Aves y anfibios`, `Criaturas`) y luego una
     tercera con los personajes de esa familia:
     mascotas = gato, perro, panda · aves y anfibios = búho, pingüino, rana ·
     criaturas = marciano, robot, fantasma, slime. Añade `Automático por
     carpeta` cuando quepa;
   - si eligió reloj o frase, una llamada con el **color**
     (`Degradado morado`, `Arcoíris`, `Según el contexto`) y, para la frase,
     pídele el texto (puede escribirlo en "Other").

   Agrupa las preguntas en la menor cantidad de llamadas posible: cada llamada
   admite hasta 4 preguntas y cada pregunta hasta 4 opciones.

3. **Si `$ARGUMENTS` trae texto**, no muestres menús: interprétalo. Puede traer
   un personaje (`gato`, `mr`, `auto`), un tamaño (`mini`, `normal`, `grande`),
   `reloj`, `frase "think ai"`, `color arcoiris`, segmentos
   (`segments model dir git context clock`, `con reloj`, `sin mood`) o `reset`
   para borrar la configuración de esta carpeta. Si algo no se entiende, dilo y
   muestra las opciones.

4. Escribe solo las claves que se pidieron, conservando el resto de la entrada
   de esta carpeta y del archivo.

5. Responde en dos o tres líneas: qué quedó configurado y que la barra se
   actualiza sola en uno o dos segundos.

No toques `settings.json` ni ningún otro archivo.
