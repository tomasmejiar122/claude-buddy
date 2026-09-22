---
description: Elige el personaje, el tamaño y los datos de la barra de estado para este proyecto
allowed-tools: Read, Write, Edit, AskUserQuestion
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
sesión), `lines` (líneas añadidas y quitadas). Los predeterminados son
`model`, `dir`, `git`, `context`, `mood`.

## Qué hacer

1. Lee `~/.claude/claude-buddy.json` (si no existe, créalo con `{}`) y mira qué
   tiene ya esta carpeta.

2. **Si `$ARGUMENTS` viene vacío, muestra menús con `AskUserQuestion`** en vez
   de pedir que escriba nombres. Primera llamada, tres preguntas juntas:
   - **Personaje** (header "Personaje"): `Mascotas (gato, perro, panda)`,
     `Aves y anfibios (búho, pingüino, rana)`,
     `Criaturas (marciano, robot, fantasma, slime)`,
     `Mr Irrelevant`. En la descripción de cada opción di qué trae.
   - **Tamaño** (header "Tamaño"): `Dejar como está`, `mini · 4 líneas, solo la
     cabeza`, `normal · 7 líneas`, `grande · 13 líneas`.
   - **Extras** (header "Extras", multiSelect): `Reloj`, `Duración de la
     sesión`, `Líneas +/-`, `Sin estado de ánimo`. Explica que lo no marcado
     deja los datos predeterminados.

   Si eligió una familia de personajes, haz una segunda llamada con una sola
   pregunta que liste esos 3 o 4 personajes (más `Automático por carpeta` si
   sobra espacio). Quien quiera otro siempre puede escribirlo en "Other".

3. **Si `$ARGUMENTS` trae texto**, no muestres menús: interprétalo. Puede traer
   un personaje (`gato`, `mr`, `auto`), un tamaño (`mini`, `normal`, `grande`),
   segmentos (`segments model dir git context clock`, `con reloj`, `sin mood`)
   o `reset` para borrar la configuración de esta carpeta. Si algo no se
   entiende, dilo y muestra las opciones.

4. Escribe solo las claves que se pidieron, conservando el resto de la entrada
   de esta carpeta y del archivo. Con los extras, parte de los segmentos
   actuales (o de los predeterminados) y añade `clock`, `session` o `lines`, o
   quita `mood`, según lo marcado.

5. Responde en dos o tres líneas: qué quedó configurado para esta carpeta
   (personaje, tamaño y segmentos) y recuerda que la barra se actualiza sola en
   uno o dos segundos.

No toques `settings.json` ni ningún otro archivo.
