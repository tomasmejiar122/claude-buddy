# claude-buddy

Un muñequito animado que vive en la barra de estado de [Claude Code](https://code.claude.com). Cada proyecto tiene el suyo, se mueve mientras esperas, se emociona cuando Claude trabaja y se cansa a medida que se llena el contexto.

<!-- Demo: graba la barra en movimiento (ScreenToGif sirve), guárdala en docs/demo.gif y descomenta la línea de abajo
![claude-buddy en acción](docs/demo.gif)
-->

```
Opus 5 | mi-proyecto | main* ↑2        (o)─(o)
▓▓▓▓░░░░░░ 42%                         │ ^ ^ │/
                                       ╰┬───┬╯
```

## Qué hace

- **Un muñequito por proyecto.** El nombre de la carpeta decide su cuerpo (blob, robot, gato, oso, nube o fantasma) y su color. Siempre es el mismo para el mismo proyecto.
- **Tiene vida propia.** Casi siempre está quieto mirando al frente, pero de vez en cuando camina, mira a los lados, saluda o salta.
- **Se emociona cuando Claude trabaja.** Cambia de colores en arcoíris, mueve los brazos, lee de un lado a otro y le salen chispas.
- **Te avisa del contexto.** A partir del 50% entrecierra los ojos y se va tiñendo de rojo; por encima del 80% suda y te sugiere hacer `/compact`.
- **Barra de estado completa.** Modelo, carpeta, rama de git (`*` cambios sin commit, `↑` / `↓` commits por subir o bajar) y una barra de contexto por colores.

## Requisitos

- [Claude Code](https://code.claude.com)
- [PowerShell 7](https://learn.microsoft.com/powershell/scripting/install/installing-powershell) (`pwsh`)
- Git, para la información de la rama (opcional)
- Una terminal con colores de 24 bits y buena fuente Unicode (Warp, Windows Terminal, WezTerm, iTerm2…)

Probado en Windows 11. En macOS y Linux debería funcionar con PowerShell 7 instalado, pero aún no está probado: si lo usas allí, cuéntame cómo te fue.

## Instalación

En PowerShell 7:

```powershell
irm https://raw.githubusercontent.com/tomasmejiar122/claude-buddy/main/install.ps1 | iex
```

O clonando el repo:

```powershell
git clone https://github.com/tomasmejiar122/claude-buddy
cd claude-buddy
./install.ps1
```

El instalador copia `claude-buddy.ps1` a `~/.claude/` y configura `statusLine` en `~/.claude/settings.json`. El resto de tu configuración no se toca, y antes de cambiar nada guarda una copia en `settings.json.bak`.

<details>
<summary>Instalación manual</summary>

Copia `claude-buddy.ps1` a `~/.claude/` y añade esto a `~/.claude/settings.json`, ajustando la ruta:

```json
"statusLine": {
  "type": "command",
  "command": "pwsh -NoProfile -ExecutionPolicy Bypass -File \"C:/Users/TU_USUARIO/.claude/claude-buddy.ps1\"",
  "refreshInterval": 1
}
```

</details>

## Desinstalar

```powershell
./install.ps1 -Uninstall
```

Quita el `statusLine` de claude-buddy y borra el script.

## Personalizar

Todo está en `claude-buddy.ps1`:

- **Cuerpos:** la lista `$bodies`. Cada cuerpo mide 7 columnas de ancho.
- **Colores:** la lista `$palette`, en RGB.
- **Qué tan seguido hace cada cosa:** las probabilidades en la parte de `Get-Random` (45% quieto, 25% caminar, 15% mirar, 10% saludar, 5% saltar).
- **Velocidad:** `refreshInterval` en `settings.json`. Con `2` o `3` se mueve más despacio y consume menos.

## Cómo funciona

Claude Code ejecuta el script cada segundo (`refreshInterval: 1`) y le pasa por stdin un JSON con los datos de la sesión. El script dibuja tres líneas: la información a la izquierda y el muñequito a la derecha. La posición y la acción del muñequito se guardan en un archivo pequeño por sesión en la carpeta temporal, así avanza un paso por cuadro. Para saber si Claude está trabajando, mira si el historial de la sesión cambió en los últimos segundos.

Cada ejecución tarda alrededor de medio segundo, casi todo en el arranque de PowerShell.

## Licencia

[MIT](LICENSE)
