---
description: Elige el personaje, el tamaño y los datos de la barra de estado para este proyecto
allowed-tools: Read, Write, Edit
---

Configura claude-buddy (la barra de estado) para la carpeta actual: `$ARGUMENTS`

La configuración vive en `~/.claude/claude-buddy.json`. Cada carpeta se guarda
en `projects` con su ruta absoluta en minúsculas y barras normales (`/`), y
cubre todo lo que haya dentro:

```json
{
  "projects": {
    "c:/users/tomas/onedrive/irrelevant/web": {
      "character": "gato",
      "size": "normal",
      "segments": ["model", "dir", "git", "context", "mood"]
    }
  }
}
```

**Personajes:** `mr` (Mr Irrelevant), `marciano`, `gato`, `perro`, `robot`,
`fantasma`, `rana`, `pinguino`, `panda`, `buho`, `slime`, y `auto` (uno fijo
elegido a partir del nombre de la carpeta).

**Tamaños:** `mini` (4 líneas, solo la cabeza), `normal` (7 líneas), `grande`
(13 líneas).

**Segmentos** (en el orden que se escriban; se acomodan solos en varias líneas):
`model`, `dir`, `git`, `context`, `mood`, `clock`, `session` (duración de la
sesión), `lines` (líneas añadidas y quitadas).

## Qué hacer

1. Lee `~/.claude/claude-buddy.json` (si no existe, créalo con `{}`).
2. Interpreta `$ARGUMENTS`, que puede traer cualquier combinación:
   - un personaje: `gato`, `mr`, `auto`…
   - un tamaño: `mini`, `normal`, `grande`
   - segmentos: `segments model dir git context clock` o `sin mood`, `con reloj`
   - `reset` para borrar la configuración de esta carpeta
   - vacío: no cambies nada.
3. Escribe solo las claves que el usuario pidió, conservando el resto de la
   entrada de esta carpeta y del archivo.
4. Responde en dos o tres líneas: qué quedó configurado para esta carpeta
   (personaje, tamaño y segmentos) y la lista de personajes disponibles si el
   usuario no pidió ninguno en concreto. Recuérdale que la barra se actualiza
   sola en uno o dos segundos.

No toques `settings.json` ni ningún otro archivo.
