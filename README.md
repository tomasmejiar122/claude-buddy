# claude-buddy

**Mr Irrelevant** en la barra de estado de [Claude Code](https://code.claude.com): un personaje en pixel art que te acompaña mientras trabajas. Casi siempre está tranquilo, a veces saluda, celebra cuando Claude trabaja y se cansa a medida que se llena el contexto.

<!-- Demo: graba la barra (ScreenToGif sirve), guárdala en docs/demo.gif y descomenta la línea de abajo
![claude-buddy en acción](docs/demo.gif)
-->

```
Opus 5 | mi-proyecto | main* ↑2          ▄▄▀▀▀▀▄▄
▓▓▓▓░░░░░░ 42%                          (Mr Irrelevant
                                          en pixel art)
```

## Qué hace

- **Mr Irrelevant, tranquilo.** Casi siempre está de pie y parpadea de vez en cuando. A ratos saluda, mira a un lado o cruza los brazos.
- **Celebra cuando Claude trabaja.** Levanta los brazos, le brillan chispas y su color pasa por el degradado de la marca.
- **Te avisa del contexto.** A partir del 50% entrecierra los ojos y se va oscureciendo; por encima del 80% suda y te sugiere hacer `/compact`.
- **Barra de estado completa.** Modelo, carpeta, rama de git (`*` cambios sin commit, `↑` / `↓` commits por subir o bajar) y una barra de contexto por colores.
- **Ligero.** Está hecho en Node.js sin dependencias: cada actualización tarda del orden de 100 ms.

## Muñequitos por proyecto (opcional)

Si prefieres un muñequito distinto en cada proyecto, crea `~/.claude/claude-buddy.json`:

```json
{
  "mode": "buddies",
  "mrIrrelevant": ["C:/Users/TU_USUARIO/proyectos/importante"]
}
```

Con `"mode": "buddies"` cada carpeta recibe un muñequito de 3 líneas (blob, robot, gato, oso, nube o fantasma) con su propio color, siempre el mismo para la misma carpeta. Ese muñequito camina, mira, saluda y salta, y se pone en arcoíris cuando Claude trabaja. Las carpetas de `mrIrrelevant`, con todo lo que tengan dentro, siguen mostrando a Mr. También admite comodines como `*`.

Sin ese archivo, Mr aparece en todas partes.

## Requisitos

- [Claude Code](https://code.claude.com) en la terminal. La barra de estado no existe en la app de chat de Claude.
- [Node.js](https://nodejs.org) 18 o más reciente.
- Git, para la información de la rama (opcional).
- Una terminal con colores de 24 bits (Warp, Windows Terminal, WezTerm, iTerm2…).

## Instalación

En Windows, con PowerShell 7:

```powershell
irm https://raw.githubusercontent.com/tomasmejiar122/claude-buddy/main/install.ps1 | iex
```

O clonando el repo:

```powershell
git clone https://github.com/tomasmejiar122/claude-buddy
cd claude-buddy
./install.ps1
```

El instalador copia `claude-buddy.mjs` a `~/.claude/` y configura `statusLine` en `~/.claude/settings.json`. El resto de tu configuración no se toca, y antes de cambiar nada guarda una copia en `settings.json.bak`.

<details>
<summary>Instalación manual (macOS, Linux o Windows)</summary>

Copia `claude-buddy.mjs` a `~/.claude/` y añade esto a `~/.claude/settings.json`, ajustando la ruta:

```json
"statusLine": {
  "type": "command",
  "command": "node \"/Users/TU_USUARIO/.claude/claude-buddy.mjs\"",
  "refreshInterval": 2
}
```

</details>

## Desinstalar

```powershell
./install.ps1 -Uninstall
```

Quita el `statusLine` de claude-buddy y borra el script.

## Personalizar

Todo está en `claude-buddy.mjs`:

- **Poses de Mr:** el objeto `poses`. Cada letra es un píxel: `P` cuerpo, `L` brillo, `E` sombra, `K` montura de las gafas, `W` brillo del ojo, `M` boca, `R` lengua, `S` chispas; `.` es transparente.
- **Colores:** el objeto `pal` para Mr y la lista `palette` para los muñequitos.
- **Qué tan seguido hace cada cosa:** las probabilidades en los bloques de `rand(100)`.
- **Velocidad:** `refreshInterval` en `settings.json`, en segundos. Con valores más altos se mueve menos y consume menos.

## Cómo funciona

Claude Code ejecuta el script cada `refreshInterval` segundos y le pasa por stdin un JSON con los datos de la sesión. El script dibuja la información a la izquierda y el personaje a la derecha. Mr está hecho con medios bloques (`▀`): cada carácter muestra dos píxeles, uno con el color de la letra y otro con el color de fondo. El estado de la animación se guarda en un archivo pequeño por sesión en la carpeta temporal. Para saber si Claude está trabajando, el script mira si el historial de la sesión cambió en los últimos segundos.

## Licencia

[MIT](LICENSE)
