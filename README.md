# artz

Página de apresentação de coisas que fiz — com o **Molina Runner** embutido no
topo: um mini jogo 2D estilo endless runner que já aparece com o personagem
correndo em modo demonstração. Aperte **START** (ou a barra de espaço) para
começar a partida.

## O jogo

- **Espaço / ↑ / toque na tela** — pular (segure para pular mais alto)
- **↓** — abaixar (passa por baixo dos e-mails voadores ✉️)
- Fuja dos bugs 🐛, aliens 👾 e incidentes em produção 🔥. A velocidade aumenta
  com o tempo e o recorde fica salvo no navegador.

## Estrutura

- `index.html` — página de apresentação com o jogo embutido
- `assets/game.js` — o jogo (canvas 2D, vanilla JS, sem dependências)
- `assets/sprites/sheet_original.png` — sprite sheet original do personagem
- `assets/sprites/frame_*.png` — frames recortados com fundo transparente
- `assets/video/running.mp4` — vídeo do personagem correndo (tela de game over)

Para rodar localmente:

```sh
python3 -m http.server 8000
# abra http://localhost:8000
```
