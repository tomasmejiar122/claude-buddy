---
description: Elige el personaje, el tamaño y los datos de la barra de estado para este proyecto
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
      "character": "gato",
      "size": "normal",
      "segments": ["model", "dir", "git", "context", "mood", "clock"]
    }
  }
}
```

- **`character`**: `mr`, `marciano`, `gato`, `perro`, `robot`, `fantasma`,
  `rana`, `pinguino`, `panda`, `buho`, `slime` o `auto` (uno fijo elegido a
  partir del nombre de la carpeta).
- **`size`**: `mini` (4 líneas), `normal` (7 líneas), `grande` (13 líneas).
- **`segments`**: los datos de la izquierda, en orden: `model`, `dir`, `git`,
  `context`, `mood`, `clock` (la hora), `session` (duración de la sesión),
  `lines` (líneas añadidas y quitadas). Los predeterminados son `model`,
  `dir`, `git`, `context`, `mood`.
- **`at`**: dónde empieza el personaje. `"right"` (lo predeterminado) lo pega
  al borde derecho de la terminal; `0` lo pone justo después del texto; un
  número lo fija en esa columna.
- **`margin`**: columnas libres al borde derecho, `4` por defecto. Súbelo si el
  personaje se ve cortado.
- **`align`**: `left` (por defecto) o `center` para el bloque de texto.

## Qué hacer

1. Lee `~/.claude/claude-buddy.json` (si no existe, créalo con `{}`) y mira qué
   tiene ya esta carpeta.

2. **Si `$ARGUMENTS` viene vacío, usa `AskUserQuestion`** en vez de pedir que
   escriba nombres. Primera llamada, tres preguntas juntas:

   - **Personaje** (header "Personaje"): `Mr Irrelevant`, `Mascotas (gato,
     perro, panda)`, `Aves y anfibios (búho, pingüino, rana)`,
     `Criaturas (marciano, robot, fantasma, slime)`. Pon primero lo que ya
     tiene esta carpeta.
   - **Tamaño** (header "Tamaño"): `Dejar como está`, `mini · 4 líneas`,
     `normal · 7 líneas`, `grande · 13 líneas`.
   - **Datos** (header "Datos", multiSelect): `Hora`, `Duración de la sesión`,
     `Líneas +/-`, `Sin estado de ánimo`. Lo que no marque se queda como está.

   Si eligió una familia, haz una segunda llamada con una sola pregunta que
   liste esos 3 o 4 personajes, más `Automático por carpeta` cuando quepa.
   Quien quiera otro siempre puede escribirlo en "Other".

3. **Si `$ARGUMENTS` trae texto**, no muestres menús: interprétalo. Puede traer
   un personaje (`gato`, `mr`, `auto`), un tamaño (`mini`, `normal`, `grande`),
   la posición (`derecha 90`, `pegado`), segmentos (`segments model dir git
   context clock`, `con hora`, `sin mood`) o `reset` para borrar la
   configuración de esta carpeta. Si algo no se entiende, dilo y muestra las
   opciones.

4. Escribe solo las claves que se pidieron, conservando el resto de la entrada
   de esta carpeta y del archivo.

5. Responde en dos o tres líneas: qué quedó configurado y que la barra se
   actualiza sola en uno o dos segundos.

No toques `settings.json` ni ningún otro archivo.
